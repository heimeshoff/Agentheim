---
id: ADR-0054
title: Compute-then-write atomicity for the mechanized lifecycle verbs — supersedes the dry-run marker mirror
scope: agentic-workflow
status: accepted
date: 2026-07-09
related_tasks: [agentic-workflow-wq7fn]
related_adrs: [0038, 0042]
---

# ADR-0054: Compute-then-write atomicity for the mechanized lifecycle verbs — supersedes the dry-run marker mirror

## Context

ADR-0038 Ruling B put the deterministic INDEX/protocol text-surgery for the mechanized
lifecycle verbs (`promoteTask`, `claimBatch`, `completeTask` — `lib/task-lifecycle.mjs`) in
a git-free layer that wraps `applyTaskMove` and must never strand a half-applied lifecycle
state: a file moved with no bookkeeping written, or bookkeeping half-written with the file
unmoved. ADR-0038 itself did not rule on *how* that atomicity is achieved; the first
implementation (`agentic-workflow-k5n8f`, its AC #5) answered with a **dry-run mirror**:
`validateBookkeepingMarkers` (plus three helpers, `hasSectionBlock` /
`hasSectionStartMarker` / `hasProtocolMarker`) re-checked, before `applyTaskMove` moved
anything, that every marker the mutation phase was about to touch was matchable.

That mirror is a duplicate of the mutation phase's own throw sites, and it drifted: it
validated the `<!-- <section>:start/end -->` markers and the protocol `---` separator, but
not the `**<Label>:** N` count lines `adjustIndexCount` parses — so an `INDEX.md` whose
section markers were intact but whose `task-counts` block was missing a required label (or
held a non-numeric value) made `adjustIndexCount` throw with files **already moved**, exactly
the state ADR-0038 exists to prevent. Worse, the system generated that malformed state
itself: `adjustIndexCount(content, 'Todo', -1)` against `**Todo:** 0` silently wrote
`**Todo:** -1` (`Number('0') - 1` doesn't throw), after which the label's own regex could
never match again — every subsequent verb call in that BC then threw *this same bug*, again
after moving files.

`agentic-workflow-wq7fn` (this task) fixed the count-line instance and, per its own
refinement, targeted the bug **class**: a hand-maintained dry-run mirror that must be
updated in lockstep with the mutation phase's own throw sites, and had already fallen out of
sync once.

## Decision

**Compute-then-write, not dry-run-then-mutate.** Each mechanized verb now:

1. Resolves its source task file **read-only** (no mutation) and reads `title`/`type`/
   `fileName` from it. A source-missing rejection (`not-found` / `stale-precondition`) is
   synthesized from a single extracted predicate (`resolveSourceOrReject`), never derived by
   speculatively invoking `applyTaskMove` as an oracle.
2. Computes the **full** new `INDEX.md` and `protocol.md` content **purely** — no disk
   writes — inside a `try`. `removeIndexLine`, `insertIndexLineAtTop`, `adjustIndexCount`,
   and `prependProtocolEntry` are all pure `string → string` functions that already throw on
   a marker/count mismatch; a throw here is caught and returned as
   `{ok:false, code:'bookkeeping-marker-mismatch', reason}`, with nothing moved and nothing
   written.
3. Calls `applyTaskMove` — the first and only disk mutation, and the last mutation before the
   writes. (`completeTask`'s idempotent branch — the file already sits in `done/` because the
   worker's worktree already moved it — performs no move at all; the two writes are then the
   *only* mutation.)
4. Writes `INDEX.md` and `protocol.md` via `writeNormalizedFile`.

`validateBookkeepingMarkers` and its three helpers are **deleted**. The computation itself is
now the guard: every future throw site the mutation-phase functions grow is fail-closed for
free, because the same functions run — for real, not as a dry check — inside the try/catch
before any move happens. There is no second, hand-maintained copy of "what could go wrong" to
keep in sync.

Two hardening changes ride along, both living inside `adjustIndexCount` (the single choke
point every count mutation flows through, so the guard cannot drift out of sync the way a
separate pre-check would):
- **Negative-count guard.** A decrement whose result would go below zero throws, naming the
  label, current value, and delta, instead of silently writing e.g. `-1` (which then makes
  the label's own regex unmatchable for every subsequent mutation — the self-inflicted
  cascade described above).
- **Block-scoped replace.** `adjustIndexCount`'s regex is now scoped to inside the
  `<!-- task-counts:start/end -->` block (mirroring `removeIndexLine`'s block capture), so an
  identically-labeled line elsewhere in the file (a header, an example) is never the line
  that gets edited.

The `applyTaskMove` precondition probe (source resolution, `not-found` vs.
`stale-precondition`) is extracted into `resolveSourceOrReject` — one implementation, called
by both `applyTaskMove` itself and each verb's compute phase. This was a deliberate rejection
of the alternative (letting the verb call the real `applyTaskMove` to *discover* whether the
source is missing): that pattern has a TOCTOU where a file appearing in the source folder
between the verb's read-only resolve and the mover's own resolve gets moved with no
bookkeeping computed. Extracting the probe leaves one implementation instead of two that could
drift — the same principle this whole ADR applies to the mirror it removes.

## Scope of what this supersedes

This ADR supersedes **only** `agentic-workflow-k5n8f`'s AC #5 dry-run-mirror mechanism (the
`validateBookkeepingMarkers` function family) as the answer to "how does the mechanized
bookkeeping stay atomic." It does **not** amend:
- **ADR-0038's Ruling A** (fail-closed `depends_on`) — unchanged, still enforced by
  `applyTaskMove`.
- **ADR-0038's Ruling B** (the three-layer boundary: mover / git-free script / skill
  judgment+git) — unchanged. This ADR operates entirely inside layer 2's own internal
  ordering; it does not move any responsibility across the layer boundary.
- **ADR-0042** (`completeTask` stays single-task-shaped, no `completeBatch`) — unchanged.
  `completeTask`'s shape (one id in, one manifest out) is untouched; only its internal
  ordering (resolve source doing/-else-done/ before any move) changed.

## Consequences

**Positive:** the fail-closed guard now covers every throw site the mutation-phase functions
have, including the ones this task fixed (count-line missing/non-numeric, negative-count) and
any future one — there is no mirror to update. The negative-count guard closes a live,
self-generated corruption path (`**Todo:** -1`) that previously cascaded into every subsequent
verb call in the affected BC. The extracted `resolveSourceOrReject` predicate removes a
second, potentially-drifting copy of the source-resolution logic from the codebase entirely
(there was never a second copy to begin with in `applyTaskMove` itself — this ADR prevents the
verbs' compute phase from becoming one).

**Negative:** the compute phase now does real work (running the actual mutation functions)
rather than a cheap boolean dry-check, so a doomed-to-reject call does marginally more work
before rejecting (negligible in practice — string operations on `INDEX.md`/`protocol.md`-sized
files). `claimBatch`'s compute phase in particular now builds the full per-BC index content for
the whole batch before the move loop runs, rather than a per-BC boolean check — a larger
in-memory computation, still bounded by the batch size.

**Neutral:** the accepted residual windows already documented for the mechanized verbs are
unchanged by this ADR — `applyTaskMove` succeeding then a `writeNormalizedFile` throwing
(EPERM/ENOSPC), `claimBatch` writing one BC's index then throwing on the next, and the
mid-batch vanish race (an id moved successfully then a later id in the same batch turns out to
have vanished) all remain out of scope; true multi-file write atomicity (tmp-write + rename
journal) is a separate, optional future task.

## Alternatives considered

- **Patch the dry-run mirror to also check count lines** (add a fourth helper,
  `hasCountLine`) — rejected: fixes the reported instance but not the class; the mirror would
  still need hand-updating for the next throw site the mutation phase grows, which is exactly
  how it fell out of sync the first time.
- **Keep the dry-run mirror AND add compute-then-write as a second layer** — rejected:
  redundant work for no additional safety once compute-then-write's catch is the real guard;
  two mechanisms doing the same job is itself a drift risk.
- **Give `claimBatch` a negative-count / marker pre-check per id before the move loop, instead
  of computing the whole batch's index content up front** — rejected: still a second copy of
  "what could go wrong," now scoped to a loop instead of the whole file; the whole-batch
  compute-then-write is no more expensive in practice and removes the duplication entirely.

## References
- ADR-0038 — the lifecycle-mechanization boundary (three concentric layers) and the
  fail-closed `depends_on` ruling this ADR does not touch.
- ADR-0042 — `completeTask` stays single-task-shaped; unaffected by this ADR.
- `agentic-workflow-k5n8f` — introduced `promoteTask`/`claimBatch`/`completeTask` and the
  dry-run mirror (its AC #5) this ADR supersedes.
- `agentic-workflow-t7m4c` — landed `claimBatch`/`completeTask` against the ADR-0032
  worktree/squash-merge model; this ADR's `completeTask` reordering (resolve doing/-else-done/
  before any move) preserves that task's idempotency contract unchanged.
- `agentic-workflow-wq7fn` — this task.
