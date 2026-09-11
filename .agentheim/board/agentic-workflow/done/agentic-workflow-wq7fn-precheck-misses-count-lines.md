---
id: agentic-workflow-wq7fn
title: Fail-closed pre-check misses the task-counts lines — bookkeeping must compute before the move
status: done
type: bug
context: agentic-workflow
created: 2026-07-09
completed: 2026-07-09
depends_on: []
blocks: []
tags: [task-lifecycle, bookkeeping, atomicity, fail-closed]
related_adrs: [0038, 0042, 0054]
related_research: []
prior_art: [agentic-workflow-k5n8f, agentic-workflow-t7m4c, agentic-workflow-p3v9k]
---

## Why

ADR-0038 Ruling B put the deterministic INDEX/protocol text-surgery for the mechanized
lifecycle verbs in `lib/task-lifecycle.mjs`, but never ruled on *how* that layer stays
atomic. `agentic-workflow-k5n8f`'s AC #5 answered that with a hand-maintained **dry-run
mirror**: `validateBookkeepingMarkers` re-checks, before `applyTaskMove` moves anything, that
every marker the mutation phase will touch is matchable — so a mismatch strands nothing.

That mirror is a duplicate of the mutation phase's throw sites, and it must be updated by
hand whenever the mutation grows a new one. It already fell out of sync: it validates the
`<!-- <section>:start/end -->` markers and the protocol `---` separator, but **not** the
`**<Label>:** N` count lines that `adjustIndexCount` parses. Those are still parsed during
the mutation phase, *after* the task file has moved: `claimBatch` runs `adjustIndexCount('Todo',
-1)` / `('Doing', 1)` after its move loop, and `promoteTask` / `completeTask` have the same
shape. An `INDEX.md` whose section markers are present but whose `task-counts` block is
missing a required label line (or holds a non-numeric value) makes `adjustIndexCount` throw
with files already moved — exactly the half-applied lifecycle state the ADR-0038 guard exists
to prevent.

Worse, the system generates that malformed state itself. `adjustIndexCount(content, 'Todo',
-1)` against `- **Todo:** 0` writes `- **Todo:** -1` silently (`Number('0') - 1` doesn't
throw). Thereafter the regex `(\*\*Todo:\*\* )(\d+)` cannot match past the `-`, so *every
subsequent* promote/claim/complete in that BC throws `INDEX.md is missing the Todo count.` —
after moving files. A decrement that would take a count below zero means the INDEX is already
desynced from disk; it must reject, not corrupt.

The fix targets the bug *class* — a dry-run mirror that must chase the mutation phase's throw
sites — not just the count-line instance.

Field report (WisdomHeim vault, 2026-07-09, plugin ~0.8.x): a `claim` against a pre-template
bespoke index moved one task file `todo/ → doing/` and rewrote a second task's frontmatter to
`status: doing` before aborting on `INDEX.md is missing the Todo count.` — repaired by a
hand-written revert of both. That index lacked the section markers too, so today's marker
dry-validation would have rejected it cleanly. The narrower case — markers present, count line
missing or malformed, or driven negative by a prior desync — still reproduces on current `main`
by inspection.

## What

Replace the dry-run mirror with **compute-then-write** in each mechanized verb. Because
`removeIndexLine`, `insertIndexLineAtTop`, `adjustIndexCount` and `prependProtocolEntry` are
pure `string → string`, and `applyTaskMove` preserves the filename across the move
(`lib/task-lifecycle.mjs:218`), each verb becomes:

1. resolve the source path; read `title` / `type` / `fileName` from it (no mutation)
2. compute the full new `INDEX.md` + `protocol.md` content purely — a throw here is caught and
   returned as `{ok:false, code:'bookkeeping-marker-mismatch', reason}`; nothing moved
3. `applyTaskMove` — the first and only disk mutation, and the last mutation before the writes
4. `writeNormalizedFile(index)`, `writeNormalizedFile(protocol)`

`validateBookkeepingMarkers` and its `hasSectionBlock` / `hasSectionStartMarker` /
`hasProtocolMarker` helpers are **deleted** — the computation itself is now the guard, so
every future throw site in the bookkeeping phase is fail-closed for free.

Fold in two hardening changes to `adjustIndexCount`: refuse a below-zero result, and scope its
replace to inside the `<!-- task-counts:start/end -->` block so it can never edit a colliding
count line elsewhere in the file. Reorder `completeTask` to resolve its source (`doing/` or
`done/`) before the move, and compute `claimBatch`'s full per-BC index content for the whole
batch up front.

## Acceptance criteria

- [ ] Each mechanized verb (promote, claim, complete) computes its full new `INDEX.md` and
      `protocol.md` content **before** `applyTaskMove`; a throw during that compute returns
      `{ok:false, code:'bookkeeping-marker-mismatch', reason}` with nothing moved and nothing
      written. `applyTaskMove` is the only disk mutation before the two `writeNormalizedFile`
      calls, and those follow the move.
