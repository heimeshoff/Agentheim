---
id: infrastructure-5w5gs
title: task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation
status: done
type: bug
context: infrastructure
created: 2026-07-03
completed: 2026-07-04
depends_on: []
blocks: []
tags: [task-lifecycle, cli, crlf, line-endings, windows, promote, claim, complete, bookkeeping, atomicity, adr-0038]
related_adrs: [0038, 0032, 0039]
related_research: []
prior_art: []
---

## Why

`lib/task-lifecycle.mjs`'s bookkeeping helpers assume `\n` (LF) line endings when
they edit `INDEX.md` and `protocol.md`. On Windows those files are routinely
**CRLF** (`\r\n`) — git's `core.autocrlf`, most editors, and the `.agentheim` files
in real consumer repos all produce CRLF. When the bookkeeping runs against a CRLF
repo, its marker regexes and `indexOf` lookups silently fail to match, and the
operation throws **after** the task file has already been moved — leaving the board
in a half-transitioned state a human then has to reconcile by hand.

Two independent sightings prove it's the whole mechanized lifecycle, not one verb:

- **`claim` (what actually broke a live session, 2026-07-03 18:09):** `claimBatch`'s
  `removeIndexLine('todo-list', …)` couldn't match this Windows checkout's CRLF
  `INDEX.md`/`protocol.md` markers; the batch-start claim threw after moving files.
  Worked around only by LF-normalizing the two files in the working tree by hand.
- **`promote` (the original capture):** running `/agentheim:modeling promote
  design-system-pv3mq` in the Mediatheca project. `applyTaskMove` renamed the task
  `backlog/ → todo/` and rewrote its frontmatter `status`, then `promoteTask` threw
  `INDEX.md is missing the backlog-list markers.` — even though the markers were
  present. The markers were `<!-- backlog-list:start -->\r\n`; the regex wanted
  `-->\n`. The file was moved but INDEX counts, the INDEX list lines, the protocol
  entry, and the commit were all left undone.

The CLI is the *mechanized* path (ADR-0038) precisely so this bookkeeping is atomic
and hand-free — on CRLF repos it delivers the opposite.

## What

Make `lib/task-lifecycle.mjs`'s file-editing helpers **line-ending-agnostic**, so
every `applyTaskMove`-driven lifecycle verb — **`promoteTask`, `claimBatch`, and
`completeTask`** — succeeds identically on LF and CRLF repos and leaves no partial
state. The fix belongs at the **three shared helpers** all three verbs call, not in
any one verb.

The three LF-assuming spots (verified in the current `lib/task-lifecycle.mjs`) —
each shared by promote **and** claim **and** complete:
- `removeIndexLine` (`lib/task-lifecycle.mjs:299`) — regex
  `(<!-- ${section}:start -->\n)([\s\S]*?)(<!-- ${section}:end -->)` (the `\n` after
  the start marker never matches `\r\n`), plus `.split('\n')` / `.join('\n')` which
  would re-emit LF into an otherwise-CRLF file.
- `insertIndexLineAtTop` (`:311`) — `marker = '<!-- ${section}:start -->\n'` used
  with `indexOf`; returns `-1` on CRLF → "missing start marker". Also **inserts**
  `line + '\n'` — freshly-`\n`-built content that becomes a mixed ending inside a
  CRLF file.
- `prependProtocolEntry` (`:338`) — `marker = '\n---\n\n'` used with `indexOf`; on
  CRLF the header separator is `\r\n---\r\n\r\n`, so it never matches → "missing the
  header's `---` separator". Also **inserts** an `entryBody\n\n---\n\n` block built
  entirely with LF.
- `adjustIndexCount` (`:320`, regex `(\*\*${label}:\*\* )(\d+)`) is already
  EOL-independent — leave it, but it must not be the reason mixed endings get
  written.

**Preferred approach — normalize on the boundary, not sprinkle `\r?\n` everywhere.**
On read, detect the file's dominant EOL (and a leading UTF-8 BOM — Mediatheca's
`INDEX.md` carries one; agentheim's does not) and strip both to a canonical `\n`
in-memory form; run all existing regex/`indexOf` logic unchanged against that; on
write, restore the original EOL and BOM. A single read/write wrapper pair keeps the
edit functions simple and guarantees the file's ending style is preserved rather
than half-converted — critically, it converts the **freshly-inserted** todo/doing/
done line and protocol entry to the file's EOL too, which a `\r?\n`-in-each-regex
patch would leave as LF (→ mixed endings). Detect **dominant** EOL, not first-EOL,
so an already-mixed file (a prior half-broken run's residue) restores cleanly.

**In-repo precedent — mirror it, don't re-invent.** `lib/index-rotation.mjs` and
`lib/protocol-rotation.mjs` are **already CRLF-safe** (index-rotation names this bug
explicitly): their marker regexes tolerate `\r?\n` and they relocate lines
verbatim. But they only *relocate* existing bytes — they never *insert* new
`\n`-built content the way these three helpers do, which is exactly why marker-regex
tolerance alone was enough for rotation but is **not** enough here. **The two
rotation modules are already correct and out of scope — do not re-touch them.**

**Atomicity — fail closed, nothing moved (folded in, builder-confirmed).** Even with
the EOL fix, the move half of each verb has no rollback, so any *future* marker
mismatch would still strand the board. Guard the bookkeeping behind a **dry
validation** — confirm every marker this verb will edit is matchable — that runs
**before** `applyTaskMove` performs the move. On any mismatch, reject with a
structured error and **nothing moved**, matching the module's existing fail-loud
posture (`reject(code, reason)`). Applies to all three verbs.

## Acceptance criteria

- [x] `promoteTask` completes fully against a CRLF `INDEX.md` + CRLF `protocol.md`:
      file moved, both INDEX list markers updated, both counts adjusted, protocol
      entry prepended, manifest returned — no throw, no partial state.
- [x] `claimBatch` and `completeTask` do the same against CRLF fixtures — including
      `claimBatch`'s **per-BC** INDEX edits (a batch may span BCs, each file with its
      own EOL) and `completeTask`'s idempotent already-in-`done/` path. (Claim is the
      verb that broke live; it must be covered end-to-end, not by inference.)
