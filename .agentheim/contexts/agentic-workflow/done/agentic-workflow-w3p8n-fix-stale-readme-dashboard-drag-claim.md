---
id: agentic-workflow-w3p8n
title: Fix stale README claim — dashboard has no drag-to-promote write-back
status: done
type: bug
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: []
tags: [harness-audit, readme, dashboard, docs]
related_adrs: ["0017"]
related_research: []
prior_art: []
---

## Why

`README.md:74` claims the dashboard's "one write-back is dragging a card
`backlog→todo` to Promote." That path was removed by ADR-0017: the board carries
no drag affordances (`dashboard/app/board.js`), and Promote is a bridge-launched
`/agentheim:modeling promote <id>` session. The README contradicts the built
system. (Harness audit 2026-07-02, confirmed defect #3.)

## What

Correct the README's dashboard section: the dashboard is fully read-only
(ADR-0017); its buttons fire skill invocations into a real Claude terminal via
the VS Code bridge (ADR-0018). No drag, no write endpoint.

## Acceptance criteria

- [x] README no longer claims any dashboard write-back or drag interaction.
- [x] The dashboard description matches ADR-0017 (read-only) and ADR-0018 (bridge-launched skill sessions).

## Outcome

Corrected the project-root `README.md` Dashboard section (the stale sentence at
line 74, "Its one write-back is dragging a card `backlog→todo` to Promote"). The
dashboard is now described as **read-only** — a total projection of disk per
ADR-0017 — with skills as the sole owners of the task lifecycle. Action buttons
(Refine, Promote, backlog launchers) are described as firing a seeded Claude
session into a real terminal via the VS Code bridge (ADR-0018), degrading to a
clipboard copy when the bridge is absent. No drag affordance and no write
endpoint are claimed.

Confirmed against `dashboard/app/board.js` (lines 1114–1115: "The board carries
NO drag affordances (ADR-0017): columns are inert projections of disk, never drop
targets") that no drag-to-promote path exists in the built system.

Key file: `README.md` (root).
