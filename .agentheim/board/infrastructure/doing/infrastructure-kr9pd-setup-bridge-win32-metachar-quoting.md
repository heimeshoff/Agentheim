---
id: infrastructure-kr9pd
title: `/setup` bridge verbs fail on win32 when the `.vsix` or `code.cmd` path holds a cmd.exe metacharacter but no space — `quoteArgWindows` leaves such segments unquoted and `cmd.exe` splits them
status: doing
type: bug
context: infrastructure
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [setup, bridge, windows, shell, quoting, cli]
related_adrs: [0002, 0018, 0079]
related_research: []
prior_art: [infrastructure-js62b, infrastructure-x56qm, infrastructure-020]
---

## Why

infrastructure-js62b's iteration-2 fix made `/setup`'s bridge verbs actually work on
win32: `defaultExec` in `lib/setup-cli.mjs` routes through `execFileSync(..., { shell: true })`
because Node refuses to spawn the `code.cmd` shim without a shell, and it pre-quotes
`execPath` and every argv element with `quoteArgWindows` because Node's own shell-mode
join is a bare `[file, ...args].join(' ')` with no per-argument quoting. The verifier
proved a space-containing `.vsix` path reaches `code` as one argument and PASSED — and
flagged one residual edge, out of criterion but real.

`quoteArgWindows` quotes only when the value contains a space, tab, or double quote
(`if (!/[ \t"]/.test(str)) return str;`). A path segment carrying a cmd.exe
metacharacter — `&`, `|`, `^`, `<`, `>`, `(`, `)` — but **no whitespace** is therefore
passed to `cmd.exe /d /s /c` bare, and `cmd.exe` interprets it: `Research&Dev` becomes
two commands, `a|b` a pipe, `x^y` an escape. There are two parsing layers stacked here —
`cmd.exe`'s own metacharacter pass sits *above* the `CommandLineToArgvW` decode that
`quoteArgWindows` was written against — and the current function only satisfies the
lower one.

The failure is loud (exit 1, `code --install-extension failed: …`, or `status.bridge`
reporting `unknown` with a warning — never silent), so no js62b acceptance criterion is
violated. But the affected segment is the one a builder does not control: the `.vsix`
path comes from `lib/resolve-plugin-file.mjs`'s cache walk
(`<home>/.claude/plugins/cache/agentheim/agentheim/<semver>/vscode-extension/agentheim-bridge-<v>.vsix`),
so a user profile such as `C:\Users\Research&Dev` — or a portable, space-free VS Code
install whose `bin\code.cmd` sits under such a segment — breaks **every** `install bridge`,
`remove bridge`, and bridge `status` call on that machine, with no workaround short of
renaming the profile. ADR-0079 made `/setup` the one place a consumer installs, upgrades
or removes the bridge; it must not have a per-username blind spot.

## What

Make the win32 shell-spawn path in `lib/setup-cli.mjs` safe for every argument, not
just whitespace-bearing ones, and pin that with a hermetic default-seam test.

**Decision (made at capture, not left to the worker):** always quote. Under `shell: true`
on win32, `quoteArgWindows` wraps **every** argument — `execPath` included — in double
quotes, regardless of content, keeping its existing `CommandLineToArgvW` backslash/quote
escaping rule for the inner bytes. Inside a double-quoted span `cmd.exe` treats
`& | < > ( ) ^` as literal characters, so unconditional quoting closes the upper layer
without a second escaping pass; the lower layer (`CommandLineToArgvW`) is already handled.
The empty-string case (`""`) is unchanged.

Considered and rejected:

- **Escape metacharacters with `^` on top of conditional quoting** — redundant once
  everything is quoted, and `^`-escaping interacts badly with the quoting rule (a `^`
  inside quotes is literal; outside it must itself be escaped). Two mechanisms where one
  suffices.
- **Avoid the shell by resolving `code.cmd` to the underlying `Code.exe … cli.js`
  invocation** — re-implements VS Code's shim (its env setup and relative layout vary
  across stable / Insiders / portable installs) and is exactly the brittleness the
  which/exec seam was built to avoid. infrastructure-020's "bypass the shell" precedent
  does not carry here, because the thing being spawned *is* a `.cmd`.

**Accepted residual (document in the function comment, do not fix here):** `cmd.exe`
expands `%NAME%` even inside double quotes, so a path segment that forms a *matched*
pair of percent signs naming a defined environment variable is still rewritten. This is
far rarer than a bare `&`/`(`/`)` and is out of this task's scope; a single unmatched `%`
is left alone by `cmd.exe` and needs nothing.

POSIX `defaultExec` stays exactly as it is — no shell, no quoting.

## Acceptance criteria

