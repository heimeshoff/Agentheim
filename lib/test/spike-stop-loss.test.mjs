// Unit tests for lib/spike-stop-loss.mjs — the ADR-0065 spike-stop-loss-
// clause lint (agentic-workflow-rx630). Covers: type filtering (only
// `type: spike` is in scope), the date-based grandfather boundary (on/before
// ADOPTION_DATE never flagged, strictly after IS flagged when the marker is
// absent), marker detection (either wording satisfies it), loss-tolerance on
// an unparseable/undated file, and the recurring live-tree gate (mirrors
// lib/index-entry-length.mjs's final test): the real tree must have zero
// non-grandfathered spike tasks missing the clause today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkSpikeTaskFile,
  findSpikeTasksMissingStopLoss,
  ADOPTION_DATE,
} from '../spike-stop-loss.mjs';

function makeTaskFile(dir, fileName, { type = 'spike', created = '2026-01-01', body = '## Why\n\nFiller.\n' } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, fileName);
  writeFileSync(
    file,
    `---\nid: ${fileName.replace(/\.md$/, '')}\ntitle: Filler\nstatus: todo\ntype: ${type}\n` +
      `context: widgets\ncreated: ${created}\ncompleted:\n---\n\n${body}`
  );
  return file;
}

function scratchProject() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-spikestop-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', 'widgets');
  mkdirSync(bcDir, { recursive: true });
  return { root, bcDir };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// --- checkSpikeTaskFile ------------------------------------------------------

test('a spike task created strictly after adoption WITHOUT the marker is flagged', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'todo'), 'widgets-aaaaa.md', {
    created: '2026-08-01',
    body: '## Why\n\nInvestigate the flaky teardown.\n',
  });
  const violation = checkSpikeTaskFile(file);
  assert.ok(violation);
  assert.equal(violation.id, 'widgets-aaaaa');
  assert.equal(violation.created, '2026-08-01');
  cleanup(root);
});

test('a spike task created strictly after adoption carrying the literal "stop-loss" wording is not flagged', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'todo'), 'widgets-bbbbb.md', {
    created: '2026-08-01',
    body: '## Why\n\nInvestigate. Stop-loss: if the mitigation is already known, record it and stop.\n',
  });
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

test('a spike task created strictly after adoption carrying the clause\'s own "record it and stop" wording is not flagged', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'todo'), 'widgets-ccccc.md', {
    created: '2026-08-01',
    body: '## Notes\n\nIf mid-spike the mitigation is already known and cheap, record it and stop.\n',
  });
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

test('a spike task created ON adoption date is grandfathered (boundary is inclusive)', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'todo'), 'widgets-ddddd.md', {
    created: ADOPTION_DATE,
    body: '## Why\n\nNo marker here.\n',
  });
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

test('a spike task created well BEFORE adoption is grandfathered', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'done'), 'widgets-eeeee.md', {
    created: '2026-05-01',
    body: '## Why\n\nNo marker here.\n',
  });
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

test('a non-spike task (any type) without the marker is never flagged', () => {
  const { root, bcDir } = scratchProject();
  const file = makeTaskFile(path.join(bcDir, 'todo'), 'widgets-fffff.md', {
    type: 'feature',
    created: '2026-08-01',
    body: '## Why\n\nNo marker here.\n',
  });
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

test('an undated spike task (missing `created`) is loss-tolerantly not flagged', () => {
  const { root, bcDir } = scratchProject();
  mkdirSync(path.join(bcDir, 'todo'), { recursive: true });
  const file = path.join(bcDir, 'todo', 'widgets-ggggg.md');
  writeFileSync(
    file,
    '---\nid: widgets-ggggg\ntitle: Filler\nstatus: todo\ntype: spike\ncontext: widgets\n---\n\n## Why\n\nNo marker.\n'
  );
  assert.equal(checkSpikeTaskFile(file), null);
  cleanup(root);
});

// --- findSpikeTasksMissingStopLoss: whole-tree walk -------------------------

test('findSpikeTasksMissingStopLoss walks every lifecycle folder of every BC', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'backlog'), 'widgets-hhhhh.md', {
    created: '2026-08-01',
    body: '## Why\n\nNo marker.\n',
  });
  makeTaskFile(path.join(bcDir, 'doing'), 'widgets-iiiii.md', {
    created: '2026-08-01',
    body: '## Why\n\nStop-loss noted.\n',
  });
  const violations = findSpikeTasksMissingStopLoss(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'widgets-hhhhh');
  cleanup(root);
});

// --- the recurring live-tree gate -------------------------------------------
// Mirrors lib/index-entry-length.mjs's final test: the LIVE .agentheim/ tree
// must have zero non-grandfathered spike tasks missing the clause. Every
// spike task on disk today predates ADOPTION_DATE, so this stays green
// without retroactively rewriting any of them.

test('the live .agentheim/ tree has NO non-grandfathered spike task missing the stop-loss clause', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findSpikeTasksMissingStopLoss(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected no spike tasks missing the stop-loss clause, found: ${violations
      .map((v) => `${v.file}#${v.id} (created ${v.created})`)
      .join('; ')}`
  );
});
