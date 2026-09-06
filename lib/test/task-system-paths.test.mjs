// Unit tests for lib/task-system-paths.mjs — the ONE path module for the
// two-root `.agentheim/` layout (ADR-0078, agentic-workflow-cj54k).
//
// Covers: `detectLayout` against a legacy fixture, a board fixture, a mixed
// fixture (both shapes present, and the ambiguous split-vision shape), and a
// truly fresh/absent `.agentheim/`; every exported getter's exact expected
// path against a legacy fixture and a board fixture, and its structured
// `'mixed-layout'` throw on the mixed fixture; both enumerators; the
// `opts.layout` override; and a snapshot check that every getter resolves
// byte-identical to the inline `path.join` it replaced at each of the nine
// re-pointed `lib/` call sites, plus the live-tree assertion that
// `detectLayout(<this repo root>)` is `'legacy'` today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectLayout,
  taskFolderPath,
  taskIndexPath,
  doneArchiveDir,
  protocolPath,
  protocolArchiveDir,
  knowledgeIndexPath,
  bcReadmePath,
  bcConceptsDir,
  topIndexPath,
  decisionsDir,
  researchDir,
  visionPath,
  contextMapPath,
  styleguideDir,
  listBoardContexts,
  listKnowledgeContexts,
} from '../task-system-paths.mjs';

const BC = 'widgets';

function scratchRoot(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** A legacy-shaped fixture: `.agentheim/contexts/<bc>/`, root `vision.md`. */
function makeLegacyRoot() {
  const root = scratchRoot('aw-paths-legacy-');
  mkdirSync(path.join(root, '.agentheim', 'contexts', BC, 'doing'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'contexts', 'design-system', 'styleguide'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'knowledge', 'decisions'), { recursive: true });
  writeFileSync(path.join(root, '.agentheim', 'vision.md'), '# vision\n');
  return root;
}

/** A board-shaped fixture: `.agentheim/board/<bc>/`, `.agentheim/knowledge/contexts/<bc>/`. */
function makeBoardRoot() {
  const root = scratchRoot('aw-paths-board-');
  mkdirSync(path.join(root, '.agentheim', 'board', BC, 'doing'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'board', 'protocol'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'knowledge', 'contexts', BC), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'knowledge', 'contexts', 'design-system', 'styleguide'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'knowledge', 'decisions'), { recursive: true });
  writeFileSync(path.join(root, '.agentheim', 'knowledge', 'vision.md'), '# vision\n');
  return root;
}

/** A mixed fixture: BOTH contexts/ and board/ present. */
function makeMixedRoot() {
  const root = scratchRoot('aw-paths-mixed-');
  mkdirSync(path.join(root, '.agentheim', 'contexts', BC), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'board', BC), { recursive: true });
  return root;
}

/** A mixed fixture via the ambiguous split-vision shape (neither contexts/ nor board/ present). */
function makeSplitVisionMixedRoot() {
  const root = scratchRoot('aw-paths-splitvision-');
  mkdirSync(path.join(root, '.agentheim', 'knowledge'), { recursive: true });
  writeFileSync(path.join(root, '.agentheim', 'vision.md'), '# root vision\n');
  writeFileSync(path.join(root, '.agentheim', 'knowledge', 'vision.md'), '# knowledge vision\n');
  return root;
}

// --- detectLayout ------------------------------------------------------------

