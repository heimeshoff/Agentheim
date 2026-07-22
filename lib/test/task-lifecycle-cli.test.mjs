// Unit tests for the task-lifecycle CLI (ADR-0038 layer 2/3 boundary,
// agentic-workflow-k5n8f). `runCli` is exercised directly (no child process) for
// the argv/exit-code contract; one end-to-end spawn proves the real `node
// lib/task-lifecycle-cli.mjs <verb> <id>` invocation + isMain guard actually
// wires up and prints/exits correctly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runCli } from '../task-lifecycle-cli.mjs';
import { applyTaskMove } from '../task-lifecycle.mjs';

const BC = 'agentic-workflow';
const FOLDERS = ['backlog', 'todo', 'doing', 'done'];
const CLI_PATH = fileURLToPath(new URL('../task-lifecycle-cli.mjs', import.meta.url));

function makeIndexMd({
  backlogLines = [],
  todoLines = [],
  doingLines = [],
  counts = { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
} = {}) {
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
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->
`;
}

function makeCliProject({ id, title = 'A CLI-promotable task', type = 'feature' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true }); // marks the project root for discoverRoot
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: ${type}\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  writeFileSync(
    path.join(bcDir, 'INDEX.md'),
    makeIndexMd({ backlogLines: [`- **${id}** — ${title} (${type}) — \`backlog/${fileName}\``] })
  );
  return { root, bcDir, fileName };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('runCli promote: success returns exitCode 0 and the enumerated manifest', () => {
  const id = 'agentic-workflow-300';
  const { root } = makeCliProject({ id });
  try {
    const { exitCode, output } = runCli(['promote', id], {
      discoverRoot: () => root,
      taskOpts: { context: BC, now: new Date(2026, 6, 3, 9, 0) },
    });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'promote');
    assert.equal(output.id, id);
    // 4, not 3: the vacated backlog/ source path plus the todo/ destination,
    // INDEX.md, and protocol.md (infrastructure-h8k2m — `changed` must
    // enumerate both halves of the rename, not just the new-location file).
    assert.ok(Array.isArray(output.changed) && output.changed.length === 4);
    assert.match(output.message, new RegExp(`^model\\(${BC}\\): promote ${id} —`));
  } finally {
    cleanup(root);
  }
});

test('runCli promote: a domain rejection (unmet depends_on) surfaces as exitCode 1, no manifest', () => {
  const id = 'agentic-workflow-301';
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-blocked-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    `---\nid: ${id}\ntitle: Blocked\nstatus: backlog\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: [design-system-001-styleguide]\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  writeFileSync(path.join(bcDir, 'INDEX.md'), makeIndexMd({ backlogLines: [`- **${id}** — Blocked (feature)`] }));
  try {
    const { exitCode, output } = runCli(['promote', id], { discoverRoot: () => root });
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'blocked-dependency');
    assert.equal(output.changed, undefined);
  } finally {
    cleanup(root);
  }
});

test('runCli: unknown verb is rejected with exitCode 1 and a listing of known verbs', () => {
  const { exitCode, output } = runCli(['dismiss', 'agentic-workflow-999'], { discoverRoot: () => '/never/used' });
  assert.equal(exitCode, 1);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'unknown-verb');
  assert.match(output.reason, /promote/);
});

test('runCli: missing id is rejected with exitCode 1', () => {
  const { exitCode, output } = runCli(['promote'], { discoverRoot: () => '/never/used' });
  assert.equal(exitCode, 1);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'missing-id');
});

test('runCli: a discoverRoot failure (no .agentheim/ found) surfaces as exitCode 1, code no-project-root', () => {
  const { exitCode, output } = runCli(['promote', 'agentic-workflow-999'], {
    discoverRoot: () => {
      throw new Error('No .agentheim/ project found walking up from /tmp/nowhere to the filesystem root.');
    },
  });
  assert.equal(exitCode, 1);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'no-project-root');
  assert.match(output.reason, /\.agentheim/);
});

// --- claim: batch verb, comma-separated ids -----------------------------

function makeCliClaimProject({ ids, titles }) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-claim-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const todoLines = [];
  for (const id of ids) {
    const title = titles[id];
    const fileName = `${id}-a-slug.md`;
    writeFileSync(
      path.join(bcDir, 'todo', fileName),
      `---\nid: ${id}\ntitle: ${title}\nstatus: todo\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
    );
    todoLines.push(`- **${id}** — ${title} (feature) — \`todo/${fileName}\``);
  }
  writeFileSync(
    path.join(bcDir, 'INDEX.md'),
    makeIndexMd({ todoLines, counts: { Backlog: 0, Todo: ids.length, Doing: 0, Done: 0 } })
  );
  return { root, bcDir };
}

