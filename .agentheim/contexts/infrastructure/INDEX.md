# Infrastructure — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 0
- **Todo:** 0
- **Doing:** 1
- **Done:** 22
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
- **infrastructure-5w5gs** — task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation (bug) — `doing/infrastructure-5w5gs-task-lifecycle-cli-crlf-line-endings.md`
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **infrastructure-q8m4t** — Support quotation marks (Gänsefüsschen) in prompts (bug) — `done/infrastructure-q8m4t-quotation-marks-in-prompts.md`
- **infrastructure-e5t9c** — Relocate skills/capture-workspace eval debris out of the plugin payload (chore) — `done/infrastructure-e5t9c-relocate-capture-workspace-eval-debris.md`
- **infrastructure-020** — Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell (bug) — `done/infrastructure-020-bridge-prompt-quote-escaping-cross-shell.md`
- **infrastructure-019** — Dashboard origin sticks to its last-good port so an intermittent collision can't flap it (feature) — `done/infrastructure-019-dashboard-origin-sticky-last-good-port.md`
- **infrastructure-018** — Dashboard binds a deterministic project-root port so the origin survives relaunch (decision) — `done/infrastructure-018-dashboard-deterministic-port-stable-origin.md`
- **infrastructure-017** — Re-package & version the bridge .vsix carrying the skip-permissions change (chore) — `done/infrastructure-017-repackage-bridge-vsix-with-skip-permissions.md`
- **infrastructure-016** — Bridge extension honours the opt-in skip-permissions option on POST /run (feature) — `done/infrastructure-016-bridge-extension-honor-skip-permissions.md`
- **infrastructure-015** — Amend ADR-0018 — permit an opt-in bridge permission-bypass (decision) — `done/infrastructure-015-amend-adr-0018-opt-in-permission-bypass.md`
- **infrastructure-014** — Dashboard server GET /api/bridge — serve the bridge port+token to the sandboxed frontend (feature) — `done/infrastructure-014-dashboard-bridge-discovery-endpoint.md`
- **infrastructure-013** — Build the VS Code bridge extension — 127.0.0.1 listener that opens a seeded Claude terminal (feature) — `done/infrastructure-013-vscode-bridge-extension.md`
- **infrastructure-012** — VS Code dashboard→terminal bridge — pin the transport contract (ADR-0018) (decision) — `done/infrastructure-012-vscode-bridge-contract.md`
- **infrastructure-011** — Dashboard browser tab title reflects the discovered project's name (feature) — `done/infrastructure-011-dashboard-title-project-name.md`
- **infrastructure-010** — $CLAUDE_PLUGIN_ROOT is empty at /dashboard runtime — 008's fix collapses to the broken project path (bug) — `done/infrastructure-010-dashboard-plugin-root-empty-foreign-project.md`
- **infrastructure-009** — Add a test seam for slash-command card invocation (catch project-relative launcher paths) (chore) — `done/infrastructure-009-command-card-invocation-test-infra.md`
- **infrastructure-008** — Dashboard command must invoke the launcher by plugin path, not project-relative (bug) — `done/infrastructure-008-dashboard-command-plugin-root-launcher-path.md`
- **infrastructure-007** — Bump plugin version to 0.8.2 + cut v0.8.2 tag to unblock marketplace updates (chore) — `done/infrastructure-007-bump-plugin-version-0-8-2.md`
- **infrastructure-006** — Plugin release discipline — stop the manifest version from silently drifting (decision) — `done/infrastructure-006-plugin-release-version-discipline.md`
- **infrastructure-005** — Bump plugin version to 0.8.0 to unblock marketplace updates (chore) — `done/infrastructure-005-bump-plugin-version-0-8-0.md`
- **infrastructure-004** — Resolve dashboard assetRoot relative to the module, not the project root (bug) — `done/infrastructure-004-dashboard-assetroot-module-relative.md`
- **infrastructure-002** — Bundle the styleguide ESM source into the dashboard's committed static assets (esbuild → committed dist/) (chore) — `done/infrastructure-002-pre-bundle-dashboard-assets.md`
- **infrastructure-003** — Dashboard live-update transport: SSE endpoint + .agentheim file-watcher (supersedes ADR-0002 req/resp-only) (decision) — `done/infrastructure-003-dashboard-live-update-sse.md`
- **infrastructure-001** — Dashboard runtime: Node static+JSON transport, launch/stop, project discovery (decision) — `done/infrastructure-001-dashboard-runtime-transport.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0018** — VS Code dashboard→terminal bridge — fixed-port localhost-listener extension + server-mediated `bridge.json` / `GET /api/bridge` discovery (proposed; diverges-in-part from ADR-0002's ephemeral port) — `../../knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md`
- **ADR-0013** — Plugin release discipline — manifest bump bound to a `vX.Y.Z` git tag, by checklist (accepted) — `../../knowledge/decisions/0013-plugin-release-discipline.md`
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
