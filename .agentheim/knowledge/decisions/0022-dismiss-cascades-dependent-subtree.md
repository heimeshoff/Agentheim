---
id: ADR-0022
title: DISMISS cascades the whole dependent subtree; refuses if it touches doing/ or done/
scope: agentic-workflow
status: proposed
date: 2026-06-16
related_tasks: [agentic-workflow-046, agentic-workflow-048, agentic-workflow-e4bjh]
related_adrs: [0017, 0007, 0018, 0028, 0073]
---

# ADR-0022: DISMISS cascades the whole dependent subtree; refuses if it touches `doing/` or `done/`

> **Amended by ADR-0073 (2026-09-06, agentic-workflow-e4bjh)**, at the point DISMISS was
> mechanized into `dismissTask` (`lib/task-lifecycle-capture-dismiss.mjs`). Two live, on-disk
> contradictions in this ADR's text were fixed at that mechanization boundary rather than
> carried forward into the script: **the cascade edge is `depends_on` only** — §1's
> "equivalently, follow `blocks` edges forward" is factually false against the live tree
> (`blocks`/`depends_on` are not mirrored) and is superseded; `blocks` is
> reconciliation-only, stripped but never traversed. **Membership and stripping match on
> exact frontmatter `id` equality only**, never filename/prefix resolution (the live
> `design-system-001-styleguide` vs `design-system-001` mismatch made this concrete). §4's
> listed write order (delete first, bookkeeping after) is also reversed by ADR-0073: INDEX
> edits → unlinks → backlink stripping → protocol, so a mid-operation crash stays
> "blocked and visible" rather than "ready and invisible." Everything else below — the
> cascade-vs-warn-and-strip-vs-block decision, the in-flight/shipped refusal, the one
> confirmation covering the whole set, never-reuse of dismissed ids — stands unamended.

## Context

The `modeling` DISMISS verb (agentic-workflow-046) hard-deletes an unstarted
`backlog/`/`todo/` task. A task rarely sits alone in the dependency DAG: others may list
it in their `depends_on` (equivalently, it lists them in its `blocks`). Deleting it would
leave those dependents pointing at a task that no longer exists.

The capture left the reconciliation policy open with three candidates:

- **Warn & strip** — delete only the named task, then strip its id out of every dependent's
  `depends_on`/`blocks`. Dependents survive, silently unblocked.
- **Block** — refuse to dismiss while anything still depends on it; the builder clears the
  dependents first.
- **Cascade** — dismiss the named task *and* its entire transitive dependent subtree in one
  confirmed gesture.

The pressure that decides it: a dependent exists *because* of the task it depends on. When
the builder drops a stray/duplicate/abandoned idea, the tasks that were only queued behind
it are almost always dead too (the clearest live example: aw-048's board trash-can exists
only to fire the dismiss of aw-046's verb — kill the verb and the button has nothing to
fire). **Warn-and-strip** silently mutates surviving tasks into a state the builder never
reviewed (an aw-048 with an empty `depends_on` reads as "ready" when it is actually
orphaned). **Block** turns one intent into a manual multi-step chore. The builder chose
**cascade** (2026-06-16): make the blast radius *visible and confirmed* rather than
*hidden* (warn-and-strip) or *refused* (block).

This is a real architectural decision, not an implementation detail: it sets the blast
radius of a single DISMISS, and therefore of aw-048's per-card trash-can, which fires the
same verb through the VS Code bridge (ADR-0018). It also lives entirely in the skill, never
the server — the dashboard stays read-only (ADR-0017) and the skill owns the
INDEX/protocol/backlink side-effects around the raw delete (the same boundary ADR-0007
draws for `applyTaskMove`).

## Decision

**DISMISS deletes the named task together with its entire transitive dependent subtree,
under one confirmation that names every task in the set. The whole operation refuses if any
member of that set is in `doing/` or `done/`.**

