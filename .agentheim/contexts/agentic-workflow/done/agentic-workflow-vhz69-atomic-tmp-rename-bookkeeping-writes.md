---
id: agentic-workflow-vhz69
title: Atomic temp-file-plus-rename for every INDEX.md / protocol.md / archive write — a crash mid-write must never truncate a bookkeeping file
status: done
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-pt0gy]
blocks: []
tags: [concurrency, bookkeeping, lifecycle-cli, crash-safety]
related_adrs: [0039, 0047, 0054, 0055, 0073, 0076]
related_research: []
prior_art: [agentic-workflow-e4bjh, agentic-workflow-k5n8f, agentic-workflow-r2c7m, agentic-workflow-wq7fn]
---

## Why

Every mechanized writer replaces `INDEX.md` and `protocol.md` whole-file with a single
`writeFileSync` (`writeNormalizedFile` in `lib/task-lifecycle.mjs:416` and its duplicate in
`lib/task-lifecycle-capture-dismiss.mjs:91`; the rotation scripts' archive and live-file
writes in `lib/protocol-rotation.mjs` and `lib/index-rotation.mjs`). `writeFileSync` truncates
the target first and then streams the bytes; a process killed between the two — Ctrl-C on a
modeling session, a terminal closing, an OS kill — leaves a zero-length or half-written
file. For `INDEX.md` that is a silent board with no marker blocks (every later verb refuses
`bookkeeping-marker-mismatch`); for `protocol.md` it is lost history that no reader detects.
ADR-0054 made the *compute* phase atomic and ADR-0055 ordered the two-step move so a crash
leaves "blocked and visible"; the file write itself was left as the one non-atomic step.
`agentic-workflow-pt0gy`'s lock serializes writers but does not change what a single
interrupted writer leaves behind. Pinned by the second architect + tactical-modeler round on
2026-09-06.

## What

Route every bookkeeping-file write through one write-temp-then-rename primitive:

1. **Primitive.** `writeFileAtomic(filePath, bytes)` (name open): write to a sibling temp
   file in the **same directory** (same filesystem, so rename is a metadata operation), then
   `renameSync(tmp, filePath)`. Atomic replace on POSIX; on Windows Node's `renameSync` maps to
   `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`, which replaces an existing target in one call on
   NTFS. On any throw after the temp file exists, unlink it in `finally` (best effort, never
   masking the original error). Preserve `writeNormalizedFile`'s EOL/BOM restoration — the
   primitive takes already-denormalized bytes.
2. **Callers.** `writeNormalizedFile` in both lifecycle modules; the live-file and archive
   writes in `rotateProtocol` and `rotateIndexDoneList`; `materializeTaskFile`'s task-file
   write (`lib/task-lifecycle.mjs:850`) and the dismiss confirm phase's surviving-backlink
   rewrites (`task-lifecycle-capture-dismiss.mjs:671/675`) if the worker judges them the same
   class — decide and record. `applyTaskMove`'s write-destination-then-unlink-source
   (ADR-0055) already has a two-step shape; leave it unless the primitive drops in cleanly.
   While there, fold the duplicated `readNormalizedFile`/`writeNormalizedFile` pair back into
   one exported implementation — ADR-0073's "Why a separate module" section says the
   duplication was a merge-risk trade during concurrent worktrees and should be re-examined
   once none is in flight; pt0gy having landed, none is.
3. **Temp-file naming and the dashboard.** The temp file lives beside `INDEX.md` inside
   `contexts/<bc>/` and beside `protocol.md` inside `knowledge/`, both watched by the
   dashboard (ADR-0070 frame routing). Choose a name the watcher can classify or ignore
   (e.g. `.INDEX.md.<pid>.tmp` — a dot-prefixed, non-`.md` extension), verify against the
   frame router which category a create+rename of that name lands in, and record whether one
   extra advisory or structural frame per write is accepted or filtered. Never leave a temp
   file behind on the success path.
4. **Lock ordering.** The rename happens inside pt0gy's held section, as the last thing the
   writer does — the lock still covers read→compute→write; this task only changes what
   "write" means.

