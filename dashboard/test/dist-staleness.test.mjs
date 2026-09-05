// Dist staleness check (infrastructure-w45ce).
//
// "A release ships a fresh dashboard" (ADR-0013 amendment) must hold by
// construction: this suite must be able to catch a committed `dashboard/dist/`
// that lags its declared inputs. That is exactly the invariant
// `dist-build.test.mjs` cannot verify, by design (ADR-0057 alternative (a)):
// its `before()` hook rebuilds `dist/` on every run, so any assertion made
// against the real `dashboard/dist/` inside that same suite run would always
// read fresh — the assertion could never fail on its own named criterion.
//
// This file breaks that trap two ways, both load-bearing:
//   1. `dist-build.test.mjs`'s `before()` hook (this task) now rebuilds into a
//      throwaway scratch directory, never `dashboard/dist/` itself — so the
//      committed `dashboard/dist/` is never touched by ANY test in this suite,
//      including this one. The freshness check below reads the real, honest,
//      on-disk state.
//   2. The Red-test proof of "this check CAN fail, and names the rebuild
//      command" is done against a synthetic, isolated scratch directory (never
//      the real committed dist/) so proving redness never requires corrupting
//      the tree this suite's other assertions depend on.
//
// Interplay with the ADR-0057 structural guard: a worker who edits
// `dashboard/app/` (or the styleguide source, or `dashboard/assets/`) without
// rebuilding is NOT blocked by this check — ADR-0057's checkpoint guard still
// drops any worktree rebuild of `dashboard/dist/` before it can reach `main`
// (that contract is unchanged, see lib/derived-artifact-guard.mjs). Instead,
// this check goes red ON MAIN once the merge lands, and stays red until a
// builder runs the real rebuild (`cd dashboard && npm run build`) and commits
// the result — the RELEASE.md step this task adds. The two guards are
// complementary: ADR-0057 stops an untrusted rebuild from reaching `main`;
// this check makes a stale `main` visibly red instead of silently stale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';

import { checkDistFreshness, writeBuildStamp, REBUILD_COMMAND } from '../build-stamp.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DASHBOARD, '..');
const DIST = path.join(DASHBOARD, 'dist');

test('REBUILD_COMMAND names the exact rebuild command', () => {
  assert.equal(REBUILD_COMMAND, 'cd dashboard && npm run build');
});

test('committed dashboard/dist/ matches current declared sources (run the rebuild command if this fails)', () => {
  const result = checkDistFreshness({ dashboardDir: DASHBOARD, repoRoot: REPO_ROOT, distDir: DIST });
  assert.ok(result.fresh, result.message);
});

test('checkDistFreshness fails, naming the rebuild command, when the stamp is ABSENT', () => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'agentheim-dist-staleness-absent-'));
  try {
    const result = checkDistFreshness({ dashboardDir: DASHBOARD, repoRoot: REPO_ROOT, distDir: scratch });
    assert.equal(result.fresh, false);
    assert.ok(result.message.includes(REBUILD_COMMAND), 'failure message must name the rebuild command');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkDistFreshness fails, naming the rebuild command, when the stamp is STALE', () => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'agentheim-dist-staleness-stale-'));
  try {
    writeFileSync(
      path.join(scratch, '.build-stamp.json'),
      JSON.stringify({ hash: 'deadbeef', algorithm: 'sha256' }, null, 2) + '\n',
      'utf8',
    );
    const result = checkDistFreshness({ dashboardDir: DASHBOARD, repoRoot: REPO_ROOT, distDir: scratch });
    assert.equal(result.fresh, false);
    assert.ok(result.message.includes(REBUILD_COMMAND), 'failure message must name the rebuild command');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkDistFreshness passes once the stamp matches current sources (mirrors a real rebuild)', () => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'agentheim-dist-staleness-fresh-'));
  try {
    writeBuildStamp({ dashboardDir: DASHBOARD, repoRoot: REPO_ROOT, outDir: scratch });
    const result = checkDistFreshness({ dashboardDir: DASHBOARD, repoRoot: REPO_ROOT, distDir: scratch });
    assert.ok(result.fresh, result.message);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
