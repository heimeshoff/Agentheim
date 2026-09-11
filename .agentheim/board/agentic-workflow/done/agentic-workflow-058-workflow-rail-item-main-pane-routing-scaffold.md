---
id: agentic-workflow-058
title: Workflow rail item + main-pane routing scaffold (third selection state)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: ad4a6f0
depends_on: [design-system-001]
blocks: [agentic-workflow-059, agentic-workflow-057, agentic-workflow-062]
tags: [frontend, ui, routing, scaffold]
related_adrs: [0003, 0009, 0017, 0021, 0025]
related_research: []
prior_art: [agentic-workflow-026, agentic-workflow-027, agentic-workflow-039]
---

## Why
The **Workflow guide page** (umbrella agentic-workflow-057) needs a home in the shell
before any of its content can be authored. The shell today holds exactly **two**
mutually-exclusive main-pane selections — `selectedDoc` (a non-task document → the
`MainPaneReader`, aw-027) and the board (the default) — plus the `openIntent` task →
slide-over split (ADR-0021). A built-in static page is **neither** a task (no lifecycle
`status`) **nor** a disk-fetched document (no `path`, no `/api/doc` fetch), so it does
not fit either state. This task lands the routing scaffold — a new **Workflow** rail
item and an explicit third main-pane view state — proving the wiring with a placeholder
page, so aw-059 (layout) and aw-060 (diagrams) can fill content without re-touching the
shell. Routing model is governed by **ADR-0025** (extends/reshapes ADR-0021).

## What
Add a **Workflow** `RailItem` to the left rail, directly **below the existing Board
item**, and an explicit third main-pane view state per ADR-0025:

- A new shell state `mainView` (`"board" | "workflow"`, default `"board"`) in
  `DashboardApp` (`dashboard/app/board.js`) — a third main-pane state beside
  `openIntent` (task → `SlideOver`) and `selectedDoc` (doc → `MainPaneReader`). **Not**
  a fourth field on any intent shape.
- `onSelectWorkflow` sets `mainView = "workflow"` and clears **both** `selectedDoc` and
  `openIntent`. Every existing handler that lands something else in the main pane —
  `onSelectBoard`, `onOpen` (both task and doc branches), `onOpenSearch`, and
  `onOpenFullScreen` (aw-039) — resets `mainView` to `"board"`.
- Main-pane render precedence becomes **`workflow → document → board`**.
- The Workflow `RailItem` renders below Board with `active=${mainView === "workflow"}`;
  the Board item's predicate widens from `!selectedId` to
  `mainView !== "workflow" && !selectedDoc`. The library tree's `selectedId` still
  follows `selectedDoc` alone (cleared by `onSelectWorkflow`, so no two rail rows
  highlight at once).
- `intent-route.js` (`isTaskIntent`) and `main-pane-reader.js` are **not** edited —
  ADR-0021's discriminator stays byte-unchanged.
- The Workflow page body is a **placeholder** in this task (e.g. a simple
  token-styled "Workflow" heading). This task proves the **routing**, not the content;
  aw-059 supplies the real layout.

The page is **static and built into the app**, **read-only** over `.agentheim/`
(ADR-0017), and composed from styleguide tokens/primitives consumed **unforked**
(ADR-0003) — no styleguide edit, no new bundled dependency.

## Acceptance criteria
- [ ] A **Workflow** `RailItem` appears directly **below Board** in the left rail and is
      keyboard-operable, consistent with the existing `RailItem` treatment.
- [ ] Selecting **Workflow** shows the built-in page (a placeholder is acceptable for
      this task) in the **main content area**; the rail's Workflow item reads `active`
      and the Board item does not.
- [ ] Selecting **Board** returns the main pane to the board; opening a task still
      routes to the slide-over; opening a rail document still routes to the
      `MainPaneReader` — **no regression** of the aw-027 / ADR-0021 task-vs-doc split.
- [ ] The three main-pane states (board / document / workflow) are **mutually
      exclusive by construction** — opening any one clears the others; no two rail rows
      highlight at once; the workflow page never lingers under a later board/doc click.
- [ ] `intent-route.js` (`isTaskIntent`) is **byte-unchanged**; the static page is never
      routed as an open-intent.
- [ ] Read-only — introduces no write path over `.agentheim/` (ADR-0017); styleguide
      consumed unforked (ADR-0003); no new bundled runtime dependency.
- [ ] `dashboard/dist/` is rebuilt so the deployed app carries the scaffold.

## Notes
- **ADR-0025** is the governing decision (Proposed) — read it before implementing; it
  spells out the precedence, the handler resets, and the rail-active predicates. ADR-0021
  is reshaped by it.
- The one mechanical risk ADR-0025 calls out: a **missed `setMainView("board")` reset**
  in an existing handler would let the workflow page persist under a later click. Thread
  the reset through **every** main-pane handler and assert it in tests.
- Conflict check: aw-056 (in todo) edits only `library-data.js` (`GROUP_ORDER`); it does
  **not** touch `board.js`'s selection model — no same-file collision.
- Pure-logic seam: if any non-trivial routing predicate is worth isolating, keep it in a
  small `node --test`-able module per the project idiom (like `intent-route.js`), but the
  `mainView` state itself lives in the shell.
- Frontend gate met: `design-system-001` (styleguide) is in `done/`.

## Outcome
Landed the third main-pane view state per ADR-0025. The shell (`DashboardApp` in
`dashboard/app/board.js`) now holds `mainView` (`"board" | "workflow"`, default
`"board"`) beside `openIntent` and `selectedDoc`. A built-in static **Workflow** page
(`WorkflowPage`, placeholder heading only — aw-059 supplies the real layout) renders
in the main pane with precedence **workflow → document → board**. A dedicated
`onSelectWorkflow` handler sets `mainView="workflow"` and clears both `selectedDoc` and
`openIntent`; every existing main-pane handler — `onSelectBoard`, `onOpen` (reset
threaded ahead of the `isTaskIntent` split so both branches clear it), `onOpenSearch`,
`onOpenFullScreen` — resets `mainView` to `"board"`, so the page can never linger under
a later board/doc click. A **Workflow** `RailItem` (styleguide `compass` icon —
`route` is absent from the unforked icon set) sits directly below Board; Board's active
predicate widened to `mainView !== "workflow" && !selectedId`, Workflow's is
`mainView === "workflow"`. `intent-route.js` (`isTaskIntent`) and `main-pane-reader.js`
are byte-unchanged (ADR-0021). Read-only, styleguide unforked, no new dependency.

Key files: `dashboard/app/board.js` (shell + `ShellRail` + `WorkflowPage`),
`dashboard/test/workflow-rail-routing.test.mjs` (12 new static-guard tests),
`dashboard/test/shell-relayout.test.mjs` (rail now has two nav items),
`dashboard/dist/app.js` (rebuilt). BC README updated (rail + main-pane states).
Full dashboard suite green: 486 tests.

The `mainView` enum is deliberately extensible — aw-062's "about" page is a one-line
enum + precedence addition.
