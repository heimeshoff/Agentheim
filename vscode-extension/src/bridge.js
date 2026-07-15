// Testable core of the Agentheim VS Code bridge (ADR-0018, diverging from
// ADR-0002 only on the fixed-port + discovery clause).
//
// A `node:http` listener bound to 127.0.0.1 ONLY. On a token-bearing POST /run
// it invokes an injected `launchClaude({ command, args })` callback — the single
// seam the editor owns (`vscode.window.createTerminal` lives in extension.js).
// The core emits a structured launch DESCRIPTOR (raw argv), never a shell command
// string, so no shell ever parses builder text (ADR-0018, amended 2026-06-16).
// Everything contractual (loopback bind, fallback ladder, per-activation token,
// bridge.json discovery file, body/CORS handling) lives here so it is unit-
// testable without the editor.
//
// Stdlib only: node:http, node:crypto, node:fs, node:path. No runtime deps.

const http = require('node:http');
const crypto = require('node:crypto');
const { mkdirSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const path = require('node:path');

// The fixed port literal is arbitrary-but-fixed; the contract is the discovery
// file, not the number. Bounded fallback ladder on EADDRINUSE.
const PREFERRED_PORTS = [31425, 31426, 31427];

// Carried on every request; the listener rejects any request lacking/mismatching it.
const TOKEN_HEADER = 'X-Agentheim-Bridge-Token';
const TOKEN_HEADER_LC = TOKEN_HEADER.toLowerCase();

// bridge.json schema version (kept in the file so a future reader can branch).
const BRIDGE_V = 1;

// The POST /run fields THIS build of makeHandler actually reads (the
// `parsed?.<field>` convention below) — the authoritative capability
// handshake (ADR-0018, amended by infrastructure-v8r3q). GET /health sources
// this straight from the live process's own in-memory constant, so it
// structurally cannot go stale the way bridge.json's last-writer-wins `v`
// can: there is no second process and no write-then-read race between the
// answering process and the process whose capabilities are being described.
// A vscode-extension/test/bridge.test.mjs structural guard scans this file's
// source for every `parsed?.<field>` reference inside makeHandler and asserts
// that set is EXACTLY new Set(CAPABILITIES) — adding a fifth /run field
// without adding it here (or vice versa) breaks the build, not merely a
// comment (the prose rule already failed three times: infrastructure-016,
// -c6fzb, -h5wnq each grew /run without touching any version signal).
const CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model'];

const DASHBOARD_DIR = '.dashboard';
const BRIDGE_NAME = 'bridge.json';

/** Absolute path to the gitignored bridge discovery file for a project root. */
function bridgePath(root) {
  return path.join(root, '.agentheim', DASHBOARD_DIR, BRIDGE_NAME);
}

/** Per-activation random token: 32 hex chars (16 bytes) via node:crypto. */
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Bind a server to 127.0.0.1, walking the fallback ladder on EADDRINUSE.
 * Resolves with the actually-bound port, rejects if the whole ladder is taken
 * (or on any non-EADDRINUSE error).
 */
function listenWithLadder(server, ports) {
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= ports.length) {
        reject(new Error(`All bridge ports busy: ${ports.join(', ')}`));
        return;
      }
      const port = ports[i++];
      const onError = (err) => {
        if (err && err.code === 'EADDRINUSE') {
          server.removeListener('error', onError);
          tryNext();
        } else {
          reject(err);
        }
      };
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError);
        // Read back the actually-bound port (port 0 ⇒ OS-assigned ephemeral).
        const bound = server.address();
        resolve(bound && typeof bound === 'object' ? bound.port : port);
      });
    };
    tryNext();
  });
}

function applyCors(res, req) {
  // Loopback-only bind is the real trust boundary; the token header is the
  // shared secret. CORS here is purely to let the browser's preflight pass so
  // the custom-header POST can fire at all (ADR-0018: preflight is load-bearing).
  const origin = req.headers.origin || '*';
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', `${TOKEN_HEADER}, Content-Type`);
  res.setHeader('access-control-max-age', '600');
}

