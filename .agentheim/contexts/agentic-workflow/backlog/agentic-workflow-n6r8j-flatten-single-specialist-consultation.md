---
id: agentic-workflow-n6r8j
title: Flatten single-specialist consultations — worker spawns the specialist directly
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, orchestrator, worker, consultation, cost]
related_adrs: []
related_research: []
prior_art: []
---

## Why

The worker→orchestrator→specialist consultation path is three contexts deep,
and each hop re-reads vision/context-map/README. For the common
single-specialist question ("does this need an ACL?") the orchestrator adds a
full agent context that contributes only routing — a heuristic lookup the
worker can do itself. The orchestrator earns its keep only when multiple
specialists must be aggregated and conflicts surfaced. (Harness audit
2026-07-02, Phase 3 recommendation b.)

## What

Let the worker spawn the needed specialist (`architect`, `tactical-modeler`, …)
directly for single-specialist questions, keeping the orchestrator agent for
multi-specialist aggregation (primarily `modeling` REFINE). Update
`agents/worker.md`'s consultation guidance and the orchestrator's description
to state the split.

## Acceptance criteria

- [ ] `agents/worker.md` instructs direct specialist consultation for single-specialist questions, with a simple routing hint (which specialist for which question class).
- [ ] The orchestrator remains the path when the question spans specialists or needs conflict surfacing.
- [ ] Consultation context passed to the specialist is the same pre-loaded block quality the orchestrator would have assembled — flattening must not degrade what the specialist sees.

## Notes

Shrinks the nested-spawn chain that the fan-out ceiling (agentic-workflow-z2f7s)
guards. Sequence freely; naming cleanup (agentic-workflow-h3z5b) touches the
same files — consider one refinement session for both.
