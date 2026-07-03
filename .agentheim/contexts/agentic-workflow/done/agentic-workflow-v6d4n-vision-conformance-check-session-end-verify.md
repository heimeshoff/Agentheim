---
id: agentic-workflow-v6d4n
title: Vision-conformance check — flag in-flight work that drifts from vision success criteria / non-goals
status: done
type: feature
context: agentic-workflow
created: 2026-07-03
completed: 2026-07-03
depends_on: []
blocks: []
tags: [harness-audit, vision, planning, three-loops, verification]
related_adrs: ["0027", "0017", "0040"]
related_research: []
prior_art: [agentic-workflow-d6q4h]
related_tasks: [agentic-workflow-x4t2g]
---

## Why

Split off from `agentic-workflow-x4t2g` (the whats-next read edge). Closing the
Why→What loop by having planning skills *read* the advisory (x4t2g) is the light
half; the heavier half is an actual **conformance check** — something that reads
the vision's success criteria and non-goals and *evaluates* whether just-completed
work still serves them, then flags drift. Today nothing does this; the vision can
silently rot while work proceeds, and only a human notices. This is the fuller
version of "closing the loop" the 2026-07-02 harness audit called for.

## What

A lightweight vision-conformance check that runs at **`work`'s session-end
reconciliation** (per-session, over the batch just shipped) and **flags** (never
blocks) drift from `vision.md`. This differs from x4t2g: x4t2g only *reads* the
advisory; v6d4n *evaluates and reports*.

The three open forks are settled to the following best-default shape (**confirmed
2026-07-03** under the builder's autonomous-refinement authorization):

- **Where it runs → `work` session-end reconciliation.** One pass per session over
  the batch just completed, folded into the existing session-end step
  (`agentic-workflow-d6q4h`'s home). Rejected: the **verifier gate** (per-task —
  would widen that gate's frozen "acceptance criteria + tests" contract, need its
  own ADR, and re-read the vision on every task) and a **standalone pass**
  (redundant with session-end). Session-end is the cheapest home with batch-level
  coverage.
- **What it emits → an advisory only.** A protocol note in the session-end entry
  when drift is detected, plus (when a drift is worth the builder's attention) a
  line surfaced through the `whats-next` advisory (ADR-0027 advisory-write family).
  It **never** hard-blocks a task, commit, or session — the human decides on drift
  (non-goal: Agentheim is not autonomous).
- **How it judges → a cheap, bounded read.** The check reads **only** the two
  vision sections — "What success looks like" and "Non-goals" — plus the batch's
  already-summarized completed-task entries (the session-end protocol material it
  already has in hand), and asks a single question per shipped task: "does this
  pull toward a stated non-goal, or away from a success criterion?" No per-task
  vision essay; one bounded pass per session.

## Acceptance criteria

- [x] `work`'s session-end reconciliation gains a vision-conformance pass that reads `vision.md`'s "What success looks like" + "Non-goals" sections and the session batch's completed-task summaries, and evaluates the batch against them.
- [x] Drift is emitted as an **advisory** — a note in the session-end protocol entry, and where warranted a `whats-next` advisory line (ADR-0027) — and **never** hard-blocks a task, commit, or session (human-in-the-loop non-goal holds).
- [x] The pass reads only the two named vision sections (not the whole vision, not per-task deep dives), and when it flags drift it **names the specific success criterion or non-goal** the flagged task diverges from.
- [x] A conforming batch produces **zero** flags — no false-drift noise on aligned work.
- [x] An ADR records the mechanism (session-end home, advisory-not-gate, ADR-0027 advisory-write family, the two-section bounded read); the ADR is backlinked into this task's `related_adrs` and its own `related_tasks` names this task.
- [x] Covered where deterministic: the vision-section extraction and the flag-formatting are unit-tested (`node --test`); the LLM judgment is exercised by at least one eval fixture (a planted drift-toward-a-non-goal task that should flag, and a clean batch that should not) or, if a full eval is out of scope, a documented runbook fixture under `evals/`.

## Notes

- Sibling of `agentic-workflow-x4t2g` (whats-next read edge); independent — v6d4n
  reads `vision.md` directly, not the advisory, so no `depends_on` edge.
- Home chosen (session-end) mirrors `agentic-workflow-d6q4h`'s session-end
  reconciliation — prior art for adding a bounded pass to that step.
- Refined 2026-07-03 from an under-specified capture: the mechanism/home/output
  forks were settled to (session-end / advisory-only / two-section bounded read)
  under the builder's autonomous-refinement authorization. The ADR is written when
  worked (do not pre-write); it likely belongs in the ADR-0027 advisory-write
  family rather than reshaping the verifier contract.

## Outcome

Added a bounded, advisory vision-conformance pass to `work`'s end-of-run reporting
(new step 5, `skills/work/SKILL.md`, between the surprise-surfacing step and
`agentic-workflow-d6q4h`'s carry-over reconciliation, which shifted to step 6; the
final protocol entry shifted to step 7). The pass reads exactly `vision.md`'s "What
success looks like" and "Non-goals" sections plus the session batch's
already-summarized completed-task entries, and judges per shipped task whether it
pulls toward a non-goal or away from a success criterion — never a per-task deep
dive, never a whole-vision essay, never a gate.

Deterministic half — extraction and formatting — lives in
`lib/vision-conformance.mjs` (`extractSection`, `extractVisionSections`, `labelFor`,
`formatConformanceLine`, `worthSurfacing`), unit-tested in
`lib/test/vision-conformance.test.mjs` (15 tests, `node --test`, TDD red→green:
confirmed the test file failed for the right reason — `ERR_MODULE_NOT_FOUND` —
before the module existed). The LLM judgment itself is exercised by
`evals/vision-conformance-check/` (`planted-drift/` — three synthetic tasks each
removing a named human-in-the-loop gate, all three correctly flagged against
"Not autonomous."; `clean-batch/` — four real completed tasks, correctly zero
flags), run as a documented manual runbook pass (`results/2026-07-03-run.md`),
not a full k=3 multi-spawn measurement.

Emission is two-tier, both advisory (ADR-0027 family): always a
`**Vision-conformance:**` line in the session-end protocol entry
(`formatConformanceLine`'s output, or `none — batch aligns with vision`); and, only
when `worthSurfacing` is true, an (over)write of the *same* single-latest
`.agentheim/state/whats-next.md` artifact the `whats-next` skill itself writes —
already read back by the next session's `work` Phase 3 planning and `modeling`'s
"Before acting" step (`agentic-workflow-x4t2g`), so a session-end drift note
naturally surfaces as planning input for whatever runs next without inventing a
second read path or a second file.

**ADR-0040** (`.agentheim/knowledge/decisions/0040-vision-conformance-check-session-end-advisory.md`)
records the mechanism (session-end home over the verifier gate / standalone pass
alternatives, advisory-not-gate emission, the two-section bounded read, and why a
second writer on `whats-next.md` is safe given ADR-0027's single-latest design).

BC README updated with a new **Vision-conformance check** ubiquitous-language term.

Key files: `skills/work/SKILL.md`, `lib/vision-conformance.mjs`,
`lib/test/vision-conformance.test.mjs`, `evals/vision-conformance-check/`,
`.agentheim/knowledge/decisions/0040-vision-conformance-check-session-end-advisory.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