test('runCli claim: a comma-separated batch of ids moves all of them and returns one manifest', () => {
  const ids = ['agentic-workflow-310', 'agentic-workflow-311'];
  const titles = { [ids[0]]: 'First', [ids[1]]: 'Second' };
  const { root, bcDir } = makeCliClaimProject({ ids, titles });
  try {
    const { exitCode, output } = runCli(['claim', ids.join(',')], {
      discoverRoot: () => root,
      taskOpts: { now: new Date(2026, 6, 3, 9, 0) },
    });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'claim');
    assert.deepEqual(output.ids, ids);
    for (const id of ids) {
      assert.equal(existsSync(path.join(bcDir, 'doing', `${id}-a-slug.md`)), true);
    }
    assert.match(output.message, /^chore\(agentic-workflow\): batch start \[agentic-workflow-310\] \[agentic-workflow-311\]$/);
  } finally {
    cleanup(root);
  }
});

test('runCli claim: a missing id in the batch is rejected with exitCode 1, nothing moved', () => {
  const ids = ['agentic-workflow-312'];
  const titles = { [ids[0]]: 'Present' };
  const { root, bcDir } = makeCliClaimProject({ ids, titles });
  try {
    const { exitCode, output } = runCli(['claim', `${ids[0]},agentic-workflow-999`], { discoverRoot: () => root });
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'not-found');
    assert.equal(existsSync(path.join(bcDir, 'todo', `${ids[0]}-a-slug.md`)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', `${ids[0]}-a-slug.md`)), false);
  } finally {
    cleanup(root);
  }
});

// --- complete: single-id verb, third-argv JSON opts ----------------------

function makeCliCompleteProject({ id, title = 'A completable task', startFolder = 'doing' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-complete-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  const status = startFolder === 'done' ? 'done' : 'doing';
  writeFileSync(
    path.join(bcDir, startFolder, fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  // INDEX always models the pre-bookkeeping "doing" state, matching the real
  // ADR-0032 shape (see the analogous lib/test/task-lifecycle.test.mjs fixture).
  writeFileSync(
    path.join(bcDir, 'INDEX.md'),
    makeIndexMd({
      doingLines: [`- **${id}** — ${title} (feature) — \`doing/${fileName}\``],
      counts: { Backlog: 0, Todo: 0, Doing: 1, Done: 0 },
    })
  );
  return { root, bcDir, fileName };
}

test('runCli complete: success returns exitCode 0, moves doing -> done, and third-argv JSON opts feed the manifest message', () => {
  const id = 'agentic-workflow-320';
  const { root, bcDir, fileName } = makeCliCompleteProject({ id });
  try {
    const { exitCode, output } = runCli(
      ['complete', id, JSON.stringify({ summary: 'Shipped it', verification: 'PASS (iteration 1)' })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'complete');
    assert.equal(output.id, id);
    assert.equal(output.idempotent, false);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), true);
    assert.match(output.message, /^feature\(agentic-workflow\): Shipped it \[agentic-workflow-320\]$/);
  } finally {
    cleanup(root);
  }
});

test('runCli complete: idempotent when the file is already in done/ (worktree already moved it)', () => {
  const id = 'agentic-workflow-321';
  const { root, bcDir, fileName } = makeCliCompleteProject({ id, startFolder: 'done' });
  try {
    const { exitCode, output } = runCli(['complete', id], { discoverRoot: () => root });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.idempotent, true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), true);
  } finally {
    cleanup(root);
  }
});

test('runCli: a malformed third-argv JSON opts string is rejected with exitCode 1, code invalid-opts-json', () => {
  const { exitCode, output } = runCli(['complete', 'agentic-workflow-999', '{not valid json'], {
    discoverRoot: () => '/never/used',
  });
  assert.equal(exitCode, 1);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'invalid-opts-json');
});

test('the real `node lib/task-lifecycle-cli.mjs claim <id-1>,<id-2>` invocation moves both ids and prints one manifest', () => {
  const ids = ['agentic-workflow-330', 'agentic-workflow-331'];
  const titles = { [ids[0]]: 'First', [ids[1]]: 'Second' };
  const { root, bcDir } = makeCliClaimProject({ ids, titles });
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, 'claim', ids.join(',')], { cwd: root, encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verb, 'claim');
    assert.deepEqual(parsed.ids, ids);
    for (const id of ids) {
      assert.equal(existsSync(path.join(bcDir, 'doing', `${id}-a-slug.md`)), true);
    }
  } finally {
    cleanup(root);
  }
});

