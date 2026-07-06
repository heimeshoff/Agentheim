---
id: agentic-workflow-p8k4d
title: Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects
status: doing
type: feature
context: agentic-workflow
created: 2026-07-06
completed:
depends_on: []
blocks: []
tags: [dashboard, prompt-bar, keyboard]
related_adrs: [ADR-0050]
related_research: []
prior_art: [agentic-workflow-bz3az, agentic-workflow-s7gev, agentic-workflow-038]
---

## Why

The board prompt bar's current interaction model (ADR-0050, shipped by
[[agentic-workflow-bz3az]]) surprises the builder in four ways:

- There is no keyboard way to *reach* the prompt field — you must click into it.
- Bare **Enter** in the field is swallowed (does nothing); launching requires
  **Ctrl+Enter** or clicking the ochre **Enter** button. The builder expects Enter
  to submit, the way it does in an ordinary chat console.
- There is no way to author a **multi-line** prompt — aw-038 collapses every newline
  to a space (`sanitizePromptLine`), so the field is single-line by construction. The
  builder wants **Shift+Enter** to add a line break, the standard chat-console gesture.
- Clicking one of the four mode tabs **launches a terminal immediately**
  (`onTabClick` = set highlight *and* fire). The builder expects a click to only
  *select* which mode is active, with the actual launch deferred to a deliberate
  Enter (key or button).

The through-line: the bar should behave like a normal chat console — **Enter commits,
Shift+Enter adds a line, pick a mode, then commit is one explicit act** — not four
buttons that each fire on contact, and not a field that refuses newlines.

## What

Reshape the prompt bar's interaction model (`dashboard/app/prompt-mode.js` +
`BoardPromptBar` / `PromptModeTab` in `dashboard/app/board.js`) on four points,
reconciled by an **in-place amendment to ADR-0050** (settled — see Notes):

1. **Ctrl+Space focuses the prompt field — window-scoped** (settled). A
   `document`-level `keydown` listener (registered/torn down in a `useEffect`) moves
   focus into the `<textarea>` (`textareaRef`) from anywhere on the board, matching
   "when I press Ctrl+Space I want the prompt input focused." It `preventDefault`s and
   focuses; it should **no-op when focus is already inside an editable field** (so it
   never steals an in-progress edit elsewhere) — but since the only editable field on
   the board *is* this textarea, the practical guard is just "focus the textarea."

2. **Bare Enter launches the highlighted mode** — identical to clicking the Enter
   button (`fire(highlightedMode)`). This flips `promptBarKeyIntent`'s bare-Enter
   classification from `swallow` → `launch`, reversing ADR-0050 invariant 4 /
   aw-038's swallow rule.

3. **Shift+Enter inserts a line break** (new — the requirement that turns the field
   genuinely multi-line). `promptBarKeyIntent` classifies **Shift+Enter** as a new
   `newline` intent (the handler lets the textarea's native newline insertion happen —
   no `preventDefault`, no `fire`). This **retires aw-038's single-line collapse**: the
   field no longer runs `sanitizePromptLine` on change, so authored newlines survive.
   The existing `autoGrowField` already grows the textarea to fit multiple lines up to
   `PROMPT_FIELD_MAX_PX` then scrolls — no layout change needed. Multi-line prompts are
   safe end-to-end (verified — see Notes): the bridge passes the command as a **raw
   argv element, no shell wrap** (ADR-0018 / infrastructure-020), and the clipboard
   fallback copies the string verbatim; `safePrompt` in `*CommandFor` trims only the
   ends, preserving interior newlines.

