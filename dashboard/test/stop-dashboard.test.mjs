// Static guard for the dashboard's "Stop dashboard" topbar control
// (agentic-workflow-028, reversed by agentic-workflow-h4n2v / ADR-0053).
//
// Once the dashboard is open in the browser, the builder wants to stop the running
// server from the UI rather than returning to a session. The settings menu's Stop
// dashboard control now POSTs the scoped runtime self-lifecycle endpoint
// `POST /api/stop` DIRECTLY (ADR-0053, amending ADR-0017/ADR-0046) — no bridge, no
// spawned session, no STOP_DASHBOARD_COMMAND. This reverses aw-028's explicit seam
// ("the server is never asked to stop itself") and removes the bridge-present/absent
// asymmetry aw-028 accepted: Stop now works identically in any browser tab.
//
// Post-stop UX is driven off the fetch resolution, TRUTHFUL on a 2xx (not
// optimistic on dispatch, since there is no longer a spawned session in the loop):
//   - res.ok  → the shell shows a full-pane "Dashboard stopped — safe to close this
//     tab" overlay over the main content area.
//   - !res.ok / network error → NO overlay (nothing was actually stopped); the menu
//     just closes quietly.
// The Stop control does NOT wear the armed/danger --obligation per-launch cue
// (aw-021 / ADR-0019) — that cue is for risky work launches, not a stop.
//
// The board's React glue has no DOM render harness in this project — the established
// idiom (aw-016/020/022/023/024/026) is source-reading static guards plus pure-module
// unit tests. This suite locks the aw-h4n2v / ADR-0053 wiring criteria.

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

test('the board no longer references STOP_DASHBOARD_COMMAND or imports it (ADR-0053 — Stop posts /api/stop directly)', () => {
  assert.doesNotMatch(boardSrc, /STOP_DASHBOARD_COMMAND/, 'board.js must not reference the retired command constant');
});

test('a StopDashboardButton component exists and does NOT render a LaunchButton (no command, no bridge)', () => {
  assert.match(boardSrc, /function StopDashboardButton\b/, 'board.js must define a StopDashboardButton component');
  const stopBtn = fn('StopDashboardButton');
  assert.doesNotMatch(stopBtn, /<\$\{LaunchButton\}/, 'StopDashboardButton must not render the bridge-launch LaunchButton');
  assert.doesNotMatch(stopBtn, /command=/, 'StopDashboardButton must not take a command prop — there is no slash command any more');
});

test('the settings menu renders the StopDashboardButton wired to onStopClick (aw-049 relocation preserved)', () => {
  const top = fn('BoardTopbar');
  assert.doesNotMatch(top, /Stop dashboard/, 'the Stop control lives in the settings menu — not inline in the topbar');
  const menu = fn('SettingsMenu');
  assert.match(menu, /<\$\{StopDashboardButton\}/, 'the settings menu must mount the StopDashboardButton');
  assert.match(menu, /<\$\{StopDashboardButton\}\s+onClick=\$\{onStopClick\}/, 'the Stop control must be wired to onStopClick');
});

test('selecting Stop dashboard POSTs /api/stop directly — no bridge, no command string', () => {
  const menu = fn('SettingsMenu');
  assert.match(menu, /onStopClick\s*=\s*useCallback/, 'SettingsMenu must own an onStopClick handler');
  const handler = menu.match(/const onStopClick[\s\S]*?\}, \[onStopped\]\);/);
  assert.ok(handler, 'the onStopClick handler must be present');
  assert.match(handler[0], /fetchImpl\("\/api\/stop",\s*\{\s*method:\s*"POST"\s*\}\)/, 'Stop must POST /api/stop directly');
  assert.doesNotMatch(handler[0], /launchOrCopy/, 'Stop must NOT go through the bridge launch path any more');
});

test('selecting Stop dashboard closes the menu (setOpen(false)) as part of the onStopClick flow', () => {
  const menu = fn('SettingsMenu');
  const handler = menu.match(/const onStopClick[\s\S]*?\}, \[onStopped\]\);/);
  assert.ok(handler, 'the onStopClick handler must be present');
  assert.match(handler[0], /setOpen\(false\)/, 'selecting Stop dashboard must close the menu');
});

