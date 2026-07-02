---
id: agentic-workflow-012
title: Copy a task's id to the clipboard from its card
status: backlog
type: feature
context: agentic-workflow
created: 2026-06-08
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, board, card, clipboard, copy, task-id]
related_adrs: [ADR-0009]
related_research: []
prior_art: [agentic-workflow-006, agentic-workflow-007]
---

## Why

Captured from the builder (2026-06-08): "clicking a card should let me copy its task id to the
clipboard." The board cards and the dashboard frontend app are owned by this BC (README → Board
view / Dashboard frontend app), so a card interaction that copies the task id lives here. Today a
card click emits the *open-this-task* intent the slide-over consumes (agentic-workflow-006/007);
copying the id is a new affordance on the same card surface.

## What (rough capture — to refine)

From a board card, let the builder copy that task's id (e.g. `agentic-workflow-012`) to the
clipboard. Open shape, to be decided during refinement:

- The affordance: a copy button/icon on the card, vs. click-to-copy, vs. a slide-over action — and
  how it coexists with the existing card-click → open-slide-over intent so the two don't collide.
- Use the Clipboard API (`navigator.clipboard.writeText`) with a fallback; show a brief "copied"
  confirmation.

## Open questions (for refinement)

- Where does the copy affordance live — on the card itself, or in the slide-over header — and how
  does it not clash with the existing card-click open intent?
- Confirmation/affordance styling: is a "copy" control part of the styleguide `TicketCard`, or
  layered in the dashboard app? (Styleguide-gated if the card component changes.)
- Copy just the id, or id + title, or a deep link?

## Notes

- Pure capture — not yet refined or promoted. No solution committed.
- Frontend/UI task: subject to the styleguide gate (`depends_on: design-system-001-styleguide`).
  If the copy control becomes part of the `TicketCard` component, that's a design-system change to
  coordinate; if it's layered in the app, it stays here. Decide during refinement.
- Prior art: agentic-workflow-006 (board view + card click → open intent),
  agentic-workflow-007 (slide-over).
