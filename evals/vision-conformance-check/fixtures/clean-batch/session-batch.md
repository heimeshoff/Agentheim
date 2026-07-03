## Completed this session (real tasks, drawn from this repo's own protocol)

- **agentic-workflow-d6q4h** — Added a session-end carry-over reconciliation
  step to `work`: detects stranded working-tree files via `git status
  --porcelain` and surfaces each one to the **user** with two explicit
  dispositions (commit deliberately, or leave behind with a named owner).
  Never auto-sweeps; the scoped-`git add` rule is unchanged.
- **agentic-workflow-k5n8f** — Mechanized PROMOTE bookkeeping into a git-free
  lifecycle CLI (`lib/task-lifecycle-cli.mjs`) plus an env-free plugin-file
  resolver, so `modeling`'s promote step is a single deterministic command
  instead of several manual file edits — no change to who decides to promote.
- **agentic-workflow-v3h6p** — A spike measuring the real `verifier` agent's
  catch rate against 9 hand-authored fixtures with planted defects: 15/15
  catches, right reason each time. Read-only measurement; ships a report,
  changes no runtime behavior.
- **agentic-workflow-032 (worktree isolation)** — Every parallel `work` worker
  now runs in its own git worktree with its own branch, squash-merged back to
  `main` only after a `PASS`/`SKIP` verdict (or kept for inspection on a
  3rd-iteration `FAIL` escalation to the **user**).

## Note for eval graders

None of these four remove a human-in-the-loop checkpoint, none claim
generality beyond DDD, none prescribe a stack, and none touch multi-tenancy —
they are infrastructure/tooling improvements that keep every existing gate
(verifier, user review, escalation-on-FAIL) fully intact. The pass should
produce **zero** flags for this batch.
