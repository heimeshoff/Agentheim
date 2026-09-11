---
id: design-system-015
title: Shared Menu / Popover primitive for dropdown menus
status: done
type: feature
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 70ffde0
depends_on: [design-system-001]
blocks: []
tags: [captured, frontend, styleguide]
related_adrs: [ADR-0003]
related_research: []
prior_art: [design-system-005, design-system-006]
---

## Why
The dashboard's topbar settings menu (agentic-workflow-049) needs a **dropdown / popover** —
a trigger that opens a floating, dismissible panel of menu items. The styleguide has **no**
Menu / Dropdown / Popover primitive today (the only "Popover" reference is an `--shadow-md`
elevation-token comment in `foundations2.js`). So aw-049 builds a **board-local, token-matched
dropdown** — the established board-control precedent (the sort `<select>`, the group-by toggle),
the styleguide consumed unforked (ADR-0003).

That board-local control is the **first** consumer of a popover affordance. A second consumer
(or any future settings/overflow menu) would re-invent the same trigger + floating-panel +
dismiss-on-outside-click/Esc machinery, risking token drift — exactly the situation that
warranted extracting the shared `Collapsible` primitive (design-system-005, captured by
agentic-workflow-014). This task promotes the pattern to a shared styleguide primitive.

## What
Extract a shared `Menu` / `Popover` styleguide primitive (likely
`styleguide/app/menu.js` or `popover.js`) that owns:

- a **trigger** (an arbitrary child / button) that toggles an anchored floating panel;
- the **floating panel** at `--shadow-md` elevation (the "Popovers" elevation role already
  named in the token set), token-styled, theme-aware;
- **dismissal** on outside-click and Esc, and **keyboard operability** (focusable trigger,
  Enter/Space opens, focusable items, Esc closes);
- a **body-agnostic** item area — consumers compose their own menu items (toggles, launch
  buttons, etc.), the same "styleguide owns look/placement, consumer owns behavior" seam as
  ds-006's `cornerAction` and ds-005's `Collapsible`.

Then **retire the board-local dropdown** aw-049 ships, having the dashboard topbar consume the
shared primitive unforked (ADR-0003).

## Acceptance criteria
- [ ] A `Menu`/`Popover` primitive exists in the styleguide as a new module, authored with htm tagged templates (no JSX, ADR-0005), consumed unforked across the BC boundary (ADR-0003).
- [ ] It owns the open/close truth, renders an anchored floating panel at `--shadow-md`, and is body-agnostic about its item content.
- [ ] It dismisses on outside-click and Esc, and is fully keyboard-operable (focusable trigger, Enter/Space opens, focusable items, Esc closes).
- [ ] The dashboard topbar settings menu (aw-049) consumes the primitive; the board-local dropdown aw-049 introduced is **deleted** — no duplicate popover machinery remains.
- [ ] The styleguide canvas documents the primitive as a pattern, rendered in context.
- [ ] Styleguide tests + dashboard build/dist tests stay green; the dashboard `dist/` is rebuilt from source (`node build.mjs`).
- [ ] Styleguide gate re-reviewed by the builder if the extraction produces any visible change (per the ds-005 / ds-007 / ds-009 precedent).

## Notes
- Captured by **agentic-workflow-049** (topbar settings menu) — the board-local dropdown there
  is the interim; this task makes the affordance shared and retires it. Mirrors aw-014 → ds-005.
- Precedent for "styleguide owns the look, consumer drives the behavior": ds-006's `cornerAction`
  render-prop slot and ds-005's `Collapsible` (controlled/uncontrolled). Reuse that seam shape.
- No urgency: build only when a second popover consumer appears or the topbar menu is worth
  unifying. The board-local control (the sort `<select>`, group-by toggle) precedent shows a
  single board-local control can stand un-promoted indefinitely.

## Outcome

Extracted a shared **`Menu` / `Popover`** styleguide primitive and **retired** the
board-local dropdown `agentic-workflow-049` had shipped; the dashboard topbar settings
gear now consumes the primitive unforked (ADR-0003).

- **`styleguide/app/menu.js`** — the `Menu` primitive (+ `MenuItem` / `MenuDivider`
  sugar). A render-prop trigger toggles an anchored floating panel at `--shadow-md`;
  body-agnostic item area; controlled (`open` + `onOpenChange`) OR uncontrolled
  (`defaultOpen`); dismiss on Esc + outside-click (root-ref scoped so in-panel toggles
  keep it open); reduced-motion-aware reveal; keyboard-operable (focusable trigger,
  Enter/Space opens, focusable items, Esc closes). htm, no JSX (ADR-0005).
- **`styleguide/app/menu-state.js`** — the React-free decisions (`isControlled`,
  `isDismissKey`, `shouldDismissOnOutsideClick`, `isOpenKey`), mirroring
  `collapsible-state.js`; tested under `node --test` without the canvas import map.
- **`styleguide/app/app.js`** — new canvas section **10 "Menu & popover"**
  (`MenuSpecimen`, a gear trigger + panel in both ownership modes); Empty states moved
  to section 11.
- **`styleguide/test/menu.test.mjs`** — pure-state contract + source-guards (board
  consumes the primitive, no duplicate popover machinery remains, canvas documents it).
- **`dashboard/app/board.js`** — `SettingsMenu` re-expressed as a pure consumer of the
  shared `Menu`; all board-local popover machinery deleted. aw-049 behavior preserved
  (closed gear neutral, `--obligation` on the skip-perms toggle inside the open menu,
  toggles keep the menu open, Stop/Esc/outside-click close). The board drives the Menu
  CONTROLLED so it can close after a successful Stop.
- **`dashboard/test/settings-menu.test.mjs`** — the two assertions that grepped board.js
  for the now-deleted machinery (Esc/mousedown/useRef listeners, reduced-motion reveal)
  updated to assert the retirement (delegation to the primitive); the other 12 aw-049
  guards unchanged and green.
- **`dashboard/dist/`** rebuilt from source (`node build.mjs`).

Tests: styleguide `node --test` 51/51 green; dashboard `node --test` 412/412 green
(incl. the known-flaky SSE timing test, which passed this run).

Gate: this is a **visible styleguide change** (new documented Menu pattern, canvas
section 10) → the design-system gate is **reopened** for builder re-review (recorded in
the README per the ds-005/007/009 precedent).

Note for the orchestrator: the **agentic-workflow README's** aw-049 SettingsMenu prose
(if it describes the dropdown as board-local "popover machinery built from tokens") is
now mildly stale — the machinery moved into the shared `Menu` primitive. Per scope rules
I did NOT edit the agentic-workflow README; flag a follow-up if that prose needs a touch.
