# Conductor-executed `lib/` helper bootstrap

Every conductor-executed `lib/` helper needs to be **runnable from a consumer install**, where
`lib/` is not at `process.cwd()` (Agentheim installed as a plugin, not checked out as the project
itself). The resolution scheme is `lib/resolve-plugin-file.mjs`'s homedir→cache→semver-max walk
(infrastructure-010), already used verbatim by the `claim`/`complete`/`promote` CLI invocations
and the protocol-rotation / index-rotation checks (`skills/work/SKILL.md`, `skills/modeling/
SKILL.md`). **Do not invent a second resolution scheme.** This file exists so the four
conductor-executed helpers that landed without a runnable call-site invocation —
`lib/adr-allocation.mjs`, `lib/session-start-churn.mjs`, `lib/vacuum-guard.mjs`,
`lib/worktree-salvage.mjs` (agentic-workflow-b4yrm) — get one shared, worked-out reference instead
of five near-duplicate one-liners scattered through skill prose.

Unlike `task-lifecycle-cli.mjs` / `protocol-rotation.mjs` / `index-rotation.mjs`, none of these
four modules ships its own CLI `main(argv)` entrypoint — they are plain function exports, unit
tested directly. The bootstrap below therefore has two parts: the **resolution boilerplate**
(verbatim shape, parameterized only by the target `relPath` and a human `<LABEL>` for the
fail-loud message) and a **call tail** that imports the resolved module and invokes the specific
function(s) that call site needs, printing JSON (or the already-formatted text) to stdout.

## Resolution boilerplate (verbatim shape — do not modify)

```js
const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');
const sv=/^(\d+)\.(\d+)\.(\d+)$/;
const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');
const cand=[p.join(process.cwd(),'lib','<RELPATH>')];
let vs=[];
try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}
for(const v of vs)cand.push(p.join(c,v,'lib','<RELPATH>'));
const r=cand.find(fs.existsSync);
if(!r){console.error('no <LABEL> found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}
```

`<RELPATH>` is the module's path relative to the plugin/repo root (e.g. `adr-allocation.mjs`,
under `lib/`); `<LABEL>` is a short human label for the fail-loud message. This is the exact
boilerplate already embedded in the `node -e` one-liners at `skills/work/SKILL.md`'s protocol-
rotation check, INDEX done-list rotation check, and `skills/modeling/SKILL.md`'s PROMOTE step 3 —
copied here once so the four invocations below don't each restate it.

Text-blob arguments (a `protocol.md` excerpt, a `git log` capture, `vision.md`'s contents) are
passed as **file paths** via `process.argv`, read inside the script with `fs.readFileSync`, rather
than embedded as inline argv strings — this avoids shell-quoting and argv-length problems on both
POSIX and Windows shells and keeps every invocation below a single copy-pasteable line. When the
conductor already holds the text in memory (e.g. the protocol excerpt from Phase 2 step 3), write
it to a scratch file first (any path is fine — nothing here is a lifecycle write).

## 1. `lib/adr-allocation.mjs` — `finalizeAdrNumbering`

Call site: `skills/work/SKILL.md`'s "Index updates" section, ADR-finalization step. Args:
`decisionsDir` (absolute path to `.agentheim/knowledge/decisions/` on `main`) and the
`ADRS_WRITTEN` filenames as a JSON array.

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','adr-allocation.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','adr-allocation.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no adr-allocation module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{console.log(JSON.stringify(m.finalizeAdrNumbering(process.argv[1], JSON.parse(process.argv[2]))))}).catch(e=>{console.error(e.message);process.exit(1)});" "<decisionsDir>" '["0059-slug-one.md","0060-slug-two.md"]'
```

Prints `{changed: string[], renumbered: [...]}` — same shape the prose already documents.

## 2. `lib/session-start-churn.mjs` — session-start human-churn reconciliation

Two calls, matching the two steps in `skills/work/SKILL.md`'s "Session-start human-churn
reconciliation" section.

**Step 1 — `resolveSinceLastSessionEnd`** (arg: absolute path to `protocol.md`, or a scratch file
holding its already-read leading excerpt):

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','session-start-churn.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','session-start-churn.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no session-start-churn module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{const txt=fs.readFileSync(process.argv[1],'utf8');console.log(JSON.stringify(m.resolveSinceLastSessionEnd(txt)))}).catch(e=>{console.error(e.message);process.exit(1)});" "<path-to-protocol.md>"
```

