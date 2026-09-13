---
id: infrastructure-vpbks
title: Herdr bridge frontend — `launchOrCopy`/`probeBridge` dispatch on `/api/bridge`'s `kind`, call the mediated-launch endpoint when Herdr is selected, keep the VS Code path unmodified otherwise, and document the three-way selection in the repo README
status: doing
type: feature
context: infrastructure
created: 2026-09-13
completed:
depends_on: [infrastructure-xh8tw, design-system-001]
blocks: []
tags: [dashboard, bridge, herdr, launch, clipboard, frontend]
related_adrs: [0082, 0018]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-h5wnq, infrastructure-v8r3q, infrastructure-c6fzb]
---

## Why

Every board launch button (Quick Capture, Modeling, Refine, Promote, the per-card Work button)
resolves through `dashboard/app/bridge-launch.js`'s `launchOrCopy`/`probeBridge`. Today that
decision is hard-wired to a single bridge (VS Code, ADR-0018). infrastructure-xh8tw now makes
`GET /api/bridge` report a `kind` and, when it is `herdr`, exposes a mediated launch endpoint this
frontend can call. This task teaches the frontend to read `kind` and dispatch accordingly, while
keeping the existing VS Code path — and its absence-contract-to-clipboard behaviour — completely
unmodified when `kind` is `vscode` or unset.

## What

1. **Dispatch by `kind`.** `discoverBridge`/`launchOrCopy`/`probeBridge` read `kind` off `GET
   /api/bridge`: `kind==='herdr'` → `POST /api/bridge/launch` (the same `{prompt,
   skipPermissions?, name?, model?}` body-building logic `runOnBridge` already uses, gated by the
   response's own `capabilities`) with the `X-Agentheim-Bridge-Token` header; `kind==='none'` →
   straight to clipboard, no VS Code discovery attempted; `kind==='vscode'` or `kind`
   absent/`null` → today's code path, completely unmodified.

2. **Absence contract, frontend side.** With `herdr` selected, each of {`kind` present but
   `live:false`, `POST /api/bridge/launch` non-2xx, a thrown fetch} collapses silently to
   `{via:'clipboard'}`, never throws — the same absence-contract shape the VS Code path already
   has.

3. **Parity of the extras.** Every board launch button, with `herdr` selected and the endpoint
   reachable, produces a `POST /api/bridge/launch` body whose `prompt` is byte-identical to the
   string the VS Code path would POST (one source of truth, `modeling-command.js`). `probeBridge`
   resolves `{present, capabilities}` correctly for both `vscode` and `herdr` kinds, so the prompt
   bar's model selector greys out consistently regardless of which bridge is selected.

4. **Document the selection.** The repo README's bridge section explains the three-way selection
   (`vscode`/`herdr`/`none`) and that the clipboard fallback is always the floor, in a few lines.

## Acceptance criteria

- [ ] `dashboard/app/bridge-launch.js`'s `discoverBridge`/`launchOrCopy`/`probeBridge` read `kind` off `GET /api/bridge`: `kind==='herdr'` dispatches to `POST /api/bridge/launch` with the token header; `kind==='none'` goes straight to clipboard with no VS Code discovery attempted; `kind==='vscode'` or `kind` absent/`null` runs today's code path unmodified — DOM-tested for all three.
- [ ] Every board launch button (Quick Capture, Modeling, Refine, Promote, per-card Work), with `herdr` selected and the endpoint reachable, produces a `POST /api/bridge/launch` body whose `prompt` is byte-identical to the string the VS Code path would POST — DOM-tested with an injected fetch, one case per button.
- [ ] Absence contract, frontend side: with `herdr` selected, each of {`kind` present but `live:false`, `POST /api/bridge/launch` non-2xx, thrown fetch} collapses silently to `{via:'clipboard'}`, never throws — one `node --test` case per mode.
- [ ] Every existing bridge test (`bridge-launch`, `bridge-api`, prompt-bar capability/DOM tests) passes without modification when `vscode` is selected or no selection is recorded.
- [ ] `probeBridge` resolves `{present, capabilities}` correctly for both `vscode` and `herdr` kinds — DOM-tested for both.
- [ ] The repo README's bridge section explains the three-way selection and the clipboard fallback in a few lines. [human-eye]

## Notes

**Rulings from the g6h1m REFINE round (ADR-0082), applied here:**

- **Wire shape (ADR-0082 §3):** `kind` is additive on `GET /api/bridge`'s existing response; the
  launch call is the *sibling* `POST /api/bridge/launch`, not a parameter on the discovery route.
- **Clipboard floor, unchanged (ADR-0082 §8):** `--dangerously-skip-permissions`, `--model`, `-n
  <name>` remain startup-only argv the clipboard path can never carry, on any bridge kind — the
  existing ADR-0018/infrastructure-h5wnq asymmetry extends unchanged; this task does not attempt
  to close that gap.
- This task depends on infrastructure-xh8tw, not on infrastructure-e8h9f directly — it only
  ever talks to the server's `/api/bridge*` routes, never to CHILDA's `lib/` modules.

- **Styleguide gate:** as the only child with a UI surface this task carries the parent's `design-system-001` dependency (already done); the two `lib/`-and-server children do not.

**Build note:** `dashboard/dist/app.js` is rebuilt by the conductor after this task merges, not by
the worker executing it.

Prior art: infrastructure-h5wnq (the model rides the launch, the bridge learns liveness — the
pattern `probeBridge`'s capability read follows), infrastructure-v8r3q (the capability handshake
and the structural guard against silent drift, which this task's dual-kind `probeBridge` test
must preserve), infrastructure-c6fzb (bridge-launched sessions carry a derived name). agentic-
workflow-020 (`bridge-launch.js`, the absence contract) and agentic-workflow-g4zce (the per-card
Work button) are prior art beyond the frontmatter matcher.
