---
id: agentic-workflow-gwh69
title: Mechanized RESULT reconstruction from the worktree — `lib/worker-result.mjs` gains `reconstructResultFromWorktree`, rebuilding a top-truncated SUCCESS's headers from the conductor-gathered changed-path list and the surviving blocks with explicit `reconstructed` provenance, as a ladder rung ahead of the lost-result re-dispatch — built only once ADR-0080's compliance or re-dispatch evidence says the redundancy is not enough
status: backlog
type: feature
context: agentic-workflow
created: 2026-09-12
completed:
depends_on: [agentic-workflow-qwfq3]
blocks: []
tags: [worker-contract, worker-result, mechanization, work-skill, transcript-loss, harness, evidence-gated]
related_adrs: [0080, 0074, 0059, 0038, 0062]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-q7v3k]
---

## Why

Split out of `agentic-workflow-qwfq3` at refinement (2026-09-12; ADR-0080 "Deferred behind
evidence"). The capture proposed three layers against a lost worker RESULT: a sidecar copy, a
trailing header repeat, and a mechanized reconstruction of the missing headers from the
worktree. The first two cover every incident observed so far (r4mzp needed only entity
unescaping; j3rsn and js62b were top-truncated at the first fence, which the trailing repeat
alone recovers), and qwfq3's ladder floors the residual with a lost-result re-dispatch into
the same worktree.

The honest tradeoff, recorded so it is not re-derived: **reconstruction preserves judgment,
re-dispatch re-authors it.** Reconstruction keeps the worker's already-written `ADRS` /
`README_DELTA` / `OUTCOME` / `BACKLOG_ITEMS` blocks intact and rebuilds only headers, but can
never produce `TESTS_*` values except `unknown`; a re-dispatch gets a runner-measured
`TESTS_PASSING` but a fresh worker re-authors every block (a different ADR number and prose, a
different README anchor). Reconstruction is worth its judgment-encoding surface (`SUMMARY`
from a first sentence, `FILE_LIST` from git) only if the two redundancy pieces turn out not to
hold — which is what the gate below measures. Also note the recovery window it would extend:
the trailing repeat rescues a top-truncation landing at or before the first opening fence;
reconstruction can additionally handle a copy that lost its headers but kept all four blocks
and has no trailing copy (a worker that skipped the repeat), and nothing rescues a cut inside
a block.

**Promotion gate (evidence, not detail):** promote only when `protocol.md` or its rolled
archives, dated after qwfq3's completion, show **either** (a) at least one
`**Result source:** re-dispatch` line, **or** (b) two or more completion entries with
`sidecar missing` or `layout leading` (no `trailing`/`both`) — the correlated-non-compliance
signal ADR-0080 names. Count only tasks *dispatched* after qwfq3's integration commit
(`937b598`): a worker spawned before the sidecar/trailing-repeat contract existed cannot be
non-compliant with it (kr9pd and g2fgb in qwfq3's own batch are the example — their
notification-sourced results predate the contract and are not evidence). A refine that finds neither leaves this in `backlog/`. If the evidence
instead shows every lost copy still carried its trailing headers, DISMISS this task rather
than build it.

## What

`lib/worker-result.mjs` exports `reconstructResultFromWorktree({partialText, changedPaths,
worktreeRoot, taskId})`. Given a SUCCESS text whose first non-blank line is a ````-fence, that
has **all four blocks intact** and **no complete trailing header copy** (`parseWorkerResult`
would reject it `missing-result-line`), plus a conductor-gathered list of worktree-relative
changed paths (`git status --porcelain` UNION `git diff --name-only <fork-point>...HEAD`,
because a wip-checkpointed iteration leaves porcelain empty), it returns
`{ok:true, text, fields, reconstructed:[...]}` where:

- `FILE_LIST` is the absolute paths of every changed path that `partitionCheckpointFiles`
  would stage (derived artifacts and `.agentheim/` paths excluded); `FILES_CHANGED` is that
  count;
- `TASK_ID` is `taskId`;
- `ADRS_WRITTEN` is derived from the `ADRS` block's `<!-- ADR: -->` markers (`none` if empty);
- `SUMMARY` is the first sentence of the `OUTCOME` body;
- `TESTS_ADDED`, `TESTS_PASSING`, `TDD_SKIPPED`, `CONCEPT_CANDIDATE` are `unknown` — never
  guessed (ADR-0062: `TESTS_PASSING` is the runner's verdict or nothing);
- `reconstructed` names every field that was rebuilt rather than read;
- `text` parses cleanly through `parseWorkerResult` with `layout.leadingHeader === true`.

Rejects `not-truncated` when the input already carries a complete header copy (leading or
trailing), and `unrecoverable` when any of the four blocks is missing or a `stray-fence` is
present. Stdlib-free, git-free, side-effect-free (ADR-0038) — the conductor gathers the path
list with git and passes it in.

`selectResultSource` (qwfq3) gains an optional `reconstruct: {changedPaths, worktreeRoot}`
input; when present and the three primary sources all fail, it tries reconstruction on the
best surviving candidate (the sidecar, then the transcript, then the unescaped notification)
before returning `no-valid-source`, reporting `source: 'reconstructed'` and passing
`reconstructed` through. The completion entry's `**Result source:**` value reads
`reconstructed (<fields>)`. The verifier is handed the `reconstructed` field list, and a
non-empty list (or `TESTS_PASSING: unknown`) makes the runner-first suite run mandatory
regardless of `TESTS_ADDED` (ADR-0062) — `agents/verifier.md` and the Verifier Prompt Template
state this.

## Acceptance criteria

- [ ] `reconstructResultFromWorktree` exists with the contract above; tests in
      `lib/test/worker-result.test.mjs` use a fixture built from the infrastructure-js62b
      iteration-1 shape and cover: successful reconstruction (asserting `FILE_LIST` excludes a
      `dashboard/dist/` and a `.agentheim/` path from `changedPaths`, `TESTS_PASSING` is
      `unknown`, `reconstructed` lists exactly the rebuilt fields, and `text` round-trips
      through `parseWorkerResult`); `not-truncated` for a leading copy and for a trailing copy;
      `unrecoverable`.
- [ ] `selectResultSource` with the `reconstruct` input tries reconstruction only after all
      three primary sources fail, on the best surviving candidate; a test pins the order and
      that the rung is skipped when the input is absent.
- [ ] `skills/work/SKILL.md`'s ladder carries the new rung, the `git status` UNION `git diff`
      path-gathering rule, and the `reconstructed (<fields>)` Result-source value.
- [ ] `agents/verifier.md` and the Verifier Prompt Template carry the mandatory-suite-run rule
      for a non-empty `reconstructed` list.
- [ ] `node --test lib/test/*.test.mjs` is green on the live tree (the two environmental
      flakes named in qwfq3's Notes excepted).

## Notes

- The promotion gate in Why is the blocker; nothing here is under-specified.
- **Gate check 2026-09-12 (refine):** not met. Zero completion entries dated after qwfq3's
  completion (20:35). The only post-contract datum is qwfq3 itself: `sidecar · layout
  leading/trailing/sentinel · sidecar present` — its notification copy was top-truncated and
  re-escaped, and the sidecar rescued it on day one. That counts *for* the redundancy holding,
  not toward the gate. Re-check after the next few work batches; the `**Result source:**` line
  in every PASS/FAIL completion entry (`skills/work/SKILL.md` Protocol logging) is the measured
  input.
- **Gate check 2026-09-13 (refine):** not met. Post-contract tally since `937b598`: 3 worker
  dispatches (agentic-workflow-vsb06 ×1, infrastructure-hnv3d ×2), 2 completion entries, every
  one `sidecar · layout both+sentinel · sidecar present`; 0 `**Result source:** re-dispatch`,
  0 `sidecar missing`, 0 `layout leading`; "Lost-result re-dispatches: 0" at session end. Both
  redundancy layers held 3/3 — evidence points *away* from building this, but 3 dispatches is
  too small a sample to call the redundancy proven. Stays in `backlog/`.
- **Closing rule (refined 2026-09-13)** so the next re-check is a count, not a judgment:
  DISMISS this task once the post-`937b598` tally reaches **10 worker dispatches with zero**
  `re-dispatch`, `sidecar missing`, or `layout leading` results — at that point the correlated-
  non-compliance risk ADR-0080 §7 names has had ten independent chances to show and did not.
  The promotion gate in Why is unchanged; whichever threshold is hit first decides the task.
  Running tally: 3/10 clean as of 2026-09-13.
- **Gate check 2026-09-14 (refine):** neither threshold hit on its letter; the closing rule is
  hit on its purpose. Post-`937b598` tally: **10 worker dispatches** across five sessions
  (agentic-workflow-vsb06 ×1, infrastructure-hnv3d ×2, infrastructure-reh04 ×1,
  infrastructure-e8h9f ×1, infrastructure-xh8tw ×2, infrastructure-vpbks ×2,
  infrastructure-p3k9r ×1), 7 completion entries. Recorded `**Result source:**` lines: 2
  (vsb06, hnv3d), both `sidecar · layout both+sentinel · sidecar present`; 0 `re-dispatch`,
  0 `sidecar missing`, 0 `layout leading`. **One lost-result re-dispatch** (session end
  2026-09-13 11:07): infrastructure-xh8tw iteration 1 — the sidecar was present and its
  leading header parsed, but the BACKLOG_ITEMS fence was never closed, so `parseWorkerResult`
  rejected `truncated-block`; the same worker rewrote the sidecar, no code changed. That
  incident is **outside this task's recovery window by its own contract**: `What` rejects
  `unrecoverable` on any block that is not intact, and `Why` already concedes "nothing rescues
  a cut inside a block". Reconstruction would not have fired. It is evidence for worker fence
  hygiene (a closing-fence lint on the sidecar, or a parser that treats a `RESULT_END` sentinel
  as closing an open block), not for header reconstruction — a separate capture if the builder
  wants one.
- **Closing rule amended 2026-09-14:** a lost-result re-dispatch counts against the tally only
  when reconstruction could have rescued it — headers lost, all four blocks intact. A
  `truncated-block` / `stray-fence` re-dispatch is neutral: it neither promotes (the gate in
  `Why` measures redundancy failure, not worker typos) nor resets the clean count. Under that
  reading the tally stands at **10/10 clean** — the DISMISS threshold is reached. DISMISS is
  the builder's call, not the refiner's (modeling never infers a hard delete); this refine
  records the count and leaves the task in `backlog/` until the builder says dismiss.
- **Measurement drift, noted 2026-09-14:** 5 of the 7 post-contract completion entries
  (reh04, e8h9f, xh8tw, vpbks, p3k9r) omit the `**Result source:**` line that
  `skills/work/SKILL.md`'s Protocol logging marks "measured, never omitted". The gate's
  measured input is under-recorded; the tally above falls back to the session-end
  `**Lost-result re-dispatches:**` line, which every session did carry. Whether xh8tw's
  iteration-1 copy also had its trailing header repeat is therefore unrecorded.
  Update 2026-09-14 (12:59 session): infrastructure-w506e's completion entry carried the line
  and named its re-dispatch inline; 3 of 8 post-contract completion entries now do.
- **Gate check 2026-09-14, second (refine):** promotion gate not met; closing rule exceeded.
  Post-`937b598` tally: **11 worker dispatches** across six sessions (the ten above plus
  infrastructure-w506e ×1), 8 completion entries. **Second lost-result re-dispatch** (session
  end 2026-09-14 12:59): infrastructure-w506e iteration 1 — sidecar present, rejected
  `stray-fence` because the task Notes mandated an extra block named `ADR_0082_AMENDMENT` and
  `scanBlocks`' opening-fence grammar is `[A-Z_]+` (`lib/worker-result.mjs:124`), so the
  digit-bearing name read as a stray fence line; the same worker rewrote it as
  `ADR_AMENDMENT`, no code changed. Like xh8tw this is a block-shape defect, neutral under the
  amended closing rule (`What` rejects `unrecoverable` on `stray-fence`). Tally: **11/11
  clean** — 0 re-dispatches reconstruction could have rescued, 0 `sidecar missing`, 0 `layout
  leading`. Header loss, the one failure this task rescues, has not occurred since the
  sidecar + trailing-repeat contract shipped; the sidecar was present in all 8 completions.
- **What the evidence points at instead (2026-09-14):** 2 of 11 post-contract dispatches cost a
  full lost-result re-dispatch, both on block-shape defects the parser could tolerate without
  guessing: (a) an unclosed block (xh8tw) — `scanBlocks` could treat the `RESULT_END`
  sentinel, which can never legitimately sit inside a block, as an implicit close of a still-
  open block, provided the sentinel was present in that copy (for xh8tw's iteration 1 that is
  unrecorded); (b) a digit-bearing block name (w506e) — widen the grammar to
  `[A-Z][A-Z0-9_]*`, or lint task Notes and the worker prompt for mandated block names outside
  it. Both are deterministic syntax repairs, not the header reconstruction this task specifies.
  If the builder wants that work it is a fresh capture, or a wholesale re-scope of this id —
  never a promotion of this task as written, and modeling does not self-generate it
  (ADR-0064). The task's own closing rule now says DISMISS; that gesture stays the builder's.
- Provenance marker precedent: ADR-0038 Ruling B (never present a reconstruction as a
  measurement). Reconstruction is exactly the thing that rule was written to label.
- ADR-0080 records the deferral and the gate; flip its "Deferred behind evidence" paragraph to
  an amendment note when this ships.
