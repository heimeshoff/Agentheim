---
id: agentic-workflow-bx7k5
title: A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: [agentic-workflow-fq2j8]
blocks: []
tags: [harness-audit, verifier, evals, model-routing]
related_adrs: [0031]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-j4m6r]
---

## Why

ADR-0031 pins the `verifier` to `opus` on the theory that the adversarial gate
needs a stronger model than the `sonnet`-pinned `worker` it audits. The
`verifier-catch-rate` fixtures (`agentic-workflow-v3h6p`) now make that theory
falsifiable: re-run the same fixtures with the verifier on `sonnet` and compare
catch rate / right-reason rate / false-FAIL rate against the `opus` baseline. If
sonnet matches opus, the opus pin is paying for nothing; if it doesn't, the pin
is vindicated with evidence instead of theory.

**The signal lives in the harder checks.** The opus baseline measured only 6 of
the 9 fixtures — checks 1, 2, 3, 4, 7 plus `clean` — and scored a perfect
15/15 catch, 15/15 right-reason, 0/3 false-FAIL, zero variance. Those are the
*mechanical* checks (AC coverage, test execution, scope, vocab presence, index
tampering), where opus is already at the ceiling. An A/B run against that subset
alone would most likely land "both 100%, no signal" — inconclusive. The three
fixtures `v3h6p` left unmeasured — `stale-readme` (check 5, README sync),
`missing-adr` (check 6, ADR-worthiness), `contradicts-adr` (check 6b, honoring a
related ADR) — are the *judgment* checks where an opus-vs-sonnet gap would
actually surface. So this A/B is only worth running over the **full 9-fixture
surface**, which is why it now waits on `agentic-workflow-fq2j8` to complete the
opus baseline to all 9 first.

## What

Re-run the entire `verifier-catch-rate` fixture set (all 9 fixtures, k ≥ 3 per
fixture) against a **`sonnet`-pinned verifier**, using the exact prompt-assembly
runbook in `evals/verifier-catch-rate/README.md`, and compare the three rates +
variance against the completed 9-fixture **`opus` baseline** (produced by
`fq2j8`, recorded alongside `v3h6p`'s numbers in
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md` / its follow-up
report).

**Pin sonnet by spawn-time override, not by editing the agent file.** Spawn the
verifier with a per-spawn model override —
`Agent(subagent_type: "verifier", model: "sonnet", …)` — which takes precedence
over `agents/verifier.md`'s `model:` frontmatter. Do **not** edit
`agents/verifier.md`. The prompt, checks, and tools stay byte-identical to the
opus baseline (so *only* the model tier — the independent variable — changes),
there is nothing to revert, and a concurrent `work` session can never pick up a
sonnet-pinned verifier mid-experiment. This is a measurement task, not a routing
change: any routing change is a separate, superseding ADR (see the decision rule
in Notes).

**Depends on `fq2j8`.** The opus arm must cover all 9 fixtures before the sonnet
arm is a clean same-set comparison. `fq2j8` runs the missing 3 opus fixtures;
this task supplies the sonnet arm across all 9 and does the side-by-side.

## Acceptance criteria

- [ ] All 9 `verifier-catch-rate` fixtures run against a `sonnet`-pinned verifier
      via a per-spawn `model: "sonnet"` override (no edit to `agents/verifier.md`),
      k ≥ 3 per fixture, using the runbook in `evals/verifier-catch-rate/README.md`.
- [ ] Catch rate / right-reason rate / false-FAIL rate / per-fixture variance
      reported **side-by-side** with the completed 9-fixture `opus` baseline, in a
      dated follow-up report under `.agentheim/knowledge/` (and per-run numbers
      under `evals/verifier-catch-rate/results/`), plus a protocol entry.
- [ ] The decision rule in Notes is applied and its verdict stated explicitly:
      opus-vindicated (keep the pin, record the evidence), sonnet-ties (write a
      superseding ADR proposing verifier→sonnet), or inconclusive (recommend
      corpus expansion, no routing change).
- [ ] `agents/verifier.md` is unchanged by this task (verified — the override
      method touches no tracked agent file). Any routing change ships as its own
      ADR superseding ADR-0031, not as an edit made under this spike.

## Notes

**Decision rule (the falsification contract — fix it before the run).** Scored
across all 9 fixtures, k ≥ 3:

- **Sonnet ties opus** on catch rate AND right-reason rate AND false-FAIL rate
  (no worse on any, within the resolution of k) → opus does not earn its gate
  spend → write a superseding ADR proposing verifier→sonnet.
- **Sonnet worse on any** — a defect opus caught that sonnet missed, a
  right-reason catch degraded to a lucky/wrong-reason catch, or a false-FAIL opus
  didn't draw → ADR-0031's opus pin is vindicated; keep opus, record the
  confirming evidence, no ADR change.
- **Both hit ceiling / high variance** (e.g. both 100% even on the judgment
  checks, so the corpus can't discriminate) → report inconclusive; recommend
  expanding/hardening the fixture corpus; no routing change.

**Spend.** Full surface is ~27 sonnet spawns (9 fixtures × k = 3). Budget-light
by design — this is a measurement spike; the durable artifact is the side-by-side
table and the applied decision rule, not a harness.

**Sibling tasks.** `fq2j8` completes the opus baseline (its blocker for this
task); `agentic-workflow-hz9m3` adds a check-8 (runtime-drive, ADR-0036) fixture
— out of scope here (this A/B compares the model tier on the existing checks, not
new coverage). The `research-review-gate-catches-hallucinated-claim` eval in
`evals/evals.json` is the structural twin for the *other* adversarial gate and a
candidate to generalize the harness toward later.
