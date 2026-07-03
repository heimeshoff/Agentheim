---
id: ADR-0038
title: Lifecycle-mechanization boundary — fail-closed depends_on + three-layer bookkeeping (mover / CLI / skill)
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-p3v9k, agentic-workflow-k5n8f]
related_adrs: [0007, 0022, 0026, 0032]
---

# ADR-0038: Lifecycle-mechanization boundary — fail-closed `depends_on` + three-layer bookkeeping

## Context

agentic-workflow-k5n8f mechanizes the bookkeeping that today lives as skill prose (INDEX
marker edits + count deltas, protocol-entry formatting, ADR-backlink reconciliation) into a
deterministic script. Its own AC#1 requires that "the divergence is resolved first: one
decision, both sources agree" before any code assumes a semantics. Two open questions
blocked it:

1. **A `depends_on` missing-target divergence.** `skills/work/SKILL.md` (line ~29) reads: *"a
   task is ready if every id in `depends_on` is in `done/` (or doesn't exist — treat missing
   as satisfied, but warn the user)"* — satisfied-with-warning. `dependencySatisfied()`
   (`lib/task-lifecycle.mjs:98`) returns `false` whenever the id can't be resolved. Two
   sources of truth, opposite semantics. A mechanized gate needs exactly one.
2. **The side-effect boundary moves.** ADR-0007 froze `applyTaskMove` as owning only the
   move; INDEX/protocol side-effects stay with the skills. k5n8f moves those side-effects out
   of prompt-prose into a script — a real boundary change, not an implicit drift, and it
   deserves a recorded decision rather than being settled silently inside k5n8f's own diff.

## Decision

### Ruling A — `depends_on` is fail-closed

A `depends_on` id present in **no** lifecycle folder (`backlog/`, `todo/`, `doing/`, `done/`,
across every BC) counts as **unsatisfied**. Promote/claim is refused and the dangling id is
surfaced to the user, rather than silently treated as satisfied.

This already matches `dependencySatisfied()` as built (returns `false` on an unresolvable
`contextsDir` scan or an unmatched id — confirmed by reading `lib/task-lifecycle.mjs:98-114`
in this task) — the code needs no change. The only remaining work is rewriting the
contradicting `skills/work/SKILL.md` prose ("treat missing as satisfied, but warn") to state
the fail-closed rule instead. **That prose edit is deferred to k5n8f**, gated on this ADR
being accepted, per this task's AC#3.

Rationale: the vision's "catch wrong work by structure" ethos treats an unresolvable
reference as a structural defect to be caught, not tolerated. ADR-0022 (DISMISS cascades the
dependent subtree) already strips dead ids from surviving tasks' `depends_on` on dismissal —
so under normal operation a `depends_on` id should never dangle; a genuine miss signals a
defect (typo, premature dismissal, hand-edited frontmatter) that promotion should refuse
rather than paper over with a warning nobody reads reliably.

### Ruling B — three concentric layers, one owner each

The lifecycle-mechanization boundary is three layers, each owning exactly one concern:

1. **`applyTaskMove` (mover)** — move + frontmatter `status` rewrite + optimistic
   precondition + legal-move / `depends_on` gates. Nothing else. **ADR-0007's boundary is
   unchanged**: the dashboard's promote path calls only this layer and still performs no
   INDEX/protocol writes.
2. **`task-lifecycle` CLI (mechanized bookkeeping — built by k5n8f)** — wraps the mover; owns
   the deterministic text surgery: INDEX marker edits + count deltas, protocol-entry
   formatting + line-4 prepend, ADR↔task backlink reconciliation. It is **git-free** — it
   never shells out to `git` — and **makes no judgment call**: every judgment-laden input
   (readiness, summary prose, measured duration/iteration count, which ADRs were written) is
   passed in by its caller, not derived by the CLI itself. Its sole output is an **enumerated
   manifest**: `{ changed: [paths], message, verb, id }`.
3. **Skill / orchestrator** — owns judgment *and* git. It decides the judgment-laden values
   layer 2 needs, then performs the scoped `git add` of exactly the manifest's `changed`
   paths plus its own worker-produced files, and commits — folded into whichever commit model
   already governs that skill (`work`'s ADR-0032 squash-merge, or modeling's direct scoped
   commit per ADR-0026).

