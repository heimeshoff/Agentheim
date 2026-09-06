// Unit tests for `lib/scoped-commit.mjs` (agentic-workflow-pt0gy).
//
// Same BOUNDED EXCEPTION shape as `lib/test/git-facts-merge-conflict.test.mjs`:
// these tests shell out to real `git` against a THROWAWAY repo created fresh
// per test with `fs.mkdtempSync(path.join(os.tmpdir(), ...))`. `lib/scoped-
// commit.mjs` itself is the one module in this task allowed to shell out to
// git (it's the git-aware layer 3, not the git-free lifecycle CLI) — this
// test file additionally exercises it, and only ever against a tmpdir it
// created itself, never this project's own repo. `test.skip`s the whole file
// when `git --version` fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runScopedCommit } from '../scoped-commit.mjs';

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

function makeRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aw-scoped-commit-'));
  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-B', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

function writeAndCommit(dir, relPath, content, message) {
  const abs = path.join(dir, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  git(dir, ['add', relPath]);
  git(dir, ['commit', '-q', '-m', message]);
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function lockPath(dir) {
  return path.join(dir, '.git', 'index.lock');
}

const FAST_RETRY = { maxAttempts: 5, initialDelayMs: 5, maxDelayMs: 20 };

test('runScopedCommit refuses "-A"', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    const res = await runScopedCommit(dir, ['-A'], 'chore: nope');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'invalid-path');
    assert.equal(res.attempts, 0);
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit refuses "."', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    const res = await runScopedCommit(dir, ['.'], 'chore: nope');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'invalid-path');
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit refuses a glob-looking path', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    const res = await runScopedCommit(dir, ['contexts/*/INDEX.md'], 'chore: nope');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'invalid-path');
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit requires a non-empty message', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    const res = await runScopedCommit(dir, ['a.md'], '');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'invalid-message');
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit stages exactly the given paths and commits with the given message', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    writeAndCommit(dir, 'seed.md', 'seed\n', 'chore: seed');
    writeFileSync(path.join(dir, 'a.md'), 'a content\n');
    writeFileSync(path.join(dir, 'b.md'), 'b content\n'); // deliberately NOT in the paths list
    const res = await runScopedCommit(dir, ['a.md'], 'chore: add a.md');
    assert.equal(res.ok, true);
    assert.equal(res.attempts, 2); // one add + one commit, each succeeding first try
    assert.ok(res.sha);
    const log = git(dir, ['log', '-1', '--pretty=%s']);
    assert.equal(log.trim(), 'chore: add a.md');
    const status = git(dir, ['status', '--porcelain']);
    // a.md is committed (not in porcelain output); b.md is still untracked.
    assert.doesNotMatch(status, /a\.md/);
    assert.match(status, /\?\? b\.md/);
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit: a pre-created index.lock removed by a timer resolves {ok:true, attempts > 1}', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    writeFileSync(path.join(dir, 'a.md'), 'a content\n');
    writeFileSync(lockPath(dir), ''); // simulate a sibling git process holding the lock
    const timer = setTimeout(() => {
      try {
        rmSync(lockPath(dir), { force: true });
      } catch {
        // already gone -- fine
      }
    }, 60);
    const res = await runScopedCommit(dir, ['a.md'], 'chore: add a.md', FAST_RETRY);
    clearTimeout(timer);
    assert.equal(res.ok, true);
    assert.ok(res.attempts > 1, `expected attempts > 1, got ${res.attempts}`);
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit: an index.lock that is never removed exhausts retries, {ok:false, code:"git-index-lock-exhausted", attempts: 6} at the default backoff, and the lock file is left untouched', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    writeFileSync(path.join(dir, 'a.md'), 'a content\n');
    writeFileSync(lockPath(dir), 'never removed');
    // Uses the DEFAULT backoff (50ms -> 800ms cap, 6 attempts) to pin the
    // documented attempts:6 contract exactly; ~2.4s worst-case sleep is
    // acceptable for one test.
    const res = await runScopedCommit(dir, ['a.md'], 'chore: add a.md');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'git-index-lock-exhausted');
    assert.equal(res.attempts, 6);
    // NEVER deletes index.lock itself -- a live sibling may still hold it.
    assert.equal(existsSync(lockPath(dir)), true);
    assert.equal(readFileSync(lockPath(dir), 'utf8'), 'never removed');
  } finally {
    cleanup(dir);
  }
});

test('runScopedCommit surfaces a genuine git failure (nothing to commit) as code:"git-failed", not lock contention', { skip: !GIT_AVAILABLE }, async () => {
  const dir = makeRepo();
  try {
    writeAndCommit(dir, 'a.md', 'a content\n', 'chore: seed a.md');
    // No changes to a.md since the seed commit -- `git commit` will exit
    // non-zero with "nothing to commit", not an index.lock message.
    const res = await runScopedCommit(dir, ['a.md'], 'chore: no-op', FAST_RETRY);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'git-failed');
    // 1 successful `add` attempt + 1 failing `commit` attempt (git-failed is
    // never retried -- it's a real failure, not lock contention).
    assert.equal(res.attempts, 2);
  } finally {
    cleanup(dir);
  }
});
