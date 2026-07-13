---
id: agentic-workflow-m2vkp
title: One launch control, not two — the ochre button names the session's model, Ctrl+M cycles it, and both selections survive a launch
status: done
type: feature
context: agentic-workflow
created: 2026-07-13
completed: 2026-07-13
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
- [x] The bordered `↵` hint span is gone from row 2; the split button is the only
      launch affordance there.
- [x] The button shows the resolved model's label and consumes the
      `design-system-r9dtm` `ModelSplitButton` **unforked** — no ochre split button
      is hand-rolled in `board.js` (ADR-0003).
- [x] Clicking the button's primary region launches exactly as clicking
      `EnterButton` does today (same single `fire(highlightedMode)` path — ADR-0050's
      one-launch-path invariant is preserved; there is still no second way to fire).
- [x] Clicking the caret opens the model menu; picking a model updates the label and
      never launches.
- [x] On the **Quick Capture** tab the button reads **Haiku**, renders no caret, and
      the menu is unreachable by mouse or keyboard.
- [x] Selecting Opus on Modeling, switching to Quick Capture (which shows Haiku),
      then switching back to Modeling **shows Opus again** — the pin never overwrites
      the stored selection.
- [x] `Ctrl+M` cycles the model with total wraparound, both when the prompt field has
      focus and when it does not (window-scoped, like `Ctrl+Space`).
- [x] `Ctrl+M` on Quick Capture is a true no-op: no state change, no visible feedback.
- [x] `promptBarKeyIntent` gains `CYCLE_MODEL` as a **fifth disjoint** label; a unit
      test asserts every intent is mutually exclusive (ADR-0050 invariant 4) and that
      `Ctrl+M` never also classifies as `launch`, `cycle`, `newline`, or `pass`.
