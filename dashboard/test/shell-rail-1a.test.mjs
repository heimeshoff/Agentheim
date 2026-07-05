// Static guards for the left-nav 1a single-panel shape (agentic-workflow-wsfsk).
//
// The builder picked 1a (a single 236px panel: app-nav → "WORKSPACE" tree → a
// footer status line) over 1b's split icon-rail + tree. ShellRail was already
// single-panel with the same content (aw-058/aw-059); this closes the
// remaining shape gaps: the 236px width, the footer status line (fed by the
// pure, already-unit-tested library-data.footerStatusLine), and the active
// nav item's ochre inset rail — a bounded ADR-0048 wayfinding exception to
// ADR-0016's "selection by de-emphasis" default.
//
// The board's React glue has no DOM render harness in this project (see
// shell-relayout.test.mjs) — the established idiom is source-reading static
// guards plus pure-module unit tests (footerStatusLine's own behavior is
// covered by library-data.test.mjs; this file locks how ShellRail wires it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function fn(name) {
  const m = boardSrc.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(m, `${name} must exist in board.js`);
  return m[0];
}

test('ShellRail renders at the 1a width, 236px', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /width:\s*236\b/, 'the rail must be 236px wide (1a single-panel shape)');
  assert.doesNotMatch(rail, /width:\s*248\b/, 'the retired 248px width must be gone');
});

test('the tree section header renders as WORKSPACE (uppercase transform over "Workspace")', () => {
  const rail = fn('ShellRail');
  assert.match(rail, />Workspace</, 'the tree header text node is present');
  assert.match(rail, /textTransform:\s*"uppercase"/, 'the header is uppercased to read WORKSPACE, per 1a');
});

test('ShellRail renders a footer status line below the tree, fed by the pure footerStatusLine helper', () => {
  const rail = fn('ShellRail');
  assert.match(boardSrc, /import\s*\{[^}]*\bfooterStatusLine\b[^}]*\}\s*from\s*"\.\/library-data\.js"/,
    'ShellRail must source its footer line from the pure, unit-tested footerStatusLine helper');
  assert.match(rail, /footerStatusLine\(/, 'ShellRail must call footerStatusLine to compute the footer text');
  // The footer must RENDER (in the returned markup) AFTER (below) the scrollable
  // tree region, not inside it — the computed variable may be declared earlier,
  // but its interpolation into markup must be the last thing in the nav.
  const scrollAt = rail.indexOf('className="scroll-quiet"');
  const footerRenderAt = rail.indexOf('}>${footerStatus}</div>');
  assert.ok(scrollAt > -1 && footerRenderAt > -1, 'both the tree scroll region and the rendered footer must be present');
  assert.ok(footerRenderAt > scrollAt, 'the footer status line must render below (after) the tree region');
});

test('the active nav item renders the ADR-0048 ochre inset rail, drawn from the accent token', () => {
  const rail = fn('ShellRail');
  // ShellRail must actually apply the wrapper that carries the inset rail to
  // each of its three nav items.
  assert.match(rail, /<\$\{RailNavSlot\}[\s\S]*?<\$\{RailItem\}[\s\S]*?label="Board"/, 'the Board RailItem must be wrapped in the active-aware RailNavSlot');
  assert.match(rail, /<\$\{RailNavSlot\}[\s\S]*?<\$\{RailItem\}[\s\S]*?label="Workflow"/, 'the Workflow RailItem must be wrapped in the active-aware RailNavSlot');
  assert.match(rail, /<\$\{RailNavSlot\}[\s\S]*?<\$\{RailItem\}[\s\S]*?label="About"/, 'the About RailItem must be wrapped in the active-aware RailNavSlot');

  const slot = fn('RailNavSlot');
  assert.match(slot, /ADR-0048/, 'a code comment must cite ADR-0048 (the bounded wayfinding exception)');
  assert.match(slot, /inset 2px 0 0 var\(--accent-ochre\)/, 'the active item must use the token-driven inset rail, no hardcoded hex');
  assert.doesNotMatch(slot, /inset 2px 0 0 #[0-9a-fA-F]{3,8}/, 'the ochre inset rail must never hardcode a hex color');
});

test('right-aligned mono counts on tree groups are unchanged (Collapsible regression)', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /<\$\{Collapsible\}[\s\S]*?count=\$\{g\.items\.length\}/,
    'each tree group Collapsible must still be handed count=${g.items.length} (unchanged from aw-n4h7q)');
});
