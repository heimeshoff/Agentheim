/* ============================================================
   Agentheim — ModelSplitButton keyboard/menu decision resolution
   (design-system-r9dtm)

   Framework-free (no React, no htm) so the load-bearing keyboard
   contract is testable under `node --test` without the canvas import
   map — mirroring collapsible-state.js (isControlled), menu-state.js
   (isDismissKey / shouldDismissOnOutsideClick) and search-state.js
   (arrowDirection / nextActiveIndex).

   A DEDICATED module rather than composing Menu.js or SearchField's
   search-state.js: the caret opens a ROVING-TABINDEX menu (focus moves
   onto the highlighted menuitemradio row, Escape returns it to the
   caret) — a third, distinct focus model from Menu's "consumer-supplied
   focusable items" and SearchField's "focus stays in the input,
   aria-activedescendant" combobox (see search.js's own Notes on why it
   didn't reuse Menu either). Each existing popover-ish primitive earns
   its own small state module for exactly this reason.
   ============================================================ */

/**
 * The menu's starting highlight index when it opens: the current `value`'s
 * position in `options`, or 0 (the first option) when `value` isn't found or
 * `options` is empty.
 *
 * @param {any[]} options — the selectable options.
 * @param {any} value — the currently selected option.
 * @returns {number} the starting highlight index.
 */
export function initialHighlightIndex(options, value) {
  if (!Array.isArray(options) || options.length === 0) return 0;
  const idx = options.indexOf(value);
  return idx >= 0 ? idx : 0;
}

/**
 * The next highlight index for an arrow keypress — CLAMPED at the ends (no
 * wraparound): ArrowDown past the last option stays on the last; ArrowUp
 * before the first stays on the first.
 *
 * @param {number} current — the current highlight index.
 * @param {number} count — total selectable options.
 * @param {"down"|"up"} direction — the arrow direction.
 * @returns {number} the next highlight index (0 when count <= 0).
 */
export function nextHighlightIndex(current, count, direction) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (direction === "down") return Math.min(current + 1, count - 1);
  if (direction === "up") return Math.max(current - 1, 0);
  return current;
}

/**
 * Which arrow key (if any) a keydown is — maps a KeyboardEvent.key to the
 * navigation direction the menu understands, or null for a non-arrow key.
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {"down"|"up"|null}
 */
export function arrowDirection(key) {
  if (key === "ArrowDown") return "down";
  if (key === "ArrowUp") return "up";
  return null;
}

/**
 * Whether a keypress should SELECT the highlighted option — Enter, and only
 * Enter (a menuitemradio row is not itself a <button>, so no native Space
 * activation is assumed here).
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean}
 */
export function isSelectKey(key) {
  return key === "Enter";
}

/**
 * Whether a keypress should CLOSE the menu and return focus to the caret —
 * Escape, matching the Menu/SearchField dismissal contract (menu-state.js /
 * search-state.js): only Escape dismisses.
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean}
 */
export function isDismissKey(key) {
  return key === "Escape";
}

/**
 * The character length of the widest option — used to size the primary
 * region's label so the button never reflows the prompt-bar row as the
 * selected option's name changes length (e.g. "Alpha" → "Gamma"). Deliberately
 * NOT a fixed pixel width (the task's explicit constraint): the caller uses
 * this as a `ch`-unit min-width.
 *
 * @param {any[]} options — the selectable options.
 * @returns {number} the longest option's string length, or 0 for an empty list.
 */
export function widestOptionLength(options) {
  if (!Array.isArray(options) || options.length === 0) return 0;
  return options.reduce((max, opt) => Math.max(max, String(opt).length), 0);
}
