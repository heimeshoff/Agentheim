---
id: ADR-0077
title: Two more lifecycle verbs — a dedicated `bounce` policy key with a `transformBody` write-seam, and a `reroute` verb that mints a new id rather than keeping the old one
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-qd24q, agentic-workflow-fn59c]
related_adrs: [0007, 0026, 0028, 0038, 0054, 0055, 0059, 0068, 0073, 0074, 0075]
---

# ADR-0077: Two more lifecycle verbs — a dedicated `bounce` policy key with a `transformBody` write-seam, and a `reroute` verb that mints a new id rather than keeping the old one

## Context

`agentic-workflow-pt0gy` (ADR-0075) put a cross-process lock inside every mechanized
lifecycle writer and added two opts-only mechanics verbs (`log`, `index-add`), but
deliberately left two hand-writes standing because both are **count-coupled** — they move a
task between lifecycle folders and must edit two list blocks and two counts together — and
`log`/`index-add` may not legally touch a task list (pt0gy's five-section deny-list,
`task-list-section-forbidden`):

- `work`'s BOUNCE integration: the `doing → backlog` move, hand-performed on `main` because
  `applyTaskMove`'s `policy:'skill'` set is forward-only and does not include this transition.
- `quick-capture`'s cross-BC "Re-routing after the fact": two BCs' `backlog-list` blocks and
  both counts edited by hand.

This task builds the two verbs that close both holes. Wiring the remaining hand-writers onto
them is `agentic-workflow-fn59c`, split off at refinement so a verifier checks a code-only
verb build and a prose-only doctrine sweep separately.

## Decision

### 1. `bounce` — a dedicated policy key, never a widened `'skill'`

`LEGAL_MOVES.bounce = {'doing->backlog'}` is added to `lib/task-lifecycle.mjs` as a
**separate, third policy key** on `applyTaskMove`, alongside `ui` and `skill`.

**Rejected alternative: widen `skill` to include `doing->backlog`.** `skill`'s forward-only
property is real and shared by its three other callers (`promoteTask`/`claimBatch`/
`completeTask`) — widening the set would silently change what every existing call site's
`policy:'skill'` argument means, for a backward move none of them ever intends to make. A
dedicated key keeps `skill`'s "backward moves and skips are illegal" invariant intact and
scopes the one backward move `bounceTask` needs to its own, minimal legal-move set. Proven by
a regression test: `applyTaskMove(..., {policy:'skill'})` still rejects `doing->backlog` as
`illegal-move` after this change.

### 2. The `## Worker note` rides the mover's single write — the `transformBody` seam

`applyTaskMove` gains one new, optional hook: `options.transformBody: (content) => content`,
applied to the already-read source content immediately BEFORE `rewriteStatus`, and published
by the mover's one existing write-destination-then-unlink-source step (ADR-0055 ordering
unchanged). Every pre-existing caller (`promoteTask`/`claimBatch`/`completeTask`) passes
nothing and is byte-for-byte unchanged — proven by the full pre-existing test suite passing
unmodified.

Two alternatives were considered and rejected:

- **A second `writeFileAtomic` of the note, run AFTER the move.** Not retriable: a retry of
  `bounce <id>` after "moved but note failed" hits the verb's own `illegal-move` precondition
  (the task is no longer in `doing/`), so the worker's `reason` — the one judgment input in
  the whole verb — would be silently lost with no recovery path.
- **Writing the note into the source file in place, BEFORE the move.** This is exactly
  ADR-0055's rejected write-source-then-move shape: it risks mtime corruption on the very
  precondition the move is about to check, and a retry after a note-write-then-crash would
  append the note a second time (non-idempotent).

`transformBody` sidesteps both: the note is composed into the ONE write that already happens,
so it can never exist independently of the move (and vice versa).

`bounceTask`/`bounceTaskLocked` (`lib/task-lifecycle.mjs`) mirror `promoteTask`'s exact
shape: a read-only source probe in `doing/`, a PURE compute of the new INDEX.md (`doing-list`
removal via a private strict-removal variant mirroring ADR-0073's, `backlog-list` insertion,
`Doing`/`Backlog` deltas from lines actually removed/inserted) and the `Task bounced`
protocol entry, then the one `applyTaskMove(..., {policy:'bounce', transformBody})` call,
then the writes — all under the one project-wide lifecycle lock (ADR-0075).

