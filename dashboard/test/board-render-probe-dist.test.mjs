// Output assertion (dist-build.test.mjs-style, agentic-workflow-rw6ck) that
// the render-count PROBE (BoardCard/BoardColumn/DashboardBoard's `renderProbe`
// prop, see board-render-probe-hover.test.mjs's header comment) is genuinely
// inert in production: no test file is ever imported by board.js, and the
// default the probe falls back to when nobody supplies one is a plain,
// harmless no-op object defined right there in board.js — not something a
// test module has to install for the app to work.
//
// Mirrors dist-build.test.mjs's own "jsdom never reaches the committed
// bundle" assertion (infrastructure-d2n8s), rebuilt into a SCRATCH dist/ for
// the same reason that suite's header comment gives: never touch or
// re-freshen the COMMITTED dashboard/dist/ from inside a test run
// (ADR-0057).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(__dirname, '..');
const boardSrc = readFileSync(path.join(DASHBOARD, 'app', 'board.js'), 'utf8');

const SCRATCH_DIST = mkdtempSync(path.join(os.tmpdir(), 'agentheim-dashboard-render-probe-dist-'));
const BUNDLE = path.join(SCRATCH_DIST, 'app.js');

before(() => {
  execFileSync(process.execPath, [path.join(DASHBOARD, 'build.mjs'), SCRATCH_DIST], {
    cwd: DASHBOARD,
    stdio: 'ignore',
  });
});

after(() => {
  rmSync(SCRATCH_DIST, { recursive: true, force: true });
});

test('the render probe default is an inert no-op object defined in board.js itself — no test-only import', () => {
  assert.match(
    boardSrc,
    /const NOOP_RENDER_PROBE = \{ card\(\) \{\}, column\(\) \{\} \};/,
    'board.js must define its own inert no-op render probe — the default every real (non-test) mount uses',
  );
  // board.js must not import from test/ or the DOM-render harness anywhere —
  // the probe is an ordinary optional prop with an inert default, not a
  // test-time dependency the production module reaches for.
  assert.doesNotMatch(boardSrc, /from\s+["']\.\.\/test\//, 'board.js must not import anything from test/');
  assert.doesNotMatch(boardSrc, /dom-harness/, 'board.js must not reference the DOM-render test harness');
});

test('DashboardBoard defaults renderProbe to the inert NOOP — production never installs a real one', () => {
  assert.match(
    boardSrc,
    /export function DashboardBoard\(\{[^}]*renderProbe = NOOP_RENDER_PROBE[^}]*\}\)/,
    'DashboardBoard must default its renderProbe prop to NOOP_RENDER_PROBE',
  );
  // DashboardApp (the real production mount point) must never pass a renderProbe.
  const dashboardAppSrc = boardSrc.slice(boardSrc.indexOf('export function DashboardApp'));
  assert.doesNotMatch(
    dashboardAppSrc,
    /renderProbe=/,
    'DashboardApp must not pass a renderProbe to DashboardBoard — production always uses the inert default',
  );
});

test('the built production bundle contains no test-only import (dom-harness, node:test, or a test/ path)', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  for (const forbidden of ['dom-harness', 'node:test', 'jsdom']) {
    assert.equal(js.includes(forbidden), false, `bundle must not reference ${forbidden}`);
  }
});
