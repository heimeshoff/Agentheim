---
id: agentic-workflow-002
title: Decide dashboard write-semantics — legal Task moves, shared move logic, concurrency
status: done
type: decision
context: agentic-workflow
created: 2026-06-05
completed: 2026-06-05
commit: 526aa12
depends_on: []
blocks: [agentic-workflow-001, agentic-workflow-003]
tags: [dashboard, task-lifecycle, invariants, concurrency, write-semantics]
related_adrs: [ADR-0001]
related_research: []
prior_art: []
---

## Why

The dashboard's v1 is interactive: dragging a card moves a task `.md` between lifecycle
folders. infrastructure-001 owns the *transport* of that write; this decision owns its
*meaning*. A card move is not a file operation — it's a **Task lifecycle transition**
bound by the Task aggregate's invariants (*status always matches folder*, *one task =
one commit*, *IDs stable*). This task decides **which moves are legal from the UI**, **what
shared operation enforces them** (extracted as agentic-workflow-003), and **the concurrency
story** when the UI mutates the same files `modeling`/`work` are editing. Disk is the
single source of truth throughout.

## What

### What a card move MEANS, and which moves are legal (v1: Promote-only)

The board columns are the four lifecycle folders; a drag is a command on the **Task**
aggregate. The builder capped v1 at the **smallest write surface**: one legal UI move.

- **`backlog → todo` = Promote** → emits `Task promoted`. **The only move legal from the UI
  in v1**, and *subject to the existing promotion guards* — in particular the frontend
  gate: a UI/frontend task may not be promoted ahead of its `depends_on` (e.g. the
  styleguide). The policy consults `depends_on`, not just adjacency.
- **`todo → doing` = Claim** → emits `Task claimed`. **NOT a UI move in v1** — stays a
  skill action (`work` claims tasks). Deferred to keep the write surface minimal.
- **`doing → done` = Complete** → **NOT legal from the UI**, now or likely ever as a bare
  move. Completion is bound to *one task = one commit*: the transition to `done` rides the
  commit `work` makes (with `commit`/`completed` frontmatter filled, after the verifier
  gate). A bare file move to `done` would create a `done` task with no commit, no
  verification, no audit trail.
- **Backward moves** (`doing→todo`, `todo→backlog`) and **skips** (`backlog→doing`, etc.):
  **not legal from the UI in v1.** Backward un-claim/un-promote has real meaning but
  touches `depends_on`/`blocks` reasoning better done in a `modeling` dialogue than a drag.

So **v1 legal UI move set = `backlog→todo` only.** Every other transition is a non-drop
target in the UI and is rejected by the write path with a domain reason. The single legal
move keeps v1's write surface as small as it can be while still being interactive.

### One shared mover — extracted as agentic-workflow-003

The dashboard write path **must call the same task-move operation the skills use**, not a
second implementation. That logic lives today inside `modeling`/`work` prose; this decision
mandates extracting it into one callable primitive — `applyTaskMove(rootDir, id, from, to)`
— delivered by **agentic-workflow-003**. It must:
1. validate `from→to` against the legal-move policy above (incl. `depends_on` guards),
2. enforce *status matches folder* — a move is folder rename **and** frontmatter `status`
   rewrite, never one without the other,
3. perform the move,
4. return success with the new state, or a structured rejection with a reason.

Both the skills' worker and infrastructure-001's `POST /api/task/move` call this one
operation — the only way to keep a single source of truth for what a valid move is. A
parallel UI-only writer is rejected: it would drift from the skills' rules the moment
either side changes.

### Concurrency story (disk is source of truth)

The UI and the skills can edit `.agentheim/` files at the same time. Named failure modes:
1. **Lost update / stale board** — UI shows a task in `backlog`; meanwhile a skill already
   moved it. A naive UI move from `backlog` would act on a stale view.
2. **Double transition** — UI promotes while `modeling` also promotes; two writers, one file.
3. **Mid-edit clobber** — a skill rewrites a task body while the UI moves the file.

**v1 mitigation (simplest that holds):**
- **Optimistic precondition on every UI write.** The move carries `from` (the column the UI
  believed the card was in). `applyTaskMove` verifies the file is actually in `from` before
  moving; if not, it **rejects** (409-style) "task already moved" and the UI re-fetches
  `/api/tree`. Kills lost-update and double-transition cheaply.
- **mtime guard for body edits.** The move reads the file's mtime as part of the
  precondition; a change between read and write aborts and the UI refetches. (Single-user,
  single-machine ⇒ contention is rare; guard + refetch is enough, no lock files.)
- **No long-held locks, no DB.** Disk stays source of truth; the runtime holds no
  authoritative state beyond per-request reads. The board is a projection rebuildable from
  disk, refreshed on any rejected write.
- **Out of scope for v1:** live file-watching/push. Refresh-on-action + refresh-on-reject
  is acceptable; a watch-based live board is a later enhancement.

## Acceptance criteria

- [ ] A BC-scoped ADR records the legal-move policy, the shared-`applyTaskMove` decision,
      and the concurrency mitigation, with alternatives and reasoning.
- [ ] The legal v1 UI move set is exactly `backlog→todo` (Promote), honoring existing
      guards (incl. the `depends_on`/styleguide frontend gate). Every other transition —
      including `todo→doing`, `doing→done`, backward moves, and skips — is rejected with a
      domain reason and documented as a non-drop target in the UI.
- [ ] `doing→done` from the UI is rejected (defends *one task = one commit*).
- [ ] The decision mandates a single `applyTaskMove` operation (built in
      agentic-workflow-003) as the **only** writer of task lifecycle state, called by both
      the skills' worker and the dashboard write endpoint (no parallel UI writer).
