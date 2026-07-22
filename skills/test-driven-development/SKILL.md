---
name: test-driven-development
description: Use whenever a worker is about to implement a task with observable behavior — features, bug fixes, refactors that should preserve behavior, any change with acceptance criteria you could turn into an assertion. Triggers internally from the `worker` agent at the start of its third action ("do the work"), and externally when the user invokes it explicitly ("do this TDD-style", "red-green-refactor this task"). Doctrine document; readable by humans and consumed by the worker as its execution discipline.
---

# Test-Driven Development — Red, Green, Refactor

TDD is the worker's default discipline. The worker writes a failing test that encodes one acceptance criterion, makes it pass with the minimum code, then refactors. Repeat per criterion until the task is done. This skill is doctrine — what TDD means in this repo, when it applies, when it doesn't, and what evidence the worker must report.

## Why TDD here

The agentheim workflow already has a strong gate after the worker returns (`verification-before-completion`). The verifier reads the diff against acceptance criteria with fresh context. Without TDD, the worker can produce code that *looks* like it satisfies the criteria but doesn't actually do so under any executed assertion — and the verifier has to re-derive the test space from scratch. With TDD, the verifier can confirm "the tests exist, they assert the criteria, they pass" and spend its energy on the harder question of "are these the right tests".

TDD also fixes the most common failure mode of LLM-generated code on domain-rich projects: plausibly-shaped but behaviorally wrong. A failing test before a single line of production code anchors the worker to *observable behavior*, not to "code that looks reasonable".

## The three laws

1. **Do not write production code until a failing test demands it.**
2. **Do not write more of a failing test than is sufficient to fail.** (Compilation failure counts.)
3. **Do not write more production code than is sufficient to pass the currently failing test.**

The third law is the one workers most often violate by writing six methods when the test demanded one. Resist.

## Red, Green, Refactor — the loop per acceptance criterion

For each acceptance criterion in the task file:

1. **Red** — write a test that asserts the criterion. Run it. Confirm it fails *for the right reason* (the assertion fails, not that the test file doesn't compile or the module isn't found). A "red" that's actually a setup error is worthless — it doesn't prove the test will detect the absence of the behavior.

2. **Green** — write the minimum production code that makes the test pass. Not the right code, not the elegant code — the minimum. If hardcoding the expected return value passes the test, that's a sign the test under-specifies; write a second test that forces real logic, then implement.

3. **Refactor** — with the test green, improve the code's structure without changing behavior. Run the test after each refactor step. If refactoring breaks the test, revert immediately — the refactor was incorrect or the test was specifying implementation rather than behavior.

Then move to the next criterion. Repeat until every checkbox in the Acceptance criteria section corresponds to at least one passing test that would fail without the implementation.

## What counts as a test

- An executable assertion in the project's test framework (xUnit, Jest, pytest, RSpec, Go test, etc.)
- An integration test that exercises a real boundary (database, API, message queue) when the criterion is about that boundary
- A property-based test when the criterion describes an invariant over a range of inputs

What does NOT count:
- A type signature (types are not assertions about runtime behavior)
- A docstring example that isn't executed
- "I ran the code manually and it looked right"
- A test that asserts the implementation's internal calls (e.g., "method X was called with Y") when the criterion is about externally observable behavior

## Runner-first — a project's first test task establishes the verdict source (ADR-0062)

Dorc's July-2026 review found the corpus-scale version of a trust failure: 155 smoke tests
accumulated before anything ran them together, and 23% were bad on the first honest run —
workers and verifiers had been trusting each test's own printed "PASS," not an actual runner's
verdict. `verification-before-completion`'s check 2 closes that gap per-task going forward
(the verifier now runs the tests itself and trusts only the runner's exit status/structured
report, never a printed claim) — but that check needs a runner to exist and to be trustworthy
*from the first test task on*, or every later verification inherits the same rot.

So: **the first test-bearing task in a project — or the first test-bearing task for a given
ecosystem within a mixed-stack project (e.g., the first shader test in an otherwise-JS repo) —
must establish the runner and its verdict convention before the test corpus grows**, as part of
that task, not as a separate follow-up:

1. Identify (or wire up) a runner whose exit status, or a structured report it emits (TAP,
   JUnit XML, a summary line), reliably reflects whether the tests it ran actually passed —
   not a runner that always exits 0 regardless of outcome.
2. Record the exact invocation somewhere `work`'s pre-resolved-test-command step
   (`agentic-workflow-g9s3w`) can find it — typically the BC README. This is the string that
   becomes every subsequent verifier spawn's `## Pre-resolved test command` block; get it right
   once and every later task's verification reuses it for free.
