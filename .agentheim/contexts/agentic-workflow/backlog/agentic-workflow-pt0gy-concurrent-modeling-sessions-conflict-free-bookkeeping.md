---
id: agentic-workflow-pt0gy
title: Concurrent modeling sessions collide on protocol.md, INDEX.md, and the git index — make capture-side bookkeeping conflict-free
status: backlog
type: feature
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-e4bjh]
blocks: [agentic-workflow-qd24q]
tags: [concurrency, bookkeeping, mechanization, rework, lifecycle-cli]
related_adrs: [0026, 0038, 0039, 0054, 0055, 0059, 0070, 0073, 0074]
related_research: [work-session-presence-lock-2026-06-15]
prior_art: [agentic-workflow-k5n8f, agentic-workflow-r2c7m, agentic-workflow-wq7fn, agentic-workflow-e4bjh, agentic-workflow-t7m4c]
---

## Why

The builder runs **one** `work` session but **several `modeling` sessions in parallel**, and
they conflict. Every modeling action prepends to the same line of `protocol.md`, edits the
same `task-counts` block and marker lists in the BC `INDEX.md`, and commits on the same
`main` — so two sessions capturing at the same moment race on the file edit itself, on the
count arithmetic, and on `.git/index.lock`. ADR-0026 §5's scoped-add rule keeps one session
from *sweeping in* another's files, but it does nothing about two sessions editing the same
hot spot in the same file.

Since `agentic-workflow-e4bjh` (ADR-0073) every capture-side verb — `promoteTask`,
`claimBatch`, `completeTask`, `captureTask`, `dismissTask` — and the two session-end rotations
(`rotateProtocol`, `rotateIndexDoneList`) run the same shape: read `INDEX.md`/`protocol.md`,
compute the full new content purely (ADR-0054), write both files. **None holds a cross-process
precondition on those two files** (the task file has `expectedMtimeMs`; INDEX and protocol have
nothing). ADR-0073's Consequences defer exactly this lost-update window to this task. The race
is real, not hypothetical: during this task's own refinement (2026-09-06) a sibling modeling
session promoted `agentic-workflow-r7dq3` between one read of the INDEX and the next.

This is the narrower, evidence-based re-capture of what `agentic-workflow-d5a9b` (dismissed
2026-09-05) gestured at. d5a9b proposed worktree-local backlogs and ticket migration between
worktrees; the actual pain is simpler — the *bookkeeping surfaces* are single-writer files
being written by multiple writers. Post-ghcaj (ADR-0074) `main` already has exactly one
writer per `.agentheim/` file on the `work` side; this task is the modeling-side half of the
same invariant.

## What

**Shape, decided with the builder on 2026-09-06: serialize, don't event-source.** The
event-per-action / regenerated-read-model shape (protocol and INDEX as projections of an
event directory) is the rework's ReadModel/EventLog port and is **deferred, not rejected** —
the worker's ADR records it as such. This task ships the small, reversible fix: a
cross-process advisory lock around every existing writer, two mechanics verbs that give the
remaining hand-edits a locked seam, and a git-side retry so the scoped commit survives a
sibling's `index.lock`. Pressure-tested by an architect + tactical-modeler round on
2026-09-06 (amendments folded in; see Notes).

### 1. The lifecycle lock (`lib/lifecycle-lock.mjs`)

- **One project-wide advisory lock** at `.agentheim/state/lifecycle.lock`. The directory is
  already gitignored (ADR-0027 advisory state) and the dashboard's frame router classifies
  `.agentheim/state/**` as *advisory* with no subscriber registered for this path (ADR-0070),
  so lock churn never re-syncs the board. Per-file locks were rejected: `protocol.md` is
  shared by every verb across every BC, so a finer grain buys nothing without a lock-ordering
  scheme this scale does not need.
- **Primitive:** `fs.openSync(path, 'wx')` — atomic exclusive-create on POSIX and Windows,
  stdlib only (no `flock`, no native addon, no SQLite — vision non-goal 5). Contents
  `{pid, hostname, startedAt}`; no heartbeat, since a hold lasts milliseconds.
