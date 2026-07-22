---
id: agentic-workflow-mqwnc
title: Doc micro-sweep — verifier task-file location, stale bc-readme-template pointer, INDEX done-list header wording
status: doing
type: chore
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: [agentic-workflow-bx01e]
tags: [audit-2026-07-22-followup, doctrine-drift]
related_adrs: [0047, 0039]
related_research: []
prior_art: [agentic-workflow-d7ksw, agentic-workflow-s9wtc]
---

## Why

Three disjoint one-line drifts left over from the 2026-07-22 consistency audit — each too
small to be its own task, batched per the d7ksw precedent:

1. `agents/verifier.md:21` says the task file is "currently in `doing/`" — but on the normal
   SUCCESS path the worker has already moved it to `done/` (`agents/worker.md:149`), and both
   other sources say "doing/ or done/" (`skills/work/SKILL.md:225`,
   `skills/verification-before-completion/SKILL.md:29`).
2. `references/bc-readme-template.md:42` cites the pre-resolved-test-command step as
   `skills/work/SKILL.md ~:136-138`; it now sits at ~:145.
3. The INDEX done-list header (`references/index-template.md` and the live
   `contexts/agentic-workflow/INDEX.md:27`) says "most recent 30" — but rotation (ADR-0047)
   rolls whole closed months, so the live list legitimately holds all current-month entries
   (81 today). The "30" is a phantom cap that never governs anything.

## What

1. `agents/verifier.md:21` → "currently in `doing/` or `done/`".
2. `references/bc-readme-template.md:42` → point at the step's current location (keep the
   `~` softener or name the section instead of a line number).
3. Reword the done-list header in `references/index-template.md` and the live INDEX(es) to
   describe the actual discipline: current-month entries live; older months archived
   verbatim under `done-archive/` (ADR-0047/0039).

## Acceptance criteria

- [ ] `grep -n "currently in" agents/verifier.md` shows "doing/ or done/".
- [ ] `references/bc-readme-template.md`'s pointer resolves to the step's actual location.
- [ ] `grep -rn "most recent 30" references/ .agentheim/contexts/*/INDEX.md` returns nothing;
      the replacement wording names the monthly cap-and-roll.

## Notes

The lib-bootstrap "five vs. six one-liners" miscount found by the same audit is NOT in this
sweep — agentic-workflow-ewt9s rewrites that intro line while adding sections, so the fix
rides there (collision avoidance).
