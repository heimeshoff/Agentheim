---
id: agentic-workflow-021
title: Dashboard armed-launch setting — all bridge launches skip permissions when armed
status: done
type: feature
context: agentic-workflow
created: 2026-06-14
completed: 2026-06-15
commit: 0a6275a
depends_on: [infrastructure-015, infrastructure-016, design-system-001]
blocks: []
tags: [dashboard, board, settings, permissions, launch]
related_adrs: [0019, 0018, 0015, 0001, 0017, 0003]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-020, agentic-workflow-022, agentic-workflow-017, agentic-workflow-016]
---

## Why
The dashboard's bridge launch buttons start a real, interactive `claude` session with
normal per-action permission prompts. The builder wants a **setting they can arm** so
those launches use `--dangerously-skip-permissions` — for an uninterrupted session —
without that bypass ever being the default or silently on. The contract that makes this
possible now exists end-to-end: infrastructure-015 froze the opt-in `skipPermissions`
field on `POST /run`, and infrastructure-016 made the extension honour it. This task is
the dashboard-side toggle plus the ADR-mandated per-launch indicator.

## What
Add a persisted dashboard setting (toggle), **off by default**, that — when armed —
makes **every** bridge launch request a skip-permissions launch.

1. **Persisted "armed" toggle.** A new `dashboard/app/skip-permissions-state.js`, a
   **sibling** of `theme-state.js` (aw-017) / `board-view-state.js` (aw-014, ADR-0015):
   a single versioned `localStorage` key (default OFF), pure over an injected storage
   backend, safe-degrading (malformed / stale-version / absent blob → OFF, never a
   throw). It is presentation view-state only — never a disk lifecycle write — so the
   dashboard stays read-only over `.agentheim/` (ADR-0017 / ADR-0001) and the choice
   survives every SSE re-projection untouched.

2. **Threads the flag through the one shared seam.** `launchOrCopy`
   (`dashboard/app/bridge-launch.js`) gains an optional `skipPermissions` argument that,
   when `true`, is included in the `POST /run` body (`{ prompt, skipPermissions: true }`);
   the bridge (infrastructure-016) then seeds `claude --dangerously-skip-permissions
   "<prompt>"`. Because **both** the column launch buttons (Quick Capture / Modeling,
   aw-020) **and** the per-card Refine / Promote buttons (aw-022) already call
   `launchOrCopy`, threading the armed flag at this single seam makes **all four** bridge
   launches honour the toggle — "all bridge launches", per the refinement decision.

3. **Shell-header armed toggle (decided in refine).** The control lives in the
   `ShellRail` header next to the theme toggle (aw-017 precedent), **not** a new settings
   panel — there is one setting today. It carries an **armed / danger** visual treatment
   so it never reads as a neutral preference. Built **board-local** from existing
   styleguide tokens, consumed unforked (ADR-0003) — **no** new design-system child task
   (refinement decision). The armed treatment must **not** reuse the styleguide's
   reserved selection accent (ADR-0016); pick an existing danger/warning token, or, if
   none exists, a board-local one — and flag it for the design-system README so an ad-hoc
   danger colour can be reconciled later rather than silently forked.

4. **Per-launch indicator (mandated by amended ADR-0018).** When the toggle is armed,
   **each** of the four launch buttons must carry an at-a-glance cue that *this launch*
   will skip permissions — the conscious moment is each launch, not the one-time arm. The
   indicator reflects the **toggle's armed state** (not a live bridge probe): when the
   bridge is absent the launch silently falls back to a clipboard copy that *cannot*
   carry the flag (see criterion below), so the indicator signals armed **intent**; the
   bridge-present/absent asymmetry is accepted (ADR-0018), not a defect. Do not make the
   indicator probe `/api/bridge` on render — that would violate the silent-absence
   contract and add a probe to every paint.

## Acceptance criteria
- [ ] A shell-header toggle exists, **default OFF**, persisted across reloads via a versioned `localStorage` store (`skip-permissions-state.js`) that safe-degrades to OFF on malformed/stale/absent data.
- [ ] With the toggle **ON** and the bridge available, **all four** bridge launches — Quick Capture, Modeling (aw-020), and per-card Refine / Promote (aw-022) — POST `{ prompt, skipPermissions: true }`, so the bridge seeds `claude --dangerously-skip-permissions "<prompt>"`.
- [ ] With the toggle **OFF**, every launch is byte-identical to today (`POST /run { prompt }` → `claude "<prompt>"`); the `skipPermissions` field is omitted, not sent `false`.
- [ ] The clipboard fallback does **not** carry the bypass (it copies a slash command to paste into a *running* session; `--dangerously-skip-permissions` is startup-only). The bridge-present/absent asymmetry is accepted, not a defect (amended ADR-0018).
- [ ] When the toggle is ON, **each** of the four launch buttons shows an at-a-glance per-launch "skips permissions" indicator (reflecting the armed toggle state, not a live bridge probe).
- [ ] The armed toggle and per-launch indicator use an **existing** styleguide token consumed unforked (ADR-0003), and do **not** reuse the reserved selection accent (ADR-0016); any new danger colour is flagged for the design-system README (no new design-system child task — refinement decision).
- [ ] The store and the `launchOrCopy` option-threading are covered by **pure** unit tests under `node --test`, exercising both armed states (and the omit-not-false body shape).
- [ ] The dashboard `dist/` is rebuilt so the served bundle carries the change.

