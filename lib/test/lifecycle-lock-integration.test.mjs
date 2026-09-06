// Proves the lock is actually acquired INSIDE each of the seven writer
// functions this task locks (agentic-workflow-pt0gy) — every writer refuses
// `lock-timeout` (nothing moved, nothing written) when the lock is already
// held by a live pid with a short injected timeout, and `dismissTask`'s
// zero-write PLAN phase stays unlocked (proceeds even while the lock is held).
// The two OPTS-ONLY mechanics verbs `log`/`index-add` get the identical
// lock-timeout proof further down via `runCli`. The bigger spawned-two-real-
// `capture`-calls concurrency proof lives in
// `task-lifecycle-cli-mechanics.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { promoteTask, claimBatch, completeTask } from '../task-lifecycle.mjs';
import { captureTask, dismissTask } from '../task-lifecycle-capture-dismiss.mjs';
import { rotateProtocol } from '../protocol-rotation.mjs';
import { rotateIndexDoneList } from '../index-rotation.mjs';
import { lifecycleLockPath } from '../lifecycle-lock.mjs';
import { runCli } from '../task-lifecycle-cli.mjs';

const BC = 'agentic-workflow';
const FOLDERS = ['backlog', 'todo', 'doing', 'done'];
const SHORT_LOCK = { timeoutMs: 100, waitIntervalMs: 20 };

