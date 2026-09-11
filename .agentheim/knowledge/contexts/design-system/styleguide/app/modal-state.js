/* ============================================================
   Agentheim — Modal dismissal + focus-trap resolution (design-system-018)
   Framework-free (no React, no htm) so the load-bearing dismiss-key and
   focus-trap-wrap decisions are testable under `node --test` without the
   canvas import map — mirroring menu-state.js (isDismissKey,
   shouldDismissOnOutsideClick), collapsible-state.js (isControlled),
   card.js (showEstimate) and motion.js (doingPulseClass).

   The Modal is the styleguide's first CENTERED scrim-backed shell (vs.
   the Drawer's side panel, ds-001, and the Menu's anchored popover,
   ds-015). Unlike those it adds a FULL focus trap: Tab / Shift-Tab cycle
   stays contained within the open panel, and focus returns to the
   trigger on close. The two decisions a trap turns on — "is this the Tab
   key?" and "which focusable comes next, wrapping at the edges?" — are
   pure index math, factored out here so the trap is unit-testable
   without a DOM.
   ============================================================ */

/**
 * Whether an Escape keypress should dismiss the modal — the load-bearing key of
 * the keyboard-dismissal contract (Esc, scrim-click and Cancel all route through
 * the consumer's onClose; this predicate is the testable seam). ONLY Escape
 * dismisses; every other key is ignored here.
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean} true when this key should close an open modal.
 */
export function isDismissKey(key) {
  return key === "Escape";
}

/**
 * Whether a keydown participates in the focus trap — ONLY Tab (forward) and
 * Shift+Tab (backward) cycle focus within the panel. Every other key passes
 * through to the focused control.
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean} true when this key drives the focus trap.
 */
export function isTrapKey(key) {
  return key === "Tab";
}

/**
 * The focus-trap wrap math: given a count of focusable elements inside the panel,
 * the index of the currently-focused one, and whether Shift is held, return the
 * index that should receive focus next — wrapping at the edges so Tab past the
 * last focusable returns to the first and Shift-Tab before the first wraps to the
 * last. This is the pure core of "Tab/Shift-Tab stay contained within the panel".
 *
 * Edge rules:
 *   - `count === 0` → returns -1 (nothing to focus).
 *   - `activeIndex === -1` (focus is not on a known focusable, e.g. it escaped
 *     the panel) → forward Tab lands on the first (0), backward on the last
 *     (count-1), pulling focus back inside.
 *
 * Pure and DOM-free: the caller resolves the focusable list and the active
 * element's index at the call site, so the wrap decision itself is unit-testable.
 *
 * @param {number} count — number of focusable elements in the panel.
 * @param {number} activeIndex — index of the currently-focused focusable, or -1.
 * @param {boolean} shift — whether Shift is held (backward cycle).
 * @returns {number} the index to focus next, or -1 when there is nothing to focus.
 */
export function nextTrapFocusIndex(count, activeIndex, shift) {
  if (count <= 0) return -1;
  if (activeIndex < 0) return shift ? count - 1 : 0;
  const step = shift ? -1 : 1;
  return (activeIndex + step + count) % count;
}
