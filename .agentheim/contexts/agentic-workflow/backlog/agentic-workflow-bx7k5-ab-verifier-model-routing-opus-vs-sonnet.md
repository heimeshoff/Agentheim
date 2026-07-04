---
id: agentic-workflow-bx7k5
title: A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: [agentic-workflow-fq2j8, agentic-workflow-n7q4d]
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

**The signal lives in the harder checks — and the opus baseline now shows the
existing corpus can't provide it.** `fq2j8` completed the full 9-fixture opus
baseline: **24/24 catch, 24/24 right-reason, 0/3 false-FAIL, variance 0 across
all 9** — and that zero-variance ceiling holds even on the three *judgment*
checks this A/B was counting on to discriminate (`stale-readme`/check 5,
`missing-adr`/check 6, `contradicts-adr`/check 6b). `hz9m3`'s 3 runtime check-8
fixtures landed 3/3 unanimous too. With the incumbent already maxing every
fixture at zero variance, the existing corpus **cannot discriminate between model
tiers**: a sonnet run over it alone can only (a) vindicate opus if sonnet drops a
check opus caught, or (b) tie at ~100% — which now reads as "corpus too easy"
(decision-rule branch 3), never a clean sonnet-equals-opus result.

So the A/B now waits on `agentic-workflow-n7q4d` to **harden the corpus first**
(add fixtures that genuinely strain even opus), and runs over the hardened
surface: the existing 12 fixtures (`fq2j8`'s original 9 + `hz9m3`'s 3 runtime)
**plus** `n7q4d`'s new discriminating fixtures. `fq2j8`/`hz9m3` (both done)
supply the opus arm for the existing 12; `n7q4d` supplies it for the new ones.

## What

Run the **entire hardened** `verifier-catch-rate` fixture set against a
**`sonnet`-pinned verifier**, k ≥ 3 per fixture, using the exact prompt-assembly
runbook in `evals/verifier-catch-rate/README.md`, and compare the three rates +
variance against the completed **`opus` baseline for the same surface**. The
surface is the existing 12 fixtures — `fq2j8`'s original 9 plus `hz9m3`'s 3
runtime check-8 fixtures — **plus** the new discriminating fixtures
`agentic-workflow-n7q4d` adds. The opus arm of record lives in
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md` and
`evals/verifier-catch-rate/results/2026-07-04-run.md` (fq2j8's 9 + hz9m3's
addendum), extended by `n7q4d`'s opus baseline for the new fixtures.

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

**Depends on `fq2j8` (done) and `n7q4d` (corpus hardening).** The opus arm must
cover the whole surface before the sonnet arm is a clean same-set comparison.
`fq2j8` completed the opus baseline for the original 9 (and `hz9m3` for the 3
runtime fixtures); `n7q4d` hardens the corpus and baselines the new fixtures
against opus. This task supplies the **sonnet arm** across the full hardened
surface and does the side-by-side.

## Acceptance criteria

- [ ] The **entire hardened** `verifier-catch-rate` surface — the existing 12
      fixtures (`fq2j8`'s 9 + `hz9m3`'s 3 runtime) plus `n7q4d`'s new
      discriminating fixtures — run against a `sonnet`-pinned verifier via a
      per-spawn `model: "sonnet"` override (no edit to `agents/verifier.md`),
      k ≥ 3 per fixture, using the runbook in `evals/verifier-catch-rate/README.md`.
- [ ] Catch rate / right-reason rate / false-FAIL rate / per-fixture variance
      reported **side-by-side** with the same-surface `opus` baseline
      (`fq2j8` + `hz9m3` + `n7q4d`), in a dated follow-up report under
      `.agentheim/knowledge/` (and per-run numbers under
      `evals/verifier-catch-rate/results/`), plus a protocol entry.
- [ ] The decision rule in Notes is applied and its verdict stated explicitly —
      with the pre-registered ceiling caveat honored: a ~100% tie on a fixture
      where opus *also* ceilinged is reported as **inconclusive / corpus-limited**
      (branch 3), not a clean sonnet win; "sonnet ties opus" counts as evidence
      against the pin only on a fixture `n7q4d` showed to strain opus.
- [ ] `agents/verifier.md` is unchanged by this task (verified — the override
      method touches no tracked agent file). Any routing change ships as its own
      ADR superseding ADR-0031, not as an edit made under this spike.

## Notes

**Decision rule (the falsification contract — fix it before the run).** Scored
across the full hardened surface, k ≥ 3. **Pre-registered given `fq2j8`:** opus
already ceilinged all 12 existing fixtures at zero variance, so a tie *there* is
corpus-limited by construction — the discriminating verdict can only come from
`n7q4d`'s hardened fixtures, where "sonnet ties" is real evidence only if the
fixture was shown to strain opus:

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

**Spend.** Sonnet arm over the hardened surface — the 12 existing fixtures plus
`n7q4d`'s new ones, × k = 3 (≈36+ sonnet spawns). Budget-light by design — this
is a measurement spike; the durable artifact is the side-by-side table and the
applied decision rule, not a harness.

**Sibling tasks.** `fq2j8` (done) completed the opus baseline for the original 9;
`agentic-workflow-hz9m3` (done) added the 3 runtime check-8 fixtures — **now in
scope** (the sonnet arm covers all 12, and hz9m3's runtime fixtures are among the
harder discriminators). `agentic-workflow-n7q4d` (new blocker) hardens the corpus
with additional discriminating fixtures before this A/B runs. The
`research-review-gate-catches-hallucinated-claim` eval in `evals/evals.json` is
the structural twin for the *other* adversarial gate and a candidate to
generalize the harness toward later.
