/* ============================================================
   Agentheim — dashboard live-frame router (agentic-workflow-mvt8x, ADR-0070)

   The READ-side counterpart to ADR-0027's write-side advisory/lifecycle split
   (extended by ADR-0043). A raw `tree-changed` frame's `path` sorts into
   exactly one of three categories — this module decides who should re-sync,
   NEVER what changed in the model (ADR-0001 / ADR-0070 §3: routing is not
   interpretation). The classified category is handed to the live-tree hub
   (live-tree-hub.js), which is the only consumer of this module.

     - STRUCTURAL — `.agentheim/contexts/**`, `.agentheim/knowledge/**`, or any
       path this module does not otherwise recognize. The board and rail
       re-sync (one shared /api/tree fetch via the hub).
     - ADVISORY   — `.agentheim/state/**`. Only the panel that reads that
       EXACT artifact re-syncs (`state/whats-next.md` → WhatsNextPanel,
       `state/in-flight.json` → InFlightLane). Never the board, never the
       rail.
     - RUNTIME    — `.agentheim/.dashboard/**` (the runfile, bridge discovery
       file, last-port marker — infrastructure's own transport bookkeeping,
       ADR-0002 / ADR-0018 / ADR-0053). No dashboard consumer re-syncs.

   FAIL OPEN (ADR-0070 §4): `fs.watch` filenames are platform-inconsistent
   (ADR-0006 already calls the emitted path a *hint*), and the `hello` frame
   carries no path at all. An absent, malformed, non-string, or otherwise
   unrecognized path classifies as STRUCTURAL — everybody re-syncs, i.e.
   exactly today's (pre-routing) behavior for that frame. A classification
   miss can only cost one wasted fetch; it can never produce a stale board.

   Pure, framework-free, unit-tested under `node --test` with no DOM
   (live-frame-router.test.mjs) — matching the BC's data-module convention
   (board-data.js, library-data.js, rail-attention.js, ...).
   ============================================================ */

export const FRAME_CATEGORY = Object.freeze({
  STRUCTURAL: 'structural',
  ADVISORY: 'advisory',
  RUNTIME: 'runtime',
});

const ADVISORY_PREFIX = '.agentheim/state/';
const RUNTIME_PREFIX = '.agentheim/.dashboard/';

/**
 * Classify a `tree-changed` frame's raw `path` pointer into the audience it
 * addresses. Never inspects file content, never interprets the change — see
 * this module's header comment.
 *
 * @param {unknown} path — the frame's `path` field (may be absent, null,
 *   malformed, or a path this router does not recognize).
 * @returns {'structural'|'advisory'|'runtime'}
 */
export function classifyFramePath(path) {
  if (typeof path !== 'string' || path.length === 0) return FRAME_CATEGORY.STRUCTURAL;
  if (path.startsWith(ADVISORY_PREFIX)) return FRAME_CATEGORY.ADVISORY;
  if (path.startsWith(RUNTIME_PREFIX)) return FRAME_CATEGORY.RUNTIME;
  return FRAME_CATEGORY.STRUCTURAL;
}
