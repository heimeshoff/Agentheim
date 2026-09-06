---
name: verification-before-completion
description: Use whenever the `work` skill is about to commit a worker's `RESULT: SUCCESS` — between the worker's return and `git add/commit`. Triggers internally from `work`'s post-success gate. Spawns the `verifier` agent with fresh context (no exposure to the worker's reasoning) to inspect the diff against the task's acceptance criteria and either PASS, FAIL with re-dispatch, or SKIP. Doctrine document; the operational steps live in `work`'s flow.
---

# Verification Before Completion — The Fresh-Eyes Gate

The worker just returned `RESULT: SUCCESS`. Trust nothing yet. A worker self-reporting success has the strongest possible incentive to call its own work done — every cognitive bias is aligned against catching its own mistakes. This skill is the structural answer: a separate agent, fresh context, reading the diff against the acceptance criteria as if seeing the work for the first time.

## What problem this solves

LLM workers fail in three distinctive ways that internal self-checks rarely catch:

1. **Plausible-but-wrong code** — the implementation reads as a reasonable solution to a different problem than the task actually specified. The worker's own attention is anchored to the solution it produced; it cannot easily see the gap to the actual spec.
2. **Partial implementation reported as complete** — the worker implements 4 of 5 acceptance criteria, runs the tests it wrote for those 4, sees green, and returns SUCCESS. The 5th criterion has no test and no implementation.
3. **Scope drift** — the worker implements the task plus three "while I'm here" improvements. Each is plausible; together they make the change harder to review and may break unstated invariants.

The verifier catches all three because it reads only the task spec and the diff — it has no exposure to the worker's reasoning trail and no investment in the solution.

## Why a separate agent, not just a checklist

If `work` ran the checks inline, it would do so in the same context that just dispatched the worker and is about to commit. That context carries momentum toward "ship it". A separately spawned agent reads only what it's handed — the task file, the BC README, the diff, the test output — and produces a verdict without that momentum. This is the load-bearing structural property; do not collapse it into a function call.

## What the verifier is given

The `work` skill spawns `verifier` per `skills/work/SKILL.md`'s **Verifier Prompt Template** —
the authoritative source for the exact field list, restated here only as a pointer to avoid a
second copy drifting out of sync. That template supplies: the task file's absolute path (in
`doing/`, on `main` — read-only, agentic-workflow-ghcaj), the BC name and README path, the worktree's absolute
path, the iteration number, the diff, the worker's strict SUCCESS return block, the **parsed
bookkeeping blocks** (`readmeDelta` / `adrs` / `outcome` / `backlogItems` — agentic-workflow-
ghcaj; there is no README/ADR diff to read, since the worker never writes those files), a
pre-resolved test command, a pre-resolved launch command, and pointers to `.agentheim/vision.md`,
`.agentheim/context-map.md`, and `.agentheim/knowledge/decisions/` for on-demand reading.

The verifier is explicitly NOT given:
- The worker's reasoning, scratchpad, or any explanation beyond the strict SUCCESS block
- The list of specialists the orchestrator consulted
- Prior verification attempts on the same task, as a *separate* artifact (each verification is
  judged independently). **Narrow exception (ADR-0061, check 1b):** the task file itself
  (which the verifier does read) accumulates `## Verifier note (iteration N)` sections that
  `work` appends on each FAIL — the verifier may read those, but only to compare a criterion's
  recorded measurement/proxy against the current diff's for metric-drift detection, never to
  bias re-judgment of a criterion that shows no drift.

## What the verifier checks

`agents/verifier.md`'s **"The checks, in order"** section is the authoritative, numbered list — restated here only as a pointer to avoid a second copy drifting out of sync (the six-drift history on this exact section, `agentic-workflow-s9wtc`, is why this is now a pointer). In order, stopping at the first failing check: **1** acceptance criteria coverage (human-eye carve-out, ADR-0061; runtime-surface narrowing, ADR-0036) → **1b** metric drift across iterations (ADR-0061) → **2** test execution, verdict from the runner only (ADR-0062) → **3** scope discipline → **4** ubiquitous language → **5** BC README sync → **6** ADRs for decisions → **6b** honored related ADRs → **6c** mechanize-or-drop convention enforcement (ADR-0059) → **7** no protocol/index/git tampering → **8** runtime drive (ADR-0036), final and most expensive. See `agents/verifier.md` for each check's full text.

## Verdicts

The verifier returns one of three verdicts. Strict format — `work` parses these deterministically.

### `VERDICT: PASS`

