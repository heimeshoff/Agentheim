// Tests for the dashboard board's persisted view-state store — rewritten to the
// v2 BOARD-WIDE lens shape (agentic-workflow-c2ver, the ADR-0015 amendment landed
// by agentic-workflow-qf945). The store now carries TWO independent pieces:
//   - `lens` — ONE `{ grouped, sort }` choice for the WHOLE board (no longer
//     per-column): the single "View" chip drives all four columns identically.
//   - `columns` — the per-`(column, BC)` `collapsed[]` section state and the
//     Done column's `peek` boolean, UNCHANGED in granularity, just re-homed
//     under `columns` instead of alongside a per-column `grouped`/`sort`.
//
// `VIEW_STATE_VERSION` bumps to 2. A blob at any OTHER version — including the
// v1 per-column shape, absent, or malformed JSON — degrades to board-wide
// defaults (flat + default sort; every column's `collapsed: []`, `peek: false`),
// never a throw. No field-by-field migration of old per-column sort/grouped
// values is attempted (a deliberate hard reset, per the ADR).
//
// The store is pure over an INJECTED storage backend (no real localStorage
// needed here), so load/save/merge logic is unit-tested under `node --test`.
// The React wiring in board.js is integration glue around it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  VIEW_STATE_VERSION,
  defaultLensState,
  defaultColumnState,
  loadViewState,
  saveViewState,
  peekClampStyle,
  PEEK_MAX_HEIGHT_PX,
  PEEK_FADE_PX,
} from '../app/board-view-state.js';
import { DEFAULT_SORT } from '../app/board-sort.js';

// A minimal in-memory localStorage stub: just getItem/setItem over one key.
function memoryStorage(initial) {
  const store = new Map();
  if (initial != null) store.set('agentheim.board.viewState', initial);
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    _raw: () => store.get('agentheim.board.viewState'),
  };
}

test('VIEW_STATE_VERSION is 2 (the board-wide-lens shape)', () => {
  assert.equal(VIEW_STATE_VERSION, 2);
});

test('defaultLensState is flat + default sort — the board-wide default', () => {
  const l = defaultLensState();
  assert.equal(l.grouped, false);
  assert.equal(l.sort, DEFAULT_SORT);
});

test('defaultColumnState is all-expanded + NOT peeked — no grouped/sort on the leaner per-column shape', () => {
  const d = defaultColumnState();
  assert.deepEqual(d.collapsed, []);
  assert.equal(d.peek, false);
  assert.equal('grouped' in d, false);
  assert.equal('sort' in d, false);
});

test('loadViewState on an empty store returns board-wide defaults and no stored columns', () => {
  const storage = memoryStorage(null);
  const loaded = loadViewState(storage);
  assert.deepEqual(loaded.lens, defaultLensState());
  assert.deepEqual(loaded.columns, {});
});

test('a saved view-state round-trips through load', () => {
  const storage = memoryStorage(null);
  const state = {
    lens: { grouped: true, sort: 'title-asc' },
    columns: {
      done: { collapsed: ['infrastructure'], peek: true },
      todo: { collapsed: [], peek: false },
    },
  };
  saveViewState(storage, state);
  assert.deepEqual(loadViewState(storage), state);
});

test('the persisted blob is versioned and nests lens + columns at the top level', () => {
  const storage = memoryStorage(null);
  saveViewState(storage, { lens: defaultLensState(), columns: { done: defaultColumnState() } });
  const parsed = JSON.parse(storage._raw());
  assert.equal(parsed.version, VIEW_STATE_VERSION);
  assert.ok(parsed.lens, 'the board-wide lens is nested under the version envelope');
  assert.ok(parsed.columns, 'columns payload is nested under the version envelope');
});

test('a stored blob from a DIFFERENT version (including the old v1 per-column shape) degrades to board-wide defaults, never throws', () => {
  const staleV1 = JSON.stringify({
    version: 1,
    columns: { done: { grouped: true, sort: 'title-asc', collapsed: ['infrastructure'], peek: true } },
  });
  const storage = memoryStorage(staleV1);
  const loaded = loadViewState(storage);
  assert.deepEqual(loaded.lens, defaultLensState());
  assert.deepEqual(loaded.columns, {});
});

test('malformed JSON in the store degrades to board-wide defaults, never throws', () => {
  const storage = memoryStorage('{not json');
  const loaded = loadViewState(storage);
  assert.deepEqual(loaded.lens, defaultLensState());
  assert.deepEqual(loaded.columns, {});
});

test('a missing/undefined storage backend degrades to board-wide defaults, never throws', () => {
  assert.deepEqual(loadViewState(undefined).lens, defaultLensState());
  assert.deepEqual(loadViewState(undefined).columns, {});
  assert.deepEqual(loadViewState(null).lens, defaultLensState());
  // saving with no backend is a silent no-op, not a throw.
  assert.doesNotThrow(() => saveViewState(undefined, { lens: defaultLensState(), columns: { done: defaultColumnState() } }));
});