3. Prove the runner actually fails on a failure: deliberately break the first test, run the
   runner, confirm it reports failure (non-zero exit / a FAILED line in its structured report),
   then fix the test back to green. A runner that stays green when the test is broken is not a
   runner — it's decoration, and no amount of later test-writing fixes that.

### Fallback for runner-less ecosystems: the external-runner pattern

Some ecosystems have no trustworthy runner out of the box — game engines, embedded targets,
anything where "run the test" means "load it in a process that exits 0 no matter what happened
inside." For those, step 1 above is not "find a runner," it's "build one": an external runner
script that owns the verdict, independent of any individual test's own exit behavior. The
reference shape is Dorc's own `run_smokes` + SmokeGuard pattern — a wrapper that:

- Invokes each test/smoke and captures its *actual* pass/fail signal through a channel that
  isn't the untrustworthy exit code — a sentinel line in stdout, a written result file, a
  structured log the wrapper parses.
- Aggregates every result into one machine-parseable summary (count run / count passed / count
  failed) and exits non-zero itself iff anything failed.
- Becomes the thing check 2 actually invokes and trusts. The individual tests underneath can
  still print their own "PASS" for a human skimming the log — that's fine, it's decoration —
  but it is the wrapper's aggregate exit status that is the verdict, never a test's line in
  isolation.

This is a fallback, not the default. Most ecosystems this project touches (`node --test`,
standard JS/TS toolchains) already ship a trustworthy runner — use it directly via the
Pre-resolved test command convention. Build the external-runner wrapper only once the native
runner is *proven* untrustworthy (step 3 above is exactly that proof), not preemptively.

## When TDD does not apply

A small set of tasks legitimately skip TDD. The worker must explicitly note the reason in its return when it does.

- **`type: decision` tasks** — the deliverable is an ADR, not code. No tests.
- **`type: spike` tasks** — exploration with explicit throwaway intent. The worker should still write a smoke test for the walking-skeleton spike, but feature spikes can skip.
- **Pure config / data migration tasks** where the assertion is "the config validates and the app boots" — a single integration check covers it; no per-criterion unit tests needed.
- **Pure documentation tasks** — no executable behavior to test.
- **UI tasks where the project has no UI testing infrastructure** — the worker should call this out as a backlog item (add UI test infra) rather than silently skip, and exercise the change manually in the browser as a substitute.

If the worker thinks TDD doesn't apply for any other reason, that's a signal to bounce the task back as under-refined — the acceptance criteria probably aren't testable as written.

## TDD against a bounded context's ubiquitous language

Tests are also a place where ubiquitous language lives. A test named `it_rejects_a_reservation_that_overlaps_an_existing_one` is worth ten tests named `test_reservation_validation_3`. The worker should name tests using the BC README's terms — and if the right term isn't in the README, that's evidence the README needs an update (do it before writing the test, not after).

## What the worker must report

When TDD applies and the worker returns `RESULT: SUCCESS`, the strict return format includes:

- `TESTS_ADDED: <integer>` — count of new tests written for this task
- `TESTS_PASSING: yes | no` — per the definition in `references/worker-return-format.md` (ADR-0062:
  the runner's own verdict, never inferred from a test printing its own success message)
- `TDD_SKIPPED: <reason or "no">` — when TDD legitimately did not apply (per the list above), which reason; otherwise `no`

If `TESTS_PASSING: no`, the worker must not return SUCCESS — that's either a FAIL (the worker couldn't get tests green) or a BOUNCE (the task as specified can't be satisfied). Returning SUCCESS with failing tests is a protocol violation.

## Anti-patterns

- **Writing tests after the code.** The whole point is that the test drives the design. After-the-fact tests tend to assert what the code happens to do, not what the spec requires.
- **Asserting implementation details.** "The repository was called with these arguments" couples the test to the code's structure. Test the externally observable behavior — what the caller sees.
- **Over-mocking.** Mocks that stub out half the system produce tests that pass while the real integration is broken. Prefer real collaborators (in-memory database, real value objects) for unit tests; reserve mocks for genuinely external systems.
- **One mega-test per task.** Splitting acceptance criteria into separate tests keeps failures localized and the suite diagnostic.
- **Skipping refactor.** The third step is the one that compounds — without it, the codebase degrades even with good test coverage.

## Interaction with verification-before-completion

This skill is upstream of the verification gate. A worker that follows TDD produces a diff the verifier can sign off on cheaply. A worker that skips TDD forces the verifier to derive the entire test space — slower, less reliable, and often results in verification failure that re-dispatches the task back to a worker who then has to write the tests anyway. Do TDD first.
