---
id: agentic-workflow-018
title: Remove the non-functional "Add ticket" affordances from non-backlog columns
status: done
type: chore
context: agentic-workflow
created: 2026-06-14
completed: 2026-06-14
commit: a536cba
depends_on: [design-system-001]
blocks: []
tags: [dashboard, board, cleanup]
related_adrs: [0003, 0009]
related_research: []
prior_art: [agentic-workflow-016, agentic-workflow-006]
---

## Why
The board shows an "Add ticket →" button inside the *empty-state card* of every
lifecycle column (`styleguide/app/empty.js:21`), and a `+` add button in every
*column header* (the styleguide `ColumnHeader` `onAdd`). After aw-016 only the
**backlog** column does anything with these — backlog cards copy the modeling
command, and the backlog header `+` copies the bare command. On **todo / doing /
done** these affordances do nothing: clicking "Add ticket" in an empty todo column
is a dead button. Dead buttons read as "this is broken," not "this is intentionally
read-only," and the board is a projection of disk (ADR-0001) — you don't *add*
tickets to todo/doing/done from here; tickets arrive there by being modeled and
promoted.

## What
Stop rendering the add-ticket affordances on the non-backlog columns:

1. **Empty-state card (the explicit ask):** the `EmptyColumn` styleguide primitive
   must not render its "Add ticket →" button for todo / doing / done. The empty
   state keeps its inbox icon + "No tickets in <status>." copy — just no dead
   button. The cleanest seam (consistent with ds-006's optional `cornerAction`) is
   to make the affordance an **optional slot/prop** on `EmptyColumn`, default off,
   that the board only supplies for backlog.
2. **Column-header `+` (related dead affordance — confirm in refine/work):** the
   same `+` exists on every column header but is a no-op outside backlog. It is the
   same class of non-functional button. Remove it from todo / doing / done headers,
   leaving backlog's `+` intact. *(Flagged for the builder: the explicit request was
   the empty-card button; this header `+` is the obvious sibling. If you'd rather
   keep the header `+` for now, drop AC #2 and this stays empty-card-only.)*

Backlog's affordances are untouched by this task — the backlog redesign into two
launch buttons is aw-020.

## Acceptance criteria
- [ ] An empty **todo / doing / done** column renders no "Add ticket" button — only the icon and the "No tickets in <status>." copy.
- [ ] An empty **backlog** column still renders its add affordance (unchanged from today).
- [ ] The todo / doing / done **column headers** render no `+` add button; the backlog header `+` is unchanged. *(Drop this criterion if the builder elects empty-card-only.)*
- [ ] The change goes through the styleguide single source (`EmptyColumn` / `ColumnHeader`) and is consumed unforked by the board (ADR-0003) — the dashboard does not fork the primitives.
- [ ] Styleguide tests cover the optional affordance (present when supplied, absent by default); the existing dashboard suite stays green.
- [ ] The dashboard `dist/` is rebuilt so the served bundle carries the change.

## Notes
- Touches the design-system styleguide (`empty.js`, and `ColumnHeader` in
  `kanban.js`) plus the board wiring in `dashboard/app/board.js`. Small enough to do
  as one task; if the styleguide change wants its own design-system ticket during
  work, split it — the seam mirrors ds-006 → aw-016.
- Visual change to `EmptyColumn` / headers → the styleguide gate re-opens for a
  builder re-review on the canvas after implementation (same flow as ds-005 / ds-007).
- Prior art: aw-016 (wired these affordances for backlog), aw-006 (the board view).

## Outcome
Made both add-ticket affordances **optional slots** in the design-system styleguide
single source (ADR-0003), default OFF, mirroring ds-006's `cornerAction` precedent
that aw-016 used — no fork, consumed as-is by the board (ADR-0009):

- `styleguide/app/empty.js`: `EmptyColumn({ status, onAdd })` — the "Add ticket →"
  button now renders ONLY behind an `onAdd &&` guard. Absent -> just the inbox icon
  + "No tickets in <status>." copy.
- `styleguide/app/kanban.js`: `ColumnHeader({ status, count, onAdd })` — the header
  `+` button now renders ONLY behind an `onAdd &&` guard. Absent -> no `+`.
- `dashboard/app/board.js`: the board supplies `onAdd` to both `EmptyColumn` and
  `ColumnHeader` **only for backlog** (copying the modeling command, as aw-016 wired);
  the non-backlog branch is now `undefined` (was a truthy no-op `() => {}`), so
  todo / doing / done render no dead add button and no header `+`. Backlog is unchanged.

Tests (mirroring the source-grep style of ticket-card / collapsible suites):
`styleguide/test/add-affordance.test.mjs` — 5 new tests covering the optional slot
(present when supplied, absent by default) on both primitives + the board's
backlog-only wiring. Styleguide suite 23 -> 28 pass / 0 fail. Dashboard suite
unchanged at 210 pass / 0 fail (the `dist-build` test rebuilds + validates the
bundle, confirming dist is reproducible). `dashboard/dist/app.js` rebuilt via
`node build.mjs` so the served bundle carries the change.

No ADR — extends ADR-0003 + ADR-0009; the optional-slot pattern is the established
ds-006 / aw-016 seam.

**Styleguide gate reopens:** `EmptyColumn` and `ColumnHeader` are visual styleguide
primitives that changed (the empty-state button and header `+` are now conditionally
rendered). Per the ds-005 / ds-007 flow, the styleguide gate reopens for a builder
canvas re-review. The styleguide canvas demo (`Column` / `KanbanBoard`) still passes
a no-op `onAdd`, so the canvas continues to demonstrate the affordance.

Key files:
- `.agentheim/contexts/design-system/styleguide/app/empty.js`
- `.agentheim/contexts/design-system/styleguide/app/kanban.js`
- `.agentheim/contexts/design-system/styleguide/test/add-affordance.test.mjs`
- `dashboard/app/board.js`, `dashboard/dist/app.js`
</content>
</invoke>