- [x] The same holds against LF files (no regression) and against a BOM-prefixed
      `INDEX.md` (BOM preserved on write, not doubled or dropped).
- [x] Written files keep their original line-ending style — a CRLF file stays CRLF
      (no mixed `\n`/`\r\n` lines introduced by `split/join` or by the freshly
      inserted list line / protocol entry), an LF file stays LF; an already-mixed
      file normalizes to its dominant EOL.
- [x] **Fail-closed atomicity:** each verb dry-validates that every marker it will
      edit is matchable *before* `applyTaskMove` moves the file; on any mismatch it
      rejects (structured `{ok:false, code, reason}`) with the task file **not**
      moved and no INDEX/protocol write. A test asserts a deliberately marker-broken
      `INDEX.md` leaves the task in its source folder.
- [x] New unit tests in `lib/test/` cover the CRLF (and BOM, and mixed-EOL) cases for
      `removeIndexLine`, `insertIndexLineAtTop`, `prependProtocolEntry`, plus
      end-to-end CRLF `promoteTask` / `claimBatch` / `completeTask` on fixtures, and
      the fail-closed guard. Existing LF tests still pass.

## Notes

- Discovered live on 2026-07-03 while promoting `design-system-pv3mq` in the
  Mediatheca consumer repo; re-confirmed the same day when it broke a `work` batch's
  `claimBatch` in *this* repo (protocol 2026-07-03 18:09). Both were reconciled by
  hand; this task fixes the tool so the manual reconciliation isn't needed again.
- Thematically adjacent cross-platform-text robustness already shipped in this BC:
  `infrastructure-020` (POSIX escaping breaking the Windows shell) and
  `infrastructure-q8m4t` (quotation marks in prompts). Same family of "the tooling
  assumed a POSIX/LF world" — worth a glance for the testing pattern, not a
  dependency.
- `applyTaskMove` itself is **already** EOL-safe: its `rewriteStatus`
  (`/^status:.*$/m`) and `parseDependsOn` regexes use `$`/`m`, which stop at `\r`,
  and it only rewrites the status line and renames the file. So AC #5's fail-closed
  guard and the EOL fix both live in the **bookkeeping layer** (the three helpers and
  their three callers), not in the mover — do not touch `applyTaskMove`'s logic
  beyond what the guard needs to read.
- Irony worth noting for whoever works this: agentheim's own
  `contexts/infrastructure/INDEX.md` is CRLF right now, so the mechanized promote of
  *this very task* had to LF-normalize it first (a git no-op under `autocrlf`). The
  fix removes that dance permanently.

## Outcome

Implemented the preferred boundary-normalization design in
`lib/task-lifecycle.mjs`: a new EOL/BOM block (`detectDominantEol`,
`normalizeText`, `denormalizeText`, `readNormalizedFile`, `writeNormalizedFile`,
`readProtocolOrDefault`) reads `INDEX.md`/`protocol.md` once, strips a leading
UTF-8 BOM if present, detects the file's *dominant* EOL (majority `\r\n` vs lone
`\n`, so an already-mixed file — the residue of a prior half-broken run —
normalizes cleanly rather than staying mixed), and canonicalizes to `\n` before
handing content to the unchanged `removeIndexLine`/`insertIndexLineAtTop`/
`prependProtocolEntry` marker logic. Writes restore the original EOL/BOM,
converting the freshly-inserted list line / protocol entry to the file's style
too (the mixed-ending failure mode a bare `\r?\n`-in-each-regex patch would have
left behind).

Added a fail-closed atomicity guard (`validateBookkeepingMarkers` +
`hasSectionBlock`/`hasSectionStartMarker`/`hasProtocolMarker`) that every one of
`promoteTask`, `claimBatch`, `completeTask` runs *before* calling
`applyTaskMove`: it dry-validates every INDEX/protocol marker the verb is about
to edit and rejects with a structured `{ok:false, code:'bookkeeping-marker-mismatch', reason}`
on any mismatch, moving nothing. `claimBatch` validates every BC's `INDEX.md` in
the batch (a batch may span BCs, each file with its own EOL) before moving any
task. `lib/index-rotation.mjs`/`lib/protocol-rotation.mjs` were left untouched —
already CRLF-safe per the task's own note — as was `applyTaskMove`'s own logic.

Added `lib/test/task-lifecycle-eol.test.mjs` (19 new tests): unit-level
round-trips of `detectDominantEol`/`normalizeText`/`denormalizeText` and of
`removeIndexLine`/`insertIndexLineAtTop`/`prependProtocolEntry` against CRLF,
BOM+CRLF, and already-mixed-EOL fixtures; end-to-end CRLF `promoteTask` /
`claimBatch` (single-BC and two-BC-spanning) / `completeTask` (incl. the
idempotent already-in-`done/` path); a BOM-preservation test; and a
fail-closed-guard test per verb (deliberately marker-broken CRLF `INDEX.md`
leaves the task file in its source folder, no INDEX/protocol write). Full suite:
`node --test "lib/test/*.test.mjs"` → 161/161 passing (48 pre-existing
task-lifecycle + cli tests unchanged, no regression).

Files: `lib/task-lifecycle.mjs`, `lib/test/task-lifecycle-eol.test.mjs`.
