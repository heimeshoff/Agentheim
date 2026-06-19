// Static guard for the dashboard shell relayout (agentic-workflow-026).
//
// The live shell is rewritten from a horizontal top header over a centered 1160px
// <main> to the styleguide §05 "Components in context" layout: a full-height left
// RAIL beside a MAIN COLUMN (a ~52px topbar over the scrollable board). The rail is
// composed from styleguide PRIMITIVES (Glyph / RailItem / TreeGroup / TreeItem) —
// NOT the styleguide AppRail (hardwired to the demo LIBRARY) — and fed the LIVE
// treeToLibrary(tree) projection. The Board RailItem is the only nav item; the
// always-visible Workspace tree IS the library. The theme + skip-permissions
// toggles live in the main-column TOPBAR, left of the theme-following Work launch
// (aw-029 placement; aw-033 made the launch follow the scheme); the rail no
// longer renders a toggle footer. No styleguide file is modified.
//
// The board's React glue has no DOM render harness in this project — the established
// idiom (aw-016/020/022/023/024) is source-reading static guards plus pure-module
// unit tests. This suite locks the aw-026 acceptance criteria that are not pure
// string logic; the prompt-bar Work removal is locked in board-prompt-bar.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');
const styleguideRail = readFileSync(
  path.join(dashboardDir, '..', '.agentheim', 'contexts', 'design-system', 'styleguide', 'app', 'library.js'),
  'utf8',
);

function fn(name) {
  const m = boardSrc.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(m, `${name} must exist in board.js`);
  return m[0];
}

test('DashboardApp renders a flex-row shell (rail beside a main column), not a centered <main>', () => {
  const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];
  assert.match(app, /flexDirection:\s*"row"/, 'the shell must be a horizontal flex row');
  // The retired centered 1160px <main> wrapper must be gone.
  assert.doesNotMatch(app, /maxWidth:\s*1160/, 'the centered 1160px main wrapper must be retired');
});

test('the shell mounts the ShellRail beside the board main column', () => {
  const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];
  assert.match(app, /<\$\{ShellRail\}/, 'DashboardApp must mount ShellRail');
  assert.match(app, /<\$\{DashboardBoard\}/, 'DashboardApp must mount the board in the main column');
});

test('the board↔library view toggle and the full-pane DashboardLibrary surface are retired', () => {
  // No view state branch, no separate Library full-pane mount.
  assert.doesNotMatch(boardSrc, /view === "library"/, 'the library full-pane branch must be gone');
  assert.doesNotMatch(boardSrc, /<\$\{DashboardLibrary\}/, 'the DashboardLibrary full pane must not be mounted');
});

test('ShellRail is a vertical full-height nav composed from styleguide primitives', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /flexDirection:\s*"column"/, 'the rail must stack vertically (full-height column)');
  assert.match(rail, /<\$\{Glyph\}/, 'rail brand must use the styleguide Glyph');
  assert.match(rail, /<\$\{RailItem\}[\s\S]*?label="Board"/, 'rail must have a Board RailItem');
  // aw-n4h7q renders the live tree by composing the styleguide Collapsible (group
  // header) + TreeItem (rows) directly — the SAME primitives TreeGroup composes —
  // so the design-system-v8k2p attention cue can be threaded (TreeGroup has no seam).
  assert.match(rail, /<\$\{Collapsible\}/, 'rail must render the live tree group headers via styleguide Collapsible');
  assert.match(rail, /<\$\{TreeItem\}/, 'rail must render the live tree rows via styleguide TreeItem');
});

test('the rail nav RailItems are the built-in views (Board + Workflow + About) — no separate Library RailItem (ADR-0011 / ADR-0025)', () => {
  // aw-026 shipped a single Board nav item (the tree below IS the library, ADR-0011).
  // aw-058 (ADR-0025) added the built-in Workflow guide BESIDE Board; aw-062 added the
  // built-in About page below Workflow. There is still NO separate Library RailItem —
  // the Workspace tree is the library.
  const rail = fn('ShellRail');
  const railItems = rail.match(/<\$\{RailItem\}/g) || [];
  assert.equal(railItems.length, 3, 'exactly three nav RailItems (Board + Workflow + About) — the tree below is the library');
  assert.doesNotMatch(rail, /label="Library"/, 'there must be no separate Library RailItem');
});

