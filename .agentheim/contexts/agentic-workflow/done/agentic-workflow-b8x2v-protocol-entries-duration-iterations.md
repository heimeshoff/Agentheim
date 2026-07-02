---
id: agentic-workflow-b8x2v
title: Work protocol entries carry Duration and verification Iterations
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
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

## Outcome

Extended the protocol-entry templates in `skills/work/SKILL.md`:

- **Task-completion entry** (both the verified and the verification-skipped
  variants) now carries a `**Duration:**` field — wall time from that worker's
  dispatch to its verdict/return, measured against the orchestrator's own clock
  (no harness support required).
- The `**Verification:** PASS (iteration N)` line is now explicitly marked
  **mandatory** — an inline `<!-- iteration N is REQUIRED -->` guard on the
  template plus a prose rule in the new "Observability fields" note.
- **Session-end entry** now carries a total `**Duration:**` (first "Batch
  started" to session end) and a `**Dispatches:**` per-task dispatch/re-dispatch
  tally (`<task-id>: D` where D = 1 + re-dispatch count).
- Added an **"Observability fields — measure, never fabricate"** subsection to
  the Protocol logging section that (a) tells the orchestrator how to measure
  Duration and the tally from data it already holds, and (b) **explicitly
  declines token/dollar cost** — the session has no programmatic access to token
  counts, so those are omitted on purpose rather than guessed, with a hook to
  add a `**Tokens:**` line if a future harness exposes real counts. This honors
  the "no fabricated metrics" acceptance criterion.

Key file: `skills/work/SKILL.md` (Protocol logging section + End-of-run
reporting session-end template).
