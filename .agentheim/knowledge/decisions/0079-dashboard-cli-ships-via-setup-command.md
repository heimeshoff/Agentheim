---
id: ADR-0079
title: Ship the zero-token dashboard CLI to consumers via a `/setup` command; demote `/dashboard` to a pointer
scope: infrastructure
status: accepted
date: 2026-09-12
related_tasks: [infrastructure-r4mzp, infrastructure-x56qm]
related_adrs: [0002, 0018, 0053, 0059]
---

# ADR-0079: Ship the zero-token dashboard CLI to consumers via a `/setup` command; demote `/dashboard` to a pointer

## Context

`commands/dashboard.md` calls itself "a deliberate, documented slash-command exception to
Agentheim's phrasing-not-slash-commands principle: the dashboard is a process-launcher, not a
Socratic dialogue" (ADR-0002). That argument justified a slash command *over a phrasing*. It
never examined a third option: no model in the loop at all. Launching through `/dashboard`
costs two full-context model turns per invocation — **transcript-measured**
(infrastructure-k9t2v's Notes, not a remembered figure): turn 1 (reads the card, fires Bash)
59,405 input tokens (35,613 cache-read + 23,790 cache-write); turn 2 (reports the URL back)
60,000 (59,403 cache-read + 594 write). The command file itself is ~1,450 tokens of that first
turn — **~2.4%**. k9t2v already cut the card from 77 to 19 lines and de-duplicated the
bootstrap; that work was worth doing on its own terms (drift hazard, restated archaeology) but,
as k9t2v's own Notes said plainly, it **did not and structurally could not** touch the ~58k
session-baseline turn 1 pays regardless of card size, or the second turn every tool call costs.
Slimming the card was never a candidate fix for this cost; it is orthogonal.

Meanwhile a shell invocation of the same launcher returns in milliseconds. The builder already
runs one, personally: `~/.local/bin/agentheim-dashboard{.mjs,.cmd,<bash shim>}`, which locate
`dashboard/resolve-launcher.mjs` exactly the way the command card does (repo-local first, else
newest-semver plugin cache, `os.homedir()`-derived, never `$CLAUDE_PLUGIN_ROOT` — ADR-0002's
infrastructure-010 addendum) and delegate to its `run()`. Zero tokens, because no model reads a
prompt or a tool result to run it.

The project has already made this exact call once, for the mirror-image half of the same
lifecycle: **ADR-0053** removed the model from the dashboard's **stop** path ("a whole agent
session to reap a process… the model contributes nothing"), replacing a bridge-mediated
session-spawn with a direct `POST /api/stop`. This ADR is that same move applied to **launch**,
seven weeks later, for a reason ADR-0053 didn't have to face: launch, unlike stop, has no server
already running to receive a direct call — the model-free path has to be an install, not an
endpoint.

**The load-bearing asymmetry.** In the Agentheim repo, "just run the script by hand" is already
true — the builder's personal scripts exist. In a **consumer install**, they do not: those
scripts are personal, never shipped. And they cannot simply be shipped as `PATH` entries,
because **a Claude Code plugin cannot place anything on `PATH`** — it ships commands, skills,
agents, hooks, and MCP servers only (platform constraint, not an Agentheim choice). For a
consumer, `/dashboard` is today the *only* launch surface that exists; the plugin cache path
(`~/.claude/plugins/cache/agentheim/agentheim/<ver>/dashboard/launch.mjs`) is reachable by hand
but wholly undocumented as such. So the honest question was never "command or CLI" — it is
"what does the plugin ship to a consumer, and does an install step change what a consumer's
default surface should be?"

**The reverted in-project shim — engaged on the merits, not on a recovered rationale.** A prior
variant had the launcher deploy scripts into `.agentheim/.dashboard/` inside the consumer's own
project tree. It was built and reverted on 2026-07-09 **without ever being committed** — there
is no diff, no task file, and no ADR recording why. The only surviving trace anywhere in this
repo is one line in a modeling-session note: "first-launch chicken-and-egg trade-off" (confirmed
by grep across `.agentheim/board/` — that phrase and "shim" appear nowhere else). The builder,
asked directly during this task's refinement, could not recall further ("I don't remember
anymore"). This ADR does not, and must not, cite a revert rationale that isn't on record. It
instead treats two readings of that one surviving phrase as **hypotheses**, tests them against
the design below, and answers on the merits:

- *(a) The shim only existed after a first launch through the command, so the expensive path
  was still paid once per project.* A user-level `~/.local/bin` install is strictly better on
  this axis: paid **once per machine**, not once per project — every subsequent project on that
  machine reuses the same install for free, where a per-project shim would re-pay the cost on
  project two.
- *(b) The launcher writing executables into a consumer's tracked project tree was itself
  unwanted* (an unexpected file showing up under `.agentheim/`, however gitignored). A
  user-level install writes **nothing into any project** — the install target is exclusively
  the user's home directory, never a project path. This shape cannot recur by construction: the
  install step and the project the CLI is later run against are structurally independent.

Both hypothetical objections are answered by the same property — "user-level, once per
machine" — without this ADR claiming either was the actual 2026-07-09 reason.

## Decision

Adopt **disposition 3** from the task (ship a real CLI via a one-time user-level install; demote
`/dashboard`), as the builder already directed at refinement. Dispositions 1, 2, and 4 are
rejected below. What follows is what this ADR settles *inside* disposition 3.

### 1. Install surface: `/setup`, a second named exception to ADR-0002

A new slash command, `/setup`, is the install surface — the builder's explicit ask. It is
justified by **exactly** the argument ADR-0002 already made for `/dashboard`: a process-launcher
/ installer is not a Socratic dialogue, so a literal command is the right surface, not a
phrasing. `/setup` extends that exception rather than inventing a new one, and is paid **once
per machine** rather than once per launch — a strictly better amortization than `/dashboard`'s
own per-invocation cost. See the ADR-0002 addendum recording this extension.

**The bounding rule (ADR-0059: prose-only, unenforced).** "Slash commands are reserved for
process-launchers / installers" was already ADR-0002's prose rule; this ADR widens the allowlist
by exactly one member: `{ /dashboard, /setup }`. Per ADR-0059's mechanize-or-drop doctrine, a
two-member allowlist does not warrant a lint — the cost of writing and maintaining an enforcement
mechanism exceeds the risk a third slash command sneaks in unnoticed for a two-item list a human
reviews by eye. This is recorded explicitly as **prose-only, unenforced**, not an oversight.

### 2. Install target: user-level only, one directory, named across platforms

The CLI installs to `<home>/.local/bin` — computed via `os.homedir()` (the same,
env-independent derivation the resolver already uses) — **on every platform**, and **never**
into any project tree. Platform equivalents named explicitly:

- **POSIX (macOS/Linux):** `~/.local/bin` — the conventional XDG-adjacent user-script location.
- **Windows:** `%USERPROFILE%\.local\bin` — the *same* relative path under the user's home, not
  a Windows-idiomatic location (`%LOCALAPPDATA%\Programs`, Program Files, etc.). This is a
  deliberate choice, not an oversight: the builder's own reference implementation already lives
  there on a real Windows 11 box, proven working, and a single `path.join(os.homedir(), '.local',
  'bin')` formula needs no per-OS branching. `/setup`'s own PATH-remediation UX (whether it
  offers to add the directory to `PATH`) is left to infrastructure-x56qm's refinement — this ADR
  only fixes *where* the CLI goes, not how the user's `PATH` gets there.

