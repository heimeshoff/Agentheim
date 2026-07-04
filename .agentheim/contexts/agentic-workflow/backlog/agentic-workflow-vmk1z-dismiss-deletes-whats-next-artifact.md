---
id: agentic-workflow-vmk1z
title: Dismissing the What's next panel deletes its advisory artifact
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [dashboard, whats-next, advisory-write, frontend]
related_adrs: [0027, 0017]
related_research: []
prior_art: [agentic-workflow-073, agentic-workflow-076]
---

## Why
The `whats-next` recommendation (`.agentheim/state/whats-next.md`) goes stale fast — the
board changes and yesterday's recommended move is no longer the right one. Today the panel's
**dismiss** is only a client-side `localStorage` hide keyed by the artifact's `generated`
stamp (aw-073): the file stays on disk, so the stale recommendation lingers and re-surfaces
in other browsers / after a store reset. The builder wants dismiss to actually **remove the
stale thing** — press dismiss, the recommendation is gone, not just hidden.

## What
When the builder dismisses the What's next panel on the dashboard, the underlying advisory
artifact `.agentheim/state/whats-next.md` is deleted (not merely suppressed in `localStorage`),
so a dismissed recommendation is genuinely gone until `whats-next` next runs and writes a
fresh one.

## Decision gate (must be settled in REFINE before this can be worked)
This reopens a **deliberately frozen boundary** and therefore cannot go straight to `todo/`:

- **ADR-0027 §4 guard-rail 5** states, verbatim: *"The dashboard is read-only over it too. The
  dashboard reads and renders it; it never writes, edits, **or deletes it**. Only `whats-next`
  writes it."* Delete-on-dismiss contradicts this.
- **ADR-0017** removed every dashboard write path — the server exposes only reads
  (`/api/tree`, `/api/doc`, SSE, `/healthz`). A dismiss-delete needs a *new* write endpoint.

Two honest directions for the architect to settle (do **not** pre-decide here):

- **A — narrow "advisory delete" write path.** Amend ADR-0027 §4.5 and ADR-0017's read-only
  stance (which is really *read-only over lifecycle*) to permit the dashboard to delete
  advisory artifacts under `state/` **only** — never lifecycle files. New tightly-scoped
  endpoint (e.g. `DELETE`/`POST /api/whats-next/dismiss`) guarded to the single advisory path.
  Delivers exactly what the builder asked for; likely splits into a `decision` task (the ADR
  amendment) that this feature depends on, plus the server + client work.
- **B — kill the staleness without a dashboard write.** Keep both ADRs intact: e.g. the panel
  auto-hides past a staleness threshold, or `whats-next` / `work` clears its own stale artifact
  at session boundaries. Doesn't literally delete-on-dismiss, but may fully address the
  stale-file pain. Lower architectural cost, but weaker on the "dismiss = gone now" intent.

## Acceptance criteria
_(provisional — will firm up once the direction above is chosen)_
- [ ] The chosen direction is ratified in an ADR (amending ADR-0027 §4.5 / ADR-0017 if
      direction A, or documenting why no write path is added if direction B).
- [ ] Dismissing the panel removes the stale recommendation so it does not re-surface (in this
      or another browser / after a `localStorage` reset).
- [ ] If a write path is added (A): it is scoped to `.agentheim/state/whats-next.md` **only**,
      guarded by the same in-root check every read uses, and cannot touch lifecycle files.
- [ ] The panel disappears live over the existing SSE consumer (ADR-0006) once the artifact is
      gone; absent artifact still renders nothing (aw-073 contract preserved).
- [ ] Pure helpers unit-tested under `node --test`; dashboard `dist/` rebuilt; suite green.

## Notes
Directly modifies shipped behavior from **aw-073** (the dismissible panel) and reads the
artifact **aw-076** writes. Refinement should route through the **architect** (via the
orchestrator) to settle A vs B; direction A almost certainly splits off a `type: decision`
task for the ADR amendment that this feature then `depends_on`. Left in `backlog/`
deliberately — it is decision-gated and not workable as-is.
