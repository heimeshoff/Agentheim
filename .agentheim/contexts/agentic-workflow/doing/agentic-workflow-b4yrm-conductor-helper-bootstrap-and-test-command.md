---
id: agentic-workflow-b4yrm
title: Conductor lib helpers have no runnable invocation in consumer installs; lib's own test command is undeclared
status: doing
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, consumer-install, bootstrap, mechanization]
related_adrs: [0038, 0058, 0064, 0066, 0063]
related_research: []
prior_art: [agentic-workflow-hmgav, agentic-workflow-qz1h7, agentic-workflow-hhjjx, agentic-workflow-hvqa4]
---

## Why

The established pattern for conductor-executed mechanizations is a plugin-cache-resolving
`node -e` bootstrap one-liner in skill prose (promote/complete/rotations — e.g.
`skills/work/SKILL.md:277,592,626`, `skills/modeling/SKILL.md:224`, via
`lib/resolve-plugin-file.mjs`'s homedir→cache→semver-max convention from infrastructure-010).
The four new conductor-executed helpers — `adr-allocation.mjs`, `session-start-churn.mjs`,
`vacuum-guard.mjs`, `worktree-salvage.mjs` — are referenced only by function name. In a
consumer project (Agentheim installed as a plugin), `lib/` is not at cwd and the conductor
must improvise module resolution — the vacuum guard and batch-mix line, built to stop
cyclic meta-work in consumer projects, may simply not run where they're needed most.

Second gap in the same enforcement chain: the three live-tree lints fire only via
`node --test lib/test/*.test.mjs`, but no BC README declares that command — a verifier on a
`lib/`-touching task finds no test command in its discovery order and fail-closes
(`agents/verifier.md:100`). Node 25 additionally requires the explicit glob form.

## What

1. For each of the four helpers, add the standard bootstrap invocation (or a shared
   documented pattern) at its call site in skill prose — work's churn step, vacuum-guard
   steps in work and modeling, the batch-mix step, the ADR-finalization step, and the
   salvage path-computation step — so a conductor in a consumer install can actually run
   them. Reuse the existing `resolve-plugin-file.mjs` convention; do not invent a new one.
2. Declare `node --test lib/test/*.test.mjs` as the lib test command in the
   agentic-workflow BC README's Key-commands section (machine-discoverable by the
   verifier's discovery order).
3. Record in ADR prose (amend or note on ADR-0059's context) that the three live-tree
   lints enforce only in the self-hosting repo — consumer projects get prose-only
   conventions. That scoping is acceptable but must be a visible decision.

## Acceptance criteria

- [ ] Every skill step that tells the conductor to call a function from the four helper modules carries (or points at) a runnable bootstrap invocation following the resolve-plugin-file convention.
- [ ] The agentic-workflow BC README declares the lib test command in a section the verifier's discovery order reads.
- [ ] The self-hosting-only scope of the live-tree lints is recorded in an ADR (new, or a noted amendment), per mechanize-or-drop's visible-decision rule.
- [ ] `node --test lib/test/*.test.mjs` green.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings G1 + G2 + G3). The audit
confirmed none of the seven new modules is an orphan — this is purely about making the
documented call sites executable outside this repo.