The diff is committable. `work` proceeds per the PASS bullet under "What `work` does with each verdict" below (agentic-workflow-ghcaj, ADR-0074) — the conductor materializes, in order, README delta(s), ADR(s) + `finalizeAdrNumbering`, the `## Outcome` append, the real `doing → done` move, any new backlog items, then commits once. That sequence, not a restatement here, is canonical; in particular it never stages the worker's raw `FILE_LIST` directly — only the `complete` manifest's `changed` subset (ADR-0057).

```
VERDICT: PASS
TASK_ID: <id>
EVIDENCE: <one line per acceptance criterion, naming the test or artifact that covers it —
  or "builder eye-check pending" for a `[human-eye]` criterion (ADR-0061)>
```

### `VERDICT: FAIL`

The diff is not committable. `work` rolls back the worker's claim of completion and re-dispatches.

```
VERDICT: FAIL
TASK_ID: <id>
REASONS:
- <one bullet per concrete defect, citing the file/line where possible>
SUGGESTED_FIX: <brief — what the next worker should do>
ITERATION_HINT: likely-fixable | task-under-specified
```

### `VERDICT: SKIP`

Rare. The task is `type: decision` with an ADR-only deliverable, or the verifier determines there is nothing executable to verify and reading the artifact against the spec is what the user should do, not the verifier. `work` treats this as PASS but logs it differently.

```
VERDICT: SKIP
TASK_ID: <id>
REASON: <why verification doesn't usefully apply to this task>
```

## What `work` does with each verdict

The operational integration lives in `skills/work/SKILL.md`. In short:

- **PASS** → the conductor materializes the worker's reported bookkeeping on `main`, in order — README delta(s), ADR(s) + `finalizeAdrNumbering`, the `## Outcome` append, the real `doing → done` move (here, for the first time — the worker's worktree never touched the task file at all, agentic-workflow-ghcaj), any new backlog items — then commits once, and logs "Task verified and completed" to protocol.md.
- **FAIL, first or second attempt on this task** → append the verifier's REASONS to the task file **on `main`** (there is no worktree copy to append to or revert — the file never moved out of `doing/` in the first place, post-ghcaj) as a `## Verifier note` block, log "Verification failed" to protocol.md, **re-dispatch a worker** on the same task with the verifier note included in its prompt. Hard cap: 2 re-dispatches per task.
- **FAIL, third time on the same task** → do not re-dispatch. Before anything else, salvage the worktree's diff to a patch tagged `escalated-iterN` (ADR-0063) and append a `## Salvage note` to the task file naming the patch's absolute path — the worktree is kept, not removed, at this point, but a later discard (a subsequent session's Phase 1 recovery or session-end reconciliation) could still lose the fix if nothing was captured first. Leave the task in `doing/` with all accumulated verifier notes. Log "Verification failed — escalating to user" to protocol.md. Surface at end of batch, naming the salvaged patch's path explicitly.
- **SKIP** → commit as on PASS, but the protocol entry reads "Task completed (verification skipped: <reason>)".

The re-dispatch loop has a cap because beyond two retries you're almost always looking at an under-specified task that needs refinement (the modeller's job), not another execution attempt.

## When to skip the gate entirely

The user can disable verification for a `work` batch by invoking `work` with `--no-verify` or by saying "skip verification this run". This is for exploratory throwaway batches. The default is always verify; the opt-out is never persistent.

`work` also skips verification automatically when:
- The project isn't a git repo (no diff to inspect)
- A worker returned `RESULT: BOUNCED` or `RESULT: FAILED` (nothing to verify)
- The task is `type: decision` AND `FILES_CHANGED == 0` AND the worker's `ADRS` block carries exactly one entry (the ADR travels in the block, never as a file — agentic-workflow-ghcaj) — auto-SKIP without spawning the verifier.

## Anti-patterns

- **Verifying with the same context that wrote the code.** Defeats the entire point. The fresh-eyes property is the value.
- **Letting the verifier propose fixes and apply them itself.** The verifier has no Write/Edit tools. If it could fix, it would lose the auditor role.
- **Treating FAIL as a worker failure.** It isn't — FAIL means "this diff isn't committable yet". The worker did what it could; the verifier surfaced what's missing. Both did their job.
- **Indefinite re-dispatch loops.** Cap at 2 retries. Past that, surface — the failure mode is structural, not executional.
- **Skipping verification on "small" tasks.** Small tasks are where this is cheapest. Don't optimize the cheapest thing away.

## Interaction with test-driven-development

When the worker followed `test-driven-development`, the verifier's first check (acceptance criteria coverage) becomes trivial — every criterion has a named test. When the worker skipped TDD, the verifier has to re-derive the test space and judge whether non-test evidence covers each criterion. Both flows are supported; TDD makes verification an order of magnitude cheaper.
