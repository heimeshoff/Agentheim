---
id: agentic-workflow-n7q4d
title: Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set)
status: done
type: spike
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: [agentic-workflow-bx7k5]
tags: [harness-audit, verifier, evals, model-routing]
related_adrs: [0031, 0036]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-fq2j8, agentic-workflow-hz9m3]
---

## Why

`fq2j8`'s full 9-fixture opus baseline came back **24/24 catch, 24/24
right-reason, 0/3 false-FAIL, variance 0 across all 9** — and crucially that
zero-variance ceiling held even on the three *judgment* checks
(`stale-readme`/5, `missing-adr`/6, `contradicts-adr`/6b) that were supposed to
be where a model-tier gap surfaces. `hz9m3`'s 3 runtime check-8 fixtures landed
3/3 unanimous too. So the entire 12-fixture corpus sits at a zero-variance opus
ceiling: **it cannot discriminate between model tiers**, because the incumbent
already maxes it.

That makes the planned opus-vs-sonnet A/B (`agentic-workflow-bx7k5`) most likely
land "both ~100%, inconclusive" — exactly `bx7k5`'s own decision-rule branch 3
(corpus can't discriminate). Rather than spend the sonnet arm to confirm the
corpus is too easy, harden it first: add fixtures that genuinely strain even
opus, so the A/B has real discriminating power instead of only being able to
vindicate opus or produce an ambiguous tie.

This is the corpus-expansion recommendation baked into `bx7k5`'s branch 3,
promoted to a prerequisite. Structurally it mirrors the existing chain:
`v3h6p` authored + partially baselined → `fq2j8` completed the opus baseline →
**this task** hardens + baselines the new fixtures → `bx7k5` supplies the sonnet
arm and the side-by-side.

## What

Author additional `verifier-catch-rate` fixtures deliberately designed to be
*harder* than the current set on the judgment-heavy checks — subtler README
staleness (check 5), genuinely borderline ADR-worthiness (check 6), a
subtle/partial ADR contradiction (check 6b), and harder runtime-probe
mismatches (check 8) — following the fixture shape and runbook in
`evals/verifier-catch-rate/README.md` (task file, synthetic BC README,
`diff.patch`, `worker-success.txt`, `meta.json`, `expected.json`; runtime
fixtures also carry a `## Runtime surface` manifest + a real stdlib server).

For each candidate, run the **opus**-pinned verifier (k ≥ 3, same runbook) to
establish whether it discriminates. A fixture earns its place only if it is
*both* (a) **hard** — it strains opus on reasoning depth (a miss or a
lucky/wrong-reason catch) — *and* (b) **unambiguous** — the planted defect is one
a fair reader agrees is genuinely there, not a contested FAIL/PASS call. Target
**discriminating potential, not raw difficulty, and not contested difficulty**: a
fixture where opus still trivially 100%s teaches nothing about a weaker tier; but
a fixture where opus flip-flops only because its *ground truth* is contested
teaches nothing either — a weaker tier flip-flopping there measures noise, not
tier (the false-vindication trap; see Notes). Non-zero opus verdict variance is a
retain signal **only once the fixture's ground truth is shown uncontested** —
otherwise it's a reason to rework, not keep. Fixtures that teach nothing (opus
ceilings) or whose ground truth is contested are reworked or dropped, with the
reasoning noted (though a fixture opus catches cleanly *may* be kept if there's
an explicit argument it could still trip a weaker tier).

Record the new fixtures' opus baseline alongside the existing dataset — a new
results file under `evals/verifier-catch-rate/results/` and a dated report under
`.agentheim/knowledge/` — **extending, not replacing** `fq2j8`'s dataset of
record, so `bx7k5`'s sonnet arm has a same-set opus arm to compare against across
the whole hardened surface.

## Acceptance criteria

- [ ] At least 3–4 new fixtures authored per the fixture shape in
      `evals/verifier-catch-rate/README.md`, targeting the judgment checks
      (5 / 6 / 6b) and the harder runtime check (8).
