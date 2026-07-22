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
`doing/` or `done/`, inside the worktree), the BC name and README path, the worktree's absolute
path, the iteration number, the diff, the worker's strict SUCCESS return block, a pre-resolved
test command, a pre-resolved launch command, and pointers to `.agentheim/vision.md`,
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

In order, stopping at the first failing check:

1. **Acceptance criteria coverage.** Every `- [ ]` bullet in the task's `## Acceptance criteria` section maps to either: (a) an executable test in the diff that would fail without the production code change, or (b) — for the legitimate TDD-skip categories — a concrete artifact the verifier can inspect (ADR file, config validation, integration smoke check). **Narrowed by ADR-0036:** for a task whose diff touches a runtime surface, a self-reported "exercised manually" note is *never* sufficient on its own — that criterion needs check 8's HTTP-floor drive to pass. A manual note still covers only the visual-DOM delta when render infra is absent; it never substitutes for the HTTP floor. The old unrestricted manual-note carve-out survives only for diffs that touch no runtime surface (or whose BC declares none). **Human-eye criteria are never proxied (ADR-0061):** a bullet carrying the `[human-eye]` marker gets no test/artifact hunt and no invented metric — the verifier reports it `builder eye-check pending` in its PASS EVIDENCE, and it is never, on its own, a reason to FAIL this check.

1b. **Metric drift across iterations — escalation, not iteration fuel (ADR-0061).** On iteration 2 or 3 only: for any criterion whose text is unchanged since the prior iteration, the verifier compares the measurement/proxy the current diff uses against what a prior `## Verifier note` recorded for that same criterion (the one sanctioned exception to "each verification is independent" — reading prior notes here is solely for this drift comparison, never to re-bias judgment of criteria that show no drift). If the criterion's text held steady but its measurement changed, that is drift — the worker tuned the metric instead of fixing the underlying claim, the exact pattern the Dorc July-2026 review named. The verifier does not grant this an ordinary retry: it FAILs with `ITERATION_HINT: task-under-specified`, which `work`'s existing handling (`skills/work/SKILL.md` step 5: "do not re-dispatch even on iteration 1 — treat as iteration-3") already escalates immediately rather than re-dispatching, regardless of how many iterations remain under the normal cap — no new machinery, since drift is itself evidence the criterion was never truly falsifiable as worded.

2. **Test execution — verdict from the runner only (ADR-0062).** If `TESTS_ADDED > 0`, the verifier runs the test suite itself (the `## Pre-resolved test command`, or its own discovery as fallback) and confirms `TESTS_PASSING: yes` is true *now*, not just at the moment the worker reported it — and the confirmation comes from the runner's own exit status or structured report (TAP, JUnit XML, `node --test`'s summary), never from a test's own printed "PASS"/"OK"/checkmark. Printed-green-without-a-runner-verdict is unverified, not evidence, and FAILs this check — the exact gap Dorc's July-2026 review found (155 smoke tests trusted on their own say-so, 23% bad on the first honest run). A `[human-eye]` criterion (ADR-0061) never reaches this check at all — check 1 already routes it to `builder eye-check pending`; runner-first governs only the machine-checkable criteria that do reach execution.

3. **Scope discipline.** The diff touches only files the task implies. Out-of-scope changes are a FAIL — even when they look like good ideas, the verifier surfaces them as a candidate backlog item rather than approving them.

4. **Ubiquitous language.** Names introduced in the diff match the BC's README. A new term that doesn't appear in the README is a FAIL with a fix suggestion: add the term to the README first, or rename to match an existing term.

5. **BC README sync.** If the worker introduced new aggregates, events, commands, or invariants, did `BC_README_UPDATED: yes` and does the README actually reflect them? `yes` in the return block without a corresponding diff to the README is a FAIL.

6. **ADRs for decisions.** If the diff embeds a decision a future maintainer would ask about (library choice, pattern choice, an invariant chosen over alternatives), is there a corresponding ADR in `ADRS_WRITTEN`? Missing ADR for a real decision is a FAIL.

6b. **Honored related ADRs.** Read the task file's `related_adrs` frontmatter. For each id, read the ADR's `## Decision` section and verify the worker's diff is consistent with it — the worker was given these ADRs pre-loaded and was told reading them is mandatory. A FAIL if the diff contradicts a related ADR, silently ignores a constraint that clearly applies to the criterion at hand, or supersedes an ADR's decision without a new ADR in `ADRS_WRITTEN` naming the superseded id in its `supersedes` field. Skip this check entirely if `related_adrs` is empty.

6c. **Mechanize-or-drop — convention enforcement (ADR-0059).** If the diff *establishes a convention* — a naming/format/structural rule other tasks or agents are meant to follow going forward, not a one-off choice scoped to this task — the task file must carry either an enforcement acceptance criterion (a lint, a live-tree `node --test` check, or a build failure, actually shipped in the diff) or an explicit "prose-only, unenforced" marker recorded in the task file. A convention-establishing task with neither is a FAIL, analogous to the ADR gate above — an unenforced convention must be a visible, recorded decision, never an accident. Non-convention tasks skip this check entirely.

