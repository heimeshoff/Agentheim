---
id: agentic-workflow-024
title: Board prompt bar — textarea to two-thirds width, Work launch button on the right
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: b16022d
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, bridge, ui]
related_adrs: [0018, 0001, 0003, 0019]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-023, agentic-workflow-020, agentic-workflow-021, agentic-workflow-022]
---

## Why

The board prompt bar (aw-023) renders a full-width textarea with the Quick Capture
and Modeling buttons in a row beneath it. The builder also wants to kick off an
execution run — `/agentheim:work` — straight from the board, without round-tripping
through the terminal. Rather than stacking yet another button under the textarea,
the textarea should narrow to two-thirds width and free up the right third for an
action column, with **Work** as its first (and currently only) occupant. Capture and
modeling are *authoring* actions that consume the typed prompt; work is an *execution*
action that runs the ready backlog and ignores the prompt — so it earns its own
spot beside the field rather than below it with the prompt-seeded pair.

## What

Re-lay-out `BoardPromptBar` (`dashboard/app/board.js`) into a left/right split:

- The **textarea** shrinks from full width to **two-thirds** of the bar's width
  (left side). It keeps its current behaviour unchanged — multi-line, token-matched,
  the value still seeds Quick Capture / Modeling.
- A **right-side action column** (the remaining ~third) holds a single **Work**
  button. Clicking it seeds the **bare** `/agentheim:work` command and opens a real
  Claude session through the VS Code bridge, or copies that exact string to the
  clipboard on the bridge-absent fallback — reusing aw-020's `launchOrCopy` /
  `LaunchButton` **unchanged** (ADR-0018). Work **ignores the textarea** — it always
  launches the bare command, regardless of what is typed.
- The **Quick Capture** and **Modeling** buttons **stay where they are** — in their
  row beneath the textarea, still prompt-seeded (`quickCaptureCommandFor(prompt)` /
  `modelingCommandFor(prompt)`), still firing the clear-and-confetti on success
  (aw-023). They are not moved into the right column.

Builder decisions (2026-06-15): right side holds **only Work** for now (Quick Capture
& Modeling are *not* relocated there); Work runs the **bare** command and does **not**
consume the prompt. The textarea is two-thirds width; the action column is the
remaining third.

## Acceptance criteria

- [ ] On the board view, the prompt-bar **textarea renders at roughly two-thirds of
      the bar's width** (left), with a **right-side action column** occupying the
      remaining third. Layout is responsive enough not to break the existing board
      shell (no horizontal overflow on a narrow window; the pair-of-buttons row below
      still lays out as today).
- [ ] The right column contains a single **Work** button that seeds the **bare**
      `/agentheim:work` command (no prompt appended, ever — typing in the textarea does
      not change what Work launches).
- [ ] The **Work** button opens a real Claude session via the **bridge** and falls
      back **silently** to clipboard copy when the bridge is absent — `launchOrCopy` /
      `LaunchButton` reused **unchanged** (ADR-0018). It threads `skipPermissions` the
      same way the other prompt-bar buttons do (aw-021 / ADR-0019), so an armed launch
      still skips permissions.
- [ ] **Quick Capture** and **Modeling** remain **beneath the textarea**, unchanged:
      still prompt-seeded, still clearing the textarea + firing confetti on a
      successful launch / landed copy. Work does **not** clear the textarea or fire
      confetti (it never consumed the prompt).
- [ ] The bare `/agentheim:work` command string is sourced from a **pure, unit-tested**
      constant/builder in `dashboard/app/modeling-command.js` (mirroring the existing
      `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND` bare constants — e.g. a
      `WORK_COMMAND` constant). `node --test` covers it.
- [ ] The board stays a **projection of disk** (ADR-0001): no change to `/api/tree`,
      the SSE consumer, or the read-only contract (ADR-0017). Launching is an external
      side-effect, never a lifecycle write.
- [ ] `dashboard/dist/` is rebuilt (esbuild) so the served bundle carries the change;
      the dashboard test suite stays green.

## Notes

- **Seam — layout.** `BoardPromptBar` currently stacks the textarea (`width: 100%`)
  over a `role="group"` button row (Quick Capture / Modeling / `BoardConfetti`). This
  task wraps the textarea + a new right-side action column in a horizontal flex
  container (textarea ~2/3, action column ~1/3) while leaving the existing
  Quick Capture / Modeling row beneath untouched. Token-matched board-local layout,
  styleguide consumed **unforked** (ADR-0003) — same posture as the textarea itself.