function makeRoot() {
  return mkdtempSync(path.join(tmpdir(), 'aw-lock-int-'));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** Pre-hold the lock with a live pid (the test process's own) so every writer under test must wait/timeout. */
function holdLock(root) {
  const lp = lifecycleLockPath(root);
  mkdirSync(path.dirname(lp), { recursive: true });
  writeFileSync(lp, JSON.stringify({ pid: process.pid, hostname: 'test', startedAt: new Date().toISOString() }));
  return lp;
}

function makeIndexMd({ backlogLines = [], todoLines = [], doingLines = [], doneLines = [], counts = { Backlog: 0, Todo: 0, Doing: 0, Done: 0 } } = {}) {
  return `# Agentic Workflow — Index

---

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
${doneLines.map((l) => l + '\n').join('')}<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
<!-- adr-local:end -->
`;
}

function taskContent({ id, title = 'A task', status, type = 'feature', dependsOn = [] } = {}) {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\ntype: ${type}\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: [${dependsOn.join(', ')}]\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`;
}

function bcDir(root) {
  return path.join(root, '.agentheim', 'contexts', BC);
}

function makeProject() {
  const root = makeRoot();
  for (const f of FOLDERS) mkdirSync(path.join(bcDir(root), f), { recursive: true });
  return root;
}

test('promoteTask refuses lock-timeout when the lifecycle lock is already held: nothing moved, nothing written', () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-500';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'backlog', fileName), taskContent({ id, status: 'backlog' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ backlogLines: [`- **${id}** — A task (feature) — \`backlog/${fileName}\``], counts: { Backlog: 1 } }));
    const before = readFileSync(indexPath, 'utf8');

    holdLock(root);
    const res = promoteTask(root, id, { context: BC, lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(existsSync(path.join(bcDir(root), 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir(root), 'todo', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('claimBatch refuses lock-timeout when the lifecycle lock is already held: nothing moved, nothing written', () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-501';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'todo', fileName), taskContent({ id, status: 'todo' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ todoLines: [`- **${id}** — A task (feature) — \`todo/${fileName}\``], counts: { Todo: 1 } }));

    holdLock(root);
    const res = claimBatch(root, [id], { lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(existsSync(path.join(bcDir(root), 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir(root), 'doing', fileName)), false);
  } finally {
    cleanup(root);
  }
});

test('completeTask refuses lock-timeout when the lifecycle lock is already held: nothing moved, nothing written', () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-502';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'doing', fileName), taskContent({ id, status: 'doing' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ doingLines: [`- **${id}** — A task (feature) — \`doing/${fileName}\``], counts: { Doing: 1 } }));

    holdLock(root);
    const res = completeTask(root, id, { context: BC, lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(existsSync(path.join(bcDir(root), 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir(root), 'done', fileName)), false);
  } finally {
    cleanup(root);
  }
});

test('captureTask refuses lock-timeout when the lifecycle lock is already held: nothing written', () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-503';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'backlog', fileName), taskContent({ id, status: 'backlog' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({}));
    const before = readFileSync(indexPath, 'utf8');

    holdLock(root);
    const res = captureTask(root, id, { context: BC, source: 'modeling', summary: 'x', lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(readFileSync(indexPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test("dismissTask's plan phase stays UNLOCKED: it succeeds even while the lifecycle lock is held", () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-504';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'backlog', fileName), taskContent({ id, status: 'backlog' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ backlogLines: [`- **${id}** — A task (feature) — \`backlog/${fileName}\``], counts: { Backlog: 1 } }));

    holdLock(root);
    const res = dismissTask(root, id, { plan: true });
    assert.equal(res.ok, true);
    assert.deepEqual(res.cascade.memberIds, [id]);
  } finally {
    cleanup(root);
  }
});

test("dismissTask's confirm phase refuses lock-timeout when the lifecycle lock is already held: nothing deleted or written", () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-505';
    const fileName = `${id}-a-slug.md`;
    writeFileSync(path.join(bcDir(root), 'backlog', fileName), taskContent({ id, status: 'backlog' }));
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ backlogLines: [`- **${id}** — A task (feature) — \`backlog/${fileName}\``], counts: { Backlog: 1 } }));

    holdLock(root);
    const res = dismissTask(root, id, { confirm: [id], lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(existsSync(path.join(bcDir(root), 'backlog', fileName)), true);
  } finally {
    cleanup(root);
  }
});

test('rotateProtocol refuses lock-timeout when the lifecycle lock is already held: protocol.md left untouched', () => {
  const root = makeRoot();
  try {
    const protocolDir = path.join(root, '.agentheim', 'knowledge');
    mkdirSync(protocolDir, { recursive: true });
    const protocolPath = path.join(protocolDir, 'protocol.md');
    // Over-cap so an unlocked call WOULD rotate -- proves the lock, not the cap, is what stops it.
    const entries = Array.from({ length: 5 }, (_, i) => `## 2026-01-${String(i + 1).padStart(2, '0')} 00:00 -- Entry ${i}\n\n**Type:** X\n\n---\n\n`).join('');
    writeFileSync(protocolPath, `# Protocol\n\n---\n\n${entries}`);
    const before = readFileSync(protocolPath, 'utf8');

    holdLock(root);
    const res = rotateProtocol(root, { capLines: 5, lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(readFileSync(protocolPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('rotateIndexDoneList refuses lock-timeout when the lifecycle lock is already held: INDEX.md left untouched', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(bcDir(root), 'done'), { recursive: true });
    const doneLines = Array.from({ length: 5 }, (_, i) => `- **agentic-workflow-6${i}** — Task ${i} — \`done/agentic-workflow-6${i}.md\``);
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({ doneLines, counts: { Done: 5 } }));
    const before = readFileSync(indexPath, 'utf8');

    holdLock(root);
    const res = rotateIndexDoneList(root, BC, { capEntries: 1, lock: SHORT_LOCK });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'lock-timeout');
    assert.equal(readFileSync(indexPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('runCli log refuses lock-timeout when the lifecycle lock is already held: protocol.md left untouched', () => {
  const root = makeRoot();
  try {
    const protocolDir = path.join(root, '.agentheim', 'knowledge');
    mkdirSync(protocolDir, { recursive: true });
    const protocolPath = path.join(protocolDir, 'protocol.md');
    writeFileSync(protocolPath, '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n');
    const before = readFileSync(protocolPath, 'utf8');

    holdLock(root);
    const { exitCode, output } = runCli(
      ['log', JSON.stringify({ title: 'A title', body: 'a body' })],
      { discoverRoot: () => root, taskOpts: { lock: SHORT_LOCK } }
    );
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'lock-timeout');
    assert.equal(readFileSync(protocolPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add refuses lock-timeout when the lifecycle lock is already held: INDEX.md left untouched', () => {
  const root = makeProject();
  try {
    const id = 'agentic-workflow-506';
    const indexPath = path.join(bcDir(root), 'INDEX.md');
    writeFileSync(indexPath, makeIndexMd({}));
    const before = readFileSync(indexPath, 'utf8');

    holdLock(root);
    const line = `- **${id}** — A decision — \`decisions/${id}-a-decision.md\``;
    const { exitCode, output } = runCli(
      ['index-add', JSON.stringify({ bc: BC, section: 'adr-local', id, line })],
      { discoverRoot: () => root, taskOpts: { lock: SHORT_LOCK } }
    );
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'lock-timeout');
    assert.equal(readFileSync(indexPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});
