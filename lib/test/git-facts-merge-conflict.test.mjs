// Git-fact fixture for the merge-back conflict ladder (ADR-0072, agentic-workflow-pcwnn).
//
// BOUNDED EXCEPTION to "lib is git-free" (ADR-0038): these tests pin real environment facts
// about how `git merge`/`git merge --squash`/`git merge --abort` behave, by running actual
// `git` against a THROWAWAY repo created fresh per test with `fs.mkdtempSync(path.join(
// os.tmpdir(), ...))`. Runtime `lib/` code (`merge-conflict-ladder.mjs`, `worktree-salvage.mjs`)
// stays git-free — only this test file shells out to git, and only inside a tmpdir it created
// itself. NEVER a path derived from an env var (a prior refinement spike's temp path came from
// an unset env var, fell through, and briefly ran against the live repo — see the task's
// Notes) and NEVER this project's own repo.
//
// `test.skip`s the whole file when `git --version` fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const GIT_AVAILABLE = gitAvailable();

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** Run a git command, never throwing — returns {code, stdout, stderr}. */
function gitTry(cwd, args) {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

/** A fresh throwaway repo under os.tmpdir() — never an env-derived path, never the real repo. */
function makeRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aw-merge-ladder-'));
  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-B', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'core.autocrlf', 'false']); // keep LF byte-exact for the diff/content assertions below
  return dir;
}

function writeAndCommit(dir, relPath, content, message) {
  const abs = path.join(dir, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  git(dir, ['add', relPath]);
  git(dir, ['commit', '-q', '-m', message]);
}

function readTracked(dir, relPath) {
  return readFileSync(path.join(dir, relPath), 'utf8');
}

const TEN_LINES = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n') + '\n';

function withLine(content, lineNumber, replacement) {
  const lines = content.split('\n');
  lines[lineNumber - 1] = replacement;
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------
// (a) two branches editing disjoint hunks of one file squash-merge cleanly in both orders
// ---------------------------------------------------------------------------------------

test('(a) disjoint-hunk edits squash-merge cleanly regardless of merge order', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  function setup() {
    const dir = makeRepo();
    writeAndCommit(dir, 'file.txt', TEN_LINES, 'base');
    git(dir, ['checkout', '-q', '-b', 'branchA']);
    writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 2, 'lineA-modified'), 'A edits line 2');
    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['checkout', '-q', '-b', 'branchB']);
    writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 9, 'lineB-modified'), 'B edits line 9');
    git(dir, ['checkout', '-q', 'main']);
    return dir;
  }

  // Order 1: A then B
  {
    const dir = setup();
    const squashA = gitTry(dir, ['merge', '--squash', 'branchA']);
    assert.equal(squashA.code, 0, `squash A should be clean: ${squashA.stderr}`);
    git(dir, ['commit', '-q', '-m', 'squash A']);
    const squashB = gitTry(dir, ['merge', '--squash', 'branchB']);
    assert.equal(squashB.code, 0, `squash B (after A) should be clean: ${squashB.stderr}`);
    git(dir, ['commit', '-q', '-m', 'squash B']);
    const final = readTracked(dir, 'file.txt');
    assert.match(final, /lineA-modified/);
    assert.match(final, /lineB-modified/);
    rmSync(dir, { recursive: true, force: true });
  }

  // Order 2: B then A
  {
    const dir = setup();
    const squashB = gitTry(dir, ['merge', '--squash', 'branchB']);
    assert.equal(squashB.code, 0, `squash B should be clean: ${squashB.stderr}`);
    git(dir, ['commit', '-q', '-m', 'squash B']);
    const squashA = gitTry(dir, ['merge', '--squash', 'branchA']);
    assert.equal(squashA.code, 0, `squash A (after B) should be clean: ${squashA.stderr}`);
    git(dir, ['commit', '-q', '-m', 'squash A']);
    const final = readTracked(dir, 'file.txt');
    assert.match(final, /lineA-modified/);
    assert.match(final, /lineB-modified/);
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------
// (b) + (c) squash conflict on main → git reset --hard HEAD (never merge --abort, which
// errors on a squash); the loser's worktree merging main conflicts on the same U path set,
// and merge --abort DOES work there.
// ---------------------------------------------------------------------------------------

test('(b)+(c) squash conflict aborts via reset --hard on main; worktree merge conflicts on the same U path set and merge --abort succeeds there', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  const dir = makeRepo();
  writeAndCommit(dir, 'file.txt', TEN_LINES, 'base');
  git(dir, ['checkout', '-q', '-b', 'branchA']);
  writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 2, 'A-version'), 'A edits line 2');
  git(dir, ['checkout', '-q', 'main']);
  git(dir, ['checkout', '-q', '-b', 'branchB']);
  writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 2, 'B-version'), 'B edits line 2 too (conflict)');
  git(dir, ['checkout', '-q', 'main']);

  // branchA squash-merges cleanly first.
  const squashA = gitTry(dir, ['merge', '--squash', 'branchA']);
  assert.equal(squashA.code, 0, `squash A should be clean: ${squashA.stderr}`);
  git(dir, ['commit', '-q', '-m', 'squash A']);

  // branchB's squash now conflicts on the same line.
  const squashB = gitTry(dir, ['merge', '--squash', 'branchB']);
  assert.notEqual(squashB.code, 0, 'squash B should conflict');
  const mainConflictedPaths = git(dir, ['diff', '--name-only', '--diff-filter=U']).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(mainConflictedPaths, ['file.txt']);

  // (c), main half: `git merge --abort` errors on a squash-merge conflict — no MERGE_HEAD.
  const abortOnMain = gitTry(dir, ['merge', '--abort']);
  assert.notEqual(abortOnMain.code, 0, 'merge --abort should error on a squash-merge conflict');

  // (b), rung 1: reset --hard HEAD is the real abort for the squash on main.
  const reset = gitTry(dir, ['reset', '--hard', 'HEAD']);
  assert.equal(reset.code, 0);
  assert.equal(gitTry(dir, ['status', '--porcelain']).stdout, '');

  // Now the loser's worktree: a real `git merge main` (not a squash) inside branchB's own tree.
  const worktreeDir = `${dir}-worktree`;
  git(dir, ['worktree', 'add', worktreeDir, 'branchB']);
  git(worktreeDir, ['config', 'user.email', 'test@example.com']);
  git(worktreeDir, ['config', 'user.name', 'Test']);
  git(worktreeDir, ['config', 'commit.gpgsign', 'false']);

  const worktreeMerge = gitTry(worktreeDir, ['merge', 'main']);
  assert.notEqual(worktreeMerge.code, 0, 'git merge main should conflict in the worktree');
  const worktreeConflictedPaths = git(worktreeDir, ['diff', '--name-only', '--diff-filter=U'])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  assert.deepEqual(worktreeConflictedPaths, mainConflictedPaths, 'the worktree merge conflicts on the same U path set as the squash did');

  // (c), worktree half: `git merge --abort` DOES succeed here — the opposite of main's squash.
  const abortInWorktree = gitTry(worktreeDir, ['merge', '--abort']);
  assert.equal(abortInWorktree.code, 0, `merge --abort should succeed in the worktree: ${abortInWorktree.stderr}`);
  assert.equal(gitTry(worktreeDir, ['status', '--porcelain']).stdout, '');

  git(dir, ['worktree', 'remove', worktreeDir, '--force']);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// (d) after resolving and committing the merge on the branch, `git diff main HEAD` equals
