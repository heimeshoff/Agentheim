---
id: agentic-workflow-055
title: Settings menu content is off-center — equal whitespace left and right
status: done
type: bug
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: e653580
depends_on: [design-system-001]
blocks: []
tags: [dashboard, settings-menu, layout]
related_adrs: []
prior_art: [agentic-workflow-049]
related_research: []
---

## Why
The top-right settings gear dropdown (`SettingsMenu`, aw-049, built on the shared
`Menu` primitive) reads as visually off-center: its controls hug the left edge,
so the whitespace on the left and right of the menu content is unequal. The
builder wants the content centered — equal padding/whitespace on both sides.

## What
The `Menu` panel itself already has symmetric `padding: 10`
(`styleguide/app/menu.js`). The asymmetry comes from the **items**: in the panel's
flex column each `MenuItem` is stretched to the full panel width but is itself a
left-aligned `display: flex` row, so each control (the `ThemeToggle`, the
`SkipPermissionsToggle`, the Stop `LaunchButton`) sits flush left and the slack
collects on the right.

Make the left and right whitespace around the menu content equal so the dropdown
reads as balanced.

## Acceptance criteria
- [ ] In the open settings dropdown, the whitespace to the left of the menu
      content equals the whitespace to the right (no left-hug).
- [ ] All three controls (theme toggle, skip-permissions toggle, Stop dashboard)
      stay aligned consistently with each other — the fix is uniform, not
      per-item.
- [ ] Existing behavior is unchanged: the menu still opens/closes on the gear,
      Esc / outside-click dismiss, theme + skip-permissions toggles keep the menu
      open, Stop closes it; the skip-permissions `--obligation` armed hue stays on
      its toggle.
- [ ] No styleguide visual-language change beyond what the fix requires; the
      styleguide is consumed unforked (ADR-0003). If the cleanest fix is in the
      shared `Menu`/`MenuItem` primitive rather than the board-local
      `SettingsMenu`, file a `design-system` child task instead of forking.
- [ ] `dashboard/dist/app.js` rebuilt so the deployed app carries the change.

## Notes
- Implementation seam to weigh during work:
  - **Board-local** — adjust how `SettingsMenu` composes the controls into the
    `Menu` (e.g. stretch each control to fill its `MenuItem`, or center them).
    Lives in `dashboard/app/board.js` (`SettingsMenu`, ~line 1120). Keeps the
    shared primitive untouched.
  - **Shared primitive** — if the imbalance is really the `Menu`/`MenuItem`
    default item alignment (affecting any future consumer), fix it in
    `styleguide/app/menu.js` under a `design-system` task and consume unforked
    here (ADR-0003). There is exactly one consumer today (`SettingsMenu`), so
    either is defensible — prefer the smallest correct change.
- Read-only dashboard (ADR-0017): presentation-only, no lifecycle write.
- Related: aw-049 (the settings dropdown), aw-053 (topbar layout), ds-015 (the
  shared Menu/Popover primitive).

## Outcome
Centered the settings-dropdown content board-local in `SettingsMenu`
(`dashboard/app/board.js`): introduced one shared `centeredItem =
{ justifyContent: "center" }` style and applied it to all three `MenuItem` rows
(theme toggle, skip-permissions toggle, Stop dashboard). The shared `Menu` panel
already had symmetric `padding: 10`; the imbalance was that each `MenuItem` is a
left-aligned, non-stretched flex row in the panel's flex column, so each
content-sized control hugged the left and the slack collected on the right.
Centering each item's content makes the left/right whitespace read equal.

**Seam chosen — board-local, not the shared primitive.** The shared
`Menu`/`MenuItem` stays a body-agnostic, left-aligning generic menu (the correct
default for a menu); centering is this consumer's presentation choice. So no
`design-system` child task was needed and the styleguide is consumed unforked
(ADR-0003). One uniform style constant keeps the three controls aligned with each
other (acceptance criterion: uniform, not per-item). Existing behavior unchanged
(open/close, Esc/outside-click, toggles keep menu open, Stop closes, the
`--obligation` armed hue on the skip-permissions toggle) — only the row
`justifyContent` changed. Presentation-only, no lifecycle write (ADR-0017).

`dashboard/dist/app.js` rebuilt (`node build.mjs`). TDD via the project's static
source-guard idiom: new `dashboard/test/settings-menu-center.test.mjs` (3 tests);
full dashboard suite 474/474 pass.

Key files: `dashboard/app/board.js` (`SettingsMenu`), `dashboard/test/settings-menu-center.test.mjs`,
`dashboard/dist/app.js` (rebuilt, ADR-0003 derived artifact).
</content>
</invoke>
