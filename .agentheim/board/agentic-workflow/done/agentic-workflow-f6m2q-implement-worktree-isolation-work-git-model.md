---
id: agentic-workflow-f6m2q
title: Implement per-worker worktree isolation in work's git model
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: [agentic-workflow-k9t3w]
blocks: []
tags: [harness-audit, work-skill, concurrency, git, verifier, worktree]
related_adrs: ["0032", "0026", "0007", "0017", "0028", "0037"]
related_research: []
prior_art: []
---

## Why

Conflict prevention today is textual guesswork: `work` Phase 3 scans task prose
for file paths and demotes higher-id tasks that *appear* to overlap
(work/SKILL.md:29-36). That both over-throttles (demoting tasks that would never
collide) and can miss a real overlap the prose never named. And every parallel
worker shares one working tree, so a verifier that reads only its own task's diff
still runs the test suite against a tree holding all siblings' uncommitted changes.

This is a **structural/scaling bet, not a bug fix** — and the archaeology says so
plainly. `git log --grep 'Verification failed'` over the consumer project's
history: **0 of 5** historical verification failures were cross-task contamination
(all five were genuine own-work defects), and only **~14% of batches (16/98)** ever
ran more than one worker in parallel, with `MAX_PARALLEL=3` already capping the
blast radius. Contamination has never been observed to bite. What this buys,
prospectively, is (1) making conflict prevention **structural** — git detects real
merge conflicts against the actual repository at integration time instead of
predicting them from English at dispatch time — and (2) letting **`MAX_PARALLEL`
rise safely**, because the throttle that caps it (the shared-tree race) is removed.

## What

Implement the git model ratified in **ADR-0032**. Give each worker a private git
worktree on branch `aw/<task-id>`, branched from a per-batch **claim commit**
(which moves the batch `todo → doing` so the worktree base already holds the task
in `doing/`). The worker runs unchanged inside its worktree — writes code, runs
tests against its own isolated tree, updates its BC README, writes ADRs, moves its
task file `doing → done`, and still runs no git. The verifier runs the suite **in
that worktree**, so it sees only this task's changes plus committed base. On PASS
the orchestrator `git merge --squash`es the branch onto `main`, folds in its own
INDEX/protocol/backlink bookkeeping, and makes **one commit per task** exactly as
ADR-0026 prescribes; on FAIL nothing merges, so `main` is pristine by construction
and the worktree holds the iteration state for re-dispatch. Git 3-way merge becomes
the conflict detector; the Phase 3 pre-scan is demoted to a non-throttling advisory
so batch width can grow.

The change surface is `skills/work/SKILL.md` (Phases 3/4, Verification gate, Git
authority, End-of-run reconciliation, Verifier + Subagent prompt templates), a
`.gitignore` entry, a node_modules-junction OS helper, and the worktree lifecycle
+ orphan reconciliation.

## Acceptance criteria

- [ ] **De-risking spike first (blocking gate on the rest):** confirm on a throwaway fixture that `git merge --squash` conflict-reports correctly on a same-line BC-README edit; that the Windows directory junction + `git config core.longpaths true` combo survives a real `dashboard/` esbuild build; and that `git worktree remove --force` cleans a junctioned `node_modules` with no `EBUSY`. If any assumption fails, surface it and adjust the design before implementing.
- [ ] Each parallel worker runs in its own git worktree at `<repo-root>/.worktrees/<task-id>/` on a private branch `aw/<task-id>`; `main` never holds an un-verified worker change (verifiable: during a batch, `git -C <main> status --porcelain` shows no worker code between commits).
- [ ] `/.worktrees/` is added to `.gitignore`; no worktree path lives under `.agentheim/`.
- [ ] A **batch-start claim commit** (`chore(<bc>): batch start [<id>]…`) moves all batch tasks `todo → doing`, applies the INDEX `todo → doing` edits and the `Batch started` protocol entry, with an enumerated `git add` (never `git add -A`); worktrees are created from that commit's HEAD.
- [ ] The verifier's test run executes **from the worktree root** and its captured diff is `git -C <worktree> show HEAD`-scoped — a sibling worker's changes are provably absent from what the verifier sees (verifiable by a two-worker fixture where sibling B's broken change does not fail A's verification).
- [ ] On PASS, integration is `git merge --squash aw/<task-id>` → orchestrator bookkeeping (INDEX doing→done, ADR index insert, ADR↔task backlinks, `Task verified and completed` protocol entry) → **one** `git commit -m "<type>(<bc>): <summary> [<task-id>]"`. Exactly one commit per task reaches `main`; the working tree is clean afterward.
- [ ] On FAIL iterations 1–2, `main` is untouched (no rollback needed); the `doing → done` revert and `## Verifier note (iteration N)` append happen inside the worktree; re-dispatch reuses the **same** worktree.
- [ ] On FAIL iteration 3, the worktree + branch are **kept** and surfaced at end-of-run; the task remains in `doing/` on `main`.
- [ ] A **real** merge-back conflict aborts the squash-merge (leaving `main` clean, never conflicted), preserves the losing task's worktree, and surfaces the conflicting files + both task ids + worktree path to the user — no merge is ever auto-guessed.
- [ ] Worktrees are removed on PASS/SKIP (`git worktree remove --force` + `git branch -D`), and session-end reconciliation (extending agentic-workflow-d6q4h) walks `git worktree list --porcelain` and gives each non-main worktree an explicit user-surfaced disposition on the `**Carry-over:**` line (discard orphan / keep with named owner). Phase 1 recovery also consults `git worktree list`.
- [ ] Tasks touching `dashboard/` get a lazily-created `node_modules` junction/symlink to the main tree's `node_modules` (no per-worktree `npm install`); `git config core.longpaths true` is set as harness setup. The OS-divergent branch lives in one helper (mirroring `dashboard/launch.mjs`, ADR-0002).
- [ ] The Phase 3 pre-scan no longer hard-demotes tasks; it is demoted to an advisory annotation used for merge-ordering only.
- [ ] Worker rules in the Subagent Prompt Template are **unchanged** (still no git; still moves its own task file doing→done); only the orchestrator's git-authority, verifier-targeting, and reconciliation sections change.

