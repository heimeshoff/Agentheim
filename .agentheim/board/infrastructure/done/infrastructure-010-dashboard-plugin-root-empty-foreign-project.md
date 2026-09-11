---
id: infrastructure-010
title: $CLAUDE_PLUGIN_ROOT is empty at /dashboard runtime — 008's fix collapses to the broken project path
status: done
type: bug
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: f74cd97
depends_on: []
blocks: []
tags: [dashboard, runtime, plugin, command, launcher, cross-project, plugin-root]
related_adrs: [ADR-0002]
related_research: []
prior_art: [infrastructure-008, infrastructure-004]
---

## Why

`infrastructure-008` "fixed" the `/agentheim:dashboard` command to invoke the launcher by
its plugin-rooted path:

```
node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"
```

The fix rested on an **unverified assumption** — that Claude Code populates
`$CLAUDE_PLUGIN_ROOT` in the command's Bash context when Agentheim runs as an installed
plugin. The 008 worker said so explicitly: it ran inside the Agentheim repo (not an
installed plugin), so it *could not observe* Claude Code's export.

**This session is the missing real-world test, and it fails.** Running plugin v0.8.3 from a
foreign consumer project (`jump_n_rogue/dorc`) on Windows 11:

```
❯ /agentheim:dashboard
● Bash(node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs")
  ⎿  Error: Cannot find module 'C:\src\jump_n_rogue\dorc\dashboard\launch.mjs'

● Bash(echo "CLAUDE_PLUGIN_ROOT=[$CLAUDE_PLUGIN_ROOT]")
  ⎿  CLAUDE_PLUGIN_ROOT=[]
```

The variable is **empty**. `${VAR:-.}` treats empty exactly like unset, so it collapses to
`.` → the consumer project root → the `\dorc\dashboard\launch.mjs` that doesn't exist.
**008's fix is inert in the exact case it was written to fix.** The agent recovered (again)
only by globbing the plugin cache and resolving
`~/.claude/plugins/cache/agentheim/agentheim/0.8.3/dashboard/launch.mjs` by hand — the
fragile, version-guessing improvisation 008 set out to eliminate. The dashboard, the
plugin's headline feature, is effectively unlaunchable from any real consumer project
without manual cache spelunking.

## What

Make `/agentheim:dashboard` (launch / stop / status) locate the launcher **without
depending on `$CLAUDE_PLUGIN_ROOT` being populated**, while still running with the consumer
project as cwd so project discovery resolves the foreign `.agentheim/`.

**Decided mechanism (architect, via orchestrator):** a small **Node resolver** the command
invokes — *not* shell cache-globbing in the card, *not* a self-locating launcher (the
launcher process never starts when the module isn't found, so it can't self-locate).

Add **`dashboard/resolve-launcher.mjs`** (stdlib-only) that:

1. Derives the plugin cache root **cross-platform from `os.homedir()`** (covers
   `%USERPROFILE%` and `$HOME` — never read the raw env vars):
   `<home>/.claude/plugins/cache/agentheim/agentheim`.
2. Lists version subdirs and picks the **maximum by semver** (~15-line comparator: split on
   `.`, numeric-compare each field; ignore non-semver dir names). Newest by *version*, not
   string order — `0.8.10 > 0.8.9 > 0.8.3`.
3. Resolves `<version>/dashboard/launch.mjs` and asserts it exists; if not, **fails loudly**
   with a clear `no cached launcher found under <path>` — the opposite of the `${VAR:-.}`
   silent collapse that caused this bug.
4. **`spawn`s the real launcher** (`process.execPath`, `[launcherPath, ...verbArgs]`) with
   **cwd inherited** (the consumer project) and `stdio: 'inherit'`, exiting with the child's
   code. This preserves the load-bearing **script-in-cache + cwd-in-project** split so
   `discoverRoot(process.cwd())` still finds the foreign `.agentheim/`. The verb passes
   through untouched.
5. When run **from the Agentheim repo itself**, finds the repo-local `launch.mjs` beside
   itself via `import.meta.url` (like `SERVE_ENTRY` already does) and skips the cache walk.

The resolver must **not** trust `$CLAUDE_PLUGIN_ROOT` for correctness. If the var *is* set
and points at a real launcher, it may be used as a fast-path (forward-compatible if Claude
Code ever populates it reliably), but correctness can never depend on it — that is the
entire lesson of the field failure.

