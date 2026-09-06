// scoped-commit — layer 3, git-aware helper for the commit step every
// bookkeeping-writing skill (`modeling`, `quick-capture`) currently hand-
// composes as `git add <paths>` + `git commit -m <message>` (agentic-workflow-
// pt0gy). ADR-0038's boundary is kept exactly: the lifecycle CLI
// (`lib/task-lifecycle-cli.mjs`) stays git-free; this is a SEPARATE module for
// the layer that owns git, callable by the skill after it has the manifest's
// `changed` paths + `message` in hand.
//
// ASYNC (`runScopedCommit` returns a Promise), because it shells out to a
// child process — this is the one function in this task that IS async;
// nothing in `lib/lifecycle-lock.mjs`, `lib/task-lifecycle.mjs`,
// `lib/task-lifecycle-capture-dismiss.mjs`, or `lib/task-lifecycle-cli.mjs`
// changes shape because of it (they stay synchronous, per this task's
// constraint that no EXISTING writer function or test may become async).
//
// SCOPED-ADD ENFORCEMENT (mechanizes ADR-0026 §5, previously prose-only
// here): refuses `-A`, `.`, and any glob-looking path outright, before
// running `git` at all — every path must be a concrete file. A caller that
// wants "everything I touched" must enumerate it; this module never expands
// a wildcard on the caller's behalf.
//
// INDEX.LOCK RETRY: `git add` and `git commit` are retried INDEPENDENTLY —
// each is its own retry loop — when the step exits non-zero AND stderr
// matches git's own `Unable to create '….git/index.lock'` message, the shape
// a sibling `modeling` / `quick-capture` / `work` session's own concurrent
// `git` invocation produces. Backoff starts at 50ms, doubles, caps at 800ms,
// for up to 6 attempts per step (worst case ~2.4s of sleeping before giving
// up). This module NEVER deletes `index.lock` itself — a live sibling may
// still hold it, and unlinking another process's lock file out from under it
// is exactly the corruption this retry exists to avoid, not invite.

import { execFile } from 'node:child_process';

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_INITIAL_DELAY_MS = 50;
const DEFAULT_MAX_DELAY_MS = 800;

/** Matches git's own message when `index.lock` already exists (any OS path style, POSIX or Windows). */
const INDEX_LOCK_ERROR = /Unable to create '[^']*\.git[\\/]index\.lock'/;

/** A caller-supplied path that would expand or sweep rather than name one concrete file. */
const GLOB_CHARS = /[*?[\]{}]/;

function isInvalidPath(p) {
  return typeof p !== 'string' || p === '-A' || p === '.' || p.length === 0 || GLOB_CHARS.test(p);
}

function runGit(cwd, args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (!err) return resolve({ code: 0, stdout: stdout ?? '', stderr: stderr ?? '' });
      resolve({
        code: typeof err.code === 'number' ? err.code : 1,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` (one git invocation) up to `maxAttempts` times, retrying ONLY when
 * it fails with the `index.lock` contention shape, backing off 50ms -> 800ms
 * cap, doubling each time. Any other non-zero exit is NOT retried — it's a
 * real git failure, surfaced immediately as `git-failed`.
 */
async function retryOnIndexLock(fn, { maxAttempts, initialDelayMs, maxDelayMs }) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fn();
    if (result.code === 0) {
      return { ok: true, attempts: attempt, stdout: result.stdout };
    }
    const isLockContention = INDEX_LOCK_ERROR.test(result.stderr || '');
    if (!isLockContention) {
      return {
        ok: false,
        code: 'git-failed',
        attempts: attempt,
        reason: (result.stderr || result.stdout || '').trim() || `git exited ${result.code}`,
      };
    }
    await sleep(Math.min(delay, maxDelayMs));
    delay = Math.min(delay * 2, maxDelayMs);
    if (attempt === maxAttempts) {
      return {
        ok: false,
        code: 'git-index-lock-exhausted',
        attempts: attempt,
        reason: `git/index.lock was still present after ${attempt} attempts.`,
      };
    }
  }
  /* c8 ignore next -- unreachable: the loop always returns on its last iteration above */
}

/**
 * Run `git add <paths…>` then `git commit -m <message>` against `cwd`,
 * retrying EACH step independently on `index.lock` contention.
 *
 * @param {string} cwd     A git working tree.
 * @param {string[]} paths Concrete file paths (never `-A`, `.`, or a glob).
 * @param {string} message The commit message.
 * @param {object} [opts]
 * @param {number} [opts.maxAttempts]    Default 6.
 * @param {number} [opts.initialDelayMs] Default 50.
 * @param {number} [opts.maxDelayMs]     Default 800.
 * @returns {Promise<
 *   {ok:true, sha:string|null, attempts:number}
 *   | {ok:false, code:'invalid-path'|'invalid-message'|'git-failed'|'git-index-lock-exhausted', attempts:number, reason?:string}
 * >}
 */
export async function runScopedCommit(cwd, paths, message, opts = {}) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return {
      ok: false,
      code: 'invalid-path',
      attempts: 0,
      reason: 'runScopedCommit requires a non-empty array of concrete file paths.',
    };
  }
  const badPath = paths.find(isInvalidPath);
  if (badPath !== undefined) {
    return {
      ok: false,
      code: 'invalid-path',
      attempts: 0,
      reason: `runScopedCommit refuses "-A", ".", and glob-looking paths -- got ${JSON.stringify(badPath)}.`,
    };
  }
  if (typeof message !== 'string' || message.length === 0) {
    return { ok: false, code: 'invalid-message', attempts: 0, reason: 'runScopedCommit requires a non-empty commit message.' };
  }

  const retryOpts = {
    maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    initialDelayMs: opts.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs: opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
  };

  const addResult = await retryOnIndexLock(() => runGit(cwd, ['add', '--', ...paths]), retryOpts);
  if (!addResult.ok) {
    return { ok: false, code: addResult.code, attempts: addResult.attempts, reason: addResult.reason };
  }

  const commitResult = await retryOnIndexLock(() => runGit(cwd, ['commit', '-m', message]), retryOpts);
  if (!commitResult.ok) {
    return {
      ok: false,
      code: commitResult.code,
      attempts: addResult.attempts + commitResult.attempts,
      reason: commitResult.reason,
    };
  }

  const shaResult = await runGit(cwd, ['rev-parse', 'HEAD']);
  const sha = shaResult.code === 0 ? shaResult.stdout.trim() : null;

  return { ok: true, sha, attempts: addResult.attempts + commitResult.attempts };
}
