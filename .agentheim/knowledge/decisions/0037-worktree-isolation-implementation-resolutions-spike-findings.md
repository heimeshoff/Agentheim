---
id: ADR-0037
title: Worktree-isolation implementation resolutions — de-risking spike findings and BOUNCE integration
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-f6m2q]
related_adrs: [0032, 0026, 0007]
---

# ADR-0037: Worktree-isolation implementation resolutions — de-risking spike findings and BOUNCE integration

## Context

**ADR-0032** ratified per-worker git worktree isolation but left two things unresolved for
the implementing task (agentic-workflow-f6m2q) to settle: (1) its own acceptance criteria
required a **blocking de-risking spike** on a throwaway fixture before any doctrine was
written, to confirm three load-bearing assumptions; and (2) ADR-0032's Decision walks
PASS / FAIL / SKIP explicitly but never addresses the `RESULT: BOUNCED` transition under
the new per-worktree model. Both are recorded here rather than silently resolved in
`skills/work/SKILL.md` prose, because both are "why this, not the obvious alternative"
calls a future maintainer would ask about.

## Decision

### 1. Spike finding — squash-merge conflicts are real, but the abort command is `git reset --hard HEAD`, not `git merge --abort`

Confirmed on a throwaway fixture: two branches editing the same line of a BC-README-style
file, squash-merged in sequence, produce a real conflict on the second merge — non-zero
exit, `CONFLICT (content)`, conflict markers in the file, `git status --porcelain` showing
`UU`. This validates ADR-0032's core conflict-detection premise.

**Correction to ADR-0032's Decision text** ("abort the merge... (`git merge --abort` /
reset the index)"): the spike showed `git merge --abort` **errors** — `fatal: There is no
merge to abort` — because `git merge --squash` never sets `MERGE_HEAD` (only a real,
non-squash merge does). The command that actually restores `main`'s index and working tree
to their pre-merge state is **`git reset --hard HEAD`**. `skills/work/SKILL.md`'s
"Merge-back conflicts" section is written with this corrected command, not the ambiguous
either/or ADR-0032 hedged with.

### 2. Spike finding — junction removal before `git worktree remove` is MANDATORY, not housekeeping

Confirmed on a throwaway fixture: `git worktree remove --force` on a worktree containing an
**un-removed** Windows directory junction at `dashboard/node_modules` does **not** fail with
`EBUSY` (the risk ADR-0032 named) — it succeeds with exit `0`, but it **recurses through the
junction and deletes the real target directory's contents** (the target directory shell
survives; every file inside it does not). This is a strictly worse failure mode than the
anticipated `EBUSY`: silent, unlogged destruction of the ONE shared `dashboard/node_modules`
every worktree links to.

When the junction **is** removed first (via `fs.unlinkSync` on the link path — confirmed to
report `isSymbolicLink(): true` for a Windows junction, so a plain unlink is sufficient and
never recurses), `git worktree remove --force` succeeds cleanly and the real target directory
and its contents are fully intact afterward.

**This upgrades ADR-0032's "remove the junction before `git worktree remove`" from a
housekeeping nicety to a hard, non-negotiable precondition on every worktree-removal
codepath** — PASS/SKIP teardown, BOUNCE teardown, and orphan discard at session-end
reconciliation alike. `lib/worktree-node-modules.mjs`'s `unlinkDashboardNodeModules` adds a
second line of defense: it refuses to touch anything at the link path that is not itself a
symlink/junction (`lstatSync(...).isSymbolicLink()`), so a real, non-linked `node_modules`
directory (e.g. from a mistaken call against the main tree) is never at risk from this helper
even if the ordering discipline above is ever violated by a caller.

The same fixture confirmed the two other spike requirements cleanly, with no design
correction needed: a Windows directory junction (`fs.symlinkSync(target, link, 'junction')`)
survived a **real** `esbuild` build (bundling actual `react`/`react-dom`/`htm`/
`canvas-confetti` pulled through the junction from this project's own
`dashboard/node_modules`, producing a correct minified bundle), and a path nested well past
Windows `MAX_PATH` (358 characters) committed cleanly under `git config core.longpaths true`.

### 3. BOUNCE integration under worktree isolation

ADR-0032 is silent on `RESULT: BOUNCED`. The chosen resolution: **squash-merge the bounce
back to `main` immediately, with no verifier, folding in the `INDEX.md` `doing → backlog`
edit and the "Task bounced" protocol entry into one small commit** —
`chore(<bc>): task bounced — <title> [<task-id>]` — then tear down the worktree exactly as
on PASS/SKIP.

Rejected alternative — **never merge the bounce, just discard the worktree**: this mirrors
the pre-ADR-0032 doctrine's literal words ("do not commit"), but under the shared-tree model
that "uncommitted" bounce was still **visible** in the one working tree (`git status` showed
it, and the session-end stranded-carry-over reconciliation would eventually surface it for a
deliberate disposition). Under worktree isolation, discarding the worktree entirely would make
the bounce **invisible** the moment the worktree is torn down — strictly worse than the
behavior it would replace, not merely different. A worker's bounce is a real, useful signal
(a task was under-refined) that the user should see reflected in `INDEX.md`/`protocol.md` like
any other outcome; withholding it serves no one. No verifier is needed because a bounce
produces no code (a file move + a `## Worker note`), so the small immediate squash-merge
carries no risk a verifier would meaningfully gate.

