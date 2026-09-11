/* ============================================================
   Agentheim — Drawer expand-state resolution (design-system-020)
   Framework-free (no React, no htm) so the load-bearing controlled-vs-
   uncontrolled decision for the in-place width toggle is testable under
   `node --test` without the canvas import map — mirroring
   collapsible-state.js (isControlled), card.js (showEstimate) and
   motion.js (doingPulseClass).
   ============================================================ */

/**
 * Whether the Drawer's in-place expand is CONTROLLED for a given `expanded`
 * prop — the standard React resolution, identical in shape to
 * collapsible-state.js's `isControlled`: the seam is controlled when an
 * explicit `expanded` value is supplied (the consumer owns the truth — the
 * slide-over drives it and supplies its own rail-aware `expandedWidth`,
 * aw-074), and uncontrolled when `expanded` is omitted (the canvas specimen
 * case — the primitive holds its own `useState`).
 *
 * `expanded === false` is STILL controlled — a consumer owning a collapsed
 * panel is normal; only `undefined` (omitted) is uncontrolled.
 *
 * @param {boolean|undefined} expanded — the controlled expand prop, or undefined.
 * @returns {boolean} true when the consumer owns the expand state.
 */
export function isExpandControlled(expanded) {
  return expanded !== undefined;
}
