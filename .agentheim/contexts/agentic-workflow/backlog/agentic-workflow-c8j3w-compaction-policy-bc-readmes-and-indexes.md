---
id: agentic-workflow-c8j3w
title: Compaction policy for BC READMEs and the growing INDEX files
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, context-management, index, readme, compaction]
related_adrs: []
related_research: []
prior_art: []
---

## Why

The harness's context/memory management is otherwise good — pre-loaded blocks,
head-100 protocol reads, concept pages, per-BC scoping — but the audit names one
hole: **no compaction policy exists for BC READMEs or the growing indexes**.
(Harness audit 2026-07-02, Phase 2 gap table, context/memory row.) READMEs
accrete ubiquitous-language entries and invariants forever; `INDEX.md` done-lists
grow monotonically (this BC's already lists 84 done tasks). Both are pre-loaded
into worker/specialist prompts, so unbounded growth silently taxes every spawn's
context budget — the same failure mode protocol rotation (agentic-workflow-r2c7m)
fixes for the diary, unaddressed for the other two artifact kinds.

## What

Define and implement a compaction policy for the two growth surfaces:

- **BC `INDEX.md` done-lists** — likely the same rotation shape as r2c7m: keep
  the most recent N done entries live, roll the rest to a dated archive file
  that prior-art search can still reach.
- **BC `README.md`** — a size/staleness review trigger rather than mechanical
  rotation: READMEs are curated prose, so compaction means consolidating, not
  moving lines verbatim.

Decide during refinement: thresholds, who compacts (deterministic script — the
k5n8f family — vs. skill prose), and how prior-art lookup keeps finding archived
done tasks.

## Acceptance criteria

- [ ] INDEX done-lists have a stated cap; entries beyond it live in a reachable archive, and prior-art lookup still finds them.
- [ ] BC READMEs have a defined compaction trigger and procedure (consolidation, not silent deletion — ubiquitous language must survive).
- [ ] The pre-loaded context blocks that skills paste into spawn prompts stay bounded as a project ages.
- [ ] Compaction never breaks existing backlinks (`prior_art`, `related_adrs` ids keep resolving).

## Notes

Sibling of protocol rotation (agentic-workflow-r2c7m) — same growth disease,
different artifacts; if the k5n8f lifecycle scripts land first, INDEX compaction
is a natural addition to that script family. Source: harness audit 2026-07-02,
gap-table hole not carried into the Phase 4 recommendations — captured
separately on the 2026-07-02 follow-up review.
