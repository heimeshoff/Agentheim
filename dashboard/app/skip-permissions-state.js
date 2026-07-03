/* ============================================================
   Agentheim — dashboard persisted SKIP-PERMISSIONS "armed" toggle
   (agentic-workflow-021)

   The dashboard's bridge launch buttons start a real, interactive `claude`
   session. When this setting is ARMED, every bridge launch requests a
   skip-permissions session — the bridge then seeds
   `--dangerously-skip-permissions` as its own raw argv element ahead of the
   prompt (no shell wrap, infrastructure-020) — the opt-in contract frozen in
   infrastructure-015 / honoured in infrastructure-016, amended ADR-0018.

   This module is the dashboard-side STATE behind that control — WHETHER the
   bypass is armed, and how it is remembered. It is a SIBLING of theme-state.js
   (aw-017) and board-view-state.js (aw-014 / ADR-0015) and deliberately mirrors
   their shape: a single versioned localStorage key with safe degradation.

   The ONE rule that sets this store apart from its siblings: the bypass must
   NEVER be silently on. So the default is OFF, and EVERY degraded path —
   malformed JSON, a stale version, an absent blob, a non-boolean value, no
   backend, a throwing backend — resolves to OFF (armed=false), never a throw and
   never on. Only an explicit, current-version, boolean-`true` blob arms it.

   Like its siblings, this is presentation view-state ONLY — it never records
   lifecycle truth, so the dashboard stays read-only over .agentheim/ (ADR-0017 /
   ADR-0001) and the armed choice survives every SSE re-projection of /api/tree
   untouched. The store is pure over an INJECTED storage backend, framework-free,
   and never throws. Unit-tested under `node --test` with no DOM.
   ============================================================ */

// The one localStorage key the armed choice lives under. Its own key, distinct
// from `agentheim.dashboard.theme` and `agentheim.board.viewState` — a sibling
// concern that evolves independently.
export const SKIP_PERMISSIONS_KEY = 'agentheim.dashboard.skipPermissions';

// Bump when the persisted shape changes incompatibly: a blob written by a
// different version is ignored on load (treated as OFF), so an old preference can
// never feed a shape this version does not understand — and, critically, can
// never silently arm a bypass.
export const SKIP_PERMISSIONS_VERSION = 1;

/**
 * Read the persisted ARMED choice from the injected storage.
 * @param {{ getItem: (k: string) => (string|null) } | null | undefined} storage
 * @returns {boolean} `true` ONLY when there is a current-version blob whose
 *   `armed` is the boolean `true`. Every other case — no backend, a throwing
 *   backend, no stored blob, a stale version, malformed JSON, a non-boolean
 *   value — degrades to `false` (OFF). Never throws, never silently on.
 */
export function loadSkipPermissions(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  let raw;
  try {
    raw = storage.getItem(SKIP_PERMISSIONS_KEY);
  } catch {
    return false; // storage access can throw (disabled / private mode) → OFF.
  }
  if (raw == null) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false; // a corrupt blob must never arm the bypass.
  }
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.version !== SKIP_PERMISSIONS_VERSION) return false; // different shape.
  if (parsed.armed !== true) return false; // strict-true only; anything else = OFF.
  return true;
}

/**
 * Persist the ARMED choice under the versioned envelope.
 * @param {{ setItem: (k: string, v: string) => void } | null | undefined} storage
 * @param {*} armed — coerced strictly: only the boolean `true` is stored as
 *   armed; every other value persists OFF. This keeps the strict-`true`
 *   activation honest end-to-end (a truthy-but-not-true value never arms).
 *
 * A no-op when there is no backend (SSR / no DOM). Storage write failures (quota,
 * disabled) are swallowed — a failed PREFERENCE write must never surface as a
 * dashboard error. Never throws.
 */
export function saveSkipPermissions(storage, armed) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(
      SKIP_PERMISSIONS_KEY,
      JSON.stringify({ version: SKIP_PERMISSIONS_VERSION, armed: armed === true }),
    );
  } catch {
    /* preference persistence is best-effort; never throw. */
  }
}
