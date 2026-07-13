/* ============================================================
   Agentheim — dashboard bridge-launch decision logic (agentic-workflow-020)

   The PURE, framework-free core behind the backlog's "Quick Capture" / "Modeling"
   launch buttons. Each button wants to open a REAL, interactive Claude session
   seeded with its `/agentheim:...` command. The only path to a visible terminal
   from the sandboxed VS Code Simple Browser is the VS Code bridge extension
   (ADR-0018): a 127.0.0.1 HTTP listener the frontend reaches over `fetch`.

   This module is the launch-vs-fallback decision, expressed as a pure function of
   an injected `fetch` and an injected `copy` (clipboard writer), so it is fully
   unit-testable under `node --test` — no React, no DOM, no real network. The React
   shell in board.js is thin glue that supplies window.fetch + the aw-016
   copyToClipboard and renders the buttons.

   The ADR-0018 discovery + launch contract, consumed here EXACTLY:
     1. Discover: `GET /api/bridge` (on the dashboard's OWN origin — the one thing
        the sandboxed frame can reach) → `{ port, token, v }` when the extension is
        live, or `{ present: false }` when absent. Port/token are NEVER hardcoded.
     2. Probe liveness: a token-bearing `GET /health` against `127.0.0.1:<port>`
        with a ~800 ms timeout (a stale bridge.json from a dead host carries a
        token no live listener accepts, so the probe is what stops a false positive).
     3. Launch: `POST /run { prompt }` to `127.0.0.1:<port>` with the
        `X-Agentheim-Bridge-Token` header. The extension passes the prompt to
        `claude` as a single raw argv element (no shell, no quoting) and opens
        the terminal (ADR-0018, amended by infrastructure-020).

   THE ABSENCE CONTRACT (the spine of the task): EVERY failure mode — present:false,
   timeout, connection-refused, non-200, CORS rejection, not-in-Simple-Browser, any
   thrown exception, even no `fetch` at all — collapses SILENTLY to the clipboard
   fallback. This module never throws and never rejects. Absence is a normal mode,
   not an error; the board surfaces no toast, no console crash, no broken button.

   The board is a projection of disk (ADR-0001): launching a session is an EXTERNAL
   side-effect (exactly like the aw-016 clipboard copy), not a lifecycle write.
   ============================================================ */

// The contract header every bridge request carries (ADR-0018). The listener
// rejects any request lacking or mismatching the per-activation token.
export const BRIDGE_TOKEN_HEADER = 'X-Agentheim-Bridge-Token';

// The dashboard-origin discovery endpoint (infrastructure-014). Same-origin, so
// the sandboxed frame can reach it; it carries the on-disk bridge contract out.
const DISCOVERY_URL = '/api/bridge';

// ADR-0018's liveness-probe budget. A bridge that does not answer /health within
// this window is treated as absent and we fall back to clipboard.
const DEFAULT_HEALTH_TIMEOUT_MS = 800;

// The closed baseline capability set a pre-handshake (0.2.0-shaped) bridge
// implicitly honours — it predates the /health `capabilities` field entirely,
// so it cannot emit one (ADR-0018, infrastructure-v8r3q). Absence of the
// field means EXACTLY this set, never "unknown" or "assume everything works".
export const LEGACY_CAPABILITIES = ['prompt', 'skipPermissions'];

// The dashboard's OWN statement of "the set of POST /run fields I know how
// to send" (agentic-workflow-n4qte) — exactly what `runOnBridge`'s per-field
// allowlist below already encodes inline (`caps.includes('name')` /
// `caps.includes('model')`). A PEER of, not an import of, the extension's
// own `CAPABILITIES` (`vscode-extension/src/bridge.js`) — the two ends of
// the same handshake, deliberately not coupled across the package boundary.
// Used by the prompt bar (board.js) to detect capability SKEW: a live
// listener that is present but advertises fewer than this full set (any
// missing field, not just 'model' specifically — see the task's Notes) is
// a stale extension host, distinct from no bridge being reachable at all.
export const KNOWN_CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model'];

