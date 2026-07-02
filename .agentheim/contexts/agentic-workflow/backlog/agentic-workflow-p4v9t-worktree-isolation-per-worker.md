---
id: agentic-workflow-p4v9t
title: Worktree isolation per worker — merge on PASS, quarantine on FAIL
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, work-skill, concurrency, git, verifier, worktree]
related_adrs: ["0026"]
related_research: []
prior_art: []
---

## Why

Parallel workers share one working tree. Conflict detection before dispatch is
textual guesswork (scanning task text for file paths — `work/SKILL.md:33`), and
the deeper problem: when N workers' uncommitted changes coexist, each verifier
"sees only its own task's diff" as *text*, but when it **runs the test suite**
it runs against a tree containing all siblings' changes. A sibling's broken
change can fail an innocent task's verification — or mask a real failure. A
FAILed task's changes stay on the tree while siblings commit around them.
MAX_PARALLEL=3 limits the blast radius but doesn't remove it. (Harness audit
2026-07-02, top-ranked gap.)

## What

Dispatch each worker into its own git worktree. On `VERDICT: PASS`, merge +
commit to the main tree; on FAIL, the worktree holds the iteration state without
contaminating siblings. Conflict *prevention* becomes structural (merge
conflicts are detected by git, not predicted from prose), verifier test runs are
uncontaminated, and MAX_PARALLEL can rise safely.

## Acceptance criteria

- [ ] Each parallel worker operates in an isolated git worktree; the main tree never holds un-verified worker changes.
- [ ] Verifier test runs see only the task-under-audit's changes plus committed state.
- [ ] PASS merges cleanly or surfaces a real merge conflict to the orchestrating session; FAIL leaves the main tree untouched.
- [ ] Worktrees are cleaned up on task completion and on session end (no orphan accumulation).
- [ ] The textual conflict pre-scan is retired or demoted to an advisory hint.

## Notes

Design questions for refinement: worktree location (inside `.agentheim/` is
wrong — gitignored temp dir?), how the verifier is pointed at the worktree, how
`.agentheim/` bookkeeping writes (task file moves) interact with per-worker
trees, Windows path/lock behavior, and interaction with the carry-over
reconciliation task (agentic-workflow-d6q4h).

Cheap validation before committing to the build (audit's uncertainty section):
the contamination claim is a structural inference, not an observed incident.
Ten minutes of `git log --grep 'Verification failed'` archaeology on a consumer
project would measure how often verifier contamination / cross-task
interference actually bites — run it during refinement to inform this task's
priority (and MAX_PARALLEL sizing) with data instead of inference.
