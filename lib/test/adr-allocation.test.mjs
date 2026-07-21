// Tests for lib/adr-allocation.mjs — collision-proof ADR number allocation
// (ADR-0058, agentic-workflow-hmgav): a provisional mint helper used inside a
// worker's own worktree, and a finalize step run by the conductor against
// `main`'s true state at squash-merge integration time, before the commit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { nextAdrNumber, finalizeAdrNumbering } from '../adr-allocation.mjs';

function makeTmpDecisionsDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-allocation-test-'));
  return dir;
}

function writeAdr(decisionsDir, number, slug, { idPrefix = 'ADR-' } = {}) {
  const filename = `${number}-${slug}.md`;
  const content =
    `---\n` +
    `id: ${idPrefix}${number}\n` +
    `title: ${slug}\n` +
    `scope: agentic-workflow\n` +
    `status: accepted\n` +
    `date: 2026-07-21\n` +
    `related_tasks: []\n` +
    `related_adrs: []\n` +
    `---\n\n` +
    `# ADR-${number}: ${slug}\n\n` +
    `## Context\n\nsome context.\n`;
  fs.writeFileSync(path.join(decisionsDir, filename), content);
  return filename;
}

// --- nextAdrNumber ------------------------------------------------------

test('nextAdrNumber: empty decisions dir mints 0001', () => {
  const dir = makeTmpDecisionsDir();
  assert.equal(nextAdrNumber(dir), '0001');
});

test('nextAdrNumber: returns max + 1, zero-padded to 4 digits', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0001', 'first-decision');
  writeAdr(dir, '0057', 'derived-artifacts-unstageable');
  assert.equal(nextAdrNumber(dir), '0058');
});

test('nextAdrNumber: non-existent decisions dir mints 0001 (loss-tolerant)', () => {
  const dir = path.join(os.tmpdir(), 'adr-allocation-does-not-exist-' + Date.now());
  assert.equal(nextAdrNumber(dir), '0001');
});

// --- finalizeAdrNumbering: no-op when the provisional number is already correct ---

test('finalizeAdrNumbering: provisional number already the true next-free -> no rename', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0057', 'existing-decision');
  const provisional = writeAdr(dir, '0058', 'my-new-decision');

  const result = finalizeAdrNumbering(dir, [provisional]);

  assert.deepEqual(result.renumbered, []);
  assert.deepEqual(result.changed, []);
  assert.ok(fs.existsSync(path.join(dir, provisional)));
});

// --- finalizeAdrNumbering: collision — a sibling task already committed the same number ---

test('finalizeAdrNumbering: collision with an already-landed ADR renumbers to the true next-free', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0057', 'existing-decision');
  // Sibling task A already landed ADR-0058 on main (its own finalize already ran).
  writeAdr(dir, '0058', 'sibling-task-a-decision');
  // Task B's worker also guessed 0058 in its own worktree — a real filename
  // collision on the *number*, not on the full filename, so a squash-merge
  // would not flag it.
  const provisionalB = writeAdr(dir, '0058', 'task-b-decision');

  const result = finalizeAdrNumbering(dir, [provisionalB]);

  assert.equal(result.renumbered.length, 1);
  assert.equal(result.renumbered[0].from, 'ADR-0058');
  assert.equal(result.renumbered[0].to, 'ADR-0059');
  assert.equal(result.renumbered[0].newFilename, '0059-task-b-decision.md');

  // Old provisional path gone, new final path exists.
  assert.ok(!fs.existsSync(path.join(dir, '0058-task-b-decision.md')));
  const newPath = path.join(dir, '0059-task-b-decision.md');
  assert.ok(fs.existsSync(newPath));

  // Sibling's own ADR-0058 is untouched.
  const siblingContent = fs.readFileSync(path.join(dir, '0058-sibling-task-a-decision.md'), 'utf8');
  assert.match(siblingContent, /id: ADR-0058/);

  // The renumbered file's identity (frontmatter id + H1 heading) matches the new number.
  const newContent = fs.readFileSync(newPath, 'utf8');
  assert.match(newContent, /^id: ADR-0059\s*$/m);
  assert.match(newContent, /^# ADR-0059: task-b-decision\s*$/m);

  // A renumbering note is appended so a reader following a stale cross-reference finds a trail.
  assert.match(newContent, /## Note on ADR numbering/);
  assert.match(newContent, /ADR-0058/);

  // The manifest names both the removed provisional path and the added final path,
  // mirroring applyTaskMove's `changed: [fromPath, toPath]` convention (ADR-0038).
  assert.deepEqual(result.changed, [path.join(dir, '0058-task-b-decision.md'), newPath]);
});

// --- finalizeAdrNumbering: a too-high guess is corrected down, never leaving a gap ---

test('finalizeAdrNumbering: an over-guessed number is corrected down to the true next-free (no gap)', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0057', 'existing-decision');
  // Worker guessed 0060 (stale worktree view of a busier main than actually exists).
  const provisional = writeAdr(dir, '0060', 'over-guessed-decision');

  const result = finalizeAdrNumbering(dir, [provisional]);

  assert.equal(result.renumbered.length, 1);
  assert.equal(result.renumbered[0].to, 'ADR-0058');
  assert.ok(fs.existsSync(path.join(dir, '0058-over-guessed-decision.md')));
  assert.ok(!fs.existsSync(path.join(dir, '0060-over-guessed-decision.md')));
});

// --- finalizeAdrNumbering: multiple provisional files in one task get sequential numbers ---

test('finalizeAdrNumbering: multiple provisional files in one call are assigned sequential numbers in order', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0057', 'existing-decision');
  const provisionalA = writeAdr(dir, '0058', 'first-of-two');
  const provisionalB = writeAdr(dir, '0059', 'second-of-two');

  const result = finalizeAdrNumbering(dir, [provisionalA, provisionalB]);

  // Both already correct in this scenario -> no renumbering.
  assert.deepEqual(result.renumbered, []);

  // Now simulate the same task landing behind a sibling that already took 0058.
  const dir2 = makeTmpDecisionsDir();
  writeAdr(dir2, '0057', 'existing-decision');
  writeAdr(dir2, '0058', 'sibling-decision');
  const p1 = writeAdr(dir2, '0058', 'my-first-decision');
  const p2 = writeAdr(dir2, '0059', 'my-second-decision');

  const result2 = finalizeAdrNumbering(dir2, [p1, p2]);
  assert.equal(result2.renumbered.length, 2);
  assert.equal(result2.renumbered[0].to, 'ADR-0059');
  assert.equal(result2.renumbered[1].to, 'ADR-0060');
  assert.ok(fs.existsSync(path.join(dir2, '0059-my-first-decision.md')));
  assert.ok(fs.existsSync(path.join(dir2, '0060-my-second-decision.md')));
});

// --- finalizeAdrNumbering: never called -> a bounced/failed task leaves no hole ---

test('finalizeAdrNumbering: a discarded provisional file (never passed in) leaves the true sequence untouched', () => {
  const dir = makeTmpDecisionsDir();
  writeAdr(dir, '0057', 'existing-decision');
  // Simulates a FAIL/BOUNCE: the worker minted a provisional 0058 file in its
  // own worktree, but that worktree/branch is discarded and never merged, so
  // finalizeAdrNumbering is never called with it — nothing on `main` ever
  // reflects the guess, so a future mint's `nextAdrNumber` still correctly
  // reports 0058, not 0059. No permanent hole.
  assert.equal(nextAdrNumber(dir), '0058');
});
