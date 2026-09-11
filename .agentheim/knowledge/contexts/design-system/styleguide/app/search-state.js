/* ============================================================
   Agentheim — Search / combobox decision resolution
   (design-system-016)

   Framework-free (no React, no htm) so the load-bearing combobox
   decisions — the active-descendant keyboard model, the panel
   state machine (empty-query / no-results / results), the
   flattening of grouped results into a single highlight track, the
   excerpt term-marking, and the dismissal predicates — are testable
   under `node --test` WITHOUT the canvas import map. Mirrors
   collapsible-state.js (isControlled), menu-state.js (isDismissKey /
   shouldDismissOnOutsideClick) and motion.js (doingPulseClass).

   This is the SECOND popover consumer that ds-015's Menu Notes
   anticipated — but a RICHER combobox: focus stays in the input and
   a single highlight moves across ALL rows (spanning category
   groups) via `aria-activedescendant`, whereas the Menu moves focus
   INTO its items. That focus model is exactly why the combobox's
   floating panel + dismiss is built STANDALONE here rather than
   composed on Menu (refine 2026-06-16). The two read identically by
   sharing the --shadow-md Popover elevation CONVENTION, not code.
   ============================================================ */

/**
 * Flatten grouped results into ONE ordered list of rows spanning all groups,
 * tagging each row with its group label and a stable option id. This is the
 * single highlight track the active-descendant keyboard model walks: up/down
 * moves across the flat order, crossing group boundaries seamlessly.
 *
 * Each input group is `{ label, items: [...] }`; each item is opaque to the
 * styleguide (body-agnostic — the consumer supplies the data). The flattened
 * row carries `{ item, groupLabel, index, id }` where `index` is the global
 * position in the flat track and `id` is `${idPrefix}-opt-${index}` (the value
 * fed to `aria-activedescendant`).
 *
 * @param {Array<{label: string, items: any[]}>} groups — grouped results.
 * @param {string} [idPrefix="agh-search"] — prefix for generated option ids.
 * @returns {Array<{item: any, groupLabel: string, index: number, id: string}>}
 */
export function flattenGroups(groups, idPrefix = "agh-search") {
  const flat = [];
  if (!Array.isArray(groups)) return flat;
  for (const group of groups) {
    if (!group || !Array.isArray(group.items)) continue;
    for (const item of group.items) {
      const index = flat.length;
      flat.push({ item, groupLabel: group.label, index, id: `${idPrefix}-opt-${index}` });
    }
  }
  return flat;
}

/**
 * The total number of selectable rows across all groups — the length of the
 * flat highlight track. Used to bound the active index and to decide the
 * no-results state.
 *
 * @param {Array<{label: string, items: any[]}>} groups — grouped results.
 * @returns {number}
 */
export function resultCount(groups) {
  return flattenGroups(groups).length;
}

/**
 * The panel's state machine, derived purely from the query and the result
 * count — so the panel is NEVER dead (no blank floating box):
 *   - "closed"     — the field has no query yet (empty / whitespace-only);
 *                    nothing to show, the panel stays shut.
 *   - "no-results" — a non-empty query matched nothing; the panel shows an
 *                    explicit "no matches" line, not emptiness.
 *   - "results"    — a non-empty query with at least one row; show the groups.
 *
 * @param {string} query — the current input value.
 * @param {number} count — the number of result rows (from resultCount).
 * @returns {"closed"|"no-results"|"results"}
 */
export function panelState(query, count) {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (trimmed.length === 0) return "closed";
  if (count <= 0) return "no-results";
  return "results";
}

/**
 * Whether the floating panel should be open (visible) for a given query +
 * count: open for BOTH "results" and "no-results" (the no-results line is
 * still a panel), closed only when there is no query. Convenience wrapper over
 * panelState so consumers don't re-derive it.
 *
 * @param {string} query
 * @param {number} count
 * @returns {boolean}
 */
export function isPanelOpen(query, count) {
  return panelState(query, count) !== "closed";
}

/**
 * The next active (highlighted) row index for an arrow keypress — the heart of
 * the active-descendant model. Moves a SINGLE highlight across the whole flat
 * track (spanning groups), wrapping at the ends so ArrowDown past the last row
 * lands on the first and ArrowUp before the first lands on the last.
 *
 * A `current` of -1 means "no row highlighted yet" (the input just opened):
 * ArrowDown selects the first row (0), ArrowUp selects the last (count-1).
 *
 * @param {number} current — the current active index, or -1 for none.
 * @param {number} count — total rows in the flat track.
 * @param {"down"|"up"} direction — the arrow direction.
 * @returns {number} the next active index, or -1 when there are no rows.
 */