Expose the pure helpers (`cacheRoot(homedir)`, `pickNewestVersion(dirNames)`,
`resolveLauncher(...)`) so they're unit-testable in isolation, mirroring infrastructure-009's
`helpers/card.mjs` pattern.

**The one open question for the worker to settle empirically (not the modeler):** locating
the *resolver file itself* from the card has the **same** empty-`$CLAUDE_PLUGIN_ROOT`
chicken-and-egg as locating the launcher — `${CLAUDE_PLUGIN_ROOT:-.}/dashboard/resolve-launcher.mjs`
is just as broken in the installed-empty case. So the card's entry point must be a **minimal,
env-free `node -e` bootstrap** that does only homedir→cache→newest-version→`import()` and
delegates to the resolver module for everything testable. The exact `node -e` form that
reaches the resolver cross-shell (PowerShell *and* bash, quoting/escaping) is the worker's to
finalize **against a real installed plugin** — see the verification note below.

## Acceptance criteria

- [ ] `commands/dashboard.md` invokes the launcher through the Node resolver for all three
      verbs; **no** verb depends on `$CLAUDE_PLUGIN_ROOT` being non-empty for correctness.
- [ ] `dashboard/resolve-launcher.mjs` (stdlib-only) derives the cache path from
      `os.homedir()` (working for both `%USERPROFILE%` and `$HOME`), selects the active
      version by **semver maximum** (proven: given `0.8.3`, `0.8.9`, `0.8.10` → picks
      `0.8.10`), resolves `<version>/dashboard/launch.mjs`, and **spawns it with cwd
      unchanged**, passing the verb through.
- [ ] The resolver **fails loudly** (clear message naming the searched cache path) when no
      cached launcher is found — it never silently falls back to a `.`-relative path.
- [ ] Running the card command with `CLAUDE_PLUGIN_ROOT` **unset/empty**, cwd in a foreign
      project (`.agentheim/` only, no `dashboard/`), launches with **no module-not-found and
      no manual cache spelunking**; the runfile lands under the **foreign** project's
      `.agentheim/.dashboard/runtime.json`. (This is the field-failure condition the old test
      never exercised.)
- [ ] `stop` and `status` work identically under the same empty-env, foreign-cwd condition.
- [ ] Running from the **Agentheim repo itself** (env unset, launcher beside `.agentheim/`)
      still works — the resolver finds the repo-local `launch.mjs` without touching the cache.
- [ ] Unit tests cover the resolver's pure parts in isolation: semver-max selection (incl.
      the `0.8.10 > 0.8.9` lexical trap and ignoring non-semver dir names), and
      homedir→cache-path derivation on both a `win32`-shaped and a POSIX-shaped homedir. No
      dependency on a real installed cache.
- [ ] The infrastructure-009 `foreign-launch` integration test is amended to run the card
      form with `CLAUDE_PLUGIN_ROOT` **deleted from the child env** (the regression-reproducing
      condition), instead of the current set-to-repo run.
- [ ] The static `command-card.test.mjs` guard is updated to assert the resolver-based
      invocation shape and to **fail** if a verb is rewritten to depend on a bare
      `${CLAUDE_PLUGIN_ROOT}` with no env-free fallback.
- [ ] An **ADR-0002 addendum** is written documenting the env-var-independent locator
      contract (homedir-derived cache path, semver-max version selection, fail-loud,
      cwd-preserving spawn).
- [ ] All tests stdlib-only; green on Windows and POSIX.

## Notes

- **Direct parent: infrastructure-008** (done, commit `a702143`, shipped v0.8.3). This task
  does not re-open it — it records that 008's central assumption was false in the field and
  supersedes its locator mechanism.
- **Sibling: infrastructure-004** — module-relative `assetRoot`; same project-root-assumption
  family, one layer down inside the launcher.
- **Test seam: infrastructure-009** — added the foreign-project integration test, but it ran
  the card form *with the env var set*, so it passed while the field failed. The amendment
  above (delete the var from the child env) converts it from "passed while the field failed"
  to actually reproducing the field condition.
