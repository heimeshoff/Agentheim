---
id: ADR-0032
title: Per-worker git worktree isolation — batch-start claim commit, private worker branch, squash-merge to main
scope: agentic-workflow
status: proposed
date: 2026-07-02
related_tasks: [agentic-workflow-k9t3w, agentic-workflow-f6m2q]
related_adrs: [0007, 0017, 0026, 0028]
---

# ADR-0032: Per-worker git worktree isolation — batch-start claim commit, private worker branch, squash-merge to main

> `related_tasks`: `agentic-workflow-k9t3w` (ratify this ADR) blocks
> `agentic-workflow-f6m2q` (implement the model). These are the split of the
> original parent task `agentic-workflow-p4v9t` (retired on split).

## Context

Today every parallel worker in a `work` batch operates on the **one shared working tree**.
The orchestrator dispatches up to `MAX_PARALLEL = 3` workers, each writes uncommitted
changes into that single tree, and the verifier gate captures each worker's diff *as text*
(`git diff` working-tree-vs-HEAD, scoped by `FILE_LIST`) before the orchestrator commits it.
Two structural weaknesses follow from the shared tree:

1. **Conflict prevention is textual guesswork.** `work` Phase 3 scans each ready task's
   prose (`What`/`Acceptance criteria`/`Notes`) for file paths and demotes the higher-id
   task to the next batch when two tasks *appear* to touch the same file or the same BC
   README. This predicts conflicts from English, not from the repository — it both
   over-throttles (demoting tasks that would never have collided) and can miss a real
   overlap the prose never named.
2. **The verifier's test run is not isolated from siblings.** The verifier reads *only its
   own task's diff* as text, but when it runs the suite it runs against a tree that also
   holds every sibling worker's uncommitted changes. A sibling's broken change can fail an
   innocent task's verification, or mask a real one.

**The empirical check ran, and it did not support the contamination motivation.**
Archaeology over the consumer project's history (`git log --grep 'Verification failed'`):
**0 of 5** historical verification failures were cross-task contamination — all five were
genuine own-work defects — and only **~14% of batches (16/98)** ever ran more than one
worker in parallel, with `MAX_PARALLEL = 3` already capping the blast radius. So weakness
(2) is a real *structural* possibility that has **never actually been observed to bite**.

This decision is therefore recorded honestly as a **forward-looking structural bet, not a
bug fix**. Its value is twofold and prospective:

- **Make conflict prevention structural.** Let git detect real merge conflicts at
  integration time (against the actual repository state) instead of predicting them from
  task prose at dispatch time. This is a categorically more trustworthy guard than the
  Phase 3 pre-scan.
- **Let `MAX_PARALLEL` rise safely.** Once isolation and structural conflict detection are
  in place, the textual pre-scan's throttling (which exists only because the shared tree is
  unsafe) can be relaxed, so batch width can grow without re-introducing the shared-tree
  race.

This sits directly in the committing-doctrine lineage: **ADR-0026** (bookkeeping folds into
the task commit; one task = one commit; scoped `git add`, never `git add -A`), **ADR-0007**
(the mover owns only the move; INDEX/protocol side-effects stay with the skills/orchestrator),
and **ADR-0017** (skills own the task lifecycle *and* its bookkeeping). The design below is
constrained to preserve every one of those invariants.

## Decision

**Dispatch each worker into its own git worktree on a private branch. The worker's file
work (code, its BC README, its ADRs, its own `doing → done` task-file move) is isolated in
that worktree; the orchestrator integrates it back onto `main` with a `git merge --squash`
that yields exactly one commit per task with all bookkeeping folded in — so ADR-0026's
one-commit-per-task, bookkeeping-in-the-task-commit, and scoped-add rules all survive intact,
and git — not a prose scan — becomes the conflict detector.**

The load-bearing invariant that ADR-0026 protects — *two concurrent git writes to the shared
`main` branch must never race* — is **strengthened**, not weakened: `main` is written **only**
by the orchestrator, **only** sequentially, exactly as before. Each worker's isolated branch
lives in its own worktree and cannot race anything.

### The dispatch/integration choreography

