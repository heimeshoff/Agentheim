---
id: agentic-workflow-g9s3w
title: Pre-load the test command into the verifier spawn prompt
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: []
tags: [harness-audit, verifier, work-skill, context-engineering]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Workers receive pre-loaded ADR blocks, prior-art excerpts, and a protocol
excerpt — but the verifier re-discovers the project's test command from scratch
on **every iteration** (`agents/verifier.md:49-53`: hunt through `package.json`,
`Makefile`, `pyproject.toml`, `*.csproj`…). An inconsistency inside the
harness's strongest mechanism, paid once per verification iteration. (Harness
audit 2026-07-02, ⊕ finding from the Opus cross-check.)

## What

Have the `work` skill resolve the test command once per batch (or per BC) and
include it in the verifier spawn prompt, exactly as workers get ADRs. The
verifier keeps its current discovery procedure only as the fallback when no
command was supplied, and keeps its fail-closed "no test command discoverable"
FAIL.

## Acceptance criteria

- [x] The verifier spawn prompt in `work/SKILL.md` carries a pre-resolved test command block.
- [x] `agents/verifier.md` check 2 uses the supplied command first, its own discovery only as fallback.
- [x] The fail-closed behavior (FAIL when no command exists anywhere) is preserved.
- [x] Re-dispatch iterations reuse the resolved command — no per-iteration re-discovery.

## Outcome

Pre-loading the test command into the verifier spawn prompt now mirrors how
workers receive pre-loaded ADRs — resolve once, hand it forward.

- `skills/work/SKILL.md` — the **Verifier dispatch** section gained an
  instruction to resolve the test command once per batch (per BC), cache it, and
  reuse it across every verifier spawn including FAIL-iteration re-dispatches;
  the **Verifier Prompt Template** gained a `## Pre-resolved test command` block
  carrying the resolved string (or `none`).
- `agents/verifier.md` — the "What you are given" input list documents the new
  block, and **check 2 (Test execution)** now uses the supplied command first,
  falling back to its existing discovery procedure only when the block reads
  `none`/is absent. The fail-closed FAIL (no command supplied AND none
  discoverable) is preserved as the final step.

No ADR — this implements an already-decided harness-audit finding; no new
decision was made. No behavior change to code, so no test infra applies (prose
skill/agent definitions).
