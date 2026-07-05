// Static guard for the board-wide "View" chip (agentic-workflow-c2ver).
//
// Replaces the four columns' independent ColumnSortControl + ColumnGroupToggle
// with ONE board-wide ViewChip, composed on the shared Menu primitive (ds-015)
// unforked, driving sort + group identically for every column. Also adds a
// "COLUMNS" uppercase section label above the board.
//
// The pure store rewrite is covered by board-view-state.test.mjs. board.js has
// no DOM render harness; the established idiom (ds-009, aw-027, aw-074,
// aw-m2v8d's board-done-collapse.test.mjs) is source-reading static guards.
// This suite locks the board-wide wiring criteria.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function viewChip() {
  const m = boardSrc.match(/function ViewChip\([\s\S]*?\n}/);
  assert.ok(m, 'board.js must define a ViewChip component');
  return m[0];
}

test('AC1: the four columns no longer carry independent sort/group controls', () => {
  assert.doesNotMatch(boardSrc, /function ColumnSortControl/,
    'the per-column ColumnSortControl must be removed');
  assert.doesNotMatch(boardSrc, /function ColumnGroupToggle/,
    'the per-column ColumnGroupToggle must be removed');
  assert.doesNotMatch(boardSrc, /function ColumnControls/,
    'the per-column ColumnControls strip must be removed');
});

test('AC1: a single board-wide ViewChip is composed on the shared Menu primitive, unforked', () => {
  const chip = viewChip();
  assert.match(chip, /<\$\{Menu\}/, 'ViewChip must compose the shared styleguide Menu primitive');
  // Only ONE ViewChip definition/usage in the whole board — not per column.
  const defs = boardSrc.match(/function ViewChip\(/g) || [];
  assert.equal(defs.length, 1, 'there must be exactly one ViewChip component');
  const uses = boardSrc.match(/<\$\{ViewChip\}/g) || [];
  assert.equal(uses.length, 1, 'ViewChip must be rendered exactly once (board-wide, not per column)');
});

test('AC1: the ViewChip drives sort + group off the board-wide lens, not a per-column value', () => {
  assert.match(boardSrc, /<\$\{ViewChip\}[\s\S]*?sort=\$\{view\.lens\.sort\}/,
    'ViewChip must be wired to the board-wide view.lens.sort');
  assert.match(boardSrc, /<\$\{ViewChip\}[\s\S]*?grouped=\$\{view\.lens\.grouped\}/,
    'ViewChip must be wired to the board-wide view.lens.grouped');
});

test('AC2: the persisted store is loaded/saved through the v2 board-wide-lens shape', () => {
  assert.match(boardSrc, /const stored = loadViewState\(storage\)/,
    'board.js must load the persisted view-state through loadViewState');
  assert.match(boardSrc, /stored\.lens/, 'the initial view state must seed from the stored board-wide lens');
  assert.match(boardSrc, /saveViewState\(storage, view\)/,
    'board.js must persist the current view (lens + columns) through saveViewState');
});

test('AC3: per-column collapsed[] state lives under view.columns, independent of the board-wide lens', () => {
  assert.match(boardSrc, /view\.columns\[status\]\.collapsed/,
    'per-(column, BC) collapsed state must be read from view.columns[status].collapsed');
  assert.doesNotMatch(boardSrc, /view\[status\]\.collapsed/,
    'collapsed state must no longer live directly on view[status] (that shape is retired)');
});

test('AC4: the Done column peek/collapse wiring is unchanged — still per-column, still setColumnPeek', () => {
  assert.match(boardSrc, /const setColumnPeek = useCallback\(\(status, peek\)/,
    'setColumnPeek must still exist, unaffected by the lens becoming board-wide');
  assert.match(boardSrc, /status === "done"\s*\?\s*\(p\)\s*=>\s*setColumnPeek\(status, p\)\s*:\s*undefined/,
    'only the Done column is wired to onToggleCollapse, exactly as before');
  assert.match(boardSrc, /view\.columns\[status\]\.peek/,
    'peek must be read from view.columns[status].peek (re-homed under columns, same granularity)');
});

test('AC5: pipeline stays project -> sort (board-wide) -> group (board-wide) -> per-column collapse/peek applied locally', () => {
  assert.match(boardSrc, /sortTickets\(columns\[status\], view\.lens\.sort\)/,
    'sort must be applied board-wide, off view.lens.sort, before BoardColumn renders');
  assert.match(boardSrc, /grouped=\$\{view\.lens\.grouped\}/,
    'BoardColumn must receive the board-wide grouped flag identically for every column');
});

test('AC6: a "COLUMNS" uppercase section label renders above the board', () => {
  assert.match(boardSrc, />Columns<\/span>/,
    'a Columns label must render as its own element above the board');
  assert.match(boardSrc, /textTransform: "uppercase"/,
    'the Columns label must render uppercase via the textTransform token idiom (matching other section labels in this file)');
});