1. **Batch-start claim commit (new).** The orchestrator moves every selected task
   `todo → doing` (file move + `status:` rewrite), applies the `todo → doing` `INDEX.md`
   edits, prepends the `Batch started` `protocol.md` entry, `git add`s that enumerated set,
   and **commits it** — `chore(<bc>): batch start [<id-1>] [<id-2>] …`. This is the one
   deliberate amendment to ADR-0026: the `todo → doing` half of the lifecycle move now rides
   in a per-*batch* claim commit instead of folding into each task's final commit. It is
   necessary because `git worktree add` checks out a **committed** state — the worktree base
   must already hold the task in `doing/` so the branch does only the `doing → done` half and
   the squash-merge stays a clean fast-forward-shaped delta with no rename/rename conflict.
   The main tree keeps showing `doing/` live (dashboard + Phase 1 recovery unaffected).

2. **Worktree creation.** For each task:
   `git worktree add -b aw/<task-id> .worktrees/<task-id> HEAD` (HEAD = the batch-start
   commit). The worktree holds the task in `doing/`, matching the worker prompt. If the task
   touches `dashboard/`, lazily link dependencies (see *Windows & node_modules* below).

3. **Worker runs in the worktree — unchanged behaviour.** The worker's cwd and task path are
   inside the worktree. It writes code, runs tests **against its own isolated tree**, updates
   its BC README, writes ADRs, and moves its task file `doing → done` — **exactly the rules it
   follows today, and it still runs no git command.** Worker rules are unchanged.

4. **Orchestrator wip-commit in the worktree.** On `RESULT: SUCCESS`, the orchestrator (the
   git owner) stages the worker's enumerated output in the worktree and commits it on the
   private branch: `git -C .worktrees/<task-id> add <FILE_LIST + moved task file + BC README +
   ADRs>` then `git -C .worktrees/<task-id> commit -m "wip [<task-id>] iter N"`. This commit is
   ephemeral — the squash in step 6 collapses it, so it never reaches `main` history. Keeping
   the commit with the orchestrator (not the worker) means the *worker never does git* rule is
   untouched.

5. **Verifier runs in the worktree.** The orchestrator captures the diff from the worktree
   (`git -C .worktrees/<task-id> show HEAD` / `diff`) and pastes it in, **and** passes the
   worktree's absolute path so the verifier runs the pre-resolved test command **from the
   worktree root**. The verifier sees only committed base + this task's changes, and stays
   read-only (no Write/Edit/git-write — running the suite in a worktree is read-only w.r.t.
   git).

6. **PASS → squash-merge to `main` + fold in bookkeeping (one commit).** In sequence, on the
   main tree:
   - `git -C <main> merge --squash aw/<task-id>` — stages the branch's net delta (code +
     `doing → done` move + BC README + ADRs). **Real conflicts are detected here** against any
     sibling already merged this batch (see *Merge-back conflicts*).
   - The orchestrator writes its own main-tree bookkeeping (the ADR-0007/0026 boundary is
     intact — this stays with the orchestrator, never the mover, never the worker): BC
     `INDEX.md` `doing → done` edit, ADR index insert (global `knowledge/index.md` or the BC
     `INDEX.md` per `scope:`), ADR↔task backlinks, and the `Task verified and completed`
     `protocol.md` entry.
   - `git -C <main> add <enumerated bookkeeping paths>` then `git -C <main> commit -m
     "<type>(<bc>): <summary> [<task-id>]"`. **One commit = squashed worker delta +
     bookkeeping**, precisely ADR-0026's shape. `git merge --squash` stages *only* the branch
     delta and the orchestrator adds *only* its enumerated bookkeeping, so `git add -A` is
     never used and a concurrent `modeling` session's in-flight markdown is never swept in.
   - Cleanup: `git worktree remove .worktrees/<task-id> --force` + `git branch -D aw/<task-id>`.

### FAIL quarantine — `main` stays pristine

On `VERDICT: FAIL` (iterations 1–2), **nothing merges to `main`** — the quarantine is now
structural: `main` never held the un-verified change, so there is nothing to roll back on the
main tree. The worktree + branch stay live; the `doing → done` revert and the
`## Verifier note (iteration N)` append both happen **inside the worktree**; the re-dispatched
worker runs in the **same** worktree (its iteration context stays live there) and the
orchestrator makes an additional wip commit per iteration on the same branch — all collapsed by
the eventual squash. On iteration 3 (escalation): do not merge, do not re-dispatch, **keep the
worktree and branch for user inspection**, task stays in `doing/` on `main` (it was never
merged to `done/`), and the worktree is surfaced at end-of-run.

