---
id: infrastructure-v8r3q
title: The bridge advertises what it can honour — a live /health capability handshake, plus a structural guard that stops a fourth silent drift
status: done
type: bug
context: infrastructure
created: 2026-07-13
completed: 2026-07-13
depends_on: []
blocks: [agentic-workflow-n4qte]
tags: [bridge, dashboard, versioning, vscode-extension, silent-failure]
related_adrs: [0018, 0013]
related_research: []
prior_art: [infrastructure-h5wnq, infrastructure-c6fzb, infrastructure-016, infrastructure-014, infrastructure-017]
---

## Why

The builder selected Sonnet in the dashboard's model selector and got an Opus session. He
named the session and got a terminal called "Claude". Both features were built, tested, and
shipped — and both did nothing.

**Nothing was broken.** `src/bridge.js` builds `['-n', name, '--model', model, …]` correctly,
`claude --help` really does carry `-n, --name` and `--model`, and `dashboard/dist/app.js`
really does put both fields in the `POST /run` body. The actual cause was version skew: the
extension **on disk** was 0.4.0 (installed 14:09), but the two live VS Code extension hosts
had started at 09:08 and 09:36 and were still executing **0.2.0** from memory. 0.2.0's
`makeHandler` reads only `prompt` and `skipPermissions`, ignores every other JSON field, and
hard-codes `createTerminal({ name: 'Claude' })`. Reloading the window fixed it.

The defect is not the missing flags. **The defect is that nothing told him.** The dashboard
POSTed `{ prompt, name, model }`, an old bridge dropped two of those three fields on the
floor, returned `202 { ok: true }`, and the UI reported success. A capability the running
bridge does not have degrades **silently and indistinguishably from success**.

`bridge.json` even carries a version field for exactly this purpose — `BRIDGE_V = 1`
(`src/bridge.js:29`) — but it has **stayed at `1` through every growth of the `/run`
contract**: `skipPermissions` (infrastructure-016), `name` (infrastructure-c6fzb), and
`model` (infrastructure-h5wnq) were all added without touching it. And even a bumped `v`
would not have been trustworthy here: `bridge.json` is written by a **separate process** (the
extension host) on its own activation lifecycle, is **last-writer-wins** across concurrent VS
Code windows, and lingers, last-written, from whichever host most recently activated — it can
describe a listener that isn't the one answering requests.

This will recur on every future field added to `/run`, and it will recur for every user who
updates the plugin without reloading their editor — the normal case, since VS Code defers
loading a new extension version until the window reloads.

## What

**Settled by the builder (not open questions — build to these):**

1. **The capability signal rides `GET /health` from the live listener, not (only)
   `bridge.json`.** `bridge.js` exports `CAPABILITIES = ['prompt', 'skipPermissions', 'name',
   'model']` — the `POST /run` fields *this build* of `makeHandler` actually reads.
   `GET /health` returns `{ ok: true, v: BRIDGE_V, capabilities: CAPABILITIES }`, sourced from
   the answering process's own in-memory constant, so it structurally cannot go stale the way
   `bridge.json` can (no second process, no write-then-read race — the process answering
   `/health` IS the process whose capabilities are being asked about). An old (0.2.0-shaped)
   bridge answers `/health` with **no `capabilities` field**; the dashboard treats that
   absence as the closed **legacy baseline** `LEGACY_CAPABILITIES = ['prompt',
   'skipPermissions']`. `bridge.json` / `GET /api/bridge` carry `capabilities` too, as
   **belt-and-braces**, but `/health` is authoritative — anything reading `bridge.json`'s copy
   for a decision that matters should probe `/health` instead.

