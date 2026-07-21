---
id: ADR-0062
title: Runner-first testing — the verifier trusts only the runner's verdict; a project's first test task establishes the runner
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-vvmfy]
related_adrs: [0036, 0059, 0061, 0044]
---

# ADR-0062: Runner-first testing — the verifier trusts only the runner's verdict; a project's first test task establishes the runner

## Context

Dorc's July-2026 agent-time review (recommendation A4) found the corpus-scale version of a
trust failure this project's verification story had never named explicitly: 155 smoke tests
accumulated before anything actually ran them together, and 23% turned out bad on the first
honest run against a real runner. Workers and verifiers had been trusting each test's own
printed "PASS" as evidence, not any runner's independently-observed exit status. In mainstream
stacks this failure mode is muted because a trustworthy runner already exists on day one
(`dotnet test`, `vitest`, `node --test` all fail loudly and reliably) — it is acute in
ecosystems where a script prints its own verdict and the process exit code lies regardless of
outcome (game engines, embedded targets), and it is acute at any scale once nobody has ever
actually invoked the aggregate and read *its* answer.

Two existing pieces of the harness are adjacent but do not close this gap on their own:

- `agentic-workflow-g9s3w` pre-loaded the project's test command into the verifier spawn (the
  `## Pre-resolved test command` block, check 2) so the verifier stops re-discovering it every
  iteration. It never specified *what counts as the verdict* once that command runs — a gap
  this ADR closes.
- ADR-0036's runtime-drive check established the same underlying principle one layer up —
  boot-and-observe the actual running app rather than trust a worker's claimed behavior. This
  ADR is the same spirit applied to the test layer: observe the runner's actual verdict, don't
  trust a test's claimed one.

Nothing before this ADR said, in so many words, that a test printing its own "PASS" with no
runner ever actually invoked and checked is not evidence at all.

## Decision

Two coupled doctrine changes, both scoped to how this project's own workflow (not any target
project's runtime) trusts a test verdict:

### 1. The verifier trusts only the runner's verdict (`agents/verifier.md` check 2, mirrored in `skills/verification-before-completion/SKILL.md`)

