---
id: agentic-workflow-c2ver
title: Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label
status: done
type: feature
context: agentic-workflow
created: 2026-07-05
completed: 2026-07-05
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

## Outcome

Replaced the four columns' independent `ColumnSortControl` + `ColumnGroupToggle` +
`ColumnControls` strip with one board-wide `ViewChip` in `dashboard/app/board.js`, composed on
the shared `Menu`/`MenuItem` primitive (ds-015) unforked — its trigger summarizes the live
choice ("Recently modified" or "Recently modified · grouped by context ▾") and its panel holds
the sort `<select>` + a group-by-context toggle button, both now driving all four lifecycle
columns identically. A "Columns" uppercase section label (`textTransform: uppercase`) renders
above the board, beside the chip.

`dashboard/app/board-view-state.js` was rewritten to the v2 shape frozen by
[[agentic-workflow-qf945]]'s ADR-0015 amendment: `VIEW_STATE_VERSION` bumped 1 -> 2; `lens`
(`{ grouped, sort }`) is now ONE board-wide object, `columns` holds only the leaner
per-`(column, BC)` `{ collapsed, peek }` (both retained at their original granularity). Any
blob at a version other than 2 — including the retired v1 per-column shape — degrades wholesale
to board-wide defaults, never a throw, no field-by-field migration (the deliberate hard reset).
`defaultLensState()`/`normalizeLens` were added; `defaultColumnState()`/`normalizeColumn` were
narrowed to drop `grouped`/`sort`. Dormant retention (toggling the board-wide `grouped` flag
off/back-on never clears a column's `collapsed[]`) holds structurally, since `collapsed[]` now
lives entirely under `columns`, untouched by the lens setter.

`DashboardBoard`'s view-state (`board.js`) is now `{ lens, columns }`: `setLensSort`/
`setLensGrouped` replace the retired per-column `setColumnSort`/`setColumnGrouped`;
`setColumnPeek`/`toggleSection` are unchanged in behavior, just re-homed under `view.columns`.
The Done column's collapse/peek control (`ColumnCollapseButton`, `peekClampStyle`,
`hasHiddenDependency`-awareness) is untouched. Pipeline order stays project
(`treeToColumns`) → sort (now board-wide, `view.lens.sort`) → group (now board-wide,
`view.lens.grouped`) → per-column collapse/peek applied locally to each column's own rendered
sections.

Tests: rewrote `dashboard/test/board-view-state.test.mjs` for the v2 shape (18 tests, all
passing) and added `dashboard/test/board-view-chip.test.mjs` (8 new static source-reading
guards, the established idiom for board.js's untested React glue — mirroring
`board-done-collapse.test.mjs`). Updated one regex in `board-done-collapse.test.mjs` (peek
state now reads `prev.columns[status].peek`). `dashboard/dist/app.js` rebuilt via
`dashboard/build.mjs`. Full dashboard + lib suite: 947 passing (764 dashboard + 183 lib), 0
failing (two pre-existing, unrelated `vscode-extension/test/bridge.test.mjs` port-binding
failures are environmental — reproduce in isolation on this machine, untouched by this task).

BC README updated: the "Column sort"/"Column grouping" bullets merged into one "Board-wide sort
+ grouping — the 'View' chip" bullet, and the "Persisted board view-state" bullet rewritten for
the v2 board-wide-lens shape (dormant retention + hard-reset semantics called out explicitly).

No ADR written — [[agentic-workflow-qf945]] already landed the ADR-0015 amendment this task
implements against; this was pure UI wiring, per the task's own Why.

Key files: `dashboard/app/board.js` (ViewChip, BoardColumn, DashboardBoard view-state),
`dashboard/app/board-view-state.js` (v2 rewrite), `dashboard/test/board-view-state.test.mjs`,
`dashboard/test/board-view-chip.test.mjs`, `dashboard/test/board-done-collapse.test.mjs`,
`dashboard/dist/app.js`, `.agentheim/contexts/agentic-workflow/README.md`.