## Notes
- **Dependencies — all met:** infrastructure-015 (frozen `skipPermissions` contract,
  commit 54c242a, done), infrastructure-016 (extension honours it, commit 1ad7d46, done),
  design-system-001 (styleguide gate, approved — done). This is why the task is promotable.
- **Refinement decisions (2026-06-15):** (1) toggle governs **all** bridge launches, not
  just the two column buttons — aw-022 added per-card bridge launches *after* this task was
  written; (2) the toggle lives as a **shell-header** control with an armed treatment, not
  a settings panel; (3) the per-launch indicator is built **board-local / unforked**, with
  **no** new design-system child task.
- **One-seam change:** because aw-020 and aw-022 both call `launchOrCopy`
  (`dashboard/app/bridge-launch.js`), the flag is threaded once at `launchOrCopy` →
  `runOnBridge`, not per-button. The current `runOnBridge` posts `{ prompt }`; add
  `skipPermissions` to the body only when strictly armed (omit otherwise, to keep the OFF
  path byte-identical and match the contract's strict-`true` activation in ADR-0018).
- **Store precedent to mirror:** `theme-state.js` (key `agentheim.dashboard.theme`,
  `version` envelope, injected storage backend, no-throw load/save) — copy its shape for
  `agentheim.dashboard.skipPermissions` (boolean, default OFF).
- **Styleguide gate honoured:** frontend task, design-system-001 done; any UI control is
  consumed from the styleguide unforked (ADR-0003).
- Evolves aw-020 / aw-022 (`prior_art`): same launch path, now parameterised by the armed
  setting. Reuses aw-017's pattern for wiring a persisted UI control into the shell header.

## Outcome

Shipped the dashboard-side armed skip-permissions setting, off by default, governing all four
bridge launches through the one shared `launchOrCopy` seam.

- **New persisted store** `dashboard/app/skip-permissions-state.js`
  (`SKIP_PERMISSIONS_KEY = agentheim.dashboard.skipPermissions`, `SKIP_PERMISSIONS_VERSION`,
  `loadSkipPermissions`, `saveSkipPermissions`): a sibling of `theme-state.js`, a single
  versioned `localStorage` key, default OFF, every degraded path (malformed / stale / absent /
  non-boolean / no backend / throwing backend) resolving to OFF — never a throw, never silently
  on. Pure, unit-tested in `dashboard/test/skip-permissions-state.test.mjs` (10 tests).
- **Flag threaded through one seam** — `launchOrCopy` (`dashboard/app/bridge-launch.js`) gained an
  optional `skipPermissions` arg; `runOnBridge` posts `{ prompt, skipPermissions: true }` ONLY on
  strict-`true`, OMITS the field otherwise (never `false`). Covered by 4 new pure tests in
  `dashboard/test/bridge-launch.test.mjs` (armed body, omit-not-false for absent/false, strict-true
  rejection of truthy-not-true, clipboard-never-carries-bypass).
- **React wiring** (`dashboard/app/board.js`): `DashboardApp` owns the armed state (lazy one-time
  read, persisted on change) and threads it through `DashboardBoard → BoardColumn → BoardCard /
  launch pairs → LaunchButton`. New shell-header `SkipPermissionsToggle` (armed/danger treatment)
  beside the theme toggle. When armed, each launch button carries a per-launch danger indicator (an
  `--obligation` border + dot) reflecting the toggle state, not a live bridge probe.
- **Danger hue** = the existing styleguide `--obligation` family, consumed unforked (ADR-0003), NOT
  the reserved selection accent (ADR-0016). Decision recorded in **ADR-0019**, which also flags the
  money-named-token repurposing for the design-system README to reconcile (no new design-system child
  task, per the refinement decision).
- `dist/` rebuilt (`npm run build`); bundle carries `skipPermissions` + `--obligation`. Full suite:
  240/240 pass.

Key files: `dashboard/app/skip-permissions-state.js`, `dashboard/app/bridge-launch.js`,
`dashboard/app/board.js`, `dashboard/test/skip-permissions-state.test.mjs`,
`dashboard/test/bridge-launch.test.mjs`, `.agentheim/knowledge/decisions/0019-dashboard-armed-launch-danger-token.md`.

**For the design-system README (flagged for the orchestrator):** add a one-liner that `--obligation`
is now also consumed by the agentic-workflow dashboard as its generic danger hue (armed skip-permissions
treatment, ADR-0019) — a candidate to reconcile into a properly-named `--danger` token/alias later.
