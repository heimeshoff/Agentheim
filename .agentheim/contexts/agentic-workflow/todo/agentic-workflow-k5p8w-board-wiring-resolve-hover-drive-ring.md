---
id: agentic-workflow-k5p8w
title: Board wiring — resolve hover dependencies and drive the on-card ring for visible targets
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-d8q3n, design-system-w4t9k]
blocks: [agentic-workflow-h9v3m, agentic-workflow-r9k2p]
tags: [dashboard, board, dependencies, motion]
related_adrs: [0017, 0002, 0003]
related_research: []
prior_art: [agentic-workflow-012, agentic-workflow-014, agentic-workflow-n4h7q, agentic-workflow-030, design-system-008]
---

## Why
This is the core of `agentic-workflow-r9k2p`: given the projection now carries
`dependsOn`/`blocks` (agentic-workflow-d8q3n) and the styleguide can render a
directional dependency ring (design-system-w4t9k), the board needs to actually
resolve a hovered backlog/todo card's edges to concrete target cards and turn the
ring on for the ones currently rendered. This ships a complete, shippable slice on
its own — hidden/off-viewport handling is `agentic-workflow-h9v3m`'s layer on top.

## What
**1. Carry the fields into the card model.** `dashboard/app/board-data.js`'s
`treeTicket` currently drops any field it doesn't name; add
`dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : []` and the same for `blocks`,
so the arrays reach the board's pooled ticket objects.

**2. Pure resolver — `dashboard/app/board-dependencies.js`** (new module, mirroring
`board-sort.js` / `board-group.js`): given the hovered ticket and the full pooled set
of tickets (across all four columns/BCs), return the resolved, directional target-id
sets:

```js
export function resolveHoverDependencies(hoveredTicket, allTickets) {
  // → { waitingOn: Set<string>, holdingUp: Set<string> }
}
```

- `waitingOn` = `hoveredTicket.dependsOn`, resolved against the live id universe
  (dangling ids dropped, deduped via `Set`, hovered card's own id excluded).
- `holdingUp` = `hoveredTicket.blocks`, same resolution.
- A ticket appearing in both lists (malformed data) resolves deterministically —
  `waitingOn` wins (pure, defined precedence, never a throw).
- Only invoked for a hovered ticket whose `status` is `backlog` or `todo` — the
  trigger-scope gate lives here, one place.
- Pure, no DOM: `node --test`-able.

**3. Thin React glue — `board.js`.** Hover handlers on backlog/todo `BoardCard`s
lift a `hoveredId` (or `null`) into `DashboardApp`/`BoardColumn`-level state (untested
DOM glue, like the existing `hostHover` pattern for the trash-can reveal). While a
hover is active, every `BoardCard` checks whether its own id is in the resolved
`waitingOn`/`holdingUp` sets and passes the matching `dependencyRelation`
(`"waiting-on" | "holding-up" | undefined`) to `TicketCard`. No IntersectionObserver
here — a target that's currently rendered anywhere on the board gets the ring
regardless of scroll position; a target that's off-viewport-but-rendered harmlessly
carries the class (invisible until scrolled to, which reads correctly even before
`agentic-workflow-h9v3m` ships the edge-blink). A target hidden inside a *collapsed*
group has no DOM node at all, so it silently gets nothing extra here — that gap is
exactly what `agentic-workflow-h9v3m` closes.

Stamp `data-ticket-id={ticket.id}` on the `BoardCard` host `div` (it already has one
for the trash-can overlay) — `agentic-workflow-h9v3m` will need it for its
IntersectionObserver wiring; adding it here avoids a second pass over the same file.

## Acceptance criteria
- [ ] `board-data.treeTicket` carries `dependsOn`/`blocks` arrays (absent/malformed
      → `[]`) onto every pooled ticket.
- [ ] `resolveHoverDependencies` returns correctly split, deduped, dangling-id-dropped,
      self-excluded `waitingOn`/`holdingUp` sets; a hover source outside
      backlog/todo yields two empty sets; `node --test`-covered.
- [ ] Hovering a backlog/todo card with a `depends_on` target that's currently
      rendered anywhere on the board (any column, any BC) shows a **solid**
      dependency ring on that card.
- [ ] Hovering a backlog/todo card with a `blocks` target that's currently rendered
      shows a **dashed** ring on that card.
- [ ] Hovering a doing/done card shows no ring anywhere.
- [ ] Moving the pointer off the hovered card clears every ring.
- [ ] A ticket with neither `depends_on` nor `blocks` entries shows nothing on hover.
- [ ] A ticket with multiple entries in either direction rings all matching visible
      targets simultaneously.
- [ ] The dashboard `dist/` is rebuilt (`node build.mjs`) so the live board picks up
      `design-system-w4t9k`'s ring.

## Notes
Depends on `agentic-workflow-d8q3n` (the projection data) and `design-system-w4t9k`
(the ring class/token) — swap `agentic-workflow-r9k2p`'s placeholder
`design-system-001` dependency for `design-system-w4t9k` once this task's real
blocker is confirmed landed.

Deliberately excludes: collapsed-group markers, Done-peek markers, and off-viewport
edge blinks — all of `agentic-workflow-h9v3m`. This task's scope boundary is "pulse
what's rendered"; the next task's scope is "signal what isn't."
