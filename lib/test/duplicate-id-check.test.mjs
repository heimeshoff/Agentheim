import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { findDuplicateTaskIds, formatDuplicateReport } from '../duplicate-id-check.mjs';

const FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/** Spin up an empty throwaway project rooted at a temp dir. */
function makeRoot() {
  return mkdtempSync(path.join(tmpdir(), 'aw080-'));
}

/**
 * Write a task file `<id>-<slug>.md` into `<root>/.agentheim/board/<bc>/<folder>/`.
 * When `frontmatterId` is undefined the body carries `id: <id>`; pass `null` to
 * write NO `id:` line (forcing the filename fallback); pass a string to write a
 * DIFFERENT frontmatter id than the filename (to prove frontmatter wins).
 */
function writeTask(root, { bc, folder, id, slug = 'a-task', frontmatterId } = {}) {
  const dir = path.join(root, '.agentheim', 'board', bc, folder);
  mkdirSync(dir, { recursive: true });
  const fmId = frontmatterId === undefined ? id : frontmatterId;
  const idLine = fmId === null ? '' : `id: ${fmId}\n`;
  const fileName = slug ? `${id}-${slug}.md` : `${id}.md`;
  const file = path.join(dir, fileName);
  const content = `---
${idLine}title: A task
status: ${folder}
context: ${bc}
---

## Why

stuff
`;
  writeFileSync(file, content);
  return file;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('all-distinct ids → no duplicates reported', () => {
  const root = makeRoot();
  try {
    writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'agentic-workflow-001' });
    writeTask(root, { bc: 'agentic-workflow', folder: 'todo', id: 'agentic-workflow-k3f9q' });
    writeTask(root, { bc: 'design-system', folder: 'backlog', id: 'design-system-q7r2m' });
    assert.deepEqual(findDuplicateTaskIds(root), []);
  } finally {
    cleanup(root);
  }
});

test('two files sharing one id → reported with BOTH colliding paths', () => {
  const root = makeRoot();
  try {
    const a = writeTask(root, { bc: 'agentic-workflow', folder: 'doing', id: 'agentic-workflow-077', slug: 'branch-a' });
    const b = writeTask(root, { bc: 'agentic-workflow', folder: 'todo', id: 'agentic-workflow-077', slug: 'branch-b' });
    const dups = findDuplicateTaskIds(root);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].id, 'agentic-workflow-077');
    assert.deepEqual(dups[0].paths, [a, b].sort());
  } finally {
    cleanup(root);
  }
});

test('a collision can span lifecycle folders AND bounded contexts', () => {
  // The id encodes its BC, but the scanner compares whole-id across the whole
  // tree, so an id duplicated under two different BC folders is still caught.
  const root = makeRoot();
  try {
    const a = writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'agentic-workflow-k3f9q', slug: 'one' });
    const b = writeTask(root, { bc: 'design-system', folder: 'backlog', id: 'agentic-workflow-k3f9q', slug: 'two' });
    const dups = findDuplicateTaskIds(root);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].id, 'agentic-workflow-k3f9q');
    assert.deepEqual(dups[0].paths, [a, b].sort());
  } finally {
    cleanup(root);
  }
});

test('mixed legacy + token ids are compared as WHOLE ids (no tail parsing)', () => {
  // A legacy all-digit tail and a new leading-letter token tail must NOT be
  // conflated, and a legacy id colliding with itself must still be caught — both
  // fall out of whole-string comparison with no shape awareness.
  const root = makeRoot();
  try {
    writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'agentic-workflow-077' });
    writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'agentic-workflow-k3f9q' });
    // legacy `-001` and token `-001x` share a prefix but are distinct whole ids:
    writeTask(root, { bc: 'agentic-workflow', folder: 'todo', id: 'agentic-workflow-001' });
    writeTask(root, { bc: 'agentic-workflow', folder: 'backlog', id: 'agentic-workflow-z001x' });
    assert.deepEqual(findDuplicateTaskIds(root), [], 'distinct whole ids must not collide');

    // now add a genuine legacy-vs-token clash on the SAME whole string:
    const a = writeTask(root, { bc: 'design-system', folder: 'done', id: 'design-system-h8p2q', slug: 'left' });
    const b = writeTask(root, { bc: 'design-system', folder: 'todo', id: 'design-system-h8p2q', slug: 'right' });
    const dups = findDuplicateTaskIds(root);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].id, 'design-system-h8p2q');
    assert.deepEqual(dups[0].paths, [a, b].sort());
  } finally {
    cleanup(root);
  }
});

