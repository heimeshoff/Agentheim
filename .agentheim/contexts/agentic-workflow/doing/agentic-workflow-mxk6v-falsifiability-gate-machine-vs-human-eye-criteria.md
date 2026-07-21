---
id: agentic-workflow-mxk6v
title: Falsifiability gate — classify acceptance criteria machine-checkable vs human-eye; verifier escalates on metric drift
status: doing
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [doctrine, refinement, verifier, dorc-review]
related_adrs: [0036]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-q7x2k, agentic-workflow-j7d4k]
---

## Why

The single worst burn in the Dorc July-2026 review (recommendation A1): a *perceptual*
acceptance claim ("the slot visibly shows the captured frame") was allowed to become a
machine-checked pixel metric at refinement. Workers then iterated on the metric, not the
product — "three worker iterations each produced a metric tuned to pass" — across a
6-task chain, and the feature still didn't work for the player. The verifier had no
signal that metric-tuning was happening.

## What

Two coupled doctrine changes:

1. **Refinement classifies every acceptance criterion** as **machine-checkable** or
   **human-eye**. Human-eye criteria are marked as such in the task file and route to a
   builder-checks-by-eye step at completion — the verifier never invents a proxy metric
   for them.
2. **The verifier treats metric drift as escalation fuel, not iteration fuel**: if the
   measurement/proxy changed between verification iterations while the claim it checks
   did not, escalate immediately instead of granting another iteration.

## Acceptance criteria

- [ ] `skills/modeling/SKILL.md` (REFINE flow + PROMOTE readiness check): every acceptance
      criterion is classified machine-checkable or human-eye; human-eye criteria carry an
      explicit marker in the task file (convention documented).
- [ ] PROMOTE readiness accepts tasks with human-eye criteria (they are not a blocker),
      but a task whose criteria are *all* human-eye promotes with a note that verification
      is builder-eye only.
- [ ] `skills/verification-before-completion/SKILL.md` + `agents/verifier.md`: human-eye
      criteria are never proxied by an invented metric; the verifier reports them as
      "builder eye-check pending", neither PASSed nor FAILed on a machine proxy.
- [ ] Verifier doctrine: "metric/proxy changed between iterations, claim unchanged" is an
      immediate escalation signal.
- [ ] An ADR records the doctrine and its rationale.

## Notes

Source: Dorc agent-time review 2026-07 (untracked file in `C:\src\jump_n_rogue\dorc`),
recommendation A1 (first half; the salvage half is [[agentic-workflow-hvqa4]]).
Evidence summarized above so this task stands alone. Prior art: the verifier eval harness
(v3h6p and successors) can gain a fixture for the metric-drift escalation once doctrine
lands.
