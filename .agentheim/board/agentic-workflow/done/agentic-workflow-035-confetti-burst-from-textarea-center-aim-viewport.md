---
id: agentic-workflow-035
title: Confetti bursts from the prompt-bar textarea center, aimed at the viewport center
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: b688673
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, motion]
related_adrs: [ADR-0020, ADR-0014, ADR-0003]
related_research: []
prior_art: [agentic-workflow-034, agentic-workflow-025, agentic-workflow-023]
---

## Why
aw-034 swapped the celebration to canvas-confetti, but it fires from a **hardcoded
origin** (`{x:0.18, y:0.92}`, lower-left) at a **fixed angle** (75°), regardless of
where anything is on screen. The builder wants the burst to read as an *explosion out
of the prompt bar*: it should originate from the **center of the prompt-bar textarea**
and **shoot into the center of the viewport**. That ties the celebration visually to
the thing the builder just acted on (the prompt they authored) instead of spraying from
an arbitrary corner.

## What
Make the celebration burst's **origin** and **launch direction** computed from live
layout instead of hardcoded constants:

- **Origin = the prompt-bar textarea's center.** Read the textarea's on-screen
  bounding rect at **fire time** and normalize its center to canvas-confetti's
  viewport coordinates: `origin.x = (rect.left + rect.width/2) / window.innerWidth`,
  `origin.y = (rect.top + rect.height/2) / window.innerHeight`. Reading at fire time
  (not mount) keeps it correct across scroll, resize, and the left-rail layout.
- **Aim = the viewport center.** Derive canvas-confetti's `angle` from the vector
  textarea-center → viewport-center `{0.5, 0.5}`. canvas-confetti's angle is
  math-style with 90° = straight up, so screen-y must be inverted:
  `angle = atan2(-(0.5 - origin.y), (0.5 - origin.x))` in degrees. (With the textarea
  near the lower middle, this lands around straight-up-and-inward, particles converging
  toward the middle of the page.) Replaces the fixed `angle: 75`.

Everything else from aw-034 stays as-is:

- **Same triggers.** Prompt-bar Quick Capture / Modeling success + the aw-025 replay
  button, via the unchanged `confettiKey` remount path. No new firing surfaces
  (confirmed scope: existing triggers only). All of them now originate from the
  textarea center — the origin is the textarea, not the clicked button.
- **Same palette.** The four status bases resolved at fire time, theme-aware
  (`confetti-palette.js` / `resolveConfettiColors`) — untouched.
- **Same reduced-motion contract** (ADR-0014): under `prefers-reduced-motion: reduce`
  the burst renders nothing and `confetti()` is never invoked.
- **Same ownership** (ADR-0020): board-local transient ACK, full-viewport canvas, not
  promoted to a design-system primitive, styleguide consumed unforked (ADR-0003).

Plumbing note: `BoardConfetti` / `fireConfetti` currently take only a `fireKey`
counter. They need a **ref to the textarea** so `fireConfetti` can read the live rect.
Pass the textarea ref (already inside `BoardPromptBar`) down to `BoardConfetti`.

## Acceptance criteria
- [ ] The burst originates from the **center of the prompt-bar textarea**, computed
      from the textarea's live `getBoundingClientRect()` at fire time and normalized to
      viewport coords — not the hardcoded `{x:0.18, y:0.92}`.
- [ ] The burst is **aimed at the viewport center** `{0.5, 0.5}`: the `angle` is derived
      from the textarea-center → viewport-center vector (screen-y inverted), replacing
      the fixed `angle: 75`.