- [ ] Each new fixture run k ≥ 3 against the **opus**-pinned verifier; per-fixture
      opus result recorded (verdict, cited check, verdict variance).
- [ ] Each *retained* fixture has **unambiguous ground truth** (a planted defect a
      fair reader agrees is genuinely there — not a contested FAIL/PASS call) **and**
      is shown to **strain opus on reasoning depth** (a miss or a lucky/wrong-reason
      catch). **Non-zero verdict variance alone is not sufficient to retain** — on a
      contested fixture opus flip-flops for lack of a stable answer, so a weaker tier
      flip-flopping there measures noise, not tier (a false-vindication trap for
      `bx7k5`). A fixture opus catches cleanly may still be kept only with an explicit
      argument it could trip a weaker tier. Fixtures that teach nothing — opus
      ceilings, *or* whose ground truth is contested — are reworked or dropped, noted.
- [ ] New fixtures' opus baseline recorded in
      `evals/verifier-catch-rate/results/` and a dated report under
      `.agentheim/knowledge/`, extending (not replacing) the `fq2j8` dataset of
      record; the eval `README.md` updated (including a short *"what makes a valid
      tier-discriminator"* methodology note — hard **and** unambiguous, never
      contested); a protocol entry written.
- [ ] `bx7k5`'s comparison surface is the hardened corpus (the existing 12
      fixtures + the new ones); this task's `blocks: [agentic-workflow-bx7k5]`
      edge holds and `bx7k5`'s `depends_on` lists this id.

## Notes

- **Same author-then-A/B split as the existing chain.** Opus spawns live *here*
  (authoring + baselining the new fixtures); the sonnet spend stays in `bx7k5`.
  Keeping the two arms in separate tasks preserves the clean same-set comparison
  `fq2j8` was created to guarantee.
