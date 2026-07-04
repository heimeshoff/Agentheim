---
id: agentic-workflow-q7x2k
title: Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [verifier, adr, check-6, harness-audit, gate-gap]
related_adrs: ["0031"]
related_research: []
prior_art: [agentic-workflow-n7q4d, agentic-workflow-bx7k5]
---

## Why

`agentic-workflow-n7q4d`'s `missing-adr-borderline` fixture exposed a real,
reproducible gap in `agents/verifier.md`'s check 6 (ADRs for decisions): when a
task's own `## Why`/`## What` narrates the tradeoff behind an embedded decision
in prose, the verifier waives the ADR requirement, reasoning that "the decision
is explained in the task file, so nothing independent to flag." This
contradicts check 6's own text (which asks only whether "the diff embeds a
decision a future maintainer would ask 'why?' about" with "no ADR" covering
it — it draws no exception for task-file narration) and contradicts this exact
corpus's own precedent (`missing-adr`, which narrates its decision identically
in its own `## What` and is correctly FAILed 3/3).

**This is not a tier problem.** `agentic-workflow-bx7k5`'s sonnet-pinned A/B
against this exact fixture (`missing-adr-borderline`) found the **opposite**
result at the weaker tier: sonnet FAILed it correctly 6/6 across two
independent k=3 batches (5/6 explicitly citing check 6 and the decision's
downstream-analytics consequence; 1/6 a lucky catch on a different, also-real
defect). Opus, the tier the gate is pinned to, missed it 0/6 across two
independent batches (`n7q4d`'s baseline + a reconfirmation). So the gap is in
`agents/verifier.md`'s check 6 wording/emphasis itself, reproducible
independent of model tier — fixing the wording benefits the gate regardless of
which model runs it.

## What

Sharpen check 6 in `agents/verifier.md` to explicitly close the "narrated in
the task's own prose" loophole: task-file narration of a tradeoff is not a
substitute for an ADR, because a task file is scoped and ephemeral (it moves to
`done/`) while an ADR is the durable, project-wide-discoverable record BC
READMEs and future maintainers point at. Consider adding a short worked example
mirroring the `missing-adr` / `missing-adr-borderline` distinction so the
verifier has an explicit anchor precedent to reason from.

## Acceptance criteria

- [ ] `agents/verifier.md`'s check 6 section explicitly states that a decision
      explained only in the task file's own `## Why`/`## What` prose still
      requires an ADR — no carve-out for task-file narration.
- [ ] Re-running the `missing-adr-borderline` fixture (`evals/verifier-catch-rate/fixtures/missing-adr-borderline/`)
      against the real (opus-pinned) verifier after the wording change yields
      `VERDICT: FAIL` citing check 6, at least k=3, to confirm the gap is
      closed.
- [ ] `evals/verifier-catch-rate/results/` and the `.agentheim/knowledge/`
      eval report gain a dated addendum recording the before/after (0/6 → FAIL
      N/N) once this fix lands.

## Notes

Backlinks: `agentic-workflow-n7q4d` (found the gap), `agentic-workflow-bx7k5`
(confirmed it is tier-independent, not a sonnet-specific weakness — sonnet
actually caught what opus missed on this exact fixture). ADR-0031 is
unaffected by this fix — it's a wording sharpen to an existing check, not a
routing change.
