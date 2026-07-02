---
name: work
description: Use whenever the user wants work executed on the todo backlog — running tasks, building features, implementing what has already been modeled. Triggers on phrases like "start working", "execute the todo", "work on it", "build it", "implement the backlog", "let's go", "run the workers", "pick up where you left off", "ship what's ready". Spawns parallel worker sub-agents that resolve task dependencies and claim ready tasks from `contexts/*/todo/`. Workers follow TDD per `skills/test-driven-development/SKILL.md`. Every worker SUCCESS goes through a `verifier` agent (see `skills/verification-before-completion/SKILL.md`) before commit — failed verification re-dispatches the worker up to twice, then escalates to the user. New tasks promoted to todo during the run are picked up automatically as they become ready. Does not do modeling — only executes already-refined tasks.
---

# Work — Parallel Dependency-Aware Worker Loop

The `work` skill turns refined `todo/` tasks into real code and real decisions. It is a loop, not a one-shot: it keeps going until todo is empty (or the user stops it), and it picks up tasks added mid-run.

**The orchestrator (you) never writes code.** You coordinate: scan, build the DAG, dispatch workers, commit, log. Keeping you lean prevents context exhaustion across long batches. All coding work is delegated to subagents.

## Phase 1: Recovery check

Before anything else, look at `contexts/*/doing/`:
- **0 tasks** → proceed to Phase 2.
- **1 task** → a previous session was interrupted. Resume it sequentially as the first task of this session, *before* starting any parallel dispatch.
- **2+ tasks** → a previous parallel session was interrupted. Ask the user: "Resume all in parallel", "Resume one at a time", or "Abandon — move them back to todo". Do not guess.

## Phase 2: Build the dependency graph

