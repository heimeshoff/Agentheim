---
id: agentic-workflow-hz9m3
title: Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval
status: backlog
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals, adr-0036]
related_adrs: [0036]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-y8b4q]
---

## Why

`agentic-workflow-v3h6p` built the `verifier-catch-rate` fixture set covering
checks 1 through 7 (+6b), but explicitly left check 8 (runtime drive,
ADR-0036, added same-day by `agentic-workflow-y8b4q`) unmeasured — it needs a
BC that declares a `## Runtime surface` manifest (`surfacePaths`, `launch`,
`stop`, `runfile`, `probes`) plus a `## Pre-resolved launch command` block in
the fixture's verifier-input tuple, which the synthetic `widgets` BC does not
have.

## What

Extend the `widgets` fixture BC (or add a second small fixture BC) with a
minimal `## Runtime surface` manifest and a tiny real HTTP server the
`launch`/`stop`/`probes` tuple can actually boot and drive (stdlib-only, per
`agents/verifier.md`'s check-8 spec). Build at least one planted-defect
fixture (e.g. a probe that returns the wrong status/shape, or a boot that
never produces a usable runfile) plus a clean pass, and real-spawn the
verifier against them (k >= 3) exactly as `v3h6p` did for checks 1-7.

## Acceptance criteria

- [ ] `widgets` (or a new fixture BC) gains a `## Runtime surface` manifest
      and a real, tiny, stdlib-only HTTP server fixture files can boot.
- [ ] At least one check-8 planted-defect fixture (boot failure or probe
      mismatch) plus a clean pass, each carrying the full tuple including
      `## Pre-resolved launch command`.
- [ ] Real verifier spawns (k >= 3) recorded, right-reason rate reported.
- [ ] `evals/verifier-catch-rate/README.md`'s "Known gaps" section is updated
      to reflect check 8 now being measured.
