// Coverage for the CLI-verb half of acceptance criterion 1
// (agentic-workflow-g5ez5, ADR-0078 §5's second phase): every mechanized
// lifecycle verb except `migrate` -- and both parameterless rotation CLIs --
// must refuse a legacy or mixed `.agentheim/` tree with
// `{ok:false, code:'legacy-layout'|'mixed-layout'}` and write nothing,
// instead of guessing a root or silently no-op'ing. `migrate` is the sole
// verb that reads a legacy tree ON PURPOSE (via an explicit `{layout:'legacy'}`
// override) and is exercised separately, in `lib/test/layout-migration.test.mjs`.
//
// Iteration 2 (after the iteration-1 verifier FAIL): this file is new. The
// FAIL also named a production defect independent of test coverage --
// `lib/index-rotation.mjs`'s `rotateAllIndexDoneLists` swallowed
// `listBoardContexts`'s structured `legacy-layout`/`mixed-layout` throw into
// a bare `bcNames = []`, making `runCli`'s catch there unreachable dead code
// (a silent `{ok:true, rotated:false, ..., contexts:{}}` no-op instead of a
// refusal). That swallow is removed in this same iteration (see
// `lib/index-rotation.mjs`) and this file's `index-rotation` cases below
// would fail against the pre-fix source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runCli as runLifecycleCli } from '../task-lifecycle-cli.mjs';
import { runCli as runIndexRotationCli } from '../index-rotation.mjs';
import { runCli as runProtocolRotationCli } from '../protocol-rotation.mjs';
import { detectLayout } from '../task-system-paths.mjs';

function makeRoot(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** Minimal legacy tree: one BC (`widgets`) with a task under `todo/`, plus `knowledge/protocol.md`. */
function buildLegacyFixture() {
  const root = makeRoot('aw-legacy-refusal-');
  mkdirSync(path.join(root, '.agentheim', 'contexts', 'widgets', 'todo'), { recursive: true });
  writeFileSync(
    path.join(root, '.agentheim', 'contexts', 'widgets', 'todo', 'widgets-001-a-todo-task.md'),
    '---\nid: widgets-001\ntitle: A todo task\nstatus: todo\ntype: feature\ncontext: widgets\ncreated: 2026-01-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nFixture task.\n'
  );
  writeFileSync(path.join(root, '.agentheim', 'contexts', 'widgets', 'INDEX.md'), '# Widgets Index\n');
  mkdirSync(path.join(root, '.agentheim', 'knowledge'), { recursive: true });
  writeFileSync(path.join(root, '.agentheim', 'knowledge', 'protocol.md'), '# Protocol\n');
  assert.equal(detectLayout(root), 'legacy', 'fixture sanity: must detect as legacy');
  return root;
}

/** Minimal mixed tree: both `contexts/` and `board/` present for the same BC. */
function buildMixedFixture() {
  const root = makeRoot('aw-mixed-refusal-');
  mkdirSync(path.join(root, '.agentheim', 'contexts', 'widgets'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'board', 'widgets'), { recursive: true });
  assert.equal(detectLayout(root), 'mixed', 'fixture sanity: must detect as mixed');
  return root;
}

/** Minimal, already-`board`-layout tree: one BC with a task under `todo/`. */
function buildBoardFixture() {
  const root = makeRoot('aw-board-refusal-');
  mkdirSync(path.join(root, '.agentheim', 'board', 'widgets', 'todo'), { recursive: true });
  writeFileSync(
    path.join(root, '.agentheim', 'board', 'widgets', 'todo', 'widgets-001-a-todo-task.md'),
    '---\nid: widgets-001\ntitle: A todo task\nstatus: todo\ntype: feature\ncontext: widgets\ncreated: 2026-01-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nFixture task.\n'
  );
  mkdirSync(path.join(root, '.agentheim', 'knowledge'), { recursive: true });
  writeFileSync(path.join(root, '.agentheim', 'knowledge', 'protocol.md'), '# Protocol\n');
  assert.equal(detectLayout(root), 'board', 'fixture sanity: must detect as board');
  return root;
}

/** Recursive snapshot of every file's relative path + size, to prove a refusal wrote nothing. */
function snapshotTree(root) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(`${path.relative(root, p)}:${statSync(p).size}`);
    }
  }
  walk(path.join(root, '.agentheim'));
  return out.sort();
}

// Every id-arity or opts-arity lifecycle verb except `migrate`, paired with
// argv that gets each verb PAST its own opts validation (missing-bc,
// missing-reason, etc.) so the layout check underneath is what actually
// fires. Established empirically against this iteration's source by driving
// `runLifecycleCli` directly (the same in-process pattern
// `lib/test/lifecycle-lock-integration.test.mjs` and
// `lib/test/task-lifecycle-cli-mechanics.test.mjs` use).
const LIFECYCLE_VERB_CASES = [
  { verb: 'promote', argv: ['promote', 'widgets-001'] },
  { verb: 'claim', argv: ['claim', 'widgets-001'] },
  { verb: 'complete', argv: ['complete', 'widgets-001'] },
  {
    verb: 'checkpoint',
    argv: ['checkpoint', 'widgets-001', JSON.stringify({ fileList: [path.join(process.cwd(), 'lib', 'index-rotation.mjs')] })],
  },
  { verb: 'capture', argv: ['capture', 'widgets-999', JSON.stringify({ title: 'A captured task', context: 'widgets' })] },
  { verb: 'dismiss', argv: ['dismiss', 'widgets-001', JSON.stringify({ plan: true })] },
  { verb: 'bounce', argv: ['bounce', 'widgets-001', JSON.stringify({ reason: 'because fixture' })] },
  { verb: 'reroute', argv: ['reroute', 'widgets-001', JSON.stringify({ context: 'widgets' })] },
  { verb: 'log', argv: ['log', JSON.stringify({ title: 'A log entry', body: 'body text' })] },
  {
    verb: 'index-add',
    argv: ['index-add', JSON.stringify({ bc: 'widgets', section: 'adr-local', id: 'ADR-0001', line: '- **ADR-0001** — x' })],
  },
];

