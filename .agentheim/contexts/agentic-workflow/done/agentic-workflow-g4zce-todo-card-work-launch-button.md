---
id: agentic-workflow-g4zce
title: Todo cards get a Work launch button seeded with the ticket id — `/agentheim:work <id>` for exactly that task
status: done
type: feature
context: agentic-workflow
created: 2026-09-05
completed: 2026-09-05
depends_on: [agentic-workflow-swj2q, design-system-001]
blocks: []
tags: [dashboard, board, todo-card, launch-button, work, bridge]
related_adrs: [0017, 0018, 0003]
related_research: []
prior_art: [agentic-workflow-022, agentic-workflow-024, agentic-workflow-048, agentic-workflow-064]
---

## Why

The board's only way to start execution is the topbar **Work** button, which launches
the bare `/agentheim:work` and therefore dispatches the whole ready set. Backlog cards
already carry a per-card Refine / Promote launch pair (agentic-workflow-022) in the
styleguide card's bottom-right `cornerAction` slot; todo cards pass no `cornerAction`
and render the slot empty. The builder wants the symmetric affordance on todo: click
**Work** on one card and a terminal opens running `/agentheim:work <that-id>` — one
worker, that task only.

This depends on agentic-workflow-swj2q, which gives `work` the argument contract the
button seeds. Shipping the button first would launch a command the skill does not
promise to honour.

## What

- `dashboard/app/modeling-command.js` gains `workCommandFor(id)` — the same pure,
  never-throwing builder shape as `refineCommandFor` / `promoteCommandFor` /
  `dismissCommandFor` (shared `safeId`): `"/agentheim:work <id>"` for a real id, the
  bare `WORK_COMMAND` for a missing/blank/non-string id. `WORK_COMMAND` itself is
  untouched — the topbar keeps launching the bare command.
- `dashboard/app/board.js`: `BoardCard` passes a `cornerAction` for `status === "todo"`
  rendering a single `LaunchButton` labelled **Work** (primary emphasis, trailing ↗
  like the topbar Work button, agentic-workflow-064) whose `command` is
  `workCommandFor(ticket.id)`. It threads `skipPermissions` exactly like the backlog
  pair (aw-021/ADR-0019 armed cue), reuses `launchOrCopy` (bridge launch, clipboard
  fallback per ADR-0018), and lives inside the click-isolated slot so launching never
  opens the slide-over. Backlog / doing / done cards are unchanged.
- The aw-048 top-right trash can keeps working on todo cards and must not collide
  visually with the new bottom-right button (the backlog card already proves the two
  coexist).
- The board stays a projection of disk (ADR-0001/ADR-0017): the button adds a launch
  side-effect only, no lifecycle write.

## Acceptance criteria

- [ ] `workCommandFor("agentic-workflow-abcde")` returns
      `"/agentheim:work agentic-workflow-abcde"`; blank / whitespace / non-string
      input returns the bare `WORK_COMMAND`; a padded id is trimmed (no doubled
      space). Unit-tested under `node --test` next to the existing builders.
- [ ] Todo cards render exactly one bottom-right **Work** launch button in the
      `cornerAction` slot; backlog cards still render Refine + Promote; doing and
      done cards render no cornerAction. DOM-tested like
      `dashboard/test/backlog-card-launch.test.mjs`.
- [ ] Clicking Work fires `launchOrCopy` with `prompt === workCommandFor(id)` and
      the current `skipPermissions` value; the click does not open the slide-over.
- [ ] Armed skip-permissions shows the same per-launch cue on this button as on
      the backlog pair; the button's tooltip / aria-label names the exact command.
- [ ] The trash can and the Work button are both reachable on a todo card without
      overlap (existing hover-reveal and layout untouched).
- [ ] The topbar Work button still launches the bare `/agentheim:work`.
- [ ] `dashboard/dist/` is rebuilt by the conductor at integration (ADR-0057 — a
      worker never stages dist); the dist-staleness check is green on main.
- [ ] BC README's board section documents the todo-card Work affordance in one
      short paragraph next to the backlog Refine/Promote text.
- [ ] `[human-eye]` The builder clicks Work on a todo card and a terminal opens
      with `/agentheim:work <that-id>` seeded.

## Notes

- Styleguide gate: consumes `LaunchButton` and the ds-006 `cornerAction` slot as-is —
  no new design-system primitive, no fork (ADR-0003).
- Label choice: "Work" (matches the topbar verb). If the builder prefers "Work on
  this", change only the label constant — the command is what matters.
- ADR-0059 disposition: no new convention introduced — this consumes the existing
  `cornerAction` slot, `LaunchButton`, `launchOrCopy`, and the `refineCommandFor`-shaped
  pure-builder pattern as-is (per Notes above). No lint expected, none added.

## Outcome

Todo cards now carry a bottom-right **Work** launch button (`cornerAction` slot,
mirroring the backlog Refine/Promote pair) that seeds the scoped-run grammar
ADR-0071 gave `/agentheim:work` — `/agentheim:work <id>` runs exactly that task,
never the whole ready set the topbar's bare Work button dispatches.

- `dashboard/app/modeling-command.js` — added pure `workCommandFor(id)`, mirroring
  the shared `safeId` trim/degrade contract (padded id trimmed, blank/non-string
  degrades to the bare `WORK_COMMAND`). No verb sub-command (unlike
  refine/promote/dismiss) — the id is appended directly, mirroring
  `quickCaptureCommandFor`'s shape.
- `dashboard/app/board.js` — new `TodoCardLaunch` component: a single primary-emphasis
  `LaunchButton` labelled "Work" with a trailing `square-arrow-out-up-right` glyph
  (matching the topbar Work restyle, agentic-workflow-064), `isolateClick` +
  `liftOnHover`, threading `skipPermissions`. `BoardCard`'s `cornerAction` now
  branches `backlog` → `BacklogCardLaunchPair`, `todo` → `TodoCardLaunch`, else
  `undefined`. The existing top-right `CardTrashCan` overlay (aw-048) is untouched
  and coexists with the new bottom-right button (top-right vs. bottom-right, no
  overlap). The topbar's bare `WORK_COMMAND` launch (aw-024) is unchanged.
- Tests (TDD, red→green): `dashboard/test/modeling-command.test.mjs` (+5 cases for
  `workCommandFor`) and a new `dashboard/test/todo-card-launch.test.mjs` (6 static
  board-glue guards, mirroring `backlog-card-launch.test.mjs`'s source-reading
  idiom — this project has no DOM render harness for board.js).
- `dashboard/dist/` rebuilt via `npm run build` so the local/verifier suite's
  dist-staleness check is green; the conductor performs the sanctioned rebuild on
  `main` at integration (ADR-0057).
- `.agentheim/contexts/agentic-workflow/README.md` — added a "Todo card launch
  (Work)" paragraph next to the backlog Refine/Promote entry.
- Full suite: `cd dashboard && node --test` → 967 passing (was 956; +11: 5
  `workCommandFor` cases + 6 `todo-card-launch` guards). `node --test
  lib/test/*.test.mjs` from the worktree root → 385 passing, unaffected (no `lib/`
  files touched).
- No ADR written — this consumes ADR-0003/0017/0018/0071 and the existing
  `cornerAction`/`LaunchButton`/`launchOrCopy` shapes unchanged (see Notes' ADR-0059
  disposition).
- `[human-eye]` left unchecked — the builder still needs to click Work on a real
  todo card in VS Code and confirm the seeded terminal.
