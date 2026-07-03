/* ============================================================
   Agentheim — dashboard board hidden/off-viewport dependency
   classification (agentic-workflow-h9v3m)

   Sits ON TOP of agentic-workflow-k5p8w's resolveHoverDependencies: given the
   resolved waitingOn/holdingUp target-id sets for the active hover session,
   this pure module answers the two questions GEOMETRY cannot (a closed
   Collapsible renders no body, so there is no DOM node to find a rendered
   position for — ADR-0033 pt. 3):

   1. Which board sections are currently COLLAPSED and hide at least one
      target id (annotateSectionHiddenDependency) — mirrors
      rail-attention.annotateGroups's "propagate a flag to a possibly-
      collapsed header" shape, one column's groupTickets sections at a time.
   2. Whether the Done column, when PEEKED (height-clamped, board-view-state's
      `peek`), holds at least one target id at all (donePeekHasHiddenDependency)
      — a narrowing candidate only: the clamp is a height clamp, not a
      node-count cut, so the DOM glue in board.js still runs ONE bounded rect
      check per candidate target to tell "genuinely clipped below the clamp"
      from "still within the visible clamp window" (ADR-0033's Notes).

   It also carries the one pure rect-math helper the off-viewport edge-blink
   DOM glue calls into (classifyEdge) and a trivial Set-union helper
   (unionTargetIds) so board.js never has to hand-roll either.

   No React, no htm, no DOM — unit-testable under `node --test`, mirroring
   board-group.js / board-dependencies.js / rail-attention.js. Never mutates
   its inputs, never touches disk, never produces a persisted artifact
   (ADR-0017 / ADR-0033 pt. 4) — everything here is transient hover-session
   presentation state.
   ============================================================ */

/**
 * Annotate one column's groupTickets sections with `hasHiddenDependency`:
 * true when a section is CURRENTLY COLLAPSED (`sec.collapsed === true`,
 * groupTickets' own derived flag from persisted view-state) and holds at
 * least one ticket whose id is in `targetIds`.
 *
 * An OPEN section is never flagged here even if it holds a target — an open
 * section renders a real DOM node per card, so that case is the on-card ring
 * (agentic-workflow-k5p8w) or the off-viewport edge-blink (classifyEdge
 * below), never this marker.
 *
 * @param {Array<{ bc, grouped, count, collapsed, tickets }>} sections —
 *        one column's board-group.groupTickets output.
 * @param {Set<string>|Array<string>} targetIds — the hover session's
 *        resolved dependency target ids (typically unionTargetIds(waitingOn,
 *        holdingUp)).
 * @returns {Array<{ bc, grouped, count, collapsed, tickets, hasHiddenDependency }>}
 *        a NEW array of NEW section objects (input never mutated).
 *
 * Pure + total: a non-array `sections` degrades to `[]`; a missing/malformed
 * `targetIds` degrades to an empty set (every section flags `false`). Never
 * throws.
 */
export function annotateSectionHiddenDependency(sections, targetIds) {
  if (!Array.isArray(sections)) return [];
  const ids = targetIds instanceof Set ? targetIds : new Set(Array.isArray(targetIds) ? targetIds : []);

  return sections.map((sec) => {
    const tickets = sec && Array.isArray(sec.tickets) ? sec.tickets : [];
    const hasHiddenDependency = !!(sec && sec.collapsed === true)
      && tickets.some((t) => t && ids.has(t.id));
    return { ...sec, hasHiddenDependency };
  });
}

/**
 * Narrow candidate for the Done column's peek marker: true only when the
 * Done column is CURRENTLY PEEKED (`peek === true`) and its (unsectioned,
 * full) ticket list holds at least one target id.
 *
 * This is a NARROWING, not the final placement decision — "Done is peeked
 * and holds a target" says nothing about whether that target sits within the
 * clamp's visible window or below it (the clamp is a height clamp, not a
 * node-count cut). The DOM glue in board.js runs one bounded rect check per
 * candidate to resolve that; a `true` here just says "it's worth checking."
 *
 * @param {Array<object>} doneTickets — the Done column's full (unsectioned)
 *        ticket list.
 * @param {Set<string>|Array<string>} targetIds — the hover session's
 *        resolved dependency target ids.
 * @param {boolean} peek — the Done column's persisted peek boolean.
 * @returns {boolean}
 *
 * Pure + total: a non-true `peek`, a non-array `doneTickets`, or a missing/
 * malformed `targetIds` all degrade to `false`. Never throws.
 */
export function donePeekHasHiddenDependency(doneTickets, targetIds, peek) {
  if (peek !== true) return false;
  if (!Array.isArray(doneTickets)) return false;
  const ids = targetIds instanceof Set ? targetIds : new Set(Array.isArray(targetIds) ? targetIds : []);
  if (ids.size === 0) return false;
  return doneTickets.some((t) => t && ids.has(t.id));
}

/**
 * Union two dependency target-id collections (agentic-workflow-k5p8w's
 * waitingOn/holdingUp) into one Set — the section/Done markers below are
 * DIRECTION-AGNOSTIC (design-system-b7n2s: "one marker meaning 'expand to
 * see' is enough — direction stays on the on-card ring"), so board.js needs
 * one combined id universe to test group/Done membership against, not two.
 *
 * @param {Set<string>|Array<string>} [waitingOn]
 * @param {Set<string>|Array<string>} [holdingUp]
 * @returns {Set<string>}
 *
 * Pure + total: missing/malformed inputs contribute nothing (never throws);
 * a fully missing pair returns an empty Set.
 */
export function unionTargetIds(waitingOn, holdingUp) {
  const out = new Set();
  for (const src of [waitingOn, holdingUp]) {
    if (src instanceof Set) { for (const id of src) out.add(id); }
    else if (Array.isArray(src)) { for (const id of src) out.add(id); }
  }
  return out;
}

/**
 * Classify a rendered element's bounding rect against a root's bounds — the
 * ONE pure rect-math seam behind the off-viewport edge-blink (ADR-0033 pt.
 * 1): `board.js`'s IntersectionObserver callback (and the Done-peek clamp
 * check) hand this plain `{top, bottom}`-shaped objects (from
 * `entry.boundingClientRect` / `entry.rootBounds`, or a clamp body's own
 * computed window) — no DOM, no IntersectionObserver, ever reaches this
 * function.
 *
 * @param {{top: number, bottom: number}} rect — the target's bounding rect.
 * @param {{top: number, bottom: number}} rootBounds — the bounds to classify
 *        against (the scroll container's rect, or a Done clamp's visible
 *        window).
 * @returns {'above'|'below'|'visible'} `'above'` when `rect` sits entirely
 *        above `rootBounds` (no overlap); `'below'` when it sits entirely
 *        below (no overlap); `'visible'` otherwise — including any partial
 *        overlap, one rect fully containing the other, and every malformed/
 *        missing input (the safe default: never spuriously blink).
 *
 * Pure + total: never throws.
 */
export function classifyEdge(rect, rootBounds) {
  const validRect = !!(rect && typeof rect === 'object'
    && typeof rect.top === 'number' && typeof rect.bottom === 'number');
  const validRoot = !!(rootBounds && typeof rootBounds === 'object'
    && typeof rootBounds.top === 'number' && typeof rootBounds.bottom === 'number');
  if (!validRect || !validRoot) return 'visible';

  if (rect.bottom <= rootBounds.top) return 'above';
  if (rect.top >= rootBounds.bottom) return 'below';
  return 'visible';
}