- **What "discriminating" means operationally.** You can't fully prove a fixture
  discriminates *tiers* without running the weaker tier (that's `bx7k5`) — but
  you *can* reject the trivial ones: any fixture opus unanimously right-reason
  catches at zero variance is, on this evidence, corpus-limited and should be
  hardened further. The bar here is "opus is not already at the ceiling on it."
- **A valid discriminator is hard *and* unambiguous — not merely hard.** Opus can
  flip-flop on a fixture for two structurally different reasons: (a) it's near its
  reasoning ceiling on a fixture with **one correct answer** — a weaker tier
  reliably does worse (a real discriminator); or (b) the fixture's **ground truth
  is genuinely contested** — even opus can't settle it, so a weaker tier's
  flip-flopping measures noise, not tier. Only (a) earns a place. Retaining (b) is
  *worse* than a false tie: `bx7k5` could read "opus 2/3, sonnet 1/3" as
  vindicating the judgment-density pillar when both tiers are merely guessing with
  different bias — a **false vindication of the incumbent on noise**, the mirror of
  the false-tie failure `bx7k5`'s decision rule already guards against, and the one
  it does *not*. Hence variance is a keep signal only *after* the ground truth is
  shown uncontested.
- **Check 8 is the ambiguity-safe discriminator; 5 / 6 / 6b are where the trap
  bites.** A runtime-probe mismatch (check 8) has **objective** ground truth — the
  *documented* body shape vs the *observed* one — so it is structurally immune to
  the contested-ground trap; harden it freely. The judgment checks (5 stale-readme /
  6 missing-adr / 6b contradicts-adr) are exactly where "genuinely borderline"
  shades into "genuinely contested," so author those with the unambiguous-ground-
  truth gate front of mind: borderline ADR-worthiness must still resolve to a
  defensible right answer, not a coin-flip.
- **Budget.** Opus-only, k ≥ 3 × the new fixtures (≈9–12 opus spawns for 3–4
  fixtures). Budget-light measurement spike; the durable artifacts are the new
  fixtures + their recorded opus baseline, not new harness code.

## Outcome

Authored 4 new fixtures under `evals/verifier-catch-rate/fixtures/` and
real-spawned the live opus-pinned `agentheim:verifier` k≥3 against each (21
total spawns: 12 scored + 3 discarded-to-a-fixture-fix + 6 scored
reconfirmation), following the existing runbook exactly. All four retained,
each with a per-fixture retention argument recorded in
`evals/verifier-catch-rate/results/2026-07-04-hardened-run.md`:

- `stale-readme-partial` (check 5, partial-not-absent README sync — `BC_README_UPDATED: yes`
  is true but only one of two relevant sections was refreshed): FAIL 3/3,
  right-reason 3/3, zero variance. Ceilings opus; retained on an explicit
  argument that a weaker tier could stop at "README was touched" without
  checking which section.
- `missing-adr-borderline` (check 6, a `PaintHistory`-cap decision narrated in
  the task's own `## Why`/`## What` rather than flagged by a code comment):
  **a genuine, reproducible opus MISS — PASS 0/6 across two independent k=3
  batches.** The first batch was contaminated by an authoring bug (the
  fixture's README inherited an irrelevant "Color... never as a raw string"
  mandate its own code violated, producing one lucky wrong-reason catch); this
  was fixed (the mandate sentence removed) and a fresh k=3 re-run PASSed
  unanimously, replicating the first batch's other 2/3 PASSes. Checked against
  this exact corpus's own `missing-adr` fixture (narrated identically in its
  own `## What`, correctly FAILed 3/3) as precedent for uncontested ground
  truth — this is the standout finding: a real, reproducible judgment-density
  gap in the current verifier, not corpus noise. Retained.
- `contradicts-adr-partial` (check 6b, ADR-0001 honored in the primary
  `paint()` path, violated only in a secondary `paintOrFallback()` method
  framed sympathetically as pipeline resilience): FAIL 3/3, right-reason 3/3
  (all three additionally flagged the sharper `ITERATION_HINT: task-under-specified`,
  still scored as a substantive check-6b catch). Ceilings opus; retained on an
  explicit argument that a shallower read stopping at "primary command honors
  the ADR" is a real risk.
- `runtime-probe-subtle-mismatch` (check 8, nested per-item field-name
  mismatch — `color` declared vs `colour` served — behind a correct top-level
  shape and, unlike the original `runtime-probe-mismatch`, a unit suite that
  genuinely drives `/widgets` over live HTTP): FAIL 3/3, right-reason 3/3,
  clean boot/probe/teardown every run. Ceilings opus; retained on an explicit
  argument, and ground truth is objectively uncontested (a textual key-name
  mismatch).

Updated `evals/verifier-catch-rate/README.md` with a new "What makes a valid
tier-discriminator" methodology note (hard AND unambiguous — never
contested; non-zero variance is a keep signal only after ground truth is
shown uncontested) plus an updated Results/Known-gaps section reflecting the
16-fixture combined corpus. Wrote
`evals/verifier-catch-rate/results/2026-07-04-hardened-run.md` (new results
file, full per-fixture table and retention-disposition table) and appended an
addendum to `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`
(extending, not replacing, the dataset of record — now 54 scored real
verifier spawns across 16 fixtures). No ADR was warranted (ADR-0036 already
governs the fixture shape; no new architectural decision was made here). No
BC README change was needed (no new ubiquitous language/aggregates/events
introduced to the real `agentic-workflow` BC — only synthetic fixture
material changed, matching the precedent set by `v3h6p`/`fq2j8`/`hz9m3`).
`bx7k5`'s `depends_on` already listed this task's id (no cross-task edit
needed); this task's `blocks: [agentic-workflow-bx7k5]` edge holds unchanged.

Key files:
- `evals/verifier-catch-rate/fixtures/stale-readme-partial/`
- `evals/verifier-catch-rate/fixtures/missing-adr-borderline/`
- `evals/verifier-catch-rate/fixtures/contradicts-adr-partial/`
- `evals/verifier-catch-rate/fixtures/runtime-probe-subtle-mismatch/`
- `evals/verifier-catch-rate/results/2026-07-04-hardened-run.md`
- `evals/verifier-catch-rate/README.md`
- `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`
