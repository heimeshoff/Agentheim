---
id: agentic-workflow-qd24q
title: Build the two count-coupled lifecycle verbs pt0gy could not cover — `bounce` (doing → backlog under its own mover policy, worker note riding the mover's single write) and `reroute` (cross-BC backlog move that mints a new id, retires the old, re-points every backlink)
status: done
type: feature
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-pt0gy]
blocks: [agentic-workflow-fn59c]
tags: [concurrency, bookkeeping, mechanization, lifecycle-cli, lifecycle-verbs]
related_adrs: [0007, 0026, 0028, 0038, 0054, 0055, 0059, 0068, 0073, 0074, 0075, 0077]
related_research: []
prior_art: [agentic-workflow-e4bjh, agentic-workflow-ghcaj, agentic-workflow-k5n8f, agentic-workflow-pt0gy, agentic-workflow-t7m4c]
---

## Why

`agentic-workflow-pt0gy` (ADR-0075) put a cross-process lock inside every mechanized lifecycle
writer and added two mechanics verbs (`log`, `index-add`) so a skill never has to hand-prepend a
protocol entry or hand-insert an INDEX line again. It deliberately left two hand-writes
standing, because both are **count-coupled** — they move a task between lifecycle folders and
must edit two list blocks and two counts together — and `log`/`index-add` may not legally touch
a task list (pt0gy's five-section deny-list, `task-list-section-forbidden`):

- `work`'s BOUNCE integration: the `doing → backlog` move, hand-performed on `main` because
  that transition is illegal under `applyTaskMove`'s `policy:'skill'` (`skills/work/SKILL.md`
  today literally says "`policy:'skill'` is not itself legal for this transition — do it as
  the plain file move"). `Task bounced` is a named Key event in this BC's README with no
  mover policy behind it — the hand-maintained invariant this task closes.
- `quick-capture`'s cross-BC "Re-routing after the fact": two BCs' `backlog-list` blocks and
  both counts edited by hand, recorded in ADR-0075 and in `quick-capture/SKILL.md` as
  "prose-only, unenforced — tracked in `agentic-workflow-qd24q` as the `reroute` verb"
  (ADR-0059).

Until each goes through a locked verb, "exactly one class of writer per bookkeeping file" —
the invariant pt0gy and ghcaj (ADR-0074) together claim — has two holes. This task builds the
verbs; wiring every remaining hand-writer (including these two) onto them is
`agentic-workflow-fn59c`, split off at the 2026-09-06 refinement so a verifier checks a
code-only verb build and a prose-only doctrine sweep separately (the ghcaj lesson: bound the
sweep).

## What

Two new lifecycle verbs on `lib/task-lifecycle-cli.mjs`, same three-layer boundary
(ADR-0038: mover / git-free CLI / skill judgment+git), same compute-then-write atomicity
(ADR-0054), same lifecycle lock (ADR-0075), same enumerated-manifest / structured-rejection
contract as `promote`/`claim`/`complete`/`capture`/`dismiss`. **No `skills/*.md` or
`agents/*.md` edits in this task** — that is `agentic-workflow-fn59c`'s job; this task's
deliverable is code, tests, one ADR, and the README's lib-inventory line.

### 1. `bounce <id> '{"reason": "<worker REASON verbatim>"}'`

- **`LEGAL_MOVES.bounce = {'doing->backlog'}`** — a new, separate policy key on
  `applyTaskMove` (`lib/task-lifecycle.mjs`), **not** an addition to `'skill'`: `'skill'`'s
  forward-only property is real and shared by its three other callers
  (`promoteTask`/`claimBatch`/`completeTask`); widening it would silently change what every
  existing call site means. Scope the mover's "backward moves illegal" doc comment to the
  `skill` policy specifically.
- **The `## Worker note` rides the mover's single destination write.** Add a narrow,
  optional `options.transformBody: (content) => content` hook to `applyTaskMove`, applied to
  the already-read source content immediately before `rewriteStatus`, published by the
  mover's one existing write-destination-then-unlink-source step (ADR-0055 ordering
  unchanged). Every existing caller passes nothing and stays byte-identical. The rejected
  alternative — call the mover unmodified, then a second `writeFileAtomic` of the note after
  the move — is **not** retriable: a retry of `bounce <id>` after "moved but note failed"
  hits the verb's own `illegal-move` precondition (the task is no longer in `doing/`), so the
  worker's `reason` — the one judgment input in the whole verb — would be silently lost with
  no recovery path. Writing the note into the source in place *before* the move is
  ADR-0055's rejected shape (mtime corruption, non-idempotent append on retry). Record all
  three in the ADR.