test('the rail tree is fed the LIVE treeToLibrary projection, never the demo LIBRARY constant', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /treeToLibrary/, 'the rail tree must come from treeToLibrary(tree)');
  // The styleguide demo LIBRARY constant must never be imported or rendered by the
  // dashboard (a comment may name it; iterating it — LIBRARY.map — would be a fork).
  assert.doesNotMatch(boardSrc, /\bLIBRARY\.map\b|import\s*\{[^}]*\bLIBRARY\b/, 'the dashboard must not consume the styleguide demo LIBRARY');
  // The dashboard does not consume the hardwired AppRail (it composes primitives).
  assert.doesNotMatch(boardSrc, /<\$\{AppRail\}/, 'the dashboard must not mount the styleguide AppRail');
});

test('the rail carries a Workspace label above the tree', () => {
  const rail = fn('ShellRail');
  assert.match(rail, /Workspace/, 'the rail must label the tree section "Workspace"');
});

test('the rail no longer renders the theme or skip-permissions toggle (aw-029)', () => {
  const rail = fn('ShellRail');
  assert.doesNotMatch(rail, /<\$\{ThemeToggle\}/, 'the toggles moved to the topbar — the rail must not host the theme toggle');
  assert.doesNotMatch(rail, /<\$\{SkipPermissionsToggle\}/, 'the toggles moved to the topbar — the rail must not host the skip-permissions toggle');
});

test('the theme + skip-permissions toggles moved into the settings menu, left of the standing Work launch (aw-029 → aw-049)', () => {
  // aw-049 collapsed the theme + skip-permissions toggles (and Stop) into the gear's
  // SettingsMenu; they no longer render inline in the topbar. The topbar now hosts the
  // gear (SettingsMenu) immediately LEFT of the standing Work launch.
  const top = fn('BoardTopbar');
  assert.doesNotMatch(top, /<\$\{ThemeToggle\}/, 'the theme toggle moved into the settings menu — not inline in the topbar');
  assert.doesNotMatch(top, /<\$\{SkipPermissionsToggle\}/, 'the skip-permissions toggle moved into the settings menu — not inline in the topbar');
  const menu = fn('SettingsMenu');
  assert.match(menu, /<\$\{ThemeToggle\}/, 'the settings menu must host the theme toggle');
  assert.match(menu, /<\$\{SkipPermissionsToggle\}/, 'the settings menu must host the skip-permissions toggle');
  // The gear sits left of the Work launch in the topbar.
  const menuAt = top.indexOf('${SettingsMenu}');
  const workAt = top.indexOf('label="Work"');
  assert.ok(menuAt > -1 && workAt > -1, 'the gear and the Work launch must render in the topbar');
  assert.ok(menuAt < workAt, 'the settings gear must render left of the Work launch');
});

test('a main-column topbar renders the theme-following Work launch and the global SEARCH field (aw-052)', () => {
  const top = fn('BoardTopbar');
  // The Work launch FOLLOWS the active theme (aw-033): the primary emphasis
  // (idleBg --surface-2, idleColor --fg-1) — NOT the inverse §05 treatment that
  // reads as the opposite scheme. It must not be rendered with emphasis="inverse".
  assert.doesNotMatch(top, /emphasis="inverse"/, 'the topbar Work launch must not use the inverse (opposite-theme) treatment');
  // aw-052: the dead breadcrumb is replaced by the global search field (TopbarSearch
  // over the ds-016 SearchField, wired to GET /api/search). The earlier "no Search box"
  // guard predated the search backend (aw-050) + styleguide pattern (ds-016).
  assert.match(top, /<\$\{TopbarSearch\}/, 'the topbar must render the global search field');
});

