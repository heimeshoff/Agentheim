---
id: design-system-009
title: Drawer header — drop the Copy button, rename "Open in editor" → "Open in full screen", expose a callback
status: done
type: feature
context: design-system
created: 2026-06-15
completed: 2026-06-15
commit: 96bd905
depends_on: [design-system-001]
blocks: [agentic-workflow-039]
tags: [styleguide, drawer, slide-over, dashboard]
related_adrs: [0003, 0010]
related_research: []
prior_art: [design-system-006, design-system-007]
---

## Why

The styleguide `Drawer` header (`styleguide/app/drawer.js`, both `HeaderMinimal` and
`HeaderContextual`) carries two icon buttons that do nothing — they have no `onClick`:

- `IconButton name="copy" title="Copy path"`
- `IconButton name="square-arrow-out-up-right" title="Open in editor"`

On the live dashboard the `Drawer` is the task slide-over (consumed **unforked**, ADR-0003),
so these two dead buttons sit at the top of every opened ticket. The builder wants the **Copy**
button gone entirely, and the **Open in editor** button repurposed into a real, useful action:
**Open in full screen** — render the document in the main content pane (where ADRs / decisions /
non-task docs already render, agentic-workflow-027). Because the dashboard consumes the `Drawer`
unforked, the header change must happen **in the styleguide**, not bolted on board-side.

## What

Two changes to the styleguide `Drawer` header (`styleguide/app/drawer.js`), keeping it the single
source of UI truth and following the **consumer-owns-behavior** render-prop/callback precedent of
the `TicketCard` `cornerAction` slot (design-system-006):

1. **Remove the Copy button.** Drop the `IconButton name="copy" title="Copy path"` from both
   `HeaderMinimal` and `HeaderContextual`. No replacement — it is dead and unwanted. In
   `HeaderMinimal` a vertical hairline divider currently sits between the action buttons and Close
   (`drawer.js:62`); it must **not dangle** once Copy is gone and "Open in full screen" may be
   absent — render the divider only when an action button precedes it (or drop it).
2. **Rename + wire "Open in editor" → "Open in full screen".** Relabel the
   `square-arrow-out-up-right` button (its `title` / `aria-label`) to **"Open in full screen"**, and
   make it fire an optional `onOpenFullScreen` callback the consumer supplies. The styleguide owns
   the button's look + placement; the consumer owns the behavior. When no callback is supplied the
   button is **not rendered** (the `cornerAction` precedent: absent slot → nothing), so the canvas
   demo either supplies a no-op handler to keep documenting it or shows the header without it.

The quiet-by-default law holds: no new hue, token-styled, same ghost `IconButton` treatment.

## Acceptance criteria

- [ ] Neither `HeaderMinimal` nor `HeaderContextual` renders a "Copy path" button anymore.
- [ ] The remaining action button reads **"Open in full screen"** (title + `aria-label`), not "Open in editor".
- [ ] The "Open in full screen" button fires an optional `onOpenFullScreen` callback passed to the `Drawer`; activating it calls that callback.
- [ ] When `onOpenFullScreen` is not supplied, the button is not rendered (no dead/no-op button) — mirrors the `cornerAction` absent-slot contract. This holds for **both** `HeaderMinimal` and `HeaderContextual`.
- [ ] In `HeaderMinimal`, the divider before the Close button does not dangle when no action button precedes it (renders only when an action is present, or is dropped).
- [ ] The `Drawer`'s existing behavior (open/close animation, Esc + scrim-click close, markdown body) is unchanged.
- [ ] The styleguide canvas (`styleguide/index.html`) Drawer demo **supplies an `onOpenFullScreen` handler so the "Open in full screen" button is visibly rendered** (no Copy button beside it) — the builder must be able to see and approve the new action when the gate is re-reviewed.
- [ ] Existing dashboard imports of `Drawer` keep working unforked (ADR-0003); the dashboard `dist/` is a derived artifact and must be rebuilt to pick up the change.

