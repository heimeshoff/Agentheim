---
id: agentic-workflow-070
title: About-page Ko-fi button uses a solid colour, not a gradient
status: done
type: refactor
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
depends_on: [design-system-001]
blocks: []
tags: [dashboard, about, ko-fi, styleguide]
related_adrs: [0003, 0016]
related_research: []
prior_art: [agentic-workflow-062]
---

## Why
The "Buy me a coffee on Ko-fi" button on the About page (`KofiButton`, aw-062) is
filled with a `linear-gradient`. The builder doesn't want the gradient — the button
should read as a flat, opaque colour.

## What
Replace the gradient fill on the `KofiButton` in `dashboard/app/board.js` with a
**solid** fill of the styleguide token `--st-doing` (the gradient's current leading
stop). The button keeps everything else: its label, icon, hover (opacity + shadow),
radius, padding, `--surface-0` text, the external `<a href="https://ko-fi.com/heimeshoff">`,
and the safe `rel`. Still token-based, so it tracks the active light/dark theme — no
new gradient, no fixed hex, no ochre (ADR-0016). The styleguide stays unforked (ADR-0003);
this is a board-local control.

Current line:
`background: "linear-gradient(90deg, var(--st-doing) 0%, var(--st-todo) 100%)"`
→ `background: "var(--st-doing)"`

Rebuild the bundled `dashboard/dist/app.js` (esbuild) so the deployed dashboard carries
the change.

## Acceptance criteria
- [ ] `KofiButton`'s `background` is a solid `var(--st-doing)` — no `linear-gradient`.
- [ ] No other visual property changes (label, icon, hover, radius, padding, text colour, link, rel all unchanged).
- [ ] The colour is a styleguide token (tracks light/dark), not a fixed hex; ochre untouched (ADR-0016).
- [ ] `dashboard/dist/app.js` is rebuilt so the deployed app reflects the change.

## Notes
- Component lives in `dashboard/app/board.js` (`KofiButton`, ~line 1561), consumed by the
  About page's Support card (`AboutCard` 2).
- Builder picked the gradient's start hue (`--st-doing`) as the solid fill over `--st-todo`
  or Ko-fi brand blue (captured 2026-06-17).
- Prior art: the button was introduced in aw-062 (About page).

## Outcome
`KofiButton` in `dashboard/app/board.js` now fills with a solid `background: "var(--st-doing)"`
(was `linear-gradient(90deg, var(--st-doing) 0%, var(--st-todo) 100%)`). Everything else is
byte-unchanged: label, `box` icon, hover (opacity 0.88 + `--shadow-md`), `--radius-md`, 11px/22px
padding, `--surface-0` text, the `<a href="https://ko-fi.com/heimeshoff">`, and `target`/`rel`.
The component header comment was updated to describe a flat token fill instead of the gradient.
Still a board-local control: styleguide unforked (ADR-0003), token-based so it tracks light/dark,
no raw hex, ochre untouched (ADR-0016) — no new ADR needed.

A new red→green test locks the behavior: `dashboard/test/about-rail-routing.test.mjs` gains
"the Ko-fi button is a solid var(--st-doing) fill, not a gradient (aw-070)" — asserts no
`linear-gradient` and a `background: "var(--st-doing)"`. `dashboard/dist/app.js` was rebuilt via
`node build.mjs` (esbuild); the Ko-fi gradient string is gone from the bundle and the solid fill
is present (the one remaining dist `linear-gradient` is an unrelated `--hairline-strong` divider).

Suite: 552 tests, 551 pass. The single failure
("…canvas-confetti, not the old CSS keyframes…", `board-prompt-bar.test.mjs:342`) is PRE-EXISTING
and unrelated — its blanket `/@keyframes/` ban now trips on the About-page `aboutRise` keyframe
added by earlier polish. Verified reproducible on HEAD with aw-070 changes stashed out. Filed as
backlog item agentic-workflow-071 (fixing it is out of this task's scope).

Key files:
- `dashboard/app/board.js` (KofiButton fill + header comment)
- `dashboard/dist/app.js` (rebuilt bundle)
- `dashboard/test/about-rail-routing.test.mjs` (new gradient→solid assertion)