- [ ] `validateBookkeepingMarkers` and its three helpers (`hasSectionBlock`,
      `hasSectionStartMarker`, `hasProtocolMarker`) are removed; no reference to them remains
      in `lib/`.
- [ ] `adjustIndexCount` rejects a decrement whose result would be `< 0`: it throws naming the
      label, current value and delta; in the compute phase that throw becomes a structured
      rejection. Per-verb test: an `INDEX.md` with `**Todo:** 0` (resp. `**Backlog:**`,
      `**Doing:**`) that the verb would decrement → structured rejection, task file still in
      its origin folder, `INDEX.md` and `protocol.md` byte-identical, and the count line is
      **not** left at `-1`.
- [ ] `adjustIndexCount`'s replace is scoped to the `<!-- task-counts:start -->` …
      `<!-- task-counts:end -->` block (mirroring `removeIndexLine`'s block capture). A test
      pins that a colliding `**Todo:** N` line placed in the header, above the block, is not
      the line that gets edited.
- [ ] The **pre-existing** bookkeeping rejections are pinned per verb, on an LF fixture,
      asserting `res.code === 'bookkeeping-marker-mismatch'`: (a) a missing section-list
      marker, and (b) a missing protocol `---` separator (currently unpinned anywhere). Each
      asserts task file still in its origin folder, `INDEX.md` / `protocol.md` byte-identical.
- [ ] The **new** count-line rejection is pinned per verb: an `INDEX.md` with valid section
      markers but a missing or non-numeric `**<Label>:** N` line the verb would adjust →
      structured rejection, tree untouched (same byte-identical assertions).
- [ ] `applyTaskMove`'s precondition probe (`lib/task-lifecycle.mjs:168-181` — resolve
      `fromPath`, else distinguish `stale-precondition` from `not-found`) is extracted into a
      pure, read-only predicate that both `applyTaskMove` and the verbs' compute phase call.
      The verbs synthesize the source-missing rejection from that predicate and **never** invoke
      the mover as a rejection oracle. A test pins that `applyTaskMove`'s own `not-found` /
      `stale-precondition` behavior is unchanged by the extraction.
- [ ] `completeTask` resolves its source (`doing/`, else `done/`) before any move. Tests pin,
      unchanged in behavior: the normal `doing→done` path (`idempotent:false`, `changed`
      includes `fromPath`); the idempotent already-in-`done/` path (**no move performed**,
      `idempotent:true`, `changed` omits `fromPath`, `title` / `type` read from the `done/`
      file); a genuine `stale-precondition` (file in `todo/`); and `not-found` (file nowhere).
- [ ] `claimBatch` computes each BC's full new index content for the whole batch up front and
      performs the move loop as the last step before the writes. The documented mid-batch
      vanish race is **unchanged**: a test pins that when an id vanishes between the pre-check
      and its move, the ids already moved this call stay moved, the split `claimed` manifest
      surfaces them, and **no** `INDEX.md` / `protocol.md` write happened. (This task does not
      claim to fix that race.)
- [ ] Every rejection across all three verbs is `{ok:false, code, reason}` with the tree
      untouched — enforced by a before/after byte-identical read of both `INDEX.md` and
      `protocol.md` and an existence check that the task file is still in its origin folder.
- [ ] **Anti-deletion.** The three existing `task-lifecycle-eol.test.mjs` "fail-closed on a
      marker-broken CRLF `INDEX.md`" tests (`promoteTask` ~L281, `claimBatch` ~L384,
      `completeTask` ~L464) stay and stay green — they survive the refactor because the thrown
      `missing the <section> markers` text is preserved through the compute-catch and surfaces
      in `reason`. They must not be deleted or weakened to make the suite pass.
