---
id: agentic-workflow-bz3az
title: Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab
status: todo
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, design-system-rm2yv, agentic-workflow-s7gev, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, prompt-bar, keyboard]
related_adrs: [0016, 0048, 0050, 0051]
related_research: []
prior_art: [agentic-workflow-038, agentic-workflow-036, agentic-workflow-h7n2c, agentic-workflow-065, agentic-workflow-054]
---

## Why
The single largest interaction change in the reskin. The builder 100% wants the 1b docked,
bottom-center console: a two-row prompt bar (four mode tabs above, prompt + Enter below) with a
real keyboard model where none existed today.

Two decisions already govern this build and were settled after this task was captured — build
**to** them, don't re-derive:
- **Interaction — ADR-0050 (from [[agentic-workflow-s7gev]]):** a single committed `highlightedMode`
  index with four invariants; names the pure module `dashboard/app/prompt-mode.js`
  (`PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, `promptBarKeyIntent`).
- **Paint — ADR-0048 (design-system-vw12e) as amended by ADR-0051 (from [[design-system-rm2yv]],
  landed 2026-07-05):** the highlighted tab takes ochre (a *bounded wayfinding surface*, second
  after the nav rail); the other three tabs de-emphasize; the Enter button takes ochre (primed
  primary action). **The ochre-tab license is ADR-0051, not vw12e** — vw12e/ADR-0048 originally
  classified this surface as ochre-*forbidden*; ADR-0051 reopens exactly that classification and
  states the complete four-tabs-plus-Enter paint contract in one place.

## What
Rebuild `BoardPromptBar` / `PromptLaunchCard` (`dashboard/app/board.js`) into the **1b two-row
docked console**: a top row of four mode tabs (name + one-line meaning: Quick Capture, Modeling,
Inquire, Research) and a bottom row of `❯` chevron + single-line input + `⌘↵` hint + ochre Enter
button. The console is docked bottom-center (~780px, raised surface + big shadow, z-above the
board). Implement the keyboard model in a **new pure module `dashboard/app/prompt-mode.js`** per
ADR-0050 (`PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, `promptBarKeyIntent`),
lifting a single `highlightedMode` index into `BoardPromptBar`.

Preserve the existing behaviours the current bar already guarantees: `sanitizePromptLine` keeps the
value single-line; the four seeded commands (`quickCaptureCommandFor` / `modelingCommandFor` /
`inquireCommandFor` / `researchCommandFor`) with the trimmed-textarea-or-bare fallback; the
`launchOrCopy` bridge path with the silent clipboard fallback; the armed `skipPermissions` thread;
and the clear-textarea + confetti reset on a successful launch.

## Acceptance criteria
- [ ] **Keyboard cycle + fire.** Ctrl+← / Ctrl+→ cycle the highlight with wraparound (ADR-0050
      invariant 3); Ctrl+Enter fires the same launch as clicking the highlighted tab. Both
      `preventDefault` so neither falls through to the input.
- [ ] **Enter button.** The bottom-row Enter button fires the currently highlighted mode's launch —
      identical to Ctrl+Enter and to clicking that tab — routing through the same `launchOrCopy`
      path (bridge-or-clipboard, `skipPermissions` threaded, `onResult` reset).
- [ ] **Bare Enter still swallows** (no newline, no launch), proven not to collide with Ctrl+Enter
      via the single `promptBarKeyIntent` classifier (ADR-0050 invariant 4 — swallow / cycle /
      launch / pass-through are disjoint).
- [ ] **Click moves the highlight; hover never does.** Clicking a tab moves the committed highlight
      to it *and* launches it (ADR-0050 §two orthogonal channels). Hover/press remain transient
      pointer-feedback only — never mutating `highlightedMode`, never launching.
- [ ] **Paint contract.** The highlighted tab renders in ochre per ADR-0051
      (extending ADR-0048's bounded wayfinding exception); the other three tabs de-emphasize
      (ADR-0016); the Enter button renders ochre (primed primary action, ADR-0048). No ochre on any
      non-highlighted tab. Default highlight is Quick Capture (index 0) on mount and after every
      successful launch reset (ADR-0050 §default/reset).
- [ ] **Docked console geometry.** The bar renders as the 1b docked bottom-center console
      (~780px, raised surface + shadow, z-above the board), two rows: four tabs above, `❯` input +
      `⌘↵` hint + Enter button below — without pushing the board content or breaking the viewport
      scroll container (aw-067).
- [ ] **`prompt-mode.js` invariants covered by `node --test`** (`node --test
      dashboard/app/*.test.mjs` or the project's test glob): exactly-one-highlighted, in-range clamp,
      total deterministic wraparound (both directions, from every index), and disjoint key-intent
      classification (bare Enter → swallow, Ctrl+Enter → launch, Ctrl+←/→ → cycle, else → pass).

## Notes
- **Interaction spec is ADR-0050**, paint spec is **ADR-0048 as amended by ADR-0051**. Token per
  ADR-0051: reuse `--accent-ochre` directly (nav-rail inset idiom or an equivalent ochre
  fill/underline) — no new token; if a value beyond `--accent-ochre` proves necessary, that's a
  separate design-system follow-up, not this task.
  `prompt-mode.js` joins the pure-module family (`board-sort.js` / `board-group.js` /
  `search-results.js`) — framework-free, no React import, unit-tested.
- Docked console geometry from 1b: bottom-center, ~780px, raised surface + big shadow, z-above the
  board; four tabs each with a one-line meaning; ochre active-tab treatment (ADR-0051) + ochre Enter
  button (ADR-0048).
- The current bar (four flat `PromptLaunchCard`s in a row below a "Prompt" title, aw-065/aw-068) is
  what this rebuild replaces. `WhatsNextPanel` (aw-073/a2pm1) currently renders inside
  `BoardPromptBar` above the "Prompt" title — decide during build whether it stays composed here or
  moves out, but do not regress its DELETE-dismiss wiring (aw-vmk1z) or the SSE re-fetch.
- Prior art: aw-038 (single-line autogrow input + Enter-swallow), aw-036 (Research button),
  aw-h7n2c (Inquire button), aw-065 (icon-tile + subtitle redesign), aw-054 (prompt title /
  spacing).
- ~~Blocked until [[design-system-rm2yv]] lands~~ — **landed 2026-07-05 as ADR-0051**; all five
  `depends_on` are in `done/`, including the styleguide gate (design-system-001-styleguide).
- Sibling caution for the conductor: [[agentic-workflow-c2ver]] also rewrites
  `dashboard/app/board.js` — do not run the two as a parallel wave; sequence bz3az first.
</content>
