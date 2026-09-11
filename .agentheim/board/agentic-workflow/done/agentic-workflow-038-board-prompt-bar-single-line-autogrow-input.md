---
id: agentic-workflow-038
title: Board prompt bar — single-line auto-growing input replaces the multi-line textarea
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 72fdbb9
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, prompt-bar, frontend, input]
related_adrs: [0020]
related_research: []
prior_art: [agentic-workflow-023, agentic-workflow-024, agentic-workflow-036]
---

## Why
The board prompt bar's authoring field is a `<textarea>` (introduced in aw-023). A
textarea visually advertises "write paragraphs here" and lets the builder embed hard
line breaks — but the field's whole job is to author a *single prompt string* that gets
joined into one slash command (`/agentheim:quick-capture|modeling|research <prompt>`).
Newlines in that value are noise at best and can mangle the seeded command. The builder
wants a field that **reads as one line of text** yet still **wraps and shows the whole
prompt** when it's long, instead of a tall paragraph box.

## What
Replace the prompt-bar textarea with a control that **renders multi-line but holds a
single logical line of text**: text wraps across visual lines (no horizontal scroll) and
the field **auto-grows in height** to fit the wrapped content, while its value can never
contain a newline character. The launch buttons (Quick Capture / Modeling / Research)
and the confetti burst keep consuming this control exactly as today.

This is a board-local, token-matched control — the styleguide still has no text-input
primitive, so it stays consumed **unforked** per ADR-0003 (the board-control precedent:
the sort `<select>`, the group toggle). The element choice (a constrained `<textarea>`
vs `contenteditable`) is the worker's call; the criteria below are behavioural, not
prescriptive.

## Acceptance criteria
- [ ] The prompt-bar field renders text as a single logical line that **wraps** to
      multiple visual lines as it grows; there is no horizontal scrollbar.
- [ ] The field **auto-grows** in height to fit the wrapped content, up to a sensible
      max height, after which it scrolls vertically (layout stays sane on long prompts).
- [ ] Pressing **Enter** inserts **no** newline and triggers **no** launch — the
      keystroke is swallowed (Shift+Enter likewise inserts no newline).
- [ ] The field's value **never contains a newline character** — multi-line pasted text
      collapses to a single line (newlines → space), preserving the single-line guarantee
      regardless of input method.
- [ ] Quick Capture / Modeling / Research read the **same trimmed value** as before; the
      seeded-command contract (aw-023 / aw-036) and empty/whitespace bare-command
      fallback are unchanged.
- [ ] The confetti burst still fires from the field's **live `getBoundingClientRect()`**
      (aw-035 contract) and tracks the field's current — now variable — height.
- [ ] The control consumes the styleguide **unforked** (ADR-0003); no styleguide
      primitive is forked and no new design-system child task is required, OR if a shared
      text-input primitive is judged warranted, a `design-system` capture is filed rather
      than forking.

## Notes
- **Decisions taken at capture (2026-06-15):** Enter does nothing (value can never hold a
  newline); the field auto-grows to fit rather than staying fixed-height. The paste →
  single-line collapse criterion is the inferred completion of the stated goal ("just
  contains a single line of text") beyond the Enter decision — Enter-swallow alone doesn't
  stop a multi-line paste.
- **aw-035 / aw-037 coupling (not in `prior_art` but load-bearing):** the confetti launch
  reads the textarea's live rect at fire time, and the concurrently-captured aw-037
  ("confetti launches from page center up toward the prompt-bar textarea") aims *at* this
  field. Because the field now changes height, confirm both bursts still compute origin/aim
  correctly when the field has grown — the helper already takes the live rect, so this
  should hold, but it's a regression to watch. Land order with aw-037 is incidental, not a
  hard dependency.
- **ADR-0003** governs: this is a board-local token-matched control consuming the
  styleguide unforked. The styleguide has no text-input primitive today (per the BC
  README), so the board owns this control as it owns the sort `<select>` and group toggle.
- Prior art: aw-023 (added the textarea + Quick Capture/Modeling), aw-024 (Work button,
  later relocated), aw-036 (Research button) — all the same prompt bar.

## Outcome

The prompt-bar field (`BoardPromptBar` in `dashboard/app/board.js`) is now a
**single-logical-line, auto-growing control**. It stays a `<textarea>` element — so the
aw-035/aw-037 confetti rect/aim path reads the SAME element via the existing
`textareaRef` and `getBoundingClientRect()` (the helper takes the live rect, so the
now-variable height computes correctly) — but is constrained:

- **Wraps, no horizontal scroll:** soft-wrap stays on, `overflowX: hidden`; long prompts
  wrap to multiple visual lines.
- **Auto-grows:** new pure helper `autoGrowField(el, maxPx)` resets height to `auto` then
  sets it to `min(scrollHeight, PROMPT_FIELD_MAX_PX)`, called on every change and on the
  clear-on-success path (so it shrinks back). `overflowY: auto` lets it scroll vertically
  once it hits `PROMPT_FIELD_MAX_PX` (168px). `resize: none`, `rows=1`.
- **Enter swallowed:** `onPromptKeyDown` calls `preventDefault()` on `key === "Enter"`
  (no shiftKey special case) — no newline inserted, no launch fired.
- **Value never holds a newline:** new pure helper `sanitizePromptLine(value)` collapses
  any run of `[\r\n]+` to a single space; `onPromptChange` feeds `setPrompt` the sanitized
  value, so a multi-line **paste** collapses to one line. Non-string degrades to `""`.
- **Builders unchanged:** Quick Capture / Modeling / Research still read the same `prompt`
  state via `quickCaptureCommandFor` / `modelingCommandFor` / `researchCommandFor`; the
  seeded-command contract (aw-023/aw-036) and empty/whitespace bare fallback hold.
- **Styleguide unforked (ADR-0003):** board-local token-matched control beside the
  primitives; no styleguide fork, no design-system child task.

Key files: `dashboard/app/board.js` (the control + `sanitizePromptLine` /
`autoGrowField` / `PROMPT_FIELD_MIN_PX` / `PROMPT_FIELD_MAX_PX`),
`dashboard/test/board-prompt-bar.test.mjs` (4 new static board-glue guards:
wrap/auto-grow wiring, Enter-swallow, no-newline sanitize, builders-read-sanitized-value),
`dashboard/dist/` (rebuilt via `node build.mjs`). Full `node --test` suite green at 350
(was 346).
