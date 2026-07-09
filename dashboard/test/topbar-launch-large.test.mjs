// Static guards for the larger TOPBAR launch buttons (What's next + Work).
//
// The topbar's two STANDING launches were too slim against the search field. They
// now opt into a `large` size on LaunchButton — bigger type, a more generous
// padding, and the --radius-md corner — so their SHAPE matches the design (the
// substantial, search-field-height buttons in the Screenshot 2026-06-17 mockup).
// Coloring is unchanged: Work keeps its primary fill, What's next its bordered
// chrome; only the box grows. The Refine/Promote (backlog card) and Stop
// (settings) launches do NOT opt in — they stay compact.
//
// The board has no DOM render harness; the established idiom (aw-016/020/.../068)
// is source-reading static guards over board.js.

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

test('LaunchButton accepts a `large` prop', () => {
  const lb = fn('LaunchButton');
  assert.match(lb, /\blarge\s*=\s*false\b/, 'LaunchButton must declare a `large` prop (default false)');
});

test('the `large` size uses a more generous padding than the compact default', () => {
  const lb = fn('LaunchButton');
  assert.match(
    lb,
    /large\s*\?\s*"9px 16px"\s*:\s*"4px 9px"/,
    'large must pad "9px 16px" while the compact default stays "4px 9px"',
  );
});

test('the `large` size rounds with --radius-md (vs the compact --radius-sm)', () => {
  const lb = fn('LaunchButton');
  assert.match(
    lb,
    /large\s*\?\s*"var\(--radius-md\)"\s*:\s*"var\(--radius-sm\)"/,
    'large must use the --radius-md corner; compact keeps --radius-sm',
  );
});

test('the `large` size bumps the font and icon up from the compact sizes', () => {
  const lb = fn('LaunchButton');
  assert.match(lb, /fontSize:\s*large\s*\?\s*13\.5\s*:\s*11\.5/, 'large fontSize must be 13.5 (compact 11.5)');
  assert.match(lb, /size=\$\{large\s*\?\s*15\s*:\s*12\.5\}/, 'large icon must be 15 (compact 12.5)');
});

test('both topbar standing launches (What\'s next + Work) opt into the large size', () => {
  const topbar = fn('BoardTopbar');
  const whatsNext = topbar.match(/label="What's next"[\s\S]{0,200}?\/>/);
  assert.ok(whatsNext, 'BoardTopbar must render the What\'s next launch');
  assert.match(whatsNext[0], /large=\$\{true\}/, 'the What\'s next launch must be large');

  const work = topbar.match(/label="Work"[\s\S]{0,260}?\/>/);
  assert.ok(work, 'BoardTopbar must render the Work launch');
  assert.match(work[0], /large=\$\{true\}/, 'the Work launch must be large');
});

test('the compact card/menu launches do NOT opt into large (Refine / Promote)', () => {
  // These call sites must not carry large=${true} — they stay the compact size.
  const refine = boardSrc.match(/label="Refine"[\s\S]{0,200}?\/>/);
  const promote = boardSrc.match(/label="Promote"[\s\S]{0,200}?\/>/);
  assert.ok(refine && promote, 'Refine and Promote launches must both exist');
  assert.doesNotMatch(refine[0], /large=\$\{true\}/, 'Refine must stay compact');
  assert.doesNotMatch(promote[0], /large=\$\{true\}/, 'Promote must stay compact');
});

test('Stop dashboard (ADR-0053) is not a LaunchButton at all, so it has no `large` opt-in to guard', () => {
  // Stop no longer renders LaunchButton — it POSTs /api/stop directly via
  // StopDashboardButton, a small dedicated component with no `large` prop.
  const stopBtn = boardSrc.match(/function StopDashboardButton[\s\S]*?\n}/);
  assert.ok(stopBtn, 'StopDashboardButton must exist');
  assert.doesNotMatch(stopBtn[0], /large/, 'StopDashboardButton must not carry a large/compact size prop');
});