This target is what answers §"the reverted shim" above on the merits — once per machine, nothing
written into any project.

### 3. Fate of `/dashboard`: pointer-only

`/dashboard` becomes a **static pointer**, not a working fallback: it prints (no launch attempt,
no Bash invocation of the launcher at all) `run agentheim-dashboard; run /setup if it isn't
installed` and nothing else.

**Why pointer-only over "keep it working as a fallback":** a fallback that still performs the
full ~120k-token launch leaves the *default habit* completely unchanged — nothing about a
working fallback nudges anyone off the expensive path merely because a cheap one now exists
alongside it. Pointer-only is the option that actually resolves the problem this ADR exists to
address, at the cost of one extra step for a consumer who hasn't yet run `/setup`. A consumer is
never left with **no** working launch path: `/setup` does not depend on the CLI already being
installed (it is the thing that installs it), so the two-step sequence `/setup` (once) →
`agentheim-dashboard` (forever after, zero tokens) is always reachable. The pointer text itself
names that sequence, so no consumer is stranded reading an opaque error.

### 4. What "the CLI" is: shipped verbatim, not generated at install time

The three files — `.mjs` logic, `.cmd` Windows wrapper, extensionless bash shim — are shipped
**verbatim** with the plugin (a `dashboard/cli/` directory mirroring the builder's personal
`~/.local/bin/agentheim-dashboard{.mjs,.cmd,}`) and `/setup` performs a **plain file copy** (plus
`chmod +x` on POSIX) into `<home>/.local/bin`. Nothing is templated or generated at install time.
This is possible, and simplest, precisely because the reference implementation already resolves
everything it needs **at run time**, not at install time: the cache root comes from
`os.homedir()`, the launcher path comes from a semver-max walk of the cache, and the project root
comes from `process.cwd()` walked up by the delegated `launch.mjs`. There is no install-time
constant (a path, a version, a project) that a generator would need to bake in. Shipping verbatim
means the shipped files and the tested reference implementation are byte-identical by
construction — no generator-vs-reference drift is possible, and a test can diff the two directly.

### 5. Re-runnability and the update trigger

