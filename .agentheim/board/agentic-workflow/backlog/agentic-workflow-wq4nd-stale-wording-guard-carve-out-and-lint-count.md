---
id: agentic-workflow-wq4nd
title: Fix stale wording on the guard's styleguide carve-out and the README lint count
status: backlog
type: chore
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
Two pieces of wording went stale during the mermaid work. The code and ADRs are correct; the
prose describing them is not.

## What
1. `agents/worker.md`, `agents/verifier.md` and `skills/work/SKILL.md` still say the
   bookkeeping-path guard "refuses every `.agentheim/` path". They don't name the ADR-0085
   carve-out for styleguide source (`.agentheim/knowledge/contexts/design-system/styleguide/`),
   which came from agentic-workflow-gvcy8.
2. The agentic-workflow README's Test command paragraph still says "three live-tree lints".
   The count is probably stale, because agentic-workflow-dd8yn added
   `lib/context-map-notation-lint.mjs`. Check the real count and update it.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `quick-capture` on 2026-11-03 — raw, unrefined. Needs a `modeling` refine pass before
it can be promoted.
