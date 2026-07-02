---
id: agentic-workflow-j4m6r
title: Pin model frontmatter on the eight agents — decorrelate the adversarial gates, cut worker-fleet cost
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, model-routing, agents, adversarial-gate, cost]
related_adrs: []
related_research: []
prior_art: []
---

## Why

No agent has a `model:` field — all eight inherit the session model. Two costs:

1. **Correctness:** the research-review doctrine names "same model for both" an
   anti-pattern ("shared training memory means shared confabulations") and calls
   model decorrelation the primary defense — yet by default `worker`/`verifier`
   and `researcher`/`research-reviewer` share a model. The adversarial gates are
   structurally fresh-context but statistically correlated.
2. **Cost:** the worker is the highest-volume agent (up to 3 parallel + re-dispatches),
   running frontier rates for refined, gate-bounded execution work.

(Harness audit 2026-07-02, Phase 3; independently reached by the Opus audit as its
single highest-leverage change.)

## What

Add one `model:` frontmatter line per agent file, per the audit routing table:

| Agent | Model | Rationale |
|---|---|---|
| `worker` | sonnet | High volume; tasks arrive refined with pre-loaded context; verifier bounds failure cost |
| `researcher` | sonnet | Retrieval + synthesis, gated downstream; speed matters |
| `orchestrator` | sonnet | Routing table is heuristic lookup; aggregation needs competence, not frontier reasoning |
| `verifier` | opus | Judgment-dense gate; false PASS compounds; decorrelated from sonnet worker |
| `research-reviewer` | opus | Same decorrelation logic, stated explicitly in the doctrine |
| `architect` | opus | Low frequency, decisions constrain everything downstream |
| `strategic-modeler` | opus | Boundary mistakes are the most expensive, hardest-to-undo error class |
| `tactical-modeler` | opus | Invariant/aggregate design rewards depth; call rate too low for savings to matter |

## Acceptance criteria

- [ ] All eight `agents/*.md` files carry a `model:` frontmatter field per the table.
- [ ] An ADR records the routing policy and the decorrelation rationale (producer and its adversarial gate never share a model tier).
- [ ] The research-review doctrine's "agentheim pins no model" admission is updated to reference the new policy.

## Notes

The heuristic inverts at the gates: the executor can be mid-tier precisely because
the judge is top-tier. Never weaken the judge to strengthen the executor. Use model
family names (sonnet/opus), not pinned versions, so the routing survives model
releases.
