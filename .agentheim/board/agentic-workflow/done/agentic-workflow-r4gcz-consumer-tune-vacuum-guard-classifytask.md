---
id: agentic-workflow-r4gcz
title: Consumer-tune classifyTask — bug/refactor tasks are bucketed "harness" unconditionally, so a consumer project's legitimate product bug-fixing session reads as majority-harness drift
status: done
type: refactor
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [vacuum-guard, batch-mix, consumer-tuning, adr-0064]
related_adrs: [0064]
related_research: []
prior_art: [agentic-workflow-qz1h7, agentic-workflow-v4gmt, agentic-workflow-pzacx]
---

## Why

2026-07-22 post-survey audit (overshoot class): `classifyTask` in `lib/vacuum-guard.mjs`
(~:141-148) buckets every `type: bug` and `type: refactor` task as "harness"
unconditionally — the bucket-2 rationale (~:127-133) is explicitly written for
Agentheim's own self-hosting repo. In a consumer project (e.g. the Dorc game), a session
of legitimate product bug-fixing/refactoring reports as majority-"harness" in the
session-end batch-mix line — the meta-work drift detector itself emits false drift
signals. This is the one session-scoped mechanism the pzacx consumer-tuning pass
(ADR-0066 amendment) did not touch. Advisory-only, so nothing blocks — but the signal
exists to catch exactly the cyclic self-directed meta-work the survey flagged, and false
positives train the builder to ignore it.

## What

Make the bug/refactor classification path-aware like the other buckets: a `bug`/
`refactor` task whose FILE_LIST touches product surfaces classifies product-facing;
type-based harness bucketing applies only when the touched paths (or the absence of any)
actually indicate harness/doctrine surfaces — or, if simpler and defensible, scope the
type-based rule to self-hosting installs. Keep the check advisory and git-free. Update
the header comment's rationale, amend ADR-0064 with the consumer-tuning note, and keep
`skills/work/SKILL.md`'s batch-mix step wording accurate.

## Acceptance criteria

- [ ] `classifyTask` no longer classifies `type: bug`/`type: refactor` as "harness"
      unconditionally — a consumer-shaped bug task touching only product files
      classifies product-facing.
- [ ] `lib/test/` cases cover: consumer product bug → product-facing; self-hosting
      doctrine-surface bug → harness; existing classifications stay green.
- [ ] ADR-0064 amended recording the consumer-tuning; `skills/work/SKILL.md` batch-mix
      wording still matches the implemented behavior.

## Notes

Enforcement ships in-task via the `node --test` cases (ADR-0059 satisfied). Segment
matching caveat from v4gmt applies: FILE_LIST paths are absolute — reuse the existing
segment-match helpers rather than repo-relative assumptions.

## Outcome

`classifyTask` in `lib/vacuum-guard.mjs` made bucket 3 (`type: bug`/`type: refactor`)
path-aware instead of unconditionally-harness: a `bug`/`refactor` task whose touched
files are *entirely* product surfaces (none under `lib/`, `skills/`, `agents/`,
`references/`, `evals/`, or `.agentheim/knowledge/decisions/`) now classifies
product-facing; any touch on a harness/doctrine surface (or no files at all) still
classifies harness — the same conservative "entirely-or-else" bias bucket 1 uses.
Reintroduced the `HARNESS_SEGMENT_RE`/`ADR_SEGMENT_RE` segment-match regexes
`agentic-workflow-v4gmt` had found unused and removed — this task gives them their
intended job. Buckets 1 (chore) and 2 (feature/decision) are unchanged; bucket 4
(spike/other) stays unconditionally harness. 7 new `node --test` cases added to
`lib/test/vacuum-guard.test.mjs` (consumer product bug/refactor → product-facing;
self-hosting doctrine-surface bug/refactor → harness; ADR-touching bug → harness;
mixed product+harness bug → harness; no-files bug/refactor → harness); one existing
test renamed for accuracy (spike-only assertion split out, since refactor is no longer
unconditional). Full suite: 365/365 passing. ADR-0064 amended with a new "Amendment
(agentic-workflow-r4gcz)" section recording the rationale and the alternative
considered (scoping to self-hosting installs) and why path-awareness was chosen
instead. `skills/work/SKILL.md`'s end-of-run step 6 wording and the BC README's
ADR-0064 ubiquitous-language summary both updated to match the new heuristic.

Key files: `lib/vacuum-guard.mjs`, `lib/test/vacuum-guard.test.mjs`,
`.agentheim/knowledge/decisions/0064-vacuum-guard-empty-board-surfaces-blocking-decision.md`,
`skills/work/SKILL.md`, `.agentheim/contexts/agentic-workflow/README.md`.
