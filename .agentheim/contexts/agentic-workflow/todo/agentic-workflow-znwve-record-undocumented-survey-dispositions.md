---
id: agentic-workflow-znwve
title: Record the two undocumented survey dispositions — mid-batch checkpoint (decide) and Haiku thin-agent wrapper (decline)
status: todo
type: decision
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [audit-2026-07-22-followup, survey-coverage]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-j7d4k, agentic-workflow-p3v9k]
---

## Why

The 2026-07-22 coverage audit found every item from the 2026-07-02 harness survey either
landed or declined-with-rationale — except two with no recorded disposition at all:

1. **Mid-batch human checkpoint (Opus gap 6):** a long healthy `work` batch runs
   uninterruptible end-to-end. Neither implemented nor declined anywhere. Existing
   mitigations are real (between-wave re-scan, FAIL escalates at iteration 3, vacuum guard
   on empty board), but nobody ever wrote down "that's fine."
2. **Haiku thin-agent wrapper** for quick-capture/whats-next/inquire: declined inside the
   audit document itself ("Not worth restructuring into an agent just to save pennies") but
   never recorded as a decision — inconsistent with the repo's own convention that declined
   directions get a decision record (cf. ADR-0059's visible-decision principle).

## What

Work the decision: (1) decide the mid-batch checkpoint — implement or decline, weighing the
existing mitigations — and record an ADR either way; (2) record the Haiku-wrapper decline as
an ADR with the audit's rationale. One combined ADR is acceptable if the shape fits (two
survey dispositions, one record); otherwise two. Update the knowledge index.

## Acceptance criteria

- [ ] An accepted ADR exists recording the mid-batch-checkpoint disposition (implement or
      decline, with rationale referencing the existing mitigations).
- [ ] An accepted ADR (same or separate) records the Haiku thin-agent-wrapper decline.
- [ ] `.agentheim/knowledge/index.md` lists the new ADR(s).
