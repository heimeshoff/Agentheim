---
id: agentic-workflow-v3h6p
title: Eval-harness the verifier — measure its catch rate against planted defects
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals, quality-gate]
related_adrs: []
related_research: []
prior_art: []
---

## Why

The verifier gate is the load-bearing quality mechanism — the vision's whole
premise is that wrong work is caught by structure, not luck — and it has zero
measured performance. The dashboard has ~60 test files; the agentic core has 4
prompts in `evals.json`. Nobody knows whether the verifier actually catches
planted defects. (Harness audit 2026-07-02, eval-coverage gap.)

## What

Build fixture diffs with known planted defects and measure the verifier's
verdicts against ground truth:

- a missing acceptance criterion (implemented N-1 of N)
- scope creep (changes beyond the task's What)
- vocabulary violation (code contradicting the BC's ubiquitous language)
- a genuinely correct diff (false-FAIL rate matters too)

## Acceptance criteria

- [ ] A repeatable eval fixture set with planted defects and expected verdicts exists under `evals/`.
- [ ] Catch rate and false-FAIL rate are measured and recorded (protocol or a report in `knowledge/`).
- [ ] Findings feed back: verifier prompt weaknesses discovered by the eval become follow-up captures.

## Notes

Spike: the deliverable is the measurement and what it teaches, not a polished
harness. Pairs with the model-routing task (agentic-workflow-j4m6r) — once the
verifier's model is pinned, the eval tells you whether opus-on-the-gate earns
its spend, and re-running it guards against routing regressions.
