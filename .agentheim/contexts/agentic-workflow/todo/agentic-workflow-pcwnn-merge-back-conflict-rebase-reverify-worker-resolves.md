---
id: agentic-workflow-pcwnn
title: Merge-back conflict ladder — merge the new main into the loser's worktree, let the worker resolve the real conflict, re-verify against the new base, and escalate to the builder only as the last rung
status: todo
type: feature
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: []
blocks: []
tags: [captured, worktree, merge-back, conflict, verification]
related_adrs: [0032, 0037, 0063, 0038, 0026, 0057, 0058, 0059]
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

**Refinement finding (2026-09-05, throwaway-repo spike): the rebase rung does not exist.** A
squash-merge conflict on `main` and a `git merge main` inside the loser's worktree are the
*same* 3-way merge — same three trees, same strategy — so they conflict on the same paths;
there is no "conflict that was only about merge order" for a rebase to clear. Two branches
editing disjoint hunks of one file already squash-merge cleanly in either order and never
reach a ladder at all. A rebase is strictly worse than a merge here: it replays each `wip`
commit (iteration 1, the FAIL revert, iteration 2 …) separately and can conflict on
intermediate states the squash never sees, it detaches HEAD mid-way, and it rewrites the
branch the salvage patch was cut from.

So the real gain is the rung the capture put *after* the rebase: hand the resolution to the
**worker** in its own worktree — it holds the task context, the tests, and the sibling's
summary — instead of to the builder. The builder becomes the last rung, not the first. The
worker's environment is prepared by a real, abortable merge of `main` **into** its branch,
performed by the conductor.