- [ ] The ADR specifies that a move updates **both** folder **and** frontmatter `status`
      atomically (invariant *status matches folder* preserved).
- [ ] The ADR specifies optimistic concurrency: a UI move whose `from` precondition no
      longer matches disk is rejected without mutating any file (UI refetches), and an mtime
      change between precondition read and write aborts the move.

## Notes

> ### ADR draft (for the worker) — scope: agentic-workflow
>
> ```markdown
> ---
> id: <assign-at-commit>
> title: Dashboard write-semantics — Promote-only UI moves, one shared mover, optimistic concurrency
> scope: agentic-workflow
> status: proposed
> date: 2026-06-05
> related_tasks: [agentic-workflow-001, agentic-workflow-002, agentic-workflow-003, infrastructure-001]
> ---
>
> # ADR: Dashboard write-semantics — Promote-only UI moves, one shared mover, optimistic concurrency
>
> ## Context
> The dashboard v1 lets the builder drag task cards between lifecycle columns, moving task
> `.md` files between folders. infrastructure-001 carries that write as dumb transport; the
> *meaning* is ours. A card move is a Task lifecycle transition bound by the Task aggregate
> invariants (*status matches folder*, *one task = one commit*, *IDs stable*). The UI can
> edit the same files `modeling`/`work` edit, disk as single source of truth. Completion
> (`→done`) is normally produced by `work` as part of one-commit-per-task, after the
> verifier gate — a bare UI move can't reproduce that.
>
> ## Decision
> Restrict UI-initiated moves to **`backlog→todo` (Promote) only** in v1, subject to
> existing promotion guards including `depends_on`. Reject every other transition
> (`todo→doing` stays a skill action; `doing→done`, backward, and skips are non-drop and
> API-rejected) — `doing→done` specifically to protect *one task = one commit*. Route
> **all** task-lifecycle writes — skills and dashboard — through **one shared
> `applyTaskMove` operation** (built in agentic-workflow-003) that validates the
> transition, updates folder and frontmatter together, and is the single source of truth
> for a valid move. Handle concurrency **optimistically**: every UI move carries the
> believed source folder + an mtime; `applyTaskMove` rejects if disk disagrees, and the UI
> refetches. No locks, no DB, no live file-watching in v1.
>
> ## Consequences
> **Positive:** invariants enforced in exactly one place shared by UI + skills (no drift);
> the riskiest transition (completion) stays with `work` where the commit lives; optimistic
> + refetch is cheap and correct for a single-user tool; the minimal one-move surface is
> trivial to reason about. **Negative:** the board isn't live (reflects last fetch/action;
> rejected move ⇒ refetch round-trip); the one-move v1 may feel restrictive (no drag-to-claim
> or done); requires the applyTaskMove extraction (agentic-workflow-003) before the write
> path exists. **Neutral:** disk remains sole source of truth; runtime is stateless beyond
> per-request reads.
>
> ## Alternatives considered
> - **Allow `doing→done` from the UI** — breaks *one task = one commit*, bypasses the
>   verifier gate, yields `done` tasks with no commit/audit. Rejected.
> - **Also allow `todo→doing` (Claim) in v1** — viable, but the builder chose the smallest
>   write surface; Claim stays a skill action for now.
> - **Parallel UI-only write path** — forks the rules; UI + skills disagree the moment
>   either changes. Rejected.
> - **Pessimistic locking / lockfiles** — overkill for single-user single-machine; adds
>   stale-lock failure modes worse than the contention prevented.
> - **Live file-watch board** — orthogonal and deferrable; refresh-on-action suffices for v1.
> ```

### Ubiquitous language additions (candidates for the BC README)
- **Card move** — a UI drag of a task between lifecycle columns; semantically a Task
  transition command (v1: Promote only), never a raw file operation.
- **`applyTaskMove`** — the single lifecycle-transition operation shared by the skills and
  the dashboard; sole enforcer of *status matches folder* and the legal-move policy. Built
  in agentic-workflow-003.

## Outcome

Recorded the dashboard write-semantics decision as **ADR-0001**
(`.agentheim/knowledge/decisions/0001-dashboard-write-semantics.md`):

- **Legal v1 UI move set = `backlog→todo` (Promote) only**, honoring existing promotion
  guards including the `depends_on`/styleguide frontend gate. Every other transition
  (`todo→doing` Claim, `doing→done` Complete, backward moves, skips) is a non-drop target and
  is rejected with a structured domain reason.
- `doing→done` is rejected from the UI to defend *one task = one commit* (completion rides the
  `work` commit after the verifier gate).
- A single **`applyTaskMove`** operation (to be built in agentic-workflow-003) is mandated as
  the **only** writer of task lifecycle state, called by both the skills' worker and the
  dashboard's `POST /api/task/move`; no parallel UI writer. It updates folder **and**
  frontmatter `status` atomically (*status matches folder* preserved).
- **Optimistic concurrency**: each UI move carries the believed `from` folder plus an mtime;
  `applyTaskMove` rejects (409-style, no mutation) if disk disagrees and the UI refetches. No
  locks, no DB, no live file-watching in v1.

The two ubiquitous-language entries (**Card move**, **`applyTaskMove`**) were added to the
agentic-workflow BC README. No runtime code written — implementation belongs to
agentic-workflow-003.

Key files:
- `.agentheim/knowledge/decisions/0001-dashboard-write-semantics.md`
- `.agentheim/contexts/agentic-workflow/README.md`
