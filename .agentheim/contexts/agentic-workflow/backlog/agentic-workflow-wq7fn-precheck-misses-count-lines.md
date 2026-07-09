---
id: agentic-workflow-wq7fn
title: Fail-closed pre-check misses the task-counts lines — adjustIndexCount can still throw mid-mutation
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-09
completed:
depends_on: []
blocks: []
tags: [task-lifecycle, bookkeeping, atomicity, fail-closed]
related_adrs: [0038, 0042]
related_research: []
prior_art: [agentic-workflow-k5n8f, agentic-workflow-t7m4c, agentic-workflow-p3v9k]
---

## Why

ADR-0038's fail-closed atomicity guard (`validateBookkeepingMarkers`, `lib/task-lifecycle.mjs`)
dry-validates every INDEX section marker a verb will edit *before* `applyTaskMove` moves anything.
But it validates only the `<!-- <section>:start/end -->` markers and the protocol `---` separator —
not the `**<Label>:** N` count lines that `adjustIndexCount` parses. Those are still parsed during
the mutation phase, *after* the task file has moved: `claimBatch` runs `adjustIndexCount('Todo', -1)`
/ `('Doing', 1)` after its move loop, and `promoteTask` / `completeTask` have the same shape. An
`INDEX.md` whose section markers are present but whose `task-counts` block is missing a required
label line (or holds a non-numeric value) makes `adjustIndexCount` throw with files already moved —
exactly the half-applied lifecycle state the ADR-0038 guard exists to prevent.

Field report (WisdomHeim vault, 2026-07-09, plugin ~0.8.x): a `claim` against a pre-template
bespoke index moved one task file `todo/ → doing/` and rewrote a second task's frontmatter to
`status: doing` before aborting on `INDEX.md is missing the Todo count.` — repaired by a
hand-written revert of both. That index lacked the section markers too, so today's marker
dry-validation would have rejected it cleanly. The narrower case — markers present, count line
missing or malformed — still reproduces on current `main` by inspection.

## What

Extend the pre-move dry-validation so a count-line problem is rejected the same way a missing
marker already is: structured `{ok:false, code, reason}`, nothing moved, nothing rewritten.

Direction: teach `validateBookkeepingMarkers` (or a sibling `validateCountLines` called in the
same pre-check phase) to verify, for every affected BC's `INDEX.md`, that each `**<Label>:** N`
line the verb will adjust is present and numeric — claim: Todo + Doing; promote: Backlog + Todo;
complete: Doing + Done. `claimBatch` already iterates every BC in the batch for the marker check,
so the count check rides the same loop.

## Acceptance criteria

- [ ] Every lifecycle verb that calls `adjustIndexCount` (promote, claim, complete) dry-validates
      the exact count labels it will adjust, in every affected BC's `INDEX.md`, before the first
      file move; a missing or non-numeric count line returns a structured rejection
      (`bookkeeping-marker-mismatch` or a dedicated code) with the tree untouched.
- [ ] Per-verb test: an index with valid section markers but a missing `**Todo:** N` (resp.
      `**Backlog:**`, `**Doing:**`, `**Done:**`) line → structured rejection, task file still in
      its origin folder, `INDEX.md` and `protocol.md` byte-identical.
- [ ] Existing suite (`node --test lib/test/*.test.mjs`) stays green.

## Notes

- The documented mid-batch race in `claimBatch` (an id vanishing between pre-check and move, no
  rollback, surfaced with the split manifest) is out of scope — that's an accepted trade-off with
  its own comment; this task is only about making the *deterministic* count-parse failure
  fail-closed like everything else.
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` (transplanted
  here 2026-07-09 after verifying the residual against `main`).