- **`bounceTask` / `bounceTaskLocked`** mirror `promoteTask`'s shape exactly: resolve the
  source in `doing/` (read-only probe), compute the new INDEX (`doing-list` removal +
  `backlog-list` insert, Doing −1 / Backlog +1 from lines actually removed/inserted — the
  ADR-0073 strict variant) and the `Task bounced` protocol entry purely, then
  `applyTaskMove(..., {policy:'bounce', transformBody})` → INDEX write → protocol write under
  one lock hold. Manifest `{ok:true, changed:[newTaskPath, oldTaskPath, indexPath,
  protocolPath], message:'chore(<bc>): task bounced — <title> [<id>]', verb:'bounce', id}`.
  Rejects fail-closed with nothing written: `not-found`, `illegal-move` (task not in
  `doing/`), `missing-reason`, `lock-timeout`.

### 2. `reroute <id> '{"to": "<bc>"}'`

- **Mints a new `<to-bc>-<token>` id and retires the old one** — builder decision at the
  2026-09-06 refinement, after both the architect and the tactical-modeler independently
  showed that keeping the old id is a functional break, not a cosmetic one: `deriveContext(id)`
  is a pure prefix parse with no fallback, `promoteTask`/`completeTask`/`checkpoint`'s
  `findMovedFromDoingPath` all default their BC through it, no skill passes an explicit
  `context` opt today, and `captureTask` already fail-closes a frontmatter `context:` that
  disagrees with the prefix (`context-mismatch`) — so keeping the id would have one verb
  permanently manufacturing the state another verb refuses. The id is a composite
  `{context, token}` value (ADR-0028 §1); a cross-BC move changes its identity. The ADR
  amends ADR-0028 with a new §8 (re-routing) — amends, never supersedes. The token is minted
  per `references/id-grammar.md` and verified with `classifyTaskId` (ADR-0044 backstop).
- **Does not wrap `applyTaskMove`** — a cross-BC `backlog → backlog` relocation has no status
  change and is not a single-BC folder-pair transition. Hand-roll ADR-0055's ordering: write
  the new file (frontmatter `id:` and `context:` rewritten, filename re-slugged), then unlink
  the old.
- **Idempotence marker.** Because old and new copies carry *different* ids, ADR-0055's usual
  same-id duplicate self-heal cannot fire on a crash-retry. The new file carries a
  `rerouted_from: <old-id>` frontmatter field (chosen over a `## Re-routed from` body section:
  it is what a retry scans for, and `materializeTaskFile`/`captureTask` already parse
  frontmatter) — a retry that finds a file in the target BC's `backlog/` with
  `rerouted_from: <old-id>` completes the pending unlink and bookkeeping rather than minting a
  second successor. Decide and record the marker's exact shape in the ADR if the worker finds a
  reason to deviate; the field name above is the default.
- **Re-points (never strips) every backlink project-wide** — `depends_on`, `blocks`,
  `prior_art` in every task file across every BC and every lifecycle folder, and
  `related_tasks` in every ADR — by generalizing `dismissTask`'s exact-id traversal
  (`loadAllTasks` / `stripIdsFromField`, `lib/task-lifecycle-capture-dismiss.mjs`) into a
  rename variant. **Reuse, don't copy-and-adapt** (ADR-0068 single-source): the shared-module
  edit is deliberate, and `dismissTask`'s own tests must stay green unchanged.
- **INDEX bookkeeping across two BCs in one verb:** remove the old BC's `backlog-list` line
  (Backlog −1), insert the new BC's line (Backlog +1), both from lines actually
  removed/inserted; the target BC's missing `INDEX.md` is backfilled only under `captureTask`'s
  otherwise-empty rule and refused `index-missing` otherwise. One `Modeling / Re-routed`
  protocol entry naming both ids.
- **Legal only `backlog → backlog`.** This confines the whole cost of re-identification to the
  one pre-promotion window in which at most one `[<old-id>]` commit trailer references the old
  id. Manifest `{ok:true, changed:[newTaskPath, oldTaskPath, oldIndexPath, newIndexPath,
  protocolPath, ...everyBacklinkFileTouched], message:'chore(<new-bc>): re-route <old-id> →
  <new-id> [<new-id>]', verb:'reroute', id:<old-id>, newId}`. Rejects fail-closed with nothing
  written: `same-bc`, `not-in-backlog`, `unknown-bc` (no `contexts/<to>/` directory),
  `index-missing` (non-empty target BC without an INDEX), `lock-timeout`.

