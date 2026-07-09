import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { applyTaskMove, deriveContext, LIFECYCLE_FOLDERS, promoteTask, claimBatch, completeTask } from '../task-lifecycle.mjs';

const BC = 'agentic-workflow';
const FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/**
 * Build a throwaway project: <root>/.agentheim/contexts/<bc>/<folder>/ for each
 * lifecycle folder, with a single task file in `startFolder`.
 */
function makeProject({ id, status, dependsOn = [], startFolder, body = '## Why\n\nstuff\n' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw003-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const depsLine = `depends_on: [${dependsOn.join(', ')}]`;
  const file = path.join(bcDir, startFolder, `${id}.md`);
  const content = `---
id: ${id}
title: A task
status: ${status}
type: feature
context: ${BC}
created: 2026-06-06
completed:
commit:
${depsLine}
blocks: []
tags: []
---

${body}`;
  writeFileSync(file, content);
  return { root, bcDir, file };
}

function fileIn(bcDir, folder, id) {
  return path.join(bcDir, folder, `${id}.md`);
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('LIFECYCLE_FOLDERS lists the four lifecycle folders in order', () => {
  assert.deepEqual(LIFECYCLE_FOLDERS, FOLDERS);
});

test('legal backlog→todo promote moves the file and rewrites status together', () => {
  const id = 'agentic-workflow-100';
  const { root, bcDir } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    assert.equal(res.state.from, 'backlog');
    assert.equal(res.state.to, 'todo');
    assert.equal(res.state.status, 'todo');

    // file gone from backlog, present in todo
    assert.equal(existsSync(fileIn(bcDir, 'backlog', id)), false);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);

    // frontmatter status rewritten to match the new folder
    const moved = readFileSync(fileIn(bcDir, 'todo', id), 'utf8');
    assert.match(moved, /^status: todo$/m);
    assert.doesNotMatch(moved, /^status: backlog$/m);
  } finally {
    cleanup(root);
  }
});

test('applyTaskMove reports the pre-move source path via state.fromPath, and that path is absent post-move (infrastructure-h8k2m regression)', () => {
  const id = 'agentic-workflow-102';
  const { root, bcDir } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const expectedFromPath = fileIn(bcDir, 'backlog', id);
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    // `state.fromPath` is the caller's handle on the vacated source path, so a
    // manifest built on top of `applyTaskMove` (promoteTask/claimBatch/
    // completeTask) can enumerate it in `changed` for a scoped `git add` to
    // stage the deletion — without this, only the new-location file was
    // reported and the source-path copy was left stranded (the reported bug).
    assert.equal(res.state.fromPath, expectedFromPath);
    assert.notEqual(res.state.fromPath, res.state.path);
    assert.equal(existsSync(res.state.fromPath), false);
    assert.equal(existsSync(res.state.path), true);
  } finally {
    cleanup(root);
  }
});

test('illegal doing→done move is rejected with a structured domain reason and no filesystem change', () => {
  const id = 'agentic-workflow-101';
  const { root, bcDir } = makeProject({ id, status: 'doing', startFolder: 'doing' });
  try {
    const res = applyTaskMove(root, id, 'doing', 'done', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'illegal-move');
    assert.equal(typeof res.reason, 'string');
    assert.ok(res.reason.length > 0);

    // nothing moved, status untouched
    assert.equal(existsSync(fileIn(bcDir, 'doing', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'done', id)), false);
    const still = readFileSync(fileIn(bcDir, 'doing', id), 'utf8');
    assert.match(still, /^status: doing$/m);
  } finally {
    cleanup(root);
  }
});

test('promote blocked by an unmet depends_on (frontend gate) is rejected with no filesystem change', () => {
  const id = 'agentic-workflow-102';
  const dep = 'design-system-001-styleguide';
  const { root, bcDir } = makeProject({
    id,
    status: 'backlog',
    startFolder: 'backlog',
    dependsOn: [dep],
  });
  try {
    // dep is NOT in done/ anywhere → promote must be blocked
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'blocked-dependency');
    assert.match(res.reason, /depends_on|dependency|styleguide|design-system-001-styleguide/i);

    // unchanged on disk
    assert.equal(existsSync(fileIn(bcDir, 'backlog', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), false);
  } finally {
    cleanup(root);
  }
});

test('promote allowed once the depends_on is satisfied (dependency present in done/)', () => {
  const id = 'agentic-workflow-103';
  const dep = 'design-system-001-styleguide';
  const { root, bcDir } = makeProject({
    id,
    status: 'backlog',
    startFolder: 'backlog',
    dependsOn: [dep],
  });
  try {
    // satisfy the dependency by placing it in another BC's done/ folder
    const depDoneDir = path.join(root, '.agentheim', 'contexts', 'design-system', 'done');
    mkdirSync(depDoneDir, { recursive: true });
    writeFileSync(path.join(depDoneDir, `${dep}.md`), '---\nid: design-system-001-styleguide\nstatus: done\n---\n');

    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
  } finally {
    cleanup(root);
  }
});

test('promote allowed when depends_on uses the bare id but the done/ file is slugged (<id>-<slug>.md)', () => {
  // Real-world shape: a task declares `depends_on: [design-system-001]` (bare
  // id) while the satisfied dependency lives on disk as
  // `design-system-001-styleguide.md`. The gate must match the slugged file,
  // not require an exact `<id>.md`.
  const id = 'agentic-workflow-105';
  const dep = 'design-system-001';
  const { root, bcDir } = makeProject({
    id,
    status: 'backlog',
    startFolder: 'backlog',
    dependsOn: [dep],
  });
  try {
    const depDoneDir = path.join(root, '.agentheim', 'contexts', 'design-system', 'done');
    mkdirSync(depDoneDir, { recursive: true });
    // Note: filename carries a slug; the bare dep id is only a prefix of it.
    writeFileSync(
      path.join(depDoneDir, `${dep}-styleguide.md`),
      '---\nid: design-system-001\nstatus: done\n---\n'
    );

    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
  } finally {
    cleanup(root);
  }
});

