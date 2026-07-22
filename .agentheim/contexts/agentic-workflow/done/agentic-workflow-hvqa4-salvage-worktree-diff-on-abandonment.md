---
id: agentic-workflow-hvqa4
title: Escalation salvages the worktree diff — attach a patch before any abandonment discards work
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [work, worktree, escalation, dorc-review]
related_adrs: [0032, 0063]
related_research: []
prior_art: [agentic-workflow-f6m2q, agentic-workflow-d6q4h]
---

## Why

Dorc review recommendation A1 (second half): when a task was abandoned at verification
iteration 3, the escalation path **discarded verified fixes with the worktree** — the
real z-order fixes had been found and confirmed working, then deleted along with the
`aw/<id>` branch. The builder had to re-derive work the system had already done.

## What

Any `work` path that abandons a worker's worktree with uncommitted changes — escalation
after the verification-iteration cap, a bounce, a skip — must first salvage the diff:
capture the worktree's changes as a patch, attach/reference it from the task's Notes,
and only then remove the worktree.

## Acceptance criteria

- [x] `skills/work/SKILL.md`: every abandonment path (post-FAIL escalation, bounce,
      skip-with-changes) salvages the worktree diff before worktree removal.
- [x] The patch's storage convention is decided and documented (location, naming,
      lifecycle — e.g. alongside the task file or under a salvage folder), recorded in an
      ADR or the task-format reference.
- [x] The escalation message to the builder names the salvaged patch so it is visible,
      not just stored.
- [x] If a helper lands in `lib/`, it is git-free (ADR-0038 three-layer boundary) and has
      `node --test` coverage.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A1. Sibling of
[[agentic-workflow-mxk6v]] (the refinement-side half); independent mechanism, no
dependency between them. ADR-0032 defines the worktree model this hooks into;
d6q4h's session-end carry-over reconciliation is the closest existing pattern.

ADR-0063 records the storage convention and the mechanize-or-drop declaration for both halves
of this task's own conventions (the path/naming scheme is mechanized; the "salvage before
every removal" sequencing itself is prose-only, unenforced — a lint could only check
after-the-fact artifact existence, not catch a skipped capture before the branch is gone).

## Outcome

Every worktree-abandonment path in `skills/work/SKILL.md` now salvages the worktree's diff to
a patch file before the worktree can become unrecoverable:

- **FAIL-iteration-3 escalation** — salvages immediately (tag `escalated-iterN`) even though
  the worktree is *kept*, not removed, at that moment — because a kept worktree can still be
  discarded later by a future session's Phase 1 recovery or session-end reconciliation, which
  is exactly how the confirmed incident (Dorc review A1: an already-verified fix deleted with
  its branch) happened. The escalation summary in End-of-run reporting now names the salvaged
  patch's path explicitly, not just the kept worktree's path.
- **BOUNCE integration** — salvages first (tag `bounced`) before the squash-merge and teardown,
  covering the rare case a worker edited files before discovering the task was under-refined.
- **Orphaned-worktree "discard" disposition** (session-end "Worktree carry-over" reconciliation,
  which Phase 1 recovery's same-posture check also defers to) — salvages (tag `discarded`)
  before `git worktree remove --force`; the carry-over line now names the salvaged patch (or
  records "nothing to salvage" on an empty diff).

Added one canonical "Salvaging a worktree's diff before abandonment" subsection to
`skills/work/SKILL.md` (between "BOUNCE integration" and the Verifier Prompt Template) that all
three call sites reference, spelling out the capture command
(`git -C <worktree> diff <fork-point-from-merge-base>`, conductor-only per ADR-0038), the
empty-diff skip guard, and the visibility requirement (a `## Salvage note` on the task file
plus naming the patch wherever the abandonment reaches the user).

Storage convention (ADR-0063): `.agentheim/salvage/<task-id>-<tag>.patch`, gitignored (added to
`.gitignore` alongside the existing `.worktrees/` and `.agentheim/state/` entries) — an
advisory rescue artifact (ADR-0027 family), never deleted by `work` on its own initiative. The
naming/path half of the convention is mechanized in `lib/worktree-salvage.mjs`
(`salvagePatchPath`, `ensureSalvageDir`, `escalationTag`, `BOUNCE_TAG`, `DISCARD_TAG`,
`formatSalvageReference`) — git-free per ADR-0038, `node --test`-covered
(`lib/test/worktree-salvage.test.mjs`, 14 tests). The "salvage before removal" sequencing
itself is recorded prose-only/unenforced per ADR-0059, with the rationale for why a lint
doesn't fit spelled out in ADR-0063's mechanize-or-drop declaration.

Discovered in passing (not fixed, out of scope): `skills/work/SKILL.md`'s BOUNCE integration's
`git merge --squash aw/<task-id>` step appears to have nothing committed on the branch to
merge, since no `checkpoint` call runs on the BOUNCE path before it — filed as
`agentic-workflow-p8q3z` in backlog for someone to confirm/fix. This task's own salvage capture
is unaffected either way, since it reads the worktree's actual working-directory state directly
rather than relying on that squash-merge.

Key files: `skills/work/SKILL.md`, `lib/worktree-salvage.mjs`,
`lib/test/worktree-salvage.test.mjs`, `.gitignore`,
`.agentheim/knowledge/decisions/0063-worktree-abandonment-diff-salvage.md`,
`.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/contexts/agentic-workflow/backlog/agentic-workflow-p8q3z-bounce-squash-merge-needs-a-checkpoint-commit-first.md`.