### 3. Boundary and out-of-scope

Both verbs are `'id'`-arity in the CLI's `ARITY` table (`<verb> <id> [json-opts]`). Neither
touches git (layer 2 stays git-free; `scoped-commit` is the caller's step). The `README`'s
*Commit doctrine* entry keeps pt0gy's "two count-coupled hand-writers remain open" sentence
until `agentic-workflow-fn59c` wires the skills — this task only adds the verbs to the lib
inventory. The vestigial `MOVED_FROM_DOING_FOLDERS` / `findMovedFromDoingPath` path and
promoting `discoverRoot` into `lib/` remain separate follow-ups (see Notes).

## Acceptance criteria

- [ ] `applyTaskMove` accepts `policy:'bounce'` (legal set exactly `{'doing->backlog'}`) and an optional `transformBody` hook applied before `rewriteStatus` and published by the single destination write; `promoteTask`/`claimBatch`/`completeTask` pass neither and their existing tests are byte-for-byte unchanged. `node --test` proves `'skill'` still rejects `doing->backlog` as `illegal-move`.
- [ ] `bounce <id>` exists on `lib/task-lifecycle-cli.mjs`: lock-held, compute-then-write, moves `doing → backlog`, appends the `## Worker note` from the caller-supplied reason through the mover's write, edits both list blocks and both counts (deltas from lines actually removed/inserted), prepends the `Task bounced` entry, returns the enumerated manifest with the `chore(<bc>): task bounced — <title> [<id>]` message; rejects `not-found`, `illegal-move` (task not in `doing/`), `missing-reason`, `lock-timeout` with nothing written. `node --test` covers every rejection, the lock-held refusal (the pt0gy integration pattern), and a crash-between-writes fixture showing the task file already carries the note when the INDEX write is what failed (the note is never a separate second write).
- [ ] `reroute <id> '{"to": bc}'` exists: lock-held, mints a grammar-valid new id, writes the new file (id/context/filename rewritten, `rerouted_from` set) then unlinks the old, edits both BCs' `backlog-list` blocks and counts, re-points every `depends_on`/`blocks`/`prior_art`/`related_tasks` reference project-wide, prepends one protocol entry, returns the manifest listing every file it touched plus `newId`; rejects `same-bc`, `not-in-backlog`, `unknown-bc`, `index-missing`, `lock-timeout` with nothing written. `node --test` covers a cross-BC fixture with a dependent task in a third BC and an ADR both referencing the moved id (both re-pointed, nothing stripped), a legacy-id source (`<bc>-NNN` re-routes to a fresh token, never a renumbered digit tail), and a retry-after-partial-failure case proving the `rerouted_from` marker prevents a second successor from being minted.
- [ ] The backlink re-point reuses `dismissTask`'s traversal helpers from `lib/task-lifecycle-capture-dismiss.mjs` (generalized strip → rename), and every existing `dismiss` test stays green unchanged.
- [ ] The worker's ADR (ADR-0058 numbering) records both verb contracts and manifests, the dedicated `bounce` policy key (naming the rejected "widen `'skill'`" alternative), the `transformBody` seam (naming the rejected post-move second write and why it is not retriable, and the rejected write-source-in-place shape per ADR-0055), the mint-new-id decision with the `deriveContext`/`context-mismatch` hazard that forced it, the `rerouted_from` idempotence marker, and the `backlog → backlog`-only legality; it amends ADR-0028 with §8 (re-routing) in place. [human-eye]
- [ ] The agentic-workflow README's lib inventory entry for pt0gy's verbs (near the `lib/lifecycle-lock.mjs`, `log` / `index-add` bullet) gains `bounce` / `reroute` with their one-line contracts; the *Commit doctrine* entry's "two count-coupled hand-writers remain open" sentence is left for `agentic-workflow-fn59c` to close. [human-eye]
- [ ] ADR-0059: every convention this task establishes ships enforcement — the verbs' rejection ladders, the policy-key test, the idempotence test — or is explicitly marked prose-only in the ADR.
- [ ] The full `lib/test/*.test.mjs` suite is green on the merged tree (ADR-0062).

## Notes

Split out of `agentic-workflow-pt0gy` at its 2026-09-06 refinement; re-refined and split
again the same day into this code-only verb build and `agentic-workflow-fn59c` (the
four-skill wiring sweep, `depends_on` this task). Orchestrator round (architect +
tactical-modeler) for the second refinement settled: dedicated `bounce` policy key (both
agreed); worker note through a `transformBody` hook on the mover (the tactical-modeler's
retriability rebuttal of the architect's post-move second write was accepted); mint-new-id
for `reroute` (both agreed independently; builder confirmed after first leaning toward keeping
the id).

**Design details left to the worker's ADR (not blockers):** whether `rerouted_from` stays a
frontmatter field (default) or becomes a body section; the exact protocol-entry shape for
`Modeling / Re-routed`; whether the re-route entry belongs under a `Capture /` or `Modeling /`
type prefix (quick-capture is the caller today; modeling may call it later).

**Related follow-ups surfaced by pt0gy's and this task's refinement, not part of this task:**
promoting `discoverRoot` from `dashboard/` into `lib/` so `lib/` stops importing from the
dashboard; removing the vestigial `MOVED_FROM_DOING_FOLDERS` / `findMovedFromDoingPath` path
in `task-lifecycle-cli.mjs` (already noted post-ghcaj); the merge-back ladder's rung-4
`done → doing` revert prose in `work/SKILL.md`, dead for the same reason. Capture separately
if wanted.

## Outcome

Built both verbs `agentic-workflow-pt0gy` left open, on the same three-layer boundary /
compute-then-write / lifecycle-lock contract as `promote`/`claim`/`complete`/`capture`/
`dismiss`:

- **`bounce`** (`lib/task-lifecycle.mjs`: `bounceTask`/`bounceTaskLocked`) — moves
  `doing → backlog` under a new, dedicated `LEGAL_MOVES.bounce` policy key on `applyTaskMove`
  (never a widened `'skill'`). `applyTaskMove` gained one new optional hook,
  `options.transformBody`, applied to the source content immediately before `rewriteStatus`
  and published by the mover's single destination write — this is how `bounce`'s
  `## Worker note` (built from the caller's `reason`) rides that one write instead of needing
  a second, non-retriable write. Every pre-existing caller of `applyTaskMove` is untouched
  (proven by the full pre-existing suite passing byte-for-byte). Rejects `not-found`,
  `illegal-move`, `missing-reason`, `lock-timeout` with nothing written; a
  `NODE_TEST_CONTEXT`-gated test-only crash injection proves the note survives an INDEX-write
  failure.
- **`reroute`** (`lib/task-lifecycle-capture-dismiss.mjs`: `rerouteTask`/`rerouteTaskLocked`)
  — relocates a `backlog`-only task across bounded contexts, minting a fresh `<to>-<token>`
  id via the new `mintTaskId`/`mintTaskToken` (`lib/id-grammar.mjs`) and retiring the old one.
  The new file carries `rerouted_from: <old-id>` as its crash-retry idempotence marker,
  written before the old file is unlinked (hand-rolled ADR-0055 ordering — this transition
  never wraps `applyTaskMove`). Every project-wide `depends_on`/`blocks`/`prior_art`/
  `related_tasks` backlink is re-pointed (never stripped) by generalizing `dismissTask`'s own
  strip logic into a shared `mapIdsInField`/`renameIdInField` pair (`dismissTask`'s own tests
  are unchanged and green). Rejects `same-bc`, `not-in-backlog`, `unknown-bc`,
  `index-missing`, `lock-timeout` with nothing written.
- Both verbs are wired onto `lib/task-lifecycle-cli.mjs`'s `HANDLERS`/`ARITY` tables
  (`'id'`-arity, same argv shape as every other lifecycle verb).

25 new `node --test` cases across four files cover both verbs' happy paths, every named
rejection code, the `bounce` policy-key regression (`skill` still rejects `doing->backlog`),
the `transformBody` seam (applied + omitted), the CLI wiring, and `mintTaskId`'s
well-formedness/non-determinism. Full `lib/test/*.test.mjs` suite: 574/574 green.

Recorded in ADR-0077 (both verb contracts, the rejected "widen `skill`" and "second write" /
"write-source-in-place" alternatives, the mint-new-id decision with its `deriveContext`/
`context-mismatch` hazard, the `rerouted_from` marker, backlog→backlog-only legality, and
ADR-0059 enforcement declarations) and a new §8 on ADR-0028 (re-routing, amending it in
place).

Key files: `lib/task-lifecycle.mjs` (`LEGAL_MOVES.bounce`, `applyTaskMove`'s
`transformBody`, `bounceTask`), `lib/task-lifecycle-capture-dismiss.mjs`
(`mapIdsInField`/`renameIdInField`, `rerouteTask`), `lib/task-lifecycle-cli.mjs` (`bounce`/
`reroute` wiring), `lib/id-grammar.mjs` (`mintTaskToken`/`mintTaskId`).
