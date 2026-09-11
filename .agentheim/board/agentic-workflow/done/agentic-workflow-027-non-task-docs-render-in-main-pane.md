---
id: agentic-workflow-027
title: Non-task documents render in the main content pane; the slide-over becomes task-only
status: done
type: decision
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 5210581
depends_on: [agentic-workflow-026, design-system-001]
blocks: []
tags: [dashboard, frontend, ui, slide-over, library, decision]
related_adrs: [0021, 0010, 0011, 0009, 0017, 0003]
related_research: []
prior_art: [agentic-workflow-007, agentic-workflow-008, agentic-workflow-009]
---

## Why

Today a **single** open-intent path sends *every* artifact — board tasks **and** non-task
documents (BC README, vision, context-map, ADR, research) — through one right-hand
slide-over (ADR-0010). Once the library tree lives permanently in the left rail (aw-026),
the old full-pane library surface is gone, and the builder wants a clicked **non-task
document** to render in the **main content area on the right side**, not in the slide-over.
**Tasks keep the slide-over** as a transient detail panel beside the board. This splits the
one open-intent sink into two, keyed on artifact kind, and is a genuine decision: it
supersedes ADR-0010's "one drawer for all artifacts" and reshapes ADR-0011's full-pane
library + `board↔library` toggle.

## What

Split `openIntent` routing in `DashboardApp` into **two sinks keyed on artifact kind**:

- A **task** intent (a board card click) continues into `SlideOver` — unchanged.
- A **non-task document** intent (a rail `TreeItem` click) sets a **selected-document**
  state that the **main pane** renders.

**The discriminator already exists, unambiguously** (verified at refinement): a board-task
intent carries a lifecycle **`status`**; a rail/library intent carries a styleguide content
**`type`** (`vision | map | context | adr | research`) and **no `status`** (see
`slide-over-data.js`'s `resolveType` and `library-data.js`'s `item` shape). So the
`onOpen` fork is exactly *"has `status` → task → slide-over; else → non-task document →
main pane"* — no new field on the intent shape is needed.

Introduce a **main-pane document reader** that fetches `GET /api/doc?path=` and renders the
markdown client-side via the styleguide **`Markdown`** primitive (independently exported
from `styleguide/app/primitives.js` — consumed unforked, **no** styleguide change, **no**
design-system child task). Reuse the existing doc-fetch mechanism
(`intentToDrawerItem` / `docUrl`) — **one** fetch mechanism, **two** render targets.

The main pane shows **either the board OR the selected document**. The **Board** `RailItem`
(aw-026) returns the main pane to the board and clears the selection — one source of truth
for "what the main pane shows". Retire the `view: "board" | "library"` toggle and the
full-pane `DashboardLibrary`; `treeToLibrary` data now feeds the rail tree (aw-026).

Because point 4 reverses ADR-0010 and reshapes ADR-0011, this is a `type: decision` task:
the worker writes a **BC-scoped ADR** alongside the small code change (they are inseparable
and belong in one commit), recording (1) non-task artifacts open in the main content pane,
the drawer is task-only; (2) the library tree relocates into the rail, the full-pane library
surface and the surface toggle are retired.

## Acceptance criteria

- [ ] Clicking a **non-task** library document in the rail (BC README, vision, context-map,
      ADR, research) renders it in the **main content area**, NOT the slide-over.
- [ ] Clicking a **board task card** still renders it in the **slide-over**, unchanged.
- [ ] The main-pane reader fetches `GET /api/doc?path=` and renders markdown client-side
      through the styleguide `Markdown` primitive, consumed unforked (ADR-0003).
- [ ] The rail's **Board** nav item returns the main pane to the board and clears the
      selected document; the selected rail row shows the styleguide selected edge while its
      doc is in the main pane.
- [ ] On first load / nothing selected, the main pane shows the **board** (the default).
- [ ] The full-pane `DashboardLibrary` surface and the `view: "library"` branch are retired;
      `treeToLibrary` data feeds the rail tree (aw-026); no dead toggle remains.
- [ ] The dashboard remains read-only; opening a doc in the main pane performs no write and
      does not alter the board projection.
- [ ] A new ADR (scope: `agentic-workflow`) records the open-intent split and supersedes /
      reshapes ADR-0010 and ADR-0011, with their `Status` / `Supersedes` / `Related` fields
      updated **bidirectionally**.

## Notes

