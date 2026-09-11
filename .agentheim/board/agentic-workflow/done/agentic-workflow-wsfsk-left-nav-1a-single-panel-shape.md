---
id: agentic-workflow-wsfsk
title: Left nav — 1a single-panel shape (width, tree label, footer status line)
status: done
type: feature
context: agentic-workflow
created: 2026-07-05
completed: 2026-07-05
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
- [x] Rail renders at 236px.
- [x] A footer status line renders below the tree, degrading gracefully if the done-count is
      unavailable (no throw, no empty artifact).
- [x] The active nav item renders **1a's ochre inset rail** (e.g. `box-shadow: inset 2px 0 0
      var(--accent-ochre)`), drawing from the accent token (no hardcoded hex), per the
      builder-approved ADR-0048 carve-out — with a code comment citing the ADR's bounded
      wayfinding exception so a future reader doesn't "fix" it back to de-emphasis.
- [x] Right-aligned mono counts on tree groups remain unchanged (regression check on the existing
      `Collapsible` behavior).

## Notes
- **Resolved (builder, 2026-07-05): the active item uses 1a's ochre inset rail.** The architect
  had defaulted to de-emphasis (ADR-0016 passive-selection); the builder chose the orange rail.
  [[design-system-vw12e]] now carves out this one surface as a bounded wayfinding exception — this
  task must land after that ADR so the rule the code comment cites already exists.
- Prior art: aw-059 (workflow shell three-segment layout), aw-058 (rail-item main-pane routing).

## Outcome
`ShellRail` (`dashboard/app/board.js`) now matches the 1a single-panel shape: the nav width is
236px (was 248px); the tree header still reads "WORKSPACE" (confirmed — already CSS-uppercased,
no change needed); a new footer status line ("all clear · N done") renders below the tree,
pinned as a sibling after the scrollable tree region so it never scrolls away. N is computed by a
new pure, unit-tested helper, `footerStatusLine` (`dashboard/app/library-data.js`), which counts
the "Decisions" (ADR) group already present in the same `cuedGroups` tree projection the tree
itself renders — an ADR is itself completed work, so this is a natural, always-available "done"
proxy with no extra fetch. It degrades loss-tolerantly to the bare "all clear" (never throws,
never an empty node) when the Decisions group or the groups array itself is missing/malformed.

The active primary-nav item (Board/Workflow/About) now renders 1a's ochre inset rail via a new
`RailNavSlot` wrapper component that wraps each styleguide `RailItem` (the styleguide's own
`library.js` is untouched — consumed unforked, ADR-0003) and applies
`box-shadow: inset 2px 0 0 var(--accent-ochre)` only when `active`. `RailNavSlot` carries an
in-body code comment citing ADR-0048's bounded wayfinding exception (surface 5) to ADR-0016's
de-emphasis-for-selection default, explicit that the pattern must not be copied to any other
peer-selection surface.

Right-aligned mono counts on tree groups (the styleguide `Collapsible`'s `count` prop, fed
`g.items.length`) are unchanged — locked by a regression test.

TDD: added `footerStatusLine` unit tests in `dashboard/test/library-data.test.mjs` (3 tests: counts
the Decisions group, degrades to "all clear" with no Decisions group, never throws on
missing/malformed input) and a new static-guard suite `dashboard/test/shell-rail-1a.test.mjs` (5
tests: 236px width, WORKSPACE header confirmation, footer wiring + render order, ADR-0048 ochre
inset rail via token only, Collapsible count regression) — following this codebase's established
idiom of source-reading static guards for the DOM-render-harness-less React glue, plus pure-module
unit tests for the testable logic (see `shell-relayout.test.mjs`'s own header comment).
Full suite: 742/742 passing (734 baseline + 8 new). `dashboard/dist/` rebuilt via `npm run build`.

Key files:
- `dashboard/app/board.js` — `ShellRail`, new `RailNavSlot`.
- `dashboard/app/library-data.js` — new `footerStatusLine`.
- `dashboard/test/library-data.test.mjs`, `dashboard/test/shell-rail-1a.test.mjs`.
- `.agentheim/contexts/agentic-workflow/README.md` — Shell layout bullet updated with the 1a shape.