// the tree the subsequent `git merge --squash` stages; that squash is clean; main ends up
// with both changes.
// ---------------------------------------------------------------------------------------

test('(d) resolved worktree-merge diff equals what the subsequent squash stages; squash is clean; main gets both changes', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  const dir = makeRepo();
  writeAndCommit(dir, 'file.txt', TEN_LINES, 'base');
  git(dir, ['checkout', '-q', '-b', 'branchA']);
  writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 2, 'A-version'), 'A edits line 2');
  git(dir, ['checkout', '-q', 'main']);
  git(dir, ['checkout', '-q', '-b', 'branchB']);
  writeAndCommit(dir, 'file.txt', withLine(TEN_LINES, 2, 'B-version'), 'B edits line 2 too (conflict)');
  git(dir, ['checkout', '-q', 'main']);

  git(dir, ['merge', '--squash', 'branchA']);
  git(dir, ['commit', '-q', '-m', 'squash A']);
  const squashBConflict = gitTry(dir, ['merge', '--squash', 'branchB']);
  assert.notEqual(squashBConflict.code, 0);
  git(dir, ['reset', '--hard', 'HEAD']);

  const worktreeDir = `${dir}-worktree`;
  git(dir, ['worktree', 'add', worktreeDir, 'branchB']);
  git(worktreeDir, ['config', 'user.email', 'test@example.com']);
  git(worktreeDir, ['config', 'user.name', 'Test']);
  git(worktreeDir, ['config', 'commit.gpgsign', 'false']);

  const merge = gitTry(worktreeDir, ['merge', 'main']);
  assert.notEqual(merge.code, 0);

  // Resolve: combine both intents on line 2.
  const resolved = withLine(TEN_LINES, 2, 'A-and-B-resolved');
  writeFileSync(path.join(worktreeDir, 'file.txt'), resolved, 'utf8');
  git(worktreeDir, ['add', 'file.txt']);
  git(worktreeDir, ['commit', '-q', '-m', 'resolve merge conflict (merge main)']);

  // Rung 6: two-dot diff, byte-equal to what the squash will stage.
  const preSquashDiff = git(worktreeDir, ['diff', 'main', 'HEAD']);
  assert.match(preSquashDiff, /A-and-B-resolved/);

  const squash = gitTry(dir, ['merge', '--squash', 'branchB']);
  assert.equal(squash.code, 0, `squash after resolution should be clean: ${squash.stderr}`);
  const stagedDiff = git(dir, ['diff', '--cached']);
  assert.equal(stagedDiff, preSquashDiff, 'the two-dot diff captured pre-squash is byte-equal to what the squash stages');

  git(dir, ['commit', '-q', '-m', 'squash B (merge main)']);
  const finalContent = readTracked(dir, 'file.txt');
  assert.match(finalContent, /A-and-B-resolved/, 'main contains both changes (the resolved line)');

  git(dir, ['worktree', 'remove', worktreeDir, '--force']);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// (e) + (f) a dirty tracked file that main also changed makes `git merge main` refuse; a