This layering **builds on**:
- **ADR-0007** — the mover boundary is restated, not altered. `applyTaskMove` still does not
  touch INDEX or protocol; that responsibility sits one layer further out, in the new CLI, not
  in the mover.
- **ADR-0026** — the committing doctrine (bookkeeping folded into the one task commit before
  it is made, scoped `git add` mandatory, `git add -A` forbidden) is preserved exactly: layer
  2 emits the scoped pathspec as data, layer 3 is the only place `git add`/`git commit` runs,
  and it never adds more than the manifest names plus its own files.
- **ADR-0032** — the CLI is deliberately git-free so its output folds cleanly into the
  worktree-per-worker squash-merge model: the CLI has no opinion about which branch or
  worktree it runs in, only the caller (governed by ADR-0032) does.

It **supersedes** the *prose restatement* of bookkeeping mechanics currently duplicated across
`skills/work/SKILL.md`, `skills/modeling/SKILL.md`, `skills/quick-capture/SKILL.md`, and
`skills/brainstorm/SKILL.md` (each independently describes how to edit INDEX markers, format a
protocol entry, and reconcile ADR backlinks). It does **not** supersede ADR-0007, ADR-0026, or
ADR-0032 themselves — those three decisions stand unchanged; only the four skills' duplicated
*how-to-edit-these-files* prose is replaced by "call the CLI, then commit its manifest."

## Consequences

**Positive:** one fail-closed semantics for `depends_on`, matching the code that already
implements it — no silent divergence between prose and implementation. Bookkeeping mechanics
(INDEX/protocol/backlink text surgery) move from four independently-drifting prose
descriptions into one tested, deterministic script; each skill's prose shrinks to "supply the
judgment inputs, call the CLI, commit its manifest." The git-free CLI composes cleanly with
both commit models in play (ADR-0026 direct-commit skills, ADR-0032 squash-merge worker
worktrees) with zero special-casing.

**Negative:** k5n8f must now build and test a CLI surface (manifest shape, judgment-input
contract) rather than only editing prose — larger, riskier unit of work than a pure prose
fix. A caller that gets the judgment inputs wrong (e.g. wrong `verb`) still produces a
syntactically valid but semantically wrong manifest — the CLI's determinism doesn't validate
caller intent, only the mechanics.

**Neutral:** `applyTaskMove`'s public contract and the shape of ADR-0007 are untouched;
existing callers (dashboard promote) need no changes. The fail-closed `depends_on` rule was
already live in `dependencySatisfied()`; this ADR changes zero runtime behavior — only the
skill prose that disagreed with it.

## Alternatives considered

- **Satisfied-with-warning for missing `depends_on` targets** (the current `work/SKILL.md`
  prose) — rejected: silently proceeding on a dangling reference is exactly the class of
  "wrong work by structure" the vision wants caught, and a warning easily missed in an
  autonomous run is not a gate.
- **Push INDEX/protocol ownership into the mover** (collapse layers 1 and 2) — rejected:
  reopens ADR-0007, and couples the dashboard's UI-move path (which calls the mover directly
  and must stay index/protocol-free per ADR-0007) to bookkeeping it doesn't want.
  Keeping the mover minimal lets the dashboard keep calling it in isolation.
- **Let the CLI decide judgment values itself** (e.g. infer summary prose or readiness) —
  rejected: makes the CLI's output non-deterministic and untestable in isolation, and
  duplicates judgment logic that already lives correctly in the calling skill/orchestrator.
- **Let the CLI perform its own git commit** — rejected: violates ADR-0026's git-add-scoping
  doctrine (the CLI can't know what else the caller's commit should include) and ADR-0032's
  squash-merge model (the CLI has no worktree/branch context); keeping it git-free is what
  lets it fold into either commit model unchanged.

## Note on ADR numbering

This task's brief reserved ADR-0037 for this decision. By the time this worker ran, ADR-0037
had already been consumed by a different, earlier-merged decision
(`0037-worktree-isolation-implementation-resolutions-spike-findings.md`, from
agentic-workflow-f6m2q). This ADR was filed as **0038**, the next actually-free number at
write time.
