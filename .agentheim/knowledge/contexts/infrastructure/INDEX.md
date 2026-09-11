## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0056** — A self-registered `module.register()` resolve hook — not a second `node_modules` — re-resolves the styleguide's bare specifiers against `dashboard/node_modules`, the Node-ESM analogue of esbuild's `nodePaths` (accepted) — `../../decisions/0056-node-esm-bare-specifier-resolve-hook-for-cross-bc-dom-tests.md`
- **ADR-0018** — VS Code dashboard→terminal bridge — fixed-port localhost-listener extension + server-mediated `bridge.json` / `GET /api/bridge` discovery (proposed; diverges-in-part from ADR-0002's ephemeral port) — `../../decisions/0018-vscode-dashboard-terminal-bridge.md`
- **ADR-0013** — Plugin release discipline — manifest bump bound to a `vX.Y.Z` git tag, by checklist (accepted) — `../../decisions/0013-plugin-release-discipline.md`
- **ADR-0002** — Dashboard runtime — Node-stdlib localhost transport with detached launch (proposed; superseded-in-part by ADR-0006) — `../../decisions/0002-dashboard-runtime-transport.md`
- **ADR-0006** — Dashboard live-update — SSE push + .agentheim/ file-watcher (proposed; supersedes-in-part ADR-0002) — `../../decisions/0006-dashboard-live-update-sse.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->


## Pointers

- BC README (purpose, transport-vs-meaning boundary): `README.md`
- Task board (tasks by status) for this BC: `../../../board/infrastructure/INDEX.md`