test('the real `node lib/task-lifecycle-cli.mjs complete <id> <json-opts>` invocation prints the manifest and exits 0', () => {
  const id = 'agentic-workflow-332';
  const { root, bcDir, fileName } = makeCliCompleteProject({ id });
  try {
    const out = execFileSync(
      process.execPath,
      [CLI_PATH, 'complete', id, JSON.stringify({ summary: 'Done via real spawn' })],
      { cwd: root, encoding: 'utf8' }
    );
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verb, 'complete');
    assert.equal(parsed.id, id);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), true);
  } finally {
    cleanup(root);
  }
});

// --- checkpoint: filters a worker's declared FILE_LIST at the conductor's --
// --- staging seam, dropping derived artifacts (agentic-workflow-q7v3k) -----

test('runCli checkpoint: an ordinary FILE_LIST stages verbatim as `changed`, with no refusals', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-checkpoint-'));
  try {
    const sourceFile = path.join(root, 'lib', 'derived-artifact-guard.mjs');
    const readmeFile = path.join(root, '.agentheim', 'contexts', BC, 'README.md');
    const { exitCode, output } = runCli(
      ['checkpoint', 'agentic-workflow-q7v3k', JSON.stringify({ fileList: [sourceFile, readmeFile], iteration: 1 })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'checkpoint');
    assert.deepEqual(output.changed, [sourceFile, readmeFile]);
    assert.deepEqual(output.refused, []);
    assert.equal(output.refusalReason, null);
    assert.equal(output.message, 'wip [agentic-workflow-q7v3k] iter 1');
  } finally {
    cleanup(root);
  }
});

test('runCli checkpoint: a rebuilt dashboard/dist/ entry is refused, dropped from `changed`, and refusalReason names ADR-0003', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-checkpoint-derived-'));
  try {
    const sourceFile = path.join(root, 'skills', 'work', 'SKILL.md');
    const bundleFile = path.join(root, 'dashboard', 'dist', 'app.js');
    const { exitCode, output } = runCli(
      ['checkpoint', 'agentic-workflow-q7v3k', JSON.stringify({ fileList: [sourceFile, bundleFile], iteration: 2 })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.deepEqual(output.changed, [sourceFile]);
    assert.equal(output.refused.length, 1);
    assert.equal(output.refused[0].path, bundleFile);
    assert.equal(output.refused[0].reason, 'derived-artifact');
    assert.match(output.refusalReason, /ADR-0003/);
    assert.equal(output.message, 'wip [agentic-workflow-q7v3k] iter 2');
  } finally {
    cleanup(root);
  }
});

test('runCli checkpoint: a missing fileList is rejected with exitCode 1, code invalid-file-list', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-checkpoint-badopts-'));
  try {
    const { exitCode, output } = runCli(['checkpoint', 'agentic-workflow-q7v3k'], { discoverRoot: () => root });
    assert.equal(exitCode, 1);
    assert.equal(output.ok, false);
    assert.equal(output.code, 'invalid-file-list');
  } finally {
    cleanup(root);
  }
});

