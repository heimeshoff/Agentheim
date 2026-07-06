---
id: agentic-workflow-q7r3x
title: Prompt area matches Section 1b of the UX explorations reference exactly
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-06
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
Not stated at capture.

## What
Make the prompt area at the bottom of the dashboard page look exactly like the prompt area
shown in **Section 1b** of the reference file `inspiration/Agentheim UX Explorations.html`.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `quick-capture` on 2026-07-06 — raw, unrefined. Needs a `modeling` refine pass
before it can be promoted. The "prompt area at the bottom of the page" is the docked
bottom-center prompt bar / console (`BoardPromptBar`, `dashboard/app/`). Reference: Section
1b of `inspiration/Agentheim UX Explorations.html` (untracked, in the repo `inspiration/`
folder). Refinement should diff the live prompt bar against the 1b mock and enumerate the
concrete visual deltas as acceptance criteria; likely touches the design-system styleguide
(styleguide gate applies to any UI change) as well as the dashboard consumer.
