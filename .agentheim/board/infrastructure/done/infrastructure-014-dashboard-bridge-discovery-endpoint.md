---
id: infrastructure-014
title: Dashboard server GET /api/bridge — serve the bridge port+token to the sandboxed frontend
status: done
type: feature
context: infrastructure
created: 2026-06-14
completed: 2026-06-14
commit: f6d73d6
depends_on: [infrastructure-012]
blocks: [agentic-workflow-020]
tags: [dashboard, vscode, bridge, transport]
related_adrs: [0002]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-001, infrastructure-003]
---

## Why
The dashboard frontend runs in VS Code's sandboxed Simple Browser: it is
filesystem-blind and can only `fetch()` its own origin. It therefore cannot read the
extension's `bridge.json` off disk to learn the listener's port+token. Per ADR-0018
(infrastructure-012), the dashboard **server** bridges that gap: it reads `bridge.json`
and serves the contract to the frontend over the same localhost transport the board
already uses. Without this endpoint, the frontend has no way to discover the bridge, and
aw-020's launch path cannot work.

## What
Add a read endpoint to the existing dashboard server (ADR-0002 transport):

- **`GET /api/bridge`** reads `.agentheim/.dashboard/bridge.json` through ADR-0002's
  in-root path validator (no traversal, no escape) and returns `{ port, token, v }`.
- When `bridge.json` is **absent** (extension not installed/not running), return
  `200 { present: false }` — not an error — so the frontend can silently fall back.
- Stays pure transport: it carries the contract the extension published; it invents no
  rule and runs no `claude` itself. Zero-dep, stdlib-only, no install step (ADR-0002).

This is a different codebase and toolchain than the extension (infrastructure-013) — it
lives in the Node dashboard server — hence its own task.

## Acceptance criteria
- [ ] `GET /api/bridge` exists on the dashboard server and returns `{ port, token, v }` read from `.agentheim/.dashboard/bridge.json` via the existing in-root path validator (ADR-0002), so the read cannot escape the discovered project root.
- [ ] When `bridge.json` is absent or unreadable, the endpoint returns `200 { present: false }` (never a 5xx for normal absence), so the frontend degrades silently.
- [ ] The endpoint adds no dependency and no install step — Node stdlib only, consistent with ADR-0002.
- [ ] The served `dist/` (if the endpoint requires any frontend-visible change) and any test seam are updated; the endpoint is covered by a test against present / absent `bridge.json`.

## Notes
- Depends on infrastructure-012 (ADR-0018) for the `bridge.json` shape and the
  `{ port, token, v }` / `{ present: false }` response contract.
- **Blocks aw-020:** the buttons' bridge-detection probe (`GET /api/bridge` then a
  token-bearing `GET /health`) starts here. aw-020 keeps its dependency on this task and
  on infrastructure-012 (the contract), but **not** on infrastructure-013 (an absent
  extension is a normal, tested mode for the frontend).
- Transport sibling of the ADR-0002 read endpoints (`/api/tree`, `/api/doc`) and the
  ADR-0006 `/api/events` SSE channel. Full findings + citations:
  `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome
Added the read endpoint **`GET /api/bridge`** to the dashboard server. It reads
`.agentheim/.dashboard/bridge.json` through ADR-0002's existing in-root path validator
(`resolveInRoot`, reused — no second validator hand-rolled) and returns the discovery
subset `200 { port, token, v }`. Absent, unreadable, or malformed `bridge.json` all
collapse to `200 { present: false }` — never a 5xx — so the sandboxed frontend degrades
silently to clipboard. `pid`/`startedAt` are deliberately not leaked. Pure transport,
zero-dep, stdlib-only, no install step; consistent with the read-only posture (ADR-0017).
No frontend change and no `dist/` rebuild (aw-020 consumes this later).

Key files:
- `dashboard/read-api.mjs` — `handleBridge(req, res, root)` handler.
- `dashboard/server.mjs` — route wiring for `GET /api/bridge`.
- `dashboard/test/bridge-api.test.mjs` — 3 tests (present / absent / malformed).
- `.agentheim/contexts/infrastructure/README.md` — bridge-discovery bullet now names the
  live endpoint and its response contract.

Tests: full dashboard suite green (200 passing, incl. 3 new). No new decision beyond
ADR-0018 (the contract was frozen) → no ADR written.