Prints `{since, heading}` or `null`. `null` is the SKIP-SILENTLY signal (see the skill prose).

**Step 3 — `parseCommitLog` + `findUntrailedCommits` + `formatHumanChurnSummary`** (arg: a scratch
file holding the `git log --since="<since>" --name-only --format="%x1eCOMMIT%x1f%H%x1f%s"` capture
— the conductor writes that command's stdout to a scratch file first, since the git read itself
stays a conductor prose step per ADR-0038, never a `lib/` call):

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','session-start-churn.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','session-start-churn.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no session-start-churn module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{const raw=fs.readFileSync(process.argv[1],'utf8');const commits=m.parseCommitLog(raw);const untrailed=m.findUntrailedCommits(commits);console.log(m.formatHumanChurnSummary(untrailed));console.log('---JSON---');console.log(JSON.stringify(untrailed))}).catch(e=>{console.error(e.message);process.exit(1)});" "<path-to-git-log-capture>"
```

Prints the formatted advisory text, then a `---JSON---` marker, then the raw `untrailedCommits`
array (each `{sha, subject, files}`) so the skill's governed-file judgment step (step 4, prose,
not mechanized) has structured data to reason over.

## 3. `lib/vacuum-guard.mjs` — two independent call sites

**Vacuum guard (`extractOpenQuestions` + `formatVacuumGuardLine`)** — `skills/work/SKILL.md`
Phase 2 step 8, and `skills/modeling/SKILL.md`'s Opening flow step 2. Arg: absolute path to
`vision.md`.

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','vacuum-guard.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','vacuum-guard.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no vacuum-guard module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{const text=fs.readFileSync(process.argv[1],'utf8');const items=m.extractOpenQuestions(text);console.log(JSON.stringify(items));console.log('---');console.log(m.formatVacuumGuardLine(items))}).catch(e=>{console.error(e.message);process.exit(1)});" "<path-to-vision.md>"
```

Prints the raw `openQuestions` array, a `---` separator, then the formatted advisory line.

**Batch-mix classification (`formatBatchMixLine`)** — `skills/work/SKILL.md` end-of-run step 6.
Arg: a JSON array of `{type, files}` for the session's completed tasks (already in the
conductor's hands — `type` from each task's frontmatter, `files` from its worker `FILE_LIST`).

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','vacuum-guard.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','vacuum-guard.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no vacuum-guard module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{const tasks=JSON.parse(process.argv[1]);console.log(m.formatBatchMixLine(tasks))}).catch(e=>{console.error(e.message);process.exit(1)});" '[{"type":"feature","files":["..."]},{"type":"chore","files":["..."]}]'
```

Prints the one-line mix string (e.g. `62% product-facing / 25% harness / 13% bookkeeping (8
tasks)`, or `none — no tasks completed this session`).

## 4. `lib/worktree-salvage.mjs` — `ensureSalvageDir` + `salvagePatchPath` + `formatSalvageReference`

Call site: `skills/work/SKILL.md`'s "Salvaging a worktree's diff before abandonment" section.
Args: `salvageRoot` (`<repo-root>/.agentheim/salvage`), `taskId`, and `tag` (`escalated-iterN`,
`bounced`, or `discarded` — the skill prose composes `escalationTag(N)` inline where `N` is
known, or passes the literal `BOUNCE_TAG`/`DISCARD_TAG` string value).

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','worktree-salvage.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','worktree-salvage.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no worktree-salvage module found under '+c+' (is the Agentheim plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>{const root=m.ensureSalvageDir(process.argv[1]);const patchPath=m.salvagePatchPath(root, process.argv[2], process.argv[3]);console.log(patchPath);console.log(m.formatSalvageReference(patchPath))}).catch(e=>{console.error(e.message);process.exit(1)});" "<repo-root>/.agentheim/salvage" "<task-id>" "<tag>"
```

Prints the resolved patch path, then the `formatSalvageReference` wording for the task's
`## Salvage note` / the abandonment message. The actual `git diff` capture into `<patch-path>`
stays the separate, conductor-only git command the skill prose already documents — this
invocation only resolves the storage path/filename convention, exactly as the module's own
git-free boundary (ADR-0038) requires.