test('a satisfied dependency must not be confused with a longer-numbered sibling (prefix collision)', () => {
  // `depends_on: [design-system-001]` must NOT be satisfied by
  // `design-system-0015-*.md` sitting in done/. The trailing-hyphen guard keeps
  // these distinct.
  const id = 'agentic-workflow-106';
  const dep = 'design-system-001';
  const { root, bcDir } = makeProject({
    id,
    status: 'backlog',
    startFolder: 'backlog',
    dependsOn: [dep],
  });
  try {
    const depDoneDir = path.join(root, '.agentheim', 'contexts', 'design-system', 'done');
    mkdirSync(depDoneDir, { recursive: true });
    // Only a longer-numbered sibling is done — the real dep is not.
    writeFileSync(
      path.join(depDoneDir, 'design-system-0015-something.md'),
      '---\nid: design-system-0015\nstatus: done\n---\n'
    );

    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'blocked-dependency');

    assert.equal(existsSync(fileIn(bcDir, 'backlog', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), false);
  } finally {
    cleanup(root);
  }
});

test('stale precondition: expected `from` disagrees with disk → reject, no filesystem change', () => {
  const id = 'agentic-workflow-104';
  // file actually lives in todo, but caller believes it is still in backlog
  const { root, bcDir } = makeProject({ id, status: 'todo', startFolder: 'todo' });
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'stale-precondition');
    assert.match(res.reason, /already moved|not in|precondition|backlog/i);

    // disk untouched: file is still exactly where it was
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'backlog', id)), false);
  } finally {
    cleanup(root);
  }
});

test('stale precondition: mtime disagrees with the expected mtime → reject, no filesystem change', () => {
  const id = 'agentic-workflow-105';
  const { root, bcDir } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo', {
      context: BC,
      expectedMtimeMs: 1, // deliberately wrong
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'stale-precondition');
    assert.match(res.reason, /mtime|already moved|changed|modified/i);

    assert.equal(existsSync(fileIn(bcDir, 'backlog', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), false);
  } finally {
    cleanup(root);
  }
});

test('matching mtime precondition is honored and the promote succeeds', () => {
  const id = 'agentic-workflow-106';
  const { root, bcDir } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const mtimeMs = statSync(fileIn(bcDir, 'backlog', id)).mtimeMs;
    const res = applyTaskMove(root, id, 'backlog', 'todo', {
      context: BC,
      expectedMtimeMs: mtimeMs,
    });
    assert.equal(res.ok, true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
  } finally {
    cleanup(root);
  }
});

test('missing task file is rejected, not thrown', () => {
  const id = 'agentic-workflow-107';
  const { root } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const res = applyTaskMove(root, 'agentic-workflow-999', 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not-found');
  } finally {
    cleanup(root);
  }
});

test('resolves a slugged task file (<id>-<slug>.md) from its bare id and preserves the filename across the move', () => {
  // Real task files are named <id>-<slug>.md while the id is the bare <id>. The
  // mover must map id → file and keep the slug when it moves the file.
  const id = 'agentic-workflow-110';
  const root = mkdtempSync(path.join(tmpdir(), 'aw003-slug-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-descriptive-slug.md`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    `---\nid: ${id}\nstatus: backlog\ncontext: ${BC}\ndepends_on: []\n---\nbody`
  );
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    // The slugged filename rode along — only the folder changed.
    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), false);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.match(readFileSync(path.join(bcDir, 'todo', fileName), 'utf8'), /^status: todo$/m);
  } finally {
    cleanup(root);
  }
});

test('a bare id does not collide with a longer-numbered sibling (alpha-001 vs alpha-0010)', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw003-collide-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  // Only the longer-numbered sibling exists; resolving the bare id must NOT find it.
  writeFileSync(
    path.join(bcDir, 'backlog', `${BC}-1110-other.md`),
    `---\nid: ${BC}-1110\nstatus: backlog\ncontext: ${BC}\ndepends_on: []\n---\nbody`
  );
  try {
    const res = applyTaskMove(root, `${BC}-111`, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not-found');
    // The sibling was untouched.
    assert.equal(existsSync(path.join(bcDir, 'backlog', `${BC}-1110-other.md`)), true);
  } finally {
    cleanup(root);
  }
});

test('a fuller skill-driven move (todo→doing claim) is legal when policy=skill', () => {
  const id = 'agentic-workflow-108';
  const { root, bcDir } = makeProject({ id, status: 'todo', startFolder: 'todo' });
  try {
    const res = applyTaskMove(root, id, 'todo', 'doing', { context: BC, policy: 'skill' });
    assert.equal(res.ok, true);
    assert.equal(existsSync(fileIn(bcDir, 'doing', id)), true);
    const moved = readFileSync(fileIn(bcDir, 'doing', id), 'utf8');
    assert.match(moved, /^status: doing$/m);
  } finally {
    cleanup(root);
  }
});

test('the same todo→doing claim is rejected under the default UI policy', () => {
  const id = 'agentic-workflow-109';
  const { root, bcDir } = makeProject({ id, status: 'todo', startFolder: 'todo' });
  try {
    const res = applyTaskMove(root, id, 'todo', 'doing', { context: BC }); // default policy = 'ui'
    assert.equal(res.ok, false);
    assert.equal(res.code, 'illegal-move');
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
    assert.equal(existsSync(fileIn(bcDir, 'doing', id)), false);
  } finally {
    cleanup(root);
  }
});

// --- deriveContext: dual-shape id resolution (ADR-0028 §4, amended ADR-0044) -

test('deriveContext derives the BC from a legacy all-digit tail (unchanged)', () => {
  assert.equal(deriveContext('agentic-workflow-077'), 'agentic-workflow');
});

test('deriveContext derives the BC from a new leading-letter token tail', () => {
  assert.equal(deriveContext('agentic-workflow-k3f9q'), 'agentic-workflow');
});

test('deriveContext derives the BC from other legacy all-digit tails, including reserved foundation ids', () => {
  assert.equal(deriveContext('infrastructure-020'), 'infrastructure');
  assert.equal(deriveContext('design-system-001'), 'design-system');
  assert.equal(deriveContext('infrastructure-001'), 'infrastructure');
});

test('deriveContext keeps the greedy BC-name match for hyphenated BC names (unaffected by the loosening)', () => {
  assert.equal(deriveContext('design-system-q7r2m'), 'design-system');
  assert.equal(deriveContext('agentic-workflow-077'), 'agentic-workflow');
});

