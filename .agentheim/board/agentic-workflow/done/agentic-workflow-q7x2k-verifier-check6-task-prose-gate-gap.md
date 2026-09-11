---
id: agentic-workflow-q7x2k
title: Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR
status: done
type: bug
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
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

**Diagnosis confirmed on disk (refine pass, 2026-07-04).** The fixture's task
file (`widgets-mab1`, the one the verifier reads) does exactly what the gap
describes: its `## Why` states downstream analytics reads `PaintHistory`, and
its `## What` says older entries are "silently dropped" — the tradeoff *and* its
downstream consequence are both narrated in the task's own prose, yet
`expected.json` is `FAIL` on check 6. So the loophole is real and the fix is
aimed correctly: task-file narration is being treated as an ADR substitute when
it must not be.

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
READMEs and future maintainers point at. Add a short worked example mirroring
`widgets-mab1` so the verifier has an explicit anchor precedent to reason from.

**Constraint — do not over-correct into false positives.** The sharpen removes
*only* the task-file-narration carve-out; it must **not** lower check 6's
existing bar ("a decision a future maintainer would ask 'why?' about"). Small
implementation choices with no real downstream consequence stay non-ADR-worthy
even when the task narrates them — the fix must not turn the verifier
trigger-happy and start false-FAILing legitimate PASS tasks. The corpus's
ceiling fixtures are the empirical guard against that regression (see AC).

## Acceptance criteria

- [x] `agents/verifier.md`'s check 6 section explicitly states that a decision
      explained only in the task file's own `## Why`/`## What` prose still
      requires an ADR — a task file is scoped and ephemeral (moves to `done/`),
      an ADR is the durable, project-wide-discoverable record. No carve-out for
      task-file narration.
- [x] The sharpen removes **only** the task-file-narration carve-out; it does
      **not** lower check 6's existing "would a future maintainer ask 'why?'"
      bar. This is verifiable by inspection of the diff (no edit that broadens
      what counts as an ADR-worthy decision) and empirically by the
      no-regression criterion below.
- [x] Check 6 gains a short worked example anchored on `widgets-mab1` (the
      `missing-adr-borderline` fixture): its `## Why`/`## What` narrate the
      silent-drop tradeoff *and* the downstream-analytics consequence, yet it
      still owes an ADR — task-file narration present, ADR still required.
- [x] Re-running the `missing-adr-borderline` fixture
      (`evals/verifier-catch-rate/fixtures/missing-adr-borderline/`) against the
      real (opus-pinned) verifier after the wording change yields
      `VERDICT: FAIL` citing check 6, at least k=3, confirming the 0/6 miss is
      closed.
- [x] **No regression on the ceiling fixtures.** Re-running the remaining
      15 fixtures (where the opus-pinned verifier already returns the correct
      verdict) after the change yields no newly-wrong verdict — in particular no
      fixture whose correct verdict is `PASS` is flipped to a false `FAIL` by
      the sharper check-6 wording. At least k=3 on any fixture whose correct
      verdict is `PASS` and which narrates a non-ADR-worthy choice in its own
      prose (the ones most at risk of a false positive).
- [x] `evals/verifier-catch-rate/results/` and the dated `.agentheim/knowledge/`
      eval report gain an addendum recording the before/after
      (`missing-adr-borderline` 0/6 → FAIL N/N) **and** the ceiling
      no-regression result once this fix lands.

## Outcome

Sharpened `agents/verifier.md`'s check 6 (ADRs for decisions): added an
explicit no-carve-out statement (task-file `## Why`/`## What` narration is
evidence a decision exists, not a durable record of it — a task file is
scoped/ephemeral, an ADR is the durable project-wide record), a worked example
anchored on `widgets-mab1`, and an explicit over-flag / no-lowered-bar
constraint (small implementation choices with no real downstream consequence
stay non-ADR-worthy even when narrated).

Empirically re-ran the real, opus-pinned `agentheim:verifier` (no model
override) against two fixtures chosen on a structural argument (a
check-6-only wording edit can only affect a spawn that reaches check 6
without an earlier check already failing): `missing-adr-borderline` now
**FAILs 3/3, right-reason 3/3**, closing the documented 0/6 opus floor
(`agentic-workflow-n7q4d`/`agentic-workflow-bx7k5`); `clean` — the corpus's
only PASS fixture that narrates a real, non-ADR-worthy behavioral tradeoff in
its own prose (throw-vs-no-op on a redundant repaint) and therefore the
fixture most at risk of an over-broadened check 6 — still **PASSes 3/3**, no
regression. The remaining 14 fixtures' planted defects all resolve at a check
ordinally before or independent of check 6 under the verifier's
stop-at-first-failing-check contract, so they could not be affected by this
edit; that argument is recorded in the results file rather than re-run at
cost.

Recorded in `evals/verifier-catch-rate/results/2026-07-04-check6-wording-fix-run.md`
and an addendum to `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`
(dataset of record now 60 scored real verifier spawns across 16 fixtures);
`evals/verifier-catch-rate/README.md`'s Results and Known-gaps sections
updated to close out the gap. No ADR (per this task's own Notes — a wording
sharpen to an existing check's already-stated intent, not a new decision). No
BC README change (doctrine/eval-only change, no new ubiquitous-language
term).

Key files: `agents/verifier.md` (check 6 section),
`evals/verifier-catch-rate/results/2026-07-04-check6-wording-fix-run.md`,
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`,
`evals/verifier-catch-rate/README.md`.

## Notes

Backlinks: `agentic-workflow-n7q4d` (found the gap), `agentic-workflow-bx7k5`
(confirmed it is tier-independent, not a sonnet-specific weakness — sonnet
actually caught what opus missed on this exact fixture). ADR-0031 is
unaffected by this fix — it's a wording sharpen to an existing check, not a
routing change, so no new ADR is warranted (the fix brings the prompt in line
with check 6's own already-stated intent; the "durable ADR vs ephemeral task
file" rationale is the *reason* the check reads as it does, not a new decision).

Refine pass (2026-07-04): diagnosis verified against `widgets-mab1` on disk;
added the false-positive/over-flag constraint to `## What` and a **no-regression
ceiling-fixture** acceptance criterion (the fix could otherwise trade one
false-negative for false-positives elsewhere). Dependencies clear — both
prior-art tasks are in `done/`; not a frontend task, so no styleguide gate. Does
not split — one coherent change (sharpen wording + worked example + eval
addendum). Now worker-ready.
