---
id: agentic-workflow-046
title: Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: 60d31ac
depends_on: []
blocks: [agentic-workflow-048]
tags: [modeling, lifecycle, dismiss, bookkeeping]
related_adrs: [0022, 0017, 0007]
related_research: []
prior_art: [agentic-workflow-003]
---

## Why
The dashboard wants a way to dismiss (remove) a ticket that will never be worked —
a stray capture, a duplicate, a since-abandoned idea — while it still sits in
`backlog/` or `todo/`. The dashboard is read-only by deliberate design (ADR-0017):
the server exposes only reads + SSE + static assets, and task-lifecycle changes are
owned entirely by the skills. So the *removal* itself must live in a skill, not the
server.

Dismissing is not a clean `rm`. A raw file delete would leave the system **quietly
wrong** — dangling `depends_on`/`blocks` references, a stale INDEX count, no record
that the task ever existed or was dropped. Reconciling that needs an agent that can
*reason* (e.g. notice another task depends on this one and warn before deleting).
That bookkeeping is exactly the kind of judgment Agentheim exists to apply, and the
side-effect boundary it follows is already established (ADR-0007: lifecycle move owns
only the move; INDEX/protocol/backlink side-effects stay with the skills).

## What
Add a fourth action to the `modeling` skill — **DISMISS** — alongside CAPTURE / REFINE
/ PROMOTE. Invoked as `/agentheim:modeling dismiss <id>` (id resolved the same way
REFINE/PROMOTE resolve a task reference: exact id, numeric, or keyword).

The disposition is a **hard delete** of the task file (builder's decision —
2026-06-16). These are unstarted backlog/todo tasks; little history is lost, and the
protocol entry preserves the record of the decision to drop it.

DISMISS, when run:
1. Resolves the task and confirms it is in `backlog/` or `todo/` — **refuses** if the
   task is in `doing/` or `done/` (you don't dismiss work in flight or shipped).
2. **Computes the cascade set** (ADR-0022): the named task plus every task that
   transitively `depends_on` it (follow `blocks` forward / `depends_on` backward to a
   fixed point). Only `depends_on`/`blocks` edges cascade — `prior_art`/`related_*`
   references are stripped during bookkeeping, never followed. The walk pulls in
   *upstream dependents only*, never a task the dismissed one itself depends on.
3. **Refuses the whole operation** if any member of the cascade set is in `doing/` or
   `done/`, naming the offending in-flight/shipped task. Cascade only ever deletes
   unstarted (`backlog`/`todo`) tasks.
4. **Surfaces the full cascade set** (ids + titles) and takes **one** confirm/cancel.
   Cancel changes nothing on disk.
5. On confirm, **hard-deletes every `.md` file in the set** from disk.
6. Reconciles bookkeeping for the whole set:
   - Remove each dismissed id's line from its BC `INDEX.md` and decrement the matching
     Backlog/Todo count at the markers (no full-file rewrite). The set may span BCs, so
     editing several `INDEX.md` files in one DISMISS is legitimate here (ADR-0022 — the
     sanctioned exception to "don't touch multiple BCs' indexes in one invocation").
   - Drop every dismissed id from any **surviving** task's `depends_on` / `blocks` /
     `prior_art`, and from any ADR's `related_tasks`. (References *within* the set vanish
     with their files.)
   - Prepend **one** bare `Modeling / Dismissed` entry to `knowledge/protocol.md` that
     lists the whole cascade set — no builder-typed reason (bare-record decision,
     2026-06-16).

## Acceptance criteria
- [ ] `/agentheim:modeling dismiss <id>` resolves a task by exact id / number / keyword
      (same resolution rules as REFINE/PROMOTE), listing matches when ambiguous.
- [ ] DISMISS refuses (with a clear message) for tasks in `doing/` or `done/`; only
      `backlog/` and `todo/` are dismissable.
- [ ] It computes the **cascade set** — the named task plus every task that transitively
      `depends_on` it — following only `depends_on`/`blocks` edges, upstream dependents
      only (never a task the named one depends on).
- [ ] If any member of the cascade set is in `doing/` or `done/`, the whole operation
      **refuses** and names the offending in-flight/shipped task; nothing is deleted.
- [ ] Before deleting, it presents the **full cascade set** (ids + titles) and takes one
      confirm; cancel changes nothing on disk.