Out of scope: `fsync` durability (a power loss, not a process death, is the failure this
does not claim to survive — say so in the doc comment); the dashboard's own runfile and
advisory writes (`whats-next.md`, `runtime.json`), which have their own write discipline.

## Acceptance criteria

- [ ] One exported atomic-write primitive exists in `lib/` (same-directory temp file, `renameSync` replace, temp unlinked on any failure) and is the only write path for `INDEX.md`, `protocol.md`, and the protocol / done-list archive files across `lib/task-lifecycle.mjs`, `lib/task-lifecycle-capture-dismiss.mjs`, `lib/protocol-rotation.mjs`, and `lib/index-rotation.mjs` — verified by a grep in the task's Outcome showing no remaining direct `writeFileSync` to those targets.
- [ ] `node --test`: a write whose rename step is forced to throw leaves the target byte-identical to its prior content and no temp file in the directory; a write interrupted after the temp file is created (injected throw between write and rename) likewise; a successful write leaves exactly the target, no temp file, with the original EOL/BOM preserved (CRLF fixture, per the EOL suite already in `lib/test/task-lifecycle-eol.test.mjs`).
- [ ] A real-process check: a spawned CLI `capture` child killed (SIGKILL / `taskkill`) while held at the pre-rename point (reuse `agentic-workflow-dpbjj`'s hold if it has landed, otherwise a local hold) leaves `INDEX.md` and `protocol.md` intact and the next verb succeeds. `test.skip` with a reason where the platform cannot deliver the kill deterministically.
- [ ] The duplicated `readNormalizedFile`/`writeNormalizedFile` pair is folded into one exported implementation, or the Outcome states why not.
- [ ] The temp-file name and its dashboard frame-routing behaviour are recorded in the Outcome and in a one-line README note beside the lib inventory's `promoteTask` / `captureTask` entries; the full `lib/test/*.test.mjs` suite is green on the merged tree (ADR-0062).
- [ ] The doc comment states the guarantee precisely: atomic against process death, not against power loss (no `fsync`).

## Notes

Surfaced as an additive gap to `agentic-workflow-pt0gy`'s todo text by a second orchestrator
round (architect + tactical-modeler) on 2026-09-06 and captured on the builder's request.
Depends on pt0gy so the two tasks never edit the same writer functions in concurrent
worktrees; functionally the change is independent of the lock.

Windows facts worth pinning during the work: `renameSync` over an existing file that another
process holds open (an editor, the dashboard watcher mid-read) fails with `EPERM`/`EBUSY` — a
short bounded retry (the same 3 × 20 ms pt0gy uses for lock release) is the right posture; on
exhaustion the verb must return a structured rejection with the target untouched and the temp
file removed, never a half-applied state.

## Outcome

Added `lib/atomic-write.mjs`'s `writeFileAtomic(filePath, data, opts)`: writes to a
`.{basename}.{pid}.{counter}.tmp` file in the SAME directory as the target, then
`renameSync`s it into place — atomic replace on POSIX, `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`
on Windows/NTFS. On any throw after the temp file exists (including rename-retry exhaustion,
3 attempts × 20ms on EPERM/EBUSY, mirroring `lib/lifecycle-lock.mjs`'s release retry), the temp
file is unlinked best-effort and the error propagates with the target untouched. The doc
comment states the guarantee precisely: atomic against process death, not power loss (no
`fsync`).

**Routing.** Every `INDEX.md`/`protocol.md`/archive write in the four named modules now goes
through it: `writeNormalizedFile` (`task-lifecycle.mjs`'s promote/claim/complete writes, and
`task-lifecycle-capture-dismiss.mjs`'s capture/dismiss writes via the same function, imported —
see the fold below); `rotateProtocol`'s live-file + archive writes and `rotateIndexDoneList`'s
live-file, archive, and header-heal writes. Also routed, decided as the same corruption class:
`applyTaskMove`'s destination write (`lib/task-lifecycle.mjs`, drops in cleanly — `toDir` is
already backfilled by the preceding `mkdirSync`, and it hardens ADR-0055's self-healing
duplicate-overwrite path), `materializeTaskFile`'s new-task-file write, and `dismissTask`'s
confirm-phase surviving-backlink rewrites (a survivor task file's `depends_on`/`blocks`/
`prior_art`, an ADR's `related_tasks`).

**Grep proof — no remaining direct `writeFileSync` to any of these targets:**
```
$ grep -n "writeFileSync" lib/task-lifecycle.mjs lib/task-lifecycle-capture-dismiss.mjs lib/protocol-rotation.mjs lib/index-rotation.mjs
(no output)
```
(`writeFileSync` was also removed from every one of those four files' `node:fs` import list,
since nothing in them calls it directly anymore — `lib/atomic-write.mjs` is the only remaining
`writeFileSync` call site across this surface, and it only ever targets the temp file, never
the real target path.)

**The `readNormalizedFile`/`writeNormalizedFile` fold.** ADR-0073 named this pair's duplication
(among others) a deliberate concurrent-worktree merge-risk trade, to be re-examined once none
was in flight. `pt0gy` has since landed, so both functions are now `export`ed from
`lib/task-lifecycle.mjs` and imported by `lib/task-lifecycle-capture-dismiss.mjs`, which drops
its own copies (that module's other duplicated helpers — `parseFrontmatterField`,
`formatProtocolTimestamp`, `adjustIndexCount`, the task-file resolver — are unchanged, out of
this task's scope).

**Temp-file naming and dashboard frame-routing.** Name: `.<basename>.<pid>.<counter>.tmp`.
Verified against `dashboard/app/live-frame-router.js`'s `classifyFramePath`: neither
`.agentheim/contexts/<bc>/` (where the INDEX temp file lands) nor `.agentheim/knowledge/`
(protocol/archives) matches the ADVISORY (`.agentheim/state/`) or RUNTIME
(`.agentheim/.dashboard/`) prefix, so a temp-file create classifies STRUCTURAL — the SAME
category the real write already produces. `dashboard/watcher.mjs`'s 150ms debounce (confirmed
by reading its `flush`/`queue` logic) collapses a create+rename(+unlink-on-failure) burst into
the ONE `tree-changed` frame the write already emits, so in practice **no extra frame** is
observed at all; even in the worst case, one extra STRUCTURAL frame per write sits inside the
router's own documented FAIL OPEN cost ("a classification miss can only cost one wasted fetch,
it can never produce a stale board").

**Real-process kill test.** `lib/test/atomic-write-real-process-kill.test.mjs` spawns
`node lib/task-lifecycle-cli.mjs capture <id> ...` with
`AGENTHEIM_ATOMIC_WRITE_TEST_HOLD_MS=8000` set (the primitive's own test-only env-var hold seam,
read internally — NOT `agentic-workflow-dpbjj`'s lifecycle-lock hold, which has not landed on
this branch; neither `lib/lifecycle-lock.mjs` nor
`lib/test/task-lifecycle-cli-mechanics.test.mjs` were touched), polls for the `.tmp` temp file
to appear beside `INDEX.md`, then `child.kill('SIGKILL')`s the process. Asserts: the killed
process's lock file is left behind (proving it died mid-critical-section, not after);
`INDEX.md` and `protocol.md` are byte-identical to their pre-spawn content; and a subsequent
in-process `capture` call for the same id succeeds (the stale, dead-pid lock is reaped, not a
permanent jam). Platform-gated to `test.skip` with a named reason on any platform other than
`win32`/`linux`/`darwin` (the platforms Node documents an unconditional-kill `child.kill()`
for) — this repo's CI/dev platform is `win32`, where the test runs and passes (verified stable
across 5 consecutive runs).

**Files:** `lib/atomic-write.mjs` (new), `lib/task-lifecycle.mjs`, `lib/task-lifecycle-capture-
dismiss.mjs`, `lib/protocol-rotation.mjs`, `lib/index-rotation.mjs`, `lib/test/atomic-
write.test.mjs` (new, 6 tests), `lib/test/atomic-write-real-process-kill.test.mjs` (new, 1
test). `node --test lib/test/*.test.mjs`: 549 passing, 0 failing (up from the 542-test batch-
start baseline), 0 skipped on this platform.

Decision recorded in ADR-0076 (reported in the ADRS block, not written to disk per this task's
rules).
