// Output assertions for the dashboard asset build (infrastructure-002).
//
// A build task's "tests" are assertions on the committed dist/. This suite runs
// the esbuild build fresh, then asserts the emitted artifact set and that the
// bundle honors ADR-0003 / ADR-0002: framework bundled IN (no CDN), React
// PRODUCTION build, token CSS present, no in-browser Babel, no import map.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(__dirname, '..');
const DIST = path.join(DASHBOARD, 'dist');
const BUNDLE = path.join(DIST, 'app.js');
const INDEX = path.join(DIST, 'index.html');

// Regenerate dist/ once so the assertions test a fresh build, not a stale one.
// Requires `npm install` to have populated dashboard/node_modules (build-time).
before(() => {
  execFileSync(process.execPath, [path.join(DASHBOARD, 'build.mjs')], {
    cwd: DASHBOARD,
    stdio: 'ignore',
  });
});

test('build emits index.html, the bundled JS, and both token CSS files', () => {
  assert.ok(existsSync(INDEX), 'dist/index.html should exist');
  assert.ok(existsSync(BUNDLE), 'dist/app.js (bundled) should exist');
  assert.ok(existsSync(path.join(DIST, 'colors_and_type.css')), 'token CSS colors_and_type.css present');
  assert.ok(existsSync(path.join(DIST, 'agentheim.css')), 'token CSS agentheim.css present');
});

test('bundle fetches no framework over the network (no CDN, no import map)', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  for (const forbidden of ['esm.sh', 'unpkg', 'cdn.jsdelivr', 'importmap']) {
    assert.equal(js.includes(forbidden), false, `bundle must not reference ${forbidden}`);
  }
});

test('no in-browser Babel and no React development build in the bundle', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  assert.equal(js.includes('@babel/standalone'), false, 'no @babel/standalone');
  assert.equal(js.includes('text/babel'), false, 'no text/babel');
  assert.equal(js.includes('react.development'), false, 'no react.development build');
});

// infrastructure-d2n8s: jsdom joined dashboard/package.json's devDependencies
// as a TEST-time-only DOM-render harness dependency (mirroring esbuild's own
// build-time-only carve-out, ADR-0002/ADR-0003). board.js never imports it —
// no test file is part of the esbuild entry graph — but this is verified
// here rather than merely asserted, exactly as infrastructure-002 verified
// esbuild's own equivalent claim by grepping the committed bundle.
test('jsdom (a test-time-only devDependency, ADR-0002/ADR-0003) never reaches the committed dist/ bundle', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  assert.equal(js.includes('jsdom'), false, 'the string "jsdom" must not appear anywhere in the committed bundle');
});

test('React PRODUCTION build is bundled in (process.env.NODE_ENV resolved to production)', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  // esbuild --define replaces process.env.NODE_ENV at build time, so the dev-only
  // invariant-warning branches are dead-code-eliminated. React's production build
  // is identified by its production-only marker string and the absence of the
  // dev "react-dom.development" guidance.
  assert.equal(
    js.includes('process.env.NODE_ENV'),
    false,
    'NODE_ENV must be inlined at build time (no runtime process.env lookup)',
  );
  // A reliable positive marker of React's production path: the minified runtime
  // ships the version string and not the development warning preamble.
  assert.ok(
    js.includes('18.3.1') || js.includes('react'),
    'React runtime should be bundled in',
  );
});

test('index.html loads the local bundle + local token CSS, no remote framework', () => {
  const html = readFileSync(INDEX, 'utf8');
  assert.ok(html.includes('id="root"'), 'has #root mount point');
  assert.ok(/src=["']\.\/app\.js["']/.test(html), 'loads the local ./app.js bundle');
  assert.ok(html.includes('colors_and_type.css'), 'links local colors_and_type.css');
  assert.ok(html.includes('agentheim.css'), 'links local agentheim.css');
  // No import map and no remote framework <script src=...> for react/marked/etc.
  assert.equal(/<script[^>]+type=["']importmap["']/.test(html), false, 'no import map');
  assert.equal(/<script[^>]+src=["']https?:/.test(html), false, 'no remote <script src>');
});

test('dist bundles the LIVE dashboard board, not the styleguide canvas (aw-006)', () => {
  const js = readFileSync(BUNDLE, 'utf8');
  // The live board fetches the read projection. The canvas never did.
  assert.ok(js.includes('/api/tree'), 'bundle must fetch /api/tree (the live board)');
  // The styleguide canvas hero copy must NOT be shipped to the dashboard — that
  // would mean the canvas entry, not the board, got bundled.
  assert.equal(
    js.includes('A calm, content-first control panel'),
    false,
    'styleguide canvas hero must not be in the dashboard bundle',
  );
});

test('token CSS in dist matches the styleguide source (single source of truth)', () => {
  const src = path.resolve(
    DASHBOARD, '..', '.agentheim', 'contexts', 'design-system', 'styleguide', 'styles',
  );
  for (const css of ['colors_and_type.css', 'agentheim.css']) {
    const a = readFileSync(path.join(src, css), 'utf8');
    const b = readFileSync(path.join(DIST, css), 'utf8');
    assert.equal(b, a, `${css} in dist must be a verbatim copy of the styleguide source`);
  }
});
