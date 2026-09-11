---
id: agentic-workflow-j4m6r
title: Pin model frontmatter on the eight agents — decorrelate the adversarial gates, cut worker-fleet cost
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: []
tags: [harness-audit, model-routing, agents, adversarial-gate, cost]
related_adrs: [ADR-0031]
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

- [x] All eight `agents/*.md` files carry a `model:` frontmatter field per the table.
- [x] An ADR records the routing policy and the decorrelation rationale (producer and its adversarial gate never share a model tier).
- [x] The research-review doctrine's "agentheim pins no model" admission is updated to reference the new policy.

## Notes

The heuristic inverts at the gates: the executor can be mid-tier precisely because
the judge is top-tier. Never weaken the judge to strengthen the executor. Use model
family names (sonnet/opus), not pinned versions, so the routing survives model
releases.

## Outcome

Added a `model:` frontmatter line to all eight agent definitions
(`agents/*.md`): `worker`, `researcher`, `orchestrator` → `sonnet`; `verifier`,
`research-reviewer`, `architect`, `strategic-modeler`, `tactical-modeler` → `opus`.
Family names, not pinned versions. This engages the model-tier decorrelation for both
adversarial gates (`worker`/`verifier`, `researcher`/`research-reviewer`) and drops the
highest-volume agent to mid-tier while the `opus` gate bounds its failure cost.

Recorded the routing + decorrelation policy in
`.agentheim/knowledge/decisions/0031-per-agent-model-routing-decorrelate-adversarial-gates.md`
(scope: global) and updated the research-review doctrine
(`skills/research-review/SKILL.md`, "Why a separate agent — and, if you can, a different
model") — its former "agentheim pins no model" admission now states the policy is engaged
and references ADR-0031.

Key files:
- `agents/{worker,researcher,orchestrator,verifier,research-reviewer,architect,strategic-modeler,tactical-modeler}.md`
- `.agentheim/knowledge/decisions/0031-per-agent-model-routing-decorrelate-adversarial-gates.md`
- `skills/research-review/SKILL.md`
