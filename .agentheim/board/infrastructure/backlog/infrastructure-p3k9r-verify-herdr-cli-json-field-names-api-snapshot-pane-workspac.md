---
id: infrastructure-p3k9r
title: Verify Herdr CLI JSON field names (api snapshot pane workspace id, tab/workspace create result shape) against a live install
status: backlog
type: spike
context: infrastructure
created: 2026-09-13
completed:
depends_on: [infrastructure-xh8tw]
blocks: []
tags: [herdr, bridge, launch]
related_adrs: [0082]
related_research: []
prior_art: []
---

## Why

infrastructure-xh8tw's `POST /api/bridge/launch` topology code (`herdr api snapshot` →
matching `tab create`/`workspace create`) infers two JSON shapes that the task's own "ground
truth" notes describe only loosely:

1. Which field on `api snapshot`'s `.result.snapshot.panes[]` entries names the pane's owning
   workspace (the task's Notes confirm `cwd` is present per-pane "plus workspace/tab ids" but
   never names the exact key). The implementation currently reads
   `pane.workspace_id ?? pane.workspace`.
2. The exact `.result` shape of `tab create` / `workspace create` (`.result.tab` /
   `.result.root_pane`, `.result.workspace` / `.result.tab` / `.result.root_pane` per the
   task's notes) — never independently verified against a live `herdr` binary, since every
   `node --test` case uses an injected fake `exec`.

## What

Run the real, currently-verified-present Herdr install (`herdr --version`, `herdr api
snapshot`, `herdr tab create`/`workspace create`) once, by hand or via a small smoke script,
and confirm or correct the field names `dashboard/bridge-launch-api.mjs` reads. Fix the
implementation (and add a regression test fixture built from the REAL captured JSON, not a
hand-guessed one) if any field name is wrong.

## Acceptance criteria

- [ ] The exact key name Herdr uses per-pane to associate it with a workspace is confirmed (or
      corrected) against a real `herdr api snapshot` invocation.
- [ ] The exact `.result` shape of `herdr tab create` and `herdr workspace create` is confirmed
      (or corrected) against real invocations.
- [ ] If either differs from `dashboard/bridge-launch-api.mjs`'s current assumption, the code
      is fixed and at least one `node --test` fixture is rebuilt from real captured JSON.