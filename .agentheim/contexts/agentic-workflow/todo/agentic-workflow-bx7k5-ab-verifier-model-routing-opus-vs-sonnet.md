---
id: agentic-workflow-bx7k5
title: A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
status: todo
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: [agentic-workflow-fq2j8, agentic-workflow-n7q4d]
blocks: []
tags: [harness-audit, verifier, evals, model-routing]
related_adrs: [0031, 0036]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-j4m6r, agentic-workflow-fq2j8, agentic-workflow-hz9m3]
---

## Why

ADR-0031 pins the `verifier` to `opus` on **two independent rationales**, and it
matters which one this spike can actually test:

1. **Judgment-density** — a false PASS compounds, so the gate wants stronger
   reasoning than the `sonnet` worker it audits. This is a **catch-rate claim**:
   it predicts opus catches defects (and cites the right reason, and avoids
   false-FAILs) at a rate a weaker tier can't match. The `verifier-catch-rate`
   fixtures make it falsifiable.
2. **Decorrelation** — the verifier must **not share a model tier** with the
   worker, so a producer and its gate don't wave through the same
   training-memory confabulations. ADR-0031 calls this **load-bearing**: *"never
   weaken the judge to strengthen the executor… downgrading a gate to sonnet to
   'match' its producer would re-correlate the pair and defeat the whole
   decision,"* and it rejects "whole fleet on sonnet" **outright** on this ground.
   A planted-defect catch-rate eval is **structurally blind** to this pillar — it
   measures how well the gate catches, never whether it shares confabulations
   with the producer.

**This spike tests pillar 1 only.** That is the correction over the prior
framing, which read as if a catch-rate result could overturn the opus pin
wholesale. It can't: pillar 2 is independent, unmeasured here, and on its own
sufficient — and given `worker = sonnet`, ADR-0031's own "decorrelated **and**
never-weaker-than-the-producer" constraint leaves `opus` (or a peer/stronger
family) essentially **forced**; a cheaper decorrelated judge (haiku/fable) would
be *weaker* than the producer, which ADR-0031 also rejects. So **no catch-rate
outcome licenses `verifier → sonnet`** — that move re-correlates the pair. The
spike's real, narrower value: (a) **validate or retire the judgment-density
claim** on evidence instead of theory, and (b) **calibrate the fixture corpus**
so the harness has a known discriminating surface. Any *spend-saving routing
change* is a separate decision that must reason about pillar 2 explicitly (see
the decision rule in Notes) — it is not this spike's to make.

**The corpus is now hardened; the discriminating surface exists (`n7q4d`, done
2026-07-04).** The original 12-fixture corpus sat at a zero-variance opus
ceiling — `fq2j8`'s 9 (24/24 catch, 24/24 right-reason, 0/3 false-FAIL, variance
0, *including* the three judgment checks 5/6/6b it was counting on to
discriminate) plus `hz9m3`'s 3 runtime check-8 fixtures (3/3 unanimous) — so on
its own it could only vindicate opus (if sonnet dropped a check) or tie
ambiguously (decision-rule branch 3, "corpus too easy"). `n7q4d` hardened it to
**16 fixtures** by authoring 4 deliberately harder ones and baselining each
against the live opus-pinned verifier (k ≥ 3, 21 spawns). Its standout result
**clears this task's readiness gate**: `missing-adr-borderline` (check 6) is a
**genuine, reproducible opus MISS — PASS 0/6 across two independent k=3
batches** — on uncontested ground truth (the fixture README documents
`PaintHistory` feeding downstream analytics, so the capped-history decision is
genuinely ADR-worthy *and* genuinely un-flagged). That is the hard-**and**-
unambiguous tier-discriminator bx7k5 was blocked waiting for: a fixture where the
incumbent itself fails, so the sonnet arm has something real to move against.
`n7q4d` also retained 3 opus-**ceiling** fixtures (`stale-readme-partial`/5,
`contradicts-adr-partial`/6b, `runtime-probe-subtle-mismatch`/8) under the
explicit-argument clause — kept on the hypothesis they could still trip a weaker
tier even though opus catches them cleanly at zero variance.

