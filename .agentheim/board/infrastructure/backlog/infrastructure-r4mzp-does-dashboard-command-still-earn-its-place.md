---
id: infrastructure-r4mzp
title: Does `/dashboard` still earn its place as a slash command, now that launching the dashboard costs ~120k tokens across two turns while a shell invocation costs zero?
status: backlog
type: decision
context: infrastructure
created: 2026-09-11
completed:
depends_on: []
blocks: [infrastructure-x56qm]
tags: [dashboard, commands, context-budget, surface]
related_adrs: [0002, 0018, 0053]
related_research: []
prior_art: [infrastructure-008, infrastructure-010, infrastructure-k9t2v]
---

## Why

`commands/dashboard.md` opens by calling itself "a deliberate, documented
slash-command exception to Agentheim's phrasing-not-slash-commands principle:
the dashboard is a process-launcher, not a Socratic dialogue, so a literal
command is the right surface."

That argument justified a *slash command over a phrasing*. It never examined the
third option — **no model in the loop at all**. Launching through the agent costs
two full-context turns (~120k input tokens billed, measured — see
infrastructure-k9t2v's Notes) to run a script that returns in milliseconds when
invoked directly. The model contributes nothing to the launch: it reads a verb,
pastes a fixed string, and reads back two lines of output.

The builder raised this after watching a launch cost 60k.

The project has already made this call once, for the other half of the same
lifecycle: agentic-workflow-h4n2v / ADR-0053 removed the model from the
dashboard's **stop** path ("a whole agent session to reap a process" — the Stop
menu item now POSTs `/api/stop` directly). Launch is the mirror image and has
never had the same treatment.

## What

Decide the disposition of `/dashboard` and record it as an ADR. The load-bearing
asymmetry to resolve:

- **In the Agentheim repo**, the builder already has personal
  `agentheim-dashboard` scripts in `~/.local/bin` (an `.mjs` that inlines the
  same homedir→cache→semver-max resolver walk as the command card, plus a `.cmd`
  and a bash shim). Zero tokens. This is why "starting the script by hand runs
  immediately."
- **In a consumer install**, those scripts do not exist — they are personal, not
  shipped. A Claude Code plugin cannot place anything on `PATH`; it ships
  commands, skills, agents, hooks and MCP servers only. For a consumer,
  `/dashboard` is currently the *only* surface there is, and the plugin cache
  (`~/.claude/plugins/cache/agentheim/agentheim/<ver>/dashboard/launch.mjs`) is
  reachable by hand but undocumented as a launch path.

So the honest question is not "command or CLI" but "what does the plugin ship to
a consumer, and does the repo-local case deserve a cheaper path alongside it?"

**Builder direction (2026-09-12 refinement, see Notes):** the zero-token CLI
*should* ship to consumers, through a new **`/setup`** command that offers a
one-time, per-machine install of the CLI and/or the VS Code bridge. The ADR
therefore starts from disposition 3 below and must settle what remains open
inside it, rather than re-weighing 1–4 from scratch. Dispositions 1, 2 and 4 are
kept here as the alternatives the ADR records and rejects with reasons.

Candidate dispositions:

1. **Keep as-is.** The command is a consumer's only entry point; the cost is
   paid once per session and is mostly session baseline anyway.
2. **Keep, and document the cheap path.** Command stays for consumers; the
   README names a shell alias / npm script for anyone working in a repo, so the
   expensive route stops being the default for daily use.
