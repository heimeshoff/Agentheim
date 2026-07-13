---
id: agentic-workflow-m2vkp
title: One launch control, not two — the ochre button names the session's model, Ctrl+M cycles it, and both selections survive a launch
status: todo
type: feature
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: [design-system-r9dtm, infrastructure-h5wnq]
blocks: []
tags: [prompt-bar, keyboard, model, dashboard, adr-0050]
related_adrs: [0050, 0048, 0051, 0031, 0017]
related_research: []
prior_art: [agentic-workflow-bz3az, agentic-workflow-p8k4d, agentic-workflow-m3vhq, agentic-workflow-aqyqd, agentic-workflow-tkq7v, agentic-workflow-spv0k]
---

## Why
The prompt bar's second row ends in **two** launch affordances: a bordered `↵`
hint glyph and, beside it, the ochre `EnterButton`. The builder needs one. The
ochre one wins — and while it's being touched, it should stop being a mute square
and start telling the builder something they currently cannot see anywhere on the
board: **which model the session it is about to launch will run on.**

Three smaller frictions come off the same complaint:

- **The model is invisible and unchangeable.** Every dashboard-launched session
  inherits whatever the user's Claude Code config says. There is no way to say
  "this one's a throwaway, run it on Haiku" or "this needs Opus" without leaving
  the board.
- **Quick Capture doesn't deserve a big model.** Filing a one-line idea is the
  cheapest thing the bar does. It should be pinned to Haiku and not ask.
- **The bar forgets.** After every launch `onResult` snaps the highlight back to
  Quick Capture (`setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)`). Firing three
  Modeling prompts in a row means re-selecting Modeling three times. The reset was
  ADR-0050's original "default/reset" rule; the builder is now explicitly
  reversing it.

## What

**1. Kill the `↵` hint.** Delete the bordered `↵` span from row 2. Its
"Enter launches · Shift+Enter for a new line" affordance moves into the split
button's tooltip/`aria-label`, which is where the builder will look for it now
that there is one control.

**2. Swap `EnterButton` → `ModelSplitButton`** (the `design-system-r9dtm`
primitive — consumed **unforked**, ADR-0003). It is wide, shows the model name as
its label, and carries a caret that opens the model menu.

**3. A new pure module, `dashboard/app/prompt-model.js`** — sibling to
`prompt-mode.js`, same discipline (no React, no DOM, `node --test`-able):
- `PROMPT_MODELS` — the ordered, displayable list: **Fable · Opus · Sonnet ·
  Haiku**, each `{ id, label }` where `id` is the value `--model` actually accepts
  (see Notes — the worker verifies these against the CLI, it does not guess).