test('deriveContext resolves a digit-leading 5-char token (ADR-0044 reverses aw-078)', () => {
  // `3f9qx` leads with a digit. It is still 5 chars over the Crockford-minus-
  // `ilou` charset, so ADR-0044 loosens the resolver's token branch to accept
  // it — the resolver is now digit-lead-tolerant even though a *minter* would
  // reject this token as out-of-spec (lib/id-grammar.mjs classifies it
  // `malformed`). This reverses the agentic-workflow-078 property that "a
  // digit-leading tail is never a new token" for the resolver only; it fixes
  // the strand a real out-of-spec id (`infrastructure-5w5gs`) caused in the
  // mechanized lifecycle verbs.
  assert.equal(deriveContext('agentic-workflow-3f9qx'), 'agentic-workflow');
});

test('deriveContext resolves the real out-of-spec grandfathered id infrastructure-5w5gs', () => {
  assert.equal(deriveContext('infrastructure-5w5gs'), 'infrastructure');
});

test('deriveContext falls through unchanged for a 6-char digit-leading tail (length-validating)', () => {
  // The loosening is length-validating, not shape-agnostic: a 6-char tail is
  // never a valid token shape (legacy or new), regardless of charset.
  const id = 'agentic-workflow-3f9qxz';
  assert.equal(deriveContext(id), id);
});

test('deriveContext returns the id unchanged when there is no recognizable tail', () => {
  assert.equal(deriveContext('nodashhere'), 'nodashhere');
});

test('deriveContext does not admit the look-alike `u` in a token', () => {
  // ADR-0028 §1: Crockford base32 minus `i l o u`. A tail leading with `u`
  // (`uuuuu`) is not a valid token, so it must not be treated as one — the id
  // falls through to the unchanged fallback rather than splitting on it.
  const id = 'agentic-workflow-uuuuu';
  assert.equal(deriveContext(id), id);
});

// --- resolveTaskFile: token-tailed slugged file resolution (ADR-0012) ------

test('a token-tailed <id>-<slug>.md file resolves from the bare id (no code change)', () => {
  // resolveTaskFile is exercised via applyTaskMove: it must locate a slugged
  // file named `<token-id>-<slug>.md` from the bare token id via ADR-0012's
  // trailing-`-` anchor, with no change to resolveTaskFile.
  const id = 'agentic-workflow-k3f9q';
  const root = mkdtempSync(path.join(tmpdir(), 'aw078-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const file = path.join(bcDir, 'backlog', `${id}-some-slug.md`);
  writeFileSync(
    file,
    `---\nid: ${id}\ntitle: A task\nstatus: backlog\ntype: feature\ncontext: ${BC}\ncreated: 2026-06-18\ncompleted:\ncommit:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo', { context: BC });
    assert.equal(res.ok, true);
    // The slugged filename rides along across the move (ADR-0012 §1).
    assert.equal(existsSync(path.join(bcDir, 'todo', `${id}-some-slug.md`)), true);
    assert.equal(existsSync(path.join(bcDir, 'backlog', `${id}-some-slug.md`)), false);
  } finally {
    cleanup(root);
  }
});

test('a token-tailed task moves with deriveContext supplying the BC (no context option)', () => {
  // Exercises deriveContext end-to-end through applyTaskMove for the new shape:
  // no `context` option, so the BC must be derived from the bare token id.
  const id = 'agentic-workflow-k3f9q';
  const { root, bcDir } = makeProject({ id, status: 'backlog', startFolder: 'backlog' });
  try {
    const res = applyTaskMove(root, id, 'backlog', 'todo'); // no context → deriveContext
    assert.equal(res.ok, true);
    assert.equal(existsSync(fileIn(bcDir, 'todo', id)), true);
  } finally {
    cleanup(root);
  }
});

// --- promoteTask: the git-free PROMOTE lifecycle script (ADR-0038 Ruling B) ---

function makeIndexMd({
  backlogLines = [],
  todoLines = [],
  doingLines = [],
  counts = { Backlog: 0, Todo: 0, Doing: 0, Done: 0 },
} = {}) {
  return `# Agentic Workflow — Index

Catalog of everything in this bounded context.

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** ${counts.Backlog}
- **Todo:** ${counts.Todo}
- **Doing:** ${counts.Doing}
- **Done:** ${counts.Done}
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
${todoLines.map((l) => l + '\n').join('')}<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
${doingLines.map((l) => l + '\n').join('')}<!-- doing-list:end -->

### Done
<!-- done-list:start -->
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
<!-- adr-local:end -->
`;
}

/** Build a promoteTask-ready project: task file in backlog/ + a matching INDEX.md. */
function makePromoteProject({
  id,
  title = 'A promotable task',
  type = 'feature',
  dependsOn = [],
  protocolContent = undefined,
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-promote-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  const depsLine = `depends_on: [${dependsOn.join(', ')}]`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: ${type}\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\n${depsLine}\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  const indexPath = path.join(bcDir, 'INDEX.md');
  writeFileSync(
    indexPath,
    makeIndexMd({
      backlogLines: [`- **${id}** — ${title} (${type}) — \`backlog/${fileName}\``],
      counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
    })
  );
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  if (protocolContent !== undefined) writeFileSync(protocolPath, protocolContent);
  return { root, bcDir, indexPath, protocolPath, fileName };
}

