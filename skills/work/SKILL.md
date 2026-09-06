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

The `work` skill turns refined `todo/` tasks into real code and real decisions. It is a loop, not a one-shot: by default it keeps going until todo is empty (or the user stops it), and it picks up tasks added mid-run. Naming one or more task ids on the invocation **scopes** the run instead — see "Argument grammar" below: the loop then ends once that named set reaches a terminal state, and newly promoted tasks are never picked up mid-run.

**The conductor (you) never writes code.** You coordinate: scan, build the DAG, dispatch workers, commit, log. Keeping you lean prevents context exhaustion across long batches. All coding work is delegated to subagents.

**Git model: per-worker worktree isolation (ADR-0032).** Every parallel worker runs in its own git worktree on a private branch — never the shared main tree. Git's own 3-way merge is the conflict detector at integration time, not a prose scan at dispatch time; the verifier's test run is isolated from every sibling worker's uncommitted changes. `main` is written only by the conductor, only sequentially, exactly as ADR-0026 already required — this strengthens that invariant, it does not relax it. See "Phase 4: Batch dispatch" and "Git authority" below for the full choreography.

**Live observability (ADR-0043, agentic-workflow-m9w5c).** This skill's own `Stop` hook (frontmatter above) fires on every orchestrator turn while `work` is active and heartbeats `.agentheim/state/in-flight.json` — a git-ignored ADVISORY artifact (ADR-0027's category), never a lifecycle write. `agents/worker.md` and `agents/verifier.md` carry their own `Stop` hook (auto-converted to `SubagentStop` when that subagent finishes) recording each completion. The dashboard's `InFlightLane` reads this artifact read-only (ADR-0017) and self-suppresses once the heartbeat goes stale — no zombie lane survives a crashed/killed session. This is pure side-channel observability: it changes nothing about how `work` dispatches, verifies, or commits.

## Argument grammar (ADR-0071, agentic-workflow-swj2q)

`/agentheim:work` accepts an optional list of task ids that **scopes** the run to exactly those tasks. This is a selection filter on Phase 2–4 below — it changes *which* tasks get dispatched and *when the loop ends*, nothing else. Every other mechanism (Phase 1 recovery, the DAG gate, worktree isolation, the verifier gate, squash-merge integration, `complete`, session-end bookkeeping, vision conformance) runs exactly as on an unscoped run.

- **`/agentheim:work`** — bare, no ids: the whole ready set, capped at `MAX_PARALLEL` per wave, looping until `todo/` is empty across every BC (or the user stops it). Newly promoted `todo/` tasks are picked up on the next Phase 2 re-scan. This is today's behaviour, unchanged.
- **`/agentheim:work <task-id>`** — a **scoped run**: the batch is exactly that one task (if ready). The loop ends the moment that task reaches a terminal state — integrated (PASS/SKIP), bounced, failed, or escalated after iteration 3 — whichever comes first. A newly promoted `todo/` task is **never** picked up mid-run in a scoped run, no matter how ready it becomes.
- **`/agentheim:work <id-1> <id-2> …`** (space- or comma-separated) — the same scoping, over an explicit small set. Still capped at `MAX_PARALLEL` per dispatch wave (Phase 3 step 4) and still merge-ordered by the Phase 3 advisory; if the named set is larger than the cap, dispatch the first wave, then continue dispatching the remaining named ids in subsequent waves (Phase 4 step 7) — **never** widen the run to the full ready set. The scoped run ends once every named id has reached a terminal state.
- **`--no-verify`** composes with any of the above exactly as today — it is an orthogonal opt-out of the verification gate (see "When to skip verification" below), not a selector.

### Id resolution — exact match only, fail-closed

A named id is resolved by **exact string match** against task filenames/frontmatter `id:` across every lifecycle folder in every BC — no fuzzy matching, no keyword search, no "closest match" guessing (that stays `modeling`'s job, never `work`'s). Resolve every named id **before any file moves for this run** (during Phase 2's scan, which already reads every BC's `todo/`/`doing/`/`backlog/`/`done/`), against three outcomes:

1. **Not found anywhere** — refuse the run, naming the id and stating it does not resolve to any task in this project. Do not guess a similar id.
2. **Found, but not in any BC's `todo/`** — refuse, naming the id's actual lifecycle folder (`backlog/`, `doing/`, or `done/`) so the builder knows where to look — e.g. "`agentic-workflow-xyz` is in `backlog/`, not `todo/` — promote it via `modeling` first" or "`agentic-workflow-xyz` is already `done/`."
3. **Found in `todo/`, but not ready** — the DAG gate (Phase 2 step 5, ADR-0038 Ruling A, fail-closed) applies exactly as for any other task: refuse, naming every unmet or dangling `depends_on` id. **The `claim` verb is never invoked for a refused id** — the refusal happens before any file moves, narrowing the existing unready-task handling to the named set instead of silently excluding it from a larger batch.

A run naming a mix of valid-and-ready and refused ids refuses the **whole invocation** rather than silently dropping the bad ones — the builder named an explicit set; partial silent substitution would be exactly the kind of silent truncation the "cap triggered — never truncate silently" rule (Protocol logging, below) already forbids for the unscoped case.

Phase 1's recovery check always runs first, unscoped or scoped: a stranded `doing/` task from an interrupted prior session is resumed **before** any scoped dispatch, even when the builder named a different task this time — naming a task never authorizes skipping recovery.

## Phase 1: Recovery check

Before anything else, look at `contexts/*/doing/` **and**, if this is a git repo, run `git worktree list --porcelain` (an orphaned `aw/<task-id>` worktree is the other half of the interrupted-session signal, alongside a stranded `doing/` task):

- **0 tasks, 0 non-main worktrees** → proceed to Phase 2.
- **1 task** → a previous session was interrupted. Resume it sequentially as the first task of this session, *before* starting any parallel dispatch. If a worktree + branch `aw/<task-id>` already exists for it (a FAIL-iteration interruption), reuse that worktree — do not create a second one. If no worktree exists (the batch-start commit landed but dispatch never happened), create one fresh: `git worktree add -b aw/<task-id> .worktrees/<task-id> HEAD`.
- **2+ tasks** → a previous parallel session was interrupted. Ask the user: "Resume all in parallel", "Resume one at a time", or "Abandon — move them back to todo". Do not guess. Resuming reuses each task's existing worktree where one exists.
- **A non-main worktree with no matching `doing/` task** → likely an orphan from a session that ended mid-cleanup. Surface it to the user for an explicit disposition rather than silently removing it — same posture as the session-end reconciliation below.
- **A non-main worktree with `MERGE_HEAD` set** (ADR-0072 — check `.git/worktrees/<id>/MERGE_HEAD` via `git -C .worktrees/<id> rev-parse -q --verify MERGE_HEAD`) → a session was interrupted **mid-ladder**, between rung 3's `git merge main` and rung 5's checkpoint. This is neither "no worktree" nor an ordinary "FAIL-iteration worktree" — surface it explicitly as **mid-conflict** and let the user choose: **abort the merge** (`git -C .worktrees/<id> merge --abort`) and resume as an ordinary kept-worktree escalation (rung 7's ergonomics), or **discard** it (salvage first — tag `discarded`, see "Salvaging a worktree's diff before abandonment" — then remove). Never silently resume it as a plain FAIL re-dispatch: the worker would be handed marker-laden files under a prompt that never says so.

Also run the **session-start human-churn reconciliation** once per session (see the dedicated section below), independent of which recovery scenario above applied — it runs whether or not there was an interrupted session to resume. Do this last in Phase 1, immediately before moving on to Phase 2.

## Session-start human-churn reconciliation

Run this once per session, at the end of Phase 1, before Phase 2's dependency-graph scan — the mirror image of "Reconciling stranded carry-over"'s session-**end** step below, at the other end of the session (ADR-0066, agentic-workflow-hhjjx). A human/out-of-band commit leaves the agents' world model stale (tests pinned to the old state fail mysteriously); this step surfaces that drift at session start, before it causes confusion mid-session.

1. **Read the last session-end boundary.** Read `.agentheim/knowledge/protocol.md`'s first ~100 lines (the same excerpt Phase 2 step 3 reads — if you haven't reached Phase 2 yet this session, do this one read here and reuse it there; never read the file twice for the same session). Find the most recent `## YYYY-MM-DD HH:MM -- Work session ended` entry via `lib/session-start-churn.mjs`'s `resolveSinceLastSessionEnd` — runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §2 (step 1). If it returns `null` — no prior session-end entry exists (a fresh project, or one that has never run a `work` session to completion) — **skip this whole reconciliation silently** and proceed to Phase 2. There is nothing yet to compare against.
2. **Read the commit range since that boundary.** If the project isn't a git repo, skip this whole reconciliation. Otherwise, on the main tree:
   ```
   git log --since="<since>" --name-only --format="%x1eCOMMIT%x1f%H%x1f%s"
   ```
   (`<since>` is `resolveSinceLastSessionEnd`'s `since` field, `"YYYY-MM-DD HH:MM"`.) This is the one git read this reconciliation performs, and it stays a **conductor** prose step, never a `lib/` module (ADR-0038's git-free boundary) — the helper only parses text handed to it.
