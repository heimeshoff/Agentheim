---
id: agentic-workflow-pcwnn
title: Merge-back conflict ladder — rebase the loser onto new main, re-verify, and let the worker resolve a real conflict before escalating to the builder
status: backlog
type: feature
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: []
blocks: []
tags: [captured, worktree, merge-back, conflict, verification]
related_adrs: [0032, 0037, 0063, 0038, 0026]
related_research: []
prior_art: [agentic-workflow-f6m2q, agentic-workflow-k9t3w, agentic-workflow-hvqa4, agentic-workflow-p8q3z]
---

## Why

ADR-0032's merge-back rule is **abort and surface**: on a real squash-merge conflict the
conductor resets `main`, keeps the losing worktree, and hands the resolution to the builder.
ADR-0032 itself names "an automatic `git rebase` of the losing branch onto the new `main` +
re-verify" as a viable future enhancement deliberately left out of the baseline. Every
conflict so far (2026-07-03 w7q2m, 2026-07-13 tkq7v/spv0k) ended with a human — the builder
or the conductor acting for an absent builder — doing the merge by hand.

An honest framing, so the task is not oversold: a rebase does **not** resolve textual
conflicts. The squash-merge is already a 3-way merge against the merge base; replaying the
branch onto the new `main` collides on the same lines. The rebase only clears a conflict that
was about *merge order*. The real gain is the step *after* a rebase conflict: hand the
resolution to the **worker** in its own worktree — it holds the task context, the tests, and
the sibling's summary — instead of to the builder. The builder becomes the last rung, not the
first.

Complements `agentic-workflow-ghcaj`: once the worker branch carries only source + tests, prose
conflicts vanish and this ladder fires only on genuine code conflicts (rare in this project's
history). Its value is highest in the window before ghcaj lands, and it stays the permanent
fallback afterwards. Neither task blocks the other.

## What

Replace the single abort-and-surface step in `skills/work/SKILL.md` "Merge-back conflicts"
with a **ladder**, all git operations staying conductor prose (the lifecycle CLI remains
git-free, ADR-0038):

1. **Reset and salvage.** `git reset --hard HEAD` on `main` as today (ADR-0037 — never `git
   merge --abort`); salvage the loser's diff to `.agentheim/salvage/<task-id>-rebase.patch`
   before touching the branch (ADR-0063 capture-before-risk).
2. **Rebase the loser onto the new `main`** inside its worktree (`git -C .worktrees/<id>
   rebase main`).
3. **Rebase clean** → wip checkpoint on the branch, **re-run the verifier in the worktree
   against the new base** (mandatory — a textually clean merge can still be a semantic
   conflict), then squash-merge on PASS exactly as the normal path. This re-verification does
   **not** consume one of the three FAIL iterations; a FAIL here does.
4. **Rebase conflicted** → `git rebase --abort`, then **re-dispatch the worker into the same
   worktree** with a *resolve-conflict* dispatch: the conflicting file list, the sibling task's
   id + summary + its integrated diff, and the instruction to merge `main` into its branch,
   resolve, and re-run tests. The worker still runs no git commands beyond what the resolve
   requires — decide in REFINE whether the conductor performs the `git merge main` and the
   worker only edits the conflicted files (preferred: keeps "the worker never does git"
   intact). This dispatch **counts as one of the three iterations**. Then checkpoint → verify
   → squash-merge.
5. **Escalate to the builder** only when step 4 fails verification or the worker reports it
   cannot resolve — same ergonomics as today's iteration-3 escalation: worktree kept, patch
   salvaged, both task ids + conflicting files + worktree path surfaced.

Record the ladder as an ADR amending ADR-0032's "Merge-back conflicts" and ADR-0037 §1.

## Acceptance criteria

- [ ] Fixture test (`node --test`, throwaway repo like ADR-0037's spike): two branches from one base, disjoint hunks in the same file, merged out of the advisory order → the ladder resolves it at step 3 with zero human input and the final `main` contains both changes.
- [ ] Fixture test: two branches editing the same line → step 4 fires; a simulated worker resolution in the worktree leads to a clean squash-merge; the iteration counter advanced by exactly one.
- [ ] Fixture test: a step-4 resolution that fails verification escalates with the worktree intact and a salvage patch on disk (ADR-0063 shape).
- [ ] Every rung is reachable only after a salvage patch exists for the loser; no rung can lose verified work.
- [ ] `main` is never left mid-rebase or mid-merge: any failure at any rung leaves `main` at the pre-merge commit and the worktree branch at a clean state (`git status --porcelain` empty in both).
- [ ] The verifier prompt for a post-rebase re-verify names the new base commit and the sibling task, so its verdict addresses the integration, not only the original diff.
- [ ] `skills/work/SKILL.md` "Merge-back conflicts", the worker dispatch reference (resolve-conflict variant), and the agentic-workflow README git-model entry are updated; an ADR amends ADR-0032 and ADR-0037.

## Notes

Captured via `modeling` on 2026-09-05 as the complement to `agentic-workflow-ghcaj`, after
the builder asked what the ADR-0032 "future enhancement" would take.

REFINE questions:
- Who runs `git merge main` in step 4 — conductor (preferred) or worker? Bears on ADR-0032's
  "worker never runs git" rule and on the worker prompt.
- Should step 3's re-verify be skippable when the rebase touched no file the sibling
  touched (pure reordering)? Default no — cheap insurance against semantic conflicts.
- Interaction with derived artifacts (ADR-0057): after a rebase the conductor must still
  rebuild `dashboard/dist/` from merged source, never merge it — restate, do not re-decide.
- If `agentic-workflow-ghcaj` lands first, step 4's conflict set is code-only; confirm the
  resolve-conflict dispatch needs no README/ADR handling in that world.
