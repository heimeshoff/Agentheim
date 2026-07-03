---
id: agentic-workflow-v3h6p
title: Eval-harness the verifier — measure its catch rate against planted defects
status: done
type: spike
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals, quality-gate]
related_adrs: [0031]
related_research: []
prior_art: [agentic-workflow-j4m6r, agentic-workflow-g9s3w, agentic-workflow-f7k2d]
---

## Why

The verifier gate is the load-bearing quality mechanism — the vision's whole
premise is that wrong work is caught by structure, not luck — and it has zero
measured performance. The dashboard has ~60 test files; the agentic core has 4
prompts in `evals/evals.json`. Nobody knows whether the verifier actually catches
planted defects, nor whether it FAILs for the *right* reason when it does.
(Harness audit 2026-07-02, eval-coverage gap.)

## What

Build a repeatable eval that feeds the **real `verifier` agent** hand-authored
fixtures with known planted defects and measures its verdicts against ground
truth — catch rate, false-FAIL rate, and whether each catch cites the check the
defect was planted under.

**Fidelity — measure the live gate, not a copy.** The harness spawns the actual
`verifier` subagent (`agents/verifier.md`, opus-pinned per ADR-0031) with a
faithful spawn prompt and parses its `VERDICT: …` block. A scripted
reproduction of the checks was rejected: the gate *is* an LLM, so a
deterministic stand-in would measure the wrong thing.

**A fixture is a verifier-input tuple + ground truth.** The verifier does not
take a free prompt; it takes the tuple `agents/verifier.md` documents (task file,
BC README, the diff, the worker's strict SUCCESS return block, the pre-resolved
test command, iteration number). Each fixture supplies exactly that tuple plus
the expected verdict, so the fixture format mirrors the real spawn one-for-one
(this is why `g9s3w`'s pre-resolved-test-command block and `f7k2d`'s `TESTS_*`
return fields are prior art — the fixture must carry them or the spawn is not
faithful).

**Cover the full 7-check surface.** One or more planted-defect fixtures per
verifier check, plus a clean true-negative:

| Fixture | Planted defect | Verifier check it should trip |
|---|---|---|
| `missing-ac` | implements N−1 of N criteria | 1 — acceptance-criteria coverage |
| `tests-fail` | added test that does not pass | 2 — test execution |
| `scope-creep` | edits an unrelated production file | 3 — scope discipline |
| `vocab-violation` | new domain term absent from the BC README | 4 — ubiquitous language |
| `stale-readme` | new aggregate/event, `BC_README_UPDATED: no` | 5 — BC README sync |
| `missing-adr` | embeds a "why?" decision, no ADR | 6 — ADRs for decisions |
| `contradicts-adr` | diff violates a `related_adrs` decision | 6b — honored related ADRs |
| `index-tampering` | diff modifies `INDEX.md` / `protocol.md` | 7 — no protocol/index tampering |
| `clean` | a genuinely correct, in-scope diff | none — expected PASS |

(A spike may land a load-bearing subset first and log what it skipped, but the
target is the whole surface — 4 of the 7 checks are unmeasured today.)

