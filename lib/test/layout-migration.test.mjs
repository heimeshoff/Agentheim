// Tests for the `migrate` verb (agentic-workflow-e896r, ADR-0078 §4):
// `lib/layout-migration.mjs`'s `migrateLayout` moves a legacy `.agentheim/`
// tree into the two-root `knowledge/` + `board/` layout under the lifecycle
// lock, splits every per-BC INDEX losslessly, rewrites every stale pointer,
// is idempotent, and refuses a mixed tree -- proved against fixtures only
// (the dogfood run on this repo's own tree is agentic-workflow-tgr31).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  migrateLayout,
  splitIndexContent,
  rewriteTopIndexPointers,
  rewriteReadmeContent,
} from '../layout-migration.mjs';
import { runCli } from '../task-lifecycle-cli.mjs';
import { runScopedCommit } from '../scoped-commit.mjs';
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
  visionPath,
  contextMapPath,
  styleguideDir,
} from '../task-system-paths.mjs';

const CLI_PATH = fileURLToPath(new URL('../task-lifecycle-cli.mjs', import.meta.url));
const BOARD_OPT = { layout: 'board' };
const BCS = ['alpha', 'beta', 'design-system'];

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

function makeRoot(prefix = 'aw-migrate-') {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

function write(root, relPath, content) {
  const abs = path.join(root, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

function taskBody({ id, title = 'A task', status, type = 'feature', context }) {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\ntype: ${type}\ncontext: ${context}\ncreated: 2026-01-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nFixture task.\n`;
}

function titleCase(bc) {
  return bc.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Renders the LEGACY combined per-BC INDEX.md shape (references/index-template.md). */
function indexFixture(bc, { includeConcepts = true, includeDoneArchivePointer = true } = {}) {
  let s =
    `# ${titleCase(bc)} — Index\n\n` +
    `Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,\n` +
    `research touching this BC, and concept synthesis pages.\n\n` +
    `> Updated by: \`modeling\` (tasks), \`work\` (BC-scoped ADRs, concept page links), \`research\` (BC-scoped reports).\n\n` +
    `---\n\n` +
    `## Tasks by status\n\n` +
    `<!-- task-counts:start -->\n- **Backlog:** 1\n- **Todo:** 1\n- **Doing:** 1\n- **Done:** 1\n<!-- task-counts:end -->\n\n` +
    `### Todo\n<!-- todo-list:start -->\n- **${bc}-002** — A todo task — depends_on: [] — \`todo/${bc}-002-a-todo-task.md\`\n<!-- todo-list:end -->\n\n` +
    `### Doing\n<!-- doing-list:start -->\n- **${bc}-003** — A doing task — \`doing/${bc}-003-a-doing-task.md\`\n<!-- doing-list:end -->\n\n` +
    `### Done (most recent first; older entries kept for prior-art search)\n<!-- done-list:start -->\n- **${bc}-001** — A done task — 2026-01-01 — \`done/${bc}-001-a-done-task.md\`\n<!-- done-list:end -->\n\n` +
    `Current-month entries stay live in full -- rotation paragraph placeholder text (ADR-0039).\n\n` +
    `### Backlog\n<!-- backlog-list:start -->\n- **${bc}-004** — A backlog task — \`backlog/${bc}-004-a-backlog-task.md\`\n<!-- backlog-list:end -->\n\n` +
    `## ADRs scoped to this BC\n\n<!-- adr-local:start -->\n- **0001** — Example decision — 2026-01-01 — \`../../knowledge/decisions/0001-example-decision.md\`\n<!-- adr-local:end -->\n\n` +
    `## Research touching this BC\n\n<!-- research-local:start -->\n- **example-topic** — An example topic — 2026-01-01 — \`../../knowledge/research/example-topic-2026-01-01.md\`\n<!-- research-local:end -->\n\n`;
  if (includeConcepts) {
    s +=
      `## Concepts (opt-in synthesis pages)\n\n<!-- concepts:start -->\n` +
      `- **example-concept** — An example concept — derived_from: [0001] — \`concepts/example-concept.md\`\n<!-- concepts:end -->\n\n`;
  }
  s += `## Pointers\n\n- BC README (ubiquitous language, invariants): \`README.md\`\n`;
  if (includeDoneArchivePointer) {
    s += `- Done-list archive (entries rolled out beyond the live cap, if any): \`done-archive/2026-01.md\` (ADR-0039 convention)\n`;
  }
  return s;
}

function readmeFixture(bc) {
  return (
    `# ${titleCase(bc)} — README\n\n` +
    `## Ubiquitous language\n\n- **Widget** — a thing.\n\n` +
    `See \`.agentheim/contexts/${bc}/todo/\` for pending work and \`.agentheim/contexts/${bc}/INDEX.md\` for the full task board.\n` +
    `The project vision lives at \`.agentheim/vision.md\` and the context map at \`.agentheim/context-map.md\`.\n` +
    `The chronological log lives at \`.agentheim/knowledge/protocol.md\`.\n` +
    `See [ADR-0001](../../knowledge/decisions/0001-example-decision.md) and [the example-topic report](../../knowledge/research/example-topic-2026-01-01.md).\n`
  );
}

function topIndexFixture(bcs) {
  const bcLines = bcs.map((bc) => `- **${bc}** — an example BC — \`contexts/${bc}/INDEX.md\`\n`).join('');
  return (
    `# Index\n\nTop-level catalog.\n\n> Updated by: modeling.\n\n---\n\n` +
    `## Bounded contexts\n\n<!-- bc-list:start -->\n${bcLines}<!-- bc-list:end -->\n\n` +
    `## Global ADRs (scope: global)\n\n<!-- adr-global:start -->\n<!-- adr-global:end -->\n\n` +
    `## Cross-BC research\n\n<!-- research-global:start -->\n<!-- research-global:end -->\n\n` +
    `## Pointers\n\n- Vision: \`vision.md\`\n- Context map: \`context-map.md\` (if exists)\n` +
    `- Protocol (chronological log): \`knowledge/protocol.md\` — newest entries on top; capped at ~1,000 lines, older months roll out verbatim to \`knowledge/protocol/YYYY-MM.md\` (ADR-0039)\n` +
    `- All ADRs: \`knowledge/decisions/\`\n- All research: \`knowledge/research/\`\n`
  );
}

function protocolFixture() {
  return (
    `# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n` +
    `## 2026-02-01 00:00 -- A recent entry\n\n**Type:** X\n\n---\n\n`
  );
}

/** The full legacy fixture named in this task's AC #1: root vision/context-map, three BCs, one BC (design-system) with a styleguide, protocol + one archive month. */
function buildLegacyFixture(root, { bcs = BCS } = {}) {
  write(root, '.agentheim/vision.md', '# Vision\n\nThe project vision.\n');
  write(root, '.agentheim/context-map.md', '# Context map\n\nThe context map.\n');

  for (const bc of bcs) {
    const includeConcepts = bc !== 'beta'; // 'beta' legally omits the Concepts block entirely.
    write(root, `.agentheim/contexts/${bc}/backlog/${bc}-004-a-backlog-task.md`, taskBody({ id: `${bc}-004`, title: 'A backlog task', status: 'backlog', context: bc }));
    write(root, `.agentheim/contexts/${bc}/todo/${bc}-002-a-todo-task.md`, taskBody({ id: `${bc}-002`, title: 'A todo task', status: 'todo', context: bc }));
    write(root, `.agentheim/contexts/${bc}/doing/${bc}-003-a-doing-task.md`, taskBody({ id: `${bc}-003`, title: 'A doing task', status: 'doing', context: bc }));
    write(root, `.agentheim/contexts/${bc}/done/${bc}-001-a-done-task.md`, taskBody({ id: `${bc}-001`, title: 'A done task', status: 'done', context: bc }));
    write(root, `.agentheim/contexts/${bc}/done-archive/2026-01.md`, `## ${bc}-000 -- An archived task\n\n\`done/${bc}-000.md\`\n`);
    write(root, `.agentheim/contexts/${bc}/README.md`, readmeFixture(bc));
    if (includeConcepts) {
      write(root, `.agentheim/contexts/${bc}/concepts/example-concept.md`, '# Example concept\n\nSynthesis page.\n');
    }
    write(root, `.agentheim/contexts/${bc}/INDEX.md`, indexFixture(bc, { includeConcepts }));
  }

  write(root, '.agentheim/contexts/design-system/styleguide/index.html', '<html></html>\n');
  write(root, '.agentheim/contexts/design-system/styleguide/app/main.js', 'export const x = 1;\n');

  write(root, '.agentheim/knowledge/index.md', topIndexFixture(bcs));
  write(root, '.agentheim/knowledge/decisions/0001-example-decision.md', '# ADR-0001\n');
  write(root, '.agentheim/knowledge/research/example-topic-2026-01-01.md', '# Example topic\n');

  write(root, '.agentheim/knowledge/protocol.md', protocolFixture());
  write(root, '.agentheim/knowledge/protocol/2026-01.md', '## 2026-01-01 00:00 -- Old entry\n\n**Type:** X\n\n---\n\n');
}

function assertNoStalePathReferences(content, label) {
  assert.equal(content.includes('.agentheim/contexts/'), false, `${label} still references .agentheim/contexts/`);
  for (const bc of BCS) {
    for (const folder of ['backlog', 'todo', 'doing', 'done', 'done-archive']) {
      assert.equal(content.includes(`contexts/${bc}/${folder}/`), false, `${label} still references contexts/${bc}/${folder}/`);
    }
  }
  assert.equal(content.includes('.agentheim/vision.md'), false, `${label} still references root-level vision.md`);
  assert.equal(content.includes('.agentheim/context-map.md'), false, `${label} still references root-level context-map.md`);
  assert.equal(content.includes('knowledge/protocol'), false, `${label} still references knowledge/protocol`);
}

function snapshotMtimes(root) {
  const map = new Map();
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else map.set(p, statSync(p).mtimeMs);
    }
  }
  walk(path.join(root, '.agentheim'));
  return map;
}

// ---------------------------------------------------------------------------
// Pure-function unit tests (splitIndexContent / the two pointer rewrites).
// ---------------------------------------------------------------------------

test('splitIndexContent: byte-verbatim retained content, the adr/research link-depth rewrite, and exactly one new Pointers line per half', () => {
  const legacy = indexFixture('widgets');
  const { taskHalf, knowledgeHalf } = splitIndexContent(legacy, 'widgets');

  assert.match(taskHalf, /^# Widgets — Index/);
  assert.match(taskHalf, /## Tasks by status/);
  assert.doesNotMatch(taskHalf, /## ADRs scoped to this BC/);
  assert.match(taskHalf, /- Done-list archive \(entries rolled out beyond the live cap, if any\): `done-archive\/2026-01\.md`/);

  assert.doesNotMatch(knowledgeHalf, /^# Widgets/);
  assert.match(knowledgeHalf, /## ADRs scoped to this BC/);
  assert.match(knowledgeHalf, /\.\.\/\.\.\/decisions\/0001-example-decision\.md/);
  assert.doesNotMatch(knowledgeHalf, /\.\.\/\.\.\/knowledge\/decisions\//);
  assert.match(knowledgeHalf, /\.\.\/\.\.\/research\/example-topic-2026-01-01\.md/);
  assert.match(knowledgeHalf, /- BC README \(ubiquitous language, invariants\): `README\.md`/);

  assert.match(taskHalf, /- Knowledge half \(ADRs \/ research \/ concepts \/ BC README\) for this BC: `\.\.\/\.\.\/knowledge\/contexts\/widgets\/INDEX\.md`/);
  assert.match(knowledgeHalf, /- Task board \(tasks by status\) for this BC: `\.\.\/\.\.\/\.\.\/board\/widgets\/INDEX\.md`/);
});

test('splitIndexContent: a BC INDEX missing the Concepts block entirely splits with that block simply absent -- never synthesized', () => {
  const legacy = indexFixture('widgets', { includeConcepts: false });
  const { knowledgeHalf } = splitIndexContent(legacy, 'widgets');
  assert.doesNotMatch(knowledgeHalf, /## Concepts/);
  assert.match(knowledgeHalf, /## ADRs scoped to this BC/);
  assert.match(knowledgeHalf, /## Research touching this BC/);
});

test('rewriteTopIndexPointers: knowledge/protocol.md and its archive path move to ../board/; vision.md/context-map.md/bc-list are untouched', () => {
  const before = topIndexFixture(['widgets']);
  const after = rewriteTopIndexPointers(before);
  assert.match(after, /`\.\.\/board\/protocol\.md`/);
  assert.match(after, /`\.\.\/board\/protocol\/YYYY-MM\.md`/);
  assert.match(after, /- Vision: `vision\.md`/);
  assert.match(after, /- Context map: `context-map\.md`/);
  assert.doesNotMatch(after, /knowledge\/protocol/);
  assert.match(after, /`contexts\/widgets\/INDEX\.md`/); // bc-list stays verbatim
});

test('rewriteReadmeContent: contexts/<bc>/ mentions move to board/, root vision/context-map/protocol mentions gain the knowledge/board prefix, and BC-local links deepen', () => {
  const bc = 'widgets';
  const before = readmeFixture(bc);
  const after = rewriteReadmeContent(before, bc);
  assert.doesNotMatch(after, /\.agentheim\/contexts\//);
  assert.match(after, /\.agentheim\/board\/widgets\/todo\//);
  assert.match(after, /\.agentheim\/board\/widgets\/INDEX\.md/);
  assert.match(after, /\.agentheim\/knowledge\/vision\.md/);
  assert.match(after, /\.agentheim\/knowledge\/context-map\.md/);
  assert.match(after, /\.agentheim\/board\/protocol\.md/);
  assert.doesNotMatch(after, /\.agentheim\/knowledge\/protocol\.md/);
  assert.match(after, /\.\.\/\.\.\/decisions\/0001-example-decision\.md/);
  assert.match(after, /\.\.\/\.\.\/research\/example-topic-2026-01-01\.md/);
});

// ---------------------------------------------------------------------------
// AC #1: the comprehensive legacy fixture.
// ---------------------------------------------------------------------------

test('migrate: comprehensive legacy fixture -- byte-identical moves, lossless INDEX split, board layout, contexts/ and root vision/context-map gone', () => {
  const root = makeRoot();
  try {
    buildLegacyFixture(root);

    const originalIndexes = {};
    const originalDoneTaskContent = {};
    for (const bc of BCS) {
      originalIndexes[bc] = readFileSync(path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md'), 'utf8');
      originalDoneTaskContent[bc] = readFileSync(path.join(root, '.agentheim', 'contexts', bc, 'done', `${bc}-001-a-done-task.md`), 'utf8');
    }
    const originalStyleguideHtml = readFileSync(path.join(root, '.agentheim', 'contexts', 'design-system', 'styleguide', 'index.html'), 'utf8');
    const originalVision = readFileSync(path.join(root, '.agentheim', 'vision.md'), 'utf8');
    const originalProtocolArchive = readFileSync(path.join(root, '.agentheim', 'knowledge', 'protocol', '2026-01.md'), 'utf8');

    const res = migrateLayout(root);
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'migrate');
    assert.deepEqual(res.changed, ['.agentheim']);
    assert.equal(typeof res.message, 'string');
    assert.ok(Array.isArray(res.moved) && res.moved.length > 0);

    assert.equal(detectLayout(root), 'board');
    assert.equal(existsSync(path.join(root, '.agentheim', 'contexts')), false);
    assert.equal(existsSync(path.join(root, '.agentheim', 'vision.md')), false);
    assert.equal(existsSync(path.join(root, '.agentheim', 'context-map.md')), false);

    // Byte-identical moves.
    assert.equal(readFileSync(visionPath(root, BOARD_OPT), 'utf8'), originalVision);
    assert.equal(readFileSync(path.join(protocolArchiveDir(root, BOARD_OPT), '2026-01.md'), 'utf8'), originalProtocolArchive);
    for (const bc of BCS) {
      const doneDest = path.join(taskFolderPath(root, bc, 'done', BOARD_OPT), `${bc}-001-a-done-task.md`);
      assert.equal(readFileSync(doneDest, 'utf8'), originalDoneTaskContent[bc]);
    }
    assert.equal(readFileSync(path.join(styleguideDir(root, BOARD_OPT), 'index.html'), 'utf8'), originalStyleguideHtml);

    // Lossless INDEX split: union of (transformed) lines matches, plus
    // exactly the two new cross-half Pointers lines per half.
    const transform = (line) => line.split('../../knowledge/decisions/').join('../../decisions/').split('../../knowledge/research/').join('../../research/');
    for (const bc of BCS) {
      const taskHalfContent = readFileSync(taskIndexPath(root, bc, BOARD_OPT), 'utf8');
      const knowledgeHalfContent = readFileSync(knowledgeIndexPath(root, bc, BOARD_OPT), 'utf8');
      const originalLines = new Set(originalIndexes[bc].split('\n').map((l) => l.trim()).filter(Boolean).map(transform));
      const unionLines = new Set([...taskHalfContent.split('\n'), ...knowledgeHalfContent.split('\n')].map((l) => l.trim()).filter(Boolean));
      for (const line of originalLines) {
        assert.ok(unionLines.has(line), `[${bc}] expected union to contain original (transformed) line: ${line}`);
      }
      const added = [...unionLines].filter((l) => !originalLines.has(l));
      assert.equal(added.length, 2, `[${bc}] expected exactly 2 added cross-half Pointers lines, got: ${JSON.stringify(added)}`);
      assert.ok(added.some((l) => l.includes(`knowledge/contexts/${bc}/INDEX.md`)));
      assert.ok(added.some((l) => l.includes(`board/${bc}/INDEX.md`)));
    }

    // 'beta' omitted Concepts entirely -- never synthesized on split.
    const betaKnowledge = readFileSync(knowledgeIndexPath(root, 'beta', BOARD_OPT), 'utf8');
    assert.equal(betaKnowledge.includes('## Concepts'), false);

    // Zero stale references, excluding knowledge/index.md's bc-list block.
    const topIndexContent = readFileSync(topIndexPath(root, BOARD_OPT), 'utf8');
    const topIndexOutsideBcList = topIndexContent.replace(/<!-- bc-list:start -->[\s\S]*?<!-- bc-list:end -->/, '');
    assertNoStalePathReferences(topIndexOutsideBcList, 'knowledge/index.md');
    for (const bc of BCS) {
      const readmeContent = readFileSync(bcReadmePath(root, bc, BOARD_OPT), 'utf8');
      assertNoStalePathReferences(readmeContent, `${bc}/README.md`);
    }

    // bc-list is left verbatim and still resolves relative to knowledge/index.md's own directory.
    for (const bc of BCS) {
      assert.match(topIndexContent, new RegExp(`contexts/${bc}/INDEX\\.md`));
      assert.equal(existsSync(path.join(path.dirname(topIndexPath(root, BOARD_OPT)), 'contexts', bc, 'INDEX.md')), true);
    }

    // Every rewritten README-relative link resolves.
    for (const bc of BCS) {
      const readmeDir = path.dirname(bcReadmePath(root, bc, BOARD_OPT));
      assert.equal(existsSync(path.join(readmeDir, '..', '..', 'decisions', '0001-example-decision.md')), true);
      assert.equal(existsSync(path.join(readmeDir, '..', '..', 'research', 'example-topic-2026-01-01.md')), true);
    }
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #2: no contexts/ at all -- the re-migrate-forever trap.
// ---------------------------------------------------------------------------

test('migrate: a fixture with no contexts/ at all (only knowledge/protocol.md) still produces board/, so a second migrate is a noop', () => {
  const root = makeRoot();
  try {
    write(root, '.agentheim/knowledge/protocol.md', protocolFixture());
    assert.equal(detectLayout(root), 'legacy');

    const first = migrateLayout(root);
    assert.equal(first.ok, true);
    assert.ok(!first.noop);
    assert.equal(detectLayout(root), 'board');
    assert.equal(existsSync(path.join(root, '.agentheim', 'board')), true);
    assert.equal(readFileSync(protocolPath(root, BOARD_OPT), 'utf8'), protocolFixture());

    const second = migrateLayout(root);
    assert.equal(second.ok, true);
    assert.equal(second.noop, true);
    assert.deepEqual(second.changed, []);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #3: idempotence -- zero writes, mtimes unchanged.
// ---------------------------------------------------------------------------

test('migrate: a second run on an already-migrated fixture is a noop with zero writes -- every file mtime is unchanged', () => {
  const root = makeRoot();
  try {
    buildLegacyFixture(root);
    const first = migrateLayout(root);
    assert.equal(first.ok, true);

    const before = snapshotMtimes(root);
    const second = migrateLayout(root);
    assert.equal(second.ok, true);
    assert.equal(second.noop, true);
    assert.deepEqual(second.changed, []);

    const after = snapshotMtimes(root);
    assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
    for (const [file, mtime] of before) {
      assert.equal(after.get(file), mtime, `expected ${file}'s mtime unchanged`);
    }
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #4: mixed fixture refusal.
// ---------------------------------------------------------------------------

test('migrate: a mixed fixture (both contexts/ and board/ present) refuses mixed-layout naming the path, zero writes', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', 'contexts', 'alpha'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', 'alpha'), { recursive: true });
    assert.equal(detectLayout(root), 'mixed');

    const res = migrateLayout(root);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'mixed-layout');
    assert.ok(res.reason.includes(root), 'expected the refusal reason to name the offending root path');
    assert.equal(existsSync(path.join(root, '.agentheim', 'contexts', 'alpha')), true);
    assert.equal(existsSync(path.join(root, '.agentheim', 'board', 'alpha')), true);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #5: layout-override discipline.
// ---------------------------------------------------------------------------

test('layout-override discipline: mid-migration a transiently-mixed tree resolves via explicit {layout} opts without any mixed-layout throw escaping', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', 'contexts', 'alpha', 'done'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', 'alpha', 'done'), { recursive: true });

    assert.equal(detectLayout(root), 'mixed');
    assert.throws(() => taskFolderPath(root, 'alpha', 'done'), (err) => err.code === 'mixed-layout');

    for (const layout of ['legacy', 'board']) {
      assert.doesNotThrow(() => taskFolderPath(root, 'alpha', 'done', { layout }));
      assert.doesNotThrow(() => doneArchiveDir(root, 'alpha', { layout }));
      assert.doesNotThrow(() => bcReadmePath(root, 'alpha', { layout }));
      assert.doesNotThrow(() => bcConceptsDir(root, 'alpha', { layout }));
      assert.doesNotThrow(() => taskIndexPath(root, 'alpha', { layout }));
      assert.doesNotThrow(() => knowledgeIndexPath(root, 'alpha', { layout }));
      assert.doesNotThrow(() => visionPath(root, { layout }));
      assert.doesNotThrow(() => contextMapPath(root, { layout }));
      assert.doesNotThrow(() => protocolPath(root, { layout }));
      assert.doesNotThrow(() => protocolArchiveDir(root, { layout }));
      assert.doesNotThrow(() => styleguideDir(root, { layout }));
    }

    // migrateLayout itself, called against a genuinely-mixed tree, refuses
    // BEFORE ever reaching the write phase -- it never guesses.
    const res = migrateLayout(root);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'mixed-layout');
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #7: the lifecycle lock (spawned two-process proof) + atomic-write safety.
// ---------------------------------------------------------------------------

function spawnCliCall(root, verb, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, verb, JSON.stringify(opts)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      try {
        resolve({ code, output: JSON.parse(out.trim()) });
      } catch (parseErr) {
        reject(new Error(`${verb} child produced unparseable output (exit ${code}, stderr ${err}): ${JSON.stringify(out)} -- ${parseErr.message}`));
      }
    });
  });
}

test('migrate holds the lifecycle lock for its whole write phase: a concurrent log call is forced to wait for it to release', async () => {
  const root = makeRoot();
  try {
    buildLegacyFixture(root);
    const H = 300; // ms -- forced hold inside the locked section, both children (agentic-workflow-dpbjj's pattern).
    const start = Date.now();
    const [migrateRes, logRes] = await Promise.all([
      spawnCliCall(root, 'migrate', { lock: { holdMs: H } }),
      spawnCliCall(root, 'log', { title: 'Concurrent log', body: 'body text', lock: { holdMs: H } }),
    ]);
    const elapsed = Date.now() - start;

    assert.equal(migrateRes.code, 0, `migrate should exit 0, got ${JSON.stringify(migrateRes.output)}`);
    assert.equal(migrateRes.output.ok, true);
    assert.equal(logRes.code, 0, `log should exit 0, got ${JSON.stringify(logRes.output)}`);
    assert.equal(logRes.output.ok, true);
    assert.ok(elapsed >= 2 * H, `expected full serialization (elapsed ${elapsed}ms, floor ${2 * H}ms) -- a fake or missing lock cannot reach this floor`);

    assert.equal(detectLayout(root), 'board');
    const finalProtocol = readFileSync(protocolPath(root), 'utf8');
    assert.match(finalProtocol, /Concurrent log/);
  } finally {
    cleanup(root);
  }
});

test('migrate: every rewritten file goes through writeFileAtomic -- a forced failure before the rename leaves no truncated file', () => {
  const root = makeRoot();
  try {
    buildLegacyFixture(root);
    const originalLegacyIndexes = {};
    for (const bc of BCS) {
      originalLegacyIndexes[bc] = readFileSync(path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md'), 'utf8');
    }

    let failed = false;
    const atomicWriteOpts = {
      injectFailureAfterWrite: () => {
        if (failed) return;
        failed = true;
        throw new Error('injected test failure before rename');
      },
    };

    assert.throws(() => migrateLayout(root, { atomicWriteOpts }), /injected test failure/);

    const failedBc = BCS.find(
      (bc) => !existsSync(taskIndexPath(root, bc, BOARD_OPT)) && existsSync(path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md'))
    );
    assert.ok(failedBc, 'expected exactly one BC to have a still-legacy, unsplit INDEX.md after the injected failure');
    assert.equal(readFileSync(path.join(root, '.agentheim', 'contexts', failedBc, 'INDEX.md'), 'utf8'), originalLegacyIndexes[failedBc]);
    assert.equal(existsSync(knowledgeIndexPath(root, failedBc, BOARD_OPT)), false);

    const boardBcDir = path.dirname(taskIndexPath(root, failedBc, BOARD_OPT));
    if (existsSync(boardBcDir)) {
      const stray = readdirSync(boardBcDir).filter((f) => f.endsWith('.tmp'));
      assert.deepEqual(stray, [], 'expected no stray .tmp file left behind');
    }
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// AC #8: runCli wiring + worktree-active refusal.
// ---------------------------------------------------------------------------

test('runCli(["migrate"]) is wired into the verb table/usage line, and returns the manifest shape', () => {
  const unknown = runCli(['not-a-real-verb']);
  assert.match(unknown.output.reason, /migrate/);

  const root = makeRoot();
  try {
    buildLegacyFixture(root);
    const { exitCode, output } = runCli(['migrate'], { discoverRoot: () => root });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'migrate');
    assert.deepEqual(output.changed, ['.agentheim']);
    assert.equal(typeof output.message, 'string');
  } finally {
    cleanup(root);
  }
});

test('migrate refuses worktree-active when a live "aw/" worker worktree is registered, leaving the legacy tree untouched', (t) => {
  if (!GIT_AVAILABLE) {
    t.skip('git not available');
    return;
  }
  const dir = makeRoot('aw-migrate-wt-');
  const wtPath = path.join(tmpdir(), `aw-migrate-wt-sibling-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    buildLegacyFixture(dir);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'base']);
    git(dir, ['worktree', 'add', '-b', 'aw/some-task', wtPath]);

    const { exitCode, output } = runCli(['migrate'], { discoverRoot: () => dir });
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'worktree-active');
    assert.match(output.reason, /aw\/some-task/);
    assert.equal(detectLayout(dir), 'legacy');
  } finally {
    try {
      git(dir, ['worktree', 'remove', '--force', wtPath]);
    } catch {
      // best effort
    }
    cleanup(dir, wtPath);
  }
});

// ---------------------------------------------------------------------------
// AC #9: runScopedCommit + git log --follow.
// ---------------------------------------------------------------------------

test('runScopedCommit(fixtureRepo, [".agentheim"], manifest.message) succeeds on the migrated fixture, and git log --follow finds the pre-migration commit', async (t) => {
  if (!GIT_AVAILABLE) {
    t.skip('git not available');
    return;
  }
  const dir = makeRoot('aw-migrate-commit-');
  try {
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    buildLegacyFixture(dir);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'base with legacy layout']);

    const res = migrateLayout(dir);
    assert.equal(res.ok, true);

    const commitRes = await runScopedCommit(dir, ['.agentheim'], res.message);
    assert.equal(commitRes.ok, true, JSON.stringify(commitRes));

    const movedDonePath = path.join(taskFolderPath(dir, 'alpha', 'done', BOARD_OPT), 'alpha-001-a-done-task.md');
    assert.equal(existsSync(movedDonePath), true);
    const log = git(dir, ['log', '--follow', '--oneline', '--', path.relative(dir, movedDonePath)]);
    assert.match(log, /base with legacy layout/);
  } finally {
    cleanup(dir);
  }
});
