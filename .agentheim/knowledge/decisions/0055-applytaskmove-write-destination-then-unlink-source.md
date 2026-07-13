---
id: ADR-0055
title: applyTaskMove never mutates its source in place — write-to-destination, then unlink-source; missing destination folders are backfilled, never rejected
scope: agentic-workflow
status: accepted
date: 2026-07-13
related_tasks: [agentic-workflow-rwxms]
related_adrs: [0007, 0038, 0054]
---

# ADR-0055: `applyTaskMove` writes the destination then unlinks the source; a missing destination folder is silently backfilled

## Context

`applyTaskMove` enforces the Task aggregate's defining invariant, *status-matches-folder*:
the frontmatter `status:` and the physical lifecycle folder a task file sits in must always
agree, "never one without the other" (the operation's own doc comment). Its move step
rewrote the SOURCE file in place —

```js
writeFileSync(fromPath, rewritten);   // flips status to the DESTINATION's, still in the OLD folder
renameSync(fromPath, toPath);         // then renames — can throw
```

— then renamed it. Nothing ever created `toPath`'s parent directory, and git does not track
empty directories: once a lifecycle folder (`doing/`, `todo/`) is fully drained, it stops
existing on disk. At the time this was diagnosed, none of the three BCs
(`agentic-workflow`, `infrastructure`, `design-system`) had a `doing/` folder on disk, and
`todo/`/`backlog/` were empty in places too — so the very next `claim` or `promote` in an
affected BC would throw an uncaught `ENOENT` from `renameSync`, **after** the in-place write
had already flipped the source file's `status:` to the destination's. The result: a task file
left in its *original* folder carrying the *destination's* status — a direct
status-matches-folder violation, escaping as an uncaught throw rather than the module's
structured `{ok:false, code, reason}` rejection shape every other guard in this function uses.

The doc comment immediately above this code claimed *"If the rename throws, the in-memory
rewrite is discarded (we never wrote it to the old path), so no partial move escapes."* — false
as written; the write went to the old path first.

ADR-0054 established compute-then-write atomicity for the three verbs (`promoteTask`,
`claimBatch`, `completeTask`) that wrap this mover, stating `applyTaskMove` is "the only disk
mutation, and the last mutation before the two writes." That framing is accurate from the
verbs' perspective but elides that the mover is *itself* internally two mutations — exactly
where this bug lives. This ADR closes that gap.

## Decision

### 1. The move is write-destination-then-unlink-source, never write-source-then-rename

`applyTaskMove`'s move step becomes:

1. `mkdirSync(dirname(toPath), {recursive: true})`
2. `writeFileSync(toPath, rewritten)` — the status-rewritten body is written directly to the
   **destination** path, under the preserved `<id>-<slug>.md` filename.
3. `unlinkSync(fromPath)` — the original file is removed.

The source file is now **only ever read, then unlinked** — never rewritten in place. This is
not a stylistic preference; it is dictated by the aggregate's invariant. Judge each shape by
what its *residual* failure leaves on disk:

- **Write-source-then-rename (the original shape, or "add mkdir and keep the same order"):**
  a residual failure after the in-place write leaves one file that *violates*
  status-matches-folder — still in `from`, but carrying `to`'s status — and that violation is
  **undetectable** by `resolveSourceOrReject`, since the source probe finds the file exactly
  where it expects it, and never inspects its frontmatter.
- **Write-destination-then-unlink (adopted):** a residual failure in the transient window
  (the destination write succeeds, the source unlink then fails) leaves **two** files, each
  individually valid — `to/` carrying `to`'s status, `from/` carrying `from`'s status. Neither
  file violates status-matches-folder. The defect is a *duplicate*, a condition
  `resolveSourceOrReject`'s "elsewhere" branch already reasons about, and it **self-heals**: the
  next call on the same id finds `fromPath` again, overwrites the stale duplicate at `toPath`,
  and unlinks the source, completing the move.

Write-destination-then-unlink strictly dominates: it downgrades every residual failure from
an undetectable invariant violation to a detectable, self-healing duplicate. It also makes the
(previously false) code comment true — no failure before the unlink leaves the source
carrying the wrong status, because the source is never touched until the unlink call. It
additionally avoids a defect the rejected shape would have introduced: rewriting the source in
place bumps its mtime before the operation can fail, so a caller retrying with the
`expectedMtimeMs` precondition from its original read would see a **false**
`stale-precondition` rejection ("modified since read") even though nothing external touched the
file — the mover would have corrupted its own optimistic-concurrency signal. Writing only the
destination leaves the source's mtime untouched, so a retry's optimistic guard still validates
correctly.

**Residual window, accepted, not fixed here:** if `unlinkSync(fromPath)` throws *after*
`writeFileSync(toPath)` already succeeded, something *was* written — that cannot be honestly
represented as `{ok:false}` ("nothing moved," the contract every other rejection in this module
means), so it is left as an uncaught throw, exactly the same failure surface the old
`renameSync` throw had. This is the same class of residual window ADR-0054 already accepts and
scopes out (`applyTaskMove` succeeding then `writeNormalizedFile` throwing); true multi-file
write atomicity (a tmp-write + rename journal) remains a separate, optional future task, not
required for this fix to be correct under the aggregate's invariant.

### 2. A missing destination lifecycle folder is backfilled, never rejected

`LIFECYCLE_FOLDERS` is a fixed four-element enum (`backlog/todo/doing/done`) — Task aggregate
vocabulary, not a per-BC configuration choice. Every BC conceptually has all four stages at all
times; there is no domain concept of "this BC has no doing stage." By the time execution
reaches the move step, both `from` and `to` are already validated against that enum (step 1,
shape validation) and against the legal-move policy (step 2) — so a destination folder's
physical absence can only mean "currently empty" (git does not track empty directories), never
illegitimacy. A structured `{ok:false, code, reason}` here would misrepresent a
non-domain-meaningful, purely incidental condition as one of the module's genuine domain
refusals (`illegal-move`, `stale-precondition`, `not-found`, `blocked-dependency`) — and would
fail-closed a **legal** move (e.g. claiming into a drained `doing/`), which is a worse defect
than the one being fixed. The fix mirrors the existing precedent already in this same module:
each verb hoists `mkdirSync(path.dirname(protocolPath), {recursive: true})` to transparently
backfill the `knowledge/` directory. The lifecycle folder is backfilled the same way, scoped to
exactly the one destination folder (`dirname(toPath) === folderDir(rootDir, context, to)`).

### 3. The mtime precondition and the `{ok:false}` contract boundary are unchanged

The pre-move optimistic mtime guard (reads `statSync(fromPath).mtimeMs` against
`expectedMtimeMs` before any mutation) is untouched by this decision — it still runs against
the untouched source, under the new ordering exactly as under the old one. The returned
`state.mtimeMs` (read via `statSync(toPath).mtimeMs` after the move) is semantically identical
under both shapes: "the mtime of the freshly-written destination content." Neither of these is
reopened.

The module's `{ok:false, code, reason}` shape continues to mean, exclusively, "nothing was
mutated — refetch and retry." It is not extended to cover post-publish failures (the unlink
throw described above): doing so would tell a caller "nothing happened" while an orphan
duplicate sits at the destination, which is a worse lie than an uncaught throw. This keeps the
contract boundary ADR-0054 already established (post-mutation failures propagate as throws, not
rejections) intact one layer deeper, inside the mover itself.

