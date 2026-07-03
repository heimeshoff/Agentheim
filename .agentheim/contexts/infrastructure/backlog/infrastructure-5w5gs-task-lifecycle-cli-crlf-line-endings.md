---
id: infrastructure-5w5gs
title: task-lifecycle CLI breaks on CRLF-line-ending .agentheim files — promote/move bookkeeping fails mid-operation
status: backlog
type: bug
context: infrastructure
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [task-lifecycle, cli, crlf, line-endings, windows, promote, bookkeeping, adr-0038]
related_adrs: [0038]
related_research: []
prior_art: []
---

## Why

`lib/task-lifecycle.mjs` assumes `\n` (LF) line endings when it edits `INDEX.md`
and `protocol.md`. On Windows those files are routinely **CRLF** (`\r\n`) — git's
`core.autocrlf`, most editors, and the `.agentheim` files in real consumer repos
all produce CRLF. When the CLI runs against a CRLF repo, its marker regexes and
`indexOf` lookups silently fail to match, and the operation throws **after** the
file has already been moved — leaving the board in a half-promoted state that a
human then has to reconcile by hand.

This actually happened: running `/agentheim:modeling promote design-system-pv3mq`
in the Mediatheca project. `applyTaskMove` renamed the task `backlog/ → todo/` and
rewrote its frontmatter `status`, then `promote()` threw
`INDEX.md is missing the backlog-list markers.` — even though the markers were
present. The markers were `<!-- backlog-list:start -->\r\n`; the regex wanted
`-->\n`. The file was moved but INDEX counts, the INDEX list lines, the protocol
entry, and the commit were all left undone. The promote had to be finished
manually. The CLI is the *mechanized* path (ADR-0038) precisely so this bookkeeping
is atomic and hand-free — on CRLF repos it delivers the opposite.

## What

Make `lib/task-lifecycle.mjs`'s file-editing functions line-ending-agnostic, so a
promote (and any future `applyTaskMove`-driven lifecycle move that touches these
files) succeeds identically on LF and CRLF repos, and leaves no partial state.

The three LF-assuming spots (verified in the current `lib/task-lifecycle.mjs`):
- `removeIndexLine` — regex `(<!-- ${section}:start -->\n)([\s\S]*?)(<!-- ${section}:end -->)`
  (the `\n` after the start marker never matches `\r\n`), plus `.split('\n')` /
  `.join('\n')` which would re-emit LF into an otherwise-CRLF file.
- `insertIndexLineAtTop` — `marker = '<!-- ${section}:start -->\n'` used with
  `indexOf`; returns `-1` on CRLF → "missing start marker".
- `prependProtocolEntry` — `marker = '\n---\n\n'` used with `indexOf`; on CRLF the
  header separator is `\r\n---\r\n\r\n`, so it never matches → "missing the header's
  `---` separator". (This one would have thrown *next*, after the INDEX edit, on the
  same promote.)
- `adjustIndexCount` (regex `(\*\*${label}:\*\* )(\d+)`) is already EOL-independent —
  leave it, but it must not be the reason mixed endings get written.

**Preferred approach:** normalize on the boundary, not sprinkle `\r?\n` everywhere.
On read, detect the file's dominant EOL (and a leading UTF-8 BOM — Mediatheca's
`INDEX.md` carries one; agentheim's does not) and strip both to a canonical `\n`
in-memory form; run all existing regex/`indexOf` logic unchanged against that; on
write, restore the original EOL and BOM. A single read/write wrapper pair keeps the
edit functions simple and guarantees the file's ending style is preserved rather
than half-converted. (Sprinkling `\r?\n` into each regex is the fallback, but it
still risks emitting mixed endings via the `split/join('\n')` paths, so the
normalize-in/restore-out wrapper is cleaner.)

## Acceptance criteria

- [ ] `promote <id>` completes fully against a CRLF `INDEX.md` + CRLF `protocol.md`:
      file moved, both INDEX list markers updated, both counts adjusted, protocol
      entry prepended, manifest returned — no throw, no partial state.
- [ ] The same holds against LF files (no regression) and against a BOM-prefixed
      `INDEX.md` (BOM preserved on write, not doubled or dropped).
- [ ] Written files keep their original line-ending style — a CRLF file stays CRLF
      (no mixed `\n`/`\r\n` lines introduced by `split/join`), an LF file stays LF.
- [ ] New unit tests in `lib/test/` cover the CRLF (and BOM) cases for
      `removeIndexLine`, `insertIndexLineAtTop`, `prependProtocolEntry`, and an
      end-to-end `promote` on CRLF fixtures. Existing LF tests still pass.
- [ ] `applyTaskMove`-driven moves (the shared mover) inherit the fix — verify no
      other lifecycle verb regresses.

## Notes

- Discovered live on 2026-07-03 while promoting `design-system-pv3mq` in the
  Mediatheca consumer repo; that promote's bookkeeping was completed by hand and
  committed there (`model(design-system): promote design-system-pv3mq …`). This
  task fixes the tool so the manual reconciliation isn't needed next time.
- Thematically adjacent cross-platform-text robustness work already done in this BC:
  `infrastructure-020` (POSIX escaping breaking the Windows shell) and
  `infrastructure-q8m4t` (quotation marks in prompts). Same family of "the tooling
  assumed a POSIX/LF world"; worth a glance for the testing pattern, not a dependency.
- Failure mode is *silent-until-throw and non-atomic*: the move half of the operation
  has no rollback, so the throw strands the board. Even with the EOL fix, consider
  whether `promote()` should guard its file edits behind a dry validation (all markers
  matchable) *before* moving the file — so any future marker mismatch fails closed with
  nothing moved. Optional hardening; call it at work time.
