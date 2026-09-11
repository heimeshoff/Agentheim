---
id: agentic-workflow-k9t3w
title: Ratify ADR-0032 — per-worker git worktree isolation model
status: done
type: decision
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: [agentic-workflow-f6m2q]
tags: [harness-audit, work-skill, concurrency, git, worktree, decision]
related_adrs: ["0032", "0026", "0007", "0017", "0028"]
related_research: []
prior_art: []
---

## Why

The worktree-isolation design (split from agentic-workflow-p4v9t) rests on a
decision that **amends load-bearing doctrine** — ADR-0026's "the `todo → doing`
move folds into the task's final commit" becomes "it rides in a per-batch
claim commit." A doctrine amendment of the orchestrator's git model deserves an
explicit ratification gate before any implementation builds on it, rather than
being silently accepted inside a modeling refinement. That gate is this task.

The archaeology that reframed the whole effort is recorded in the ADR's Context:
**0 of 5** historical verification failures were cross-task contamination, and
only **~14% of batches (16/98)** ever ran in parallel. So this is ratifying a
**forward-looking structural/scaling bet, not a bug fix** — the reviewer should
confirm the doctrine amendment is worth its cost *on those honest terms*.

## What

Review the drafted `knowledge/decisions/0032-worker-worktree-isolation-git-model.md`
(currently `status: proposed`) and either ratify it (`proposed → accepted`) or
send it back with recorded objections. The ADR is fully written; this task does
**not** write code — its output is the ratified (or amended) decision record.

The one clause to scrutinise hardest: the **batch-start claim commit** as the
single deliberate amendment to ADR-0026. Confirm that every *other* ADR-0026
invariant (one commit per task, bookkeeping-in-the-task-commit, scoped enumerated
`git add`, `main` written only by the orchestrator, sequentially) survives intact
in the design.

## Acceptance criteria

- [ ] ADR-0032 is reviewed end-to-end; the ADR-0026 amendment (batch-start claim commit) is judged acceptable or the ADR is amended to address the objection.
- [ ] The ADR-0007 mover boundary and the worker-never-runs-git invariant are confirmed intact in the design (worker rules unchanged; the orchestrator, not the worker, makes the ephemeral in-worktree wip-commit).
- [ ] ADR-0032 `status:` is set to `accepted` (or, if rejected/amended, the record states why and what changed).
- [ ] ADR-0032 `related_tasks` frontmatter names the real child ids (this task + agentic-workflow-f6m2q), not the retired `-decision`/`-impl` placeholders.
- [ ] The BC INDEX adr-local entry for ADR-0032 reflects the ratified status.

## Notes

This is a `type: decision` task: when `work` picks it up, it auto-SKIPs the
verification gate iff `FILES_CHANGED == 1` and the single file is the ADR
(work/SKILL.md "When to skip verification"). If ratification also edits the BC
INDEX status line, that is orchestrator bookkeeping folded into the same commit,
not a second code file.

Blocks the implementation task **agentic-workflow-f6m2q** — impl must not start
until the decision is ratified, so the impl worker reads an `accepted` ADR-0032
as pre-loaded `related_adrs` context.

## Outcome

ADR-0032 ratified: `status: proposed → accepted`. Reviewed against ADR-0026 and
ADR-0007 in full; confirmed the ADR's own claim that the batch-start claim commit
is the *only* ADR-0026 amendment, and that one-commit-per-task, bookkeeping-folded-
in, the dropped `commit:` field, and scoped enumerated `git add` all survive intact.
Confirmed ADR-0007's mover boundary and the worker-never-runs-git invariant are
unchanged. Added a `## Ratification note` to the ADR recording the review and one
non-blocking observation (the ADR-0026 trivial-squash carve-out is unaddressed by
the new per-task squash-merge flow, but not precluded by it). `related_tasks`
frontmatter already named the real child ids — no change needed.
