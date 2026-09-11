---
id: design-system-017
title: Add the trash-2 glyph to the shared icon set
status: done
type: feature
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 984d317
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-048]
tags: [styleguide, icons, glyph]
related_adrs: [0003]
related_research: []
prior_art: []
---

## Why
The board's per-card dismiss affordance (agentic-workflow-048) needs a trash-can icon, and
the shared icon set (`styleguide/app/icons.js`, the `LUCIDE` dictionary) has no trash
glyph. The board consumes icons exclusively via `Icon name="…"` and never hand-rolls inline
SVGs, so the right home for a reusable trash icon is the one shared set — not a board-local
fork (ADR-0003). The builder chose this over a board-local inline SVG (2026-06-16).

## What
Add the Lucide **`trash-2`** glyph to the `LUCIDE` map in `styleguide/app/icons.js` so it
renders through the existing `Icon` component like every other glyph, **and surface it in
the canvas's curated interface-set gallery** (section 04 Iconography, `foundations2.js`).

The builder chose (2026-06-16) to document the glyph on the canvas rather than leave it an
undocumented dictionary entry (the `box` / `compass` / `maximize` precedent) — so this is a
*visible* styleguide change that reopens the design-system gate (see Notes).

- **Dictionary entry.** Add `trash-2` to `LUCIDE` using Lucide's upstream geometry: inner
  `<path>`/`<line>` markup only (the wrapper `<svg>` with `viewBox="0 0 24 24"`,
  `stroke="currentColor"`, `stroke-linecap/linejoin="round"` is supplied by `Icon`).
- **Gallery entry.** Append `"trash-2"` to the curated `ui` array in `IconSection`
  (`foundations2.js:135`) so it renders in the "Interface set · 1.5px · monochrome" grid.
  The gallery is a hand-picked subset of `LUCIDE`, not auto-derived — the glyph does not
  appear there unless explicitly added.
- No change to the `Icon` component's API or rendering, and no other glyph changes.

## Acceptance criteria
- [ ] `LUCIDE["trash-2"]` exists in `styleguide/app/icons.js` with the upstream Lucide
      `trash-2` geometry (see Notes for the exact path data).
- [ ] `"trash-2"` is present in the `ui` array of `IconSection` (`foundations2.js`) and
      renders in the section-04 interface-set gallery on the canvas.
- [ ] `<${Icon} name="trash-2" />` renders the trash can at any `size`/`color`, matching
      the stroke weight and visual balance of the existing glyphs.
- [ ] No other glyph changes and the `Icon` component's signature is unchanged.

## Notes
- **Exact upstream Lucide `trash-2` inner geometry** (use verbatim):
  ```
  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
  ```
  Note the lid-handle path is **symmetric** — `c1 0 2 1 2 2`, not `c1 0 1 1 2 2`. An earlier
  draft of this task carried the asymmetric control points, which would ship a subtly
  distorted lid; the worker should use the geometry above. If upstream Lucide has drifted,
  match the current upstream path — the entries in this file track Lucide geometry.
- **Gate impact (builder decision 2026-06-16).** Because the glyph now renders on the canvas
  (section 04), this is a visible styleguide change and **reopens the design-system gate**
  per the ds-005 / 007 / 009 / 014 / 015 precedent. The worker must add the gate-reopen note
  to the design-system README and the builder re-reviews the canvas (the section-04 gallery
  showing the new trash can) **before agentic-workflow-048 ships**.
- Consumed unforked by aw-048, which tints it with the `--obligation` danger token at the
  call site (the glyph itself carries no color — `Icon` defaults to `currentColor`).
- Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003); this
  styleguide change only affects the canvas + bundled `Icon` set, and `dist/` is rebuilt by
  the consuming task (aw-048) when the trash can actually renders on the board.

## Outcome
Added the Lucide **`trash-2`** glyph to the shared icon set so the board's dismiss
affordance (aw-048) can consume it unforked via `Icon name="trash-2"`.

- **Dictionary entry** — `LUCIDE["trash-2"]` added to `styleguide/app/icons.js` with the
  exact upstream Lucide inner geometry (lid line, can body, lid handle with the *symmetric*
  control points `c1 0 2 1 2 2`, and the two body slats). Inner markup only; the wrapping
  `<svg>` is supplied by `Icon` (API unchanged).
- **Gallery entry** — appended `"trash-2"` to the curated `ui` array in `IconSection`
  (`styleguide/app/foundations2.js`), so the glyph renders in the section-04
  "Interface set · 1.5px · monochrome" grid on the canvas.
- **Tests** — added `styleguide/test/icons-trash.test.mjs` (3 source-guard tests, mirroring
  the drawer maximize-glyph guard): the glyph resolves with non-empty inner markup and no
  self-wrapped `<svg>`; the geometry uses the symmetric (non-distorted) lid handle and both
  slats; the curated gallery surfaces it. Full styleguide suite green: 54/54.
- **Gate** — this is a visible canvas change (section 04), so it reopens the design-system
  gate per the ds-005/007/009/014/015 precedent; gate-reopen note added to the BC README.
  `dist/` deliberately NOT rebuilt (derived artifact per ADR-0003; aw-048 rebuilds it).

Key files:
- `styleguide/app/icons.js` (LUCIDE entry)
- `styleguide/app/foundations2.js` (gallery `ui` array)
- `styleguide/test/icons-trash.test.mjs` (new tests)
- `.agentheim/contexts/design-system/README.md` (gate-reopen note)
