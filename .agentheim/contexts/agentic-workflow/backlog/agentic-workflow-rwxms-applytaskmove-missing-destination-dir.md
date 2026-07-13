---
id: agentic-workflow-rwxms
title: applyTaskMove rewrites frontmatter before a rename that ENOENTs on a missing destination folder
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-10
completed:
depends_on: []
blocks: []
tags: [task-lifecycle, atomicity, fail-closed, applyTaskMove, disk-io]
related_adrs: [0038, 0054, 0055]
related_research: []
prior_art: [agentic-workflow-wq7fn, agentic-workflow-dk3vz, agentic-workflow-003]
---

## Why

`agentic-workflow-wq7fn` (ADR-0054) closed the bookkeeping layer's half-applied-state hole with
compute-then-write: every mechanized verb computes its full new `INDEX.md` + `protocol.md`
purely, then calls `applyTaskMove` as "the only disk mutation, last before the two writes."

That invariant holds *around* the mover. It does not hold *inside* it. `applyTaskMove`
(`lib/task-lifecycle.mjs:240-241`) is itself two mutations:

```js
writeFileSync(fromPath, rewritten);   // status flipped, e.g. todo -> doing
renameSync(fromPath, toPath);         // can throw
```

Nothing creates `toPath`'s parent folder first. `folderDir()` only joins a path
(`lib/task-lifecycle.mjs:49-51`), and the only `mkdirSync` calls in the module target
`dirname(protocolPath)` under `knowledge/` — never a lifecycle folder. So when the destination
folder is absent, `renameSync` throws `ENOENT` **after** the source file has already been
rewritten to claim the destination status. The task is left in `todo/` carrying
`status: doing`: a half-applied claim, no bookkeeping written, no structured rejection —
`applyTaskMove` throws rather than returning `{ok:false, ...}`, so the verb's compute-phase
`try` never sees it.

The destination folder is absent routinely, not exceptionally. **Git does not track empty
directories and this repo has no `.gitkeep` files anywhere under `.agentheim/`** (verified:
`find .agentheim -name .gitkeep` → empty). Once a session drains a BC's `doing/`, the folder
stops existing. At current `main` **none of the three BCs has a `doing/` dir on disk** — so
the next `claim` in any of them reproduces this. (Re-verified at refinement, 2026-07-13:
`doing/` still absent in all three BCs.)

The code comment at `lib/task-lifecycle.mjs:229-231` asserts the opposite of what the code does:

> *"If the rename throws, the in-memory rewrite is discarded (we never wrote it to the old
> path), so no partial move escapes."*

Line 240 writes it to the old path. The comment describes the write-to-dest ordering the code
does not implement, which is likely why the hazard was never noticed.

**Why the green suite never caught it.** The fixture builder in
`lib/test/task-lifecycle.test.mjs` scaffolds every lifecycle folder unconditionally —
`const FOLDERS = ['backlog','todo','doing','done']` (L10), then
`for (const f of FOLDERS) mkdirSync(...)` at L19, L297, L318, L428, L515. No test in the suite
has ever run a verb against a missing destination. The bug is invisible to the harness by
construction.

**Field report** (WisdomHeim vault, 2026-07-10 `work` session, tracked there as
`infrastructure-nvrz0`): reproduced twice; worked around by hand with `mkdir -p` before each
claim. Re-confirmed by inspection against `main` on 2026-07-10 and again on 2026-07-13.

## What

Make `applyTaskMove` fail-closed against a missing destination folder, and stop it from
mutating the source file before the operation that can fail.

**The fix shape is pinned — ADR-0055** (refinement, 2026-07-13; the capture's two-candidate
framing is settled). The move step becomes **write-to-destination, then unlink-source**:

1. `mkdirSync(dirname(toPath), {recursive: true})` — a missing destination lifecycle folder is
   **backfilled, never rejected** (ADR-0055 §2: `LIFECYCLE_FOLDERS` is fixed aggregate
   vocabulary; a folder's disk-absence only ever means "currently empty" under git's
   no-empty-dirs behavior, never a domain condition — rejecting would fail-closed a legal move).
2. `writeFileSync(toPath, rewritten)` — the status-rewritten body lands directly at the
   destination, preserved `<id>-<slug>.md` filename.
3. `unlinkSync(fromPath)`.

