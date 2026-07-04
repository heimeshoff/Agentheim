---
id: agentic-workflow-c2ver
title: Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-a31e0, design-system-t896s, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, board, columns, view-state]
related_adrs: [0015]
related_research: []
prior_art: [agentic-workflow-072, agentic-workflow-m2v8d, agentic-workflow-061]
---

## Why
The builder wants 1b's columns exactly: the condensed 4-column board plus **one** board-wide
filter/group/sort control (a "View" chip) instead of today's per-column Sort + Group affordances.
This is a real reversal of ADR-0015's per-column persisted view-state scope, not just a cosmetic
tweak.

## What
Replace the four columns' independent `ColumnSortControl` + `ColumnGroupToggle` with a single
`ViewChip` (e.g. "Recently modified · grouped by context ▾") driving all columns identically —
likely composed on the shared `Menu` primitive (ds-015) unforked. Add a "COLUMNS" section label
above the board. Migrate the persisted view-state store (`board-view-state.js`) from per-column to
one board-wide lens. Consumes the condensed ticket card from [[design-system-t896s]].

## Acceptance criteria
- [ ] One control drives sort + group for all four columns simultaneously; no column keeps an
      independent sort/group affordance.
- [ ] The Done column's collapse/peek control is unchanged (still per-column, still
      `hasHiddenDependency`-aware).
- [ ] Persisted view-state migrates cleanly: a stale/malformed old per-column blob degrades to
      sensible board-wide defaults, never a throw.
- [ ] **ADR-0015 is amended (or a superseding ADR written)** to record the collapse from per-column
      to a single board-wide view lens — flagged explicitly since it diverges from that ADR's scope.
- [ ] A "COLUMNS" uppercase section label renders above the board.

## Notes
- The architect folded the ADR-0015 amendment into this task's AC rather than spinning up a fourth
  decision task; **if the builder prefers, split the amendment out as its own `type: decision`
  task** at refine.
- Prior art: aw-072 (hideable Done column), aw-m2v8d (clamped-fade collapse), aw-061 (name sort
  alphabetical).
- Depends on the palette [[design-system-a31e0]] and the condensed-card radius
  [[design-system-t896s]].
