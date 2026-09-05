---
id: agentic-workflow-pt0gy
title: Concurrent modeling sessions collide on protocol.md, INDEX.md, and the git index — make capture-side bookkeeping conflict-free
status: backlog
type: feature
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-e4bjh]
blocks: []
tags: [captured, concurrency, bookkeeping, mechanization, rework]
related_adrs: [0026, 0038, 0039, 0054, 0022]
related_research: []
prior_art: [agentic-workflow-k5n8f, agentic-workflow-r2c7m, agentic-workflow-wq7fn]
---

## Why

The builder runs **one** `work` session but **several `modeling` sessions in parallel**, and
they conflict. Every modeling action prepends to the same line of `protocol.md`, edits the
same `task-counts` block and marker lists in the BC `INDEX.md`, and commits on the same
`main` — so two sessions capturing at the same moment race on the file edit itself, on the
count arithmetic, and on `.git/index.lock`. ADR-0026 §5's scoped-add rule keeps one session
from *sweeping in* another's files, but it does nothing about two sessions editing the same
hot spot in the same file.

This is the narrower, evidence-based re-capture of what `agentic-workflow-d5a9b` (dismissed
2026-09-05) gestured at. d5a9b proposed worktree-local backlogs and ticket migration between
worktrees; the actual pain is simpler — the *bookkeeping surfaces* are single-writer files
being written by multiple writers.

## What

Make the capture-side bookkeeping safe under N concurrent modeling sessions. Candidate
shapes, to be decided in REFINE (an ADR either way):

1. **Event-per-action, read models generated.** Each CAPTURE / REFINE / PROMOTE / DISMISS
   writes one small, uniquely-named event file (e.g.
   `.agentheim/knowledge/protocol/events/<ts>-<task-id>-<verb>.md`); `protocol.md` and the
   INDEX marker lists + counts become read models regenerated from the task files and the
   event files (by the lifecycle CLI, at every verb, idempotently). Two writers never touch
   the same file; the generated files are deterministic from disk state, so a stale
   regeneration is self-healing on the next verb. Aligns with the rework's EventLog /
   ReadModel ports (anatomy page §10) and with ADR-0054's compute-then-write discipline.
2. **Serialize at the CLI.** The lifecycle verbs take an advisory lock (`.agentheim/.lock`
   with pid + heartbeat, reaped on staleness like the dashboard runfile) around
   compute → write, and the skill's scoped commit retries on `index.lock`. Small, but keeps
   the hot spots and only narrows the window.
3. **Per-session protocol shards** merged at rotation (ADR-0039) — protocol-only, leaves INDEX
   counts unsolved.

`depends_on: agentic-workflow-e4bjh` because the capture and dismiss verbs must be mechanized
before any of these shapes has a single seam to land in; hand-edited markers cannot be made
atomic.

## Acceptance criteria

- [ ] Two modeling sessions capturing into the same BC within the same second both succeed, both tasks are listed in the INDEX backlog list, the Backlog count equals the number of files in `backlog/`, and both protocol entries are present (test fixture, `node --test`).
- [ ] No modeling action can leave INDEX counts disagreeing with the lifecycle folders after a concurrent action — either by construction (regenerated) or by a verified serialization.
- [ ] A modeling session's scoped commit does not fail terminally on a transient `.git/index.lock` held by a sibling session — bounded retry with a clear message on exhaustion.
- [ ] An ADR records the chosen shape and its relationship to ADR-0026 §5, ADR-0038, ADR-0039, and ADR-0054.
- [ ] Sibling task `agentic-workflow-ghcaj` (worker-side) and this task together leave `main` with exactly one class of writer per bookkeeping file — documented in the agentic-workflow README's git-model entry.

## Notes

Captured via `modeling` on 2026-09-05, same conversation as `agentic-workflow-ghcaj`.
Questions for REFINE: does the dashboard (read-only, ADR-0017) read the generated protocol /
INDEX or the events directly? What does `rotateProtocol` (ADR-0039/0045) rotate when the
protocol is generated? Is `whats-next` (ADR-0027) a consumer of the event stream? Where does
`quick-capture` land — it is the most likely session to run concurrently with everything.
