---
id: agentic-workflow-n3bbk
title: research commits nothing it writes — report, INDEX edits, and protocol entry strand as anonymous carry-over
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [audit-2026-07-22-followup, doctrine-drift, commit-doctrine, research]
related_adrs: [0026]
related_research: []
prior_art: [agentic-workflow-d7ksw]
---

## Why

`references/commit-doctrine.md:8` claims "Every skill that produces `.agentheim/` markdown
commits its own artifacts … so the working tree is clean after any session (ADR-0026)." But
`skills/research/SKILL.md` writes a report (`:36`), edits INDEX.md files (`:131-138`), and
prepends protocol entries (`:142-156`) — and contains no Committing section and no `git`
mention at all. ADR-0026 §4 names only `modeling`/`quick-capture`/`brainstorm` (+ `work`).
Net effect: a research run strands report + INDEX + protocol uncommitted — the exact
carry-over leak the doctrine says is closed — which `work`'s session-end reconciliation later
flags as anonymous orphans.

## What

Give `research` its own Committing section per ADR-0026: scoped `git add` of exactly the
report file, the touched `INDEX.md`(s), and `protocol.md`, with a message convention (e.g.
`chore(<bc-or-global>): research <slug>`). Add the matching row to
`references/commit-doctrine.md`'s message table, and amend ADR-0026 §4 to name `research`.

## Acceptance criteria

- [ ] `skills/research/SKILL.md` has a Committing section enumerating its scoped add set and
      message shape (grep for `git add` / commit message in the file succeeds).
- [ ] `references/commit-doctrine.md`'s message table carries a `research` row matching that
      shape exactly.
- [ ] ADR-0026 is amended to name `research` among the committing skills.

## Acceptance criteria — notes

The universal sentence at `commit-doctrine.md:8` then becomes true again; no scoping
carve-out needed.

## Notes

Found by the 2026-07-22 four-agent consistency audit (cross-doc drift finding #2, MEDIUM).

## Outcome

Added a Committing section to `skills/research/SKILL.md` (after the Protocol logging
section): scoped `git add` of the new report file, the touched `INDEX.md` (BC-local or
global), `protocol.md`, and any citing task/ADR touched in the same pass; commits silently
once the report clears the review gate (PASS / SKIP / iteration-3 labeled-unverified), with
message `chore(<bc-or-global>): research <slug>` (scope token dropped when indexed
globally, mirroring `work`'s own multi-BC shapes). Added the matching `research` row to
`references/commit-doctrine.md`'s message table. Amended ADR-0026 §4 (and its own
commit-message table) to name `research` among the committing skills.

Key files:
- `C:/src/heimeshoff/agentic/agentheim/.worktrees/agentic-workflow-n3bbk/skills/research/SKILL.md`
- `C:/src/heimeshoff/agentic/agentheim/.worktrees/agentic-workflow-n3bbk/references/commit-doctrine.md`
- `C:/src/heimeshoff/agentic/agentheim/.worktrees/agentic-workflow-n3bbk/.agentheim/knowledge/decisions/0026-committing-doctrine-bookkeeping-in-task-commit.md`