Decomposed from a single capture by the orchestrator (tactical-modeler) into A→B; this is
task **B**, depending on aw-026 (task A — the shell relayout).

The orchestrator recommended **folding the ADR into this feature task** rather than a
standalone decision task ahead of the code: the change (one open-intent sink → two, plus a
main-pane reader) is small and inseparable from the decision, so an ADR written alongside
keeps them in one commit. If the builder would rather settle the ADR up front, the
orchestrator can draft it before work starts.

ADR-0010 currently states tasks **and** non-task artifacts render through one drawer path;
this task is where that becomes load-bearing to reverse — hence ADR-0010 sits in this task's
`related_adrs` but not aw-026's.

### Refinement 2026-06-15 (promoted backlog → todo)

Dependency `aw-026` landed (commit `0ab1f34`); `design-system-001` (styleguide gate) is done —
both deps met, gate satisfied. The builder chose to **keep the ADR folded into the worker's
commit** (orchestrator's recommendation), not draft it up front. Two load-bearing claims were
checked against the current code and **hold**:

- **`Markdown` is independently exported** — `design-system/styleguide/app/primitives.js:129`
  (`export function Markdown({ source })`). The main-pane reader imports it **directly** (its
  prop is **`source`**); today the slide-over reaches `Markdown` only *through* the `Drawer`
  (`slide-over.js`), so the reader is a new, separate consumption — still unforked (ADR-0003),
  still **no** design-system child task.
- **The artifact-kind discriminator is clean** — see *What* above (`status` present → task;
  absent → non-task doc). No change to the open-intent shape is required.

**Two-state selection model (implementation note).** Today `ShellRail` and `SlideOver` share the
**single** `openIntent` state (`board.js` `DashboardApp`, ~L930–946: `selectedId={openIntent?.id}`
feeds the rail; the same `openIntent` feeds the slide-over). After the split there are **two**
states:

- `openIntent` — task → `SlideOver`; drives the **board card** selection ring (unchanged).
- `selectedDoc` (new) — non-task doc → **main pane**; drives the **rail row's** selected edge.

So the rail's `selectedId` must follow **`selectedDoc`**, not `openIntent` — that is what AC bullet 4
("the selected rail row shows the styleguide selected edge while its doc is in the main pane")
turns on. The **Board** `RailItem` (currently `active={true}`, `onClick={() => {}}`) clears
`selectedDoc` and returns the main pane to the board; its `active` is true exactly when
`selectedDoc` is null (AC bullets 4–5).

## Outcome

The dashboard's single open-intent sink is split into two render targets keyed on
artifact kind. A board **task** (carries a lifecycle `status`) keeps the right-hand
slide-over; a non-task **document** (a rail row carrying a content `type`, no
`status`) now renders in the **main content pane**. The discriminator is the pure,
unit-tested `isTaskIntent` — no new intent field was needed.

Key files:
- `dashboard/app/intent-route.js` (NEW) — pure `isTaskIntent(intent)` router;
  unit-tested in `dashboard/test/intent-route.test.mjs` (5 tests).
- `dashboard/app/main-pane-reader.js` (NEW) — the main-pane document reader; reuses
  `docUrl`/`GET /api/doc` (one fetch mechanism) and renders through the styleguide
  `Markdown` primitive consumed unforked (ADR-0003). Read-only.
- `dashboard/app/board.js` — `DashboardApp` now holds two mutually-exclusive states
  (`openIntent` → SlideOver, `selectedDoc` → main pane); `onOpen` routes via
  `isTaskIntent`; the main column renders the reader OR the board (board default);
  the Board `RailItem` clears `selectedDoc` and is `active` exactly when no doc is
  selected; the rail `selectedId` follows `selectedDoc`.
- `dashboard/app/library.js` (REMOVED) — the dead full-pane `DashboardLibrary`
  surface; `library-data.js` (`treeToLibrary`) stays and feeds the rail tree (aw-026).
- `dashboard/test/main-pane-reader.test.mjs` (NEW) — static guard for the reader +
  the two-state split (8 tests).
- Dashboard suite: 272 → 285 green; committed `dist/` rebuilt.

Decision recorded in **ADR-0021** (open-intent split: tasks → slide-over, non-task
documents → main pane). ADR-0010 and ADR-0011 were updated bidirectionally (Status /
Reshaped-by / Related + an Update section each): ADR-0010's "one drawer for all
artifacts" is now task-only; ADR-0011 §5's `board↔library` toggle / single `view`
state is retired.
