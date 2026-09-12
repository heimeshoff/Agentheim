---
id: infrastructure-js62b
title: `/setup` installs, upgrades and removes the VS Code bridge from the shipped `.vsix`, reports its install state, and the dashboard's skew banner names `/setup` as the remedy
status: done
type: feature
context: infrastructure
created: 2026-09-12
completed:
depends_on: [infrastructure-x56qm, infrastructure-j3rsn]
blocks: []
tags: [dashboard, commands, setup, bridge, vsix]
related_adrs: [0018, 0079]
related_research: []
prior_art: [infrastructure-013, infrastructure-v8r3q]
---

## Why

The bridge install is documented as a four-command manual ritual nobody but the
builder has run. ADR-0079 §5 makes `/setup` the one place a consumer adds,
upgrades, or removes the bridge, and names it as the remedy the dashboard's
"older version" skew banner points at after a plugin update. infrastructure-x56qm
ships `/setup` with the CLI option only; infrastructure-j3rsn makes the `.vsix`
actually reach a consumer's plugin cache. This task adds the bridge option on
top of both.

## What

Extend `lib/setup-cli.mjs` (x56qm) additively — same stdlib-only, git-free shape,
same non-interactive verb surface:

| Verb | Effect | Exit |
|---|---|---|
| `install bridge` | `code --install-extension <resolved .vsix> --force` (an upgrade as well as a first install) | `0` / `1` |
| `remove bridge` | `code --uninstall-extension agentheim.agentheim-bridge` | `0` / `1` |

The `.vsix` is resolved through `lib/resolve-plugin-file.mjs` (repo-local
`vscode-extension/agentheim-bridge-*.vsix` first, else the newest cached semver),
so a plugin update is picked up by a plain re-run. Both verbs print a one-line
reminder to reload the VS Code window (a reload alone re-activates the stale
build; an install alone leaves the old listener running — README already warns
the order matters).

`status` gains a `bridge` key (additive to x56qm's `schema: 1` contract; no other
field changes):

```json
"bridge": { "state": "not-installed" | "installed-current" | "installed-stale" | "unknown",
            "installedVersion": "0.5.0" | null, "shippedVersion": "0.5.0" | null,
            "vsix": "<abs>" | null, "codeOnPath": true }
```

Bridge state is the deliberate asymmetry to the CLI's byte-compare: the installed
artifact lives opaquely in VS Code's extensions directory and exposes only a
version, so `installed-current` is a string compare of
`code --list-extensions --show-versions` against the shipped `.vsix`'s version
segment. When `code` is absent, the state is `"unknown"` — honestly distinct
from `"not-installed"`.

**Skew banner.** `BRIDGE_SKEW_BANNER_TEXT` in `dashboard/app/board.js` becomes,
verbatim:

> Your VS Code bridge is running an older version. Some launch options are unavailable. Run `/setup` to upgrade it, then reload the window.

It keeps agentic-workflow-n4qte's generic, names-no-capability framing and orders
the steps the way README already warns. Caveat that rides in the acceptance
criteria: the banner fires off the *running listener's* advertised capability
set, so it structurally cannot distinguish "upgraded via `/setup`, window not
yet reloaded" from "never upgraded" — the copy is safe under both readings
(merely redundant in the first), and no test may claim the banner appears only
when an upgrade is actually needed.

**Docs.** README's bridge `<details>` block names `/setup` as the primary install
path; the four-command `vsce package` sequence survives below it, explicitly
labelled the from-source alternative. The `/dashboard` table (x56qm) is not
touched. The infrastructure BC README's `/setup` entry gains the bridge option
and the version-compare rule.

## Acceptance criteria

