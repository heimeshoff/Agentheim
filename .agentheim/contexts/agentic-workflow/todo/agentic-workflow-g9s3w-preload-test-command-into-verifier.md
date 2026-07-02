---
id: agentic-workflow-g9s3w
title: Pre-load the test command into the verifier spawn prompt
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
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

- [ ] The verifier spawn prompt in `work/SKILL.md` carries a pre-resolved test command block.
- [ ] `agents/verifier.md` check 2 uses the supplied command first, its own discovery only as fallback.
- [ ] The fail-closed behavior (FAIL when no command exists anywhere) is preserved.
- [ ] Re-dispatch iterations reuse the resolved command — no per-iteration re-discovery.
