---
id: agentic-workflow-b8x2v
title: Work protocol entries carry Duration and verification Iterations
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, observability, protocol, work-skill, cost]
related_adrs: ["0026"]
related_research: []
prior_art: []
---

## Why

Nothing in the harness records wall time, verify-iteration counts, or any cost
signal. You cannot answer "what does a work batch cost" or "is the verifier
earning its spend." The protocol entries are written anyway — carrying these
fields is near-free observability. (Harness audit 2026-07-02, gap table +
recommendation #5.)

## What

Extend the `work/SKILL.md` protocol-entry templates:

- Task-completion entry: add **Duration** (wall time from dispatch to verdict)
  and keep **Verification: PASS (iteration N)** — make the iteration count
  mandatory, not incidental.
- Session-end entry: add total batch **Duration** and a per-task
  dispatch/re-dispatch tally.
- If the harness exposes token counts to the orchestrating session, include
  them; if not, note that explicitly rather than fabricating.

## Acceptance criteria

- [ ] `work/SKILL.md` protocol templates include Duration on task-completion and session-end entries.
- [ ] Verification iteration count is a required field on task-completion entries.
- [ ] No fabricated metrics: fields the session cannot actually measure are omitted from the template, not guessed.

## Notes

This is the observability floor. The fuller structures — machine-readable runs
JSONL, live status — are separate backlog tasks (protocol rotation
agentic-workflow-r2c7m, live hooks agentic-workflow-m9w5c). Fan-out caps
(agentic-workflow-z2f7s) want this data to exist first.
