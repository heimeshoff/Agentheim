---
id: design-system-t896s
title: TicketCard — bump corner radius toward 1b's 10px
status: done
type: refactor
context: design-system
created: 2026-07-05
completed: 2026-07-05
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
- [x] The canvas `TicketCard` specimen renders the new (larger) radius.
- [x] The choice of shared-token-bump vs. dedicated `--radius-card` token is justified in the task
      notes, explicitly checked against `Menu` / `Modal` / `Drawer`'s shared use of `--radius-md`.
- [x] `dist/` is **rebuilt by this task itself** — a style-only change to an already-consumed
      primitive; no separate agentic-workflow wiring task.
- [x] Reopens the styleguide gate for a lightweight re-review (the ds-008 / ds-010 precedent).

## Notes
- Sibling to the palette retokenization [[design-system-a31e0]]; the two are independent token
  concerns and can run in parallel, but this should land before the columns / condensed-card
  wiring task [[agentic-workflow-c2ver]].
- TicketCard look history: ds-006 (corner action / estimate chip), ds-008 (hover shadow, no lift),
  ds-010 (dropped the ochre selected-ring).

- **Token-choice justification (dedicated `--radius-card`, not a `--radius-md` bump):**
  Grepped every `--radius-md` consumer in `styleguide/` before deciding. It is shared by
  `Menu` (`app/menu.js:155`), `Modal` (`app/modal.js:178`), the `Drawer` panel
  (`app/app.js`, several chrome surfaces), `SearchField` (`app/search.js`), `EmptyColumn`
  (`app/empty.js`), the live-activity list (`app/live.js`), and the Foundations swatch demo
  (`app/foundations.js` / `foundations2.js`). Bumping `--radius-md` globally to 10px would
  have silently re-rounded all of those unrelated, already-shipped surfaces as a side effect
  of a TicketCard-only aesthetic call from 1b — out of this task's scope and un-reviewed for
  those components. A dedicated `--radius-card: 10px` token isolates the change to
  `TicketCard`'s base style only; `Menu`/`Modal`/`Drawer`/everything else keeps 8px, untouched.
  The token is defined once in the shared `:root` radii block of
  `styles/colors_and_type.css` (radius is not theme-dependent, so — unlike the recent
  palette work — it is NOT duplicated across the two `[data-theme]` blocks).

## Outcome
Introduced a dedicated `--radius-card: 10px` token in
`styleguide/styles/colors_and_type.css` (shared `:root` radii block, alongside
`--radius-sm` / `--radius-md`). `TicketCard`'s base style in
`styleguide/app/kanban.js` now uses `var(--radius-card)` instead of
`var(--radius-md)`, so the canvas Kanban specimen renders the larger 10px corner
while `Menu` / `Modal` / `Drawer` / `SearchField` / `EmptyColumn` keep the
untouched 8px `--radius-md`. Updated the Foundations "Radii" doc card
(`app/foundations2.js`) to list the new token and relabel `--radius-md`'s role.
Added two tests to `styleguide/test/ticket-card.test.mjs` asserting the base
style uses `--radius-card` (not `--radius-md`) and that the token resolves to
10px — both went red before the source change and green after (160/160 total
suite passing, up from the 158 baseline). Rebuilt `dashboard/dist/` via
`npm run build`; verified reproducible (a second run produced the identical
diff). BC README updated with the token-choice note and a gate-reopen entry
(lightweight re-review per the ds-008 / ds-010 precedent, builder confirmation
pending).
