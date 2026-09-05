---
id: ADR-0063
title: Worktree-abandonment diff salvage — capture-before-remove, storage convention, escalation visibility
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-hvqa4]
related_adrs: [0032, 0037, 0038, 0027, 0059]
---

# ADR-0063: Worktree-abandonment diff salvage — capture-before-remove, storage convention, escalation visibility

## Context

Dorc's July-2026 agent-time review (recommendation A1, second half) surfaced a confirmed
incident: a task escalated at FAIL-iteration-3 had already found and confirmed a working fix
inside its worktree, then the worktree (and the `aw/<task-id>` branch it lived on) was
eventually removed with nothing salvaged — the real fix was deleted, and the builder had to
re-derive work the system had already done.

ADR-0032 defines three points where a worker's git worktree is abandoned rather than
squash-merged to `main`, each of which today (before this ADR) removes the worktree with no
capture step:

1. **FAIL-iteration-3 escalation** — the worktree is *kept* at the moment of escalation, but
   nothing forces it to stay kept forever; a later session's Phase 1 recovery or session-end
   reconciliation can (correctly, per ADR-0032's own doctrine) offer to discard it once it no
   longer matches "escalated this session."
2. **BOUNCE** (`RESULT: BOUNCED`) — ADR-0037 resolved this to an immediate squash-merge +
   teardown; teardown removes the worktree unconditionally.
3. **Orphaned-worktree "discard" disposition** — the session-end "Worktree carry-over"
   reconciliation (and Phase 1 recovery's same-posture check) can end with the user choosing
   to discard an orphan, which runs `git worktree remove --force` + `git branch -D`.

All three are legitimate, intentional abandonments — none of this ADR argues against
abandoning a worktree. The gap is narrower and structural: **nothing captures the worktree's
diff before the removal that makes it unrecoverable.**

## Decision

**Every abandonment path salvages the worktree's diff to a patch file before the worktree is
removed.** Capture is unconditional at each of the three points above — it is cheap, and
`git diff` against the fork point is a no-op-shaped write (an empty patch) when there is
nothing to save.

### Capture command (conductor-only prose — see "Mechanize-or-drop declaration" below)

```
git -C .worktrees/<task-id> merge-base HEAD main
git -C .worktrees/<task-id> diff <fork-point-from-above> > .agentheim/salvage/<task-id>-<tag>.patch
```

`git diff <fork-point>` (no `--cached`, no second ref) reports the union of anything already
committed on the branch (the conductor's ephemeral `wip` commits) **and** anything still
sitting uncommitted in the worktree's working directory — one command covers both, so the
capture is correct regardless of whether a `wip` checkpoint happened to run first for that
particular abandonment path.

### Storage convention

- **Location:** `.agentheim/salvage/`, git-ignored. It sits inside `.agentheim/` (unlike
  `.worktrees/`, which is deliberately kept outside it — ADR-0032) because a salvage patch is
  a rescue artifact *about* a specific task, not generic harness scratch; but it is not
  versioned project knowledge either, so it joins `.agentheim/state/`'s **advisory,
  machine-written, gitignored** category (ADR-0027 family) rather than the tracked
  `contexts/*/` tree.
- **Naming:** `<task-id>-<tag>.patch`, where `tag` names *which* abandonment path produced the
  capture: `escalated-iterN` (FAIL-iteration-3, `N` = the escalating iteration, normally 3),
  `bounced` (BOUNCE), or `discarded` (an orphan's discard disposition). One file per
  abandonment **event**, not per task — a task escalated once and later discarded at a
  subsequent session's reconciliation gets **two** distinct files
  (`<task-id>-escalated-iter3.patch` and `<task-id>-discarded.patch`), never an overwrite of
  the earlier record.
- **Lifecycle:** `work` never deletes a salvage patch on its own initiative. It is scratch the
  user/builder consults, applies (`git apply <patch>` against a scratch checkout), or discards
  by hand — the same posture `.agentheim/state/` already takes toward its own gitignored
  advisory writes. A stale patch for a task that later shipped through some other route is
  harmless clutter, not a correctness risk.
- **Empty-diff guard:** if the capture produces an empty patch (the worktree never diverged
  from its fork point — e.g. a BOUNCE that fired before any file was touched), skip writing
  the file and skip referencing one. There is nothing to salvage, and a zero-byte patch would
  be a confusing "salvaged" claim about a task that never actually changed anything.

### Visibility, not just storage

A salvage patch that sits unreferenced on disk repeats exactly the original failure in a new
shape — a real artifact nobody looks at until it is too late. So every capture also:

- Appends a `## Salvage note` to the task file, naming the patch's absolute path.
- Is named explicitly in the message that reaches the user/builder for that abandonment: the
  FAIL-iteration-3 escalation summary in `work`'s end-of-run reporting, and the worktree
  carry-over disposition line for a discard (`<path>: discarded (orphan, salvaged:
  <patch-path>)`). BOUNCE still captures defensively (a worker occasionally edits files before
  realizing a task is under-refined and reverting), but its own "Task bounced" protocol entry
  does not need to grow a new field — the patch existing and being named in the salvage note
  is sufficient, since a bounce is expected to usually be empty-diff and skip capture per the
  guard above.

### Mechanize-or-drop declaration (ADR-0059)

This ADR establishes two conventions of different mechanizability:

1. **The naming/storage-path convention** (`<task-id>-<tag>.patch` under
   `.agentheim/salvage/`) — **mechanized**: `lib/worktree-salvage.mjs` (`salvagePatchPath`,
   `ensureSalvageDir`, `escalationTag`, `BOUNCE_TAG`, `DISCARD_TAG`,
   `formatSalvageReference`), covered by `lib/test/worktree-salvage.test.mjs`. A conductor (or
   a future deterministic script) computing a salvage path any other way is trivially
   wrong-shaped and would fail these tests if routed through the helper.
2. **"Salvage before every worktree removal" itself** (the behavioral ordering rule in
   `skills/work/SKILL.md`) — **prose-only, unenforced**. This is a sequencing discipline over
   *which git commands the conductor runs and in what order*, the same category as the
   pre-existing `unlinkDashboardNodeModules`-before-`git worktree remove` rule (ADR-0037) that
   also has no lint. A lint could only check the *artifacts* of correct sequencing after the
   fact (a patch file exists for every task whose worktree is gone) — that check has real
   false-negative risk (a discard immediately after an already-covered escalation may
   legitimately be an empty-diff skip) and no cheap true-positive signal to catch a
   *skipped* capture at the moment it matters, before the branch is unrecoverably gone.
   Building a plausible-looking but unreliable lint here would be worse than none — judged not
   worth it, per ADR-0059's stated escape hatch.

### The git-free-lib boundary (ADR-0038)

`lib/worktree-salvage.mjs` never shells out to git — it only computes the storage path from
pure inputs (task id, tag) and creates the directory via `fs.mkdirSync`. The `git diff`
capture itself is conductor-executed prose in `skills/work/SKILL.md`, exactly where every
other worktree git command already lives (the `wip` checkpoint, the squash-merge, `git
worktree remove`). This mirrors `lib/worktree-node-modules.mjs`'s existing shape: OS-divergent
or git-adjacent mechanics get one git-free helper; the git invocation stays with its sole
owner, the conductor.

## Consequences

**Positive**
- The confirmed incident (verified fixes deleted with the branch) cannot recur silently: every
  removal point now has a capture step immediately before it.
- The storage convention is deterministic and testable even though the triggering behavior is
  prose, so at least the *shape* of a salvage artifact is guaranteed correct whenever the
  conductor does remember to call it.
- Reuses the existing `.agentheim/state/`-style gitignored-advisory precedent (ADR-0027)
  rather than inventing a new artifact category.

**Negative**
- One more conductor-prose step at three separate call sites in `skills/work/SKILL.md` — a
  real (if small) chance a future edit to any one of the three forgets to preserve the salvage
  step, since it is not mechanically enforced (see the mechanize-or-drop declaration above).
- `.agentheim/salvage/` can accumulate unbounded stale patches over a long project lifetime
  with no automatic pruning — accepted as a cheap, low-risk cost (small text files, gitignored,
  never touch `main`) against the alternative of building pruning logic nobody asked for yet.

**Neutral**
- Does not change squash-merge, checkpoint, or teardown behavior for PASS/SKIP — those paths
  never abandon a worktree with un-merged content, so they are out of this ADR's scope by
  construction.

## Alternatives considered

- **Store the patch beside the task file (`contexts/<bc>/doing/<id>.patch`).** Rejected: task
  files are tracked, portable project knowledge; a salvage patch is scratch, and committing it
  would put an unreviewed diff into `main` history the moment any *other* bookkeeping for that
  BC gets committed (INDEX/README edits are scoped-added, but an untracked sibling file sitting
  in a tracked directory invites an accidental `git add` of the whole directory).
- **Commit the patch as part of the BOUNCE/escalation protocol entry.** Rejected — same reason:
  a salvage patch is not reviewed content, and folding it into a task's real commit would want
  a `git add` that isn't scoped to what that commit is actually about.
- **Only salvage at FAIL-iteration-3 escalation, since that's the incident that motivated this.**
  Rejected: BOUNCE and orphan-discard remove worktrees just as unconditionally, and the task's
  own Why note explicitly names "a bounce" and "a skip[-with-changes]" alongside escalation as
  abandonment paths — narrowing to one path would leave the other two exposed to the identical
  failure mode.
- **Mechanize the "capture before remove" ordering with a pre-remove git hook or wrapper
  script.** Rejected for this task's scope: `git worktree remove` is invoked directly by the
  conductor's own prose-driven git commands, not through any project-owned wrapper today: 
  adding one here would be a larger, separate refactor of how the conductor issues git commands
  generally, out of scope for closing this specific gap.

## Amended by ADR-0072 (2026-09-06)

The abandonment-path family this ADR names (FAIL-iteration-3 escalation, BOUNCE, orphan
discard) gains a fourth member: a **real merge-back conflict**, resolved by the merge-back
conflict ladder. Rung 1 salvages the loser's diff **before** `main` is reset and before the
branch is touched by the ladder's in-worktree `git merge main`, using a new
`MERGE_CONFLICT_TAG` (`'merge-conflict'`) alongside this ADR's existing `BOUNCE_TAG` /
`DISCARD_TAG` / `escalationTag` family in `lib/worktree-salvage.mjs` — same storage
convention, same empty-diff skip, same visibility requirement. See ADR-0072.
