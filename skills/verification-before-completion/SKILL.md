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

The `work` skill spawns `verifier` with:

- Absolute path to the task file (currently in `doing/` for unverified-success tasks)
- Absolute path to the BC's README
- The diff (`git diff` plus a list of changed files, or a generated patch attached as text)
- The worker's strict SUCCESS return block (so the verifier sees the worker's claims about tests, files, ADRs)
- Pointers to: `.agentheim/vision.md`, `.agentheim/context-map.md`, `.agentheim/knowledge/decisions/` (verifier reads on demand)

The verifier is explicitly NOT given:
- The worker's reasoning, scratchpad, or any explanation beyond the strict SUCCESS block
- The list of specialists the orchestrator consulted
- Prior verification attempts on the same task (each verification is independent)

## What the verifier checks

In order, stopping at the first failing check:

1. **Acceptance criteria coverage.** Every `- [ ]` bullet in the task's `## Acceptance criteria` section maps to either: (a) an executable test in the diff that would fail without the production code change, or (b) — for the legitimate TDD-skip categories — a concrete artifact the verifier can inspect (ADR file, config validation, integration smoke check). **Narrowed by ADR-0036:** for a task whose diff touches a runtime surface, a self-reported "exercised manually" note is *never* sufficient on its own — that criterion needs check 8's HTTP-floor drive to pass. A manual note still covers only the visual-DOM delta when render infra is absent; it never substitutes for the HTTP floor. The old unrestricted manual-note carve-out survives only for diffs that touch no runtime surface (or whose BC declares none).

2. **Test execution.** If `TESTS_ADDED > 0`, the verifier runs the test suite and confirms `TESTS_PASSING: yes` is true *now*, not just at the moment the worker reported it.

3. **Scope discipline.** The diff touches only files the task implies. Out-of-scope changes are a FAIL — even when they look like good ideas, the verifier surfaces them as a candidate backlog item rather than approving them.

4. **Ubiquitous language.** Names introduced in the diff match the BC's README. A new term that doesn't appear in the README is a FAIL with a fix suggestion: add the term to the README first, or rename to match an existing term.

5. **BC README sync.** If the worker introduced new aggregates, events, commands, or invariants, did `BC_README_UPDATED: yes` and does the README actually reflect them? `yes` in the return block without a corresponding diff to the README is a FAIL.

6. **ADRs for decisions.** If the diff embeds a decision a future maintainer would ask about (library choice, pattern choice, an invariant chosen over alternatives), is there a corresponding ADR in `ADRS_WRITTEN`? Missing ADR for a real decision is a FAIL.

6c. **Mechanize-or-drop — convention enforcement (ADR-0059).** If the diff *establishes a convention* — a naming/format/structural rule other tasks or agents are meant to follow going forward, not a one-off choice scoped to this task — the task file must carry either an enforcement acceptance criterion (a lint, a live-tree `node --test` check, or a build failure, actually shipped in the diff) or an explicit "prose-only, unenforced" marker recorded in the task file. A convention-establishing task with neither is a FAIL, analogous to the ADR gate above — an unenforced convention must be a visible, recorded decision, never an accident. Non-convention tasks skip this check entirely.

7. **No protocol or git tampering.** The diff must not touch `.agentheim/knowledge/protocol.md` (work owns it) and must contain no git operations in the worker's output. Violation is a FAIL — the worker broke a protocol rule.

8. **Runtime drive (ADR-0036).** The verifier's final and most expensive check. Fires only when the diff touches a `surfacePath` declared in the BC's `## Runtime surface` README manifest — absent manifest, or a diff that touches none of its `surfacePaths`, means the check does not run at all for this task. When it fires: boot the app from the worktree via the manifest's `launch` command, read the *actual* bound port from its runfile (never assume the derived value), assert the declared `probes` (stdlib-only HTTP GETs — status + body shape), run the opt-in render tier only when the task sets `runtime_render: true` and a browser capability is already present, and **always** tear down via the manifest's `stop` command regardless of outcome. A boot failure or any probe mismatch is a FAIL citing the probe. This check replaces the self-reported manual-exercise note as sufficient evidence for a runtime-surface change (see the narrowed check 1 above).

## Verdicts

The verifier returns one of three verdicts. Strict format — `work` parses these deterministically.

### `VERDICT: PASS`

The diff is committable. `work` proceeds to move the task to `done/` (if the worker didn't already), runs `git add` on the FILE_LIST and ancillary files, and commits.

```
VERDICT: PASS
TASK_ID: <id>
EVIDENCE: <one line per acceptance criterion, naming the test or artifact that covers it>
```

### `VERDICT: FAIL`

The diff is not committable. `work` rolls back the worker's claim of completion and re-dispatches.

```
VERDICT: FAIL
TASK_ID: <id>
REASONS:
- <one bullet per concrete defect, citing the file/line where possible>
SUGGESTED_FIX: <brief — what the next worker should do>
ITERATION_HINT: <"likely fixable with another worker pass" | "task is under-specified — consider bouncing to backlog">
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
- **FAIL, third time on the same task** → do not re-dispatch. Leave the task in `doing/` with all accumulated verifier notes. Log "Verification failed — escalating to user" to protocol.md. Surface at end of batch.
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
