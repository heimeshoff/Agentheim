---
id: infrastructure-008
title: Dashboard command must invoke the launcher by plugin path, not project-relative
status: done
type: bug
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: a702143
depends_on: []
blocks: []
tags: [dashboard, runtime, plugin, command, launcher, cross-project]
related_adrs: [ADR-0002]
related_research: []
prior_art: [infrastructure-004, infrastructure-001]
---

## Why

The `/agentheim:dashboard` command card (`commands/dashboard.md`) tells the agent to run
the launcher **project-relative, from the project root**:

```
node dashboard/launch.mjs
```

That path only exists when Agentheim runs against **its own repo** (where `dashboard/`
sits beside `.agentheim/`). In any **foreign consumer project** — the normal case, an
installed plugin pointed at someone else's codebase — there is no `dashboard/` in the
project, so the command fails:

```
Error: Cannot find module 'C:\src\jump_n_rogue\dorc\dashboard\launch.mjs'
```

The agent then has to *recover by hand*: search the repo, discover the launcher ships
with the plugin not the project, list the plugin cache, work out which cached version is
active, and finally run it from
`~/.claude/plugins/cache/agentheim/agentheim/<version>/dashboard/launch.mjs`. That worked
once by improvisation, but it is fragile (version-guessing), slow, and not what the
command card instructs — the card is simply wrong for every real consumer.

This is the **command-invocation sibling of infrastructure-004**. That bug fixed the
launcher's *internal* asset resolution so `server.mjs` finds its `dist/` module-relative
instead of project-relative. The same project-root assumption survives one layer up, at
the **slash-command → launcher** seam: the command still hard-codes a project-relative
launcher path. ADR-0002's "one cross-platform launcher" only helps if the command can
actually *locate* that launcher from a foreign cwd.

## What

Make the command invoke the launcher by its **plugin install location**, independent of
the project the dashboard points at — so it works identically against a foreign project
and against the Agentheim repo itself.

Likely fix: Claude Code exposes **`${CLAUDE_PLUGIN_ROOT}`** to plugin command/hook
contexts, resolving to the plugin's install dir (the active cached version). Use it for
all three verbs, e.g.:

```
node "${CLAUDE_PLUGIN_ROOT}/dashboard/launch.mjs"
node "${CLAUDE_PLUGIN_ROOT}/dashboard/launch.mjs" stop
node "${CLAUDE_PLUGIN_ROOT}/dashboard/launch.mjs" status
```

The launcher must still be **run with the project as cwd** (or otherwise able to discover
the foreign `.agentheim/`): project discovery walks up from the invocation directory, so
the *script* path may live in the plugin cache while the *working directory* stays the
consumer project. Confirm this split holds — script-in-cache + cwd-in-project — and that
launch/stop/status all still find the right `.agentheim/` and runfile.

Also update the prose in `commands/dashboard.md`: the "from the project root" /
`node dashboard/launch.mjs` framing and the "do not re-implement launch/stop/status"
note should reflect the plugin-path invocation, so the agent reads a card that is correct
on first run and never has to improvise the cache lookup.

## Acceptance criteria

- [ ] `commands/dashboard.md` invokes the launcher via a plugin-rooted path (no bare
      project-relative `dashboard/launch.mjs`) for all three verbs (launch / stop /
      status).
- [ ] `${CLAUDE_PLUGIN_ROOT}` (or whatever the verified-correct mechanism is) actually
      interpolates in the command body — confirmed, not assumed. If it does **not**
      interpolate in command markdown, the task documents the working alternative
      (e.g. instruct the agent to resolve the active plugin-cache path) and uses it.
- [ ] Running `/agentheim:dashboard` (no arg) in a **foreign consumer project** launches
      the dashboard with **no module-not-found error and no manual cache spelunking**.
- [ ] The launched server still discovers the **consumer project's** `.agentheim/`
      (project discovery walks up from cwd; script location in the cache does not break
      it) and writes its runfile under that project.
- [ ] `stop` and `status` work the same way against a foreign project.
- [ ] Running against the Agentheim repo itself still works (no regression).
- [ ] The command's prose no longer says "from the project root" in a way that implies a
      project-relative launcher path.

## Notes

