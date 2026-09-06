// lifecycle-lock — one project-wide advisory lock guarding every bookkeeping
// writer (agentic-workflow-pt0gy). Stdlib only, git-free, synchronous.
//
// WHY ONE LOCK, NOT ONE PER FILE: `protocol.md` is shared by every verb across
// every BC, so a finer grain buys nothing without a lock-ordering scheme this
// scale does not need (a per-file lock would still have to serialize any verb
// that touches BOTH an INDEX.md and protocol.md against a sibling touching
// just one of them, in some order — the project-wide lock sidesteps ordering
// entirely by only ever holding one lock at a time).
//
// PRIMITIVE: `fs.openSync(path, 'wx')` — atomic exclusive-create on both POSIX
// and Windows, stdlib only (no `flock`, no native addon, no SQLite — vision
// non-goal 5). Lock file contents are `{pid, hostname, startedAt}`; no
// heartbeat, since a hold lasts milliseconds (one verb's compute-then-write).
//
// WAITER POLICY: a synchronous poll built on `Atomics.wait` (so none of the
// seven writer functions this wraps, nor their existing synchronous tests,
// need to turn `async`), 100ms interval, 10s bound by default (both
// injectable). On exhaustion, `acquireLifecycleLock` returns
// `{ok:false, code:'lock-timeout', reason}` naming the current holder —
// nothing is moved, nothing is written, because the caller never got past
// acquiring the lock.
//
// STALENESS = dead pid only. A lock file naming a pid that
// `process.kill(pid, 0)` reports dead is reaped (unlinked) by the NEXT waiter
// to notice it stale, then everyone still waiting retries `'wx'` — the
// exclusive-create primitive itself resolves the double-reap race: of two
// waiters that both judge the same lock stale, at most one `openSync(..,
// 'wx')` call succeeds, the other gets `EEXIST` again and loops. A LIVE
// holder is never auto-broken by age, however long it has held the lock.
//
// RELEASE is `unlinkSync` inside a `finally`, with a small bounded retry
// (3 attempts, 20ms apart) for a transient Windows `EBUSY`/`EPERM`, and it
// NEVER throws out of that `finally` — an orphaned lock file left behind by a
// release that still failed after the retry is reaped by the next acquirer's
// dead-pid check; an exception escaping `finally` would instead clobber the
// verb's own real result (its manifest or rejection), which is worse.
//
// PID-ALIVE PROBE: copied from `dashboard/runfile.mjs`'s `isPidAlive` (an
// eight-line function) rather than imported — this module must never add a
// second `lib -> dashboard` import (`lib/task-lifecycle-cli.mjs`'s existing
// `discoverRoot` import is the one already-accepted exception, and adding a
// second import from a sibling `lib/` module would compound rather than
// clean up that direction). Promoting `isPidAlive` into `lib/` itself is a
// reasonable follow-on, left undone here per this task's own scope.
//
// WHERE ACQUIRED: inside each of the seven writer functions (`promoteTask`,
// `claimBatch`, `completeTask`, `captureTask`, `dismissTask`'s CONFIRM phase
// only, `rotateProtocol`, `rotateIndexDoneList`'s per-BC inner function) plus
// the two new mechanics verbs (`log`, `index-add`) — never at a CLI dispatch
// layer. `rotateProtocol` and `rotateIndexDoneList` are independent CLI entry
// points `work` bootstraps directly, never through `task-lifecycle-cli.mjs`,
// so a dispatch-level lock would leave them unprotected; wrapping BOTH the
// dispatch layer and the writer would also self-deadlock this lock, which is
// not reentrant. Read-only calls (`checkpoint`, `dismiss --plan`) stay
// unlocked — they mutate nothing. `applyTaskMove` stays lock-unaware and
// unchanged — see this task's ADR for the full rationale.
//
// DOCUMENTED FACT, NOT A FIX: `discoverRoot(cwd)` resolves to a worktree's own
// root when a verb runs inside one, so such a verb takes a DIFFERENT lock
// file than one running on `main`. Harmless today (only the unlocked
// `checkpoint` ever runs in a worktree, post-ghcaj) — see this task's ADR.

import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 100ms poll interval, 10s bound — both injectable per-call for tests. */
export const DEFAULT_WAIT_INTERVAL_MS = 100;
export const DEFAULT_TIMEOUT_MS = 10_000;

/** The one project-wide lock's path, gitignored under `.agentheim/state/` (ADR-0027). */
export function lifecycleLockPath(rootDir) {
  return path.join(rootDir, '.agentheim', 'state', 'lifecycle.lock');
}

