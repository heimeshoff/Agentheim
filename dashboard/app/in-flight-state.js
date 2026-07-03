/* ============================================================
   Agentheim — dashboard IN-FLIGHT LANE state (agentic-workflow-m9w5c, ADR-0043)

   Two Claude Code `Stop`/`SubagentStop` hooks (lib/hook-agent-signal.mjs)
   maintain a SECOND advisory artifact (ADR-0027 category, extended by
   ADR-0043) at `.agentheim/state/in-flight.json` — a session-liveness
   heartbeat plus a bounded list of recently-completed worker/verifier
   subagents. This module is the dashboard-side READ path:

     1. `parseInFlightDoc` — safe JSON.parse + shape guard over the fetched
        text. Malformed/absent/wrong-version input yields `null`.
     2. `deriveInFlightView` — the pure staleness/projection core. A heartbeat
        past STALE_WINDOW_MS collapses to `null` (renders NOTHING) — this is
        the crash-safety mechanism: a killed session's leftover signal stops
        updating and ages out rather than drawing a zombie in-flight lane
        (AC3, work-session-presence-lock research).

   The dashboard is READ-ONLY over this artifact (ADR-0017): it fetches via
   the existing GET /api/doc body carrier (ADR-0021/0023, the same transport
   `whats-next-state.js` uses for its sibling artifact) and never writes it.
   Pure, framework-free, unit-tested under `node --test` with no DOM.
   ============================================================ */

// The single in-root path of this advisory artifact (ADR-0043 §state schema).
export const IN_FLIGHT_DOC_PATH = '.agentheim/state/in-flight.json';

// Mirrors lib/agent-heartbeat.mjs's STALE_WINDOW_MS exactly (no doc basis for the
// exact figure — chosen to comfortably exceed the gap between ordinary orchestrator
// turns while still reaping a crashed session's lane promptly). Kept as a SEPARATE
// constant (not imported) because this module ships to the browser bundle and
// lib/agent-heartbeat.mjs is a Node-only module (fs-adjacent, not bundled) — see
// dashboard/test/in-flight-state.test.mjs for the parity assertion against the
// hook-side constant's shape (both positive, finite numbers).
export const STALE_WINDOW_MS = 5 * 60 * 1000;

const SCHEMA_VERSION = 1;

/**
 * Safely parse the fetched artifact body. Returns the parsed object on a
 * well-formed `{version:1, lastHeartbeat: <ISO string>, ...}` shape, otherwise
 * `null` — absent, blank, malformed JSON, wrong version, or missing/non-string
 * `lastHeartbeat` all collapse to the same "nothing to show" signal. Never throws.
 * @param {string|null|undefined} raw
 * @returns {object|null}
 */
export function parseInFlightDoc(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (parsed.version !== SCHEMA_VERSION) return null;
  if (typeof parsed.lastHeartbeat !== 'string' || Number.isNaN(Date.parse(parsed.lastHeartbeat))) return null;
  return parsed;
}

/**
 * Derive the in-flight lane's view model, or `null` when there is nothing to
 * show — absent artifact, malformed artifact, OR a heartbeat past the
 * staleness window (a crashed/killed session; AC3's "no zombie lane"). LIVE
 * (heartbeat within the window) returns counts by agent type plus the session
 * start time, so the panel can render "which workers/verifiers [have run],
 * since when" (AC1) without ever assuming a live session that has gone quiet.
 * @param {string|null|undefined} raw — the fetched artifact body.
 * @param {number} now — current epoch ms, injected so this stays pure/testable.
 * @returns {{startedAt:string, lastHeartbeat:string, workerCount:number, verifierCount:number, agentCount:number} | null}
 */
export function deriveInFlightView(raw, now) {
  const state = parseInFlightDoc(raw);
  if (!state) return null;

  const lastHeartbeatMs = Date.parse(state.lastHeartbeat);
  const elapsed = Number(now) - lastHeartbeatMs;
  if (!Number.isFinite(elapsed) || elapsed > STALE_WINDOW_MS) return null; // stale — reap silently.

  const agents = Array.isArray(state.agents) ? state.agents : [];
  const workerCount = agents.filter((a) => a && a.agentType === 'worker').length;
  const verifierCount = agents.filter((a) => a && a.agentType === 'verifier').length;

  return {
    startedAt: typeof state.startedAt === 'string' ? state.startedAt : state.lastHeartbeat,
    lastHeartbeat: state.lastHeartbeat,
    workerCount,
    verifierCount,
    agentCount: agents.length,
  };
}
