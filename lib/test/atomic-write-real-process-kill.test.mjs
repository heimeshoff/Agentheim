// Real-process kill proof (agentic-workflow-vhz69, AC #3): a spawned CLI
// `capture` child, held at the pre-rename point via `writeFileAtomic`'s
// test-only `AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS` env seam (this task's own
// local hold -- `agentic-workflow-dpbjj`'s lifecycle-lock hold has not landed
// on this branch, and that module/test are out of scope here), then
// SIGKILLed, must leave INDEX.md and protocol.md byte-identical to their
// pre-spawn content, and the next `capture` call must still succeed (proving
// the stale lifecycle lock left behind by the killed holder is reaped, not a
// permanent jam).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runCli } from '../task-lifecycle-cli.mjs';
import { lifecycleLockPath } from '../lifecycle-lock.mjs';

const CLI_PATH = fileURLToPath(new URL('../task-lifecycle-cli.mjs', import.meta.url));
const BC = 'agentic-workflow';

// Real SIGKILL / forceful termination is only deterministic on the platforms
// Node itself documents unconditional-kill behavior for: POSIX (a real
// signal the kernel delivers, uncatchable) and win32 (child_process's kill()
// unconditionally terminates via TerminateProcess regardless of the signal
// name). Anything else cannot be relied on to actually stop the child mid-
// hold, so the proof would be non-deterministic rather than testing what it
// claims.
const CAN_DELIVER_DETERMINISTIC_KILL = process.platform === 'win32' || process.platform === 'linux' || process.platform === 'darwin';

function makeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-atomic-kill-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

function bcIndexPath(root, bc = BC) {
  return path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md');
}

function protocolPath(root) {
  return path.join(root, '.agentheim', 'knowledge', 'protocol.md');
}

function makeBcIndex(root, bc = BC) {
  const p = bcIndexPath(root, bc);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(
    p,
    `# ${bc} — Index\n\n---\n\n## Tasks by status\n\n<!-- task-counts:start -->\n- **Backlog:** 1\n- **Todo:** 0\n- **Doing:** 0\n- **Done:** 0\n<!-- task-counts:end -->\n\n### Todo\n<!-- todo-list:start -->\n<!-- todo-list:end -->\n\n### Doing\n<!-- doing-list:start -->\n<!-- doing-list:end -->\n\n### Done\n<!-- done-list:start -->\n<!-- done-list:end -->\n\n### Backlog\n<!-- backlog-list:start -->\n<!-- backlog-list:end -->\n\n## ADRs scoped to this BC\n\n<!-- adr-local:start -->\n<!-- adr-local:end -->\n\n## Research touching this BC\n\n<!-- research-local:start -->\n<!-- research-local:end -->\n\n## Concepts (opt-in synthesis pages)\n\n<!-- concepts:start -->\n<!-- concepts:end -->\n`
  );
  return p;
}

function taskBody(id) {
  return `---\nid: ${id}\ntitle: Real kill capture target\nstatus: backlog\ntype: feature\ncontext: ${BC}\ncreated: 2026-09-06\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`;
}

/** Poll a directory for any `.tmp` file (the primitive's temp-file naming) up to `timeoutMs`. */
async function waitForTmpFile(dir, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(dir)) {
      const found = readdirSync(dir).filter((n) => n.endsWith('.tmp'));
      if (found.length > 0) return found;
    }
    await new Promise((r) => setTimeout(r, 15));
  }
  return [];
}

const testOpts = CAN_DELIVER_DETERMINISTIC_KILL
  ? { timeout: 20000 }
  : {
      timeout: 20000,
      skip: `process.platform "${process.platform}" is neither win32 (TerminateProcess-backed kill()) nor a POSIX platform with real signals -- a SIGKILL-equivalent cannot be delivered deterministically here.`,
    };

test(
  'a capture child SIGKILLed while held at the pre-rename point leaves INDEX.md and protocol.md intact, and the next capture call still succeeds',
  testOpts,
  async () => {
    const root = makeRoot();
    try {
      const bcDir = path.join(root, '.agentheim', 'contexts', BC);
      const backlogDir = path.join(bcDir, 'backlog');
      for (const f of ['backlog', 'todo', 'doing', 'done']) mkdirSync(path.join(bcDir, f), { recursive: true });

      const id = 'agentic-workflow-90099';
      writeFileSync(path.join(backlogDir, `${id}-slug.md`), taskBody(id));

      const idxPath = makeBcIndex(root);
      const pPath = protocolPath(root);
      mkdirSync(path.dirname(pPath), { recursive: true });
      const originalProtocol = '# Protocol\n\nNewest entries on top.\n\n---\n\n## 2026-09-01 00:00 -- Pre-existing entry\n\n**Type:** X\n\n---\n\n';
      writeFileSync(pPath, originalProtocol);
      const originalIndex = readFileSync(idxPath, 'utf8');

      const child = spawn(
        process.execPath,
        [CLI_PATH, 'capture', id, JSON.stringify({ source: 'modeling', summary: 'held for kill' })],
        {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS: '8000' },
        }
      );

      let exited = false;
      const exitPromise = new Promise((resolve) => {
        child.on('exit', () => {
          exited = true;
          resolve();
        });
      });

      // The primitive writes INDEX.md's temp file INTO bcDir before holding --
      // wait for it to appear, then kill.
      const found = await waitForTmpFile(bcDir, 5000);
      assert.ok(found.length > 0, 'expected a .tmp temp file to appear beside INDEX.md before the hold elapses');

      child.kill('SIGKILL');
      await exitPromise;
      assert.equal(exited, true);

      // The lock the killed process was holding is left behind, naming its
      // (now dead) pid -- confirms the process really died mid-critical-
      // section rather than finishing first.
      const lockPath = lifecycleLockPath(root);
      assert.equal(existsSync(lockPath), true, 'the killed process should have left its lock file behind');

      // Target files: byte-identical to before the kill.
      assert.equal(readFileSync(idxPath, 'utf8'), originalIndex, 'INDEX.md must be untouched by the killed write');
      assert.equal(readFileSync(pPath, 'utf8'), originalProtocol, 'protocol.md must be untouched by the killed write');

      // The next verb succeeds: the stale lock (dead pid) is reaped and this
      // capture call lands cleanly.
      const { exitCode, output } = runCli(['capture', id, JSON.stringify({ source: 'modeling', summary: 'retry after kill' })], {
        discoverRoot: () => root,
      });
      assert.equal(exitCode, 0, `expected the retry to succeed, got ${JSON.stringify(output)}`);
      assert.equal(output.ok, true);
      assert.match(readFileSync(idxPath, 'utf8'), new RegExp(`\\*\\*${id}\\*\\*`));
    } finally {
      cleanup(root);
    }
  }
);
