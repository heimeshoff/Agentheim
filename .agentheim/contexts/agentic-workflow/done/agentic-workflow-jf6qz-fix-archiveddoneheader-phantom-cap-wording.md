---
id: agentic-workflow-jf6qz
title: Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-09-05
depends_on: [agentic-workflow-mqwnc]
blocks: []
tags: [captured, audit-2026-07-22-followup, doctrine-drift]
related_adrs: [0047, 0039, 0059]
related_research: []
prior_art: [agentic-workflow-mqwnc, agentic-workflow-c8j3w]
---

## Why

`agentic-workflow-mqwnc` (now **done**) corrected the misleading "most recent 30" done-list
header wording in `references/index-template.md`. But that wording is **also machine-generated**
by `lib/index-rotation.mjs`'s `archivedDoneHeader(capEntries)` (`lib/index-rotation.mjs:180`):

```js
function archivedDoneHeader(capEntries) {
  return (
    `### Done (most recent ${capEntries}; older entries archived verbatim under ` +
    `\`done-archive/\` — kept for prior-art search, ADR-0039 convention)`
  );
}
```

`rotateIndexDoneList` overwrites the live `### Done (...)` header with this string
(`lib/index-rotation.mjs:338`, the `DONE_HEADER_LINE` replace) every time it actually rotates a
month out. So:

1. All **three** live `.agentheim/contexts/*/INDEX.md` headers say `### Done (most recent 30; …)`
   today (agentic-workflow / design-system / infrastructure — all three have already rotated, so
   each has a `done-archive/`). A worker can't legally correct them (conductor-owned; exactly why
   mqwnc was re-scoped to leave them alone), and they'd be regenerated from `archivedDoneHeader`
   anyway.
2. Even with mqwnc's template fixed, the **next** real rotation for any BC silently regenerates
   the exact "most recent N" text the template sweep removed — the doc fix is not durable without
   this code fix.

This is the code-owned half of mqwnc's original criterion #3, split out per the escalation
(ADR-0032 worker/conductor boundary, ADR-0059 mechanize-or-drop).

## What

1. **Fix the header string.** Update `archivedDoneHeader` to emit wording matching mqwnc's
   corrected `references/index-template.md` post-rotation prose — describing current-month-live /
   closed-months-archived, **not** a numeric "most recent N" claim, while KEEPING the archive
   naming the template requires post-rotation. Proposed literal:

   ```
   ### Done (current-month entries live; older months archived verbatim under `done-archive/` — kept for prior-art search, ADR-0039 convention)
   ```

   With "most recent N" gone, `capEntries` is no longer read by the header — **drop the parameter**
   from `archivedDoneHeader()` (it stays an input to the rotation cap logic, just not the header).

