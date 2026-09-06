---
id: agentic-workflow-vhz69
title: Atomic temp-file-plus-rename for every INDEX.md / protocol.md / archive write — a crash mid-write must never truncate a bookkeeping file
status: todo
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-pt0gy]
blocks: []
tags: [concurrency, bookkeeping, lifecycle-cli, crash-safety]
related_adrs: [0039, 0047, 0054, 0055, 0073]
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
