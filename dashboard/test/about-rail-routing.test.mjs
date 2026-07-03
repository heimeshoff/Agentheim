// Static guard for the About rail item + main-pane routing extension
// (agentic-workflow-062, governed by ADR-0025).
//
// ADR-0025 anticipated a SECOND built-in static page (a future "About") as "a
// one-line `mainView` enum extension, not another shell-state invention." aw-058
// landed the third main-pane view state (mainView: "board" | "workflow"); aw-062
// extends the enum to "about", adds an About RailItem directly BELOW Workflow,
// and adds its own onSelectAbout handler — mirroring the Workflow scaffold.
//
// The same mechanical obligation ADR-0025 calls out holds: every handler that
// lands something else in the main pane (onSelectBoard, onOpen task + doc
// branches, onSelectWorkflow, onOpenSearch, onOpenFullScreen) must move the view
// AWAY from "about" so the About page never lingers under a later click. The
// About page is NOT an open-intent (no status, no path, no /api/doc fetch), so it
// never enters isTaskIntent (ADR-0021, BYTE-UNCHANGED).
//
// The board's React glue has no DOM render harness in this project — the
// established idiom (aw-026 / aw-027 / aw-039 / aw-058) is source-reading static
// guards. This suite follows it and keeps the aw-058 workflow guards green.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');
const intentRouteSrc = readFileSync(path.join(dashboardDir, 'app', 'intent-route.js'), 'utf8');
const mainPaneReaderSrc = readFileSync(path.join(dashboardDir, 'app', 'main-pane-reader.js'), 'utf8');

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

