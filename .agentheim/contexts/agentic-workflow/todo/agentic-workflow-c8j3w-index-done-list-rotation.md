---
id: agentic-workflow-c8j3w
title: INDEX done-list rotation — cap the done-list and roll older entries to a dated archive
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-k5n8f, agentic-workflow-r2c7m]
blocks: []
tags: [harness-audit, context-management, index, compaction]
related_adrs: ["0023"]
related_research: []
prior_art: []
---

## Why

A BC's `INDEX.md` done-list grows monotonically — this BC's is already **90
entries** and climbing (~6/day; it was 84 when this was first captured a day
ago). The done-list is pre-loaded whole into `modeling`'s prior-art lookup and
into the dashboard search corpus (`buildTree`, ADR-0023), so its unbounded growth
silently taxes every spawn's context budget. Same growth disease as protocol
rotation ([[agentic-workflow-r2c7m]]), different artifact — verbatim rotation, not
prose rewrite.

Split from the original c8j3w capture ("Compaction policy for BC READMEs and the
growing INDEX files"): the README half is a different problem — curated prose that
needs judgment-driven consolidation, not mechanical rotation — and moved to its
own task [[agentic-workflow-w7q2m]]. This task is the INDEX half only.

## What

Cap the live done-list at the **N most-recent** entries and roll everything older,
**verbatim**, to a dated archive under `contexts/<bc>/` (mirror r2c7m's archive
convention rather than inventing a divergent one). The rotation lands as one more
deterministic operation in the [[agentic-workflow-k5n8f]] lifecycle-script family,
not hand-edited marker surgery — a rotate step folded into the complete/capture
scripts.

The load-bearing constraint is **reachability**. `modeling`'s backlink matcher
reads the target BC's `INDEX.md` done-task list to auto-populate `prior_art`, and
the dashboard search corpus is single-sourced from the tree walk (ADR-0023). If
done entries roll out of `INDEX.md`, the archive must stay in scope for **both** —
either the matcher/corpus also read the archive file, or the archive is itself
indexed — so an archived done task is still findable by keyword. Decide the exact
mechanism during work; the acceptance criteria fix the outcome.

## Acceptance criteria

- [ ] The done-list has a stated cap (propose N ≈ 30); entries beyond it are moved **verbatim** to a dated archive file under `contexts/<bc>/`, never rewritten or summarized.
- [ ] `modeling`'s prior-art matcher still surfaces archived done tasks — an archived done task remains findable by keyword (matcher and/or search corpus reach the archive).
- [ ] Rotation is deterministic — a k5n8f-family script or a precisely-specified marker edit, run the same way every time, not ad-hoc.
- [ ] The done-list header / INDEX pointers name the archive location; existing backlinks (`prior_art`, `related_adrs` ids) keep resolving after rotation.
- [ ] Covered by `node --test` alongside the k5n8f lifecycle-script tests.

## Notes

Sibling of protocol rotation ([[agentic-workflow-r2c7m]]) — same cap-and-roll
pattern; reuse its archive-file convention so the three growth surfaces (protocol,
INDEX, README) don't fragment into three different archive shapes. `depends_on`
both siblings deliberately: **k5n8f** because the rotation should be a script in
that family (and k5n8f resolves the marker-edit mechanics this would otherwise
hand-roll); **r2c7m** because its archive convention should be decided *before*
this picks one, to avoid divergence.

No new ADR — this **applies** r2c7m's rotation decision to the INDEX artifact
rather than deciding something new.

Source: harness audit 2026-07-02, Phase 2 gap table (context/memory row), captured
on the 2026-07-02 follow-up review. Refined + split 2026-07-02.
