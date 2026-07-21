---
id: agentic-workflow-p8q3z
title: BOUNCE integration's squash-merge needs a worktree checkpoint commit first — none is ever made
status: done
type: bug
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [work-skill, git, worktree, bounce, checkpoint, bug]
related_adrs: [0037, 0032, 0057, 0063, 0026]
related_research: []
prior_art: [agentic-workflow-hvqa4]
---

## Why

Discovered while implementing agentic-workflow-hvqa4 (worktree-abandonment diff salvage).
`skills/work/SKILL.md`'s "BOUNCE integration" (lines ~176–186) integrates a bounced worker on
the **main** tree by: salvage the worktree diff → `git merge --squash aw/<task-id>` → apply the
`INDEX.md` `doing → backlog` edit + prepend the "Task bounced" protocol entry → commit → tear
down the worktree.

Nothing before the squash-merge ever commits the worker's `doing → backlog` move (or the
appended `## Worker note`) onto the `aw/<task-id>` branch. A worker never runs git (by design)
— it moves the file and edits it, uncommitted, inside the worktree's working directory. The
conductor's `checkpoint` verb (`lib/task-lifecycle-cli.mjs`, "Verifier dispatch" step, SKILL.md
line ~140) that stages-and-commits worktree content runs **only** on the `RESULT: SUCCESS`
path; the `RESULT: FAIL` path makes its own `wip` commits (line ~162). The `RESULT: BOUNCED`
handling makes **no** commit at all before its squash-merge.

**Confirmed real by the doctrine's own text, not just analysis.** `git merge --squash <branch>`
merges the branch's *committed* HEAD; it cannot see another worktree's uncommitted working
directory. On BOUNCE the branch HEAD is still identical to the batch-start commit, so the
squash stages nothing — the `doing → backlog` move never reaches `main` — yet the conductor
then writes an `INDEX.md doing → backlog` edit and a "Task bounced" protocol entry describing a
move that didn't happen. `main` is left inconsistent: the task file still sits in `doing/` while
`INDEX.md`/`protocol.md` both claim `backlog/`. The salvage note added by hvqa4 corroborates the
gap explicitly (SKILL.md line ~197): its `git diff <fork-point>` is correct *"whether or not a
`wip` checkpoint happened first for this particular abandonment"* — i.e. on BOUNCE none is
guaranteed. Salvage survives the gap (it reads the working directory directly); the squash-merge
does not.

## What

Add a `checkpoint` step on the `aw/<task-id>` branch inside "BOUNCE integration", **before** its
`git merge --squash aw/<task-id>` step, mirroring the SUCCESS path's pre-verification checkpoint.
Two design constraints fix the shape of the change (see Notes for the full reasoning):

1. **Route through the `checkpoint` verb, not a hand-rolled `git add -A`.** A bounce that ran the
   test suite has rebuilt `dashboard/dist/` in the worktree; `git add -A` would restage that
   derived artifact and defeat ADR-0057's guard. The `checkpoint` verb filters it out.
2. **Checkpoint only the task file (the move + `## Worker note`), not the whole worktree.** A
   bounce sends the task back to `backlog/` precisely because it couldn't be done; a bouncing
   worker's incidental, unverified code edits must **not** land on `main` (BOUNCE is
   verifier-free). Those incidentals are already preserved for the builder by the salvage patch
   (ADR-0063). The conductor already knows the task-file path from `<task-id>`, so it can
   checkpoint that one file directly — **no change to the BOUNCED worker return format is needed**
   (it carries no `FILE_LIST`, and none should be added for this).

This also means correcting SKILL.md's current step-2 parenthetical *"(plus any other worktree
edits the squash picks up)"* — that phrasing is wrong for a bounce and should be replaced with
the task-file-only intent above.

## Acceptance criteria

- [ ] `skills/work/SKILL.md`'s "BOUNCE integration" adds a `checkpoint`-verb step that commits
      **only** the task file's `doing → backlog` move + `## Worker note` onto `aw/<task-id>`
      **before** the `git merge --squash` step (not a hand-rolled `git add -A`).
