---
id: ADR-0075
title: Lifecycle lock + two mechanics verbs (log, index-add) + scoped-commit — serialize the modeling-side bookkeeping surfaces instead of event-sourcing them
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-pt0gy]
related_adrs: [0026, 0027, 0038, 0039, 0054, 0055, 0059, 0070, 0073, 0074]
---

# ADR-0075: Lifecycle lock + two mechanics verbs (`log`, `index-add`) + `scoped-commit` — serialize the modeling-side bookkeeping surfaces instead of event-sourcing them

## Context

Since `agentic-workflow-e4bjh` (ADR-0073) every capture-side verb — `promoteTask`, `claimBatch`,
`completeTask`, `captureTask`, `dismissTask` — and the two session-end rotations
(`rotateProtocol`, `rotateIndexDoneList`) share one shape: read `INDEX.md`/`protocol.md`,
compute the full new content purely (ADR-0054), write both files. None held a cross-process
precondition on those two files (the task file has `expectedMtimeMs`; INDEX and protocol have
nothing). The builder runs one `work` session but several `modeling` sessions in parallel, and
two sessions capturing at the same moment raced on the file edit itself, the count arithmetic,
and `.git/index.lock`. ADR-0026 §5's scoped-add rule keeps one session from sweeping in
another's files but does nothing about two sessions editing the same hot spot in the same file.
The race is real, not hypothetical: during this task's own refinement (2026-09-06) a sibling
modeling session promoted `agentic-workflow-r7dq3` between one read of the INDEX and the next.

Post-ghcaj (ADR-0074) `main` already has exactly one writer per `.agentheim/` file on the
`work` side (the conductor, sequential by construction); this task is the modeling-side half
of the same invariant, where no single conductor already serializes writes.

## Decision

**Serialize, don't event-source.** The event-per-action / regenerated-read-model shape
(protocol and INDEX as projections of an event directory) is the rework's ReadModel/EventLog
port — a real, considered alternative — and is **deferred, not rejected**: it would remove the
lost-update window structurally rather than merely narrow it, but it is a materially larger,
riskier unit of work (a new persistence shape, a migration of every existing reader) for a race
that a lock closes at a fraction of the cost. This task ships the smaller, reversible fix.

### 1. The lifecycle lock (`lib/lifecycle-lock.mjs`)

One project-wide advisory lock at `.agentheim/state/lifecycle.lock` — already gitignored
(ADR-0027 advisory state) and outside the dashboard frame router's subscriber set (ADR-0070),
so lock churn never re-syncs the board. Per-file locks were rejected: `protocol.md` is shared
by every verb across every BC, so a finer grain buys nothing without a lock-ordering scheme
this scale does not need.

- **Primitive:** `fs.openSync(path, 'wx')` — atomic exclusive-create on POSIX and Windows,
  stdlib only. Contents `{pid, hostname, startedAt}`; no heartbeat (a hold lasts milliseconds).
- **Waiter policy:** a synchronous poll built on `Atomics.wait` (so none of the seven writer
  functions, nor their existing synchronous tests, become `async`), 100ms interval, 10s bound,
  both injectable. On exhaustion: `{ok:false, code:'lock-timeout', reason:'held by pid N since
  T'}`, nothing moved, nothing written.
- **Staleness = dead pid only** (`process.kill(pid, 0)`, copied from `dashboard/runfile.mjs`'s
  `isPidAlive` rather than imported, to avoid a second `lib -> dashboard` import). A live
  holder is never auto-broken by age. Two waiters that both judge a lock stale both retry
  `'wx'`; the primitive resolves the double-reap race — at most one wins.
- **Release** is `unlinkSync` inside `finally`, with a bounded 3×20ms retry for a transient
  Windows `EBUSY`/`EPERM`, and it never throws out of `finally` — an orphan is reaped by the
  next acquirer's dead-pid check, whereas an exception escaping `finally` would clobber the
  verb's own real result.
- **Where acquired — inside each writer function, never at a CLI dispatch layer:**
  `promoteTask`, `claimBatch`, `completeTask` (`lib/task-lifecycle.mjs`); `captureTask` and
  `dismissTask`'s **confirm** phase only, never its zero-write plan phase
  (`lib/task-lifecycle-capture-dismiss.mjs`); `rotateProtocol` (`lib/protocol-rotation.mjs`);
  `rotateIndexDoneList`'s per-BC inner function, **not** `rotateAllIndexDoneLists`'s loop, which
  would double-acquire a non-reentrant lock (`lib/index-rotation.mjs`); plus `log` and
  `index-add` below. `rotateProtocol`/`rotateIndexDoneList` are independent CLI entry points
  `work` bootstraps directly, never through `task-lifecycle-cli.mjs`, so a dispatch-level lock
  would leave them unprotected; wrapping both the dispatch layer and the writer would also
  self-deadlock a non-reentrant lock. `applyTaskMove` stays lock-unaware and unchanged: its only
  production callers are the wrappers above (the dashboard's write path was removed by
  ADR-0017 — grep-confirmed, no bypass exists).