export function nextActiveIndex(current, count, direction) {
  if (!Number.isFinite(count) || count <= 0) return -1;
  if (direction === "down") {
    // From "none" (-1) ArrowDown lands on the first row; past the last wraps to
    // the first.
    if (current < 0) return 0;
    return current >= count - 1 ? 0 : current + 1;
  }
  // up: from "none" (-1) ArrowUp lands on the last row; before the first wraps
  // to the last.
  if (current <= 0) return count - 1;
  return current - 1;
}

/**
 * The `aria-activedescendant` value for the input: the option id of the active
 * row, or "" (no active descendant) when nothing is highlighted or the index is
 * out of range. Empty string is the correct ARIA "none" signal.
 *
 * @param {Array<{id: string}>} flat — the flattened rows (from flattenGroups).
 * @param {number} activeIndex — the active index, or -1 for none.
 * @returns {string} the active descendant id, or "".
 */
export function activeDescendantId(flat, activeIndex) {
  if (!Array.isArray(flat)) return "";
  if (activeIndex < 0 || activeIndex >= flat.length) return "";
  return flat[activeIndex].id || "";
}

/**
 * Which arrow key (if any) a keydown is — maps a KeyboardEvent.key to the
 * navigation direction the combobox understands, or null for a non-arrow key.
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
 * Whether an Escape keypress should dismiss/clear the combobox — matching the
 * Menu's dismissal contract (menu-state.js): ONLY Escape. Esc closes the panel
 * and clears the highlight; the consumer decides whether to also clear the
 * query (the styleguide closes + clears the active row).
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @returns {boolean}
 */
export function isDismissKey(key) {
  return key === "Escape";
}

/**
 * Whether an Enter keypress should SELECT the highlighted row: true exactly when
 * Enter is pressed AND a row is currently highlighted (activeIndex within
 * range). Enter with no highlight is a no-op (the consumer may submit the raw
 * query itself; the combobox does not invent a selection).
 *
 * @param {string} key — a KeyboardEvent.key value.
 * @param {number} activeIndex — the active index, or -1 for none.
 * @param {number} count — total rows.
 * @returns {boolean}
 */
export function isSelectKey(key, activeIndex, count) {
  return key === "Enter" && activeIndex >= 0 && activeIndex < count;
}

/**
 * Whether an outside-click (a document mousedown) should dismiss the panel: true
 * exactly when the panel is open AND the click landed OUTSIDE the combobox root.
 * A click WITHIN the root (the input or a result row) must NOT dismiss. Pure and
 * DOM-free — the caller passes the contained? boolean (computed via
 * `rootEl.contains(target)`), identical to the Menu's predicate so the two
 * popovers dismiss by the same convention.
 *
 * @param {boolean} open — whether the panel is currently open.
 * @param {boolean} targetInsideRoot — whether the click landed inside the root.
 * @returns {boolean}
 */
export function shouldDismissOnOutsideClick(open, targetInsideRoot) {
  return open && !targetInsideRoot;
}

/**
 * Split an excerpt into marked / unmarked segments around occurrences of the
 * matched term — the data behind the highlighted snippet in each result row.
 * Pure (returns segments, not markup) so the term-marking is unit-testable
 * without a DOM; the view maps marked segments to a styled <mark>.
 *
 * Case-INSENSITIVE matching; the original casing of the excerpt is preserved in
 * the emitted segments. An empty / missing term yields a single unmarked
 * segment (the whole excerpt). Non-overlapping, left-to-right.
 *
 * @param {string} excerpt — the snippet text.
 * @param {string} term — the matched term to mark.
 * @returns {Array<{text: string, marked: boolean}>}
 */
export function markMatches(excerpt, term) {
  const text = typeof excerpt === "string" ? excerpt : "";
  const needle = typeof term === "string" ? term.trim() : "";
  if (needle.length === 0 || text.length === 0) {
    return text.length ? [{ text, marked: false }] : [];
  }
  const segments = [];
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let from = 0;
  let at = lowerText.indexOf(lowerNeedle, from);
  while (at !== -1) {
    if (at > from) segments.push({ text: text.slice(from, at), marked: false });
    segments.push({ text: text.slice(at, at + needle.length), marked: true });
    from = at + needle.length;
    at = lowerText.indexOf(lowerNeedle, from);
  }
  if (from < text.length) segments.push({ text: text.slice(from), marked: false });
  return segments;
}