for (const { fixtureName, buildFixture, code } of [
  { fixtureName: 'legacy', buildFixture: buildLegacyFixture, code: 'legacy-layout' },
  { fixtureName: 'mixed', buildFixture: buildMixedFixture, code: 'mixed-layout' },
]) {
  for (const { verb, argv } of LIFECYCLE_VERB_CASES) {
    test(`${verb}: a ${fixtureName} fixture refuses {ok:false, code:'${code}'} and writes nothing`, () => {
      const root = buildFixture();
      try {
        const before = snapshotTree(root);
        const { exitCode, output } = runLifecycleCli(argv, { cwd: root, discoverRoot: () => root });
        assert.equal(output.ok, false, `expected ${verb} to refuse, got ${JSON.stringify(output)}`);
        assert.equal(output.code, code);
        assert.equal(exitCode, 1);
        const after = snapshotTree(root);
        assert.deepEqual(after, before, `expected ${verb} to write nothing against a ${fixtureName} tree`);
      } finally {
        cleanup(root);
      }
    });
  }

  test(`index-rotation runCli: a ${fixtureName} fixture refuses {ok:false, code:'${code}'} and writes nothing`, () => {
    const root = buildFixture();
    try {
      const before = snapshotTree(root);
      const { exitCode, output } = runIndexRotationCli({ cwd: root, discoverRoot: () => root });
      assert.equal(output.ok, false, `expected index-rotation to refuse, got ${JSON.stringify(output)}`);
      assert.equal(output.code, code);
      assert.equal(exitCode, 1);
      const after = snapshotTree(root);
      assert.deepEqual(after, before, `expected index-rotation to write nothing against a ${fixtureName} tree`);
    } finally {
      cleanup(root);
    }
  });

  test(`protocol-rotation runCli: a ${fixtureName} fixture refuses {ok:false, code:'${code}'} and writes nothing`, () => {
    const root = buildFixture();
    try {
      const before = snapshotTree(root);
      const { exitCode, output } = runProtocolRotationCli({ cwd: root, discoverRoot: () => root });
      assert.equal(output.ok, false, `expected protocol-rotation to refuse, got ${JSON.stringify(output)}`);
      assert.equal(output.code, code);
      assert.equal(exitCode, 1);
      const after = snapshotTree(root);
      assert.deepEqual(after, before, `expected protocol-rotation to write nothing against a ${fixtureName} tree`);
    } finally {
      cleanup(root);
    }
  });
}

// `migrate` is the one verb that reads a legacy tree ON PURPOSE -- it must
// NOT be caught by the same refusal (its full behavior is covered in
// `lib/test/layout-migration.test.mjs`; this is just the boundary check that
// distinguishes it from the table above).
test("migrate: a legacy fixture is NOT refused with legacy-layout -- it is migrate's whole job", () => {
  const root = buildLegacyFixture();
  try {
    const { output } = runLifecycleCli(['migrate'], { cwd: root, discoverRoot: () => root });
    assert.notEqual(output.code, 'legacy-layout');
    assert.equal(output.ok, true);
  } finally {
    cleanup(root);
  }
});

test('migrate: a mixed fixture IS refused with mixed-layout, same as every other verb', () => {
  const root = buildMixedFixture();
  try {
    const { output } = runLifecycleCli(['migrate'], { cwd: root, discoverRoot: () => root });
    assert.equal(output.ok, false);
    assert.equal(output.code, 'mixed-layout');
  } finally {
    cleanup(root);
  }
});

// Board-fixture smoke half: `migrate` still no-ops, other verbs still
// operate normally (the existing per-verb suites already cover normal
// operation in depth -- this is deliberately minimal).
test('board fixture: migrate is a noop', () => {
  const root = buildBoardFixture();
  try {
    const { output } = runLifecycleCli(['migrate'], { cwd: root, discoverRoot: () => root });
    assert.equal(output.ok, true);
    assert.equal(output.noop, true);
  } finally {
    cleanup(root);
  }
});

test('board fixture: log operates normally (smoke)', () => {
  const root = buildBoardFixture();
  try {
    const { output } = runLifecycleCli(['log', JSON.stringify({ title: 'A log entry', body: 'body text' })], {
      cwd: root,
      discoverRoot: () => root,
    });
    assert.equal(output.ok, true);
  } finally {
    cleanup(root);
  }
});

test('board fixture: index-rotation runCli operates normally (smoke)', () => {
  const root = buildBoardFixture();
  try {
    const { output } = runIndexRotationCli({ cwd: root, discoverRoot: () => root });
    assert.equal(output.ok, true);
  } finally {
    cleanup(root);
  }
});

test('board fixture: protocol-rotation runCli operates normally (smoke)', () => {
  const root = buildBoardFixture();
  try {
    const { output } = runProtocolRotationCli({ cwd: root, discoverRoot: () => root });
    assert.equal(output.ok, true);
  } finally {
    cleanup(root);
  }
});
