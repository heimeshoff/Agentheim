---
id: agentic-workflow-p3v9k
title: Decide the lifecycle-mechanization boundary — fail-closed depends_on ruling + 3-layer bookkeeping ADR
status: todo
type: decision
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: [agentic-workflow-k5n8f]
tags: [harness-audit, bookkeeping, task-lifecycle, decision, dependency-gate]
related_adrs: ["0007", "0026", "0032"]
related_research: []
prior_art: [agentic-workflow-002, agentic-workflow-003, agentic-workflow-063]
---

## Why

[[agentic-workflow-k5n8f]] (mechanize the bookkeeping) cannot start until two
questions are settled as a ratified decision — its AC#1 requires "the divergence is
resolved first: one decision, both sources agree." Deciding these in an ADR *before*
any code assumes a semantics is the "decisions as tasks" discipline.

1. **The `depends_on` missing-target divergence.** `work/SKILL.md:25` treats a
   `depends_on` id that resolves to no `done/` file as *satisfied-with-warning*;
   `dependencySatisfied()` (`lib/task-lifecycle.mjs:98`) returns *false*. Two sources
   of truth, opposite semantics. The mechanized gate needs exactly one ruling.
2. **The side-effect boundary moves.** ADR-0007 froze "`applyTaskMove` owns only the
   move; INDEX/protocol side-effects stay with the skills." k5n8f moves those
   side-effects out of prompt-prose into a deterministic script. That reshapes the
   boundary and deserves a recorded decision, not an implicit drift.

## What

Write one ADR (next free number, `scope: agentic-workflow`) ruling on both, which
becomes k5n8f's contract.

**Ruling A — fail-closed `depends_on`** *(confirmed 2026-07-03 — see Notes)*: a
`depends_on` id present in *no* lifecycle folder counts as
**unsatisfied** — promote/claim is refused and the dangling id surfaced. This already
matches `dependencySatisfied()`, so the script inherits it for free; the only change
is rewriting the contradicting `work/SKILL.md:25` prose. Rationale: the vision's
"catch wrong work by structure" ethos, and DISMISS (ADR-0022) already strips dead ids
from surviving `depends_on`, so a genuine missing target signals a defect, not a
normal state.

**Ruling B — three concentric layers, one owner each** (architect brief, this refine):

1. **`applyTaskMove` (mover)** — move + status rewrite + preconditions + legal-move /
   `depends_on` gates, nothing else. *ADR-0007 unchanged; the dashboard calls only this.*
2. **`task-lifecycle` CLI (mechanized bookkeeping)** — wraps the mover; owns the
   deterministic text surgery (INDEX marker edits + count deltas, protocol-entry
   formatting + line-4 prepend, ADR↔task backlink reconciliation). **Git-free**;
   **emits an enumerated manifest** `{ changed: [paths], message, verb, id }`. Makes no
   judgment call — all judgment-laden values (readiness, summary prose, measured
   duration/iteration, which ADRs were written) are passed in by the caller.
3. **Skill / orchestrator** — owns judgment *and* git: the scoped `git add` of the
   manifest's paths + commit, folded into its own model (modeling's direct scoped
   commit, or `work`'s ADR-0032 squash-merge).

The ADR **builds on** ADR-0007 (mover boundary intact), ADR-0026 (git doctrine intact
— the script emits the scoped pathspec, the caller commits, `git add -A` never
appears), and ADR-0032 (git-free so it folds into the squash-merge). It **supersedes
the prose restatement** of bookkeeping across the four skills — *not* ADR-0007.

## Acceptance criteria

- [ ] One ADR filed under `knowledge/decisions/`, scope agentic-workflow, ratifying Ruling A (fail-closed) and Ruling B (three-layer boundary + git-free manifest).
- [ ] The ADR states the new boundary explicitly, names what it builds on (0007 / 0026 / 0032), and names the skill prose it supersedes.
- [ ] Ruling A is stated as the single semantics both `work/SKILL.md:25` and `dependencySatisfied()` will agree on (the `work` prose edit is deferred to k5n8f, gated on this ADR being accepted).
- [ ] Bidirectional links: the ADR's `related_tasks` names this task, and this task's `related_adrs` gets the new ADR id.

## Notes

**Confirmed 2026-07-03.** Ruling A (fail-closed) is the builder's call — confirmed
under the builder's autonomous-refinement authorization ("refine the whole backlog with
best-default answers"). The rationale held: the vision's "catch wrong work by structure"
ethos, DISMISS (ADR-0022) already strips dead ids from surviving `depends_on`, and
`dependencySatisfied()` already implements fail-closed — so a genuine missing target
signals a defect, not a normal state. Ruling B follows mechanically from the architect
brief and the existing ADR-0007/0026/0032 doctrine. No open product call remains; ready
to work.

Reference (cross-BC, not `prior_art`): **infrastructure-010** — the env-free
plugin-file resolver pattern k5n8f reuses; not a dependency of this decision.

Source: harness audit 2026-07-02; extracted from k5n8f during the 2026-07-03 refine.
