---
id: infrastructure-007
title: Throttle the dashboard file-watcher so a burst of tree changes (e.g. a large git checkout) collapses into few tree-changed events
status: backlog
type: feature
context: infrastructure
created: 2026-06-08
depends_on: [infrastructure-003]
blocks: []
tags: [dashboard, sse, file-watcher, live-update, throttle, debounce, performance]
related_adrs: [ADR-0006]
related_research: []
prior_art: [infrastructure-003]
---

## Why

The live-update transport (infrastructure-003 / ADR-0006) backs the `GET /api/events` SSE
stream with an `.agentheim/` file-watcher (`node:fs.watch` recursive + debounced poll
fallback). A single bulk filesystem operation — a large `git checkout`, a branch switch, a
`git stash pop` — touches hundreds or thousands of files at once. Today that can fan out into
a flood of `tree-changed` pointers, each waking every open board to re-fetch `/api/tree` and
re-project. The transport already debounces, but a big checkout can still produce a thundering
herd of events / redundant re-fetches.

## What

Coalesce a burst of watcher signals into at most one (or a small number of) `tree-changed`
pointer(s) over a short window, so a thousand near-simultaneous file changes don't fire a
thousand events. Stays transport-only — the watcher still emits raw "something changed"
pointers; it just emits *fewer* of them. The board's re-fetch is already idempotent
(agentic-workflow-009), so collapsing a burst into one pointer loses no correctness, only
redundant work.

## Acceptance criteria

- [ ] A bulk filesystem operation touching many files under `.agentheim/` (simulate a large
      `git checkout` / mass file move) results in at most a small, bounded number of
      `tree-changed` SSE frames, not one-per-file.
- [ ] A single isolated change still propagates promptly (the throttle window is short enough
      that normal skill-driven moves feel near-real-time).
- [ ] The watcher stays transport-only — no interpretation of *what* changed; it only emits
      fewer raw pointers.
- [ ] Behaviour holds for both the `node:fs.watch` recursive path and the debounced
      stat-poll fallback (Linux / network-drive cases).

## Notes

- Captured 2026-06-08 from the builder: "throttle the dashboard's file-watcher so a huge git
  checkout doesn't fire a thousand tree-changed events at once."
- Routed to **infrastructure**: the file-watcher and the `tree-changed` SSE channel are this
  BC's transport (infrastructure-003, ADR-0006). One-line test — *if the dashboard were
  strictly read-only, would this concern still exist?* Yes (the watcher fires on any disk
  change regardless of UI writes) → infrastructure, not agentic-workflow.
- The existing debounce is per-change; this is about leading/trailing throttle (or burst
  coalescing) across a window so a single bulk op collapses to ~one pointer. Refine the exact
  window / leading-vs-trailing semantics before promoting to `todo`.
</content>
</invoke>
