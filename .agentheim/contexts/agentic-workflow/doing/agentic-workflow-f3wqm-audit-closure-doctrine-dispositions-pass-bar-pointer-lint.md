---
id: agentic-workflow-f3wqm
title: Audit-closure doctrine — disposition the three open undershoot residuals, define the audit PASS bar and dated audit stamp with delta-scoping, and ban raw line-number pointers in doctrine prose (lint-enforced)
status: doing
type: feature
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: [agentic-workflow-k9pbh]
blocks: []
tags: [audit-closure, convergence, vacuum-guard, doctrine-pointers, adr-0067, adr-0068]
related_adrs: [0059, 0061, 0064, 0067, 0068]
related_research: []
prior_art: [agentic-workflow-znwve, agentic-workflow-z394j, agentic-workflow-qz1h7, agentic-workflow-mxk6v]
---

## Why

The builder has now asked "did we miss something?" three times and each full-tree audit
produced fresh findings. The recurrence has structural causes: judgment residuals left
undispositioned get re-found by every fresh auditor; un-mechanized finding classes
(stale line-number pointers are on their third consecutive audit) recur by construction;
and an unbounded full-tree audit has no defined PASS state, so it can never report
"done". ADR-0067 proved the counter-pattern works: once a decline is a visible decision
record, no auditor re-raises it. This task makes that the standing discipline.

Three specific residuals from the 2026-07-22 four-agent audit are currently
undispositioned and WILL be re-found by the next audit:

1. **Vacuum-guard conditional refusal** — both call sites (`skills/work/SKILL.md` Phase 2
   step 8, `skills/modeling/SKILL.md` Opening step 2) place "do not self-generate
   substitute work" *inside* the branch where `extractOpenQuestions` returns ≥1 item;
   with no open vision questions the anti-filler refusal never textually applies — yet
   inventing work outside the board was precisely the Dorc failure ADR-0064 closes.
2. **Check 1b cross-task blindness** — the ADR-0061 metric-drift detector only compares
   a task against its own iteration history; a proxy drifting across a chain of fresh
   iteration-1 tasks (the actual Dorc shape) produces no signal.
3. **Untyped investigation tasks** — an "investigate why X" task captured as `bug`/
   `chore` escapes the whole ADR-0065 apparatus (stop-loss clause, ordering preference),
   which keys on `type: spike`; nothing in modeling forces investigation-shaped tasks
   into the spike type.

## What

One ADR ("audit-closure doctrine") plus its enforcement, four parts:

1. **Disposition the three residuals** — each gets fix or decline-with-rationale in the
   ADR, ADR-0067 posture (revisit-on-evidence, never silent). Recommended dispositions,
   worker validates against the ADRs' own reasoning: (1) **fix** — move the
   do-not-self-generate refusal outside the open-questions branch at both call sites, so
   it applies whenever the board is empty regardless of whether `extractOpenQuestions`
   returns anything (small prose edit, apply in this task); (2) **decline** pending a
   concrete incident — cross-task drift detection requires cross-task state no current
   mechanism holds, same evidence-gap grounds as ADR-0067's checkpoint decline;
   (3) **decline** pending incident, but add one sentence to modeling's `type` legend
   nudging investigation-shaped captures toward `type: spike`.
2. **Define the audit PASS bar** — a consistency audit passes when it yields zero
   findings of class contradiction / lost-rule / code-doctrine-behavior-mismatch.
   Cosmetic classes (stale pointers, counts, wording) are fix-or-dismiss in the same
   session — never carried, never counted as "missed". Judgment findings (overshoot /
   undershoot opinions) that are declined must land as ADR dispositions in the same
   wave, per ADR-0067.
3. **Dated audit stamp + delta-scoping** — each audit ends with a dated record (in
   `.agentheim/knowledge/`, worker picks the exact home and format) naming the bar
   applied, the verdict, and the HEAD audited. The next "did we miss something" audit
   scopes to the diff since the last stamp plus that stamp's open dispositions —
   full-tree re-audits only on explicit builder request. Write the first stamp for the
   2026-07-22 audit as part of this task so the baseline exists.
4. **Ban raw line-number pointers in doctrine prose** — `skills/`, `agents/`,
   `references/` prose must reference other doctrine by greppable anchor (step / section
   / rule name), never `~:NNN` line numbers (the class has produced findings in three
   consecutive audits). Ship the lint (`node --test`, live-tree, same family as
   `lib/index-entry-length.mjs`) and leave the tree green: fix remaining occurrences or
   carry an explicit enumerated allowlist with rationale. Depends on k9pbh (which
   already fixes two occurrences) to avoid conflicting edits.

## Acceptance criteria

- [ ] The audit-closure ADR exists and dispositions all three named residuals — each
      explicitly fix or decline-with-rationale, revisit-on-evidence posture.
- [ ] If disposition (1) is fix: the vacuum-guard refusal applies on an empty board even
      when `extractOpenQuestions` returns nothing, at both call sites, and ADR-0064 is
      amended accordingly.
- [ ] The ADR defines the PASS bar and the audit-stamp + delta-scoping convention;
      these two are marked **prose-only, unenforced** (ADR-0059) in the ADR itself —
      audit conduct is conductor judgment, not lintable.
- [ ] The line-pointer lint ships and runs green in `node --test lib/test/*.test.mjs` —
      doctrine prose carries no raw line-number pointers outside an enumerated,
      justified allowlist.
- [ ] The first audit stamp (2026-07-22 audit: bar applied retroactively, verdict,
      HEAD, open dispositions → this task's ADR) is written.

## Notes

Typed `feature`, not `decision`, per the rx630/z394j precedent — decision tasks output
only an ADR, and this one ships a lint plus two small doctrine edits alongside its ADR.
Touches `skills/work/SKILL.md` (Phase 2 step 8) and `skills/modeling/SKILL.md` (Opening
step 2 + type legend) — different sections from t8kfq/k9pbh's edits, but do not co-batch
with any wholesale rewrite of either file.