2. **Update the tests.** `lib/test/index-rotation.test.mjs`'s existing header test
   (`index-rotation.test.mjs:280`, "after rotation the done-list header names the archive
   location") already asserts the archive-naming substring and does **not** pin the old literal, so
   it won't break — but **add a negative assertion** that the post-rotation header contains no
   "most recent" / numeric-cap claim, plus the Option-A heal coverage in #3. `node --test
   lib/test/*.test.mjs` green.

3. **Heal the stale live headers on no-op rotation — Option A (builder-decided 2026-07-22).**
   The session-end rotation check (ADR-0047, already conductor-owned) rewrites a stale header even
   on a run where **no month rolls**, so the three live headers self-correct at the next `work`
   session-end through an already-conductor-owned seam — no worker INDEX edit. Bounded so it never
   makes a false claim:
   - In `rotateIndexDoneList`, after the "no rotation fired" early-returns: **if** the live
     `### Done (...)` header is not already the corrected form **AND** a `done-archive/` exists for
     that BC, rewrite the header to `archivedDoneHeader()`'s corrected output and surface the
     `INDEX.md` as a committable `changed` path via a new `healed` signal (`rotated` stays
     `false`). Gating on `done-archive/` existence is what keeps a never-rotated consumer BC's
     header untouched — no spurious "archived under `done-archive/`" claim before anything is
     archived.
   - `rotateAllIndexDoneLists` must collect a healed BC's `changed` path (today it only collects
     `changed` when `result.rotated`) so the session-end conductor commits the one-time
     correction.
   - **Idempotent / self-limiting:** once a header equals the corrected form, a subsequent run is a
     silent no-op — the change fires at most once per BC, so ADR-0047's fully-quiet common case is
     preserved *after* the one-time heal.
   - **Amend ADR-0047** to document this heal-on-no-op carve-out to its quiet-no-op contract. Per
     ADR-0059 this Option-A behavior establishes a convention ("rotation heals a stale header even
     on a no-op run"); its enforcement is the test in criterion #3 below — **mechanized, not
     prose-only**, so mechanize-or-drop is satisfied.

## Acceptance criteria

- [x] `archivedDoneHeader`'s returned string contains no "most recent" text and no numeric cap;
      it emits the archive-naming form consistent with `references/index-template.md`'s
      post-rotation prose. The `capEntries` parameter is removed from `archivedDoneHeader()`.
- [x] The rotation-fired header (`lib/index-rotation.mjs`'s `DONE_HEADER_LINE` replace, inside
      `rotateIndexDoneList`) writes that corrected string; the existing `index-rotation.test.mjs`
      header test is updated with a **negative** assertion that the header carries no "most
      recent"/numeric-cap claim.
- [x] Option-A heal implemented across `rotateIndexDoneList` + `rotateAllIndexDoneLists`: a no-op
      (non-rotating) run rewrites a stale live header **only when** the BC already has a
      `done-archive/`, surfaces it as a committable `changed` path, and is a silent no-op once the
      header is already corrected.
- [x] New `node --test` coverage for the heal, at least: (a) stale header + `done-archive/` present
      → header corrected, `changed` includes the `INDEX.md`; (b) already-corrected header +
      `done-archive/` → no change, quiet; (c) stale-looking header + **no** `done-archive/` →
      header untouched (no false archive claim).
- [x] `node --test lib/test/*.test.mjs` green.
- [x] ADR-0047 amended to record the heal-on-no-op carve-out to its quiet-no-op contract.
- [x] The three live `contexts/*/INDEX.md` headers reach consistency with
      `references/index-template.md` via the Option-A heal at the **next `work` session-end**
      (conductor-owned) — the worker does **not** hand-edit a live `INDEX.md`. This criterion is
      satisfied by the mechanism now being reachable end-to-end: the `lib/index-rotation.mjs` heal
      writes the corrected header and reports `healed:true`, and `skills/work/SKILL.md`'s "INDEX
      done-list rotation check (session-end)" section (this task's iteration 2) now recognizes the
      healed shape, narrows its no-op rule to require no `healed:true`, and commits the healed
      `changed` paths with a dedicated message shape — so the next `work` session-end both heals and
      commits the correction; not a deliverable in this task's diff.

## Notes

Captured during `agentic-workflow-mqwnc` (doc-only micro-sweep) and refined during its `modeling`
REFINE. `depends_on: agentic-workflow-mqwnc` (**done** 2026-07-22) — the canonical header prose in
`references/index-template.md` exists for the code and tests to match, so the dependency is met.

**Design decision resolved during this refinement (2026-07-22): Option A (heal on rotation),
builder-selected.** Rationale: the task's whole reason to exist as a split-out from mqwnc is
*durability* — the live headers can't be worker-corrected, and Option B (fix code+tests, let the
headers self-correct on each BC's next real month-roll) would leave the wrong "most recent 30" in
all three live headers indefinitely until a month happens to close. Option A closes the loop
deterministically through the already-conductor-owned ADR-0047 session-end seam, with a test, in
the mechanize spirit of ADR-0059. Its one cost — a bounded, one-time, self-limiting amendment to
ADR-0047's quiet-no-op contract — is the explicit trade the builder accepted; it is guarded so a
never-rotated BC (no `done-archive/`) is never touched and no false archive claim is ever made.

**Two-header-form check (why Option A stays single-form):** the corrected header is the
*archive-naming* form. The heal only fires when a `done-archive/` already exists, so the
archive-naming claim is always true where the heal writes it; a never-rotated BC keeps the
template's pre-rotation header form untouched. No conditional second header string is needed.

**ADR-0059 convention scope:** this task's diff touches `lib/` (doctrine-bearing), so the
mechanize-or-drop gate applies. Option A establishes a convention and ships enforcement (the heal
test) → **enforced, not prose-only**. All acceptance criteria are machine-checkable (no
`[human-eye]` criteria).

## Outcome

`archivedDoneHeader()` in `lib/index-rotation.mjs` dropped its `capEntries` parameter and now
emits `### Done (current-month entries live; older months archived verbatim under
\`done-archive/\` — kept for prior-art search, ADR-0039 convention)` — no numeric "most recent N"
claim — matching `references/index-template.md`'s already-corrected post-rotation prose
(agentic-workflow-mqwnc). A new `healStaleHeaderIfNeeded` helper implements the Option-A
heal-on-no-op carve-out: on a non-rotating run, if the live header isn't already the corrected form
AND the BC already has a `done-archive/`, the header alone is rewritten and the result reports
`healed:true` with `changed:[indexPath]`; gated so a never-rotated BC (no `done-archive/`) is never
touched, and idempotent (fires once per BC). `rotateAllIndexDoneLists` now collects a healed BC's
`changed` path the same way it collects a rotated BC's, and surfaces a new top-level `healed`
boolean alongside `rotated`. Every per-BC `{ok:true, ...}` result shape now carries a `healed`
boolean field.

`lib/test/index-rotation.test.mjs` gained: a negative assertion on the existing header test (no
"most recent N" text after a real rotation), three new Option-A heal tests covering cases (a)
stale+archive-present→healed, (b) corrected+archive-present→quiet no-op, (c) stale+no-archive→
untouched, and a `rotateAllIndexDoneLists` aggregation test for the healed case. Full BC suite:
`node --test lib/test/*.test.mjs` → 379 passed, 0 failed.

ADR-0047 amended in place (`.agentheim/knowledge/decisions/0047-...md`) with a new dated
"Amendment — 2026-09-05 (agentic-workflow-jf6qz)" section documenting both the header-wording fix
and the heal-on-no-op carve-out to the quiet-no-op contract, and `related_tasks`/`related_adrs`
updated. BC README's `rotateIndexDoneList` / INDEX done-list rotation entry updated with a note on
the fix and the heal mechanism.

`references/index-template.md` needed no change — its post-rotation prose (mqwnc's earlier fix)
already describes the discipline generically without pinning a "most recent N" or any other
specific header literal, so it already matched the corrected code output; verified via grep.

**Iteration 2 (verifier fix): `skills/work/SKILL.md`'s "INDEX done-list rotation check
(session-end)" section wired to the heal, closing the reachability gap the verifier found.** Step
1's per-BC shape list gained the healed shape (`{ok:true, rotated:false, healed:true,
changed:[indexPath], rolledMonths:[], liveEntries}`) and the manifest description now names the
top-level `healed` boolean beside `rotated`. Step 2's fully-quiet no-op condition now also requires
no BC reported `healed:true`. Step 4 gained a heal-commit obligation: when the top-level `healed`
is `true` and `rotated` is `false`, `git add` the top-level `changed` paths and commit with a
dedicated message shape (`chore(agentic-workflow): heal INDEX done-list header — <bc>[, <bc2>...]
[<last-task-id>]`, falling back to `chore: heal INDEX done-list header — ...` with no completed
task) — a run that both rotates and heals in the same session uses the one rotate-shaped commit.
Step 5's "no protocol entry" rule now says "rotation or heal itself". ADR-0047 amendment point 4
was corrected from "heals all three" to "heals AND commits all three", crediting this SKILL.md
change as what makes the commit half reachable. The n8w2q backlog item captured in iteration 1 was
deleted — its content is now folded into this task's diff and it never reached `main`.

Key files: `lib/index-rotation.mjs`, `lib/test/index-rotation.test.mjs`, `skills/work/SKILL.md`,
`.agentheim/knowledge/decisions/0047-index-done-list-rotation-trigger-work-session-end-check.md`,
`.agentheim/contexts/agentic-workflow/README.md`.

## Verifier note (iteration 1)

**REASONS:**
- Criterion #7 is not reachable as shipped. `skills/work/SKILL.md`'s "INDEX done-list rotation check (session-end)" section has zero occurrences of `healed`. A healed-only run (`rotated:false`, `healed:true`, no refusal, no `unmatched`) satisfies step 2's silent-no-op condition verbatim and never reaches step 4's `rotated: true` commit trigger, so the mechanism criterion #7 delegates to cannot deliver the live-header correction. The worker's own backlog capture n8w2q states this defect explicitly.
- Concrete live-behavior regression: `healStaleHeaderIfNeeded` (reached from `reportUnrotated`) performs an unconditional `writeFileSync` to the live `INDEX.md`. At the next `work` session-end all three already-rotated BCs will have their `INDEX.md` mutated on disk, and step 2's no-op rule will decline to commit them, leaving three stranded uncommitted `.agentheim/`-owned files. Before this diff a `rotated:false` run wrote nothing, which is precisely what step 2's rule assumes.
- The diff introduces false statements on two doctrine-bearing surfaces: the BC README's rotateIndexDoneList entry claims "`work`'s silent no-op rule is narrowed once more to also require no BC reported `healed:true`", and ADR-0047 amendment point 3 makes the same claim while point 4 asserts the next session-end heals all three live BCs. Neither is true against the live `skills/work/SKILL.md`.
- Scope note: `skills/work/SKILL.md` is strongly implied by the task's What #3 ("so the session-end conductor commits the one-time correction"). Nothing in the task file scopes `skills/` out; only live `INDEX.md` files are conductor-owned. Workers routinely amend `skills/work/SKILL.md` in this BC.

Checks that passed: header-string fix and `capEntries` drop are correct and CRLF-safe; the heal fires from both and only both `reportUnrotated()` return points and never from a refusal; `archiveDir` override is honored consistently; criteria #3 to #6 are covered by the four new tests plus the amended header test; suite 379 pass / 0 fail; check 8 skipped (no `dashboard/**` path touched).

**SUGGESTED_FIX:** In this task, update `skills/work/SKILL.md`'s "INDEX done-list rotation check (session-end)" section so the shipped heal is actually reachable: add the `healed:true` shape to step 1's per-BC list, add "and no BC reported `healed:true`" to step 2's no-op condition, and extend step 4 (or add a sibling step) to `git add` + commit the top-level `changed` paths when `healed` is true and `rotated` is false, with a heal-specific message shape (a heal has no `rolledMonths`). Then retire or re-scope `agentic-workflow-n8w2q`, since its entire content becomes redundant.

**ITERATION_HINT:** likely-fixable
