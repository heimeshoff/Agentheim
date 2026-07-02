---
id: agentic-workflow-z2f7s
title: Fan-out caps — MAX_PARALLEL as a knob, research cap, global nested-spawn ceiling
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, concurrency, cost, work-skill, research-skill, orchestrator]
related_adrs: []
related_research: []
prior_art: []
---

## Why

All three fan-out surfaces are magic or unbounded: `work` caps at a bare
`MAX_PARALLEL = 3` (no rationale, no documented knob), `research` fan-out is
entirely uncapped ("spawn multiple researcher agents rather than serializing"),
and the nested worker→orchestrator→specialist chain has no global ceiling — up
to 3 workers × an orchestrator × 2–4 specialists, and a FAIL re-dispatch re-runs
the whole chain. Nothing tracks or caps cumulative spend. (Harness audit
2026-07-02, ⊕ finding from the Opus cross-check.)

## What

- Document `MAX_PARALLEL` as a user-settable knob with its rationale.
- Give `research` a default fan-out cap (override by explicit user ask).
- Add a global ceiling on nested spawns per batch, with a stated behavior when
  hit (serialize, not silently drop).

## Acceptance criteria

- [ ] `MAX_PARALLEL` is documented, user-settable, and carries a rationale.
- [ ] `research` has a stated default cap on parallel researchers.
- [ ] A per-batch nested-spawn ceiling exists with defined at-ceiling behavior.
- [ ] Caps that trigger are surfaced in the protocol entry — silent truncation is not allowed.

## Notes

Wants the duration/iteration observability (agentic-workflow-b8x2v) to exist
first, so cap values are informed rather than invented. Related structural
alternative: flattening single-specialist consultations
(agentic-workflow-n6r8j) shrinks the chain the ceiling guards.
