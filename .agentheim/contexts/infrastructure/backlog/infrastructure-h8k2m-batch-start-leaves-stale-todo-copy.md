---
id: infrastructure-h8k2m
title: Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/
status: backlog
type: bug
context: infrastructure
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [task-lifecycle, cli, claimBatch, batch-start, duplicate-id-check]
related_adrs: [0038]
related_research: []
prior_art: []
---

## Why

Discovered while working `infrastructure-m3q7k` in its worktree: the batch-start commit
(`0fea549`) that moved `infrastructure-m3q7k`'s task file `todo/` -> `doing/` added the file at
its new `doing/` path but never removed the old copy at
`.agentheim/contexts/infrastructure/todo/infrastructure-m3q7k-derivecontext-leading-digit-token-id.md`.
Both copies were byte-identical apart from `status:` (`todo` vs `doing`) — a clear leftover, not
an intentional dual-state. `INDEX.md`'s todo-list/doing-list markers were bookkept correctly
(the id appears only in the doing-list), so this is purely a **filesystem** artifact, not an
INDEX corruption — but it tripped `findDuplicateTaskIds`'s live-tree test
(`lib/test/duplicate-id-check.test.mjs`), which (correctly) flags two files claiming one id.

This smells like `claimBatch` / the mover writing the new-location file before removing the
old one (or a `git add` without a paired `git rm` of the source path), rather than the
digit-lead token bug `m3q7k` itself fixes — `m3q7k`'s own token leads with a letter (`m`), so
it is not an instance of the ADR-0028/ADR-0044 grammar issue.

## What

Investigate `claimBatch` / `applyTaskMove` (`lib/task-lifecycle.mjs`) and the batch-start CLI
call site to find where a moved file's source-path copy can survive a move, and fix it so a
lifecycle move is atomic w.r.t. the two paths (old path gone, new path present) even under
whatever git/write sequencing batch-start uses. Add a regression test asserting the source path
no longer exists after a mechanized move.

## Acceptance criteria

- [ ] Root-caused: identify exactly which code path (mover, CLI wrapper, or the batch-start
      skill step) leaves the stale source-path file.
- [ ] Fixed so a mechanized `todo -> doing` (and by extension any lifecycle) move never leaves
      a duplicate at the source path.
- [ ] A regression test in `lib/test/task-lifecycle.test.mjs` (or wherever the fix lands)
      asserts the source path is absent post-move.
- [ ] `lib/test/duplicate-id-check.test.mjs`'s live-tree test stays green going forward under
      normal mechanized moves.

## Notes

- The stray `todo/` copy for `infrastructure-m3q7k` was deleted as part of unblocking
  `infrastructure-m3q7k`'s own test run (its live-tree duplicate-id test was failing on this
  unrelated pre-existing artifact); this backlog task is the follow-up to root-cause and fix
  the underlying mover/CLI bug, not just the one-off symptom.
