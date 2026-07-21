---
id: agentic-workflow-rx630
title: Dispatch ordering — a known-cheap remediation outranks further diagnosis; spikes carry a stop-loss
status: todo
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [work, dispatch, spike, doctrine, dorc-review]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Dorc review recommendation A5: three diagnosis spikes on the same defect family were
completed while the already-diagnosed, cheap root-cause remediation sat in backlog. One
spike pinned exactly which node caused the symptom — then applied the workaround it
would have applied without the diagnosis. Diagnosis kept outrunning the fix because
nothing in dispatch ordering preferred fixing.

## What

1. **Dispatch ordering**: when `work` scans the ready set, a remediation task whose root
   cause is already diagnosed and whose fix is cheap outranks further diagnosis
   spikes on the same thread (same defect family / shared tags / linked tasks).
2. **Spike stop-loss**: spike doctrine gains a standing clause — "if, mid-spike, the
   mitigation is already known and cheap, record it and stop." The worker ends the spike
   early with the recorded mitigation instead of completing the full diagnosis.

## Acceptance criteria

- [ ] `skills/work/SKILL.md` (scan/dispatch): the remediation-over-diagnosis preference
      is part of dispatch ordering, with the "same thread" linkage defined (tags,
      `depends_on`/`blocks`, or prior-art links).
- [ ] Spike doctrine (task format notes in `skills/modeling/SKILL.md` and/or the worker's
      execution doctrine): every `type: spike` task carries the stop-loss clause; a
      stopped-early spike is a legitimate completion, recorded as such.
- [ ] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A5. Keep the preference a
*dispatch ordering* rule, not a gate — a builder explicitly asking for deeper diagnosis
still gets it.