- **ADR: write an ADR-0002 ADDENDUM, reversing 008's "no ADR" call.** 008 recorded "no ADR"
  precisely *because* it assumed `$CLAUDE_PLUGIN_ROOT` works — and that undocumented
  assumption is what failed. Env-var-independent cache resolution (semver-max, homedir-derived,
  fail-loud) is now a non-obvious, constraining runtime contract a future maintainer would want
  the reasoning for. Add it inline in `0002-dashboard-runtime-transport.md` under a new
  `## Addendum` section (dated 2026-06-08), using the `references/adr-template.md` shape. Do
  **not** mint a new ADR number — it's a sub-clause of the existing transport decision.

- **⚠ Verification realism — the reason this bug exists in the first place.** Whoever works
  this task runs in the Agentheim repo, NOT an installed plugin — the identical limitation
  that let 008 ship broken. So the worker can: (a) unit-test the resolver fully (semver,
  homedir derivation), and (b) *simulate* the foreign + empty-var case (temp project with only
  `.agentheim/`, `CLAUDE_PLUGIN_ROOT` deleted from the test child env). What the worker
  **cannot** do is observe a real Claude Code `/dashboard` command invocation against an
  installed plugin. The card's `node -e` bootstrap syntax (the one open question) and the true
  end-to-end behavior can only be confirmed by the **maintainer running it as an installed
  plugin after a release**. Do not mark this fully verified on simulation alone — flag the
  installed-plugin run as a post-release confirmation step, and resist 008's false-confidence
  pattern.

- **Platform facts (claude-code-guide):** `$CLAUDE_PLUGIN_ROOT` is documented as exported to
  *hook processes and MCP/LSP subprocesses*; there is a **doc gap** — no explicit statement it
  reaches command-card Bash tool calls, and it is empirically empty on Windows v0.8.3. The
  cache layout `~/.claude/plugins/cache/<source>/<plugin>/<version>/` is *described* but not a
  formal contract — treat it as a stable-in-practice implementation detail and fail loudly if
  it's absent. No alternative mechanism (manifest field, other env var) gives a command its own
  root; `${CLAUDE_PLUGIN_DATA}` is for state, `${CLAUDE_PROJECT_DIR}` is the project not the
  plugin. The worker should confirm the `agentheim/agentheim` source/plugin path segment
  against a live cache before trusting it.

- Reported environment: Windows 11 Home, Claude Code, plugin v0.8.3, consumer project
  `C:\src\jump_n_rogue\dorc`. Manual recovery path the agent used:
  `C:\Users\marco\.claude\plugins\cache\agentheim\agentheim\0.8.3\dashboard\launch.mjs`,
  launched successfully (pid 34064, port 62166) with the project as cwd.

## Files (for the worker)

- `commands/dashboard.md` — rewrite all three verb fences to invoke the resolver; replace the
  "`${CLAUDE_PLUGIN_ROOT:-.}` is correct in both contexts" prose with the truth (var may be
  empty in installed consumers; resolver finds the newest cached `launch.mjs` from the home
  cache; cwd stays the consumer project; do not `cd`).
- `dashboard/resolve-launcher.mjs` — **new**; resolver/bootstrapper with exported pure helpers.
- `dashboard/launch.mjs` — **no logic change**; `discoverRoot(process.cwd())` + `import.meta.url`
  already correct. Confirm the printed hint (`Stop it with: /dashboard stop`) stays right.
- `.agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md` — add `## Addendum`.
- `dashboard/test/foreign-launch.test.mjs` — amend to delete `CLAUDE_PLUGIN_ROOT` from the
  child env and exercise the resolver (the load-bearing test change).
- `dashboard/test/command-card.test.mjs` (+ `helpers/card.mjs`) — update predicates to the
  resolver shape; add resolver unit tests here or in a sibling `resolve-launcher.test.mjs`.
- `dashboard/README.md` and `.agentheim/contexts/infrastructure/README.md` — update the
  "Launcher location" notes to describe resolver-based, env-independent location.

## Outcome

Replaced the empty-`$CLAUDE_PLUGIN_ROOT` launcher locator with an
environment-variable-independent resolver. `/dashboard` now locates `launch.mjs`
from the home plugin cache, not from a variable that comes through empty in an
installed plugin's command Bash context.

