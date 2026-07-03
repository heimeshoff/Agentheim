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

const BC = 'agentic-workflow';
const FOLDERS = ['backlog', 'todo', 'doing', 'done'];
const CLI_PATH = fileURLToPath(new URL('../task-lifecycle-cli.mjs', import.meta.url));

function makeIndexMd({ backlogLines = [], counts = { Backlog: 1, Todo: 0, Doing: 0, Done: 0 } } = {}) {
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
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

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
    assert.ok(Array.isArray(output.changed) && output.changed.length === 3);
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
