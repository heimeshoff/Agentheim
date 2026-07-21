---
id: agentic-workflow-hvqa4
title: Escalation salvages the worktree diff — attach a patch before any abandonment discards work
status: doing
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [work, worktree, escalation, dorc-review]
related_adrs: [0032]
related_research: []
prior_art: [agentic-workflow-f6m2q, agentic-workflow-d6q4h]
---

## Why

Dorc review recommendation A1 (second half): when a task was abandoned at verification
iteration 3, the escalation path **discarded verified fixes with the worktree** — the
real z-order fixes had been found and confirmed working, then deleted along with the
`aw/<id>` branch. The builder had to re-derive work the system had already done.

## What

Any `work` path that abandons a worker's worktree with uncommitted changes — escalation
after the verification-iteration cap, a bounce, a skip — must first salvage the diff:
capture the worktree's changes as a patch, attach/reference it from the task's Notes,
and only then remove the worktree.

## Acceptance criteria

- [ ] `skills/work/SKILL.md`: every abandonment path (post-FAIL escalation, bounce,
      skip-with-changes) salvages the worktree diff before worktree removal.
- [ ] The patch's storage convention is decided and documented (location, naming,
      lifecycle — e.g. alongside the task file or under a salvage folder), recorded in an
      ADR or the task-format reference.
- [ ] The escalation message to the builder names the salvaged patch so it is visible,
      not just stored.
- [ ] If a helper lands in `lib/`, it is git-free (ADR-0038 three-layer boundary) and has
      `node --test` coverage.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A1. Sibling of
[[agentic-workflow-mxk6v]] (the refinement-side half); independent mechanism, no
dependency between them. ADR-0032 defines the worktree model this hooks into;
d6q4h's session-end carry-over reconciliation is the closest existing pattern.
