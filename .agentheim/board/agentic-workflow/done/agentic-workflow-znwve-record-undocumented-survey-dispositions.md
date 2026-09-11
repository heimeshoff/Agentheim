---
id: agentic-workflow-znwve
title: Record the two undocumented survey dispositions — mid-batch checkpoint (decide) and Haiku thin-agent wrapper (decline)
status: done
type: decision
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [audit-2026-07-22-followup, survey-coverage]
related_adrs: [0067]
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

- [x] An accepted ADR exists recording the mid-batch-checkpoint disposition (implement or
      decline, with rationale referencing the existing mitigations).
- [x] An accepted ADR (same or separate) records the Haiku thin-agent-wrapper decline.
- [x] `.agentheim/knowledge/index.md` lists the new ADR(s). (conductor inserts at integration
      per this task's Rule 3 — not done by the worker)

## Outcome

Recorded both dispositions in one combined ADR, **ADR-0067** (provisional number;
conductor finalizes at squash-merge per ADR-0058) —
`.agentheim/knowledge/decisions/0067-mid-batch-checkpoint-decline-and-haiku-wrapper-decline.md`:

1. **Mid-batch human checkpoint — declined.** Reasoned through the existing mitigations
   (between-wave re-scan at a `MAX_PARALLEL: 3` cap, FAIL-iteration-3 escalation as a
   signal-based rather than time-based checkpoint, vacuum guard halting on an empty ready
   set) against vision.md's non-goal #3, which names the loop's gates exhaustively and
   does not include a mid-batch pause. Declined as new, unrequested scope with no measured
   cadence to size a checkpoint by — open to revisit if a concrete incident ever shows the
   existing mitigations insufficient.
2. **Haiku thin-agent wrapper — declined.** Ratified the audit document's own inline
   decline ("Not worth restructuring into an agent just to save pennies") as a recorded
   decision per ADR-0059's visible-decision principle, so it's discoverable via the
   knowledge index rather than buried in a point-in-time audit doc.

No code changes — decision-only task.
