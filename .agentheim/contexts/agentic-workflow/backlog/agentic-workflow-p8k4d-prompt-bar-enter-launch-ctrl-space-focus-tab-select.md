---
id: agentic-workflow-p8k4d
title: Prompt bar — bare Enter launches, Ctrl+Space focuses the field, tab click only selects
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-06
completed:
depends_on: []
blocks: []
tags: [dashboard, prompt-bar, keyboard]
related_adrs: [ADR-0050]
related_research: []
prior_art: [agentic-workflow-bz3az, agentic-workflow-s7gev]
---

## Why

The board prompt bar's current interaction model (ADR-0050, shipped by
[[agentic-workflow-bz3az]]) surprises the builder in three ways:

- There is no keyboard way to *reach* the prompt field — you must click into it.
- Bare **Enter** in the field is swallowed (does nothing); launching requires
  **Ctrl+Enter** or clicking the ochre **Enter** button. The builder expects Enter
  to submit, the way it does in an ordinary input.
- Clicking one of the four mode tabs **launches a terminal immediately**
  (`onTabClick` = set highlight *and* fire). The builder expects a click to only
  *select* which mode is active, with the actual launch deferred to a deliberate
  Enter (key or button).

The through-line: the bar should behave like a normal "type, pick a mode, then
commit" console, where committing is one explicit act (Enter) — not four buttons
that each fire on contact.

## What

Reshape the prompt bar's interaction model (`dashboard/app/prompt-mode.js` +
`BoardPromptBar` / `PromptModeTab` in `dashboard/app/board.js`) on three points,
reconciled by an **amendment to ADR-0050**:

1. **Ctrl+Space focuses the prompt field.** A new shortcut that moves focus into
   the `<textarea>` (`textareaRef`). Open question below: window-scoped (works from
   anywhere on the board) vs. bar-scoped.
2. **Bare Enter launches the highlighted mode** — identical to clicking the Enter
   button (`fire(highlightedMode)`). This flips `promptBarKeyIntent`'s bare-Enter
   classification from `swallow` → `launch`, reversing ADR-0050 invariant 4 /
   aw-038's swallow rule. (The field is already a single logical line — no hard
   newline is lost, since bare Enter did nothing useful before.)
3. **Tab click only selects, never launches.** `onTabClick` keeps
   `setHighlightedMode(index)` and drops the `fire(index)` call — reversing
   ADR-0050's "clicking a card moves the committed highlight *and* launches it."
   The launch is then reachable only via the Enter key (per #2) or the Enter button
   (unchanged), keeping ADR-0050's "one `fire()` path, all triggers identical"
   property intact for the two remaining triggers.

## Acceptance criteria

- [ ] Pressing **Ctrl+Space** moves keyboard focus into the prompt `<textarea>`.
- [ ] Pressing **Enter** while the field is focused fires the currently highlighted
      mode's command through the same `fire(highlightedMode)` path the Enter button
      uses (same seeded command, same `launchOrCopy` bridge/clipboard path, same
      armed `skipPermissions` thread, same clear-textarea + confetti + highlight
      reset on success).
- [ ] **Clicking a mode tab** moves the committed highlight to that tab and does
      **not** launch anything.
- [ ] The launch is reachable **only** via the Enter key or the Enter button — no
      trigger fires a session on contact/selection.
- [ ] `promptBarKeyIntent` (and its `node --test` coverage) is updated so bare Enter
      classifies as `launch`; classification stays disjoint (no keystroke both
      swallows and launches).
- [ ] ADR-0050 is **amended** (not superseded) to record the three reversed
      decisions; its four-invariant framing is preserved where still true.
- [ ] The `⌘↵` / "Ctrl+Enter launches" hint and any related titles/aria are
      reconciled with whatever is decided for Ctrl+Enter (see open questions).

## Notes

Refinement should settle these before a worker picks it up — they are why this sits
in backlog rather than todo:

- **ADR-0050 amendment vs. new ADR.** The change reverses three named invariants of
  a *proposed* ADR. Preference is an in-place amendment (like the ADR-0015 amendment
  qf945 landed), keeping ADR-0050 the single standing statement of the prompt-bar
  interaction model. Refinement produces the `type: decision` treatment.
- **Ctrl+Enter's fate.** With bare Enter now launching, Ctrl+Enter is redundant.
  Options: keep it as a harmless alias, or free it. Decide and reflect in the hint.
- **Ctrl+Space scope.** Window-scoped (focus from anywhere on the board) is the more
  useful reading of "when pressing Ctrl+Space I want the prompt input to get focus,"
  but it adds a document-level listener with its own teardown; a bar-scoped handler
  is simpler. Also confirm Ctrl+Space doesn't collide with a browser/OS binding.
- **Swallow rule removal.** aw-038 deliberately swallowed bare Enter to keep the
  field single-line. Since the field already collapses newlines on change
  (`sanitizePromptLine`) and holds one logical line, launching on Enter is
  consistent — but the amendment should state this explicitly so the aw-038 record
  isn't left contradicting the new behavior.
- **Paint untouched.** ADR-0048/ADR-0051 (ochre highlighted tab + ochre Enter
  button) and ADR-0016 stay as-is; this task is interaction-only, like ADR-0050.

Relevant seams: `dashboard/app/prompt-mode.js` (`promptBarKeyIntent`,
`PROMPT_KEY_INTENT`); `dashboard/app/board.js` `BoardPromptBar` (`onTabClick`
~1024, `onPromptKeyDown` ~1044, Enter button `onClick` ~1120, `textareaRef`).
