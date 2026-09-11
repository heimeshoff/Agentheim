---
id: agentic-workflow-033
title: Work button follows the active theme instead of the inverse light/dark treatment
status: done
type: bug
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 4e6f537
depends_on: [design-system-001]
blocks: []
tags: [dashboard, topbar, theme, work-button]
related_adrs: [0009, 0003]
related_research: []
prior_art: [agentic-workflow-026, agentic-workflow-024, agentic-workflow-017]
---

## Why
The main-column topbar Work launch is rendered with `emphasis="inverse"` (aw-026 / the
styleguide §05 "Components in context" treatment): `background` + `border: var(--fg-1)`,
`color: var(--surface-0)`. By design that makes the button the *opposite* of the page
scheme so it reads as a standout primary action — a light chip on the dark page, a dark
chip on the light page.

In use it reads wrong: the Work button looks like it belongs to the *other* theme than
the one the dashboard is in. The builder wants the button to **follow the active scheme**,
not invert it — light fill + dark text in light mode, dark fill + light text in dark mode,
like a normal theme-following primary button.

## What
Change the topbar Work launch (`BoardTopbar`, `dashboard/app/board.js`) so it no longer
uses the `inverse` treatment. It should render as a primary action that **follows the
active theme**:

- Light mode → dark text on a light fill.
- Dark mode → light text on a dark fill.

The existing `emphasis="primary"` `LaunchButton` variant already does exactly this
(`idleBg: var(--surface-2)`, `idleColor: var(--fg-1)`, `idleBorder: var(--hairline-strong)`),
so the likely change is switching the topbar Work button from `emphasis="inverse"` to
`emphasis="primary"`. The worker decides whether `primary` is the right fit or a small
dedicated treatment is warranted; either way the styleguide stays consumed **unforked**
(ADR-0003) and no new hue/token is introduced.

Everything else about the Work launch is unchanged — it still launches the bare
`/agentheim:work` (`WORK_COMMAND`) via `launchOrCopy`, still threads `skipPermissions`
(aw-021 / ADR-0019), still passes no `onResult`, and stays read-only (ADR-0017). Only its
light/dark appearance changes.

## Acceptance criteria
- [ ] The topbar Work button is no longer rendered with `emphasis="inverse"`.
- [ ] In **light** mode the Work button shows dark text on a light fill (follows the scheme).
- [ ] In **dark** mode the Work button shows light text on a dark fill (follows the scheme).
- [ ] The Work button still launches `/agentheim:work` via `launchOrCopy`, still threads
      `skipPermissions` when armed, and the dashboard stays read-only.
- [ ] The styleguide is consumed unforked (ADR-0003) — no styleguide source edited, no new
      token/hue added.
- [ ] The dashboard `dist/` bundle is rebuilt.
- [ ] Any test (e.g. `shell-relayout.test.mjs`) or README wording that asserts/describes the
      Work button as "inverse" is updated to the theme-following treatment; the dashboard
      suite stays green.

## Notes
- Touch points: `dashboard/app/board.js` (`BoardTopbar`, and possibly the `inverse` branch
  of `LaunchButton` if it becomes unused), the dist rebuild, and any test/README copy that
  names the Work button "inverse".
- **Interaction with aw-029** (currently in `doing/`): aw-029 places the theme +
  skip-permissions toggles "left of the **inverse** Work button". This task removes that
  inverse treatment, so the README/test phrasing both touch ("inverse Work launch") will
  need reconciling — coordinate wording with whichever lands second. No hard `depends_on`;
  they touch the same button but not in a blocking way.
- `emphasis="inverse"` was introduced for this button in **aw-026**; if no other consumer
  uses it after this change, the worker may leave the variant in place (still a valid
  styleguide §05 treatment) or note it as dead — not required to remove it.
- Frontend gate satisfied: `design-system-001` (styleguide) is done.

## Outcome
The main-column topbar **Work** launch now FOLLOWS the active theme instead of inverting
it. The single-line change in `BoardTopbar` switched the Work `LaunchButton` from
`emphasis="inverse"` to `emphasis="primary"` (`dashboard/app/board.js:946`). The existing
`primary` variant already renders theme-following tokens (`idleBg: var(--surface-2)`,
`idleColor: var(--fg-1)`, `idleBorder: var(--hairline-strong)`), so it is light fill + dark
text in light mode and dark fill + light text in dark mode automatically — light/dark
follow the `data-theme` documentElement scheme (aw-017). The aw-030 hover `onMouseLeave`
branch (`inverse ? "var(--fg-1)" : idleBg`) now naturally restores the `primary` idleBg,
which is correct.

Everything else about Work is unchanged: bare `WORK_COMMAND` via `launchOrCopy`, threads
`skipPermissions`, passes no `onResult`, stays read-only (ADR-0017). Styleguide consumed
unforked (ADR-0003) — no styleguide source edited, no new token/hue. The `inverse`
`LaunchButton` variant is LEFT in place (now unused by the dashboard, but still a valid
§05 treatment another surface may want).

Wording reconciliation: `dashboard/test/shell-relayout.test.mjs` updated red-first — the
"theme-following Work launch" test now asserts the Work button is NOT `inverse`, and the
Work-launch test asserts `emphasis="primary"`. The "LaunchButton supports an inverse
emphasis" guard is retained (the variant stays). The BC README topbar/theme prose reworded
from "inverse Work launch" to "theme-following / primary". `dist/` rebuilt (`npm run build`);
full suite green (305 tests).

Key files:
- `dashboard/app/board.js` — `BoardTopbar` Work button `inverse` → `primary` + header comment
- `dashboard/test/shell-relayout.test.mjs` — assertions + header reworded
- `dashboard/dist/app.js` — rebuilt bundle
- `.agentheim/contexts/agentic-workflow/README.md` — topbar/theme prose reworded