The source file is only ever read, then unlinked — never rewritten in place. Any failure
before the unlink leaves the source structurally untouched (never written to, mtime intact, so
a retry's `expectedMtimeMs` guard still validates). The residual window — `unlinkSync` throws
after the destination write succeeded — leaves a *duplicate* (both copies individually satisfy
status-matches-folder, self-healing on retry via `resolveSourceOrReject`'s "elsewhere"
reasoning), not a corrupt file, and propagates as an uncaught throw of the same severity as
today's `renameSync` throw. See ADR-0055 for the full residual analysis.

The guard lives inside `applyTaskMove` (one choke point, called by all three verbs plus the
dashboard's `ui` policy), not re-derived per verb — the same principle that motivated
`resolveSourceOrReject` in `agentic-workflow-wq7fn`. `LEGAL_MOVES` (L39-42) exposes the bug to
both policies: `ui` (`backlog->todo`) and `skill` (`backlog->todo`, `todo->doing`,
`doing->done`).

Worker's open (optional) judgment call: wrapping *only* the `writeFileSync(toPath, ...)` step
in a try/catch returning a clean `{ok:false}` (the source is provably untouched at that point)
is an honest, low-cost strengthening — but do **not** extend it to the `unlinkSync`: a
post-write failure cannot honestly be reported as "nothing moved" (ADR-0055 §3).

## Acceptance criteria

- [ ] **Missing destination succeeds, doesn't fail.** A missing destination lifecycle folder
      does not cause `applyTaskMove` to fail: it is created via
      `mkdirSync(dirname(toPath), {recursive:true})` and the move proceeds normally. Test:
      scaffold a BC with the destination folder **absent**, call the mover for a legal move,
      assert `{ok:true}`, the folder now exists, the task file sits at the destination with
      rewritten status, and the origin folder no longer contains it.
- [ ] **Genuine pre-unlink failure leaves the source untouched — structurally, not by luck.**
      Construct a real failure that is *not* folder-absence (e.g. make `toPath`'s parent path
      collide with an existing plain file, so `mkdirSync` itself throws `ENOTDIR`/`EEXIST`
      before any write happens). Assert `applyTaskMove` returns a structured
      `{ok:false, code, reason}` — never an uncaught throw — and that the source file is
      byte-identical and still in its origin folder. Frame the test's comment around the
      structural guarantee (source is read then unlinked, never rewritten in place), not just
      this one branch.
- [ ] **Ordering requirement** (drives the two criteria above; not necessarily its own test):
      the move step writes the rewritten content to `toPath` and only then
      `unlinkSync(fromPath)` — never writes to `fromPath` in place.
- [ ] **Three verbs succeed against a missing destination.** `promoteTask`, `claimBatch`,
      `completeTask` each *succeed* (not merely survive untouched) when their destination
      folder is absent: folder created, task moved, `INDEX.md`/`protocol.md` bookkeeping
      correct exactly as if the folder had pre-existed. One test per verb.
- [ ] **`claimBatch` batch-into-empty-`doing/` fully succeeds:** every id ends up in `doing/`
      with `status: doing`, one manifest, one protocol entry (mkdir is idempotent across the
      per-id move loop). The existing mid-batch-vanish-race test keeps covering the
      genuine-failure path unchanged.
- [ ] **Both misleading comments corrected** — `lib/task-lifecycle.mjs:229-231` ("no partial
      move escapes") *and* `:237-239` ("writing to source first ... keeps a single canonical
      file") — rewritten to describe write-to-destination-then-unlink-source and why: the
      source is read-only accessed until the unlink, so no failure before it can leave the
      source carrying the wrong status; the module deliberately trades momentary
      single-canonical-file-ness for that guarantee.
- [ ] **Fixture builder retained; new tests build the absent-destination variant.** The
      unconditional `for (const f of FOLDERS) mkdirSync(...)` stays for existing tests; the new
      missing-destination tests build fixtures that skip the destination folder, and the
      pre-unlink-failure test builds its own file-blocks-mkdir fixture — pinning the gap rather
      than widening the mask.
- [ ] `node --test lib/test/*.test.mjs` stays green (explicit glob — the bare-directory form
      finds nothing under Node 25 on this box). Existing tests unmodified — verified at
      refinement that none assert the old write-source-then-rename ordering directly (all
      check before/after end-states, never an intermediate disk state), so the reorder is safe.

**Explicitly out of scope** (per ADR-0055 — stated so its absence isn't read as an oversight):
closing the transient two-file window, or making a post-destination-write `unlinkSync` failure
return a clean rejection. That failure propagates as an uncaught throw, same severity as
today's `renameSync` throw — the residual-window class ADR-0054 already accepts. True
multi-file atomicity (tmp-write + rename journal) is a separate, optional future task.

## Notes

- **Same family as `agentic-workflow-wq7fn`, distinct root cause and location.** wq7fn fixed the
  *bookkeeping* layer (compute before the move). This is the *move mechanics* inside
  `applyTaskMove`, which ADR-0054's fix did not touch. wq7fn's own Notes list its accepted
  residual windows as "`applyTaskMove` succeeds then `writeNormalizedFile` throws" — i.e. it
  scoped out failures *after* a successful move. A failure *during* the move, corrupting the
  source, is outside that accepted list and outside ADR-0054's stated invariant.
- **`prior_art: agentic-workflow-003`** is `003-extract-apply-task-move` — the task that
  extracted this mover in the first place.
- **The ADR question is settled — ADR-0055 (accepted, 2026-07-13), written at refinement.** It
  amends ADR-0054's "`applyTaskMove` is the only disk mutation" phrasing (the mover is
  internally two mutations, ordered so the source is never corrupted) without reopening
  ADR-0054's verb-level rulings, ADR-0007's mover boundary, or ADR-0038's Rulings A/B /
  ADR-0042. The worker implements ADR-0055; no new ADR is expected from work-time unless the
  implementation genuinely deviates.
- **BC README touch-up at completion:** the README's Compute-then-write entry (~L615-632)
  inherits ADR-0054's "only disk mutation" elision — add one sentence noting the mover's own
  internal write-then-unlink ordering, citing ADR-0055.
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` — the same
  pointer task that transplanted `agentic-workflow-wq7fn` and `agentic-workflow-dk3vz` here on
  2026-07-09. With this capture that pointer holds no unfiled findings and becomes
  dismiss-ready.
