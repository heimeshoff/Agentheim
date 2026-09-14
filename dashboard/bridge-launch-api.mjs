// POST /api/bridge/launch (ADR-0082 §2-§6, infrastructure-xh8tw): the
// dashboard's FOURTH write category — MEDIATED LAUNCH — sibling to the
// forbidden LIFECYCLE write (ADR-0017) and the ADVISORY/RUNTIME
// SELF-LIFECYCLE categories (ADR-0027/0043/0046/0053). Spawning a Herdr-hosted
// Claude session is the server performing, on the builder's explicit request,
// the same external side effect the browser performs directly for VS Code
// (ADR-0018) — it touches no task-lifecycle truth: no task moves, no
// `status` rewrite, no INDEX.md/protocol.md change.
//
// Body shape is the IDENTICAL `{ prompt, skipPermissions?, name?, model? }`
// as VS Code's `POST /run` (deliberately, to minimize bridge-launch.js's
// diff on the frontend side). Security is token-only, no Origin check
// (ADR-0082 §4 — ADR-0053's no-Origin-check ruling for /api/stop does NOT
// carry over as precedent; this endpoint reaches `claude` directly with
// skipPermissions available, the same unbounded blast radius ADR-0018 itself
// already accepted a token-only defense for). The custom header forces a
// CORS preflight this server never answers permissively, and a header-less
// CSRF POST arrives token-less and gets 401.
//
// REQUEST-PATH BUDGET (ADR-0082 §6): `api snapshot` + the matching
// `tab create`/`workspace create` are AWAITED — a failure there is a non-2xx
// before any response commits. Once topology succeeds, the handler responds
// `202 {ok:true}` IMMEDIATELY, then resolves live agent names and spawns
// `agent start … --timeout … -- <argv>` UNAWAITED — a subsequent
// `agent_not_ready` (or any later failure) is never surfaced to the caller;
// the pane is already open.
//
// EVERY EXTERNAL SEAM IS INJECTED (`exec`, `spawnFn`, `listAgentNames`,
// `resolveHerdrBinaryFn`) so `node --test` never spawns a real `herdr`.

import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { resolveHerdrBinary, HERDR_CHILD_OPTIONS } from '../lib/resolve-herdr.mjs';

// Same header name as ADR-0018's VS Code bridge — reused, not reinvented.
export const BRIDGE_TOKEN_HEADER = 'X-Agentheim-Bridge-Token';
const BRIDGE_TOKEN_HEADER_LC = BRIDGE_TOKEN_HEADER.toLowerCase();

// The capability set this endpoint honours — value-identical to the VS Code
// extension's own `CAPABILITIES` (vscode-extension/src/bridge.js), pinned by
// a structural-guard test (dashboard/test/bridge-launch-api.test.mjs) rather
// than a cross-package import, so the two independent bridge implementations
// stay independent peers (ADR-0082 §2) while drift is still caught.
export const HERDR_CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model'];

// Model selection (infrastructure-h5wnq / ADR-0018), reused verbatim: a
// CLOSED SET of short aliases. Anything outside it sanitizes to '' — no
// `--model` flag, never a rejection. Value-identical to
// vscode-extension/src/bridge.js's MODEL_ALLOWLIST — pinned equal by
// dashboard/test/bridge-launch-api.test.mjs so the two never drift apart.
export const MODEL_ALLOWLIST = ['fable', 'opus', 'sonnet', 'haiku'];

/** @param {*} raw @returns {string} the value unchanged if an exact allowlist member, else ''. */
export function sanitizeModel(raw) {
  return typeof raw === 'string' && MODEL_ALLOWLIST.includes(raw) ? raw : '';
}

// Session-name derivation (infrastructure-c6fzb / -w6p4k), reimplemented here
// (not imported — the dashboard server cannot import vscode-extension/ at
// runtime) so this endpoint gets a non-empty display name even when the
// frontend's own `name` field is absent/invalid, exactly mirroring the VS
// Code listener's own fallback.
export const NAME_MAX_LEN = 60;

