---
id: agentic-workflow-053
title: Topbar layout — search on the left, settings gear + Work flush right
status: done
type: bug
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: b210357
depends_on: [design-system-001]
blocks: []
tags: [dashboard, topbar, layout]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-052, agentic-workflow-049, agentic-workflow-026]
---

## Why
The dashboard main-column topbar is meant to read, left → right,
`[ search field ] … [ ⚙ ] [ Work ]` (aw-052 / aw-049) — search anchored on the
left, the settings gear and the standing Work launch anchored on the right. But the
actual layout (`dashboard/app/board.js`, `BoardTopbar`) never right-aligns the
control group: the search field is capped (`flex: 1, maxWidth: 520`) and the
gear+Work group has no left push, so on any viewport wider than the search cap the
group floats just to the right of the search field with **empty space trailing to
the edge** instead of sitting flush right. The bar visually doesn't match its own
documented intent.

## What
Right-align the settings gear + Work group in the topbar so it sits flush against
the right edge, while the search field stays anchored on the left. The fix is a
consumer-side flex tweak in `BoardTopbar` (`dashboard/app/board.js`) — e.g. a
`marginLeft: "auto"` on the right-hand `[ ⚙ ][ Work ]` group (or equivalent
`justify-content` / spacer). No styleguide component changes; the styleguide is
consumed unforked (ADR-0003).

## Acceptance criteria
- [ ] On a wide viewport, the settings gear + Work button sit **flush against the
      right edge** of the topbar (no trailing empty space to their right).
- [ ] The search field stays anchored on the **left**, keeping its bounded width
      (it does not stretch the full bar width).
- [ ] On a narrow viewport the controls still lay out gracefully (the search field
      yields space rather than overflowing or clipping the gear/Work group).
- [ ] No change to the styleguide source — only `dashboard/app/board.js` is touched.
- [ ] `dashboard/dist/` is rebuilt (esbuild, `node build.mjs`) so the deployed app
      carries the change.

## Notes
- Current layout: `board.js` `BoardTopbar` — the outer flex row holds `TopbarSearch`
  (renders `SearchField` with `flex: 1, maxWidth: 520`) then a `gap: 9` group div
  containing `SettingsMenu` + the Work `LaunchButton`. The group has no
  `marginLeft: auto`, so unconsumed free space collects after it (default
  `justify-content: flex-start`).
- This is purely presentational — no read-model, no lifecycle, no API change; the
  dashboard stays read-only (ADR-0017).
- The code comments at `board.js:1283` / `:1292` already assert the intended
  `[ search field ] … [ ⚙ ] [ Work ]` reading; this task makes the rendered layout
  honour it.

## Outcome
Right-aligned the topbar's settings-gear + Work control group by adding
`marginLeft: "auto"` to its `gap: 9` group div in `BoardTopbar`
(`dashboard/app/board.js`). The bounded search field (`TopbarSearch` →
`SearchField`, `flex: 1, maxWidth: 520`) stays left-anchored; all unconsumed free
space now collects ahead of the group, seating the gear + Work flush against the
topbar's right edge on wide viewports. On narrow viewports the search side yields
space first (no overflow/clip). Presentation-only — no read-model, lifecycle, or
API change (ADR-0017); styleguide consumed unforked, untouched (ADR-0003).

- Production change: `dashboard/app/board.js` (`BoardTopbar` group div), rebuilt
  into `dashboard/dist/` via `node build.mjs`.
- Test: `dashboard/test/topbar-right-align.test.mjs` — static guard asserting the
  group carries `marginLeft: auto` and the search field keeps its bounded
  left-anchored cap (the established source-reading idiom; no DOM harness exists).
- Full dashboard suite: 468 pass / 0 fail.
- Note: the comment annotating the change must avoid literal backticks — the
  surrounding `html\`...\`` template literal would otherwise terminate early
  (caught at esbuild build time).
</content>
</invoke>
