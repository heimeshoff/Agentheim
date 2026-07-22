---
id: agentic-workflow-pzacx
title: Consumer-tune the two session reconciliations — fold recognized machine shapes into a summary, batch non-.agentheim carry-over
status: todo
type: refactor
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: [agentic-workflow-bx01e]
tags: [audit-2026-07-22-followup, overshoot-tuning, session-start-churn, carry-over]
related_adrs: [0066, 0026]
related_research: []
prior_art: [agentic-workflow-c5nvb, agentic-workflow-hhjjx, agentic-workflow-d6q4h]
---

## Why

Both session reconciliations were tuned for this self-hosted repo, where machine commits
dominate — and their recall-over-precision defaults invert in a consumer repo:

1. **Session-start churn (ADR-0066)** flags every untrailed commit. A solo builder who
   commits by hand constantly gets most commits flagged, every session, each needing a
   governed-surface judgment skim. ADR-0066 itself names the revisit ("special-case the
   known machine shapes … revisit if the false-positive rate proves annoying") — and the
   condition is arguably met: keeping the known-shapes prose in sync has already cost two
   fix-tasks in one week (d7ksw, c5nvb).
2. **Session-end carry-over reconciliation** interrogates per file ("ask the user per
   file… Do not batch"). A consumer's working tree routinely carries their own WIP; the
   safe answer is always "leave behind," asked N times per session.

Additionally (same surface, found by the same audit): every known-machine-shapes
enumeration omits `modeling` CONSOLIDATE, which `references/commit-doctrine.md:40` itself
defines as trailer-less — so a CONSOLIDATE commit reads as human churn.

## What

1. **Churn:** recognize the known machine shapes from `references/commit-doctrine.md`'s
   tables (including CONSOLIDATE) deterministically in `lib/session-start-churn.mjs`
   (`node --test` covered), and have `work`'s churn step print one summary line — "N
   recognized machine-shape commits, M human commits" — itemizing only the
   governed-surface hits. The advisory stays advisory; recall on genuinely human commits
   is unchanged.
2. **Carry-over:** ask per-file only for `.agentheim/`-owned paths; batch everything else
   into a single "left behind (user WIP, N files)" disposition line.
3. Amend ADR-0066 (its own named revisit) and align the enumerations at
   `skills/work/SKILL.md:42` and the `lib/session-start-churn.mjs` header comment with the
   table.

## Acceptance criteria

- [ ] `lib/session-start-churn.mjs` recognizes all commit-doctrine machine shapes incl.
      CONSOLIDATE, with `node --test` coverage for each shape.
- [ ] `skills/work/SKILL.md`'s churn step prints the summary line and itemizes only
      governed-surface hits.
- [ ] The carry-over step's per-file prompt is scoped to `.agentheim/` paths; non-.agentheim
      files get one batched disposition line.
- [ ] ADR-0066 is amended recording the tuning.

## Notes

Flagged by the 2026-07-22 overshoot review (candidate #2) and the consistency audit
(finding #4, the CONSOLIDATE omission).
