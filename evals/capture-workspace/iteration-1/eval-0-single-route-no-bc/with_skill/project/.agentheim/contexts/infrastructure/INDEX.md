# Infrastructure — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 1
- **Todo:** 0
- **Doing:** 0
- **Done:** 5
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **infrastructure-005** — Bump plugin version to 0.8.0 to unblock marketplace updates (chore) — `done/infrastructure-005-bump-plugin-version-0-8-0.md`
- **infrastructure-004** — Resolve dashboard assetRoot relative to the module, not the project root (bug) — `done/infrastructure-004-dashboard-assetroot-module-relative.md`
- **infrastructure-002** — Bundle the styleguide ESM source into the dashboard's committed static assets (esbuild → committed dist/) (chore) — `done/infrastructure-002-pre-bundle-dashboard-assets.md`
- **infrastructure-003** — Dashboard live-update transport: SSE endpoint + .agentheim file-watcher (supersedes ADR-0002 req/resp-only) (decision) — `done/infrastructure-003-dashboard-live-update-sse.md`
- **infrastructure-001** — Dashboard runtime: Node static+JSON transport, launch/stop, project discovery (decision) — `done/infrastructure-001-dashboard-runtime-transport.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **infrastructure-006** — Plugin release discipline — stop the manifest version from silently drifting (decision) — `backlog/infrastructure-006-plugin-release-version-discipline.md`
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0002** — Dashboard runtime — Node-stdlib localhost transport with detached launch (proposed; superseded-in-part by ADR-0006) — `../../knowledge/decisions/0002-dashboard-runtime-transport.md`
- **ADR-0006** — Dashboard live-update — SSE push + .agentheim/ file-watcher (proposed; supersedes-in-part ADR-0002) — `../../knowledge/decisions/0006-dashboard-live-update-sse.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->

## Pointers

- BC README (purpose, transport-vs-meaning boundary): `README.md`