test('promoteTask moves the file, edits INDEX markers + counts, prepends protocol.md, and returns an enumerated manifest', () => {
  const id = 'agentic-workflow-200';
  const title = 'A promotable task';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProject({ id, title });
  const now = new Date(2026, 6, 3, 14, 30); // 2026-07-03 14:30, local
  try {
    const res = promoteTask(root, id, { context: BC, now });
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'promote');
    assert.equal(res.id, id);
    assert.equal(res.message, `model(${BC}): promote ${id} — ${title} [${id}]`);

    const taskPath = path.join(bcDir, 'todo', fileName);
    const backlogPath = path.join(bcDir, 'backlog', fileName);
    // `changed` must enumerate BOTH halves of the rename — the vacated
    // backlog/ source path and the new todo/ destination — so a caller's
    // scoped `git add` of `changed` stages the source deletion too
    // (infrastructure-h8k2m; ADR-0038).
    assert.deepEqual(new Set(res.changed), new Set([backlogPath, taskPath, indexPath, protocolPath]));

    // The move actually happened (applyTaskMove was invoked, not re-implemented).
    assert.equal(existsSync(backlogPath), false);
    assert.equal(existsSync(taskPath), true);
    assert.match(readFileSync(taskPath, 'utf8'), /^status: todo$/m);

    // INDEX.md: backlog line gone, todo line present at the top, counts shifted.
    const indexContent = readFileSync(indexPath, 'utf8');
    assert.doesNotMatch(indexContent, new RegExp(`backlog-list:start[\\s\\S]*\\*\\*${id}\\*\\*`));
    assert.match(indexContent, new RegExp(`todo-list:start -->\\n- \\*\\*${id}\\*\\* — ${title} \\(feature\\) — \`todo/${fileName}\``));
    assert.match(indexContent, /\*\*Backlog:\*\* 0/);
    assert.match(indexContent, /\*\*Todo:\*\* 1/);

    // protocol.md: created fresh, header intact, new entry prepended right after it.
    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, /^# Protocol\n/);
    assert.match(protocolContent, new RegExp(`## 2026-07-03 14:30 -- Modeling / Promoted: ${id} - ${title}`));
    assert.match(protocolContent, /\*\*Type:\*\* Modeling \/ Promote/);
    assert.match(protocolContent, new RegExp(`\\*\\*BC:\\*\\* ${BC}`));
    assert.match(protocolContent, /\*\*From → To:\*\* backlog → todo/);
  } finally {
    cleanup(root);
  }
});

test('promoteTask prepends to an existing protocol.md, keeping the older entries below', () => {
  const id = 'agentic-workflow-201';
  const existingProtocol = `# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n## 2026-07-02 09:00 -- Some older entry\n\n**Type:** Work / Task completion\n\n---\n\n`;
  const { root, protocolPath } = makePromoteProject({ id, protocolContent: existingProtocol });
  try {
    const res = promoteTask(root, id, { context: BC, now: new Date(2026, 6, 3, 10, 0) });
    assert.equal(res.ok, true);
    const content = readFileSync(protocolPath, 'utf8');
    const newIdx = content.indexOf(`Modeling / Promoted: ${id}`);
    const oldIdx = content.indexOf('Some older entry');
    assert.ok(newIdx > -1 && oldIdx > -1 && newIdx < oldIdx, 'new entry must sit above the older one');
  } finally {
    cleanup(root);
  }
});

test('promoteTask is fail-closed on an unmet depends_on: no move, no INDEX/protocol write (ADR-0038 Ruling A)', () => {
  const id = 'agentic-workflow-202';
  const dep = 'design-system-001-styleguide';
  const { root, indexPath, protocolPath } = makePromoteProject({ id, dependsOn: [dep] });
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'blocked-dependency');
    assert.equal(res.changed, undefined);

    // Nothing was written: INDEX.md untouched, protocol.md never created.
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

test('promoteTask propagates an illegal-move rejection from applyTaskMove untouched', () => {
  const id = 'agentic-workflow-203';
  const { root, bcDir, indexPath } = makePromoteProject({ id });
  // Task is actually already in todo/, not backlog/ — applyTaskMove's stale-precondition path.
  const backlogFile = path.join(bcDir, 'backlog', `${id}-a-slug.md`);
  const todoFile = path.join(bcDir, 'todo', `${id}-a-slug.md`);
  const preMoved = readFileSync(backlogFile, 'utf8').replace('status: backlog', 'status: todo');
  writeFileSync(todoFile, preMoved);
  rmSync(backlogFile);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'stale-precondition');
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
  } finally {
    cleanup(root);
  }
});

// --- claimBatch: the git-free, batch CLAIM lifecycle script (agentic-workflow-t7m4c) ---

/** Build a claimBatch-ready project: one or more task files in todo/ across one or more BCs. */
function makeClaimProject({ tasks, protocolContent = undefined } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-claim-'));
  const byBc = new Map();
  for (const t of tasks) {
    const bc = t.context ?? BC;
    if (!byBc.has(bc)) byBc.set(bc, []);
    byBc.get(bc).push(t);
  }
  const paths = {};
  for (const [bc, bcTasks] of byBc) {
    const bcDir = path.join(root, '.agentheim', 'contexts', bc);
    for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
    const todoLines = [];
    for (const t of bcTasks) {
      const fileName = `${t.id}-a-slug.md`;
      writeFileSync(
        path.join(bcDir, 'todo', fileName),
        `---\nid: ${t.id}\ntitle: ${t.title}\nstatus: todo\ntype: ${t.type ?? 'feature'}\ncontext: ${bc}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
      );
      todoLines.push(`- **${t.id}** — ${t.title} (${t.type ?? 'feature'}) — \`todo/${fileName}\``);
      paths[t.id] = { bcDir, fileName };
    }
    const indexPath = path.join(bcDir, 'INDEX.md');
    writeFileSync(
      indexPath,
      makeIndexMd({ todoLines, counts: { Backlog: 0, Todo: bcTasks.length, Doing: 0, Done: 0 } })
    );
    paths[`__index_${bc}`] = indexPath;
  }
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  if (protocolContent !== undefined) writeFileSync(protocolPath, protocolContent);
  return { root, paths, protocolPath };
}