test('id is taken from frontmatter, NOT the filename, when they disagree', () => {
  const root = makeRoot();
  try {
    // Two files whose FILENAMES differ but whose frontmatter id is the same →
    // a duplicate, proving frontmatter is the source of truth.
    const a = writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'aw-filename-x', slug: 's1', frontmatterId: 'agentic-workflow-dup1' });
    const b = writeTask(root, { bc: 'agentic-workflow', folder: 'todo', id: 'aw-filename-y', slug: 's2', frontmatterId: 'agentic-workflow-dup1' });
    const dups = findDuplicateTaskIds(root);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].id, 'agentic-workflow-dup1');
    assert.deepEqual(dups[0].paths, [a, b].sort());
  } finally {
    cleanup(root);
  }
});

test('falls back to the filename id when frontmatter is absent (loss-tolerant, never throws)', () => {
  const root = makeRoot();
  try {
    // No `id:` line in either file; the `<id>-<slug>.md` stem must still collide.
    const a = writeTask(root, { bc: 'agentic-workflow', folder: 'done', id: 'agentic-workflow-nofm', slug: 's1', frontmatterId: null });
    const b = writeTask(root, { bc: 'agentic-workflow', folder: 'todo', id: 'agentic-workflow-nofm', slug: 's1', frontmatterId: null });
    const dups = findDuplicateTaskIds(root);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].id, 'agentic-workflow-nofm-s1', 'whole filename stem is the fallback id');
    assert.deepEqual(dups[0].paths, [a, b].sort());
  } finally {
    cleanup(root);
  }
});

test('an absent or empty tree yields no duplicates and does not throw', () => {
  const root = makeRoot();
  try {
    // No board dir at all — a completely absent .agentheim/ is 'board' by
    // detectLayout's own neither-root default (agentic-workflow-g5ez5).
    assert.deepEqual(findDuplicateTaskIds(root), []);
    // Empty board dir.
    mkdirSync(path.join(root, '.agentheim', 'board'), { recursive: true });
    assert.deepEqual(findDuplicateTaskIds(root), []);
    // BC dir with no lifecycle folders.
    mkdirSync(path.join(root, '.agentheim', 'board', 'empty-bc'), { recursive: true });
    assert.deepEqual(findDuplicateTaskIds(root), []);
  } finally {
    cleanup(root);
  }
});

// --- legacy/mixed refusal (agentic-workflow-g5ez5, ADR-0078 §5 2nd phase) ---

test('findDuplicateTaskIds throws a structured "legacy-layout" error on a detected legacy tree', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', 'contexts', 'widgets', 'todo'), { recursive: true });
    assert.throws(() => findDuplicateTaskIds(root), (err) => err.code === 'legacy-layout');
  } finally {
    cleanup(root);
  }
});

test('findDuplicateTaskIds throws a structured "mixed-layout" error on a mixed tree', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', 'contexts', 'widgets'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', 'widgets'), { recursive: true });
    assert.throws(() => findDuplicateTaskIds(root), (err) => err.code === 'mixed-layout');
  } finally {
    cleanup(root);
  }
});

test('formatDuplicateReport renders a clear message naming the id and every file; empty for no dups', () => {
  assert.equal(formatDuplicateReport([]), '');
  const msg = formatDuplicateReport([
    { id: 'agentic-workflow-077', paths: ['/x/a.md', '/x/b.md'] },
  ]);
  assert.match(msg, /agentic-workflow-077/);
  assert.match(msg, /\/x\/a\.md/);
  assert.match(msg, /\/x\/b\.md/);
});

// --- The recurring insurance: the LIVE tree must have NO duplicate ids. -------
// This is the gate that replaces the original "passes on the current tree" + "CI
// wiring" criteria (the repo has no CI; the node --test suite is the gate).
test('the live .agentheim/ tree has NO duplicate task ids', () => {
  // <repo>/lib/test/<this file> → repo root is three levels up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const dups = findDuplicateTaskIds(repoRoot);
  assert.deepEqual(dups, [], formatDuplicateReport(dups) || 'expected no duplicate ids');
});
