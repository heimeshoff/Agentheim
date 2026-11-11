---
id: ADR-0084
title: Context-map diagram is authored, not derived — prose wins, only the modeler edits the fence
scope: agentic-workflow
status: accepted
date: 2026-11-03
related_tasks: [agentic-workflow-dd8yn]
related_adrs: [0059, 0068]
---

# ADR-0084: Context-map diagram is authored, not derived — prose wins, only the modeler edits the fence

## Context

`context-map.md` states cross-context relationships in prose. Task agentic-workflow-dd8yn adds a mermaid `## Diagram` to make them visible at a glance. A diagram generated from the prose would need a parser for free-form relationship text. A hand-authored diagram can drift from the prose. design-system-kw15t will render the fence downstream.

## Decision

1. The diagram is authored, not derived. No generator is built.
2. The prose relationships stay the source of truth. When the diagram and the prose disagree, the prose wins and the diagram is the defect.
3. Only the strategic-modeler and brainstorm edit the fence. Workers never do, and a worker `README_DELTA` against `context-map.md` stays append-only.
4. A missing or stale diagram is backfilled when the map is next touched, not in a dedicated sweep.
5. The notation is fixed in `references/context-map-notation.md`. `lib/context-map-notation-lint.mjs` mechanizes that notation against the live tree (ADR-0059, mechanize-or-drop). The notation is stated once there and pointered from elsewhere (ADR-0068).

## Consequences

- No prose parser to maintain.
- Drift is possible but bounded: prose wins, and the lint catches malformed notation.
- design-system-kw15t can render the fence as authored, without deriving anything.

## Note on ADR numbering

Minted provisionally as ADR-0083 in its worker worktree. A sibling task's ADR already claimed that number (or the guess overshot the true count) by the time this task's conductor finalized numbering at squash-merge integration (`lib/adr-allocation.mjs`'s `finalizeAdrNumbering`, ADR-0058) — this ADR was renumbered to **ADR-0084**, the true next-free number on `main` at that moment. No content besides this identity changed.