// `git checkout -- <path>` first lets it proceed. An untracked gitignored directory (the
// node_modules-link shape) is untouched throughout.
// ---------------------------------------------------------------------------------------

test('(e)+(f) a dirty tracked file blocks the merge until checked out; an untracked gitignored dir is untouched', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  const dir = makeRepo();
  const THREE_LINES = 'line1\nline2\nline3\n';
  writeAndCommit(dir, '.gitignore', 'node_modules/\n', 'gitignore');
  writeAndCommit(dir, 'dirty.txt', THREE_LINES, 'base');

  git(dir, ['checkout', '-q', '-b', 'branchA']);
  writeAndCommit(dir, 'dirty.txt', withLine(THREE_LINES, 1, 'branchA-line1'), 'A edits line 1');
  git(dir, ['checkout', '-q', 'main']);
  // main also changes the SAME FILE (a different line) after the branch point.
  writeAndCommit(dir, 'dirty.txt', withLine(THREE_LINES, 3, 'main-line3'), 'main edits line 3');

  const worktreeDir = `${dir}-worktree`;
  git(dir, ['worktree', 'add', worktreeDir, 'branchA']);
  git(worktreeDir, ['config', 'user.email', 'test@example.com']);
  git(worktreeDir, ['config', 'user.name', 'Test']);
  git(worktreeDir, ['config', 'commit.gpgsign', 'false']);

  // (f) setup: an untracked, gitignored directory inside the worktree — the shape of the
  // dashboard/node_modules junction (ADR-0032).
  const nodeModulesDir = path.join(worktreeDir, 'node_modules');
  mkdirSync(nodeModulesDir, { recursive: true });
  const sentinelFile = path.join(nodeModulesDir, 'sentinel.txt');
  writeFileSync(sentinelFile, 'do-not-touch', 'utf8');

  // (e): make the tracked file dirty (uncommitted) in the worktree.
  writeFileSync(path.join(worktreeDir, 'dirty.txt'), withLine(THREE_LINES, 1, 'WORKTREE-UNCOMMITTED-EDIT'), 'utf8');

  const mergeWhileDirty = gitTry(worktreeDir, ['merge', 'main']);
  assert.notEqual(mergeWhileDirty.code, 0, 'merge should refuse while dirty.txt has uncommitted local changes');
  assert.match(mergeWhileDirty.stderr + mergeWhileDirty.stdout, /local changes|overwritten/i);

  // (f) assertion, mid-way: the refusal did not touch the untracked ignored dir.
  assert.ok(existsSync(sentinelFile));
  assert.equal(readFileSync(sentinelFile, 'utf8'), 'do-not-touch');

  // Rung 2: git checkout -- <path> discards the dirty tracked file first.
  const checkout = gitTry(worktreeDir, ['checkout', '--', 'dirty.txt']);
  assert.equal(checkout.code, 0);
  assert.equal(readTracked(worktreeDir, 'dirty.txt'), withLine(THREE_LINES, 1, 'branchA-line1'));

  // Now the merge can proceed — disjoint hunks (line1 vs line3), so it merges cleanly.
  const mergeAfterCheckout = gitTry(worktreeDir, ['merge', 'main']);
  assert.equal(mergeAfterCheckout.code, 0, `merge should proceed after checkout: ${mergeAfterCheckout.stderr}`);
  const merged = readTracked(worktreeDir, 'dirty.txt');
  assert.match(merged, /branchA-line1/);
  assert.match(merged, /main-line3/);

  // (f) final assertion: still untouched by the checkout AND the merge.
  assert.ok(existsSync(sentinelFile));
  assert.equal(readFileSync(sentinelFile, 'utf8'), 'do-not-touch');

  git(dir, ['worktree', 'remove', worktreeDir, '--force']);
  rmSync(dir, { recursive: true, force: true });
});