test('claimBatch moves a single task todo -> doing, edits INDEX, and writes one Batch started entry', () => {
  const id = 'agentic-workflow-400';
  const title = 'A claimable task';
  const { root, paths, protocolPath } = makeClaimProject({ tasks: [{ id, title }] });
  const now = new Date(2026, 6, 3, 9, 0);
  try {
    const res = claimBatch(root, [id], { now });
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'claim');
    assert.deepEqual(res.ids, [id]);

    const { bcDir, fileName } = paths[id];
    const taskPath = path.join(bcDir, 'doing', fileName);
    const todoPath = path.join(bcDir, 'todo', fileName);
    assert.equal(existsSync(taskPath), true);
    assert.equal(existsSync(todoPath), false);
    assert.match(readFileSync(taskPath, 'utf8'), /^status: doing$/m);

    const indexContent = readFileSync(paths[`__index_${BC}`], 'utf8');
    assert.match(indexContent, /todo-list:start -->\n<!-- todo-list:end -->/);
    assert.match(indexContent, new RegExp(`doing-list:start -->\\n- \\*\\*${id}\\*\\* — ${title} \\(feature\\) — \`doing/${fileName}\``));
    assert.match(indexContent, /\*\*Todo:\*\* 0/);
    assert.match(indexContent, /\*\*Doing:\*\* 1/);

    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`## 2026-07-03 09:00 -- Batch started: \\[${id}\\]`));
    assert.match(protocolContent, /\*\*Type:\*\* Work \/ Batch start/);
    assert.match(protocolContent, new RegExp(`\\*\\*Tasks:\\*\\* ${id} - ${title}`));
    assert.match(protocolContent, /\*\*Parallel:\*\* no \(1 worker\)/);

    assert.equal(res.message, `chore(${BC}): batch start [${id}]`);
    // `changed` must enumerate BOTH the vacated todo/ source path and the new
    // doing/ destination, so a caller's scoped `git add` of `changed` stages
    // the rename atomically instead of leaving a stale duplicate tracked at
    // the source path (infrastructure-h8k2m; ADR-0038; the conductor-observed
    // batch-start bug this task fixes).
    assert.deepEqual(new Set(res.changed), new Set([todoPath, taskPath, paths[`__index_${BC}`], protocolPath]));
  } finally {
    cleanup(root);
  }
});

test('claimBatch: changed lists the vacated todo/ source path for every task in a multi-id batch, not just each destination', () => {
  const ids = ['agentic-workflow-406', 'agentic-workflow-407'];
  const { root, paths, protocolPath } = makeClaimProject({
    tasks: [
      { id: ids[0], title: 'First task' },
      { id: ids[1], title: 'Second task' },
    ],
  });
  try {
    const res = claimBatch(root, ids, { now: new Date(2026, 6, 3, 9, 20) });
    assert.equal(res.ok, true);

    const expected = new Set([paths[`__index_${BC}`], protocolPath]);
    for (const id of ids) {
      const { bcDir, fileName } = paths[id];
      const todoPath = path.join(bcDir, 'todo', fileName);
      const doingPath = path.join(bcDir, 'doing', fileName);
      expected.add(todoPath);
      expected.add(doingPath);
      // Regression: the source path must be gone from disk post-move...
      assert.equal(existsSync(todoPath), false);
      assert.equal(existsSync(doingPath), true);
    }
    // ...AND must be named in `changed` so a scoped `git add` stages its
    // deletion (this is the actual bug: the mover already deletes it on disk,
    // but a prior manifest omitted it, leaving a stale duplicate once the
    // caller's scoped `git add` ran only against the destinations).
    assert.deepEqual(new Set(res.changed), expected);
  } finally {
    cleanup(root);
  }
});

test('claimBatch moves several same-BC tasks in one call, one manifest, one protocol entry listing all', () => {
  const ids = ['agentic-workflow-401', 'agentic-workflow-402'];
  const { root, paths, protocolPath } = makeClaimProject({
    tasks: [
      { id: ids[0], title: 'First task' },
      { id: ids[1], title: 'Second task' },
    ],
  });
  try {
    const res = claimBatch(root, ids, { now: new Date(2026, 6, 3, 9, 5), parallel: 'yes (2 workers)' });
    assert.equal(res.ok, true);
    assert.deepEqual(res.ids, ids);

    for (const id of ids) {
      const { bcDir, fileName } = paths[id];
      assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    }
    const indexContent = readFileSync(paths[`__index_${BC}`], 'utf8');
    assert.match(indexContent, /\*\*Todo:\*\* 0/);
    assert.match(indexContent, /\*\*Doing:\*\* 2/);

    const protocolContent = readFileSync(protocolPath, 'utf8');
    // exactly one "Batch started" heading for this call
    const matches = protocolContent.match(/-- Batch started:/g) ?? [];
    assert.equal(matches.length, 1);
    assert.match(protocolContent, new RegExp(`Batch started: \\[${ids[0]}, ${ids[1]}\\]`));
    assert.match(protocolContent, /\*\*Tasks:\*\* agentic-workflow-401 - First task, agentic-workflow-402 - Second task/);
    assert.match(protocolContent, /\*\*Parallel:\*\* yes \(2 workers\)/);
    assert.equal(res.message, `chore(${BC}): batch start [${ids[0]}] [${ids[1]}]`);
  } finally {
    cleanup(root);
  }
});

test('claimBatch spanning two BCs edits each BC INDEX.md separately and drops the <bc> token from the message', () => {
  const idA = 'agentic-workflow-403';
  const idB = 'design-system-050';
  const { root, paths, protocolPath } = makeClaimProject({
    tasks: [
      { id: idA, title: 'AW task', context: BC },
      { id: idB, title: 'DS task', context: 'design-system' },
    ],
  });
  try {
    const res = claimBatch(root, [idA, idB], { now: new Date(2026, 6, 3, 9, 10) });
    assert.equal(res.ok, true);

    const awIndex = readFileSync(paths[`__index_${BC}`], 'utf8');
    const dsIndex = readFileSync(paths['__index_design-system'], 'utf8');
    assert.match(awIndex, new RegExp(`\\*\\*${idA}\\*\\*`));
    assert.doesNotMatch(awIndex, new RegExp(`\\*\\*${idB}\\*\\*`));
    assert.match(dsIndex, new RegExp(`\\*\\*${idB}\\*\\*`));
    assert.doesNotMatch(dsIndex, new RegExp(`\\*\\*${idA}\\*\\*`));

    // one protocol entry, both ids named
    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`Batch started: \\[${idA}, ${idB}\\]`));

    // no single BC to attribute the commit message to
    assert.equal(res.message, `chore: batch start [${idA}] [${idB}]`);
  } finally {
    cleanup(root);
  }
});

test('claimBatch pre-checks the whole set: one missing id aborts the batch with nothing moved', () => {
  const idPresent = 'agentic-workflow-404';
  const idMissing = 'agentic-workflow-405';
  const { root, paths } = makeClaimProject({ tasks: [{ id: idPresent, title: 'Present' }] });
  const indexBefore = readFileSync(paths[`__index_${BC}`], 'utf8');
  try {
    const res = claimBatch(root, [idPresent, idMissing]);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not-found');
    assert.match(res.reason, new RegExp(idMissing));

    // nothing moved, even the id that WAS found
    const { bcDir, fileName } = paths[idPresent];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(paths[`__index_${BC}`], 'utf8'), indexBefore);
  } finally {
    cleanup(root);
  }
});

