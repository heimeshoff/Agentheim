---
id: agentic-workflow-016
title: Backlog cards and the add-ticket button copy the matching /modeling command to the clipboard
status: done
type: feature
context: agentic-workflow
created: 2026-06-09
completed: 2026-06-09
commit: 67ade09
depends_on: [design-system-001, design-system-006]
blocks: []
tags: [dashboard, board, clipboard]
related_adrs: [0003, 0009]
related_research: []
prior_art: [agentic-workflow-006, agentic-workflow-012]
---

## Why
The dashboard board is read-mostly: its one write is drag `backlog→todo` to Promote
(aw-009). But the builder's actual next action on a *backlog* (unrefined) ticket is to
**refine** it — by running `/agentheim:modeling <id>` in the Claude Code terminal.
Today that means hand-typing the command and the task id. Meanwhile every card shows a
dead "— pt" chip (the projection carries no estimate). This task repurposes that dead
bottom-right slot on backlog cards into a one-click "copy the command I'm about to run"
affordance: the builder clicks the card's button, switches to the terminal, and pastes
the exact `/agentheim:modeling <id>`.

## What
Using the styleguide `TicketCard` corner-action slot (design-system-006), wire the
board so:

1. **Backlog cards** render a small copy button in the bottom-right (where "— pt"
   was). Clicking it writes `/agentheim:modeling <task-id>` to the system clipboard
   (e.g. `/agentheim:modeling agentic-workflow-016`) with brief copied feedback. It
   must **not** open the slide-over (the card's own click).
2. **The backlog column's add-ticket `+` button** (the styleguide `ColumnHeader`
   `onAdd`, currently a board-side no-op) copies the bare `/agentheim:modeling` to
   the clipboard.
3. **Other columns** (todo / doing / done) get **no** corner action and no dead
   "— pt" chip (the latter falls out of design-system-006 dropping the empty
   estimate chip).

The board stays a projection of disk — this adds no lifecycle write, only a clipboard
side-effect.

## Acceptance criteria
- [ ] Each card in the **backlog** column shows a copy button in the meta row's bottom-right (the former estimate-chip slot); todo/doing/done cards do not.
- [ ] Clicking a backlog card's button writes exactly `/agentheim:modeling <id>` (the card's task id) to the clipboard and does **not** emit the open-this-task intent / open the slide-over.
- [ ] The backlog column's add-ticket `+` button writes exactly `/agentheim:modeling` (no id) to the clipboard.
- [ ] The button gives brief, quiet "copied" feedback (e.g. a transient icon/label swap), consistent with the styleguide.
- [ ] Clipboard write uses `navigator.clipboard.writeText` with a graceful, no-throw fallback when the API is unavailable/blocked — the board must never crash or surface an error for a failed copy.
- [ ] No "— pt" chip renders on any board card (inherited from design-system-006).
- [ ] The pure board-side logic that builds the copied string is unit-tested under `node --test` (id → `/agentheim:modeling <id>`; add-button → bare `/agentheim:modeling`).
- [ ] The dashboard `dist/` is rebuilt so the served bundle carries the change.

## Notes
- Depends on design-system-006 (the in-card corner-action slot + dropping the dead
  estimate chip). The button is supplied *to* the styleguide card via that slot — the
  dashboard does not fork `TicketCard` (ADR-0003).
- Command text confirmed with the builder: the **fully-qualified** `/agentheim:modeling`
  (not the bare `/modeling` alias), so the paste resolves regardless of alias setup.
- "Copy into memory" in the capture = the **system clipboard** (for Ctrl+V), not
  Agentheim's `.agentheim/` memory.
- Scope confirmed: the add-ticket button is wired for the **backlog** column; the same
  `+` exists on every column header (board-side `onAdd`), but only backlog copies
  `/agentheim:modeling` for now.
- Once design-system-006 lands, `board-data.js`'s `est: '—'` placeholder becomes
  irrelevant (the styleguide hides an empty estimate); it can be dropped or left as a
  harmless no-op — the worker's call.
- Prior art: aw-006 (the board view this extends), aw-012 (the board-local per-column
  control precedent).

## Outcome
The backlog refine command is now one click to copy. Implemented as a pure
string-builder plus a thin React shell over the styleguide card, consumed
unforked (ADR-0003).

- **`dashboard/app/modeling-command.js`** (new) — pure, framework-free builder:
  `MODELING_COMMAND` (`/agentheim:modeling`, fully-qualified, not the `/modeling`
  alias) and `modelingCommandFor(id)` → `"/agentheim:modeling <id>"` for a real
  (trimmed) id, else the bare command. A missing/empty/whitespace/non-string id
  degrades to the bare command — never `[object Object]`, never a throw.
- **`dashboard/test/modeling-command.test.mjs`** (new) — `node --test` unit tests
  for the builder (id → qualified+id, add-button → bare, degradation, trimming).
- **`dashboard/app/board.js`** — added `copyToClipboard(text)` (graceful no-throw
  `navigator.clipboard.writeText` wrapper, returns `Promise<boolean>`),
  `CopyCommandButton` (transient "Copy"→"Copied" label swap, token-styled), and
  wired them: backlog `DraggableCard`s pass a `cornerAction` returning the button
  (`/agentheim:modeling <id>`); the backlog `ColumnHeader`'s `onAdd` copies the
  bare command; todo/doing/done pass no `cornerAction` and no `onAdd` copy.
- **`dashboard/dist/app.js`** — rebuilt (`node build.mjs`) so the served bundle
  carries the change; verified the command string is in the bundle.

The `est: '—'` placeholder in `board-data.js` is left untouched — design-system-006's
`showEstimate()` already hides the chip for `'—'`, so it is a harmless no-op and
the styleguide owns the placeholder constant (no drift risk).

No ADR written: this extends ADR-0003 (styleguide consumed unforked) and ADR-0009
(dashboard app consumes the styleguide; `cornerAction` is the ds-006 slot) — no new
architectural decision. The board adds only a clipboard side-effect; it remains a
pure projection of disk (ADR-0001). Full dashboard suite green (183 tests).