test('a stored lens with partial/garbage fields is normalized on load (never NaN, never throws)', () => {
  const blob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    lens: { grouped: 'yes', sort: 'bogus-sort' },
    columns: {},
  });
  const storage = memoryStorage(blob);
  const loaded = loadViewState(storage);
  assert.equal(loaded.lens.grouped, true);
  assert.equal(loaded.lens.sort, DEFAULT_SORT);
});

test('a stored column with partial/garbage fields is normalized on load (never NaN, never throws)', () => {
  const blob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    lens: defaultLensState(),
    columns: {
      done: { collapsed: 'not-an-array', peek: 'yes' },
      todo: {},
    },
  });
  const storage = memoryStorage(blob);
  const loaded = loadViewState(storage);
  assert.deepEqual(loaded.columns.done.collapsed, []);
  assert.equal(loaded.columns.done.peek, true);
  assert.deepEqual(loaded.columns.todo.collapsed, []);
  assert.equal(loaded.columns.todo.peek, false);
});

// ---- dormant retention (ADR-0015 amendment): grouping is now board-wide, but
// per-(column, BC) collapsed[] state must NOT be swept up in the lens — it
// stays column-scoped and survives the board-wide grouped flag flipping off
// then back on. ------------------------------------------------------------

test('toggling the board-wide lens does not touch a column collapsed[] — dormant retention', () => {
  const storage = memoryStorage(null);
  const withGrouping = {
    lens: { grouped: true, sort: DEFAULT_SORT },
    columns: { done: { collapsed: ['infrastructure'], peek: false } },
  };
  saveViewState(storage, withGrouping);

  // Flip the board-wide lens to flat, WITHOUT touching the column's collapsed[].
  const flat = { lens: { grouped: false, sort: DEFAULT_SORT }, columns: withGrouping.columns };
  saveViewState(storage, flat);
  assert.deepEqual(loadViewState(storage).columns.done.collapsed, ['infrastructure']);

  // Flip back to grouped — the dormant collapsed[] reappears intact.
  const regrouped = { lens: { grouped: true, sort: DEFAULT_SORT }, columns: withGrouping.columns };
  saveViewState(storage, regrouped);
  assert.deepEqual(loadViewState(storage).columns.done.collapsed, ['infrastructure']);
});

// ---- aw-m2v8d: the `peek` field (Done column collapse-to-clamped-fade) -------

test('a stored column with peek: true round-trips as peeked', () => {
  const storage = memoryStorage(null);
  saveViewState(storage, { lens: defaultLensState(), columns: { done: { ...defaultColumnState(), peek: true } } });
  assert.equal(loadViewState(storage).columns.done.peek, true);
});

test('peek is coerced to a boolean (garbage / partial values never throw)', () => {
  const blob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    lens: defaultLensState(),
    columns: {
      done: { peek: 'yes' },     // truthy non-boolean → true
      todo: { peek: 0 },         // falsy non-boolean → false
      doing: {},                 // absent → false
    },
  });
  const storage = memoryStorage(blob);
  const loaded = loadViewState(storage);
  assert.equal(loaded.columns.done.peek, true);
  assert.equal(loaded.columns.todo.peek, false);
  assert.equal(loaded.columns.doing.peek, false);
});

// ---- aw-m2v8d: peekClampStyle — the pure height-clamp + fade style fragment ---
// (Unchanged by this rewrite — the clamp is orthogonal to the lens becoming
// board-wide; still one style fragment derived purely from `peek`.)

test('peekClampStyle(true) clamps height with overflow hidden and a bottom mask fade', () => {
  const style = peekClampStyle(true);
  assert.equal(style.maxHeight, PEEK_MAX_HEIGHT_PX);
  assert.equal(style.overflow, 'hidden');
  assert.match(style.maskImage, /linear-gradient\(to bottom/);
  assert.match(style.maskImage, new RegExp(`${PEEK_FADE_PX}px`));
  assert.equal(style.WebkitMaskImage, style.maskImage);
});

test('peekClampStyle(false) is empty — the full list renders, no clamp, no fade', () => {
  assert.deepEqual(peekClampStyle(false), {});
});

test('peekClampStyle is defensive — a non-true peek yields the expanded (empty) style, never throws', () => {
  assert.deepEqual(peekClampStyle(undefined), {});
  assert.deepEqual(peekClampStyle(null), {});
  assert.deepEqual(peekClampStyle('yes'), {});
  assert.deepEqual(peekClampStyle(0), {});
});

test('the peek height target is a positive pixel value larger than the fade band', () => {
  assert.ok(PEEK_MAX_HEIGHT_PX > 0);
  assert.ok(PEEK_FADE_PX > 0);
  assert.ok(PEEK_MAX_HEIGHT_PX > PEEK_FADE_PX);
});