// --- completeTask: the git-free COMPLETE lifecycle script (agentic-workflow-t7m4c) ---

/** Build a completeTask-ready project: one task file in `startFolder` + a matching INDEX.md. */
function makeCompleteProject({
  id,
  title = 'A completable task',
  type = 'feature',
  startFolder = 'doing',
  protocolContent = undefined,
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-complete-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  const status = startFolder === 'done' ? 'done' : 'doing';
  writeFileSync(
    path.join(bcDir, startFolder, fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\ntype: ${type}\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  // INDEX.md always models the PRE-bookkeeping state — the task still listed in
  // doing-list with Doing:1/Done:0 — regardless of which physical folder the task
  // file itself sits in. That's the real ADR-0032 shape: INDEX.md is
  // conductor-only and untouched by the worker/squash-merge, so on `main`,
  // before `completeTask` runs, it always still reflects "doing" even when the
  // worktree already physically moved the file to done/ (the idempotent case).
  const indexPath = path.join(bcDir, 'INDEX.md');
  writeFileSync(
    indexPath,
    makeIndexMd({
      todoLines: [],
      doingLines: [`- **${id}** — ${title} (${type}) — \`doing/${fileName}\``],
      counts: { Backlog: 0, Todo: 0, Doing: 1, Done: 0 },
    })
  );
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  if (protocolContent !== undefined) writeFileSync(protocolPath, protocolContent);
  return { root, bcDir, indexPath, protocolPath, fileName };
}

test('completeTask moves doing -> done, edits INDEX markers + counts, prepends a verified-and-completed protocol entry', () => {
  const id = 'agentic-workflow-500';
  const title = 'A completable task';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id, title });
  const now = new Date(2026, 6, 3, 15, 0);
  try {
    const res = completeTask(root, id, {
      context: BC,
      now,
      summary: 'Landed the thing',
      duration: '4m12s',
      verification: 'PASS (iteration 1)',
      filesChanged: 3,
      testsAdded: 2,
      adrsWritten: 'none',
    });
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'complete');
    assert.equal(res.id, id);
    assert.equal(res.idempotent, false);

    const taskPath = path.join(bcDir, 'done', fileName);
    const doingPath = path.join(bcDir, 'doing', fileName);
    assert.equal(existsSync(doingPath), false);
    assert.equal(existsSync(taskPath), true);
    assert.match(readFileSync(taskPath, 'utf8'), /^status: done$/m);
    // `changed` must enumerate BOTH the vacated doing/ source path and the new
    // done/ destination (infrastructure-h8k2m; ADR-0038) — same rename-manifest
    // fix as promoteTask/claimBatch.
    assert.deepEqual(new Set(res.changed), new Set([doingPath, taskPath, indexPath, protocolPath]));

    const indexContent = readFileSync(indexPath, 'utf8');
    assert.match(indexContent, /doing-list:start -->\n<!-- doing-list:end -->/);
    assert.match(indexContent, new RegExp(`done-list:start -->\\n- \\*\\*${id}\\*\\* — ${title} \\(feature\\) — \`done/${fileName}\``));
    assert.match(indexContent, /\*\*Doing:\*\* 0/);
    assert.match(indexContent, /\*\*Done:\*\* 1/);

    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`## 2026-07-03 15:00 -- Task verified and completed: ${id} - ${title}`));
    assert.match(protocolContent, /\*\*Summary:\*\* Landed the thing/);
    assert.match(protocolContent, /\*\*Duration:\*\* 4m12s/);
    assert.match(protocolContent, /\*\*Verification:\*\* PASS \(iteration 1\)/);
    assert.match(protocolContent, /\*\*Files changed:\*\* 3/);
    assert.match(protocolContent, /\*\*Tests added:\*\* 2/);
    assert.match(protocolContent, /\*\*ADRs written:\*\* none/);

    assert.equal(res.message, `feature(${BC}): Landed the thing [${id}]`);
  } finally {
    cleanup(root);
  }
});

test('completeTask is idempotent: file already in done/ (worktree already moved it) -> proceed to bookkeeping, not an error', () => {
  const id = 'agentic-workflow-501';
  const title = 'Already merged by the worktree';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id, title, startFolder: 'done' });
  try {
    const res = completeTask(root, id, { context: BC, summary: 'Done already', verification: 'PASS (iteration 1)' });
    assert.equal(res.ok, true);
    assert.equal(res.idempotent, true);

    // still exactly one file, in done/
    const taskPath = path.join(bcDir, 'done', fileName);
    assert.equal(existsSync(taskPath), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    // The idempotent branch never vacated a doing/ path in THIS working tree
    // (a prior squash-merge already did), so `changed` must NOT name one —
    // there is nothing there to stage a deletion for.
    assert.deepEqual(new Set(res.changed), new Set([taskPath, indexPath, protocolPath]));

    // bookkeeping still happened
    const indexContent = readFileSync(indexPath, 'utf8');
    assert.match(indexContent, new RegExp(`\\*\\*${id}\\*\\*`));
    assert.match(indexContent, /\*\*Done:\*\* 1/);
    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`Task verified and completed: ${id}`));
  } finally {
    cleanup(root);
  }
});

test('completeTask propagates a genuine stale-precondition (task is elsewhere, not at doing/ or done/) untouched', () => {
  const id = 'agentic-workflow-502';
  const { root, bcDir, indexPath } = makeCompleteProject({ id, startFolder: 'doing' });
  // Simulate the task actually sitting in todo/, not doing/ or done/.
  const doingFile = path.join(bcDir, 'doing', `${id}-a-slug.md`);
  const todoFile = path.join(bcDir, 'todo', `${id}-a-slug.md`);
  const preMoved = readFileSync(doingFile, 'utf8').replace('status: doing', 'status: todo');
  writeFileSync(todoFile, preMoved);
  rmSync(doingFile);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'stale-precondition');
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
  } finally {
    cleanup(root);
  }
});