- **Waiter policy:** synchronous poll (an `Atomics.wait`-based sleep, so none of the seven
  writer functions nor their existing synchronous tests turn `async`), 100 ms interval,
  10 s bound (injectable for tests). On exhaustion the verb returns
  `{ok:false, code:'lock-timeout', reason:'… held by pid N since T'}` with nothing moved and
  nothing written.
- **Staleness = dead pid only** (`process.kill(pid, 0)` probe — promote
  `dashboard/runfile.mjs`'s `isPidAlive` into `lib/` or copy the eight-line probe with a
  pointer; never add a second `lib → dashboard` import). A live holder is **never**
  auto-broken by age. Two waiters that both judge a lock stale both retry `'wx'`; exactly one
  wins — the primitive itself resolves the double-reap race. Release is `unlinkSync` inside
  `finally`, with a tiny bounded retry (3 × 20 ms) for Windows `EBUSY`/`EPERM`, and it
  **never throws out of `finally`** — an orphaned file is reaped by the next acquirer's
  dead-pid check, whereas an exception escaping `finally` would clobber the verb's real result.
- **Where acquired — inside each writer function, not at a CLI dispatch layer:**
  `promoteTask`, `claimBatch`, `completeTask` (`lib/task-lifecycle.mjs`); `captureTask` and
  `dismissTask`'s **confirm** phase (`lib/task-lifecycle-capture-dismiss.mjs`);
  `rotateProtocol` (`lib/protocol-rotation.mjs`); `rotateIndexDoneList` — the per-BC inner
  function, **not** `rotateAllIndexDoneLists`' loop, which would double-acquire a
  non-reentrant lock (`lib/index-rotation.mjs`); plus the two new verbs below. The rotation
  scripts are independent CLI entry points that `work` bootstraps directly, never through
  `task-lifecycle-cli.mjs`, so a dispatch-level lock would leave them unprotected. Read-only
  calls (`checkpoint`, `dismiss --plan`) stay unlocked — they mutate nothing, and no lock
  survives the human confirmation gap anyway (ADR-0073's `cascade-drifted` /
  `cascade-in-flight` guards already cover that interleave). `applyTaskMove` (ADR-0007 mover)
  stays lock-unaware and unchanged: its only production callers are the three wrappers above
  (the dashboard's write path was removed by ADR-0017 — verified, no bypass exists).
- **Documented fact, not a fix:** `discoverRoot(cwd)` resolves to a worktree's own root when a
  verb runs inside one, so such a verb would take a *different* lock file than one on `main`.
  Harmless today (only the unlocked `checkpoint` ever runs in a worktree post-ghcaj); one
  sentence in the ADR.

### 2. Two mechanics verbs on `lib/task-lifecycle-cli.mjs`

Both git-free, both lock-held, both **mechanics verbs, not domain intents** — like
`checkpoint`, they have no Key-event counterpart, and the README documents them as such so
the verb list does not erode into a dumping ground. `runCli` gains a small per-verb arity
table (these two take opts only, no positional id); the six existing verbs are untouched.

- **`log`** — prepend one protocol entry. Opts `{title, body, message?}`; no `bc` (there is
  exactly one `protocol.md`). The CLI renders `## <formatProtocolTimestamp(now)> -- <title>`
  + blank line + `body` through the existing `prependProtocolEntry`, defaulting the header via
  `readProtocolOrDefault`. The split matters: the timestamp is mechanics — an LLM hand-typing a
  heading clock reading is fabricating a measurement, the class ADR-0038 Ruling B reserves for
  the CLI — while every word of `title`/`body` stays judgment. Rejections: `missing-opts`,
  `missing-title`, `invalid-title` (newline or leading `#`), `missing-body`,
  `heading-in-body` (a `## ` line), `separator-in-body` (a bare `---` line would split the
  entry stream), `bookkeeping-marker-mismatch`, `lock-timeout`. Manifest
  `{ok:true, changed:[protocolPath], message: string|null, verb:'log', timestamp}` — `message`
  is echoed verbatim or `null`, **never synthesized**: a mechanics verb never constitutes its
  own commit; the caller folds `changed` into a commit whose message it already owns.
  `captureTask`'s `protocolEntry:false` stays as is, re-described in its doc comment as "the
  caller will `log` its own entry covering these captures" — the flag and `log` are
  complements (brainstorm's N captures / one narrative entry), not alternatives.
- **`index-add`** — insert one line at the top of a named marker block. Opts
  `{bc: string|null, section, id, line, message?}`; `bc` must be **present even when `null`**
  (`null` = the top-level `knowledge/index.md`; an omitted key is ambiguous between
  "top-level" and "forgot" → `missing-bc`). `id` is supplied beside `line` and the CLI checks
  it occurs in `line` (`id-not-in-line`) so the dedupe key can never be vacuous. Duplicate
  detection is a word-and-hyphen-boundary match inside the section block only (so
  `agentic-workflow-001` never false-positives inside `agentic-workflow-0010`; the ADR-0012
  anchoring precedent) and splits two ways: identical `id` + byte-identical `line` → no-op
  success `{changed:[], skipped:true}` (crash-retry idempotency, the `completeTask` posture);
  identical `id` + different `line` → refuse `duplicate-id-conflict`. A missing target
  `INDEX.md` refuses `index-missing` — **never** backfills (an `adr-local` insert has no
  "BC holds nothing but this file" check; seeding zero counts over a live BC would desync it).
  **Forbidden sections — five:** `backlog-list`, `todo-list`, `doing-list`, `done-list`
  **and `task-counts`** (a nameable marker block; a bullet inserted above `**Backlog:** N` is
  invisible to `adjustIndexCount`'s label regex and silently corrupts the invariant this task
  protects) → `task-list-section-forbidden`. Legal surface, verified against
  `references/index-template.md` and the three live indexes: `bc-list`, `adr-global`,
  `research-global`, `adr-local`, `research-local`, `concepts`. The deny-list ships as a
  live-tree test asserting it covers every marker in the template's task-status region.

### 3. `lib/scoped-commit.mjs` — layer 3, git-aware

ADR-0038's boundary is kept: the lifecycle CLI stays git-free; this is a separate helper for
the layer that owns git. Async `runScopedCommit(cwd, paths, message, opts)`: runs
`git add <paths…>` then `git commit -m <message>`, retrying **each** step independently when
git exits non-zero **and** stderr matches `Unable to create '….git/index.lock'` — backoff
50 ms → 800 ms cap, ×2, 6 attempts (~2.4 s worst case). It **never deletes** `index.lock`
(a live sibling may hold it), refuses `-A`, `.`, and glob arguments (`invalid-path`), and
returns `{ok:true, sha, attempts}` or `{ok:false, code:'git-index-lock-exhausted', attempts}`
/ `{ok:false, code:'git-failed', reason}`. Runnable through the same env-free
homedir→cache→semver-max bootstrap the skills already use (`references/lib-bootstrap.md`).
`modeling` and `quick-capture` call it instead of hand-composing `git add` + `git commit`.

### 4. Rewire `modeling` and `quick-capture` (the sessions that actually run in parallel)

- `skills/modeling/SKILL.md`: the REFINE and CONSOLIDATE protocol entries call `log`; the
  rare bc-list insert calls `index-add`; every Committing step calls `scoped-commit`. Two
  defects fixed while there: the "REFINE that splits a task: remove the parent line, insert
  child task lines, update counts" rule under *Updating indexes* desyncs count from folder
  (the parent file still sits in `backlog/`) — children register through `capture`
  (line + count together) and the parent's line is left alone (DISMISS it if superseded);
  and the *Protocol logging* section's "if `protocol.md` doesn't exist, create it with…"
  header template is dead once every writer routes through a verb that already calls
  `readProtocolOrDefault` — delete it in favour of a pointer (ADR-0068 drift-twice posture).
- `skills/quick-capture/SKILL.md`: Committing calls `scoped-commit`. Its cross-BC
  *Re-routing after the fact* flow hand-edits **two** BCs' `backlog-list` blocks and both
  counts — the largest remaining count-coupled hand-edit. It is **not** mechanized here
  (ADR-0073 already scoped it out once); this task records that disposition explicitly as
  "prose-only, unenforced — tracked in `agentic-workflow-qd24q` as the `reroute` verb"
  (ADR-0059), so the contradiction with the invariant is a visible decision, never silent.

### 5. Out of scope — tracked in `agentic-workflow-qd24q` (depends on this task)

The remaining hand-writers are `work` (batch-start / session-end / bounce / fail entries,
adr-local and backlog-list inserts at integration, BOUNCE's `doing → backlog` move),
`brainstorm` (session entry, bc-list / adr-global inserts), `research` (research-list inserts,
post-review entry), and quick-capture's re-route. Two of those are **count-coupled** and need
their own lifecycle verbs (`bounce`, `reroute`) — neither `log` nor `index-add` may legally
touch a task list. Until qd24q lands, AC 5's "one class of writer per file" is true for the
modeling side only; the README entry says so.

## Acceptance criteria

- [ ] `lib/lifecycle-lock.mjs` exists; the lock is acquired inside `promoteTask`, `claimBatch`, `completeTask`, `captureTask`, `dismissTask` (confirm phase only), `rotateProtocol`, `rotateIndexDoneList`, `log`, and `index-add` — and nowhere at a CLI dispatch layer. Proven by a `node --test` fixture that `child_process.spawn`s two real `capture` calls into one BC of one temp project concurrently: both exit 0 with `{ok:true}`, the INDEX `backlog-list` block contains both ids, the `**Backlog:**` count equals `readdirSync(backlogDir).length` (the literal lost-update assertion — unlocked, this reads 1), and `protocol.md`'s `## ` heading count rose by exactly 2 (a heading count, not `.includes(id)`, which a clobbered write can still satisfy).
- [ ] A lock file naming a dead pid (a spawned-and-exited child's) is reaped: the next verb proceeds well under the timeout and the file afterwards names the caller's own pid. A lock held by a live pid makes a concurrent verb **wait, not fail** (test holds it ~300 ms from the test process; the verb resolves `{ok:true}` after ≥250 ms); with an injected short timeout, exhaustion returns `{ok:false, code:'lock-timeout', reason}` naming the holder, and nothing was moved or written.
- [ ] `log` and `index-add` are wired into `lib/task-lifecycle-cli.mjs` (opts-only arity; the six existing verbs' argv shapes unchanged) and covered for every rejection code named in What §2, the two-way duplicate split (`skipped:true` vs `duplicate-id-conflict`), `index-missing` without backfill, `message: null` when omitted, `bc: null` targeting `knowledge/index.md`, and `task-list-section-forbidden` for **all five** forbidden sections including `task-counts`; a live-tree test asserts the deny-list covers every marker section in `references/index-template.md`'s task-status region.
- [ ] `lib/scoped-commit.mjs` exists, refuses `-A` / `.` / globs, retries `add` and `commit` independently on `index.lock` contention with the bounded backoff, never deletes the lock, and is covered in the `git-facts-*` temp-repo harness shape (`test.skip` when `git` is absent): a pre-created `index.lock` removed by a timer → `{ok:true, attempts > 1}`; one never removed → `{ok:false, code:'git-index-lock-exhausted', attempts: 6}`.
- [ ] The full `lib/test/*.test.mjs` suite is green under `node --test` on the merged tree (runner verdict, ADR-0062); no existing writer function or test became `async`.
- [ ] `skills/modeling/SKILL.md` (REFINE + CONSOLIDATE entries → `log`; bc-list → `index-add`; every Committing step → `scoped-commit`; the REFINE-split count defect fixed; the dead protocol-header template deleted for a pointer) and `skills/quick-capture/SKILL.md` (Committing → `scoped-commit`; the re-route flow carries the explicit ADR-0059 prose-only disposition pointing at `agentic-workflow-qd24q`) contain no remaining hand-composed `git add`/`git commit` or hand-prepended protocol entry. [human-eye]
- [ ] The worker's ADR (number via `lib/adr-allocation.mjs`, ADR-0058) records: the lock (path, primitive, staleness, placement inside the seven writers, the worktree-root fact), both verb contracts (five forbidden / six legal sections, the duplicate split, `message: string|null`), `scoped-commit`; the ReadModel/EventLog deferral; and **two named residuals** — the lock ends when a verb returns, *before* the caller's `git add`, so a sibling's `log`/`index-add` landing in that window is swept into the caller's scoped add (no edit is ever lost; ADR-0026 §5's one-commit-one-action is blurred for shared files), and a single writer's own INDEX-then-protocol two-file write is still not atomic across the two files (pre-existing, ADR-0054 Neutral). `related_adrs` here and `related_tasks` there are backlinked. [human-eye]
- [ ] The agentic-workflow README's *Commit doctrine* entry states the post-pt0gy git model — the lifecycle lock, the two mechanics verbs, `scoped-commit` — and names BOUNCE's move and quick-capture's re-route as the two still-open count-coupled gaps tracked in `agentic-workflow-qd24q`; the lib inventory gains `lifecycle-lock` / `scoped-commit` / `log` + `index-add` entries beside `captureTask` / `dismissTask`, documenting the latter two as mechanics verbs. [human-eye]
- [ ] ADR-0059 mechanize-or-drop: the lock placement, the five-section deny-list, the duplicate split, and the scoped-commit refusals ship with their enforcement in the tests above; the one prose-only convention this task leaves (quick-capture's re-route) is recorded as such in the ADR and in `quick-capture/SKILL.md` itself.

## Notes

**Builder decisions (2026-09-06, this refinement):** (1) serialize with a lock rather than
event-source — the event/read-model shape is the rework's ReadModel port and lands there;
(2) split the remaining hand-writers into `agentic-workflow-qd24q` rather than sweep five
skills in one task (the ghcaj lesson: unbounded doctrine sweeps do not converge under the
verifier loop); (3) a small layer-3 `scoped-commit.mjs` over a prose-only retry rule.

**Amendments from the 2026-09-06 orchestrator round** (architect + tactical-modeler, no
conflicts between them):
- Lock inside the seven writer functions, never (additionally) at `runCli` — rotation scripts
  are separate entry points; a dispatch-only lock leaves them unprotected, and wrapping both
  layers self-deadlocks a non-reentrant lock.
- `applyTaskMove` stays outside the lock: the "dashboard legacy caller" premise in the
  original capture is stale (ADR-0017 removed `POST /api/task/move`; grep confirms no
  `dashboard/*.mjs` import).
- `log` takes `{title, body}`, not an opaque entry body — the timestamp is mechanics.
- `index-add` forbids **five** sections (`task-counts` was the one a four-section list misses),
  splits duplicates two ways, and never backfills.
- Three count-coupled hand-writes no verb here may touch: BOUNCE's `doing → backlog`
  (needs a `bounce` verb), quick-capture's re-route (needs `reroute`), and backlog-item
  materialization at PASS/SKIP integration (needs no new verb — wire the existing
  `captureTask` after `materializeTaskFile`). All three go to qd24q.
- The git-window residual and the two-file non-atomicity residual are named in the ADR so
  no later reader assumes pt0gy solved them.

**Test-fixture note:** the concurrency proof cannot run in-process (one interpreter would pass
with no lock at all) — spawn the CLI via `process.execPath` against a `mkdtempSync` project
(extend `makeProject` from `lib/test/task-lifecycle.test.mjs` as e4bjh did). Windows note:
`.agentheim/contexts/*/INDEX.md` are CRLF on this checkout; the lib's normalize/denormalize
already handles it, and the new `index-add` must go through the same helpers.

**Original open questions (2026-09-05) and their answers:** the dashboard reads neither the
generated protocol nor INDEX counts structurally (`dashboard/tree.mjs` projects lifecycle
folders; both files are only rendered as documents) — moot under the lock shape;
`rotateProtocol` rotates the same live file, now under the lock; `whats-next` reads the top
~100 lines of `protocol.md` unchanged; `quick-capture` runs through `capture` (already
mechanized) and gains `scoped-commit` — it is covered.

Captured via `modeling` on 2026-09-05, same conversation as `agentic-workflow-ghcaj`; refined
2026-09-06.
