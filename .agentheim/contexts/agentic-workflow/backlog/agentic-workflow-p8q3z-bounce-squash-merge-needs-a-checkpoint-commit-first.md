---
id: agentic-workflow-p8q3z
title: BOUNCE integration's squash-merge needs a worktree checkpoint commit first — none is ever made
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [work-skill, git, worktree, bounce, bug]
related_adrs: [0032, 0037]
related_research: []
prior_art: [agentic-workflow-hvqa4]
---

## Why

Discovered while implementing agentic-workflow-hvqa4 (worktree-abandonment diff salvage).
`skills/work/SKILL.md`'s "BOUNCE integration" section reads:

> 1. `git merge --squash aw/<task-id>` — the delta is just the `doing → backlog` move + the
>    `## Worker note`.

But nothing before this step ever commits the worker's `doing → backlog` move (or the
appended `## Worker note`) onto the `aw/<task-id>` branch. A worker never runs git (by design)
— it just moves the file and edits it, uncommitted, inside the worktree's working directory.
The `checkpoint` verb (`lib/task-lifecycle-cli.mjs`, described under "Verifier dispatch") that
would stage and commit that content only runs on the `RESULT: SUCCESS` path, immediately
before verification — there is no equivalent call anywhere in the `RESULT: BOUNCED` handling.

`git merge --squash <branch>` merges **commits**, not another worktree's uncommitted working
directory — it cannot see content that was never committed to the branch it's told to merge.
As written, a BOUNCE's `git merge --squash aw/<task-id>` would find `aw/<task-id>` identical to
the batch-start commit (nothing was ever committed to it) and stage nothing, meaning the
`doing → backlog` move never actually reaches `main` even though the conductor goes on to write
an `INDEX.md doing → backlog` edit and a "Task bounced" protocol entry describing a move that
didn't happen. That would leave `main` in a genuinely inconsistent state: the task file still
sits in `doing/` while `INDEX.md`/`protocol.md` both claim it's in `backlog/`.

Not investigated further here (out of scope for hvqa4, which only needed to add a salvage
step that works correctly regardless of this gap — its `git diff <fork-point>` capture reads
the worktree's actual working-directory state directly, so it is unaffected either way).

## What

Add an explicit `checkpoint` call (or equivalent staged commit) on the `aw/<task-id>` branch,
inside "BOUNCE integration", **before** its `git merge --squash aw/<task-id>` step — mirroring
how the SUCCESS/verification path always checkpoints before its own diff capture and eventual
squash-merge. Confirm (with a real BOUNCE dry run, not just prose reasoning) whether the
described gap actually reproduces, since this write-up is analysis from reading the doctrine,
not an observed failure in the wild.

## Acceptance criteria

- [ ] Confirm whether a real `RESULT: BOUNCED` run currently fails to move the task file to
      `main`'s `backlog/` (reproduce or rule out the gap described above).
- [ ] If confirmed, `skills/work/SKILL.md`'s BOUNCE integration checkpoints the worktree's
      `doing → backlog` move + `## Worker note` onto the branch before the squash-merge.
- [ ] `main` ends up with the task file actually present in `backlog/` after a BOUNCE,
      consistent with the `INDEX.md`/`protocol.md` entries the conductor also writes.

## Notes

Surfaced as a discovered-in-passing item per worker scope discipline (do not fix out-of-scope
bugs inline; file them). See `skills/work/SKILL.md` "BOUNCE integration" and ADR-0037 (which
resolved BOUNCE's squash-merge + teardown shape but did not address a checkpoint step).
