---
id: design-system-010
title: TicketCard — drop the ochre selected-state ring (no replacement cue)
status: done
type: refactor
context: design-system
created: 2026-06-15
completed: 2026-06-15
commit: 5ba2524
depends_on: [design-system-001]
blocks: []
tags: [styleguide, ticket-card, selection, focus]
related_adrs: [0003, 0016]
related_research: []
prior_art: [design-system-008, design-system-006, design-system-004]
---

## Why
A selected / in-focus ticket card currently gets an ochre outline — an
orange-yellow border plus a 1px accent ring around the card. The Builder does not
want any yellow/orange outline around the ticket that's in focus.

This also aligns the `TicketCard` with the direction already set elsewhere in the
design system: ADR-0016 reserves the accent and moves selection cues *off* the
ochre/accent/ring (theme-preview swatches, theme toggle, `live.js` all signal
selection by de-emphasis, never the reserved accent). The `TicketCard` selected
state is the last place still using the ochre ring.

## What
In `styleguide/app/kanban.js` `TicketCard`, remove the ochre selected treatment
so a selected card looks identical to an unselected one:

- **Border color** (kanban.js:78) — drop the `selected ? "var(--accent-ochre)"`
  branch; the border follows the normal idle/hover logic regardless of `selected`.
- **Selected ring** (kanban.js:80) — remove the
  `if (selected) base.boxShadow = "0 0 0 1px var(--accent-ochre), var(--shadow-sm)"`
  line entirely. No replacement ring, border, shadow, or de-emphasis cue —
  selected == unselected (Builder chose: just remove it).
- The `selected` prop / `aria-pressed` wiring stays (it still carries semantic
  state for assistive tech and consumers); only its *visual* ochre cue is removed.

Out of scope: the global keyboard `:focus-visible` outline in
`styles/agentheim.css:256` (`.focusable:focus-visible { outline: 1.5px solid
var(--accent-ochre) }`). That is an accessibility affordance on every focusable
element, not a ticket-selection cue, and is left intact. If the Builder later
wants the keyboard focus ring recolored/removed too, that's a separate capture.

## Acceptance criteria
- [ ] A selected `TicketCard` (`selected` / `forceHover=false`) has no ochre
      border and no `0 0 0 1px var(--accent-ochre)` ring — its border and box-shadow
      are identical to the same card unselected.
- [ ] No `--accent-ochre` (or any accent/ochre color) is applied to the card based
      on `selected`.
- [ ] The `selected` prop and `aria-pressed=${selected}` are still passed through
      (semantic state preserved); only the visual ochre cue is gone.
- [ ] Idle and hover appearances are unchanged (hover still `--shadow-md`, no
      transform — per design-system-008).
- [ ] No styleguide fork (ADR-0003): change is in `kanban.js` itself; dashboard
      `dist/` rebuilt so the running board picks it up.

## Notes
- The selected treatment lives entirely in the `base` style object of
  `TicketCard` (kanban.js:63–80): line 78 `borderColor` and line 80 `boxShadow`.
- `styleguide/test/ticket-card.test.mjs:99` currently asserts the selected
  box-shadow *is* `accent ring + --shadow-sm` — that guard must be updated/removed
  to assert the selected state carries no accent ring (mirror the
  theme-toggle.test.mjs:90 "no ochre / accent / ring for the selected state"
  contract).
- Same primitive touched by design-system-008 (hover), design-system-006 (corner
  action), design-system-004 (doing-column animation) — read those for the current
  `TicketCard` shape before editing.
- Conceptual sibling: ADR-0016 (selection by de-emphasis, never the reserved
  accent). This task completes that direction for the ticket card. Worth a one-line
  note on the ADR or BC README that the card now omits the cue entirely.

## Outcome
The `TicketCard` selected state no longer renders any visual cue: the ochre
`borderColor` branch and the `if (selected) base.boxShadow = "0 0 0 1px
var(--accent-ochre), var(--shadow-sm)"` ring were removed from the `base` style
object in `styleguide/app/kanban.js`. A selected card is now visually identical to
an unselected one; the `selected` prop survives only as semantic state
(`aria-pressed=${selected}`). Idle/hover appearances (`--shadow-md`, no transform —
ds-008) are untouched, and the global `:focus-visible` outline was left intact (out
of scope). This is the last ochre-ring selection cue in the design system, so it
completes ADR-0016's direction for the card.

Key files:
- `.agentheim/contexts/design-system/styleguide/app/kanban.js` — removed the ochre
  border branch + accent-ring boxShadow override.
- `.agentheim/contexts/design-system/styleguide/test/ticket-card.test.mjs` —
  inverted the selected-state guard: now asserts NO `if (selected) base.boxShadow`,
  no `selected`-branched borderColor, and no accent/ochre in the base style.
- `dashboard/dist/app.js` — rebuilt derived bundle (esbuild) so the running board
  picks up the change (ADR-0003).
- `.agentheim/contexts/design-system/README.md` — Motion section note updated.

Verification: styleguide suite 37/38 pass (the single failure is the pre-existing
out-of-scope `add-affordance.test.mjs`, filed as design-system-011); dashboard
suite 352/352 pass.
