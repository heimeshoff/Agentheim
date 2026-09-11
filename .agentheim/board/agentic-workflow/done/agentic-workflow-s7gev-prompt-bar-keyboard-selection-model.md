---
id: agentic-workflow-s7gev
title: Prompt bar gains a keyboard-committed single-selection highlight model
status: done
type: decision
context: agentic-workflow
created: 2026-07-05
completed: 2026-07-05
depends_on: []
blocks: [agentic-workflow-bz3az]
tags: [dashboard-redesign, prompt-bar, keyboard, adr]
related_adrs: [0050]
related_research: []
prior_art: [agentic-workflow-038, agentic-workflow-065, agentic-workflow-h7n2c]
---

## Why
`PromptLaunchCard` currently documents explicitly that there is **no selection model** among the
four launch cards (Quick Capture / Modeling / Inquire / Research). The builder's new keyboard
model (Ctrl+←/→ to move between modes, Ctrl+Enter to execute the highlighted one) reverses that
stance and introduces a real invariant — exactly one of four is highlighted at all times — that
deserves recording before implementation.

## What
Write an ADR (provisional ADR-0050, agentic-workflow-scoped) fixing the interaction model: a
0-based `highlightedMode` index; a wrapping cycle via Ctrl+←/→; **Ctrl+Enter fires the highlighted
mode identically to a click**; **clicking a card also moves the highlight**; **hover never does**;
default/reset target is Quick Capture (index 0). Name the pure module
(`dashboard/app/prompt-mode.js`) that will carry the judgment, mirroring `board-sort.js` /
`search-state.js`.

## Acceptance criteria
- [ ] ADR states the four invariants: exactly-one-highlighted; index always in range; total &
      deterministic wraparound; disjoint key-intent classification (swallow / cycle / launch /
      pass-through) so bare-Enter and Ctrl+Enter never collide.
- [ ] ADR explicitly notes it **supersedes `PromptLaunchCard`'s "no selection model" comment**.
- [ ] ADR scopes the *color/accent* treatment of the highlight OUT (owned by the accent carve-out
      decision [[design-system-vw12e]]); this decision is interaction-only.
- [ ] Committed-selection (click / Ctrl-arrow) and transient pointer feedback (hover) are recorded
      as two orthogonal channels that may compose on one card.

## Notes
- Foundation decision; blocks the prompt-bar rebuild [[agentic-workflow-bz3az]].
- Interaction shape from the tactical-modeler: single committed index, not per-card booleans;
  wraparound mirrors design-system's `nextActiveIndex` precedent.

## Outcome
Wrote ADR-0050 (`.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`),
fixing the prompt bar's interaction model ahead of implementation:

- A single 0-based `highlightedMode` index into `PROMPT_MODES` (not four per-card
  booleans), with four named invariants — exactly-one-highlighted, index always in range,
  total/deterministic Ctrl+←/→ wraparound, and a disjoint four-way key-intent
  classification (swallow / cycle / launch / pass-through) so bare Enter and Ctrl+Enter
  can never collide or double-fire.
- Committed selection (click or Ctrl+←/→) and transient hover are recorded as two
  orthogonal channels: hover never reads or writes `highlightedMode`, and a card can be
  both highlighted and hovered simultaneously without either channel overwriting the
  other.
- Explicitly **supersedes** `PromptLaunchCard`'s "no selection model" stance on record
  (aw-065's and aw-h7n2c's Outcome sections) — those done-task records stay untouched as
  history, but this ADR is now the standing statement of the interaction model going
  forward.
- Explicitly scopes the highlight's **color/accent** treatment OUT — that's owned by the
  accent carve-out (ADR-0048 / [[design-system-vw12e]]), already settled: a highlighted
  peer-mode tab is passive equivalent-state selection, so ADR-0016's de-emphasis rule
  governs it, not ochre.
- Names (without implementing) the pure module `dashboard/app/prompt-mode.js`
  (`PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, `promptBarKeyIntent`),
  mirroring the `board-sort.js` / `board-group.js` pure-module family, as the contract the
  downstream implementation task ([[agentic-workflow-bz3az]]) builds to.

No BC README change was needed — the README's "Board prompt bar" bullet never documented
a "no selection model" stance to supersede, so there was nothing stale to correct there.

Key file: `.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`.
