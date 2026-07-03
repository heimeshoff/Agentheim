---
id: 0042
title: The COMPLETE lifecycle script stays single-task — the trivial-squash carve-out is composed by the caller, not built into the script
scope: agentic-workflow
status: accepted
date: 2026-07-03
supersedes: []
superseded_by: []
related_tasks: [agentic-workflow-t7m4c]
related_research: []
---

# ADR 0042: The COMPLETE lifecycle script stays single-task — the trivial-squash carve-out is composed by the caller, not built into the script

## Context

ADR-0038 mechanized task-lifecycle bookkeeping (INDEX.md marker edits, protocol.md
prepends) into git-free scripts under `lib/task-lifecycle.mjs`, behind a thin CLI
(`lib/task-lifecycle-cli.mjs`). `promoteTask` — the first script, landed by
agentic-workflow-k5n8f — is single-task-shaped: one id in, one manifest out.

agentic-workflow-t7m4c mechanizes the two remaining `work`-path verbs, CLAIM and
COMPLETE, against the final ADR-0032 worktree/squash-merge model. CLAIM is
naturally **batch-shaped**: ADR-0032's batch-start claim commit moves a whole
ready set `todo → doing` in one commit, so `claimBatch(rootDir, ids, opts)` takes
a list of ids and emits one manifest covering the whole batch.

COMPLETE's situation is different. `work/SKILL.md`'s existing doctrine (predating
this task) already defines a **trivial-squash carve-out**: under specific
conditions (same BC, same file set, no-behavior-change, same batch — see
`references/commit-doctrine.md`, ADR-0026), several independently-verified tasks'
squash-merges can be folded into **one** shared commit on `main` instead of one
commit per task. The aw-064/065/066/067 one-line topbar-chrome tweaks are the
canonical example. This carve-out predates worktree isolation and predates this
task's mechanization work — the question this ADR settles is narrower: **should
the new `completeTask` script gain a batch mode to serve that carve-out, the same
way `claimBatch` did for CLAIM?**

## Decision

**No.** `completeTask(rootDir, id, opts)` stays single-task-shaped, mirroring
`promoteTask`'s shape exactly — one id, one manifest, one BC's `INDEX.md` edit,
one protocol entry. When the trivial-squash carve-out applies to N eligible
tasks, `work`'s conductor runs `complete` **once per task** in the set (after
each task's own `git merge --squash aw/<id>` in turn), collects the N resulting
manifests, and composes the ONE shared commit itself: `git add` the union of
every manifest's `changed` paths, and write a commit message that concatenates
each manifest's own `[<task-id>]` trailer onto one summary line it writes by
hand (e.g. `feature(agentic-workflow): one-line topbar-chrome tweaks [aw-064]
[aw-065] [aw-066] [aw-067]`).

CLAIM's batch shape is not a precedent that COMPLETE must follow — the two
verbs are batch-shaped for structurally different reasons. CLAIM's batch is
**forced by ADR-0032's own choreography**: there is exactly one claim commit per
dispatch batch, by construction, so a single-id `claimTask` would just be
`claimBatch` called in a loop by the conductor for no benefit — the "batch" is
not optional. COMPLETE's batch (the trivial-squash carve-out) is **occasional
and opportunistic** — it applies only when four specific conditions all hold,
and "when in doubt, do not squash" is the documented default. Building batch
support into the script for a rare case, when the composition is trivial for
the conductor to do with N single-task manifests already in hand, is not
justified by the frequency of the case it would serve.

## Consequences

### Positive
- `completeTask` keeps the exact same shape as `promoteTask` — one id in, one
  manifest out, idempotent on its own single-task rejection path (the
  ADR-0032-driven idempotency for an already-squash-merged file, this task's
  other headline decision). Readers and future maintainers of the script family
  learn one shape, not two.
- No new judgment call moves into the script. A batch-complete verb would have
  to decide a shared commit-message summary line and a shared `<type>` across N
  potentially-different tasks' frontmatter — exactly the kind of judgment
  ADR-0038's three-layer boundary (mover / git-free script / skill judgment+git)
  reserves for the skill, not the script.
- The carve-out's own four gating conditions (same BC, same file set,
  no-behavior-change, same batch) are still evaluated by the conductor, where
  they already lived — this decision doesn't relocate that judgment, it just
  declines to also relocate the mechanical parts that don't need relocating.

### Negative
- When the carve-out applies, the conductor makes N script invocations instead
  of one, and still hand-composes the final shared commit message (the union of
  `changed` paths and the trailer concatenation are simple, but not zero
  conductor-side work). A hypothetical `completeBatch` would collapse this to
  one call — this ADR accepts that cost as the price of not over-building for
  an occasional case.

### Neutral
- This ADR only settles the COMPLETE script's shape. It does not touch the
  carve-out's own four conditions, its evaluation, or `references/commit-doctrine.md`
  — those are unchanged.

## Alternatives considered

- **`completeBatch(rootDir, ids, opts)` mirroring `claimBatch`.** Rejected: the
  carve-out is opportunistic, not structurally forced the way CLAIM's batch is;
  the script would need to invent a shared commit-message summary and `<type>`
  across possibly-different tasks, pushing a judgment call down into
  supposedly-judgment-free layer 2 code.
- **A `completeTask` opt-in "no-commit-message" mode that only returns the
  bookkeeping paths, leaving message composition entirely to the caller even
  in the single-task case.** Rejected: this would degrade the common
  (non-carve-out) single-task path's ergonomics — the caller would always have
  to hand-compose the message — to marginally simplify the rare carve-out path.
  The chosen design keeps the common path fully mechanized and only asks the
  conductor to do extra (still trivial) work in the rare case.

## References
- ADR-0038 — the lifecycle-mechanization boundary (three concentric layers).
- ADR-0032 — per-worker git worktree isolation, the batch-start claim commit,
  and the trivial-squash carve-out's (unaddressed-but-not-precluded) relationship
  to the per-task-branch model.
- ADR-0026 — the trivial-squash carve-out's original four conditions (
  `references/commit-doctrine.md`).
- agentic-workflow-t7m4c — this task, landing `claimBatch` and `completeTask`.
- agentic-workflow-k5n8f — `promoteTask`, the single-task shape this ADR keeps
  `completeTask` consistent with.
