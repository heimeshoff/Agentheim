---
id: agentic-workflow-vvmfy
title: Runner-first testing — the verifier only trusts an external runner's verdict, never a test's own printed green
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [doctrine, tdd, verifier, testing, dorc-review]
related_adrs: [0036, 0062]
related_research: []
prior_art: [agentic-workflow-g9s3w, agentic-workflow-y8b4q]
---

## Why

Dorc review recommendation A4: 155 smoke tests accumulated before anything ran them
together; 23% were bad on the first honest run, and workers/verifiers had been trusting
each test's self-printed green. In mainstream stacks the runner exists on day one
(dotnet test, vitest, `node --test`) — the failure mode is acute in ecosystems where
scripts print their own verdicts and exit codes lie (game engines, embedded).

## What

Doctrine in two places:

1. **Verifier**: a test verdict comes only from the project's runner (the test command
   pre-loaded into the verifier spawn, g9s3w) — its exit status / structured report. A
   test's own printed "PASS" without a runner verdict is *unverified*, and the verifier
   says so.
2. **TDD skill**: the first test task in any project must establish the runner and its
   verdict convention before the test corpus grows. For ecosystems without a trustworthy
   runner, the doctrine names the fallback pattern: an external runner script that owns
   the verdict (Dorc's `run_smokes` + SmokeGuard shape), built as part of that first
   test task.

## Acceptance criteria

- [x] `skills/verification-before-completion/SKILL.md` + `agents/verifier.md`: verdicts
      only from the runner; printed-green-without-runner-verdict is treated as
      unverified, never as PASS evidence.
- [x] `skills/test-driven-development/SKILL.md`: runner-first rule for a project's first
      test; fallback external-runner pattern named for runner-less ecosystems.
- [x] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A4, generalized: the SmokeGuard
template is the *fallback* for exit-code-unreliable ecosystems, not a requirement for
stacks whose runner is already trustworthy. ADR-0036's runtime-drive check is adjacent
(observed behavior over claimed behavior) — same spirit, different layer.

Doctrine recorded in ADR-0062 (`.agentheim/knowledge/decisions/0062-runner-first-testing-verdicts-only-from-the-runner.md`).
Per ADR-0059 (mechanize-or-drop): this task establishes a convention and ships **no new
`lib/` lint** — the ADR's "Self-referential compliance" section explains why prose-only
judgment (the sharpened `agents/verifier.md` check 2) is the mechanize-or-drop-compliant
choice here: the predicate ("was this printed PASS actually backed by a runner
invocation the verifier itself just ran and checked?") reads live Bash execution output,
not committed source, so no lint has anything to grep. The "first test task must
establish a runner" half is separately covered by pre-existing mechanized enforcement
(check 2's fail-closed "no test command discoverable → FAIL", from `agentic-workflow-g9s3w`).

## Outcome

Sharpened the verifier's test-execution check (`agents/verifier.md` check 2, mirrored in
`skills/verification-before-completion/SKILL.md`) so a test verdict comes only from the
project's runner — its exit status or structured report — never a test's own printed
"PASS"; a printed-green with no runner actually invoked and checked is unverified and
FAILs the check. Added a "Runner-first" section to
`skills/test-driven-development/SKILL.md` requiring a project's (or a mixed-stack
project's ecosystem's) first test-bearing task to establish the runner and prove it
fails on a failure, naming the external-runner fallback (Dorc's `run_smokes` +
SmokeGuard shape) for ecosystems with no trustworthy native runner. Recorded the
doctrine in ADR-0062 and added a matching "Runner-first testing" glossary entry to the
BC README's Ubiquitous language section. No code/behavior change — pure doctrine/prose
edits to skill and agent definitions — so TDD does not apply (pure documentation task);
`node --test lib/test/*.test.mjs` (263 tests) still passes unaffected, confirming no
regression.

Files touched: `agents/verifier.md`, `skills/verification-before-completion/SKILL.md`,
`skills/test-driven-development/SKILL.md`,
`.agentheim/knowledge/decisions/0062-runner-first-testing-verdicts-only-from-the-runner.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