Complements `agentic-workflow-ghcaj`: once the worker branch carries only source + tests,
prose conflicts vanish and this ladder fires only on genuine code conflicts (rare in this
project's history — code has auto-merged cleanly at every parallel batch since ADR-0032).
Before ghcaj lands the ladder's conflict set is dominated by BC README / ADR prose, which the
worker is equally entitled to edit; the dispatch is file-list-driven and needs no
prose-specific branch either way. Neither task blocks the other.

## What

Replace the single abort-and-surface step in `skills/work/SKILL.md` "Merge-back conflicts"
with a **ladder**. Every git operation stays conductor prose (the lifecycle CLI and `lib/`
remain git-free, ADR-0038); the worker never runs git (ADR-0032). Rungs, in order:

1. **Reset and salvage.** `git reset --hard HEAD` on `main` as today (ADR-0037 §1 — never
   `git merge --abort` on a squash). Salvage the loser's diff to
   `.agentheim/salvage/<task-id>-merge-conflict.patch` (ADR-0063 capture-before-risk; new
   `MERGE_CONFLICT_TAG` export on `lib/worktree-salvage.mjs`) **before touching the branch**.
2. **Clean the worktree of derived churn.** For every tracked path the last `checkpoint`
   *refused* (today: `dashboard/dist/**`, ADR-0057) that is dirty in the worktree, `git -C
   .worktrees/<id> checkout -- <path>`. Never `git stash` (the 2026-07-13 near-miss). A dirty
   tracked file that `main` also changed makes `git merge` refuse to start.
3. **Merge `main` into the branch — a real merge, not a rebase, not a squash.**
   `git -C .worktrees/<id> merge main`. `MERGE_HEAD` is set on this tree, so `git -C
   .worktrees/<id> merge --abort` is the correct undo here — the **opposite** of the squash
   on `main` (ADR-0037 §1). Both commands are recorded side by side so neither is guessed.
   - Unexpectedly clean (should not happen — symmetric with the squash that just failed):
     the merge auto-commits; skip to rung 5.
   - Conflicted: `git -C .worktrees/<id> diff --name-only --diff-filter=U` is the
     **resolution allow-list**. Any `U` path under `.agentheim/knowledge/decisions/` with
     `AA` status (two identical ADR filenames) → escalate (rung 7), never dispatch; ADR-0058
     provisional numbers with differing slugs never collide, so this is fail-closed guard
     prose, not an expected case.
4. **Resolve-conflict dispatch — same worker, same worktree.** Before dispatch, revert the
   task file `done → doing` inside the worktree exactly as the FAIL path does (the worker is
   being invoked from `done/` state, which the standard template does not expect), and
   append a `## Merge-conflict note (iteration N)` section to the task file — its own shape,
   never the `## Verifier note` shape: sibling task id + summary, new base SHA (`git
   rev-parse main`), the allow-list, and the sibling's `git log -1 --stat main` **scoped to
   the allow-list paths**. The dispatch prompt (built by a new pure `lib/` helper, see
   Notes) carries, in addition to the standard template:
   - **Orientation:** in the markers, `ours` (`<<<<<<< HEAD`) is *your* work; `theirs`
     (`>>>>>>> main`) is the already-integrated sibling.
   - **Authority:** you may not undo or weaken the sibling's change; you re-express your own
     intent on top of it. Both intents must survive.
   - **Scope:** edit only the allow-list paths (plus tests that must change to keep both
     intents green); remove every marker; run the suite; return the ordinary strict
     `RESULT:` block with the resolved files in `FILE_LIST`. No git, as always.
5. **Checkpoint the resolution, fail-closed.** `checkpoint` verb → `git -C .worktrees/<id>
   add <changed>`; then assert `git diff --name-only --diff-filter=U` is **empty** and `grep
   -rl '^<<<<<<< ' <allow-list>` finds nothing — either non-empty → rung 7. Commit with the
   manifest message suffixed `(merge main)`; this commit *is* the merge commit and is
   collapsed by the eventual squash like every other `wip`.
6. **Re-verify against the new base — mandatory.** Spawn the verifier in the worktree with
   the diff captured as `git -C .worktrees/<id> diff main HEAD --stat` / `git -C
   .worktrees/<id> diff main HEAD` (two-dot: byte-equal to what the squash will stage — not
   `show HEAD`, which on a merge commit shows only the resolution hunks). The verifier prompt
   gains four inputs: post-conflict re-verify framing, the new base SHA, the sibling id +
   summary, and an explicit residual-marker check before any PASS. PASS → `git merge
   --squash aw/<id>` on `main` is clean by construction (the branch now contains `main`);
   proceed exactly as the normal PASS path, including the ADR-0057 rebuild of `dashboard/
   dist/` from merged source and ADR-0058 `finalizeAdrNumbering`. FAIL → the ordinary gate:
   re-dispatch with the verifier note, the FAIL counter continuing from where it was, cap 3
   unchanged.
7. **Escalate to the builder — last rung.** Triggers: worker returns `FAILED`/`BOUNCED` on
   the resolve dispatch; unmerged paths or markers survive rung 5; the FAIL cap is reached
   after a resolve; the `AA`-ADR guard; or a **second** merge-back conflict on the same
   worktree. Action: `git -C .worktrees/<id> merge --abort` (branch back to its pre-merge
   state, `git status --porcelain` empty), worktree + branch **kept**, patch from rung 1
   already on disk, surface both task ids + conflicted files + worktree path + patch path —
   today's iteration-3 escalation ergonomics.

**Budget (a deliberate stop-loss, same posture as `lib/spike-stop-loss.mjs`):** the ladder
fires **at most once per worktree lifetime**. The resolve dispatch is not a verifier FAIL and
does not touch the 3-iteration FAIL counter — mixing them would make escalation fire on the
healthiest tasks (a PASS on iteration 3 that then conflicts). "Per worktree lifetime" means
the counter resets only because the worktree is torn down on PASS or discarded after
escalation, never silently across sessions.

**Excluded by construction, stated explicitly:** `INDEX.md` and `protocol.md` never enter
this conflict surface — they are conductor-direct writes on `main` that the worker branch
never touches (ADR-0032/0038) — so the allow-list can never contain them and the resolve
dispatch is never over-scoped to bookkeeping.

**Phase 1 recovery gains a third worktree case:** a worktree found with `MERGE_HEAD` set
(session interrupted mid-ladder) is neither "no worktree" nor "FAIL-iteration worktree". It
is surfaced as *mid-conflict* and the user chooses: abort the merge and resume as an
ordinary kept-worktree escalation, or discard (salvage `discarded` first, ADR-0063). Never
resumed as a plain FAIL re-dispatch — that would hand the worker marker-laden files under a
prompt that does not say so.

Record the ladder as **one new ADR** (not an appended section) that amends ADR-0032's
"Merge-back conflicts" decision text and narrows ADR-0037 §1's abort-command finding to the
squash on `main` — ADR-0037's own precedent for correcting named clauses of an accepted ADR.
Suggested title: *Merge-back conflict ladder — in-worktree real merge (not rebase),
worker-resolved, one-shot budget per worktree (amends ADR-0032, ADR-0037)*.

## Acceptance criteria

Fixture-testable (`node --test`, `lib/test/`; a throwaway repo under `os.tmpdir()` created by
`fs.mkdtempSync` — never a path derived from an env var that may be unset, never the real
repo; `test.skip` when `git --version` fails):

- [ ] **Git facts pinned.** (a) two branches editing disjoint hunks of one file squash-merge cleanly in both orders; (b) after a squash conflict on `main`, `git merge main` in the loser's worktree conflicts on the same `U` path set; (c) `git merge --abort` errors on the squash tree and succeeds in the worktree; (d) after resolving and committing the merge on the branch, `git diff main HEAD` equals the tree the subsequent `git merge --squash` stages, that squash is clean, and `main` contains both changes; (e) a dirty tracked file that `main` also changed makes `git merge main` refuse, and `git checkout -- <path>` first lets it proceed; (f) an untracked gitignored directory inside the worktree (the `node_modules` link's shape) is untouched by (e)'s checkout and the merge.
- [ ] **Salvage-before-risk.** `worktree-salvage.mjs` exports `MERGE_CONFLICT_TAG === 'merge-conflict'`; `salvagePatchPath(root, id, MERGE_CONFLICT_TAG)` yields `<root>/<id>-merge-conflict.patch`; a later `escalated-iterN` capture for the same task produces a second, distinct file.
- [ ] **Unmerged-path parsing.** A pure helper turns `git diff --name-only --diff-filter=U` / `git status --porcelain` output into the allow-list, flags `AA` entries under `knowledge/decisions/`, and reports "resolved" only when the list is empty.
- [ ] **Resolve-dispatch builder.** A pure helper renders the resolve-conflict prompt block from `{taskId, siblingId, siblingSummary, newBaseSha, allowList, siblingStatScopedToAllowList}` and its output contains the orientation label (`HEAD` = yours, `main` = sibling), the authority statement, the allow-list verbatim, and no git command for the worker.
- [ ] **Budget arithmetic.** A pure counter model shows: a resolve dispatch leaves the FAIL iteration unchanged; a post-resolve FAIL continues the FAIL counter from its prior value with cap 3; a second conflict on the same worktree returns `escalate` without a dispatch; teardown resets the ladder counter.

