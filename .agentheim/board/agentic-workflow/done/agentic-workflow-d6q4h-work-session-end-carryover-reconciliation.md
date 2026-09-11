---
id: agentic-workflow-d6q4h
title: Work session-end reconciliation of stranded working-tree carry-over
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
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

- [x] `work` session end detects stranded working-tree files (tracked-modified and untracked) not part of the batch's own commits.
- [x] Each stranded file gets an explicit disposition: committed deliberately or left with a named reason — surfaced to the user, never auto-swept.
- [x] The session-end protocol entry records the disposition instead of the current "carry-over untouched" boilerplate.
- [x] The scoped-add rule itself is unchanged — reconciliation never becomes a blanket `git add -A`.

## Notes

Concurrency caution: a *live* concurrent session's in-flight files look identical
to stranded ones. The disposition step must ask, not assume — committing another
session's half-written markdown is the exact failure ADR-0026 exists to prevent.

## Outcome

Refined existing committing doctrine (ADR-0026) — no new ADR needed. Added a
session-end **carry-over reconciliation** step to `skills/work/SKILL.md`, wired into
End-of-run reporting as new step 5 (after the last per-task commit, before the
session-end protocol entry), with a dedicated "Reconciling stranded working-tree
carry-over (session-end)" section spelling out the procedure:

- **Detect** — `git status --porcelain`; each line is a stranded entry, tracked-modified
  (` M`/`M `/`A `/`D `/…) or untracked (`??`). Empty output → `Carry-over: none — working
  tree clean`.
- **Surface per file, never auto-sweep** — each stranded file gets one of two explicit
  dispositions presented to the user: (A) commit deliberately via an own scoped, labeled
  `chore(<bc>): reconcile stranded …` commit (enumerated `git add <path>`), or (B) leave
  behind with a **named owner + reason**.
- **Concurrency caution** — the step asks the user per file and never infers; a live
  concurrent session's in-flight files are byte-indistinguishable from orphans, so the safe
  default when uncertain is (B) leave-behind.
- **Scoped-add rule unchanged** — reconciliation stays an enumerated `git add <path>`,
  never `git add -A` / `git add .`.
- **Protocol entry records the disposition** — added a `**Carry-over:**` line to the "Work
  session ended" entry format that records per-file dispositions, explicitly replacing the
  old "untouched, as in prior sessions" boilerplate (the confirmed leak at protocol.md:182
  and :228).

Also updated the BC README's **Commit doctrine** term to name the session-end reconciliation
behavior. Prose/doctrine change only — no code, no test infrastructure — so TDD does not apply.

Key files: `skills/work/SKILL.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