test('onSelectAbout sets mainView="about" and clears BOTH selectedDoc and openIntent', () => {
  const h = handler('onSelectAbout');
  assert.match(h, /setMainView\(\s*["']about["']\s*\)/, 'onSelectAbout must set mainView to "about"');
  assert.match(h, /setSelectedDoc\(\s*null\s*\)/, 'onSelectAbout must clear selectedDoc');
  assert.match(h, /setOpenIntent\(\s*null\s*\)/, 'onSelectAbout must clear openIntent');
});

test('onSelectAbout is its own handler — never routed through onOpen / isTaskIntent / /api/doc', () => {
  const h = handler('onSelectAbout');
  assert.doesNotMatch(h, /isTaskIntent/, 'onSelectAbout must not consult isTaskIntent — the page is not an intent');
  assert.doesNotMatch(h, /\/api\/doc/, 'onSelectAbout performs no doc fetch');
});

test('every other main-pane handler moves the view away from "about" (no lingering About page, ADR-0025)', () => {
  // onSelectBoard, onOpen, onOpenSearch, onOpenFullScreen all reset to "board";
  // onSelectWorkflow sets "workflow". None leaves mainView on "about".
  for (const name of ['onSelectBoard', 'onOpen', 'onOpenSearch', 'onOpenFullScreen']) {
    const h = handler(name);
    assert.match(h, /setMainView\(\s*["']board["']\s*\)/,
      `${name} must reset mainView to "board" so the About page never lingers`);
  }
  const wf = handler('onSelectWorkflow');
  assert.match(wf, /setMainView\(\s*["']workflow["']\s*\)/,
    'onSelectWorkflow sets mainView to "workflow", leaving any About page');
});

test('the rail mounts an About RailItem directly BELOW the Workflow item, active when mainView === "about"', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /<\$\{RailItem\}[\s\S]*?label="About"/, 'the rail must have an About RailItem');
  // Three nav RailItems now: Board, Workflow, About — in that order.
  const items = rail.match(/<\$\{RailItem\}/g) || [];
  assert.equal(items.length, 3, 'exactly three nav RailItems: Board, Workflow and About');
  const boardAt = rail.indexOf('label="Board"');
  const wfAt = rail.indexOf('label="Workflow"');
  const aboutAt = rail.indexOf('label="About"');
  assert.ok(boardAt > -1 && wfAt > -1 && aboutAt > -1, 'all three RailItems must render');
  assert.ok(boardAt < wfAt && wfAt < aboutAt, 'the About item must sit directly below the Workflow item');
  const about = rail.match(/<\$\{RailItem\}\s+icon=[^>]*?label="About"[\s\S]*?\/>/);
  assert.ok(about, 'the About RailItem must be a self-closing element');
  assert.match(about[0], /active=\$\{mainView === "about"\}/, 'About active when mainView === "about"');
  assert.match(about[0], /onClick=\$\{[^}]*onSelectAbout/, 'the About item must call onSelectAbout on click');
});

test('the Board RailItem predicate excludes the About view too — at most one rail row highlights', () => {
  const rail = fn('ShellRail');
  const board = rail.match(/<\$\{RailItem\}\s+icon=[^>]*?label="Board"[\s\S]*?\/>/);
  assert.ok(board, 'the Board RailItem must be a self-closing element');
  // Cleanest exclusive predicate: Board active iff mainView === "board" && !selectedId.
  assert.match(board[0], /active=\$\{mainView === "board" && !selectedId\}/,
    'the Board item is active only when mainView is "board" and no doc is selected (excludes workflow AND about)');
  // The Workflow predicate stays mainView === "workflow" (untouched, exclusive).
  const wf = rail.match(/<\$\{RailItem\}\s+icon=[^>]*?label="Workflow"[\s\S]*?\/>/);
  assert.ok(wf, 'the Workflow RailItem must remain self-closing');
  assert.match(wf[0], /active=\$\{mainView === "workflow"\}/, 'Workflow active when mainView === "workflow"');
});

test('the shell threads mainView + onSelectAbout into the ShellRail', () => {
  assert.match(app, /<\$\{ShellRail\}[\s\S]*?onSelectAbout=\$\{onSelectAbout\}/, 'ShellRail must receive onSelectAbout');
  const rail = fn('ShellRail');
  assert.match(rail, /function ShellRail\(\{[^}]*\bonSelectAbout\b[^}]*\}\)/, 'ShellRail must accept onSelectAbout');
});

test('main-pane render precedence is workflow → about → document → board', () => {
  const wfAt = app.indexOf('mainView === "workflow"');
  const aboutAt = app.indexOf('mainView === "about"');
  const docAt = app.indexOf('<${MainPaneReader}');
  const boardAt = app.indexOf('<${DashboardBoard}');
  assert.ok(wfAt > -1 && aboutAt > -1 && docAt > -1 && boardAt > -1, 'all four main-pane targets must render');
  assert.ok(wfAt < aboutAt && aboutAt < docAt && docAt < boardAt,
    'precedence must be workflow → about → document → board in the render tree');
});

test('the shell mounts a built-in AboutPage in the main pane', () => {
  assert.match(app, /<\$\{AboutPage\}/, 'the about view must render the built-in AboutPage');
  const page = fn('AboutPage');
  assert.match(page, /Marco Heimeshoff/, 'the About page must carry the builder bio');
});

test('the About page is static: no /api/doc fetch, no isTaskIntent, no write verb (ADR-0017 / ADR-0025)', () => {
  const page = fn('AboutPage');
  assert.doesNotMatch(page, /\/api\/doc/, 'the About page must not fetch /api/doc (it is static)');
  assert.doesNotMatch(page, /isTaskIntent/, 'the About page is not an open-intent');
  assert.doesNotMatch(page, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/i, 'the About page must perform no write');
});

test('the About page profile photo is referenced by a served URL, not a filesystem path', () => {
  const page = fn('AboutPage');
  assert.match(page, /src="\/heimeshoff\.jpg"/, 'the profile photo must load from the served /heimeshoff.jpg URL');
});

test('the Ko-fi and GitHub links point at the right Agentheim targets and open safely in a new tab', () => {
  const page = fn('AboutPage');
  const kofi = fn('KofiButton');
  // The Ko-fi button (board-local gradient) links to ko-fi.com/heimeshoff.
  assert.match(kofi, /https:\/\/ko-fi\.com\/heimeshoff/, 'the Ko-fi button links to ko-fi.com/heimeshoff');
  // The GitHub link is rendered via AboutLink in the AboutPage support card.
  assert.match(page, /https:\/\/github\.com\/heimeshoff\/Agentheim/, 'the GitHub link points at the Agentheim repo (not WhisperHeim)');
  assert.doesNotMatch(page, /github\.com\/heimeshoff\/WhisperHeim/, 'must not link WhisperHeim');
  // Every external anchor opens in a new tab with a safe rel — locked in the two
  // anchor-bearing components (the shared AboutLink primitive + the Ko-fi button).
  const link = fn('AboutLink');
  for (const [name, src] of [['AboutLink', link], ['KofiButton', kofi]]) {
    const anchors = src.match(/<a\b[\s\S]*?>/g) || [];
    assert.ok(anchors.length >= 1, `${name} must render an external anchor`);
    for (const a of anchors) {
      assert.match(a, /target="_blank"/, `${name} external link must open in a new tab: ${a}`);
      assert.match(a, /rel="noopener noreferrer"/, `${name} external link must carry rel="noopener noreferrer": ${a}`);
    }
  }
});

test('the About contact links carry the expected destinations', () => {
  const page = fn('AboutPage');
  assert.match(page, /https:\/\/heimeshoff\.de/, 'website link present');
  assert.match(page, /https:\/\/bsky\.app\/profile\/heimeshoff\.de/, 'Bluesky link present');
  assert.match(page, /https:\/\/linkedin\.com\/in\/heimeshoff/, 'LinkedIn link present');
});

test('the About page honors theme tokens (no hardcoded fg/bg hex outside the board-local Ko-fi gradient)', () => {
  const page = fn('AboutPage');
  // Text colors must resolve through var(--...) tokens.
  assert.match(page, /var\(--fg-1\)/, 'body text resolves through a foreground token');
  // The card surface resolves through a surface token (the shared AboutCard host).
  const card = fn('AboutCard');
  assert.match(card, /var\(--surface/, 'card surface resolves through a surface token');
  // The Ko-fi fill is the one board-local color treatment — and even it draws
  // from a styleguide status token (no raw hex), so it tracks the active theme.
  const kofi = fn('KofiButton');
  assert.doesNotMatch(kofi, /#[0-9a-fA-F]{3,8}\b/, 'the Ko-fi fill must use tokens, not raw hex');
});

test('the Ko-fi button is a solid var(--st-doing) fill, not a gradient (aw-070)', () => {
  const kofi = fn('KofiButton');
  // The fill is a flat, opaque styleguide token — no gradient.
  assert.doesNotMatch(kofi, /linear-gradient/, 'the Ko-fi button must not use a gradient fill');
  assert.match(kofi, /background:\s*["']var\(--st-doing\)["']/, 'the Ko-fi button fills with a solid var(--st-doing)');
});

test('isTaskIntent (ADR-0021 discriminator) is BYTE-UNCHANGED', () => {
  assert.match(intentRouteSrc,
    /export function isTaskIntent\(intent\) \{\r?\n  return Boolean\(intent && intent\.status\);\r?\n\}/,
    'isTaskIntent must remain byte-identical (ADR-0021 / ADR-0025 decision 2)');
});

test('main-pane-reader.js is BYTE-UNCHANGED — the About page never routes through it', () => {
  // A cheap structural lock: the reader still fetches /api/doc and renders an article.
  assert.match(mainPaneReaderSrc, /\/api\/doc/, 'MainPaneReader still owns the /api/doc fetch');
  assert.doesNotMatch(mainPaneReaderSrc, /AboutPage|mainView/, 'the reader must not learn about the About page');
});
