/* ============================================================
   Agentheim — live-observability hook signal, pure state core
   (agentic-workflow-m9w5c, ADR-0043)

   The dashboard shows only resting disk state (ADR-0017 read-only projection).
   During a `work` batch, in-flight workers/verifiers were invisible until their
   files landed. This module is the pure transition core behind the on-disk
   ADVISORY signal (ADR-0027 category, extended by ADR-0043 to a bounded second
   artifact) that two Claude Code hooks maintain:

     - a `Stop` hook scoped to the `work` skill's frontmatter — fires on every
       orchestrator turn while `work` is active. `applyHeartbeat` is its core:
       first fire creates the session record (`startedAt === lastHeartbeat`),
       every later fire just bumps `lastHeartbeat`.
     - a `Stop` hook scoped to `agents/worker.md` / `agents/verifier.md`
       frontmatter — auto-converted to `SubagentStop` when that subagent
       completes (work-terminal-completion-signal research). `applyAgentCompletion`
       is its core: records `{ agentType, agentId, completedAt }`, replacing any
       prior entry for the same `agentId` (never duplicating), and also bumps the
       heartbeat (a subagent finishing is itself proof the session was alive).

   STALENESS is the crash-safety mechanism (work-session-presence-lock research):
   there is no reliable "session ended" hook (SessionEnd is undocumented for
   crash/SIGKILL and confirmed to skip `/exit`), so a heartbeat older than
   STALE_WINDOW_MS is treated as a NEW session starting fresh — `agents` clears,
   `startedAt` resets. This is what keeps a crashed/killed session's stale
   signals from producing a zombie in-flight lane (AC3): the dashboard-side
   reader (dashboard/app/in-flight-state.js) applies the SAME staleness test and
   renders nothing once the heartbeat goes stale, rather than showing a lane that
   never updates again.

   Framework-free, I/O-free, pure over injected timestamps — testable under
   `node --test` with no filesystem or clock dependency. The I/O glue (reading/
   writing `.agentheim/state/in-flight.json`, parsing the hook's stdin JSON)
   lives in lib/hook-agent-signal.mjs, which calls these functions.
   ============================================================ */

// No doc basis for an exact number (the presence-lock research flags this as an
// open, empirically-chosen question) — 5 minutes comfortably exceeds the gap
// between ordinary orchestrator turns (tool calls, worker dispatch waits) while
// still reaping a crashed session's lane promptly once the dashboard is watching.
export const STALE_WINDOW_MS = 5 * 60 * 1000;

const SCHEMA_VERSION = 1;

function isValidState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    state.version === SCHEMA_VERSION &&
    typeof state.lastHeartbeat === 'string' &&
    !Number.isNaN(Date.parse(state.lastHeartbeat))
  );
}

/**
 * Whether `state`'s heartbeat is older than `staleMs` as of `nowMs` — the reaping
 * test. Malformed/absent state is always stale (never treated as "still live").
 * @param {unknown} state
 * @param {number} nowMs — epoch ms, injected so this stays pure/testable.
 * @param {number} [staleMs]
 * @returns {boolean}
 */
export function isStale(state, nowMs, staleMs = STALE_WINDOW_MS) {
  if (!isValidState(state)) return true;
  const then = Date.parse(state.lastHeartbeat);
  return Number(nowMs) - then > staleMs;
}

/**
 * Apply one `Stop`-hook heartbeat fire. Creates a fresh session record on the
 * first fire (or when the prior record is malformed/stale — a crashed session's
 * leftover signal never leaks into a new one), otherwise bumps `lastHeartbeat`
 * and keeps `startedAt` unchanged. Never throws.
 * @param {unknown} existing — the prior parsed state (or null/malformed).
 * @param {{ sessionId?: string|null, nowIso: string, staleMs?: number }} opts
 * @returns {{version:1, sessionId:string|null, startedAt:string, lastHeartbeat:string, agents:Array}}
 */
export function applyHeartbeat(existing, { sessionId = null, nowIso, staleMs = STALE_WINDOW_MS }) {
  const nowMs = Date.parse(nowIso);
  const stale = !isValidState(existing) || isStale(existing, nowMs, staleMs);
  if (stale) {
    return { version: SCHEMA_VERSION, sessionId, startedAt: nowIso, lastHeartbeat: nowIso, agents: [] };
  }
  return { ...existing, sessionId: sessionId ?? existing.sessionId ?? null, lastHeartbeat: nowIso };
}

/**
 * Apply one `SubagentStop` (auto-converted from a subagent's own `Stop`) fire.
 * Bumps the heartbeat exactly as `applyHeartbeat` does (a subagent completing is
 * itself proof of liveness), then records the completion — replacing any prior
 * entry for the same `agentId` rather than duplicating, and pruning any entry
 * whose `completedAt` has itself gone stale. This keeps the artifact BOUNDED —
 * it is a merge-and-overwrite snapshot, not an append log (ADR-0027 §4.2's
 * "overwritten, never appended" guard rail, honored at the content level).
 * @param {unknown} existing
 * @param {{ agentType?: string, agentId?: string, sessionId?: string|null, nowIso: string, staleMs?: number }} opts
 * @returns {{version:1, sessionId:string|null, startedAt:string, lastHeartbeat:string, agents:Array<{agentType:string, agentId:string, completedAt:string}>}}
 */
export function applyAgentCompletion(existing, { agentType, agentId, sessionId = null, nowIso, staleMs = STALE_WINDOW_MS }) {
  const base = applyHeartbeat(existing, { sessionId, nowIso, staleMs });
  if (typeof agentType !== 'string' || agentType === '') return base; // nothing identifiable to record.

  const nowMs = Date.parse(nowIso);
  const id = typeof agentId === 'string' ? agentId : '';
  const survivors = (Array.isArray(base.agents) ? base.agents : []).filter((a) => {
    if (!a || typeof a.completedAt !== 'string') return false;
    const t = Date.parse(a.completedAt);
    if (Number.isNaN(t) || nowMs - t > staleMs) return false; // pruned — past the window.
    return a.agentId !== id; // drop any stale duplicate of the id we're about to (re)write.
  });
  return { ...base, agents: [...survivors, { agentType, agentId: id, completedAt: nowIso }] };
}