3. **Ship a real CLI via a one-time user-level install, and demote `/dashboard`
   to a pointer or fallback.** The builder's chosen direction. What the ADR must
   still settle within it:
   - *Install surface:* a `/setup` slash command (builder's ask) — a second
     process-launcher exception to "phrasing, not slash commands", justified by
     the same argument ADR-0002 made for `/dashboard`, and paid once per machine
     rather than once per launch. The ADR extends ADR-0002's exception to cover
     it explicitly.
   - *Install target:* user-level (`~/.local/bin` or the platform equivalent),
     **never** the consumer's project tree. The in-project shim variant
     (launcher writes scripts into `.agentheim/.dashboard/`) was built and
     reverted on 2026-07-09 — see Notes on what is and isn't known about why.
   - *Fate of `/dashboard`:* pointer-only (prints "run `agentheim-dashboard`;
     run `/setup` if it isn't installed"), or kept as a working fallback for a
     consumer who hasn't run `/setup`. Either is acceptable; the ADR picks one
     and says why. A consumer must never be left with *no* working launch path.
   - *What "the CLI" is:* the existing personal scripts are the reference
     implementation (three files: `.mjs` logic, `.cmd` for Windows, bash shim for
     Git Bash / macOS / Linux). The ADR states whether the plugin ships them
     as-is from the cache or generates them at install time.
4. **Retire the command.** Only viable if consumers get a shipped alternative;
   with disposition 3 this collapses into the "fate of `/dashboard`" bullet.

## Acceptance criteria

- [ ] An ADR in `.agentheim/knowledge/decisions/` records the disposition and its reasoning, and is linked from this task (`related_adrs`) and from ADR-0002 (an addendum or a backlink line).
- [ ] The ADR states explicitly what launch surface a **consumer install** has, separately from what the Agentheim repo has — the two cases must not be collapsed — and names the fact that a Claude Code plugin cannot put a binary on `PATH`, which is why an install step exists at all.
- [ ] The ADR engages with the reverted in-project shim (launcher deploying scripts into `.agentheim/.dashboard/`, reverted 2026-07-09): it records that the revert's reasoning is **not documented** anywhere in the repo (the only surviving note is "first-launch chicken-and-egg trade-off"), and argues on the merits why a user-level, once-per-machine install does not reintroduce that shape — it must not cite a revert rationale as if it were on record.
- [ ] The ADR carries the measured token cost (infrastructure-k9t2v's Notes table, transcript-sourced) as its evidence base, not a remembered figure, and states plainly that the command-card slimming already shipped (k9t2v) did not and could not address it.
- [ ] The ADR names ADR-0053 (runtime self-lifecycle: the model was already removed from the dashboard's stop path) as the precedent it extends to launch.
- [ ] The ADR extends ADR-0002's "process-launcher slash-command exception" to cover `/setup`, and states the rule that keeps it bounded — prose-only, unenforced (ADR-0059 marker; see Notes).
- [ ] The follow-up implementation task infrastructure-x56qm (`/setup` command) exists in `backlog/`, depends on this task, and its Notes are updated with whatever the ADR settled from the "what the ADR must still settle" list above, so its own refinement starts from the decision rather than re-deriving it.

## Notes

Deliberately **not** blocked on infrastructure-k9t2v (now done), and never was:
the slim-down was worth having whether or not the command survives.

**Builder answers recorded at the 2026-09-12 refinement** (these are the
judgment inputs the ADR is written from; the worker does not re-ask them):

1. *Should other users get the `~/.local/bin` launcher?* — **Yes, ship it to
   consumers.** Not a personal convenience.
2. *Why was the in-project shim reverted on 2026-07-09?* — **"I don't remember
   anymore."** The revert is not in git history (it was never committed) and
   the only surviving record is a one-line session note: "first-launch
   chicken-and-egg trade-off". Two plausible readings, neither confirmed: (a)
   the shim only existed after a first launch *through the command*, so the
   expensive path was still paid once per project; (b) the launcher writing
   executables into a consumer's `.agentheim/` tree was unwanted. The ADR
   treats both as hypotheses and answers them on the merits — a user-level
   install is paid once per machine (answers a) and writes nothing into any
   project (answers b) — without claiming either was the actual reason.
3. *Is a one-time user-level install a valid candidate?* — **Yes: there should
   be a `/setup` command** that gives the user the choice to install the CLI
   and/or the VS Code bridge. The bridge half already exists as a prebuilt
   `.vsix` under `vscode-extension/` (shipped in the plugin cache) whose
   install today is a four-command manual sequence in the README; `/setup`
   folds that in. Captured as infrastructure-x56qm.

**Convention check (ADR-0059):** the one convention this decision touches —
"slash commands are reserved for process-launchers / installers" — is
ADR-0002's existing prose rule, and the ADR only widens it by one named command.
**Prose-only, unenforced.** No lint is warranted for a two-member allowlist.

**Evidence base** (do not re-measure from memory): infrastructure-k9t2v Notes —
turn 1 59,405 input tokens (35,613 cache-read + 23,790 cache-write), turn 2
60,000 (59,403 cache-read + 594 write); the command card itself is ~1,450 of
turn 1 (~2.4%), the remainder is session baseline plus the structural second
turn every tool call costs.

**What the worker delivers:** the ADR (type: decision — output is markdown, not
code), the ADR-0002 backlink, this task's `related_adrs` update, and the Notes
update on infrastructure-x56qm. It does **not** implement `/setup`.
