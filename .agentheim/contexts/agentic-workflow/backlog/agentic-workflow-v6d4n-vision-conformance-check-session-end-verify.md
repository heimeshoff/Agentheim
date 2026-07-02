---
id: agentic-workflow-v6d4n
title: Vision-conformance check — flag in-flight work that drifts from vision success criteria / non-goals
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [harness-audit, vision, planning, three-loops, verification]
related_adrs: ["0027", "0017"]
related_research: []
prior_art: []
related_tasks: [agentic-workflow-x4t2g]
---

## Why

Split off from `agentic-workflow-x4t2g` (the whats-next read edge). Closing the
Why→What loop by having planning skills *read* the advisory (x4t2g) is the light
half; the heavier half is an actual **conformance check** — something that reads
the vision's success criteria and non-goals and *evaluates* whether in-flight or
just-completed work still serves them, then flags drift. Today nothing does this;
the vision can silently rot while work proceeds, and only a human notices. This
is the fuller version of "closing the loop" the 2026-07-02 harness audit called
for.

## What

A lightweight vision-conformance check that evaluates work against
`vision.md`'s success criteria and non-goals and **flags** (never blocks) drift.
This is a different mechanism from x4t2g: x4t2g only *reads* the advisory;
v6d4n *evaluates and reports*.

Open shape — to be settled at refine:

- **Where it runs.** Candidate homes: (a) the `verifier` gate (per-task, alongside
  acceptance-criteria audit — "does this diff pull toward or away from a stated
  non-goal?"); (b) `work`'s session-end reconciliation (per-session, over the
  batch just shipped); (c) a standalone advisory pass. Each has a different
  cost/coverage tradeoff.
- **What it emits.** An advisory flag (in the spirit of ADR-0027's advisory
  write), or a protocol note, or a surfaced escalation to the builder — but
  **never** a hard gate that fails a task or blocks a commit (non-goal:
  Agentheim is not autonomous; the human decides on drift).
- **How it judges.** Vision success-criteria / non-goals are prose; the check
  needs a cheap, non-hallucinatory way to assess conformance without turning
  every task into a vision essay.

## Acceptance criteria

- [ ] (to refine) A check exists that reads `vision.md` success criteria + non-goals and evaluates in-flight / just-shipped work against them.
- [ ] (to refine) It **flags/surfaces** drift; it never hard-blocks a task, commit, or session (human-in-the-loop non-goal holds).
- [ ] (to refine) Its home (verifier vs work session-end vs standalone) is decided and justified.

## Notes

- Sibling of `agentic-workflow-x4t2g` (whats-next read edge); independent — v6d4n
  reads `vision.md` directly, not the advisory, so no `depends_on` edge.
- Under-refined by design: the mechanism, home, and output are open questions for
  a REFINE pass. Filed to `backlog/`.
- Likely warrants an ADR if it lands in the `verifier` gate (that gate's contract
  is otherwise "acceptance criteria + tests", and adding a vision lens widens it).