`/setup` is re-runnable at any time (builder's explicit requirement, captured fully in
infrastructure-x56qm's acceptance criteria): it reports each option's current install state
(installed-at-version, or not installed) and lets the user add or remove either the CLI or the
bridge; re-running with an option already installed upgrades it in place to the newest cached
version.

**The trigger for re-running after a plugin update is user-prompted, not launch-path
self-detecting.** The CLI's *launcher resolution* already self-refreshes every run (it walks the
cache for the newest semver on every invocation); the only thing that can drift is the *copied
`.mjs`'s own interface*, if a future release changes the resolver's exported contract — a rare,
occasional event, not a per-launch concern. Building an active mechanism for the zero-token
launch path itself to detect a newer cached version and write a refresh into the user's `PATH`
directory is disproportionate machinery for that narrow case, and it would reintroduce exactly
the kind of "launcher writes to a location outside the immediate ask" surface this ADR otherwise
avoids. Instead: the dashboard's existing "older version" skew banner (already shipped for the
VS Code bridge, ADR-0018/infrastructure-v8r3q) and the (now pointer-only) `/dashboard` card both
name `/setup` as the remedy. This is the same low-machinery posture ADR-0053 chose for the stop
path (no `terminate()`/subprocess indirection where a direct call suffices) applied here: a
passive, visible prompt over an active self-healing mechanism, for a low-frequency event.

## Alternatives considered

- **Disposition 1 — keep `/dashboard` as-is.** Rejected: does not remove any of the measured
  cost; "paid once per session, mostly baseline anyway" (the task's own framing of this
  disposition) is true of the *second* turn's structural cost but not of the ~59k first-turn
  cost the command itself triggers, and ignores that the model contributes nothing to the actual
  work (parse a verb, paste a fixed string, read back two lines).
- **Disposition 2 — keep, and document a cheap path.** Rejected: a README-documented shell
  alias only helps someone already working in the Agentheim repo (where the cheap path already
  exists informally); it does nothing for a consumer, since a plugin cannot ship anything onto
  `PATH` for them to alias to. This leaves the actual asymmetry — consumer has no CLI at all —
  completely unaddressed.
- **Disposition 4 — retire `/dashboard` outright.** Only viable once consumers have a shipped
  alternative; with disposition 3 adopted, this collapses exactly into the "fate of `/dashboard`"
  bullet above (§3) rather than being a distinct option — pointer-only is a strictly softer
  version of retirement that still names the way forward instead of a bare 404.
- **`/dashboard` kept as a full working fallback (the other named option in §3).** Considered and
  rejected in favor of pointer-only — see §3's reasoning: it would leave the expensive default
  fully intact for anyone who doesn't proactively switch.
- **Generate the CLI files at install time (§4's alternative).** Rejected: there is no
  install-time-only value the reference implementation needs baked in (everything already
  resolves at run time from `os.homedir()`/`process.cwd()`/the cache), so generation would only
  add a second, divergence-prone implementation of logic that already exists and is tested.
- **Active launch-path self-detection of a newer cached version, auto-refreshing the installed
  CLI/bridge (§5's alternative).** Rejected as disproportionate machinery for a narrow,
  infrequent drift case; a passive prompt (skew banner + card pointer) is proportionate and
  consistent with ADR-0053's minimal-machinery precedent.

## Consequences

**Positive**

- A consumer gets a genuine zero-token daily launch path for the first time — the exact
  asymmetry the task opened with (repo-local convenience vs. consumer's total absence of one) is
  closed.
- `/dashboard`'s slash-command cost stops being the default habit: it becomes a one-line pointer,
  paid in a sliver of a turn, not a two-full-turn ~120k-token launch.
- The install cost (`/setup`) is paid once per machine, not once per launch — the same
  amortization argument that already justified `/dashboard` as a command in ADR-0002, now
  applied to the more favorable case of a one-time action.
- Extends, rather than re-litigates, two existing precedents: ADR-0053 (model removed from a
  dashboard lifecycle path) and ADR-0002's process-launcher exception (now a named, bounded
  two-member allowlist, ADR-0059-marked).
- The reverted in-project shim's two plausible failure shapes (paid-per-project;
  writes-into-project-tree) are both structurally impossible under a user-level, home-directory
  install — without this ADR ever claiming to know which one, if either, was the actual 2026-07-09
  reason.

**Negative**

- A brand-new consumer's *very first* dashboard launch still costs a full `/setup` invocation (a
  model turn) before the zero-token path exists — the win is amortized, not instant, exactly as
  `/setup` being "paid once per machine" implies.
- Two install targets (CLI files, VS Code `.vsix`) and their independent update cadences
  (self-refreshing resolver vs. a fixed installed extension) now both need `/setup` to track —
  scoped entirely to infrastructure-x56qm, not built by this ADR.
- `/dashboard` pointer-only is a real behavior change for anyone currently relying on it as a
  working launcher; the pointer text is the mitigation (it never leaves the user without a
  next step), but it is still a breaking change to the command's current contract.

**Neutral**

- The plugin still cannot place anything on `PATH` directly (an unchanged platform fact); the
  install step exists because of that constraint, not despite a preference for one.
- This ADR does not implement `/setup` — infrastructure-x56qm does, starting from the settlements
  above rather than re-deriving them.
