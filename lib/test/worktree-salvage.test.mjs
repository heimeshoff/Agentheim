import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  BOUNCE_TAG,
  DISCARD_TAG,
  MERGE_CONFLICT_TAG,
  escalationTag,
  ensureSalvageDir,
  salvagePatchPath,
  formatSalvageReference,
} from '../worktree-salvage.mjs';

// ---- escalationTag ----

test('escalationTag: formats a positive integer iteration', () => {
  assert.equal(escalationTag(3), 'escalated-iter3');
  assert.equal(escalationTag(1), 'escalated-iter1');
});

test('escalationTag: throws on a non-positive-integer iteration', () => {
  assert.throws(() => escalationTag(0), TypeError);
  assert.throws(() => escalationTag(-1), TypeError);
  assert.throws(() => escalationTag(1.5), TypeError);
  assert.throws(() => escalationTag('3'), TypeError);
  assert.throws(() => escalationTag(undefined), TypeError);
});

// ---- BOUNCE_TAG / DISCARD_TAG ----

test('BOUNCE_TAG and DISCARD_TAG are the documented literal tags', () => {
  assert.equal(BOUNCE_TAG, 'bounced');
  assert.equal(DISCARD_TAG, 'discarded');
});

// ---- MERGE_CONFLICT_TAG (ADR-0072, agentic-workflow-pcwnn) ----

test('MERGE_CONFLICT_TAG is the documented literal tag', () => {
  assert.equal(MERGE_CONFLICT_TAG, 'merge-conflict');
});

test('salvagePatchPath: works with MERGE_CONFLICT_TAG, and a later escalated-iterN capture for the same task is a second, distinct file', () => {
  const conflictPatch = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-pcwnn', MERGE_CONFLICT_TAG);
  assert.equal(conflictPatch, path.join('/repo/.agentheim/salvage', 'agentic-workflow-pcwnn-merge-conflict.patch'));
  const laterEscalation = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-pcwnn', escalationTag(3));
  assert.notEqual(conflictPatch, laterEscalation);
  assert.equal(laterEscalation, path.join('/repo/.agentheim/salvage', 'agentic-workflow-pcwnn-escalated-iter3.patch'));
});

// ---- ensureSalvageDir ----

test('ensureSalvageDir: creates a nested directory that does not yet exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-hvqa4-salvage-'));
  const salvageRoot = path.join(root, '.agentheim', 'salvage');
  try {
    assert.equal(existsSync(salvageRoot), false);
    const returned = ensureSalvageDir(salvageRoot);
    assert.equal(returned, salvageRoot);
    assert.equal(existsSync(salvageRoot), true);
    assert.equal(statSync(salvageRoot).isDirectory(), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureSalvageDir: idempotent — a second call on an already-existing dir is a no-op, not an error', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-hvqa4-salvage-'));
  const salvageRoot = path.join(root, '.agentheim', 'salvage');
  try {
    ensureSalvageDir(salvageRoot);
    assert.doesNotThrow(() => ensureSalvageDir(salvageRoot));
    assert.equal(existsSync(salvageRoot), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureSalvageDir: throws on an empty/non-string salvageRoot', () => {
  assert.throws(() => ensureSalvageDir(''), TypeError);
  assert.throws(() => ensureSalvageDir(undefined), TypeError);
});

// ---- salvagePatchPath ----

test('salvagePatchPath: joins salvageRoot, taskId, and tag into "<taskId>-<tag>.patch"', () => {
  const p = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', BOUNCE_TAG);
  assert.equal(p, path.join('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4-bounced.patch'));
});

test('salvagePatchPath: works with escalationTag output', () => {
  const p = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', escalationTag(3));
  assert.equal(p, path.join('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4-escalated-iter3.patch'));
});

test('salvagePatchPath: two different tags for the same task produce two distinct paths (no overwrite)', () => {
  const escalated = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', escalationTag(3));
  const discarded = salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', DISCARD_TAG);
  assert.notEqual(escalated, discarded);
});

test('salvagePatchPath: throws on an invalid taskId (path-traversal / unsafe characters)', () => {
  assert.throws(() => salvagePatchPath('/repo/.agentheim/salvage', '../../etc/passwd', BOUNCE_TAG), TypeError);
  assert.throws(() => salvagePatchPath('/repo/.agentheim/salvage', 'task/with/slash', BOUNCE_TAG), TypeError);
  assert.throws(() => salvagePatchPath('/repo/.agentheim/salvage', '', BOUNCE_TAG), TypeError);
});

test('salvagePatchPath: throws on an invalid tag', () => {
  assert.throws(() => salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', 'bad tag with spaces'), TypeError);
  assert.throws(() => salvagePatchPath('/repo/.agentheim/salvage', 'agentic-workflow-hvqa4', ''), TypeError);
});

test('salvagePatchPath: throws on an empty/non-string salvageRoot', () => {
  assert.throws(() => salvagePatchPath('', 'agentic-workflow-hvqa4', BOUNCE_TAG), TypeError);
  assert.throws(() => salvagePatchPath(undefined, 'agentic-workflow-hvqa4', BOUNCE_TAG), TypeError);
});

// ---- formatSalvageReference ----

test('formatSalvageReference: names the exact patch path', () => {
  const ref = formatSalvageReference('/repo/.agentheim/salvage/agentic-workflow-hvqa4-bounced.patch');
  assert.match(ref, /Salvaged diff:/);
  assert.match(ref, /agentic-workflow-hvqa4-bounced\.patch/);
});

test('formatSalvageReference: throws on an empty/non-string patchPath', () => {
  assert.throws(() => formatSalvageReference(''), TypeError);
  assert.throws(() => formatSalvageReference(undefined), TypeError);
});