- **Documented fact, not a fix:** `discoverRoot(cwd)` resolves to a worktree's own root when a
  verb runs inside one, so such a verb takes a DIFFERENT lock file than one on `main`. Harmless
  today — only the unlocked `checkpoint` ever runs in a worktree, post-ghcaj.

### 2. Two mechanics verbs on `lib/task-lifecycle-cli.mjs`

Both git-free, both lock-held, both **mechanics verbs, not domain intents** — like
`checkpoint`, they have no Key-event counterpart. `runCli` gained a small per-verb arity table
(`'id'` vs `'opts'`); the six existing verbs' argv shapes are unchanged.

- **`log`** — prepend one protocol entry. Opts `{title, body, message?}`; no `bc` (there is
  exactly one `protocol.md`). Renders `## <timestamp> -- <title>` + blank line + `body` via
  the existing `prependProtocolEntry`, defaulting the header via `readProtocolOrDefault`. The
  timestamp is mechanics (ADR-0038 Ruling B: a hand-typed clock reading is a fabricated
  measurement); every word of `title`/`body` stays judgment. Rejections: `missing-opts`
  (neither title nor body present), `missing-title`, `invalid-title` (newline or leading `#`),
  `missing-body`, `heading-in-body` (a `## ` line in `body`), `separator-in-body` (a bare `---`
  line), `bookkeeping-marker-mismatch`, `lock-timeout`. Manifest `{ok:true,
  changed:[protocolPath], message: string|null, verb:'log', timestamp}` — `message` is echoed
  verbatim or `null`, never synthesized: a mechanics verb never constitutes its own commit.
- **`index-add`** — insert one line at the top of a named marker block. Opts `{bc: string|null,
  section, id, line, message?}`; `bc` must be **present even when `null`** (`null` = the
  top-level `knowledge/index.md`; an omitted key is `missing-bc`, ambiguous between "top-level"
  and "forgot"). `id` is checked to occur in `line` at a word/hyphen boundary
  (`id-not-in-line`, ADR-0012 anchoring precedent — `agentic-workflow-001` never
  false-positives inside `agentic-workflow-0010`) so the dedupe key can never be vacuous.
  Duplicate detection is scoped to the section block only and splits two ways: identical `id`
  + byte-identical `line` → no-op success `{changed:[], skipped:true}`; identical `id` +
  different `line` → `duplicate-id-conflict`. A missing target `INDEX.md` refuses
  `index-missing` — **never** backfills. **Five forbidden sections** (`FORBIDDEN_INDEX_ADD_
  SECTIONS`, exported): `backlog-list`, `todo-list`, `doing-list`, `done-list`, and
  `task-counts` (a bullet inserted above `**Backlog:** N` is invisible to `adjustIndexCount`'s
  label regex and silently corrupts the invariant this task protects) →
  `task-list-section-forbidden`. **Six legal sections**, verified against
  `references/index-template.md` by a live-tree test: `bc-list`, `adr-global`,
  `research-global`, `adr-local`, `research-local`, `concepts`.

### 3. `lib/scoped-commit.mjs` — layer 3, git-aware