7. **No protocol, index, or git tampering.** The diff must not touch `.agentheim/knowledge/protocol.md` or any `INDEX.md` (`.agentheim/knowledge/index.md`, `.agentheim/contexts/*/INDEX.md`) — both are owned by `work`, not workers — and must contain no git operations in the worker's output. Violation is a FAIL — the worker broke a protocol rule.

8. **Runtime drive (ADR-0036).** The verifier's final and most expensive check. Fires only when the diff touches a `surfacePath` declared in the BC's `## Runtime surface` README manifest — absent manifest, or a diff that touches none of its `surfacePaths`, means the check does not run at all for this task. When it fires: boot the app from the worktree via the manifest's `launch` command, read the *actual* bound port from its runfile (never assume the derived value), assert the declared `probes` (stdlib-only HTTP GETs — status + body shape), run the opt-in render tier only when the task sets `runtime_render: true` and a browser capability is already present, and **always** tear down via the manifest's `stop` command regardless of outcome. A boot failure or any probe mismatch is a FAIL citing the probe. This check replaces the self-reported manual-exercise note as sufficient evidence for a runtime-surface change (see the narrowed check 1 above).

## Verdicts

The verifier returns one of three verdicts. Strict format — `work` parses these deterministically.

### `VERDICT: PASS`

The diff is committable. `work` proceeds per its own **"PASS / SKIP — squash-merge to `main`, one commit"** integration steps — squash-merge the worktree branch (`git merge --squash aw/<task-id>`), run the mechanized COMPLETE script, then `git add` only the `complete` manifest's `changed` paths plus any ADR/task backlink files, and commit. That sequence, not a restatement here, is canonical; in particular it never stages the worker's raw `FILE_LIST` directly — `changed` is the guarded subset (ADR-0057).

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

- **PASS** → move task to `done/` (if needed), commit, log "Task verified and completed" to protocol.md.
- **FAIL, first or second attempt on this task** → append the verifier's REASONS to the task file as a `## Verifier note` block, revert the task's frontmatter `status: done` back to `status: doing`, move it back from `done/` to `doing/` if the worker already moved it, log "Verification failed" to protocol.md, **re-dispatch a worker** on the same task with the verifier note included in its prompt. Hard cap: 2 re-dispatches per task.
- **FAIL, third time on the same task** → do not re-dispatch. Before anything else, salvage the worktree's diff to a patch tagged `escalated-iterN` (ADR-0063) and append a `## Salvage note` to the task file naming the patch's absolute path — the worktree is kept, not removed, at this point, but a later discard (a subsequent session's Phase 1 recovery or session-end reconciliation) could still lose the fix if nothing was captured first. Leave the task in `doing/` with all accumulated verifier notes. Log "Verification failed — escalating to user" to protocol.md. Surface at end of batch, naming the salvaged patch's path explicitly.
- **SKIP** → commit as on PASS, but the protocol entry reads "Task completed (verification skipped: <reason>)".

The re-dispatch loop has a cap because beyond two retries you're almost always looking at an under-specified task that needs refinement (the modeller's job), not another execution attempt.

## When to skip the gate entirely

The user can disable verification for a `work` batch by invoking `work` with `--no-verify` or by saying "skip verification this run". This is for exploratory throwaway batches. The default is always verify; the opt-out is never persistent.

`work` also skips verification automatically when:
- The project isn't a git repo (no diff to inspect)
- A worker returned `RESULT: BOUNCED` or `RESULT: FAILED` (nothing to verify)
- The task is `type: decision` AND the ADR was the only artifact AND `FILES_CHANGED == 1` (just the ADR file) — auto-SKIP without spawning the verifier.

## Anti-patterns

- **Verifying with the same context that wrote the code.** Defeats the entire point. The fresh-eyes property is the value.
- **Letting the verifier propose fixes and apply them itself.** The verifier has no Write/Edit tools. If it could fix, it would lose the auditor role.
- **Treating FAIL as a worker failure.** It isn't — FAIL means "this diff isn't committable yet". The worker did what it could; the verifier surfaced what's missing. Both did their job.
- **Indefinite re-dispatch loops.** Cap at 2 retries. Past that, surface — the failure mode is structural, not executional.
- **Skipping verification on "small" tasks.** Small tasks are where this is cheapest. Don't optimize the cheapest thing away.

## Interaction with test-driven-development

When the worker followed `test-driven-development`, the verifier's first check (acceptance criteria coverage) becomes trivial — every criterion has a named test. When the worker skipped TDD, the verifier has to re-derive the test space and judge whether non-test evidence covers each criterion. Both flows are supported; TDD makes verification an order of magnitude cheaper.
