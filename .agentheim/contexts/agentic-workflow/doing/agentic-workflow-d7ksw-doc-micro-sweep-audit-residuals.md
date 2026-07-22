---
id: agentic-workflow-d7ksw
title: Doc micro-sweep from the audit — bc-readme-template surface slots, research model-pin text, orchestrator worker route, hvqa4/rx630 checkboxes, commit-doctrine table
status: doing
type: chore
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, doc-sync]
related_adrs: [0061, 0031, 0036]
related_research: []
prior_art: [agentic-workflow-hvqa4, agentic-workflow-rx630]
---

## Why

Small, independent doc drifts confirmed by the audit — none worth its own task, together
they're a coherent sweep (all disjoint files, no contention with the other audit tasks):

1. `references/bc-readme-template.md` lacks the `## Runtime surface` and test-command
   slots that three doctrine steps now read (work's per-batch resolution :136-138, the
   churn governedness judgment :45, TDD's runner-first recording :66-69) — BCs scaffolded
   by brainstorm never get the sections the machinery looks for.
2. `skills/research/SKILL.md:90` still says "agentheim pins no model" — stale vs
   ADR-0031's pins documented in research-review and the agent frontmatter.
3. `agents/orchestrator.md:31` still offers routing to `agentheim:worker` — bypasses the
   work conductor's entire dispatch/verification gate; nothing sanctions that route.
4. `done/agentic-workflow-hvqa4-*.md` and `done/agentic-workflow-rx630-*.md` have all
   machine-checkable acceptance boxes unchecked despite `status: done` (only `[human-eye]`
   boxes may stay unchecked per ADR-0061).
5. `references/commit-doctrine.md:33-43`'s message table omits the BOUNCE, batch-start,
   reconcile-stranded, session-end, and rotation shapes work actually mints — it presents
   itself as the convention of record.

## What

One pass, five targeted edits: add the two optional template sections; replace the stale
model-pin parenthetical with a pointer to ADR-0031; drop (or explicitly forbid) the
orchestrator's worker row; tick the machine-checkable boxes on the two done files; extend
the commit-doctrine table (or scope its claim) to cover work's real shapes.

## Acceptance criteria

- [ ] `bc-readme-template.md` carries optional `## Runtime surface` and test-command sections matching what work/TDD/churn read.
- [ ] `skills/research/SKILL.md` no longer claims no model is pinned.
- [ ] `agents/orchestrator.md` no longer offers an unsanctioned route to `agentheim:worker`.
- [ ] All machine-checkable criteria boxes in the hvqa4 and rx630 done files are `[x]`.
- [ ] `references/commit-doctrine.md` either lists work's trailer-less/session shapes or explicitly scopes its table's claim.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings M1, M5-part, M6, F9, L6, and
the checkbox defect). Item 5 feeds agentic-workflow-c5nvb's known-shapes pointer — no
hard dependency, but co-batching them is friendly.
