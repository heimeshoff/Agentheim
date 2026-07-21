---
id: agentic-workflow-ngzwz
title: INDEX entry diet — hard-cap new entry length; the linked artifact carries the detail
status: todo
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [bookkeeping, index, doctrine, lint, dorc-review]
related_adrs: [0041, 0047, 0039]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-w7q2m]
---

## Why

Dorc review recommendation A6 (surviving piece 1 of 3): single INDEX bullets ran 300–500
words, and the swollen knowledge base became a per-session context tax on every worker
and verifier that reads it. Agentheim's own `contexts/agentic-workflow/INDEX.md` shows
the same drift — recent ADR entries run ~200+ words each. The INDEX is a *catalog*; the
ADR/task file is where detail belongs.

(The other two Dorc A6 complaints — protocol rotation never firing and the done-list cap
not being enforced — are already fixed here by ADR-0045/0047; this task is the remaining
gap.)

## What

Hard-cap the length of **newly written** INDEX entries (ADR lines, task lines) at 2–3
sentences: the claim and the pointer, with detail living in the linked artifact. Applies
to every skill that appends INDEX entries (`work`'s index updates, `modeling`'s capture/
refine inserts). Existing over-length entries are left verbatim — no retroactive rewrite
(consistent with ADR-0039's verbatim discipline; a CONSOLIDATE-style cleanup can be a
separate, builder-approved action).

## Acceptance criteria

- [ ] The index-update steps in `skills/work/SKILL.md` and `skills/modeling/SKILL.md`
      state the cap (2–3 sentences, ~60 words) for new entries.
- [ ] Per the mechanize-or-drop rule ([[agentic-workflow-z394j]]): either a lint flags
      new over-length entries (live-tree `node --test` check scoped to entries newer than
      adoption, or a length check in the lifecycle CLI's bookkeeping path), or the task
      explicitly records "prose-only, unenforced" with the accepted risk.
- [ ] Existing entries untouched; the no-retroactive-rewrite decision is recorded.
- [ ] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. Scoping the lint to
new/recent entries avoids failing the tree on the existing long entries; grandfathering
mirrors ADR-0044's `GRANDFATHERED_IDS` pattern.