### Merge-back conflicts — the hard case, resolved by git not prose

Two same-BC workers both editing the BC README (today prevented by the Phase 3 pre-scan) now
collide at **merge-back** instead of being predicted from prose. On a clean or auto-mergeable
3-way squash-merge, proceed. On a **real** conflict (git leaves conflict markers, non-zero
exit): **abort the merge to keep `main` pristine** (`git merge --abort` / reset the index —
main integrity is sacrosanct), preserve the losing task's verified work in its intact worktree
+ branch, and **surface the conflict to the user immediately** — naming the conflicting files,
both tasks, and the worktree path — for a manual resolve or re-run. `main` is never left in a
conflicted state and no merge is ever auto-guessed. (An automatic `git rebase` of the losing
branch onto the new `main` + re-verify is a viable future enhancement, deliberately **not** in
the baseline; the baseline asks the user, matching the escalation ergonomics of a
FAIL-iteration-3.)

### Pre-scan demoted to advisory

The Phase 3 textual pre-scan is **demoted, not retired**. Its power to hard-demote a task to
the next batch on predicted file overlap is **removed** — that throttle exists only because the
shared tree is unsafe, and removing it is what lets `MAX_PARALLEL` rise. What remains is an
**advisory annotation**: the orchestrator still flags same-BC-README / same-file contention so
it can order those tasks' sequential merges and not be surprised by a merge-back conflict. Git
3-way merge is the real guard (BC README edits are typically append-to-marker or additive prose
that 3-way-merges cleanly); the advisory only preserves foresight for the rare same-line
collision. Retiring the scan entirely was rejected: with `MAX_PARALLEL` rising, keeping a
cheap heads-up for the one file every same-BC batch contends (the README) costs nothing and
smooths merge ordering.

### Worktree location, naming, cleanup

- **Location:** `<repo-root>/.worktrees/<task-id>/`, with `/.worktrees/` gitignored. Outside
  `.agentheim/` (which holds only real project artifacts, never harness scratch) and outside
  the tracked tree. Task ids are collision-resistant (ADR-0028) and one worker owns a task at a
  time, so `<task-id>` is a unique, stable path — deliberately **reused** across FAIL
  re-dispatch iterations so iteration context persists.
- **Cleanup:** removed on PASS/SKIP; kept on FAIL-iteration-3 escalation; **reconciled at
  session end** by extending the existing stranded-carry-over reconciliation (task
  `agentic-workflow-d6q4h`) with a new *worktree* category — `git worktree list --porcelain`
  is walked alongside `git status --porcelain`, and each non-main worktree gets an explicit,
  user-surfaced disposition (discard a dead orphan, or keep with a named owner) recorded on the
  session-end `**Carry-over:**` line. Phase 1 recovery also consults `git worktree list`: an
  orphaned `aw/*` worktree is an interrupted-session signal alongside a stranded `doing/` task.

### Windows & node_modules

- **Long paths:** worktrees nest `.agentheim/` and `dashboard/` trees; set
  `git config core.longpaths true` (and rely on Windows LongPathsEnabled) as harness setup. If
  MAX_PATH still bites, fall back to the bare ADR-0028 token as the worktree dir name.
- **No per-worktree `npm install`.** `dashboard/node_modules/` is gitignored and build-time
  only (ADR-0003), so a fresh worktree lacks it. Per-worktree install is expensive and courts
  Windows `EBUSY`/antivirus lock contention. Instead, **only when a task touches `dashboard/`**,
  lazily link `<worktree>/dashboard/node_modules` → `<main>/dashboard/node_modules` (Windows
  directory **junction** `mklink /J` — no admin needed, unlike a symlink; POSIX `ln -s`). Sharing
  one physical `node_modules` across concurrent worktree builds is safe because it is **read-only
  during a build** — esbuild reads deps and writes each worktree's own tracked `dashboard/dist/`,
  so there is no concurrent writer to the shared dir. The OS branch lives in one helper, mirroring
  how `dashboard/launch.mjs` centralizes OS-divergent spawn logic (ADR-0002). Remove the junction
  before `git worktree remove` (junction removal never touches the real `node_modules`).

