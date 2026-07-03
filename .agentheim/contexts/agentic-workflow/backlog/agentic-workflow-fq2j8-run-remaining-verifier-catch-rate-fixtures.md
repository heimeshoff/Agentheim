---
id: agentic-workflow-fq2j8
title: Run the remaining verifier-catch-rate fixtures against the real verifier (stale-readme, missing-adr, contradicts-adr)
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-v3h6p]
---

## Why

`agentic-workflow-v3h6p` built the full 9-fixture `verifier-catch-rate` set
(`evals/verifier-catch-rate/fixtures/`) but only real-spawned the verifier
against 6 of them (missing-ac, tests-fail, scope-creep, vocab-violation,
index-tampering, clean) for spike time/spend reasons — 18 real runs, 100%
right-reason catch rate, 0% false-FAIL. `stale-readme`, `missing-adr`, and
`contradicts-adr` are fully built (task file, diff, worker-success,
expected.json) but have never been run against the real verifier.

## What

Spawn the real `verifier` agent (`agentheim:verifier`) against each of the
three remaining fixtures, k = 3 runs each, following the same prompt-assembly
runbook documented in `evals/verifier-catch-rate/README.md`. Record the
results (catch rate, right-reason vs lucky-catch, variance) alongside the
existing numbers in `evals/verifier-catch-rate/results/` and update
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md` (or a dated
follow-up report) with the completed full-surface numbers.

## Acceptance criteria

- [ ] `stale-readme`, `missing-adr`, `contradicts-adr` each run 3x against the
      real verifier; verdicts recorded.
- [ ] Catch rate / right-reason rate / variance reported for all 9 fixtures
      combined (not just the 6 measured in v3h6p).
- [ ] Any surprises (a fixture not behaving as its `expected.json` predicts,
      mirroring the `clean`-fixture correction found in v3h6p) are corrected
      and re-run before being counted.
