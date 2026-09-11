---
id: design-system-011
title: Stale add-affordance test — styleguide suite asserts against dashboard board.js that has dropped onAdd
status: done
type: bug
context: design-system
created: 2026-06-15
completed: 2026-06-16
commit: 076870b
depends_on: []
blocks: []
tags: [styleguide, test, dashboard, tech-debt]
related_adrs: [0003]
related_research: []
prior_art: [agentic-workflow-018]
---

## Why

`.agentheim/contexts/design-system/styleguide/test/add-affordance.test.mjs`
(added by `agentic-workflow-018`) reaches ACROSS the BC boundary: it reads the
dashboard source (`dashboard/app/board.js`, via a five-`..` `REPO` hop) to assert
the board hands `EmptyColumn` an `onAdd` only for the backlog column. The board no
longer references `onAdd` at all (`grep -c onAdd dashboard/app/board.js` → 0), so
the test now fails:

> ✖ the board supplies onAdd to EmptyColumn ONLY for backlog
> AssertionError: the board must pass onAdd into EmptyColumn (so backlog keeps its affordance)

The failure is **pre-existing** (present on `main` before `design-system-009`) and
unrelated to the Drawer-header change; it surfaced while running the styleguide
suite for ds-009. One stale assertion fails; the other 37 styleguide tests pass.

## What

**Resolved during refinement (2026-06-15): the board dropped `onAdd` on purpose —
outcome (1), delete the stale board assertions. No board wiring is restored.**

Ground truth confirmed against the source:

- `dashboard/app/board.js` renders `<${ColumnHeader} … />` and `<${EmptyColumn}
  status=… />` with **no `onAdd`** (zero `onAdd` refs in the file). The
  styleguide-owned guard (`empty.js` / `kanban.js` gate the affordance behind
  `onAdd &&`) is intact and correct.
- The drop was **deliberate**, not refactor drift. Prior art
  `agentic-workflow-018` is titled *"remove dead add-ticket affordances"*; the
  aw-016 wiring that passed `onAdd` only for backlog was then fully **superseded**
  by the board-level **prompt bar** (Quick Capture / Modeling / Research launch
  buttons — aw-023+) and the per-backlog-card **Refine / Promote** launch pair
  (aw-022). The dashboard is a read-only projection of disk (ADR-0001 / ADR-0017):
  you no longer "add" a ticket from an inline button — you launch a modeling
  session. So the old `onAdd` affordance is obsolete, not missing.
- The replacement IS already covered on the right side of the boundary: the
  dashboard suite (`dashboard/test/`) carries `board-prompt-bar.test.mjs` and
  `backlog-card-launch.test.mjs`. Nothing new needs to be asserted there.

The fix, therefore:

1. Delete the two `Board:` tests from `add-affordance.test.mjs` (`the board
   supplies onAdd to EmptyColumn ONLY for backlog` and `the board no longer hands
   ColumnHeader a no-op onAdd for non-backlog columns`) — both reach across the BC
   boundary and are now obsolete.
2. Delete the cross-boundary plumbing they need: the `boardSrc` read and the
   `REPO` path constant (and the now-unused `readFileSync`/`join` imports only if
   they become unused — `emptySrc`/`kanbanSrc` still use them, so they stay).
3. Update the file's header comment so it no longer describes board-side wiring —
   the suite now documents only the styleguide-owned `onAdd`-guard contract.
4. Keep the four EmptyColumn / ColumnHeader source-guard tests unchanged.

This removes the ADR-0003 smell (a **design-system** test reading **dashboard**
source): the styleguide suite ends up asserting only on styleguide source, and
consumer-wiring assertions live in the dashboard suite where they already are.

The entire fix edits one **design-system-owned** file, so this stays a
design-system task — no agentic-workflow work, settling the "fix's home BC is a
refinement call" note below.

## Acceptance criteria

- [ ] `node --test` under `.agentheim/contexts/design-system/styleguide/` is green
      — the two stale board assertions are gone, the remaining 37 still pass.
- [ ] `add-affordance.test.mjs` no longer reads `dashboard/app/board.js` (no
      `boardSrc` / `REPO` cross-boundary hop); it imports/reads only styleguide
      source under `styleguide/app/`.
- [ ] The styleguide-owned contract is still covered: EmptyColumn accepts an
      optional `onAdd` and renders the "Add ticket" button only behind `onAdd &&`;
      ColumnHeader renders its `+` only behind `onAdd &&`.
- [ ] The file header comment describes only the styleguide guard contract, with
      no board-wiring narration.

## Notes

- Surfaced by `design-system-009` (worker note): the failure is independent of the
  Drawer-header change.
- Refinement (2026-06-15) resolved the open decision by inspecting the source:
  board has zero `onAdd` refs; aw-018 (`remove dead add-ticket affordances`),
  aw-022 (per-card launch pair), aw-023+ (prompt bar) collectively superseded the
  inline add affordance. No agentic-workflow restoration is needed; the consumer's
  add story is already tested in `dashboard/test/{board-prompt-bar,backlog-card-launch}.test.mjs`.

## Outcome

Removed the ADR-0003 smell: the styleguide `add-affordance.test.mjs` no longer
reaches across the BC boundary into dashboard source. The suite now asserts only
the styleguide-owned `onAdd &&` guard contract on `EmptyColumn` and `ColumnHeader`.

- `styleguide/test/add-affordance.test.mjs`: deleted the two cross-boundary
  `Board:` assertions and the `boardSrc` read + `REPO` path constant. Kept the four
  EmptyColumn / ColumnHeader source-guard tests. Rewrote the header comment to
  describe only the styleguide guard contract (consumer wiring is the dashboard
  suite's concern). `readFileSync` / `join` remain — still used by
  `emptySrc` / `kanbanSrc`.
- `node --test` under `styleguide/`: 36 pass, 0 fail (was 1 stale failure + 37).

Consumer add story remains covered on the right side of the boundary in
`dashboard/test/{board-prompt-bar,backlog-card-launch}.test.mjs` — no new
assertions needed there.
