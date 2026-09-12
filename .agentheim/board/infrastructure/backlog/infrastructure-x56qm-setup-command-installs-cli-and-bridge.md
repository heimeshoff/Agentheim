---
id: infrastructure-x56qm
title: A `/setup` command — one-time, per-machine install of the zero-token dashboard CLI and/or the VS Code bridge, so a consumer never pays a model turn to launch the dashboard again
status: backlog
type: feature
context: infrastructure
created: 2026-09-12
completed:
depends_on: [infrastructure-r4mzp]
blocks: []
tags: [dashboard, commands, setup, bridge, context-budget]
related_adrs: [0002, 0018, 0053]
related_research: []
prior_art: [infrastructure-010, infrastructure-k9t2v]
---

## Why

Launching the dashboard through `/dashboard` costs two full-context model turns
(~120k input tokens, measured in infrastructure-k9t2v) to run a script that
returns in milliseconds from a terminal. The builder avoids that in the
Agentheim repo with three personal scripts in `~/.local/bin`; a consumer has no
such path because a Claude Code plugin cannot put anything on `PATH`. The
decision task infrastructure-r4mzp settles that the CLI *should* ship to
consumers via a one-time, user-level install — this task builds that install.

The VS Code bridge has the same shape of problem: it ships as a prebuilt `.vsix`
in the plugin cache, but installing it is a four-command manual sequence in the
README (`cd vscode-extension && npm install && npx vsce package … && code
--install-extension …`). One `/setup` that offers both installs replaces two
undocumented-for-consumers rituals with one guided, once-per-machine step.

## What

A `/setup` slash command — the second process-launcher exception to "phrasing,
not slash commands", alongside `/dashboard` (ADR-0002, extended by r4mzp's ADR)
— that offers the user a choice of:

- **Install the dashboard CLI** — place `agentheim-dashboard` (the `.mjs` logic
  plus the `.cmd` Windows wrapper and the bash shim) into a user-level `PATH`
  directory (`~/.local/bin` or the platform equivalent), never into any project
  tree. The scripts resolve the launcher exactly as the command card does
  (cwd-relative repo-local `dashboard/resolve-launcher.mjs` first, else newest
  semver under `~/.claude/plugins/cache/agentheim/agentheim/`), so they keep
  working across plugin updates without reinstalling.
- **Install the VS Code bridge** — `code --install-extension <cached .vsix>
  --force` from the plugin cache, then tell the user to reload the window.

**`/setup` is never one-shot.** The user can say `/setup` at any time and
change the options: it shows the current install state of each option (CLI
installed at which version / not installed; bridge installed at which version /
not installed) and lets the user add **or remove** either. Removing the CLI
deletes the scripts it placed under the user's home; removing the bridge runs
`code --uninstall-extension agentheim.agentheim-bridge`. Re-running with an
option already installed upgrades it in place. It reports what it did and what
the user must still do by hand (add `~/.local/bin` to `PATH`, `chmod +x`,
reload VS Code).

**A plugin update must reach the installed pieces.** When the agentheim plugin
updates (a new semver directory appears in the plugin cache), the installed
dashboard CLI and/or the VS Code bridge need updating too, or they silently
serve the old version:

- The CLI scripts resolve the launcher from the *newest* cached semver at every
  run, so a plain update is already picked up — but the `.mjs` is a copied file,
  and if a release changes the resolver's location or interface the copy drifts.
- The bridge is a fixed installed `.vsix`; VS Code never re-reads the cache. A
  newer plugin ships a newer `.vsix` that stays uninstalled until someone runs
  `code --install-extension … --force` again. The dashboard already detects
  this skew (the "older version" banner off the bridge's `GET /health`,
  infrastructure-v8r3q / ADR-0018).

So `/setup` re-run after an update must refresh both, and the update must be
*noticed*: at minimum the dashboard's skew banner and the `/dashboard` card
point at `/setup`; whether the launch path itself detects a newer cached
version and prompts is settled by r4mzp's ADR (see Notes).

## Acceptance criteria

- [ ] `commands/setup.md` exists and, like `commands/dashboard.md`, contains the resolver bootstrap exactly once (extend `lib/dashboard-command-bootstrap-dedup.mjs`'s lint or add a sibling), delegating to a shipped setup script rather than inlining install logic in the card.
- [ ] After "install CLI" on a machine with the plugin installed and no repo checkout, `agentheim-dashboard`, `agentheim-dashboard stop` and `agentheim-dashboard status` behave identically to the three `/dashboard` verbs, and `foreign-launch.test.mjs`-style end-to-end tests prove it against a foreign project.
- [ ] The install writes only under the user's home directory — a test asserts no file is created under the target project's tree (in particular nothing under `.agentheim/`).
- [ ] After "install bridge", `code --list-extensions` reports `agentheim.agentheim-bridge` at the version of the cached `.vsix`; re-running upgrades rather than refusing.
- [ ] `/setup` with no `code` on `PATH`, or no writable `~/.local/bin`, fails loud per option with a one-line remedy and still completes the other option.
- [ ] Re-running `/setup` shows the current install state (installed version or "not installed") for each option and lets the user add or remove either; after "remove CLI" the placed scripts are gone from the user's home, and after "remove bridge" `code --list-extensions` no longer reports `agentheim.agentheim-bridge`.
- [ ] After the plugin cache gains a newer semver directory, re-running `/setup` upgrades the installed bridge to the newer cached `.vsix` and refreshes the CLI scripts; a test simulates the update by adding a newer version directory to a fixture cache and asserts both installs track it.
- [ ] After a plugin update, the user is told that `/setup` needs re-running: the dashboard's existing "older version" bridge banner and the `/dashboard` card both name `/setup` as the remedy.
- [ ] README's `/dashboard` table and the bridge `<details>` block point at `/setup` as the primary install path; the manual four-command sequence survives only as the "from source" alternative.
- [ ] The infrastructure BC README's "Launch / Stop" entry describes the three launch surfaces (repo-local, `/dashboard`, installed CLI) and which one a consumer is expected to use daily.

## Notes

Blocked on infrastructure-r4mzp: its ADR settles (a) whether `/dashboard`
becomes pointer-only or stays a working fallback, (b) whether the CLI files
ship verbatim from the cache or are generated at install time, (c) the
exact rule that keeps the slash-command allowlist at two, and (d) how a plugin
update reaches the installed CLI and bridge — whether the user re-runs `/setup`
on a prompt (skew banner, `/dashboard` card) or the launch path itself notices
a newer cached version and offers the refresh. **The r4mzp worker appends those
answers here**; this task's own refinement starts from them.

Reference implementation for the CLI half: the builder's personal
`~/.local/bin/agentheim-dashboard{.mjs,.cmd,}` — same resolver walk as
`commands/dashboard.md`, `run(process.argv.slice(2))` on
`dashboard/resolve-launcher.mjs`. It already declares itself "callable from any
repo without Claude Code"; this task makes that true for everyone.

Do **not** revive the in-project shim (launcher deploying scripts into
`.agentheim/.dashboard/`, reverted 2026-07-09) — user-level only. See r4mzp's
Notes for what is and isn't known about that revert.

Open questions for this task's refinement: Windows `PATH` handling (is
`~/.local/bin` on `PATH` for a PowerShell user, or should `/setup` offer to add
it?); whether "both" should be the default choice; whether `/setup` should also
be what `brainstorm`'s first run points a fresh consumer at.