**Manifest:** `{ok:true, changed:[newBacklogPath, oldDoingPath, indexPath, protocolPath],
message:'chore(<bc>): task bounced — <title> [<id>]', verb:'bounce', id}`.

**Rejections, fail-closed, nothing written:** `not-found` (the task is nowhere);
`illegal-move` (the task exists but is not in `doing/` — a domain-vocabulary remap of the
shared source probe's `stale-precondition`, since bounce's own precondition failure reads as
"this move does not apply to where the task currently sits" rather than a race);
`missing-reason` (no `opts.reason`); `lock-timeout`.

A `node --test` fixture proves the crash-between-writes property directly: a test-only,
`NODE_TEST_CONTEXT`-gated `opts.testCrashBeforeIndexWrite` (mirroring `lifecycle-lock.mjs`'s
`holdMs` convention, agentic-workflow-dpbjj) throws immediately after `applyTaskMove` succeeds
but before the INDEX write — the moved file already carries the `## Worker note` even though
the function then throws, proving the note is never a second, independently-failable write.

### 3. `reroute` mints a new id and retires the old one

`reroute <id> {"to": "<bc>"}` (`lib/task-lifecycle-capture-dismiss.mjs`, alongside
`captureTask`/`dismissTask` — reusing that module's INDEX-backfill and backlink-traversal
helpers) relocates a `backlog`-only task **across bounded contexts**.

**Decision: mint a new `<to-bc>-<token>` id and retire the old one, rather than keeping the
id under the new BC.** `deriveContext(id)` is a pure prefix parse with no fallback;
`promoteTask`/`completeTask`/the vestigial `findMovedFromDoingPath` all default their BC
through it; no skill passes an explicit `context` opt today; and `captureTask` already
fail-closes a frontmatter `context:` that disagrees with the id-derived prefix
(`context-mismatch`). Keeping the old id under a new BC would have one verb (a hypothetical
"keep-id" `reroute`) permanently manufacturing exactly the state another verb (`captureTask`)
already refuses. The id is a composite `{context, token}` value (ADR-0028 §1); a cross-BC move
changes that identity, so minting is the only sound choice. (Rejected alternative: keep the
old id, rewrite only `context:`. Rejected for the hazard above.)

The token is minted by a new function, `lib/id-grammar.mjs`'s `mintTaskId(context)` (backed by
`mintTaskToken()`), the first CODE minter in this project (every other minting call site is
agent prose per `references/id-grammar.md`) — needed because `reroute` is a mechanized verb
with no agent turn in the loop to hand-pick a token. It is verified against `classifyTaskId`
before being returned (the ADR-0044 backstop) and additionally checked for collision within
the target BC before use.

**Idempotence marker.** Because the old and new copies carry *different* ids, ADR-0055's usual
same-id duplicate self-heal cannot fire on a crash-retry. The new file carries a
`rerouted_from: <old-id>` frontmatter field — the shape a retry scans for
(`findRerouteSuccessor`), since `materializeTaskFile`/`captureTask` already parse frontmatter
and a body-section marker would need bespoke parsing for no benefit. A retry that finds a file
in the target BC's `backlog/` carrying this marker reuses its id (never minting a second
successor), completes the pending unlink of the old file if it is still present, and skips
re-inserting the target BC's `backlog-list` line if it is already there — proven by a
`node --test` fixture that pre-creates both the marked successor and the still-present old
file and asserts exactly one file, one INDEX line, and the pending unlink completing.

**Ordering:** `reroute` does NOT wrap `applyTaskMove` — a cross-BC `backlog → backlog`
relocation has no status change and is not a single-BC folder-pair transition. It hand-rolls
ADR-0055's write-destination-then-unlink-source ordering directly: write the new file
(`id`/`context` rewritten, `rerouted_from` set, filename re-slugged from the title) first,
then unlink the old.

