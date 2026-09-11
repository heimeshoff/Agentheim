---
id: design-system-006
title: TicketCard — optional corner action; hide the empty estimate chip
status: done
type: feature
context: design-system
created: 2026-06-09
completed: 2026-06-09
commit: 4588599
depends_on: [design-system-001]
blocks: [agentic-workflow-016]
tags: [styleguide, ticket-card, dashboard]
related_adrs: [0003]
related_research: []
prior_art: [design-system-001]
---

## Why
On the live dashboard board every `TicketCard` shows a meaningless "— pt" estimate
chip: the `/api/tree` read projection carries no estimate (ADR-0002 — pointers and
metadata only), so `dashboard/app/board-data.js` feeds the styleguide card the
placeholder `est: '—'`. The chip is dead space on every card. The dashboard wants to
(a) stop showing the empty estimate and (b) place a single quiet action in that
bottom-right slot on some cards (agentic-workflow-016 puts a copy-command button
there). Because the dashboard consumes the styleguide `TicketCard` **unforked**
(ADR-0003), both capabilities must live in the styleguide, not be bolted on
board-side.

## What
Two small, backward-compatible changes to the styleguide `TicketCard`
(`styleguide/app/kanban.js`), keeping it the single source of UI truth:

1. **Estimate chip renders only when there is a real estimate.** When `ticket.est`
   is absent, empty, or the em-dash placeholder, the `… pt` `MetaChip` does not
   render at all. Tickets that *do* carry an estimate (the canvas demo data) still
   show it unchanged.
2. **Optional corner action.** The card accepts an optional action affordance
   occupying the bottom-right of the meta row — exactly where the estimate chip sat.
   When supplied it renders a single quiet, token-styled control (an icon button);
   when absent the card is unchanged. The slot is generic (the styleguide owns
   look/placement; the consumer owns behavior) so a consumer like the dashboard can
   drop in its own button without forking the card.

The quiet-by-default law holds: no new hue, token-styled, the action reads as a
subtle affordance, not a loud button.

## Acceptance criteria
- [ ] A `TicketCard` whose `est` is absent, empty, or the `'—'` placeholder renders **no** estimate (`… pt`) chip.
- [ ] A `TicketCard` whose `est` is a real value still renders the `… pt` chip as before (canvas demo unchanged).
- [ ] `TicketCard` accepts an optional action affordance; when provided it renders in the bottom-right of the meta row (the former estimate-chip slot), token-styled and quiet.
- [ ] When no action is provided, the meta row renders exactly as today minus the dead estimate chip — no layout regression.
- [ ] The action is keyboard-focusable and activating it does **not** trigger the card's own `onClick` (the click must not bubble to card-open).
- [ ] The styleguide canvas (`styleguide/index.html`) documents both new states (a card with an action; a card with no estimate) so the gate can be re-reviewed.
- [ ] Existing dashboard imports of `TicketCard` keep working unforked (ADR-0003); the dashboard `dist/` is a derived artifact and must be rebuilt to pick up the change.

## Notes
- The exact slot API (a render-prop vs an `{ icon, label, onClick, title }` config
  object) is left to the worker to settle during TDD — pick whichever keeps the
  styleguide the owner of look/placement and the consumer the owner of behavior. A
  render-prop is the lighter touch.
- This is the **in-card** counterpart to the board-local controls precedent (the
  sort `<select>`, the group toggle): those are siblings *outside* the card; this
  affordance is genuinely *inside* the card, which is why it belongs in the
  styleguide rather than board-local.
- Stop-propagation on the action's click is the load-bearing interaction detail —
  the card itself is a button that opens the slide-over.
- Gate: styleguide change → re-review with the builder before the dashboard wiring
  (agentic-workflow-016) ships.

## Outcome

The styleguide `TicketCard` gained two backward-compatible, consumer-shaped
behaviors, both inherited by the dashboard unforked (ADR-0003):

1. **Estimate chip is conditional.** The `… pt` `MetaChip` renders only for a real
   estimate. Absent / empty / whitespace / the em-dash `—` placeholder (which the
   dashboard `board-data.js` feeds, since `/api/tree` carries no estimate) hides
   it — no dead `— pt` on every card. Driven by a new pure, React-free decision
   `showEstimate(est)` in `styleguide/app/card.js`, testable under `node --test`
   without the canvas import map (mirrors `doingPulseClass`/ADR-0014).
2. **Optional `cornerAction` render-prop.** The card renders an optional consumer
   control in the bottom-right meta slot. The styleguide owns look/placement and
   wraps the slot in a `stopPropagation` container so the action's click/keydown
   never bubbles to the card's own `onClick`; the consumer owns behavior. Absent →
   card unchanged. Render-prop was chosen over a config object (lighter touch;
   keeps the styleguide ignorant of the consumer's control). Also made the
   `updated` timestamp span conditional so the empty-meta dashboard cards don't
   emit a stray empty node.

Chose **not** to write an ADR: this extends ADR-0003 (unforked consumption) and
reuses the established pure-decision-in-react-free-module pattern (ADR-0014); the
render-prop choice is documented inline + in the BC README.

Canvas (`styleguide/index.html` via `app/app.js`) documents both new states — "No
estimate — chip hidden" and "Corner action" (a quiet copy-command icon button) —
in section 06 for both card directions, so the gate can re-review.

Dashboard `dist/` rebuilt (`cd dashboard && node build.mjs`); the bundle carries
`showEstimate` + the `cornerAction` slot. All 176 dashboard tests + 10 styleguide
tests pass.

Key files:
- `styleguide/app/card.js` (new — `showEstimate` pure decision)
- `styleguide/app/kanban.js` (conditional chip + `cornerAction` slot)
- `styleguide/app/app.js` (canvas: two new documented states)
- `styleguide/test/ticket-card.test.mjs` (new — 5 tests)
- `dashboard/dist/*` (rebuilt derived artifact)
- design-system `README.md` (TicketCard component contract)

Downstream: `agentic-workflow-016` (blocked on this) wires a backlog card's
`cornerAction` to copy the next command to the clipboard.
