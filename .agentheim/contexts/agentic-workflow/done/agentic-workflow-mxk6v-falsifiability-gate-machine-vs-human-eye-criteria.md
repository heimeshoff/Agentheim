---
id: agentic-workflow-mxk6v
title: Falsifiability gate — classify acceptance criteria machine-checkable vs human-eye; verifier escalates on metric drift
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [doctrine, refinement, verifier, dorc-review]
related_adrs: [0036, 0061]
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

- [x] `skills/modeling/SKILL.md` (REFINE flow + PROMOTE readiness check): every acceptance
      criterion is classified machine-checkable or human-eye; human-eye criteria carry an
      explicit marker in the task file (convention documented).
- [x] PROMOTE readiness accepts tasks with human-eye criteria (they are not a blocker),
      but a task whose criteria are *all* human-eye promotes with a note that verification
      is builder-eye only.
- [x] `skills/verification-before-completion/SKILL.md` + `agents/verifier.md`: human-eye
      criteria are never proxied by an invented metric; the verifier reports them as
      "builder eye-check pending", neither PASSed nor FAILed on a machine proxy.
- [x] Verifier doctrine: "metric/proxy changed between iterations, claim unchanged" is an
      immediate escalation signal.
- [x] An ADR records the doctrine and its rationale.

## Notes

Source: Dorc agent-time review 2026-07 (untracked file in `C:\src\jump_n_rogue\dorc`),
recommendation A1 (first half; the salvage half is [[agentic-workflow-hvqa4]]).
Evidence summarized above so this task stands alone. Prior art: the verifier eval harness
(v3h6p and successors) can gain a fixture for the metric-drift escalation once doctrine
lands.

Related ADR: ADR-0061.

## Outcome

Two coupled doctrine changes landed, per ADR-0061:

1. **Classification.** `skills/modeling/SKILL.md` now classifies every acceptance criterion at
   CAPTURE/REFINE time as machine-checkable (default) or `[human-eye]` (explicit marker) — see
   the new "Classifying acceptance criteria" subsection, CAPTURE step 4, REFINE step 3
   interrogation bullet, and PROMOTE readiness step 2 + new step 2b (the all-human-eye
   builder-eye-only `## Notes` line requirement). A `[human-eye]` bullet's checkbox stays
   unchecked through `done/` as the routing signal to the builder's own eye-check.
2. **Verifier never proxies.** `agents/verifier.md` check 1 (mirrored in `skills/
   verification-before-completion/SKILL.md`) reports a `[human-eye]` criterion "builder
   eye-check pending" in PASS EVIDENCE — never a hunted test, never an invented metric.
3. **Metric drift → escalation, not iteration fuel.** New verifier check 1b: on iteration 2/3,
   if a criterion's text is unchanged but its measurement/proxy drifted since the prior
   `## Verifier note`, the verifier FAILs with `ITERATION_HINT: task-under-specified` — reusing
   `work`'s already-shipped immediate-escalation handling for that hint (no `skills/work/
   SKILL.md` edit needed or made).

**Mechanize-or-drop (ADR-0059) self-compliance, explicit per-piece:** the marker + all-human-eye
note requirement ships real enforcement — `lib/human-eye-criteria.mjs` (`lib/test/
human-eye-criteria.test.mjs`, 16 tests, includes a live-tree gate mirroring `lib/id-grammar.mjs`
/ `lib/index-entry-length.mjs`). The metric-drift check and the "is this criterion genuinely
human-eye" classification call are judgment-embedded prompt checks, not a lint — mirroring
ADR-0059's own check 6c, since both predicates require reading intent/meaning a script cannot
approximate. Full suite: `node --test lib/test/*.test.mjs` — 263 passing, 0 failing.

Key files: `skills/modeling/SKILL.md`, `skills/verification-before-completion/SKILL.md`,
`agents/verifier.md`, `lib/human-eye-criteria.mjs`, `lib/test/human-eye-criteria.test.mjs`,
`.agentheim/knowledge/decisions/0061-falsifiability-gate-machine-vs-human-eye-criteria.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