**Backlink re-point (never strip), reusing `dismissTask`'s traversal (ADR-0068
single-source).** `stripIdsFromField`'s bracketed-array rewrite is generalized into a shared
`mapIdsInField(content, field, mapId)` — `mapId` returns the same string to keep an item,
a different string to rename it, or `null` to drop it. `stripIdsFromField` (dismiss) and the
new `renameIdInField` (reroute) are both thin callers of this one function now, rather than
two independently hand-rolled array-rewrites that could drift. `dismissTask`'s own tests stay
green, unchanged. `reroute` walks every task via the existing `loadAllTasks` and renames an
exact `oldId` match to `newId` in `depends_on`/`blocks`/`prior_art`, and every ADR's
`related_tasks`, mirroring `confirmDismissLocked`'s own decisions-directory walk.

**INDEX bookkeeping across two BCs, one verb:** remove the old BC's `backlog-list` line
(`Backlog` −1, via the same strict-removal variant `bounceTask` uses), insert the new BC's
line (`Backlog` +1) — the target BC's missing `INDEX.md` is backfilled only under
`captureTask`'s own otherwise-empty rule (reusing its private `bcHasOnlyThisFile`/
`renderIndexTemplate` helpers directly, same module) and refused `index-missing` otherwise.
One `Modeling / Re-routed` protocol entry naming both ids.

**Legal only `backlog → backlog`.** This confines the whole cost of re-identification to the
one pre-promotion window in which at most one `[<old-id>]` commit trailer could reference the
old id.

**Manifest:** `{ok:true, changed:[newTaskPath, oldTaskPath, oldIndexPath, newIndexPath,
protocolPath, ...everyBacklinkFileTouched], message:'chore(<new-bc>): re-route <old-id> →
<new-id> [<new-id>]', verb:'reroute', id:<old-id>, newId}`.

**Rejections, fail-closed, nothing written:** `same-bc`; `not-in-backlog` (the task is neither
in the source BC's `backlog/` nor does a retry-successor already exist); `unknown-bc` (no
`contexts/<to>/` directory); `index-missing`; `lock-timeout`.

## ADR-0059 (mechanize-or-drop) compliance

Both verbs' full rejection ladders are `node --test`-covered (fail-closed, nothing written, on
every named code). The `bounce` policy-key restriction and the `skill`-still-rejects
regression are covered. Both idempotence markers/behaviors (`bounce`'s note-survives-a-crash
fixture, `reroute`'s retry-after-partial-failure fixture) are covered. Nothing this task
establishes is left prose-only/unenforced.

## Consequences

**Positive:** the "exactly one class of writer per bookkeeping file" invariant (pt0gy, ghcaj)
now has zero holes on the verb side — every remaining hand-writer (`work`'s BOUNCE, quick
capture's re-route) has a locked, tested verb to be wired onto by `agentic-workflow-fn59c`.
`transformBody` is a narrow, backward-compatible seam other future verbs needing to publish a
body edit alongside a move can reuse. `mintTaskId` gives future mechanized-minting call sites
a tested, grammar-verified generator instead of hand-rolled agent prose.

**Negative:** `reroute`'s id-mint-and-retire semantics mean a rerouted task's pre-promotion
commit history (if any) still references the OLD id — accepted, since `backlog → backlog`-only
legality already bounds this to the narrowest possible window (no commit ever references the
task by id before capture, and after promotion `reroute` is illegal). `bounceTaskLocked`'s
`illegal-move` remap of the shared probe's `stale-precondition` code means the two lifecycle
scripts now use different codes for structurally similar situations — accepted, since the
codes are meant to name each verb's own domain vocabulary, not share a wire format.

## Alternatives considered

- Widening `LEGAL_MOVES.skill` to include `doing->backlog` — rejected (§1).
- A second, post-move write for the Worker note — rejected as non-retriable (§2).
- Writing the note into the source in place, pre-move — rejected as ADR-0055's own rejected
  shape (§2).
- Keeping the old id across a re-route, rewriting only `context:` — rejected as manufacturing
  a state `captureTask` already refuses (§3).

Builds on ADR-0007, ADR-0038, ADR-0054, ADR-0055, ADR-0059, ADR-0068, ADR-0073, ADR-0074,
ADR-0075. Amends **ADR-0028** with a new §8 (re-routing).
