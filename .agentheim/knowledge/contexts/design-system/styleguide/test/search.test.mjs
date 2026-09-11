// Tests for the search-field + grouped-results combobox pattern (design-system-016).
//
// The combobox renders via htm/React with no DOM under `node --test`, so —
// mirroring the collapsible / menu / ticket-card suites — the load-bearing,
// framework-free contract is tested directly against the pure decisions the
// pattern delegates to (search-state.js):
//   1. flattenGroups / resultCount — the single highlight track spanning groups.
//   2. panelState / isPanelOpen — the never-dead panel state machine
//      (closed / no-results / results).
//   3. nextActiveIndex — the active-descendant arrow model, wrapping across
//      group boundaries.
//   4. activeDescendantId / arrowDirection / isDismissKey / isSelectKey —
//      the keyboard wiring.
//   5. shouldDismissOnOutsideClick — the standalone dismiss predicate, matching
//      the Menu's by convention.
//   6. markMatches — the excerpt term-marking data.
// Plus source-guards that the module owns the standalone panel + --shadow-md
// elevation (NOT composed on Menu), the combobox/listbox ARIA, the token-styled
// input, and that the canvas documents the pattern in context.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  flattenGroups, resultCount, panelState, isPanelOpen,
  nextActiveIndex, activeDescendantId, arrowDirection,
  isDismissKey, isSelectKey, shouldDismissOnOutsideClick, markMatches,
} from '../app/search-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const searchSrc = readFileSync(join(APP, 'search.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');

const GROUPS = [
  { label: 'Bounded contexts', items: [{ title: 'design-system' }, { title: 'agentic-workflow' }] },
  { label: 'Decisions', items: [{ title: 'ADR-0003' }] },
  { label: 'Research', items: [] }, // an empty group must contribute no rows
  { label: 'Tickets', items: [{ title: 'aw-052' }] },
];

// ---- the flat highlight track ----

test('flattenGroups produces one ordered track spanning groups, skipping empty groups', () => {
  const flat = flattenGroups(GROUPS);
  assert.equal(flat.length, 4, 'two BCs + one decision + one ticket; the empty Research group adds nothing');
  assert.deepEqual(flat.map((r) => r.item.title), ['design-system', 'agentic-workflow', 'ADR-0003', 'aw-052']);
  assert.deepEqual(flat.map((r) => r.index), [0, 1, 2, 3], 'global indices are contiguous across groups');
  assert.equal(flat[0].groupLabel, 'Bounded contexts');
  assert.equal(flat[2].groupLabel, 'Decisions', 'the highlight track crosses the group boundary');
});

test('flattenGroups assigns stable, prefixable option ids for aria-activedescendant', () => {
  assert.equal(flattenGroups(GROUPS)[2].id, 'agh-search-opt-2');
  assert.equal(flattenGroups(GROUPS, 'topbar')[0].id, 'topbar-opt-0');
});

test('flattenGroups is defensive against missing / malformed input', () => {
  assert.deepEqual(flattenGroups(undefined), []);
  assert.deepEqual(flattenGroups([null, { label: 'x' }]), [], 'a group with no items array contributes nothing');
});

test('resultCount counts rows across all groups', () => {
  assert.equal(resultCount(GROUPS), 4);
  assert.equal(resultCount([]), 0);
});

// ---- the never-dead panel state machine ----

test('panelState: empty / whitespace query keeps the panel closed (no dead box)', () => {
  assert.equal(panelState('', 4), 'closed');
  assert.equal(panelState('   ', 4), 'closed', 'whitespace-only is treated as empty');
  assert.equal(panelState(undefined, 4), 'closed');
});

test('panelState: a non-empty query with no rows is an explicit no-results panel', () => {
  assert.equal(panelState('zzz', 0), 'no-results');
});

test('panelState: a non-empty query with rows shows results', () => {
  assert.equal(panelState('des', 4), 'results');
});

test('isPanelOpen is true for both results and no-results, false only when no query', () => {
  assert.equal(isPanelOpen('des', 4), true);
  assert.equal(isPanelOpen('zzz', 0), true, 'the no-results line is still a panel');
  assert.equal(isPanelOpen('', 4), false);
});

// ---- the active-descendant arrow model ----

test('nextActiveIndex walks the flat track and wraps at both ends', () => {
  assert.equal(nextActiveIndex(-1, 4, 'down'), 0, 'ArrowDown from none → first row');
  assert.equal(nextActiveIndex(0, 4, 'down'), 1);
  assert.equal(nextActiveIndex(3, 4, 'down'), 0, 'ArrowDown past the last wraps to the first');
  assert.equal(nextActiveIndex(-1, 4, 'up'), 3, 'ArrowUp from none → last row');
  assert.equal(nextActiveIndex(0, 4, 'up'), 3, 'ArrowUp before the first wraps to the last');
  assert.equal(nextActiveIndex(2, 4, 'up'), 1);
});

test('nextActiveIndex returns -1 when there are no rows', () => {
  assert.equal(nextActiveIndex(-1, 0, 'down'), -1);
  assert.equal(nextActiveIndex(0, 0, 'up'), -1);
});

