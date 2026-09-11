---
id: agentic-workflow-010
title: Dashboard cross-OS verification — POSIX leg
status: done
type: spike
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-08
commit: 06f0ac0
depends_on: [agentic-workflow-001, infrastructure-004]
blocks: []
tags: [dashboard, cross-os, posix, verification, runtime]
related_adrs: [ADR-0002, ADR-0004]
related_research: []
prior_art: [agentic-workflow-004]
---

## Why

The dashboard runtime (ADR-0002) must work on the builder's Windows box **and** at least one
POSIX OS (macOS/Linux). The aw-001 integration epic verified end-to-end on Windows only; the
POSIX leg was carved out into this spike.

**This spike has now largely fired.** On 2026-06-08 a macOS contributor ran the POSIX leg and
reported an effectively clean full pass — detached launch, runfile, SSE, `/api/tree`, and the
end-to-end flow all behaved as on Windows. The run also surfaced exactly the kind of POSIX/
foreign-environment divergence this spike existed to catch: `defaultAssetRoot` resolves `dist/`
against the *discovered project root* instead of module-relative, so the installed plugin can't
find its built assets against a foreign project (404 "dist absent"). That bug was carved out as
**infrastructure-004** (and a stale version bump as infrastructure-005).

So the remaining work is no longer "go run the whole POSIX leg" — it's "land the one fix the
leg surfaced and re-verify it on POSIX, then close." aw-010 is **not done until
infrastructure-004 is fixed and its asset-serving path is re-checked on a POSIX OS** — hence the
added dependency.

## What

Treat the macOS clean-pass as the body of the POSIX verification. Then:

1. Wait for **infrastructure-004** (module-relative `defaultAssetRoot`) to be fixed.
2. Re-run the affected path on a POSIX OS: launch the dashboard *as the installed plugin against
   a foreign project* and confirm `dist/` assets are served (no "dist absent" 404) in addition
   to the in-repo run that already passed.
3. Record the verification outcome (Windows + POSIX parity) in the BC README / an ADR addendum
   if the documented runtime contract (ADR-0002 / ADR-0004) shifts.

The single `launch.mjs` confines OS differences to `spawn` options, the kill path, and the
browser-open step (aw-011) — that remains where any residual regression would live.

## Acceptance criteria

### Confirmed on macOS, 2026-06-08 (full clean pass — re-state, don't re-run from scratch)
- [x] `dashboard` launches the detached server on POSIX: terminal returns, server reachable on
      the `127.0.0.1` ephemeral port recorded in the runfile.
- [x] `dashboard stop` terminates the detached process and removes the runfile on POSIX.
- [x] Project discovery (walk-up for `.agentheim/`) and the `AGENTHEIM_ROOT` / neutral-cwd
      contract (ADR-0004) behave as on Windows for the in-repo run.
- [x] End-to-end flow on POSIX: launch → board → open artifact in slide-over → board
      live-updates on a disk move → drag `backlog→todo` Promotes.
- [x] The dashboard test suite (lib + dashboard) runs green on the POSIX OS.

### Remaining before this task moves to done
- [x] **infrastructure-004 is fixed** (module-relative `defaultAssetRoot`) and merged.
- [x] With that fix in place, the **installed plugin against a foreign project** serves `dist/`
      assets on a POSIX OS — no "dist absent" 404 (the one divergence this spike caught).
- [x] Verification outcome (Windows + POSIX parity, and the infra-004 resolution) is captured in
      the BC README / an ADR addendum if it changes the documented runtime contract.

## Notes

- **Final re-check still needs a POSIX box.** The residual acceptance is environmental — a
  Windows-only worker can land the dependency bookkeeping but cannot tick the foreign-project
  asset-serving re-check. Coordinate with a POSIX contributor (the same one who ran the leg, if
  available) for that last confirmation.
- Governing decisions: ADR-0002 (Node-stdlib localhost transport, detached launch, walk-up
  discovery), ADR-0004 (neutral cwd + `AGENTHEIM_ROOT`).
- Spawned by this spike: **infrastructure-004** (the assetRoot fix — now a `depends_on`) and
  **infrastructure-005** (version bump, independent). See protocol 2026-06-08.
- Prior art: aw-004 (server bootstrap) built and Windows-verified the launcher/server this task
  re-verifies on POSIX.

## Outcome

Windows + POSIX parity for the dashboard runtime is confirmed. The macOS contributor's
2026-06-08 clean pass covered detached launch, runfile, `stop`, walk-up discovery, the
`AGENTHEIM_ROOT`/neutral-cwd contract, the end-to-end board/slide-over/live-update/Promote
flow, and a green test suite — matching the Windows leg.

The single divergence the spike existed to catch — `defaultAssetRoot` resolving `dist/`
against the *discovered project root* instead of module-relative, so the installed plugin
404'd ("dist absent") on a foreign project — was carved out as **infrastructure-004** and
fixed by making `defaultAssetRoot` module-relative (commit 716c7f0). The contributor then
**re-ran the foreign-project asset path on a POSIX OS with that fix in place and confirmed
the built `dist/` assets are served — no 404.** Sibling **infrastructure-005** (commit
41fabcb) bumped the plugin to 0.8.0.

No ADR addendum was written: infrastructure-004 was a bug-fix that *restored* the documented
asset-serving contract of **ADR-0002** (plugin-relative assets) — the root-cause class is
the cwd-decoupling already described in **ADR-0004** — so neither runtime contract shifted.

Key references: infrastructure-004 (`.agentheim/contexts/infrastructure/done/`), commit
716c7f0; the launcher/server under `dashboard/` (`launch.mjs`, `serve.mjs`, `server.mjs`)
built in aw-004.
</content>
</invoke>
