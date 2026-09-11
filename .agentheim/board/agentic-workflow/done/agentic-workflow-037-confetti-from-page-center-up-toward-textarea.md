---
id: agentic-workflow-037
title: Confetti launches from the page center and shoots up toward the prompt-bar textarea
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 87e8991
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, motion]
related_adrs: [ADR-0020, ADR-0014, ADR-0003]
related_research: []
prior_art: [agentic-workflow-035, agentic-workflow-034, agentic-workflow-025]
---

## Why
aw-035 made the celebration burst originate at the **prompt-bar textarea center**
and shoot toward the **viewport center** — an explosion *out of* the prompt bar.
The builder now wants the **inverse reading**: the confetti should *converge on*
the prompt bar. It should start **in the middle of the page** and shoot **upwards
toward the textarea** (the prompt bar sits above the board's count strip, near the
top of the main column, so "up toward the textarea" is the natural direction). The
celebration then reads as particles rising *into* the thing the builder just acted
on, rather than spraying out of it.

## What
Swap the two endpoints of aw-035's launch geometry:

- **Origin = the page center** `{x: 0.5, y: 0.5}` (canvas-confetti viewport coords),
  replacing aw-035's textarea-center origin. This is the fixed "middle of the page"
  the burst starts from.
- **Aim = the prompt-bar textarea center.** Derive canvas-confetti's `angle` from
  the vector page-center → textarea-center. Screen-y must still be inverted for
  canvas-confetti's math-style angle (90° = straight up): with the textarea above
  page center, this aims **upward** toward it. Concretely, for a textarea center
  `(tx, ty)` in normalized viewport coords:
  `angle = atan2(-(ty - 0.5), (tx - 0.5))` in degrees (the mirror of aw-035's
  `atan2(-(0.5 - origin.y), (0.5 - origin.x))`).

Everything else from aw-035 / aw-034 stays as-is:

- **Same triggers.** Prompt-bar Quick Capture / Modeling / Research success + the
  aw-025 replay button, via the unchanged `confettiKey` remount path. No new firing
  surfaces.
- **Same palette.** The four status bases resolved at fire time, theme-aware
  (`confetti-palette.js` / `resolveConfettiColors`) — untouched.
- **Same reduced-motion contract** (ADR-0014): under `prefers-reduced-motion:
  reduce` the burst renders nothing and `confetti()` is never invoked.
- **Same ownership** (ADR-0020): board-local transient ACK, full-viewport canvas,
  not promoted to a design-system primitive, styleguide consumed unforked (ADR-0003).

