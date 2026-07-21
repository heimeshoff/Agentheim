---
id: agentic-workflow-rx630
title: Dispatch ordering — a known-cheap remediation outranks further diagnosis; spikes carry a stop-loss
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [work, dispatch, spike, doctrine, dorc-review]
related_adrs: [0065]
related_research: []
prior_art: []
---

## Why

Dorc review recommendation A5: three diagnosis spikes on the same defect family were
completed while the already-diagnosed, cheap root-cause remediation sat in backlog. One
spike pinned exactly which node caused the symptom — then applied the workaround it
would have applied without the diagnosis. Diagnosis kept outrunning the fix because
nothing in dispatch ordering preferred fixing.

## What

1. **Dispatch ordering**: when `work` scans the ready set, a remediation task whose root
   cause is already diagnosed and whose fix is cheap outranks further diagnosis
   spikes on the same thread (same defect family / shared tags / linked tasks).
2. **Spike stop-loss**: spike doctrine gains a standing clause — "if, mid-spike, the
   mitigation is already known and cheap, record it and stop." The worker ends the spike
   early with the recorded mitigation instead of completing the full diagnosis.

## Acceptance criteria

- [ ] `skills/work/SKILL.md` (scan/dispatch): the remediation-over-diagnosis preference
      is part of dispatch ordering, with the "same thread" linkage defined (tags,
      `depends_on`/`blocks`, or prior-art links).
- [ ] Spike doctrine (task format notes in `skills/modeling/SKILL.md` and/or the worker's
      execution doctrine): every `type: spike` task carries the stop-loss clause; a
      stopped-early spike is a legitimate completion, recorded as such.
- [ ] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A5. Keep the preference a
*dispatch ordering* rule, not a gate — a builder explicitly asking for deeper diagnosis
still gets it.

## Outcome

Shipped both doctrine halves plus ADR-0065.

1. **Dispatch ordering** — `skills/work/SKILL.md` Phase 3 step 4 gained a
   "Remediation-over-diagnosis" clause: a ready remediation task whose root cause is already
   diagnosed and whose fix is cheap outranks a ready further-diagnosis `spike` on the same
   thread (shared `tags`, `depends_on`/`blocks`, or `prior_art` link). Ordering only, never a
   gate — an explicit builder request for deeper diagnosis is dispatched as asked.
2. **Spike stop-loss** — `skills/modeling/SKILL.md`'s `type` field legend now instructs task
   authors to include the stop-loss clause when minting a `type: spike` task; `agents/worker.md`
   gained a "Spike stop-loss (ADR-0065)" section making an early-stopped spike (recorded
   mitigation in `## Outcome`) a legitimate `SUCCESS` completion, not a bounce/fail.
   Enforcement: `lib/spike-stop-loss.mjs` + `lib/test/spike-stop-loss.test.mjs`, a date-
   grandfathered (`ADOPTION_DATE = 2026-07-21`) live-tree lint mirroring
   `lib/index-entry-length.mjs`'s shape — flags any `type: spike` task minted after adoption
   whose body lacks the clause. All 6 existing spike tasks on disk predate adoption and are
   grandfathered untouched.
3. Mechanize-or-drop split per ADR-0065: dispatch ordering is prose-only/unenforced
   (judgment call, same shape as the existing planning-advisory weighting); the stop-loss
   clause ships enforcement (a mechanically checkable structural predicate).

Files: `skills/work/SKILL.md`, `skills/modeling/SKILL.md`, `agents/worker.md`,
`lib/spike-stop-loss.mjs`, `lib/test/spike-stop-loss.test.mjs`,
`.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/knowledge/decisions/0065-remediation-over-diagnosis-dispatch-ordering-spike-stop-loss.md`.
9 new tests, all passing (313/313 in the full `lib/test/*.test.mjs` run).
