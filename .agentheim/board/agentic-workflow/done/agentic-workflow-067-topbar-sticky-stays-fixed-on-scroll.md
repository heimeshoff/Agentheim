---
id: agentic-workflow-067
title: Topbar stays fixed at the top of the viewport when the board or a document scrolls
status: done
type: bug
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 35cc892
depends_on: [design-system-001]
blocks: []
tags: [dashboard, shell, topbar, layout, scroll]
related_adrs: [0009]
related_research: []
prior_art: [agentic-workflow-026, agentic-workflow-053]
---

## Why
The topbar — the global search field plus the standing **Work** launch (and the
settings gear between them) — is the dashboard's primary action bar. Today it
scrolls **out of view** as soon as the content under it grows past the viewport:
scroll down the board, or read a long ADR / research report / task in the main
pane, and the search box and Work button disappear off the top. The builder has to
scroll back up to search or launch work. Those controls should always be reachable.

## What
Keep the **topbar (`BoardTopbar`) pinned to the top of the viewport** while only the
content region below it scrolls — for **both** the board view and the main-pane
reader (and the workflow / about pages).

The cause is the shell frame, not the topbar markup. The outer shell `<div>`
(`dashboard/app/board.js`, the `DashboardApp` return — the `display: flex; flexDirection: row`
frame) is sized `minHeight: "100vh"` with **no height cap and no `overflow: hidden`**.
So when the main column's content is taller than the viewport, the *whole frame*
(rail + topbar + content) grows and the **window** scrolls, carrying the topbar with
it. The inner `scroll-quiet` region (`overflowY: "auto"`, the `flex: 1` wrapper that
holds `WorkflowPage` / `AboutPage` / `MainPaneReader` / `DashboardBoard`) never gets a
bounded height, so it never becomes the actual scroll container.

The fix is to **bound the shell frame to the viewport height** so the existing inner
`scroll-quiet` div is the only thing that scrolls — leaving the rail and topbar fixed.
The intended structure already exists (topbar is a sibling *above* the scroll region,
not inside it); it just needs the frame to stop growing past the screen.

## Acceptance criteria
- [ ] Scrolling the **board** keeps the topbar (search field, settings gear, Work) fully visible and fixed at the top.
- [ ] Scrolling a long **document in the main pane** (ADR / research / BC README / task full-screen) keeps the topbar fixed at the top.
- [ ] The **left rail** likewise stays put (it shares the same frame); only the main content area scrolls.
- [ ] No nested/double scrollbar on the window — the content region (`scroll-quiet`) is the sole vertical scroll container; the window does not scroll.
- [ ] Works in both light and dark themes and at narrow heights; no layout overflow clipping of the topbar's own controls (e.g. the search results popover still renders, not clipped by a new `overflow: hidden`).
- [ ] Styleguide consumed **unforked** (ADR-0003) — this is a board-local layout/sizing change in `dashboard/app/board.js`, no styleguide edit.
- [ ] The committed `dashboard/dist/app.js` esbuild bundle is rebuilt so the deployed app carries the change.

## Notes
- Seam: `dashboard/app/board.js` — the `DashboardApp` outer frame at the `minHeight: "100vh"` /
  `flexDirection: "row"` div (~`board.js:1880`). Likely fix: cap the frame to the viewport
  (`height: "100vh"` — consider `100dvh` for mobile browser chrome — plus `overflow: "hidden"`)
  so the inner `scroll-quiet` (`overflowY: "auto"`, ~`board.js:1898`) owns the scroll. Verify the
  topbar search-results **popover** (ds-016 `SearchField`) is not clipped by any new `overflow: hidden`
  on an ancestor — it floats out of the topbar; if it gets clipped, the clip must be confined to the
  scroll region, not the topbar's row.
- **Conflicts with in-flight chrome work:** aw-064 (topbar "What's next" + Work restyle) and aw-065
  (prompt-bar button redesign) both edit `dashboard/app/board.js` and rebuild `dashboard/dist/app.js`.
  `work` will need to serialize this against them (one worker per wave) — same conflict pattern noted for
  the recent dashboard batch. No logical dependency, just a file-level conflict.
- Prior art: **aw-026** built this left-rail shell + topbar-over-scrollable-board layout (the structure
  being corrected here); **aw-053** set the topbar's internal layout (search left, gear + Work flush right).
- Read-only / lifecycle untouched (ADR-0017): this is pure presentation sizing, no write path, no
  routing/`mainView` change.

## Outcome
Bounded the `DashboardApp` outer shell frame to the viewport: changed `minHeight: "100vh"`
(uncapped, which let the whole frame grow and the window scroll) to `height: "100dvh"` plus
`overflow: "hidden"`. The pre-existing inner `scroll-quiet` content region (`flex: 1`,
`minHeight: 0`, `overflowY: "auto"`) is now the sole vertical scroll container, so the left
rail and the topbar (search / gear / What's next / Work) stay fixed while the board, main-pane
reader, workflow and about pages scroll beneath them. No double/window scrollbar.

The topbar is a sibling ABOVE the scroll region; its search-results popover (ds-016 `SearchField`,
`position: absolute`, opens downward from the topbar at the top of the frame) renders within the
100dvh frame interior and is NOT clipped by the new `overflow: hidden`. The main-column flex
wrapper carries no clip of its own. No styleguide file edited (ADR-0003); no write path / routing
change (ADR-0017).

Key files:
- `dashboard/app/board.js` — `DashboardApp` outer frame (~line 2033).
- `dashboard/test/shell-relayout.test.mjs` — two new static guards (aw-067): frame is
  height-bounded (100dvh/100vh + overflow hidden, no minHeight 100vh) and the scroll-quiet
  region owns the scroll as a sibling below the topbar.
- `dashboard/dist/app.js` — esbuild bundle rebuilt (`node build.mjs`).
- BC README *Shell layout* section — documents the viewport-bounded frame + sole scroll container.

Full `node --test` suite green (535 pass / 0 fail).