2. **The dashboard becomes capability-aware in two places — defense in depth.**
   - `dashboard/app/bridge-launch.js`'s `probeBridge(fetchImpl)` resolves `{ present: boolean,
     capabilities: string[] }` instead of a bare `{ present }` (reusing the existing discover
     + health-probe internals; absent bridge → `capabilities: []`; present-but-legacy →
     `capabilities: LEGACY_CAPABILITIES`).
   - `launchOrCopy`'s own fire-time health probe captures the same `capabilities`, and
     `runOnBridge` **omits** `model` / `name` from the `POST /run` body whenever the
     live-probed capabilities don't include them — so even if a UI-side render-time gate is
     stale, absent, or bypassed, the wire-level request itself cannot claim a capability the
     listener just said, at that moment, it doesn't have. This mirrors the bridge's own
     allowlist-degrades-quietly discipline (infrastructure-h5wnq): omit the field, never
     reject, never `500`.

3. **A structural guard, not a third prose rule.** `vscode-extension/test/bridge.test.mjs`
   gains a test that scans `bridge.js`'s own source text for every `parsed?.<field>` read
   inside `makeHandler` — the convention all four honoured fields already follow
   (`parsed?.prompt`, `parsed?.skipPermissions`, `parsed?.name`, `parsed?.model`) — and
   asserts that discovered set is **exactly** `new Set(CAPABILITIES)`, in both directions: a
   field read but not declared fails; a field declared but never read fails. This is the test
   that stops a fourth silent drift; the prose rule already failed three times.

**What this task does NOT own:** the prompt bar's grey-out and the skew-detection banner are
UI/meaning concerns (BC README's transport-vs-meaning test: *"if the dashboard were strictly
read-only, would this concern still exist?"* — no, that's about how a write's outcome is
communicated) and belong to `agentic-workflow-n4qte`, which depends on the `{ present,
capabilities }` contract this task ships.

## Acceptance criteria

- [ ] `vscode-extension/src/bridge.js` exports `CAPABILITIES = ['prompt', 'skipPermissions',
      'name', 'model']`; `makeHandler`'s `GET /health` branch returns `{ ok: true, v:
      BRIDGE_V, capabilities: CAPABILITIES }`.
- [ ] `bridge.json` (`writeBridgeFile`) and `GET /api/bridge` (`dashboard/read-api.mjs`
      `handleBridge`) both carry `capabilities` through (belt-and-braces; still not the
      authoritative check).
- [ ] `dashboard/app/bridge-launch.js`'s `probeBridge(fetchImpl)` resolves `{ present: bool,
      capabilities: string[] }`; every failure mode still resolves `{ present: false,
      capabilities: [] }`, never throws, never rejects (unchanged silence contract). A live
      bridge whose `/health` omits `capabilities` resolves the exported `LEGACY_CAPABILITIES
      = ['prompt', 'skipPermissions']`.
- [ ] `launchOrCopy`/`runOnBridge` omit `model` and/or `name` from the `POST /run` body when
      the fire-time-probed live capabilities don't include them, even when the caller passed
      a value for either — this is a hard wire-level guarantee, not merely a UI-layer
      courtesy.
- [ ] A test in `vscode-extension/test/bridge.test.mjs` scans `bridge.js` source for every
      `parsed?.<field>` reference inside `makeHandler` and asserts that set equals `new
      Set(CAPABILITIES)` exactly — the test fails if a field is read without being declared,
      and fails if a field is declared without being read.
- [ ] Regression coverage in `dashboard/test/bridge-launch.test.mjs`: a real, in-test
      0.2.0-shaped HTTP listener (token-gated, honours only `prompt` + `skipPermissions`,
      `/health` omits `capabilities`) is stood up on localhost; against it,
      `probeBridge(fetch)` resolves `{ present: true, capabilities: LEGACY_CAPABILITIES }`,
      and `launchOrCopy({ ..., model: 'sonnet', name: 'x' })` produces a captured `POST /run`
      body with **no** `model` and **no** `name` field, while still resolving `{ via:
      'bridge' }` for the launch itself (prompt + skipPermissions are genuinely honoured).
- [ ] Existing `/run` callers that send no `model`/`name` are unaffected; the `skipPermissions`
      + prompt argv ordering is byte-identical to today.
- [ ] `vscode-extension/package.json` is version-bumped and the `.vsix` repackaged (the wire
      contract changed — `/health`'s response shape and `probeBridge`'s return contract both
      grew). If `vsce` isn't available in the worktree, say so plainly rather than claiming
      the package shipped (infrastructure-h5wnq precedent).
- [ ] ADR-0018 (already amended in place for this task in refinement, `.agentheim/knowledge/
      decisions/0018-vscode-dashboard-terminal-bridge.md`) is left internally consistent by
      the worker — if execution reveals any deviation from the amendment as drafted, correct
      the ADR text to match reality, don't silently diverge from it.

## Notes

- **Read the ADR-0018 amendment already written for this task** (dated 2026-07-13,
  infrastructure-v8r3q) before starting — it records the settled decisions above in full,
  including the rationale for why `/health` (not `bridge.json`) is authoritative.
- Prior art for the field-threading pattern: `infrastructure-c6fzb` (`name`) and
  `infrastructure-h5wnq` (`model`, `probeBridge`) both did this exact shape of change to
  `bridge.js` / `bridge-launch.js`. Follow their sanitize/allowlist/omit-don't-reject
  discipline.
- The structural guard's source-scan is deliberately narrow (it trusts the `parsed?.<field>`
  convention, not a general static-analysis pass) — consistent with other source-guard tests
  already in this repo (e.g. design-system-r9dtm's "no Agentheim-specific model names" guard).
  If a future field is read via a different syntax, the guard should be widened then, not
  pre-emptively generalized now.
- **Test-environment gotcha (repeated from infrastructure-h5wnq):**
  `vscode-extension/test/bridge.test.mjs` has two fixed-port tests that fail `EADDRINUSE` on
  `127.0.0.1:31425`/`31426` whenever the builder's real bridge extension is live in VS Code.
  Pre-existing and environmental, not a regression — expect exactly those two failures; treat
  a third as yours. Brief the verifier on this too.
- `dashboard/dist/app.js` is a derived artifact (esbuild, ADR-0003) — regenerate it, don't
  hand-edit it, and don't textually merge it at integration time (regenerate from merged
  source instead).
- This task does not touch `agentic-workflow-n4qte`'s scope (board.js grey-out/banner) at
  all; it only has to ship a trustworthy `{ present, capabilities }` signal and the
  wire-level omission guarantee above.

## Outcome

Shipped the live `/health` capability handshake exactly as ADR-0018's infrastructure-v8r3q
amendment specified, with no deviation — the ADR text needed no correction.

- `vscode-extension/src/bridge.js`: exports `CAPABILITIES = ['prompt', 'skipPermissions',
  'name', 'model']`; `GET /health` returns `{ ok: true, v: BRIDGE_V, capabilities:
  CAPABILITIES }`; `startBridge`'s `bridge.json` meta also carries `capabilities`
  (belt-and-braces). A new structural-guard test in `vscode-extension/test/bridge.test.mjs`
  scans the file's own source for every `parsed?.<field>` reference inside `makeHandler` and
  asserts that set equals `new Set(CAPABILITIES)` exactly.
- `dashboard/read-api.mjs`'s `handleBridge` (`GET /api/bridge`) now passes `capabilities`
  through from `bridge.json` unchanged (still belt-and-braces, not authoritative).
- `dashboard/app/bridge-launch.js`: exports `LEGACY_CAPABILITIES = ['prompt',
  'skipPermissions']`; `probeHealth` now reads `capabilities` off the live `/health` JSON body
  (defaulting to `LEGACY_CAPABILITIES` when the field is absent/invalid); `probeBridge`
  resolves `{ present, capabilities }` (failure modes → `{ present: false, capabilities: [] }`,
  unchanged silence contract); `runOnBridge` omits `model`/`name` from the `POST /run` body at
  the wire level whenever the live-probed capabilities lack them, even when the caller passed
  a value — a hard guarantee, not a UI courtesy. `launchOrCopy` threads the fire-time-probed
  capabilities from `probeHealth` straight into `runOnBridge`.
- `vscode-extension/package.json`: version bumped `0.4.0 → 0.5.0` (additive capability, per
  ADR-0013's convention). The `.vsix` itself was **not** repackaged: `vscode-extension/`
  has no `node_modules` in this worktree, and `npm run package` fails with `'vsce' is not
  recognized` — confirmed the same way infrastructure-h5wnq did, stated plainly rather than
  claiming the package shipped.
- Tests: `vscode-extension/test/bridge.test.mjs` (structural guard + updated `/health`/
  bridge.json assertions) and `dashboard/test/bridge-api.test.mjs` /
  `dashboard/test/bridge-launch.test.mjs` (legacy-capability wire-omission tests, updated
  `probeBridge` contract assertions, and a real in-process 0.2.0-shaped `node:http` listener
  regression fixture proving `probeBridge` resolves `LEGACY_CAPABILITIES` and `launchOrCopy`
  drops `model`/`name` at the socket level against a genuine legacy server, not just scripted
  JSON). Full suites green: `vscode-extension` 29/31 pass (2 known environmental
  `EADDRINUSE` failures on the fixed-port ladder, pre-existing per the task notes); `dashboard`
  891/891 pass; `lib` 229/229 pass.
- `.agentheim/contexts/infrastructure/README.md` updated: the bridge surface bullet, a new
  "Capability handshake" bullet, the bridge-discovery-file bullet, and the ADR-0018 changelog
  entry all now describe `capabilities`/`LEGACY_CAPABILITIES`/the wire-level omission
  guarantee, and no longer describe `probeBridge` as resolving a bare `{ present: boolean }`.
- No new ADR was needed — ADR-0018's infrastructure-v8r3q amendment (already drafted in
  refinement) was the complete, accurate spec for this build; execution surfaced no deviation
  requiring a correction.
