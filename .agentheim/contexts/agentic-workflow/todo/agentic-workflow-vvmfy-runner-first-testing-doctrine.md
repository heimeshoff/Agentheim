---
id: agentic-workflow-vvmfy
title: Runner-first testing — the verifier only trusts an external runner's verdict, never a test's own printed green
status: todo
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [doctrine, tdd, verifier, testing, dorc-review]
related_adrs: [0036]
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

- [ ] `skills/verification-before-completion/SKILL.md` + `agents/verifier.md`: verdicts
      only from the runner; printed-green-without-runner-verdict is treated as
      unverified, never as PASS evidence.
- [ ] `skills/test-driven-development/SKILL.md`: runner-first rule for a project's first
      test; fallback external-runner pattern named for runner-less ecosystems.
- [ ] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A4, generalized: the SmokeGuard
template is the *fallback* for exit-code-unreliable ecosystems, not a requirement for
stacks whose runner is already trustworthy. ADR-0036's runtime-drive check is adjacent
(observed behavior over claimed behavior) — same spirit, different layer.
