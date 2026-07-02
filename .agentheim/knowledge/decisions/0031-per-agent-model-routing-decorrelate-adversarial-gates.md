---
id: ADR-0031
title: Per-agent model routing — decorrelate the adversarial gates, run the executor fleet mid-tier
scope: global
status: accepted
date: 2026-07-02
related_tasks: [agentic-workflow-j4m6r]
related_adrs: []
---

# ADR-0031: Per-agent model routing — decorrelate the adversarial gates, run the executor fleet mid-tier

## Context

Until now no agent definition carried a `model:` field — all eight agents
(`worker`, `researcher`, `orchestrator`, `verifier`, `research-reviewer`,
`architect`, `strategic-modeler`, `tactical-modeler`) inherited whatever model the
session ran on. That default has two costs, one about correctness and one about spend.

1. **The adversarial gates were correlated.** Agentheim runs two producer→gate pairs
   whose whole value is fresh-eyes independence: `worker`→`verifier` (the work skill's
   post-success gate) and `researcher`→`research-reviewer` (the research skill's
   post-write gate). Both are structurally decorrelated — the gate is a separately
   spawned agent that reads only what it is handed, never the producer's reasoning
   trail. But structural freshness is not statistical freshness: a producer and its
   gate running on the **same** model share training-memory confabulations. If a model
   "knows" a library version that does not exist, a second instance of the same model
   may wave that claim through. The research-review doctrine already named "same model
   for both" the weaker-but-real anti-pattern and called model decorrelation the cheap
   second layer beneath the reviewer's independent web re-verification — yet by default
   the pairs shared a model, so the second layer was never actually engaged.

2. **The highest-volume agent ran at frontier rates.** `worker` is the busiest agent
   in the system: up to three run in parallel per batch, plus re-dispatches when the
   verifier bounces. Its tasks arrive **refined**, with pre-loaded ADRs, prior art, and
   BC context, and its failure cost is bounded downstream by the verifier gate. Paying
   frontier per-token rates for gate-bounded execution work against already-refined
   tasks is the single largest avoidable cost in a `work` batch.

This was independently reached as the highest-leverage change by the harness self-audit
(2026-07-02, Phase 3) and by the Opus audit pass.

## Decision

**Each of the eight agents carries an explicit `model:` frontmatter field, routed by a
single heuristic: the executor/producer tier runs mid-tier (`sonnet`); the judgment-dense
gates and the constraint-setting specialists run top-tier (`opus`). The producer of an
adversarial pair and its gate never share a model tier.**

| Agent | Model | Rationale |
|---|---|---|
| `worker` | `sonnet` | Highest volume (up to 3 parallel + re-dispatch); tasks arrive refined with pre-loaded context; the verifier gate bounds failure cost. |
| `researcher` | `sonnet` | Retrieval + synthesis, gated downstream by the reviewer; speed matters. |
| `orchestrator` | `sonnet` | Routing is heuristic lookup; result aggregation needs competence, not frontier reasoning. |
| `verifier` | `opus` | Judgment-dense gate; a false PASS compounds; decorrelated from the `sonnet` worker it audits. |
| `research-reviewer` | `opus` | Same decorrelation logic, now engaged: it audits a `sonnet` researcher's report on a different tier. |
| `architect` | `opus` | Low frequency; its decisions constrain everything downstream. |
| `strategic-modeler` | `opus` | Boundary mistakes are the most expensive, hardest-to-undo error class. |
| `tactical-modeler` | `opus` | Invariant/aggregate design rewards depth; call rate is too low for any saving to matter. |

### The heuristic and where it inverts

The default lever is volume-and-boundedness: an agent that runs often and whose output
is gated can run mid-tier. **At the gates the heuristic inverts** — the executor can be
mid-tier *precisely because* the judge is top-tier. The `sonnet` worker is affordable
only because an `opus` verifier stands behind it; the `sonnet` researcher only because an
`opus` reviewer re-verifies it. This yields the decorrelation for free: every
producer→gate pair now spans two tiers.

**The load-bearing rule: never weaken the judge to strengthen the executor.** The saving
comes from the high-volume producer side, not the gate. Downgrading a gate to `sonnet`
to "match" its producer would re-correlate the pair and defeat the whole decision.

### Family names, not pinned versions

The `model:` value is a model **family name** (`sonnet` / `opus`), never a pinned point
release. The routing must survive model releases without an edit sweep across eight files,
and the policy is about *tier and decorrelation*, not a specific checkpoint.

## Consequences

**Positive**

- Both adversarial gates are now statistically decorrelated, not just structurally fresh
  — the model-tier layer the doctrine described is finally engaged for `worker`/`verifier`
  and `researcher`/`research-reviewer`.
- The highest-volume agent (`worker`, up to 3 parallel + re-dispatch) runs mid-tier,
  cutting the dominant cost line of a `work` batch, with the `opus` verifier bounding the
  correctness risk of the downgrade.
- Model routing is explicit and greppable — one `model:` line per agent file — rather than
  an invisible session-inherited default.

**Negative**

- Eight files now carry a routing assumption that must stay coherent: any future new
  producer→gate pair must respect the never-share-a-tier rule, and any agent added to the
  fleet needs a deliberate tier choice rather than silent inheritance.
- The `sonnet` worker will occasionally produce weaker first-pass work that the `opus`
  verifier bounces, spending a re-dispatch. This is the intended trade — bounded rework at
  mid-tier rates versus every first pass at frontier rates — but it is a real cost on the
  tasks that bounce.

**Neutral**

- Nothing about the fresh-context spawn boundary changes; the gates were already separate
  agents. This decision only assigns the tier they run on.
- `orchestrator` on `sonnet` is a judgment call sized to its actual work (routing +
  aggregation); if aggregation quality regresses it can be promoted without disturbing the
  gate-decorrelation invariant, since the orchestrator is not one side of an adversarial
  pair.

## Alternatives considered

- **Leave every agent on the session-inherited model (the status quo).** Rejected: it
  leaves the adversarial gates correlated and pays frontier rates for the highest-volume,
  gate-bounded agent — the two costs this decision exists to remove.
- **Run the entire fleet on `opus` for maximum quality.** Rejected: it maximizes spend on
  exactly the high-volume, already-refined, gate-bounded work where frontier reasoning buys
  least, and it re-correlates both gates onto a single model.
- **Run the entire fleet on `sonnet` for maximum saving.** Rejected: it re-correlates the
  gates (defeating the decorrelation goal) and puts mid-tier reasoning on the
  constraint-setting specialists (`strategic-modeler`, `architect`) whose mistakes are the
  most expensive and hardest to undo.
- **Pin exact model versions instead of family names.** Rejected: it would force an
  eight-file edit sweep on every model release for no benefit — the policy is about tier
  and decorrelation, which family names express precisely.
- **Downgrade the gates to match their producers.** Rejected outright — it violates the
  load-bearing "never weaken the judge to strengthen the executor" rule and re-correlates
  the pairs.
