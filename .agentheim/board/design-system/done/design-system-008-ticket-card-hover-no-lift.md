---
id: design-system-008
title: TicketCard hover — stronger shadow, no upward content lift
status: done
type: refactor
context: design-system
created: 2026-06-15
completed: 2026-06-15
commit: 44476fc
depends_on: [design-system-001]
blocks: []
tags: [styleguide, ticket-card, hover, motion]
related_adrs: [0003]
related_research: []
prior_art: [design-system-006, design-system-004]
---

## Why
On the dashboard, hovering an item card lifts its whole content upward (a
`translateY(-1px)`), which makes the text jump and reads as jittery rather than
responsive. The Builder wants the hover to feel like the card is *raised* (a
stronger shadow) without the content shifting position.

The card is the styleguide `TicketCard` primitive, consumed unforked by the
dashboard (ADR-0003), so the fix belongs in the styleguide — every consumer gets
the corrected hover.

## What
In `styleguide/app/kanban.js` `TicketCard`, change the hover treatment:

- **Stronger shadow.** Today hover uses `--shadow-sm` (kanban.js:77). Raise it to
  the next step on the existing shadow scale, `--shadow-md`
  (`styles/agentheim.css:36`), so hover reads as a clear lift. No new token.
- **No vertical movement.** Remove the `transform: translateY(-1px)` on hover
  (kanban.js:78) so the card — and its content — stays put. The transition entry
  for `transform` can be dropped with it.
- The `selected` state's shadow (kanban.js:81) is unchanged.

## Acceptance criteria
- [ ] On hover, the `TicketCard` box-shadow is `--shadow-md` (stronger than the
      previous `--shadow-sm`).
- [ ] On hover, the card no longer translates — no `translateY` (or any
      `transform` offset) is applied; content does not move upward.
- [ ] The non-hover (idle) and `selected` appearances are unchanged.
- [ ] No styleguide fork — the change is made in `kanban.js` itself; the dashboard
      keeps consuming `TicketCard` as-is (ADR-0003). Dashboard `dist/` rebuilt so
      the running board picks it up.

## Notes
- Shadow scale lives in `styleguide/styles/agentheim.css` (`--shadow-sm/-md/-lg`),
  with `--shadow-md` already documented as the next step up from card hover in
  `foundations2.js`.
- Sibling capture: the board's launch *buttons* get a matching hover treatment in
  **agentic-workflow-030** (board-local, different code). No hard dependency
  between the two; they're one visual-polish pass landing in two BCs.
- Touches the same primitive as design-system-006 (corner action) and
  design-system-004 (doing-column animation) — read those for the current
  `TicketCard` shape before editing.

## Outcome

The `TicketCard` hover now reads as a **raise, not a jump**. In
`styleguide/app/kanban.js` the base style object's hover branch deepens the
shadow one step (`--shadow-sm` → `--shadow-md`) and drops the
`transform: translateY(-1px)` line entirely; the `transform` segment was also
removed from the `transition` declaration since nothing animates it anymore. The
idle (non-hover) and `selected` (`0 0 0 1px var(--accent-ochre), var(--shadow-sm)`)
appearances are untouched.

No styleguide fork (ADR-0003): the change is in `kanban.js` itself, and the
dashboard `dist/` was rebuilt (`npm run build` from `dashboard/`) so the served
board picks it up. This is a minor consumer-visible polish to the hover
treatment, not a structural reopening of the styleguide gate.

Key files:
- `styleguide/app/kanban.js` — TicketCard hover (shadow up to `--shadow-md`, no transform).
- `styleguide/test/ticket-card.test.mjs` — added three source-reading guards: hover uses `--shadow-md` not `--shadow-sm`; hover applies no `transform`/`translateY` and the transition drops the transform segment; selected-state shadow unchanged. (12 styleguide tests green, plus the full dashboard suite at 313 passing.)
- `dashboard/dist/app.js`, `dashboard/dist/*` — regenerated consumer bundle.
- BC README Motion section — documents the raise-not-jump hover.

No ADR: extends ADR-0003 (unforked styleguide consumption); no new decision.
