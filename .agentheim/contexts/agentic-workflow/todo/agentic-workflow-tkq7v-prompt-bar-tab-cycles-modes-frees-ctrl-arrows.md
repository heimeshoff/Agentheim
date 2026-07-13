---
id: agentic-workflow-tkq7v
title: Prompt bar — Tab/Shift+Tab cycles the mode tabs; Ctrl+←/→ returns to native word-jump
status: todo
type: feature
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [dashboard, prompt-bar, keyboard]
related_adrs: [ADR-0050]
related_research: []
prior_art: [agentic-workflow-p8k4d, agentic-workflow-bz3az, agentic-workflow-s7gev]
---

## Why

The builder tried to use Ctrl+←/→ for what it means in every text field — jump the
caret a word at a time — and the prompt bar ate it to cycle mode tabs instead. Since
[[agentic-workflow-p8k4d]] made the field genuinely multi-line, word navigation inside
the prompt matters; stealing it is a real editing cost, not a hypothetical one.

Worse, the shipped classifier (`promptBarKeyIntent`, `dashboard/app/prompt-mode.js`)
checks `ctrlKey` and the arrow key but never `shiftKey` on the cycle branch, so
**Ctrl+Shift+←/→ (word-select) is hijacked too** — the builder cannot select by word
in the prompt field at all today.

Builder decision (2026-07-13, capture session): mode cycling moves to **Tab /
Shift+Tab** while the prompt textarea has focus; both Ctrl-arrow chords go back to the
browser's native caret behavior. **Ctrl+Space (focus-from-anywhere) stays as-is** —
the builder was offered `/` and Ctrl+K and explicitly chose to keep Ctrl+Space; only
the cycle binding changes.

## What

In `dashboard/app/prompt-mode.js` and its consumer (`BoardPromptBar`,
`dashboard/app/board.js`):

- `promptBarKeyIntent` classifies **Tab** (no modifiers) and **Shift+Tab** as
  `cycle`; the caller reads `shiftKey` for direction (Tab → forward, Shift+Tab →
  backward) instead of reading `event.key` for ArrowLeft/ArrowRight.
- The `Ctrl+ArrowLeft` / `Ctrl+ArrowRight` branch is removed entirely — those
  keystrokes (with or without Shift) classify as `pass`, restoring native word-jump
  and word-select.
- The handler `preventDefault()`s on the cycle branch so Tab does not move focus out
  of the textarea.
- Because Tab is hijacked while the field has focus, **Escape blurs the textarea** —
  the keyboard exit that keeps this from being a WCAG 2.1.2 keyboard trap. Everywhere
  else on the board, Tab remains untouched native focus navigation (the intent
  handler lives on the textarea, so this scoping is inherent).
- ADR-0050 gets an amendment in the established style: invariant 4's `cycle` trigger
  changes from Ctrl+←/→ to Tab/Shift+Tab; the Escape exit is recorded alongside it.
  Enter/Shift+Enter/Ctrl+Enter and Ctrl+Space are untouched.

## Acceptance criteria

- [ ] `promptBarKeyIntent({key:'Tab'})` → `cycle`; `promptBarKeyIntent({key:'Tab', shiftKey:true})` → `cycle`. Tab with Ctrl or Alt held → `pass` (don't shadow browser tab-switch chords).
- [ ] `promptBarKeyIntent({key:'ArrowLeft', ctrlKey:true})` and `({key:'ArrowRight', ctrlKey:true})` → `pass`, with and without `shiftKey` — native word-jump and word-select work in the prompt field again.
- [ ] Cycling direction comes from `shiftKey`: Tab steps forward (wraps past Plain to Quick Capture), Shift+Tab steps backward (wraps before Quick Capture to Plain) — wraparound via the existing `nextPromptModeIndex`, invariants 1–3 untouched.
- [ ] The cycle branch `preventDefault()`s, so focus stays in the textarea while cycling.
- [ ] Escape while the prompt textarea has focus blurs it (focus leaves the field); Tab then resumes native focus navigation. Escape does not clear the typed prompt.
- [ ] Enter → `launch`, Shift+Enter → `newline`, Ctrl+Enter → `launch`, and the window-scoped Ctrl+Space focus listener are all unchanged, with existing tests still green.
- [ ] `dashboard/test/prompt-mode.test.mjs` / `board-prompt-bar.test.mjs` updated: new Tab/Shift+Tab cases added, the Ctrl-arrow cycle cases inverted to assert `pass`; no existing non-cycle test deleted.
- [ ] ADR-0050 amended in place recording the trigger change, the Escape exit, and what it reverses (the original Decision's Ctrl+←/→ clause).

## Notes

- Builder rejected the alternatives offered at capture (Alt+←/→ — collides with
  browser Back/Forward; Alt+1–5 direct select; `/` or Ctrl+K for focus). Tab-cycling
  matches the chat-console feel p8k4d was already steering toward.
- The accessibility cost of hijacking Tab inside the field was surfaced at capture;
  the Escape exit is the agreed mitigation. If refinement finds a nicer exit
  affordance, it may replace Escape-blur, but some keyboard exit must exist.
- Paint is untouched — ADR-0048/ADR-0051/ADR-0016 govern the tabs exactly as before;
  this is interaction-only, like every amendment in the ADR-0050 chain.
