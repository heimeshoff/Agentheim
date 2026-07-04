---
name: work
description: Use whenever the user wants work executed on the todo backlog — running tasks, building features, implementing what has already been modeled. Triggers on phrases like "start working", "execute the todo", "work on it", "build it", "implement the backlog", "let's go", "run the workers", "pick up where you left off", "ship what's ready". Spawns parallel worker sub-agents that resolve task dependencies and claim ready tasks from `contexts/*/todo/`. Workers follow TDD per `skills/test-driven-development/SKILL.md`. Every worker SUCCESS goes through a `verifier` agent (see `skills/verification-before-completion/SKILL.md`) before commit — failed verification re-dispatches the worker up to twice, then escalates to the user. New tasks promoted to todo during the run are picked up automatically as they become ready. Does not do modeling — only executes already-refined tasks.
hooks:
  Stop:
    - hooks:
        - type: command
          command: "node -e \"const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\\d+)\\.(\\d+)\\.(\\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','hook-agent-signal.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','hook-agent-signal.mjs'));const r=cand.find(fs.existsSync);if(r){import(u.pathToFileURL(r).href).then(m=>{try{m.runHook(process.argv[1])}catch{}process.exit(0)}).catch(()=>process.exit(0))}else{process.exit(0)}\" session-heartbeat"
---

# Work — Parallel Dependency-Aware Worker Loop

The `work` skill turns refined `todo/` tasks into real code and real decisions. It is a loop, not a one-shot: it keeps going until todo is empty (or the user stops it), and it picks up tasks added mid-run.

**The conductor (you) never writes code.** You coordinate: scan, build the DAG, dispatch workers, commit, log. Keeping you lean prevents context exhaustion across long batches. All coding work is delegated to subagents.

**Git model: per-worker worktree isolation (ADR-0032).** Every parallel worker runs in its own git worktree on a private branch — never the shared main tree. Git's own 3-way merge is the conflict detector at integration time, not a prose scan at dispatch time; the verifier's test run is isolated from every sibling worker's uncommitted changes. `main` is written only by the conductor, only sequentially, exactly as ADR-0026 already required — this strengthens that invariant, it does not relax it. See "Phase 4: Batch dispatch" and "Git authority" below for the full choreography.

**Live observability (ADR-0043, agentic-workflow-m9w5c).** This skill's own `Stop` hook (frontmatter above) fires on every orchestrator turn while `work` is active and heartbeats `.agentheim/state/in-flight.json` — a git-ignored ADVISORY artifact (ADR-0027's category), never a lifecycle write. `agents/worker.md` and `agents/verifier.md` carry their own `Stop` hook (auto-converted to `SubagentStop` when that subagent finishes) recording each completion. The dashboard's `InFlightLane` reads this artifact read-only (ADR-0017) and self-suppresses once the heartbeat goes stale — no zombie lane survives a crashed/killed session. This is pure side-channel observability: it changes nothing about how `work` dispatches, verifies, or commits.

## Phase 1: Recovery check

Before anything else, look at `contexts/*/doing/` **and**, if this is a git repo, run `git worktree list --porcelain` (an orphaned `aw/<task-id>` worktree is the other half of the interrupted-session signal, alongside a stranded `doing/` task):

- **0 tasks, 0 non-main worktrees** → proceed to Phase 2.
- **1 task** → a previous session was interrupted. Resume it sequentially as the first task of this session, *before* starting any parallel dispatch. If a worktree + branch `aw/<task-id>` already exists for it (a FAIL-iteration interruption), reuse that worktree — do not create a second one. If no worktree exists (the batch-start commit landed but dispatch never happened), create one fresh: `git worktree add -b aw/<task-id> .worktrees/<task-id> HEAD`.
- **2+ tasks** → a previous parallel session was interrupted. Ask the user: "Resume all in parallel", "Resume one at a time", or "Abandon — move them back to todo". Do not guess. Resuming reuses each task's existing worktree where one exists.
- **A non-main worktree with no matching `doing/` task** → likely an orphan from a session that ended mid-cleanup. Surface it to the user for an explicit disposition rather than silently removing it — same posture as the session-end reconciliation below.

## Phase 2: Build the dependency graph

1. Read `.agentheim/vision.md` and `.agentheim/context-map.md` for orientation.
2. Read `.agentheim/knowledge/index.md` (top-level catalog — current BCs and recent ADRs). If missing, surface to user that the project hasn't been indexed and offer to run `scripts/backfill-indexes.ps1` (or `.sh`) before continuing — workers will be less effective without indexes.
3. Read the first ~100 lines of `.agentheim/knowledge/protocol.md` (newest entries are on top — this gives recent activity context). Skip if it doesn't exist yet. **Hold this excerpt in memory** — you pass it forward to each worker as `## Recent activity` so workers don't re-read the protocol themselves. The live file is capped (ADR-0039) — older months roll out verbatim to `.agentheim/knowledge/protocol/YYYY-MM.md`, so this ~100-line read always yields recent activity regardless of the live file's age; there is no need to consult the archive here.
4. Scan `.agentheim/contexts/*/todo/` and `.agentheim/contexts/*/doing/`.
5. For every todo task, read `depends_on`. A task is *ready* if every id in `depends_on` is in `done/`. **Fail-closed** (ADR-0038 Ruling A): a `depends_on` id present in NO lifecycle folder (`backlog/`, `todo/`, `doing/`, `done/`, across every BC) counts as **unsatisfied** — the task is not ready, and the dangling id is surfaced to the user, never silently treated as satisfied. This matches `dependencySatisfied()` in `lib/task-lifecycle.mjs` exactly (no code change needed there — only this prose used to disagree with it).
6. **Detect cycles.** If the graph has a cycle, stop and surface the cycle to the user. Do not "just pick one".
7. Briefly tell the user what you found: "X tasks ready across N contexts, Y tasks blocked on Z."

## Phase 3: Conflict pre-scan — advisory only (ADR-0032 demoted this from a throttle)

Textual conflict prediction used to hard-demote tasks because the shared working tree made a real collision unsafe. Per-worker worktree isolation (ADR-0032) removes that unsafety: two workers touching the same file now collide at **merge-back**, where git's real 3-way merge either resolves it cleanly or surfaces an actual conflict — never a guess from English. The pre-scan survives only as a cheap **advisory** for merge ordering:

1. For each ready task, scan its `What`, `Acceptance criteria`, and `Notes` sections for file paths, directory references, and shared resources (BC READMEs, ADRs, shared modules).
2. If two ready tasks reference the same file or directory (same-BC-README overlap is the routine case), **annotate them** for sequential merge-ordering — dispatch both in the same batch, but plan to squash-merge them one after another rather than out of order, so a real conflict (if one occurs) surfaces predictably. Do **not** demote either task to a later batch on this basis alone — that throttle is retired.
3. **Weigh the planning advisory (read-only influence, never a selector).** If `.agentheim/state/whats-next.md` exists, read it and note its latest *recommended move* + age (`generated` timestamp) — this informs **ordering/priority among the already-ready tasks** picked in step 4 below, surfaced in the batch rationale (see the "Batch started" protocol entry's optional `**Planning advisory:**` line under "Protocol logging"). Compare `generated` against the newest `## … -- Work / …` entry in the protocol excerpt already read in Phase 2 step 3: newer than that entry → treat as **current**, and let it nudge which ready tasks get priority (e.g. break a tie between two equally-ready tasks toward the recommended one, or dispatch the recommended task earlier within the batch); older → treat as **stale — background context**, weighted less; no Work entries yet in the protocol → not stale. It **never** overrides the dependency DAG, never promotes an un-ready task into the batch, and never demotes a task the DAG says is ready — it only informs ordering among tasks step 4 was already going to select from. A missing artifact is silent — no note, no weighting. A malformed / partial / headingless artifact degrades gracefully: read whatever is parseable and proceed without blocking batch planning; never throw.
4. **Cap the batch at `MAX_PARALLEL` (default `3`)** — a **named, user-settable knob**, not a hardcoded limit: the user can raise or lower it for a session ("run 5 in parallel", "just do them one at a time") and that overrides the default for the rest of the run. Absent an explicit ask, stay at 3. **Rationale for the default:** 3 balances merge-conflict surface at integration (more concurrent worktrees means more branches converging on `main` per batch, each a potential 3-way-merge collision) against verifier review load (one verifier run per returning worker, competing for the same conductor attention); isolation (ADR-0032) makes raising it safer than it used to be, but review load doesn't shrink just because merge risk did. The b8x2v duration/iteration fields on protocol entries (see "Protocol logging" below) now give this default a measured basis going forward — a future session with enough batch-duration history can revisit *3* from real wall-clock data instead of guessing; nothing yet has recorded enough runs to justify moving it. Pick the lowest-numbered unblocked tasks, adjusted by the advisory weighting from step 3 where it applies; the merge-order annotation from step 2 only affects merge *order*, never selection.

## Phase 4: Batch dispatch

Every dispatch wave now runs each worker in its own **git worktree** on a private branch (ADR-0032) — the shared-tree model is retired. The choreography, in order:

1. **Batch-start claim commit.** On the **main** tree, the `todo → doing` batch move + `INDEX.md` edits + the "Batch started" `protocol.md` entry are **mechanized** (ADR-0038, agentic-workflow-t7m4c): run the CLAIM verb of `lib/task-lifecycle-cli.mjs` against a comma-separated id list —
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','task-lifecycle-cli.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','task-lifecycle-cli.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no task-lifecycle CLI found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" claim <id-1>,<id-2>,... '{"parallel":"<the Parallel: line value you already composed in Phase 3 step 4 / the cap-triggered note below>","planningAdvisory":"<Phase 3 step 3's advisory line, if any — omit the whole key when absent>"}'
   ```
   (Same env-free homedir→cache→semver-max bootstrap infrastructure-010 established for `/dashboard`, reused verbatim from `modeling/SKILL.md`'s PROMOTE flow — runs in-process, cwd = the project. The trailing JSON is optional; omit the whole third argument for a plain, un-annotated batch.) It prints **one** manifest `{changed, message, verb:'claim', ids}` covering the whole batch — grouped per-BC internally if the batch spans more than one bounded context (`work`'s Phase 2 scans every BC's `todo/` at once, so this is a real shape, not a hypothetical) — or a structured `{ok:false, code, reason}` rejection if a selected id no longer resolves in `todo/` (a race with a concurrent `modeling` session; **nothing is moved** when this happens — the pre-check runs before any file touches disk, so retry after re-scanning). `git add` the manifest's `changed` paths and **commit** with its `message` verbatim: `chore(<bc>): batch start [<id-1>] [<id-2>] …` (single-BC batch), or `chore: batch start […]` — no `<bc>` token — when the batch spans multiple contexts. This is the **one** deliberate amendment to ADR-0026: the `todo → doing` half of the lifecycle move now rides in this per-batch commit instead of folding into each task's final commit — `git worktree add` checks out a *committed* state, so the worktree's base must already hold the task in `doing/`. If the project isn't a git repo, skip the commit and every worktree step below — just run the `claim` script anyway to get the files moved (ignore its manifest/message, there's nothing to commit) and proceed to spawn workers against the one working tree exactly as before ADR-0032 (see "Windows & node_modules" at the end of "Git authority").

2. **Create one worktree per task**, from that commit's HEAD:
   ```
   git worktree add -b aw/<task-id> .worktrees/<task-id> HEAD
   ```
   The worktree holds the task already in `doing/`, matching the worker prompt below.

3. **Lazily link `dashboard/node_modules` for dashboard-touching tasks only.** If the task's `What`/`Acceptance criteria` name `dashboard/`, call `linkDashboardNodeModules(worktreeRoot, mainRoot)` (`lib/worktree-node-modules.mjs`) — it junctions (Windows) / symlinks (POSIX) the worktree's `dashboard/node_modules` to the ONE real one in the main tree. No per-worktree `npm install`. Every other task's worktree gets no link and needs none. (`taskTouchesDashboard(fileList)` in the same module is a pure helper for this check once a `FILE_LIST` exists; at dispatch time you're deciding from the task's own prose.)

4. **Set `git config core.longpaths true`** once per session (harness setup, not per-worktree) if not already set — worktrees nest `.agentheim/` and `dashboard/` trees deep enough to approach Windows `MAX_PATH`.

5. **Spawn one subagent per task** using the Agent tool with `subagent_type: "worker"`. Launch all subagents in **one message** (parallel tool calls). Use the Subagent Prompt Template below — its `## Your task` block now carries a `Workspace` field pointing at the task's worktree; every other absolute path you pass (task file, BC README, BC index) is the copy **inside that worktree**, not the main tree.

6. **Wait for all subagents to complete.** As each returns:
   - Parse its strict return format (see template).
   - For `RESULT: SUCCESS`: **verify the result** (see "Verification gate" below). Only integrate to `main` after verification passes.
   - For `RESULT: BOUNCED`: see "BOUNCE integration" at the end of "Verification gate" below — a small, verifier-free squash-merge back to `main`, then worktree cleanup.
   - For `RESULT: FAILED`: log "Task failed" to protocol.md with the error, on the **main** tree (there is no worktree content worth merging). Remove the worktree + branch (`git worktree remove --force` + `git branch -D aw/<task-id>`) — the task stays in `doing/` on `main` (from the batch-start commit) so it doesn't silently retry. Tell the user at the end.
   - One failure does not block the batch — the other subagents continue and are processed normally.

7. **After the batch completes**, return to Phase 2 — re-scan. New tasks may have been promoted to todo (via parallel `modeling` invocations) or new dependencies may have unblocked.

## Nested fan-out budget (worst case — documented, not enforced)

Each dispatched worker can, on its own initiative, spawn further subagents — a direct single-specialist consultation (ADR-0035), or an `orchestrator` call that itself fans out to 1–4 specialists when a question spans more than one domain. Those nested spawns happen *inside* a worker's own subagent context: they are invisible to and uncontrollable by the conductor session that dispatched the worker, and the Agent tool exposes no cap on nested concurrency. This section states the worst case honestly rather than inventing a mechanism the conductor cannot actually run.

- **Worst-case shape per batch:** up to `MAX_PARALLEL` workers, each independently capable of triggering one orchestrator call that fans out to up to 4 specialists — worst case ≈ `MAX_PARALLEL × (1 orchestrator + up to 4 specialists)`. At the default `MAX_PARALLEL = 3` that's as many as 3 × 5 = 15 second-order subagents live at once, in the theoretical worst case where every worker hits a multi-specialist question simultaneously. A FAIL verdict that triggers a re-dispatch re-runs that same worker's chain, so a single stubborn task can repeat this fan-out across iterations, not just once.
- **The lever that actually bounds it is `MAX_PARALLEL` itself** (see Phase 3 step 4 above) — it is the *only* cap the conductor can enforce, because it is the only fan-out point the conductor directly controls (Phase 4 step 5). Everything past that first level is the worker's own call, not the conductor's.
- **The structural mitigation is agentic-workflow-n6r8j** (prefer-direct-consultation): routing a worker's single-specialist question straight to that specialist instead of through the orchestrator collapses the middle hop (worker → specialist, not worker → orchestrator → specialist), shrinking the worst case from `1 orchestrator + up to 4 specialists` toward `1 specialist` for the common case. This does not touch the batch-level `MAX_PARALLEL` cap — it shrinks the *per-worker* fan-out that cap multiplies.
- **What this is not:** a claim that the conductor enforces, counts, or even observes second-order spawns. It cannot. If a future harness surfaces nested-spawn telemetry to the dispatching session, that would be the point to replace this worst-case estimate with a measured, enforced ceiling — until then, `MAX_PARALLEL` plus n6r8j-style flattening are the only real levers.

## Verification gate (post-SUCCESS, pre-commit)

A worker returning `RESULT: SUCCESS` is not yet a commit. Every SUCCESS goes through the `verification-before-completion` gate — a separate `verifier` agent inspects the diff against the acceptance criteria with fresh context. This is the structural defense against plausible-but-wrong code.

The full doctrine lives in `skills/verification-before-completion/SKILL.md`. The operational integration here is:

### When to skip verification

Skip the gate (commit immediately on SUCCESS) when any of these is true:

- The project is not a git repo (no diff to inspect).
- The user invoked `work` with `--no-verify` or said "skip verification this run" — opt-out is per-batch, never persistent.
- The task is `type: decision` AND `FILES_CHANGED == 1` AND the single file is an ADR — auto-SKIP without spawning the verifier.

Otherwise, verify.

### Verifier dispatch

**Resolve the test command once per batch (per BC), not per verifier and not per iteration.** Before spawning the batch's verifiers, determine the project's test command using the same discovery order the verifier uses as its fallback — the BC README first, then the project root (`package.json` scripts, `Makefile` targets, `pyproject.toml`, `Cargo.toml`, `*.csproj`, `go.mod`). Cache the resolved command per BC (different BCs may have different commands) and pass it into every verifier spawn this batch — **including re-dispatched verifiers on FAIL iterations 2 and 3: reuse the cached command, never re-resolve per iteration.** This mirrors how workers receive pre-loaded ADRs — resolve once, hand it forward. If no command is discoverable for a BC, pass the literal `none` in the block and let the verifier apply its fail-closed rule.

**Resolve the runtime-surface manifest once per batch (per BC), same seam (ADR-0036).** Alongside the test command, read the BC README for a `## Runtime surface` fenced block. If present, parse its `surfacePaths`, `launch`, `stop`, `runfile`, `probes`, and optional `renderPaths` once — cache per BC, reuse across every verifier spawn this batch **including re-dispatched verifiers on FAIL iterations 2 and 3**, never re-parse per iteration. If the BC README carries no such block, cache `none` for that BC — every verifier spawned for it then skips check 8 entirely, for every task, regardless of what the diff touches. Pass the cached manifest (or `none`) into every verifier spawn as the `## Pre-resolved launch command` block below.

Before capturing a diff, make the worker's committed-but-ephemeral checkpoint: **the conductor** (never the worker) stages and commits the worker's enumerated output **inside its worktree** — `git -C .worktrees/<task-id> add <FILE_LIST + moved task file + BC README + ADRs>` then `git -C .worktrees/<task-id> commit -m "wip [<task-id>] iter N"`. This commit is ephemeral: the eventual squash-merge (see "Git authority") collapses it, so it never reaches `main` history on its own. Keeping this commit with the conductor, not the worker, keeps the *worker never runs git* rule untouched.

For each SUCCESS that requires verification, in parallel where the workers ran in parallel:

1. Capture the diff **from the worktree, not the main tree**: `git -C .worktrees/<task-id> show HEAD` (the wip-commit's full diff) and `git -C .worktrees/<task-id> show HEAD --stat`. This is the isolation payoff — the diff (and the verifier's later test run) can never contain a sibling worker's uncommitted changes, because each worktree only ever holds its own task's work atop the shared batch-start commit.
2. Track the iteration count for this task (start at 1; increments on each FAIL re-dispatch).
3. Spawn one `verifier` subagent via Agent with `subagent_type: "verifier"` using the **Verifier Prompt Template** below — it now carries a `## Worktree` absolute-path field. Launch verifiers for a batch's successes in the same message (parallel tool calls).
4. Wait for each verifier's verdict.

### Handling the verdict

**`VERDICT: PASS`**
1. Proceed to the existing "Git authority" section — **on the main tree**, squash-merge the worker's branch, fold in the INDEX/protocol/task-move bookkeeping, and make **one** commit (per ADR-0026 + ADR-0032). Note the protocol entry written there is "Task verified and completed" (replaces the old "Task completed" entry — see Protocol logging below). Tear down the worktree + branch afterward (see "Git authority").

**`VERDICT: SKIP`**
1. Integrate exactly as on PASS — same squash-merge + before-the-commit bookkeeping + worktree teardown. The protocol entry written in the Git authority step is "Task completed (verification skipped: <reason>)".

**`VERDICT: FAIL`, iteration 1 or 2**
1. Do **not** merge to `main` — nothing on `main` needs to change, because `main` never held this task's unverified work in the first place (it lives only in the worktree + branch). This is the structural upside of isolation: there is no rollback to perform on `main`.
2. **Inside the worktree**, roll back the worker's completion claim on the task file:
   - Move the task file from `done/` back to `doing/`
   - Revert frontmatter: `status: done` → `status: doing`, clear the `completed:` date
   The conductor performs this move in the worktree (still no git command from the worker) and makes another `wip [<task-id>] iter N` commit on the same branch capturing the revert + the verifier note below — this too is collapsed by the eventual squash.
3. Append the verifier's output to the task file as a new `## Verifier note (iteration N)` section at the bottom, containing the REASONS, SUGGESTED_FIX, and ITERATION_HINT verbatim.
4. Log "Verification failed (iteration N)" to protocol.md — on the **main** tree (this entry is not part of any task's eventual squash-merge; it accumulates on `main` until the next commit that does land there — see "Reconciling stranded carry-over" for how a lone protocol edit is handled if the session ends before then).
5. Decide re-dispatch:
   - If `ITERATION_HINT: task-under-specified` → do not re-dispatch even on iteration 1. Treat as iteration-3 below.
   - Otherwise → **re-dispatch a worker into the SAME worktree** (the `Workspace` field points at the same `.worktrees/<task-id>/`, so its iteration context — files, the earlier `wip` commits still pending collapse — stays live). Use the standard Subagent Prompt Template, but prepend a paragraph telling the worker to read the task file's `## Verifier note` sections and address them. Set `iteration = N + 1` for the next verification.

**`VERDICT: FAIL`, iteration 3 (or earlier with `ITERATION_HINT: task-under-specified`)**
1. Do not merge to `main`. Do not re-dispatch.
2. **Keep the worktree and branch** — do not remove them. The task remains in `doing/` on `main` (it was never merged to `done/`); all accumulated verifier notes are visible in the task file **inside the worktree**. Surface the worktree's absolute path alongside the task so the user can inspect the live iteration state directly.
3. Log "Verification failed — escalating to user" to protocol.md.
4. Surface at end-of-batch (see End-of-run reporting): summarize the task, the iteration history, the latest verifier's SUGGESTED_FIX, and the kept worktree's path. The user decides whether to refine the task (re-route via `modeling` REFINE) or abandon — either way, the worktree is reconciled at session end (see "Reconciling stranded carry-over").

### BOUNCE integration

A worker that returns `RESULT: BOUNCED` moved its task file `doing → backlog` **inside its worktree** and appended a `## Worker note`. This needs no verifier (no code was produced) and is small enough to integrate immediately rather than leaving it stranded once the worktree is torn down — the conservative alternative (never merging it) would silently hide the bounce, strictly worse than the pre-worktree behavior of at least leaving an uncommitted, visible change in the one shared tree. So, on the **main** tree:

1. `git merge --squash aw/<task-id>` — the delta is just the `doing → backlog` move + the `## Worker note`.
2. Apply the BC `INDEX.md` `doing → backlog` edit and prepend the "Task bounced" `protocol.md` entry (see "Protocol logging").
3. `git add` the enumerated bookkeeping (`INDEX.md`, `protocol.md` — the squash already staged the moved task file) and commit: `chore(<bc>): task bounced — <title> [<task-id>]`.
4. Tear down the worktree + branch exactly as on PASS/SKIP (unlink any `dashboard/node_modules` link first, then `git worktree remove --force` + `git branch -D aw/<task-id>`).

This resolution is recorded in **ADR-0037** — ADR-0032 covered PASS/FAIL/SKIP explicitly but left the BOUNCE transition unaddressed.

### Verifier Prompt Template

Spawn each verifier with `Agent(subagent_type: "verifier", prompt: <the-below>)`. Fill the placeholders.

```
You are a verifier agent auditing one worker's completed task with fresh context. You have no exposure to the worker's reasoning — only the task spec, the BC README, and the diff in front of you.

## Your inputs
Task file (currently in doing/ or done/, inside the worktree below): <ABSOLUTE-PATH>
Bounded context: <BC-NAME>
BC README: <ABSOLUTE-PATH-TO-BC-README>
Worktree: <ABSOLUTE-PATH-TO-WORKTREE>   <!-- run the test command below FROM this directory, not the main repo root -->
Iteration: <N> of max 3

## The worker's strict SUCCESS return
<paste the worker's full RESULT: SUCCESS block verbatim>

## The diff to audit
<paste `git -C <worktree> show HEAD --stat` output, then `git -C <worktree> show HEAD` output — the worktree's one wip-commit, scoped to only this task's changes atop the shared batch-start commit>

## Pre-resolved test command
The `work` skill resolved this project's test command once for this batch (the same command is reused across every verification iteration for this BC). **Run it from the `## Worktree` path above** — that is what makes this run isolated from any sibling worker's changes. If it reads `none`, resolution found no command; fall back to your own discovery procedure (rooted at the worktree), and if that also finds nothing, apply your fail-closed FAIL.

<the resolved test command string for this BC, or `none` if resolution found nothing>

## Pre-resolved launch command
The `work` skill resolved this BC's `## Runtime surface` manifest (ADR-0036) once for this batch (the same manifest is reused across every verification iteration for this BC). If it reads `none`, this BC declares no runtime surface — skip check 8 entirely, for every task, regardless of what the diff touches. Otherwise it carries the manifest's `surfacePaths`, `launch`, `stop`, `runfile`, `probes`, and optional `renderPaths` (JSON below): if the diff touches a `surfacePath`, boot via `launch` **from the `## Worktree` path above**, read the actual bound port from `runfile` (never assume the derived value), assert `probes`, and **always** tear down via `stop`.

<the resolved runtime-surface manifest as a JSON object for this BC, or `none` if the BC declares no runtime surface>

## Project context (read on demand if needed)
- .agentheim/vision.md
- .agentheim/context-map.md (if exists)
- .agentheim/knowledge/decisions/ (ADRs)

## Your job
Follow the checks in `agents/verifier.md`, in order, stopping at the first failing check. Return exactly one verdict block — VERDICT: PASS, VERDICT: FAIL, or VERDICT: SKIP — per the strict formats in your agent definition.

Do not use Write, Edit, or any git command. You are read-only.
```

### Parallel verification

When the conductor dispatched a parallel batch of N workers and several return SUCCESS, each worker's diff is **already isolated by construction** — it is `git -C .worktrees/<task-id> show HEAD` in that worker's own worktree, which can never contain a sibling's uncommitted changes. Spawn the verifiers as parallel Agent calls in one message; each verifier sees only its own task's diff and runs the suite in its own worktree. Integrate each verified-PASS **sequentially** on the main tree in the order verifiers return — never parallelize git writes to `main` (a worktree's own `wip` commits can happen at any time; only the squash-merge onto `main` is serialized).

## Git authority (conductor only)

Git is owned by `work`, not by workers or verifiers. Workers only move files and write content, **inside their own worktree**; verifiers only read, also inside that worktree. This is load-bearing for parallel safety: `main` is written **only** by the conductor, **only** sequentially — worktree isolation (ADR-0032) strengthens this, it does not relax it, because every worker's writes land on a private branch that cannot race anything.

**The doctrine here is ADR-0026 + ADR-0032: all bookkeeping is written and `git add`ed BEFORE the integrating commit, so a completed task's code + task-move + INDEX + protocol all land in ONE commit on `main`, and `git merge --squash` — not a prose scan — is the conflict detector.** Commit doctrine (scoped add, message convention, the dropped `commit:` field) lives in `references/commit-doctrine.md`.

### Anchor every git command to its tree — the CWD-drift trap

Worktree isolation means the conductor is juggling **two working trees at once**: `main` (the repo root) and each live `.worktrees/<task-id>/` on branch `aw/<task-id>`. The shell's working directory **persists between commands**, so a `cd .worktrees/<task-id> && …` you ran for discovery or a `wip` checkpoint silently leaves every *later* bare `git` command executing **inside that worktree on the private branch**, not on `main`. That defeats the whole invariant above — `main` writes are supposed to be the conductor's alone, sequentially. A misdirected `git merge --squash` degrades to a confusing self-merge no-op ("Already up to date"); a misdirected `git reset --hard` / `git commit` would corrupt the wrong tree with no warning.

**Rule — never rely on the inherited CWD for a git write.** For every git command that targets a specific tree, make the target explicit, one of:

- `git -C <absolute-path>` — the preferred form for worktree writes (e.g. the `wip` checkpoint: `git -C .worktrees/<task-id> commit …`); it names the tree per-invocation and cannot drift.
- Prefix a fresh `cd <main-repo-root>` at the start of the command whenever you need to operate on `main` (the squash-merge, the integrating commit, worktree teardown, all bookkeeping) — do **not** assume you're already there.

When a git result looks off (an unexpected "Already up to date", a clean tree you expected to be dirty, a branch name you didn't expect), your first check is `git rev-parse --abbrev-ref HEAD` — confirm which tree/branch you're actually on before running anything destructive.

### PASS / SKIP — squash-merge to `main`, one commit

After a verifier returns `VERDICT: PASS` (or `VERDICT: SKIP`, or when verification was bypassed per the skip rules above), on the **main** tree:

1. `git merge --squash aw/<task-id>` — stages the branch's net delta (code + `doing → done` move + BC README + ADRs, collapsed from however many `wip` commits the branch accumulated across iterations). **This is where a real conflict against an already-merged sibling surfaces** — see "Merge-back conflicts" below.
2. **Run the COMPLETE script (pre-commit), on the main tree** — the `doing → done` `INDEX.md` edit and the completion `protocol.md` entry are **mechanized** (ADR-0038, agentic-workflow-t7m4c):
   ```
   node -e "<the same bootstrap as the claim verb in Phase 4 step 1>" complete <task-id> '{"summary":"<worker SUMMARY>","duration":"<dispatch→verdict wall time, e.g. 4m12s>","verification":"PASS (iteration N)","filesChanged":<FILES_CHANGED>,"testsAdded":<TESTS_ADDED>,"adrsWritten":"<ADRS_WRITTEN, comma-joined, or \"none\">"}'
   ```
   (For a `VERDICT: SKIP` completion, swap the trailing JSON for `{"summary":"...","duration":"...","skipped":true,"skipReason":"<decision-only task | --no-verify | non-git project>","filesChanged":<FILES_CHANGED>}` — this selects the "Task completed (verification skipped)" entry shape instead, which carries no `Tests added:` / `ADRs written:` lines.) The script is **idempotent** w.r.t. the squash: the worker already moved the task file `doing → done` inside its own worktree, and the squash in step 1 already carried that move onto `main` — so by the time this runs, `applyTaskMove`'s own `doing → done` attempt sees `stale-precondition` (the file is no longer in `doing/`) and, because the file resolves in `done/` already, treats that as a no-op move and proceeds straight into the `INDEX.md`/`protocol.md` bookkeeping rather than rejecting. It prints one manifest `{changed, message, verb:'complete', id, idempotent}` — or `applyTaskMove`'s own rejection verbatim on a genuine problem (the file resolves in neither `doing/` nor `done/`, which should never happen after a clean squash and is worth investigating, never silently retried).
   - Still apply the ADR↔task backlink maintenance and any ADR index inserts yourself (see "Index updates" below) — those are not part of the `complete` manifest. A task's `ADRS_WRITTEN` list is conductor-only knowledge (read off the worker's SUCCESS block) that the script has no way to see.
3. `git add` an **explicit, enumerated** list: the `complete` manifest's `changed` paths (`INDEX.md`, `protocol.md` — the task file itself, already staged `doing → done` by the squash in step 1, is not re-added) plus any ADR/task files touched by the backlink maintenance above. Never `git add -A` / `git add .` — see `references/commit-doctrine.md` for why the scoped-add rule is load-bearing here.
4. Commit with the `complete` manifest's `message` verbatim — already the doctrine-compliant `<type>(<bc>): <summary> [<task-id>]` (`<type>` read from the task's own frontmatter, `<summary>` from the JSON opts above, falling back to the task title when omitted). Do not hand-compose this string. Example: `feature(books): add ReadingSession concept to Book aggregate [books-001]`.
5. **Tear down the worktree**, in order:
   - If the task touched `dashboard/`, `unlinkDashboardNodeModules(worktreeRoot)` (`lib/worktree-node-modules.mjs`) **first** — never skip this. (De-risking spike finding, ADR-0037: `git worktree remove --force` recurses THROUGH an un-removed junction and silently deletes the real shared `node_modules`'s contents — no error, just data loss. Unlinking first is mandatory, not housekeeping.)
   - `git worktree remove .worktrees/<task-id> --force`
   - `git branch -D aw/<task-id>`

The commit SHA is **not** written back anywhere — see `references/commit-doctrine.md` for the `[<task-id>]` trailer / dropped `commit:` field convention. Do **not** add a `commit: <sha>` field and do **not** amend the task file after committing.

### Merge-back conflicts — abort and surface, never auto-guess

Two same-BC workers both editing the BC README (the common case the Phase 3 advisory flags) now collide at **merge-back** instead of being predicted from prose. On a clean or auto-mergeable squash-merge, proceed as above. On a **real** conflict (git leaves conflict markers, non-zero exit from step 1):

1. **Abort with `git reset --hard HEAD`** — **not** `git merge --abort`. De-risking spike finding (ADR-0037): `git merge --squash` never sets `MERGE_HEAD`, so `git merge --abort` errors ("There is no merge to abort") on a squash merge; `git reset --hard HEAD` is the command that actually restores `main`'s index and working tree to their pre-merge state. `main` is never left in a conflicted state.
2. Preserve the losing task's worktree + branch **exactly as-is** — do not remove them.
3. **Surface to the user immediately**: name the conflicting file(s), both task ids, and the worktree path. No merge is ever auto-guessed; the user resolves manually or asks for a re-run. (An automatic rebase-and-reverify is a named future enhancement, not baseline — see ADR-0032.)

### One commit per task — and the trivial-squash carve-out

**One task = one commit is the default.** Integrate after each verifier passes, not in a batch — that way if the next verification fails we haven't bundled it with an already-passed one. In a parallel batch where verifiers return roughly simultaneously, squash-merge sequentially on `main` in the order verifiers return PASS.

The trivial-squash carve-out and its four conditions (same BC, same file set, no-behavior-change, same batch) are defined in `references/commit-doctrine.md` (ADR-0026, unaddressed by ADR-0032's per-task-branch model but not precluded by it). The aw-064/065/066/067 one-line topbar-chrome tweaks are the canonical example. When in doubt, do **not** squash — one commit per task is always safe. When it does apply under worktree isolation, squash-merge each eligible branch in turn (`git merge --squash aw/<id-1>`, then `git merge --squash aw/<id-2>`, …) before the one shared commit.

**The `complete` script stays single-task-shaped (ADR-0042) — it has no batch mode.** Unlike `claim` (a real batch verb, because ADR-0032's batch-start commit is inherently one-per-batch), `completeTask` mirrors `promoteTask`'s single-id shape: it moves one task, edits one BC's `INDEX.md`, and prepends one protocol entry. When the trivial-squash carve-out applies to N eligible tasks, run the `complete` script **once per task** in the set — after step 1's `git merge --squash` for each branch — collect their N manifests, then compose the one shared commit yourself: `git add` the union of every manifest's `changed` paths, and write a commit message that concatenates each manifest's own `[<task-id>]` trailer onto one summary line (the aw-064/065/066/067 shape: `feature(agentic-workflow): one-line topbar-chrome tweaks [aw-064] [aw-065] [aw-066] [aw-067]`). The script itself never attempts this composition — a batch-complete verb would have to invent a shared summary line and a shared `<type>` across N potentially-different tasks, which is exactly the judgment call ADR-0038's three-layer boundary reserves for the skill, not the script.

### Windows & node_modules

- **Long paths.** Worktrees nest `.agentheim/` and `dashboard/` trees; `git config core.longpaths true` is harness setup (Phase 4 step 4), relied on alongside Windows `LongPathsEnabled`. If `MAX_PATH` still bites, fall back to the bare ADR-0028 token as the worktree dir name.
- **No per-worktree `npm install`.** Only when a task touches `dashboard/`, `linkDashboardNodeModules` lazily junctions/symlinks the worktree's `dashboard/node_modules` to the main tree's ONE real copy (Phase 4 step 3) — safe because node_modules is read-only during a build. `unlinkDashboardNodeModules` removes the link — **always before** `git worktree remove` (see the PASS/SKIP teardown above and the mandatory safety note there). The OS-divergent branch (junction vs. symlink) lives in the one helper `lib/worktree-node-modules.mjs`, mirroring how `dashboard/launch.mjs` centralizes OS-divergent spawn logic (ADR-0002).

If the project isn't a git repo, skip commits and worktrees silently — workers run against the one shared working tree exactly as before ADR-0032, and note the degraded mode in the end-of-run summary. (Verification is also auto-skipped in this case — see "When to skip verification".)

## Index updates (conductor-owned)

Indexes track artifact movement. The work skill — **never the worker** — updates them. The worker is scope-restricted; touching `INDEX.md` files from inside a worker would fail verification. Index template lives at `references/index-template.md`.

These edits are part of the bookkeeping that is written and `git add`ed **before** the integrating commit (ADR-0026 + ADR-0032) — the INDEX edit, the ADR backlinks, and the protocol entry all land in the same commit as the task's squash-merged (or, for the batch-start transition, batch-claimed) work. Do them in the Git authority step's pre-commit phase, not after.

Per state transition in `contexts/<bc>/INDEX.md`:

| Transition | Marker edits | Counts |
|---|---|---|
| **todo → doing** (Phase 4 step 1 — the **batch-start claim commit**, a commit of its own, separate from any task's eventual squash-merge commit) | **Mechanized** (ADR-0038, agentic-workflow-t7m4c) — `lib/task-lifecycle-cli.mjs claim <ids>` performs the marker edit + count delta for every id in the batch (grouped per BC) as part of its manifest; nothing to hand-edit here. | Todo −1, Doing +1 |
| **doing → done** (pre-squash-merge-commit bookkeeping, on `main`, PASS/SKIP) | **Mechanized** — `lib/task-lifecycle-cli.mjs complete <id>` performs the marker edit + count delta (idempotently, whether or not the squash already carried the file to `done/`) as part of its manifest; nothing to hand-edit here. | Doing −1, Done +1 |
| **doing → backlog** (BOUNCED — pre-squash-merge-commit bookkeeping, on `main`; see "BOUNCE integration") | remove from `<!-- doing-list:start -->` → insert into `<!-- backlog-list:start -->` (still hand-edited — BOUNCE is not mechanized by this task) | Doing −1, Backlog +1 |
| **doing → doing** (FAIL iteration N, re-dispatched into the same worktree) | no list move; line stays in doing-list | no count change |
| **doing → doing-final** (FAIL iteration 3, escalated; worktree kept) | no list move | no count change |

Per ADR written (from `ADRS_WRITTEN` in worker SUCCESS):

- Read the ADR's frontmatter `scope:` field.
- `scope: <bc-name>` → insert under `<!-- adr-local:start -->` in `contexts/<bc-name>/INDEX.md`.
- `scope: global` → insert under `<!-- adr-global:start -->` in `.agentheim/knowledge/index.md`.
- **Bidirectional backlink:** append the ADR id to the task's `related_adrs` frontmatter, and append the task id to the ADR's `related_tasks` frontmatter. The worker writes the ADR but does not maintain these cross-links — the conductor does, atomically, alongside the index update.

If `.agentheim/knowledge/index.md` or the BC's `INDEX.md` does not exist yet, create it from `references/index-template.md` before inserting. Do not auto-rewrite the file — only insert/remove at markers.

If `NEW_BACKLOG_ITEMS` are non-empty in the worker SUCCESS, also insert those task lines under `<!-- backlog-list:start -->` in the appropriate BC's INDEX.md (counts +N).

## Protocol logging

`.agentheim/knowledge/protocol.md` is the project's chronological diary. Every `work` event prepends a new entry. Keep entries terse — the diff carries the detail.

**Rotation (ADR-0039):** the live file is capped at ~1,000 lines. Older, closed-out months roll out verbatim to `.agentheim/knowledge/protocol/YYYY-MM.md` via `lib/protocol-rotation.mjs`'s `rotateProtocol` (a k5n8f-family script — deterministic, git-free, stdlib-only). This doesn't change anything you write here — you still prepend every entry to the live file exactly as below; rotation is a separate maintenance operation over the file, not a per-entry concern.

The completion entries below are written in the **pre-commit bookkeeping phase** (ADR-0026), so they ride in the task's own **squash-merge commit on `main`** (ADR-0032). Because the commit SHA isn't known until after the commit and isn't written back anywhere, the `**Commit:**` line is **omitted** from these entries — `git log`'s `[<task-id>]` trailer is the SHA index. (The "Batch started" entry is prepended and committed as part of the **batch-start claim commit** — Phase 4 step 1 — a commit of its own, separate from every task's eventual squash-merge commit, per ADR-0032's one deliberate ADR-0026 amendment.)

### Observability fields — measure, never fabricate

`work` records the cheap-to-capture cost signals it can actually observe, and explicitly declines the ones it cannot. This is the observability floor: the protocol entries are written anyway, so carrying these fields is near-free.

- **Duration** — wall time the conductor measures against its own clock: note the dispatch time when you spawn a worker (Phase 4) and subtract it from the time that worker's verdict lands. This is a real measurement the session already has — it needs no harness support. Record it on every task-completion entry (dispatch → verdict for that task) and record the whole-session span on the session-end entry. Express it human-readably (e.g. `4m12s`, `1h03m`).
- **Verification iteration** — the `PASS (iteration N)` count is **mandatory**, never dropped. N is the iteration counter the verification gate already tracks (1 on a first-try pass, higher after re-dispatch). It is the signal for "is the verifier earning its spend."
- **Dispatch / re-dispatch tally** — the session-end entry carries a per-task count of how many times each task was dispatched (1 + its re-dispatch count). The conductor already tracks this per task for the iteration counter; the tally just surfaces it.
- **Token / dollar cost — deliberately omitted.** The orchestrating session has no programmatic access to its own or its subagents' token counts, so any token or cost figure here would be fabricated. It is left out on purpose (acceptance criterion: no fabricated metrics). If a future harness exposes real per-run token counts to the session, add a `**Tokens:**` line then — until it does, absence is the honest record.

If `protocol.md` doesn't exist, create it with:
```markdown
# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---
```

Then every entry is prepended right after the `---` on line 4.

Entry formats — the "Batch started", "Task verified and completed", and "Task completed (verification skipped)" shapes below are **no longer hand-formatted here**: `lib/task-lifecycle-cli.mjs`'s `claim` and `complete` verbs generate and prepend them as part of their manifests (ADR-0038, agentic-workflow-t7m4c) — see Phase 4 step 1 and the Git authority PASS/SKIP section above. They're kept below as the human-readable contract (what the script actually writes, so a reader can spot drift), not as instructions to compose by hand. "Verification failed", "Task bounced", and "Task failed" (further below) are **not** mechanized — those stay hand-written exactly as before:

```markdown
## YYYY-MM-DD HH:MM -- Batch started: [task-id-1, task-id-2, ...]

**Type:** Work / Batch start
**Tasks:** task-id-1 - [title], task-id-2 - [title]
**Parallel:** yes / no (N workers)
**Planning advisory:** [omitted entirely if you passed no `planningAdvisory` in the `claim` call's JSON opts; otherwise one line — the recommended move + current/stale age — per Phase 3 step 3]

---
```

**Cap triggered — never truncate silently.** If the ready set (Phase 2 step 7's tally) is larger than the batch you're actually dispatching — whether because `MAX_PARALLEL` held tasks back or the conflict pre-scan's merge-ordering pushed one to a later wave — compose the held-back task ids and the reason into the `parallel` value you pass to the `claim` call's JSON opts, the same way an earlier session did it: `"parallel":"yes (2 workers — ... k5p8w held to next wave — it conflicts with both, same agentic-workflow README as f6m2q ...)"`. A batch that is smaller than the ready set with no stated reason is a protocol gap, not an acceptable shorthand — the script only prints what you hand it.

```markdown

## YYYY-MM-DD HH:MM -- Task verified and completed: <task-id> - [title]

**Type:** Work / Task completion
**Task:** <task-id> - [title]
**Summary:** [worker's 1-line SUMMARY]
**Duration:** [wall time from this worker's dispatch to its verifier verdict, e.g. 4m12s]
**Verification:** PASS (iteration N)   <!-- iteration N is REQUIRED — never omit the count -->
**Files changed:** N
**Tests added:** N
**ADRs written:** [ids or "none"]

---

## YYYY-MM-DD HH:MM -- Task completed (verification skipped): <task-id> - [title]

**Type:** Work / Task completion
**Task:** <task-id> - [title]
**Summary:** [worker's 1-line SUMMARY]
**Duration:** [wall time from this worker's dispatch to its SUCCESS return, e.g. 4m12s]
**Verification:** SKIPPED — [reason: decision-only task | --no-verify | non-git project]
**Files changed:** N

---

## YYYY-MM-DD HH:MM -- Verification failed: <task-id> - [title]

**Type:** Work / Verification failure
**Task:** <task-id> - [title]
**Iteration:** N of 3
**Reasons:** [verifier's REASONS, comma-joined]
**Iteration hint:** likely-fixable | task-under-specified
**Next:** re-dispatched worker | escalated to user

---

## YYYY-MM-DD HH:MM -- Task bounced: <task-id> - [title]

**Type:** Work / Task bounced
**Task:** <task-id> - [title]
**Reason:** [worker's REASON]
**Moved to:** backlog

---

## YYYY-MM-DD HH:MM -- Task failed: <task-id> - [title]

**Type:** Work / Task failure
**Task:** <task-id> - [title]
**Error:** [worker's ERROR]
**Left in:** doing

---
```

## Subagent Prompt Template

Spawn each worker with `Agent(subagent_type: "worker", prompt: <the-below>)`. Fill the placeholders — **every absolute path you fill in points inside the task's worktree** (ADR-0032), not the main tree. The `## Rules — CRITICAL` list below is **unchanged**: the worker still never runs git and still owns only its own `doing → done` move — only *which* tree it operates in has changed.

```
You are a worker agent executing one refined task. Stay strictly within its scope.

## Your task
Workspace (this task's private git worktree — run all commands, including tests, from inside it): <ABSOLUTE-PATH-TO-WORKTREE>
Task file (currently in doing/): <ABSOLUTE-PATH>
Bounded context: <BC-NAME>
BC README: <ABSOLUTE-PATH-TO-BC-README>
BC index: <ABSOLUTE-PATH-TO-CONTEXTS-BC-INDEX-MD>  # catalog of ADRs/research/concepts scoped to this BC

## Pre-loaded ADRs (MUST READ before coding)
The task's `related_adrs` frontmatter lists ADRs you must read. Their full content is below — do not re-fetch.

<For each id in task.related_adrs, paste the full ADR file content here, separated by `---`. If related_adrs is empty, write: "No related ADRs.">

## Pre-loaded prior art (SHOULD READ if non-empty)
The task's `prior_art` frontmatter lists done-task ids that are close in subject. Read their `## Outcome` sections before designing yours — don't re-derive a solved problem.

<For each id in task.prior_art, list: id, title, path to done/ file, and the Outcome section excerpt (last 30 lines of the file). If prior_art is empty, write: "No prior art identified.">

## Related research (read on demand)
The task's `related_research` frontmatter points at research reports under `.agentheim/knowledge/research/`. Read the ones whose topic actually bears on your work.

<List task.related_research entries by slug; do not paste contents — reports can be long.>

## Recent activity
Last ~100 lines of `.agentheim/knowledge/protocol.md` — the project's recent events. Use this for orientation; do not re-fetch the protocol yourself.

<Paste the head -100 excerpt the conductor captured in Phase 2 verbatim.>

## Project context (read only if you need them)
- .agentheim/vision.md
- .agentheim/context-map.md (if exists)
- .agentheim/knowledge/decisions/ (other ADRs beyond the pre-loaded ones)
- .agentheim/knowledge/research/ (research reports)
- .agentheim/contexts/<bc>/concepts/ (opt-in synthesis pages — grep for relevant concepts before designing)

## Rules — CRITICAL
1. Do NOT run `git add`, `git commit`, or any git write operation. The conductor owns git.
2. Do NOT modify `.agentheim/knowledge/protocol.md`. The conductor owns protocol logging.
3. Do NOT modify any `INDEX.md` (`.agentheim/knowledge/index.md` or `.agentheim/contexts/*/INDEX.md`). The conductor owns indexes.
4. Do NOT touch any task file other than the one you were assigned.
5. Do NOT modify other BCs' READMEs. Only the BC your task belongs to.
6. DO write code, run tests, update YOUR BC's README, write ADRs for decisions you make.
7. DO move your task file from doing/ to done/ when acceptance criteria are met, and update its frontmatter (status: done, completed: YYYY-MM-DD).
8. If the task is under-refined (no concrete acceptance criteria, unclear scope, unmet dependencies, insufficient BC language), MOVE IT BACK TO backlog/ with a `## Worker note` explaining what's missing, and return RESULT: BOUNCED. This is correct behavior, not a failure.

## Context hygiene — IMPORTANT
Your context window is finite. Respect it:
- Read only what you need. Use targeted reads (offset/limit) on large files. Don't read a whole file for a few lines.
- Don't echo file contents back in your output — work with them silently.
- Keep tool output concise (use head/tail, --quiet flags).
- Don't re-read files you've already read unless they've changed.
- Don't restate the task file or the BC README verbatim — the conductor already has them.

## Return format — STRICT
When done, the worker returns ONLY a `RESULT: SUCCESS | BOUNCED | FAILED` block, nothing else — no prose, no preamble, no "here's what I did". The exact fields (SUCCESS's `SUMMARY` / `FILE_LIST` / `TESTS_ADDED` / `TESTS_PASSING` / `TDD_SKIPPED` / `CONCEPT_CANDIDATE` / etc., plus BOUNCED's and FAILED's shapes) are the single source in `references/worker-return-format.md` — paste that file's content into the spawn prompt here so the worker has it inline without a read hop.

If `TESTS_PASSING: no`, do NOT return SUCCESS — that's a FAIL or a BOUNCE, not a success.
```

## End-of-run reporting

When `todo/` is empty and all `doing/` is resolved (or the user interrupts):

1. Summarize in plain prose: tasks completed (with verification stats — how many passed first try vs. needed re-dispatch), tasks bounced (and why), tasks failed (and why), tasks escalated after 3 verification failures (these need user attention), ADRs written, new backlog items created, total commits made.
2. For each task escalated to the user: name it, summarize the iteration history, and show the latest verifier's SUGGESTED_FIX. The user decides whether to REFINE via `modeling` or abandon.
3. **Concept candidates.** Aggregate every non-"none" `CONCEPT_CANDIDATE` from worker SUCCESS blocks across the run. If any concept name shows up in 2+ workers' returns, escalate the convergence signal more loudly. For each unique candidate: print the concept name, the BC, and the converging artifact ids. The user decides whether to create the page (per `references/concept-template.md`); never auto-create.
4. Surface anything that surprised you mid-run: cycles detected, dependency gaps, recovered sessions, repeated verification failures pointing at a common cause.
5. **Vision-conformance pass** (see the dedicated section below). One bounded read per session over the batch just completed — not per task, not a whole-vision essay. Do this before the carry-over reconciliation and the final protocol entry; its output feeds the **Vision-conformance:** line of that entry and, when a flag is worth the builder's attention, the whats-next advisory (below).
6. **Reconcile stranded carry-over — working tree AND worktrees** (see the dedicated section below). Do this *after* the last per-task integration and *before* prepending the session-end protocol entry — its dispositions feed the `**Carry-over:**` line of that entry.
7. Prepend a final protocol entry:
   ```markdown
   ## YYYY-MM-DD HH:MM -- Work session ended

   **Type:** Work / Session end
   **Duration:** [total wall time from the first "Batch started" entry to now, e.g. 23m40s]
   **Completed:** N (first-try PASS: A, re-dispatched: B, skipped: C)
   **Bounced:** M
   **Failed:** K
   **Escalated after verification:** E
   **Dispatches:** [per-task tally, one entry per task as `<task-id>: D` where D = 1 + its re-dispatch count, e.g. "b8x2v: 1, j4m6r: 2"]
   **Commits:** <count>
   **Vision-conformance:** [flag list from the session-end vision-conformance pass, `lib/vision-conformance.mjs`'s `formatConformanceLine` — one entry per flagged task as `<task-id>: diverges from <success criterion|non-goal> "<label>" — <note>`; or `none — batch aligns with vision` when the pass raises nothing. Never a gate — a note only (ADR-0027 advisory-write family, ADR-0040).]
   **Carry-over:** [reconciliation disposition per stranded file, from the step-6 section — one entry each: `<path>: committed (<label>)` or `<path>: left behind (owner: <flow>, <reason>)`; or `none — working tree clean`. NEVER the old "untouched, as in prior sessions" boilerplate — every stranded file names an explicit disposition or the tree was clean.]

   ---
   ```
   This is the one `work` protocol line written *after* a commit (it summarizes the session). To honor the "clean working tree" rule (`references/commit-doctrine.md`, ADR-0026), **commit it** with a scoped add of only `protocol.md`: `git add .agentheim/knowledge/protocol.md` then `chore(<bc>): work session end bookkeeping [<last-task-id>]` (reuse the last completed task's id as the trailer, or `chore: work session end bookkeeping` if the session committed nothing). This is the *only* bookkeeping-after-commit `work` performs, and it is a single line — every per-task INDEX/protocol edit already rode in its own task commit (the old trailing "record SHAs + INDEX/protocol" commit is gone). (Any *deliberately-committed* stranded file from step 6 rode in its own scoped reconciliation commit *before* this entry — see below.)
8. **Protocol rotation check (session-end)** (see the dedicated section below). Run this immediately after step 7's session-end protocol entry has been committed — the file has just grown, making this the natural, self-firing checkpoint that closes ADR-0039's deferred "who invokes it" non-decision (ADR-0045, ADR-0041's cap-and-roll doctrine).
9. **INDEX done-list rotation check (session-end)** (see the dedicated section below). Run this immediately after step 8's protocol rotation check. Every task this session completed grew some BC's `INDEX.md` done-list via `completeTask`, so this is the same self-firing seam step 8 uses, applied to the sibling cap-and-roll surface ADR-0045's "Scope boundary" section deferred (ADR-0047 closes it).

## Vision-conformance check (session-end)

Run this once per session, at end-of-run step 5, after the last per-task commit and before the carry-over reconciliation and the final protocol entry. It closes the Why→What loop the 2026-07-02 harness audit called for: today nothing evaluates whether just-shipped work still serves the vision, so the vision can rot silently while work proceeds and only a human notices. This pass is a **cheap, bounded read** — not a per-task deep dive, not a whole-vision essay — and it **never blocks**: it is a session-end advisory, the ADR-0027 advisory-write family (see ADR-0040), exactly as read-only over lifecycle as `whats-next`'s own advisory write (ADR-0017).

1. **Read the bounded inputs.** `.agentheim/vision.md`'s two named sections only — "What success looks like" and "Non-goals" — via `lib/vision-conformance.mjs`'s `extractVisionSections` (deterministic, unit-tested: `lib/test/vision-conformance.test.mjs`). Plus the session batch's already-summarized completed-task entries — the same material already in hand for step 1's plain-prose summary; no extra reads, no re-opening each task's diff.
2. **Ask one question per shipped task.** For each task this session completed: does it pull toward a stated non-goal, or away from a stated success criterion? This is genuine judgment, not a keyword match — reason about what the task actually changed, not just its title. A conforming batch should produce **zero** flags; don't manufacture drift to look thorough (see `evals/vision-conformance-check/` for a planted-drift fixture and a clean-batch fixture demonstrating both ends of this judgment).
3. **When you flag one, name the specific criterion or non-goal.** Use `lib/vision-conformance.mjs`'s `labelFor` convention — the item's leading **bold** phrase if it has one (vision.md's non-goals are typically written `**Not X.** ...`), else a short excerpt — so the flag is traceable to the exact vision line, not a vague "seems off".
4. **Format the flags.** `lib/vision-conformance.mjs`'s `formatConformanceLine(flags)` renders the list (or `none — batch aligns with vision` when empty) for the protocol entry's `**Vision-conformance:**` line (the template above).
5. **Surface worth-attention drift through the whats-next advisory too.** When `worthSurfacing(flags)` is true (any non-empty flag set), also (over)write `.agentheim/state/whats-next.md` — the same frozen shape `whats-next` itself writes (frontmatter `generated` ISO-8601 timestamp + the three sections *Where things stand* / *Recommended move* / *Next*), with **Recommended move** naming the flagged task(s) and the diverged-from criterion/non-goal, and **Next** suggesting the builder review the flagged task (a pause, not a "run work" nudge). This is not a second owner colliding with `whats-next`'s own write: the file is single-latest by design (ADR-0027) — whichever pass wrote it last is the current recommendation, and the next real `whats-next` invocation (or the next session's `work` Phase 3 / `modeling` "Before acting" read, both of which already consult this file) naturally supersedes it. Skip this sub-step entirely when there are no flags — a clean batch writes nothing here, so it never clobbers a genuinely useful existing recommendation with a bland "all clear".
6. **Never a gate.** No matter what this pass finds, it does not stop a commit, does not fail a task, does not stop the session. The human reads the protocol line (and, when present, the whats-next surface) and decides — the "Not autonomous" non-goal holds here exactly as everywhere else.

## Reconciling stranded carry-over (session-end): working tree AND worktrees

The scoped-`git add` rule (ADR-0026 §5) is load-bearing for concurrency, but it has a cost: anything no skill explicitly enumerated stays uncommitted **forever**. Left unmanaged this silently accumulates dirty state — the confirmed leak where the *same* files were recorded as "carry-over (untouched, as in prior sessions)" session after session, each run dutifully stepping around them. This step closes that leak by forcing an explicit, user-surfaced disposition for every stranded file — without ever loosening the scoped-add rule. Per-worker git worktrees (ADR-0032) get the same treatment — see "Worktree carry-over" below, which extends this same reconciliation rather than being a separate mechanism.

### Working-tree file carry-over

Run this once per session, at end-of-run step 6 (after the last per-task commit and the vision-conformance pass, before the session-end protocol entry):

1. **Detect.** Run `git status --porcelain`. Each line is a stranded working-tree entry: tracked-modified/staged (` M`, `M `, `MM`, `A `, `D `, `R `, …) **or** untracked (`??`). By this point every task this session completed has already ridden into its own commit, so a clean tree yields no lines. If the output is **empty**, there is nothing to reconcile — record `Carry-over: none — working tree clean` and skip to the protocol entry.
2. **Surface, per file — never auto-sweep.** For **each** stranded entry (both tracked-modified and untracked), present it to the **user** with the two allowed dispositions. Do not batch them into a single yes/no; a mixed set (one orphan to commit, one live sibling to leave) is the common case.
   - **(A) Commit deliberately.** The file is this project's own orphaned bookkeeping that no skill owns (e.g. an INDEX edit or protocol line a crashed prior session left behind). Make its **own scoped, clearly-labeled** commit: enumerate the exact path — `git add <exact-path>`, never `git add -A` / `git add .` (`references/commit-doctrine.md`) — then commit with `chore(<bc>): reconcile stranded <short-desc> [<last-task-id>]` (or `chore: reconcile stranded <short-desc>` if no task ran). One reconciliation commit may group several paths **only** if they are one coherent orphan set, each path still enumerated in the `git add`.
   - **(B) Leave behind with a named owner.** The file belongs to another live flow — a concurrent `modeling` session's in-flight task, a still-un-verified worker's code, the user's own WIP, or known non-work noise (e.g. an untracked screenshot). Leave it untouched and record a leave-behind note that **names the presumed owner and the reason** (e.g. `owner: concurrent modeling session, in-flight task file`). This is a deliberate, attributed decision — not the old anonymous "untouched" boilerplate.
3. **Concurrency caution — ask, do not assume.** A *live* concurrent session's in-flight files are byte-indistinguishable from a crashed session's orphans. Committing another session's half-written markdown is the exact failure ADR-0026 §5 exists to prevent. So this step **asks the user per file** and never infers the disposition. When the owner is uncertain, the safe default is **(B) leave behind**, not (A) commit — you can always reconcile a true orphan next session, but a wrongly-committed live file is a race you cannot cleanly undo.
4. **The scoped-add rule is unchanged.** Reconciliation is still an enumerated `git add <path>` per deliberately-committed file — never `git add -A` / `git add .` (`references/commit-doctrine.md`), which would sweep in exactly the concurrent-sibling files disposition (B) exists to protect.
5. **Record the dispositions.** Carry every file's disposition into the session-end protocol entry's `**Carry-over:**` line (step 7): committed files as `<path>: committed (<label>)`, left-behind files as `<path>: left behind (owner: <flow>, <reason>)`. This replaces the "carry-over untouched, as in prior sessions" boilerplate — the protocol now records *what was decided and why*, per file, instead of silently repeating the leak.

### Worktree carry-over (extends this reconciliation — ADR-0032)

Run this alongside the working-tree carry-over above, at the same point in the session (after the last integration, before the session-end protocol entry): per-worker worktrees (`.worktrees/<task-id>/` on branch `aw/<task-id>`) get the same explicit-disposition treatment, extending **agentic-workflow-d6q4h**'s mechanism with a worktree category rather than replacing it.

1. **Detect.** Run `git worktree list --porcelain` (skip if not a git repo). Every entry other than the main worktree (the repo root) is a candidate. By this point every PASS/SKIP/BOUNCE this session completed already tore its worktree down (Git authority), so what remains is either a **known keep** (a FAIL-iteration-3 escalation from this session) or a genuine **orphan** (a session interrupted mid-cleanup, or a leftover from an earlier session).
2. **Surface, per worktree — never auto-remove.**
   - **Escalated this session (FAIL iteration 3)** → not an orphan, a deliberate keep. Record it plainly, no user prompt needed (the escalation itself already surfaced it in step 4 of the FAIL-iteration-3 handling above): `<path>: kept (owner: <task-id>, escalated at iteration 3 — see task notes)`.
   - **Everything else** (no matching `doing/` task on `main`, or the matching task is already `done/`/`backlog/`) → an **orphan**. Ask the user, per worktree, the same two dispositions as the working-tree case: **discard** it (unlink any `dashboard/node_modules` link first — `unlinkDashboardNodeModules` — then `git worktree remove --force` + `git branch -D aw/<task-id>`) or **keep** it for inspection. Never guess: a live concurrent session's worktree is byte-indistinguishable from an interrupted one's, same caution as the working-tree carry-over above.
3. **Record the disposition** on the same `**Carry-over:**` line as the working-tree entries (step 6 above) — e.g. `.worktrees/agentic-workflow-f6m2q: kept (owner: agentic-workflow-f6m2q, escalated at iteration 3)` or `.worktrees/agentic-workflow-old1: discarded (orphan, no matching doing/ task)`.
4. **Feeds Phase 1 recovery.** An orphan or a kept escalation that survives to the *next* session is exactly the signal Phase 1's `git worktree list --porcelain` check picks up — the two mechanisms are one continuous thread across sessions, not independent.

## Protocol rotation check (session-end)

Run this once per session, immediately after step 7's session-end protocol entry has been
committed (ADR-0045, closing ADR-0039's deferred "who invokes it" non-decision). This is the
self-firing cap-and-roll check ADR-0041 calls for: cheap, deterministic, and it runs exactly when
the live file has just grown from the entry step 7 just committed.

1. **Invoke `rotateProtocol` via the standard env-free plugin bootstrap** — the same
   homedir→cache→semver-max resolution the `claim`/`complete` CLI invocations already use (ADR-0038),
   pointed at `lib/protocol-rotation.mjs` instead of `lib/task-lifecycle-cli.mjs`:
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','protocol-rotation.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','protocol-rotation.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no protocol-rotation script found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});"
   ```
   This prints one manifest `{ok:true, rotated, changed:[paths], rolledMonths:[...], liveLines}` on
   stdout and exits 0 (or a structured `{ok:false, ...}` on some unexpected error — treat a non-zero
   exit / `ok:false` as a soft failure: change nothing, mention it in the end-of-run summary, and
   never let it block or fail the session).
2. **`rotated: false`** (the common case — the live file is still under the ~1,000-line cap) →
   nothing to do: no commit, no protocol entry. Silent no-op is correct — this check is meant to be
   invisible on every session that doesn't need it.
3. **`rotated: true`** → `git add` exactly the manifest's `changed` paths (the rewritten
   `protocol.md` plus every new/appended `.agentheim/knowledge/protocol/YYYY-MM.md` archive file it
   lists) — never `git add -A` / `git add .` (`references/commit-doctrine.md`) — and commit as its
   **own scoped commit**, separate from step 7's session-end-entry commit:
   `chore(agentic-workflow): rotate protocol — <rolledMonths joined with ", "> [<last-task-id>]`
   (or `chore: rotate protocol — ...` if the session completed no task, mirroring step 7's fallback
   trailer convention).
4. **No protocol log entry for the rotation itself.** Rotation is infrastructure housekeeping, not a
   project event worth a diary line — logging it would just add another entry pushing the file
   closer to needing rotation again. The commit message and the archive files themselves are the
   audit trail.

## INDEX done-list rotation check (session-end)

Run this once per session, immediately after the protocol rotation check above (step 9, ADR-0047,
closing ADR-0045's deferred "sibling surface" scope boundary). Same self-firing cap-and-roll
posture as the protocol check, applied to every bounded context's `INDEX.md` `done-list` instead of
`protocol.md` — cheap, deterministic, and it runs exactly when the session's `completeTask` calls
have just grown one or more BCs' done-lists.

1. **Invoke `rotateAllIndexDoneLists` via the standard env-free plugin bootstrap** — the same
   homedir→cache→semver-max resolution the protocol-rotation check and the `claim`/`complete` CLI
   invocations already use (ADR-0038), pointed at `lib/index-rotation.mjs` instead of
   `lib/protocol-rotation.mjs`:
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','index-rotation.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','index-rotation.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no index-rotation script found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});"
   ```
   This prints one manifest `{ok:true, rotated, changed:[paths], contexts:{<bc>:{ok, rotated,
   changed, rolledMonths, liveEntries}, ...}}` on stdout and exits 0 (or a structured `{ok:false,
   ...}` on some unexpected error — treat a non-zero exit / `ok:false` as a soft failure: change
   nothing, mention it in the end-of-run summary, and never let it block or fail the session). Note
   the shape differs from the protocol check's manifest: the top-level `rotated`/`changed` are
   aggregated across every BC, and each BC's own `rolledMonths` lives under `contexts[<bc>]`, not at
   the top level.
2. **`rotated: false`** (the common case — every BC's live done-list is still under the ~30-entry
   cap) → nothing to do: no commit, no protocol entry. Silent no-op is correct — this check is meant
   to be invisible on every session that doesn't need it.
3. **`rotated: true`** → `git add` exactly the top-level manifest's `changed` paths (every rewritten
   `INDEX.md` plus every new/appended `contexts/<bc>/done-archive/YYYY-MM.md` file it lists) — never
   `git add -A` / `git add .` (`references/commit-doctrine.md`) — and commit as its **own scoped
   commit**, separate from both step 7's session-end-entry commit and step 8's protocol-rotation
   commit: `chore(agentic-workflow): rotate INDEX done-list — <bc>:<rolledMonths joined with ", ">[, <bc2>:<rolledMonths2>...] [<last-task-id>]`
   — one `<bc>:<rolledMonths>` segment per BC that actually rotated (read each rotated BC's own
   `rolledMonths` from `contexts[<bc>].rolledMonths`, comma-joined when a BC rolled more than one
   month), the segments themselves comma-joined when more than one BC rotated (or `chore: rotate
   INDEX done-list — ...` if the session completed no task, mirroring step 7's and step 8's fallback
   trailer convention).
4. **No protocol log entry for the rotation itself.** Same reasoning as the protocol check: this is
   infrastructure housekeeping, not a project event worth a diary line. The commit message and the
   archive files themselves are the audit trail.

## Do not model in work

If a worker realizes mid-task that the scope is actually under-refined, it bounces to backlog — it does not try to refine the task itself. Refinement is the `modeling` skill's job, with the user in the loop. Workers executing under-specified tasks produce plausible-looking but wrong output — that's the worst possible outcome.
