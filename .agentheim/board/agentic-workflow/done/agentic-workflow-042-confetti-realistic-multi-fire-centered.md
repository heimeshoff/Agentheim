---
id: agentic-workflow-042
title: Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: e5499ec
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, motion]
related_adrs: [ADR-0020, ADR-0014, ADR-0003]
related_research: []
prior_art: [agentic-workflow-037, agentic-workflow-035, agentic-workflow-034, agentic-workflow-025]
---

## Why
aw-037 was the last replay-loop turn: it fired a **single** canvas-confetti burst
from the page center, aimed **up at the prompt-bar textarea**, so the celebration
read as particles *converging on* the prompt bar. The builder now wants a **more
realistic** look — canvas-confetti's canonical "realistic look" demo, which is a
**layered multi-`fire()` burst** (five overlaid shots with different spreads,
velocities, decays and scalars) rather than one directional shot. Rendered from the
**center of the screen**. This is the dramatic, fuller spread the demo on the
canvas-confetti site shows, adapted to this dashboard's palette and discipline.

## What
Replace aw-037's **single aimed** burst with the demo's **layered multi-`fire()`**
sequence, fired from a **centered origin** (no aim at the textarea).

Source demo the builder handed over (canvas-confetti "realistic look"):

```js
var count = 200;
var defaults = { origin: { y: 0.7 } };
function fire(particleRatio, opts) {
  confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
}
fire(0.25, { spread: 26, startVelocity: 55 });
fire(0.2,  { spread: 60 });
fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
fire(0.1,  { spread: 120, startVelocity: 45 });
```

Adapt it to this codebase, keeping everything else from aw-034/aw-037 intact:

- **Layered multi-fire.** One `fireConfetti` invocation issues the **five overlaid
  `confetti()` shots** above (one shared `count`, per-shot `particleRatio` /
  `spread` / `startVelocity` / `decay` / `scalar`), replacing aw-037's single
  `confetti({ origin, angle, … })` call. The local `fire(particleRatio, opts)`
  helper + shared `defaults` shape carries over directly.
- **Centered origin, no aim.** Fire from the **center of the screen** — horizontal
  `origin.x = 0.5`. Keep the demo's `origin.y = 0.7` as the starting vertical (the
  bursts rise from just below center, the demo's signature look); the exact `y` is
  the open replay-loop dial. There is **no `angle` aim** anymore — the realistic
  preset is a symmetric upward spray, so aw-037's textarea-aim geometry is
  **dropped**.
- **Retire the aim helper + textarea plumbing.** aw-037's pure
  `confettiLaunchToRect(rect, viewport)` and the `textareaRef` → `originRef` chain
  through `BoardConfetti` exist only to aim at the textarea; with a fixed centered
  origin and no aim, they are no longer needed. Remove them (and their unit tests)
  rather than leaving dead plumbing — or, if a centered-origin pure helper still
  earns a smoke test, replace `confetti-launch.js` with a pure module that returns
  the fire-sequence parameters (see acceptance criteria). The live
  `getBoundingClientRect()` read in `board.js` goes away with the aim.

Everything below is **unchanged** from aw-034/aw-037:

- **Same triggers.** Prompt-bar Quick Capture / Modeling / Research success + the
  aw-025 replay button, via the unchanged `confettiKey` remount path. No new firing
  surfaces.
- **Same palette.** The four status bases resolved at fire time, theme-aware
  (`confetti-palette.js` / `resolveConfettiColors`) — untouched. Each of the five
  shots draws from the same resolved color set. No reserved `--accent-ochre-soft`
  (ADR-0016) / `--obligation` (aw-021).
- **Same reduced-motion contract** (ADR-0014): under `prefers-reduced-motion:
  reduce` the celebration renders nothing — the `matchMedia` guard wraps the whole
  fire sequence, so **none** of the five `confetti()` shots are invoked.
- **Same ownership** (ADR-0020): board-local transient ACK, full-viewport canvas,
  not promoted to a design-system motion primitive, styleguide consumed unforked
  (ADR-0003). No design-system child task.

## Acceptance criteria
- [ ] The celebration fires the **five-shot layered `fire()` sequence** from the
      demo (the `count: 200` + per-shot `particleRatio` / `spread` / `startVelocity`
      / `decay` / `scalar` values), replacing aw-037's single `confetti()` call.