- [ ] The step-2 parenthetical "plus any other worktree edits the squash picks up" is corrected:
      the doctrine states a bounce carries only the task-file move+note to `main`, with any
      incidental worker edits preserved by the salvage patch (ADR-0063), never merged.
- [ ] A real `RESULT: BOUNCED` dry run leaves the task file actually present in `main`'s
      `backlog/` after integration, consistent with the `INDEX.md` `doing → backlog` edit and the
      "Task bounced" protocol entry the conductor writes (today the squash stages nothing).
- [ ] The BOUNCED worker return format in `references/worker-return-format.md` is unchanged
      (this fix deliberately does not add a `FILE_LIST` to it — the conductor checkpoints the
      known task-file path directly).

## Notes

Surfaced as a discovered-in-passing item per worker scope discipline (file, don't fix inline);
refined 2026-07-21.

**Salvage-before-checkpoint ordering is fine.** BOUNCE integration step 1 (salvage) reads the
worktree's working directory via `git diff <fork-point>` and is correct before or after a
checkpoint (SKILL.md line ~197). Keep salvage first; insert the checkpoint between it and the
squash-merge. Final order: salvage → checkpoint (task file only) → `git merge --squash` →
`INDEX.md`/protocol bookkeeping → commit → teardown.

**Why not merge the incidental edits.** Merging a bouncing worker's half-finished code onto
`main` with no verifier gate would pollute `main` with unwanted, unverified partial work — the
opposite of what a bounce means. The salvage patch (`.agentheim/salvage/<task-id>-bounced.patch`,
ADR-0063) is the rescue channel for those edits; `main` gets only the lifecycle move.

**Implementation-time git-model questions** (e.g. the exact `checkpoint` invocation for a
task-file-only stage, whether `checkpoint`'s `fileList` accepts a single path) can go to the
`architect` specialist via the worker's direct-consult path (ADR-0035); the design decision
itself is settled above.

See `skills/work/SKILL.md` "BOUNCE integration" (~L176) + "Verifier dispatch" checkpoint (~L140);
ADR-0037 (resolved BOUNCE's squash-merge/teardown shape but not a checkpoint step), ADR-0057
(derived-artifact checkpoint guard / the `checkpoint` verb), ADR-0063 (worktree-abandonment
salvage), ADR-0032 (worktree isolation), ADR-0026 (bookkeeping-in-the-integrating-commit).

## Outcome

Added a new step 2 to `skills/work/SKILL.md`'s "BOUNCE integration" (between salvage and the
squash-merge): a `checkpoint`-verb call scoped to `opts.fileList = ["<abs-path-to-task-file>"]`
that stages and commits only the task file's `doing → backlog` move + `## Worker note` onto
`aw/<task-id>`, mirroring the SUCCESS-path checkpoint invocation shape (same verb, same
`git -C .worktrees/<task-id> add <changed>` / `commit -m "<message>"` pattern) but deliberately
narrower — a single-element `fileList`, no worker-reported `FILE_LIST` involved. The subsequent
`git merge --squash aw/<task-id>` step's text was corrected: it now explains the squash's delta is
exactly the task-file move+note *because* step 2 put it on the branch HEAD, and that any other
worktree edits are NOT picked up (they were never checkpointed) — replacing the old, incorrect
"(plus any other worktree edits the squash picks up)" parenthetical with an explicit statement
that incidental edits stay solely in the salvage patch (ADR-0063), never reaching `main`.
Confirmed `checkpoint`'s `fileList` accepts a single-element array by reading
`lib/task-lifecycle-cli.mjs`'s `checkpointFiles` handler and `lib/derived-artifact-guard.mjs`'s
`partitionCheckpointFiles` (both iterate an arbitrary array, no arity assumption) — no specialist
consult needed, the design was already settled in the task. `references/worker-return-format.md`
was read and confirmed unchanged (its `RESULT: BOUNCED` block still carries no `FILE_LIST`).
Full `node --test lib/test/*.test.mjs` run: 330/330 passing (prose-only change, no new tests).

Key file: `skills/work/SKILL.md` (lines ~176-187, "BOUNCE integration" section).
