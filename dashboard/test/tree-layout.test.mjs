// ADR-0078 two-root layout — dashboard/tree.mjs resolves the `board` layout
// through `lib/task-system-paths.mjs` (agentic-workflow-hxq1g), and refuses a
// DETECTED `'legacy'` or `'mixed'` root before touching any getter
// (agentic-workflow-g5ez5, ADR-0078 §5 second phase). This suite covers the
// `board` layout's split index pointer, the `orphan-task-folder` warning,
// the one legacy-refusal case, and `migrationPending` across all three
// `detectLayout` outcomes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildTree } from '../tree.mjs';

function writeTaskFile(dir, id, title, status) {
  writeFileSync(
    path.join(dir, `${id}.md`),
    ['---', `id: ${id}`, `title: ${title}`, `status: ${status}`, 'type: feature', `context: alpha`, '---'].join('\n')
  );
}

/**
 * Build one BC's worth of fixture content (backlog+todo+doing+done, README,
 * two INDEXes, one concept) under either layout, so a single spec drives both
 * fixture builders and a normalized-diff comparison is meaningful.
 */
function makeLayoutFixture(kind) {
  const base = mkdtempSync(path.join(tmpdir(), `hxq1g-tree-${kind}-`));
  const ah = path.join(base, '.agentheim');
  mkdirSync(ah, { recursive: true });
  const decisionsDir = path.join(ah, 'knowledge', 'decisions');
  const researchDir = path.join(ah, 'knowledge', 'research');
  mkdirSync(decisionsDir, { recursive: true });
  mkdirSync(researchDir, { recursive: true });
  writeFileSync(path.join(decisionsDir, '0001-foo.md'), '# ADR 0001');
  writeFileSync(path.join(researchDir, 'spike-bar.md'), '# Research');

  let bcTaskRoot;
  let bcKnowledgeRoot;
  let visionFile;
  let contextMapFile;

  if (kind === 'legacy') {
    visionFile = path.join(ah, 'vision.md');
    contextMapFile = path.join(ah, 'context-map.md');
    bcTaskRoot = path.join(ah, 'contexts', 'alpha');
    bcKnowledgeRoot = bcTaskRoot;
  } else {
    visionFile = path.join(ah, 'knowledge', 'vision.md');
    contextMapFile = path.join(ah, 'knowledge', 'context-map.md');
    bcTaskRoot = path.join(ah, 'board', 'alpha');
    bcKnowledgeRoot = path.join(ah, 'knowledge', 'contexts', 'alpha');
  }

  writeFileSync(visionFile, '# Vision: Acme Platform\n\nbody');
  writeFileSync(contextMapFile, '# Context map');

  for (const folder of ['backlog', 'todo', 'doing', 'done']) {
    mkdirSync(path.join(bcTaskRoot, folder), { recursive: true });
  }
  writeTaskFile(path.join(bcTaskRoot, 'backlog'), 'alpha-001', 'Do a thing', 'backlog');
  writeTaskFile(path.join(bcTaskRoot, 'done'), 'alpha-002', 'Done thing', 'done');

  mkdirSync(bcKnowledgeRoot, { recursive: true });
  writeFileSync(path.join(bcKnowledgeRoot, 'README.md'), '# Alpha');
  mkdirSync(path.join(bcKnowledgeRoot, 'concepts'), { recursive: true });
  writeFileSync(path.join(bcKnowledgeRoot, 'concepts', 'thing.md'), '# Thing');

  // Task-half INDEX (board/<bc>/INDEX.md, or the shared file under legacy).
  writeFileSync(path.join(bcTaskRoot, 'INDEX.md'), '# Alpha task index');
  // Knowledge-half INDEX — under legacy this OVERWRITES the same file (by
  // design: bcTaskRoot === bcKnowledgeRoot there), matching production's
  // "both point at the same file" contract.
  writeFileSync(path.join(bcKnowledgeRoot, 'INDEX.md'), '# Alpha index');

  return base;
}