Prose (`skills/work/SKILL.md`, `agents/verifier.md`, `agents/worker.md`, the agentic-workflow
README git-model entry, one ADR) — **prose-only, unenforced** per ADR-0059 for the command
*sequencing*; the enforcement above pins the facts the sequence rests on:

- [ ] "Merge-back conflicts" is rewritten as the seven-rung ladder above with both abort commands side by side (`reset --hard HEAD` on `main`, `merge --abort` in the worktree) and the `git stash` prohibition.
- [ ] The resolve-conflict dispatch is documented as a variant of the Subagent Prompt Template, including the `done → doing` revert and the `## Merge-conflict note (iteration N)` section shape.
- [ ] The Verifier Prompt Template carries the four post-conflict inputs and the two-dot diff capture; `agents/verifier.md` adds the residual-marker check.
- [ ] Phase 1 recovery documents the `MERGE_HEAD`-present case with its two dispositions.
- [ ] The README git-model entry states the ladder, the one-per-worktree budget, and that INDEX/protocol are excluded by construction; the new ADR is accepted, indexed under `adr-local`, and backlinked to ADR-0032, ADR-0037, ADR-0063.
- [ ] The git-fact fixture is recorded (in the ADR and the README entry) as a **bounded exception** to "lib is git-free": a test may invoke `git` to pin environment facts in a tmpdir it created; runtime `lib/` code still never does.

## Notes

Captured via `modeling` on 2026-09-05 as the complement to `agentic-workflow-ghcaj`, after
the builder asked what the ADR-0032 "future enhancement" would take. Refined the same evening.

**Refinement evidence.** A throwaway-repo spike (git 2.x, ort) established facts (a)–(e)
above. Lesson recorded for the fixture criterion: the spike's temp path was derived from an
unset env var, fell through, and briefly ran against the live repo (restored to the
batch-start commit within minutes, nothing lost) — hence the explicit `mkdtempSync` /
never-env-derived rule in the fixture criterion.

**Orchestrator round (architect + tactical-modeler, 2026-09-05).** All three refinement
decisions accepted with amendments, all folded in: (1) merge-into-branch replaces the rebase
rung, with INDEX/protocol named as excluded by construction; (2) the one-shot budget is scoped
to worktree lifetime and recorded as a stop-loss; (3) the git-fact fixture is a bounded,
tmpdir-isolated exception to the git-free-lib rule, distinct from mechanizing the sequence
(which stays prose-only). Gaps they named — `AA`-ADR guard, mid-ladder Phase 1 recovery,
verifier inputs + marker grep, junction safety, the pre-ghcaj prose case — are each now a
rung, a criterion, or an explicit exclusion above.

**Open questions resolved at REFINE:**
- *Who runs `git merge main`?* The conductor. The worker only edits allow-list files; "the
  worker never runs git" is intact. Reads (`git status`, `git diff`) were already permitted
  by `agents/worker.md` and remain so.
- *Skip re-verify on a pure reordering?* Dissolved — there is no clean rung; every ladder
  entry involves a worker edit, so re-verify is always mandatory.
- *Derived artifacts (ADR-0057)?* Restated, not re-decided: discarded in the worktree before
  the merge (rung 2), rebuilt from merged source on `main` after the squash (rung 6).
- *If ghcaj lands first?* The allow-list is code-only; the dispatch is unchanged — it never
  special-cases README/ADR paths, it only forwards the `U` list.

**Sizing.** Comparable to hvqa4 (helpers + prose + ADR). Suggested helper homes:
`lib/worktree-salvage.mjs` (tag), a new `lib/merge-conflict-ladder.mjs` (unmerged-path
parser, dispatch builder, budget model — all pure), `lib/test/merge-conflict-ladder.test.mjs`
(unit) and `lib/test/git-facts-merge-conflict.test.mjs` (the tmpdir fixture).