/**
 * `process.kill(pid, 0)` probes without delivering a signal: `ESRCH` means
 * dead, `EPERM` means alive (exists, just not owned by us). Copied verbatim
 * from `dashboard/runfile.mjs`'s `isPidAlive` — see the module doc comment
 * above for why this is a copy, not an import.
 */
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** Block the calling thread for `ms` milliseconds — the stdlib-only synchronous sleep. */
function sleepSync(ms) {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

/** Read + JSON-parse the lock file's `{pid, hostname, startedAt}`, or `null` on any failure (gone, malformed). */
function readHolderSafely(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * If the lock at `lockPath` names a dead pid, unlink it. A no-op (never
 * throws) when the file is already gone, unreadable/malformed, or names a
 * live pid. Of two concurrent waiters that both call this for the same stale
 * lock, at most one `unlinkSync` succeeds — the other's failure is swallowed,
 * which is correct: the lock is gone either way, and both waiters' next
 * `openSync(.., 'wx')` race fairly for it.
 */
function reapIfStale(lockPath) {
  const holder = readHolderSafely(lockPath);
  if (!holder || typeof holder.pid !== 'number') return;
  if (isPidAlive(holder.pid)) return;
  try {
    unlinkSync(lockPath);
  } catch {
    // Already reaped by a concurrent waiter, or released normally in the
    // interim -- either way there is nothing left to do.
  }
}

/** Release the lock: `unlinkSync` with a small bounded retry, and it NEVER throws. */
function releaseLifecycleLock(lockPath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      unlinkSync(lockPath);
      return;
    } catch (err) {
      if (err.code === 'ENOENT') return; // already gone -- nothing to release
      if (attempt === 2) return; // give up silently; the next acquirer's dead-pid check reaps an orphan
      sleepSync(20);
    }
  }
}

/**
 * Acquire the one project-wide lifecycle lock, blocking the calling thread
 * (synchronously) until it is free or `opts.timeoutMs` elapses.
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @param {number} [opts.waitIntervalMs]  Poll interval. Default `DEFAULT_WAIT_INTERVAL_MS` (100ms).
 * @param {number} [opts.timeoutMs]       Wait bound. Default `DEFAULT_TIMEOUT_MS` (10s).
 * @param {string} [opts.lockPath]        Override for tests; defaults to `lifecycleLockPath(rootDir)`.
 * @returns {{ok:true, release: () => void} | {ok:false, code:'lock-timeout', reason:string}}
 */
export function acquireLifecycleLock(rootDir, opts = {}) {
  const waitIntervalMs = opts.waitIntervalMs ?? DEFAULT_WAIT_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lockPath = opts.lockPath ?? lifecycleLockPath(rootDir);
  mkdirSync(path.dirname(lockPath), { recursive: true });

  const payload = JSON.stringify({
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
  });
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      writeSync(fd, payload);
      closeSync(fd);
      return { ok: true, release: () => releaseLifecycleLock(lockPath) };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Held by someone else. Reap it if the holder is dead (a no-op if it's
    // live or already gone), then decide whether to give up or wait and retry.
    reapIfStale(lockPath);

    if (Date.now() >= deadline) {
      const holder = readHolderSafely(lockPath);
      return {
        ok: false,
        code: 'lock-timeout',
        reason: holder
          ? `Lifecycle lock held by pid ${holder.pid} since ${holder.startedAt}.`
          : 'Lifecycle lock timed out (holder unreadable).',
      };
    }
    sleepSync(Math.min(waitIntervalMs, Math.max(0, deadline - Date.now())));
  }
}

/**
 * Run `fn` (synchronous, returning a manifest or rejection) while holding the
 * one project-wide lifecycle lock. If the lock can't be acquired within the
 * bound, `fn` never runs and the timeout rejection is returned in its place —
 * nothing moved, nothing written. The lock is always released before this
 * function returns, success or throw.
 *
 * @param {string} rootDir
 * @param {() => object} fn
 * @param {object} [opts]  Forwarded to `acquireLifecycleLock`.
 * @returns {object}  Either `fn()`'s own return value, or `{ok:false, code:'lock-timeout', reason}`.
 */
export function withLifecycleLock(rootDir, fn, opts = {}) {
  const lock = acquireLifecycleLock(rootDir, opts);
  if (!lock.ok) return lock;
  try {
    return fn();
  } finally {
    lock.release();
  }
}