/**
 * `fetch` with a bounded timeout, via AbortController when available. Returns the
 * Response, or throws (timeout/abort/network) — the caller treats any throw as
 * "bridge unavailable". A missing AbortController (exotic runtime) just races a
 * timer reject against the fetch, so the timeout still bounds the wait.
 */
function fetchWithTimeout(fetchImpl, url, opts, timeoutMs) {
  const AC = typeof AbortController !== "undefined" ? AbortController : null;
  if (AC) {
    const ctrl = new AC();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return Promise.resolve(fetchImpl(url, { ...opts, signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("bridge probe timeout")), timeoutMs);
    Promise.resolve(fetchImpl(url, opts)).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Discover the live bridge via the dashboard-origin `GET /api/bridge`.
 * @returns {Promise<{port:number, token:string}|null>} the advertised port+token,
 *   or null for ANY absence/failure (present:false, missing fields, non-200, throw).
 *   Never throws.
 */
async function discoverBridge(fetchImpl) {
  try {
    const res = await fetchImpl(DISCOVERY_URL, { headers: { Accept: "application/json" } });
    if (!res || !res.ok) return null;
    const body = await res.json();
    if (!body || body.present === false) return null;
    const { port, token } = body;
    if (typeof port !== "number" || !port || typeof token !== "string" || !token) return null;
    return { port, token };
  } catch {
    // present:false is normal; so is "not in Simple Browser" (fetch throws). Quiet.
    return null;
  }
}

/**
 * Confirm a live listener with a token-bearing `GET /health` (≈800 ms timeout),
 * and read the authoritative capability signal off its response (ADR-0018,
 * infrastructure-v8r3q). A stale bridge.json (dead host) advertises a port
 * whose token no live listener accepts, so a non-200 / refusal / timeout here
 * correctly reads as "no bridge". A live response whose body omits (or fails
 * to carry a valid) `capabilities` array is a pre-handshake (0.2.0-shaped)
 * bridge — treated as the closed `LEGACY_CAPABILITIES` baseline, never as
 * "unknown" or "assume everything works".
 * @returns {Promise<{live: boolean, capabilities: string[]}>} Never throws.
 */
async function probeHealth(fetchImpl, { port, token }, timeoutMs) {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `http://127.0.0.1:${port}/health`,
      { method: "GET", headers: { [BRIDGE_TOKEN_HEADER]: token } },
      timeoutMs,
    );
    if (!res || !res.ok) return { live: false, capabilities: [] };
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const capabilities = Array.isArray(body?.capabilities) ? body.capabilities : LEGACY_CAPABILITIES;
    return { live: true, capabilities };
  } catch {
    return { live: false, capabilities: [] };
  }
}

/**
 * Launch the seeded session via `POST /run` (token header). The body is
 * `{ prompt }`, plus `skipPermissions: true` ONLY when strictly armed — when OFF
 * the field is OMITTED (never sent `false`), so the OFF body is byte-identical to
 * today and matches the contract's strict-`true` activation (amended ADR-0018;
 * honoured by the bridge in infrastructure-016, which prepends
 * `--dangerously-skip-permissions` as its own raw argv element before the
 * prompt, only on strict-`true`; no shell wrap, per infrastructure-020), and
 * `name` ONLY when a real (non-blank) string was supplied — omitted otherwise
 * so the bridge falls back to its own prompt-derived name (infrastructure-c6fzb).
 * The custom header makes this a CORS-preflighted request — the extension answers
 * the preflight (ADR-0018); a CORS rejection here just throws and we fall back.
 * `capabilities` is the live-probed set `probeHealth` just read off THIS
 * listener's own `/health` response (ADR-0018, infrastructure-v8r3q) —
 * `model`/`name` are omitted from the body whenever the listener didn't just
 * advertise them, even if the caller passed a value for either. This is a
 * hard wire-level guarantee, not merely a UI-layer courtesy: a stale UI gate
 * cannot make this module claim a capability the listener, at this moment,
 * doesn't have. Mirrors the bridge's own allowlist-degrades-quietly
 * discipline (infrastructure-h5wnq) — omit the field, never reject, never 500.
 * @returns {Promise<boolean>} Never throws.
 */
async function runOnBridge(fetchImpl, { port, token, prompt, skipPermissions, name, model, capabilities }) {
  try {
    const caps = Array.isArray(capabilities) ? capabilities : LEGACY_CAPABILITIES;
    // Strict-`true` only: a truthy-but-not-true value must never arm the bypass,
    // and OFF must OMIT the field rather than serialize `false`.
    const body = skipPermissions === true ? { prompt, skipPermissions: true } : { prompt };
    if (caps.includes('name') && typeof name === 'string' && name.trim()) body.name = name;
    if (caps.includes('model') && typeof model === 'string' && model.trim()) body.model = model;
    const res = await fetchImpl(`http://127.0.0.1:${port}/run`, {
      method: "POST",
      headers: {
        [BRIDGE_TOKEN_HEADER]: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

/**
 * Launch `prompt` through the bridge, or fall back to copying it to the clipboard.
 *
 * Try, in order: discover the bridge (`GET /api/bridge`) → confirm it is live
 * (token-bearing `GET /health`, bounded) → seed the session (`POST /run`). The
 * FIRST failure at any step collapses SILENTLY to the clipboard fallback — every
 * failure mode is normal, none is surfaced. This function NEVER throws or rejects.
 *
 * @param {object} args
 * @param {string} args.prompt — the exact command string (e.g. `/agentheim:modeling`),
 *   produced by the pure modeling-command.js module. Both the launched POST body
 *   and the copied clipboard text are this same string — one source of truth.
 * @param {(url:string, opts?:object)=>Promise<Response>} [args.fetchImpl] — injected
 *   `fetch`. Absent/undefined → straight to clipboard (no origin to reach).
 * @param {(text:string)=>Promise<boolean>} args.copy — injected no-throw clipboard
 *   writer (board.js supplies aw-016's copyToClipboard). Resolves to whether the
 *   write landed; a false just means no "copied" feedback flashes.
 * @param {number} [args.healthTimeoutMs] — liveness-probe budget (default ~800 ms).
 * @param {boolean} [args.skipPermissions] — the armed toggle (aw-021). When strict
 *   `true`, the POST /run body carries `skipPermissions: true` and the bridge
 *   prepends `--dangerously-skip-permissions` as a raw argv element ahead of the
 *   prompt (no shell wrap, infrastructure-020); OFF/absent OMITS the
 *   field (never sends `false`). It affects ONLY the bridge POST — the clipboard
 *   fallback can NEVER carry the bypass (it copies a slash command to paste into a
 *   RUNNING session; `--dangerously-skip-permissions` is startup-only), so the
 *   bridge-present/absent asymmetry is accepted (amended ADR-0018), not a defect.
 * @param {string} [args.name] — a display name for the launched session
 *   (infrastructure-c6fzb). When a real (non-blank) string is supplied, the
 *   POST /run body carries `name` and the bridge rides it into the launch
 *   descriptor as `-n <name>`, so the terminal tab / `/resume` picker entry
 *   stop reading "Claude". Absent/blank OMITS the field (the bridge then
 *   derives its own fallback name from the prompt). Never sent to the
 *   clipboard fallback — there is no launch to name.
 * @param {string} [args.model] — a chosen model id for the launched session
 *   (infrastructure-h5wnq, feeding the prompt bar's model selector,
 *   agentic-workflow-m2vkp). When a real (non-blank) string is supplied, the
 *   POST /run body carries `model`; the bridge allowlists it and rides an
 *   accepted value into the launch descriptor as `--model <id>` (a rejected
 *   value just means no flag — the bridge, not this module, owns the
 *   allowlist). Absent/blank OMITS the field, so the session inherits the
 *   user's own Claude Code config. Never sent to the clipboard fallback —
 *   a pasted slash command cannot carry a startup flag.
 * @returns {Promise<{via:'bridge'}|{via:'clipboard', copied:boolean}>} which path
 *   handled it; for the clipboard path, whether the copy itself landed.
 */
export async function launchOrCopy({ prompt, fetchImpl, copy, healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS, skipPermissions, name, model }) {
  // Try the bridge only when we actually have a fetch to reach it with.
  if (typeof fetchImpl === "function") {
    const bridge = await discoverBridge(fetchImpl);
    if (bridge) {
      const { live, capabilities } = await probeHealth(fetchImpl, bridge, healthTimeoutMs);
      if (live) {
        const launched = await runOnBridge(fetchImpl, { ...bridge, prompt, skipPermissions, name, model, capabilities });
        if (launched) return { via: "bridge" };
      }
    }
  }

  // Fallback: copy the command to the clipboard (aw-016 behavior). The bypass is
  // deliberately NOT carried here — the clipboard text is the bare prompt (a slash
  // command for a running session; the bypass is startup-only). The copy is itself
  // no-throw; a false result just means no "copied" feedback should flash.
  let copied = false;
  try {
    copied = await copy(prompt);
  } catch {
    copied = false;
  }
  return { via: "clipboard", copied: !!copied };
}

/**
 * An ambient, render-time-safe bridge-presence + capability signal
 * (infrastructure-h5wnq; grown by infrastructure-v8r3q). `launchOrCopy` only
 * learns whether the bridge is reachable lazily, at fire time — nothing
 * tells the UI *before* a launch is attempted. The prompt bar's model
 * selector (agentic-workflow-m2vkp) needs exactly that: it greys out when no
 * bridge is reachable, because a clipboard-copied command can never carry a
 * `--model` flag; agentic-workflow-n4qte extends this to "bridge present but
 * too old" using the `capabilities` this now resolves.
 *
 * Runs the SAME two-step discover (`GET /api/bridge`) + health
 * (`GET /health`, ~800 ms budget) protocol `launchOrCopy` uses — reusing the
 * module's existing `discoverBridge`/`probeHealth` internals rather than a
 * second implementation of them — and resolves `{ present: boolean,
 * capabilities: string[] }`. `capabilities` is read from the LIVE listener's
 * own `/health` response (authoritative, ADR-0018) — a listener whose
 * `/health` omits the field is a pre-handshake (0.2.0-shaped) bridge and
 * resolves the closed `LEGACY_CAPABILITIES` baseline, never "unknown".
 *
 * As silent as `launchOrCopy`: every failure mode (no `fetchImpl` at all, no
 * `bridge.json`/`present:false`, a dead port, any thrown fetch, not running
 * in Simple Browser) resolves `{ present: false, capabilities: [] }`. Never
 * throws, never rejects, never logs.
 *
 * @param {(url:string, opts?:object)=>Promise<Response>} [fetchImpl] — injected
 *   `fetch`. Absent/not-a-function → straight to `{ present: false, capabilities: [] }`.
 * @returns {Promise<{present: boolean, capabilities: string[]}>}
 */
export async function probeBridge(fetchImpl) {
  if (typeof fetchImpl !== "function") return { present: false, capabilities: [] };
  try {
    const bridge = await discoverBridge(fetchImpl);
    if (!bridge) return { present: false, capabilities: [] };
    const { live, capabilities } = await probeHealth(fetchImpl, bridge, DEFAULT_HEALTH_TIMEOUT_MS);
    return live ? { present: true, capabilities } : { present: false, capabilities: [] };
  } catch {
    // discoverBridge/probeHealth already swallow their own failures; this
    // catch is a belt-and-braces guarantee that probeBridge itself never
    // throws or rejects, matching launchOrCopy's contract.
    return { present: false, capabilities: [] };
  }
}
