---
id: agentic-workflow-vsg9d
title: Prompt field stays tall after a launch — the post-clear re-measure runs before React re-renders
status: doing
type: bug
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [dashboard, prompt-bar, frontend, input, confetti]
related_adrs: [0050, 0003]
related_research: []
prior_art: [agentic-workflow-038, agentic-workflow-m2vkp, agentic-workflow-p8k4d]
---

## Why
Type a prompt long enough to wrap to two or three visual lines, press Enter to launch it.
The prompt clears and the confetti fires — but the field **stays at its grown height**. The
builder is left staring at a two- or three-line-tall empty input, and it only snaps back on
the next keystroke. Firing several prompts in a row leaves the bar permanently oversized.

The auto-grow band (aw-038) was always supposed to shrink back: `autoGrowField` resets
height to `auto` before measuring precisely so the field can *shrink* as text is deleted,
and `onResult` calls it right after the clear. The comment above that call even states the
intent — *"The field is re-measured after the clear so it shrinks back to one line
(aw-038)"*. The intent is right; the **timing** is wrong.

Root cause, `dashboard/app/board.js` `onResult` (~L1132-1138):

```js
setPrompt("");
autoGrowField(textareaRef.current, PROMPT_FIELD_MAX_PX);   // ← measures the OLD DOM
setConfettiKey((k) => k + 1);
```

`setPrompt("")` only *schedules* a re-render. `autoGrowField` then runs **synchronously**,
while the textarea in the DOM still holds the old wrapped text — so `scrollHeight` reports
the tall content and the inline `height` is pinned to the tall pixel value. React then
re-renders with `value=""`, but nothing re-measures, and the stale inline height wins. The
next `onPromptChange` (any keystroke) measures a now-correct DOM and the field finally
snaps back — which is exactly the "it fixes itself when I start typing again" symptom.

## What
Make the post-launch re-measure observe the DOM **after** the clear has actually landed, so
a successful launch returns the field to its one-line resting height (`PROMPT_FIELD_MIN_PX`).

The mechanism is the worker's call — the two obvious shapes are (a) drive the re-measure
from a `useLayoutEffect`/`useEffect` keyed on `prompt`, so any path that empties the field
shrinks it, or (b) keep it in `onResult` but defer past the commit. Prefer (a) if it holds:
it makes shrink-to-fit a property of the *value*, not of the one call site that happens to
clear it, and it survives the next mode/model change that touches this handler. Whichever is
chosen, the growth band itself (aw-038: `PROMPT_FIELD_MIN_PX` 40 → `PROMPT_FIELD_MAX_PX` 168,
`overflowX: hidden`, `overflowY: auto`, `resize: none`) is unchanged — only *when* the
measurement happens.

Everything else about the launch is settled and must not regress: the highlighted mode and
selected model **survive** a launch (m2vkp reversed ADR-0050's original reset rule), Enter
launches / Shift+Enter newlines (p8k4d), a fully-silent action (no bridge, clipboard blocked)
leaves the textarea untouched and plays no confetti, and confetti still fires from the field's
live `getBoundingClientRect()`.

## Acceptance criteria
- [ ] After a **successful** launch (bridge or clipboard) of a prompt that had wrapped to two
      or more visual lines, the prompt field returns to its **one-line resting height**
      (`PROMPT_FIELD_MIN_PX`) — no keystroke required to make it snap back.
- [ ] Holds for a launch fired by **any** trigger — bare Enter, the mode-tab click, and the
      launch button — since all three go through the one launch path.
- [ ] Holds **repeatedly**: firing several long prompts in a row leaves the bar at one line
      each time (no accumulating height).
- [ ] A **declined / failed** launch (empty-or-whitespace prompt per aqyqd, or bridge
      unreachable *and* clipboard blocked) still leaves the field's text **and** its current
      grown height untouched — the shrink is tied to the clear, not to the attempt.
- [ ] The aw-038 growth band is preserved: typing/pasting still grows the field to fit wrapped
      content up to `PROMPT_FIELD_MAX_PX`, then scrolls vertically; deleting text still shrinks
      it back.
- [ ] The confetti burst still fires on success and still reads the field's **live** rect.
- [ ] m2vkp's survival rule is untouched: the highlighted mode and the selected model both
      survive the launch.
- [ ] Covered by a **DOM-level** test (`dom-harness.mjs`) that mounts the real component,
      drives a real launch, and asserts the field's height collapses — not a source-regex
      guard. Mutation-check it: the test must go **red** when the fix is reverted to the
      synchronous `autoGrowField` call.

## Notes
- **This bug class is exactly why the jsdom harness exists.** `infrastructure-d2n8s` (landed
  2026-07-13) stood up `dom-harness.mjs` precisely because source-regex tests are structurally
  blind to live render/timing behavior — and this is a render-timing bug that *no* static guard
  over `board.js` could ever have caught: the call site looks correct, and the existing
  `board-prompt-bar.test.mjs` auto-grow guards presumably assert the wiring is present, which
  it is. Use the harness. If the height assertion is awkward in jsdom (jsdom does not do real
  layout — `scrollHeight` is 0 unless stubbed), that friction is itself the interesting finding:
  say so in the Outcome and stub/inject the measurement seam rather than falling back to a
  regex test that cannot fail.
- **`autoGrowField` is currently in the ADR-0033 "untested DOM/browser-only glue" bucket** (see
  the `EdgeBlinkOverlay` comment citing the `autoGrowField`/`fireConfetti` precedent). That
  exemption was granted when there was no way to observe it; d2n8s removed that excuse for the
  parts a mounted component can drive. Don't extend the exemption to cover this fix.
- The stale comment at ~L1125-1127 ("The field is re-measured after the clear so it shrinks
  back to one line") describes behavior that never worked. Correct it in place rather than
  leaving a comment that asserts the bug is fixed.
- Prior art: **aw-038** introduced `autoGrowField` and the growth band (and its own Notes
  flagged "the field now changes height — confirm the confetti still computes origin/aim
  correctly" as a regression to watch; this is the sibling regression, on the clear path).
  **m2vkp** most recently touched `onResult` (mode/model now survive a launch). **p8k4d** made
  bare Enter the launch trigger, which is what makes the tall-empty-field state so visible —
  before it, the field was cleared far less often.
- Board-local control, consumed unforked per ADR-0003 — the styleguide still has no text-input
  primitive. No design-system child task expected.
