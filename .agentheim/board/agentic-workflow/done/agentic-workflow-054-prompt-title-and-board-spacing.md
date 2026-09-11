---
id: agentic-workflow-054
title: Board prompt bar gets a "Prompt" title; whitespace separates it from the "Board" title
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: 121db42
depends_on: [design-system-001]
blocks: []
tags: [captured, frontend, dashboard, prompt-bar]
related_adrs: [ADR-0003, ADR-0009, ADR-0017]
related_research: []
prior_art: [agentic-workflow-023, agentic-workflow-038]
---

## Why
On the board view the prompt-authoring region sits directly above the Kanban board.
The board has a "Board" title above its columns (`BoardHeader`), but the prompt input
has no equivalent label, and the two zones run together visually with nothing between
them. Giving the prompt input a "Prompt" title — mirroring the "Board" title — and a bit
of breathing room above the "Board" title makes the two zones read as distinct: a
capture region on top, the board below.

## What
Two small, presentation-only layout tweaks to the board view (`dashboard/app/board.js`):

1. **A "Prompt" title above the prompt input.** Render a title reading "Prompt" at the
   top of the `BoardPromptBar` section, above the textarea, styled to match the existing
   "Board" title in `BoardHeader` (same `--font-ui`, ~15px, weight 600, `--fg-1` tokens).
2. **Whitespace above the "Board" title.** Add vertical space above the "Board" title
   (`BoardHeader`) so it visually separates from the prompt-capturing region above it.

## Acceptance criteria
- [ ] A "Prompt" title renders above the prompt input field on the board view, styled to
      match the "Board" title (same font family / size / weight / colour tokens).
- [ ] There is visible vertical whitespace between the prompt-bar region (input + launch
      buttons) and the "Board" title that sits below it.
- [ ] The "Board" title and its task-count strip are otherwise unchanged in styling; only
      the spacing above the "Board" title changes.
- [ ] The "Prompt" title is a board-local, token-matched element mirroring the board-local
      "Board" title — the styleguide is consumed unforked (ADR-0003); no styleguide edit.
- [ ] The board stays read-only and a pure projection of disk (ADR-0017) — this change is
      presentation-only.
- [ ] `dist/` is rebuilt (esbuild) so the deployed app carries the change.

## Notes
- Implementation lives in `dashboard/app/board.js`:
  - `BoardPromptBar` (the prompt `<section>`, ~L476) gains the "Prompt" title above the
    `<textarea>`.
  - The top spacing goes above `BoardHeader` (the "Board" title, ~L88) — either on
    `BoardHeader` itself or on the wrapping board `<div>` (~L905) between `BoardPromptBar`
    and `BoardHeader`.
- "Board" title styling to mirror for the "Prompt" title:
  `fontFamily: var(--font-ui), fontSize: 15, fontWeight: 600, letterSpacing: -0.01em,
  color: var(--fg-1)`.
- Prior art: aw-023 (board prompt-bar origin + its relationship to the "Board" count
  strip), aw-038 (current single-line auto-growing prompt field).

## Outcome
Two presentation-only layout tweaks in `dashboard/app/board.js`:
- `BoardPromptBar` now renders a board-local `<span>Prompt</span>` title as the first
  child of its `<section>`, above the `<textarea>`, with the exact `Board`-title tokens
  (`--font-ui`, fontSize 15, fontWeight 600, letterSpacing -0.01em, `--fg-1`).
- The `BoardHeader` ("Board" title + count strip) is wrapped in a `<div style="paddingTop:18">`
  in `DashboardBoard`'s render, separating the prompt-capture region from the board. The
  `BoardHeader` component itself and its count-strip styling are untouched.
Both are board-local, token-matched elements — the styleguide is consumed unforked
(ADR-0003); no styleguide edit, no read-model / lifecycle / API change (ADR-0017).
`dist/` was rebuilt via `node build.mjs`. Two new static guards added to
`test/board-prompt-bar.test.mjs`; full suite green (471 pass).
Key files: `dashboard/app/board.js`, `dashboard/test/board-prompt-bar.test.mjs`,
rebuilt `dashboard/dist/app.js`.
</content>