1. **Cascade set.** Start from the named task X. Add every task T whose `depends_on`
   contains a member of the set (equivalently, follow `blocks` edges forward), transitively,
   to a fixed point. The set is X plus everything (transitively) queued behind it.
   - Only `depends_on`/`blocks` edges drive the cascade. `prior_art`, `related_adrs`, and
     `related_tasks` are **not** cascade edges — references to a dismissed id through those
     fields are *stripped* during bookkeeping, never followed to delete another task.
   - The cascade walks **upstream dependents only** — it never pulls in a task that X itself
     depends on. (Dismissing aw-048 would not touch `design-system-001-styleguide`.)

2. **In-flight / shipped guard — refuse the whole operation.** If any task in the cascade set
   is in `doing/` or `done/`, DISMISS aborts before deleting anything and names the offending
   in-flight/shipped task. You do not delete a started/shipped task, and you do not silently
   orphan one by deleting its upstream. The builder resolves that edge by hand. (X itself
   being in `doing/`/`done/` is the same refusal, already required by aw-046.)

3. **One confirmation, full set.** Present the complete cascade set (ids + titles) and take a
   single confirm/cancel. Cancel changes nothing on disk.

4. **Bookkeeping, for the whole set** (the skill's responsibility, layered around the raw
   deletes — ADR-0007's boundary):
   - Hard-delete every `.md` file in the set.
   - For each dismissed id, remove its line from its BC `INDEX.md` and decrement the matching
     Backlog/Todo count at the markers (no full-file rewrite). The cascade set may span more
     than one BC, so editing several BCs' `INDEX.md` in one DISMISS is **legitimate here** —
     the one sanctioned exception to "don't touch multiple BCs' indexes in one invocation".
   - Strip every dismissed id from any *surviving* task's `depends_on`/`blocks`/`prior_art`
     and from any ADR's `related_tasks`. (References *within* the set vanish with their files.)
   - Prepend **one** bare `Modeling / Dismissed` entry to `protocol.md` that lists the whole
     cascade set — no builder-typed reason (the bare-record choice, 2026-06-16).

5. **IDs are gone, never reused.** Consistent with "never renumber": a dismissed *legacy*
   number is retired, a future legacy-style capture takes the next free number.
   **Amended by ADR-0028 (2026-06-17):** new ids are random tokens (`<bc>-<token>`), not
   sequential numbers, so there is no "next free number" for new captures. Never-reuse /
   never-renumber holds **by construction** — the token generator never consults history, so
   a dismissed token is simply one of ~23.1M points it will (overwhelmingly) never re-emit,
   and there is no counter to advance or rewind. The retired-number rule above is **retained
   verbatim for legacy all-digit ids**; new token ids satisfy it by construction.

## Consequences

**Positive**
- The blast radius is *seen and confirmed*, never hidden. The builder cannot accidentally
  leave an orphaned dependent that misreads as ready.
- One gesture clears a dead branch of the DAG cleanly — matching the real shape of "this idea
  and everything queued behind it are abandoned".
- aw-048's trash-can inherits a crisp contract: its confirmation dialog must surface the
  *full cascade set*, not just the single card's title, so a one-click dismiss can never
  delete more than the builder saw.

**Negative**
- A single confirm can delete several files. Mitigated by always listing the full set before
  the confirm and by the `doing/`/`done/` refusal capping the reach to unstarted work.
- A dependent that had *other* live reasons to exist (e.g. it also depended on a still-valid
  task) is deleted rather than re-pointed. Accepted: the builder sees it in the set and can
  cancel; re-pointing a survivor is a deliberate, separate edit, not a dismiss side-effect.

**Neutral**
- Disk stays the single source of truth; the board re-projects the disappearance via SSE
  (ADR-0017). DISMISS adds no write path to the server.

## Alternatives considered

- **Warn & strip (the capture's proposed default).** Rejected: it silently rewrites surviving
  tasks into an unreviewed state — a stripped `depends_on` makes an orphan look ready. The
  mutation the builder most needs to see is the one it hides.
- **Block until dependents are cleared.** Rejected: turns a single intent into a manual,
  leaf-first chore, and offers no help doing it. Cascade is block's safety (nothing left
  dangling) without block's friction.
- **Cascade without the `doing/`/`done/` refusal** (strip the dangling ref on a shipped
  dependent instead). Rejected for v1: deleting the upstream of in-flight or shipped work is
  exactly the surprising, hard-to-undo case the verb should refuse, not paper over.
