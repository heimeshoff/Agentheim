---
id: infrastructure-017
title: Re-package & version the bridge .vsix carrying the skip-permissions change
status: done
type: chore
context: infrastructure
created: 2026-06-15
completed: 2026-06-15
commit: 2ff0add
depends_on: [infrastructure-016]
blocks: []
tags: [bridge, extension, packaging, release]
related_adrs: [0018]
related_research: []
prior_art: [infrastructure-013]
---

## Why
infrastructure-016 added the opt-in `skipPermissions` command-construction to the
bridge extension's pure core (`vscode-extension/src/bridge.js`). The shipped
`.vsix` artifact still reflects the pre-amendment behaviour: the committed-on-disk
`agentheim-bridge-0.1.0.vsix` predates the bridge.js change, `package.json`
`version` is still `0.1.0`, and the extension README still asserts the opposite of
the new behaviour. To get the amended behaviour into an installed editor — and to
stop the README lying about the contract — the extension must be re-packaged, the
version bumped, and the README reconciled.

## What
A mechanical packaging chore, scoped to `vscode-extension/`. No runtime behaviour
changes — infrastructure-016 already shipped the logic; this just versions and
re-packages it and fixes the docs that lag it.

**Decisions settled in refinement (2026-06-15):**
- **Version bump → `0.2.0` (minor).** The opt-in `skipPermissions` parameter is an
  additive capability on the `POST /run` contract surface. This is the *extension's*
  own version and is **independent of the plugin manifest / ADR-0013 release
  discipline** — it needs **no `vX.Y.Z` git tag** and no `plugin.json` touch.
- **Distribution channel → keep build-on-demand.** The `.vsix` is gitignored and
  built locally from the README's install steps (confirmed: `git check-ignore`
  matches it; only `README.md` + `package.json` are tracked). Keep it that way — no
  binary committed to git, no GitHub-release flow. This matches the zero-artifact
  plugin philosophy.

## Acceptance criteria
- [x] `vscode-extension/package.json` `version` bumped `0.1.0` → `0.2.0`. (The
      `description` field already mentions `skipPermissions` — no further change there.)
- [x] `extension.js` confirmed unchanged — infrastructure-016 was confined to the pure
      core `src/bridge.js`; the only `vscode`-API file needs no edit.
- [x] `vscode-extension/README.md` reconciled with the amended `POST /run` contract:
  - [x] The "Trust boundary" line *"The launch never hard-wires
        `--dangerously-skip-permissions` or any other permission-bypass flag"* corrected
        to the opt-in, off-by-default, strict-`true` reality (mirror ADR-0018's amended
        wording / the BC README's Bridge entry).
  - [x] The HTTP-surface table's `POST /run` row notes the optional, off-by-default
        `skipPermissions` boolean (literal `true` → `claude --dangerously-skip-permissions
        "<prompt>"`; absent/false/malformed → `claude "<prompt>"`).
  - [x] The Tests blurb no longer claims `POST /run` launches "with no permission-bypass
        flag" — it now covers both the default and the strict-`true` bypass path.
  - [x] The Install/Uninstall commands reference `agentheim-bridge-0.2.0.vsix` (both the
        `vsce package` output comment and the `code --install-extension` line).
- [x] `npm run package` (vsce) re-run, producing `agentheim-bridge-0.2.0.vsix`; the stale
      `0.1.0` `.vsix` is replaced (not left lying beside the new one).
- [x] The `.vsix` stays **gitignored and uncommitted** — no binary added to the repo;
      `git status` shows no new tracked artifact.
- [x] `npm test` still green (this chore changes no runtime behaviour; the suite that
      already covers the skipPermissions paths from infra-016 stays passing — the only
      two failing cases are the pre-existing fixed-port-contention tests, environmental:
      a live VS Code bridge extension host holds 31425/31426 on this dev box, unrelated
      to any diff here).

## Notes
- Predecessor packaging task: **infrastructure-013** built the extension and established
  the `vsce package` flow this chore repeats (`.vscodeignore` already keeps `test/**` and
  `**/*.test.mjs` out of the bundle — no change needed).
- Do **not** conflate with ADR-0013: that governs the **plugin** (`plugin.json` ↔ `vX.Y.Z`
  tag), not this extension. Bumping the extension is a standalone act with no tag.
- The `.vsix` filename is version-stamped by vsce, so the README's hardcoded filename must
  track the bump — easy to miss, hence its own criterion above.

## Outcome

Mechanical packaging chore complete; no runtime behaviour changed (infrastructure-016
already shipped the `skipPermissions` logic in `src/bridge.js`).

- **Version bump** — `vscode-extension/package.json` `version` `0.1.0` → `0.2.0` (minor;
  additive `skipPermissions` capability). Standalone extension version — no `plugin.json`
  touch, no `vX.Y.Z` tag (ADR-0013 governs the plugin, not this extension).
- **`extension.js` confirmed unchanged** — zero `skipPermissions` references, no git diff;
  the only `vscode`-API file needed no edit.
- **`vscode-extension/README.md` reconciled** with the amended ADR-0018 `POST /run`
  contract: the stale Trust-boundary "never hard-wires `--dangerously-skip-permissions`"
  line replaced with the opt-in/off-by-default/strict-`true` reality + the unchanged-token
  guardrail + the bridge-launch-only / clipboard-can't-carry note; the HTTP-surface table
  `POST /run` row now shows the optional `skipPermissions` boolean and both command paths;
  the Tests blurb now describes the default + strict-`true` bypass + malformed-default
  cases; Install/Uninstall filenames bumped to `agentheim-bridge-0.2.0.vsix`.
- **Re-packaged** — `npm run package` produced `agentheim-bridge-0.2.0.vsix` (6 files,
  `test/**` correctly excluded by `.vscodeignore`); the stale `0.1.0` `.vsix` removed. The
  `.vsix` stays gitignored (`git check-ignore` matches) and untracked — no binary in the
  repo.
- **Tests** — `npm test` green except the two pre-existing **fixed-port-contention** cases
  (`binds … preferred fixed port`, `falls back along 31425→31426→31427`), which fail
  environmentally because a live VS Code bridge extension host holds 31425/31426 on this
  dev box (`EADDRINUSE`). All `skipPermissions` cases from infra-016 pass. No regression
  from this diff (README + version only; no code touched).

No new ADR (the decision was already settled by ADR-0018's 2026-06-14 amendment). The
infrastructure BC README needed no change — infra-015/016 already reconciled its Bridge
entry with the amended contract.