test('the overlay flips ONLY on a truthful 2xx (res.ok), not merely on dispatch', () => {
  const menu = fn('SettingsMenu');
  const handler = menu.match(/const onStopClick[\s\S]*?\}, \[onStopped\]\);/);
  assert.ok(handler, 'the onStopClick handler must be present');
  assert.match(handler[0], /res\s*&&\s*res\.ok\s*&&\s*typeof onStopped === "function"/, 'onStopped must fire only when the fetch resolved with res.ok');
});

test('the Stop control does NOT wear the armed/danger per-launch cue (it never threads skipPermissions)', () => {
  const stopBtn = fn('StopDashboardButton');
  assert.doesNotMatch(stopBtn, /skipPermissions/, 'Stop must NOT thread skipPermissions (no armed/danger cue — aw-021/ADR-0019 is a non-goal here)');
});

test('the Stop button fires with NO confirmation step (a single click posts /api/stop)', () => {
  const top = fn('BoardTopbar');
  const menu = fn('SettingsMenu');
  assert.doesNotMatch(top, /confirm\s*\(/, 'the Stop control must not be gated behind a confirmation prompt (topbar)');
  assert.doesNotMatch(menu, /confirm\s*\(/, 'the Stop control must not be gated behind a confirmation prompt (settings menu)');
});

test('the onStopped callback threads shell → topbar → settings menu, flipping shell state only on a truthful 2xx', () => {
  // The shell hands onStopped to BoardTopbar, which threads it into SettingsMenu (aw-049);
  // the menu's onStopClick handler fires it only when the POST resolved res.ok.
  const topSig = boardSrc.match(/function BoardTopbar\(\{[^}]*\}\)/);
  assert.ok(topSig, 'BoardTopbar must take a props object');
  assert.match(topSig[0], /onStopped/, 'BoardTopbar must accept an onStopped prop from the shell');
  const top = fn('BoardTopbar');
  assert.match(top, /onStopped=\$\{onStopped\}/, 'BoardTopbar must thread onStopped into the SettingsMenu');
  const menuSig = boardSrc.match(/function SettingsMenu\(\{[^}]*\}\)/);
  assert.ok(menuSig, 'SettingsMenu must take a props object');
  assert.match(menuSig[0], /onStopped/, 'SettingsMenu must accept onStopped');
});

test('DashboardApp owns a "stopped" shell state, flips it via onStopped, and mounts the overlay over the main content', () => {
  const app = boardSrc.match(/export function DashboardApp[\s\S]*$/)[0];
  assert.match(app, /\[stopped, setStopped\]\s*=\s*useState\(false\)/, 'DashboardApp must hold a stopped shell state (default false)');
  // The shell hands BoardTopbar an onStopped that flips the state to true.
  assert.match(app, /onStopped=/, 'DashboardApp must pass onStopped to BoardTopbar');
  assert.match(app, /setStopped\(true\)/, 'onStopped must flip the stopped state to true');
  // The overlay is mounted only when stopped, over the main content area.
  assert.match(app, /stopped\s*\?\s*html`<\$\{StoppedOverlay\}/, 'the StoppedOverlay must mount only when stopped is true');
});

test('a board-local StoppedOverlay carries the "stopped — safe to close" copy and is full-pane', () => {
  const overlay = fn('StoppedOverlay');
  assert.match(overlay, /Dashboard stopped — safe to close this tab/, 'the overlay must carry the "stopped — safe to close" copy');
  // Full-pane cover over the relatively-positioned content wrapper.
  assert.match(overlay, /position:\s*"absolute"/, 'the overlay must absolutely fill the main content area');
  assert.match(overlay, /inset:\s*0/, 'the overlay must cover the full content area (inset: 0)');
});

test('the stopped overlay is board-local and token-matched — NOT the Drawer side-panel primitive (ADR-0003)', () => {
  const overlay = fn('StoppedOverlay');
  // The overlay is composed from tokens; it must not reuse the Drawer side panel.
  assert.doesNotMatch(overlay, /<\$\{Drawer\}/, 'the stopped overlay must NOT use the Drawer side-panel primitive');
  assert.match(overlay, /var\(--surface-0\)/, 'the overlay must be token-matched (composed from styleguide tokens)');
});