4. **Tab click only selects, never launches.** `onTabClick` keeps
   `setHighlightedMode(index)` and drops the `fire(index)` call — reversing
   ADR-0050's "clicking a card moves the committed highlight *and* launches it."
   The launch is then reachable only via the Enter key (per #2), the Enter button
   (unchanged), or the Ctrl+Enter alias (per Notes), keeping ADR-0050's "one `fire()`
   path, all triggers identical" property intact for those triggers.

**Ctrl+Enter** stays as a **harmless alias** for launch (decided during refinement —
the builder deprioritized it). It already classifies as `launch`; keep it there
(bare Enter and Ctrl+Enter both → `launch`, distinguished from Shift+Enter's `newline`
only by the Shift modifier). Zero extra classifier work; freeing it later is a
one-line change if ever wanted.

## Acceptance criteria

- [ ] Pressing **Ctrl+Space** anywhere on the board moves keyboard focus into the
      prompt `<textarea>` (window-scoped `document` keydown listener, registered and
      torn down in a `useEffect`; the handler `preventDefault`s the browser default).
- [ ] Pressing **Enter** (no Shift) while the field is focused fires the currently
      highlighted mode's command through the same `fire(highlightedMode)` path the
      Enter button uses (same seeded command, same `launchOrCopy` bridge/clipboard
      path, same armed `skipPermissions` thread, same clear-textarea + confetti +
      highlight reset on success). **Ctrl+Enter** does the same (alias).
- [ ] Pressing **Shift+Enter** inserts a newline into the field and launches nothing;
      the authored newline is preserved in the stored value (no longer collapsed) and
      the field auto-grows to show it.
- [ ] A multi-line prompt launches correctly: the seeded command carries the interior
      newlines to the bridge (raw argv) and to the clipboard fallback unchanged; only
      leading/trailing whitespace is trimmed (`safePrompt`).
- [ ] **Clicking a mode tab** moves the committed highlight to that tab and does
      **not** launch anything.
- [ ] The launch is reachable **only** via the Enter key, the Ctrl+Enter alias, or the
      Enter button — no trigger fires a session on contact/selection.
- [ ] `promptBarKeyIntent` (and its `node --test` coverage) is updated: bare Enter and
      Ctrl+Enter → `launch`; **Shift+Enter → `newline`** (regardless of Ctrl); the old
      `swallow` label is removed; Ctrl+←/→ → `cycle` and everything else → `pass` are
      unchanged. Classification stays disjoint (invariant 4 preserved — every keystroke
      maps to exactly one label; no keystroke both launches and inserts a newline).
- [ ] `sanitizePromptLine` and its single-line invariant are retired/updated so the
      field holds multi-line text; the aw-038 doc comment block in `board.js`
      (~line 544) is rewritten to describe the multi-line auto-grow field, not a
      single-logical-line one.
- [ ] ADR-0050 is **amended in place** (not superseded) to record the reversed
      decisions — bare Enter launches (invariant 4's `swallow`→`launch`), tab-click
      selects-only, Ctrl+Space focus, and the new Shift+Enter `newline` intent
      retiring aw-038's collapse — preserving its four-invariant framing where still
      true. Mirrors the ADR-0015 amendment (qf945) precedent. The amendment states
      explicitly that aw-038's swallow + single-line rules are intentionally reversed,
      so the aw-038 record isn't left silently contradicting the new behavior.
- [ ] The `⌘↵` hint and its title/aria are reconciled with the new model — Enter is
      now the primary trigger (e.g. `↵` / "Enter launches · Shift+Enter for a new
      line"), not `⌘↵` / "Ctrl+Enter launches."

## Notes

Settled during refinement (2026-07-06) — these were the open questions that kept the
task in backlog:

- **ADR-0050: in-place amendment** (builder-confirmed). Add an `## Amendment` section
  to `0050-prompt-bar-keyboard-committed-selection-model.md` recording the reversals;
  keep ADR-0050 the single standing statement of the prompt-bar interaction model,
  like the ADR-0015 amendment qf945 landed. This is the `type: decision` output the
  worker produces alongside the code.
- **Ctrl+Space: window-scoped** (builder-confirmed). Document-level listener with
  `useEffect` teardown. Confirm during implementation that Ctrl+Space doesn't collide
  with an IME/OS binding on the target setup (it can be an IME toggle on some Windows
  configs); if it does, the `preventDefault` + editable-field guard already scopes the
  handler tightly, but flag it if it misbehaves rather than papering over it.
- **Shift+Enter → newline** (builder requirement, this refinement). This is the change
  that reverses aw-038's premise. The field becomes genuinely multi-line; stop
  collapsing newlines. The `newline` intent's handler simply does *not* `preventDefault`
  (the textarea inserts `\n` natively) — a dedicated `PROMPT_KEY_INTENT.NEWLINE` label
  is preferred for explicit `node --test` coverage, though a worker may fold it into
  `pass` if they justify it; either way the pinned behavior is "newline inserted,
  nothing launched."
- **Ctrl+Enter: kept as a harmless alias** (refinement decision, builder
  deprioritized). No classifier change needed for the chord — it already returns
  `launch`. Only bare Enter flips `swallow`→`launch` and Shift+Enter gains `newline`.
- **Multi-line safety verified.** Bridge = raw argv, no shell wrap (ADR-0018 amended
  by infrastructure-020) → interior newlines in the single argv element are safe.
  Clipboard fallback copies verbatim. `safePrompt`/`safeId` trim ends only. So the
  worker does not need to re-derive whether a multi-line prompt survives the launch —
  it does.
- **Paint untouched.** ADR-0048/ADR-0051 (ochre highlighted tab + ochre Enter button)
  and ADR-0016 stay as-is; this task is interaction-only, like ADR-0050.

Relevant seams: `dashboard/app/prompt-mode.js` (`promptBarKeyIntent`,
`PROMPT_KEY_INTENT` — add `NEWLINE`, remove `SWALLOW`); `dashboard/app/board.js`
`BoardPromptBar` (`onTabClick` ~1024, `onPromptKeyDown` ~1044, `onPromptChange` ~1031
which currently calls `sanitizePromptLine`, the aw-038 doc comment ~544,
`sanitizePromptLine` def ~576, Enter button `onClick` ~1120, the `⌘↵` hint ~1110,
`textareaRef` ~983, and a new `useEffect` for the window Ctrl+Space listener).