- Reported from a real session in an unrelated consumer project (`jump_n_rogue/dorc`):
  `/agentheim:dashboard` → `Cannot find module '...\dorc\dashboard\launch.mjs'`; the
  agent recovered only by listing the plugin cache and guessing the active version
  (0.8.0 vs 0.8.2). The recovery output is the capture source for this task.
- Sibling fix: **infrastructure-004** (module-relative `defaultAssetRoot`) — same
  project-root-assumption bug, one layer down inside the launcher. This task fixes the
  *command's* assumption; that one fixed the *server's*. Worth reading its Outcome for
  the `import.meta.url` / cache-vs-project separation precedent.
- Governing decision: **ADR-0002** (one cross-platform `launch.mjs`, all OS differences
  confined there). This task does not change the launcher contract — only how the command
  *locates* it. If the verified mechanism turns out to need a documented runtime-contract
  note (e.g. "the command resolves the launcher from the plugin root"), add an ADR-0002
  addendum and update `dashboard/README.md`; otherwise no ADR.
- Open question for the worker to settle, not the modeler: does `${CLAUDE_PLUGIN_ROOT}`
  expand inside a `command` markdown body under `allowed-tools: Bash(node:*)`? If yes,
  the fix is a one-line-per-verb path change. If no, fall back to instructing the agent
  to resolve the active cached launcher path deterministically (newest installed version),
  and capture that as the mechanism.

## Outcome

**Mechanism settled (the open question):** `$CLAUDE_PLUGIN_ROOT` is an **environment
variable** Claude Code exports into a plugin command's *shell* execution context — it is
**not** command-body `$ARGUMENTS`-style templating. So it expands in the Bash command line,
not in the markdown prose. Under `allowed-tools: Bash(node:*)` the three verbs now run:

```
node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"          # launch
node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs" stop
node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs" status
```

The `:-.` default makes the same command correct in both contexts: it resolves to the
plugin install dir when installed (var set), and to `.` (the current project) when run from
the Agentheim repo itself during development (var unset, launcher beside `.agentheim/`).
Because the worker runs in the Agentheim repo (not an installed plugin), I could not
execute an end-to-end installed-plugin run to *observe* Claude Code's export; the mechanism
is the documented `$CLAUDE_PLUGIN_ROOT` contract plus a defensive in-repo fallback, and the
**shell expansion itself** was verified directly (set → plugin dir; unset → `.`).

**Foreign-project behavior verified by simulation:** in a temp project with `.agentheim/`
but **no `dashboard/` folder**, with cwd in that project and the launcher invoked by an
absolute (cache-like) path, the full launch → status → stop cycle worked with no
module-not-found error and no manual cache spelunking; the runfile was written under the
**foreign** project's `.agentheim/.dashboard/runtime.json`. This confirms the load-bearing
split: script-in-cache + cwd-in-project, discovery via `discoverRoot(process.cwd())`.

**Files:**
- `commands/dashboard.md` — rewrote the invocation for all three verbs to the plugin-rooted
  path; replaced the "from the project root" / `node dashboard/launch.mjs` framing with a
  "the launcher ships with the plugin, not the project" explanation; kept the "do not
  re-implement / do not cd / report errors verbatim" guidance and corrected it.
- `dashboard/launch.mjs` — fixed the one stale project-relative hint the launcher prints
  after a successful launch (`Stop it with: node dashboard/launch.mjs stop` →
  `Stop it with: /dashboard stop`), so a foreign launch no longer echoes the broken path.
- `dashboard/README.md` — new "Launcher location" section under Usage.
- `.agentheim/contexts/infrastructure/README.md` — Launch/Stop ubiquitous-language entry now
  records the plugin-rooted-invocation + cwd-in-project contract.

**No ADR:** like its sibling infrastructure-004, this fixes a project-root *assumption*
without changing the ADR-0002 launcher contract ("one launcher"; "discovery walks up from
the invocation directory"). Plugin-rooted invocation is the natural consequence of that
already-decided contract, so no addendum was needed — documented in both READMEs instead.

**Tests:** no new test added. The fix lives in a markdown command card (no command-card test
infrastructure exists in this project) and a one-line print-string correction in the
launcher; the existing dashboard suite (124 tests) still passes. The behavioral guarantee
(foreign-cwd + plugin-path launch/status/stop) was verified by an ad-hoc end-to-end
simulation rather than a committed test. Backlog item filed to add command-card test infra.
