## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0079 — Ship the zero-token dashboard CLI to consumers via a `/setup` command; demote `/dashboard` to a pointer** (2026-09-12, accepted) — a plugin cannot put a binary on `PATH`, so a new re-runnable `/setup` command copies the three CLI files verbatim into `<home>/.local/bin` (never a project tree) and/or installs the VS Code bridge; `/dashboard` becomes a static pointer; plugin updates reach the install via a user-prompted re-run (skew banner, card), not launch-path self-detection. Extends ADR-0002 exception to a two-member allowlist (prose-only, ADR-0059) and ADR-0053 model-free precedent to launch. Implements infrastructure-r4mzp — `knowledge/decisions/0079-dashboard-cli-ships-via-setup-command.md`
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