- [x] After a successful launch the highlighted **mode** stays where it was and the
      selected **model** stays where it was; only the textarea clears (confetti still
      fires; the launched/copied flash still anchors to the fired tab —
      agentic-workflow-spv0k's `firedMode` is not regressed).
- [x] A reload resets to Quick Capture + Opus (no `localStorage`, no persisted file —
      ADR-0017's read-only dashboard is untouched).
- [x] `fire()` passes the resolved model id to `launchOrCopy`; a bridge launch spawns
      `claude … --model <id> …`.
- [x] With no bridge reachable, the button is `locked`, names **no** model, and the
      clipboard-copy launch still works.
- [x] `prompt-model.js` is pure (no React/DOM/IO) and unit-tested under `node --test`,
      joining the `prompt-mode.js` / `board-sort.js` family. Its guards never throw on
      a missing, NaN, negative, float, or out-of-range index.
- [x] ADR-0050 gains a **fifth `## Amendment` section** recording: the new
      `CYCLE_MODEL` intent (invariant 4 now over five labels), the committed-selection
      model generalizing from **one axis (mode) to two (mode + model)**, and the
      **reversal of the post-launch reset-to-Quick-Capture rule** the original ADR
      established.
- [x] The BC README's prompt-bar section reflects the new control and keybinding.

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

## Outcome

Shipped. The prompt bar's ochre launch affordance is now `ModelSplitButton`
(design-system-r9dtm, consumed unforked), naming the resolved model and
carrying a caret to change it; the bordered `↵` hint span is gone, its
affordance folded into the split button's tooltip. A new sibling pure module,
`dashboard/app/prompt-model.js`, mirrors `prompt-mode.js` on a second,
orthogonal axis: `PROMPT_MODELS` (Fable · Opus · Sonnet · Haiku, ids matching
the bridge's `MODEL_ALLOWLIST` exactly), `DEFAULT_PROMPT_MODEL_INDEX` (Opus),
`clampPromptModelIndex` / `nextPromptModelIndex` (total wraparound), and
`isModelLockedForMode` / `modelForMode` — the read-time projection that pins
Quick Capture to Haiku without ever mutating the stored selection (verified by
a Modeling(Opus) -> Quick Capture(Haiku) -> Modeling(Opus) round-trip test).
`promptBarKeyIntent` (`dashboard/app/prompt-mode.js`) gains a fifth disjoint
label, `CYCLE_MODEL` (Ctrl+M), classified in the one keydown classifier rather
than a second handler; wired both field-focused and window-scoped (alongside
Ctrl+Space) in `board.js`. `probeBridge` (infrastructure-h5wnq) gates the
selector on mount: no bridge reachable locks the button and names no model
("Default"), since a clipboard-copied command can never carry `--model`.
`fire()` threads the resolved model id into `launchOrCopy`'s `model` field.
ADR-0050's original post-launch reset-to-Quick-Capture rule is reversed on
both axes — `onResult` no longer touches `highlightedMode`, and the model axis
was never reset — so both selections survive a launch; a reload (not a
launch) returns the bar to Quick Capture + Opus, per ADR-0017's read-only
dashboard (in-page React state only, no `localStorage`, no server write).

ADR-0050 gained its fifth `## Amendment` section recording all of the above,
including the explicit note that ADR-0031 (per-agent model routing) is
untouched and composes rather than conflicts with this session-level
selector. The BC README's prompt-bar section was updated to describe the new
control, its keybinding, and the retired reset.

Key files: `dashboard/app/prompt-model.js` (new), `dashboard/app/prompt-mode.js`
(CYCLE_MODEL intent), `dashboard/app/board.js` (BoardPromptBar wiring),
`dashboard/test/prompt-model.test.mjs` (new), `dashboard/test/prompt-mode.test.mjs`
(CYCLE_MODEL/disjointness coverage), `dashboard/test/board-prompt-bar.test.mjs`
(rewrites for the mandated AC reversals + board-level model-selector wiring),
`.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`
(fifth Amendment), `.agentheim/contexts/agentic-workflow/README.md` (prompt-bar
section).

## Outcome — iteration 2 (double-dispatch fix)

Iteration 1's Ctrl+M wiring was correct in classification (a genuine fifth
disjoint `promptBarKeyIntent` label) but wrong in dispatch: the window-scoped
`document` keydown listener re-derived its own `ctrlKey && key === 'm'` check
independently of the field's `onPromptKeyDown`, so a Ctrl+M pressed while the
prompt field was focused was handled by BOTH — the field via React's
delegated keydown, `document` via the same physical event's native bubbling
under `createRoot` — stepping `selectedModel` by two instead of one.

Fixed with one new pure, exported guard in `dashboard/app/prompt-model.js`,
`shouldWindowCtrlMHandle(event, promptFieldEl)`: `false` whenever the
keydown's `target` IS the prompt field (the field's own handler already owns
it), `true` everywhere else. `board.js`'s window-scoped listener now checks
this guard before doing anything else in its Ctrl+M branch (before
`preventDefault`, before `modelLocked`, before `setSelectedModel`) — the
field's own `onPromptKeyDown` needed no matching change, since it is only
ever invoked for events targeting the field to begin with.

Also fixed, flagged as a minor item in the same verifier note:
`isModelLockedForMode` (`prompt-model.js`) previously read
`Number(modeIndex) === DEFAULT_PROMPT_MODE_INDEX`, which coerces `null`,
`''`, `false`, and `[]` all to `0` and reported them "locked" — contradicting
its own documented contract that a missing index is simply "not Quick
Capture". Tightened to `typeof modeIndex === 'number' &&
Number.isInteger(modeIndex) && modeIndex === DEFAULT_PROMPT_MODE_INDEX`, so
only a genuine integer `0` locks.

New tests added in `dashboard/test/prompt-model.test.mjs`: two behavioral
tests proving `shouldWindowCtrlMHandle`'s allow/refuse split plus a
never-throws case, and two "regression replay" tests that drive the real
exported functions (`promptBarKeyIntent`, `shouldWindowCtrlMHandle`,
`nextPromptModelIndex`) through both of board.js's actual dispatch paths for
a single physical Ctrl+M keydown — one asserting the field-focused case
advances `selectedModel` by exactly one (Opus → Sonnet, not Opus → Haiku),
the other asserting the not-in-field case is still handled exactly once by
the window-scoped fallback alone — plus two tests locking down the
`isModelLockedForMode` null/`''`/`false`/`[]` fix. One new test added in
`dashboard/test/board-prompt-bar.test.mjs` locks the wiring: the window
listener must import and call `shouldWindowCtrlMHandle` before
`preventDefault`/`setSelectedModel`. This is a genuine behavioral test at the
pure-function seam (the project has no DOM render harness to mount
`BoardPromptBar` itself), constructed so that reintroducing the
double-dispatch — removing the guard, reversing its sense, or calling it
after the mutation — turns it red; the prior iteration's test could not,
since it only asserted both handlers' source contained `setSelectedModel(`.

Net: **8 new tests** (baseline for this iteration 1279 → 1287, all passing).
Booted the dashboard by hand (`node dashboard/launch.mjs`, port from
`.agentheim/.dashboard/runtime.json`, torn down afterward via
`node dashboard/launch.mjs stop`) and confirmed it serves the rebuilt bundle
(`dashboard/test/dist-build.test.mjs`, part of the mandated test command,
runs `build.mjs` for real as one of its own assertions — so the suite run
above already regenerated `dashboard/dist/` from this iteration's source,
`node build.mjs` was never invoked directly). This environment has no
browser-automation tool, so an actual Ctrl+M keydown could not be literally
dispatched and observed in-browser; the pure-function regression-replay
tests above are the load-bearing proof, driving the identical two-dispatch-
path scenario (field-focused target vs. not) through the real exported
functions the browser's two handlers call.

ADR-0050's fifth amendment gained an "Iteration-1 correction" paragraph
recording the bug, the fix, and the generalized lesson (a key wired into
both the field's classifier-driven handler and the window-scoped fallback
needs an explicit "does the field already own this?" guard, not an
independent re-derivation of the same key check — unlike Ctrl+Space, which
the classifier deliberately classifies `pass`, giving it only one handler to
begin with). The BC README's model-axis paragraph gained a sentence
describing `shouldWindowCtrlMHandle` and why it exists.

Key files (iteration 2): `dashboard/app/prompt-model.js` (`shouldWindowCtrlMHandle`
added, `isModelLockedForMode` tightened), `dashboard/app/board.js` (window
listener now guards via `shouldWindowCtrlMHandle`, comments updated),
`dashboard/test/prompt-model.test.mjs` (+7 tests), `dashboard/test/board-prompt-bar.test.mjs`
(+1 test), `.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`
(iteration-1-correction paragraph + Naming update), `.agentheim/contexts/agentic-workflow/README.md`
(model-axis paragraph extended).

## Verifier note (iteration 1)

**REASONS:**

- **Ctrl+M is double-handled when the prompt field has focus, cycling the model by TWO instead of one.** `dashboard/app/board.js:1213-1218` (`onPromptKeyDown`'s `CYCLE_MODEL` branch) calls `setSelectedModel((current) => nextPromptModelIndex(current, 1))`, and `dashboard/app/board.js:1085-1097` (the window-scoped `document` keydown listener) hand-rolls its own `e.ctrlKey === true && !e.altKey && (e.key === "m" || e.key === "M")` check and calls the same functional setter again. The app mounts under React 18 `createRoot` (`dashboard/app/app.js:15,21`), so React's delegated `keydown` fires at the root container and the event then continues bubbling to `document`, where the native listener also fires. Neither handler calls `stopPropagation()` (the only `stopPropagation` calls in `board.js` are at 331, 1433, 1441, all card/dismiss wiring), and `preventDefault()` does not stop propagation. Both functional updaters queue, so the net step is `+2`.

- **Consequence — the "total wraparound" acceptance criterion is NOT met.** `PROMPT_MODELS` has four entries, so a `+2` step is a parity trap: from the Opus default (index 1) a focused-field Ctrl+M goes Opus(1) → Haiku(3) → Opus(1) → Haiku(3)… **Fable (0) and Sonnet (2) are unreachable via Ctrl+M whenever the prompt field is focused** — which is the normal case, since the builder is typing a prompt. The AC "`Ctrl+M` cycles the model with total wraparound, **both when the prompt field has focus** and when it does not" fails on the focused half.

- **This is precisely the failure mode the task forbade, one layer below the classifier.** `promptBarKeyIntent` (`dashboard/app/prompt-mode.js:280-298`) *is* correctly a fifth disjoint intent, structurally by construction. But the window listener **bypasses the classifier entirely** and re-derives Ctrl+M itself — the "second handler agreeing not to collide" pattern the task's `## What` §4 and Notes explicitly rule out. It does not merely risk colliding; it collides. (What hid this: Ctrl+Space classifies as `PASS`, so the pre-existing window listener was the *only* handler for it. Ctrl+M is the first key that is both a classified intent *and* hand-handled in the window listener.)

- **No test can catch this.** `dashboard/test/board-prompt-bar.test.mjs` is a source-regex suite; its Ctrl+M test asserts only that *both* `onPromptKeyDown`'s `CYCLE_MODEL` block **and** `onWindowKeyDown` contain `setSelectedModel(` — i.e. it asserts the exact buggy shape, and passes *because* the bug is present.

- **Secondary — `TESTS_ADDED: 32` does not reconcile.** Baseline 1254 → observed 1279 = **+25** net new passing tests, not 32.

- **Minor** — `isModelLockedForMode` (`dashboard/app/prompt-model.js:106-108`) uses `Number(modeIndex) === DEFAULT_PROMPT_MODE_INDEX`, so `null`, `''`, `false`, and `[]` all coerce to `0` and report `true` (locked, "Quick Capture"), contradicting the function's own JSDoc claim that a missing index is "simply 'not Quick Capture'". Not an AC violation and never throws, but worth tightening while the file is open.

**Everything else audited CLEAN — preserve it, do not redo or regress it:** `ModelSplitButton` consumed unforked from the styleguide, no hand-rolled ochre split button, no edit under `.agentheim/contexts/design-system/**`; `PROMPT_MODELS` ids (`fable`, `opus`, `sonnet`, `haiku`) match the bridge's closed `MODEL_ALLOWLIST` exactly with Opus as default; `modelForMode` IS a genuine read-time projection (the only `setSelectedModel` call sites are Ctrl+M and the menu's `onSelect` — the Haiku pin is never stored, so the Modeling(Opus) → Quick Capture → Modeling round-trip correctly restores Opus); `setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)` is gone from `onResult` while the textarea clear and confetti remain; `firedMode` still anchors the flash; the `↵` span is deleted; no `localStorage`/`sessionStorage`; no protocol/INDEX/other-BC edits. Suite green at 1279/1279.

**SUGGESTED_FIX:** Make the two Ctrl+M handlers mutually exclusive so a single keystroke produces a single cycle — either have the window-scoped listener ignore events originating from the prompt textarea (`if (e.target === textareaRef.current) return;`, letting `onPromptKeyDown` own the focused case) or route the window listener through `promptBarKeyIntent` and have `onPromptKeyDown`'s `CYCLE_MODEL` branch call `e.stopPropagation()`. Then add a test that actually goes red on the regression — press Ctrl+M with the field focused and assert `selectedModel` advances by exactly one (Opus → Sonnet), rather than regex-asserting that both handlers contain `setSelectedModel`. Also recheck the `TESTS_ADDED` count against the observed +25.

**ITERATION_HINT:** likely-fixable