## Consequences

**Positive**

- Conflict detection becomes **structural**: git evaluates real repository state at merge-back
  instead of a prose scan predicting overlap at dispatch. Both false throttles and missed
  overlaps go away.
- The verifier's test run is **isolated** — it runs against only its task's changes plus
  committed base, never a tree polluted by sibling workers.
- `MAX_PARALLEL` can rise safely: the throttle that capped it was the shared-tree race, now
  removed.
- **FAIL leaves `main` pristine by construction** — no rollback of the main tree, because the
  change never touched it.
- **ADR-0026 is preserved where it counts:** one commit per task, all bookkeeping folded in,
  scoped enumerated adds, `main` written only by the orchestrator sequentially.

**Negative**

- **One extra commit per batch** (the batch-start claim commit) — the single, deliberate
  amendment to ADR-0026's "the `todo → doing` move folds into the task's final commit."
- New moving parts on Windows: worktree lifecycle, `core.longpaths`, node_modules junctions,
  and worktree cleanup/orphan reconciliation — each a real failure surface to test.
- A same-line BC-README merge-back conflict now surfaces to the **user** (an interruption)
  rather than being silently pre-empted by the pre-scan's demotion; the demoted advisory
  softens but does not eliminate this.
- The orchestrator does more git work per task (wip-commit-in-worktree, squash-merge, worktree
  teardown), a modest orchestration-cost increase for the isolation guarantee.

**Neutral**

- **Worker rules are unchanged** — it still writes files and runs tests in a tree and never
  runs git; only *which* tree changed. ADR-0007's mover boundary is intact (lifecycle
  bookkeeping still the orchestrator's, on the main tree, post-merge).
- The motivation is a forward-looking structural/scaling bet; the contamination it also
  removes was never observed to bite (0/5 historical failures, ~14% of batches parallel).
- `scope: agentic-workflow` (matching ADR-0026/0007, its doctrine lineage) — in this
  single-BC repo that is semantically equivalent to `global`.

## Alternatives considered

- **Keep the shared tree + textual pre-scan (status quo).** Rejected as the thing being
  replaced: prose-predicted conflicts both over-throttle and miss real overlaps, and the
  verifier's suite is never isolated. Cheap, but structurally weaker.
- **Worker commits on its own branch.** Would also enable squash-merge, but it changes the
  load-bearing *worker-never-does-git* rule for no benefit — the orchestrator can make the
  ephemeral wip-commit in the worktree itself, keeping all git with its sole owner. Rejected.
- **`git diff | git apply --3way` instead of `git merge --squash`.** Avoids the wip-commit but
  gives patch-level, weaker 3-way reconciliation and no branch to hold FAIL-iteration state.
  Rejected — the branch + real merge is the cleaner quarantine and the stronger conflict
  detector.
- **No batch-start commit; do `todo → doing` inside each worktree.** Produces a rename/rename
  conflict at squash-merge (main renamed `todo → doing`, branch renamed `todo → done` from a
  shared `todo/` base), and loses live `doing/` visibility + Phase 1 recovery on `main`.
  Rejected — the batch-start commit is load-bearing.
- **Per-worktree `npm install`.** Expensive and Windows-lock-prone; `node_modules` is
  read-only during a build, so a shared junction is strictly cheaper and safe. Rejected.
- **Worktrees under `.agentheim/`.** Pollutes the managed artifact tree with harness scratch
  state. Rejected — `.worktrees/` at repo root, gitignored, mirrors the `.agentheim/.dashboard/`
  gitignored-runtime precedent (ADR-0002) without living inside `.agentheim/`.
- **Retire the pre-scan entirely.** Rejected: with `MAX_PARALLEL` rising, a zero-cost advisory
  heads-up for the one file every same-BC batch contends (the README) is worth keeping for merge
  ordering, even though git is the real guard.

Amends **ADR-0026** (the `todo → doing` claim now rides in a batch-start commit; every other
clause preserved), keeps **ADR-0007**'s mover boundary intact, builds on **ADR-0017** (skills
own lifecycle + bookkeeping), and uses **ADR-0028**'s collision-resistant ids for worktree
naming.
