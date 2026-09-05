---
description: Launch, stop, or check the status of the local Agentheim dashboard web UI.
argument-hint: "[stop|status]"
allowed-tools: Bash(node:*)
---

# /dashboard — the Agentheim dashboard launcher

This is a deliberate, documented **slash-command exception** to Agentheim's
"phrasing, not slash commands" principle: the dashboard is a process-launcher,
not a Socratic dialogue, so a literal command is the right surface.

It is a thin trigger over the single cross-platform launcher `launch.mjs`
(ADR-0002 — one launcher, all OS differences confined there). Pass the verb
straight through; do not re-implement launch/stop/status logic here.

## Locating the launcher — env-independent, never via `$CLAUDE_PLUGIN_ROOT`

`launch.mjs` ships **inside this plugin's install dir**, not in the project you
are pointing the dashboard at. When Agentheim runs as an installed plugin against
a foreign codebase, there is **no** `dashboard/` folder beside that project's
`.agentheim/`.

The earlier fix reached the launcher via `${CLAUDE_PLUGIN_ROOT:-.}` — but that
variable comes through **empty** in the command's Bash context for an installed
plugin (verified in the field, v0.8.3), so `${VAR:-.}` collapses to `.` → the
consumer project → `Cannot find module`. **Correctness must never depend on that
variable** (infrastructure-010; ADR-0002 addendum).

Instead, a tiny inline `node -e` bootstrap derives the plugin cache path from
`os.homedir()` (`<home>/.claude/plugins/cache/agentheim/agentheim`), picks the
newest cached version by **semver** (`0.8.10 > 0.8.9 > 0.8.3`), imports
`dashboard/resolve-launcher.mjs` from there (or the repo-local copy when running
from the Agentheim repo), and that resolver spawns the real `launch.mjs`. The
launcher still runs with the **consumer project as the current working
directory** (the default) — it discovers the foreign `.agentheim/` by walking
**up from cwd**, so the script lives in the plugin cache while the project stays
the cwd. Do **not** `cd` anywhere; do **not** pass a project path. If no cached
launcher is found, the bootstrap **fails loudly** naming the searched path — it
never silently falls back to a `.`-relative path.

The argument (if any) is: `$ARGUMENTS`

Run **exactly one** Bash command based on that argument.

- No argument (empty) → launch (or reuse) the detached server and auto-open the
  browser:

  ```
  node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'dashboard','resolve-launcher.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'dashboard','resolve-launcher.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no Agentheim dashboard resolver found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.run(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});"
  ```

- `stop` → terminate the detached server and remove the runfile:

  ```
  node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'dashboard','resolve-launcher.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'dashboard','resolve-launcher.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no Agentheim dashboard resolver found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.run(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" stop
  ```

- `status` → report whether a server is running and on which port, without
  launching or stopping:

  ```
  node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'dashboard','resolve-launcher.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'dashboard','resolve-launcher.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no Agentheim dashboard resolver found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.run(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" status
  ```

The bootstrap touches **no** environment variable — it locates the launcher from
the home cache regardless of whether `$CLAUDE_PLUGIN_ROOT` is set. From the
Agentheim repo itself (where `dashboard/resolve-launcher.mjs` sits beside
`.agentheim/`) it uses the repo-local copy and skips the cache walk. If the
chosen verb fails with `no Agentheim dashboard resolver found`, the plugin cache
is missing or unreadable: report the error verbatim and stop — do **not** start
guessing or listing the plugin cache by hand.

The launcher is detached, so the command returns to a prompt immediately. Report
the printed URL / pid / status back to the builder verbatim — do not poll, do not
open anything yourself (auto-open is the launcher's job), and do not run any
further commands.

## Version-aware reuse — a live server is only reused if it serves the CURRENT plugin

`launch.mjs` no longer reuses any live server it finds by pid alone. It compares
the runfile's recorded `pluginVersion`/`pluginRoot` against the launcher's own
(the plugin version this bootstrap just resolved). A **mismatch** — including a
runfile written before this rule existed (missing the fields) or one whose
recorded `pluginRoot` no longer exists on disk (a cache dir removed on
update) — is treated as **replace, not reuse**: the outgoing process is stopped
through the existing stop path, a fresh one is launched from the current
plugin, and the reported verb is `replaced <old-version> → <new-version>`.
Equal versions still report `already running`. `status` prints the serving
version alongside pid/port so skew is visible without a launch attempt
(ADR-0002 addendum, infrastructure-rgknz). This is why "I updated the plugin
but the dashboard shows the old UI" self-heals on the next `/dashboard` call —
no manual `stop` is required.
