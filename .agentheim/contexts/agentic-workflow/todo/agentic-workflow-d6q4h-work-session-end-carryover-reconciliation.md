---
id: agentic-workflow-d6q4h
title: Work session-end reconciliation of stranded working-tree carry-over
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, work-skill, git, committing-doctrine, carry-over]
related_adrs: ["0026"]
related_research: []
prior_art: [agentic-workflow-063]
---

## Why

The scoped-`git add` rule (load-bearing for concurrency, ADR-0026) means anything
a skill didn't explicitly enumerate is left uncommitted — forever. This is a
confirmed live leak, not a hypothesis: `protocol.md:47` and `protocol.md:93`
record the *same two files* ("Working-tree carry-over (untouched, as in prior
sessions)") orphaned across multiple sessions, each session dutifully stepping
around them. The safety mechanism systematically produces dirty state that
accumulates silently. (Harness audit 2026-07-02, ⊕ finding from the Opus
cross-check.)

## What

Add a session-end step to `work/SKILL.md` (after the last commit, before the
session-end protocol entry): run `git status --porcelain`, list any stranded
`.agentheim/` / repo files not touched by this batch, and **surface them to the
user with a disposition choice** — commit them deliberately (own scoped commit,
clearly labeled), or record an explicit leave-behind note naming the owner. Never
silently repeat "untouched, as in prior sessions."

## Acceptance criteria

- [ ] `work` session end detects stranded working-tree files (tracked-modified and untracked) not part of the batch's own commits.
- [ ] Each stranded file gets an explicit disposition: committed deliberately or left with a named reason — surfaced to the user, never auto-swept.
- [ ] The session-end protocol entry records the disposition instead of the current "carry-over untouched" boilerplate.
- [ ] The scoped-add rule itself is unchanged — reconciliation never becomes a blanket `git add -A`.

## Notes

Concurrency caution: a *live* concurrent session's in-flight files look identical
to stranded ones. The disposition step must ask, not assume — committing another
session's half-written markdown is the exact failure ADR-0026 exists to prevent.
