// Tests for lib/derived-artifact-guard.mjs — the guard that makes the
// "workers never rebuild dashboard/dist/" contract structural
// (agentic-workflow-q7v3k, ADR-0057). It filters the conductor's checkpoint
// `git add` list, not the working tree: a derived artifact that is never
// staged can never reach the squash-merge, so a worktree rebuild is
// rendered inert rather than forbidden.
//
// Highest-priority trap (named in the task): `FILE_LIST` entries are
// ABSOLUTE, OS-native-separator paths (references/worker-return-format.md
// line 17), never POSIX-relative literals. Every fixture below is built with
// `path.join(worktreeRoot, ...)` for exactly this reason — a guard or test
// written against a hardcoded `'dashboard/dist/app.js'` string would pass
// its own test while being inert against every real input.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  DERIVED_ARTIFACT_PREFIXES,
  BOOKKEEPING_PATH_PREFIXES,
  partitionCheckpointFiles,
} from '../derived-artifact-guard.mjs';

const WORKTREE_ROOT =
  process.platform === 'win32' ? 'C:\\src\\repo\\.worktrees\\agentic-workflow-q7v3k' : '/src/repo/.worktrees/agentic-workflow-q7v3k';

test('DERIVED_ARTIFACT_PREFIXES is frozen and starts with dashboard/dist/', () => {
  assert.equal(Object.isFrozen(DERIVED_ARTIFACT_PREFIXES), true);
  assert.deepEqual([...DERIVED_ARTIFACT_PREFIXES], ['dashboard/dist/']);
});

test('partitionCheckpointFiles keeps an ordinary source file as changed', () => {
  const sourceFile = path.join(WORKTREE_ROOT, 'lib', 'derived-artifact-guard.mjs');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [sourceFile]);
  assert.deepEqual(changed, [sourceFile]);
  assert.deepEqual(refused, []);
});

test('partitionCheckpointFiles refuses a derived dashboard/dist/ file built as an absolute, OS-native path', () => {
  // Built with path.join, per the task's named trap — not a POSIX-relative literal.
  const bundleFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', 'app.js');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [bundleFile]);
  assert.deepEqual(changed, []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].path, bundleFile);
  assert.equal(refused[0].reason, 'derived-artifact');
});

test('partitionCheckpointFiles refuses a NESTED derived path (dashboard/dist/fonts/x.woff2)', () => {
  const fontFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', 'fonts', 'x.woff2');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [fontFile]);
  assert.deepEqual(changed, []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].reason, 'derived-artifact');
});

test('partitionCheckpointFiles refuses dashboard/dist/.build-stamp.json (infrastructure-w45ce staleness stamp) — same derived-artifact reason as the bundle, no special-casing needed', () => {
  const stampFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', '.build-stamp.json');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [stampFile]);
  assert.deepEqual(changed, []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].path, stampFile);
  assert.equal(refused[0].reason, 'derived-artifact');
});

test('partitionCheckpointFiles does NOT refuse dashboard/dist-notes.md — segment-boundary matching, never includes("dist")', () => {
  const notesFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist-notes.md');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [notesFile]);
  assert.deepEqual(changed, [notesFile]);
  assert.deepEqual(refused, []);
});

test('partitionCheckpointFiles refuses a path resolving outside the worktree with a distinct outside-worktree reason', () => {
  const outsideFile =
    process.platform === 'win32' ? 'C:\\src\\repo\\some-other-tree\\file.mjs' : '/src/repo/some-other-tree/file.mjs';
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [outsideFile]);
  assert.deepEqual(changed, []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].path, outsideFile);
  assert.equal(refused[0].reason, 'outside-worktree');
});

test('partitionCheckpointFiles partitions a mixed FILE_LIST correctly, preserving order within each bucket', () => {
  const sourceFile = path.join(WORKTREE_ROOT, 'skills', 'work', 'SKILL.md');
  const bundleFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', 'app.js');
  const readmeFile = path.join(WORKTREE_ROOT, '.agentheim', 'contexts', 'agentic-workflow', 'README.md');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [sourceFile, bundleFile, readmeFile]);
  // Post-ghcaj: a worker's worktree never carries a `.agentheim/` write — the
  // README path is refused as `bookkeeping-path`, not staged.
  assert.deepEqual(changed, [sourceFile]);
  assert.equal(refused.length, 2);
  assert.equal(refused[0].path, bundleFile);
  assert.equal(refused[0].reason, 'derived-artifact');
  assert.equal(refused[1].path, readmeFile);
  assert.equal(refused[1].reason, 'bookkeeping-path');
});

test('BOOKKEEPING_PATH_PREFIXES is frozen and names .agentheim/', () => {
  assert.equal(Object.isFrozen(BOOKKEEPING_PATH_PREFIXES), true);
  assert.deepEqual([...BOOKKEEPING_PATH_PREFIXES], ['.agentheim/']);
});

test('partitionCheckpointFiles refuses every absolute, OS-native path under <worktreeRoot>/.agentheim/ with reason bookkeeping-path', () => {
  const readmeFile = path.join(WORKTREE_ROOT, '.agentheim', 'contexts', 'agentic-workflow', 'README.md');
  const adrFile = path.join(WORKTREE_ROOT, '.agentheim', 'knowledge', 'decisions', '0099-example.md');
  const taskFile = path.join(WORKTREE_ROOT, '.agentheim', 'contexts', 'agentic-workflow', 'done', 'agentic-workflow-ghcaj-x.md');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [readmeFile, adrFile, taskFile]);
  assert.deepEqual(changed, []);
  assert.equal(refused.length, 3);
  for (const entry of refused) assert.equal(entry.reason, 'bookkeeping-path');
});

test('partitionCheckpointFiles does NOT refuse a root-level .agentheim-notes.md — segment-boundary matching, never a bare prefix match', () => {
  const notesFile = path.join(WORKTREE_ROOT, '.agentheim-notes.md');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [notesFile]);
  assert.deepEqual(changed, [notesFile]);
  assert.deepEqual(refused, []);
});

test('partitionCheckpointFiles still refuses dashboard/dist/ as derived-artifact and still passes ordinary source/test paths, alongside the new bookkeeping-path guard', () => {
  const bundleFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', 'app.js');
  const sourceFile = path.join(WORKTREE_ROOT, 'lib', 'readme-delta.mjs');
  const testFile = path.join(WORKTREE_ROOT, 'lib', 'test', 'readme-delta.test.mjs');
  const bookkeepingFile = path.join(WORKTREE_ROOT, '.agentheim', 'contexts', 'agentic-workflow', 'README.md');
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, [bundleFile, sourceFile, testFile, bookkeepingFile]);
  assert.deepEqual(changed, [sourceFile, testFile]);
  assert.equal(refused.length, 2);
  assert.equal(refused[0].reason, 'derived-artifact');
  assert.equal(refused[1].reason, 'bookkeeping-path');
});

test('partitionCheckpointFiles operates on the declared list only — it never touches the filesystem (no git status/diff needed, structurally immune to the autocrlf dist/app.js phantom-modification)', () => {
  // The bundle path below need not exist on disk at all; the guard must still
  // classify it correctly from the string shape alone.
  const bundleFile = path.join(WORKTREE_ROOT, 'dashboard', 'dist', 'app.js');
  const { refused } = partitionCheckpointFiles(WORKTREE_ROOT, [bundleFile]);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].reason, 'derived-artifact');
});

test('an empty FILE_LIST partitions to two empty arrays', () => {
  const { changed, refused } = partitionCheckpointFiles(WORKTREE_ROOT, []);
  assert.deepEqual(changed, []);
  assert.deepEqual(refused, []);
});
