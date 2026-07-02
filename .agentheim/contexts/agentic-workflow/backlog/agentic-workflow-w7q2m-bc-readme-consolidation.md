---
id: agentic-workflow-w7q2m
title: BC README consolidation — size trigger + human-in-loop consolidation procedure
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, context-management, readme, compaction]
related_adrs: ["0017"]
related_research: []
prior_art: []
---

## Why

A BC's `README.md` accretes ubiquitous-language entries and per-feature narration
forever — this BC's is already **802 lines / ~28k tokens**, past the 25k Read cap,
so it can no longer be read in a single pass (the refinement session that split
this task hit exactly that wall). READMEs are pre-loaded whole into every
worker/specialist spawn, so the growth silently taxes every spawn's context
budget.

Unlike the INDEX done-list ([[agentic-workflow-c8j3w]]), a README is **curated
prose**: compaction means *consolidating and rewriting*, not verbatim rotation. So
it cannot be scripted (a machine can't safely rewrite ubiquitous language without
dropping meaning) and it must keep the builder in the loop — ubiquitous language
and invariants must survive. Split from the original c8j3w capture, whose INDEX
half is the mechanical sibling.

## What

Define a **trigger** and a **procedure** for consolidating a BC README:

- **Trigger** — a stated size (or staleness) threshold on `README.md`. When
  crossed, a skill flags it — candidate: `whats-next` surfaces "README <bc> is over
  the consolidation threshold" — rather than any skill auto-rewriting prose
  unattended.
- **Procedure** — a `modeling`/refine pass (or a dedicated consolidation
  sub-action) that consolidates *with the builder in the loop*: merge redundant
  ubiquitous-language entries, fold superseded per-feature narration (the
  "aw-0NN did X, then aw-0MM superseded it" chains) into settled summaries, and
  drop dead detail — **never silently deleting a term**. Every ubiquitous-language
  entry and invariant survives the rewrite.

Decide during work: the exact threshold (lines vs tokens), the flag mechanism, and
where consolidation lives (a `modeling` sub-action vs. a standalone skill).

## Acceptance criteria

- [ ] BC READMEs have a defined consolidation trigger — a stated size or staleness threshold, checkable without judgment.
- [ ] A defined procedure consolidates the prose with the builder in the loop: it merges/rewrites, never silently deletes; every ubiquitous-language term and invariant survives.
- [ ] Consolidation never breaks backlinks — ADR ids and task ids referenced in the README keep resolving after a rewrite.
- [ ] The pre-loaded README context blocks that skills paste into spawn prompts stay bounded as a project ages.

## Notes

Sibling of INDEX rotation ([[agentic-workflow-c8j3w]]) — same growth disease, but
prose not a list, so judgment-driven, not scripted. Explicitly **not** a
[[agentic-workflow-k5n8f]] script: a deterministic tool can rotate a list verbatim
but cannot safely rewrite ubiquitous language. Human-in-the-loop is the point, not
a limitation (ADR-0017's read-only / builder-in-loop stance).

This BC's own README is the live poster child — 802 lines, past the Read cap, the
exact artifact the refinement couldn't read in one pass.

Source: harness audit 2026-07-02, Phase 2 gap table (context/memory row). Split
from the original c8j3w capture on the 2026-07-02 refinement.
