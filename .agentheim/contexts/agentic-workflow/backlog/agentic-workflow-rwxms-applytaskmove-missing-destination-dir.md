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
related_adrs: [0038, 0054]
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
the next `claim` in any of them reproduces this. A fresh clone is worse: `backlog/` and
`todo/` are empty in all three BCs today, so even `promote` is exposed.

The code comment at `lib/task-lifecycle.mjs:229-231` asserts the opposite of what the code does:

> *"If the rename throws, the in-memory rewrite is discarded (we never wrote it to the old
> path), so no partial move escapes."*

Line 240 writes it to the old path. The comment describes the write-to-dest ordering the code
does not implement, which is likely why the hazard was never noticed.

**Why 204 green tests never caught it.** The fixture builder in
`lib/test/task-lifecycle.test.mjs` scaffolds every lifecycle folder unconditionally —
`const FOLDERS = ['backlog','todo','doing','done']` (L10), then
`for (const f of FOLDERS) mkdirSync(...)` at L19, L297, L318, L428, L515. No test in the suite
has ever run a verb against a missing destination. The bug is invisible to the harness by
construction.

**Field report** (WisdomHeim vault, 2026-07-10 `work` session, tracked there as
`infrastructure-nvrz0`): reproduced twice; worked around by hand with `mkdir -p` before each
claim. Re-confirmed by inspection against `main` on 2026-07-10.

## What

Make `applyTaskMove` fail-closed against a missing destination folder, and stop it from
mutating the source file before the operation that can fail.

Two candidate shapes — the fix-shape choice is deliberately left to work-time, since it is a
real design call and the ADR-0054 ordering rule bears on it:

1. **`mkdirSync(dirname(toPath), {recursive: true})` before the write.** Smallest diff,
   mirrors the `mkdirSync(dirname(protocolPath))` already in each verb. Removes the ENOENT
   cause but leaves the write-then-rename ordering (still exposed to EPERM/ENOSPC on rename).
2. **Write to `toPath`, then `unlink(fromPath)`.** Makes the rewrite land at the destination,
   so a failure leaves the source untouched and byte-identical — matching what the L229-231
   comment already claims. Needs the destination dir created regardless, and a decision about
   the transient two-file window.

Either way, the guard belongs inside `applyTaskMove` (one choke point, called by all three
verbs plus the dashboard's `ui` policy), not re-derived per verb — the same principle that
motivated `resolveSourceOrReject` in `agentic-workflow-wq7fn`.

Note `LEGAL_MOVES` (L39-42) exposes this to both policies: `ui` (`backlog->todo`) and `skill`
(`backlog->todo`, `todo->doing`, `doing->done`).

## Acceptance criteria

- [ ] `applyTaskMove` never leaves the source task file mutated when the move fails. A test
      scaffolds a BC with the destination folder **absent**, calls the mover, and asserts the
      source file is still in its origin folder and **byte-identical** (`status:` unchanged).
- [ ] A missing destination folder does not throw out of `applyTaskMove`. It either succeeds
      (folder created) or returns a structured `{ok:false, code, reason}` consistent with the
      module's existing rejection shape — never an uncaught `ENOENT`.
- [ ] The three mechanized verbs (`promoteTask`, `claimBatch`, `completeTask`) survive a missing
      destination folder with the tree untouched: task file in its origin folder, `INDEX.md` and
      `protocol.md` byte-identical. One test per verb.
- [ ] `claimBatch` specifically: a batch claimed into a BC with no `doing/` dir either fully
      succeeds or rejects with nothing moved — no id is left in `todo/` carrying
      `status: doing`.
- [ ] The misleading comment at `lib/task-lifecycle.mjs:229-231` is corrected to describe the
      implemented ordering (or deleted, if shape 2 makes it true).
- [ ] The test fixture's unconditional `for (const f of FOLDERS) mkdirSync(...)` is *kept* for
      existing tests, but the new tests build their fixture without the destination folder —
      pinning the gap rather than widening the mask.
- [ ] `node --test lib/test/*.test.mjs` stays green (explicit glob — the bare-directory form
      finds nothing under Node 25 on this box). Existing 204 tests unmodified.

## Notes

- **Same family as `agentic-workflow-wq7fn`, distinct root cause and location.** wq7fn fixed the
  *bookkeeping* layer (compute before the move). This is the *move mechanics* inside
  `applyTaskMove`, which ADR-0054's fix did not touch. wq7fn's own Notes list its accepted
  residual windows as "`applyTaskMove` succeeds then `writeNormalizedFile` throws" — i.e. it
  scoped out failures *after* a successful move. A failure *during* the move, corrupting the
  source, is outside that accepted list and outside ADR-0054's stated invariant.
- **`prior_art: agentic-workflow-003`** is `003-extract-apply-task-move` — the task that
  extracted this mover in the first place.
- **Does not reopen ADR-0038 Rulings A/B or ADR-0042.** Whether it amends ADR-0054's
  "`applyTaskMove` is the only disk mutation" phrasing (it is two) is a work-time call; if the
  fix lands shape 2, an ADR amendment noting the mover's internal ordering may be warranted.
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` — the same
  pointer task that transplanted `agentic-workflow-wq7fn` and `agentic-workflow-dk3vz` here on
  2026-07-09. With this capture that pointer holds no unfiled findings and becomes
  dismiss-ready.
