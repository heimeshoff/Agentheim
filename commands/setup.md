---
description: One-time, per-machine install of the zero-token Agentheim dashboard CLI and the VS Code bridge. Re-runnable at any time.
argument-hint: "[status|install cli|remove cli|install bridge|remove bridge]"
allowed-tools: Bash(node:*)
---

# /setup — install the Agentheim dashboard CLI

A second, named process-launcher/installer exception to the "phrasing, not slash
commands" rule (ADR-0002, extended by [ADR-0079](../.agentheim/knowledge/decisions/0079-dashboard-cli-ships-via-setup-command.md)):
this is an install action, not a Socratic dialogue. Paid once per machine, never
once per launch — see ADR-0079 for the full reasoning.

This command never prompts on stdin (a Bash tool call is non-interactive). Run
this one Bash command with the verb passed straight through as `$ARGUMENTS`:

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','setup-cli.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','setup-cli.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no setup-cli module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" $ARGUMENTS
```

Then act on the model side, conversationally — the script never presents a menu itself:

- **No argument** — run with `status`, read its one-line JSON, and summarize
  plainly: whether `agentheim-dashboard` is installed (current/stale/not-
  installed) and the VS Code bridge's install state (`bridge.state`:
  not-installed / installed-current / installed-stale / unknown — "unknown"
  means `code` itself isn't on PATH, distinct from "not-installed"). Ask the
  builder which they want installed/updated/removed, then re-run this Bash
  command once per choice with the explicit verb (e.g. `install cli`,
  `install bridge`, `remove cli`, `remove bridge`) — there is no `install both`
  and no default choice, so issue one call per option so each fails loud
  independently.
- **`status`** — print the JSON and summarize it plainly; make no writes.
- **`install cli`** — installs (or upgrades in place) the CLI into
  `<home>/.local/bin`. If the printed output names a PATH remedy, show it to
  the builder verbatim — this command never writes to PATH itself, only
  prints what the builder could run.
- **`remove cli`** — removes the three installed CLI files, nothing else.
- **`install bridge`** — installs (or upgrades in place) the VS Code bridge
  extension from the plugin's own shipped `.vsix`. Tell the builder to reload
  the VS Code window afterward — the printed output already names this, but a
  reload is what actually activates the new build.
- **`remove bridge`** — uninstalls the VS Code bridge extension. Same reload
  note applies.

After a successful `install cli`, the daily launch path is `agentheim-dashboard`
(`agentheim-dashboard stop` / `agentheim-dashboard status`) run directly from a
shell — no Claude Code turn, no `/dashboard` invocation needed. After a
successful `install bridge`, the board's launch buttons open a real terminal
once the window is reloaded (see the root README's VS Code bridge section).