- [ ] Origin and angle are read/recomputed at **fire time** (so a scrolled/resized
      board still fires from the textarea's current on-screen position).
- [ ] The triggers are **unchanged**: prompt-bar Quick Capture / Modeling success and
      the aw-025 replay button, via the existing `confettiKey` remount path. No new
      firing surfaces; all originate from the textarea center.
- [ ] Reduced-motion still silent (ADR-0014): under `prefers-reduced-motion: reduce`,
      `confetti()` is never invoked.
- [ ] Palette unchanged: the four status bases resolved at fire time, theme-aware;
      `confetti-palette.js` untouched. No reserved `--accent-ochre-soft` / `--obligation`.
- [ ] No launch / bridge / clipboard / textarea-clear / lifecycle-write behaviour
      changes — only origin + aim of the visual.
- [ ] Styleguide source untouched, consumed unforked (ADR-0003); no design-system
      child task / no new primitive.
- [ ] `dashboard/dist/` rebuilt and the existing suite stays green; the origin/angle
      math has a smoke-level guard — extract a **pure helper** (e.g.
      `confettiLaunchFromRect(rect, viewport) → { origin, angle }`, mirroring
      `confetti-palette.js`'s pure-module pattern) and unit-test it (center-of-rect
      normalization + aim angle toward `{0.5,0.5}`).

## Notes
Captured via `modeling` (Facilitator) on 2026-06-15 as the next aw-025 replay-loop
iteration on aw-034. Builder's words: *"the confetti should start from the button that
I'm pressing and shoot into the center of the viewport,"* then sharpened to *"the
explosion should come from the center of the text area"* — so the origin is the
**textarea**, not the individual button.

- Direct iteration on aw-034's `fireConfetti()` / `BoardConfetti` in
  `dashboard/app/board.js` (the `origin: {x:0.18,y:0.92}` + `angle: 75` constants).
- The exact tuning (`particleCount` / `spread` / `startVelocity` / `gravity` /
  `scalar`) is **not** changed by this task and stays an open replay-loop dial — this
  task only makes **origin** and **aim** dynamic.
- **No new ADR expected.** ADR-0020 already frames the burst as firing "from an origin
  near the prompt-bar buttons" over a full-viewport canvas; this just makes that origin
  precise (textarea center) and adds directional aim. If the worker disagrees and finds
  a genuine decision, amend ADR-0020 in place (aw-021/aw-030/aw-034 precedent) rather
  than writing a new one.
- **Frontend gate:** depends on `design-system-001` (styleguide), done/approved
  (2026-06-05) — satisfied, so this is in `todo/`.

## Outcome
The celebration burst now reads as an explosion out of the prompt bar: it
originates at the prompt-bar textarea's center and shoots toward the viewport
center, replacing aw-034's hardcoded origin `{x:0.18,y:0.92}` / `angle:75`.

- **New pure module** `dashboard/app/confetti-launch.js` — `confettiLaunchFromRect(rect, viewport) → { origin, angle }`. Normalizes the rect center to canvas-confetti viewport coords (`origin.x = (left+width/2)/vw`, `origin.y = (top+height/2)/vh`) and derives the aim as `angle = atan2(-(0.5-origin.y), (0.5-origin.x))` in degrees (math-style, 90°=up, screen-y inverted toward `{0.5,0.5}`). Mirrors `confetti-palette.js`'s pure-module pattern; unit-tested in `dashboard/test/confetti-launch.test.mjs` (6 tests: center normalization + quadrant aim + the atan2 identity).
- **`board.js` wiring:** `fireConfetti(textareaEl)` reads the textarea's live `getBoundingClientRect()` + `window.innerWidth/innerHeight` at FIRE TIME and feeds them through `confettiLaunchFromRect`; `confetti()` now uses `origin: launch.origin` / `angle: launch.angle`. A defensive fallback to the old constants guards a missing ref. `BoardConfetti` gained an `originRef` prop; `BoardPromptBar` holds a `textareaRef` (useRef), attaches it to the `<textarea>`, and passes it down. particleCount/spread/startVelocity/gravity/scalar/ticks unchanged.
- **Unchanged:** triggers (Quick Capture / Modeling success + aw-025 replay via `confettiKey` remount), palette (`confetti-palette.js` resolved at fire time), reduced-motion silence (ADR-0014 matchMedia guard), board-local ownership (ADR-0020), styleguide consumed unforked (ADR-0003).
- No new ADR: the dynamic origin/aim is the iteration target ADR-0020 already framed (no genuine new decision).
- Suite: 319 green (313 prior + 6 new). `dashboard/dist/app.js` rebuilt via esbuild.

Key files: `dashboard/app/confetti-launch.js`, `dashboard/app/board.js`, `dashboard/test/confetti-launch.test.mjs`, `dashboard/test/board-prompt-bar.test.mjs`, `dashboard/dist/app.js`.
