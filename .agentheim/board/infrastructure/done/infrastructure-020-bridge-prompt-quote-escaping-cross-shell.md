---
id: infrastructure-020
title: Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell
status: done
type: bug
context: infrastructure
created: 2026-06-16
completed: 2026-06-16
commit: 4533d39
depends_on: []
blocks: []
tags: [bridge, extension, shell, quoting, windows, dashboard]
related_adrs: [0018]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-016, infrastructure-013]
---

## Why
A prompt typed into the dashboard prompt bar that contains a double-quote (`"`) is
**cut off** when a launch button hands it to the terminal. The builder expects every
character they type to reach the spawned `claude` session verbatim.

The string is *not* lost in transit: it travels dashboard → bridge as JSON
(`POST /run { prompt }`), which carries quotes losslessly. It breaks one step later,
when the bridge turns the prompt into a shell command line and types it into the VS
Code integrated terminal.

Root cause — `vscode-extension/src/bridge.js:182`:

```js
const quoted = `"${prompt.replace(/"/g, '\\"')}"`;   // → claude "...\"..."
```

The `\"` escaping is **POSIX `sh`/`bash` convention**. The bridge then runs
`terminal.sendText('claude "<…>"')` (`extension.js`), typing that line into whatever
shell the user's *default integrated terminal* uses. On the builder's **Windows** box
that is **PowerShell or cmd.exe**, and neither treats `\"` as an escaped quote
(PowerShell wants `` `" `` or `""`; cmd wants `""`). So the first embedded `"`
terminates the quoted string early and the tail is dropped or re-parsed.

The same class of failure applies to other shell metacharacters typed in a prompt
(single quotes, backticks, `$(…)`, `;`, `&`, `|`) — `\"` only addresses one of them,
and addresses it for the wrong shell. The bug is *categorical*: it exists because a
shell parses builder text at all.

## What
Make the bridge hand the **exact** typed prompt to the spawned `claude` session, with
**no shell in the path** — so no character the builder typed can ever be cut off or
reinterpreted, regardless of which shell VS Code's integrated terminal would have used.

### Decided approach (architect, 2026-06-16) — bypass the shell entirely
The fix is not to out-quote every shell (Approach 2, "detect-and-quote-per-shell") nor
to hand off out-of-band (Approach 3, temp file / stdin). Both accept the broken premise
that a shell parses the prompt. Instead:

**Make the terminal *be* the `claude` process.** The injected seam spawns `claude`
directly via `createTerminal({ name:'Claude', cwd:root, shellPath:'claude', shellArgs:[…] })`,
so the prompt and the optional `--dangerously-skip-permissions` flag are delivered as
raw **argv** elements — the OS passes them verbatim, no shell, no escaping. This deletes
the bug class outright and is strictly *fewer* moving parts than today's
`sendText('claude "<prompt>"')`.

**Reshaped core↔seam contract.** The pure core (`bridge.js`) stops emitting a
shell-escaped command *string* and instead emits a structured launch descriptor; the
injected seam consumes it:

```
// bridge.js, inside POST /run — the `quoted` escaping step is DELETED.
const args = skip ? ['--dangerously-skip-permissions', prompt] : [prompt];
launchClaude({ command: 'claude', args });   // injected seam, renamed from launchTerminal(command)

// extension.js — the only file touching the vscode API:
const launchClaude = ({ command, args }) => {
  const terminal = vscode.window.createTerminal({
    name: 'Claude', cwd: root,
    shellPath: resolveExecutable(command),   // Windows: PATH×PATHEXT → absolute path
    shellArgs: args,
  });
  terminal.show();
  // no sendText — the terminal IS the claude process
};
```

The prompt is pushed as a single **raw** array element — no `replace(/"/g, …)`, no
surrounding quotes. The descriptor carries `command:'claude'` so the seam holds zero
domain knowledge. The `vscode` API stays quarantined in `extension.js`; the pure core
stays unit-testable (assert the *descriptor* the core builds, exactly as the tests
assert the string today).

Approaches 2 and 3 are recorded as **rejected**; Approach 3 (stdin/temp-file) remains
the named escape hatch *only if* Windows `shellPath` resolution proves genuinely
intractable (see worker-confirmable points below).

## Acceptance criteria
- [ ] A prompt containing `"` reaches the spawned `claude` session intact (e.g.
      `say "hello"` arrives as exactly `say "hello"`, nothing dropped).
- [ ] Other shell metacharacters in a prompt survive verbatim too: single quotes,
      backticks, `$(…)`, `;`, `&`, `|` (e.g. `say "hi" & echo $x` arrives whole).
- [ ] Verified on the builder's primary shell (Windows PowerShell) — the reported case —
      *and* the fix is shell-agnostic by construction (no shell parses the prompt), not a
      PowerShell-only patch that re-breaks cmd/bash.
- [ ] The pure core (`bridge.js`) emits a structured launch descriptor
      `{ command:'claude', args:[…] }` — the `\"`-escaping string step is removed. The
      injected seam is renamed (`launchTerminal(command)` → `launchClaude({ command, args })`)
      so every call site / test is forced through the contract change.
- [ ] The skip-permissions branch (infrastructure-016) carries the prompt with the
      identical guarantee: `skipPermissions === true` → `args = ['--dangerously-skip-permissions', prompt]`,
      anything else → `args = [prompt]`. The strict-`true` fail-safe matrix
      (false / `"true"` / null / number / absent) still passes — assertions move from
      string shape to descriptor shape.
- [ ] `vscode-extension/test/bridge.test.mjs` migrated: string assertions → descriptor
      assertions; the regression guard reframed to "no-`skipPermissions` → `args` is
      exactly `[prompt]`, no flag element"; **plus a new metacharacter-survival test**
      (a prompt with `"` `'` `` ` `` `$` `&` survives as one verbatim `args[0]`) — this
      is the infrastructure-020 regression guard itself.
- [ ] **ADR-0018 amended in place** (additive, `status: proposed`, no `supersedes`,
      mirroring the 2026-06-14 skip-permissions amendment) — the mechanism clause
      `sendText('claude "<prompt>"')` is replaced by the `shellPath`/`shellArgs` spawn;
      the HTTP wire contract is explicitly noted as unchanged. The README *Bridge*
      ubiquitous-language entry and the README ADR-0018 changelog get the same one-line
      correction. `infrastructure-020` added to ADR-0018's `related_tasks`.
- [ ] The `.vsix` is re-packaged / versioned (mirror infrastructure-017) so the installed
      bridge actually carries the reshaped launch — the launch shape changed, so a
      stale-installed extension would silently keep the bug.

## Notes
**Worker-confirmable points (empirical — do NOT re-open the architecture over them):**

1. **Windows `shellPath` resolution.** VS Code's `createTerminal({ shellPath })` does
   *not* reliably apply `PATHEXT`, so a bare `shellPath:'claude'` may fail to resolve to
   `claude.cmd` on Windows (it can work on macOS/Linux). Keep the **core**
   platform-agnostic (always `command:'claude'`); make the **seam** resolve it — on
   `process.platform === 'win32'`, walk `PATH × PATHEXT` (a ~10-line `node:fs`/`node:path`
   lookup, no new dependency) and pass the **absolute path** as `shellPath`; pass
   `'claude'` as-is elsewhere. The OS wart stays localized in the one impure file.
2. **`.cmd` re-parse.** If the resolved target is `claude.cmd`, confirm `shellArgs` reach
   `claude`'s argv verbatim and aren't re-tokenized by `cmd.exe`. If they are, resolve to
   the underlying Node entry the shim wraps instead. Worker-level detail, not a
   re-litigation of the approach.
3. **Interactive session intact.** `shellPath:'claude'` makes the terminal *be* the
   claude process (this is exactly how VS Code custom-shell profiles work) — you get the
   real interactive TUI, `show()` reveals it. One behavioral difference to accept: when
   `claude` exits, the terminal shows an exit notice rather than dropping to a shell
   prompt. Acceptable / arguably clearer.

Escape hatch if Windows resolution proves intractable: **Approach 3** (write the prompt
to a temp file / pipe via stdin). Named here so the worker doesn't invent a new one.

**ADR-0018 amendment text (drop in verbatim, dated 2026-06-16):**

> **Amended 2026-06-16 (infrastructure-020).** The bridge mechanism no longer types a
> shell command line into a terminal. The original clause —
> `window.createTerminal()` + `terminal.show()` + `terminal.sendText('claude "<prompt>"')`
> — seeded a *shell* terminal and let that shell parse `claude "<prompt>"`, which mangled
> prompts containing shell metacharacters on non-POSIX default shells (Windows
> PowerShell/cmd treat `\"` differently). The bridge now makes the terminal **be the
> `claude` process directly**:
> `createTerminal({ name:'Claude', cwd:root, shellPath:'claude', shellArgs:[<flag?>, prompt] })`,
> so the prompt and the optional `--dangerously-skip-permissions` flag are delivered as
> raw `argv` elements with **no shell and no escaping** — quoting cannot corrupt them.
> The pure core (`bridge.js`) correspondingly emits a structured launch descriptor
> `{ command:'claude', args:[…] }` instead of a pre-escaped command string; the injected
> seam (`extension.js`) resolves `command` to a concrete executable on Windows
> (PATH×PATHEXT → absolute path) and spawns it. **Nothing on the HTTP wire changes:**
> `POST /run { prompt, skipPermissions? }`, the token header, the load-bearing `OPTIONS`
> preflight, status codes, `bridge.json`/`GET /api/bridge`, and the strict-`true`
> skip-permissions activation all stand verbatim. The `\"`-escaping step is deleted as
> the source of the bug.

**Touch points:**
- `vscode-extension/src/bridge.js` — delete the `quoted`/escaping step (~182-185); emit
  `{ command:'claude', args }`; rename injected `launchTerminal(command)` →
  `launchClaude({ command, args })`; update the contract comment (~125-130) and `@param` (~226).
- `vscode-extension/extension.js` — replace the `sendText` seam (~50-54) with
  `createTerminal({ shellPath, shellArgs })` + the Windows PATH/PATHEXT resolver; drop
  the "seed the command" comment.
- `vscode-extension/test/bridge.test.mjs` — string → descriptor assertions; reframe the
  regression guard (~178); add the metacharacter-survival test.
- `.agentheim/knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md` — add the
  amendment block; add `infrastructure-020` to `related_tasks`.
- `.agentheim/contexts/infrastructure/README.md` — correct the *Bridge* entry (~88-99)
  and the ADR-0018 changelog (~229-247) from `sendText` to the `shellPath`/`shellArgs`
  mechanism.

Context: the dashboard side already does the right thing — the prompt-bar value is
sanitized to a single line (agentic-workflow-038) and sent as JSON via `launchOrCopy`
(`dashboard/app/bridge-launch.js`); no change there. The **clipboard fallback** pastes
verbatim into a *running* session, so it never had this shell-quoting problem — this bug
is the **bridge → terminal** path only.

Prior art: infrastructure-016 introduced the current `\"` escaping (and its tests);
infrastructure-013 built the bridge; the contract is ADR-0018. infrastructure-017 is the
precedent for re-packaging the `.vsix` after a bridge change.

## Outcome

Architect's Approach 1 (bypass the shell) implemented as decided — no shell now parses
builder text, so the bug class is deleted, not patched. Windows `shellPath` resolution
proved tractable (a ~25-line PATH×PATHEXT walker in the seam), so the Approach 3 escape
hatch was not needed.

- **Pure core (`vscode-extension/src/bridge.js`)** — the `\"`-escaping `quoted` step is
  deleted. `POST /run` now emits a structured launch descriptor
  `{ command: 'claude', args }` where `args = skip ? ['--dangerously-skip-permissions', prompt] : [prompt]`.
  The prompt is a single **raw argv element** — no quoting, no escaping. The injected seam
  is renamed `launchTerminal(command)` → `launchClaude({ command, args })`, forcing every
  call site and test through the contract change. The strict-`true` skip-permissions
  identity check (`parsed?.skipPermissions === true`) is unchanged.
- **Seam (`vscode-extension/extension.js`)** — the `sendText('claude "<prompt>"')` mechanism
  is replaced by `createTerminal({ name:'Claude', cwd:root, shellPath:resolveExecutable(command), shellArgs:args }).show()`:
  the terminal **is** the `claude` process; the OS delivers each arg verbatim. A new
  `resolveExecutable()` localizes the Windows wart — on `win32` it walks `PATH × PATHEXT`
  (stdlib `node:fs`/`node:path`, no new dep) to an absolute path; elsewhere it returns the
  bare `'claude'` for the OS to resolve. Core stays platform-agnostic.
- **Tests (`vscode-extension/test/bridge.test.mjs`)** — all string assertions migrated to
  descriptor-shape assertions; the regression guard reframed to "no `skipPermissions` →
  `args` is exactly `[prompt]`, no flag element"; the strict-`true` fail-safe matrix
  (false / `"true"` / null / number / absent) re-asserted as descriptors. **New
  metacharacter-survival guard** (the infra-020 regression itself): a prompt with
  `"` `'` `` ` `` `$` `&` `|` `;` `$(…)` arrives as one verbatim `args[0]`, plus a
  skip-permissions variant. 12/14 green; the only 2 failures are the pre-existing
  fixed-port-contention cases (a live bridge holds 31425 on this dev box — environmental,
  per the infra-016 note), not a regression.
- **ADR-0018 amended in place** (additive, `status: proposed`, no `supersedes`) — the
  verbatim mechanism-clause amendment dropped in; `infrastructure-020` added to
  `related_tasks`. HTTP wire contract explicitly noted unchanged.
- **README** — the BC README *Bridge* ubiquitous-language entry and the ADR-0018 changelog
  corrected from the `sendText` mechanism to `shellPath`/`shellArgs` spawn; the
  extension-local `vscode-extension/README.md` reconciled likewise.
- **Re-packaged** — `vscode-extension/package.json` bumped `0.2.0` → `0.2.1` (patch: launch
  mechanism fix, wire unchanged); `npm run package` produced `agentheim-bridge-0.2.1.vsix`
  (6 files, `test/**` excluded), stale `0.2.0` removed; the `.vsix` stays gitignored/untracked.

Key files: `vscode-extension/src/bridge.js`, `vscode-extension/extension.js`,
`vscode-extension/test/bridge.test.mjs`,
`.agentheim/knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md`,
`.agentheim/contexts/infrastructure/README.md`, `vscode-extension/README.md`,
`vscode-extension/package.json`.
</content>
</invoke>