test('the topbar Work button IS the Work launch: bare WORK_COMMAND, skipPermissions threaded, no onResult', () => {
  const top = fn('BoardTopbar');
  assert.match(top, /label="Work"/, 'the topbar must render the Work launch');
  const work = top.match(/label="Work"[\s\S]{0,320}?\/>/);
  assert.ok(work, 'the Work button must be present in the topbar');
  assert.match(work[0], /command=\$\{WORK_COMMAND\}/, 'Work must seed the bare WORK_COMMAND');
  assert.match(work[0], /emphasis="primary"/, 'Work must use the theme-following primary emphasis (aw-033)');
  assert.match(work[0], /skipPermissions=\$\{skipPermissions\}/, 'Work must thread skipPermissions (aw-021/ADR-0019)');
  assert.doesNotMatch(work[0], /onResult/, 'Work must NOT pass onResult — it never consumed a prompt');
});

test('LaunchButton supports an "inverse" emphasis filled with --fg-1 / --surface-0 (§05)', () => {
  const lb = fn('LaunchButton');
  assert.match(lb, /emphasis === "inverse"|inverse/, 'LaunchButton must recognise the inverse emphasis');
  assert.match(lb, /var\(--surface-0\)/, 'inverse text colour must be --surface-0');
});

test('the shell frame is bounded to the viewport height so the topbar stays fixed (aw-067)', () => {
  // The outer DashboardApp frame must CAP its height to the viewport and clip its own
  // overflow, so the WINDOW never scrolls. Previously it was minHeight: "100vh" with no
  // cap, so a tall main column grew the whole frame (rail + topbar + content) and the
  // window scrolled the topbar off-screen.
  const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];
  const frame = app.match(/display:\s*"flex",\s*flexDirection:\s*"row",[\s\S]{0,160}?\}\}>/);
  assert.ok(frame, 'the flex-row shell frame must be present');
  assert.match(frame[0], /height:\s*"100dvh"|height:\s*"100vh"/, 'the shell frame must cap its height to the viewport (100dvh/100vh)');
  assert.match(frame[0], /overflow:\s*"hidden"/, 'the shell frame must clip overflow so the window itself never scrolls');
  assert.doesNotMatch(frame[0], /minHeight:\s*"100vh"/, 'the uncapped minHeight: 100vh that let the window grow must be gone');
});

test('the inner content region is the sole vertical scroll container, not the window (aw-067)', () => {
  // The scroll-quiet wrapper under the topbar must own the vertical scroll (flex:1,
  // minHeight:0, overflowY:auto) so it — not the window — scrolls when content is tall.
  const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];
  const scrollRegion = app.match(/className="scroll-quiet"\s+style=\$\{\{[^}]*overflowY:\s*"auto"[^}]*\}\}/g) || [];
  assert.ok(scrollRegion.length >= 1, 'a scroll-quiet content region with overflowY: auto must own the scroll');
  // The scroll region (and its flex parent) sit BELOW the topbar, so the topbar — a
  // sibling above it — is not carried by the scroll and is not clipped by the frame's
  // overflow: hidden (the popover floats out of the topbar row, above the scroll region).
  const topbarAt = app.indexOf('${BoardTopbar}');
  const scrollAt = app.indexOf('className="scroll-quiet"');
  assert.ok(topbarAt > -1 && scrollAt > -1, 'topbar and scroll region must both be present');
  assert.ok(topbarAt < scrollAt, 'the topbar must be a sibling ABOVE the scroll region (so it stays fixed and its popover is not clipped)');
});

test('no styleguide file is modified — the dashboard composes the unforked primitives', () => {
  // The styleguide AppRail still demos LIBRARY (proves we did not gut it to feed live data).
  assert.match(styleguideRail, /export function AppRail/, 'styleguide AppRail must remain intact');
  assert.match(styleguideRail, /LIBRARY\.map/, 'styleguide AppRail must still render the demo LIBRARY');
});
