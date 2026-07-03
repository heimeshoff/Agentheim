---
id: agentic-workflow-t7m4c
title: Mechanize CLAIM + COMPLETE lifecycle scripts against the ADR-0032 worktree / squash-merge model
status: done
type: refactor
context: agentic-workflow
created: 2026-07-03
completed: 2026-07-03
depends_on: [agentic-workflow-k5n8f, agentic-workflow-f6m2q]
blocks: []
tags: [harness-audit, bookkeeping, task-lifecycle, scripts, work, worktree]
related_adrs: ["0007", "0026", "0032", "0038", "0042"]
related_research: []
prior_art: [agentic-workflow-003, agentic-workflow-063]
---

## Why

[[agentic-workflow-k5n8f]] mechanized the **PROMOTE** path (single-tree, modeling-owned)
as the pattern MVP and deliberately descoped the **work-path** operations — CLAIM
(`todo → doing`) and COMPLETE (`doing → done`) — because they are entangled with the
ADR-0032 per-worker worktree / squash-merge git model, and because
[[agentic-workflow-f6m2q]] (implement worktree isolation) was still in flight when
k5n8f was refined. Mechanizing them against a *moving* choreography would have
collided with a live sibling. This task lands them against the **final** worktree model,
once f6m2q is done.

## What

Reuse the k5n8f spine (`lib/resolve-plugin-file.mjs`, the `task-lifecycle-cli.mjs`
skeleton, the git-free manifest contract, p3v9k Ruling B) and add the two work-path
verbs, matched to ADR-0032:

- **CLAIM is a *batch* operation, not per-task.** Under ADR-0032 the conductor claims N
  ready tasks at batch start with **one** claim commit (the `todo → doing` move rides in
  the batch-start commit). The handler must support claiming a *set* of ids and emit one
  manifest for the batch — its exact shape is defined by f6m2q's final model.
- **COMPLETE spans two trees.** The `doing → done` move happens in the worker's
  **worktree**; the INDEX / protocol / backlink bookkeeping happens on **main** after the
  `git merge --squash`. So by the time the conductor runs `complete` on main, the file is
  already in `done/`. Make the move **idempotent** at the CLI layer: if `applyTaskMove`
  returns `stale-precondition` **and** `resolveTaskFile` finds the task already in the
  target folder, treat it as a no-op move and proceed to bookkeeping (no change to
  `applyTaskMove` itself). One `complete` verb then serves both the worktree path
  (already merged) and any shared-tree fallback.
- **Fold the manifest into `work`'s squash-merge.** The handler stays **git-free** (emits
  `{ changed, message, verb, id }`); `work`'s conductor adds the manifest's enumerated
  paths to the single squash commit — `git add -A` never appears, a concurrent `modeling`
  session's markdown is never swept in (ADR-0026 §5 + ADR-0032 both preserved).
- **`work/SKILL.md`** — delegate the CLAIM (batch-start) and COMPLETE (post-merge)
  bookkeeping to the scripts; delete the replaced text-surgery prose, keep the contract
  as a pointer. This is where the audit's largest context-budget reclaim lands.

## Acceptance criteria

- [ ] CLAIM handler claims a batch of ids and emits one manifest matching f6m2q's final batch-start commit shape; the `todo → doing` moves are represented without a second git actor.
- [ ] COMPLETE handler is idempotent w.r.t. an already-in-`done/` file (worktree already moved it): `stale-precondition` + already-in-target → proceed to bookkeeping, not an error. Covered by a `node --test` case for "file already in done/ on main".
- [ ] Both handlers stay git-free and emit enumerated manifests; `work`'s conductor commits them (squash-merge for complete, batch commit for claim) with a scoped add — never `git add -A`.
- [ ] `work/SKILL.md` delegates CLAIM + COMPLETE bookkeeping to the scripts; removed prompt-prose is gone, not duplicated.
- [ ] The ADR-0032 trivial-squash carve-out is addressed: decide whether the manifest supports multi-`[task-id]` squash messages, and document the choice.
- [ ] Covered by `node --test` alongside the k5n8f lifecycle-script tests.

## Notes

- Split from the original broad k5n8f capture on 2026-07-03 (architect brief, this refine).
  `depends_on` **f6m2q** because CLAIM's batch shape and COMPLETE's two-tree split are
  *defined by* the final worktree model; do not mechanize them against the pre-0032
  shared-tree flow.
- `depends_on` **k5n8f** for the reusable spine (resolver, CLI skeleton, manifest contract,
  the p3v9k boundary decision it implements).
- Reciprocal `blocks` edge on f6m2q was intentionally **not** written during this refine —
  f6m2q was in `doing/` under a live `work` session and editing its file would risk
  contaminating that session's commit; the `depends_on` edge here is the load-bearing one.

## Outcome

Landed `claimBatch` and `completeTask` in `lib/task-lifecycle.mjs`, wired live into
`lib/task-lifecycle-cli.mjs`'s `claim`/`complete` verbs, and rewrote `skills/work/SKILL.md`
to delegate CLAIM (Phase 4 step 1) and COMPLETE (Git authority PASS/SKIP section) bookkeeping
to them — reusing the k5n8f spine (the same `resolve-plugin-file.mjs`-based env-free `node -e`
bootstrap, the git-free enumerated-manifest contract, the p3v9k/ADR-0038 three-layer boundary).

