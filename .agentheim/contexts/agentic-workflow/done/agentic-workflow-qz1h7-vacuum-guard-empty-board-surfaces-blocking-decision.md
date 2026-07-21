---
id: agentic-workflow-qz1h7
title: Vacuum guard — an empty board surfaces the blocking decision instead of minting meta-work; session-end batch-mix line
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [work, modeling, doctrine, advisory, dorc-review]
related_adrs: [0040, 0027, 0064]
related_research: []
prior_art: [agentic-workflow-x4t2g, agentic-workflow-v6d4n]
---

## Why

Dorc review recommendation A2: with todo empty in all six BCs and the vision's own open
questions unmade (next milestone unchosen for ~78 days), agent capacity flowed to what is
self-discoverable — the harness's own test failures — producing a week that was ~2/3
meta-work. An empty board is a *user decision waiting*, not agent fuel, and nothing in
the framework made the drift visible while it was happening.

## What

1. **Vacuum guard**: when the ready set / backlog is empty and `vision.md` carries
   explicitly open questions or unmade decisions, `work` and `modeling` refuse to
   self-generate harness/bookkeeping work and instead surface the blocking decision with
   its age ("the next-milestone decision has been open 78 days").
2. **Batch-mix visibility**: the `work` session-end protocol entry gains one line
   classifying the batch — X% product-facing / Y% harness / Z% bookkeeping — so drift
   toward meta-work is visible per session, not discovered after a week.

Both are advisory (ADR-0027/0040 family) — the builder can always explicitly capture or
dispatch meta-work; the guard only stops *self-generated* filler.

## Acceptance criteria

- [x] `skills/work/SKILL.md`: empty ready set + open vision decision → the session
      surfaces the decision(s) with age instead of generating substitute work; wording
      makes clear this is the highest-leverage builder action.
- [x] `skills/modeling/SKILL.md` (Opening flow): bare invocation with an empty backlog
      surfaces open vision decisions before inviting new capture.
- [x] Session-end protocol entry includes the batch-mix line; the classification
      heuristic (e.g. by task type + target surface) is documented where the entry format
      is defined.
- [x] Never a hard gate — explicit builder requests are untouched (vision non-goal 3
      holds: human stays in the loop, framework doesn't refuse the human).
- [x] An ADR records the doctrine.

## Outcome

Shipped both coupled mechanisms as a new git-free `lib/vacuum-guard.mjs` (27 `node --test`
cases, `lib/test/vacuum-guard.test.mjs`) plus prose wiring in `skills/work/SKILL.md`
(Phase 2 new step 8 "Vacuum guard"; end-of-run reporting new step 6 "Batch-mix
classification" + the session-end protocol entry's new `**Batch mix:**` line; all
downstream step numbers renumbered and cross-references fixed) and
`skills/modeling/SKILL.md` (Opening flow step 2). `vision.md`'s one existing open question
("Brainstorm on existing code") was backfilled with `(open since 2026-06-05)`, the date
confirmed via `git log -S"Brainstorm on existing code" --follow -- .agentheim/vision.md`
(present since the vision's initial commit `e116a87`). `lib/vacuum-guard.mjs` reuses
`vision-conformance.mjs`'s `extractSection`/`labelFor` rather than duplicating markdown
extraction. ADR-0064 records the doctrine, including the mechanize-or-drop split (open-
question extraction and batch-mix classification are mechanized; "remember to annotate a
newly-captured open question" stays prose-only, documented as such). BC README updated
with a new bullet. Full `lib/` suite: 304/304 passing.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A2. The vision-conformance check
(v6d4n / ADR-0040) is the closest existing pattern — same session-end advisory slot; this
adds the quantitative mix line and the empty-board refusal. `whats-next` (ADR-0027,
x4t2g) is the natural surface for the "blocking decision + age" line.
