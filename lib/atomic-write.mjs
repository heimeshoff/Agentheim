// atomic-write — one same-directory temp-file + renameSync primitive every
// bookkeeping-file writer (INDEX.md / protocol.md / the protocol and
// done-list archives, plus applyTaskMove's destination write and
// materializeTaskFile's new-task-file write) goes through
// (agentic-workflow-vhz69). Stdlib only, synchronous, git-free.
//
// GUARANTEE (stated precisely, as this task requires): atomic against
// PROCESS DEATH — a crash, Ctrl-C, or an OS kill between the temp-file write
// and the rename can never leave the TARGET truncated or half-written,
// because the target itself is never opened for writing; a throw at any
// point after the temp file exists unlinks it (best effort, never masking
// the original error), leaving the target exactly as it was. This does NOT
// claim to survive POWER LOSS — no `fsync` is called, so a crash of the
// underlying storage (not the process) before the OS has flushed the rename
// to the platter is out of scope, the same posture every other write in
// this codebase already has (single-user, single-process tool).
//
// SAME DIRECTORY, SAME FILESYSTEM: the temp file is written beside its
// target (`dirname(filePath)`), so `renameSync` is a same-filesystem
// metadata operation — atomic replace on POSIX, and on Windows Node's
// `renameSync` maps to `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`, which
// replaces an existing NTFS target in one call.
//
// TEMP NAME: `.<basename>.<pid>.<counter>.tmp` — dot-prefixed (hidden-file
// convention) and a non-`.md` extension, so nothing that globs `*.md` picks
// it up mid-write. `<pid>` plus a per-process monotonic counter make two
// concurrent writers, or two writes in the same process (e.g. INDEX.md then
// protocol.md), collide-proof without a random-number import.
//
// DASHBOARD FRAME-ROUTING (verified against `dashboard/app/live-frame-
// router.js`, ADR-0070): a temp file living beside `INDEX.md`
// (`.agentheim/contexts/<bc>/`) or `protocol.md` (`.agentheim/knowledge/`)
// matches neither the ADVISORY (`.agentheim/state/`) nor RUNTIME
// (`.agentheim/.dashboard/`) prefix `classifyFramePath` checks, so it
// classifies STRUCTURAL — the SAME category the real write already
// produces; there is no worse-classified extra frame this naming could
// cause. In practice `dashboard/watcher.mjs`'s 150ms debounce collapses the
// create + rename (+ unlink-on-failure) burst into the one `tree-changed`
// frame the write already emits, so no additional frame is observed at all;
// even if one were, one extra STRUCTURAL frame per write is inside the
// router's own accepted "one wasted fetch, never a stale board" cost (its
// module doc comment's FAIL OPEN policy).
//
// WINDOWS EPERM/EBUSY: `renameSync` over a target another process holds
// open (an editor, the dashboard watcher mid-read) can fail transiently.
// Bounded retry — 3 attempts, 20ms apart, the same posture
// `lib/lifecycle-lock.mjs`'s release retry already uses. On exhaustion the
// temp file is removed and a structured `AtomicWriteError` is thrown; the
// target is untouched, never half-applied.

import { writeFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';

let counter = 0;

/** Stdlib-only synchronous sleep (copied from lib/lifecycle-lock.mjs's sleepSync). */
function sleepSync(ms) {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

/** Structured error thrown on rename-retry exhaustion. The target is untouched; the temp file has been removed. */
export class AtomicWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AtomicWriteError';
    this.code = code;
  }
}

function isTransientRenameError(err) {
  return Boolean(err) && (err.code === 'EPERM' || err.code === 'EBUSY');
}

/**
 * Write `data` to `filePath` atomically against process death: write to a
 * sibling temp file in the SAME directory, then `renameSync` it onto
 * `filePath`. Never leaves a temp file behind on the success path. On any
 * throw after the temp file is created, the temp file is unlinked (best
 * effort — a cleanup failure never masks the original error) and the
 * original error (or a structured `AtomicWriteError` on rename-retry
 * exhaustion) propagates; the target is left exactly as it was before this
 * call.
 *
 * NOT durable against power loss — no `fsync`. See this module's header.
 *
 * @param {string} filePath
 * @param {string|Buffer} data
 * @param {object} [opts]
 * @param {number} [opts.retryAttempts] Bounded EPERM/EBUSY retry on the rename. Default 3.
 * @param {number} [opts.retryDelayMs]  Delay between retries, ms. Default 20.
 * @param {(tmpPath:string)=>void} [opts.injectFailureAfterWrite] TEST-ONLY hook
 *   invoked right after the temp file is written, before the rename; if it
 *   throws, the throw is treated exactly like a real interruption in that
 *   window (temp file cleaned up, error propagated). Never set outside a test.
 * @param {(from:string,to:string)=>void} [opts.renameSync] TEST-ONLY override for
 *   the rename call (defaults to the real `fs.renameSync`) — lets a test force
 *   the rename step itself to throw. Never set outside a test.
 */
export function writeFileAtomic(filePath, data, opts = {}) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  counter += 1;
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${counter}.tmp`);
  const retryAttempts = opts.retryAttempts ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 20;
  const doRename = opts.renameSync ?? renameSync;

  writeFileSync(tmpPath, data);

  try {
    if (opts.injectFailureAfterWrite) opts.injectFailureAfterWrite(tmpPath);

    // TEST-ONLY hold point: block here, after the temp file exists and before
    // the rename, for AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS milliseconds — the
    // window a real-process kill test needs to SIGKILL/taskkill this process
    // between the temp write and the rename. A no-op unless the env var is
    // set to a positive number; never set outside a test.
    const holdMs = Number(process.env.AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS);
    if (Number.isFinite(holdMs) && holdMs > 0) sleepSync(holdMs);

    let lastErr;
    for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
      try {
        doRename(tmpPath, filePath);
        return;
      } catch (err) {
        lastErr = err;
        if (!isTransientRenameError(err) || attempt === retryAttempts - 1) throw err;
        sleepSync(retryDelayMs);
      }
    }
    throw lastErr;
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Best effort — a cleanup failure never masks the original error.
    }
    if (isTransientRenameError(err)) {
      throw new AtomicWriteError(
        'atomic-write-rename-exhausted',
        `writeFileAtomic: renameSync(${tmpPath} -> ${filePath}) failed after ${retryAttempts} attempt(s): ${err.message}. The target is untouched.`
      );
    }
    throw err;
  }
}
