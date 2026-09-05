---
id: ADR-0072
title: Merge-back conflict ladder — in-worktree real merge (not rebase), worker-resolved, one-shot budget per worktree (amends ADR-0032, ADR-0037)
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-pcwnn]
related_adrs: [0032, 0037, 0063, 0038, 0026, 0057, 0058, 0059]
---

# ADR-0072: Merge-back conflict ladder — in-worktree real merge (not rebase), worker-resolved, one-shot budget per worktree

## Context

ADR-0032's merge-back rule is **abort and surface**: on a real squash-merge conflict the
conductor resets `main` (`git reset --hard HEAD`, per ADR-0037's correction — never
`git merge --abort`, which errors on a squash), keeps the losing worktree, and hands the
resolution to a human — the builder, or the conductor acting for an absent builder. ADR-0032
itself names "an automatic `git rebase` of the losing branch onto the new `main` + re-verify"
as a viable future enhancement, deliberately left out of the baseline. Every real conflict
recorded in `protocol.md` so far (2026-07-03, 2026-07-13 ×2) ended with a human doing the
merge by hand.

**Refinement finding (2026-09-05, throwaway-repo spike): the rebase rung ADR-0032 sketched
does not exist.** A squash-merge conflict on `main` and a `git merge main` inside the loser's
worktree are the *same* 3-way merge — same three trees (merge-base, `main`'s tip, the
branch's tip), same strategy — so they conflict on exactly the same paths; there is no
"conflict that was only about merge order" for a rebase to clear. Two branches editing
disjoint hunks of one file already squash-merge cleanly in either order and never reach a
ladder at all (fact (a) below). A rebase would in fact be strictly worse here: it replays
each ephemeral `wip` commit (iteration 1, the FAIL revert, iteration 2, …) separately and can
conflict on intermediate states the squash never sees, it detaches HEAD mid-way, and it
rewrites the very branch ADR-0063's salvage patch is cut from.

So the real gain is the rung the original sketch put *after* the (nonexistent) rebase: hand
the resolution to the **worker**, in its own worktree, instead of to the builder — it already
holds the task context, the tests, and (now) the sibling's summary. The builder becomes the
**last** rung, not the first. The worker's environment is prepared by a real, abortable merge
of `main` **into** its branch, performed by the conductor — the worker still never runs git
(ADR-0032 unchanged).

### Spike findings (throwaway repo, `os.tmpdir()`, never this project's own repo)

A de-risking spike pinned six facts before any doctrine below was written, later reproduced as
the `node --test` fixture named in "Mechanize-or-drop" below:

- **(a)** Two branches editing disjoint hunks of one file squash-merge cleanly in **both**
  orders.
- **(b)** After a squash-merge conflict on `main`, `git merge main` inside the loser's worktree
  conflicts on the **same** `U` path set the squash did — confirming (a)+(b) that a rebase
  would gain nothing a real merge doesn't already give.
- **(c)** `git merge --abort` **errors** on the squash tree (`fatal: There is no merge to
  abort` — `git merge --squash` never sets `MERGE_HEAD`, ADR-0037's finding) but **succeeds**
  in the worktree, where the real `git merge main` did set `MERGE_HEAD`. The two undo commands
  are opposites of each other depending on which tree you're standing in.
- **(d)** After resolving the conflict and committing the merge on the branch, the two-dot
  diff `git diff main HEAD` (captured in the worktree) is **byte-equal** to what
  `git merge --squash <branch>` subsequently stages on `main` — that squash is then clean by
  construction, and `main` ends up holding both intents.
- **(e)** A dirty tracked file that `main` also changed makes `git merge main` refuse to start
  (`error: Your local changes ... would be overwritten by merge`) — `git checkout -- <path>`
  first (discarding the dirty copy) lets the merge proceed.
- **(f)** An untracked, gitignored directory inside the worktree (the shape of the
  `dashboard/node_modules` junction, ADR-0032) is untouched by both (e)'s checkout and the
  subsequent merge.

## Decision

**Replace ADR-0032's single "abort and surface" merge-back step with a seven-rung ladder.**
Every git operation stays conductor prose — the worker never runs git (ADR-0032 unchanged);
`lib/` stays git-free except for the one bounded test exception below (ADR-0038). Full rung
detail, exact commands, and the Verifier/Subagent prompt-template variants live in
`skills/work/SKILL.md`'s "Merge-back conflicts" section — this ADR records the *why* and the
structural commitments; it does not duplicate the choreography verbatim.

1. **Reset and salvage.** `git reset --hard HEAD` on `main` (fact (c) — never
   `git merge --abort` on a squash). Salvage the loser's diff to
   `.agentheim/salvage/<task-id>-merge-conflict.patch` **before touching the branch**
   (ADR-0063 capture-before-risk) via a new `MERGE_CONFLICT_TAG` export on
   `lib/worktree-salvage.mjs`.
2. **Clean the worktree of derived churn.** For every tracked path the checkpoint guard
   refuses (today: `dashboard/dist/**`, ADR-0057) that is dirty in the worktree,
   `git checkout -- <path>` — never `git stash` (a 2026-07-13 near-miss). Fact (e): a dirty
   tracked file `main` also changed blocks the merge from even starting.
3. **Merge `main` into the branch — a real merge, not a rebase, not a squash.**
   `git -C .worktrees/<id> merge main`. Fact (c): `git -C .worktrees/<id> merge --abort` is
   the correct undo **here** — the opposite of the squash's abort on `main`. Conflicted:
   `git diff --name-only --diff-filter=U` is the resolution allow-list. A `U` path under
   `.agentheim/knowledge/decisions/` with `AA` status (two identical provisional ADR
   filenames) escalates (rung 7) rather than dispatches — ADR-0058's numbers with differing
   slugs never actually collide, so this is fail-closed guard prose, not an expected case.
4. **Resolve-conflict dispatch — same worker, same worktree.** The task file is reverted
   `done → doing` (mirroring the FAIL path) and gains a `## Merge-conflict note (iteration N)`
   section (sibling id/summary, new base SHA, allow-list, sibling's scoped `--stat`). The
   dispatch prompt states the **orientation** (`HEAD` = the worker's own work, `main` = the
   already-integrated sibling), the **authority** (the worker may not undo or weaken the
   sibling's change — both intents must survive), and the **scope** (allow-list paths only,
   plus tests; remove every marker; no git, as always).
5. **Checkpoint the resolution, fail-closed.** Stage, then assert `--diff-filter=U` is empty
   and no residual `<<<<<<<` marker survives in any allow-list path — either failing sends
   this to rung 7. The commit is suffixed `(merge main)` and is collapsed by the eventual
   squash like every other `wip` commit.
6. **Re-verify against the new base — mandatory.** The verifier's diff is the two-dot
   `git diff main HEAD` (fact (d): byte-equal to what the squash will stage). The verifier
   prompt gains four inputs (post-conflict framing, new base SHA, sibling id+summary, an
   explicit residual-marker check before any PASS). PASS → the subsequent
   `git merge --squash aw/<id>` is clean by construction; proceed exactly as the ordinary
   PASS path. FAIL → the ordinary FAIL gate, continuing the existing iteration counter — see
   "Budget" below.
7. **Escalate to the builder — last rung, not the first.** Triggers: a `FAILED`/`BOUNCED`
   resolve-dispatch return; unmerged paths or markers surviving rung 5; the FAIL cap reached
   after a resolve; the `AA`-ADR guard; or a **second** merge-back conflict on the same
   worktree. `git -C .worktrees/<id> merge --abort` restores the branch to its pre-merge
   state; worktree + branch are **kept**, the rung-1 patch is already on disk, both task ids +
   conflicted files + worktree path + patch path are surfaced — today's iteration-3
   escalation ergonomics, reused rather than reinvented.

### Budget — a deliberate stop-loss, one shot per worktree lifetime

The ladder fires **at most once per worktree lifetime**, mirroring the posture of
`lib/spike-stop-loss.mjs`. A resolve dispatch (rung 4) is **structurally separate** from the
ordinary 3-iteration FAIL counter — dispatching it never touches that counter, and a
post-resolve FAIL continues the FAIL count from whatever it already was, with the same cap-3
rule as any other FAIL. Mixing the two counters would fire escalation on the *healthiest*
tasks (a clean PASS on iteration 3 that then hits a merge conflict). "Per worktree lifetime"
means the one-shot flag resets only because the worktree is torn down (PASS integration, or
discard after escalation) — never silently across sessions on the same worktree. Mechanized
in `lib/merge-conflict-ladder.mjs`'s `createLadderState` / `onMergeBackConflict` /
`decideAfterVerifierVerdict` / `onWorktreeTeardown`.

### Excluded by construction

`INDEX.md` and `protocol.md` never enter this conflict surface — they are conductor-direct
writes on `main` the worker branch never touches (ADR-0032/ADR-0038) — so the allow-list can
never contain them and the resolve dispatch is never over-scoped to bookkeeping.

### Phase 1 recovery gains a third worktree case

A worktree found with `MERGE_HEAD` set (a session interrupted mid-ladder) is neither "no
worktree" nor "FAIL-iteration worktree" — it is surfaced as **mid-conflict**, and the user
chooses: abort the merge and resume as an ordinary kept-worktree escalation, or discard
(salvaging first, ADR-0063). It is never silently resumed as a plain FAIL re-dispatch, which
would hand a worker marker-laden files under a prompt that never says so.

## Mechanize-or-drop declaration (ADR-0059)

This decision establishes conventions of two different mechanizability, stated explicitly
rather than defaulted into:

1. **Mechanized: the git facts, and the three pure computations that are functions of already-
   captured text/state.** The six spike findings above are pinned as a `node --test`
   fixture (`lib/test/git-facts-merge-conflict.test.mjs`) so a future git-version upgrade or
   platform change that silently changes any of them is caught, not rediscovered by incident.
   `lib/merge-conflict-ladder.mjs` mechanizes: unmerged-path parsing into the allow-list plus
   the `AA`-under-`knowledge/decisions/` guard (`parsePorcelainStatus` /
   `conflictStateFromPorcelain` / `findAdrNumberGuardHits` / `isResolved`), the resolve-dispatch
   prompt renderer (`buildResolveDispatchPrompt`), and the one-shot budget arithmetic
   (`createLadderState` / `onMergeBackConflict` / `decideAfterVerifierVerdict` /
   `onWorktreeTeardown`) — all pure, all git-free, all `node --test`-covered.
   `lib/worktree-salvage.mjs` gains `MERGE_CONFLICT_TAG` alongside its existing `BOUNCE_TAG` /
   `DISCARD_TAG` / `escalationTag`.
2. **Prose-only, unenforced: the seven-rung *sequencing* itself.** Which git command the
   conductor runs, in what order, across which of the two trees (`main` vs. the worktree) —
   `skills/work/SKILL.md`'s "Merge-back conflicts" section — is conductor-executed prose, the
   same category ADR-0063's own "salvage before every removal" ordering already occupies. A
   lint could only check after-the-fact artifacts (a patch exists, an allow-list is non-empty)
   with real false-negative risk and no way to catch a *skipped* rung at the moment it
   matters, before the branch state has moved on. Building a plausible-looking but unreliable
   lint here would be worse than none, per ADR-0059's own escape hatch.

### The bounded git-in-tests exception (ADR-0038)

`lib/test/git-facts-merge-conflict.test.mjs` is a **deliberate, narrow exception** to "`lib/`
is git-free": a test file, not runtime `lib/` code, is permitted to shell out to real `git`
**only** inside a throwaway repository it creates itself via
`fs.mkdtempSync(path.join(os.tmpdir(), ...))` — never a path derived from an environment
variable that might be unset (a refinement-time spike's temp path was, fell through, and
briefly ran destructive git commands against this project's own repository before being
caught and restored within minutes — nothing lost, but the near-miss is the reason for this
explicit rule) and never this project's own repository under any circumstance. The test
`test.skip`s its whole file when `git --version` fails, so a `git`-less CI environment
degrades gracefully rather than failing. Runtime code — `merge-conflict-ladder.mjs`,
`worktree-salvage.mjs` — remains fully git-free; only the fixture that pins environment facts
about git's own behavior gets this exception, and only inside its own disposable sandbox.

## Amendments to prior ADRs

- **Amends ADR-0032's "Merge-back conflicts" decision text.** The named future enhancement
  ("an automatic `git rebase` of the losing branch onto the new `main` + re-verify") is
  retired — spike fact (b) shows no rebase-specific conflict class exists to clear, so a
  rebase would only add cost (replaying ephemeral `wip` commits separately, detaching HEAD,
  rewriting the salvage source branch) for no gain over a real merge. The ladder above is the
  concrete mechanism ADR-0032 left as "a viable future enhancement, deliberately not in the
  baseline" — it is now the baseline.
- **Narrows ADR-0037 §1's abort-command finding** ("the command that actually restores
  `main`'s index and working tree ... is `git reset --hard HEAD`") to the **squash on `main`**
  specifically. Rung 3's real, non-squash `git -C .worktrees/<id> merge main` **does** set
  `MERGE_HEAD` (spike fact (c)), so `git -C .worktrees/<id> merge --abort` is the correct
  undo *there* — the opposite command in the opposite tree. ADR-0037's finding was never wrong
  for the case it examined (a squash on `main`); it simply didn't yet have a second, real-merge
  case to distinguish from.
- Each of ADR-0032, ADR-0037, and ADR-0063 carries a dated backlink to this ADR (see each
  file's own note near its end).

## Consequences

**Positive**
- A real merge conflict at merge-back no longer defaults to interrupting a human on every
  occurrence — the worker, who already holds the task's context and tests, gets the first
  attempt, with the builder as the genuine last resort.
- The rebase idea ADR-0032 left open is resolved with evidence, not deferred indefinitely —
  a future reader will not re-propose it without also re-deriving fact (b).
- The one-shot budget is structurally decoupled from the FAIL-iteration counter, so a
  healthy, already-passing task cannot be escalated merely for having the bad luck of a
  late-arriving sibling.
- Six previously-unpinned git behaviors are now a regression-tested fixture, not tribal
  knowledge re-derived by the next incident.

**Negative**
- One more conductor-prose choreography (seven rungs, two prompt-template variants, a new
  Phase 1 case) to hold correctly — real complexity, only partially offset by mechanizing the
  parsing/prompt/budget pieces.
- The git-in-tests exception, while bounded and explicit, is a real precedent: a future task
  could over-read it as license for broader git-shelling in `lib/`. The exception's scope
  (test-only, tmpdir-only, never-env-derived) is stated explicitly here and in the fixture's
  own header comment specifically to resist that drift.
- A worker asked to resolve a merge conflict is doing something categorically different from
  its ordinary task execution — a new failure mode (a worker that resolves a conflict
  incorrectly, silently discarding the sibling's intent) is possible in principle; the
  authority statement and the mandatory re-verify (rung 6) are the mitigations, not a
  guarantee.

**Neutral**
- Complements `agentic-workflow-ghcaj` (source+tests-only worker branches): once that lands,
  prose conflicts (BC README / ADR text) mostly vanish and this ladder fires almost
  exclusively on genuine code conflicts — rare in this project's history to date. Neither task
  blocks the other; the ladder's dispatch is file-list-driven and needs no prose-specific
  branch either way.

## Alternatives considered

- **Automatic `git rebase` + re-verify (ADR-0032's original sketch).** Rejected on evidence:
  fact (b) shows the rebase clears no conflict class a merge doesn't already clear, and a
  rebase is strictly worse here (separate replay of ephemeral commits, detached HEAD,
  rewriting the salvage source branch).
- **Keep "abort and surface" as the only rung (status quo).** Rejected: every recorded real
  conflict to date required a human, at a point in the workflow (merge-back) the whole
  worktree-isolation model exists to keep out of the human's way for the common case.
- **Skip the worker rung; go straight from abort to builder escalation.** Rejected: the
  worker already holds the exact context (task file, tests, its own diff) a human resolving
  the same conflict would have to reconstruct from scratch; skipping it discards free
  leverage the isolation model already pays for.
- **Give the resolve dispatch its own iteration counter, separate budget cap.** Considered,
  then rejected for simplicity: reusing the existing FAIL counter (never touched by the
  dispatch itself, only by what happens *after* it) needs no new cap to reason about, and the
  one-shot ladder flag is a separate, simpler axis (has this worktree ever hit a conflict) than
  "how many times has verification failed."
- **Mechanize the seven-rung sequencing itself as a script.** Rejected per the mechanize-or-
  drop declaration above — the sequencing spans two different git trees with real judgment
  calls (which rung fired, what to surface) better suited to conductor prose than a brittle
  script chasing every git edge case.

## References
- ADR-0032 — the worktree-isolation model and the "abort and surface" rule this amends.
- ADR-0037 — the abort-command finding this narrows to the squash-on-`main` case.
- ADR-0063 — worktree-abandonment salvage; rung 1 and rung 7 both reuse its capture mechanism
  and `MERGE_CONFLICT_TAG` extends its tag family.
- ADR-0038 — the git-free `lib/` boundary; the bounded test-only exception this ADR carves out.
- ADR-0057 — the derived-artifact checkpoint guard rung 2 defers to.
- ADR-0058 — provisional ADR numbering; the reason the `AA`-under-decisions/ guard is fail-
  closed prose for a case that should never actually fire.
- ADR-0059 — the mechanize-or-drop doctrine this decision's own declaration follows.
- `lib/merge-conflict-ladder.mjs`, `lib/worktree-salvage.mjs`,
  `lib/test/merge-conflict-ladder.test.mjs`, `lib/test/git-facts-merge-conflict.test.mjs` —
  this task's implementation.
