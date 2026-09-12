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

Idempotent: re-running `/setup` upgrades in place. It reports what it did and
what the user must still do by hand (add `~/.local/bin` to `PATH`, `chmod +x`,
reload VS Code).

## Acceptance criteria

- [ ] `commands/setup.md` exists and, like `commands/dashboard.md`, contains the resolver bootstrap exactly once (extend `lib/dashboard-command-bootstrap-dedup.mjs`'s lint or add a sibling), delegating to a shipped setup script rather than inlining install logic in the card.
- [ ] After "install CLI" on a machine with the plugin installed and no repo checkout, `agentheim-dashboard`, `agentheim-dashboard stop` and `agentheim-dashboard status` behave identically to the three `/dashboard` verbs, and `foreign-launch.test.mjs`-style end-to-end tests prove it against a foreign project.
- [ ] The install writes only under the user's home directory — a test asserts no file is created under the target project's tree (in particular nothing under `.agentheim/`).
- [ ] After "install bridge", `code --list-extensions` reports `agentheim.agentheim-bridge` at the version of the cached `.vsix`; re-running upgrades rather than refusing.
- [ ] `/setup` with no `code` on `PATH`, or no writable `~/.local/bin`, fails loud per option with a one-line remedy and still completes the other option.
- [ ] README's `/dashboard` table and the bridge `<details>` block point at `/setup` as the primary install path; the manual four-command sequence survives only as the "from source" alternative.
- [ ] The infrastructure BC README's "Launch / Stop" entry describes the three launch surfaces (repo-local, `/dashboard`, installed CLI) and which one a consumer is expected to use daily.

## Notes

Blocked on infrastructure-r4mzp: its ADR settles (a) whether `/dashboard`
becomes pointer-only or stays a working fallback, (b) whether the CLI files
ship verbatim from the cache or are generated at install time, and (c) the
exact rule that keeps the slash-command allowlist at two. **The r4mzp worker
appends those answers here**; this task's own refinement starts from them.

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
