---
id: infrastructure-js62b
title: `/setup` installs, upgrades and removes the VS Code bridge from the shipped `.vsix`, reports its install state, and the dashboard's skew banner names `/setup` as the remedy
status: todo
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