## Scope of what this amends

This ADR **amends** ADR-0054's "`applyTaskMove` is the only disk mutation" phrasing: the mover
is internally two mutations (destination write, source unlink), ordered specifically so the
source is never corrupted. It does not reopen or contradict any of ADR-0054's rulings for the
three wrapping verbs (compute-then-write, the negative-count guard, the extracted
`resolveSourceOrReject`) — those stand unchanged; this ADR operates entirely inside what
ADR-0054 treated as the mover's single atomic step. It does not reopen ADR-0007 (the mover
owns only the move + status rewrite + precondition; INDEX/protocol stay with the skills) or
ADR-0038 (the three-layer boundary, or the fail-closed `depends_on` ruling) — both are
unaffected.

## Consequences

**Positive:** the invariant-violating half-state (source in its original folder carrying the
destination's status) is now structurally unreachable, not merely less likely. The mover's own
doc comment is corrected to describe semantics the code actually implements. The
mtime-bump-on-failed-move defect the rejected shape would have introduced — a false
`stale-precondition` on retry — never arises. Draining a lifecycle folder to zero tasks (the
routine, expected steady state under git's no-empty-dirs behavior) no longer breaks the next
transition into it.

**Negative:** a transient window exists where both the destination and source copies of a task
file are simultaneously present on disk (between the destination write and the source unlink).
An `unlinkSync` failure in that window leaves an orphan duplicate and an uncaught throw,
identical in severity to today's `renameSync` throw, deferred rather than fixed.

**Neutral:** the `changed` manifest contract the three verbs rely on
(`state.fromPath`/`state.path`, ADR-0038, infrastructure-h8k2m) is unaffected — an unlinked
source plus a written destination is, from git's staging perspective, identical to a rename;
`changed: [fromPath, toPath, ...]` still stages both halves correctly.

## Alternatives considered

- **Add `mkdirSync` only, keep write-source-then-rename.** Rejected: removes the routine
  ENOENT trigger but preserves the shape that manufactures an undetectable
  status-matches-folder violation on any other rename failure (a lock, a permissions error);
  additionally bumps the source's mtime before the fallible operation, which would falsely
  reject a legitimate retry as `stale-precondition`.
- **Reject a missing destination folder with a structured `{ok:false}`.** Rejected: a lifecycle
  folder's physical absence carries no domain signal beyond "currently empty" — every BC always
  has all four stages in the aggregate's own vocabulary — so surfacing it as a domain refusal
  would fail-closed a legal move and would misrepresent an infrastructure artifact (git not
  tracking empty directories) as a meaningful rejection code.
- **Wrap the destination write AND the source unlink in one try/catch returning `{ok:false}`
  for both.** Rejected: a failure after the destination write has already mutated disk: telling
  the caller "nothing moved" at that point is a false statement the module's contract does not
  make anywhere else. Only a pre-write failure (e.g., the `mkdirSync` step) is honestly
  representable as "nothing moved"; a post-write failure is left as a throw, matching the
  residual-window class ADR-0054 already accepts.
- **Build full multi-file write atomicity (tmp-write + rename journal) now.** Rejected as
  out of scope: ADR-0054 already parks this as a separate, optional future task; the duplicate
  residual this decision leaves is self-healing on retry, which is sufficient for a
  single-user, single-process tool.

## References

- ADR-0007 — the mover's boundary (move + status rewrite + precondition only); unaffected.
- ADR-0038 — the three-layer bookkeeping boundary and the fail-closed `depends_on` ruling;
  unaffected.
- ADR-0054 — compute-then-write atomicity for the three verbs; amended (not superseded) by this
  ADR's correction of the "only disk mutation" phrasing.
- `agentic-workflow-rwxms` — this task.