**Scoring is a rate, not a boolean.** Each fixture runs k times (k = 3–5, matching
the capture benchmark's `runs_per_configuration`); catch rate, false-FAIL rate and
verdict variance are reported as fractions. A single draw misrepresents a
stochastic gate.

**A catch must cite the right check.** A defect fixture counts as caught only when
the verdict is FAIL **and** its `REASONS` / `ITERATION_HINT` name the check the
defect was planted under. A FAIL for an unrelated reason is a *lucky catch*,
tallied separately — the right-reason rate is the diagnostic number.

## Acceptance criteria

- [ ] A fixture set lives under `evals/verifier-catch-rate/fixtures/<name>/`, each fixture carrying the full verifier-input tuple (task file, BC README or pointer, `diff.patch`, worker SUCCESS return block, pre-resolved test command, iteration number) plus an `expected.json` ground truth (`verdict`, planted `check`).
- [ ] The set covers the verifier's checks per the table above — at minimum the four originally listed (missing-AC, scope-creep, vocab-violation, clean); the whole 7-check surface is the target, and any check deliberately left out is named in the report.
- [ ] The harness spawns the **real** `verifier` agent per fixture (not a scripted reproduction) and parses its `VERDICT` block; each fixture is run k times (k ≥ 3).
- [ ] Measured and recorded (a report in `knowledge/` plus a protocol entry): overall **catch rate**, **false-FAIL rate** (on the clean fixture), **right-reason rate** vs lucky-catch rate, and per-fixture verdict variance across the k runs.
- [ ] Findings feed back: each verifier-prompt weakness the eval exposes becomes a follow-up capture (id noted in the report).

## Notes

Spike: the deliverable is the measurement and what it teaches, not a polished
harness. The driver can be as light as a documented runbook that assembles the
spawn prompt from the fixture files, spawns the `verifier`, and tallies parsed
verdicts — the durable artifacts are the fixtures, the pinned ground truth, and
the recorded numbers under `evals/verifier-catch-rate/results/`.

Structural twin: `evals/evals.json`'s `research-review-gate-catches-hallucinated-claim`
eval is the same shape for the *other* adversarial gate (`research-reviewer`) —
worth reading as a model, and a candidate to generalise the harness toward later.

Pairs with the model-routing work (`j4m6r`, now shipped as **ADR-0031** — verifier
pinned to opus). Once pinned, the eval answers "does opus-on-the-gate earn its
spend?": re-running the fixtures with the verifier pinned to sonnet vs opus A/Bs
the gate model, and re-running after any spawn-prompt change (cf. `g9s3w`, `f7k2d`)
guards against catch-rate regressions.

**Four design calls — ratified 2026-07-03** (under the builder's
autonomous-refinement authorization): (1) spawn the real verifier vs a scripted
driver → **real**; (2) full 7-check coverage vs the 4 originally listed → **full**,
subset allowed if logged; (3) N-runs rate vs single-pass boolean → **N-runs**;
(4) right-reason-required vs any-FAIL-counts → **right-reason required**, lucky
catches logged apart. All four stand as the task's contract.

## Outcome

Built the full 9-fixture set (`evals/verifier-catch-rate/fixtures/`) covering
checks 1, 2, 3, 4, 5, 6, 6b, 7 plus a clean true-negative — each fixture
doubling as a self-contained "worktree" with real, runnable `node --test`
code (no simulated test results), the worker's strict SUCCESS block,
`diff.patch`, and pinned `expected.json` ground truth. Real-spawned the live
`agentheim:verifier` agent (opus-pinned, ADR-0031) against 6 of the 9
fixtures, k = 3 runs each (18 scored runs, plus 3 more runs against a v1
`clean` fixture that turned out to have a self-contradiction — see below).

**Headline numbers**: catch rate 15/15 = 100%, right-reason rate 15/15 =
100% (zero lucky catches), false-FAIL rate 0/3 = 0%, verdict variance 0
across all 6 measured fixtures. Full per-run table:
`evals/verifier-catch-rate/results/2026-07-03-run.md`. Full write-up:
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md`.

**One real finding**: the first version of the `clean` fixture used raw
string color literals while its own BC README banned exactly that
("`Color`... never as a raw string") — the real verifier correctly `FAIL`ed
it 3/3 under check 4, catching a genuine bug I introduced while authoring
the fixture, not a false positive. Fixed by introducing an actual `Color`
enum; corrected fixture came back `PASS` 3/3. Recorded as a lesson (the
verifier enforces README wording, including representation-level clauses,
completely literally) rather than a verifier-prompt defect — no code change
to `agents/verifier.md` was warranted.

**Left unmeasured, logged not silently skipped**: `stale-readme` (check 5),
`missing-adr` (check 6), `contradicts-adr` (check 6b) are fully built but
not real-spawned this pass (spike budget) — follow-up
`agentic-workflow-fq2j8`. Check 8 (runtime drive, ADR-0036, added same-day)
has no fixture at all — needs a runtime-surface BC — follow-up
`agentic-workflow-hz9m3`. The opus-vs-sonnet A/B this baseline now makes
possible (per ADR-0031) is filed as `agentic-workflow-bx7k5`.

Key files: `evals/verifier-catch-rate/README.md` (runbook),
`evals/verifier-catch-rate/fixtures/*/` (9 fixtures),
`evals/verifier-catch-rate/results/2026-07-03-run.md`,
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md`.
