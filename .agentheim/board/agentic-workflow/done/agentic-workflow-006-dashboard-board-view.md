---
id: agentic-workflow-006
title: Dashboard board view — flat Kanban (lifecycle columns, BC shown on the card) over /api/tree
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: 03e0b37
depends_on: [agentic-workflow-005, design-system-002, infrastructure-002]
blocks: [agentic-workflow-001]
tags: [dashboard, ui, frontend, kanban, board]
related_adrs: [ADR-0009]
related_research: []
prior_art: []
---

## Why

The board is the dashboard's home view — an at-a-glance picture of every task across the
project. The approved styleguide already ships the pattern for it (`KanbanBoard` in
`design-system-001`): four lifecycle columns with cards that carry a BC folder-chip. This task
renders that pattern over live project data.

## What

Render the **flat** Kanban board in the dashboard UI by consuming `/api/tree`: the four
lifecycle columns (`backlog` / `todo` / `doing` / `done`), tasks from **all** bounded contexts
pooled into those columns, each card labelled with its BC via the existing styleguide `context`
chip (kanban.jsx). Uses the bundled ESM styleguide (design-system-002 source → infrastructure-002
dist). Read-only board here — the drag-to-Promote write path is aw-009; clicking a card emits the
open intent the slide-over (aw-007) consumes.

> Decided 2026-06-06: flat board, not BC swimlanes. The single `todo` column mixes BCs; the
> per-card BC chip is how you tell them apart. A BC filter/grouping can be captured later if the
> flat board gets crowded.

## Acceptance criteria

- [ ] The board renders four lifecycle columns (`backlog`/`todo`/`doing`/`done`) with tasks from
      all BCs, drawn from `/api/tree`.
- [ ] Each card shows its BC via the approved styleguide `context` chip; no swimlanes.
- [ ] Look-and-feel conforms to the approved styleguide (design-system-001) and loads from the
      committed dist — no in-browser Babel.
- [ ] Clicking a card emits an "open this task" intent that the slide-over (aw-007) consumes.
- [ ] Empty columns render the styleguide's empty-column state.
- [ ] Frontend gate honored: this task lists the styleguide source (design-system-002, which
      re-approves design-system-001) in `depends_on` and is not promoted ahead of it.

## Notes

- Reuses `KanbanBoard` / `Column` / `TicketCard` as-is from the approved styleguide — no new
  pattern, no styleguide re-approval needed (the earlier swimlane proposal was dropped).
- Depends on design-system-002 (the ESM styleguide single source the board imports) and
  infrastructure-002 (the committed bundle it loads).

## Outcome

Stood up the **dashboard frontend app** (the project's first UI) and rendered the flat
board over live `/api/tree` data, reusing the approved styleguide components as-is.

**Architecture (ADR-0009):** the dashboard frontend app now lives in `dashboard/app/` and
*consumes* the design-system styleguide source across the BC boundary (no fork — single
source intact, ADR-0003). The esbuild `ENTRY` in infrastructure's `dashboard/build.mjs`
was retargeted from the styleguide canvas to `dashboard/app/app.js` (the single sanctioned
edit to that file), so the committed `dist/` now serves the **live board** instead of the
demo canvas. dist/ was rebuilt and re-committed.

**Files:**
- `dashboard/app/board-data.js` — pure, framework-free transform: pools every BC's tasks
  into the four flat lifecycle columns by status (unknown status → backlog, never lost) and
  maps each tree task into the styleguide `TicketCard` shape. Unit-tested under `node --test`.
- `dashboard/app/board.js` — `DashboardBoard` (fetches `/api/tree`, renders four styleguide
  `Column`s with live tickets, loading/error states, emits open-intent + selection on card
  click) and `DashboardApp` (the composable shell aw-007/aw-008 slot into).
- `dashboard/app/app.js` — the esbuild entry; mounts `DashboardApp` into `#root`.
- `dashboard/build.mjs` — `ENTRY` retargeted to the dashboard app (infra's file, one edit).
- `dashboard/test/board-data.test.mjs` — 9 tests for the transform (flat pooling, BC chip,
  status-driven placement, loss-tolerance, empty/null degradation, card-shape mapping).
- `dashboard/test/dist-build.test.mjs` — added an assertion that dist ships the live board
  (`/api/tree`), not the canvas hero.

**Acceptance criteria** — all met: four lifecycle columns over `/api/tree`; per-card BC
`context` chip, no swimlanes; loads from committed dist, no in-browser Babel; clicking a card
emits the open-intent (aw-007 wires the slide-over to it); empty columns render the styleguide
`EmptyColumn`; frontend gate honored (design-system-002 in `depends_on`).

**Verification:** full dashboard suite green (65 tests); a real server smoke check confirmed
`GET /` serves the board HTML referencing `./app.js`, `GET /api/tree` returns the live tree
(this task showed up in `doing`), and `GET /app.js` is the bundled board (190 KB, contains
`/api/tree`).

**Out of scope (left for later tasks):** the slide-over (aw-007), navigation rail (aw-008),
drag-to-Promote write path (aw-009), SSE live refresh wiring (aw-009 concern).
