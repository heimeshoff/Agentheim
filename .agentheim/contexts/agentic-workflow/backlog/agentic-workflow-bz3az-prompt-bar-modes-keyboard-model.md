---
id: agentic-workflow-bz3az
title: Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, agentic-workflow-s7gev, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, prompt-bar, keyboard]
related_adrs: [0016]
related_research: []
prior_art: [agentic-workflow-038, agentic-workflow-036, agentic-workflow-h7n2c, agentic-workflow-065, agentic-workflow-054]
---

## Why
The single largest interaction change in the reskin. The builder 100% wants the 1b docked,
bottom-center console: a two-row prompt bar (four mode tabs above, prompt + Enter below) with a
real keyboard model where none existed today.

## What
Rebuild `BoardPromptBar` / `PromptLaunchCard` (`dashboard/app/board.js`) into the 1b two-row
console — a top row of four mode tabs (name + one-line meaning: Quick Capture, Modeling, Inquire,
Research), a bottom row of `❯` chevron + single-line input + `⌘↵` hint + Enter button. Implement the
keyboard model in a new pure module `dashboard/app/prompt-mode.js` (`PROMPT_MODES`,
`nextPromptModeIndex`, `clampPromptModeIndex`, `promptBarKeyIntent`) per [[agentic-workflow-s7gev]],
lifting a single `highlightedMode` index into `BoardPromptBar`.

## Acceptance criteria
- [ ] Ctrl+← / Ctrl+→ cycle the highlight with wraparound; Ctrl+Enter fires the same launch as
      clicking the highlighted card; both `preventDefault` so neither falls through to the input.
- [ ] Bare Enter still swallows (no newline, no launch), proven not to collide with Ctrl+Enter via
      one shared key-classifier function.
- [ ] Clicking a card moves the highlight; **hovering never does** (highlight and hover are two
      independent visual channels that can compose on one card).
- [ ] The highlighted tab renders in the ochre accent per [[design-system-vw12e]]; default highlight
      is Quick Capture on mount and after every successful launch reset.
- [ ] `prompt-mode.js`'s invariants are covered by `node --test`
      (`node --test dashboard/app/*.test.mjs` or the project's test glob).

## Notes
- Docked console geometry from 1b: bottom-center, ~780px, raised surface + big shadow, z-above the
  board; four tabs each with a one-line meaning; orange active-tab underline + text.
- Prior art: aw-038 (single-line autogrow input), aw-036 (Research button), aw-h7n2c (Inquire
  button), aw-065 (icon-tile + subtitle redesign), aw-054 (prompt title / spacing).