## Notes

Full mechanics — the exact dispatch/integration choreography, the merge-back
abort-and-surface handling, the FAIL quarantine, worktree location/naming/cleanup,
and the Windows & node_modules strategy — are recorded in **ADR-0032** (read it as
pre-loaded context; do not re-derive). Design resolutions to the eight original
p4v9t design questions, condensed:

- **Location/naming:** `<repo-root>/.worktrees/<task-id>/`, gitignored, outside `.agentheim/`; branch `aw/<task-id>`; the ADR-0028 task id is the unique key, reused across FAIL re-dispatch iterations.
- **Verifier targeting:** verifier prompt gains a `## Worktree` absolute-path field; runs the pre-resolved test command from the worktree root; diff capture is `git -C <worktree> show HEAD`. Verifier stays read-only.
- **Bookkeeping across trees:** worker `.agentheim/` writes arrive via squash-merge; orchestrator INDEX/protocol/backlink writes happen on `main` after staging the merge, before the single commit.
- **Merge-back conflicts:** abort-and-surface-to-user; `main` never left conflicted. Auto-rebase-and-reverify is a named future enhancement, not baseline.
- **FAIL quarantine:** same worktree reused iterations 2–3; `main` needs no rollback; iteration-3 escalation keeps the worktree for inspection.
- **Windows/node_modules:** no per-worktree install; lazy junction to main's `node_modules` for `dashboard/`-touching tasks only; `core.longpaths` set.
- **Cleanup:** removed on PASS/SKIP; kept on iteration-3 escalation; reconciled at session end by *extending* d6q4h's mechanism with a worktree category.
- **Pre-scan:** demoted to advisory (loses hard-demote power, kept for merge-ordering foresight).

Depends on **agentic-workflow-k9t3w** (ratify ADR-0032) — do not start until the
decision is `accepted`. This changes the orchestrator's core git model across many
`work/SKILL.md` sections; treat it as a large, carefully-verified task, not a quick
edit.

## Outcome

The de-risking spike ran first, on throwaway git fixtures under the scratchpad (never this
repo's tracked state), and confirmed all three ADR-0032 assumptions plus surfaced two
implementation-critical corrections (recorded in **ADR-0037**):

- `git merge --squash` **does** conflict-report a same-line BC-README-style edit (exit 1,
  `CONFLICT (content)`, `UU` status) — but the correct abort command is `git reset --hard HEAD`,
  **not** `git merge --abort` (which errors — squash merges never set `MERGE_HEAD`).
- A Windows directory junction (`fs.symlinkSync(target, link, 'junction')`) survived a **real**
  esbuild build pulling actual `react`/`react-dom`/`htm`/`canvas-confetti` through it from this
  project's own `dashboard/node_modules`, and a 358-character nested path committed cleanly
  under `git config core.longpaths true`.
- `git worktree remove --force` on a junctioned `node_modules` produced **no `EBUSY`** as
  anticipated, but a worse, previously-unconfirmed failure mode when the junction is left in
  place: it silently deletes the real target directory's **contents** (data loss, not an error).
  Removing the junction first (confirmed safe via a plain `fs.unlinkSync`, since a Windows
  junction reports `isSymbolicLink(): true`) avoids this entirely.

`skills/work/SKILL.md` was rewritten across Phase 1 (recovery now also consults
`git worktree list --porcelain`), Phase 3 (the textual pre-scan demoted from a hard-demote
throttle to a merge-ordering advisory), Phase 4 (the batch-start claim commit + per-task
worktree creation + lazy `dashboard/node_modules` linking + `core.longpaths` setup), the
Verification gate (worktree-scoped diff capture, the ephemeral orchestrator `wip` commit, a new
BOUNCE-integration subsection), the Verifier Prompt Template (a `## Worktree` field), the Git
authority section (squash-merge + fold-in-bookkeeping + one commit, merge-back conflict
abort-and-surface, Windows & node_modules doctrine), the Index-updates table, Protocol logging,
the Subagent Prompt Template (a `Workspace` field; the `## Rules — CRITICAL` list itself is
byte-unchanged), and the session-end reconciliation section (extended agentic-workflow-d6q4h's
mechanism with a `git worktree list --porcelain`-driven worktree category).

`lib/worktree-node-modules.mjs` is the one OS-divergent helper (mirroring `dashboard/launch.mjs`,
ADR-0002) for the lazy `dashboard/node_modules` link: `taskTouchesDashboard`,
`linkDashboardNodeModules`, `unlinkDashboardNodeModules` — the latter refuses to touch anything
at the link path that isn't itself a symlink/junction, a second line of defense on top of the
SKILL.md ordering discipline. `.gitignore` gained `/.worktrees/`.

ADR-0037 records the BOUNCE-integration resolution (ADR-0032 didn't address it: squash-merge
immediately, no verifier, one small commit) and the two spike-driven corrections above.

Key files: `skills/work/SKILL.md`, `lib/worktree-node-modules.mjs`,
`lib/test/worktree-node-modules.test.mjs`, `.gitignore`,
`.agentheim/knowledge/decisions/0037-worktree-isolation-implementation-resolutions-spike-findings.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
