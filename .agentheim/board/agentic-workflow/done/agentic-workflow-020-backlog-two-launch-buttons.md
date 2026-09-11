---
id: agentic-workflow-020
title: Backlog "Add ticket" becomes two launch buttons — Quick Capture & Modeling — that start a seeded Claude session
status: done
type: feature
context: agentic-workflow
created: 2026-06-14
completed: 2026-06-14
commit: e18e538
depends_on: [infrastructure-012, infrastructure-014, agentic-workflow-019, design-system-001]
blocks: []
tags: [dashboard, board, capture, modeling, launch]
related_adrs: [0001, 0003, 0009]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-016]
---

## Why
Today the backlog add-ticket affordance only **copies** a `/agentheim:modeling`
command to the clipboard (aw-016); the builder then switches to the terminal and
pastes. The builder wants the board to *start the work directly* — and to offer the
two real entry points into the backlog: a fast jot vs. a full modeling session. So
the single "Add ticket" affordance becomes **two buttons**:

- **Quick Capture** → starts `/agentheim:quick-capture` (the fast idea-dump skill,
  renamed in aw-019).
- **Modeling** → starts `/agentheim:modeling` (the full Socratic session).

Each should open a real, interactive Claude session seeded with the command, via the
VS Code bridge (infrastructure-012) — `claude "/agentheim:quick-capture"` /
`claude "/agentheim:modeling"`.

## What
Replace the backlog column's single add affordance with a Quick Capture / Modeling
button pair, wired to launch through the bridge, with a clipboard fallback:

1. **Two-button affordance** in the backlog column (header add-slot and/or the empty
   backlog state). Needs a styleguide button-pair treatment consumed unforked
   (ADR-0003) — may spawn a design-system child task during refine.
2. **Launch via bridge:** each button does a `fetch()` POST to the
   infrastructure-012 listener with its prompt, opening a seeded interactive terminal.
3. **Clipboard fallback (builder's explicit requirement):** if the page is **not**
   running in the VS Code Simple Browser, or the bridge listener is unreachable, the
   buttons fall back to today's behavior — copy the corresponding command to the
   clipboard with the same quiet "copied" feedback. The board must never surface an
   error for an absent bridge; absence is a normal mode, not a failure.

The board stays a projection of disk (ADR-0001): launching a session is an external
side-effect, not a lifecycle write.

## Acceptance criteria
- [ ] The backlog add affordance renders **two** labelled buttons, "Quick Capture" and "Modeling" (replacing the single add-ticket affordance); todo/doing/done are unaffected (their affordances were removed in aw-018).
- [ ] When the bridge is available, **Quick Capture** opens an interactive terminal running `claude "/agentheim:quick-capture"` and **Modeling** runs `claude "/agentheim:modeling"`.
- [ ] When the page is not in VS Code's Simple Browser **or** the bridge is unreachable, each button falls back to copying its command (`/agentheim:quick-capture` / `/agentheim:modeling`) to the clipboard, with the existing quiet "copied" feedback and the existing no-throw clipboard guard (aw-016).
- [ ] Bridge-unavailable is detected gracefully (timeout / connection-refused / not-in-Simple-Browser) and silently degrades to clipboard — no error toast, no console crash, no broken-looking button.
- [ ] The exact launched/copied command strings are produced by pure, unit-tested logic (extends `modeling-command.js`; add the quick-capture command) under `node --test`.
- [ ] The button pair is consumed from the styleguide unforked (ADR-0003); the board does not fork the primitive.
- [ ] The dashboard `dist/` is rebuilt so the served bundle carries the change.

## Notes
- **Depends on:** infrastructure-012 (ADR-0018 — the frozen bridge contract: port,
  token, `bridge.json`, the absence-detection probe), infrastructure-014 (the
  dashboard `GET /api/bridge` endpoint this frontend fetches to discover the bridge),
  aw-019 (so the Quick Capture command is `/agentheim:quick-capture`), and
  design-system-001 (styleguide gate; frontend). It does **not** depend on
  infrastructure-013 (the extension `.vsix`): an absent extension is a normal, tested
  mode for the frontend (clipboard fallback), so this can ship before the extension exists.
- Evolves aw-016 (`prior_art`): reuses its `copyToClipboard` no-throw guard and its
  pure command-builder as the **fallback** path; the new primary path is the bridge.
- Bridge-detection contract (port, token, how the frontend probes presence) is owned
  by infrastructure-012's ADR — refine this task after that contract is pinned.
- Open for refine: exact placement of the two buttons (header add-slot vs. the empty
  backlog card vs. both), and whether the per-card backlog copy button (aw-016) stays
  as-is or also gains a launch path. Research backing the launch mechanism:
  `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome
The backlog column's single add-ticket `+` is replaced by **two labelled launch
buttons** — **Quick Capture** (`/agentheim:quick-capture`) and **Modeling**
(`/agentheim:modeling`) — each of which opens a real, interactive Claude session
through the VS Code bridge (ADR-0018), with a silent clipboard fallback when the
bridge is absent for **any** reason. All 7 acceptance criteria met; full dashboard
suite green (217 tests), dist rebuilt.

**Design decisions (within scope, per the task's "open for refine" notes):**
- **Button placement:** the pair renders as a board-composed **sibling** of the
  styleguide `ColumnHeader` for the backlog column — the same precedent as the sort
  / group controls. The styleguide `kanban.js` / `empty.js` are consumed **unforked**
  (ADR-0003); these are native, token-styled board controls beside the primitive, not
  a fork of it. No new styleguide primitive was needed, so **no design-system child
  task** was filed.
- **Per-card backlog Copy button (aw-016) left as-is** — it keeps copying
  `/agentheim:modeling <id>` (the per-ticket refine affordance). Only the
  *column-level* add affordance became the launch pair.
- **No new ADR:** the launch path is fully decided by ADR-0018; this task only
  composes existing primitives against the frozen contract (like aw-016 / infra-013/014).

**Key files:**
- `dashboard/app/bridge-launch.js` (new) — pure, framework-free `launchOrCopy`:
  discover (`GET /api/bridge`) → probe (`GET /health`, ~800 ms timeout) → launch
  (`POST /run { prompt }` with `X-Agentheim-Bridge-Token`) → else copy. Never throws.
- `dashboard/test/bridge-launch.test.mjs` (new) — 15 `node --test` cases covering the
  happy launch path, the request shapes (token header, JSON body, port), and **every**
  fallback mode (present:false, /api/bridge throw/non-200, /health refuse/401/timeout,
  /run non-2xx/CORS-throw, missing fields, no fetch, copy-also-fails).
- `dashboard/app/modeling-command.js` — added `QUICK_CAPTURE_COMMAND`
  (`/agentheim:quick-capture`); existing `MODELING_COMMAND` / `modelingCommandFor`
  unchanged.
- `dashboard/test/modeling-command.test.mjs` — extended with quick-capture coverage.
- `dashboard/app/board.js` — new `LaunchButton` + `BacklogLaunchPair` React glue
  (thin over `launchOrCopy`, supplying `window.fetch` + aw-016 `copyToClipboard`);
  backlog `ColumnHeader`/`EmptyColumn` no longer get the old clipboard `onAdd`.
- `dashboard/dist/` — rebuilt so the served bundle carries the change.
- `.agentheim/contexts/agentic-workflow/README.md` — documented the two launch
  buttons and the bridge launch/fallback path.
</content>
