---
id: agentic-workflow-wsfsk
title: Left nav — 1a single-panel shape (width, tree label, footer status line)
status: doing
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
sourced loss-tolerantly from the existing tree projection). The active nav item takes **1a's ochre
inset rail** per the builder-approved carve-out in [[design-system-vw12e]].

## Acceptance criteria
- [ ] Rail renders at 236px.
- [ ] A footer status line renders below the tree, degrading gracefully if the done-count is
      unavailable (no throw, no empty artifact).
- [ ] The active nav item renders **1a's ochre inset rail** (e.g. `box-shadow: inset 2px 0 0
      var(--accent-ochre)`), drawing from the accent token (no hardcoded hex), per the
      builder-approved ADR-0048 carve-out — with a code comment citing the ADR's bounded
      wayfinding exception so a future reader doesn't "fix" it back to de-emphasis.
- [ ] Right-aligned mono counts on tree groups remain unchanged (regression check on the existing
      `Collapsible` behavior).

## Notes
- **Resolved (builder, 2026-07-05): the active item uses 1a's ochre inset rail.** The architect
  had defaulted to de-emphasis (ADR-0016 passive-selection); the builder chose the orange rail.
  [[design-system-vw12e]] now carves out this one surface as a bounded wayfinding exception — this
  task must land after that ADR so the rule the code comment cites already exists.
- Prior art: aw-059 (workflow shell three-segment layout), aw-058 (rail-item main-pane routing).
