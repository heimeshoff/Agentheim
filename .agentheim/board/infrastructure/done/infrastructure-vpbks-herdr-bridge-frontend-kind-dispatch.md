---
id: infrastructure-vpbks
title: Herdr bridge frontend — `launchOrCopy`/`probeBridge` dispatch on `/api/bridge`'s `kind`, call the mediated-launch endpoint when Herdr is selected, keep the VS Code path unmodified otherwise, and document the three-way selection in the repo README
status: done
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

## Verifier note (iteration 1)

**VERDICT:** FAIL

**REASONS:**
- Acceptance criterion 1 ("`kind==='herdr'` … `kind==='none'` … `kind==='vscode'`/absent … — DOM-tested for all three") is only DOM-covered for two of the three kinds. `dashboard/test/board-bridge-herdr-parity-dom.test.mjs` (the only new DOM file, 7 cases) mounts a fetch stub that answers `/api/bridge` with `kind:'herdr'` in every case — `makeHerdrFetch` and the not-live stub at lines 332-343 and 575-581 are the only discovery shapes it ever returns. The `kind:'vscode'`/absent kind is DOM-exercised by the untouched pre-existing `dashboard/test/board-prompt-bar-capability-dom.test.mjs` (whose kind-less fixtures now run through the new `body.kind !== "none"` branch and `extractVscodeTarget`, and pass). `kind:'none'` has NO DOM-level coverage anywhere — its only coverage is the two `node --test` unit cases in `dashboard/test/bridge-launch.test.mjs` ('kind:"none" -> straight to clipboard, no VS Code discovery attempted at all (no /health, no /run)' and 'probeBridge resolves {present:false, capabilities:[]} for kind:"none", without probing /health'). The criteria in this task distinguish test modality deliberately and precisely elsewhere (criterion 3 asks for "one `node --test` case per mode", criteria 2 and 5 ask for "DOM-tested"), so "DOM-tested for all three" is a literal requirement, not loose phrasing, and the `none` branch — the clipboard floor the README criterion advertises — is never proven through a real mounted board.

**SUGGESTED_FIX:** Add one DOM case to `dashboard/test/board-bridge-herdr-parity-dom.test.mjs` (or a sibling file) that mounts the real board with `/api/bridge` answering `{present:false, kind:'none'}`, clicks a launch button, and asserts no `POST /api/bridge/launch` and no `127.0.0.1:<port>` `/health`//`run` fetch ever fires — the recording-fetch + `withReducedMotion` helpers already in that file cover the mechanics; optionally give the vscode half an explicit `kind:'vscode'` DOM fixture too, since the pre-existing capability-DOM fixtures only exercise the kind-absent form. Nothing else in the diff needs changing: both suites were run from the worktree and are clean apart from the three known pre-existing reds (`lib` 859 tests / 857 pass, failures only `index-entry-length` and `spike-stop-loss`; dashboard 1083 tests / 1082 pass, failure only `dist-staleness`), and the targeted run of all seven bridge-related test files passed 145/145 with every pre-existing `bridge-launch`/`bridge-api`/prompt-bar test green and unmodified.

**ITERATION_HINT:** likely-fixable

## Outcome

`dashboard/app/bridge-launch.js`'s `launchOrCopy`/`probeBridge` now dispatch on the `kind`
field `GET /api/bridge` carries (infrastructure-xh8tw): the internal `discoverBridge` helper
was simplified to return the raw discovery body, with a new `extractVscodeTarget` pulling out
the VS Code `{port, token}` shape exactly as `discoverBridge` used to do inline. `kind==='herdr'`
routes through a new `runOnHerdr`, POSTing to same-origin `POST /api/bridge/launch` with the
`X-Agentheim-Bridge-Token` header, gated by the discovery response's own `live` boolean (no
separate health probe exists for Herdr, ADR-0082 §3) and `capabilities` array. `kind==='none'`
falls straight to the clipboard with no VS Code discovery attempted. `kind==='vscode'` or
absent/`null` is untouched — every existing `bridge-launch.test.mjs` test (unmodified) still
passes. A new shared `buildLaunchBody` factors the body-construction logic out of both
`runOnBridge` and `runOnHerdr` so the two paths structurally cannot diverge in what `prompt`
(and gated `skipPermissions`/`name`/`model`) they send.

Coverage:
- `dashboard/test/bridge-launch.test.mjs` gained 13 unit tests: the herdr happy path (launches,
  never copies, never touches `/health`/`/run`), skipPermissions/name/model threading gated by
  capabilities, the wire-level omission guarantee when capabilities are absent, the three
  silent-collapse-to-clipboard modes (`live:false`, non-2xx, thrown fetch), `kind:'none'`
  (asserting neither `/health` nor `/run` is ever reached), `kind:'vscode'`/`kind:null` running
  the unmodified path, and `probeBridge`'s dual-kind resolution (herdr live/not-live, none,
  vscode/absent).
- `dashboard/test/board-bridge-herdr-parity-dom.test.mjs` (new) DOM-mounts the real
  `DashboardBoard`/`BoardPromptBar` through `dom-harness.mjs` with a herdr-selected fetch stub,
  one case per launch button named in the task (Quick Capture, Modeling, Refine, Promote,
  per-card Work), asserting each produces a `POST /api/bridge/launch` body whose `prompt` is
  byte-identical to the matching `modeling-command.js` function's output, plus two tests proving
  the model split button renders unlocked/locked correctly against a live/not-live herdr bridge.
- `README.md`'s VS Code bridge `<details>` block gained a short paragraph naming the three-way
  `/setup use bridge <kind>` selection (`vscode`/`herdr`/`none`) and stating the clipboard
  fallback is always the floor regardless of kind, with a new guard test in
  `dashboard/test/readme-docs.test.mjs`.

**Iteration 2 fix (verifier note):** acceptance criterion 1 requires the `kind` dispatch to be
"DOM-tested for all three" kinds — iteration 1 only DOM-tested `herdr` (and relied on the
pre-existing `board-prompt-bar-capability-dom.test.mjs`'s kind-LESS fixtures for the
`vscode`/absent case), leaving `kind:'none'` covered by unit tests alone. Added two DOM tests to
`board-bridge-herdr-parity-dom.test.mjs`: (1) `kind:'none'` mounts the real `BoardPromptBar`
with `/api/bridge` reporting `{present:false, kind:'none'}`, fires Quick Capture, and asserts
every fetch call was to `/api/bridge` alone (never `/health`, `/run`, or `/api/bridge/launch`) —
plus a real `navigator.clipboard.writeText` stub proving the clipboard copy genuinely landed
with the byte-identical prompt, not merely that nothing else fired; (2) an explicit
`kind:'vscode'` fixture (as opposed to the pre-existing suite's kind-absent form) proving the
VS Code discover→probe→run path still fires `POST /run` with the right token and never reaches
`/api/bridge/launch`. No other file in the diff changed.

No new ADR: the design was frozen by the pre-loaded ADR-0082; this task is its frontend
implementation. Full suite run from the worktree: `node --test lib/test/*.test.mjs` (859 tests,
2 pre-existing failures unrelated to this task — `index-entry-length.test.mjs`'s qwfq3 INDEX
entry, and `spike-stop-loss.test.mjs`'s infrastructure-p3k9r backlog item, which the conductor
confirmed is already fixed on `main` but stays red against this worktree's older base) and
`cd dashboard && npm test` (1085 tests, 1 failure — `dist-staleness.test.mjs`, the expected
ADR-0057 artifact from editing `bridge-launch.js`; the conductor rebuilds `dashboard/dist/` at
integration).
