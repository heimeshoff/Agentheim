/* ============================================================
   Agentheim — Collapsible open-state resolution (design-system-005)
   Framework-free (no React, no htm) so the load-bearing controlled-vs-
   uncontrolled decision is testable under `node --test` without the
   canvas import map — mirroring card.js (showEstimate) and motion.js
   (doingPulseClass).
   ============================================================ */

/**
 * Whether a Collapsible is CONTROLLED for a given `open` prop — the standard
 * React resolution: a component is controlled when an explicit `open` value is
 * supplied (the parent owns the truth; the board drives it from persisted
 * view-state, ADR-0015), and uncontrolled when `open` is omitted (the TreeGroup
 * behavior — the primitive holds its own `useState(defaultOpen)`).
 *
 * `open === false` is STILL controlled — a parent owning a closed section is the
 * board's normal case; only `undefined` (omitted) is uncontrolled.
 *
 * @param {boolean|undefined} open — the controlled open prop, or undefined.
 * @returns {boolean} true when the parent owns the open state.
 */
export function isControlled(open) {
  return open !== undefined;
}
