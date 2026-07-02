import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  taskTouchesDashboard,
  linkDashboardNodeModules,
  unlinkDashboardNodeModules,
} from '../worktree-node-modules.mjs';

/** Spin up a throwaway "main root" with a populated dashboard/node_modules. */
function makeMainRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-f6m2q-main-'));
  const nm = path.join(root, 'dashboard', 'node_modules');
  mkdirSync(nm, { recursive: true });
  writeFileSync(path.join(nm, 'marker.txt'), 'real-node-modules-contents');
  return root;
}

/** Spin up a throwaway "worktree root" with an empty dashboard/ dir (no node_modules yet). */
function makeWorktreeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-f6m2q-wt-'));
  mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  return root;
}

function cleanup(...roots) {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
}

// ---- taskTouchesDashboard ----

test('taskTouchesDashboard: true when a FILE_LIST path has a dashboard/ directory segment (posix)', () => {
  assert.equal(taskTouchesDashboard(['/repo/dashboard/app/board.js']), true);
});

test('taskTouchesDashboard: true for a Windows backslash-separated path', () => {
  assert.equal(taskTouchesDashboard(['C:\\repo\\dashboard\\build.mjs']), true);
});

test('taskTouchesDashboard: false when "dashboard" is only the FILENAME, not a directory', () => {
  assert.equal(taskTouchesDashboard(['/repo/commands/dashboard.md']), false);
});

test('taskTouchesDashboard: false for an empty or non-array FILE_LIST', () => {
  assert.equal(taskTouchesDashboard([]), false);
  assert.equal(taskTouchesDashboard(undefined), false);
  assert.equal(taskTouchesDashboard(null), false);
});

test('taskTouchesDashboard: true if ANY entry in a multi-file list touches dashboard/', () => {
  assert.equal(
    taskTouchesDashboard(['/repo/lib/task-lifecycle.mjs', '/repo/dashboard/app/board.js']),
    true,
  );
});

// ---- linkDashboardNodeModules / unlinkDashboardNodeModules ----

test('linkDashboardNodeModules: links, and a file is readable THROUGH the link with identical contents', () => {
  const mainRoot = makeMainRoot();
  const wtRoot = makeWorktreeRoot();
  try {
    const res = linkDashboardNodeModules(wtRoot, mainRoot);
    assert.equal(res.linked, true);
    const linkPath = path.join(wtRoot, 'dashboard', 'node_modules');
    assert.equal(existsSync(linkPath), true);
    const viaLink = readFileSync(path.join(linkPath, 'marker.txt'), 'utf8');
    assert.equal(viaLink, 'real-node-modules-contents');
  } finally {
    cleanup(mainRoot, wtRoot);
  }
});

test('linkDashboardNodeModules: is idempotent — a second call reports already-linked, does not throw', () => {
  const mainRoot = makeMainRoot();
  const wtRoot = makeWorktreeRoot();
  try {
    linkDashboardNodeModules(wtRoot, mainRoot);
    const second = linkDashboardNodeModules(wtRoot, mainRoot);
    assert.equal(second.linked, false);
    assert.equal(second.reason, 'already-linked');
  } finally {
    cleanup(mainRoot, wtRoot);
  }
});

test('linkDashboardNodeModules: degrades to linked:false when the main tree has no dashboard/node_modules', () => {
  const mainRoot = mkdtempSync(path.join(tmpdir(), 'aw-f6m2q-main-empty-'));
  const wtRoot = makeWorktreeRoot();
  try {
    const res = linkDashboardNodeModules(wtRoot, mainRoot);
    assert.equal(res.linked, false);
    assert.equal(res.reason, 'main-node-modules-missing');
  } finally {
    cleanup(mainRoot, wtRoot);
  }
});

test('unlinkDashboardNodeModules: removes the link and leaves the MAIN node_modules contents fully intact', () => {
  const mainRoot = makeMainRoot();
  const wtRoot = makeWorktreeRoot();
  try {
    linkDashboardNodeModules(wtRoot, mainRoot);
    const res = unlinkDashboardNodeModules(wtRoot);
    assert.equal(res.unlinked, true);
    const linkPath = path.join(wtRoot, 'dashboard', 'node_modules');
    assert.equal(existsSync(linkPath), false);
    // The load-bearing assertion: the REAL target's contents survive unlinking.
    const stillThere = readFileSync(path.join(mainRoot, 'dashboard', 'node_modules', 'marker.txt'), 'utf8');
    assert.equal(stillThere, 'real-node-modules-contents');
  } finally {
    cleanup(mainRoot, wtRoot);
  }
});

test('unlinkDashboardNodeModules: no-op (unlinked:false) when nothing is linked', () => {
  const wtRoot = makeWorktreeRoot();
  try {
    const res = unlinkDashboardNodeModules(wtRoot);
    assert.equal(res.unlinked, false);
    assert.equal(res.reason, 'not-present');
  } finally {
    cleanup(wtRoot);
  }
});

test('unlinkDashboardNodeModules: REFUSES to touch a real directory that is not a link — safety guard', () => {
  // This is the spike-confirmed danger: `git worktree remove --force` recurses
  // through an un-removed junction and deletes the REAL target's contents. The
  // helper must never itself delete a real (non-symlink) node_modules directory.
  const wtRoot = makeWorktreeRoot();
  const realNodeModules = path.join(wtRoot, 'dashboard', 'node_modules');
  mkdirSync(realNodeModules, { recursive: true });
  writeFileSync(path.join(realNodeModules, 'real-marker.txt'), 'do-not-delete-me');
  try {
    const res = unlinkDashboardNodeModules(wtRoot);
    assert.equal(res.unlinked, false);
    assert.equal(res.reason, 'not-a-link-refusing-to-touch');
    // The real directory and its contents must be untouched.
    const contents = readFileSync(path.join(realNodeModules, 'real-marker.txt'), 'utf8');
    assert.equal(contents, 'do-not-delete-me');
  } finally {
    cleanup(wtRoot);
  }
});