test('completeTask (verification skipped variant) writes the skipped-completion protocol entry, no Tests/ADRs lines', () => {
  const id = 'agentic-workflow-503';
  const title = 'A decision task';
  const { root, protocolPath } = makeCompleteProject({ id, title, type: 'decision' });
  try {
    const res = completeTask(root, id, {
      context: BC,
      now: new Date(2026, 6, 3, 16, 0),
      summary: 'Ratified the ADR',
      duration: '1m02s',
      skipped: true,
      skipReason: 'decision-only task',
      filesChanged: 1,
    });
    assert.equal(res.ok, true);
    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`## 2026-07-03 16:00 -- Task completed \\(verification skipped\\): ${id} - ${title}`));
    assert.match(protocolContent, /\*\*Verification:\*\* SKIPPED — decision-only task/);
    assert.match(protocolContent, /\*\*Files changed:\*\* 1/);
    assert.doesNotMatch(protocolContent, /\*\*Tests added:\*\*/);
    assert.doesNotMatch(protocolContent, /\*\*ADRs written:\*\*/);
    assert.equal(res.message, `decision(${BC}): Ratified the ADR [${id}]`);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// ADR-0054: compute-then-write atomicity. `validateBookkeepingMarkers` (the
// hand-maintained dry-run mirror) is gone — the compute phase's own throw IS
// the guard now. These tests pin: (1) the negative-count guard per verb; (2)
// adjustIndexCount's block-scoped replace; (3) the pre-existing marker
// rejections, now pinned on an LF fixture with `res.code` asserted (previously
// only pinned behaviorally, on CRLF, in task-lifecycle-eol.test.mjs); (4) the
// protocol `---`-separator rejection, previously unpinned anywhere; (5) the
// new count-line-missing/non-numeric rejection; (6) completeTask's not-found
// path; (7) claimBatch's mid-batch vanish race, computed-then-written.
// ---------------------------------------------------------------------------

// --- negative-count guard --------------------------------------------------

test('promoteTask rejects when decrementing Backlog would go negative, tree untouched, count not left at -1', () => {
  const id = 'agentic-workflow-210';
  const title = 'Zero-backlog task';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProject({ id, title });
  const broken = readFileSync(indexPath, 'utf8').replace('- **Backlog:** 1', '- **Backlog:** 0');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Backlog/);
    assert.match(res.reason, /negative/i);

    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
    assert.doesNotMatch(indexBefore, /\*\*Backlog:\*\* -1/);
  } finally {
    cleanup(root);
  }
});

test('claimBatch rejects when decrementing Todo would go negative, nothing moved, count not left at -1', () => {
  const id = 'agentic-workflow-420';
  const { root, paths, protocolPath } = makeClaimProject({ tasks: [{ id, title: 'Zero-todo task' }] });
  const indexPath = paths[`__index_${BC}`];
  const broken = readFileSync(indexPath, 'utf8').replace('- **Todo:** 1', '- **Todo:** 0');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = claimBatch(root, [id]);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Todo/);
    assert.match(res.reason, /negative/i);

    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
    assert.doesNotMatch(indexBefore, /\*\*Todo:\*\* -1/);
  } finally {
    cleanup(root);
  }
});

test('completeTask rejects when decrementing Doing would go negative, tree untouched, count not left at -1', () => {
  const id = 'agentic-workflow-510';
  const title = 'Zero-doing task';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id, title });
  const broken = readFileSync(indexPath, 'utf8').replace('- **Doing:** 1', '- **Doing:** 0');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Doing/);
    assert.match(res.reason, /negative/i);

    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
    assert.doesNotMatch(indexBefore, /\*\*Doing:\*\* -1/);
  } finally {
    cleanup(root);
  }
});

// --- adjustIndexCount block-scoping -----------------------------------------

test('adjustIndexCount (exercised via promoteTask) only edits the count line inside the task-counts block — a colliding label elsewhere is untouched', () => {
  const id = 'agentic-workflow-211';
  const title = 'Collision task';
  const root = mkdtempSync(path.join(tmpdir(), 'aw-promote-collide-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  const indexPath = path.join(bcDir, 'INDEX.md');
  // A colliding "**Todo:** 99" line sits in the HEADER, above the real
  // task-counts block (whose own **Todo:** line is 0). The old unanchored
  // regex would have matched this header line first — the bug this scoping
  // fixes.
  writeFileSync(
    indexPath,
    `# Agentic Workflow — Index\n\n(example: **Todo:** 99 tasks last sprint)\n\n---\n\n## Tasks by status\n\n<!-- task-counts:start -->\n- **Backlog:** 1\n- **Todo:** 0\n- **Doing:** 0\n- **Done:** 0\n<!-- task-counts:end -->\n\n### Todo\n<!-- todo-list:start -->\n<!-- todo-list:end -->\n\n### Doing\n<!-- doing-list:start -->\n<!-- doing-list:end -->\n\n### Done\n<!-- done-list:start -->\n<!-- done-list:end -->\n\n### Backlog\n<!-- backlog-list:start -->\n- **${id}** — ${title} (feature) — \`backlog/${fileName}\`\n<!-- backlog-list:end -->\n\n## ADRs scoped to this BC\n\n<!-- adr-local:start -->\n<!-- adr-local:end -->\n`
  );
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, true);
    const indexContent = readFileSync(indexPath, 'utf8');
    // the header's colliding line is untouched...
    assert.match(indexContent, /example: \*\*Todo:\*\* 99 tasks last sprint/);
    // ...while the real block's Backlog/Todo lines were the ones edited.
    assert.match(indexContent, /<!-- task-counts:start -->\n- \*\*Backlog:\*\* 0\n- \*\*Todo:\*\* 1/);
  } finally {
    cleanup(root);
  }
});

// --- pre-existing marker rejections, pinned on an LF fixture with res.code --