- [ ] A new ADR records the compute-then-write atomicity rule ("bookkeeping is computed before
      the move; the move is the last mutation before the writes; a compute-phase throw is
      fail-closed"), stating it **supersedes `agentic-workflow-k5n8f`'s AC #5 dry-run-mirror
      mechanism only** and does **not** amend ADR-0038's Rulings A/B or ADR-0042.
      `related_adrs` on this task updated to include it. (Next free number is ~0054 — verify at
      work-time; 0053 is the current ceiling.)
- [ ] `node --test lib/test/*.test.mjs` stays green (explicit glob — the bare-directory form
      finds nothing under Node 25 on this box).

## Notes

- **Accepted residual windows (all pre-existing, all disk-I/O class, none reopen ADR-0038's
  marker/count invariant, which this task fully closes):** `applyTaskMove` succeeds then
  `writeNormalizedFile(index)` or `(protocol)` throws (EPERM / ENOSPC); `claimBatch` writes
  BC-1's index then throws writing BC-2's; `claimBatch` moves id 2 of 3 then id 3 vanishes (the
  split `claimed` manifest, above). True multi-file write atomicity (tmp-write + rename journal)
  is a separate, optional task, deliberately out of scope here.
- **Hoist `mkdirSync(dirname(protocolPath), {recursive:true})` into the compute phase** so a
  broken `knowledge/` dir rejects before anything moves, rather than after.
- **The rejection-oracle question was settled at refinement, not deferred.** The alternative —
  letting the real `applyTaskMove` produce the source-missing rejection — carries a TOCTOU where
  a file appearing in the source folder between the read-only resolve and the mover's own
  resolve gets moved with no bookkeeping computed. It was rejected on the same principle that
  drives this whole task: a second copy of a check drifts. Extracting the probe leaves one
  implementation, called from both places.
- **Negative-count guard lives inside `adjustIndexCount`**, the single choke point every count
  mutation flows through — a separate pre-check would re-derive the label / value and could
  drift out of sync (the exact failure mode of the mirror this task removes). It runs in the
  compute phase, so its throw is already caught. A consistent INDEX never underflows in normal
  flow (promote decrements Backlog ≥ 1, claim Todo ≥ 1, complete Doing ≥ 1); the guard fires
  only when the INDEX is already desynced from disk, where rejecting is the correct fail-closed
  behavior.
- **Code stays `bookkeeping-marker-mismatch`** even though it now also covers count-underflow
  and the count-line miss — one code, specificity carried in `reason`; no second code invented.
- **Test-coverage baseline, verified at refinement.** `grep -rn "bookkeeping-marker-mismatch"
  lib/` matches only the three `reject(...)` sites — no test asserts the *code*. But
  `task-lifecycle-eol.test.mjs` does pin the marker rejections *behaviorally* (asserting
  `res.reason`, files unmoved, both files byte-identical) on a CRLF fixture, for all three verbs.
  Genuinely uncovered today: the protocol `---`-separator rejection, the LF-fixture path, any
  assertion on `res.code`, and the count-line + negative-count rejections. The ACs above pin the
  gaps rather than re-pinning what is already covered.
- **Sibling `agentic-workflow-dk3vz`** (rotation's silent-zero on an unparseable done-list) is
  the same fail-closed / partial-mutation theme one layer up, but a different file
  (`lib/index-rotation.mjs`) and call path — `rotateIndexDoneList` is not reached from
  `task-lifecycle.mjs` (verified by grep). Independent; no `depends_on` / `blocks` edge (a
  sibling cross-reference is the correct link).
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` (transplanted
  here 2026-07-09 after verifying the residual against `main`).

## Outcome

Replaced the dry-run marker mirror (`validateBookkeepingMarkers` + its three helpers, deleted)
with **compute-then-write** in all three mechanized verbs (`promoteTask`, `claimBatch`,
`completeTask`, `lib/task-lifecycle.mjs`): each now resolves its source read-only, computes the
full new `INDEX.md` + `protocol.md` content purely inside a `try` (a throw from
`removeIndexLine`/`insertIndexLineAtTop`/`adjustIndexCount`/`prependProtocolEntry` is caught as
`{ok:false, code:'bookkeeping-marker-mismatch', reason}`, nothing moved, nothing written), then
runs `applyTaskMove` — the only disk mutation, last before the two writes.
`adjustIndexCount` now rejects a below-zero decrement (naming label/current/delta) and scopes
its replace to inside the `<!-- task-counts:start/end -->` block, mirroring `removeIndexLine`'s
block capture, closing the collision this class of bug produced (a decrement silently writing
`**Todo:** -1`, which then made every subsequent verb call in that BC throw the same bug after
moving files). `applyTaskMove`'s own precondition probe was extracted into
`resolveSourceOrReject`, one implementation called by both `applyTaskMove` and every verb's
compute phase — no rejection-oracle pattern, no second copy to drift. `completeTask` now
resolves `doing/`, else `done/` (idempotent), before any move, mirroring the same ordering.
`claimBatch` computes every BC's full new index content for the whole batch up front and moves
last; the documented mid-batch vanish race is unchanged (re-pinned by a new deterministic test
using two ids that alias the same physical file).

Recorded **ADR-0054**, superseding only `agentic-workflow-k5n8f`'s AC #5 dry-run-mirror
mechanism — ADR-0038's Rulings A/B and ADR-0042 are explicitly untouched.

**Tests** (`node --test`, TDD red→green): 15 new tests in `lib/test/task-lifecycle.test.mjs` —
3 negative-count-guard tests (one per verb), 1 block-scoping collision test, 3 LF-fixture
marker-mismatch tests asserting `res.code` (previously only pinned behaviorally on CRLF), 3
protocol `---`-separator tests (previously unpinned anywhere), 3 count-line
missing/non-numeric tests, 1 `completeTask` not-found test, and 1 `claimBatch` mid-batch
vanish-race test. The three pre-existing CRLF anti-deletion tests in
`task-lifecycle-eol.test.mjs` (`promoteTask`/`claimBatch`/`completeTask` fail-closed on a
marker-broken CRLF `INDEX.md`) were kept unmodified and stay green — the thrown marker text
still surfaces in `reason` through the compute-catch. Full `lib/test/*.test.mjs` suite: 204/204
green (189 before, +15).

Key files: `lib/task-lifecycle.mjs`, `lib/test/task-lifecycle.test.mjs`,
`.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/knowledge/decisions/0054-compute-then-write-atomicity-supersedes-dry-run-mirror.md`.