test('buildTree on a detected legacy fixture refuses before any getter — migrationPending, empty contexts/locations, no throw (agentic-workflow-g5ez5)', () => {
  const legacyRoot = makeLayoutFixture('legacy');
  try {
    const legacyTree = buildTree(legacyRoot);
    assert.equal(legacyTree.layout, 'legacy');
    assert.equal(legacyTree.migrationPending, true);
    assert.deepEqual(legacyTree.contexts, []);
    assert.deepEqual(legacyTree.locations, {});
    assert.deepEqual(legacyTree.project, { name: null });
  } finally {
    rmSync(legacyRoot, { recursive: true, force: true });
  }
});

test('on a board fixture, index points at board/<bc>/INDEX.md and knowledgeIndex at knowledge/contexts/<bc>/INDEX.md', () => {
  const boardRoot = makeLayoutFixture('board');
  try {
    const tree = buildTree(boardRoot);
    const alpha = tree.contexts.find((c) => c.name === 'alpha');
    assert.equal(alpha.index, '.agentheim/board/alpha/INDEX.md');
    assert.equal(alpha.knowledgeIndex, '.agentheim/knowledge/contexts/alpha/INDEX.md');
  } finally {
    rmSync(boardRoot, { recursive: true, force: true });
  }
});


test('a board/<bc>/ with no matching knowledge/contexts/<bc>/ yields an orphan-task-folder warning; other BCs render normally', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'hxq1g-tree-orphan-'));
  try {
    const ah = path.join(base, '.agentheim');
    // A well-formed BC: both roots present.
    mkdirSync(path.join(ah, 'board', 'alpha', 'todo'), { recursive: true });
    mkdirSync(path.join(ah, 'knowledge', 'contexts', 'alpha'), { recursive: true });
    writeFileSync(path.join(ah, 'knowledge', 'contexts', 'alpha', 'README.md'), '# Alpha');
    // An orphan: a board/ folder with no knowledge/contexts/ counterpart.
    mkdirSync(path.join(ah, 'board', 'orphan', 'todo'), { recursive: true });

    const tree = buildTree(base);
    assert.equal(tree.layout, 'board');
    assert.deepEqual(tree.warnings, [{ code: 'orphan-task-folder', bc: 'orphan' }]);
    const bcNames = tree.contexts.map((c) => c.name);
    assert.deepEqual(bcNames, ['alpha']);
    assert.equal(tree.contexts[0].readme, '.agentheim/knowledge/contexts/alpha/README.md');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('migrationPending is true on a legacy fixture, true on a mixed fixture, false on a board fixture — never a throw', () => {
  const legacyRoot = makeLayoutFixture('legacy');
  const boardRoot = makeLayoutFixture('board');
  const mixedRoot = mkdtempSync(path.join(tmpdir(), 'hxq1g-tree-mixed-'));
  try {
    mkdirSync(path.join(mixedRoot, '.agentheim', 'contexts', 'alpha', 'todo'), { recursive: true });
    mkdirSync(path.join(mixedRoot, '.agentheim', 'board', 'alpha', 'todo'), { recursive: true });

    const legacyTree = buildTree(legacyRoot);
    const boardTree = buildTree(boardRoot);
    const mixedTree = buildTree(mixedRoot);

    assert.equal(legacyTree.migrationPending, true);
    assert.equal(legacyTree.layout, 'legacy');
    assert.equal(boardTree.migrationPending, false);
    assert.equal(boardTree.layout, 'board');
    assert.equal(mixedTree.migrationPending, true);
    assert.equal(mixedTree.layout, 'mixed');
    // The mixed case RETURNS a payload — no mixed-layout error escapes buildTree.
    assert.deepEqual(mixedTree.contexts, []);
    assert.deepEqual(mixedTree.locations, {});
  } finally {
    rmSync(legacyRoot, { recursive: true, force: true });
    rmSync(boardRoot, { recursive: true, force: true });
    rmSync(mixedRoot, { recursive: true, force: true });
  }
});