test('promoteTask is fail-closed on a marker-broken LF INDEX.md: rejects with res.code, nothing moved, no writes', () => {
  const id = 'agentic-workflow-212';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProject({ id });
  const broken = readFileSync(indexPath, 'utf8').replace('<!-- todo-list:start -->', '<!-- todo-liZt:start -->');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /todo-list/i);

    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

test('claimBatch is fail-closed on a marker-broken LF INDEX.md: rejects with res.code, nothing moved, no writes', () => {
  const id = 'agentic-workflow-421';
  const { root, paths, protocolPath } = makeClaimProject({ tasks: [{ id, title: 'A claimable task' }] });
  const indexPath = paths[`__index_${BC}`];
  const broken = readFileSync(indexPath, 'utf8').replace('doing-list:start', 'doing-liZt:start');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = claimBatch(root, [id]);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /doing-list/i);

    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

test('completeTask is fail-closed on a marker-broken LF INDEX.md: rejects with res.code, nothing moved, no writes', () => {
  const id = 'agentic-workflow-511';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id });
  const broken = readFileSync(indexPath, 'utf8').replace('done-list:start', 'done-liZt:start');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /done-list/i);

    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

// --- protocol `---`-separator rejection (previously unpinned anywhere) -----

test('promoteTask is fail-closed when protocol.md is missing the header separator: rejects with res.code, nothing moved, no INDEX write', () => {
  const id = 'agentic-workflow-213';
  const brokenProtocol = '# Protocol\n\nChronological log, no separator here.\n\n';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProject({ id, protocolContent: brokenProtocol });
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolBefore = readFileSync(protocolPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /separator/i);

    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(readFileSync(protocolPath, 'utf8'), protocolBefore);
  } finally {
    cleanup(root);
  }
});

test('claimBatch is fail-closed when protocol.md is missing the header separator: rejects with res.code, nothing moved, no INDEX write', () => {
  const id = 'agentic-workflow-422';
  const brokenProtocol = '# Protocol\n\nNo separator here.\n\n';
  const { root, paths, protocolPath } = makeClaimProject({
    tasks: [{ id, title: 'A claimable task' }],
    protocolContent: brokenProtocol,
  });
  const indexPath = paths[`__index_${BC}`];
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolBefore = readFileSync(protocolPath, 'utf8');
  try {
    const res = claimBatch(root, [id]);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /separator/i);

    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(readFileSync(protocolPath, 'utf8'), protocolBefore);
  } finally {
    cleanup(root);
  }
});

test('completeTask is fail-closed when protocol.md is missing the header separator: rejects with res.code, nothing moved, no INDEX write', () => {
  const id = 'agentic-workflow-512';
  const brokenProtocol = '# Protocol\n\nNo separator here.\n\n';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id, protocolContent: brokenProtocol });
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolBefore = readFileSync(protocolPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /separator/i);

    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(readFileSync(protocolPath, 'utf8'), protocolBefore);
  } finally {
    cleanup(root);
  }
});

// --- new: count-line missing / non-numeric rejection -----------------------

test('promoteTask rejects when the INDEX.md task-counts block is missing the Todo count line, tree untouched', () => {
  const id = 'agentic-workflow-214';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProject({ id });
  const broken = readFileSync(indexPath, 'utf8').replace('- **Todo:** 0\n', '');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Todo/);

    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

test('claimBatch rejects when the INDEX.md task-counts block is missing the Doing count line, nothing moved', () => {
  const id = 'agentic-workflow-423';
  const { root, paths, protocolPath } = makeClaimProject({ tasks: [{ id, title: 'A claimable task' }] });
  const indexPath = paths[`__index_${BC}`];
  const broken = readFileSync(indexPath, 'utf8').replace('- **Doing:** 0\n', '');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = claimBatch(root, [id]);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Doing/);

    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

test('completeTask rejects when the INDEX.md Done count is non-numeric, tree untouched', () => {
  const id = 'agentic-workflow-513';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProject({ id });
  const broken = readFileSync(indexPath, 'utf8').replace('- **Done:** 0\n', '- **Done:** N/A\n');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.match(res.reason, /Done/);

    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});

// --- completeTask: not-found (unchanged behavior, ADR-0054 refactor) -------

test('completeTask returns not-found when the task is nowhere (not in doing/, done/, or elsewhere)', () => {
  const idElsewhere = 'agentic-workflow-515';
  const idMissing = 'agentic-workflow-514';
  const { root, indexPath } = makeCompleteProject({ id: idElsewhere });
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = completeTask(root, idMissing, { context: BC });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not-found');
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
  } finally {
    cleanup(root);
  }
});

// --- claimBatch: mid-batch vanish race, unchanged (compute-then-write) -----

test('claimBatch: an id that vanishes between the pre-check and its move (mid-batch race) surfaces the split claimed manifest and writes nothing', () => {
  // Two ids that resolve to the SAME physical file deterministically reproduce
  // the documented mid-batch race within one synchronous call: the pre-check
  // (step 1) sees BOTH ids resolve in todo/, but the move loop (step 3)
  // vacates the file for the first id, so by the time it reaches the second
  // id the file has already moved — vanished between the pre-check and its
  // move, exactly like a concurrent DISMISS pulling it out from under the
  // batch. This task does not claim to fix that race; it only re-pins that
  // compute-then-write left it unchanged.
  const idBare = 'agentic-workflow-430';
  const idExact = 'agentic-workflow-430-x';
  const root = mkdtempSync(path.join(tmpdir(), 'aw-claim-race-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${idExact}.md`; // exact match for idExact; prefix match for idBare
  writeFileSync(
    path.join(bcDir, 'todo', fileName),
    `---\nid: ${idBare}\ntitle: Shared file\nstatus: todo\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  const indexPath = path.join(bcDir, 'INDEX.md');
  writeFileSync(
    indexPath,
    makeIndexMd({
      todoLines: [
        `- **${idBare}** — Shared file (feature) — \`todo/${fileName}\``,
        `- **${idExact}** — Shared file (feature) — \`todo/${fileName}\``,
      ],
      counts: { Backlog: 0, Todo: 2, Doing: 0, Done: 0 },
    })
  );
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolPath = path.join(root, '.agentheim', 'knowledge', 'protocol.md');
  try {
    const res = claimBatch(root, [idBare, idExact], { contexts: { [idBare]: BC, [idExact]: BC } });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'stale-precondition');
    assert.equal(res.id, idExact);
    assert.deepEqual(res.claimed, [idBare]);

    // idBare's move stayed — NOT rolled back.
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);

    // NEITHER file was written.
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(existsSync(protocolPath), false);
  } finally {
    cleanup(root);
  }
});
