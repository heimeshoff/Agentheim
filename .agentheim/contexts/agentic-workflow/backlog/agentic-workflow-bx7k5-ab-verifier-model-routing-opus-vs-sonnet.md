---
id: agentic-workflow-bx7k5
title: A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals, model-routing]
related_adrs: [0031]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-j4m6r]
---

## Why

ADR-0031 pins the `verifier` to `opus` on the theory that the adversarial gate
needs a stronger model than the `sonnet`-pinned `worker` it audits. Now that
`agentic-workflow-v3h6p` has produced a real baseline (18 real spawns, 100%
right-reason catch rate, 0% false-FAIL against `opus`), the fixture set can
directly answer "does opus-on-the-gate earn its spend?" by re-running the
same fixtures with the verifier's `model:` field temporarily set to `sonnet`
and comparing catch rate / right-reason rate / false-FAIL rate.

## What

Re-run the `verifier-catch-rate` fixture set (same k >= 3 per fixture) with
`agents/verifier.md`'s `model:` frontmatter field changed to `sonnet` for the
duration of the experiment, using the exact same prompts recorded in
`evals/verifier-catch-rate/README.md`. Compare against the `opus` baseline in
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md`. Revert the
`model:` field to `opus` afterward — this is a measurement task, not a
routing change; any resulting routing change is a separate ADR.

## Acceptance criteria

- [ ] Full fixture set (or the same load-bearing subset `v3h6p` measured) run
      against a `sonnet`-pinned verifier, k >= 3 per fixture.
- [ ] Catch rate / right-reason rate / false-FAIL rate compared side-by-side
      with the `opus` baseline in a follow-up report.
- [ ] `agents/verifier.md`'s `model:` field is restored to `opus` before the
      task completes (or a new ADR is written if the A/B result argues for a
      change, superseding ADR-0031).