- [ ] On win32, `defaultExec` passes every argument — `execPath` and each element of
      `args` — to `execFileSync(..., { shell: true })` wrapped in double quotes,
      independent of whether the value contains whitespace; `quoteArgWindows` no longer
      has an unquoted early return for values lacking space / tab / `"`. The
      `CommandLineToArgvW` escaping of inner backslashes and quotes is unchanged, and
      `''` still yields `""`.
- [ ] A hermetic default-seam test in `lib/test/setup-cli.test.mjs` (same shape as the
      existing "the default which/exec seam … actually spawns a stub `code`" test: stub
      `code.cmd` on a fixture `Path` fed through `deps.env`, **no** injected `which`/`exec`,
      never the real PATH / registry / VS Code) runs the fixture home **and** the stub
      `code.cmd`'s directory through a prefix that contains `&`, `^`, `(` and `)` and **no
      whitespace** (e.g. `R&D^(x)`), and asserts `install bridge` exits 0 with the logged
      argv containing the full resolved `.vsix` path verbatim including that segment, `status`
      reports `bridge.state: "installed-current"` with `codeOnPath: true`, and
      `remove bridge` exits 0.
- [ ] The same test's `&`/`^`/`(`/`)` prefix is exercised on every platform the suite runs
      on (POSIX runs the shell-script stub through the unchanged no-shell path), so the
      fixture is not win32-only even though only win32 has the shell layer; on POSIX it
      guards that no shell was introduced there.
- [ ] A unit test pins `quoteArgWindows` directly (export it, or test it through
      `defaultExec` with an injected `execFileSync`-shaped seam — worker's call, but the
      assertion must be on the produced command-line tokens): a value with no whitespace
      and a `&` is emitted quoted; a value with an embedded `"` is emitted with the `\"`
      escape; a value ending in backslashes doubles them before the closing quote; the
      empty string yields `""`.
- [ ] The existing space-containing default-seam test, the exec-throws → `unknown` test,
      and every other `lib/test/setup-cli.test.mjs` case pass unchanged; `node --test
      lib/test/*.test.mjs` is fully green (755 + the new tests).
- [ ] POSIX `defaultExec` is byte-for-byte untouched: still `execFileSync(execPath, args,
      { encoding: 'utf8' })` with no `shell` option.
- [ ] The `quoteArgWindows` / `defaultExec` comment block names both parsing layers
      (`cmd.exe` metacharacter pass above `CommandLineToArgvW` decode), states that
      unconditional quoting is what closes the upper layer, and records the `%NAME%`
      residual as accepted and out of scope.
- [ ] `lib/setup-cli.mjs` remains stdlib-only and git-free (ADR-0002); no new dependency,
      no PATH write (the existing source guard over `setup-cli.mjs` still passes).

## Notes

- Found by the infrastructure-js62b iteration-2 verifier on 2026-09-12 (`work` session,
  batch `[infrastructure-js62b]`): the end-to-end stub-`code.cmd` proof on a spaced path
  PASSED, and the verifier flagged the space-free-metacharacter segment as a residual
  edge and backlog candidate, not a criterion defect. Captured here from that finding.
- Mechanics to read first: `lib/setup-cli.mjs` — `defaultWhich` (PATH × PATHEXT walk that
  yields the `.cmd` shim on win32), `quoteArgWindows`, `defaultExec`, and the three call
  sites `installBridge` / `removeBridge` / `buildBridgeStatus`. The `.vsix` path comes
  from `resolveVsixSource` → `lib/resolve-plugin-file.mjs`'s homedir-derived cache walk.
- Why Node's shell mode needs this at all: with `shell: true` on win32 Node runs
  `cmd.exe /d /s /c "<file> <args joined by space>"`; `/s` strips only the outermost
  quote pair, so a quoted `execPath` plus quoted args survive intact — the js62b space
  test already relies on this. Quoting a value that "didn't need it" costs nothing in that
  model.
- The existing win32 stub (`writeStubCode`) logs with `echo %* >> "%~dp0calls.log"`; with
  the argument quoted, `%*` carries the quotes through, so the log line contains the
  quoted path — assert on the path bytes, not on the absence of quote characters.
- `tmp()` in the test file creates the fixture under `os.tmpdir()`; the metacharacter
  prefix has to be a directory *created* by the test beneath that, not injected into
  the tmp root. The `rmSync` teardown on this Windows box has a known, pre-existing
  EPERM flake in `foreign-launch.test.mjs`; keep the new fixture's teardown in a
  `finally` with `{ recursive: true, force: true }` as the sibling tests do.
- infrastructure-020 (bridge prompt quoting) is the cross-shell precedent in this BC —
  it fixed the same bug class by deleting the shell. That option is closed here (a `.cmd`
  cannot be spawned shell-less), which is why the answer is "quote everything", not
  "quote nothing".
