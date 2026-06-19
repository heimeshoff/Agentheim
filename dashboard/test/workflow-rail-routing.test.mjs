// Static guard for the Workflow rail item + main-pane routing scaffold
// (agentic-workflow-058, governed by ADR-0025).
//
// ADR-0025 adds a THIRD main-pane view state beside the two existing selections
// the shell already holds — `openIntent` (task → SlideOver) and `selectedDoc`
// (non-task doc → MainPaneReader). A built-in STATIC page (the Workflow guide,
// umbrella aw-057) is neither a task (no lifecycle `status`) nor a disk-fetched
// document (no `path`, no /api/doc fetch), so it gets its own shell state
// `mainView` ("board" | "workflow", default "board"), its own rail item BESIDE the
// Board item, and its own handler `onSelectWorkflow`.
//
// The mechanical risk ADR-0025 calls out: a MISSED `setMainView("board")` reset in
// an existing main-pane handler would let the workflow page linger under a later
// board/doc click. So every handler that lands something else in the main pane —
// onSelectBoard, onOpen (task + doc branches), onOpenSearch, onOpenFullScreen —
// must reset mainView to "board". This suite locks that, the precedence, and the
// rail-active predicates. isTaskIntent stays BYTE-UNCHANGED (ADR-0021).
//
// The board's React glue has no DOM render harness in this project — the established
// idiom (aw-026 / aw-027 / aw-039) is source-reading static guards. This suite
// follows it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');
const intentRouteSrc = readFileSync(path.join(dashboardDir, 'app', 'intent-route.js'), 'utf8');

function fn(name) {
  const m = boardSrc.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(m, `${name} must exist in board.js`);
  return m[0];
}

const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];

function handler(name) {
  const h = app.match(new RegExp(`const ${name} = useCallback\\([\\s\\S]*?\\}, \\[[^\\]]*\\]\\)`));
  assert.ok(h, `the shell must define a ${name} useCallback handler`);
  return h[0];
}