So the A/B now runs over a **known, mixed surface**: one opus-**floor** fixture
(the primary discriminator), three opus-**ceiling-but-argued** fixtures, and the
12 zero-variance ceiling fixtures (which can only tie-at-ceiling = corpus-
limited). The spike is no longer inconclusive-by-construction. The decision rule
(Notes) now scores **by fixture direction** — a sonnet *drop* on a ceiling
fixture and a sonnet *catch-or-miss* on the floor fixture mean structurally
different things.

## What

Run the **16-fixture hardened** `verifier-catch-rate` set against a
**`sonnet`-pinned verifier**, k ≥ 3 per fixture, using the exact prompt-assembly
runbook in `evals/verifier-catch-rate/README.md`, and compare the three rates +
variance against the completed **`opus` baseline for the same surface** — scoring
the result **only** as evidence about ADR-0031's *judgment-density* pillar, never
as license to move the verifier off opus (see Notes). The surface is
`fq2j8`'s original 9 + `hz9m3`'s 3 runtime check-8 fixtures + `n7q4d`'s 4 new
discriminating fixtures. The opus arm of record spans
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md` (fq2j8's baseline +
hz9m3's + n7q4d's addendum),
`evals/verifier-catch-rate/results/2026-07-04-run.md` (the original 9 + hz9m3),
and `evals/verifier-catch-rate/results/2026-07-04-hardened-run.md` (n7q4d's 4) —
54 scored real verifier spawns across the 16 fixtures.

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

**Both blockers are done.** `fq2j8` baselined the original 9 against opus,
`hz9m3` the 3 runtime fixtures, and `n7q4d` hardened the corpus + baselined its 4
new ones against opus (readiness gate **satisfied** — see Notes). This task
supplies the **sonnet arm** across the full 16-fixture surface and does the
side-by-side.

## Acceptance criteria

- [ ] The **16-fixture hardened surface** — `fq2j8`'s 9 + `hz9m3`'s 3 runtime +
      `n7q4d`'s 4 new discriminating fixtures — run against a `sonnet`-pinned
      verifier via a per-spawn `model: "sonnet"` override (no edit to
      `agents/verifier.md`), k ≥ 3 per fixture, using the runbook in
      `evals/verifier-catch-rate/README.md`.
- [ ] Catch rate / right-reason rate / false-FAIL rate / per-fixture variance
      reported **side-by-side** with the same-surface `opus` baseline of record —
      `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md` plus
      `evals/verifier-catch-rate/results/2026-07-04-run.md` and
      `.../2026-07-04-hardened-run.md` — in a dated follow-up report under
      `.agentheim/knowledge/` (and per-run numbers under
      `evals/verifier-catch-rate/results/`), plus a protocol entry.
- [ ] The decision rule in Notes is applied and its verdict stated explicitly,
      **scored strictly as evidence about ADR-0031's judgment-density pillar**
      and **by fixture direction**: the ceiling caveat honored (a ~100% tie on a
      fixture opus *also* ceilinged is **inconclusive / corpus-limited** — branch
      "ceiling", never a clean sonnet win), AND the **opus-floor fixture
      `missing-adr-borderline` scored on its own terms** — a sonnet catch there
      reported as evidence *against* judgment-density (weaker tier outperformed;
      flag + re-run at higher k), a sonnet miss as a **tie-at-floor** (opus's
      density did not manifest where the fixture strains it → density unsupported
      on that fixture, and a real gate gap in the current verifier). "Sonnet ties
      opus" is evidence against the judgment-density rationale only on a fixture
      `n7q4d` showed to strain opus — and **never** evidence about the
      decorrelation pillar, which this eval cannot measure.
- [ ] The report states explicitly that **no result here moves the verifier to
      `sonnet`** (that re-correlates the worker→verifier pair, ADR-0031's
      load-bearing rule). If the evidence retires the judgment-density claim, any
      proposed spend-saving routing change ships as its **own** ADR superseding
      ADR-0031 that reasons about decorrelation explicitly — not as an edit made
      under this spike.
- [ ] `agents/verifier.md` is unchanged by this task (verified — the override
      method touches no tracked agent file).

## Notes

**Decision rule (the falsification contract — fixed before the run).** Scored
across the 16-fixture hardened surface, k ≥ 3, **as a test of ADR-0031's
judgment-density pillar only** (pillar 2, decorrelation, is out of this eval's
reach and independently sufficient to keep the opus pin). Because `n7q4d`
established a **mixed** opus baseline, the rule scores **by fixture direction**:

- **Opus-ceiling fixtures** — opus 3/3 right-reason: the 12 original +
  `stale-readme-partial`, `contradicts-adr-partial`, `runtime-probe-subtle-mismatch`.
  Here sonnet can only tie or drop.
  - **Sonnet drops** (a defect opus caught that sonnet missed, a right-reason
    catch degraded to a lucky/wrong-reason catch, or a false-FAIL opus didn't
    draw) → the **judgment-density** justification is **vindicated** on that
    fixture; keep opus, record the confirming evidence.
  - **Sonnet ties at ceiling** → **inconclusive / corpus-limited** — not a clean
    sonnet win, by construction, because opus itself ceilinged (the false-tie the
    rule has always guarded against).
- **Opus-floor fixture** — `missing-adr-borderline`, opus 0/6 — the primary
  discriminator. Here the question inverts: can the weaker tier do *better*?
  - **Sonnet also misses** (PASS, no catch) → **tie-at-floor**: opus's
    judgment-density advantage did **not** manifest where the fixture strains it
    → evidence **against** the judgment-density rationale *on this fixture*, and a
    surfaced **gate gap** — a real ADR-worthiness defect the current verifier
    misses at *both* tiers, worth its own follow-up regardless of routing.
  - **Sonnet catches it** (FAIL, right-reason) → the weaker tier **outperformed**
    opus on a judgment check → direct evidence **against** judgment-density.
    Almost certainly variance given opus's stable 0/6, so **flag it, re-run at
    higher k**, and report it as anti-density either way — **never** as
    vindication of the opus pin.
- **Overall.** None of these outcomes licenses `verifier → sonnet`: that
  re-correlates the worker→verifier pair, and decorrelation (pillar 2)
  independently holds the pin. If the floor fixture and any ceiling-fixture
  evidence together **retire** the judgment-density claim, the most likely
  resolution is **"decorrelation alone carries the pin — no routing change."** If
  a spend-saving move is still wanted, it ships as its own superseding ADR that
  keeps the worker→verifier pair decorrelated *and* the judge not-weaker-than the
  producer — a constraint that, with `worker = sonnet`, points back at `opus` (or
  a peer family), not at sonnet.

**Readiness gate — satisfied.** This task's comparison only has power if `n7q4d`
produced **≥ 1 opus-straining fixture with uncontested ground truth**. It did:
`missing-adr-borderline` is a reproducible opus miss (0/6) on a defect a fair
reader agrees is genuinely there — checked against this corpus's own
`missing-adr` fixture (narrated identically in its own `## What`, correctly
FAILed 3/3) as the uncontested-ground precedent. So bx7k5 has a genuine
discriminating surface and is **not** inconclusive-by-construction. (Recorded
here as met; it was the open condition at PROMOTE time — now cleared by `n7q4d`'s
result, not merely its status.)

**Spend.** Sonnet arm over the 16-fixture surface × k ≥ 3 (≈48 sonnet spawns).
Budget-light by design — this is a measurement spike; the durable artifact is the
side-by-side table and the applied decision rule, not a harness.

**Sibling tasks.** `fq2j8` (done) baselined the original 9; `hz9m3` (done) added
the 3 runtime check-8 fixtures — in scope (the sonnet arm covers all 16, and the
runtime fixtures are among the harder discriminators; ADR-0036 governs that
check). `n7q4d` (done) hardened the corpus with 4 new discriminating fixtures,
including the `missing-adr-borderline` floor discriminator. The
`research-review-gate-catches-hallucinated-claim` eval in `evals/evals.json` is
the structural twin for the *other* adversarial gate — and note it faces the
**same** pillar split: `research-reviewer` (opus) audits a `sonnet` researcher,
so any A/B there measures its judgment-density, not the decorrelation that
ADR-0031 also rests on. A candidate to generalize the harness toward later.
