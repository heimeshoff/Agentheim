---
id: agentic-workflow-w2njd
title: checkpoint stages only the task file's new location — the wip commit's tree holds the task file in both lifecycle folders, contradicting the squash steps that assert the move is fully captured
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [checkpoint, worktree, task-lifecycle, staging]
related_adrs: [0032, 0038, 0055]
related_research: []
prior_art: [agentic-workflow-p8q3z, agentic-workflow-t7m4c, agentic-workflow-q7v3k]
---

## Why

2026-07-22 post-survey audit, highest-impact mechanical finding (independently observed
as a live failure in a prior session): the SUCCESS checkpoint (`skills/work/SKILL.md`
~:149) and BOUNCE checkpoint (~:190-191) prescribe `git -C .worktrees/<id> add <changed>`
where `<changed>` is the manifest partition naming only the task file's **new** location
(`lib/task-lifecycle-cli.mjs` ~:73-92). The moved-from path's deletion is never staged,
so the wip commit's tree holds the task file in **both** locations — while downstream
doctrine asserts the opposite (BOUNCE step 3: "the squash's delta is exactly that: the
task-file move and note"; PASS/SKIP step 2 ~:286: "the squash in step 1 already carried
that move onto `main`"). No doctrine file anywhere instructs adding the moved-from path
to the same `git add`.

## What

Close the gap mechanically, not with more prose: the checkpoint staging set must include
the moved-from lifecycle path. Preferred shape — the CLI's manifest (the `changed`
partition, or a dedicated field) enumerates the moved-from path alongside the new one, so
the doctrine's existing `git add <changed>` becomes correct without a new hand-rule; the
work SKILL's SUCCESS and BOUNCE checkpoint steps are then synced to whatever the
implemented contract is. Ship a `node --test` case in `lib/test/` asserting that after an
`applyTaskMove`-backed move, the checkpoint staging set names both the new path and the
moved-from path (equivalently: a tree built from the staged set does not contain the task
file at both locations).

## Acceptance criteria

- [ ] The checkpoint staging set (CLI manifest or equivalent contract) includes the
      moved-from lifecycle path for a moved task file; enforcement ships as a
      `node --test` case in `lib/test/`.
- [ ] `skills/work/SKILL.md` SUCCESS checkpoint and BOUNCE checkpoint steps match the
      implemented contract — no step still implies the new-location-only add.
- [ ] The downstream squash assertions (BOUNCE step 3, PASS/SKIP step 2) are true under
      the fixed behavior — verified by reading, corrected if wording still overclaims.

## Notes

Root of the recorded live failure "checkpoint doesn't stage doing/ deletion — branch HEAD
holds the task file in both places". Enforcement ships in-task (ADR-0059 satisfied by the
test). Mind CRLF on touched `.agentheim` bookkeeping files (known lifecycle-script
hazard, bug infrastructure-5w5gs).

## Outcome

Fixed mechanically in `lib/task-lifecycle-cli.mjs`'s `checkpoint` handler: a new
`findMovedFromDoingPath(rootDir, id, fileList)` helper detects, from the id + the caller's
existing `fileList` (no new field), whenever an entry names this task's file under `done/` or
`backlog/` (the `<id>.md` / `<id>-…` convention `resolveTaskFile` already uses elsewhere in
this codebase), and — only when the corresponding `doing/<basename>` no longer exists on disk
(confirming a genuine in-worktree vacate, never an untracked path that would abort `git add`)
— folds that vacated path into the set handed to `partitionCheckpointFiles`. So `changed` now
always names both halves of a worker's `doing → done` / `doing → backlog` move, and the
existing `git add <changed>` in `skills/work/SKILL.md` stages the deletion without any new
doctrine hand-rule.

`skills/work/SKILL.md`'s SUCCESS checkpoint paragraph and BOUNCE checkpoint step 2 are updated
to describe the new detect-and-fold behavior. The downstream squash assertions (BOUNCE step 3,
PASS/SKIP step 2) were read and found to become TRUE under the fix (they had been silently
overclaiming before it) — PASS/SKIP step 2 got a clarifying clause naming why the idempotent
no-op path is now safe; BOUNCE step 3 needed no wording change, only the guarantee it already
asserted.

Amended ADR-0057 (the `checkpoint` verb's home ADR) with an "Amendment" section recording this
fix rather than minting a new ADR — this is a manifest-shape extension of the same verb/seam,
not a new alternative-weighing decision.

Enforcement: two new `node --test` cases in `lib/test/task-lifecycle-cli.test.mjs` — one
driving an actual `applyTaskMove`-backed `doing → done` move, one simulating a BOUNCE-style
manual `doing → backlog` move — both asserting `changed` names both the new and vacated paths.
Full suite (`node --test lib/test/*.test.mjs`, 353 tests) green.

Key files: `lib/task-lifecycle-cli.mjs`, `lib/test/task-lifecycle-cli.test.mjs`,
`skills/work/SKILL.md`, `.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/knowledge/decisions/0057-derived-artifacts-unstageable-from-worktree-checkpoint-guard.md`.
