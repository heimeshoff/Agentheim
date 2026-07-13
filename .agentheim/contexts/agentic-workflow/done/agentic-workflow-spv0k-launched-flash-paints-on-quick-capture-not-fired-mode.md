---
id: agentic-workflow-spv0k
title: Launched/Copied flash paints on Quick Capture instead of the fired mode's tab
status: done
type: bug
context: agentic-workflow
created: 2026-07-13
completed: 2026-07-13
depends_on: [design-system-001]
blocks: []
tags: [dashboard, prompt-bar, feedback, adr-0050]
related_adrs: [0050]
related_research: []
prior_art: [agentic-workflow-p8k4d, agentic-workflow-aqyqd, agentic-workflow-bz3az, agentic-workflow-q7r3x, agentic-workflow-s7gev]
---

## Why

When the builder highlights a non-default prompt-bar mode (e.g. Modeling) and
presses Enter, the green "Launched" flash paints on the **Quick Capture** tab —
the first tab in the row — not on the mode that actually fired. The feedback
lies about what just launched: the builder selected Modeling, the console says
Quick Capture launched. Trust in the launch feedback is the whole point of the
flash channel.

## What

The flash is keyed to the *currently highlighted* tab
(`PromptModeTab`: `flashed = highlighted && feedback !== "idle"`,
`dashboard/app/board.js:633`), but `fire()` calls `onResult(res)` **before**
setting the feedback (`board.js:1056-1058`), and `onResult` performs ADR-0050's
success-reset `setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)` (`board.js:1035`).
Both state updates batch into one re-render, so by the time
`feedback === "launched"` paints, the highlight has already snapped back to
Quick Capture (index 0) — the flash therefore *always* lands on tab 0,
whichever mode fired.

Fix: key the flash to the mode index that actually fired (a fired-index
recorded alongside the feedback state, or an equivalent mechanism), so the
success-reset of the committed highlight and the transient flash stay the two
orthogonal channels ADR-0050 describes instead of the reset relocating the
flash.

## Acceptance criteria

- [ ] Firing a non-default mode (e.g. Modeling, index > 0) via bare Enter,
      Ctrl+Enter, or the Enter button paints the "Launched" (bridge) /
      "Copied" (clipboard fallback) flash on **that mode's tab**, never on
      Quick Capture.
- [ ] Firing Quick Capture itself still flashes on Quick Capture (no
      regression at index 0).
- [ ] ADR-0050's success-reset is preserved: after a successful launch the
      committed highlight still returns to Quick Capture (the reset may be
      visible during the flash — the invariant is only that the flash paints on
      the fired tab, not where the highlight rests).
- [ ] A declined launch (empty/whitespace prompt, agentic-workflow-aqyqd) still
      shows no flash on any tab.
- [ ] A regression test in `dashboard/test/board-prompt-bar.test.mjs` pins:
      fire a mode with index > 0 → the flash renders on the fired tab and not
      on tab 0.

## Notes

- User report: "When I press enter, the quick capture tab turns green and says
  launching. Even though I had modelling selected, I want the respective tab to
  show the modeling instead of always the first one in the row."
- ADR-0050 names committed selection and transient pointer/flash feedback as
  two orthogonal channels; this bug is the reset of channel 1 hijacking the
  render of channel 2. If the fix amends how the flash channel is modeled,
  note it against ADR-0050 rather than writing a new ADR — it's a rendering
  defect, not a new decision.
- The 1100ms flash timer (`board.js:1062`) and the confetti/clear path
  (`onResult`) are otherwise correct — only the flash's anchor is wrong.
- Prior art: agentic-workflow-p8k4d (Enter launches / tab-click selects),
  agentic-workflow-bz3az (mode tabs + keyboard model), agentic-workflow-q7r3x
  (Section 1b cell layout), agentic-workflow-aqyqd (decline-to-launch),
  agentic-workflow-s7gev (keyboard-committed selection decision).

## Outcome

Fixed by introducing a `firedMode` index (`BoardPromptBar`, `useState(null)`),
set inside `fire()`'s own bridge/clipboard success branches to the `idx` that
actually launched. `PromptModeTab` now takes `flashed` as a prop
(`firedMode === index && feedback !== "idle"`) instead of deriving it from
`highlighted && feedback !== "idle"` — the conflation that let ADR-0050's
success-reset of `highlightedMode` (still preserved, unchanged) relocate the
flash onto Quick Capture. A declined launch (`canFirePromptMode` false) still
runs before any `setFiredMode` call, so no tab flashes on a decline.

Recorded as ADR-0050's fourth amendment (2026-07-13,
`.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`)
— a rendering-defect fix restoring the Decision's own "two orthogonal
channels" clause, not a new decision.

Files changed:
- `dashboard/app/board.js` — `firedMode` state, `fire()` sets it in the
  success branches, `PromptModeTab` takes `flashed` as a prop.
- `dashboard/test/board-prompt-bar.test.mjs` — 6 new regression tests pinning
  the fired-index anchor, the preserved success-reset, and the decline no-op.
- `dashboard/dist/app.js` — rebuilt via `node build.mjs`.
- `.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`
  — fourth amendment appended.
- `.agentheim/contexts/agentic-workflow/README.md` — one clause added noting
  the flash is a third, independent channel keyed to `firedMode`.