test('the shell owns a mainView state defaulting to "board" (the third main-pane state, ADR-0025)', () => {
  assert.match(app, /const \[mainView, setMainView\] = useState\(\s*["']board["']\s*\)/,
    'DashboardApp must hold mainView state defaulting to "board"');
});

test('onSelectWorkflow sets mainView="workflow" and clears BOTH selectedDoc and openIntent', () => {
  const h = handler('onSelectWorkflow');
  assert.match(h, /setMainView\(\s*["']workflow["']\s*\)/, 'onSelectWorkflow must set mainView to "workflow"');
  assert.match(h, /setSelectedDoc\(\s*null\s*\)/, 'onSelectWorkflow must clear selectedDoc');
  assert.match(h, /setOpenIntent\(\s*null\s*\)/, 'onSelectWorkflow must clear openIntent');
});

test('every existing main-pane handler resets mainView to "board" (the one mechanical obligation, ADR-0025)', () => {
  for (const name of ['onSelectBoard', 'onOpen', 'onOpenSearch', 'onOpenFullScreen']) {
    const h = handler(name);
    assert.match(h, /setMainView\(\s*["']board["']\s*\)/,
      `${name} must reset mainView to "board" so the workflow page never lingers`);
  }
});

test('onOpen resets mainView in BOTH branches (task → slide-over and doc → main pane)', () => {
  const h = handler('onOpen');
  // The reset must be unconditional (outside the isTaskIntent branches) OR present in
  // both branches. Easiest robust check: the reset count covers both paths — assert it
  // appears before the isTaskIntent split so it applies to both kinds.
  const splitAt = h.indexOf('isTaskIntent(');
  const resetBefore = h.slice(0, splitAt).match(/setMainView\(\s*["']board["']\s*\)/);
  assert.ok(resetBefore,
    'onOpen must reset mainView BEFORE the isTaskIntent split so both task and doc branches clear the workflow page');
});

test('the rail mounts a Workflow RailItem BELOW the Board item, active when mainView === "workflow"', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /<\$\{RailItem\}[\s\S]*?label="Workflow"/, 'the rail must have a Workflow RailItem');
  // Board first, Workflow directly below (the About item, aw-062, sits below Workflow).
  const items = rail.match(/<\$\{RailItem\}/g) || [];
  assert.ok(items.length >= 2, 'at least the Board and Workflow nav RailItems must render');
  const boardAt = rail.indexOf('label="Board"');
  const wfAt = rail.indexOf('label="Workflow"');
  assert.ok(boardAt > -1 && wfAt > -1, 'both Board and Workflow RailItems must render');
  assert.ok(boardAt < wfAt, 'the Workflow item must sit directly below the Board item');
  // Workflow active predicate is mainView === "workflow".
  const wf = rail.match(/<\$\{RailItem\}\s+icon=[^>]*?label="Workflow"[\s\S]*?\/>/);
  assert.ok(wf, 'the Workflow RailItem must be a self-closing element');
  assert.match(wf[0], /active=\$\{mainView === "workflow"\}/, 'Workflow active when mainView === "workflow"');
  assert.match(wf[0], /onClick=\$\{[^}]*onSelectWorkflow/, 'the Workflow item must call onSelectWorkflow on click');
});

test('the Board RailItem predicate excludes every non-board main-pane state (ADR-0025)', () => {
  const rail = fn('ShellRail');
  const board = rail.match(/<\$\{RailItem\}\s+icon=[^>]*?label="Board"[\s\S]*?\/>/);
  assert.ok(board, 'the Board RailItem must be a self-closing element');
  // aw-062 widened the predicate from `mainView !== "workflow" && !selectedId` to the
  // exclusive `mainView === "board" && !selectedId`, so adding further built-in views
  // (About, …) keeps Board un-highlighted without re-enumerating each one. Inside
  // ShellRail the selected document is the `selectedId` prop (fed from selectedDoc).
  assert.match(board[0], /active=\$\{mainView === "board" && !selectedId\}/,
    'the Board item is active only when the main pane shows the board itself and no doc is selected');
  // The library tree selection still follows selectedDoc alone (no widening). aw-n4h7q
  // replaced the TreeGroup convenience (which took `selectedId`) with a direct
  // Collapsible + TreeItem composition (so the attention cue can be threaded); each
  // TreeItem now derives its selected edge per-row from the same selectedId prop.
  assert.match(rail, /selected=\$\{selectedId === it\.id\}/, 'each rail row selects from the selected document alone');
});

test('the shell threads mainView + onSelectWorkflow into the ShellRail', () => {
  assert.match(app, /<\$\{ShellRail\}[\s\S]*?mainView=\$\{mainView\}/, 'ShellRail must receive mainView');
  assert.match(app, /<\$\{ShellRail\}[\s\S]*?onSelectWorkflow=\$\{onSelectWorkflow\}/, 'ShellRail must receive onSelectWorkflow');
  // ShellRail must accept the two new props.
  const rail = fn('ShellRail');
  assert.match(rail, /function ShellRail\(\{[^}]*\bmainView\b[^}]*\}\)/, 'ShellRail must accept mainView');
  assert.match(rail, /function ShellRail\(\{[^}]*\bonSelectWorkflow\b[^}]*\}\)/, 'ShellRail must accept onSelectWorkflow');
});

test('main-pane render precedence is workflow → document → board (mutually exclusive by construction)', () => {
  // The render must consult mainView === "workflow" first, then selectedDoc, then the board.
  const region = app.match(/mainView === "workflow"[\s\S]*?DashboardBoard/);
  assert.ok(region, 'the main pane must branch on mainView === "workflow" ahead of the board');
  const wfAt = app.indexOf('mainView === "workflow"');
  const docAt = app.indexOf('<${MainPaneReader}');
  const boardAt = app.indexOf('<${DashboardBoard}');
  assert.ok(wfAt > -1 && docAt > -1 && boardAt > -1, 'all three main-pane targets must render');
  assert.ok(wfAt < docAt && docAt < boardAt,
    'precedence must be workflow → document → board in the render tree');
});

test('the shell mounts a built-in WorkflowPage placeholder in the main pane', () => {
  assert.match(app, /<\$\{WorkflowPage\}/, 'the workflow view must render the built-in WorkflowPage');
  const page = fn('WorkflowPage');
  assert.match(page, /Workflow/, 'the placeholder page must carry a Workflow heading');
});

test('the static page is never routed as an open-intent: no status, no path, no /api/doc fetch (ADR-0025)', () => {
  const page = fn('WorkflowPage');
  assert.doesNotMatch(page, /\/api\/doc/, 'the built-in page must not fetch /api/doc (it is static, ADR-0017)');
  assert.doesNotMatch(page, /isTaskIntent/, 'the built-in page is not an open-intent');
  // onSelectWorkflow is a dedicated handler, NOT routed through onOpen / isTaskIntent.
  const h = handler('onSelectWorkflow');
  assert.doesNotMatch(h, /isTaskIntent/, 'onSelectWorkflow must not consult isTaskIntent — the page is not an intent');
  assert.doesNotMatch(h, /\/api\/doc/, 'onSelectWorkflow performs no doc fetch');
});

test('the scaffold is read-only: no write verb introduced over .agentheim (ADR-0017)', () => {
  for (const name of ['onSelectWorkflow', 'WorkflowPage']) {
    const src = name === 'WorkflowPage' ? fn(name) : handler(name);
    assert.doesNotMatch(src, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/i,
      `${name} must perform no write`);
  }
});

test('isTaskIntent (ADR-0021 discriminator) is BYTE-UNCHANGED — the static page never enters it', () => {
  // The exact source of the discriminator function body, locked verbatim.
  assert.match(intentRouteSrc,
    /export function isTaskIntent\(intent\) \{\n  return Boolean\(intent && intent\.status\);\n\}/,
    'isTaskIntent must remain byte-identical (ADR-0021 / ADR-0025 decision 2)');
});
