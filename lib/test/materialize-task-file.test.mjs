// Tests for lib/task-lifecycle.mjs's materializeTaskFile — writing a NEW
// backlog task file from a full `BACKLOG_ITEMS` body (agentic-workflow-ghcaj,
// amends ADR-0032 §3/§4/§6). tmpdir fixtures only, never the live tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { materializeTaskFile } from '../task-lifecycle.mjs';

function makeProject() {
  const root = mkdtempSync(path.join(tmpdir(), 'materialize-task-file-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', 'agentic-workflow');
  for (const folder of ['backlog', 'todo', 'doing', 'done']) {
    mkdirSync(path.join(bcDir, folder), { recursive: true });
  }
  return root;
}

function taskBody({ id, title = 'A follow-up task', extra = '' }) {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: chore\ncontext: agentic-workflow\n---\n\n## Why\n\nBecause a worker discovered it mid-task.\n${extra}`;
}

test('writes contexts/<bc>/backlog/<id>-<slug>.md from a body whose frontmatter passes classifyTaskId', () => {
  const root = makeProject();
  const body = taskBody({ id: 'agentic-workflow-ab3f9', title: 'Fix the flaky thing' });
  const result = materializeTaskFile(root, body);
  assert.equal(result.ok, true);
  assert.equal(result.id, 'agentic-workflow-ab3f9');
  assert.equal(result.context, 'agentic-workflow');
  const expectedPath = path.join(root, '.agentheim', 'contexts', 'agentic-workflow', 'backlog', 'agentic-workflow-ab3f9-fix-the-flaky-thing.md');
  assert.equal(result.path, expectedPath);
  assert.deepEqual(result.changed, [expectedPath]);
  assert.equal(existsSync(expectedPath), true);
  assert.equal(readFileSync(expectedPath, 'utf8'), body);
  rmSync(root, { recursive: true, force: true });
});

test('refuses an id already on disk in backlog/', () => {
  const root = makeProject();
  const bcDir = path.join(root, '.agentheim', 'contexts', 'agentic-workflow');
  writeFileSync(path.join(bcDir, 'backlog', 'agentic-workflow-ab3f9-existing.md'), taskBody({ id: 'agentic-workflow-ab3f9' }));
  const result = materializeTaskFile(root, taskBody({ id: 'agentic-workflow-ab3f9', title: 'A duplicate' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'duplicate-id');
  rmSync(root, { recursive: true, force: true });
});

test('refuses an id already on disk in doing/ (not just backlog/)', () => {
  const root = makeProject();
  const bcDir = path.join(root, '.agentheim', 'contexts', 'agentic-workflow');
  writeFileSync(path.join(bcDir, 'doing', 'agentic-workflow-ab3f9-in-progress.md'), taskBody({ id: 'agentic-workflow-ab3f9' }));
  const result = materializeTaskFile(root, taskBody({ id: 'agentic-workflow-ab3f9' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'duplicate-id');
  rmSync(root, { recursive: true, force: true });
});

test('refuses an id already on disk in done/', () => {
  const root = makeProject();
  const bcDir = path.join(root, '.agentheim', 'contexts', 'agentic-workflow');
  writeFileSync(path.join(bcDir, 'done', 'agentic-workflow-ab3f9-shipped.md'), taskBody({ id: 'agentic-workflow-ab3f9' }));
  const result = materializeTaskFile(root, taskBody({ id: 'agentic-workflow-ab3f9' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'duplicate-id');
  rmSync(root, { recursive: true, force: true });
});

test('refuses a malformed id (fails classifyTaskId)', () => {
  const root = makeProject();
  const result = materializeTaskFile(root, taskBody({ id: 'agentic-workflow-uuuuu' })); // out-of-charset look-alike 'u' only
  assert.equal(result.ok, false);
  assert.equal(result.code, 'malformed-id');
  rmSync(root, { recursive: true, force: true });
});

test('refuses a body with no frontmatter id: field', () => {
  const root = makeProject();
  const result = materializeTaskFile(root, '---\ntitle: No id here\n---\n\n## Why\n\nOops.');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-id');
  rmSync(root, { recursive: true, force: true });
});

test('returns {changed} for a scoped git add', () => {
  const root = makeProject();
  const result = materializeTaskFile(root, taskBody({ id: 'agentic-workflow-cd4g0', title: 'Another thing' }));
  assert.equal(result.ok, true);
  assert.equal(Array.isArray(result.changed), true);
  assert.equal(result.changed.length, 1);
  rmSync(root, { recursive: true, force: true });
});