ADR-0038's boundary is kept: the lifecycle CLI stays git-free; this is a separate, ASYNC helper
(the one function in this task that is) for the layer that owns git. `runScopedCommit(cwd,
paths, message, opts)`: runs `git add <paths…>` then `git commit -m <message>`, retrying EACH
step independently when git exits non-zero AND stderr matches git's own `Unable to create
'….git/index.lock'` message — backoff 50ms → 800ms cap, doubling, 6 attempts (~2.4s worst
case). It never deletes `index.lock` (a live sibling may hold it), refuses `-A`, `.`, and
glob-looking arguments (`invalid-path`), and returns `{ok:true, sha, attempts}` or
`{ok:false, code:'git-index-lock-exhausted', attempts}` / `{ok:false, code:'git-failed',
reason}`. `modeling` and `quick-capture` call it instead of hand-composing `git add` +
`git commit`.

### 4. Rewired `modeling` and `quick-capture`

`skills/modeling/SKILL.md`: REFINE's and CONSOLIDATE's protocol entries now call `log`
(composing the judgment `title`/`body` text the CLI cannot synthesize); the rare bc-list
insert calls `index-add`; every Committing step calls `scoped-commit`. Two defects fixed while
there: the REFINE-split count-desync rule ("remove the parent line, insert child task lines")
is replaced with "children register through `capture`; the parent's line is left alone —
DISMISS it if superseded"; the dead "if protocol.md doesn't exist, create it with…" header
template is deleted in favour of a pointer (every verb already calls `readProtocolOrDefault`).

`skills/quick-capture/SKILL.md`: Committing calls `scoped-commit`. The cross-BC *Re-routing
after the fact* flow — which hand-edits two BCs' `backlog-list` blocks and both counts, the
largest remaining count-coupled hand-edit — is **not mechanized here** (ADR-0073 already
scoped it out once); this ADR and the skill file both record that disposition explicitly as
"prose-only, unenforced — tracked in `agentic-workflow-qd24q` as the `reroute` verb"
(ADR-0059), so the contradiction with the invariant is a visible decision, never silent.

## Named residuals

Two residuals are recorded here deliberately, so no later reader assumes this ADR closed them:

1. **The lock ends when a verb returns, BEFORE the caller's `git add`.** A sibling's `log` /
   `index-add` landing in that window is swept into the caller's scoped `git add` (no edit is
   ever lost — the file on disk already reflects both writes), but ADR-0026 §5's
   one-commit-one-action is blurred for shared files: one commit can end up carrying two
   sessions' bookkeeping edits to the same file. Not closed by this task.
2. **A single writer's own `INDEX.md`-then-`protocol.md` two-file write is still not atomic
   across the two files.** This is pre-existing (ADR-0054 Neutral) and unchanged by the lock —
   the lock prevents a SECOND writer from interleaving, it does not make one writer's own two
   writes a single transaction. A crash between the two writes still leaves one file updated
   and the other not.

## Out of scope

Tracked in `agentic-workflow-qd24q` (depends on this task): `work`'s remaining hand-writers
(batch-start / session-end / bounce / fail entries, adr-local and backlog-list inserts at
integration, BOUNCE's `doing → backlog` move), `brainstorm`'s hand-writers, `research`'s
hand-writers, and quick-capture's re-route. Two of those are count-coupled and need their own
lifecycle verbs (`bounce`, `reroute`) — neither `log` nor `index-add` may legally touch a task
list.

## Consequences

**Positive:** the modeling-side lost-update window is closed for every mechanized writer;
proven by a `node --test` fixture that spawns two real `capture` calls concurrently and shows
both land (no lost INDEX line, no lost count, no lost protocol entry). The remaining hand-edits
in `modeling`/`quick-capture` now route through a locked, mechanized seam (`log`/`index-add`)
or a retrying `scoped-commit`, closing the git-side half of the same race.

**Negative:** a lock timeout is a new user-visible failure mode (`lock-timeout`) a caller must
handle — in practice this surfaces rarely, since a hold lasts milliseconds. `scoped-commit`
introduces the one async function in this task's otherwise-synchronous module family, a
boundary future readers must respect (nothing upstream of it may assume synchronous callers).

**Neutral:** the ReadModel/EventLog shape remains deferred to the rework's persistence-port
design, not rejected — revisit if the lock's residuals (above) ever prove insufficient in
practice.

## Alternatives considered

- **Event-sourcing** (protocol/INDEX as regenerated projections of an append-only event log) —
  deferred, not rejected: removes the race structurally, but is the rework's ReadModel/EventLog
  port, a materially larger and riskier change than this task's scope.
- **Per-file locks** (one lock per `INDEX.md`, one for `protocol.md`) — rejected: a verb that
  touches both needs a lock-ordering scheme to avoid deadlock, which this scale doesn't
  justify; the project-wide lock sidesteps ordering entirely.
- **Locking at the CLI dispatch layer instead of inside each writer** — rejected: the two
  rotation scripts are independent entry points that never go through
  `task-lifecycle-cli.mjs`, so a dispatch-level lock would leave them unprotected; and locking
  both layers would self-deadlock a non-reentrant lock.

## References

- ADR-0026 — commit doctrine (scoped add, one commit per action) this task's residual #1 blurs
  for shared files.
- ADR-0027 — advisory-write category; `.agentheim/state/` classification the lock file rides.
- ADR-0038 — the three-layer mechanization boundary (mover / git-free CLI / skill judgment+git)
  this task's `log`/`index-add` extend and `scoped-commit` respects.
- ADR-0054 — compute-then-write atomicity; this task's residual #2 is that ADR's Neutral,
  restated as still-open.
- ADR-0055 — `applyTaskMove`'s internal write-destination-then-unlink-source ordering, unchanged
  and lock-unaware.
- ADR-0059 — mechanize-or-drop; the lock, the deny-list, the duplicate split, and the
  scoped-commit refusals ship their own enforcement (this ADR's tests); quick-capture's
  re-route is the one prose-only, unenforced convention this task leaves, recorded as such here
  and in `quick-capture/SKILL.md`.
- ADR-0070 — live-tree hub frame routing; `.agentheim/state/**` has no subscriber, so lock
  churn never re-syncs the dashboard.
- ADR-0073 — capture/dismiss mechanization this task's lock now wraps.
- ADR-0074 — worker branch source-and-tests-only; this task's worker-side compliance (no
  `.agentheim/` write in the worktree) follows that ADR unchanged.
