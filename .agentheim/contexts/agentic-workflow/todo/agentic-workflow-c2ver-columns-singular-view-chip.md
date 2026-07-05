---
id: agentic-workflow-c2ver
title: Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label
status: todo
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [agentic-workflow-qf945, design-system-a31e0, design-system-t896s, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, board, columns, view-state]
related_adrs: [0015]
related_research: []
prior_art: [agentic-workflow-072, agentic-workflow-m2v8d, agentic-workflow-061, agentic-workflow-bz3az]
---

## Why

The builder wants 1b's columns exactly: the condensed 4-column board plus **one**
board-wide filter/group/sort control (a "View" chip) instead of today's per-column Sort +
Group affordances. The architectural reversal this implies for ADR-0015's per-column
view-state scope is now a settled, separate decision ([[agentic-workflow-qf945]]) — this
task is pure UI wiring against that frozen shape.

## What

Replace the four columns' independent `ColumnSortControl` + `ColumnGroupToggle` with a
single `ViewChip` (e.g. "Recently modified · grouped by context ▾") driving all columns
identically, composed on the shared `Menu` primitive (ds-015) **unforked**. Add a
"COLUMNS" uppercase section label above the board. Rewrite the persisted view-state store
(`dashboard/app/board-view-state.js`) from the v1 per-column shape to the v2 board-wide-lens
shape frozen by [[agentic-workflow-qf945]]'s ADR-0015 amendment:
`{ version: 2, lens: { grouped, sort }, columns: { [col]: { collapsed, peek } } }`.
Consumes the condensed ticket card from [[design-system-t896s]].

## Acceptance criteria

- [ ] One board-wide `ViewChip` (composed on the shared `Menu` primitive ds-015, unforked)
      replaces the four columns' independent Sort + Group-by-BC controls, driving sort +
      group identically for all four columns — no column keeps an independent sort/group
      affordance.
- [ ] Persisted view-state migrates cleanly to the v2 shape frozen by
      [[agentic-workflow-qf945]]: `VIEW_STATE_VERSION` bumps to `2`; a stale/malformed/v1
      blob degrades to board-wide defaults (flat + default sort; every column's
      `collapsed: []`, `peek: false`), never a throw. No field-by-field migration of old
      per-column sort/grouped values is attempted (deliberate hard reset, per the ADR).
- [ ] Per-`(column, BC)` `collapsed[]` section state is retained at today's granularity:
      toggling the board-wide `grouped` flag off then back on does NOT clear a column's
      stored `collapsed[]` — it goes dormant while flat and reappears intact once grouping
      is re-enabled.
- [ ] The Done column's collapse/peek control is unchanged — still per-column, still
      `peek`-driven height clamp (`peekClampStyle`), still `hasHiddenDependency`-aware —
      wholly unaffected by sort/group becoming board-wide.
- [ ] Pipeline order stays project → sort (now board-wide) → group (now board-wide) →
      per-column collapse/peek applied locally to each column's own rendered sections.
- [ ] A "COLUMNS" uppercase section label renders above the board.

## Notes

- **All dependencies met (reconciled 2026-07-05).** [[agentic-workflow-qf945]] landed its
  ADR-0015 amendment (completed 2026-07-05 10:38) — the v2 store shape cited in What/criteria
  matches the amended ADR verbatim, no criteria changed. The three design-system dependencies
  ([[design-system-a31e0]] palette, [[design-system-t896s]] condensed-card radius,
  design-system-001-styleguide) were already in `done/`. Nothing blocks this task.
- **board.js sequencing caution cleared.** Sibling [[agentic-workflow-bz3az]] (the prompt-bar
  rebuild, the other `board.js` rewrite in this redesign) completed 2026-07-05 11:44 — build
  against current `main`. Its rebuild touched only the prompt-bar region:
  `ColumnSortControl` / `ColumnGroupToggle` are intact (`board.js:136` / `:165`) and are
  exactly what this task removes.
- **Premises re-verified against the tree:** `dashboard/app/board-view-state.js` is still v1
  (`VIEW_STATE_VERSION = 1`); the shared `Menu` primitive (ds-015) lives at
  `styleguide/app/menu.js` exporting `Menu` / `MenuItem` / `MenuDivider` — compose the
  ViewChip on it unforked.
- Prior art: aw-072 (hideable Done column), aw-m2v8d (clamped-fade collapse), aw-061 (name
  sort alphabetical), aw-bz3az (the sibling board.js rebuild, landed first).
