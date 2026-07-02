---
id: agentic-workflow-t7m4c
title: Mechanize CLAIM + COMPLETE lifecycle scripts against the ADR-0032 worktree / squash-merge model
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: [agentic-workflow-k5n8f, agentic-workflow-f6m2q]
blocks: []
tags: [harness-audit, bookkeeping, task-lifecycle, scripts, work, worktree]
related_adrs: ["0007", "0026", "0032"]
related_research: []
prior_art: [agentic-workflow-003, agentic-workflow-063]
---

## Why

[[agentic-workflow-k5n8f]] mechanized the **PROMOTE** path (single-tree, modeling-owned)
as the pattern MVP and deliberately descoped the **work-path** operations — CLAIM
(`todo → doing`) and COMPLETE (`doing → done`) — because they are entangled with the
ADR-0032 per-worker worktree / squash-merge git model, and because
[[agentic-workflow-f6m2q]] (implement worktree isolation) was still in flight when
k5n8f was refined. Mechanizing them against a *moving* choreography would have
collided with a live sibling. This task lands them against the **final** worktree model,
once f6m2q is done.

## What

Reuse the k5n8f spine (`lib/resolve-plugin-file.mjs`, the `task-lifecycle-cli.mjs`
skeleton, the git-free manifest contract, p3v9k Ruling B) and add the two work-path
verbs, matched to ADR-0032:

- **CLAIM is a *batch* operation, not per-task.** Under ADR-0032 the conductor claims N
  ready tasks at batch start with **one** claim commit (the `todo → doing` move rides in
  the batch-start commit). The handler must support claiming a *set* of ids and emit one
  manifest for the batch — its exact shape is defined by f6m2q's final model.
- **COMPLETE spans two trees.** The `doing → done` move happens in the worker's
  **worktree**; the INDEX / protocol / backlink bookkeeping happens on **main** after the
  `git merge --squash`. So by the time the conductor runs `complete` on main, the file is
  already in `done/`. Make the move **idempotent** at the CLI layer: if `applyTaskMove`
  returns `stale-precondition` **and** `resolveTaskFile` finds the task already in the
  target folder, treat it as a no-op move and proceed to bookkeeping (no change to
  `applyTaskMove` itself). One `complete` verb then serves both the worktree path
  (already merged) and any shared-tree fallback.
- **Fold the manifest into `work`'s squash-merge.** The handler stays **git-free** (emits
  `{ changed, message, verb, id }`); `work`'s conductor adds the manifest's enumerated
  paths to the single squash commit — `git add -A` never appears, a concurrent `modeling`
  session's markdown is never swept in (ADR-0026 §5 + ADR-0032 both preserved).
- **`work/SKILL.md`** — delegate the CLAIM (batch-start) and COMPLETE (post-merge)
  bookkeeping to the scripts; delete the replaced text-surgery prose, keep the contract
  as a pointer. This is where the audit's largest context-budget reclaim lands.

## Acceptance criteria

- [ ] CLAIM handler claims a batch of ids and emits one manifest matching f6m2q's final batch-start commit shape; the `todo → doing` moves are represented without a second git actor.
- [ ] COMPLETE handler is idempotent w.r.t. an already-in-`done/` file (worktree already moved it): `stale-precondition` + already-in-target → proceed to bookkeeping, not an error. Covered by a `node --test` case for "file already in done/ on main".
- [ ] Both handlers stay git-free and emit enumerated manifests; `work`'s conductor commits them (squash-merge for complete, batch commit for claim) with a scoped add — never `git add -A`.
- [ ] `work/SKILL.md` delegates CLAIM + COMPLETE bookkeeping to the scripts; removed prompt-prose is gone, not duplicated.
- [ ] The ADR-0032 trivial-squash carve-out is addressed: decide whether the manifest supports multi-`[task-id]` squash messages, and document the choice.
- [ ] Covered by `node --test` alongside the k5n8f lifecycle-script tests.

## Notes

- Split from the original broad k5n8f capture on 2026-07-03 (architect brief, this refine).
  `depends_on` **f6m2q** because CLAIM's batch shape and COMPLETE's two-tree split are
  *defined by* the final worktree model; do not mechanize them against the pre-0032
  shared-tree flow.
- `depends_on` **k5n8f** for the reusable spine (resolver, CLI skeleton, manifest contract,
  the p3v9k boundary decision it implements).
- Reciprocal `blocks` edge on f6m2q was intentionally **not** written during this refine —
  f6m2q was in `doing/` under a live `work` session and editing its file would risk
  contaminating that session's commit; the `depends_on` edge here is the load-bearing one.
