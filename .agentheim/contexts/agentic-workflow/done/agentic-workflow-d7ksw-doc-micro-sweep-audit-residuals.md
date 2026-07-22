---
id: agentic-workflow-d7ksw
title: Doc micro-sweep from the audit — bc-readme-template surface slots, research model-pin text, orchestrator worker route, hvqa4/rx630 checkboxes, commit-doctrine table
status: done
type: chore
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
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

- [x] `bc-readme-template.md` carries optional `## Runtime surface` and test-command sections matching what work/TDD/churn read.
- [x] `skills/research/SKILL.md` no longer claims no model is pinned.
- [x] `agents/orchestrator.md` no longer offers an unsanctioned route to `agentheim:worker`.
- [x] All machine-checkable criteria boxes in the hvqa4 and rx630 done files are `[x]`.
- [x] `references/commit-doctrine.md` either lists work's trailer-less/session shapes or explicitly scopes its table's claim.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings M1, M5-part, M6, F9, L6, and
the checkbox defect). Item 5 feeds agentic-workflow-c5nvb's known-shapes pointer — no
hard dependency, but co-batching them is friendly.

## Outcome

Five disjoint doc edits, no behavior change, no ADR needed (a doc-sync sweep, not a decision):

1. `references/bc-readme-template.md` — added two optional sections, `## Test command`
   (pointing at `skills/work/SKILL.md` :136-138's per-batch resolution and
   `skills/test-driven-development/SKILL.md` :66-69's runner-first recording) and
   `## Runtime surface` (a worked YAML shape mirroring this BC's own block, ADR-0036), plus a
   Writing-guidance bullet marking both add-only-when-earned. Nested the nested YAML fence
   inside a widened 4-backtick outer fence so the template block still renders as one piece.
2. `skills/research/SKILL.md` ~:90 — replaced the stale "agentheim pins no model" parenthetical
   with a pointer to ADR-0031's actual per-agent routing (`researcher`=sonnet,
   `research-reviewer`=opus).
3. `agents/orchestrator.md` — dropped the routing-table row offering `agentheim:worker`; added
   a note explaining why (bypasses `work`'s dispatch/verification gate, ADR-0032/verifier).
4. Ticked all machine-checkable `[ ]` → `[x]` acceptance boxes in
   `done/agentic-workflow-hvqa4-*.md` (4 boxes) and `done/agentic-workflow-rx630-*.md` (3
   boxes) — each verified against its own `## Outcome` section before ticking; neither task has
   any `[human-eye]` box.
5. `references/commit-doctrine.md` — added a "`work`'s own non-task-commit shapes" table
   listing the batch-start claim commit, BOUNCE integration, reconcile-stranded, session-end
   bookkeeping, and the two rotation-check commits, sourced verbatim from `skills/work/SKILL.md`.

Verified: `node --test lib/test/*.test.mjs` — 333/333 passing (doc-only change; no new tests,
no behavior touched).

Key files: `references/bc-readme-template.md`, `skills/research/SKILL.md`,
`agents/orchestrator.md`, `references/commit-doctrine.md`,
`.agentheim/contexts/agentic-workflow/done/agentic-workflow-hvqa4-salvage-worktree-diff-on-abandonment.md`,
`.agentheim/contexts/agentic-workflow/done/agentic-workflow-rx630-dispatch-ordering-remediation-over-diagnosis-spike-stop-loss.md`.
