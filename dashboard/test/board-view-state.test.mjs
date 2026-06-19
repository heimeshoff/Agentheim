// Tests for the dashboard board's persisted view-state store
// (agentic-workflow-014). This is the single versioned localStorage store that
// survives a reload: each column's grouped/flat choice, its sort choice, and its
// per-(column, BC) collapse state. It REVERSES ADR-0009's "no localStorage" clause
// (and supersedes aw-012's in-session-only sort) — but it is VIEW-STATE ONLY: it
// never carries lifecycle truth, which stays a projection of disk.
//
// The store is pure over an INJECTED storage backend (no real localStorage needed
// here), so load/save/merge logic is unit-tested under `node --test` with a tiny
// in-memory stub. The React wiring in board.js is integration glue around it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  VIEW_STATE_VERSION,
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

test('defaultColumnState is flat + default sort + all-expanded + NOT peeked', () => {
  const d = defaultColumnState();
  assert.equal(d.grouped, false);
  assert.equal(d.sort, DEFAULT_SORT);
  assert.deepEqual(d.collapsed, []);
  // aw-m2v8d: the collapse/peek affordance defaults OFF — a column with no stored
  // preference renders the FULL list. "Expanded by default" is the AC: no stored
  // state resolves to expanded.
  assert.equal(d.peek, false);
});

test('loadViewState on an empty store returns an empty object (every column defaults)', () => {
  const storage = memoryStorage(null);
  assert.deepEqual(loadViewState(storage), {});
});

test('a saved view-state round-trips through load', () => {
  const storage = memoryStorage(null);
  const state = {
    done: { grouped: true, sort: 'title-asc', collapsed: ['infrastructure'], peek: true },
    todo: { grouped: false, sort: DEFAULT_SORT, collapsed: [], peek: false },
  };
  saveViewState(storage, state);
  assert.deepEqual(loadViewState(storage), state);
});

test('the persisted blob is versioned', () => {
  const storage = memoryStorage(null);
  saveViewState(storage, { done: defaultColumnState() });
  const parsed = JSON.parse(storage._raw());
  assert.equal(parsed.version, VIEW_STATE_VERSION);
  assert.ok(parsed.columns, 'columns payload is nested under the version envelope');
});

test('a stored blob from a DIFFERENT version is ignored (returns empty), never throws', () => {
  const stale = JSON.stringify({ version: VIEW_STATE_VERSION + 999, columns: { done: { grouped: true } } });
  const storage = memoryStorage(stale);
  assert.deepEqual(loadViewState(storage), {});
});

test('malformed JSON in the store degrades to empty, never throws', () => {
  const storage = memoryStorage('{not json');
  assert.deepEqual(loadViewState(storage), {});
});

test('a missing/undefined storage backend degrades to empty, never throws', () => {
  assert.deepEqual(loadViewState(undefined), {});
  assert.deepEqual(loadViewState(null), {});
  // saving with no backend is a silent no-op, not a throw.
  assert.doesNotThrow(() => saveViewState(undefined, { done: defaultColumnState() }));
});

test('a stored column with partial/garbage fields is normalized on load (never NaN, never throws)', () => {
  const blob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    columns: {
      done: { grouped: 'yes', sort: 'bogus-sort', collapsed: 'not-an-array' },
      todo: {},
    },
  });
  const storage = memoryStorage(blob);
  const loaded = loadViewState(storage);
  // grouped coerced to boolean; unknown sort falls back to default; collapsed
  // forced to an array.
  assert.equal(loaded.done.grouped, true);
  assert.equal(loaded.done.sort, DEFAULT_SORT);
  assert.deepEqual(loaded.done.collapsed, []);
  assert.equal(loaded.todo.grouped, false);
  assert.equal(loaded.todo.sort, DEFAULT_SORT);
});

// ---- aw-m2v8d: the `peek` field (Done column collapse-to-clamped-fade) -------

test('a stored column with peek: true round-trips as peeked', () => {
  const storage = memoryStorage(null);
  saveViewState(storage, { done: { ...defaultColumnState(), peek: true } });
  assert.equal(loadViewState(storage).done.peek, true);
});

test('peek is coerced to a boolean (garbage / partial values never throw)', () => {
  const blob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    columns: {
      done: { peek: 'yes' },     // truthy non-boolean → true
      todo: { peek: 0 },         // falsy non-boolean → false
      doing: {},                 // absent → false
    },
  });
  const storage = memoryStorage(blob);
  const loaded = loadViewState(storage);
  assert.equal(loaded.done.peek, true);
  assert.equal(loaded.todo.peek, false);
  assert.equal(loaded.doing.peek, false);
});

test('an OLD stored blob that predates `peek` loads as peek: false (back-compat, no version bump)', () => {
  // A blob written before aw-m2v8d carries grouped/sort/collapsed but NO peek
  // field. It must still load (same VIEW_STATE_VERSION — additive field, no bump)
  // and every column must resolve to peek: false (expanded — the full list).
  const oldBlob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    columns: {
      done: { grouped: true, sort: 'title-asc', collapsed: ['infrastructure'] },
      todo: { grouped: false, sort: DEFAULT_SORT, collapsed: [] },
    },
  });
  const storage = memoryStorage(oldBlob);
  const loaded = loadViewState(storage);
  // The pre-existing fields survive untouched...
  assert.equal(loaded.done.grouped, true);
  assert.equal(loaded.done.sort, 'title-asc');
  assert.deepEqual(loaded.done.collapsed, ['infrastructure']);
  // ...and the missing peek field back-fills to false (expanded).
  assert.equal(loaded.done.peek, false);
  assert.equal(loaded.todo.peek, false);
});

test('an OLD blob carrying aw-072 `hidden: true` migrates to shown + expanded (no blank board, no version bump)', () => {
  // aw-m2v8d REPLACES aw-072's hide control. A blob that still carries the retired
  // `hidden: true` flag must NOT blank or break the board: `hidden` is no longer
  // read, the column loads with peek: false (expanded), and the retired field is
  // simply dropped on the next save.
  const oldBlob = JSON.stringify({
    version: VIEW_STATE_VERSION,
    columns: {
      done: { grouped: false, sort: DEFAULT_SORT, collapsed: [], hidden: true },
    },
  });
  const storage = memoryStorage(oldBlob);
  const loaded = loadViewState(storage);
  // Degrades to shown + expanded.
  assert.equal(loaded.done.peek, false);
  // The retired `hidden` field is not carried forward.
  assert.equal('hidden' in loaded.done, false);
  // Re-saving drops `hidden` entirely from the persisted blob.
  saveViewState(storage, loaded);
  const reparsed = JSON.parse(storage._raw());
  assert.equal('hidden' in reparsed.columns.done, false);
});

// ---- aw-m2v8d: peekClampStyle — the pure height-clamp + fade style fragment ---

test('peekClampStyle(true) clamps height with overflow hidden and a bottom mask fade', () => {
  const style = peekClampStyle(true);
  assert.equal(style.maxHeight, PEEK_MAX_HEIGHT_PX);
  assert.equal(style.overflow, 'hidden');
  // A bottom-edge fade via mask-image (+ webkit), running over the fade band.
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
  // The clamp is a visual ≈3.5-card height target; the fade band must fit inside it.
  assert.ok(PEEK_MAX_HEIGHT_PX > 0);
  assert.ok(PEEK_FADE_PX > 0);
  assert.ok(PEEK_MAX_HEIGHT_PX > PEEK_FADE_PX);
});