A test verdict comes **only** from the project's runner — the pre-resolved test command
(g9s3w) or the verifier's own discovery fallback — and specifically from that runner's **exit
status or the structured report it produces** (TAP, JUnit XML, `node --test`'s summary line).
A test's own printed `PASS` / `OK` / checkmark, with no runner actually invoked and its exit
status read, is **unverified**: the verifier does not count it as PASS evidence, cites it as
unverified in REASONS, and FAILs check 2. This holds even when a worker's `TESTS_PASSING: yes`
claim looks entirely plausible — the verifier's job is to have run the command itself and read
*its* answer, not to accept the worker's transcript of having run it.

This composes with the two doctrines that landed earlier in this same review pass without
contradicting either:

- **ADR-0059 (mechanize-or-drop)** — the enforcement mechanism for this doctrine (below) mirrors
  ADR-0059's own self-referential shape: a judgment-embedded verifier check, not a lint.
- **ADR-0061 (falsifiability gate)** — a `[human-eye]` criterion never reaches a runner at all;
  check 1 already routes it to `builder eye-check pending` before check 2 ever runs. Runner-first
  governs *only* the machine-checkable criteria that do reach execution — falsifiability decides
  whether a criterion should be judged by a runner in the first place, runner-first decides what
  counts as evidence once it is.

### 2. A project's first test task establishes the runner (`skills/test-driven-development/SKILL.md`)

The first test-bearing task in a project (or the first test-bearing task for a given ecosystem
within a mixed-stack project) must, as part of that task and not a deferred follow-up:

1. Identify or wire up a runner whose exit status / structured report reliably reflects whether
   the tests it ran actually passed.
2. Record the invocation where `work`'s pre-resolved-test-command resolution (g9s3w) will find
   it — typically the BC README — so every later verifier spawn inherits it for free.
3. Prove the runner actually fails on a failure: deliberately break the first test, run the
   runner, confirm it reports failure, then fix it back to green.

**Fallback for runner-less ecosystems.** Where no native runner is trustworthy (exit code lies
unconditionally, or there is no structured report at all), the first test task must instead
*build* an external runner script that owns the verdict — the reference shape is Dorc's own
`run_smokes` + SmokeGuard pattern: a wrapper that captures each test's actual pass/fail signal
through a channel other than the untrustworthy exit code, aggregates into one machine-parseable
summary, and is itself the thing whose exit status the verifier's check 2 trusts. This is
named as the fallback, not the default — most ecosystems this project actually touches
(`node --test`) already have a trustworthy native runner and should use it directly.

## Self-referential compliance (ADR-0059)

This task establishes a convention (runner-first verdict trust; first-test-task runner
establishment) and satisfies mechanize-or-drop, but **ships no new `lib/` lint** — it records
here, explicitly, why not, which per ADR-0059 is itself a fully compliant choice when the
predicate genuinely resists mechanization:

- **"Was this printed PASS actually backed by a runner invocation the verifier itself just
  ran and checked?"** is not a predicate over committed source a lint can grep for — the
  violation, when it happens, lives in *ephemeral execution output* (what the verifier chose to
  trust in a live Bash call), not in any file `node --test` could statically inspect. The
  enforcement has to live at the point of judgment itself: the sharpened check 2 in
  `agents/verifier.md` (this task's own diff) *is* the mechanism, the same shape ADR-0059's own
  check 6c and ADR-0061's check 1b already use for predicates that are semantic rather than
  shape-matchable.
- **The "first test task establishes a runner" half is already mechanically enforced**, for
  free, by a mechanism that predates this ADR: check 2's existing fail-closed behavior (g9s3w) —
  "no command supplied and none discoverable → FAIL" — already rejects a `TESTS_ADDED > 0` task
  in a project with no test command anywhere. A first test task that skips establishing a runner
  cannot produce a task the verifier will PASS; the runner-first rule for *that* half rides on
  enforcement this project already shipped, not new machinery.
- What remains genuinely unmechanized is the *fallback pattern's shape* (the SmokeGuard/
  `run_smokes` wrapper) — whether a given ecosystem's runner is "trustworthy enough" to skip
  building one is a judgment call about that ecosystem's actual exit-code semantics, which no
  general lint in this repo can decide on a project's behalf ahead of time.

## Consequences

### Positive
- Closes the exact gap the Dorc review named: a test's own printed claim can no longer stand in
  for an actual runner verdict, at either the per-task (verifier) or per-project (first test
  task) scale.
- Reuses existing machinery rather than inventing new: the pre-resolved-test-command block
  (g9s3w), the fail-closed "no runner → FAIL" behavior it already carries, and the
  judgment-embedded-check shape ADR-0059/0061 already established.
- Names a concrete fallback (external runner script) for the one class of ecosystem where "just
  use the native runner" doesn't hold, instead of leaving that case to worker improvisation.

### Negative
- The verifier's judgment about "was this actually runner-verified" is still a judgment call, not
  a deterministic script — a careless verifier reading a worker's transcript uncritically could
  still be fooled, the same residual risk every judgment-embedded check in this project carries.
- Adds one more thing a first-test-task worker must do (steps 1-3 above) before writing
  ordinary red-green-refactor tests — a small one-time cost per project/ecosystem, paid once.

### Neutral
- Does not change `TESTS_ADDED`/`TESTS_PASSING`/`TDD_SKIPPED` field shapes in
  `references/worker-return-format.md` — only sharpens what `TESTS_PASSING: yes` must actually
  be backed by.
- Does not retroactively require existing test corpora to re-prove their runner is trustworthy —
  governs first-test-tasks and verifier checks from this point forward.

## Alternatives considered

- **Mechanize "is this a real runner verdict" as a lint that greps for exit-code checks in CI
  config.** Rejected: the thing being judged is what the verifier actually did in its own live
  Bash invocation, not a static property of any committed file — there is nothing for a lint to
  grep.
- **Require every project use `node --test` regardless of ecosystem.** Rejected: this project
  already supports polyglot BCs (dotnet, vitest, pytest, per `agents/verifier.md` check 2's
  existing discovery list); forcing one runner technology would contradict that and doesn't
  address the actual runner-less-ecosystem case (game engines, embedded) the Dorc review's A4
  finding was about.
- **Make the SmokeGuard/`run_smokes` wrapper the default for every project, not just the
  fallback.** Rejected: adds a mandatory wrapper layer even where the native runner is already
  trustworthy (`node --test`, `vitest`, `dotnet test`) — unnecessary indirection for the common
  case this project mostly lives in.

## References
- `agentic-workflow-g9s3w` — pre-loaded the test command into the verifier spawn; this ADR
  sharpens exactly its check 2 with the runner-verdict-only rule.
- ADR-0036 — the runtime-drive check's adjacent principle (observe actual behavior, don't trust
  the claim) applied one layer up, at the app-boot level rather than the test-execution level.
- ADR-0059 — mechanize-or-drop; this task's self-referential compliance section follows its
  judgment-vs-lint reasoning.
- ADR-0061 — falsifiability gate; runner-first composes with it by governing only the
  machine-checkable criteria a `[human-eye]` marker already excludes from runner evaluation.
- `agents/verifier.md` check 2, `skills/verification-before-completion/SKILL.md`, and
  `skills/test-driven-development/SKILL.md` (this task's implementation).