test('activeDescendantId is the active row id, or "" (ARIA none) when out of range', () => {
  const flat = flattenGroups(GROUPS);
  assert.equal(activeDescendantId(flat, 2), 'agh-search-opt-2');
  assert.equal(activeDescendantId(flat, -1), '', 'no highlight → no active descendant');
  assert.equal(activeDescendantId(flat, 99), '', 'out of range → no active descendant');
});

test('arrowDirection maps only the arrow keys', () => {
  assert.equal(arrowDirection('ArrowDown'), 'down');
  assert.equal(arrowDirection('ArrowUp'), 'up');
  assert.equal(arrowDirection('Enter'), null);
  assert.equal(arrowDirection('a'), null);
});

test('only Escape dismisses the panel', () => {
  assert.equal(isDismissKey('Escape'), true);
  assert.equal(isDismissKey('Enter'), false);
  assert.equal(isDismissKey('ArrowDown'), false);
});

test('Enter selects only when a row is highlighted within range', () => {
  assert.equal(isSelectKey('Enter', 2, 4), true);
  assert.equal(isSelectKey('Enter', -1, 4), false, 'Enter with no highlight is a no-op for the combobox');
  assert.equal(isSelectKey('Enter', 4, 4), false, 'an out-of-range index does not select');
  assert.equal(isSelectKey('ArrowDown', 2, 4), false);
});

// ---- standalone dismiss, matching the Menu by convention ----

test('outside-click dismisses only when open AND the click is outside the root', () => {
  assert.equal(shouldDismissOnOutsideClick(true, false), true, 'open + outside → dismiss');
  assert.equal(shouldDismissOnOutsideClick(true, true), false, 'a click on the input or a row must NOT dismiss');
  assert.equal(shouldDismissOnOutsideClick(false, false), false, 'a closed panel has nothing to dismiss');
});

// ---- excerpt term-marking ----

test('markMatches splits the excerpt around case-insensitive term occurrences', () => {
  const segs = markMatches('A design system token', 'design');
  assert.deepEqual(segs, [
    { text: 'A ', marked: false },
    { text: 'design', marked: true },
    { text: ' system token', marked: false },
  ]);
});

test('markMatches preserves original casing and marks every occurrence', () => {
  const segs = markMatches('Design and design', 'design');
  assert.deepEqual(segs.filter((s) => s.marked).map((s) => s.text), ['Design', 'design']);
});

test('markMatches with an empty term yields one unmarked segment', () => {
  assert.deepEqual(markMatches('whole excerpt', ''), [{ text: 'whole excerpt', marked: false }]);
  assert.deepEqual(markMatches('whole excerpt', '   '), [{ text: 'whole excerpt', marked: false }]);
});

// ---- source-guards: the standalone primitive, ARIA, tokens, the canvas ----

test('SearchField owns a STANDALONE floating panel — not composed on the Menu primitive', () => {
  assert.doesNotMatch(searchSrc, /from\s*["']\.\/menu\.js["']/, 'the combobox does NOT import Menu — it is standalone (refine 2026-06-16)');
  // It conditionally renders the panel it owns (the open/close reveal lives here).
  assert.match(searchSrc, /panelState\(/, 'the panel render delegates to the pure state machine');
});

test('the floating panel matches the Menu --shadow-md Popover elevation by convention', () => {
  assert.match(searchSrc, /boxShadow:\s*"var\(--shadow-md\)"/, 'same Popover elevation as ds-015, by convention not code');
  assert.match(searchSrc, /var\(--surface-1\)/, 'same surface as the Menu panel');
  assert.match(searchSrc, /var\(--hairline\)/, 'same hairline border as the Menu panel');
});

test('the combobox carries ARIA combobox/listbox semantics with active-descendant', () => {
  assert.match(searchSrc, /role="combobox"/, 'the input is a combobox');
  assert.match(searchSrc, /role="listbox"/, 'the panel is a listbox');
  assert.match(searchSrc, /role="option"/, 'rows are options');
  assert.match(searchSrc, /aria-activedescendant/, 'focus stays in the input; rows highlight via active-descendant');
});

test('the input is token-styled and standalone owns its dismissal', () => {
  assert.match(searchSrc, /placeholder/, 'the input has a placeholder');
  assert.match(searchSrc, /shouldDismissOnOutsideClick\(/, 'the panel owns its own outside-click dismissal');
  assert.match(searchSrc, /isDismissKey\(/, 'Esc dismissal delegates to the pure predicate');
  assert.match(searchSrc, /addEventListener\("mousedown"/, 'the standalone panel wires its own outside-click listener');
});

test('the styleguide canvas documents the search pattern in context', () => {
  assert.match(appSrc, /import\s*\{[^}]*SearchField[^}]*\}\s*from\s*["']\.\/search\.js["']/, 'app.js imports the pattern');
  assert.match(appSrc, /<\$\{SearchField\}/, 'the canvas renders the SearchField specimen in context');
});
