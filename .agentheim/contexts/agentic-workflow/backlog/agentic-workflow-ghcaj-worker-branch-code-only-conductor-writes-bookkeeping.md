---
id: agentic-workflow-ghcaj
title: Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: []
blocks: []
tags: [captured, worktree, merge-back, mechanization, rework]
related_adrs: [0032, 0037, 0057, 0058, 0026, 0038]
related_research: []
prior_art: [agentic-workflow-f6m2q, agentic-workflow-t7m4c, agentic-workflow-k9t3w, agentic-workflow-w2njd]
---

## Why

Parallel worktree batches conflict at merge-back far more often than the builder expects,
and the protocol record shows the conflicts are **never code** — git's 3-way merge has
reconciled every parallel code edit cleanly since ADR-0032 landed. Every real merge-back
conflict has been a `.agentheim/` prose artifact or a derived build artifact:

- the BC `README.md` — two same-BC workers rewrite the same bullet, or an additive entry
  collides with a wholesale rewrite (w7q2m vs t7m4c/q3n7k, 2026-07-03);
- an ADR amendment appended by two workers at the same anchor (tkq7v vs spv0k, 2026-07-13);
- `dashboard/dist/app.js` — since made unstageable by ADR-0057;
- the task file's own `doing → done` move, which the worker still performs inside its worktree.

In a single-core-BC project like this one, *almost every task* touches the same README, so
the conductor keeps holding ready tasks "to the next wave" on the Phase 3 advisory, and the
parallelism ADR-0032 was meant to unlock is throttled by prose, not by code.

The builder's framing: **orchestration and ticket wrangling belong on `main`; the worker's
worktree exists only for the implementation.** The conductor already writes INDEX/protocol on
`main` (ADR-0032/0038); this task moves the *remaining* `.agentheim/` writes — README delta,
ADR files, the `doing → done` move — out of the worker's branch and onto `main` too.

## What

Shrink what a worker's private branch may contain to **source and tests only**. Everything
under `.agentheim/` is written by the conductor on `main`, sequentially, after the code
squash-merges:

1. **Worker return format grows structured bookkeeping blocks** — e.g. `README_DELTA`
   (the ubiquitous-language / invariant entries to add or change, addressed to a README
   section or marker), `ADRS` (full ADR bodies, provisional-numbered per ADR-0058), and the
   existing task-move intent. The worker no longer edits `README.md`, writes into
   `knowledge/decisions/`, or moves its task file in the worktree.
2. **Checkpoint refuses `.agentheim/` paths** from the worker's `FILE_LIST`, the same way
   ADR-0057's guard refuses `dashboard/dist/` — one more entry in the `refused` manifest, at
   the seam that already exists.
3. **Conductor applies bookkeeping on `main` at integration**: after `git merge --squash`
   stages the code delta, the conductor (via the mechanized `complete` verb, extended) writes
   the README delta at its marker, materializes the ADR files with `finalizeAdrNumbering`
   (ADR-0058 already runs here), performs the `doing → done` move, then INDEX + protocol as
   today — all in the one integrating commit ADR-0026 requires.
4. **Verifier still sees the README/ADR content** — it is passed the structured blocks
   alongside the code diff so "README left stale" and "ADR misaligned" remain catchable.
5. **Phase 3 advisory** loses its same-BC-README case entirely (there is nothing left to
   collide on), and `MAX_PARALLEL` can rise for same-BC batches.

## Acceptance criteria

- [ ] A worker branch (`aw/<id>`) contains no changes under `.agentheim/` at squash-merge time; a `.agentheim/` path in `FILE_LIST` appears in checkpoint's `refused` manifest with a named reason.
- [ ] Two same-BC workers in one batch that both contribute README entries and both mint an ADR integrate with **zero** merge-back conflicts, and the resulting `README.md` / `decisions/` on `main` contain both contributions (test fixture, `node --test`).
- [ ] The integrating commit for each task still lands as ONE commit with code + README delta + ADR(s) + `doing → done` + INDEX + protocol (ADR-0026 shape preserved).
- [ ] The verifier receives the README delta and ADR bodies for the task it is judging and can FAIL on a missing or misaligned entry, as today.
- [ ] BOUNCE and FAIL-iteration-3 escalation paths still salvage correctly (ADR-0063): the structured blocks are written into the salvage patch or a sibling `.md` next to it so no README/ADR text is lost on abandonment.
- [ ] `agents/worker.md`, `skills/work/SKILL.md` (Phase 3 advisory, checkpoint, git authority), `skills/verification-before-completion/SKILL.md`, and the worker return-format reference are updated; an ADR records the amendment to ADR-0032's "worker moves its task file / updates its BC README / writes ADRs in the worktree" choreography.

## Notes

Captured via `modeling` on 2026-09-05 from the builder's complaint that parallel worktrees
conflict "very often". Evidence gathered at capture: protocol entries 2026-07-03 15:32
(w7q2m README conflict, resolved by hand), 2026-07-13 10:45 §(1)–(2) (ADR-0050 amendment +
README bullet + dist bundle conflict), and the recurring "held to next wave — same BC README"
lines in batch-start entries across June/July.

Open questions for REFINE:
- **Shape of `README_DELTA`.** Marker-addressed appends (cheap, conflict-free, but the README
  grows only by accretion until CONSOLIDATE) vs. a "replace this bullet" form (lets a worker
  correct an existing entry, but re-introduces same-target collisions that the conductor must
  then resolve sequentially — still conflict-free in git terms, since applied one at a time on
  `main`). Recommendation to test: append-only + CONSOLIDATE, with the ADR-0041 ~600-line
  trigger as the pressure valve.
- **`type: decision` tasks** whose whole deliverable is an ADR: the ADR body travels in the
  report instead of as a worktree file — confirm the verifier's decision-task path copes.
- **Interaction with ADR-0058**: `finalizeAdrNumbering` currently renumbers files staged by
  the squash; it would instead number bodies the conductor is about to write. Same function,
  different input.
- Does this fold into the rework's TaskStore / DecisionStore ports (see the anatomy page's
  section 10)? The conductor becoming the sole `.agentheim/` writer is exactly the seam a
  Jira-backed TaskStore would want — worth checking before implementation so the return-format
  blocks are designed once.
- Sibling capture: `agentic-workflow-pt0gy` covers the *modeling*-side concurrency (several
  modeling sessions colliding on `protocol.md` / `INDEX.md`). Independent — neither blocks the other.