/** @param {*} raw @returns {string} control characters stripped, trimmed, capped; '' for a non-string. */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, NAME_MAX_LEN);
}

/**
 * `/agentheim:<skill> <rest>` -> `<skill>: <rest>`; the `modeling` skill
 * carves out `<rest>` alone (infrastructure-w6p4k); any other prompt -> the
 * prompt text itself.
 * @param {string} prompt
 * @returns {string}
 */
export function deriveNameFromPrompt(prompt) {
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
 * The session's display name: a sanitized explicit `name` when supplied and
 * non-empty, else a prompt-derived fallback. Always non-empty given a
 * non-empty `prompt` (the caller already rejects an empty prompt with 400).
 * @param {{name?: *, prompt: string}} args
 * @returns {string}
 */
export function resolveSessionName({ name, prompt }) {
  const explicit = sanitizeName(name);
  return explicit || deriveNameFromPrompt(prompt);
}

/**
 * ADR-0018's exact argv order: `['-n', name, '--model', id,
 * '--dangerously-skip-permissions', prompt]`, each optional pair present
 * only when armed.
 * @param {{name: string, model: string, skipPermissions: boolean, prompt: string}} args
 * @returns {string[]}
 */
export function buildClaudeArgv({ name, model, skipPermissions, prompt }) {
  const modelArgs = model ? ['--model', model] : [];
  const tailArgs = skipPermissions === true ? ['--dangerously-skip-permissions', prompt] : [prompt];
  return ['-n', name, ...modelArgs, ...tailArgs];
}

// ---------------------------------------------------------------------------
// deriveHerdrAgentName — pure, Herdr's own naming grammar: [a-z][a-z0-9_-]{0,31}
// ---------------------------------------------------------------------------

const AGENT_NAME_MAX = 32;
const FALLBACK_BASE = 'agent';

function sanitizeAgentNameBase(raw) {
  const lowered = typeof raw === 'string' ? raw.toLowerCase() : '';
  let stripped = lowered.replace(/[^a-z0-9_-]+/g, '-');
  stripped = stripped.replace(/^[^a-z]+/, ''); // grammar requires a leading LETTER
  if (!stripped) stripped = FALLBACK_BASE;
  return stripped.slice(0, AGENT_NAME_MAX);
}

/**
 * Derive a Herdr agent name from a human display name: lower-cased,
 * non-grammar characters collapsed to `-`, forced to start with a letter
 * (falling back to `"agent"` when nothing survives), capped at 32 chars, and
 * made unique against `liveAgentNames` by appending a `-<n>` suffix
 * (truncating the base to keep the whole name within the 32-char cap) when
 * the plain candidate already exists.
 * @param {*} displayName
 * @param {string[]} [liveAgentNames]
 * @returns {string} always matches `/^[a-z][a-z0-9_-]{0,31}$/`
 */
export function deriveHerdrAgentName(displayName, liveAgentNames = []) {
  const liveSet = new Set(Array.isArray(liveAgentNames) ? liveAgentNames : []);
  const base = sanitizeAgentNameBase(displayName);
  if (!liveSet.has(base)) return base;

  let suffix = 2;
  for (;;) {
    const suffixStr = `-${suffix}`;
    const truncatedBase = base.slice(0, Math.max(1, AGENT_NAME_MAX - suffixStr.length));
    const candidate = `${truncatedBase}${suffixStr}`;
    if (!liveSet.has(candidate)) return candidate;
    suffix += 1;
  }
}

// ---------------------------------------------------------------------------
// normalizeCwdForComparison / cwdsMatch (infrastructure-nz2e8) -- the
// workspace-reuse decision below must never be pushed onto the
// `workspace create` branch by a path-FORM difference alone (forward vs
// backslash separators, a trailing separator, or -- on win32 -- letter
// case) when the pane really is the same directory `root` names. Pure,
// platform-injectable (mirrors lib/resolve-herdr.mjs's own hermetic-fixture
// discipline) so a test can force win32 behaviour on any host OS.
// ---------------------------------------------------------------------------

/**
 * @param {*} raw
 * @param {string} [platform] defaults to `process.platform`
 * @returns {string} '' for a non-string/empty input
 */
export function normalizeCwdForComparison(raw, platform = process.platform) {
  if (typeof raw !== 'string' || raw === '') return '';
  const impl = platform === 'win32' ? path.win32 : path.posix;
  let normalized = impl.resolve(raw);
  // `path.*.resolve` keeps a trailing separator only for a bare drive/root
  // (e.g. 'C:\\' or '/'); strip any OTHER trailing separator so
  // 'C:\\proj\\' and 'C:\\proj' compare equal.
  if (normalized.length > 1) {
    const stripped = normalized.replace(/[\\/]+$/, '');
    normalized = stripped === '' ? normalized[0] : stripped;
  }
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * @param {*} root
 * @param {*} cwd
 * @param {string} [platform] defaults to `process.platform`
 * @returns {boolean} true only when both normalize to the same non-empty string
 */
export function cwdsMatch(root, cwd, platform = process.platform) {
  const a = normalizeCwdForComparison(root, platform);
  const b = normalizeCwdForComparison(cwd, platform);
  return a !== '' && a === b;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
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

function tokensMatch(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Herdr CLI plumbing — every seam injected, real defaults only reached in
// production, never under `node --test` (tests always supply their own).
// ---------------------------------------------------------------------------

/**
 * Default synchronous `herdr <args>` invoker: returns stdout, throws on any
 * failure. `options` (`HERDR_CHILD_OPTIONS` by default -- infrastructure-
 * nz2e8) is spread last so a caller-supplied override always wins.
 */
function defaultExec(binaryPath, args, options) {
  return execFileSync(binaryPath, args, { encoding: 'utf8', timeout: 10000, ...options });
}

/** Best-effort live agent names via `herdr agent list`; `[]` on ANY failure (never throws). */
function defaultListAgentNames(binaryPath, exec) {
  try {
    const parsed = JSON.parse(exec(binaryPath, ['agent', 'list'], HERDR_CHILD_OPTIONS));
    const agents = parsed?.result?.agents;
    return Array.isArray(agents) ? agents.map((a) => a && a.name).filter((n) => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Handle `POST /api/bridge/launch`. See module banner for the full contract.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} root — discovered project root (workspace-matching cwd).
 * @param {object} [opts]
 * @param {string} opts.token — the per-process bridge token (server.mjs mints it).
 * @param {string} [opts.homedir] — defaults to `os.homedir()`.
 * @param {object} [opts.resolveDeps] — forwarded to `resolveHerdrBinary`.
 * @param {(binaryPath: string, args: string[], options?: object) => string} [opts.exec] — injectable `herdr <args>` invoker (receives `HERDR_CHILD_OPTIONS` as its third argument — infrastructure-nz2e8); throws = failure.
 * @param {(binaryPath: string, args: string[], spawnOpts: object) => object} [opts.spawnFn] — injectable `child_process.spawn`.
 * @param {(binaryPath: string, exec: Function) => string[]} [opts.listAgentNames] — injectable live-agent-name lookup.
 * @param {number} [opts.timeoutMs] — `agent start --timeout`; defaults to 30000.
 * @param {string} [opts.platform] — injectable for the workspace-reuse cwd comparison; defaults to `process.platform`.
 */
export async function handleBridgeLaunch(req, res, root, opts = {}) {
  const homedir = opts.homedir ?? os.homedir();
  const resolveDeps = opts.resolveDeps ?? {};
  const exec = opts.exec ?? defaultExec;
  const spawnFn = opts.spawnFn ?? nodeSpawn;
  const listAgentNames = opts.listAgentNames ?? defaultListAgentNames;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const platform = opts.platform ?? process.platform;

  // Token gate FIRST (ADR-0082 §4: token-only, no Origin check).
  const presented = req.headers[BRIDGE_TOKEN_HEADER_LC];
  if (!presented || typeof opts.token !== 'string' || !tokensMatch(presented, opts.token)) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }

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

  // Resolution itself is wrapped: an unexpected throw from the resolver (a
  // broken filesystem read, or — in tests — a deliberately-throwing fake)
  // must still degrade to a non-2xx response, never an unhandled rejection
  // (verifier iteration 1, AC6 "never a 5xx crash").
  let resolved;
  try {
    resolved = (opts.resolveHerdrBinaryFn ?? resolveHerdrBinary)({ homedir, ...resolveDeps });
  } catch (err) {
    send(res, 502, { error: 'herdr binary resolution failed', detail: String(err && err.message) });
    return;
  }
  if (!resolved.path) {
    send(res, 503, { error: 'herdr binary not found' });
    return;
  }
  const binaryPath = resolved.path;

  const displayName = resolveSessionName({ name: parsed?.name, prompt });
  const model = sanitizeModel(parsed?.model);
  const skipPermissions = parsed?.skipPermissions === true;

  // Fast path: awaited (ADR-0082 §6). `api snapshot` first.
  let snapshot;
  try {
    snapshot = JSON.parse(exec(binaryPath, ['api', 'snapshot'], HERDR_CHILD_OPTIONS));
  } catch (err) {
    send(res, 502, { error: 'herdr api snapshot failed', detail: String(err && err.message) });
    return;
  }

  const panes = snapshot?.result?.snapshot?.panes;
  // Compared through a normaliser (infrastructure-nz2e8), never a bare
  // `===`: a path-FORM difference alone (separator style, trailing
  // separator, win32 case) must never push a launch onto the
  // `workspace create` branch when the pane really is the same directory.
  const matchingPane = Array.isArray(panes) ? panes.find((p) => p && cwdsMatch(root, p.cwd, platform)) : undefined;
  const workspaceId = matchingPane ? matchingPane.workspace_id : undefined;

  let topology;
  try {
    const raw2 =
      matchingPane !== undefined
        ? exec(
            binaryPath,
            ['tab', 'create', '--workspace', String(workspaceId), '--cwd', root, '--label', displayName, '--focus'],
            HERDR_CHILD_OPTIONS,
          )
        : exec(
            binaryPath,
            ['workspace', 'create', '--cwd', root, '--label', displayName, '--focus'],
            HERDR_CHILD_OPTIONS,
          );
    topology = JSON.parse(raw2);
  } catch (err) {
    send(res, 502, { error: 'herdr tab/workspace create failed', detail: String(err && err.message) });
    return;
  }

  // `root_pane` is a PaneInfo OBJECT (herdr 0.9.0, protocol 22, `api schema
  // --json` + a live `workspace create`/`tab create` capture,
  // infrastructure-p3k9r) — its id lives at `.pane_id`, it is never a bare
  // string.
  const paneId = topology?.result?.root_pane?.pane_id;
  if (!paneId) {
    send(res, 502, { error: 'herdr did not report a pane id' });
    return;
  }

  // The response commits HERE (ADR-0082 §6) — everything past this point is
  // fire-and-report and MUST NOT be surfaced to the caller, success or fail.
  send(res, 202, { ok: true });

  try {
    const liveNames = listAgentNames(binaryPath, exec);
    const agentName = deriveHerdrAgentName(displayName, liveNames);
    const claudeArgv = buildClaudeArgv({ name: displayName, model, skipPermissions, prompt });
    const args = [
      'agent',
      'start',
      agentName,
      '--kind',
      'claude',
      '--pane',
      String(paneId),
      '--timeout',
      String(timeoutMs),
      '--',
      ...claudeArgv,
    ];
    spawnFn(binaryPath, args, { stdio: 'ignore', ...HERDR_CHILD_OPTIONS });
  } catch {
    // Deliberately swallowed (ADR-0082 §6): the pane is already open, and a
    // post-202 failure (agent_not_ready, spawn error, agent-list failure) is
    // never surfaced to a caller that has already received its 202.
  }
}