- [ ] On confirm, **every** `.md` file in the cascade set is hard-deleted from disk.
- [ ] Each dismissed id's `INDEX.md` line is removed and the matching Backlog/Todo count
      decremented at the markers (no full-file rewrite), **across every BC** the set spans.
- [ ] Every dismissed id is removed from every **surviving** task's `depends_on` /
      `blocks` / `prior_art` and from any ADR `related_tasks` (no dangling references left).
- [ ] A single bare `Modeling / Dismissed` entry listing the whole cascade set is
      prepended to `protocol.md` (no builder-typed reason).
- [ ] The skill's own documentation (the three-actions table, disambiguation, flows)
      is updated to describe DISMISS.

## Notes
- **Mechanism decided (2026-06-16):** dismiss goes through a skill, *not* a new server
  write endpoint — this keeps ADR-0017 (read-only dashboard) intact. The dashboard's
  job is only to *seed and fire* the command (see agentic-workflow-048).
- **Disposition decided (2026-06-16):** hard delete, not an archive folder or a
  `status: dismissed` flag.
- **Open questions — RESOLVED at refine (2026-06-16):**
  - *Dependency-reconciliation policy → **cascade** (ADR-0022).* Dismissing a task
    dismisses its whole transitive dependent subtree under one confirmation that names
    every task in the set; the operation refuses entirely if the set touches `doing/` or
    `done/`. Chosen over warn-and-strip (silently leaves orphaned dependents that misread
    as ready) and block (turns one intent into a manual chore). See ADR-0022 for the full
    reasoning and bookkeeping rules.
  - *Protocol reason → **bare record** (no builder-typed reason).* One `Modeling /
    Dismissed` entry per dismiss, listing the cascade set; id + title + timestamp is
    enough.
  - *Verb vs. thin skill → **`modeling` verb**.* Settled at capture and kept: mirrors
    REFINE/PROMOTE routing and keeps the dashboard's seeded command consistent
    (`/agentheim:modeling …`).
- **ID stability:** the id is *gone*, not renumbered — consistent with "never
  renumber". A future capture takes the next free number, never a dismissed one.

## Outcome

DISMISS is now the `modeling` skill's documented fourth action, with its full contract frozen
by ADR-0022 written into the skill prose. The skill is natural-language instructions (no
code/test suite), so this is documentation of skill behavior — TDD does not apply.

Changes:
- `skills/modeling/SKILL.md`:
  - Title + intro now name four actions; "## The three actions" → "## The four actions" with a
    DISMISS row in the table.
  - "Disambiguating intent" gains a DISMISS trigger line (dismiss/delete/drop/remove/dead/won't-do
    + the literal `/agentheim:modeling dismiss <id>`) plus a guardrail against inferring DISMISS
    from soft phrasing (it hard-deletes).
  - "Identifying which task the user means" heading + body extended to REFINE / PROMOTE / **DISMISS**
    (same resolution rules; DISMISS also scans `doing/`/`done/` to refuse early).
  - New "## DISMISS flow" section: resolve + `doing`/`done` refusal, the cascade-set fixed-point
    algorithm (upstream `depends_on`/`blocks` dependents only; `prior_art`/`related_*` stripped not
    traversed), the in-flight/shipped whole-operation refusal, one confirm over the full set (with a
    table sketch), hard-delete, and the bookkeeping layer (INDEX line + count across BCs, surviving
    backlink strip, one bare protocol entry), plus retired-id note. Mirrors the ADR-0007 side-effect
    boundary (delete is the mechanical core; reconciliation is the skill's).
  - Mode note: DISMISS, like PROMOTE, runs mode-agnostic.
  - "Updating indexes" gains a DISMISS bullet and the sanctioned multi-BC-index exception.
  - "Protocol logging" gains a bare `Modeling / Dismissed` entry template.
- `.agentheim/contexts/agentic-workflow/README.md`:
  - Key commands: **Dismiss** added to the intent list with a full paragraph (cascade, refusal,
    skill-owned removal keeping the dashboard read-only, bookkeeping, retired IDs, aw-048 trash-can).
  - Key events: **Task dismissed** added.
  - Task aggregate invariant: dismissed IDs are retired, not reused.

ADR-0022 already listed `agentic-workflow-046` in `related_tasks` — no backlink edit needed. No
modeling `references/` doc enumerates the actions (the directory doesn't exist yet), so `SKILL.md`
was the only action-enumerating artifact to extend.

Key files: `skills/modeling/SKILL.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
