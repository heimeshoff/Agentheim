---
description: Launch, stop, or check the status of the local Agentheim dashboard web UI.
argument-hint: "[stop|status]"
allowed-tools: Bash(node:*)
---

# /dashboard — the Agentheim dashboard launcher

Thin trigger over `launch.mjs` (ADR-0002 — one launcher, all OS differences confined there).
ADR-0002's addenda hold the rationale: env-independent `$CLAUDE_PLUGIN_ROOT` resolution
(infrastructure-010) and version-aware reuse/replace of a stale live server (infrastructure-rgknz).

Do not `cd` or re-implement launch/stop/status here — run this one Bash command, with the verb passed straight through as `$ARGUMENTS`:

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'dashboard','resolve-launcher.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'dashboard','resolve-launcher.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no Agentheim dashboard resolver found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.run(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" $ARGUMENTS
```

The launcher is detached; report its printed output verbatim — do not poll, do not open anything yourself, and run no further commands.