- [ ] The burst fires from a **centered origin** (`origin.x = 0.5`, `origin.y` at the
      demo's `0.7` as the starting value) with **no `angle` aim** — aw-037's
      textarea-aim geometry is removed.
- [ ] aw-037's `confettiLaunchToRect` aim helper and the `textareaRef`/`originRef`
      plumbing it required are **removed** (no dead aim code / no orphan
      `getBoundingClientRect()` read left in `board.js`); their unit tests are
      removed or replaced to match the new contract.
- [ ] The triggers are **unchanged**: prompt-bar Quick Capture / Modeling / Research
      success and the aw-025 replay button, via the existing `confettiKey` remount
      path. No new firing surfaces.
- [ ] Reduced-motion still silent (ADR-0014): under `prefers-reduced-motion: reduce`,
      **none** of the five `confetti()` shots are invoked.
- [ ] Palette unchanged: the four status bases resolved at fire time, theme-aware;
      `confetti-palette.js` untouched. No reserved `--accent-ochre-soft` /
      `--obligation`. Each shot uses the same resolved color set.
- [ ] No launch / bridge / clipboard / textarea-clear / lifecycle-write behaviour
      changes — only how the celebration particles are drawn.
- [ ] Styleguide source untouched, consumed unforked (ADR-0003); no design-system
      child task / no new primitive.
- [ ] `dashboard/dist/` rebuilt and the existing suite stays green; the fire-sequence
      parameters have a smoke-level guard (e.g. a pure helper returning the
      `{ count, shots: [...] }` shape, or the existing pure-module pattern, unit-tested
      for the five shots + centered origin), and the reduced-motion no-call path stays
      asserted.

## Notes
Captured via `modeling` (Facilitator) on 2026-06-15 as the next aw-025 replay-loop
iteration. Builder handed over the canvas-confetti "realistic look" demo verbatim:
*"There is a more realistic way to do the Canvas confetti. I want you to render it in
the center of the screen with the following demo script … feel free to adapt it to the
language and styling that you have applied here."*

- **Direct iteration on aw-037.** aw-037 = single burst, origin page-center, aimed up
  at the textarea. This = layered five-shot demo, centered origin, no aim. Same
  module (`dashboard/app/confetti-launch.js`) and same `board.js` fire path are the
  edit sites; the aim plumbing is what's being torn out.
- **"Center of the screen" vs the demo's `y: 0.7`.** Honored as **horizontal**
  centering (`x: 0.5`); the demo's `y: 0.7` is kept as the starting vertical (its
  signature rise-from-just-below-center look). Exact `y` is the open replay-loop dial,
  not pinned by this task.
- **No new ADR expected.** ADR-0020 (amended by aw-034) already frames the burst's
  origin/aim/tuning as the replay-loop iteration target. If the worker finds a genuine
  decision (e.g. the multi-fire structure warrants recording), amend ADR-0020 in place
  (aw-034/aw-035/aw-037 precedent) rather than writing a new ADR.
- **Frontend gate:** depends on `design-system-001` (styleguide), done/approved
  (2026-06-05) — satisfied, so this is in `todo/`.

## Outcome
The celebration is now canvas-confetti's "realistic look" preset: a layered
multi-fire burst of **five overlaid `confetti()` shots** (shared `count: 200` with
per-shot `particleRatio` / `spread` / `startVelocity` / `decay` / `scalar`), fired
from a **centered origin `{x:0.5, y:0.7}` with no angle aim** — a symmetric upward
spray from the center of the screen, replacing aw-037's single textarea-aimed burst.

- `dashboard/app/confetti-launch.js` — `confettiLaunchToRect` (the aim helper) is
  replaced by a pure `confettiFireSequence()` returning `{ count, defaults: { origin },
  shots: [...] }`, the five-shot demo profile with the centered origin.
- `dashboard/app/board.js` — `fireConfetti()` takes no element, walks the sequence,
  issues one `confetti()` call per shot (`particleCount = Math.floor(count *
  particleRatio)`) sharing the centered `defaults` + the resolved palette. The
  `getBoundingClientRect` read and the `originRef` prop threaded into `BoardConfetti`
  are removed. `textareaRef` is **kept** and still attached to the `<textarea>` — it
  drives aw-038's auto-grow.
- The reduced-motion guard still wraps the whole sequence (ADR-0014): under
  `prefers-reduced-motion: reduce` none of the five shots fire. The palette
  (`confetti-palette.js`) is untouched; each shot draws the same resolved color set.
- Tests: `dashboard/test/confetti-launch.test.mjs` rewritten to lock the five shots +
  centered origin + no-angle contract; the aw-037 aim/originRef guards in
  `dashboard/test/board-prompt-bar.test.mjs` were replaced with the aw-042 contract,
  keeping the reduced-motion no-call assertion and the aw-038 auto-grow guards.
- `dashboard/dist/` rebuilt (`node build.mjs`); full `node --test` suite green (352
  passing). No new ADR — origin/tuning is ADR-0020's open replay-loop dial.
</parameter>
</invoke>
