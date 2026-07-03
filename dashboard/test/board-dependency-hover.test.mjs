// Static guard for the board's hover-dependency ring wiring (agentic-workflow-k5p8w).
//
// The board's React glue has no DOM render harness in this project — the
// established idiom (aw-016/020/022/023/024/026/028/048/049) is: the pure
// resolution logic gets full node --test coverage (resolveHoverDependencies,
// board-dependencies.test.mjs), and the THIN React wiring around it is guarded
// by reading its source. This suite locks the acceptance criteria that are NOT
// pure logic:
//   - board-data.treeTicket carries dependsOn/blocks (already covered directly
//     in board-data.test.mjs; not re-asserted here);
//   - the board imports resolveHoverDependencies from the pure module and
//     threads its result down through BoardColumn to BoardCard to TicketCard's
//     dependencyRelation prop;
//   - only backlog/todo cards are a hover SOURCE (the same status gate as the
//     existing trash-can overlay — hovering doing/done never lifts hoveredId);
//   - moving the pointer off a card clears the hover (onMouseLeave -> null);
//   - EVERY card (not just backlog/todo hover sources) carries data-ticket-id
//     (widened by agentic-workflow-h9v3m: a doing/done card can be a resolved
//     dependency TARGET just as easily as a backlog/todo one, so its
//     IntersectionObserver wiring needs a DOM node to find on every status).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

// A brace-balanced function extractor (the naive `\n}` sentinel other suites in
// this project use breaks on a multi-line destructured parameter list, which
// BoardColumn already has and BoardCard/BoardColumn now share for the hover
// props this task adds) — walk braces from the function's opening `{` to its
// matching close.
function fn(name) {
  const start = boardSrc.search(new RegExp(`function ${name}\\b`));
  assert.ok(start >= 0, `${name} must exist in board.js`);
  // Walk the PARAMETER LIST first (paren-balanced — a destructured parameter's
  // own `{...}` must not be mistaken for the function body), then the body
  // (brace-balanced) starting at the first `{` after the params close.
  const parenOpen = boardSrc.indexOf('(', start);
  assert.ok(parenOpen >= 0, `${name} must have a parameter list`);
  let depth = 0;
  let parenClose = -1;
  for (let i = parenOpen; i < boardSrc.length; i++) {
    if (boardSrc[i] === '(') depth++;
    else if (boardSrc[i] === ')') {
      depth--;
      if (depth === 0) { parenClose = i; break; }
    }
  }
  assert.ok(parenClose >= 0, `${name}: unbalanced parameter list`);
  const bodyOpen = boardSrc.indexOf('{', parenClose);
  assert.ok(bodyOpen >= 0, `${name} must have a body`);
  depth = 0;
  for (let i = bodyOpen; i < boardSrc.length; i++) {
    if (boardSrc[i] === '{') depth++;
    else if (boardSrc[i] === '}') {
      depth--;
      if (depth === 0) return boardSrc.slice(start, i + 1);
    }
  }
  throw new Error(`${name}: unbalanced braces`);
}

test('the board imports resolveHoverDependencies from the pure board-dependencies module', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*resolveHoverDependencies[^}]*\}\s*from\s*"\.\/board-dependencies\.js"/,
    'resolveHoverDependencies must come from the pure board-dependencies module',
  );
});

test('DashboardBoard resolves hover dependencies against the full pooled cross-column ticket set', () => {
  const board = fn('DashboardBoard');
  assert.match(
    board,
    /resolveHoverDependencies\(\s*hoveredTicket\s*,\s*allTickets\s*\)/,
    'the resolver must be called with the hovered ticket and the FULL pooled ticket set (all columns, all BCs)',
  );
  assert.match(
    board,
    /COLUMN_ORDER\.flatMap/,
    'allTickets must flatten every lifecycle column, not just the hovered column',
  );
});

test('BoardCard threads a resolved dependencyRelation into the styleguide TicketCard', () => {
  const card = fn('BoardCard');
  assert.match(
    card,
    /dependencyRelation=\$\{dependencyRelation\}/,
    'BoardCard must pass its resolved dependencyRelation prop straight through to TicketCard',
  );
});

test('BoardColumn computes waiting-on (solid) before holding-up (dashed), matching resolver precedence', () => {
  const column = fn('BoardColumn');
  assert.match(
    column,
    /waitingOn\s*&&\s*waitingOn\.has\(t\.id\)\s*\?\s*"waiting-on"\s*:\s*\(?holdingUp\s*&&\s*holdingUp\.has\(t\.id\)\s*\?\s*"holding-up"/,
    'a card in both sets must resolve to waiting-on first, mirroring resolveHoverDependencies\' own precedence',
  );
});

test('only backlog/todo cards are a hover source — the same gate as the trash-can overlay', () => {
  const card = fn('BoardCard');
  // The hover lift (onMouseEnter/onMouseLeave -> onCardHover) and the trash-can
  // overlay live ONLY behind showTrash === (status === "backlog" || status ===
  // "todo"). doing/done cards return a bare data-ticket-id wrapper (agentic-
  // workflow-h9v3m: every card is a potential dependency TARGET, so it still
  // needs a DOM node the IntersectionObserver can find) with NO hover wiring.
  assert.match(
    card,
    /const showTrash = status === "backlog" \|\| status === "todo";/,
    'the hover-lift host div must reuse the existing backlog/todo-only gate',
  );
  assert.match(
    card,
    /if \(!showTrash\) return html`<div data-ticket-id=\$\{ticket\.id\}>\$\{card\}<\/div>`;/,
    'doing/done cards must return a bare data-ticket-id wrapper with no hover wiring (onCardHover, trash-can)',
  );
});

test('moving the pointer off a hovered card clears it (onMouseLeave lifts null)', () => {
  const card = fn('BoardCard');
  assert.match(
    card,
    /onMouseLeave=\$\{\(\)\s*=>\s*\{[^}]*onCardHover\(null\)[^}]*\}\}/,
    'onMouseLeave must call onCardHover(null) to clear every ring',
  );
  assert.match(
    card,
    /onMouseEnter=\$\{\(\)\s*=>\s*\{[^}]*onCardHover\(ticket\.id\)[^}]*\}\}/,
    'onMouseEnter must lift the hovered ticket id',
  );
});

test('every card — hover-source or not — carries data-ticket-id (agentic-workflow-h9v3m)', () => {
  const card = fn('BoardCard');
  // Both branches (the showTrash host div AND the bare doing/done wrapper) must
  // stamp data-ticket-id — every card is a potential IntersectionObserver target,
  // not just backlog/todo hover sources.
  const occurrences = card.match(/data-ticket-id=\$\{ticket\.id\}/g) || [];
  assert.equal(occurrences.length, 2, 'both the showTrash host div and the bare doing/done wrapper must stamp data-ticket-id');
});
