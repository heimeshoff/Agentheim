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
related_adrs: ["0017", "0022", "0026", "0027"]
related_research: []
prior_art: []
---

## Why

A BC's `README.md` accretes ubiquitous-language entries and per-feature narration
forever — this BC's is already **811 lines / ~28k tokens**, past the 25k Read cap,
so it can no longer be read in a single pass (the refinement session that split
this task hit exactly that wall, and this refinement had to page it). READMEs are
pre-loaded whole into every worker/specialist spawn, so the growth silently taxes
every spawn's context budget.

Unlike the INDEX done-list ([[agentic-workflow-c8j3w]]) and the protocol
([[agentic-workflow-r2c7m]]), a README is **curated prose**: compaction means
*consolidating and rewriting*, not verbatim rotation. So it cannot be scripted (a
machine can't safely rewrite ubiquitous language without dropping meaning) and it
must keep the builder in the loop — ubiquitous language and invariants must
survive. This is the family's **flag-and-consolidate** discipline (judgment,
human-in-loop, rewritten *in place* — nothing rolls to an archive), as opposed to
the siblings' **cap-and-roll** discipline (verbatim, scripted, rolled to a dated
archive). That is why this task is deliberately **not** in the k5n8f script family
and needs **no** archive convention — it stands independent of the sibling chain
(`depends_on: []`). Split from the original c8j3w capture, whose INDEX half is the
mechanical sibling.

## What

Define a **trigger** and a **procedure** for consolidating a BC README.

- **Trigger** — a **line-count threshold** on `README.md`, checkable without
  judgment (no tokenizer). Proposed cap **~600 lines**, calibrated to the ~25k-token
  Read cap: at this BC's prose density (~34.8 tok/line) a README becomes
  un-Readable in one pass around ~718 lines, so flagging at ~600 leaves headroom to
  consolidate *before* it can no longer be read whole. When a README crosses the
  threshold, **`whats-next` surfaces it** — an advisory line in its *recommended
  move* section ("README `<bc>` is over the consolidation threshold — consolidate").
  whats-next already performs an advisory write (ADR-0027) and reads per-BC state,
  so this rides its existing machinery; **no skill auto-rewrites prose unattended.**

- **Procedure** — a new **`modeling` CONSOLIDATE sub-action** (a 5th verb beside
  CAPTURE / REFINE / PROMOTE / DISMISS), builder-in-the-loop and orchestrator-backed,
  that consolidates the prose: merge redundant ubiquitous-language entries, fold
  superseded per-feature narration (the "aw-0NN did X, then aw-0MM superseded it"
  chains) into settled summaries, and drop dead detail — **never silently deleting
  a term or invariant.** Every ubiquitous-language entry and invariant survives the
  rewrite. It commits its own scoped markdown (the rewritten README + protocol
  entry) like every other modeling action (ADR-0026). This mirrors how DISMISS
  (aw-046) added a verb to modeling with ADR-0022 falling out as its frozen
  contract.

Decide during work: the exact line cap (the ~600 proposal is a starting point, not
frozen), and whether whats-next flags **only** or also emits a machine cue the
dashboard could badge later (out of scope here — flag-via-whats-next is the MVP).

## Acceptance criteria

- [ ] BC READMEs have a defined consolidation trigger — a stated **line-count** threshold (~600 lines), checkable without judgment (no tokenizer, no per-file estimate).
- [ ] `whats-next` surfaces an over-threshold BC as a recommended move (a `README <bc>` advisory line); **no** skill auto-rewrites README prose unattended.
- [ ] A defined `modeling` **CONSOLIDATE** sub-action consolidates the prose with the builder in the loop: it merges/rewrites, never silently deletes; every ubiquitous-language term and invariant survives the rewrite.
- [ ] Consolidation never breaks backlinks — ADR ids and task ids referenced in the README keep resolving after a rewrite.
- [ ] CONSOLIDATE commits its own scoped markdown (rewritten README + protocol entry), matching every modeling action's commit doctrine (ADR-0026).
- [ ] The pre-loaded README context blocks that skills paste into spawn prompts stay bounded as a project ages (this BC's own README, post-consolidation, is Read-able in one pass).

## Notes

**Family placement.** Sibling of INDEX rotation ([[agentic-workflow-c8j3w]]) and
protocol rotation ([[agentic-workflow-r2c7m]]) — same growth disease, but prose not
a list, so **flag-and-consolidate** (judgment, human-in-loop, in-place) rather than
**cap-and-roll** (verbatim, scripted, archived). Explicitly **not** a
[[agentic-workflow-k5n8f]] script: a deterministic tool can rotate a list verbatim
but cannot safely rewrite ubiquitous language. Human-in-the-loop is the point, not
a limitation (ADR-0017's read-only / builder-in-loop stance). Because it rewrites in
place with no archive roll-out, it needs neither r2c7m's archive convention nor a
k5n8f dependency — hence `depends_on: []`.

**ADR candidates when worked** (do not pre-write):
1. The **CONSOLIDATE verb** is a doctrine addition to `modeling` — like DISMISS's
   ADR-0022, its contract (trigger, the "every term & invariant survives" guarantee,
   the commit scope) likely deserves its own ADR.
2. The broader **two-disciplines** framing (cap-and-roll vs. flag-and-consolidate for
   artifact growth) spans r2c7m / c8j3w / w7q2m — a candidate for one unifying ADR so
   the three growth surfaces don't fragment into three mental models.

This BC's own README is the live poster child — 811 lines, past the Read cap, the
exact artifact both the original split and this refinement had to page.

**Refinement note (2026-07-03).** The three "decide during work" forks — procedure
home, threshold metric, flag mechanism — were resolved to (CONSOLIDATE sub-action /
~600-line count / whats-next advisory) by **best judgment while the builder was
away**, not by confirmed decision. Left in `backlog/` deliberately: adding a 5th
modeling verb is a doctrine change that wants builder sign-off before PROMOTE.

Source: harness audit 2026-07-02, Phase 2 gap table (context/memory row). Split
from the original c8j3w capture on the 2026-07-02 refinement; sharpened 2026-07-03.