## Notes

- **Source verified (refine 2026-06-15):** the styleguide lives at
  `.agentheim/contexts/design-system/styleguide/` — paths in this task (`styleguide/app/drawer.js`)
  are relative to the BC root, per the BC README's pointer convention. `HeaderMinimal` (`drawer.js:60-61`)
  and `HeaderContextual` (`drawer.js:79-80`) both carry the two dead, `onClick`-less buttons as described.
  `Drawer` (`drawer.js:99`) currently passes only `info` + `onClose` to the header components, so the
  worker threads `onOpenFullScreen` through `Drawer` → `HeaderMinimal`/`HeaderContextual`.
- **Callback signature (settled):** the action fires a **bare `onOpenFullScreen()`** — the consumer
  (the dashboard slide-over) already owns the open `item`, so the drawer need not pass it back. A
  single prop on `Drawer`, threaded to both headers. This keeps the styleguide owner of
  look/placement and the consumer owner of behavior (the ds-006 `cornerAction` precedent). If a
  worker finds passing the current item materially simpler for the canvas demo, that's an acceptable
  variation — but the default is the no-arg callback.
- The `copy` glyph stays in the icon set (`icons.js`) — it is used elsewhere (the styleguide canvas
  copy-command button); only the Drawer-header usage is removed.
- **Gate:** this is a visible styleguide change (the slide-over header on every page that shows a
  Drawer), so it **reopens the design-system gate** — re-review with the builder before the
  agentic-workflow wiring (agentic-workflow-039) ships. Same precedent as ds-005 / ds-007.
- Downstream consumer: **agentic-workflow-039** wires `onOpenFullScreen` to render the task in the
  dashboard main pane.

## Outcome

The styleguide `Drawer` header (`styleguide/app/drawer.js`) now carries a single quiet
action instead of two dead buttons:

- **Copy button removed** from both `HeaderMinimal` and `HeaderContextual` (the `copy`
  glyph stays in `icons.js`, still used by the canvas copy-command button).
- **"Open in editor" → optional "Open in full screen".** The `square-arrow-out-up-right`
  button is relabelled (title + `aria-label`) and fires a bare optional
  `onOpenFullScreen()` callback threaded `Drawer` → both headers. **Absent callback →
  the button is not rendered** (ds-006 `cornerAction` absent-slot precedent), for BOTH
  headers. In `HeaderMinimal` the hairline divider before Close is guarded by the same
  callback so it never dangles. `IconButton` now forwards an `aria-label` (defaults to
  `title`).
- The Drawer's open/close animation, Esc + scrim-click close, and markdown body are
  unchanged.
- The canvas (`styleguide/app/app.js`, section 07) supplies `onOpenFullScreen` on both
  header demos so the action renders visibly for the gate re-review (no Copy beside it).

Tests: new `styleguide/test/drawer.test.mjs` (7 source-reading static guards) — all
green. The dashboard `dist/` was rebuilt (`cd dashboard && node build.mjs`) to fold the
unforked Drawer change into `dashboard/dist/app.js`; the dashboard suite stays green
(353 pass). The dashboard slide-over consumes `Drawer` unforked and passes no callback
yet (correct — `agentic-workflow-039` wires it later).

Key files: `styleguide/app/drawer.js`, `styleguide/app/app.js`,
`styleguide/test/drawer.test.mjs`, `dashboard/dist/*` (derived), BC README.

**Gate:** this visible header change **reopens the design-system gate** (recorded in the
BC README, ds-005/007 precedent) — re-review with the builder before `agentic-workflow-039`.

**Worker note:** running the styleguide suite surfaced one PRE-EXISTING failure unrelated
to this task — `styleguide/test/add-affordance.test.mjs` asserts against
`dashboard/app/board.js`, which has dropped its `onAdd` wiring. Filed as
`design-system-011` (backlog). Not fixed here (out of scope; crosses into board wiring).
</content>
</invoke>