## Consequences

**Positive**

- The two hedged/ambiguous corners of ADR-0032 (abort command; BOUNCE transition) are now
  concretely resolved and mirrored verbatim in `skills/work/SKILL.md`, so the doctrine has no
  silent gap for a future implementer to guess at.
- The junction-removal ordering is now understood as safety-critical (real data-loss risk),
  not merely tidy — `lib/worktree-node-modules.mjs`'s refusal-to-touch-a-real-directory guard
  is a second line of defense on top of the ordering discipline in `skills/work/SKILL.md`.
- Every ADR-0032 spike requirement is empirically confirmed on a throwaway fixture, never
  against this repository's own tracked git state.

**Negative**

- One more narrow, Windows-specific failure mode is now load-bearing knowledge every
  maintainer of the worktree-removal codepath must carry (junction-before-remove, always).

**Neutral**

- Does not reopen or contradict any clause of ADR-0032's Decision — it resolves exactly the
  two things that Decision left open (an ambiguous abort command; an unaddressed BOUNCE path)
  and corrects one internal hedge with an empirically-confirmed single command.

## Alternatives considered

- **Silently correct ADR-0032 in place rather than recording a new ADR.** Rejected: ADR-0032
  is `accepted` and its Decision text is the ratified record; a future maintainer diffing
  `skills/work/SKILL.md` against ADR-0032 should find the discrepancy explained, not silently
  diverged from.
- **BOUNCE: route through the verifier anyway, for uniformity.** Rejected — a bounce produces
  no code; spawning a verifier to audit "the worker moved a file and wrote a note" is pure
  overhead with nothing to gate.

Builds on **ADR-0032** (the ratified worktree-isolation model this resolves two open corners
of), preserves **ADR-0026** (one task = one commit; BOUNCE's small commit is that one commit)
and **ADR-0007** (the conductor, not a redefined mover, performs the BOUNCE move + bookkeeping).

## Amended by ADR-0072 (2026-09-06)

§1's abort-command finding ("the command that actually restores `main`'s index and working
tree ... is `git reset --hard HEAD`") is narrowed to the **squash-merge on `main`**
specifically — that finding was never wrong for the case it examined, it simply had no
second, real-merge case to distinguish from yet. ADR-0072's merge-back conflict ladder adds
that second case: rung 3's real, non-squash `git merge main` **inside the loser's worktree**
does set `MERGE_HEAD`, so `git merge --abort` is the correct undo *there* — the opposite
command in the opposite tree. Both facts now coexist explicitly rather than the second
silently overriding the first.
