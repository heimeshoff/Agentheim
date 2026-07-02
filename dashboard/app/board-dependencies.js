/* ============================================================
   Agentheim — dashboard board hover-dependency resolver (agentic-workflow-k5p8w)

   A pure, framework-free resolution of one hovered ticket's dependsOn/blocks
   edges (raw, unresolved id-string arrays the /api/tree projection carries —
   agentic-workflow-d8q3n, ADR-0002) against the full pooled ticket universe
   (all four columns, all BCs — board-data.treeToColumns's output flattened).
   It answers exactly one question: "of the tickets currently rendered
   anywhere on the board, which ones does the hovered card depend on, and
   which ones does it block?" — the board turns the answer into the
   directional dependency ring (design-system-w4t9k) on each matching card.

   Mirrors board-sort.js / board-group.js: no React, no htm, no DOM, so it is
   unit-testable under `node --test`. It never mutates the read model, the
   projection, or disk (ADR-0002/ADR-0001) — hover is transient, client-side
   view-state only (ADR-0017); nothing here writes anywhere.

   Deliberately excludes collapsed-group markers, Done-peek markers, and
   off-viewport edge blinks — a target with no DOM node (hidden inside a
   collapsed group) simply resolves into a Set with no card to apply it to;
   that gap is agentic-workflow-h9v3m's layer on top of this one.
   ============================================================ */

// The two hover-source statuses that trigger resolution. Doing/done cards
// don't participate in the backlog/todo planning view this ring serves —
// hovering one yields two empty sets, one gate, one place.
const TRIGGER_STATUSES = new Set(['backlog', 'todo']);

const EMPTY = Object.freeze({ waitingOn: new Set(), holdingUp: new Set() });

/**
 * Resolve a hovered ticket's dependsOn/blocks edges into the live,
 * currently-pooled id universe.
 *
 * @param {object|null} hoveredTicket — TicketCard-shaped object (board-data.treeTicket),
 *        carrying `dependsOn`/`blocks` raw id arrays and a `status`.
 * @param {Array<object>|null} allTickets — every pooled ticket across all four
 *        columns/BCs (the full board, not just one column).
 * @returns {{ waitingOn: Set<string>, holdingUp: Set<string> }}
 *
 * `waitingOn` = hoveredTicket.dependsOn, resolved: dangling ids dropped, the
 * hovered card's own id excluded, deduped via Set.
 * `holdingUp` = hoveredTicket.blocks, same resolution.
 * A ticket appearing in BOTH lists resolves deterministically — waitingOn
 * wins (pure, defined precedence, never a throw).
 * Only invoked for a hovered ticket whose status is backlog or todo — any
 * other status (or a missing/malformed hovered ticket, or a missing/
 * non-array allTickets) degrades to two empty sets, never NaN, never a throw.
 */
export function resolveHoverDependencies(hoveredTicket, allTickets) {
  if (!hoveredTicket || typeof hoveredTicket !== 'object') return EMPTY;
  if (!TRIGGER_STATUSES.has(hoveredTicket.status)) return EMPTY;
  if (!Array.isArray(allTickets)) return EMPTY;

  const selfId = hoveredTicket.id;

  const liveIds = new Set();
  for (const t of allTickets) {
    if (t && typeof t.id === 'string' && t.id !== '') liveIds.add(t.id);
  }

  const dependsOn = Array.isArray(hoveredTicket.dependsOn) ? hoveredTicket.dependsOn : [];
  const blocks = Array.isArray(hoveredTicket.blocks) ? hoveredTicket.blocks : [];

  const waitingOn = new Set();
  for (const id of dependsOn) {
    if (typeof id === 'string' && id !== selfId && liveIds.has(id)) waitingOn.add(id);
  }

  const holdingUp = new Set();
  for (const id of blocks) {
    // waitingOn wins on overlap — a ticket already in waitingOn is skipped here.
    if (typeof id === 'string' && id !== selfId && liveIds.has(id) && !waitingOn.has(id)) {
      holdingUp.add(id);
    }
  }

  return { waitingOn, holdingUp };
}