3. **Parse, filter to untrailed commits, and partition by known machine shape.** Feed the raw output to `lib/session-start-churn.mjs`'s `parseCommitLog`, then `findUntrailedCommits` — every commit whose subject carries no `[<task-id>]` bracketed trailer (ADR-0026). Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §2 (step 3), which now also runs the partition step below. Then split the untrailed set via `partitionUntrailedCommits`, which matches each subject against `recognizeMachineShape`'s closed, deterministic set of known trailer-less machine shapes — the four trailer-less rows of `references/commit-doctrine.md`'s "Message convention" table (`modeling` DISMISS, `modeling` CONSOLIDATE, `brainstorm`'s session commit, `research`'s report-cleared-review commit), plus `work`'s own four bare fallback shapes when a session completes no task from its "`work`'s own non-task-commit shapes" table (the reconcile-stranded-carry-over commit, the session-end bookkeeping commit, and both rotation commits; the batch-start and BOUNCE-integration shapes always carry a trailer, so they are never part of this list) — eight shapes total, this module's pattern set mirroring both tables' trailer-less rows exactly (ADR-0066 amendment, `agentic-workflow-pzacx`, replacing the original "deliberately do not try to tell them apart" stance for the *known* shapes). A subject matching none of the known shapes is still counted as human, unchanged — recall over precision on the genuinely-unknown case is exactly as before. If `findUntrailedCommits` returns nothing, both counts are zero; move straight to step 5.
4. **Judge which touched files are governed** (this is the skill's judgment call, not the `lib/` helper's — ADR-0038's three-layer boundary; `lib/session-start-churn.mjs` deliberately stops at parsing/formatting and does no governed-surface matching itself). This applies to **every** untrailed commit — recognized-machine-shape or human alike, since even a known machine shape touching a governed file is worth a glance. For each untrailed commit's files, flag any that:
   - are described or referenced as the subject of an ADR under `.agentheim/knowledge/decisions/` (the decision you'd want to re-consult before that file changes again), or
   - are named in a BC README's `## Runtime surface` manifest, ubiquitous-language entries, or Key-commands section (the file the README already documents as load-bearing for an invariant).
   This is a judgment skim, not an exhaustive cross-reference — check the BCs the touched paths belong to (their READMEs are already this session's working context) and any ADR titles you recognize as governing that area; it does not require reading every ADR in the project before Phase 2 can proceed.
5. **Surface as an advisory — never auto-file, never gate.** Print exactly **one summary line** via `formatChurnSummaryLine`'s partition — "N recognized machine-shape commits, M human commits" — always, even when both are zero. Then **itemize only the governed-surface hits** found by step 4 (via `formatUntrailedCommitLine`, appending the governed-file flag, e.g. "— touches a file ADR-0032 describes; consider a re-alignment task") — a recognized-shape or human commit that touched no governed file gets no individual line; the summary line already accounts for it. Print both at the top of the session, before Phase 2's "X tasks ready..." line — this is the **session-start line** the acceptance criteria name.
   - **Never auto-file a task.** This step recommends; it never creates a `todo/`/`backlog/` task on its own initiative — that decision belongs to the builder, via an explicit ask or a `modeling` CAPTURE.
   - **When at least one commit is flagged as touching a governed surface**, also (over)write `.agentheim/state/whats-next.md` (ADR-0027 advisory-write family) — **Recommended move** naming the flagged commit(s)/file(s) and inviting the builder to approve an explicit re-alignment task via `modeling`; **Next** suggesting the builder review the diff (`git show <short-sha>`). Skip this write entirely when nothing is flagged — a clean read writes nothing, exactly as the vision-conformance pass does below. This write happens early (session start), before Phase 2's vacuum guard or the eventual session-end vision-conformance pass might write the same file later in the *same* session — by design (ADR-0027's single-latest semantics, the same "whichever pass wrote it last is the current recommendation" precedent the vision-conformance section documents): no collision-avoidance beyond that ordering is needed.
   - **Never a gate.** No matter what this step finds, Phase 2 proceeds exactly as it otherwise would. This is advisory-only, the ADR-0027 family, exactly as read-only over lifecycle as the vision-conformance / vacuum-guard / carry-over passes elsewhere in this skill.

## Phase 2: Build the dependency graph

1. Read `.agentheim/vision.md` and `.agentheim/context-map.md` for orientation.
2. Read `.agentheim/knowledge/index.md` (top-level catalog — current BCs and recent ADRs). If missing, surface to user that the project hasn't been indexed and offer to run `scripts/backfill-indexes.ps1` before continuing — workers will be less effective without indexes.
3. Read the first ~100 lines of `.agentheim/knowledge/protocol.md` (newest entries are on top — this gives recent activity context). Skip if it doesn't exist yet. **Hold this excerpt in memory** — you pass it forward to each worker as `## Recent activity` so workers don't re-read the protocol themselves. The live file is capped (ADR-0039) — older months roll out verbatim to `.agentheim/knowledge/protocol/YYYY-MM.md`, so this ~100-line read always yields recent activity regardless of the live file's age; there is no need to consult the archive here.
4. Scan `.agentheim/contexts/*/todo/` and `.agentheim/contexts/*/doing/`.
5. For every todo task, read `depends_on`. A task is *ready* if every id in `depends_on` is in `done/`. **Fail-closed** (ADR-0038 Ruling A): a `depends_on` id present in NO lifecycle folder (`backlog/`, `todo/`, `doing/`, `done/`, across every BC) counts as **unsatisfied** — the task is not ready, and the dangling id is surfaced to the user, never silently treated as satisfied. This matches `dependencySatisfied()` in `lib/task-lifecycle.mjs` exactly (no code change needed there — only this prose used to disagree with it). **Scoped run** (see "Argument grammar" above): apply this same readiness check, plus the exact-match / lifecycle-folder resolution from that section, to the named id(s) specifically — an unready or unresolved named id refuses the whole run rather than being silently excluded from a larger batch.
6. **Detect cycles.** If the graph has a cycle, stop and surface the cycle to the user. Do not "just pick one".
7. Briefly tell the user what you found: "X tasks ready across N contexts, Y tasks blocked on Z." For a **scoped run**, report instead which named id(s) resolved ready and how many other ready tasks exist but will not be dispatched this run, e.g. "Scoped run: dispatching agentic-workflow-xyz; 3 other ready tasks not dispatched this run."
8. **Vacuum guard** (ADR-0064, agentic-workflow-qz1h7; refusal-placement fix agentic-workflow-f3wqm/ADR-0064 amendment). Run this only when step 7 found **zero ready tasks across every BC** (a genuinely empty ready set, not merely this batch).
   - **Do not self-generate substitute work, unconditionally on an empty ready set.** No manufacturing a chore task, no wandering into unrelated test-suite maintenance, no drafting bookkeeping busywork on your own initiative just because the board is empty (ADR-0064). This refusal applies the moment step 7 finds zero ready tasks — whether or not vision.md turns out to have an open question to surface below; an empty "Open questions" section is not licence to invent filler.
   - Read `.agentheim/vision.md`'s "## Open questions" section (already in hand from step 1) through `lib/vacuum-guard.mjs`'s `extractOpenQuestions` — it filters out already-resolved (struck-through) items and returns each remaining item with its `since` date. Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §3 (vacuum guard). If it returns **one or more** open items:
     - **Surface the open item(s) with their age**, via `formatVacuumGuardLine` (e.g. "Brainstorm on existing code (next iteration). (open 46 days)"), and say plainly that resolving one of these is the single highest-leverage thing the builder can do right now — more valuable to the project than anything this session could invent on its own from an empty board.
     - **Write a minimal session-end protocol entry, then stop** (agentic-workflow-c5nvb). Skipping this leaves `resolveSinceLastSessionEnd`'s window with no boundary at this session's end, so the session-start human-churn reconciliation's next run reaches back past it — the same untrailed commits get re-flagged every subsequent session until a real session-end entry eventually lands. Prepend the minimal shape below — not the full step-8 template further down (there is no batch to summarize):
       ```markdown
       ## YYYY-MM-DD HH:MM -- Work session ended

       **Type:** Work / Session end
       **Completed:** 0 — vacuum guard exit (no ready tasks; open item(s) surfaced above)

       ---
       ```
       Commit it exactly as the fallback trailer convention step 8 below uses when a session completes no task: scoped `git add .agentheim/knowledge/protocol.md`, then `chore: work session end bookkeeping` (no `[<task-id>]` trailer). Skip straight to a one-line "nothing ran this session" note after that, rather than the full End-of-run reporting machinery below (steps 1-10) — no batch-mix line, no vision-conformance pass, no carry-over reconciliation, no rotation checks; this entry exists solely to give the *next* session's churn reconciliation a boundary to resolve against.
   - **Never a hard gate** (`isVacuum` only *informs* this step — it never blocks a command). If the user explicitly asks for something else anyway ("do it anyway", "add a chore for the flaky test", "dispatch harness cleanup") — do exactly that. The guard only suppresses work the session would invent unprompted; it never refuses an explicit builder request (vision non-goal 3, "Not autonomous").
   If step 7 found ready tasks, this whole step is a no-op — proceed to Phase 3 exactly as before. If the ready set is empty but `extractOpenQuestions` returns nothing (vision.md has no unresolved open questions, or is missing), the do-not-self-generate refusal above still holds — there is simply no open item to surface — proceed to Phase 3 exactly as before (there is nothing ready to dispatch there either).

## Phase 3: Conflict pre-scan — advisory only (ADR-0032 demoted this from a throttle; agentic-workflow-ghcaj retires the README half)

Textual conflict prediction used to hard-demote tasks because the shared working tree made a real collision unsafe. Per-worker worktree isolation (ADR-0032) removes that unsafety: two workers touching the same file now collide at **merge-back**, where git's real 3-way merge either resolves it cleanly or surfaces an actual conflict — never a guess from English. The pre-scan survives only as a cheap **advisory** for merge ordering, and even that advisory has shrunk: since a worker's branch carries source and tests only (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6), the BC README/ADR half of the old same-BC-README overlap case can no longer collide at merge-back at all — `applyReadmeDelta` and `finalizeAdrNumbering` apply sequentially on `main`, never as a git 3-way merge, so there is nothing left to pre-flag there. **The same-BC-README annotation is retired outright, not merely demoted** — the annotation step below is scoped to genuine CODE-file overlap only.

1. For each ready task, scan its `What`, `Acceptance criteria`, and `Notes` sections for file paths and directory references naming **source or test files** — never a BC README, an ADR, or any other `.agentheim/` path, since no worker branch can touch those anymore.
2. If two ready tasks reference the same source/test file or directory, **annotate them** for sequential merge-ordering — dispatch both in the same batch, but plan to squash-merge them one after another rather than out of order, so a real conflict (if one occurs) surfaces predictably. Do **not** demote either task to a later batch on this basis alone — that throttle is retired.
3. **Weigh the planning advisory (read-only influence, never a selector).** If `.agentheim/state/whats-next.md` exists, read it and note its latest *recommended move* + age (`generated` timestamp) — this informs **ordering/priority among the already-ready tasks** picked in step 4 below, surfaced in the batch rationale (see the "Batch started" protocol entry's optional `**Planning advisory:**` line under "Protocol logging"). Compare `generated` against the newest `## … -- Work / …` entry in the protocol excerpt already read in Phase 2 step 3: newer than that entry → treat as **current**, and let it nudge which ready tasks get priority (e.g. break a tie between two equally-ready tasks toward the recommended one, or dispatch the recommended task earlier within the batch); older → treat as **stale — background context**, weighted less; no Work entries yet in the protocol → not stale. It **never** overrides the dependency DAG, never promotes an un-ready task into the batch, and never demotes a task the DAG says is ready — it only informs ordering among tasks step 4 was already going to select from. A missing artifact is silent — no note, no weighting. A malformed / partial / headingless artifact degrades gracefully: read whatever is parseable and proceed without blocking batch planning; never throw.
4. **Cap the batch at `MAX_PARALLEL` (default `3`)** — a **named, user-settable knob**, not a hardcoded limit: the user can raise or lower it for a session ("run 5 in parallel", "just do them one at a time") and that overrides the default for the rest of the run. Absent an explicit ask, stay at 3 — the default balances merge-conflict surface at integration against verifier review load; isolation (ADR-0032) makes raising it safer than it used to be, but review load doesn't shrink just because merge risk did. Pick the lowest-numbered unblocked tasks, adjusted by the advisory weighting from step 3 where it applies; the merge-order annotation from step 2 only affects merge *order*, never selection. **Scoped run** (see "Argument grammar" above): the candidate pool is the named id(s) only, in the order named (not lowest-numbered) — the advisory weighting from step 3 still applies for ordering only, never for selection, since selection is already fixed by the builder's named set.
   - **Remediation-over-diagnosis (ADR-0065, agentic-workflow-rx630, Dorc review recommendation A5).** Within that pick, a ready remediation task whose root cause is already diagnosed and whose fix is cheap outranks a ready further-diagnosis `spike` on the **same thread** — dispatch the remediation first (or in the same batch ahead of the spike), not after it. **Same thread** means any of: the two tasks share a `tags` entry naming the defect family, one is named in the other's `depends_on`/`blocks`, or one is named in the other's `prior_art`. This is a **dispatch-ordering preference, not a gate** — it never removes a ready spike from the batch, it only orders the remediation ahead of it. If the builder has explicitly asked for the deeper diagnosis on that thread ("dig deeper first", "I want root cause before we patch"), dispatch as asked — the preference only breaks an otherwise-unforced tie.
   - **Backlog-stranded same-thread remediation, surfaced (ADR-0065, agentic-workflow-t8kfq, closing the doctrine's own founding-incident gap).** When a ready `type: spike` task selected for this batch has a same-thread remediation (same "same thread" test as the bullet above — shared `tags` defect-family entry, or a `depends_on`/`blocks`/`prior_art` link) sitting **unpromoted in that BC's `backlog/`** rather than in `todo/`, surface it as one line in the batch rationale: "ready spike `<id>` has an unpromoted same-thread remediation `<id>` in backlog — promote first?" This is **advisory only** — it never gates the spike out of the batch and never auto-promotes the backlog task into `todo/` (ADR-0027 family); it only gives the builder the chance to reorder before the spike runs.

## Phase 4: Batch dispatch

Every dispatch wave now runs each worker in its own **git worktree** on a private branch (ADR-0032) — the shared-tree model is retired. The choreography, in order:

1. **Batch-start claim commit.** On the **main** tree, the `todo → doing` batch move + `INDEX.md` edits + the "Batch started" `protocol.md` entry are **mechanized** (ADR-0038, agentic-workflow-t7m4c): run the CLAIM verb of `lib/task-lifecycle-cli.mjs` against a comma-separated id list —
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','task-lifecycle-cli.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','task-lifecycle-cli.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no task-lifecycle CLI found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" claim <id-1>,<id-2>,... '{"parallel":"<the Parallel: line value you already composed in Phase 3 step 4 / the cap-triggered note below>","planningAdvisory":"<Phase 3 step 3's advisory line, if any — omit the whole key when absent>"}'
   ```
   (Same env-free homedir→cache→semver-max bootstrap infrastructure-010 established for `/dashboard`, reused verbatim from `modeling/SKILL.md`'s PROMOTE flow — runs in-process, cwd = the project. The trailing JSON is optional; omit the whole third argument for a plain, un-annotated batch. For a **scoped run** (see "Argument grammar" above), `<id-1>,<id-2>,...` is exactly the — possibly cap-limited — subset of the builder's named ids being dispatched this wave, never the DAG's full ready set; compose the `parallel` JSON opt per the "Scoped run — record it explicitly" note under Protocol logging below.) It prints **one** manifest `{changed, message, verb:'claim', ids}` covering the whole batch — grouped per-BC internally if the batch spans more than one bounded context (`work`'s Phase 2 scans every BC's `todo/` at once, so this is a real shape, not a hypothetical) — or a structured `{ok:false, code, reason}` rejection if a selected id no longer resolves in `todo/` (a race with a concurrent `modeling` session; **nothing is moved** when this happens — the pre-check runs before any file touches disk, so retry after re-scanning). `git add` the manifest's `changed` paths and **commit** with its `message` verbatim: `chore(<bc>): batch start [<id-1>] [<id-2>] …` (single-BC batch), or `chore: batch start […]` — no `<bc>` token — when the batch spans multiple contexts. This is the **one** deliberate amendment to ADR-0026: the `todo → doing` half of the lifecycle move now rides in this per-batch commit instead of folding into each task's final commit — `git worktree add` checks out a *committed* state, so the worktree's base must already hold the task in `doing/`. If the project isn't a git repo, skip the commit and every worktree step below — just run the `claim` script anyway to get the files moved (ignore its manifest/message, there's nothing to commit) and proceed to spawn workers against the one working tree exactly as before ADR-0032 (see "Windows & node_modules" at the end of "Git authority").

2. **Create one worktree per task**, from that commit's HEAD:
   ```
   git worktree add -b aw/<task-id> .worktrees/<task-id> HEAD
   ```
   The worktree holds the task already in `doing/`, matching the worker prompt below.

3. **Lazily link `dashboard/node_modules` for dashboard-touching tasks only.** If the task's `What`/`Acceptance criteria` name `dashboard/`, call `linkDashboardNodeModules(worktreeRoot, mainRoot)` (`lib/worktree-node-modules.mjs`) — it junctions (Windows) / symlinks (POSIX) the worktree's `dashboard/node_modules` to the ONE real one in the main tree. No per-worktree `npm install`. Every other task's worktree gets no link and needs none. (`taskTouchesDashboard(fileList)` in the same module is a pure helper for this check once a `FILE_LIST` exists; at dispatch time you're deciding from the task's own prose.)

4. **Set `git config core.longpaths true`** once per session (harness setup, not per-worktree) if not already set — worktrees nest `.agentheim/` and `dashboard/` trees deep enough to approach Windows `MAX_PATH`.

5. **Spawn one subagent per task** using the Agent tool with `subagent_type: "agentheim:worker"`. Launch all subagents in **one message** (parallel tool calls). Use the Subagent Prompt Template below — its `## Your task` block now carries a `Workspace` field pointing at the task's worktree, and the BC README and BC index paths you pass also point **inside that worktree**; the task-file path is **`main`'s one copy**, read-only to the worker (agentic-workflow-ghcaj).

6. **Wait for all subagents to complete.** As each returns:
   - Parse its strict return format (see template).
   - For `RESULT: SUCCESS`: **verify the result** (see "Verification gate" below). Only integrate to `main` after verification passes.
   - For `RESULT: BOUNCED`: see "BOUNCE integration" at the end of "Verification gate" below — a small, verifier-free squash-merge back to `main`, then worktree cleanup.
   - For `RESULT: FAILED`: log "Task failed" to protocol.md with the error, on the **main** tree (there is no worktree content worth merging). Remove the worktree + branch (`git worktree remove --force` + `git branch -D aw/<task-id>`) — the task stays in `doing/` on `main` (from the batch-start commit) so it doesn't silently retry. Tell the user at the end.
   - One failure does not block the batch — the other subagents continue and are processed normally.

7. **After the batch completes**, return to Phase 2 — re-scan. New tasks may have been promoted to todo (via parallel `modeling` invocations) or new dependencies may have unblocked. **Scoped run** (see "Argument grammar" above): skip the re-scan entirely. If any named ids remain undispatched (the cap held some back), dispatch the next wave directly from the remaining named ids — never re-scan `todo/` for newly promoted or newly-ready tasks. Once every named id has reached a terminal state (integrated, bounced, failed, or escalated), the run ends (see End-of-run reporting) — it does not loop back to Phase 2's full DAG scan at all.

## Nested fan-out budget (worst case — documented, not enforced)

Each dispatched worker can, on its own initiative, spawn further subagents — a direct single-specialist consultation (ADR-0035), or an `orchestrator` call that itself fans out to 1–4 specialists when a question spans more than one domain. Those nested spawns happen *inside* a worker's own subagent context: invisible to and uncontrollable by the conductor, with no cap on nested concurrency the Agent tool exposes. This section states the worst case honestly rather than inventing a mechanism the conductor cannot actually run.

- **Worst-case shape per batch:** up to `MAX_PARALLEL` workers, each capable of triggering one orchestrator call fanning out to up to 4 specialists — ≈ `MAX_PARALLEL × (1 orchestrator + up to 4 specialists)`. A FAIL-triggered re-dispatch repeats that same worker's chain, so a stubborn task can repeat this fan-out across iterations, not just once.
- **The only lever the conductor can enforce is `MAX_PARALLEL` itself** (Phase 3 step 4) — the sole fan-out point it directly controls (Phase 4 step 5). Everything past that first level is the worker's own call.
- **The structural mitigation is agentic-workflow-n6r8j** (prefer-direct-consultation): routing a worker's single-specialist question straight to that specialist collapses the middle hop, shrinking the worst case toward `1 specialist` for the common case — it shrinks the *per-worker* fan-out `MAX_PARALLEL` multiplies, not the batch cap itself.
- **What this is not:** a claim that the conductor enforces, counts, or observes second-order spawns — it cannot. `MAX_PARALLEL` plus n6r8j-style flattening are the only real levers until a future harness surfaces nested-spawn telemetry.

## Verification gate (post-SUCCESS, pre-commit)

A worker returning `RESULT: SUCCESS` is not yet a commit. Every SUCCESS goes through the `verification-before-completion` gate — a separate `verifier` agent inspects the diff against the acceptance criteria with fresh context. This is the structural defense against plausible-but-wrong code.

The full doctrine lives in `skills/verification-before-completion/SKILL.md`. The operational integration here is:

### When to skip verification

Skip the gate (commit immediately on SUCCESS) when any of these is true:

- The project is not a git repo (no diff to inspect).
- The user invoked `work` with `--no-verify` or said "skip verification this run" — opt-out is per-batch, never persistent.
- The task is `type: decision` AND `FILES_CHANGED == 0` AND the worker's `ADRS` block carries exactly one entry — auto-SKIP without spawning the verifier. (Post-ghcaj: a decision-only task writes no source/test file and no `.agentheim/` file either — its ADR travels in the `ADRS` block, not on disk, so `FILES_CHANGED` is `0`, not `1`.)

Otherwise, verify.

### Verifier dispatch

**Resolve the test command once per batch (per BC), not per verifier and not per iteration.** Before spawning the batch's verifiers, determine the project's test command using the same discovery order the verifier uses as its fallback — the BC README first, then the project root (`package.json` scripts, `Makefile` targets, `pyproject.toml`, `Cargo.toml`, `*.csproj`, `go.mod`). Cache the resolved command per BC (different BCs may have different commands) and pass it into every verifier spawn this batch — **including re-dispatched verifiers on FAIL iterations 2 and 3: reuse the cached command, never re-resolve per iteration.** This mirrors how workers receive pre-loaded ADRs — resolve once, hand it forward. If no command is discoverable for a BC, pass the literal `none` in the block and let the verifier apply its fail-closed rule.

**Resolve the runtime-surface manifest once per batch (per BC), same seam (ADR-0036).** Alongside the test command, read the BC README for a `## Runtime surface` fenced block. If present, parse its `surfacePaths`, `launch`, `stop`, `runfile`, `probes`, and optional `renderPaths` once — cache per BC, reuse across every verifier spawn this batch **including re-dispatched verifiers on FAIL iterations 2 and 3**, never re-parse per iteration. If the BC README carries no such block, cache `none` for that BC — every verifier spawned for it then skips check 8 entirely, for every task, regardless of what the diff touches. Pass the cached manifest (or `none`) into every verifier spawn as the `## Pre-resolved launch command` block below.

Before capturing a diff, make the worker's committed-but-ephemeral checkpoint: **the conductor** (never the worker) stages and commits the worker's enumerated output **inside its worktree** — via the `checkpoint` verb, not a hand-composed `git add` (agentic-workflow-q7v3k, ADR-0057): `node lib/task-lifecycle-cli.mjs checkpoint <task-id> '{"fileList":["<abs-path-1>", ...the worker's FILE_LIST — source and tests only, agentic-workflow-ghcaj — never a task file, a README, or an ADR, "..."], "iteration": N}'` run with cwd inside the worktree. It returns one manifest `{ok, changed, refused, refusalReason, message, verb:'checkpoint'}`: `git -C .worktrees/<task-id> add <changed>` (never the raw FILE_LIST — `changed` is the guarded subset), then `git -C .worktrees/<task-id> commit -m "<message>"` (the manifest's `message` is already `"wip [<task-id>] iter N"`). **The checkpoint guard now refuses two families of path**, each with its own reason: `derived-artifact` (today: any `dashboard/dist/` entry, ADR-0003) and, post-ghcaj, `bookkeeping-path` (any `.agentheim/` path at all — a worker's worktree never legitimately contains one anymore; the moved-from-`doing/` detection (agentic-workflow-w2njd) still runs but is now vestigial for the worker path, since no task file ever moves inside a worktree, and both halves it would have folded in are themselves refused as `bookkeeping-path` — kept with this note rather than removed, cleanup is a follow-up). A non-empty `refused` is not a failure — it silently drops each refused path from staging and **continues**; surface `refused` (with `refusalReason`) in the end-of-run summary and prepend it to any FAIL re-dispatch prompt, but never fail the task or the batch over it. This commit is ephemeral: the eventual squash-merge (see "Git authority") collapses it, so it never reaches `main` history on its own. Keeping this commit with the conductor, not the worker, keeps the *worker never runs git* rule untouched. The conductor's own sanctioned main-tree writes (the rebuild-from-merged-source, and now every `.agentheim/` bookkeeping write in the PASS/SKIP integration order below) never route through `checkpoint` at all — they aren't exempted by any actor check, they are simply a different code path, since `checkpoint` only ever runs against a worktree.

For each SUCCESS that requires verification, in parallel where the workers ran in parallel:

1. Capture the diff **from the worktree, not the main tree**: `git -C .worktrees/<task-id> show HEAD` (the wip-commit's full diff) and `git -C .worktrees/<task-id> show HEAD --stat`. This is the isolation payoff — the diff (and the verifier's later test run) can never contain a sibling worker's uncommitted changes, because each worktree only ever holds its own task's work atop the shared batch-start commit.
2. Track the iteration count for this task (start at 1; increments on each FAIL re-dispatch).
3. Spawn one `verifier` subagent via Agent with `subagent_type: "agentheim:verifier"` using the **Verifier Prompt Template** below — it now carries a `## Worktree` absolute-path field. Launch verifiers for a batch's successes in the same message (parallel tool calls).
4. Wait for each verifier's verdict.

### Handling the verdict

**Task-file annotations are written on `main`'s copy, not the worktree's (agentic-workflow-ghcaj).** Since the worker never moves or edits its own task file anymore — it stays in `doing/` on `main`, untouched, for the whole iteration loop, and the `doing → done` move only happens once, inside the PASS/SKIP integration order below — every `## Verifier note (iteration N)`, `## Salvage note`, and (ADR-0072) `## Merge-conflict note` is appended directly to the task file **on `main`**, uncommitted between iterations (the same posture the "Verification failed" protocol entry below already has: it accumulates on `main` until the next commit that does land there). There is exactly one copy of the task file at any time, so a re-dispatched worker and the next verifier both read it from the same absolute path the very first dispatch used.

**`VERDICT: PASS`**
1. Proceed to the "PASS / SKIP" integration order in "Git authority" below — **on the main tree**: `applyReadmeDelta` → write ADR(s) + `finalizeAdrNumbering` → append `OUTCOME` to the task file → `complete` (the real `doing → done` move, here for the first time) → `materializeTaskFile` per backlog item → INDEX ADR insert + backlinks, then **one** scoped commit (per ADR-0026 + ADR-0032). The protocol entry written there is "Task verified and completed" (replaces the old "Task completed" entry — see Protocol logging below). Tear down the worktree + branch afterward (see "Git authority").

**`VERDICT: SKIP`**
1. Integrate exactly as on PASS — same integration order + before-the-commit bookkeeping + worktree teardown. The protocol entry written in the Git authority step is "Task completed (verification skipped: <reason>)".

**`VERDICT: FAIL`, iteration 1 or 2**
1. Do **not** merge to `main` — nothing on `main` needs to change, because `main` never held this task's unverified work in the first place (the code lives only in the worktree + branch, and the task file has never moved out of `doing/` on `main` at all — there is no `doing → done` claim to roll back post-ghcaj). This is the structural upside of isolation, now clean of the old revert step too.
2. Append the verifier's output to the task file **on `main`** as a new `## Verifier note (iteration N)` section at the bottom, containing the REASONS, SUGGESTED_FIX, and ITERATION_HINT verbatim.
3. Log "Verification failed (iteration N)" to protocol.md — on the **main** tree (this entry is not part of any task's eventual squash-merge; it accumulates on `main` until the next commit that does land there — see "Reconciling stranded carry-over" for how a lone protocol edit is handled if the session ends before then).
4. Decide re-dispatch:
   - If `ITERATION_HINT: task-under-specified` → do not re-dispatch even on iteration 1. Treat as iteration-3 below.
   - Otherwise → **re-dispatch a worker into the SAME worktree** (the `Workspace` field points at the same `.worktrees/<task-id>/`, so its iteration context — files, the earlier `wip` commits still pending collapse — stays live). Use the standard Subagent Prompt Template, but prepend a paragraph telling the worker to read the task file's `## Verifier note` sections (on `main`, at the same absolute path it was already handed) and address them. Set `iteration = N + 1` for the next verification.

**`VERDICT: FAIL`, iteration 3 (or earlier with `ITERATION_HINT: task-under-specified`)**
1. Do not merge to `main`. Do not re-dispatch.
2. **Salvage the worktree's (code-only) diff now, before anything else** (agentic-workflow-hvqa4, ADR-0063 — see "Salvaging a worktree's diff before abandonment" below). Do this even though step 3 keeps the worktree rather than removing it: the whole point is that a kept worktree can still be discarded later (a future session's Phase 1 recovery or session-end reconciliation), and the incident this closes is exactly a verified fix vanishing when that later discard happened with nothing captured first. Tag `escalated-iterN` (N = this iteration, normally 3). **Also salvage the worker's last-reported structured blocks** (`README_DELTA`/`ADRS`/`OUTCOME`/`BACKLOG_ITEMS`, if any were non-empty) verbatim to `bookkeepingSalvagePath(salvageRoot, taskId, tag)` (`lib/worktree-salvage.mjs`) — a worktree escalation abandons the code diff AND the not-yet-materialized bookkeeping the worker had already drafted; both halves are worth keeping. Append a `## Salvage note` to the task file **on `main`** naming both paths.
3. **Keep the worktree and branch** — do not remove them. The task remains in `doing/` on `main` (it was never merged to `done/`, and its file was never in the worktree to begin with); all accumulated verifier notes are visible in the task file **on `main`, at the one absolute path it always lived at**. Surface the worktree's absolute path alongside the task so the user can inspect the live code iteration state directly.
4. Log "Verification failed — escalating to user" to protocol.md.
5. Surface at end-of-batch (see End-of-run reporting): summarize the task, the iteration history, the latest verifier's SUGGESTED_FIX, the kept worktree's path, **and both salvaged paths, named explicitly** (the code patch and, when non-empty, the bookkeeping file) — the escalation message must name them, not just imply the worktree holds the fix. The user decides whether to refine the task (re-route via `modeling` REFINE) or abandon — either way, the worktree is reconciled at session end (see "Reconciling stranded carry-over"), which salvages again (tag `discarded`) immediately before any eventual removal.

### BOUNCE integration (ADR-0037, no longer squash-merges since agentic-workflow-ghcaj)

A worker that returns `RESULT: BOUNCED` never touched its own task file — it only reports `REASON`. The `doing → backlog` move and the `## Worker note` are now entirely **on the main tree**, performed directly by the conductor; there is nothing on the worker's branch worth merging, so **BOUNCE no longer squash-merges at all**:

1. **Salvage the worktree's (code-only) diff first** (agentic-workflow-hvqa4, ADR-0063 — see "Salvaging a worktree's diff before abandonment" below), tag `bounced`, before touching anything else. A bounce is expected to usually be empty-diff (a worker bounces before writing code, per its own "verify workability before any changes" first action) and the empty-diff guard skips writing a file in that case — but an occasional worker starts, discovers under-refinement mid-way, and bounces with real edits already made; this step is what saves those. Since the worker branch is now code-only by construction, this patch — if non-empty — is the entirety of what's abandoned.
2. **On `main`**, apply `applyTaskMove`-shaped bookkeeping directly (mirroring `applyTaskMove`'s own `doing → backlog` shape, `policy: 'skill'` is not itself legal for this transition — do it as the plain file move + `status:` rewrite it already is): move the task file `doing → backlog`, append a `## Worker note` quoting the worker's `REASON` verbatim.
3. Apply the BC `INDEX.md` `doing → backlog` edit and prepend the "Task bounced" `protocol.md` entry (see "Protocol logging").
4. `git add` the enumerated bookkeeping (the moved task file's new `backlog/` path and its vacated `doing/` counterpart, `INDEX.md`, `protocol.md`) and commit: `chore(<bc>): task bounced — <title> [<task-id>]`.
5. Tear down the worktree + branch exactly as on PASS/SKIP (unlink any `dashboard/node_modules` link first, then `git worktree remove --force` + `git branch -D aw/<task-id>`) — the branch is discarded unmerged; only the code-only salvage patch from step 1 remembers what it held.

pcwnn's rung 4 `done → doing` revert (the merge-back conflict ladder) is **vestigial for the same reason** — the task file is never in `done/` inside a worktree to revert from, since it never moves inside a worktree at all anymore. Left as dead prose, not removed, exactly like the moved-from-`doing/` checkpoint detection above; a follow-up may clean up both together.

### Salvaging a worktree's diff before abandonment (ADR-0063)

Every abandonment path — FAIL-iteration-3 escalation above, BOUNCE above, an orphaned worktree's "discard" disposition (see "Reconciling stranded carry-over" below), and rung 1 of the merge-back conflict ladder (see "Merge-back conflicts" above) — removes or eventually removes a worktree that may hold real, working changes the conductor never merged to `main`. **Before any of those four paths' `git worktree remove`, salvage the worktree's diff to a patch file** (ADR-0063; the merge-back-conflict case added by ADR-0072).

**Capture (conductor-only — never the worker, never a `lib/` module per ADR-0038's git-free boundary):**
```
git -C .worktrees/<task-id> merge-base HEAD main
git -C .worktrees/<task-id> diff <fork-point-from-above> > <patch-path>
```
`git diff <fork-point>` (no `--cached`) reports the union of anything already committed on the branch (a conductor `wip` commit) **and** anything still sitting uncommitted in the worktree's working directory — one command covers both, so it is correct whether or not a `wip` checkpoint happened first for this particular abandonment.

**Resolve `<patch-path>`** via `lib/worktree-salvage.mjs` — git-free, `node --test`-covered (ADR-0038): call `ensureSalvageDir(salvageRoot)` first (`salvageRoot` = `<repo-root>/.agentheim/salvage/`, which does not pre-exist until the first capture), then `salvagePatchPath(salvageRoot, taskId, tag)` where `tag` is one of `escalationTag(N)` (→ `escalated-iterN`), the exported `BOUNCE_TAG` (`bounced`), `DISCARD_TAG` (`discarded`), or `MERGE_CONFLICT_TAG` (`merge-conflict`, ADR-0072 — the merge-back conflict ladder's rung 1 capture) — whichever path triggered the capture. Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §4.

**Skip on empty diff.** If the resulting patch is empty (the worktree never diverged from its fork point), don't write the file and don't reference one — there is nothing to salvage.

**Make it visible, not just stored.** Append a `## Salvage note` to the task file naming the patch's absolute path (use `formatSalvageReference(patchPath)` for the wording), and name the same path explicitly in whatever message reaches the user/builder for that abandonment — the FAIL-iteration-3 escalation summary (End-of-run reporting below) and the discard disposition line (Reconciling stranded carry-over below) both do this.

**Storage convention:** `.agentheim/salvage/<task-id>-<tag>.patch`, gitignored — an advisory rescue artifact (ADR-0027 family), not versioned project knowledge. `work` never deletes a salvage patch on its own initiative. One abandonment **event** = one file; a task abandoned twice (e.g. escalated, then later discarded at a subsequent session's reconciliation) gets two distinct, differently-tagged files, never an overwrite of the earlier record. Full rationale and the mechanize-or-drop declaration for this convention: **ADR-0063**.

### Verifier Prompt Template

Spawn each verifier with `Agent(subagent_type: "agentheim:verifier", prompt: <the-below>)`. Fill the placeholders.

```
You are a verifier agent auditing one worker's completed task with fresh context. You have no exposure to the worker's reasoning — only the task spec, the BC README, and the diff in front of you.

## Your inputs
Task file (currently in `doing/`, on `main` — read-only, agentic-workflow-ghcaj): <ABSOLUTE-PATH>
Bounded context: <BC-NAME>
BC README: <ABSOLUTE-PATH-TO-BC-README>
Worktree: <ABSOLUTE-PATH-TO-WORKTREE>   <!-- run the test command below FROM this directory, not the main repo root -->
Iteration: <N> of max 3

## The worker's strict SUCCESS return
<paste the worker's full RESULT: SUCCESS block verbatim>

## Parsed bookkeeping blocks (agentic-workflow-ghcaj)
<Paste the `parseWorkerResult` output's `blocks` verbatim as JSON-ish text: `readmeDelta` (the README_DELTA array — empty `[]` if none), `adrs` (filename + a short excerpt or full body per entry — empty if none), `outcome` (the full OUTCOME text), `backlogItems` (filename + title per entry — empty if none). On a re-verify after the conductor already applied a delta this batch (a PASS/SKIP integration that then needed a second look), also include each op's disposition (`applied` / `merged` / `appended-fallback` / `noop-already`) so a `merged` or `appended-fallback` result is never silently invisible to the verifier.>

## The diff to audit
<paste `git -C <worktree> show HEAD --stat` output, then `git -C <worktree> show HEAD` output — the worktree's one wip-commit, scoped to only this task's changes atop the shared batch-start commit. EXCEPTION — a rung-6 post-conflict re-verify (see below): paste `git -C <worktree> diff main HEAD --stat` / `git -C <worktree> diff main HEAD` instead — two-dot, byte-equal to what the eventual `git merge --squash` will stage; `show HEAD` on a merge commit would show only the resolution hunks, hiding the sibling's already-integrated change this diff also carries.>

## Post-conflict re-verify (ADR-0072 — include this whole section ONLY when this task went through the merge-back conflict ladder's rung 4 resolve-dispatch; omit entirely for an ordinary verification)
This is a re-verify against an updated base, not a first-pass verification: the worker's worktree was merged with the new `main` after a real merge-back conflict, and the worker resolved it.
New base SHA: <NEW-BASE-SHA, from `git -C <worktree> rev-parse main`>
Sibling: <SIBLING-TASK-ID> — <SIBLING-SUMMARY>
Before any PASS, confirm no residual conflict marker (`^<<<<<<< `, `^=======$`, `^>>>>>>> `) survives anywhere in the diff above — see `agents/verifier.md`'s residual-marker check. Any survivor is an automatic FAIL, no matter what else passes.

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

Git is owned by `work`, not by workers or verifiers. Workers only write content — source and tests, **inside their own worktree**; they move no files, not even their own task file (agentic-workflow-ghcaj: that move happens on `main`, at PASS/SKIP integration step (d)). Verifiers only read, also inside that worktree. This is load-bearing for parallel safety: `main` is written **only** by the conductor, **only** sequentially — worktree isolation (ADR-0032) strengthens this, it does not relax it, because every worker's writes land on a private branch that cannot race anything.

**The doctrine here is ADR-0026 + ADR-0032: all bookkeeping is written and `git add`ed BEFORE the integrating commit, so a completed task's code + task-move + INDEX + protocol all land in ONE commit on `main`, and `git merge --squash` — not a prose scan — is the conflict detector.** Commit doctrine (scoped add, message convention, the dropped `commit:` field) lives in `references/commit-doctrine.md`.

### Anchor every git command to its tree — the CWD-drift trap

Worktree isolation means the conductor is juggling **two working trees at once**: `main` (the repo root) and each live `.worktrees/<task-id>/` on branch `aw/<task-id>`. The shell's working directory **persists between commands**, so a `cd .worktrees/<task-id> && …` you ran for discovery or a `wip` checkpoint silently leaves every *later* bare `git` command executing **inside that worktree on the private branch**, not on `main`. That defeats the whole invariant above — `main` writes are supposed to be the conductor's alone, sequentially. A misdirected `git merge --squash` degrades to a confusing self-merge no-op ("Already up to date"); a misdirected `git reset --hard` / `git commit` would corrupt the wrong tree with no warning.

**Rule — never rely on the inherited CWD for a git write.** For every git command that targets a specific tree, make the target explicit, one of:

- `git -C <absolute-path>` — the preferred form for worktree writes (e.g. the `wip` checkpoint: `git -C .worktrees/<task-id> commit …`); it names the tree per-invocation and cannot drift.
- Prefix a fresh `cd <main-repo-root>` at the start of the command whenever you need to operate on `main` (the squash-merge, the integrating commit, worktree teardown, all bookkeeping) — do **not** assume you're already there.

When a git result looks off (an unexpected "Already up to date", a clean tree you expected to be dirty, a branch name you didn't expect), your first check is `git rev-parse --abbrev-ref HEAD` — confirm which tree/branch you're actually on before running anything destructive.

### PASS / SKIP — squash-merge to `main`, then materialize bookkeeping, one commit (agentic-workflow-ghcaj)

After a verifier returns `VERDICT: PASS` (or `VERDICT: SKIP`, or when verification was bypassed per the skip rules above), on the **main** tree, in this order — the worker's parsed `RESULT` (`lib/worker-result.mjs`'s `parseWorkerResult`) supplies `blocks.readmeDelta` / `blocks.adrs` / `blocks.outcome` / `blocks.backlogItems` for steps (a)–(e):

1. `git merge --squash aw/<task-id>` — stages the branch's net delta (**source and tests only** — no `.agentheim/` path can appear here post-ghcaj, since the worker never wrote one), collapsed from however many `wip` commits the branch accumulated across iterations. **This is where a real conflict against an already-merged sibling's CODE surfaces** — see "Merge-back conflicts" below; a README/ADR collision can no longer happen here at all (see the next steps).
2. **(a) Apply the README delta(s).** For each entry in `blocks.readmeDelta`, read the named `document` (default `README.md`, the BC's; or `context-map.md`) and call `applyReadmeDelta(content, {section, ops})` (`lib/readme-delta.mjs`), then write the returned content back once (ADR-0054 compute-then-write). For any op whose disposition comes back `merged` or `appended-fallback`, compose a **`**README delta:**`** line for this task's completion protocol entry (see "Protocol logging" below) quoting the anchor and the *observed* current bullet text — never attributing the mismatch to "a sibling", which is only one of three possible causes (an earlier-integrated sibling, the conductor's own earlier write this batch, or a concurrent `modeling` session). `noop-already` and `applied` dispositions need no protocol mention.
3. **(b) Write each ADR, then finalize numbering.** For each entry in `blocks.adrs`, write its body verbatim to `decisions/<provisional-filename>` (the marker-named filename from the `ADRS` block). Then run `finalizeAdrNumbering(decisionsDir, [<those filenames>])` (`lib/adr-allocation.mjs`, ADR-0058, **unchanged** by this task — it has no opinion about who wrote the provisional file or when) to recompute the true next-free number(s) against `main`'s real state and renumber on collision or gap. If it reports a `renumbered` entry, use the NEW number for every later step (index insertion, backlinks, the task's own Notes reference to the ADR).
4. **(c) Append the Outcome.** Append `blocks.outcome` (the full `## Outcome` section, heading included) to the task file — still sitting in `doing/` on `main` at this point.
5. **(d) Complete — the real `doing → done` move, here for the first time.** Run the COMPLETE script (ADR-0038, agentic-workflow-t7m4c):
   ```
   node -e "<the same bootstrap as the claim verb in Phase 4 step 1>" complete <task-id> '{"summary":"<worker SUMMARY>","duration":"<dispatch→verdict wall time, e.g. 4m12s>","verification":"PASS (iteration N)","filesChanged":<FILES_CHANGED>,"testsAdded":<TESTS_ADDED>,"adrsWritten":"<ADRS_WRITTEN, comma-joined, or \"none\">"}'
   ```
   (For a `VERDICT: SKIP` completion, swap the trailing JSON for `{"summary":"...","duration":"...","skipped":true,"skipReason":"<decision-only task | --no-verify | non-git project>","filesChanged":<FILES_CHANGED>}` — this selects the "Task completed (verification skipped)" entry shape instead, which carries no `Tests added:` / `ADRs written:` lines.) Unlike before ghcaj, this is **not** a no-op-detecting idempotent path in the ordinary case — the task file has been sitting in `doing/` on `main`, untouched, this whole time (steps (a)–(c) above edited it in place there), so `applyTaskMove`'s `doing → done` attempt performs a REAL move here. (The idempotent branch still exists for the rare case of a resumed/interrupted session finding the file already in `done/` — harmless, unchanged.) It prints one manifest `{changed, message, verb:'complete', id, idempotent}`.
6. **(e) Materialize any new backlog items.** For each entry in `blocks.backlogItems`, call `materializeTaskFile(rootDir, body)` (`lib/task-lifecycle.mjs`) — it refuses a duplicate id rather than overwriting. Insert each new task's INDEX line under `<!-- backlog-list:start -->` in its BC's `INDEX.md` (counts +1 per item) — see "Index updates" below.
7. **(f) ADR index insert + backlinks** — as today (see "Index updates" below): still apply the ADR↔task backlink maintenance and the `adr-local`/`adr-global` insert yourself; these are not part of any manifest above.
8. `git add` an **explicit, enumerated** list: every path (a)–(f) wrote (the README(s), each ADR file — both old and new path on a rename, the task file, each new backlog file, both BC `INDEX.md`s if a backlog item landed in a different BC than the task itself, `protocol.md`) plus the `complete` manifest's `changed` paths. Never `git add -A` / `git add .` — see `references/commit-doctrine.md` for why the scoped-add rule is load-bearing here.
9. Commit with the `complete` manifest's `message` verbatim — already the doctrine-compliant `<type>(<bc>): <summary> [<task-id>]` (`<type>` read from the task's own frontmatter, `<summary>` from the JSON opts above, falling back to the task title when omitted). Do not hand-compose this string. Example: `feature(books): add ReadingSession concept to Book aggregate [books-001]`. **One commit, ADR-0026 shape** — code (step 1) + every one of (a)–(f) land together, exactly like the integration-commit-shape fixture (`lib/test/integration-commit-shape.test.mjs`).
10. **Tear down the worktree**, in order:
   - If the task touched `dashboard/`, `unlinkDashboardNodeModules(worktreeRoot)` (`lib/worktree-node-modules.mjs`) **first** — never skip this. (De-risking spike finding, ADR-0037: `git worktree remove --force` recurses THROUGH an un-removed junction and silently deletes the real shared `node_modules`'s contents — no error, just data loss. Unlinking first is mandatory, not housekeeping.)
   - `git worktree remove .worktrees/<task-id> --force`
   - `git branch -D aw/<task-id>`

The commit SHA is **not** written back anywhere — see `references/commit-doctrine.md` for the `[<task-id>]` trailer / dropped `commit:` field convention. Do **not** add a `commit: <sha>` field and do **not** amend the task file after committing.

### Merge-back conflicts — the seven-rung ladder (ADR-0072, agentic-workflow-pcwnn)

Two same-BC workers both editing the BC README (the common case the Phase 3 advisory flags) now collide at **merge-back** instead of being predicted from prose. On a clean or auto-mergeable squash-merge, proceed as above. On a **real** conflict (git leaves conflict markers, non-zero exit from step 1), work the ladder below, in order — every git operation is conductor prose (ADR-0038); the worker never runs git (ADR-0032). **The ladder fires at most once per worktree lifetime** — see "Budget" at the end of this section.

**A refinement spike established the load-bearing fact behind this ladder: there is no separate "rebase" rung.** A squash-merge conflict on `main` and a real `git merge main` inside the loser's worktree are the *same* 3-way merge (same merge-base, same two tips), so they conflict on exactly the same paths — a rebase would replay each ephemeral `wip` commit separately, detach HEAD, and rewrite the branch the salvage patch is cut from, for zero conflict-avoidance gain over a real merge. ADR-0032's named "automatic rebase" future enhancement is retired by ADR-0072 in favor of the ladder below.

**Rung 1 — reset and salvage.** `git reset --hard HEAD` on `main` — **not** `git merge --abort`, which errors (`fatal: There is no merge to abort`) on a squash merge (ADR-0037 §1, narrowed by ADR-0072 to this squash-on-`main` case specifically). Before touching the losing branch at all, salvage its diff (see "Salvaging a worktree's diff before abandonment" above) using the new `MERGE_CONFLICT_TAG` export on `lib/worktree-salvage.mjs` — this is capture-before-risk (ADR-0063), done first so a botched later rung never costs the already-verified work a second time.

**Rung 2 — clean the worktree of derived churn.** For every tracked path the checkpoint guard refuses (today: `dashboard/dist/**`, ADR-0057) that is dirty in the worktree, `git -C .worktrees/<id> checkout -- <path>`. **Never `git stash`** (a 2026-07-13 near-miss) — a dirty tracked file that `main` also changed makes `git merge` refuse to start, and stashing risks losing track of what was set aside.

**Rung 3 — merge `main` into the branch, a real merge.** `git -C .worktrees/<id> merge main`. **`MERGE_HEAD` is set on this tree** (the opposite of the squash on `main`), so `git -C .worktrees/<id> merge --abort` is the correct undo **here** — record both abort commands side by side, since one errors and the other succeeds depending on which tree you're standing in:

| Tree | Abort command | Outcome |
|---|---|---|
| `main` (the failed squash) | `git reset --hard HEAD` | restores cleanly; `git merge --abort` here **errors** |
| `.worktrees/<id>` (the real merge) | `git -C .worktrees/<id> merge --abort` | restores cleanly; `git reset --hard HEAD` here would discard the branch's own prior `wip` commits |

- **Unexpectedly clean** (should not happen — symmetric with the squash that just failed): the merge auto-commits; skip to rung 5.
- **Conflicted:** `git -C .worktrees/<id> diff --name-only --diff-filter=U` is the **resolution allow-list**. Any `U` path under `.agentheim/knowledge/decisions/` with `AA` status (two identical provisional ADR filenames) → escalate (rung 7), never dispatch — ADR-0058's numbers with differing slugs never actually collide, so this is fail-closed guard prose, not an expected case. Parse the porcelain/diff output with `lib/merge-conflict-ladder.mjs`'s `conflictStateFromPorcelain` (or `conflictStateFromNameOnly` when only the name-only form is in hand) to get `{allowList, adrGuardHits, resolved}`.

**Rung 4 — resolve-conflict dispatch, same worker, same worktree.** Before dispatch: append a `## Merge-conflict note (iteration N)` section to the task file **on `main`**, at the same absolute path the worker was always handed — the `done → doing` revert this step used to require is **vestigial since agentic-workflow-ghcaj** (the task file never moves inside a worktree at all anymore, so there is no `done/` state to revert from) — see "Resolve-conflict dispatch" under the Subagent Prompt Template below for the exact note shape and the prompt block to hand the worker (built by `lib/merge-conflict-ladder.mjs`'s `buildResolveDispatchPrompt`).

**Rung 5 — checkpoint the resolution, fail-closed.** Route the resolved files through the `checkpoint` verb exactly as the ordinary SUCCESS path does. Then assert, before committing: `git -C .worktrees/<id> diff --name-only --diff-filter=U` is **empty** (`isResolved`/`conflictStateFromPorcelain(...).resolved`) **and** no allow-list path still contains a `^<<<<<<< ` marker. Either non-empty/non-clean → rung 7. Otherwise commit with the manifest message suffixed `(merge main)` — this commit *is* the merge commit and is collapsed by the eventual squash like every other `wip` commit.

**Rung 6 — re-verify against the new base, mandatory.** Spawn the verifier in the worktree with the diff captured as `git -C .worktrees/<id> diff main HEAD --stat` / `git -C .worktrees/<id> diff main HEAD` — **two-dot**, byte-equal to what the squash will stage (never `show HEAD`, which on a merge commit shows only the resolution hunks). See "Verifier Prompt Template" below for the four post-conflict inputs this adds. PASS → `git merge --squash aw/<id>` on `main` is clean by construction (the branch now contains `main`); proceed exactly as the normal PASS path, including the ADR-0057 rebuild of `dashboard/dist/` from merged source and ADR-0058's `finalizeAdrNumbering`. FAIL → the ordinary gate: re-dispatch with the verifier note, the FAIL counter **continuing from where it already was** (see "Budget" below), cap 3 unchanged.

**Rung 7 — escalate to the builder, the last rung, not the first.** Triggers: the resolve dispatch returns `FAILED`/`BOUNCED`; unmerged paths or markers survive rung 5; the FAIL cap is reached after a resolve; the `AA`-ADR guard fires; or a **second** merge-back conflict hits the same worktree (the one-shot budget is spent). Action: `git -C .worktrees/<id> merge --abort` (branch back to its pre-merge state, `git status --porcelain` empty), worktree + branch **kept**, the rung-1 patch already on disk, both task ids + conflicted files + worktree path + patch path surfaced — today's iteration-3 escalation ergonomics, reused rather than reinvented.

**Budget — one shot per worktree lifetime.** Mechanized in `lib/merge-conflict-ladder.mjs`: `createLadderState()` / `onMergeBackConflict(state)` / `decideAfterVerifierVerdict(iteration, verdict)` / `onWorktreeTeardown()`. A resolve dispatch (rung 4) is **structurally separate** from the ordinary FAIL-iteration counter — `onMergeBackConflict` never sees or touches it, so a post-resolve FAIL (rung 6) continues the FAIL count from wherever it already was, with the same cap-3 rule as any other FAIL. Mixing the two counters would escalate the *healthiest* tasks (a PASS on iteration 3 that then hits a merge conflict). The one-shot flag resets only on worktree teardown (`onWorktreeTeardown`) — never silently across sessions on the same worktree.

**Excluded by construction.** `INDEX.md` and `protocol.md` never enter this conflict surface — they are conductor-direct writes on `main` the worker branch never touches (ADR-0032/ADR-0038) — so the allow-list can never contain them and the resolve dispatch is never over-scoped to bookkeeping.

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

A task line's prose is the task's own `title:` frontmatter, embedded verbatim by the mechanized lifecycle scripts (`lib/task-lifecycle.mjs`'s `insertIndexLineAtTop`) — nothing to compose here. Its length cap (ADR-0060) is therefore enforced where the title is authored/refined, in `modeling`'s "Updating indexes" section, not here.

Per state transition in `contexts/<bc>/INDEX.md`:

| Transition | Marker edits | Counts |
|---|---|---|
| **todo → doing** (Phase 4 step 1 — the **batch-start claim commit**, a commit of its own, separate from any task's eventual squash-merge commit) | **Mechanized** (ADR-0038, agentic-workflow-t7m4c) — `lib/task-lifecycle-cli.mjs claim <ids>` performs the marker edit + count delta for every id in the batch (grouped per BC) as part of its manifest; nothing to hand-edit here. | Todo −1, Doing +1 |
| **doing → done** (pre-squash-merge-commit bookkeeping, on `main`, PASS/SKIP) | **Mechanized** — `lib/task-lifecycle-cli.mjs complete <id>` performs the real `doing → done` move (marker edit + count delta) as part of its manifest, here for the first time (the worker branch never touched `.agentheim/`, per step (d) above); nothing to hand-edit here. | Doing −1, Done +1 |
| **doing → backlog** (BOUNCED — pre-squash-merge-commit bookkeeping, on `main`; see "BOUNCE integration") | remove from `<!-- doing-list:start -->` → insert into `<!-- backlog-list:start -->` (still hand-edited — BOUNCE is not mechanized by this task) | Doing −1, Backlog +1 |
| **doing → doing** (FAIL iteration N, re-dispatched into the same worktree) | no list move; line stays in doing-list | no count change |
| **doing → doing-final** (FAIL iteration 3, escalated; worktree kept) | no list move | no count change |

Per ADR written (from `ADRS_WRITTEN` in worker SUCCESS):

- **Finalize the ADR's number first (ADR-0058)**, before anything else in this list — a rename here changes the filename and frontmatter `id:` that every later step (index insertion, backlinks) refers to. On the main tree, after PASS/SKIP integration step (b) has written each `ADRS` body to `decisions/<provisional-filename>` (agentic-workflow-ghcaj — the worker's `git merge --squash` stages no ADR file anymore; the conductor writes it from the report block) but before any `git add`: run `lib/adr-allocation.mjs`'s `finalizeAdrNumbering(decisionsDir, [<the ADRS_WRITTEN filenames>])` — runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §1. It recomputes the true next-free number(s) against `main`'s real `.agentheim/knowledge/decisions/` and renumbers on collision or gap (filename + frontmatter `id:` + H1 heading, plus an in-file "Note on ADR numbering"), so two parallel workers can never land on the same final ADR number. If it reports a `renumbered` entry, use the NEW number for every step below, and also patch any reference to the OLD provisional number in the task's own Notes/Outcome section (you have both artifacts in hand at this commit boundary) — the finalize step does not sweep prose outside the ADR file itself. Git-free (never shells out to `git`); its `changed` paths (both the removed old path and the added new path, when a rename fired) fold into this commit's scoped `git add` alongside everything below.
- Read the ADR's frontmatter `scope:` field.
- `scope: <bc-name>` → insert under `<!-- adr-local:start -->` in `contexts/<bc-name>/INDEX.md`.
- `scope: global` → insert under `<!-- adr-global:start -->` in `.agentheim/knowledge/index.md`.
- **Bidirectional backlink:** append the ADR id to the task's `related_adrs` frontmatter, and append the task id to the ADR's `related_tasks` frontmatter. The worker drafts the ADR body in its `ADRS` block but never writes the file or maintains these cross-links — the conductor materializes the file and maintains the backlinks, atomically, alongside the index update.
- **Entry-length cap (ADR-0060):** the one-line ADR summary you compose for the `adr-local`/`adr-global` insert is capped at **~2-3 sentences, ~60 words** — the ADR's headline decision and its pointer, not a restatement of its Context/Consequences. Detail lives in the ADR file itself, which the pointer already reaches. Applies to newly inserted entries only; an existing over-length entry already sitting in an `INDEX.md` is left verbatim — no retroactive rewrite (mirrors ADR-0039's verbatim cap-and-roll discipline). A live-tree lint (`lib/index-entry-length.mjs`, `node --test`) flags a new entry — one dated after the doctrine's adoption — that exceeds the cap; it does not (and cannot, since this prose is hand-composed) rewrite the line for you.

If `.agentheim/knowledge/index.md` or the BC's `INDEX.md` does not exist yet, create it from `references/index-template.md` before inserting. Do not auto-rewrite the file — only insert/remove at markers.

If the worker's `BACKLOG_ITEMS` block is non-empty (agentic-workflow-ghcaj — replaces the old id-only `NEW_BACKLOG_ITEMS` field), materialize each entry first (`materializeTaskFile(rootDir, body)`, PASS/SKIP integration step (e) above), then insert each new task's line under `<!-- backlog-list:start -->` in its BC's `INDEX.md` (counts +1 per item) exactly as any other backlog insertion — `materializeTaskFile` only writes the task file itself, never the INDEX line.

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

**Scoped run — record it explicitly (ADR-0071).** When the batch was scoped by a named id list ("Argument grammar" above), compose that into the same `parallel` JSON opt instead of the cap-triggered wording above: `"parallel":"scoped — builder named agentic-workflow-xyz; 3 other ready tasks not dispatched"` (single id), or, for a named set larger than `MAX_PARALLEL`, name which of the set are in this wave vs. still queued: `"parallel":"scoped — builder named 5 ids; dispatching agentic-workflow-a, agentic-workflow-b, agentic-workflow-c this wave (cap 3); 2 more from the named set queued"`. This keeps the "never truncate silently" invariant honest for the scoped case too: unlike an ordinary cap, a scoped run's undispatched ready tasks were never candidates in the first place — the builder narrowed the field — and the wording should make that explicit rather than reading as an accidental cap.

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
**README delta:** [OMITTED when every README_DELTA op this task applied disposed `applied` or `noop-already`. Present, one line per `merged`/`appended-fallback` op, when integration step (a) hit either: "<document> §<section> anchor \"<anchor>\": merged — observed current text: \"<the actual bullet text read at merge time, verbatim, never attributed to \"a sibling\">\"" or "<document>: appended-fallback into ## Ubiquitous language (named section \"<section>\" not found)".]
**README length:** [OMITTED unless the README this task's delta touched now exceeds the ADR-0041 ~600-line consolidation trigger. Present as one advisory line: "<bc> README now N lines (ADR-0041 trigger: ~600) — consider `modeling` CONSOLIDATE". Advisory only — never gates, never blocks the commit; a visible valve now that a delta-only worker can no longer notice the README's own length the way a hand-editing worker used to.]

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

Spawn each worker with `Agent(subagent_type: "agentheim:worker", prompt: <the-below>)`. Fill the placeholders — the `Workspace`, BC README, and BC index paths you fill in point **inside the task's worktree** (ADR-0032); the task-file path is **`main`'s one copy**, read-only to the worker (agentic-workflow-ghcaj), never the worktree's. Post-ghcaj the worker runs no git and writes nothing under `.agentheim/`: it no longer owns any task-file move — its worktree holds only source and tests, and all bookkeeping (task-file moves, README, ADRs, index, protocol) is materialized by the conductor on `main` at integration. The `## Rules — CRITICAL` list below reflects that.

```
You are a worker agent executing one refined task. Stay strictly within its scope.

## Your task
Workspace (this task's private git worktree — run all commands, including tests, from inside it): <ABSOLUTE-PATH-TO-WORKTREE>
Task file (currently in doing/, on `main` — read-only to you; you never write or move it, agentic-workflow-ghcaj): <ABSOLUTE-PATH>
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
4. Do NOT touch any task file — not another task's, and not even your own. The task file path above is on `main` and is **read-only** to you: re-read it if you need to, but never edit it and never move it. Report your `## Outcome` text in the `OUTCOME` block and any follow-ups as full bodies in the `BACKLOG_ITEMS` block instead (`references/worker-return-format.md`) — the conductor writes and moves the real files.
5. Do NOT modify other BCs' READMEs. Only the BC your task belongs to — and even for your own BC, never edit `README.md` directly.
6. DO write code, run tests. For your BC's ubiquitous language / aggregates / events / commands / invariants and any ADR-worthy decision, **REPORT, never write**: compose a `README_DELTA` entry and/or full `ADRS` block entries (`references/worker-return-format.md`) instead of editing `.agentheim/contexts/<bc>/README.md` or writing a file under `.agentheim/knowledge/decisions/` yourself. `nextAdrNumber(decisionsDir)` is still yours to call, but it is **read-only, provisional minting** — it only picks the number you put in the `ADRS` block's `id:`/heading/provisional filename; it writes nothing, and the conductor's `finalizeAdrNumbering` is the authority at squash-merge.
7. Do NOT move your task file from doing/ to done/ — you never do this anymore. Report the `## Outcome` section text in your `OUTCOME` block; the conductor appends it and performs the real move on `main` after your code squash-merges.
8. If the task is under-refined (no concrete acceptance criteria, unclear scope, unmet dependencies, insufficient BC language), do **not** move anything — just return `RESULT: BOUNCED` with a `REASON`. The conductor moves the task file `doing → backlog` and appends the `## Worker note` on `main`. This is correct behavior, not a failure.
9. Running the test suite rebuilds `dashboard/dist/` in your worktree — that is expected and fine (`dashboard/test/dist-build.test.mjs` does this on every run; you cannot avoid it by being careful). It will be dropped at checkpoint and never merged (agentic-workflow-q7v3k, ADR-0057). Do not run `node build.mjs` yourself, do not hand-edit `dashboard/dist/`, and do not list `dashboard/dist/` in your FILE_LIST.
10. Do NOT write anything under `.agentheim/` anywhere in your worktree, for any reason (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6) — not the README, not an ADR file, not your task file, not a backlog item. A worktree that still does is rendered inert, not failed: the checkpoint guard refuses every `.agentheim/` path with reason `bookkeeping-path`, the same posture ADR-0057 already gives a rebuilt `dashboard/dist/`.

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

### Resolve-conflict dispatch (merge-back conflict ladder rung 4, ADR-0072)

A variant of the Subagent Prompt Template above, used **only** for rung 4 of the merge-back conflict ladder — same worker task, same worktree, invoked after a real `git -C .worktrees/<id> merge main` conflict (see "Merge-back conflicts"). Two things differ from the standard dispatch:

1. **Vestigial since agentic-workflow-ghcaj: no `done → doing` revert is needed** — the task file never moves inside a worktree at all anymore (its one real `doing → done` move happens on `main`, at PASS/SKIP integration step (d), after the worker's code has already squash-merged), so there is no `done/` state to revert from here. Append a `## Merge-conflict note (iteration N)` section to the task file **on `main`**, at the same absolute path the worker was always handed — its own shape, **never** the `## Verifier note` shape: the sibling task id + summary, the new base SHA (`git -C .worktrees/<id> rev-parse main`), the resolution allow-list, and the sibling's `git log -1 --stat main` **scoped to the allow-list paths**.
2. **The `## Your task` block gains one extra section**, inserted immediately after it: the rendered output of `lib/merge-conflict-ladder.mjs`'s `buildResolveDispatchPrompt({taskId, siblingId, siblingSummary, newBaseSha, allowList, siblingStatScopedToAllowList})` — pasted verbatim. It carries the **orientation** (`HEAD` = the worker's own work, `main` = the already-integrated sibling), the **authority** statement (the worker may not undo or weaken the sibling's change — both intents must survive), and the **scope** (the allow-list paths verbatim, plus any test that must change to keep both intents green). Everything else — `## Pre-loaded ADRs`, `## Rules — CRITICAL`, the strict `RESULT:` return format — is the standard template, unchanged; the worker still never runs git.

## End-of-run reporting

When `todo/` is empty and all `doing/` is resolved (or the user interrupts) — or, for a **scoped run** (see "Argument grammar" above), when every named id has reached a terminal state (integrated, bounced, failed, or escalated after iteration 3):

1. Summarize in plain prose: tasks completed (with verification stats — how many passed first try vs. needed re-dispatch), tasks bounced (and why), tasks failed (and why), tasks escalated after 3 verification failures (these need user attention), ADRs written, new backlog items created, total commits made.
2. For each task escalated to the user: name it, summarize the iteration history, show the latest verifier's SUGGESTED_FIX, and **name the salvaged patch's absolute path** (ADR-0063 — see "Salvaging a worktree's diff before abandonment"; omit only if that capture found an empty diff and there is genuinely nothing to salvage). The user decides whether to REFINE via `modeling` or abandon.
3. **Concept candidates.** Aggregate every non-"none" `CONCEPT_CANDIDATE` from worker SUCCESS blocks across the run. If any concept name shows up in 2+ workers' returns, escalate the convergence signal more loudly. For each unique candidate: print the concept name, the BC, and the converging artifact ids. The user decides whether to create the page (per `references/concept-template.md`); never auto-create.
4. Surface anything that surprised you mid-run: cycles detected, dependency gaps, recovered sessions, repeated verification failures pointing at a common cause.
5. **Vision-conformance pass** (see the dedicated section below). One bounded read per session over the batch just completed — not per task, not a whole-vision essay. Do this before the carry-over reconciliation and the final protocol entry; its output feeds the **Vision-conformance:** line of that entry and, when a flag is worth the builder's attention, the whats-next advisory (below).
6. **Batch-mix classification** (ADR-0064, agentic-workflow-qz1h7; path-aware bug/refactor amendment agentic-workflow-r4gcz). For every task this session completed, you already hold its `type` (from its task file frontmatter) and its `FILE_LIST` (from the worker's SUCCESS return, already used for the checkpoint stage). Feed `[{type, files}, ...]` for the whole batch to `lib/vacuum-guard.mjs`'s `formatBatchMixLine` — runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §3 (batch-mix classification) — it classifies each task **product-facing** / **harness** / **bookkeeping** by the heuristic documented in that module (`classifyTask`'s doc comment: `type: feature`/`decision` → product-facing; `type: chore` whose touched files are *entirely* protocol/INDEX/state bookkeeping surfaces → bookkeeping, else harness; `type: bug`/`refactor` whose touched files are *entirely* product surfaces (none under `lib/`, `skills/`, `agents/`, `references/`, `evals/`, or `.agentheim/knowledge/decisions/`) → product-facing, else harness — a consumer project's own bug fix/refactor no longer reads as harness merely by type; everything else, e.g. `spike` → harness unconditionally) and renders the one-line mix (e.g. `62% product-facing / 25% harness / 13% bookkeeping (8 tasks)`) for the session-end protocol entry's **Batch mix:** line below. This is purely descriptive — it never blocks, never influences dispatch, and exists only so drift toward meta-work is visible per session instead of discovered a week later (Dorc review recommendation A2).
7. **Reconcile stranded carry-over — working tree AND worktrees** (see the dedicated section below). Do this *after* the last per-task integration and *before* prepending the session-end protocol entry — its dispositions feed the `**Carry-over:**` line of that entry.
8. Prepend a final protocol entry:
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
   **Batch mix:** [step 6's `formatBatchMixLine` output, e.g. `62% product-facing / 25% harness / 13% bookkeeping (8 tasks)`, or `none — no tasks completed this session` for an empty batch. Descriptive only — never a gate (ADR-0064).]
   **Carry-over:** [reconciliation disposition, from the step-7 section — one entry per stranded `.agentheim/`-owned file: `<path>: committed (<label>)` or `<path>: left behind (owner: <flow>, <reason>)`; plus one batched entry when non-`.agentheim/` files were stranded: `left behind (user WIP, N files)`; or `none — working tree clean` when nothing was stranded at all. NEVER the old "untouched, as in prior sessions" boilerplate — every stranded file names an explicit disposition (individually or via the batched WIP line) or the tree was clean.]

   ---
   ```
   This is the one `work` protocol line written *after* a commit (it summarizes the session). To honor the "clean working tree" rule (`references/commit-doctrine.md`, ADR-0026), **commit it** with a scoped add of only `protocol.md`: `git add .agentheim/knowledge/protocol.md` then `chore(<bc>): work session end bookkeeping [<last-task-id>]` (reuse the last completed task's id as the trailer, or `chore: work session end bookkeeping` if the session committed nothing). This is the *only* bookkeeping-after-commit `work` performs, and it is a single line — every per-task INDEX/protocol edit already rode in its own task commit (the old trailing "record SHAs + INDEX/protocol" commit is gone). (Any *deliberately-committed* stranded file from step 7 rode in its own scoped reconciliation commit *before* this entry — see below.)
9. **Protocol rotation check (session-end)** (see the dedicated section below). Run this immediately after step 8's session-end protocol entry has been committed — the file has just grown, making this the natural, self-firing checkpoint that closes ADR-0039's deferred "who invokes it" non-decision (ADR-0045, ADR-0041's cap-and-roll doctrine).
10. **INDEX done-list rotation check (session-end)** (see the dedicated section below). Run this immediately after step 9's protocol rotation check. Every task this session completed grew some BC's `INDEX.md` done-list via `completeTask`, so this is the same self-firing seam step 9 uses, applied to the sibling cap-and-roll surface ADR-0045's "Scope boundary" section deferred (ADR-0047 closes it).

## Vision-conformance check (session-end)

Run this once per session, at end-of-run step 5, after the last per-task commit and before the carry-over reconciliation and the final protocol entry. It closes the Why→What loop the 2026-07-02 harness audit called for: today nothing evaluates whether just-shipped work still serves the vision, so the vision can rot silently while work proceeds and only a human notices. This pass is a **cheap, bounded read** — not a per-task deep dive, not a whole-vision essay — and it **never blocks**: it is a session-end advisory, the ADR-0027 advisory-write family (see ADR-0040), exactly as read-only over lifecycle as `whats-next`'s own advisory write (ADR-0017).

1. **Read the bounded inputs.** `.agentheim/vision.md`'s two named sections only — "What success looks like" and "Non-goals" — via `lib/vision-conformance.mjs`'s `extractVisionSections` (deterministic, unit-tested: `lib/test/vision-conformance.test.mjs`). Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §5. Plus the session batch's already-summarized completed-task entries — the same material already in hand for step 1's plain-prose summary; no extra reads, no re-opening each task's diff.
2. **Ask one question per shipped task.** For each task this session completed: does it pull toward a stated non-goal, or away from a stated success criterion? This is genuine judgment, not a keyword match — reason about what the task actually changed, not just its title. A conforming batch should produce **zero** flags; don't manufacture drift to look thorough (see `evals/vision-conformance-check/` for a planted-drift fixture and a clean-batch fixture demonstrating both ends of this judgment).
3. **When you flag one, name the specific criterion or non-goal.** Use `lib/vision-conformance.mjs`'s `labelFor` convention — the item's leading **bold** phrase if it has one (vision.md's non-goals are typically written `**Not X.** ...`), else a short excerpt — so the flag is traceable to the exact vision line, not a vague "seems off".
4. **Format the flags.** `lib/vision-conformance.mjs`'s `formatConformanceLine(flags)` renders the list (or `none — batch aligns with vision` when empty) for the protocol entry's `**Vision-conformance:**` line (the template above).
5. **Surface worth-attention drift through the whats-next advisory too.** When `worthSurfacing(flags)` is true (any non-empty flag set), also (over)write `.agentheim/state/whats-next.md` — the same frozen shape `whats-next` itself writes (frontmatter `generated` ISO-8601 timestamp + the three sections *Where things stand* / *Recommended move* / *Next*), with **Recommended move** naming the flagged task(s) and the diverged-from criterion/non-goal, and **Next** suggesting the builder review the flagged task (a pause, not a "run work" nudge). This is not a second owner colliding with `whats-next`'s own write: the file is single-latest by design (ADR-0027) — whichever pass wrote it last is the current recommendation, and the next real `whats-next` invocation (or the next session's `work` Phase 3 / `modeling` "Before acting" read, both of which already consult this file) naturally supersedes it. Skip this sub-step entirely when there are no flags — a clean batch writes nothing here, so it never clobbers a genuinely useful existing recommendation with a bland "all clear".
6. **Never a gate.** No matter what this pass finds, it does not stop a commit, does not fail a task, does not stop the session. The human reads the protocol line (and, when present, the whats-next surface) and decides — the "Not autonomous" non-goal holds here exactly as everywhere else.

## Reconciling stranded carry-over (session-end): working tree AND worktrees

The scoped-`git add` rule (ADR-0026 §5) is load-bearing for concurrency, but it has a cost: anything no skill explicitly enumerated stays uncommitted **forever**. Left unmanaged this silently accumulates dirty state — the confirmed leak where the *same* files were recorded as "carry-over (untouched, as in prior sessions)" session after session, each run dutifully stepping around them. This step closes that leak by forcing an explicit, user-surfaced disposition for every stranded file — without ever loosening the scoped-add rule. Per-worker git worktrees (ADR-0032) get the same treatment — see "Worktree carry-over" below, which extends this same reconciliation rather than being a separate mechanism.

### Working-tree file carry-over

Run this once per session, at end-of-run step 7 (after the last per-task commit, the vision-conformance pass, and the batch-mix classification, before the session-end protocol entry):

1. **Detect.** Run `git status --porcelain`. Each line is a stranded working-tree entry: tracked-modified/staged (` M`, `M `, `MM`, `A `, `D `, `R `, …) **or** untracked (`??`). By this point every task this session completed has already ridden into its own commit, so a clean tree yields no lines. If the output is **empty**, there is nothing to reconcile — record `Carry-over: none — working tree clean` and skip to the protocol entry.
2. **Partition by ownership before surfacing (consumer-tuning, agentic-workflow-pzacx).** Split the stranded entries into paths under `.agentheim/` (this project's own governed bookkeeping — task files, indexes, protocol, ADRs, vision, context-map) and everything else (the builder's own source, docs, or working files). A consumer repo's working tree routinely carries the builder's own WIP outside `.agentheim/`; asking per file there is friction with a foregone answer, not genuine judgment.
   - **`.agentheim/`-owned paths** get the full per-file treatment below (step 3) — unchanged from before this amendment.
   - **Everything else** gets **one batched line**, no per-file ask: `left behind (user WIP, N files)`, where N is the count of stranded non-`.agentheim/` paths. Never offer a commit disposition for these — they are the builder's own working files, not this project's bookkeeping to commit on their behalf.
3. **Surface `.agentheim/`-owned entries, per file — never auto-sweep.** For **each** stranded `.agentheim/` entry (both tracked-modified and untracked), present it to the **user** with the two allowed dispositions. Do not batch them into a single yes/no; a mixed set (one orphan to commit, one live sibling to leave) is the common case.
   - **(A) Commit deliberately.** The file is this project's own orphaned bookkeeping that no skill owns (e.g. an INDEX edit or protocol line a crashed prior session left behind). Make its **own scoped, clearly-labeled** commit: enumerate the exact path — `git add <exact-path>`, never `git add -A` / `git add .` (`references/commit-doctrine.md`) — then commit with `chore(<bc>): reconcile stranded <short-desc> [<last-task-id>]` (or `chore: reconcile stranded <short-desc>` if no task ran). One reconciliation commit may group several paths **only** if they are one coherent orphan set, each path still enumerated in the `git add`.
   - **(B) Leave behind with a named owner.** The file belongs to another live flow — a concurrent `modeling` session's in-flight task, a still-un-verified worker's code, or known non-work noise. Leave it untouched and record a leave-behind note that **names the presumed owner and the reason** (e.g. `owner: concurrent modeling session, in-flight task file`). This is a deliberate, attributed decision — not the old anonymous "untouched" boilerplate.
4. **Concurrency caution — ask, do not assume (`.agentheim/`-owned paths only).** A *live* concurrent session's in-flight files are byte-indistinguishable from a crashed session's orphans. Committing another session's half-written markdown is the exact failure ADR-0026 §5 exists to prevent. So this step **asks the user per file** for `.agentheim/`-owned paths and never infers the disposition there. When the owner is uncertain, the safe default is **(B) leave behind**, not (A) commit — you can always reconcile a true orphan next session, but a wrongly-committed live file is a race you cannot cleanly undo.
5. **The scoped-add rule is unchanged.** Reconciliation is still an enumerated `git add <path>` per deliberately-committed file — never `git add -A` / `git add .` (`references/commit-doctrine.md`), which would sweep in exactly the concurrent-sibling files disposition (B) exists to protect.
6. **Record the dispositions.** Carry every `.agentheim/`-owned file's disposition into the session-end protocol entry's `**Carry-over:**` line (step 8): committed files as `<path>: committed (<label>)`, left-behind files as `<path>: left behind (owner: <flow>, <reason>)` — plus the one batched line from step 2 when non-`.agentheim/` files were stranded: `left behind (user WIP, N files)`. This replaces the "carry-over untouched, as in prior sessions" boilerplate — the protocol now records *what was decided and why*, per governed file, instead of silently repeating the leak, without interrogating the builder over their own WIP file by file.

### Worktree carry-over (extends this reconciliation — ADR-0032)

Run this alongside the working-tree carry-over above, at the same point in the session (after the last integration, before the session-end protocol entry): per-worker worktrees (`.worktrees/<task-id>/` on branch `aw/<task-id>`) get the same explicit-disposition treatment, extending **agentic-workflow-d6q4h**'s mechanism with a worktree category rather than replacing it.

1. **Detect.** Run `git worktree list --porcelain` (skip if not a git repo). Every entry other than the main worktree (the repo root) is a candidate. By this point every PASS/SKIP/BOUNCE this session completed already tore its worktree down (Git authority), so what remains is either a **known keep** (a FAIL-iteration-3 escalation from this session) or a genuine **orphan** (a session interrupted mid-cleanup, or a leftover from an earlier session).
2. **Surface, per worktree — never auto-remove.**
   - **Escalated this session (FAIL iteration 3)** → not an orphan, a deliberate keep. Record it plainly, no user prompt needed (the escalation itself already surfaced it in step 5 of the FAIL-iteration-3 handling above): `<path>: kept (owner: <task-id>, escalated at iteration 3, salvaged: <patch-path> — see task notes)`.
   - **Everything else** (no matching `doing/` task on `main`, or the matching task is already `done/`/`backlog/`) → an **orphan**. Ask the user, per worktree, the same two dispositions as the working-tree case: **discard** it (**salvage its diff first — tag `discarded`, see "Salvaging a worktree's diff before abandonment"** — then unlink any `dashboard/node_modules` link — `unlinkDashboardNodeModules` — then `git worktree remove --force` + `git branch -D aw/<task-id>`) or **keep** it for inspection. Never guess: a live concurrent session's worktree is byte-indistinguishable from an interrupted one's, same caution as the working-tree carry-over above.
3. **Record the disposition** on the same `**Carry-over:**` line as the working-tree entries (step 7 above) — e.g. `.worktrees/agentic-workflow-f6m2q: kept (owner: agentic-workflow-f6m2q, escalated at iteration 3, salvaged: .agentheim/salvage/agentic-workflow-f6m2q-escalated-iter3.patch)` or `.worktrees/agentic-workflow-old1: discarded (orphan, no matching doing/ task, salvaged: .agentheim/salvage/agentic-workflow-old1-discarded.patch)` — or, when the capture found an empty diff and skipped writing a file, `...discarded (orphan, no matching doing/ task, nothing to salvage)`.
4. **Feeds Phase 1 recovery.** An orphan or a kept escalation that survives to the *next* session is exactly the signal Phase 1's `git worktree list --porcelain` check picks up — the two mechanisms are one continuous thread across sessions, not independent.

## Protocol rotation check (session-end)

Run this once per session, immediately after step 8's session-end protocol entry has been committed — the self-firing cap-and-roll check ADR-0041 calls for, closing ADR-0039's deferred "who invokes it" non-decision (ADR-0045). Cheap, deterministic, and runs exactly when the live file has just grown from the entry step 8 just committed.

1. **Invoke `rotateProtocol` via the standard env-free plugin bootstrap** (the same homedir→cache→semver-max resolution the `claim`/`complete` CLI invocations already use, ADR-0038), pointed at `lib/protocol-rotation.mjs` instead of `lib/task-lifecycle-cli.mjs`:
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','protocol-rotation.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','protocol-rotation.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no protocol-rotation script found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});"
   ```
   Prints one manifest `{ok:true, rotated, changed:[paths], rolledMonths:[...], liveLines}` on stdout and exits 0 (or a structured `{ok:false, ...}` on some unexpected error — treat a non-zero exit / `ok:false` as a soft failure: change nothing, mention it in the end-of-run summary, never block or fail the session).
2. **`rotated: false`** (the common case) → nothing to do: no commit, no protocol entry. Silent no-op is correct.
3. **`rotated: true`** → `git add` exactly the manifest's `changed` paths (the rewritten `protocol.md` plus every new/appended `.agentheim/knowledge/protocol/YYYY-MM.md` archive file) — never `git add -A` / `git add .` (`references/commit-doctrine.md`) — and commit as its **own scoped commit**, separate from step 8's session-end-entry commit: `chore(agentic-workflow): rotate protocol — <rolledMonths joined with ", "> [<last-task-id>]` (or `chore: rotate protocol — ...` if the session completed no task).
4. **No protocol log entry for the rotation itself** — rotation is infrastructure housekeeping, not a project event worth a diary line. The commit message and the archive files themselves are the audit trail.

## INDEX done-list rotation check (session-end)

Run this once per session, immediately after the protocol rotation check above (ADR-0047, closing ADR-0045's deferred "sibling surface" scope boundary). Same self-firing cap-and-roll posture as the protocol check, applied to every bounded context's `INDEX.md` `done-list` instead of `protocol.md` — runs exactly when the session's `completeTask` calls have just grown one or more BCs' done-lists.

1. **Invoke `rotateAllIndexDoneLists` via the standard env-free plugin bootstrap** (same homedir→cache→semver-max resolution, ADR-0038), pointed at `lib/index-rotation.mjs`:
   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','index-rotation.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','index-rotation.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no index-rotation script found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});"
   ```
   Prints one manifest `{ok:true, rotated, healed, changed:[paths], contexts:{<bc>:{...}, ...}}` on stdout and exits 0 (or a structured `{ok:false, ...}` on some unexpected top-level error — treat as a soft failure: change nothing, mention it in the end-of-run summary, never block the session). The shape differs from the protocol check's manifest: the top-level `rotated`/`healed`/`changed` are aggregated across every BC, each BC's own result under `contexts[<bc>]`. A per-BC entry is one of four shapes (agentic-workflow-dk3vz, fail-closed on an unparseable done-list; the healed shape added by agentic-workflow-jf6qz):
   - `{ok:true, rotated:true, changed, rolledMonths, liveEntries}` — that BC actually rotated.
   - `{ok:true, rotated:false, changed:[], rolledMonths:[], liveEntries, unmatched?}` — the common case, nothing to roll; `unmatched > 0` only when the BC's done-list has non-blank lines that didn't match the expected shape but weren't destructive to skip — reported, not fatal, nothing written.
   - `{ok:true, rotated:false, healed:true, changed:[indexPath], rolledMonths:[], liveEntries}` — a stale archive-naming header corrected on an otherwise no-op run (ADR-0047 amendment, agentic-workflow-jf6qz): the BC didn't roll a month, but its live `### Done (...)` header wasn't yet in the corrected form and the BC already has a `done-archive/`, so the header alone was rewritten.
   - `{ok:false, code, context, reason}` — that BC REFUSED (unparseable done-list, or `INDEX.md` missing the done-list markers). Writes nothing. **Never flips the top-level `ok` or exit code** — a refusal can't strand a healthy BC's rotation. Top-level `changed` only ever lists the healthy (actually-rotated or healed) BCs' paths.
2. **`rotated: false` AND no BC refused AND no BC reported `unmatched > 0` AND no BC reported `healed:true`** → nothing to do: no commit, no protocol entry. (Narrower than the protocol check's unqualified `rotated: false` ⇒ no-op rule: a healthy-looking `rotated:false` can still be hiding a per-BC refusal, unmatched-line report, or one-time header heal, all of which step 3/4 must surface.)
3. **Surface every refusal and every unmatched-line report, regardless of the `rotated` branch.** Iterate `contexts`: for each BC with `ok === false`, add a line to the end-of-run summary naming the BC, its `code`, and its `reason`; for each BC with `unmatched > 0`, add a line naming the BC and the count. Never blocks the session and never prevents committing the healthy BCs' `changed` paths in step 4.
4. **`rotated: true`** → `git add` exactly the top-level manifest's `changed` paths (every rewritten `INDEX.md` plus every new/appended `contexts/<bc>/done-archive/YYYY-MM.md` file) — never `git add -A` / `git add .` — and commit as its **own scoped commit**, separate from steps 8 and 9's commits: `chore(agentic-workflow): rotate INDEX done-list — <bc>:<rolledMonths joined with ", ">[, <bc2>:<rolledMonths2>...] [<last-task-id>]` — one `<bc>:<rolledMonths>` segment per BC that actually rotated, comma-joined when more than one BC rotated (or `chore: rotate INDEX done-list — ...` if the session completed no task). Fires independently of whether any BC refused in step 3 — a refusal only ever removes that ONE BC's paths from `changed`. **`healed: true` with `rotated: false`** (no BC rotated a month, but at least one healed a stale header) → the same `git add` + commit obligation, staging exactly the top-level manifest's `changed` paths, but with its own message shape since a heal has no `rolledMonths` to report: `chore(agentic-workflow): heal INDEX done-list header — <bc>[, <bc2>...] [<last-task-id>]` (or `chore: heal INDEX done-list header — ...` if the session completed no task). When a run both rotates one BC and heals another in the same session, one commit using the rotate message above is sufficient — no need for two commits.
5. **No protocol log entry for the rotation or heal itself** (refusals/reports included) — same reasoning as the protocol check. The commit message and the archive files themselves are the audit trail; the end-of-run summary (step 3) is where a refusal or report surfaces to the human.

## Do not model in work

If a worker realizes mid-task that the scope is actually under-refined, it bounces to backlog — it does not try to refine the task itself. Refinement is the `modeling` skill's job, with the user in the loop. Workers executing under-specified tasks produce plausible-looking but wrong output — that's the worst possible outcome.