test('runCli checkpoint: after an applyTaskMove-backed doing->done move, the staging set names both the new done/ path and the vacated doing/ path (agentic-workflow-w2njd)', () => {
  const id = 'agentic-workflow-340';
  const { root, fileName } = makeCliCompleteProject({ id }); // seeds the file in doing/
  try {
    const moveResult = applyTaskMove(root, id, 'doing', 'done', { context: BC, policy: 'skill' });
    assert.equal(moveResult.ok, true);
    const newPath = moveResult.state.path;
    const oldPath = moveResult.state.fromPath;
    assert.equal(existsSync(oldPath), false); // the move already vacated doing/

    // The conductor's checkpoint call only ever names the NEW location in
    // fileList (per skills/work/SKILL.md's "FILE_LIST + moved task file") —
    // the moved-from path must be discovered by the checkpoint verb itself,
    // not hand-added by the caller.
    const { exitCode, output } = runCli(
      ['checkpoint', id, JSON.stringify({ fileList: [newPath], iteration: 1 })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.ok(output.changed.includes(newPath), 'changed must include the new done/ path');
    assert.ok(output.changed.includes(oldPath), 'changed must include the vacated doing/ path so its deletion is staged');
    assert.equal(fileName.startsWith(id), true); // sanity: same basename rides both sides of the move
  } finally {
    cleanup(root);
  }
});

test('runCli checkpoint: detects the vacated doing/ path even when fileList uses forward slashes on a backslash-native platform (agentic-workflow-kp7dq)', () => {
  const id = 'agentic-workflow-343';
  const { root } = makeCliCompleteProject({ id }); // seeds the file in doing/
  try {
    const moveResult = applyTaskMove(root, id, 'doing', 'done', { context: BC, policy: 'skill' });
    assert.equal(moveResult.ok, true);
    const newPath = moveResult.state.path;
    const oldPath = moveResult.state.fromPath;
    assert.equal(existsSync(oldPath), false); // the move already vacated doing/

    // Simulate a caller (e.g. a shell that dodges backslash-escaping) passing
    // its fileList entry with forward slashes, regardless of the platform's
    // native separator.
    const forwardSlashNewPath = newPath.split(path.sep).join('/');

    const { exitCode, output } = runCli(
      ['checkpoint', id, JSON.stringify({ fileList: [forwardSlashNewPath], iteration: 1 })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.ok(
      output.changed.includes(oldPath),
      'changed must include the vacated doing/ path even though fileList used forward slashes'
    );
  } finally {
    cleanup(root);
  }
});

test('runCli checkpoint: a BOUNCE-style manual doing->backlog move also gets its vacated doing/ path added to changed', () => {
  const id = 'agentic-workflow-341';
  const { root, bcDir, fileName } = makeCliCompleteProject({ id });
  const doingPath = path.join(bcDir, 'doing', fileName);
  const backlogPath = path.join(bcDir, 'backlog', fileName);
  try {
    // Simulate the worker's own manual doing -> backlog move (BOUNCE is not a
    // legal applyTaskMove transition under the 'skill' policy, so a real
    // worker performs this as a plain file move, not via applyTaskMove).
    const content = readFileSync(doingPath, 'utf8').replace(/^status:.*$/m, 'status: backlog');
    writeFileSync(backlogPath, content);
    rmSync(doingPath);

    const { exitCode, output } = runCli(
      ['checkpoint', id, JSON.stringify({ fileList: [backlogPath], iteration: 1 })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.ok(output.changed.includes(backlogPath), 'changed must include the new backlog/ path');
    assert.ok(output.changed.includes(doingPath), 'changed must include the vacated doing/ path so its deletion is staged');
  } finally {
    cleanup(root);
  }
});

test('the real `node lib/task-lifecycle-cli.mjs checkpoint <id> <json-opts>` invocation filters derived artifacts and exits 0', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-checkpoint-real-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  try {
    const sourceFile = path.join(root, 'lib', 'task-lifecycle-cli.mjs');
    const bundleFile = path.join(root, 'dashboard', 'dist', 'app.js');
    const out = execFileSync(
      process.execPath,
      [CLI_PATH, 'checkpoint', 'agentic-workflow-q7v3k', JSON.stringify({ fileList: [sourceFile, bundleFile] })],
      { cwd: root, encoding: 'utf8' }
    );
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verb, 'checkpoint');
    assert.deepEqual(parsed.changed, [sourceFile]);
    assert.equal(parsed.refused.length, 1);
    assert.equal(parsed.refused[0].reason, 'derived-artifact');
  } finally {
    cleanup(root);
  }
});

test('the real `node lib/task-lifecycle-cli.mjs <verb> <id>` invocation prints the manifest and exits 0 (isMain + discoverRoot wiring)', () => {
  const id = 'agentic-workflow-302';
  const { root } = makeCliProject({ id });
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, 'promote', id], { cwd: root, encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verb, 'promote');
    assert.equal(parsed.id, id);
  } finally {
    cleanup(root);
  }
});

test('the real CLI invocation exits non-zero and prints a rejection for an unknown verb', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-realverb-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  try {
    assert.throws(() => execFileSync(process.execPath, [CLI_PATH, 'nope', 'x'], { cwd: root, encoding: 'utf8' }));
    let stdout = '';
    try {
      execFileSync(process.execPath, [CLI_PATH, 'nope', 'x'], { cwd: root, encoding: 'utf8' });
    } catch (err) {
      stdout = err.stdout;
    }
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.ok, false);
    assert.equal(parsed.code, 'unknown-verb');
  } finally {
    cleanup(root);
  }
});
