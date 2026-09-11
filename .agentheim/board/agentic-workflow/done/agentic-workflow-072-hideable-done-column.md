---
id: agentic-workflow-072
title: Done column should be hideable (it can grow infinitely large)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
depends_on: [design-system-001]
blocks: []
tags: []
related_adrs: [0015, 0017, 0003, 0009, 0001]
related_research: []
prior_art: [agentic-workflow-014, agentic-workflow-012, agentic-workflow-018]
---

## Why
The Done column accumulates every completed task — 69 today and only ever growing — so it
crowds the board and squeezes the columns that still need attention (backlog / todo / doing)
into less and less space. The builder should be able to drop Done out of view to focus on
live work, then bring it back on demand.

## What
Give the Done column a **hide control**. When hidden, the Done column drops out of the board's
column layout **entirely**, so the remaining three lifecycle columns (backlog / todo / doing)
reflow to share the full width. While it's hidden, a small **"Show Done (N)"** chip — N being
the live done-task count — appears above the board to bring it back. The choice **persists
across reloads** via the existing versioned board view-state store (ADR-0015). **Done only**:
backlog / todo / doing carry no hide control. **Shown by default.** This is presentation
view-state only — never a disk write; the tasks and their lifecycle are untouched
(ADR-0017 / ADR-0001).

## Acceptance criteria
- [ ] The Done column header (or its board-local control strip, beside the sort `<select>` /
      group toggle) carries a hide affordance — a small icon button (an existing registry glyph
      such as `eye-off` / `x` from design-system-017's `Icon`, consumed unforked). It renders on
      **Done only**; backlog / todo / doing show no such control.
- [ ] Clicking it removes the Done column from the board layout; backlog / todo / doing reflow
      to share the full width.
- [ ] While Done is hidden, a **"Show Done (N)"** chip is shown above the board (near the
      existing "Board" count strip / prompt-bar region), where N is the current done count and
      tracks live SSE re-projection. Clicking it restores the Done column. **No chip** is shown
      when Done is visible.
- [ ] Done is **visible by default** — no stored preference resolves to shown.
- [ ] The hidden choice **persists across reloads** in the existing versioned view-state store
      (`dashboard/app/board-view-state.js`, ADR-0015): `defaultColumnState` and `normalizeColumn`
      gain a `hidden` boolean defaulting to `false`; an old stored blob that lacks the field loads
      as `hidden: false` with **no `VIEW_STATE_VERSION` bump** (back-compatible additive field).
- [ ] Hiding is **presentation-only**: no `/api/*` write, no lifecycle move, no change on disk —
      the board stays a read-only projection (ADR-0017 / ADR-0001). Done's tasks still exist on
      disk; only their rendering is suppressed.
- [ ] Hidden state **survives every SSE `tree-changed` re-projection** (derived at render, like
      sort / group / collapse). A task completing into Done while it's hidden just bumps the chip's
      count — it never reveals the column.
- [ ] The hide button and the "Show Done" chip are **board-local, token-matched** elements (the
      sort `<select>` / group-toggle precedent); the styleguide is consumed **unforked** (ADR-0003)
      — no new design-system primitive, no styleguide edit.
- [ ] Pure logic is **unit-tested under `node --test`**: the `hidden` normalization in
      `board-view-state.js` (including the old-blob → `false` back-compat path) and the
      column-filtering that drops Done from the rendered set.
- [ ] `dashboard/dist/app.js` is **rebuilt (esbuild)** so the deployed bundle carries the change.

## Notes
- **Refinement decisions (2026-06-17, user-confirmed):**
  - **Mechanism** — remove-from-layout + "Show Done" chip (chosen over collapse-to-a-thin-strip),
    so the three live columns actually get the reclaimed width.
  - **Scope** — Done only (matches the Why; Done is the one column that grows unbounded).
  - **Persistence** — yes, via the ADR-0015 store (not in-session-only).
- **Storage shape:** keep the generic per-column `{ grouped, sort, collapsed, hidden }` shape even
  though only Done renders the control — it's the cleanest fit with the existing store; the UI just
  wires the affordance for Done alone. Additive + back-compatible, so no version bump.
- **Chip placement:** above the board, in/near the existing "Board" count strip — keep it
  **board-view-only** (the prompt bar and board controls don't render on the workflow / about /
  document-reader views).
- **Glyph:** reuse an existing `Icon` registry glyph (design-system-017) unforked — pick whichever
  reads cleanest as "hide this column" (`eye-off`, `x`, or similar).
- **Prior art / precedent:** aw-014 (persisted per-column view-state + collapsible sections — the
  store this extends), aw-012 (per-column sort control as a board-local `ColumnHeader` sibling),
  aw-018 (optional per-column affordance keyed off a prop, default OFF).

## Outcome
The Done column is now hideable. A board-local **Hide** button (the existing `x` registry glyph —
the registry has no `eye-off` — consumed unforked, ADR-0003) renders on the Done column **only**,
wired off an optional `onHide` prop (the aw-018 default-OFF precedent); backlog / todo / doing carry
no such control. Clicking it sets the column's persisted `hidden: true`; the pure
`visibleColumns(COLUMN_ORDER, view)` drops it from the rendered set at render time, so the three live
columns reflow to share the width and the choice survives every SSE re-projection (it never resets).
While Done is hidden a **"Show Done (N)"** chip (the `square-kanban` glyph) renders in the board's
count-strip region, N being the live done count read from the re-fetched columns; clicking it clears
`hidden`. Hiding is **presentation-only** — no `/api` write, no lifecycle move (ADR-0017 / ADR-0001).

Persistence rides the existing ADR-0015 versioned store: `defaultColumnState` and `normalizeColumn`
gained a `hidden` boolean defaulting to `false`; an old blob that predates the field loads as
`hidden: false` (shown) with **no `VIEW_STATE_VERSION` bump** (additive, back-compatible). Shown by
default.

Key files:
- `dashboard/app/board-view-state.js` — `hidden` in `defaultColumnState` / `normalizeColumn`; new pure
  `visibleColumns` export.
- `dashboard/app/board.js` — `ColumnHideButton` + `ShowColumnChip` components, `setColumnHidden`
  callback, `visibleColumns` filtering of the rendered columns, Done-only `onHide` wiring.
- `dashboard/test/board-view-state.test.mjs` — 6 new `node --test` cases (hidden normalization,
  old-blob → `false` back-compat, `visibleColumns` drop/keep/defensive).
- `dashboard/dist/app.js` — rebuilt via esbuild so the deployed bundle carries the change.
- BC README — hideable-Done bullet + `hidden` in the persisted view-state bullet.

Full dashboard suite: **558/558** green (was 552; +6).
