---
id: infrastructure-xh8tw
title: Herdr bridge server — `POST /api/bridge/launch` opens a Claude session in Herdr behind a per-process token; `GET /api/bridge` grows `kind`/`live`; workspace reuse by project cwd via `api snapshot`; agent start is fire-and-forget behind an immediate 202
status: done
type: feature
context: infrastructure
created: 2026-09-13
completed:
depends_on: [infrastructure-e8h9f]
blocks: [infrastructure-vpbks]
tags: [dashboard, bridge, herdr, launch, server]
related_adrs: [0082, 0018, 0053, 0017]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09, claude-code-terminal-session-naming-2026-06-15]
prior_art: [infrastructure-c6fzb, infrastructure-w6p4k, infrastructure-h5wnq, infrastructure-v8r3q]
---

## Why

The browser cannot reach Herdr's local socket, so unlike the VS Code path (a browser `fetch`
straight to a second local listener), a Herdr launch is necessarily **server-mediated**: the
dashboard's own Node process, which already knows the project root, runs the `herdr` CLI on the
UI's behalf. ADR-0082 names this a new write category — MEDIATED LAUNCH, sibling to the forbidden
LIFECYCLE category (ADR-0017) and the ADVISORY/RUNTIME SELF-LIFECYCLE categories (ADR-0053) — and
freezes the endpoint's wire shape, its security bar, its Herdr topology, and its request-path
budget. This task builds exactly that endpoint against infrastructure-e8h9f's config reader and
binary resolver.

## What

1. **`GET /api/bridge` grows `kind`.** Reads `readBridgeSelection` and adds `kind` (the recorded
   selection verbatim, `null` when unset) to every response, additively. When `kind==='herdr'`,
   the response also carries `{token, capabilities:['prompt','skipPermissions','name','model'],
   live}` — `live` from CHILDA's `checkHerdrLiveness`.

2. **A per-process token.** Minted once at server start (`node:crypto`, 32 hex, in memory only —
   no disk write, since producer and consumer are the same process). `GET /api/bridge` is the only
   way to learn it, and it is only same-origin-readable because the server sends no CORS headers.

