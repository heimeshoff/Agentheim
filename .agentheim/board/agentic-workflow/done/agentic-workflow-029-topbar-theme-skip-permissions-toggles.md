---
id: agentic-workflow-029
title: Move the theme + skip-permissions toggles to the topbar, left of the Work button
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 39447ec
depends_on: [design-system-001]
blocks: []
tags: [dashboard, shell, topbar, theme, skip-permissions]
related_adrs: [0009, 0003, 0019, 0018]
related_research: []
prior_art: [agentic-workflow-026, agentic-workflow-017, agentic-workflow-021]
---

## Why
aw-026 relocated the **theme (brightness) light/dark toggle** (aw-017) and the
**skip-permissions armed toggle** (aw-021) into the **rail footer**, while the **Work**
launch became the inverse primary action in the main-column **topbar** (top right). The
builder wants these two controls back at the top right where the eye already lands for
session actions — grouped with Work rather than tucked into the bottom of the left rail.
The toggles read as session-level controls, so they belong next to the session launch, not
in the rail footer.

## What
Move both controls out of the `ShellRail` footer and into the **main-column topbar**,
rendered to the **left of** the inverse **Work** launch button (so the top-right cluster
reads, left → right: `[ theme toggle ] [ skip-permissions toggle ] [ Work ]`). The rail
footer no longer renders these two controls (it becomes empty and is dropped, or retains
only whatever non-toggle content it held — today it held only these two).

Everything else about the two controls is unchanged — only their **home** moves:

- The theme toggle keeps consuming the styleguide `ThemeToggle` unforked (ADR-0003), still
  feeding `ThemeCtx.Provider` + the `data-theme` documentElement effect, persistence via
  `theme-state.js` untouched (aw-017).
- The skip-permissions toggle keeps its **armed / danger** (`--obligation`) treatment, its
  **off-by-default** persistence via `skip-permissions-state.js`, and its threading of the
  `skipPermissions` flag through `launchOrCopy` for every bridge launch (aw-021 / ADR-0019,
  ADR-0018). The per-launch "skips permissions" cue on the launch buttons is unaffected.
- The dashboard stays **read-only** (ADR-0017) — this is pure presentation-layer relayout,
  no lifecycle write, no new persistence store.

## Acceptance criteria
- [ ] The theme (brightness) toggle and the skip-permissions armed toggle render in the
      main-column **topbar**, positioned to the **left of** the inverse Work launch button.
- [ ] Left-to-right order in the top-right cluster is: theme toggle, skip-permissions toggle,
      Work button.
- [ ] The `ShellRail` footer no longer renders either toggle (the footer section is removed
      if it now holds nothing else).
- [ ] The skip-permissions toggle keeps its armed/danger (`--obligation`) treatment and its
      off-by-default persisted state; arming it still threads `skipPermissions` through every
      bridge launch and the per-launch cues still reflect the armed state.
- [ ] The theme toggle keeps its persisted light/dark behaviour (system default on first
      visit, remembered override after) and animated flip.
- [ ] Both controls are consumed from the styleguide **unforked** (ADR-0003); no styleguide
      source is modified.
- [ ] The dashboard `dist/` bundle is rebuilt to carry the relocated controls.
- [ ] The shell relayout tests (`shell-relayout.test.mjs`) are updated: the toggles are now
      asserted in the topbar (left of Work), not the rail footer; the dashboard suite stays
      green.

## Notes
- This is a **partial reversal** of aw-026's footer placement, scoped to these two controls
  only — the rest of the aw-026 left-rail shell (brand → Board `RailItem` → divider →
  "Workspace" label → live `treeToLibrary` tree) is unchanged.
- The topbar already renders a single inverse Work `LaunchButton` (aw-026); this adds the two
  toggles as siblings to its left, a board-local token-matched flex cluster — the styleguide
  has no "topbar action group" primitive, so compose from the existing primitives (the
  board-control precedent, ADR-0003).
- Touch points: `dashboard/app/board.js` (the `ShellRail` footer + the main-column topbar),
  the dist rebuild, and `shell-relayout.test.mjs`. No change to `theme-state.js`,
  `skip-permissions-state.js`, or `launchOrCopy`.
- Frontend gate satisfied: `design-system-001` (styleguide) is done.

## Outcome
Moved the theme + skip-permissions toggles out of the `ShellRail` footer and into the
main-column `BoardTopbar`, grouped left of the inverse Work launch (left → right:
`[ theme ][ skip-permissions ][ Work ]`). The rail footer section was dropped (it held
only these two controls), and `ShellRail` shed its now-unused `theme/setTheme/
skipPermissions/setSkipPermissions` props — `DashboardApp` now threads those into
`BoardTopbar` instead. Both controls stay consumed from the styleguide unforked
(ADR-0003): `ThemeToggle` keeps its `theme-state.js` persistence + `data-theme` flip
(aw-017), and `SkipPermissionsToggle` keeps its `--obligation` armed/danger treatment,
off-by-default `skip-permissions-state.js` persistence, and `skipPermissions` threading
through `launchOrCopy` (aw-021 / ADR-0019 / ADR-0018). No styleguide source, no state
module, and no launch path was touched — pure presentation relayout.

- Key file: `dashboard/app/board.js` (`ShellRail`, `BoardTopbar`, `DashboardApp`).
- Dist rebuilt: `dashboard/dist/app.js` (`npm run build`).
- Tests: `dashboard/test/shell-relayout.test.mjs` updated — the footer-toggle guard
  flipped to assert the toggles render in the topbar in `[theme][skip-perms][Work]`
  order, and a guard added that the rail no longer renders either toggle. Suite 13/13
  green in isolation; full dashboard suite green apart from a pre-existing flaky
  `events.test.mjs` SSE filesystem-watch timing test (passes on isolated re-run,
  unrelated to this change).
