---
id: design-system-t896s
title: TicketCard — bump corner radius toward 1b's 10px
status: todo
type: refactor
context: design-system
created: 2026-07-05
completed:
depends_on: [design-system-e9apx, design-system-001-styleguide]
blocks: [agentic-workflow-c2ver]
tags: [dashboard-redesign, ticket-card, radius]
related_adrs: [0003]
related_research: []
prior_art: [design-system-006, design-system-008, design-system-010]
---

## Why
1b's condensed ticket card calls out a 10px corner radius against the system's current 8px
`--radius-md`. A small, style-only tweak to an already-unforked shared primitive that the
condensed-card look (consumed by the board) depends on.

## What
Adjust the `TicketCard` corner radius in `styleguide/app/kanban.js` — either by bumping
`--radius-md` or by introducing a dedicated `--radius-card` token. Decide at refine which is safer,
given `--radius-md`'s other consumers (`Menu`, `Modal`, `Drawer`).

## Acceptance criteria
- [ ] The canvas `TicketCard` specimen renders the new (larger) radius.
- [ ] The choice of shared-token-bump vs. dedicated `--radius-card` token is justified in the task
      notes, explicitly checked against `Menu` / `Modal` / `Drawer`'s shared use of `--radius-md`.
- [ ] `dist/` is **rebuilt by this task itself** — a style-only change to an already-consumed
      primitive; no separate agentic-workflow wiring task.
- [ ] Reopens the styleguide gate for a lightweight re-review (the ds-008 / ds-010 precedent).

## Notes
- Sibling to the palette retokenization [[design-system-a31e0]]; the two are independent token
  concerns and can run in parallel, but this should land before the columns / condensed-card
  wiring task [[agentic-workflow-c2ver]].
- TicketCard look history: ds-006 (corner action / estimate chip), ds-008 (hover shadow, no lift),
  ds-010 (dropped the ochre selected-ring).
