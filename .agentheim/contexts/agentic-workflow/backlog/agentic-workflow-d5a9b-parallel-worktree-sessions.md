---
id: agentic-workflow-d5a9b
title: Enable parallel worktree sessions with independent idea capture and ticket movement
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-15
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
Enable parallelization of work through multiple Claude sessions working independently on different features or components, utilizing time more efficiently while keeping the work focused and batch-coordinated.

## What
Extend the workflow to support:
- Capturing ideas directly into a worktree-local backlog in addition to the main branch backlog
- Selecting and moving multiple tickets from the main backlog into an existing worktree session to add them to that feature's roster
- Creating a new worktree with a curated subset of tickets selected from main backlog
- Work sessions operating within worktrees should automatically pick up refined tasks from the worktree-local backlog once they're promoted to todo

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `modeling` on 2026-07-15 — raw, unrefined. Needs a thorough modeling session to explore:
- The state-consistency model (how backlog split between main and worktrees affects vision/protocol/INDEX)
- The dependency-resolution story (cross-worktree and main-to-worktree dependencies)
- Whether this adds genuine parallelism or is a presentation/workflow change
- How modeling and work skills interact with worktree-local state
- Trade-offs vs. the current batch-promotion model that already parallelizes workers

Challenge the model thoroughly before refining acceptance criteria.
