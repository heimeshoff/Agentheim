---
id: agentic-workflow-mqwnc
title: Doc micro-sweep — verifier task-file location, stale bc-readme-template pointer, index-template done-list header wording
status: doing
type: chore
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: [agentic-workflow-bx01e, agentic-workflow-jf6qz]
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
   `contexts/*/INDEX.md`) says "most recent 30" — but rotation (ADR-0047) rolls whole closed
   months, so the live list legitimately holds all current-month entries (well past 30). The
   "30" is a phantom cap that never governs anything.

## What

1. `agents/verifier.md:21` → "currently in `doing/` or `done/`".
2. `references/bc-readme-template.md:42` → point at the step's current location (keep the
   `~` softener or name the section instead of a line number).
3. Reword the done-list header **in `references/index-template.md` only** — describe the
   actual discipline: current-month entries live; older months archived verbatim under
   `done-archive/` (ADR-0047/0039).

**Scope carve-out (re-scoped 2026-07-22 after escalation — see the `## Verifier note` /
`## Salvage note` history and ADR-0032/ADR-0059).** The original task also required rewording
the three **live** `.agentheim/contexts/*/INDEX.md` done-list headers. That is deliberately
**out of scope** here and moved to `agentic-workflow-jf6qz`, because:

- A live `INDEX.md` is conductor-owned; a worker must not edit it (worker rule 3 in
  `skills/work/SKILL.md`; verifier checks 3 & 7). This task edits only worker-legal reference
  docs — `agents/`, `references/` — never a live `INDEX.md`.
- The live header line is **machine-generated**: `lib/index-rotation.mjs`'s
  `archivedDoneHeader()` regenerates it (line ~338, the `DONE_HEADER_LINE` replace) on every
  real rotation. A hand-edit here would be reverted on the next month-roll. The durable fix is
  the code, owned by `agentic-workflow-jf6qz`.

## Acceptance criteria

- [ ] `grep -n "currently in" agents/verifier.md` shows "doing/ or done/".
- [ ] `references/bc-readme-template.md`'s pointer resolves to the pre-resolved-test-command
      step's actual location (verify it points where the step now sits).
- [ ] `grep -rn "most recent 30" references/` returns nothing; the replacement wording in
      `references/index-template.md` names the monthly cap-and-roll (current-month live,
      older months archived under `done-archive/`, ADR-0047/0039).
- [ ] The live `.agentheim/contexts/*/INDEX.md` headers are **not** touched by this task — the
      diff contains no `INDEX.md` change. (Their correction rides `agentic-workflow-jf6qz`.)

## Notes

The lib-bootstrap "five vs. six one-liners" miscount found by the same audit is NOT in this
sweep — agentic-workflow-ewt9s handled that (now done, 2026-07-22).

Re-scope history: this task was escalated once (iteration hint `task-under-specified`) because
its original criterion #3 mandated editing conductor-owned, code-regenerated live `INDEX.md`
headers — impossible for a worker to satisfy legally. Re-scoped via `modeling` REFINE on
2026-07-22 to the three worker-legal reference-doc edits above; the live-header + code side was
split into `agentic-workflow-jf6qz`. `blocks: agentic-workflow-jf6qz` so the template wording
this task lands is the canonical string jf6qz's code must match.