test('detectLayout: legacy fixture resolves "legacy"', () => {
  const root = makeLegacyRoot();
  try {
    assert.equal(detectLayout(root), 'legacy');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: board fixture resolves "board"', () => {
  const root = makeBoardRoot();
  try {
    assert.equal(detectLayout(root), 'board');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: both contexts/ and board/ present resolves "mixed"', () => {
  const root = makeMixedRoot();
  try {
    assert.equal(detectLayout(root), 'mixed');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: split-vision (root vision.md + knowledge/vision.md, no contexts/board) resolves "mixed"', () => {
  const root = makeSplitVisionMixedRoot();
  try {
    assert.equal(detectLayout(root), 'mixed');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: a completely absent .agentheim/ resolves "board" (fresh project, before brainstorm)', () => {
  const root = scratchRoot('aw-paths-fresh-');
  try {
    assert.equal(detectLayout(root), 'board');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: an existing-but-otherwise-empty .agentheim/ (neither contexts/ nor board/) resolves "legacy"', () => {
  const root = scratchRoot('aw-paths-emptyagentheim-');
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  try {
    assert.equal(detectLayout(root), 'legacy');
  } finally {
    cleanup(root);
  }
});

test('detectLayout: the live repo root resolves "legacy" today', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  assert.equal(detectLayout(repoRoot), 'legacy');
});

// --- getters: legacy ----------------------------------------------------------

test('getters resolve the exact legacy-shaped path per export', () => {
  const root = makeLegacyRoot();
  try {
    assert.equal(taskFolderPath(root, BC, 'doing'), path.join(root, '.agentheim', 'contexts', BC, 'doing'));
    assert.equal(taskIndexPath(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'INDEX.md'));
    assert.equal(doneArchiveDir(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'done-archive'));
    assert.equal(protocolPath(root), path.join(root, '.agentheim', 'knowledge', 'protocol.md'));
    assert.equal(protocolArchiveDir(root), path.join(root, '.agentheim', 'knowledge', 'protocol'));
    // Deliberate: same file as taskIndexPath under legacy.
    assert.equal(knowledgeIndexPath(root, BC), taskIndexPath(root, BC));
    assert.equal(bcReadmePath(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'README.md'));
    assert.equal(bcConceptsDir(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'concepts'));
    assert.equal(topIndexPath(root), path.join(root, '.agentheim', 'knowledge', 'index.md'));
    assert.equal(decisionsDir(root), path.join(root, '.agentheim', 'knowledge', 'decisions'));
    assert.equal(researchDir(root), path.join(root, '.agentheim', 'knowledge', 'research'));
    assert.equal(visionPath(root), path.join(root, '.agentheim', 'vision.md'));
    assert.equal(contextMapPath(root), path.join(root, '.agentheim', 'context-map.md'));
    assert.equal(styleguideDir(root), path.join(root, '.agentheim', 'contexts', 'design-system', 'styleguide'));
  } finally {
    cleanup(root);
  }
});

// --- getters: board -------------------------------------------------------

test('getters resolve the exact board-shaped path per export', () => {
  const root = makeBoardRoot();
  try {
    assert.equal(taskFolderPath(root, BC, 'doing'), path.join(root, '.agentheim', 'board', BC, 'doing'));
    assert.equal(taskIndexPath(root, BC), path.join(root, '.agentheim', 'board', BC, 'INDEX.md'));
    assert.equal(doneArchiveDir(root, BC), path.join(root, '.agentheim', 'board', BC, 'done-archive'));
    assert.equal(protocolPath(root), path.join(root, '.agentheim', 'board', 'protocol.md'));
    assert.equal(protocolArchiveDir(root), path.join(root, '.agentheim', 'board', 'protocol'));
    assert.equal(knowledgeIndexPath(root, BC), path.join(root, '.agentheim', 'knowledge', 'contexts', BC, 'INDEX.md'));
    assert.notEqual(knowledgeIndexPath(root, BC), taskIndexPath(root, BC));
    assert.equal(bcReadmePath(root, BC), path.join(root, '.agentheim', 'knowledge', 'contexts', BC, 'README.md'));
    assert.equal(bcConceptsDir(root, BC), path.join(root, '.agentheim', 'knowledge', 'contexts', BC, 'concepts'));
    assert.equal(topIndexPath(root), path.join(root, '.agentheim', 'knowledge', 'index.md'));
    assert.equal(decisionsDir(root), path.join(root, '.agentheim', 'knowledge', 'decisions'));
    assert.equal(researchDir(root), path.join(root, '.agentheim', 'knowledge', 'research'));
    assert.equal(visionPath(root), path.join(root, '.agentheim', 'knowledge', 'vision.md'));
    assert.equal(contextMapPath(root), path.join(root, '.agentheim', 'knowledge', 'context-map.md'));
    assert.equal(
      styleguideDir(root),
      path.join(root, '.agentheim', 'knowledge', 'contexts', 'design-system', 'styleguide')
    );
  } finally {
    cleanup(root);
  }
});

// --- mixed: every getter + enumerator throws a structured error, never a guess ---

const GETTER_CALLS = [
  ['taskFolderPath', (root) => taskFolderPath(root, BC, 'doing')],
  ['taskIndexPath', (root) => taskIndexPath(root, BC)],
  ['doneArchiveDir', (root) => doneArchiveDir(root, BC)],
  ['protocolPath', (root) => protocolPath(root)],
  ['protocolArchiveDir', (root) => protocolArchiveDir(root)],
  ['knowledgeIndexPath', (root) => knowledgeIndexPath(root, BC)],
  ['bcReadmePath', (root) => bcReadmePath(root, BC)],
  ['bcConceptsDir', (root) => bcConceptsDir(root, BC)],
  ['topIndexPath', (root) => topIndexPath(root)],
  ['decisionsDir', (root) => decisionsDir(root)],
  ['researchDir', (root) => researchDir(root)],
  ['visionPath', (root) => visionPath(root)],
  ['contextMapPath', (root) => contextMapPath(root)],
  ['styleguideDir', (root) => styleguideDir(root)],
  ['listBoardContexts', (root) => listBoardContexts(root)],
  ['listKnowledgeContexts', (root) => listKnowledgeContexts(root)],
];

for (const [name, call] of GETTER_CALLS) {
  test(`mixed layout: ${name} throws a structured 'mixed-layout' error, never a guess`, () => {
    const root = makeMixedRoot();
    try {
      assert.throws(
        () => call(root),
        (err) => err.code === 'mixed-layout' && typeof err.message === 'string' && err.message.length > 0
      );
    } finally {
      cleanup(root);
    }
  });
}

test('mixed layout: an enumerator never degrades to an empty array — it throws', () => {
  const root = makeMixedRoot();
  try {
    assert.throws(() => listBoardContexts(root), (err) => err.code === 'mixed-layout');
    assert.throws(() => listKnowledgeContexts(root), (err) => err.code === 'mixed-layout');
  } finally {
    cleanup(root);
  }
});

// --- opts.layout override --------------------------------------------------

test('opts.layout overrides disk state, even against a mixed tree', () => {
  const root = makeMixedRoot();
  try {
    assert.equal(
      taskFolderPath(root, BC, 'doing', { layout: 'legacy' }),
      path.join(root, '.agentheim', 'contexts', BC, 'doing')
    );
    assert.equal(
      taskFolderPath(root, BC, 'doing', { layout: 'board' }),
      path.join(root, '.agentheim', 'board', BC, 'doing')
    );
  } finally {
    cleanup(root);
  }
});

// --- enumerators -------------------------------------------------------------

test('listBoardContexts / listKnowledgeContexts: legacy fixture, both read contexts/', () => {
  const root = makeLegacyRoot();
  try {
    assert.deepEqual(listBoardContexts(root).sort(), ['design-system', BC].sort());
    assert.deepEqual(listKnowledgeContexts(root).sort(), listBoardContexts(root).sort());
  } finally {
    cleanup(root);
  }
});

test('listBoardContexts: board fixture excludes the protocol/ archive directory', () => {
  const root = makeBoardRoot();
  try {
    assert.deepEqual(listBoardContexts(root).sort(), [BC]);
  } finally {
    cleanup(root);
  }
});

test('listKnowledgeContexts: board fixture reads knowledge/contexts/', () => {
  const root = makeBoardRoot();
  try {
    assert.deepEqual(listKnowledgeContexts(root).sort(), ['design-system', BC].sort());
  } finally {
    cleanup(root);
  }
});

// --- snapshot: every getter matches the removed inline join, byte-for-byte ---
// One representative call per re-pointed lib/ module, against a legacy fixture
// (this repo's own real layout today) — proves the getters are drop-in
// replacements for the exact inline `path.join` calls they replaced.

test('snapshot: every getter is byte-identical to its removed inline path.join, at each of the nine call sites', () => {
  const root = makeLegacyRoot();
  try {
    // lib/task-lifecycle.mjs — folderDir + promoteTaskLocked's indexPath/protocolPath.
    assert.equal(taskFolderPath(root, BC, 'backlog'), path.join(root, '.agentheim', 'contexts', BC, 'backlog'));
    assert.equal(taskIndexPath(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'INDEX.md'));
    assert.equal(protocolPath(root), path.join(root, '.agentheim', 'knowledge', 'protocol.md'));

    // lib/task-lifecycle-capture-dismiss.mjs — findTaskFile's dir + decisionsDir.
    assert.equal(taskFolderPath(root, BC, 'todo'), path.join(root, '.agentheim', 'contexts', BC, 'todo'));
    assert.equal(decisionsDir(root), path.join(root, '.agentheim', 'knowledge', 'decisions'));

    // lib/task-lifecycle-cli.mjs — index-add's top-level vs per-BC indexPath.
    assert.equal(topIndexPath(root), path.join(root, '.agentheim', 'knowledge', 'index.md'));
    assert.equal(knowledgeIndexPath(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'INDEX.md'));

    // lib/index-rotation.mjs — rotateIndexDoneListLocked's indexPath/archiveDir/doneDir.
    assert.equal(doneArchiveDir(root, BC), path.join(root, '.agentheim', 'contexts', BC, 'done-archive'));
    assert.equal(taskFolderPath(root, BC, 'done'), path.join(root, '.agentheim', 'contexts', BC, 'done'));

    // lib/protocol-rotation.mjs — rotateProtocolLocked's protocolPath/archiveDir.
    assert.equal(protocolArchiveDir(root), path.join(root, '.agentheim', 'knowledge', 'protocol'));

    // lib/index-entry-length.mjs — findOverLengthIndexEntries's contextsDir walk + topIndexPath.
    assert.deepEqual(listBoardContexts(root).sort(), ['design-system', BC].sort());

    // lib/duplicate-id-check.mjs / lib/human-eye-criteria.mjs / lib/spike-stop-loss.mjs —
    // all three walk listBoardContexts(root) + taskFolderPath(root, bc, folder) identically.
    assert.equal(taskFolderPath(root, BC, 'doing'), path.join(root, '.agentheim', 'contexts', BC, 'doing'));
  } finally {
    cleanup(root);
  }
});
