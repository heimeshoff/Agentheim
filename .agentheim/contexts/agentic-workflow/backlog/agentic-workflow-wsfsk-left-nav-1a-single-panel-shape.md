---
id: agentic-workflow-wsfsk
title: Left nav — 1a single-panel shape (width, tree label, footer status line)
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, sidebar, navigation]
related_adrs: [0016]
related_research: []
prior_art: [agentic-workflow-059, agentic-workflow-058]
---

## Why
The builder picked the **1a** left-nav shape (single 236px panel: app-nav Board/Workflow/About on
top, then a "WORKSPACE" tree, then a footer status line) over 1b's split icon-rail + tree. Today's
`ShellRail` is already single-panel with the same content; this closes the remaining shape gaps.

## What
Adjust `ShellRail` (`dashboard/app/board.js`): set the rail width to 236px, confirm/relabel the
tree section header ("WORKSPACE"), and add a footer status line (e.g. "all clear · N done", N
sourced loss-tolerantly from the existing tree projection). The active-item color is settled by
[[design-system-vw12e]], **not** by the brief's literal ask.

## Acceptance criteria
- [ ] Rail renders at 236px.
- [ ] A footer status line renders below the tree, degrading gracefully if the done-count is
      unavailable (no throw, no empty artifact).
- [ ] The active nav item explicitly **keeps the current `--surface-2` de-emphasis fill — NOT an
      ochre inset rail** — with a code comment citing ADR-0048 and the conflict-vs-brief for future
      readers.
- [ ] Right-aligned mono counts on tree groups remain unchanged (regression check on the existing
      `Collapsible` behavior).

## Notes
- **Open conflict:** the brief (item 11) literally asked for 1a's orange inset rail on the active
  item; the architect ruled against it (ADR-0016 passive-selection). Captured here per the
  architect's default; **needs builder confirmation at refine** — if the builder insists on the
  ochre rail, [[design-system-vw12e]]'s boundary must be restated.
- Prior art: aw-059 (workflow shell three-segment layout), aw-058 (rail-item main-pane routing).
