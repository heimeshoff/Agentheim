---
id: ADR-0076
title: Atomic write-temp-then-rename primitive — guarantee boundary (process death, not power loss) and which writers it covers
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-vhz69]
related_adrs: [0039, 0047, 0054, 0055, 0073, 0075]
---

# ADR-0076: Atomic write-temp-then-rename primitive — guarantee boundary and routing

## Context

ADR-0054 made the mechanized lifecycle verbs' *compute* phase atomic (compute-then-write) and
ADR-0055 made `applyTaskMove`'s internal move write-destination-then-unlink-source, but both
explicitly parked the *write itself* as non-atomic: `writeFileSync` truncates its target and
then streams bytes, so a process killed mid-write (Ctrl-C, a closed terminal, an OS kill)
between those two steps can leave `INDEX.md` or `protocol.md` zero-length or half-written.
`agentic-workflow-pt0gy` (ADR-0075) serializes concurrent writers with a project-wide lock but
does not change what a single interrupted writer leaves behind — a different failure axis
entirely. This task closes that axis: one write-temp-then-rename primitive, and a decision for
every whole-file overwrite in the four bookkeeping-writer modules about whether it belongs
behind that primitive.

## Decision

### 1. The primitive

`writeFileAtomic(filePath, data, opts)` (`lib/atomic-write.mjs`): write `data` to a sibling temp
file in the SAME directory as `filePath` (so the rename is a same-filesystem metadata
operation — atomic replace on POSIX, `MoveFileExW(MOVEFILE_REPLACE_EXISTING)` on Windows/NTFS),
then `renameSync(tmp, filePath)`. On any throw after the temp file exists — including rename
retry exhaustion — the temp file is unlinked in a `finally`-equivalent (best effort, never
masking the original error) and the original error (or a structured `AtomicWriteError` on
retry exhaustion) propagates; the target is left exactly as it was. A bounded 3×20ms
EPERM/EBUSY retry on the rename mirrors `lib/lifecycle-lock.mjs`'s own release-retry posture,
covering the transient Windows case where another process (an editor, the dashboard watcher
mid-read) holds the target open.

**Guarantee boundary, stated precisely (doc comment):** atomic against PROCESS DEATH, not
against POWER LOSS — no `fsync` is called, so storage-level loss before the OS flushes the
rename to the platter is out of scope, matching the posture every other write in this codebase
already has (a single-user, single-process tool; vision non-goal).

**Temp-file name:** `.<basename>.<pid>.<counter>.tmp` — dot-prefixed and non-`.md`, so nothing
globbing `*.md` picks it up; `pid` + a per-process monotonic counter make concurrent writers,
or two writes in the same process (INDEX then protocol), collide-proof without a random-number
import. Verified against `dashboard/app/live-frame-router.js`'s `classifyFramePath`: neither
`.agentheim/contexts/<bc>/` nor `.agentheim/knowledge/` matches the ADVISORY
(`.agentheim/state/`) or RUNTIME (`.agentheim/.dashboard/`) prefix, so a temp-file create
classifies STRUCTURAL — the identical category the real write already produces, so this naming
introduces no worse-classified frame. In practice `dashboard/watcher.mjs`'s 150ms debounce
collapses the create+rename(+unlink-on-failure) burst into the single `tree-changed` frame the
write already emits — no additional frame is observed at all; even if one were, one extra
STRUCTURAL frame per write is inside the frame router's own accepted "one wasted fetch, never a
stale board" FAIL OPEN cost.

**Test-only seams**, never exercised outside `lib/test/`: `opts.renameSync` (override the
rename call, e.g. to force a throw) and `opts.injectFailureAfterWrite` (force a throw between
the temp write and the rename) for the in-process unit tests; a
`AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS` env var, read internally, that blocks (a stdlib
`Atomics.wait` sleep, copied from `lifecycle-lock.mjs`'s `sleepSync`) after the temp write and
before the rename — the hold the real-process kill test uses. This is a LOCAL hold, not
`agentic-workflow-dpbjj`'s (that sibling task's `lib/lifecycle-lock.mjs` hold has not landed on
this branch, and that module/its test are explicitly out of scope here); it lives entirely
inside this new primitive, so it neither touches `lifecycle-lock.mjs` nor
`task-lifecycle-cli-mechanics.test.mjs`.

### 2. Routing — every whole-file bookkeeping overwrite goes through it

`writeNormalizedFile` (now the ONE exported implementation, see §3) in `task-lifecycle.mjs`;
`rotateProtocol`'s live-file and archive writes and `rotateIndexDoneList`'s live-file, archive,
and header-heal writes. Three further sites were judged the same corruption class and routed
too, rather than left as bare `writeFileSync`:

