---
id: agentic-workflow-x4t2g
title: whats-next feeds back into planning — modeling and work read the advisory at session start
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, whats-next, vision, planning, three-loops]
related_adrs: ["0027"]
related_research: []
prior_art: [agentic-workflow-076, agentic-workflow-073]
---

## Why

The Why→What feedback edge is missing: once `vision.md` is written, nothing
structurally re-checks in-flight planning against it. `whats-next` reads the
vision's success criteria and gaps — but its artifact
(`.agentheim/state/whats-next.md`) dead-ends at the dashboard panel; no other
skill reads it. The vision can quietly drift from what's being built and only a
human notices. (Harness audit 2026-07-02, What-loop closure gap; mechanism ⊕
from the Opus cross-check.)

## What

Make the advisory artifact a real planning input: `modeling` and `work` read
`state/whats-next.md` (when present and fresh) in their "Before acting" steps,
so the vision-gap analysis re-enters the loop — informing refinement questions
and batch prioritization instead of waiting for a human to relay it.

## Acceptance criteria

- [ ] `modeling` and `work` read the advisory at session start when it exists; a missing/stale artifact degrades silently.
- [ ] The advisory stays advisory: it informs, it never auto-moves tasks or overrides the user's explicit ask (ADR-0027's advisory-write boundary holds).
- [ ] Staleness is respected — a recommendation older than the last completed batch is treated as context, not directive.

## Notes

Refinement question: whether a lightweight "does this still serve the vision's
success criteria / violate a non-goal?" check also belongs in the verify or
session-end path — the audit's fuller version of closing the loop.
