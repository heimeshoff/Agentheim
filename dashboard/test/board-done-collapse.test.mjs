// Static guard for the Done-column COLLAPSE / PEEK wiring in board.js
// (agentic-workflow-m2v8d).
//
// aw-m2v8d REPLACES aw-072's Done-column hide control with an in-place collapse: a
// double-chevron button (top-right of the Done column control strip) toggles the
// column's persisted `peek` boolean, which the pure peekClampStyle height-clamps to a
// short, bottom-faded ≈3.5-card window. The hide machinery (the `x` button, the
// `hidden` flag, the visibleColumns drop-from-layout filter, the "Show Done (N)" chip)
// is taken OUT — replacement, not coexistence.
//
// The pure store + clamp logic is unit-tested in board-view-state.test.mjs. The React
// glue in board.js has no DOM render harness; the established idiom (ds-009, aw-027,
// aw-074) is source-reading static guards. This suite locks the board.js criteria.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

// The ColumnCollapseButton component body, isolated so prop/glyph assertions are scoped.
function collapseButton() {
  const m = boardSrc.match(/function ColumnCollapseButton\([\s\S]*?\n}/);
  assert.ok(m, 'board.js must define a ColumnCollapseButton component');
  return m[0];
}

test('AC1: the collapse button is the Done-only control wired via an optional onToggleCollapse prop', () => {
  // The control strip renders the button ONLY when onToggleCollapse is supplied (the
  // aw-018 default-OFF precedent), and only Done is ever wired to it.
  assert.match(boardSrc, /typeof onToggleCollapse === "function"/,
    'ColumnControls must render the collapse button only when onToggleCollapse is supplied');
  assert.match(boardSrc, /status === "done"\s*\?\s*\(p\)\s*=>\s*setColumnPeek\(status, p\)\s*:\s*undefined/,
    'only the Done column is wired to onToggleCollapse (backlog/todo/doing carry no collapse control)');
});

test('AC1+AC5: the chevron is a GLYPH-NAME SWAP — chevrons-up (expanded) ⇄ chevrons-down (collapsed), not a CSS rotate', () => {
  const btn = collapseButton();
  // Both ds-c3p9k glyphs are consumed by name, selected on `peek`.
  assert.match(btn, /name=\$\{peek \? "chevrons-down" : "chevrons-up"\}/,
    'the chevron must swap chevrons-up (expanded) ⇄ chevrons-down (collapsed) by Icon name');
  // NOT a board-local CSS rotate transform on a single glyph (ADR-0003 / refine 2026-06-19).
  assert.doesNotMatch(btn, /rotate/i,
    'the chevron flip must be a glyph-name swap, never a board-local CSS rotate transform');
});

test('AC5: clicking the button toggles peek (passes the flipped boolean to onToggleCollapse)', () => {
  const btn = collapseButton();
  assert.match(btn, /onClick=\$\{\(\)\s*=>\s*onToggleCollapse\(!peek\)\}/,
    'clicking the collapse button must toggle peek by passing !peek');
});

test('AC2/AC3: the column body is height-clamped via the pure peekClampStyle — one clamp on the whole body, orthogonal to grouping', () => {
  // The clamp is applied to ONE body wrapper (spread peekClampStyle), wrapping BOTH the
  // grouped sections and the flat list — never per-section.
  assert.match(boardSrc, /import \{[^}]*peekClampStyle[^}]*\} from "\.\/board-view-state\.js"/,
    'board.js must consume the pure peekClampStyle from the view-state store');
  assert.match(boardSrc, /const bodyClamp = peekClampStyle\(peek === true\)/,
    'BoardColumn must derive the body clamp from peekClampStyle(peek)');
  assert.match(boardSrc, /paddingBottom: 8,\s*\.\.\.bodyClamp/,
    'the clamp must spread onto the single column-body wrapper (orthogonal to grouping)');
});

test('AC4: expanded is the default — peek defaults to false in BoardColumn', () => {
  assert.match(boardSrc, /peek = false, onToggleCollapse/,
    'BoardColumn must default peek to false (expanded is the default)');
});

test('AC6/AC7: collapse is presentation-only — it flips persisted view-state peek, no /api write', () => {
  // setColumnPeek lifts the choice into the same persisted per-column view-state the
  // sort/group toggles use; it never posts to /api.
  assert.match(boardSrc, /const setColumnPeek = useCallback\(\(status, peek\)/,
    'board.js must define setColumnPeek to flip persisted view-state peek');
  assert.match(boardSrc, /prev\[status\]\.peek === peek/,
    'setColumnPeek must update the per-column persisted peek boolean');
});

test('AC9: the aw-072 hide machinery is REMOVED — no ShowColumnChip, ColumnHideButton, visibleColumns, hidden flag, or onHide', () => {
  assert.doesNotMatch(boardSrc, /ShowColumnChip/, 'the "Show Done (N)" chip must be removed');
  assert.doesNotMatch(boardSrc, /ColumnHideButton/, 'the x hide button must be removed');
  assert.doesNotMatch(boardSrc, /visibleColumns/, 'the drop-from-layout visibleColumns filter must be removed');
  assert.doesNotMatch(boardSrc, /setColumnHidden/, 'the setColumnHidden callback must be removed');
  assert.doesNotMatch(boardSrc, /onHide/, 'the Done-only onHide wiring must be removed');
});

test('AC8: the collapse button is board-local + token-matched — no styleguide fork beyond the ds-c3p9k glyphs', () => {
  const btn = collapseButton();
  // Token-styled board-local control (the sort <select> / group-toggle precedent).
  assert.match(btn, /var\(--surface-/, 'the collapse button must be token-styled (surface tokens)');
  assert.match(btn, /var\(--hairline/, 'the collapse button must be token-styled (hairline border)');
  // It composes the unforked Icon primitive — it does not declare its own glyph geometry.
  assert.match(btn, /<\$\{Icon\} name=/, 'the chevron must be the unforked styleguide Icon primitive (ADR-0003)');
});
