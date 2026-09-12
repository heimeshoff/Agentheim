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
import { mkdtempSync, mkdirSync, cpSync, readFileSync, existsSync, rmSync } from 'node:fs';
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