3. **`POST /api/bridge/launch`.** A new sibling route, `{prompt, skipPermissions?, name?, model?}`
   — the identical body shape as VS Code's `POST /run`, deliberately, to minimize
   `bridge-launch.js`'s diff — requiring `X-Agentheim-Bridge-Token` (same header name as the VS
   Code contract). No `Origin` check (see Notes). Topology: `herdr api snapshot` first; if any
   pane's `cwd` equals the project root, `tab create --workspace <id> --cwd <root> --label <name>
   --no-focus`; else `workspace create --cwd <root> --label <name> --no-focus`. Always
   `--no-focus`. `<name>` is the same resolved session name the VS Code path already derives.

4. **Fast path awaited, slow path fired-and-reported.** `api snapshot` + `tab`/`workspace create`
   are awaited; a failure there is a non-2xx before any response commits. Once that succeeds, the
   handler responds `202 {ok:true}` immediately, then spawns `herdr agent start <name> --kind
   claude --pane <id> --timeout <ms> -- <argv>` **unawaited** — a subsequent `agent_not_ready`
   (e.g. Claude's first-run trust prompt) is not surfaced to the caller; the pane is already open.

5. **Argv parity.** `name`, `model` (closed allowlist, ADR-0018 / infrastructure-h5wnq), and
   strict-`true` `skipPermissions` ride the `agent start` argv in ADR-0018's exact order (`['-n',
   name, '--model', id, '--dangerously-skip-permissions', prompt]`, each optional pair present
   only when armed) — raw argv, no shell. A pure `deriveHerdrAgentName(displayName,
   liveAgentNames)` always returns `[a-z][a-z0-9_-]{0,31}`, unique against the injected live-agent
   list.

## Acceptance criteria

- [ ] `GET /api/bridge` adds `kind` (verbatim recorded value, `null` when unset) to every response shape, additively; existing `bridge-api`/`bridge-launch` tests that assert on the response body are updated the additive way if any assert exact equality — no existing test newly fails. When `kind==='herdr'`, the response also carries `{token, capabilities:['prompt','skipPermissions','name','model'], live}`.
- [ ] A per-process random token (`node:crypto`, 32 hex) is minted once at server start and is the value `GET /api/bridge` returns for `kind:'herdr'`; `node --test` asserts it is stable across repeated GETs within one server instance and absent when `kind !== 'herdr'`.
- [ ] `POST /api/bridge/launch` is wired into `server.mjs`, validates the token (`401` on missing/mismatch) and the body (`400` on malformed), resolves the herdr binary via CHILDA's resolver (a non-2xx if not found), runs `api snapshot` → matching-workspace `tab create` or `workspace create` (awaited; failure → non-2xx before any `202`), responds `202 {ok:true}`, then spawns `agent start … --timeout … -- <argv>` unawaited; a subsequent `agent_not_ready` is not surfaced to the caller. No `Origin`/`Sec-Fetch-Site` check.
- [ ] `name`, `model`, `skipPermissions` from the request body ride the `agent start` argv in ADR-0018's exact order, each present only when armed; one `node --test` case per field, including the rejected-model-value → no-flag case, reusing the existing model allowlist.
- [ ] `deriveHerdrAgentName(displayName, liveAgentNames)` always returns `[a-z][a-z0-9_-]{0,31}`, unique against the injected live-agent list; unit-tested against the display names the VS Code path already derives.
- [ ] Absence contract, server side: herdr not on PATH, socket absent, `api snapshot`/`tab create`/`workspace create` failure, and a launch request with a bad/missing token each produce a non-2xx (never a hang, never a 5xx crash) — one `node --test` case per mode, using an injected fake `exec`/`which`, no real Herdr binary required.

## Notes

**Rulings from the g6h1m REFINE round (ADR-0082), applied here:**

- **Security (ADR-0082 §4):** token-only, no Origin check — and this is a deliberate divergence
  from ADR-0053's `/api/stop` precedent, not an oversight. ADR-0053 accepted no Origin check
  because its blast radius was bounded (a locally-relaunchable dev server, one advisory file).
  This endpoint reaches `claude` directly with `skipPermissions` available — the same unbounded
  blast radius ADR-0018 itself already accepted a token-only defense for, with no Origin check
  either. Inherit ADR-0018's bar exactly; do not add an Origin check beyond it.
- **Write category (ADR-0082 §2):** this is MEDIATED LAUNCH, a fourth category alongside the
  forbidden LIFECYCLE (ADR-0017) and the ADVISORY/RUNTIME SELF-LIFECYCLE categories (ADR-0053) —
  named so a future "server mediates another external action" doesn't re-litigate ADR-0017.
- **Wire shape (ADR-0082 §3):** `kind` on the existing `GET /api/bridge` (additive), a *sibling*
  `POST /api/bridge/launch` route — not folded into `/api/bridge` itself, which stays GET-only.
- **HERDR_ENV (ADR-0082 §7):** this bridge neither sets nor checks `HERDR_ENV` — Herdr's guidance
  to drive it only from inside a Herdr pane is policy for autonomous agents, not a technical gate;
  this launcher is deterministic.

- **Convention check (ADR-0059):** the MEDIATED LAUNCH write-category name is prose-only, unenforced — it lives in ADR-0082 as vocabulary for future rulings, not as a lint; the endpoint's own contract (token, body shape, status codes) is fully enforced by the `node --test` cases above.

**Herdr facts verified on the builder's machine (2026-09-13), ground truth for this endpoint:**
`herdr tab create [--workspace <id>] --cwd <path> --label <text> [--env K=V] --no-focus` →
`.result.tab` / `.result.root_pane` (pane id like `w3:p1`). `herdr workspace create --cwd <path>
--label <text> --no-focus` → `.result.workspace` / `.result.tab` / `.result.root_pane`. `herdr
agent start <NAME> --kind claude --pane <ID> [--timeout <ms>, default 30000, max 300000] --
<agent args...>` — success means Claude is detected in that pane and ready for input; if the agent
is BLOCKED during startup (e.g. Claude's first-run directory trust prompt when
`--dangerously-skip-permissions` is absent) it returns `agent_not_ready` immediately but the
session IS open — treat that as launched, not failed. `herdr workspace list` / `tab list` expose
NO cwd; `herdr api snapshot` DOES expose per-pane `cwd` (`.result.snapshot.panes[].cwd`) plus
workspace/tab ids, making "find the workspace whose panes' cwd equals the project root" a single
call. Names: `[a-z][a-z0-9_-]{0,31}`, unique among live agents; `herdr agent list` returns
`{result:{agents:[...]}}`.

Prior art: infrastructure-c6fzb (bridge-launched sessions carry a derived name — the pattern
`deriveHerdrAgentName` follows), infrastructure-w6p4k (session-name prefix conventions),
infrastructure-h5wnq (model rides the launch as raw argv, the bridge learns liveness),
infrastructure-v8r3q (capability handshake plus the structural guard against silent drift — this
task's `capabilities` field follows the same shape). agentic-workflow-020 (`bridge-launch.js`, the
absence contract this endpoint's failure modes must preserve) is prior art beyond the frontmatter
matcher.

## Verifier note (iteration 1)

**VERDICT:** FAIL

**REASONS:**
- Acceptance criterion 3 ("`POST /api/bridge/launch` is wired into `server.mjs`…") has no executable coverage. The dispatch block at dashboard/server.mjs:126-133 — route match, POST-only guard, placement ahead of the `req.method !== 'GET'` 405 gate, and the `{ token: bridgeToken, homedir, ...bridgeLaunch }` opts it passes — is exercised by zero tests. Every case in dashboard/test/bridge-launch-api.test.mjs invokes `handleBridgeLaunch` directly with a fake req/res; no test issues an HTTP request to `/api/bridge/launch`. Removing the whole block leaves the dashboard suite at 1057/1057 green (verified: `cd dashboard && npm test` → exit 0).
- Consequently the cross-criterion integration claim in criteria 2+3 is unproven: nothing asserts that the per-process token `GET /api/bridge` returns for `kind:'herdr'` is the same token `POST /api/bridge/launch` accepts. A wiring mistake (omitted `token:`, a second `randomBytes` call, or dispatch placed after the 405 gate) would make the endpoint dead on arrival with the suite still fully green.
- The house pattern for a route dispatched ahead of the 405 gate is established and was not followed: dashboard/test/stop-api.test.mjs:107 and :126, and dashboard/test/whats-next-delete.test.mjs:163 and :176, each pair a "reachable via <method>, not 405" test with an "every OTHER non-GET method on that path is still 405" test against a real `createDashboardServer`. Neither counterpart exists for `/api/bridge/launch`.
- Secondary, against criterion 6's "never a hang, never a 5xx crash": dashboard/server.mjs:131 calls the async `handleBridgeLaunch` without `await` or `.catch()`, and `resolveHerdrBinary` at dashboard/bridge-launch-api.mjs:271 sits outside every `try`. A throw there becomes an unhandled rejection that kills the process instead of returning a non-2xx. The handler-level tests cannot observe this because they await the call themselves.

**SUGGESTED_FIX:** Add server-level tests in dashboard/test/bridge-launch-api.test.mjs (or bridge-api.test.mjs) using `createDashboardServer({ root, assetRoot, homedir, bridgeLaunch: { resolveHerdrBinaryFn, exec, spawnFn } })` — the injection seam already exists but is untested: one test that GETs /api/bridge with `kind:'herdr'` recorded, reuses the returned token to POST /api/bridge/launch and asserts 202 `{ok:true}` plus the spawned argv, and one mirroring stop-api.test.mjs:126 asserting PUT/DELETE on /api/bridge/launch still 405 while GET falls through to 404. While there, attach a `.catch()` (or wrap the `resolveHerdrBinary` call in the existing try/send-non-2xx shape) at dashboard/server.mjs:131 so a resolver throw cannot become an unhandled rejection.

**ITERATION_HINT:** likely-fixable

## Outcome

Built the Herdr server-mediated launch endpoint on top of infrastructure-e8h9f's foundation, per ADR-0082.

**`dashboard/bridge-launch-api.mjs`** (new) is the core module: `BRIDGE_TOKEN_HEADER`,
`HERDR_CAPABILITIES` (pinned equal to `vscode-extension/src/bridge.js`'s `CAPABILITIES`),
`MODEL_ALLOWLIST`/`sanitizeModel` (pinned equal to the extension's own allowlist),
`sanitizeName`/`deriveNameFromPrompt`/`resolveSessionName` (a faithful reimplementation of
the VS Code listener's own session-name fallback, since the dashboard server cannot import
`vscode-extension/` at runtime), `buildClaudeArgv` (ADR-0018's exact argv order),
`deriveHerdrAgentName` (pure, Herdr's `[a-z][a-z0-9_-]{0,31}` grammar, unique against an
injected live-agent list), and `handleBridgeLaunch` — the `POST /api/bridge/launch` handler
itself: token gate (401) → body/prompt validation (400) → `resolveHerdrBinary` (503 if
absent) → awaited `api snapshot` → awaited matching `tab create`/`workspace create` (502 on
either failure, before any 202) → `202 {ok:true}` → unawaited `agent list` (best-effort,
swallowed on failure) → `deriveHerdrAgentName` → unawaited `spawn(herdr, ['agent','start',...])`.
Every Herdr CLI call is behind an injected `exec`/`spawnFn`/`resolveHerdrBinaryFn` seam; no
test spawns a real binary.

**`dashboard/read-api.mjs`**'s `handleBridge` now reads `readBridgeSelection(homedir)` and
adds `kind` additively to the existing VS Code/absent shapes; when the recorded selection is
`'herdr'` it takes a wholly different branch — never reading `bridge.json` at all — returning
`{present:true, kind:'herdr', token, capabilities, live}`, with `live` from
`checkHerdrLiveness`.

**`dashboard/server.mjs`** mints the per-process bridge token (`node:crypto`, 32 hex) once per
server instance, threads an injectable `homedir`/`herdr`/`bridgeLaunch` opts bag through, and
dispatches `POST /api/bridge/launch` ahead of the 405 method gate (same pattern as
`/api/whats-next` and `/api/stop`).

Tests (iteration 1): `dashboard/test/bridge-launch-api.test.mjs` (new, 36 cases at the time)
covered every pure helper, the argv-order/ADR-0018-parity cases (name/model/skipPermissions
each armed independently and combined, plus the rejected-model no-flag case),
`deriveHerdrAgentName`'s grammar/uniqueness/truncation edge cases, and the full absence
contract (missing/mismatched token, malformed body, empty prompt, herdr-not-found, `api
snapshot` failure, `tab`/`workspace create` failure — each asserted non-2xx and never 202)
plus the two topology branches (matching-cwd pane → `tab create --workspace <id>`; no match →
`workspace create`) and the 202-before-spawn ordering with a failing post-202 spawn swallowed.
`dashboard/test/bridge-api.test.mjs` was updated to inject a fake `homedir` in every existing
case (an untouched test would otherwise read the builder's real
`~/.config/agentheim/config.json`), gained `kind` to every existing assertion, and 6 new cases
covered the `kind:'herdr'` branch.

**Iteration 2 fix (verifier iteration-1 FAIL, addressed):** the verifier found the
`server.mjs` dispatch block for `POST /api/bridge/launch` (route match, POST-only guard,
placement ahead of the 405 gate, and the `{token, homedir, ...bridgeLaunch}` opts it passes)
had zero executable coverage — every prior test drove `handleBridgeLaunch` directly, so
deleting the whole dispatch block left the suite green. It also flagged that
`handleBridgeLaunch` was invoked without `await`/`.catch()` in `server.mjs`, and that
`resolveHerdrBinary` in `bridge-launch-api.mjs` sat outside any `try`, so an unexpected throw
there would become an unhandled rejection (process death) rather than a non-2xx. Fixed both:

- `dashboard/server.mjs` now chains `.catch()` onto the `handleBridgeLaunch(...)` call, writing
  a `500` (only if headers aren't already sent) instead of letting a throw escape as an
  unhandled rejection.
- `dashboard/bridge-launch-api.mjs` now wraps the `resolveHerdrBinaryFn`/`resolveHerdrBinary`
  call itself in a `try/catch`, turning a throw into a `502` before any response commits.
- `dashboard/test/bridge-launch-api.test.mjs` gained 5 new cases (36 → 41; whole-suite count
  1057 → 1062): a unit-level case for a throwing `resolveHerdrBinaryFn` (never-a-crash), and
  four new HTTP-route tests against a REAL `createDashboardServer` — mirroring the house
  pattern in `dashboard/test/stop-api.test.mjs`/`dashboard/test/whats-next-delete.test.mjs`:
  (1) an end-to-end case that `GET /api/bridge` with `kind:'herdr'` recorded, reuses the
  returned token to `POST /api/bridge/launch`, and asserts `202 {ok:true}` plus the exact
  spawned `agent start` argv — proving the SAME per-process token both routes share and that
  the dispatch is actually reachable; (2) a wrong-token case asserting `401` through the real
  server; (3) a case proving a throwing `resolveHerdrBinaryFn` yields a non-2xx through the
  real server rather than crashing the process (the server answers a later request at all,
  which it could not do if the process had died); (4) a case mirroring `stop-api.test.mjs`'s
  own 405/404 pairing — `GET /api/bridge/launch` falls through to `404` (no matching GET
  route), `PUT`/`DELETE` remain `405`. As a manual regression check, temporarily deleting the
  `server.mjs` dispatch block was confirmed to fail the new end-to-end/401 tests (401 became
  405) before the block was restored.

`node --test lib/test/*.test.mjs` and `cd dashboard && npm test` both green (1062/1062 in
dashboard as of iteration 2; the one `lib/` failure is the pre-existing agentic-workflow-qwfq3
INDEX-length regression, unrelated to this task; one `dashboard/test/events.test.mjs` SSE
timing test was independently observed to flake once and pass clean on rerun — pre-existing
file-watcher timing sensitivity, untouched by this task's files). No `dashboard/app/` or
`dashboard/dist/` files were touched — the frontend wiring is infrastructure-vpbks's job.
