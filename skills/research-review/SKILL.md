---
name: research-review
description: Use whenever the `research` skill is about to ship a researcher's report — between the researcher's return and the report being treated as citable knowledge. Triggers internally from `research`'s post-write gate. Spawns the `research-reviewer` agent with fresh context (no exposure to the researcher's reasoning) to re-verify the report's decision-critical checkable claims against primary sources and either PASS, FAIL with re-dispatch, or label the survivors unverified. Doctrine document; the operational steps live in `research`'s flow.
---

# Research Review — The Fresh-Eyes Claim Gate

The researcher just wrote a report. Trust nothing yet. A report reads as authoritative whether or not its claims were checked — the fluency of a generated answer *is* the hazard. "Sonnet 4.7", "$0.40 / M tokens", "the `:stable` tag", "the flag defaults to off" all read exactly like verified facts. This skill is the structural answer: a separate agent, fresh context, **with web access**, re-verifying the decision-critical claims against their sources of truth as if seeing the report for the first time.

This gate enforces, structurally, a rule the researcher's own quality bar already states — *"Every claim cites its source. No exceptions, even for things you 'know'."* That rule was aspirational: nothing failed a report for breaking it. The gate makes it load-bearing.

## What problem this solves

The researcher fails in one distinctive, domain-independent way that its own self-checks rarely catch: **it asserts a checkable fact it never checked.** The claim is plausible because it is generated from training memory or a single source that sounded right — and it wears the clothes of verified knowledge. Real instances, across unrelated topics:

- A **model version that does not exist** ("Sonnet 4.7") — plausible because version numbers increment.
- **Fantasy prices** for a cloud offering — in the right ballpark, never checked against the pricing page.
- A **registry tag that isn't published** (`...:stable`) — a downstream deploy died on `pull`.
- An **env var's default stated backwards** — never checked against the reference docs.

The thread is not "deploy" or any single domain. It is: *a checkable claim treated as settled without checking the source of truth.* The reviewer catches it because it reads only the report and the question — it has no investment in the report's conclusions — and because it re-runs the verification itself rather than trusting the report's citation.

## Why a separate agent — and, if you can, a different model

If `research` ran the checks inline, it would do so in the same context that just produced the report and is leaning toward shipping it. That context shares the researcher's blind spots. A separately spawned agent reads only what it's handed and produces a verdict without that momentum. This fresh-context separation is the **load-bearing** property; do not collapse it into a function call or a same-context self-review.

There is a second lever: the model. Researcher and reviewer on the *same* model share training-memory confabulations — if a model "knows" a version that doesn't exist, a second instance of it may wave the claim through. Running the reviewer on a **different** (or more skeptical) model decorrelates those blind spots. agentheim now **acts on this**: per **ADR-0031** the producer/gate model-routing policy pins `researcher` to `sonnet` and its adversarial gate `research-reviewer` to `opus`, so the report is produced and re-verified on decorrelated model tiers by default (mirroring the `worker` (sonnet) / `verifier` (opus) split). The primary defense remains the reviewer's independent web re-verification, which catches most hallucinations regardless of model; the model split is the cheap second layer beneath it. The `model:` frontmatter is a family name (sonnet/opus), not a pinned version, so the policy stays provider-agnostic and survives model releases.

## What the reviewer is given

The `research` skill spawns `research-reviewer` with:

- The absolute path to the report
- The original question (this frames which claims are *decision-critical*)
- The iteration number (1, 2, or 3)

The reviewer is explicitly NOT given:

- The researcher's reasoning, scratchpad, or search history
- The sources it considered and discarded
- Prior review attempts on the same report (each review is independent)

## What the reviewer checks

The full checklist lives in `agents/research-reviewer.md`. In short:

1. **Inventory the checkable claims** — hunting first at the notorious hallucination sites: version names / release numbers, prices / quotas / limits, product / package / image names + tags, API surface (flags, defaults, endpoints, signatures), dates & currency, hard benchmarks.
2. **Re-verify the decision-critical ones** against a PRIMARY source via its own WebSearch/WebFetch — not by trusting the report's adjacent citation. Each claim resolves to verified / contradicted / uncited / stale / unverifiable.
3. **Judgment framing** — synthesis and opinion need no citation but must read as opinion, not as measured fact.

A report passes when every decision-critical checkable claim is either verified or honestly labeled unverifiable. PASS does not require omniscience — it requires that nothing decision-critical is *asserted as fact when it is only model-memory, vendor-claim, or single-source.*

## Verdicts

The reviewer returns one of three. Strict format — `research` parses these deterministically.

### `VERDICT: PASS`

The report is citable. `research` ships it (updates indexes, logs the protocol entry).

### `VERDICT: FAIL`

The report is not yet citable. It lists each `CHALLENGED_CLAIM` with the `PRIMARY_SOURCE` it must be checked against and a `FINDING` (contradicted / uncited / stale / opinion-as-fact). `research` re-dispatches the researcher with that list.

### `VERDICT: SKIP`

Rare. The report makes no checkable claims at all (pure synthesis of the reader's own context). `research` ships it and logs the skip.

## Terminal state — label, don't block forever

Code is binary: a diff is committable or it isn't. Research is not. A report will sometimes carry a claim **no primary source can settle** — an unreleased price, a private roadmap, a genuinely contested fact. The gate must not loop on these forever, and must not silently pass them either.

So the loop is capped (max 3 iterations, mirroring `work`'s verifier cap), and the terminal state is **explicit labeling, not blocking:**

- On `FAIL` with `ITERATION_HINT: likely-fixable`, iterations 1–2 → re-dispatch the researcher with the challenged-claims list to re-verify and correct.
- At the iteration cap (or on `ITERATION_HINT: genuinely-unverifiable`), surviving unverified claims are **marked in the report** — inline `⚠️ UNVERIFIED` next to each, plus an `## Unverified claims` subsection collecting them — and the report ships. Never silently passed; never infinitely looped.

The reviewer's real job is not to make every claim true. It is to ensure nothing decision-critical is asserted as fact when it is only model-memory, vendor-claim, or single-source — and that what genuinely can't be verified is *visibly flagged* so the reader weights it accordingly.

The operational integration — when to spawn, how to re-dispatch, how the labeling is applied — lives in `skills/research/SKILL.md`.

## Anti-patterns

- **Reviewing with the researcher's own context.** Defeats the point. The fresh-eyes property is the value.
- **Same model for both.** Shared training memory means shared confabulations. The model split is deliberate decorrelation.
- **Trusting the report's citation instead of opening it.** The citation may be misread, stale, or point at a blog quoting a hallucination. Re-verify against the primary source.
- **Letting the reviewer edit the report.** It has no Write/Edit tools. If it could fix, it would lose the auditor role and re-acquire the author's blind spots.
- **Treating FAIL as a researcher failure.** It isn't — FAIL means "these claims aren't checked yet." Both agents did their job.
- **Stripping unverifiable claims instead of labeling them.** Deleting hides the uncertainty; labeling surfaces it. The reader needs to know what's load-bearing.
- **Skipping the gate on "small" research.** Small reports are where a single false claim hides easiest. Don't optimize the cheapest check away.

## Why external-only, for now

This gate is added as a **single variable.** The researcher's own self-discipline prose (its `## Quality bar`, the "cite everything, even what you know" line) stays untouched, so the gate's isolated effect on research quality can be observed in real use before deciding whether the researcher prompt itself also needs tightening. Hardening the researcher's prompt is a deliberate future follow-up, contingent on what the gate alone achieves.