- **Seam — command string.** Add a bare `WORK_COMMAND` (e.g. `/agentheim:work`) to
  `dashboard/app/modeling-command.js` beside `QUICK_CAPTURE_COMMAND` /
  `MODELING_COMMAND`. No prompt-taking builder is needed for Work (it never appends the
  prompt), so this is a constant, not a `*CommandFor(prompt)` builder. Unit-test its
  value in `dashboard/test/modeling-command.test.mjs`.
- **Seam — launch path.** `LaunchButton` already takes a `command` string,
  `skipPermissions`, and an optional `onResult` (aw-023). Work passes the bare command
  and `skipPermissions`; it does **not** pass the prompt-bar `onResult` (no clear / no
  confetti). Everything else on the launch path is reused unchanged (ADR-0018).
- **Design-system follow-up (non-blocking).** The right-side "action column beside a
  prompt field" is board-local layout today, like the textarea and confetti before it
  (aw-023's two flagged follow-ups: a shared TextArea/prompt-input primitive and a
  shared confetti motion). If a reusable prompt-bar/action-column primitive starts to
  look warranted, that's a `design-system` capture — the worker may only edit this BC's
  README, so flag it for the orchestrator rather than spawning it here.
- **Prior art:** extends **aw-023** (the prompt bar being re-laid-out), **aw-020**
  (the `launchOrCopy` / `LaunchButton` origin), **aw-021** (the `skipPermissions`
  threading the Work button reuses), **aw-022** (the `LaunchButton` shape). Bridge
  contract from the **vscode-dashboard-terminal-bridge** research (2026-06-09) and
  ADR-0018.

## Outcome

Re-laid-out `BoardPromptBar` (`dashboard/app/board.js`) into a left/right horizontal
flex split: the textarea now takes `flex: 2` (~two-thirds, `minWidth: 220`,
`flexWrap` so it stacks on a narrow window — no overflow) and a new right-side
action column (`flex: 1`, `minWidth: 120`) holds a single **Work** `LaunchButton`.
Work seeds the **bare** `WORK_COMMAND` (`/agentheim:work`), threads `skipPermissions`
(aw-021 / ADR-0019), and passes **no** `onResult` — so it never clears the textarea
or fires confetti (it never consumed the prompt). The Quick Capture / Modeling row is
**unchanged** beneath the split, still prompt-seeded and still clearing + celebrating
on success. `launchOrCopy` / `LaunchButton` reused unchanged (ADR-0018); no
`/api/tree` / SSE / read-only-contract change (ADR-0001 / ADR-0017). Styleguide
consumed unforked (ADR-0003) — board-local token-matched flex layout, same posture as
the textarea/confetti before it. (Work uses the existing `arrow-right` icon; the
styleguide has no `play` glyph and Work reads as "run/go".)

Added the bare `WORK_COMMAND = '/agentheim:work'` constant to
`dashboard/app/modeling-command.js` (a constant, not a `*CommandFor(prompt)` builder,
since Work never appends the prompt) — one source of truth for the launch + clipboard
paths.

No new ADR — composes ADR-0018 / 0001 / 0003 / 0019 unchanged.

Tests (TDD, red→green): +2 `WORK_COMMAND` cases in
`dashboard/test/modeling-command.test.mjs`; +5 static board-glue cases in
`dashboard/test/board-prompt-bar.test.mjs` (horizontal split, textarea no longer
`width:100%`, Work button seeds bare `WORK_COMMAND`, Work threads `skipPermissions`
but no `onResult`, board imports `WORK_COMMAND`). Full suite `node --test`: **262
green** (was 255). `dashboard/dist/` rebuilt via esbuild — the served bundle carries
the Work button + command.

Key files:
- `dashboard/app/board.js` — BoardPromptBar left/right split + Work LaunchButton; `WORK_COMMAND` import.
- `dashboard/app/modeling-command.js` — `WORK_COMMAND` constant.
- `dashboard/test/modeling-command.test.mjs`, `dashboard/test/board-prompt-bar.test.mjs` — coverage.
- `dashboard/dist/` — rebuilt bundle.
