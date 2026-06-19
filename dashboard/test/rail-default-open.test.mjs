// Static guard for the left-rail Workspace tree's per-group default open state
// (agentic-workflow-066).
//
// aw-056 ordered the rail groups Product -> Bounded contexts -> Research -> Decisions.
// aw-066 flips which of Research/Decisions starts OPEN: the builder reads research
// more than ADRs day-to-day, so Research opens by default and Decisions collapses.
//
// The rail render in board.js maps each group onto the styleguide's Collapsible
// primitive (consumed UNFORKED, ADR-0003) and passes a single defaultOpen expression.
// (aw-n4h7q replaced the TreeGroup convenience with a direct Collapsible + TreeItem
// composition so the cue's `attention` flag can be threaded; the defaultOpen seam is
// preserved.) Collapsible owns runtime open state after mount (the user can still
// toggle); this is the INITIAL/default state only (read-only dashboard, ADR-0017).
// The idiom here (aw-016/020/022/023/056) is a source-reading guard: the board has no
// DOM render harness, so we lock the defaultOpen expression and assert each group's default.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

// Pull the single Collapsible render in the rail's cuedGroups.map(...) block and
// capture the defaultOpen expression, then evaluate it per group name. The expression
// is a pure function of g.group, so we can exercise it directly.
function defaultOpenExpr() {
  const m = boardSrc.match(/cuedGroups\.map\(\(g\) =>[\s\S]*?defaultOpen=\$\{([^}]*)\}/);
  assert.ok(m, 'the rail render must map cuedGroups onto Collapsible with a defaultOpen expression');
  return m[1].trim();
}

function defaultOpenFor(group) {
  const expr = defaultOpenExpr();
  // eslint-disable-next-line no-new-func
  return Function('g', `return (${expr});`)({ group });
}

test('Decisions is the single collapsed group on fresh load', () => {
  assert.equal(defaultOpenFor('Decisions'), false, 'Decisions must be collapsed by default');
});

test('Research is expanded by default on fresh load', () => {
  assert.equal(defaultOpenFor('Research'), true, 'Research must be expanded by default');
});

test('Product and Bounded contexts stay expanded by default', () => {
  assert.equal(defaultOpenFor('Product'), true, 'Product must be expanded by default');
  assert.equal(defaultOpenFor('Bounded contexts'), true, 'Bounded contexts must be expanded by default');
});
