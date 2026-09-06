import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import {
  acquireLifecycleLock,
  withLifecycleLock,
  lifecycleLockPath,
} from '../lifecycle-lock.mjs';

const LOCK_MODULE_URL = new URL('../lifecycle-lock.mjs', import.meta.url).href;

function makeRoot() {
  return mkdtempSync(path.join(tmpdir(), 'aw-lock-'));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** Spawn a child process that calls `acquireLifecycleLock` against `lockPath` and reports the result + elapsed ms as JSON, releasing immediately on success. Async (non-blocking) so the parent's own timers keep firing while it waits — unlike `spawnSync`/`execFileSync`, which block the event loop. */
function runChildAcquire(lockPath, timeoutMs) {
  const script = `
    import(${JSON.stringify(LOCK_MODULE_URL)}).then((m) => {
      const start = Date.now();
      const result = m.acquireLifecycleLock('unused-root', {
        lockPath: process.argv[1],
        timeoutMs: Number(process.argv[2]),
        waitIntervalMs: 20,
      });
      const elapsed = Date.now() - start;
      if (result.ok) result.release();
      process.stdout.write(JSON.stringify({ ...result, elapsed }));
    }).catch((e) => { console.error(e && e.stack || e); process.exit(1); });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, lockPath, String(timeoutMs)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`child acquire exited ${code}: ${err}`));
      try {
        resolve(JSON.parse(out.trim()));
      } catch (parseErr) {
        reject(new Error(`child acquire produced unparseable output ${JSON.stringify(out)}: ${parseErr.message}`));
      }
    });
  });
}

test('acquireLifecycleLock succeeds immediately when no lock file exists, and release() removes it', () => {
  const root = makeRoot();
  try {
    const result = acquireLifecycleLock(root);
    assert.equal(result.ok, true);
    assert.equal(existsSync(lifecycleLockPath(root)), true);
    result.release();
    assert.equal(existsSync(lifecycleLockPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test("a lock file naming a dead pid is reaped: the next acquire proceeds well under the timeout, and the file afterwards names the caller's own pid", () => {
  const root = makeRoot();
  try {
    // A real spawned-and-exited child -- guaranteed dead by the time spawnSync returns.
    const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = exited.pid;
    const lockPath = lifecycleLockPath(root);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: deadPid, hostname: 'stale-holder', startedAt: new Date().toISOString() })
    );

    const start = Date.now();
    const result = acquireLifecycleLock(root, { timeoutMs: 2000, waitIntervalMs: 20 });
    const elapsed = Date.now() - start;

    assert.equal(result.ok, true);
    assert.ok(elapsed < 1000, `expected the dead-pid reap to resolve well under the 2000ms timeout, took ${elapsed}ms`);
    const holder = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(holder.pid, process.pid);
    result.release();
  } finally {
    cleanup(root);
  }
});

test('a lock held by a live pid makes a concurrent verb wait, not fail: it resolves {ok:true} only after the holder releases (>=250ms)', async () => {
  const root = makeRoot();
  const lockPath = lifecycleLockPath(root);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  // The test process itself is the live holder ("from the test process").
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, hostname: 'test', startedAt: new Date().toISOString() }));
  const holdMs = 300;
  const released = new Promise((resolve) => {
    setTimeout(() => {
      try {
        unlinkSync(lockPath);
      } catch {
        // already gone somehow -- fine
      }
      resolve();
    }, holdMs);
  });
  try {
    const start = Date.now();
    const acquirePromise = runChildAcquire(lockPath, 5000);
    const [result] = await Promise.all([acquirePromise, released]);
    const elapsed = Date.now() - start;
    assert.equal(result.ok, true);
    assert.ok(elapsed >= 250, `expected the waiter to resolve only after the holder released (>=250ms), took ${elapsed}ms`);
  } finally {
    cleanup(root);
  }
});

test('an injected short timeout, with the lock held by a live pid, returns {ok:false, code:"lock-timeout", reason} naming the holder, with nothing moved or written', () => {
  const root = makeRoot();
  const lockPath = lifecycleLockPath(root);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const startedAt = new Date().toISOString();
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, hostname: 'test', startedAt }));
  try {
    const before = readFileSync(lockPath, 'utf8');
    const result = acquireLifecycleLock(root, { timeoutMs: 150, waitIntervalMs: 20 });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'lock-timeout');
    assert.match(result.reason, new RegExp(`held by pid ${process.pid} since`));
    // Nothing moved or written: the lock file itself is byte-identical to before the call.
    assert.equal(readFileSync(lockPath, 'utf8'), before);
  } finally {
    unlinkSync(lockPath);
    cleanup(root);
  }
});

test("withLifecycleLock runs fn while holding the lock and releases it after, returning fn's own result", () => {
  const root = makeRoot();
  try {
    let sawLockHeld = false;
    const result = withLifecycleLock(root, () => {
      sawLockHeld = existsSync(lifecycleLockPath(root));
      return { ok: true, changed: [], message: 'x', verb: 'test' };
    });
    assert.equal(sawLockHeld, true);
    assert.deepEqual(result, { ok: true, changed: [], message: 'x', verb: 'test' });
    assert.equal(existsSync(lifecycleLockPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('withLifecycleLock releases the lock even when fn throws, and rethrows', () => {
  const root = makeRoot();
  try {
    assert.throws(
      () =>
        withLifecycleLock(root, () => {
          throw new Error('boom');
        }),
      /boom/
    );
    assert.equal(existsSync(lifecycleLockPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('withLifecycleLock returns the lock-timeout rejection without ever calling fn, when the lock cannot be acquired', () => {
  const root = makeRoot();
  const lockPath = lifecycleLockPath(root);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, hostname: 'test', startedAt: new Date().toISOString() }));
  try {
    let called = false;
    const result = withLifecycleLock(
      root,
      () => {
        called = true;
        return { ok: true };
      },
      { timeoutMs: 100, waitIntervalMs: 20 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'lock-timeout');
    assert.equal(called, false);
  } finally {
    unlinkSync(lockPath);
    cleanup(root);
  }
});
