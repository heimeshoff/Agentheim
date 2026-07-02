---
id: agentic-workflow-r2c7m
title: Protocol rotation — cap protocol.md and roll to monthly files
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: [agentic-workflow-c8j3w]
tags: [harness-audit, protocol, observability, concurrency]
related_adrs: []
related_research: []
prior_art: []
---

## Why

`protocol.md` is a good diary but it's prose, prepend-only, ~5.7k lines,
unbounded — and every skill races to prepend at line 4. Concurrent sessions are
explicitly supported; this file is the collision point the scoped-add rule
doesn't cover. (Harness audit 2026-07-02, observability gap.)

## What

Cap the live `protocol.md` (~1,000 lines) and roll older entries to
`knowledge/protocol/2026-07.md`-style monthly files. Decide during refinement:
who rotates (a deterministic script — candidate for the
agentic-workflow-k5n8f script family — vs. skill prose), and whether a
machine-readable `runs/` JSONL should land beside it.

## Acceptance criteria

- [ ] `protocol.md` stays under the cap; older entries live in dated rollover files under `knowledge/protocol/`.
- [ ] Skills' "read the first ~100 lines" pattern still yields recent activity unchanged.
- [ ] Rotation is deterministic (scripted or precisely specified), not ad-hoc summarization — entries are moved verbatim, never rewritten.
- [ ] The indexes/pointers that reference `protocol.md` mention the rollover location.

## Notes

Rotation also shrinks the line-4 prepend collision window between concurrent
sessions, but doesn't eliminate it — if the k5n8f scripts land first, the
prepend itself becomes atomic and this task simplifies to pure rotation.
