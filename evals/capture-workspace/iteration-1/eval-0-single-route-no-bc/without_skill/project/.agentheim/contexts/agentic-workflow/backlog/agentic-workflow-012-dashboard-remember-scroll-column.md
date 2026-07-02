---
id: agentic-workflow-012
title: Dashboard remembers the last board column scrolled to across reopens
status: backlog
type: feature
context: agentic-workflow
created: 2026-06-08
depends_on: []
blocks: []
tags: [dashboard, ui, frontend, board, ux]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-006]
---

## Why

When the builder reopens the dashboard, the board view jumps back to the top / leftmost
column every time, losing the horizontal scroll position they had. On a wide flat Kanban
(`backlog`/`todo`/`doing`/`done`, all BCs pooled — agentic-workflow-006) this is a small
but constant friction: you have to re-scroll to wherever you were working.

## What

The board view should **remember which column the builder last scrolled to** and restore
that scroll position when the dashboard is reopened, so reopening lands where they left off
instead of resetting to the top/start.

## Open questions (to resolve in refinement)

- **Persistence scope** — where is "last scrolled column" stored? Client-side
  (`localStorage`, per-browser) is the obvious low-cost fit — the board is a pure projection
  and the runtime owns no UI-preference state today. Server-side / on-disk would drag a new
  preference concern into the transport (infrastructure), which seems heavier than warranted.
- **What exactly is restored** — the precise scroll offset, or the nearest column snapped
  into view? Column-granular ("remember the column") is what was asked for and is more robust
  to layout changes than a raw pixel offset.
- **Interaction with live-update** — the board re-fetches and re-projects on every SSE
  `tree-changed` frame (agentic-workflow-009). Restoring scroll must survive those re-renders,
  not just the initial mount, without fighting the user's current scroll.
- **Frontend gate** — pure board-view UX over existing styleguide components; likely no
  styleguide change, but confirm during refinement whether any `depends_on` on
  design-system is needed.

## Notes

Captured from the builder: "the dashboard should remember which board column I last scrolled
to, so reopening it doesn't jump back to the top every time." Lightweight idea — not yet
refined; left in `backlog/` pending a refinement pass.