Implementation note: this is a direct edit of aw-035's pure helper
`dashboard/app/confetti-launch.js`. The cleanest move is to **replace**
`confettiLaunchFromRect(rect, viewport)` with the mirror
`confettiLaunchToRect(rect, viewport) → { origin: {x:0.5, y:0.5}, angle }` (the
textarea rect is still the input — it's now the *target*, not the origin) and
update its single caller in `board.js`. The live read
(`textarea.getBoundingClientRect()` + `window.innerWidth/innerHeight` at fire time)
and the defensive missing-ref fallback stay in `board.js`; only what the helper
computes changes. Keep the `textareaRef` plumbing from aw-035 as-is.

## Acceptance criteria
- [ ] The burst **originates from the page center** `{x:0.5, y:0.5}` (canvas-confetti
      viewport coords), replacing aw-035's textarea-center origin.
- [ ] The burst is **aimed at the prompt-bar textarea center**: the `angle` is derived
      from the page-center → textarea-center vector (screen-y inverted), so particles
      shoot **upward toward the textarea** (textarea above page center).
- [ ] The textarea center used for the aim is read from the textarea's live
      `getBoundingClientRect()` and the live viewport at **fire time** (a scrolled or
      resized board still aims at the textarea's current on-screen position).
- [ ] The triggers are **unchanged**: prompt-bar Quick Capture / Modeling / Research
      success and the aw-025 replay button, via the existing `confettiKey` remount
      path. No new firing surfaces.
- [ ] Reduced-motion still silent (ADR-0014): under `prefers-reduced-motion: reduce`,
      `confetti()` is never invoked.
- [ ] Palette unchanged: the four status bases resolved at fire time, theme-aware;
      `confetti-palette.js` untouched. No reserved `--accent-ochre-soft` / `--obligation`.
- [ ] No launch / bridge / clipboard / textarea-clear / lifecycle-write behaviour
      changes — only origin + aim of the visual.
- [ ] Styleguide source untouched, consumed unforked (ADR-0003); no design-system
      child task / no new primitive.
- [ ] `dashboard/dist/` rebuilt and the existing suite stays green; the pure helper's
      unit tests are updated to assert the new contract (origin pinned to `{0.5,0.5}`
      + aim angle toward the rect center, including the upward case for a rect above
      page center).

## Notes
Captured via `modeling` (Facilitator) on 2026-06-15 as the next aw-025 replay-loop
iteration. Builder's words: *"The confetti that is shot upon celebration should
start somewhere in the middle of the page and shoot upwards towards the text area."*

- **Direct inverse of aw-035.** aw-035 = origin:textarea-center, aim:viewport-center.
  This = origin:page-center, aim:textarea-center. Same pure-helper module
  (`dashboard/app/confetti-launch.js`), same `board.js` fire path, same `textareaRef`.
- The exact tuning (`particleCount` / `spread` / `startVelocity` / `gravity` /
  `scalar` / `ticks`) is **not** changed by this task and stays an open replay-loop
  dial — this task only flips **origin** and **aim**.
- **No new ADR expected.** ADR-0020 (amended by aw-034) already frames the burst's
  origin/aim as an iteration target dialed via the replay button. If the worker
  finds a genuine decision, amend ADR-0020 in place (aw-034/aw-035 precedent) rather
  than writing a new one.
- **Frontend gate:** depends on `design-system-001` (styleguide), done/approved
  (2026-06-05) — satisfied, so this is in `todo/`.

## Outcome
Inverted aw-035's launch geometry so the celebration confetti now **converges on**
the prompt bar instead of spraying out of it. The pure helper in
`dashboard/app/confetti-launch.js` was replaced: `confettiLaunchFromRect` →
`confettiLaunchToRect(rect, viewport) → { origin: {x:0.5,y:0.5}, angle }`. Origin
is now pinned to the **page center** `{0.5,0.5}`; the aim `angle` is derived from
the page-center → textarea-center vector as `atan2(-(ty-0.5), (tx-0.5))` in degrees
(tx,ty = the target rect center normalized to viewport coords), so a textarea above
page center makes the burst shoot **upward** into the prompt bar.

`board.js` keeps the aw-035 plumbing unchanged — the live `getBoundingClientRect()`
+ `window.innerWidth/innerHeight` read at fire time, the missing-ref fallback, and
the `textareaRef`/`originRef` chain — only the helper it calls and the surrounding
comments flipped (`fireConfetti` now calls `confettiLaunchToRect`). Triggers,
palette (`confetti-palette.js` untouched), reduced-motion silence, and ownership
(board-local, full-viewport, not a styleguide primitive) are all unchanged. No new
ADR: ADR-0020 (amended aw-034) already frames origin/aim as a replay-loop dial.

The pure helper's unit tests were rewritten to assert the new contract (origin
pinned to `{0.5,0.5}`; upward aim for a rect above page center; straight-up 90° for
a centered-above target; quadrant checks; exact atan2; a below-center degenerate
case). `board-prompt-bar.test.mjs` updated to the new helper name and the
fire-up-from-page-center reading. `dashboard/dist/app.js` rebuilt via esbuild.
Full `node --test` suite: 346 green.

Key files: `dashboard/app/confetti-launch.js`, `dashboard/app/board.js`,
`dashboard/test/confetti-launch.test.mjs`, `dashboard/test/board-prompt-bar.test.mjs`,
`dashboard/dist/app.js`.
