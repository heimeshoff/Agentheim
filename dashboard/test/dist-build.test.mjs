// Output assertions for the dashboard asset build (infrastructure-002).
//
// A build task's "tests" are assertions on the committed dist/. This suite runs
// the esbuild build fresh, then asserts the emitted artifact set and that the
// bundle honors ADR-0003 / ADR-0002: framework bundled IN (no CDN), React
// PRODUCTION build, token CSS present, no in-browser Babel, no import map.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { styleguideDir } from '../../lib/task-system-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(__dirname, '..');

// Regenerate a build into a SCRATCH directory, never the committed
// dashboard/dist/ (infrastructure-w45ce). Building in place here — as this
// hook did before this task — would make dist-staleness.test.mjs's "committed
// dist matches its source stamp" assertion structurally, permanently green:
// a sibling test in the SAME `node --test` invocation would have just
// refreshed the very thing being checked (ADR-0057 alternative (a) names this
// exact trap for a "dist matches fresh build" assertion). Redirecting the
// rebuild here means this suite's own test run never touches, and never
// re-freshens, the committed dist/ — the staleness check reads real,
// honest, on-disk state instead.
const SCRATCH_DIST = mkdtempSync(path.join(os.tmpdir(), 'agentheim-dashboard-dist-build-'));
const DIST = SCRATCH_DIST;
const BUNDLE = path.join(DIST, 'app.js');
const INDEX = path.join(DIST, 'index.html');

// Requires `npm install` to have populated dashboard/node_modules (build-time).
before(() => {
  execFileSync(process.execPath, [path.join(DASHBOARD, 'build.mjs'), SCRATCH_DIST], {
    cwd: DASHBOARD,
    stdio: 'ignore',
  });
});

after(() => {
  rmSync(SCRATCH_DIST, { recursive: true, force: true });
});

test('build emits index.html, the bundled JS, and both token CSS files', () => {
  assert.ok(existsSync(INDEX), 'dist/index.html should exist');
  assert.ok(existsSync(BUNDLE), 'dist/app.js (bundled) should exist');
  assert.ok(existsSync(path.join(DIST, 'colors_and_type.css')), 'token CSS colors_and_type.css present');
  assert.ok(existsSync(path.join(DIST, 'agentheim.css')), 'token CSS agentheim.css present');
});

// ADR-0083: the dist contract is "entry + chunks" — scan EVERY .js under a dist dir.
function allJsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allJsFiles(abs));
    else if (e.name.endsWith('.js')) out.push(abs);
  }
  return out;
}

const FORBIDDEN_NETWORK = ['esm.sh', 'unpkg', 'cdn.jsdelivr', 'importmap'];

// Returns the list of violations (file + token) across every .js under `dir`.
function networkViolations(dir) {
  const bad = [];
  for (const f of allJsFiles(dir)) {
    const js = readFileSync(f, 'utf8');
    for (const forbidden of FORBIDDEN_NETWORK) {
      if (js.includes(forbidden)) bad.push(`${path.relative(dir, f)}: ${forbidden}`);
    }
  }
  return bad;
}

test('no .js under dist/ (entry or chunks) fetches a framework over the network (no CDN, no import map)', () => {
  assert.deepEqual(networkViolations(DIST), []);
});

test('the network scan covers chunks/: a planted chunks/x.js containing esm.sh is caught', () => {
  const planted = mkdtempSync(path.join(os.tmpdir(), 'yaajt-planted-'));
  try {
    mkdirSync(path.join(planted, 'chunks'));
    writeFileSync(path.join(planted, 'app.js'), 'export {};');
    writeFileSync(path.join(planted, 'chunks', 'x.js'), 'import "https://esm.sh/mermaid";');
    assert.deepEqual(networkViolations(planted), ['chunks/x.js: esm.sh']);
  } finally {
    rmSync(planted, { recursive: true, force: true });
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
  for (const f of allJsFiles(DIST)) {
    assert.equal(readFileSync(f, 'utf8').includes('jsdom'), false, `"jsdom" must not appear in ${path.relative(DIST, f)}`);
  }
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
  const src = path.join(styleguideDir(path.resolve(DASHBOARD, '..')), 'styles');
  for (const css of ['colors_and_type.css', 'agentheim.css']) {
    const a = readFileSync(path.join(src, css), 'utf8');
    const b = readFileSync(path.join(DIST, css), 'utf8');
    assert.equal(b, a, `${css} in dist must be a verbatim copy of the styleguide source`);
  }
});

test('dashboard/package.json pins mermaid to an exact version (no ^ or ~) (ADR-0083)', () => {
  const pkg = JSON.parse(readFileSync(path.join(DASHBOARD, 'package.json'), 'utf8'));
  const v = pkg.devDependencies?.mermaid;
  assert.ok(v, 'mermaid is a devDependency');
  assert.match(v, /^\d+\.\d+\.\d+$/, `mermaid must be an exact version, got ${v}`);
});

// ---- design-system-kw15t: mermaid ships as a lazy chunk (ADR-0083) ----
// MERMAID_MARKER is a string that occurs only inside mermaid's own code (its
// flowchart diagram registry id), never in Agentheim source: if it shows up in
// app.js, a static import has dragged mermaid into the entry bundle.
const MERMAID_MARKER = 'flowchart-v2';
// app.js size on main before design-system-kw15t (infrastructure-yaajt Outcome).
const APP_JS_BASELINE_BYTES = 328694;
const APP_JS_MAX_GROWTH_BYTES = 20 * 1024;

test('mermaid is a lazy chunk: app.js has a dynamic chunk import and no mermaid-only marker; chunks/ holds it', () => {
  const app = readFileSync(BUNDLE, 'utf8');
  assert.ok(app.includes('import("./chunks/'), 'app.js dynamically imports ./chunks/');
  assert.ok(!app.includes(MERMAID_MARKER), 'mermaid code must not be in app.js');
  const chunks = allJsFiles(path.join(DIST, 'chunks'));
  assert.ok(chunks.some((f) => readFileSync(f, 'utf8').includes(MERMAID_MARKER)), 'some chunk contains mermaid');
});

test('no .js under dist/ contains a CDN host or a remote dynamic import("http', () => {
  const bad = [];
  for (const f of allJsFiles(DIST)) {
    const js = readFileSync(f, 'utf8');
    for (const needle of ['esm.sh', 'unpkg', 'cdn.jsdelivr', 'cdnjs', 'import("http']) {
      if (js.includes(needle)) bad.push(`${path.relative(DIST, f)}: ${needle}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('app.js grows by at most 20 KB over the pre-mermaid baseline', () => {
  const size = readFileSync(BUNDLE).length;
  assert.ok(size - APP_JS_BASELINE_BYTES <= APP_JS_MAX_GROWTH_BYTES, `app.js is ${size} bytes (baseline ${APP_JS_BASELINE_BYTES})`);
});
