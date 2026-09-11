---
id: agentic-workflow-012
title: Add sorting options to Kanban board columns
status: done
type: feature
context: agentic-workflow
created: 2026-06-08
completed: 2026-06-08
commit: 19e5870
depends_on: [agentic-workflow-013, design-system-001-styleguide]
blocks: []
tags: [dashboard, board, frontend, ui]
related_adrs: [0002, 0003, 0009]
related_research: []
prior_art: [agentic-workflow-006, agentic-workflow-009]
---

## Why
Surface recently-touched work. On the live board, the cards that just moved or changed
are the ones the builder cares about — they should sit at the top of each column instead
of being lost in a fixed order. This is what validates the `modification date descending`
default.

## What
Give each lifecycle column on the dashboard Kanban board (`backlog` / `todo` / `doing` /
`done`) its own independent sort control. Orderings: **Name ascending**, **Name
descending**, and **Modification-date descending** (plus modification-date ascending for
symmetry/testability). "Name" = the task `title`. Default per column = **modification
date descending**.

Frontend-only. The file modification time the default sort needs is added to the
`/api/tree` projection by **agentic-workflow-013** (this task depends on it). The
reordering happens board-side, after the existing `treeToColumns` projection — the
styleguide is consumed unmodified.

## Acceptance criteria
- [ ] Each column renders its own sort control, board-side, as a sibling of the styleguide
      `ColumnHeader`. The styleguide `ColumnHeader` / `Column` / `TicketCard` are imported
      as-is and **not** modified or forked (ADR-0003) — mirrors how `DragColumn` already
      adds board-only drag affordances around unmodified styleguide components.
- [ ] The control offers: Name asc, Name desc, Modification-date desc, Modification-date
      asc. "Name" = task `title`.
- [ ] Each column's sort choice is **independent** (changing one does not change another)
      and held in board view-state only (React state in `dashboard/app/board.js`).
- [ ] On every load the sort **resets to the default** (`modification date descending`)
      for every column. **No `localStorage` / no client persistence** — pure in-session
      view-state.
- [ ] Sorting is a **pure reordering of already-projected tickets** — it runs after
      `treeToColumns` and never mutates the transform, the read model, or disk. The
      comparator lives in a pure, DOM-free module (recommend `dashboard/app/board-sort.js`)
      and is unit-tested under `node --test`, mirroring `board-data.js`.
- [ ] **Live-update interplay:** after every SSE `tree-changed` re-fetch + re-projection
      (`loadTree` in `board.js`, aw-009) and on reconnect, each column's current sort
      choice is **re-applied** so a live change never silently resets the visible order.
- [ ] **Deterministic tie-breaks:** name ties and modification-date ties both break by `id`
      ascending. A ticket with absent/`null` `mtimeMs` (graceful-degradation case) sorts to
      a defined position (treat as oldest), then `id` tie-break — never `NaN`, never a throw.
- [ ] Default mod-date-descending surfaces recently-touched cards at the **top** of each
      column (the validated Why).

## Notes
Refined 2026-06-08 via `modeling` (Interrogator). Builder's answers: **Why** = surface
recently-touched work; **Scope** = per-column independent; **Persistence** = reset to
default each load, no `localStorage`.

**Finding A — default sort needs mtime the read model lacks.** `/api/tree`
(`dashboard/tree.mjs`, aw-005) projects only `{ id, title, status, type, context, path }`
— no file mtime — and the board is a browser client that cannot `stat()` itself. The
projection must carry `mtimeMs`. **Split out as agentic-workflow-013** (shared read-model
change consumed by aw-006/007/008/009), which this task depends on. The extension is
additive/backward-compatible and **within** ADR-0002's "pointers + metadata only" contract
(mtime is metadata) — no ADR / no ADR-0002 addendum.

**Finding B — sort-control affordance home.** Render the control **board-side**, as a
sibling of `ColumnHeader` inside `dashboard/app/board.js` (in or beside `DragColumn`). Do
**not** extend or fork the styleguide (`kanban.js` stays untouched, ADR-0003). `Column`
already receives pre-ordered tickets, so sort happens **after** `treeToColumns`
(`board-data.js`) over the projected list. No design-system task, no cross-BC dependency.

**Relevant files:**
- `dashboard/app/board.js` — sort UI + per-column state + `loadTree` re-apply
- `dashboard/app/board-data.js` — `treeToColumns` / `treeTicket` (pass `mtimeMs` through)
- `dashboard/app/board-sort.js` — new pure comparator module (recommended)
- `.agentheim/contexts/design-system/styleguide/app/kanban.js` — `ColumnHeader`/`Column`/`TicketCard`, consumed unmodified
- ADR-0002 (projection contract), ADR-0003 (styleguide no-fork), ADR-0009 (frontend app shell)

## Outcome
Each dashboard board column now carries its own independent sort control. The reordering is a
pure, DOM-free comparator in the new `dashboard/app/board-sort.js` (`sortTickets`, with
`SORT_OPTIONS` / `DEFAULT_SORT`), unit-tested under `node --test` (`dashboard/test/board-sort.test.mjs`,
12 tests) mirroring `board-data.js`. It runs board-side *after* `treeToColumns` — it never mutates
the transform, the read model, or disk.

- **Orderings:** Name (task `title`) asc/desc and Modification-date desc/asc, where mtime is the
  per-task `mtimeMs` the projection carries (aw-013). `board-data.treeTicket` now passes `mtimeMs`
  through, normalized to `null` when absent (two new `board-data.test.mjs` tests).
- **Default = modification-date descending** per column — recently-touched cards sit at the top
  (the validated Why).
- **Tie-breaks:** name ties and mod-date ties both break by `id` ascending; an absent/`null`
  `mtimeMs` sorts as oldest then `id` tie-break — never `NaN`, never a throw.
- **No-fork affordance:** the control is a board-only native `<select>` rendered as a *sibling* of
  the styleguide `ColumnHeader` inside `DragColumn` (`dashboard/app/board.js`); `kanban.js` is
  consumed unmodified (ADR-0003), mirroring the `DragColumn` drag-affordance precedent (aw-009).
- **View-state only:** each column's choice lives in React state in `board.js` (no `localStorage`),
  so every load resets to the default. Because the ordering is *derived at render*, every live
  re-projection (`loadTree` on SSE `tree-changed` / reconnect, aw-009) re-applies the column's
  current choice — a live change never silently resets the visible order.

Full suite green (124 tests); `dashboard/dist/` rebuilt via `dashboard/build.mjs` (npm run build).
No ADR (mtime is metadata within ADR-0002; the board-side affordance is governed by ADR-0003).

**Key files:** `dashboard/app/board-sort.js` (new pure comparator), `dashboard/test/board-sort.test.mjs`
(new), `dashboard/app/board.js` (per-column sort state + `ColumnSortControl` + render-time apply),
`dashboard/app/board-data.js` (`mtimeMs` pass-through), `dashboard/test/board-data.test.mjs`,
`dashboard/dist/app.js` (rebuilt bundle).
