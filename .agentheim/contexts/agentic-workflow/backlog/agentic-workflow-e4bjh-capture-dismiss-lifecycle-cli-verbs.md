---
id: agentic-workflow-e4bjh
title: Finish the bookkeeping mechanization — capture and dismiss verbs on the lifecycle CLI
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [captured, audit-2026-07-22-followup, mechanization]
related_adrs: [0038, 0042, 0022]
related_research: []
prior_art: [agentic-workflow-k5n8f, agentic-workflow-t7m4c]
---

## Why

ADR-0038's mechanization stopped at promote/claim/complete/checkpoint. The capture and
dismiss paths — `modeling` CAPTURE/DISMISS, `quick-capture`, `brainstorm`'s task minting —
still hand-edit `INDEX.md` marker lists, counts, and `protocol.md`, even though ADR-0038
declares that bookkeeping prose superseded. This is the last remaining
LLM-text-surgery-on-derived-state surface, and the 2026-07-22 coverage audit flagged it as
the substantive tail of the survey's highest-leverage change.

## What

Add `capture` and `dismiss` verbs to `lib/task-lifecycle-cli.mjs` (task-file write / cascade
delete + INDEX edit + count delta + protocol entry, returning the enumerated manifest) and
wire `modeling`, `quick-capture`, and `brainstorm` through them, keeping judgment and git in
the skills per the ADR-0038 three-layer boundary.

## Acceptance criteria

- [ ] To be defined during refinement.

## Notes

Raw capture — needs a refinement pass before promotion. Open design questions: the `capture`
verb's argument shape (full file content vs. structured fields — brainstorm and modeling
author rich bodies); whether DISMISS's cascade computation (ADR-0022) moves into lib or
stays skill-side with lib doing per-id bookkeeping; how brainstorm's multi-artifact writes
(vision + several tasks + INDEX + protocol) compose with a per-task verb; whether the
protocol-entry templates (per-action shapes) migrate into lib or arrive as an argument.
