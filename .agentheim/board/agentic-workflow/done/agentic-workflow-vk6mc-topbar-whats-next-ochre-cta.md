---
id: agentic-workflow-vk6mc
title: Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts
status: done
type: feature
context: agentic-workflow
created: 2026-07-05
completed: 2026-07-05
depends_on: [design-system-vw12e, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, topbar, whats-next, skip-permissions]
related_adrs: [0016]
related_research: []
prior_art: [agentic-workflow-064, agentic-workflow-069, agentic-workflow-053, agentic-workflow-041, agentic-workflow-029]
---

## Why
The one genuine topbar *color* change the brief asks for. Several adjacent brief items — search at
the far left (1a position), the settings gear immediately left of What's-next, and the
skip-permissions **red-icon** armed cue — are **already true today**, so they only need explicit
regression protection while the surrounding reskin lands.

## What
Recolor the What's-next `LaunchButton` in `BoardTopbar` (`dashboard/app/board.js`) to the new ochre
CTA treatment (orange text on the warm-dark fill/border from the palette task), applying the
accent carve-out [[design-system-vw12e]]. Leave `Work`'s existing treatment untouched.

## Acceptance criteria
- [x] What's-next button renders from the new palette tokens (no hardcoded hex).
- [x] Global search field remains the topbar's **leftmost** element (1a position) — explicit
      regression check.
- [x] Ordering holds: settings gear immediately left of What's-next, which is immediately left of
      Work — no reorder.
- [x] **Skip-permissions-armed icon(s) still render `--obligation` red** regardless of the new ochre
      CTA — the aw-041 behavior explicitly re-verified, not assumed.

## Notes
- The "menu button" the builder wants kept is the aw-049 settings menu (shared `Menu` primitive,
  ds-015), carrying the theme + skip-permissions toggles (aw-029).
- Prior art: aw-064 (What's-next + Work restyle), aw-069 (button fires the whats-next skill),
  aw-053 (right-align settings/work), aw-041 (armed = red icon), aw-029 (topbar toggles).
- Depends on the palette [[design-system-a31e0]] and the accent decision [[design-system-vw12e]].

## Outcome
Added a new `LaunchButton` `emphasis="cta"` treatment in `dashboard/app/board.js` —
`--accent-ochre` text on an `--accent-ochre-soft` fill with an `--accent-ochre` border,
all named palette tokens (no hardcoded hex) — and switched the What's-next call site in
`BoardTopbar` from `liftOnHover` to `emphasis="cta"` (dropping `liftOnHover`, since the CTA
fill is now a persistent idle treatment rather than the quiet-until-hover chrome
`liftOnHover` normalises everything else to). A code comment at the `cta` definition and at
the What's-next call site cites ADR-0048's accent carve-out so a future reader doesn't
"fix" it back to de-emphasis. `Work` is untouched (`emphasis="primary"`, no ochre). The
armed-icon ternary was re-verified and left ordered `armed` before `cta`, so the
`--obligation` red cue always wins over the idle ochre fill (aw-041, explicitly re-checked,
not assumed).

Updated `dashboard/test/topbar-right-align.test.mjs`'s now-outdated "What's next ... never
ochre" test (it predated ADR-0048's carve-out) to assert the new `emphasis="cta"` instead.
Added `dashboard/test/topbar-whats-next-ochre-cta.test.mjs` (6 tests) covering: the `cta`
emphasis renders from named tokens with no hex; What's-next carries `cta` while Work stays
`primary`; the search field remains leftmost (1a) — regression; gear → What's-next → Work
ordering with nothing else between — regression; the armed-icon ternary orders `armed`
before `cta` — regression; and the What's-next call site still threads `skipPermissions`.
Full suite: 734 passing (baseline 728 + 6 new).

Updated the agentic-workflow BC README's Shell layout bullet to describe the ochre CTA
recolor and cite ADR-0048 / design-system-vw12e.

`dashboard/dist/app.js` rebuilt via `npm run build` (esbuild) — only `app.js` has a real
content diff (62 lines); `index.html`'s changed git-status flag is a line-ending artifact
with zero actual diff.

Key files: `dashboard/app/board.js`, `dashboard/test/topbar-whats-next-ochre-cta.test.mjs`,
`dashboard/test/topbar-right-align.test.mjs`, `.agentheim/contexts/agentic-workflow/README.md`,
`dashboard/dist/app.js`.
