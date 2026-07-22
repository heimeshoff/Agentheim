---
id: agentic-workflow-m7xva
title: commit-doctrine's churn paragraph drifted a third time — delete-and-pointer it per ADR-0068; the shape table misses trailer-less batch-capture and release commits, so churn misclassifies them as human
status: doing
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [commit-doctrine, session-start-churn, drift-twice, adr-0066, adr-0068]
related_adrs: [0066, 0068, 0026]
related_research: []
prior_art: [agentic-workflow-c5nvb, agentic-workflow-pzacx, agentic-workflow-d7ksw, agentic-workflow-hhjjx]
---

## Why

2026-07-22 post-survey audit, found independently by two auditors:

1. `references/commit-doctrine.md` ~:61-69 still states the session-start churn step
   "deliberately does not try to distinguish these known machine shapes from a real human
   commit" — superseded by ADR-0066's pzacx amendment (`recognizeMachineShape` /
   `partitionUntrailedCommits` in `lib/session-start-churn.mjs` now do exactly that;
   `skills/work/SKILL.md` ~:42 says the stance was replaced). This paragraph family has
   now drifted a **third** time (d7ksw, c5nvb, now this) — ADR-0068's drift-twice rule
   applies: delete the restatement and pointer the canonical source, never re-sync.
2. The shape table isn't exhaustive, which ADR-0066's churn partition depends on. Real
   machine commits it misses: trailer-less multi-capture batch commits
   (`2e2b241` "chore(agentic-workflow): capture 10 post-Dorc consistency-audit follow-up
   tasks") and release-flow commits (`2ac05bc` `chore(release): v0.9.2`, documented in
   RELEASE.md but absent here). Both get counted as *human* churn. Additionally
   `a328700` `chore(protocol): record v0.9.2 release shipped [work]` passes
   `hasTaskTrailer` only because `[work]` happens to satisfy the trailer regex.

## What

1. Replace the ~:61-69 churn-behavior paragraph with a one-line pointer to
   `lib/session-start-churn.mjs` + ADR-0066's amendment (ADR-0068 discipline — no third
   re-sync).
2. Add table rows for the trailer-less batch-capture shape and the release-flow shapes
   (`chore(release): vX.Y.Z`; the `chore(protocol): record … [work]` release record —
   either document `[work]` as a sanctioned pseudo-trailer or give the shape its own
   row and tighten expectations, worker's choice with rationale recorded).
3. Extend `MACHINE_SHAPES` in `lib/session-start-churn.mjs` to recognize the added
   shapes; keep the module's table↔regex completeness note truthful; `node --test` cases
   assert the real historical subjects (the 2e2b241 / 2ac05bc / a328700 shapes) partition
   as machine, not human.

## Acceptance criteria

- [ ] `references/commit-doctrine.md` no longer carries the "deliberately does not
      distinguish" claim — the churn-behavior text is a pointer, not a restatement
      (ADR-0068 applied and noted in the task/ADR record).
- [ ] The shape table covers trailer-less batch-capture and release-flow commits.
- [ ] `MACHINE_SHAPES` recognizes the added shapes; tests cover the three real
      historical commit subjects; existing 8-shape tests stay green.
- [ ] Table rows and `MACHINE_SHAPES` entries agree 1:1 (the module's completeness
      comment updated).

## Notes

Enforcement ships in-task via the `node --test` cases (ADR-0059 satisfied). ADR-0066
should gain a short amendment note recording the table extension.