- `DEFAULT_PROMPT_MODEL_INDEX` — **Opus** (the builder's ruling).
- `clampPromptModelIndex` / `nextPromptModeIndex`-style `nextPromptModelIndex` —
  the same total, never-throws, wraparound guards `prompt-mode.js` already
  establishes for the mode axis. Do not re-derive bounds inline at call sites.
- `isModelLockedForMode(modeIndex)` — `true` for Quick Capture, `false` otherwise.
- `modelForMode(modeIndex, selectedModelIndex)` — the ONE resolver both the button's
  label and `fire()`'s launch payload consult. Quick Capture → always Haiku,
  whatever is selected. Every other mode → the selected index.

  This is the load-bearing shape: the pin is a **projection at read time**, not a
  mutation of the stored selection. So switching Modeling(Opus) → Quick
  Capture(shows Haiku) → Modeling **restores Opus**, because the selection was
  never overwritten. Storing the pin would silently eat the builder's choice every
  time they filed a quick idea.

**4. Ctrl+M cycles the model.** A new, fifth disjoint intent in
`promptBarKeyIntent` — `PROMPT_KEY_INTENT.CYCLE_MODEL` — so ADR-0050's invariant 4
(exactly-one-intent-per-keystroke) still holds by construction rather than by two
handlers agreeing not to collide. Wire it in both places the bar already listens:
`onPromptKeyDown` (field-focused) **and** the existing window-scoped `document`
keydown `useEffect` that today handles `Ctrl+Space` — so Ctrl+M works from
anywhere on the board, like focus-the-field does. On Quick Capture it is a
**true no-op**: no state change, no flash, nothing.

**5. Both selections survive a launch.** Remove `setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)`
from `onResult`. The mode stays where the builder put it; the model likewise is
never reset. The textarea still clears and the confetti still fires. Persistence is
**in-page only** (the builder's ruling) — React state, no `localStorage`, no
server write. A reload starts at Quick Capture + Opus.

**6. The model rides the launch.** `fire()` passes
`modelForMode(idx, selectedModel)`'s id into `launchOrCopy({ ..., model })`
(`infrastructure-h5wnq` provides the field).

**7. No bridge → no model promise.** On mount, call `probeBridge()`
(`infrastructure-h5wnq`). When the bridge is absent, the launch degrades to the
clipboard copy, and a copied command **cannot carry `--model`** — so the selector
must not claim one. Render the button `locked` with a label that names no model
(e.g. `Default`) and a tooltip saying why. The launch itself still works. Ctrl+M
is a no-op in this state too.

## Acceptance criteria
- [ ] The bordered `↵` hint span is gone from row 2; the split button is the only
      launch affordance there.
- [ ] The button shows the resolved model's label and consumes the
      `design-system-r9dtm` `ModelSplitButton` **unforked** — no ochre split button
      is hand-rolled in `board.js` (ADR-0003).
- [ ] Clicking the button's primary region launches exactly as clicking
      `EnterButton` does today (same single `fire(highlightedMode)` path — ADR-0050's
      one-launch-path invariant is preserved; there is still no second way to fire).
- [ ] Clicking the caret opens the model menu; picking a model updates the label and
      never launches.
- [ ] On the **Quick Capture** tab the button reads **Haiku**, renders no caret, and
      the menu is unreachable by mouse or keyboard.
- [ ] Selecting Opus on Modeling, switching to Quick Capture (which shows Haiku),
      then switching back to Modeling **shows Opus again** — the pin never overwrites
      the stored selection.
- [ ] `Ctrl+M` cycles the model with total wraparound, both when the prompt field has
      focus and when it does not (window-scoped, like `Ctrl+Space`).
- [ ] `Ctrl+M` on Quick Capture is a true no-op: no state change, no visible feedback.
- [ ] `promptBarKeyIntent` gains `CYCLE_MODEL` as a **fifth disjoint** label; a unit
      test asserts every intent is mutually exclusive (ADR-0050 invariant 4) and that
      `Ctrl+M` never also classifies as `launch`, `cycle`, `newline`, or `pass`.
- [ ] After a successful launch the highlighted **mode** stays where it was and the
      selected **model** stays where it was; only the textarea clears (confetti still
      fires; the launched/copied flash still anchors to the fired tab —
      agentic-workflow-spv0k's `firedMode` is not regressed).
- [ ] A reload resets to Quick Capture + Opus (no `localStorage`, no persisted file —
      ADR-0017's read-only dashboard is untouched).
- [ ] `fire()` passes the resolved model id to `launchOrCopy`; a bridge launch spawns
      `claude … --model <id> …`.
- [ ] With no bridge reachable, the button is `locked`, names **no** model, and the
      clipboard-copy launch still works.
- [ ] `prompt-model.js` is pure (no React/DOM/IO) and unit-tested under `node --test`,
      joining the `prompt-mode.js` / `board-sort.js` family. Its guards never throw on
      a missing, NaN, negative, float, or out-of-range index.
- [ ] ADR-0050 gains a **fifth `## Amendment` section** recording: the new
      `CYCLE_MODEL` intent (invariant 4 now over five labels), the committed-selection
      model generalizing from **one axis (mode) to two (mode + model)**, and the
      **reversal of the post-launch reset-to-Quick-Capture rule** the original ADR
      established.
- [ ] The BC README's prompt-bar section reflects the new control and keybinding.

## Notes
- **Model ids are the open question — verify, don't guess.** `--model` takes
  aliases (`opus`, `sonnet`, `haiku`) and full ids (`claude-opus-4-8`,
  `claude-sonnet-5`, `claude-haiku-4-5-20251001`, `claude-fable-5`). **Fable may
  have no short alias.** The display label is Agentheim's (`Fable`, `Opus`, …); the
  `id` must be whatever the CLI actually accepts. `infrastructure-h5wnq`'s
  allowlist and this module's `PROMPT_MODELS` must agree — settle the set once,
  in that task, and consume it here. The `claude-api` skill is the reference.
- **This is a session-model selector, not an agent-model override.** ADR-0031 pins
  models *per agent* (`worker`→sonnet, `verifier`→opus). `--model` sets the
  **main-loop** model. They compose — a session launched on Haiku still spawns its
  `verifier` on Opus. Nothing here amends ADR-0031, and the ADR-0050 amendment
  should say so explicitly so a future reader doesn't think the two collide.
- **Why five intents and not "handle Ctrl+M in the handler".** ADR-0050's invariant 4
  exists because a keystroke double-handled by two branches is exactly the class of
  bug the prompt bar kept producing (`swallow` vs `newline`; Ctrl+←/→ vs native
  word-jump, which `agentic-workflow-tkq7v` had to undo). The classifier is the ONE
  place a key becomes an intent. Adding `CYCLE_MODEL` there keeps that true.
- **`Ctrl+M` is `Enter` in some terminals** (it is the ASCII CR control code). In a
  *browser* `keydown`, `Ctrl+M` reports `key === 'm'` with `ctrlKey` — it does not
  masquerade as `Enter` — so the `launch` branch is not at risk. Assert this with a
  test rather than trusting it; the dashboard runs in VS Code's Simple Browser, not
  a terminal.
- Read `prompt-mode.js`'s header before writing `prompt-model.js`. Four ADR-0050
  amendments' worth of hard-won interaction judgment are documented there, and the
  new module is deliberately its mirror image on the model axis.
