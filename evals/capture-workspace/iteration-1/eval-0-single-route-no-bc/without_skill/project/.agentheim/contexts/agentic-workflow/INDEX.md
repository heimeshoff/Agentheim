# Agentic Workflow — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 1
- **Todo:** 1
- **Doing:** 0
- **Done:** 10
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
- **agentic-workflow-010** — Dashboard cross-OS verification: POSIX leg (spike) — `todo/agentic-workflow-010-dashboard-posix-cross-os-verification.md`
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **agentic-workflow-011** — /dashboard command — launch, stop, status, auto-open (feature) — `done/agentic-workflow-011-dashboard-slash-command.md`
- **agentic-workflow-001** — Dashboard — local web UI over the project's .agentheim folder (epic / integration gate; Windows v1) — `done/agentic-workflow-001-dashboard.md`
- **agentic-workflow-009** — Dashboard interactivity: SSE live-update consumer + Promote → applyTaskMove (feature) — `done/agentic-workflow-009-dashboard-live-update-and-promote.md`
- **agentic-workflow-008** — Dashboard navigation: discover and browse all .agentheim artifacts (feature) — `done/agentic-workflow-008-dashboard-navigation.md`
- **agentic-workflow-007** — Dashboard slide-over: universal detail panel + client-side markdown renderer (feature) — `done/agentic-workflow-007-dashboard-slide-over-renderer.md`
- **agentic-workflow-006** — Dashboard board view: flat Kanban (lifecycle columns, BC on the card) (feature) — `done/agentic-workflow-006-dashboard-board-view.md`
- **agentic-workflow-005** — Dashboard read API: /api/tree projection + /api/doc carrier (feature) — `done/agentic-workflow-005-dashboard-read-api.md`
- **agentic-workflow-003** — Extract applyTaskMove: one shared Task-lifecycle mover for skills and the dashboard (refactor) — `done/agentic-workflow-003-extract-apply-task-move.md`
- **agentic-workflow-004** — Dashboard server bootstrap: stdlib HTTP, detached launch/stop, project discovery (feature) — `done/agentic-workflow-004-dashboard-server-bootstrap.md`
- **agentic-workflow-002** — Decide dashboard write-semantics: legal Task moves, shared mover, concurrency (decision) — `done/agentic-workflow-002-dashboard-write-semantics.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **agentic-workflow-012** — Dashboard remembers the last board column scrolled to across reopens (feature) — `backlog/agentic-workflow-012-dashboard-remember-scroll-column.md`
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0001** — Dashboard write-semantics — Promote-only UI moves, one shared mover, optimistic concurrency (proposed) — `../../knowledge/decisions/0001-dashboard-write-semantics.md`
- **ADR-0004** — Detached dashboard server uses a neutral cwd and AGENTHEIM_ROOT, not the project dir (proposed) — `../../knowledge/decisions/0004-dashboard-detached-process-cwd.md`
- **ADR-0007** — applyTaskMove owns only the move; INDEX/protocol side-effects stay with skills (proposed) — `../../knowledge/decisions/0007-task-move-side-effect-boundary.md`
- **ADR-0009** — Dashboard frontend app lives in `dashboard/app/`, consumes the styleguide; build retargets to it (proposed) — `../../knowledge/decisions/0009-dashboard-frontend-app-shell.md`
- **ADR-0010** — The dashboard slide-over feeds the styleguide Drawer a doc-shaped item (accepted) — `../../knowledge/decisions/0010-slide-over-doc-shaped-item.md`
- **ADR-0011** — The dashboard library/navigation surface is the non-task half of the tree projection, grouped client-side (accepted) — `../../knowledge/decisions/0011-dashboard-library-groups-from-tree-locations.md`
- **ADR-0012** — applyTaskMove resolves slugged task filenames from a bare id; the SSE consumer re-fetches, never interprets (proposed) — `../../knowledge/decisions/0012-applytaskmove-resolves-slugged-filenames-by-bare-id.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->

## Pointers

- BC README (ubiquitous language, invariants): `README.md`