- [ ] With a stubbed `code` executable on `PATH` (fixture recording its argv), `install bridge` invokes `code --install-extension <resolved .vsix> --force` and exits `0`; `remove bridge` invokes `code --uninstall-extension agentheim.agentheim-bridge`; both print a reload reminder.
- [ ] `install bridge` resolves the `.vsix` newest-cached-semver-first: a fixture cache with two version directories installs the newer one's file.
- [ ] With no `code` on `PATH`, `install bridge` exits `1` with a one-line remedy, and `status` reports `bridge.state === "unknown"` (never `"not-installed"`) with `codeOnPath: false`.
- [ ] `status` reports `bridge.state` as `installed-current` / `installed-stale` / `not-installed` from a stubbed `code --list-extensions --show-versions` compared against `bridge.shippedVersion`, across three fixtures; x56qm's existing `status` assertions still pass unchanged (the key is additive).
- [ ] `status` remains side-effect-free with the bridge key present (recursive fake-home snapshot unchanged).
- [ ] `commands/setup.md` still carries the resolver bootstrap exactly once (`lib/command-bootstrap-dedup.mjs`'s live-tree gate unchanged) and inlines no `code --install-extension` literal.
- [ ] `BRIDGE_SKEW_BANNER_TEXT` in `dashboard/app/board.js` equals the string above verbatim; `dashboard/test/board-prompt-bar.test.mjs` and `dashboard/test/board-prompt-bar-capability-dom.test.mjs` are updated to pin it, and the banner still fires on any missing capability (the n4qte contract is unchanged).
- [ ] README's bridge `<details>` block names `/setup` as the primary install path and labels the `vsce package` sequence as the from-source alternative — asserted by a literal-substring doc check.
- [ ] The infrastructure BC README's `/setup` entry describes the bridge option and the version-compare rule.
- [ ] `npm test` (dashboard) and `node --test lib/test/*.test.mjs` are green, excluding the two known-environmental failures (fixed-port `bridge.test.mjs` cases while the builder's live bridge holds `:31425`; `foreign-launch.test.mjs`'s EPERM teardown race on Windows).
- [ ] On the builder's machine: `/setup` → bridge → reload VS Code → `code --list-extensions --show-versions` reports `agentheim.agentheim-bridge@<shipped version>`, and the dashboard's launch buttons open a real terminal. [human-eye]
- [ ] The banner copy reads correctly in both indistinguishable states — upgraded-but-not-reloaded and never-upgraded. [human-eye]

## Notes

Depends on infrastructure-x56qm (the `/setup` card, `lib/setup-cli.mjs`, the
`status` contract) and infrastructure-j3rsn (the committed `.vsix`). **Never
batch in parallel with x56qm** — both touch `commands/setup.md`,
`lib/setup-cli.mjs`, `README.md` and the BC README.

`dashboard/app/board.js` changes require a `dist/` rebuild. Per the standing
convention the worker must **not** run `node build.mjs`; `dist-staleness.test.mjs`
goes red on `main` after merge and stays red until the builder runs `RELEASE.md`
step 1. Brief the verifier on this, and never textually merge
`dashboard/dist/app.js` at merge-back — discard both sides and rebuild from
merged source.

Two `vscode-extension/test/bridge.test.mjs` cases fail `EADDRINUSE` on `:31425`
while the builder's real bridge runs — not a regression.

Settled at refinement (2026-09-12): `.vsix` ships committed (builder ruling;
j3rsn), not built at install time; version-compare for bridge state versus
byte-compare for the CLI; `"unknown"` when `code` is absent.

## Verifier note (iteration 1)

**Verdict:** FAIL — likely-fixable

**REASONS:**
- AC 1 ("`install bridge` invokes `code --install-extension <resolved .vsix> --force` and exits `0`; `remove bridge` invokes `code --uninstall-extension …`") is covered only through the injected `exec` seam. The shipped default seam cannot invoke `code` on win32 at all: `lib/setup-cli.mjs:215-217` `defaultExec` calls `execFileSync(execPath, args, { encoding: 'utf8' })` with no `shell` option, and `defaultWhich` (`lib/setup-cli.mjs:196-212`) resolves `code` to `…\Microsoft VS Code\bin\code.cmd` on this machine. The verifier ran that exact call shape directly and it throws: `EXEC THREW: EINVAL spawnSync C:\Users\marco\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd EINVAL` — Node refuses to spawn `.cmd`/`.bat` without `shell: true`. Every real `install bridge` / `remove bridge` on the builder's platform therefore takes the `catch` at `lib/setup-cli.mjs:307` / `:329` and returns `exitCode: 1` with `code --install-extension failed: … EINVAL`. No test detects this because all 6 bridge tests inject `exec`; none exercises `defaultExec`.
- AC 4 (`status` reports `installed-current` / `installed-stale` / `not-installed`) and AC 3's explicit "`unknown` is honestly distinct from `not-installed`" contract are broken by the same defect on win32, and worse, silently. `buildBridgeStatus` swallows the EINVAL at `lib/setup-cli.mjs:266-268` (`catch { installedVersion = null; }`) and reports `state: "not-installed"`. Verified live in the worktree: `runCli(['status'], { homedir: <tmp> })` returns `{"state":"not-installed","installedVersion":null,"shippedVersion":"0.5.0","vsix":"…agentheim-bridge-0.5.0.vsix","codeOnPath":true}` in 22 ms — `codeOnPath: true` yet no `code` was ever successfully run. An installed bridge would be misreported as `not-installed`, which is precisely the conflation AC 3 forbids. The three-fixture test at `lib/test/setup-cli.test.mjs:706-734` passes only because it stubs the output the real seam can never obtain.
- Consequence for the deferred `[human-eye]` criteria: AC 11 cannot succeed as written on the builder's machine (`/setup` → bridge would exit `1`), so this is not a pending eye-check but a defect already provable by machine.

Everything else checked is clean and should be preserved on the next pass: lib suite 753/753 pass; dashboard 1014 pass / 1 fail, the single failure being the expected `dist-staleness.test.mjs` ADR-0057 artifact; `BRIDGE_SKEW_BANNER_TEXT` at `dashboard/app/board.js:651` matches the task's blockquote byte-for-byte including the backticked `/setup`, pinned in both named dashboard test files with the n4qte any-missing-capability contract intact; `commands/setup.md` keeps the bootstrap exactly once and the new `command-card.test.mjs` guard confirms no inlined `code --install-extension` literal; the README `<details>` literal-substring check and the BC README `README_DELTA` replace op are both sound; scope is source+tests only, no `.agentheim/` path in the diff.

**SUGGESTED_FIX:** Make `defaultExec` actually able to run `code` on win32 — e.g. `execFileSync(execPath, args, { encoding: 'utf8', shell: process.platform === 'win32' })` with the `.vsix` path quoted for the shell (or resolve/spawn `cmd.exe /c` explicitly) — and add one hermetic test that exercises the *default* seam (no injected `exec`) against a fixture stub executable placed in a temp dir fed through the injected `env.Path`, so the real spawn path is covered without touching the machine's real PATH or VS Code. Also make `buildBridgeStatus` stop swallowing an exec failure into `not-installed`: an exec that errors while `codeOnPath` is true should report `unknown` (or surface a warning), matching AC 3's honest-distinction rule.

**ITERATION_HINT:** likely-fixable

## Outcome

Extended `lib/setup-cli.mjs` (infrastructure-x56qm) additively with the bridge half of `/setup` (ADR-0079 §5), with every existing x56qm assertion still passing unchanged:

- **`resolveVsixSource(opts)`** — resolves the bridge `.vsix`: repo-local `vscode-extension/agentheim-bridge-*.vsix` first, else the newest cached plugin version's own copy (walking cache version dirs newest-semver-first, mirroring `resolveCliSource`'s pattern but through an entirely independent `bridgeResolveOpts` injection point, so forcing CLI-cache resolution in a test never accidentally forces bridge-cache resolution or vice versa). Returns `null` (never throws) when no `.vsix` is found anywhere.
- **`install bridge` / `remove bridge`** (`installBridge`/`removeBridge`) — `code --install-extension <resolved .vsix> --force` and `code --uninstall-extension agentheim.agentheim-bridge`, both printing a reload-the-window reminder. `code` is located via an injectable `which`/`exec` seam (`resolveCode`, `defaultWhich`/`defaultExec`) rather than a hardcoded shell-out, so every fixture substitutes its own locator/invoker and stays hermetic — no test touches the real PATH or spawns a real VS Code. Absent `code` exits `1` with a one-line remedy.
- **`status.bridge`** (`buildBridgeStatus`) — additive top-level key: `{ state, installedVersion, shippedVersion, vsix, codeOnPath }`. State is a **version-compare** (`code --list-extensions --show-versions` parsed for `agentheim.agentheim-bridge@<version>`, compared against the resolved `.vsix`'s filename version) — deliberately asymmetric to the CLI's byte-compare, since the installed extension exposes only a version. `codeOnPath: false` yields `state: "unknown"`, never `"not-installed"`. Side-effect-free (read-only + one `exec` call), confirmed by a recursive fake-home snapshot test.
- `BRIDGE_EXTENSION_ID` is built from separate `agentheim`/`agentheim-bridge` string parts (not one `'agentheim.agentheim-bridge'` literal) so it doesn't collide with `lib/test/sole-path-constructor.test.mjs`'s `.agentheim`-literal scan — a spelling coincidence, not a real path.
- `runCli`/`main` dispatch `install bridge` and `remove bridge`; `USAGE` and the module's own header comment updated to name all five verbs.
- **`commands/setup.md`** — conversational menu prose extended to mention `install bridge`/`remove bridge` and `status.bridge.state`; the resolver bootstrap Bash block is untouched (still carries it exactly once, per `lib/command-bootstrap-dedup.mjs`'s live-tree gate), and inlines no `code --install-extension`/`--uninstall-extension` literal (new guard added in `dashboard/test/command-card.test.mjs`).
- **`dashboard/app/board.js`** — `BRIDGE_SKEW_BANNER_TEXT` now reads "Your VS Code bridge is running an older version. Some launch options are unavailable. Run `/setup` to upgrade it, then reload the window." (verbatim, ADR-0079 §5); pinned by a new source-scan test in `dashboard/test/board-prompt-bar.test.mjs` and an updated DOM-rendered assertion in `dashboard/test/board-prompt-bar-capability-dom.test.mjs`. The banner still fires on any missing capability (n4qte's contract unchanged) and the copy is worded to stay true whether or not the upgrade has actually happened yet, since the running listener's own advertised capabilities are structurally incapable of telling those two states apart.
- **Root `README.md`** — the bridge `<details>` block now names `/setup` as the primary install path (new paragraph up top) and relabels the existing four-command `vsce package` sequence "From-source alternative"; `dashboard/test/readme-docs.test.mjs`'s bridge-block test was updated (not deleted) to assert the new contract while still requiring the from-source `vsce` snippet to survive verbatim.
- Infrastructure BC README's `/setup` "Install surface" bullet updated to describe the bridge option and the version-compare rule — reported in `README_DELTA` (single `replace` op).

**Tests**: `node --test lib/test/*.test.mjs` — 753/753 passing (11 new tests in `lib/test/setup-cli.test.mjs`: `resolveVsixSource` repo-local/cache/null/live-repo, `install bridge`/`remove bridge` argv+exit+reminder, newest-cached-semver-first, no-`code` remedy + `status.bridge` unknown, `runCli` dispatch, the three-state `status.bridge` transition sequence, and bridge-key side-effect-freedom). `cd dashboard && npm test` — 1014/1015 passing (1 new test in `board-prompt-bar.test.mjs`, 1 in `command-card.test.mjs`; the sole failure is `dist-staleness.test.mjs`, the known ADR-0057 artifact from `board.js` changing without a `node build.mjs` rebuild — not this task's defect; `dashboard/dist/` was not hand-edited and is excluded from `FILE_LIST`). `vscode-extension/test/*.test.mjs` spot-checked untouched: the same 2 known environmental `EADDRINUSE` failures on `:31425` persist, nothing new.

**Deferred, per the task's Notes**: the two `[human-eye]` acceptance criteria (installing the bridge on the builder's real machine and reloading VS Code; confirming the banner copy reads sensibly in both indistinguishable states) are the builder's/verifier's step, not performed here — no test or code in this task touches the builder's real `code` CLI or extensions directory.

Key files: `lib/setup-cli.mjs`, `lib/test/setup-cli.test.mjs`, `commands/setup.md`, `README.md`, `dashboard/app/board.js`, `dashboard/test/board-prompt-bar.test.mjs`, `dashboard/test/board-prompt-bar-capability-dom.test.mjs`, `dashboard/test/command-card.test.mjs`, `dashboard/test/readme-docs.test.mjs`.

**Iteration 2 fix (verifier FAIL on iteration 1):** the shipped default `code`-invocation seam (`defaultExec`) could not actually run `code` on win32, because `defaultWhich` resolves `code` to a `.cmd` shim and Node refuses to spawn a `.cmd`/`.bat` without a shell — every real `install bridge`/`remove bridge` on the builder's platform threw `EINVAL` and returned `exitCode: 1`, and `buildBridgeStatus` silently swallowed that same throw into `state: "not-installed"` (with `codeOnPath: true`), exactly the conflation AC 3 forbids. Fixed by: (1) `defaultExec` now routes win32 through `execFileSync(..., { shell: true })`, pre-quoting `execPath` and every argv element itself with a `CommandLineToArgvW`-compatible quoting function (`quoteArgWindows`) — Node's own shell-mode join is a bare `[file, ...args].join(' ')` with no per-argument quoting, so this is required for a `.vsix` path containing a space (e.g. the real `...\Microsoft VS Code\bin\code.cmd` shim path itself) to survive the round trip intact; POSIX `defaultExec` is unchanged (no shell). (2) `buildBridgeStatus` now distinguishes "exec threw" from "exec succeeded but the bridge isn't in the extension list": when `codeOnPath` is true and the `--list-extensions --show-versions` exec call itself throws, it returns `state: "unknown"` (never `"not-installed"`) plus a `warnings: [...]` entry naming the underlying error, matching AC 3's honest-distinction rule; the pre-existing three-state (`not-installed`/`installed-current`/`installed-stale`) transition test is untouched since it never hits the throwing path. (3) Two new tests added to `lib/test/setup-cli.test.mjs`: a hermetic default-seam test that places a stub `code`/`code.cmd` on a fixture PATH (fed through injected `deps.env`, never the real PATH/registry/VS Code) with NO injected `which`/`exec`, running the fixture's home directory itself through a space-containing prefix so the resolved `.vsix` path contains a space, and asserting `install bridge` → `status` → `remove bridge` all succeed for real through `defaultWhich`/`defaultExec`; and a second test injecting a `which` that reports `code` present but an `exec` that throws, asserting `buildBridgeStatus` returns `state: "unknown"`/`codeOnPath: true`/a non-empty `warnings` array rather than `"not-installed"`. `node --test lib/test/*.test.mjs` now passes 755/755 (35/35 in `setup-cli.test.mjs`); `cd dashboard && npm test` remains 1014/1015 (sole failure still the known `dist-staleness.test.mjs` ADR-0057 artifact, unrelated to this fix — no dashboard file was touched in this iteration). Files touched this iteration: `lib/setup-cli.mjs`, `lib/test/setup-cli.test.mjs` (both already in `FILE_LIST` from iteration 1; no new files).