1. Read `.agentheim/vision.md` and `.agentheim/context-map.md` for orientation.
2. Read `.agentheim/knowledge/index.md` (top-level catalog — current BCs and recent ADRs). If missing, surface to user that the project hasn't been indexed and offer to run `scripts/backfill-indexes.ps1` (or `.sh`) before continuing — workers will be less effective without indexes.
3. Read the first ~100 lines of `.agentheim/knowledge/protocol.md` (newest entries are on top — this gives recent activity context). Skip if it doesn't exist yet. **Hold this excerpt in memory** — you pass it forward to each worker as `## Recent activity` so workers don't re-read the protocol themselves.
4. Scan `.agentheim/contexts/*/todo/` and `.agentheim/contexts/*/doing/`.
5. For every todo task, read `depends_on`. A task is *ready* if every id in `depends_on` is in `done/` (or doesn't exist — treat missing as satisfied, but warn the user).
6. **Detect cycles.** If the graph has a cycle, stop and surface the cycle to the user. Do not "just pick one".
7. Briefly tell the user what you found: "X tasks ready across N contexts, Y tasks blocked on Z."

## Phase 3: Conflict detection before batch dispatch

Two parallel workers touching the same file is the most common cause of merge pain. Defend against it:

1. For each ready task, scan its `What`, `Acceptance criteria`, and `Notes` sections for file paths, directory references, and shared resources (BC READMEs, ADRs, shared modules).
2. If two ready tasks reference the same file or directory, **demote the higher-id task to the next batch** — don't dispatch it in the current wave.
3. Tasks targeting the same BC's README count as a conflict (only one worker updates the BC memory per batch).
4. **Cap the batch at MAX_PARALLEL = 3** unless the user asked otherwise. Pick the lowest-numbered unblocked, non-conflicting tasks.

## Phase 4: Batch dispatch

For each dispatch wave:

1. **Move all selected task files** from `todo/` to `doing/` (the orchestrator does this *before* spawning subagents — prevents workers racing for the same file).

2. **Log "Batch started"** to `.agentheim/knowledge/protocol.md` (prepend — see "Protocol logging" section below).

3. **Spawn one subagent per task** using the Agent tool with `subagent_type: "worker"`. Launch all subagents in **one message** (parallel tool calls). Use the Subagent Prompt Template below.

4. **Wait for all subagents to complete.** As each returns:
   - Parse its strict return format (see template).
   - For `RESULT: SUCCESS`:
     - **Verify the result** (see "Verification gate" section below). Only commit after verification passes.
   - For `RESULT: BOUNCED`: the worker moved the task back to `backlog/` because it was under-refined. Log "Task bounced" to protocol.md. Do not commit — the worker made no changes.
   - For `RESULT: FAILED`: log "Task failed" to protocol.md with the error. Leave the task in `doing/` so it doesn't silently retry. Tell the user at the end.
   - One failure does not block the batch — the other subagents continue and are processed normally.

5. **After the batch completes**, return to Phase 2 — re-scan. New tasks may have been promoted to todo (via parallel `modeling` invocations) or new dependencies may have unblocked.

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

For each SUCCESS that requires verification, in parallel where the workers ran in parallel:

1. Capture the diff: run `git diff` (working tree against HEAD — the worker has not committed) and `git diff --stat`. Note the exact files changed.
2. Track the iteration count for this task (start at 1; increments on each FAIL re-dispatch).
3. Spawn one `verifier` subagent via Agent with `subagent_type: "verifier"` using the **Verifier Prompt Template** below. Launch verifiers for a batch's successes in the same message (parallel tool calls).
4. Wait for each verifier's verdict.

### Handling the verdict

**`VERDICT: PASS`**
1. Proceed to the existing "Git authority" section — it does the INDEX/protocol/task-move bookkeeping **before** the commit, then `git add`s everything and commits in one shot (per ADR-0026). Note the protocol entry written there is "Task verified and completed" (replaces the old "Task completed" entry — see Protocol logging below).

**`VERDICT: SKIP`**
1. Commit exactly as on PASS — same before-the-commit bookkeeping. The protocol entry written in the Git authority step is "Task completed (verification skipped: <reason>)".

**`VERDICT: FAIL`, iteration 1 or 2**
1. Do **not** commit. The worker's changes stay on the working tree but are not added or committed yet.
2. Roll back the worker's completion claim on the task file:
   - Move the task file from `done/` back to `doing/`
   - Revert frontmatter: `status: done` → `status: doing`, clear the `completed:` date
3. Append the verifier's output to the task file as a new `## Verifier note (iteration N)` section at the bottom, containing the REASONS, SUGGESTED_FIX, and ITERATION_HINT verbatim.
4. Log "Verification failed (iteration N)" to protocol.md.
5. Decide re-dispatch:
   - If `ITERATION_HINT: task-under-specified` → do not re-dispatch even on iteration 1. Treat as iteration-3 below.
   - Otherwise → **re-dispatch a worker** on this task. Use the standard Subagent Prompt Template, but prepend a paragraph telling the worker to read the task file's `## Verifier note` sections and address them. Set `iteration = N + 1` for the next verification.

**`VERDICT: FAIL`, iteration 3 (or earlier with `ITERATION_HINT: task-under-specified`)**
1. Do not commit. Do not re-dispatch.
2. Leave the task in `doing/` with all accumulated verifier notes — the user will see them.
3. Log "Verification failed — escalating to user" to protocol.md.
4. Surface at end-of-batch (see End-of-run reporting): summarize the task, the iteration history, and the latest verifier's SUGGESTED_FIX. The user decides whether to refine the task (re-route via `modeling` REFINE) or abandon.

### Verifier Prompt Template

Spawn each verifier with `Agent(subagent_type: "verifier", prompt: <the-below>)`. Fill the placeholders.

```
You are a verifier agent auditing one worker's completed task with fresh context. You have no exposure to the worker's reasoning — only the task spec, the BC README, and the diff in front of you.

## Your inputs
Task file (currently in doing/ or done/): <ABSOLUTE-PATH>
Bounded context: <BC-NAME>
BC README: <ABSOLUTE-PATH-TO-BC-README>
Iteration: <N> of max 3

## The worker's strict SUCCESS return
<paste the worker's full RESULT: SUCCESS block verbatim>

## The diff to audit
<paste `git diff --stat` output, then `git diff` output — or attach as text>

## Pre-resolved test command
The `work` skill resolved this project's test command once for this batch (the same command is reused across every verification iteration for this BC). Use it directly in check 2 — run it as-is instead of re-discovering. If it reads `none`, resolution found no command; fall back to your own discovery procedure, and if that also finds nothing, apply your fail-closed FAIL.

<the resolved test command string for this BC, or `none` if resolution found nothing>

## Project context (read on demand if needed)
- .agentheim/vision.md
- .agentheim/context-map.md (if exists)
- .agentheim/knowledge/decisions/ (ADRs)

## Your job
Follow the checks in `agents/verifier.md`, in order, stopping at the first failing check. Return exactly one verdict block — VERDICT: PASS, VERDICT: FAIL, or VERDICT: SKIP — per the strict formats in your agent definition.

Do not use Write, Edit, or any git command. You are read-only.
```

### Parallel verification

When the orchestrator dispatched a parallel batch of N workers and several return SUCCESS, capture each worker's diff independently (use `git diff -- <FILE_LIST>` per worker if needed to scope the patch), and spawn the verifiers as parallel Agent calls in one message. Each verifier sees only its own task's diff. Commit each verified-PASS sequentially in the order verifiers return — never parallelize git writes.

## Git authority (orchestrator only)

Git is owned by `work`, not by workers or verifiers. Workers only move files and write content; verifiers only read. This is load-bearing for parallel safety — two writes to git concurrently can race.

**The doctrine here is ADR-0026: all bookkeeping is written and `git add`ed BEFORE the commit, so a completed task's code + task-move + INDEX + protocol all land in ONE commit and the working tree is clean afterward.** There is no post-commit write step — the old `commit: <sha>` chicken-and-egg (which forced bookkeeping out of the task commit into a separate trailing per-session commit) is gone.

After a verifier returns `VERDICT: PASS` (or `VERDICT: SKIP`, or when verification was bypassed per the skip rules above), do all of this **before** committing:

1. `git status` to see what changed.
2. **Write all bookkeeping now (pre-commit):**
   - The worker already moved the task file `doing → done` and set `status: done` + `completed:`. Confirm that move is on disk.
   - Apply the BC `INDEX.md` doing → done edits (see "Index updates" below) for this task.
   - Apply the ADR↔task backlink maintenance and any ADR index inserts (see "Index updates").
   - Prepend the `protocol.md` entry for this task (see "Protocol logging") — write the final entry now, not after the commit.
3. `git add` an **explicit, enumerated** list: the files from the worker's `FILE_LIST`, plus the moved task file, the updated BC README (if `BC_README_UPDATED: yes`), any ADRs in `ADRS_WRITTEN`, **and the `INDEX.md` files and `protocol.md` you just edited in step 2**. **Never `git add -A` / `git add .`** — a blanket add sweeps in the user's in-progress work or a parallel sibling worker's files still awaiting their own verification, and a concurrent `modeling` session's in-flight markdown (ADR-0026's scoped-add rule is load-bearing for concurrency safety).
4. Commit with message:
   ```
   <type>(<bc>): <summary> [<task-id>]
   ```
   where `<type>` comes from the task's frontmatter (feature / bug / refactor / chore / spike / decision), `<bc>` is the bounded context, `<task-id>` is the task id. Example:
   `feature(books): add ReadingSession concept to Book aggregate [books-001]`

The commit SHA is **not** written back anywhere. A task's commit is discoverable from `git log` via the `[<task-id>]` trailer in the message — that is why the `commit:` frontmatter field is dropped (ADR-0026). Do **not** add a `commit: <sha>` field and do **not** amend the task file after committing.

### One commit per task — and the trivial-squash carve-out

**One task = one commit is the default.** Commit after each verifier passes, not in a batch — that way if the next verification fails we haven't bundled it with an already-passed one. In a parallel batch where verifiers return roughly simultaneously, commit sequentially in the order verifiers return PASS.

**Trivial-squash carve-out (ADR-0026):** a *wave* of trivial follow-up tasks MAY be folded into one commit (carrying one `[<task-id>]` trailer per squashed task) **only when ALL of these hold**:

- **(a) Same BC** — every task in the wave belongs to the same bounded context.
- **(b) Same file set** — they touch the same files; no task in the wave touches a file no other task in the wave touches.
- **(c) No-behavior-change tweaks** — each is a copy / chrome / token / formatting tweak layered on the prior one: no new test, no new code path, no acceptance criterion that a test would newly cover. (If a task adds a test or a behavior, it is not trivial — give it its own commit.)
- **(d) Same batch** — they were dispatched in the same `work` batch and all passed verification.

The aw-064/065/066/067 one-line topbar-chrome tweaks are the canonical example. When in doubt, do **not** squash — one commit per task is always safe. This carve-out bends the vision's "one task = one commit" invariant deliberately; that is why it is recorded in ADR-0026.

If the project isn't a git repo, skip commits silently and note it in the end-of-run summary. (Verification is also auto-skipped in this case — see "When to skip verification".)

## Index updates (orchestrator-owned)

Indexes track artifact movement. The work skill — **never the worker** — updates them. The worker is scope-restricted; touching `INDEX.md` files from inside a worker would fail verification. Index template lives at `references/index-template.md`.

These edits are part of the bookkeeping that is written and `git add`ed **before** the commit (ADR-0026) — the doing → done INDEX edit, the ADR backlinks, and the protocol entry all land in the same commit as the task. Do them in the Git authority step's pre-commit phase, not after.

Per state transition in `contexts/<bc>/INDEX.md`:

| Transition | Marker edits | Counts |
|---|---|---|
| **todo → doing** (Phase 4 step 1) | remove from `<!-- todo-list:start -->` → insert into `<!-- doing-list:start -->` | Todo −1, Doing +1 |
| **doing → done** (pre-PASS-commit bookkeeping) | remove from `<!-- doing-list:start -->` → insert at top of `<!-- done-list:start -->` (newest first) | Doing −1, Done +1 |
| **doing → backlog** (BOUNCED) | remove from `<!-- doing-list:start -->` → insert into `<!-- backlog-list:start -->` | Doing −1, Backlog +1 |
| **doing → doing** (FAIL iteration N, re-dispatched) | no list move; line stays in doing-list | no count change |
| **doing → doing-final** (FAIL iteration 3, escalated) | no list move | no count change |

Per ADR written (from `ADRS_WRITTEN` in worker SUCCESS):

- Read the ADR's frontmatter `scope:` field.
- `scope: <bc-name>` → insert under `<!-- adr-local:start -->` in `contexts/<bc-name>/INDEX.md`.
- `scope: global` → insert under `<!-- adr-global:start -->` in `.agentheim/knowledge/index.md`.
- **Bidirectional backlink:** append the ADR id to the task's `related_adrs` frontmatter, and append the task id to the ADR's `related_tasks` frontmatter. The worker writes the ADR but does not maintain these cross-links — the orchestrator does, atomically, alongside the index update.

If `.agentheim/knowledge/index.md` or the BC's `INDEX.md` does not exist yet, create it from `references/index-template.md` before inserting. Do not auto-rewrite the file — only insert/remove at markers.

If `NEW_BACKLOG_ITEMS` are non-empty in the worker SUCCESS, also insert those task lines under `<!-- backlog-list:start -->` in the appropriate BC's INDEX.md (counts +N).

## Protocol logging

`.agentheim/knowledge/protocol.md` is the project's chronological diary. Every `work` event prepends a new entry. Keep entries terse — the diff carries the detail.

The completion entries below are written in the **pre-commit bookkeeping phase** (ADR-0026), so they ride in the task's own commit. Because the commit SHA isn't known until after the commit and isn't written back anywhere, the `**Commit:**` line is **omitted** from these entries — `git log`'s `[<task-id>]` trailer is the SHA index. (The "Batch started" entry is prepended at Phase 4 step 2, before dispatch, and gets committed with the batch's tasks.)

### Observability fields — measure, never fabricate

`work` records the cheap-to-capture cost signals it can actually observe, and explicitly declines the ones it cannot. This is the observability floor: the protocol entries are written anyway, so carrying these fields is near-free.

- **Duration** — wall time the orchestrator measures against its own clock: note the dispatch time when you spawn a worker (Phase 4) and subtract it from the time that worker's verdict lands. This is a real measurement the session already has — it needs no harness support. Record it on every task-completion entry (dispatch → verdict for that task) and record the whole-session span on the session-end entry. Express it human-readably (e.g. `4m12s`, `1h03m`).
- **Verification iteration** — the `PASS (iteration N)` count is **mandatory**, never dropped. N is the iteration counter the verification gate already tracks (1 on a first-try pass, higher after re-dispatch). It is the signal for "is the verifier earning its spend."
- **Dispatch / re-dispatch tally** — the session-end entry carries a per-task count of how many times each task was dispatched (1 + its re-dispatch count). The orchestrator already tracks this per task for the iteration counter; the tally just surfaces it.
- **Token / dollar cost — deliberately omitted.** The orchestrating session has no programmatic access to its own or its subagents' token counts, so any token or cost figure here would be fabricated. It is left out on purpose (acceptance criterion: no fabricated metrics). If a future harness exposes real per-run token counts to the session, add a `**Tokens:**` line then — until it does, absence is the honest record.

If `protocol.md` doesn't exist, create it with:
```markdown
# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---
```

Then every entry is prepended right after the `---` on line 4.

Entry formats:

```markdown
## YYYY-MM-DD HH:MM -- Batch started: [task-id-1, task-id-2, ...]

**Type:** Work / Batch start
**Tasks:** task-id-1 - [title], task-id-2 - [title]
**Parallel:** yes / no (N workers)

---

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

Spawn each worker with `Agent(subagent_type: "worker", prompt: <the-below>)`. Fill the placeholders.

```
You are a worker agent executing one refined task. Stay strictly within its scope.

## Your task
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

<Paste the head -100 excerpt the orchestrator captured in Phase 2 verbatim.>

## Project context (read only if you need them)
- .agentheim/vision.md
- .agentheim/context-map.md (if exists)
- .agentheim/knowledge/decisions/ (other ADRs beyond the pre-loaded ones)
- .agentheim/knowledge/research/ (research reports)
- .agentheim/contexts/<bc>/concepts/ (opt-in synthesis pages — grep for relevant concepts before designing)

## Rules — CRITICAL
1. Do NOT run `git add`, `git commit`, or any git write operation. The orchestrator owns git.
2. Do NOT modify `.agentheim/knowledge/protocol.md`. The orchestrator owns protocol logging.
3. Do NOT modify any `INDEX.md` (`.agentheim/knowledge/index.md` or `.agentheim/contexts/*/INDEX.md`). The orchestrator owns indexes.
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
- Don't restate the task file or the BC README verbatim — the orchestrator already has them.

## Return format — STRICT
When done, return ONLY the following, nothing else. No prose, no preamble, no "here's what I did".

RESULT: SUCCESS
TASK_ID: <id>
SUMMARY: <one or two sentences, domain-language>
FILES_CHANGED: <integer>
FILE_LIST: <comma-separated absolute paths of all files you created or modified, EXCLUDING the moved task file>
BC_README_UPDATED: yes | no
ADRS_WRITTEN: <comma-separated filenames under .agentheim/knowledge/decisions/, or "none">
NEW_BACKLOG_ITEMS: <comma-separated task ids created in a backlog/ during your work, or "none">
TESTS_ADDED: <integer count of new tests written for this task>
TESTS_PASSING: yes | no
TDD_SKIPPED: <reason from the legitimate-skip categories, or "no" if TDD was followed>
CONCEPT_CANDIDATE: <concept-name> — converging on N artifacts (<id list>) | none

If `TESTS_PASSING: no`, do NOT return SUCCESS — that's a FAIL or a BOUNCE, not a success.

For a bounce, return:
RESULT: BOUNCED
TASK_ID: <id>
REASON: <one or two sentences on what was missing>

For a failure, return:
RESULT: FAILED
TASK_ID: <id>
ERROR: <where and why it went wrong, one or two sentences>
```

## End-of-run reporting

When `todo/` is empty and all `doing/` is resolved (or the user interrupts):

1. Summarize in plain prose: tasks completed (with verification stats — how many passed first try vs. needed re-dispatch), tasks bounced (and why), tasks failed (and why), tasks escalated after 3 verification failures (these need user attention), ADRs written, new backlog items created, total commits made.
2. For each task escalated to the user: name it, summarize the iteration history, and show the latest verifier's SUGGESTED_FIX. The user decides whether to REFINE via `modeling` or abandon.
3. **Concept candidates.** Aggregate every non-"none" `CONCEPT_CANDIDATE` from worker SUCCESS blocks across the run. If any concept name shows up in 2+ workers' returns, escalate the convergence signal more loudly. For each unique candidate: print the concept name, the BC, and the converging artifact ids. The user decides whether to create the page (per `references/concept-template.md`); never auto-create.
4. Surface anything that surprised you mid-run: cycles detected, dependency gaps, recovered sessions, repeated verification failures pointing at a common cause.
5. **Reconcile stranded working-tree carry-over** (see the dedicated section below). Do this *after* the last per-task commit and *before* prepending the session-end protocol entry — its dispositions feed the `**Carry-over:**` line of that entry.
6. Prepend a final protocol entry:
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
   **Carry-over:** [reconciliation disposition per stranded file, from the step-5 section — one entry each: `<path>: committed (<label>)` or `<path>: left behind (owner: <flow>, <reason>)`; or `none — working tree clean`. NEVER the old "untouched, as in prior sessions" boilerplate — every stranded file names an explicit disposition or the tree was clean.]

   ---
   ```
   This is the one `work` protocol line written *after* a commit (it summarizes the session). To honor ADR-0026's "clean working tree" rule, **commit it** with a scoped add of only `protocol.md`: `git add .agentheim/knowledge/protocol.md` then `chore(<bc>): work session end bookkeeping [<last-task-id>]` (reuse the last completed task's id as the trailer, or `chore: work session end bookkeeping` if the session committed nothing). Do not `git add -A`. This is the *only* bookkeeping-after-commit `work` performs, and it is a single line — every per-task INDEX/protocol edit already rode in its own task commit (the old trailing "record SHAs + INDEX/protocol" commit is gone). (Any *deliberately-committed* stranded file from step 5 rode in its own scoped reconciliation commit *before* this entry — see below.)

## Reconciling stranded working-tree carry-over (session-end)

The scoped-`git add` rule (ADR-0026 §5) is load-bearing for concurrency, but it has a cost: anything no skill explicitly enumerated stays uncommitted **forever**. Left unmanaged this silently accumulates dirty state — the confirmed leak where the *same* files were recorded as "carry-over (untouched, as in prior sessions)" session after session, each run dutifully stepping around them. This step closes that leak by forcing an explicit, user-surfaced disposition for every stranded file — without ever loosening the scoped-add rule.

Run this once per session, at end-of-run step 5 (after the last per-task commit, before the session-end protocol entry):

1. **Detect.** Run `git status --porcelain`. Each line is a stranded working-tree entry: tracked-modified/staged (` M`, `M `, `MM`, `A `, `D `, `R `, …) **or** untracked (`??`). By this point every task this session completed has already ridden into its own commit, so a clean tree yields no lines. If the output is **empty**, there is nothing to reconcile — record `Carry-over: none — working tree clean` and skip to the protocol entry.
2. **Surface, per file — never auto-sweep.** For **each** stranded entry (both tracked-modified and untracked), present it to the **user** with the two allowed dispositions. Do not batch them into a single yes/no; a mixed set (one orphan to commit, one live sibling to leave) is the common case.
   - **(A) Commit deliberately.** The file is this project's own orphaned bookkeeping that no skill owns (e.g. an INDEX edit or protocol line a crashed prior session left behind). Make its **own scoped, clearly-labeled** commit: enumerate the exact path — `git add <exact-path>` (never `git add -A` / `git add .`) — then commit with `chore(<bc>): reconcile stranded <short-desc> [<last-task-id>]` (or `chore: reconcile stranded <short-desc>` if no task ran). One reconciliation commit may group several paths **only** if they are one coherent orphan set, each path still enumerated in the `git add`.
   - **(B) Leave behind with a named owner.** The file belongs to another live flow — a concurrent `modeling` session's in-flight task, a still-un-verified worker's code, the user's own WIP, or known non-work noise (e.g. an untracked screenshot). Leave it untouched and record a leave-behind note that **names the presumed owner and the reason** (e.g. `owner: concurrent modeling session, in-flight task file`). This is a deliberate, attributed decision — not the old anonymous "untouched" boilerplate.
3. **Concurrency caution — ask, do not assume.** A *live* concurrent session's in-flight files are byte-indistinguishable from a crashed session's orphans. Committing another session's half-written markdown is the exact failure ADR-0026 §5 exists to prevent. So this step **asks the user per file** and never infers the disposition. When the owner is uncertain, the safe default is **(B) leave behind**, not (A) commit — you can always reconcile a true orphan next session, but a wrongly-committed live file is a race you cannot cleanly undo.
4. **The scoped-add rule is unchanged.** Reconciliation is still an enumerated `git add <path>` per deliberately-committed file. It **never** becomes `git add -A` / `git add .` — that would sweep in exactly the concurrent-sibling files disposition (B) exists to protect.
5. **Record the dispositions.** Carry every file's disposition into the session-end protocol entry's `**Carry-over:**` line (step 6): committed files as `<path>: committed (<label>)`, left-behind files as `<path>: left behind (owner: <flow>, <reason>)`. This replaces the "carry-over untouched, as in prior sessions" boilerplate — the protocol now records *what was decided and why*, per file, instead of silently repeating the leak.

## Do not model in work

If a worker realizes mid-task that the scope is actually under-refined, it bounces to backlog — it does not try to refine the task itself. Refinement is the `modeling` skill's job, with the user in the loop. Workers executing under-specified tasks produce plausible-looking but wrong output — that's the worst possible outcome.
