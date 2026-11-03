// ADR-0078 two-root layout — `npm run build` must succeed against the
// board-layout styleguide location
// (`.agentheim/knowledge/contexts/design-system/styleguide/`,
// agentic-workflow-hxq1g), and a DETECTED legacy styleguide root is refused
// with `legacy-layout` rather than silently falling back
// (agentic-workflow-g5ez5, ADR-0078 §5 second phase).
//
// `runBuild({ repoRoot })` (build.mjs) resolves the styleguide via
// `styleguideDir(repoRoot)` and a build-time esbuild plugin redirects every
// one of the 20 literal `design-system/styleguide/app/*.js` import specifiers
// across dashboard/app/{app,board,main-pane-reader,slide-over}.js to that
// resolved directory — proven here by driving a REAL build against a fixture
// root that mirrors this repo's own real styleguide source. A resolution
// miss on ANY of the 20 imports would throw out of `runBuild` (esbuild's own
// module-not-found error), so build SUCCESS is itself the proof "all 20
// app-side import paths resolve".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, existsSync, rmSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBuild } from '../build.mjs';
import { styleguideDir } from '../../lib/task-system-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DASHBOARD, '..');
// This repo's OWN tree is board-shaped (migrated by agentic-workflow-tgr31,
// commit 6fbaad2) — the real styleguide source to mirror into each fixture.
const REAL_STYLEGUIDE = styleguideDir(REPO_ROOT);

function makeFixtureRoot(kind) {
  const base = mkdtempSync(path.join(tmpdir(), `hxq1g-build-${kind}-`));
  const dest = kind === 'legacy'
    ? path.join(base, '.agentheim', 'contexts', 'design-system', 'styleguide')
    : path.join(base, '.agentheim', 'knowledge', 'contexts', 'design-system', 'styleguide');
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(REAL_STYLEGUIDE, dest, { recursive: true });
  if (kind === 'board') {
    // detectLayout needs the board/ marker directory to resolve 'board' —
    // knowledge/contexts/ alone (with no legacy contexts/) is ambiguous with
    // "an .agentheim/ that simply hasn't populated either root yet".
    mkdirSync(path.join(base, '.agentheim', 'board'), { recursive: true });
  }
  return base;
}

async function assertBuildSucceeds(fixtureRoot) {
  const scratchDist = mkdtempSync(path.join(tmpdir(), 'hxq1g-build-dist-'));
  try {
    await runBuild({ repoRoot: fixtureRoot, outDir: scratchDist });
    assert.ok(existsSync(path.join(scratchDist, 'app.js')), 'bundle emitted');
    assert.ok(existsSync(path.join(scratchDist, 'colors_and_type.css')), 'token CSS copied');
    assert.ok(existsSync(path.join(scratchDist, 'agentheim.css')), 'token CSS copied');
    assert.ok(existsSync(path.join(scratchDist, 'fonts')), 'webfonts copied');
    assert.ok(existsSync(path.join(scratchDist, '.build-stamp.json')), 'build stamp written');
    const html = readFileSync(path.join(scratchDist, 'index.html'), 'utf8');
    assert.ok(html.includes('id="root"'), "the styleguide's own entry page loads (mount point present)");
    const js = readFileSync(path.join(scratchDist, 'app.js'), 'utf8');
    assert.ok(js.length > 0, 'bundle is non-empty');
  } finally {
    rmSync(scratchDist, { recursive: true, force: true });
  }
}

test('runBuild against a detected legacy styleguide root is refused with legacy-layout, not a silent fallback (agentic-workflow-g5ez5)', async () => {
  const fixtureRoot = makeFixtureRoot('legacy');
  const scratchDist = mkdtempSync(path.join(tmpdir(), 'hxq1g-build-dist-'));
  try {
    await assert.rejects(
      () => runBuild({ repoRoot: fixtureRoot, outDir: scratchDist }),
      (err) => err.code === 'legacy-layout'
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(scratchDist, { recursive: true, force: true });
  }
});

test('npm run build succeeds against a board-layout fixture (knowledge/contexts/design-system/styleguide/); all 20 app-side imports resolve', async () => {
  const fixtureRoot = makeFixtureRoot('board');
  try {
    await assertBuildSucceeds(fixtureRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('declaredInputRoots (build-stamp.mjs) against a detected legacy fixture is refused with legacy-layout too (agentic-workflow-g5ez5)', async () => {
  const { declaredInputRoots } = await import('../build-stamp.mjs');
  const fixtureRoot = makeFixtureRoot('legacy');
  try {
    assert.throws(
      () => declaredInputRoots({ dashboardDir: DASHBOARD, repoRoot: fixtureRoot }),
      (err) => err.code === 'legacy-layout'
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// infrastructure-yaajt / ADR-0083: a dynamic import() in the styleguide source
// becomes a lazily-loaded chunk under dist/chunks/, and an app.js that
// references it relatively; the build is byte-deterministic.
function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(abs, base));
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

test('a dynamic import() in the styleguide source emits dist/chunks/*.js and app.js references ./chunks/ (ADR-0083)', async () => {
  const fixtureRoot = makeFixtureRoot('board');
  const dist1 = mkdtempSync(path.join(tmpdir(), 'yaajt-dist-a-'));
  const dist2 = mkdtempSync(path.join(tmpdir(), 'yaajt-dist-b-'));
  try {
    const appDir = path.join(styleguideDir(fixtureRoot), 'app');
    writeFileSync(path.join(appDir, 'lazy-fixture.js'), 'export const lazyFixtureMarker = "yaajt-lazy-marker-" + Date.now().toString().length;\n');
    appendFileSync(path.join(appDir, 'primitives.js'), '\nimport("./lazy-fixture.js").then((m) => { globalThis.__lazy = m; });\n');

    await runBuild({ repoRoot: fixtureRoot, outDir: dist1 });
    const files = listFiles(dist1);
    const chunks = files.filter((f) => /^chunks\/.+\.js$/.test(f));
    assert.ok(chunks.length >= 1, `expected at least one chunks/*.js, got: ${files.join(', ')}`);
    assert.ok(files.includes('app.js'), 'entry keeps its name app.js');
    assert.ok(readFileSync(path.join(dist1, 'app.js'), 'utf8').includes('import("./chunks/'), 'app.js lazily imports ./chunks/');
    assert.ok(/src=["']\.\/app\.js["']/.test(readFileSync(path.join(dist1, 'index.html'), 'utf8')));

    // Determinism: a second build into a different dir is byte-identical.
    await runBuild({ repoRoot: fixtureRoot, outDir: dist2 });
    const files2 = listFiles(dist2);
    assert.deepEqual(files2, files, 'same file set');
    for (const f of files) {
      assert.ok(readFileSync(path.join(dist1, f)).equals(readFileSync(path.join(dist2, f))), `${f} is byte-identical`);
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(dist1, { recursive: true, force: true });
    rmSync(dist2, { recursive: true, force: true });
  }
});
