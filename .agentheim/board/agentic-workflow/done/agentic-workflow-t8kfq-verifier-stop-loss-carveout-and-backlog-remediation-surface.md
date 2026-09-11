---
id: agentic-workflow-t8kfq
title: Verifier check 1 lacks the ADR-0065 stop-loss carve-out — an early-stopped spike gets FAILed into finishing the diagnosis it was told to skip; dispatch never surfaces a backlog-stranded same-thread remediation
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [spike-stop-loss, verifier, dispatch-ordering, adr-0065]
related_adrs: [0065, 0061, 0059]
related_research: []
prior_art: [agentic-workflow-rx630, agentic-workflow-mxk6v]
---

## Why

2026-07-22 post-survey audit finding (overshoot class): the two halves of ADR-0065 fight
the verification path.

1. `agents/worker.md` ("Third action" execution doctrine) declares an early-stopped
   `type: spike` a **legitimate completion** — the worker records the mitigation in
   `## Outcome`, moves the task to `done/`, returns SUCCESS with the fuller-diagnosis
   acceptance criteria unmet. But verifier check 1 (`agents/verifier.md`) requires every
   acceptance criterion to map to a test or artifact and contains no mention of
   spike/stop-loss/ADR-0065 (grep confirms none in verifier.md or the VBC skill). The
   first real early stop gets FAILed and the worker re-dispatched to complete exactly the
   diagnosis the doctrine told it to skip — the fix reproduces the Dorc waste it was
   built to prevent.
2. ADR-0065's founding incident had the diagnosed remediation sitting in **backlog/**
   while spikes ran. The dispatch-ordering preference (`skills/work/SKILL.md` Phase 3
   step 4) only reorders among *ready* (`todo/`) tasks — the original shape still
   dispatches the spike first with no signal emitted.

## What

1. **Verifier carve-out.** Amend check 1 in `agents/verifier.md`: when the worker's
   return (or the task's `## Outcome`) records an ADR-0065 early stop on a `type: spike`
   task, the unmet fuller-diagnosis criteria are not FAIL evidence — the verifier instead
   checks that the early stop is recorded per doctrine (mitigation named in `## Outcome`,
   stop-loss clause present in the task body) and judges the mitigation record, not the
   skipped diagnosis. VBC SKILL needs no edit (its check list is already a pointer).
   Amend ADR-0065 to note the carve-out.
2. **Backlog-remediation surface line.** In `skills/work/SKILL.md` Phase 3 step 4, when a
   ready `type: spike` task has a same-thread remediation (shared defect-family tag, or
   linked via `depends_on`/`blocks`/`prior_art`) sitting in `backlog/`, the conductor
   surfaces it in one line at dispatch ("ready spike X has an unpromoted same-thread
   remediation Y in backlog — promote first?"). Advisory only — never a gate, never an
   auto-promote (ADR-0027 family).

## Acceptance criteria

- [x] `agents/verifier.md` check 1 names the ADR-0065 early-stop case and instructs
      verifying the recorded mitigation instead of FAILing unmet fuller-diagnosis
      criteria on an early-stopped spike.
- [x] `skills/work/SKILL.md` Phase 3 step 4 carries the backlog-stranded same-thread
      remediation surface line, explicitly marked advisory (never gates, never
      auto-promotes).
- [x] ADR-0065 amended to record both: the verifier carve-out and the surface line
      closing its own founding-incident gap.

## Notes

Convention disposition (ADR-0059): **prose-only, unenforced** — both additions are
verifier/conductor judgment calls of the same shape as ADR-0065's existing prose-only
ordering half; no cheap mechanical predicate distinguishes "recorded early stop" or
"same-thread backlog remediation" without re-litigating the judgment.

Touches `skills/work/SKILL.md` (Phase 3 step 4) — same file as agentic-workflow-k9pbh
(different section, :55); fine to co-batch per the additive-edit heuristic, but don't
co-batch either with a wholesale rewrite of that file.

## Outcome

Closed both halves of the gap:

1. **Verifier carve-out.** `agents/verifier.md` check 1 gained a "Spike stop-loss early-stop
   carve-out (ADR-0065)" paragraph, right after the existing `[human-eye]` carve-out: when a
   `type: spike` task's worker return or `## Outcome` records an ADR-0065 early stop, the
   unmet fuller-diagnosis criteria are no longer FAIL evidence — the verifier instead checks
   the stop-loss clause is present in the task body and a concrete mitigation is named in
   `## Outcome`, judging that record rather than the skipped diagnosis. Confirmed
   `skills/verification-before-completion/SKILL.md`'s check list is already a pointer to
   `agents/verifier.md` — no edit needed there.
2. **Backlog-remediation surface line.** `skills/work/SKILL.md` Phase 3 step 4 gained a new
   bullet (sibling to the existing remediation-over-diagnosis bullet, same "same thread"
   definition): when a ready `type: spike` selected for the batch has a same-thread
   remediation sitting unpromoted in `backlog/`, the conductor surfaces one line in the batch
   rationale. Explicitly advisory only — never gates the spike, never auto-promotes
   (ADR-0027 family).
3. **ADR-0065 amended** with a new "Amended (agentic-workflow-t8kfq)" section recording both
   closures and their disposition (prose-only/unenforced, ADR-0059 — same judgment-call shape
   as the original ordering preference; no new lint). `related_tasks` and References updated.
4. **BC README's ADR-0065 entry updated** with the amendment summary.

No `~:NNN` raw line-number pointers introduced (checked via grep) — all cross-references use
section/rule names. `node --test lib/test/*.test.mjs`: 358/358 passing, no regressions.

Files: `agents/verifier.md`, `skills/work/SKILL.md`,
`.agentheim/knowledge/decisions/0065-remediation-over-diagnosis-dispatch-ordering-spike-stop-loss.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