- **`applyTaskMove`'s destination write** (ADR-0055's `writeFileSync(toPath, rewritten)`) — left
  in scope by that ADR as accepted residual, but the primitive drops in cleanly here: `toDir`
  is already backfilled by the preceding `mkdirSync`, and the write is the same "write a whole
  file" shape the primitive targets. This also hardens ADR-0055's own self-healing duplicate
  path — a retry that finds a stale duplicate already at `toPath` now overwrites it atomically
  rather than truncating it in place.
- **`materializeTaskFile`'s new-task-file write** — even though the preceding duplicate-id guard
  means there is no pre-existing content this write could clobber, a crash mid-write here would
  still leave a new task file half-written under `backlog/`, the same "silent corruption no
  other verb detects" failure class as a truncated `INDEX.md`.
- **`dismissTask`'s confirm-phase surviving-backlink rewrites** (a survivor task file's
  `depends_on`/`blocks`/`prior_art`, an ADR's `related_tasks`) — whole-file overwrites of
  pre-existing content, identical in kind to `INDEX.md`/`protocol.md`.

### 3. The `readNormalizedFile`/`writeNormalizedFile` fold

ADR-0073's "Why a separate module" section named the duplicated pair (plus others) a deliberate
merge-risk trade for the concurrent-worktree window that existed at the time, to be
re-examined once none was in flight. `agentic-workflow-pt0gy` has since landed; this task closes
that trigger for these two functions specifically (not the other duplicated helpers named
there, which are out of this task's scope): both are now `export`ed from `task-lifecycle.mjs`
and imported by `task-lifecycle-capture-dismiss.mjs`, which drops its own copies.
`writeNormalizedFile`'s body now calls `writeFileAtomic` with the already-denormalized bytes.

## Consequences

**Positive:** every mechanized bookkeeping write in the four modules is now crash-safe against
process death — a kill mid-write leaves the target byte-identical to before, never truncated or
half-written. The fold removes one of ADR-0073's accepted duplications now that its own
re-examination trigger has fired. `applyTaskMove`'s destination write and
`materializeTaskFile`'s new-file write get the same guarantee for free, closing two residual
windows those functions' own ADRs had left open.

**Negative:** one extra temp-file create+rename pair per bookkeeping write (negligible on the
string-sized files this codebase writes); a stray `.tmp` file can be left behind specifically by
an OS-level kill (not a JS throw, which this primitive always cleans up) — accepted, since
nothing on the read side scans for or is confused by it, and the next writer's own temp file
uses a fresh `pid`+counter name.

**Neutral:** `fsync`/power-loss durability and the dashboard's own runfile/advisory writes
remain explicitly out of scope, per this task's own framing.

## Alternatives considered

- **Leave `applyTaskMove`'s destination write and `materializeTaskFile` as bare `writeFileSync`,
  scope this task to only the four writer modules' INDEX/protocol/archive writes.** Rejected:
  both are the identical "crash truncates a whole-file write" failure class the primitive
  exists to close, and the primitive drops in with no shape change to either function's
  control flow.
- **Reuse `agentic-workflow-dpbjj`'s lifecycle-lock hold point for the real-process kill test.**
  Rejected for this task specifically: that sibling's hold has not landed on this branch, and
  `lib/lifecycle-lock.mjs` / `lib/test/task-lifecycle-cli-mechanics.test.mjs` are out of scope
  to edit here. A self-contained env-var-gated hold inside the new primitive gives the same
  kill-window proof without touching either file.
- **A random component (`crypto.randomBytes`) in the temp-file name.** Rejected: `pid` +
  a per-process monotonic counter already make every temp name unique for this codebase's
  concurrency shape (one lifecycle lock serializes writers project-wide; two writes in the same
  process are the only same-pid case), at the cost of one more import for no added safety here.

## References

- ADR-0054 — compute-then-write atomicity; left the write step itself non-atomic, which this
  ADR closes.
- ADR-0055 — `applyTaskMove`'s write-destination-then-unlink-source shape; this ADR makes the
  destination write itself atomic-replace, without reopening the ordering ADR-0055 decided.
- ADR-0073 — named the `readNormalizedFile`/`writeNormalizedFile` duplication a temporary,
  re-examine-once-none-in-flight trade; this ADR closes that trigger for this pair.
- ADR-0075 — the lifecycle lock this task's primitive runs inside (last thing before release);
  a different failure axis (concurrent writers vs. a single interrupted writer) this task does
  not reopen.
- `agentic-workflow-dpbjj` — the sibling task adding a lock-side hold point and hardening the
  spawn-concurrency test; not depended on or edited by this task.