function send(res, status, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  // Drain any unread request body before replying. Responding mid-upload makes
  // the OS reset the connection (ECONNRESET on the client), so we let the
  // inbound stream finish first when there is still data to come.
  const req = res.req;
  const finish = () => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(body);
  };
  if (req && req.readable && !req.readableEnded) {
    req.resume();
    req.once('end', finish);
    req.once('error', finish);
  } else {
    finish();
  }
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Build the request handler. `token` gates every request; `launchClaude` is the
 * injected editor action invoked with a structured launch descriptor
 * `{ command: 'claude', args: [...] }`. The prompt is carried as a single raw
 * argv element — no shell, no quoting, no escaping — so any character the builder
 * typed (`"`, `'`, `` ` ``, `$`, `&`, `|`, `;`, `$(...)`) reaches the spawned
 * `claude` session verbatim. The optional `--dangerously-skip-permissions` flag
 * is prepended ONLY on a strict-`true` `skipPermissions` (ADR-0018, amended
 * 2026-06-16).
 */
function makeHandler({ token, launchClaude }) {
  return async function handler(req, res) {
    applyCors(res, req);

    // Answer the browser preflight before any auth — preflights carry no
    // custom headers, so gating them on the token would break the real POST.
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Shared-secret gate (timing-safe compare of equal-length buffers).
    const presented = req.headers[TOKEN_HEADER_LC];
    if (!presented || !tokensMatch(presented, token)) {
      send(res, 401, { error: 'unauthorized' });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      // capabilities is the authoritative signal (ADR-0018, infrastructure-v8r3q):
      // sourced from THIS process's own CAPABILITIES constant, never bridge.json's.
      send(res, 200, { ok: true, v: BRIDGE_V, capabilities: CAPABILITIES });
      return;
    }

    if (req.method === 'POST' && req.url === '/run') {
      let raw;
      try {
        raw = await readBody(req);
      } catch {
        send(res, 400, { error: 'bad body' });
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        send(res, 400, { error: 'malformed json' });
        return;
      }
      const prompt = typeof parsed?.prompt === 'string' ? parsed.prompt.trim() : '';
      if (!prompt) {
        send(res, 400, { error: 'empty prompt' });
        return;
      }
      // Opt-in permission bypass (ADR-0018, amended 2026-06-14). The flag is
      // prepended ONLY on a strict-`true` identity check — field absent, `false`,
      // `null`, the string "true", a number, or anything else falls through to
      // the prompt-gated default `args = [prompt]`, so malformed input never
      // silently enables the bypass. The prompt is a single RAW argv element:
      // no quoting, no escaping (ADR-0018, amended 2026-06-16). The OS passes it
      // to the spawned `claude` verbatim, so no shell can corrupt it.
      const skip = parsed?.skipPermissions === true;
      const existingArgs = skip ? ['--dangerously-skip-permissions', prompt] : [prompt];
      // Session name (ADR-0018, amended by infrastructure-c6fzb): an explicit,
      // sanitized `name` field when supplied, else a fallback derived from the
      // prompt (`/agentheim:<skill> …` -> `<skill>: …`; plain text -> the
      // prompt itself). Rides as its own raw argv pair `-n <name>` ahead of
      // the skip-permissions flag and prompt — exactly the pattern the
      // `skipPermissions` flag already prepends by (infrastructure-016). No
      // shell parses it, so (like the prompt) it needs no quoting/escaping.
      const name = resolveSessionName({ name: parsed?.name, prompt });
      // Model selection (infrastructure-h5wnq): an optional `model` field rides
      // its own raw argv pair, `--model <id>`, ahead of the skip-permissions
      // flag and the prompt — after `-n <name>` (same discipline: no shell
      // parses it). The allowlist is the security boundary: anything outside
      // it (case mismatch, shell metacharacters, whitespace, a leading dash,
      // a full model id, a non-string) sanitizes to '' and simply produces NO
      // `--model` flag — never a 500, never a rejected request. The session
      // then inherits the user's own Claude Code config, exactly as if no
      // model field had been sent at all.
      const model = sanitizeModel(parsed?.model);
      const modelArgs = model ? ['--model', model] : [];
      const args = ['-n', name, ...modelArgs, ...existingArgs];
      try {
        launchClaude({ command: 'claude', args });
      } catch (err) {
        send(res, 500, { error: 'launch failed', detail: String(err && err.message) });
        return;
      }
      send(res, 202, { ok: true });
      return;
    }

    send(res, 404, { error: 'not found' });
  };
}

// Session name construction (infrastructure-c6fzb). The name rides the launch
// descriptor as a raw argv element ('-n', name), exactly the pattern the
// `skipPermissions` flag already uses (infrastructure-016) — no shell parses
// it, so it needs no quoting/escaping either (ADR-0018, amended 2026-06-16).
// Capped well below any reasonable terminal-tab/picker width; the cap is a
// courtesy, not a protocol limit.
const NAME_MAX_LEN = 60;

/**
 * Sanitize a candidate session name: strip control characters (including
 * newlines/tabs — a name is a single display label, never multi-line), trim,
 * and cap at NAME_MAX_LEN. A non-string input yields ''. Idempotent.
 * @param {*} raw
 * @returns {string}
 */
function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  const stripped = raw.replace(/[\x00-\x1F\x7F]/g, '');
  return stripped.trim().slice(0, NAME_MAX_LEN);
}

/**
 * Derive a fallback session name from the prompt when no usable explicit
 * `name` was supplied. `/agentheim:<skill> <rest>` -> `<skill>: <rest>` (the
 * skill the launch invokes, plus the builder's own text); any other prompt ->
 * the prompt text itself. Both branches are sanitized/capped identically to
 * an explicit name. The prompt itself is never mutated — this only reads it
 * to build a separate display label.
 *
 * Modeling carve-out (infrastructure-w6p4k, amends the c6fzb convention): a
 * `modeling` launch with trailing text names the session from that text
 * alone — no `modeling: ` prefix — because the builder found the prefix to
 * be noise specifically for modeling launches. A bare `/agentheim:modeling`
 * with no rest still falls through to the plain `modeling` label, same as
 * every other skill's bare-invocation case. Every other skill keeps the
 * uniform `<skill>: <rest>` convention unchanged.
 * @param {string} prompt — already-trimmed, known non-empty (POST /run
 *   rejects an empty prompt before this is ever called).
 * @returns {string}
 */
function deriveNameFromPrompt(prompt) {
  const match = /^\/agentheim:(\S+)\s*([\s\S]*)$/.exec(prompt);
  if (match) {
    const skill = match[1];
    const rest = match[2].trim();
    if (!rest) return sanitizeName(skill);
    return sanitizeName(skill === 'modeling' ? rest : `${skill}: ${rest}`);
  }
  return sanitizeName(prompt);
}

/**
 * Resolve the session name a POST /run will use: a sanitized explicit `name`
 * when one was supplied and survives sanitization, else a prompt-derived
 * fallback (infrastructure-c6fzb). Exported so tests can compute the expected
 * name for a given input without duplicating the derivation rules.
 * @param {{ name?: *, prompt: string }} args
 * @returns {string}
 */
function resolveSessionName({ name, prompt }) {
  const explicit = sanitizeName(name);
  return explicit || deriveNameFromPrompt(prompt);
}

// Model selection (infrastructure-h5wnq). `claude --model` accepts both short
// aliases (`fable`, `opus`, `sonnet`, `haiku` — confirmed via `claude --help`
// on the installed CLI) and full model ids (`claude-sonnet-5`, …). The
// allowlist holds only the short aliases: they track "the latest model" of
// their tier automatically, which is what the CLI's own help text documents
// first, and a pinned full id would silently go stale the day a new model
// ships under the same tier name. This is a CLOSED SET, not free text — the
// value reaches a spawned process (`launchClaude`), so anything outside it
// (case mismatch, shell metacharacters, whitespace, a leading dash, a full
// model id, a non-string) must sanitize to '' rather than ever touch argv.
const MODEL_ALLOWLIST = ['fable', 'opus', 'sonnet', 'haiku'];

/**
 * Sanitize a candidate `model` value against the closed MODEL_ALLOWLIST.
 * Returns the value unchanged when it is an EXACT member (case-sensitive,
 * no trimming — membership is binary, not fuzzy), else ''. A rejected value
 * never reaches the argv; the caller degrades to "no --model flag at all".
 * @param {*} raw
 * @returns {string}
 */
function sanitizeModel(raw) {
  return typeof raw === 'string' && MODEL_ALLOWLIST.includes(raw) ? raw : '';
}

function tokensMatch(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Write the discovery file (overwriting any stale one) for a live listener. */
function writeBridgeFile(root, meta) {
  const dir = path.join(root, '.agentheim', DASHBOARD_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(bridgePath(root), JSON.stringify(meta, null, 2));
}

/** Remove the discovery file so a dead host leaves nothing live to find. */
function removeBridgeFile(root) {
  const p = bridgePath(root);
  if (existsSync(p)) rmSync(p, { force: true });
}

/**
 * Start the bridge for a project `root`. Generates a fresh per-activation
 * token, binds 127.0.0.1 along the fallback ladder, writes bridge.json, and
 * returns a handle { port, token, address, server, close() }. `close()` shuts
 * the listener AND removes the discovery file (deactivation contract).
 *
 * @param {{ root: string, launchClaude: (descriptor: { command: string, args: string[] }) => void, ports?: number[] }} opts
 */
async function startBridge({ root, launchClaude, ports = PREFERRED_PORTS }) {
  if (typeof launchClaude !== 'function') {
    throw new TypeError('startBridge requires a launchClaude callback');
  }
  const token = generateToken();
  const server = http.createServer(makeHandler({ token, launchClaude }));
  const port = await listenWithLadder(server, ports);

  const meta = {
    port,
    token,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    v: BRIDGE_V,
    // Belt-and-braces only (ADR-0018, infrastructure-v8r3q) — bridge.json is
    // written by this process on its own activation lifecycle and can lag or
    // race a concurrent host's write; GET /health is the authoritative check.
    capabilities: CAPABILITIES,
  };
  writeBridgeFile(root, meta);

  let closed = false;
  return {
    port,
    token,
    address: '127.0.0.1',
    server,
    close() {
      if (closed) return;
      closed = true;
      try { server.close(); } catch { /* already closing */ }
      removeBridgeFile(root);
    },
  };
}

module.exports = {
  startBridge,
  bridgePath,
  generateToken,
  makeHandler,
  writeBridgeFile,
  removeBridgeFile,
  TOKEN_HEADER,
  PREFERRED_PORTS,
  BRIDGE_V,
  resolveSessionName,
  sanitizeName,
  deriveNameFromPrompt,
  NAME_MAX_LEN,
  MODEL_ALLOWLIST,
  sanitizeModel,
  CAPABILITIES,
};