- **`claimBatch(rootDir, ids, opts)`** — BATCH-shaped (unlike `promoteTask`/`completeTask`),
  matching ADR-0032's one-claim-commit-per-batch choreography: pre-checks every id resolves
  in `todo/` **before any move happens** (fail-loud, whole batch aborts with nothing moved on
  a missing id — a mid-batch race after the pre-check is surfaced with whichever ids already
  moved named in the rejection, not rolled back), then moves each `todo → doing` via
  `applyTaskMove`, groups the `INDEX.md` marker/count edits **per BC** (a batch may legitimately
  span more than one bounded context), and prepends exactly ONE `protocol.md` "Batch started"
  entry naming every claimed id. Returns one manifest `{changed, message, verb:'claim', ids}`;
  the commit `message` drops the `<bc>` token (`chore: batch start […]`) when the batch spans
  multiple contexts, else `chore(<bc>): batch start […]`.
- **`completeTask(rootDir, id, opts)`** — single-task-shaped, mirrors `promoteTask`. **Idempotent**
  w.r.t. ADR-0032's two-tree split: the worker's worktree already moves the task file
  `doing → done` before the squash-merge, so by the time `complete` runs on `main`,
  `applyTaskMove`'s own `doing → done` attempt typically rejects `stale-precondition` — if the
  task resolves in `done/` already, that's treated as a no-op move (not an error) and bookkeeping
  proceeds against the file already there; any other rejection (a genuine "file is elsewhere"
  stale-precondition, illegal-move, not-found) propagates untouched. Performs the `INDEX.md`
  doing→done marker/count edit and prepends either the "Task verified and completed" or "Task
  completed (verification skipped)" `protocol.md` entry, selected by `opts.skipped`. Returns
  `{ok:true, changed, message, verb:'complete', id, idempotent}`.
- **`lib/task-lifecycle-cli.mjs`** — added `claim`/`complete` to `HANDLERS`; `claim`'s second
  positional argv is a comma-separated id list; both verbs (and `promote`, unaffected) accept
  an optional THIRD positional argv carrying a JSON opts blob (merged under any `opts.taskOpts`
  test injection), since `complete`'s richer bookkeeping fields (summary, duration, verification,
  filesChanged, testsAdded, adrsWritten) don't fit a bare id/verb pair. A malformed JSON third
  argument is rejected as `{ok:false, code:'invalid-opts-json'}`.
- **`skills/work/SKILL.md`**: Phase 4 step 1 (batch-start claim commit) now runs the `claim`
  script instead of hand-editing `INDEX.md`/`protocol.md`; the Git authority PASS/SKIP section's
  steps 2–4 now run the `complete` script instead of hand-writing the doing→done bookkeeping
  (ADR backlink maintenance for `ADRS_WRITTEN` stays conductor-owned prose — the script has no
  visibility into that worker-SUCCESS-only data). The "Index updates" table's `todo → doing` and
  `doing → done` rows are marked mechanized; `doing → backlog` (BOUNCE) stays hand-edited, not
  mechanized by this task. The Protocol logging section's "Batch started" / "Task verified and
  completed" / "Task completed (verification skipped)" templates are now documented as
  script-generated (kept as the human-readable contract, not instructions to hand-compose),
  mirroring how `modeling/SKILL.md` treats the PROMOTE entry. Added a note to the trivial-squash
  carve-out section pointing at ADR-0042.
- **ADR-0042** (new): decided `completeTask` stays single-task-shaped — no `completeBatch`. When
  the trivial-squash carve-out applies to N tasks, the conductor runs `complete` once per task
  and composes the one shared commit itself (union of `changed` paths, concatenated `[<id>]`
  trailers), rather than the script inventing a shared summary/`<type>` across possibly-different
  tasks — reserved for the skill's judgment layer per ADR-0038's three-layer boundary.
- **BC README**: replaced the old "CLAIM/COMPLETE are the same shape, descoped to
  agentic-workflow-t7m4c" placeholder with a full `claimBatch`/`completeTask` entry describing
  both shapes, the idempotency mechanism, and the ADR-0042 decision.
- **Tests** (`node --test`, TDD red→green): `lib/test/task-lifecycle.test.mjs` (+12: 4
  `claimBatch`, incl. single-id, multi-id same-BC, cross-BC, and missing-id-aborts-whole-batch;
  4 `completeTask`, incl. the idempotent-already-in-done/ case and a genuine
  stale-precondition-elsewhere case; both files' `makeIndexMd` test helper gained a `doingLines`
  param to model the pre-bookkeeping INDEX state correctly for the idempotent fixture).
  `lib/test/task-lifecycle-cli.test.mjs` (+7: `claim`/`complete` `runCli` cases plus two real
  `execFileSync` spawns proving the CLI's argv wiring for both new verbs, and the malformed-JSON
  rejection). Full `lib/test/**/*.test.mjs` suite: 108/108 green.

Key files: `lib/task-lifecycle.mjs`, `lib/task-lifecycle-cli.mjs`,
`lib/test/task-lifecycle.test.mjs`, `lib/test/task-lifecycle-cli.test.mjs`,
`skills/work/SKILL.md`, `.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/knowledge/decisions/0042-complete-script-single-task-carve-out-composed-by-caller.md`.
