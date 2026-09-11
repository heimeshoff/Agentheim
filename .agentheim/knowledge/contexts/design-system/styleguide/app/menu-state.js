/* ============================================================
   Agentheim — Menu / Popover open-state resolution (design-system-015)
   Framework-free (no React, no htm) so the load-bearing controlled-vs-
   uncontrolled decision AND the dismissal predicate are testable under
   `node --test` without the canvas import map — mirroring collapsible-
   state.js (isControlled), card.js (showEstimate) and motion.js
   (doingPulseClass).

   The Menu is the dashboard's first popover affordance (the topbar
   settings gear, agentic-workflow-049). It shares the SAME ownership
   seam as the Collapsible (ds-005): it owns the open/close truth, so it
   owns the floating panel it reveals; consumers compose arbitrary menu
   items into a body-agnostic item area.
   ============================================================ */

/**
 * Whether a Menu is CONTROLLED for a given `open` prop — the standard React
 * resolution, identical in spirit to the Collapsible's: a component is
 * controlled when an explicit `open` value is supplied (the parent owns the
 * truth), and uncontrolled when `open` is omitted (the primitive holds its own
 * `useState(defaultOpen)` — the board's settings gear, which owns no menu state
 * of its own, runs uncontrolled).
 *
 * `open === false` is STILL controlled — only `undefined` (omitted) is
 * uncontrolled.
 *
 * @param {boolean|undefined} open — the controlled open prop, or undefined.
 * @returns {boolean} true when the parent owns the open state.
 */
export function isControlled(open) {
  return open !== undefined;
}

/**
 * Whether an Escape keypress should dismiss the menu — the load-bearing key of
 * the keyboard-dismissal contract, factored out so the predicate is testable
 * without a DOM. ONLY the Escape key dismisses; every other key is ignored here
 * (focusable menu items handle their own activation).
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean} true when this key should close an open menu.
 */
export function isDismissKey(key) {
  return key === "Escape";
}

/**
 * Whether an outside-click (a document mousedown) should dismiss the menu: true
 * exactly when the menu is open AND the event target lies OUTSIDE the menu's
 * root element. A click WITHIN the root (the trigger or a menu item — e.g.
 * flipping a toggle) must NOT dismiss, so the popover survives in-menu
 * interaction.
 *
 * Pure and DOM-free: the caller passes the boolean "is the target contained?"
 * (computed via `rootEl.contains(target)` at the call site) so the decision
 * itself is unit-testable.
 *
 * @param {boolean} open — whether the menu is currently open.
 * @param {boolean} targetInsideRoot — whether the click landed inside the menu root.
 * @returns {boolean} true when the click should dismiss the menu.
 */
export function shouldDismissOnOutsideClick(open, targetInsideRoot) {
  return open && !targetInsideRoot;
}

/**
 * Whether a trigger keydown should OPEN the menu — Enter or Space, the native
 * activation keys for a button-role trigger. (A native `<button>` already fires
 * click on Enter/Space; this predicate makes the contract explicit and testable
 * for non-button triggers / source-guards.)
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean} true when this key should open the menu from the trigger.
 */
export function isOpenKey(key) {
  return key === "Enter" || key === " " || key === "Spacebar";
}