**What changed:**
- **`dashboard/resolve-launcher.mjs`** (new, stdlib-only) — exports the pure helpers
  `cacheRoot(homedir)` (`<home>/.claude/plugins/cache/agentheim/agentheim`),
  `pickNewestVersion(dirNames)` (semver-max, numeric per field, ignores non-semver
  names — handles the `0.8.10 > 0.8.9 > 0.8.3` lexical trap), `resolveLauncher(cacheRoot)`
  (newest version dir whose `dashboard/launch.mjs` exists; **fails loud** naming the
  searched path, never a `.`-relative fallback), and `locateLauncher`/`run` (repo-local
  short-circuit via `import.meta.url`, else cache walk; spawns `launch.mjs` with cwd
  inherited + `stdio: 'inherit'`, exiting with the child's code).
- **`commands/dashboard.md`** — all three verbs now invoke a minimal, env-free `node -e`
  bootstrap (homedir→cache→newest-version→`import()`→`run()`). No verb references
  `$CLAUDE_PLUGIN_ROOT`. Prose rewritten to the env-independent contract.
- **`dashboard/launch.mjs`** — no logic change (confirmed the `/dashboard stop` hint
  stays correct; discovery already uses `process.cwd()` + `import.meta.url`).
- **ADR-0002** — added a dated `## Addendum` (2026-06-08) documenting the
  env-var-independent locator contract. No new ADR number.
- **Tests (all stdlib-only, `node --test`):**
  - `dashboard/test/resolve-launcher.test.mjs` (new, 14 unit tests) — semver-max incl.
    the lexical trap and non-semver filtering, homedir→cache derivation on a win32- and a
    POSIX-shaped homedir, fail-loud, repo-local short-circuit, cache fall-through.
  - `dashboard/test/foreign-launch.test.mjs` (amended) — now **deletes** `CLAUDE_PLUGIN_ROOT`
    from the child env and redirects `os.homedir()` (HOME/USERPROFILE) to a fake cache home
    linking the repo dashboard, reproducing the actual field condition; runs the literal card
    `node -e` form launch→status→stop and asserts the runfile lands under the foreign project.
  - `dashboard/test/command-card.test.mjs` + `helpers/card.mjs` (updated) — static guard now
    asserts the env-independent resolver shape (`isEnvIndependentResolver`), **fails** if any
    verb depends on `$CLAUDE_PLUGIN_ROOT`, and keeps Red-proof meta-tests for both the 008
    bare-relative and 010 env-dependent regression forms.
  - Full dashboard suite: **150/150 green** (was 132; +18).
- **READMEs** — `dashboard/README.md` and the infrastructure BC README launcher-location
  notes rewritten to the resolver-based, env-independent contract.

**Cross-shell bootstrap (the one open question):** settled empirically for the card's
authoritative execution context — `allowed-tools: Bash(node:*)`, i.e. **bash**. The JS body
uses single-quoted string literals inside a double-quoted `node -e "..."` arg; the only `$`
is the regex anchor `$/`, which bash leaves literal inside double quotes (verified). The
literal card form runs cleanly in bash (launch/status/stop). A native Windows-PowerShell
`/dashboard` run was not verifiable in this sandbox (pwsh shells invoked from bash mangled
the test harness's nested quoting), and is folded into the maintainer confirmation below.

**⚠ Verification realism (resisting 008's false-confidence pattern):** this worker ran in the
Agentheim **repo**, not an installed plugin. Fully covered here: the resolver unit tests, and
a faithful **simulation** of the foreign + empty-`$CLAUDE_PLUGIN_ROOT` field condition (temp
foreign project, var deleted from child env, `os.homedir()` redirected to a fake cache linking
the repo dashboard). **NOT** observable here: a real Claude Code `/dashboard` invocation
against an installed plugin, and the cross-shell `node -e` quoting under PowerShell.
**Post-release maintainer confirmation step:** after the next release, run `/dashboard`,
`/dashboard status`, `/dashboard stop` from a foreign consumer project on an installed plugin
(ideally once from a PowerShell terminal and once from a bash terminal) and confirm no
module-not-found and the runfile under the consumer project.

**Notes:** ADR-0002 `## Addendum` (env-independent locator contract). This task records that
008's central `$CLAUDE_PLUGIN_ROOT` assumption was false in the field and supersedes its
locator mechanism; 008's done file is left frozen.
