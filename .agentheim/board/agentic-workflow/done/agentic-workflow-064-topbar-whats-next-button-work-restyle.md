---
id: agentic-workflow-064
title: Topbar "What's next" launch button + Work button restyle (accent fill, trailing ↗)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 658d130
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, topbar, ui]
related_adrs: [0016, 0003, 0018, 0017]
related_research: []
prior_art: [agentic-workflow-053, agentic-workflow-033, agentic-workflow-024, agentic-workflow-049]
related_tasks: [agentic-workflow-065]
---

## Why
A screenshot mock the builder produced (root `Screenshot 2026-06-17 112241.png`) reshapes
the topbar's right edge. Today it reads `[ search ] … [ ⚙ ] [ Work ]` (aw-053). The design
adds a third standing action — **"What's next"** — and gives **Work** a louder, accent
treatment so the primary launch reads as the page's main call to action.

## What
Adjust the main-column topbar (`BoardTopbar` in `dashboard/app/board.js`) so its right
group reflects the mock, left → right: `[ ⚙ gear ] [ What's next ] [ Work ↗ ]`.

1. **"What's next" button** — a new standing button between the settings gear and Work,
   carrying the `sun` glyph (confirmed present in the styleguide icon registry —
   `icons.js`, so consumed **unforked**, no design-system child). It **launches a seeded
   Claude session** through the existing VS Code bridge (`launchOrCopy`, like Work and Stop
   dashboard — ADR-0018), with the silent clipboard fallback when the bridge is absent.
   The session generates a "what next" overview of sensible next steps. It threads the
   armed `skipPermissions` signal like the other launches, and passes no `onResult`.
   - **The seeded command is an interim raw natural-language prompt** (settled in
     refinement — see Notes), **not** a slash command, since no skill backs it yet. It
     lives as a bare `WHATS_NEXT_COMMAND` constant beside `WORK_COMMAND` /
     `STOP_DASHBOARD_COMMAND` in `dashboard/app/modeling-command.js`. The bridge wraps any
     prompt as `claude "<prompt>"`, so a raw prompt launches a real session; the clipboard
     fallback copies the same text (pasteable into a running session). Suggested interim
     text: *"Review this project's `.agentheim/` backlog, the recent protocol entries, and
     the git state, then give me a concise overview of the most sensible next steps —
     grouped by what's ready now vs. what's blocked, one-line rationale each. Read-only:
     change no files."* The worker may tune the wording; the contract is read-only + a
     next-steps overview.
   - Emphasis sits **between** the quiet gear and the primary Work — a bordered secondary
     button (the mock shows a hairline-bordered chip with the sun icon + label).

2. **Work restyle** — the primary Work launch (`LaunchButton label="Work"
   emphasis="primary"`) gets the mock's treatment **minus the ochre fill** (settled in
   aw-065's refinement — see Notes): it **keeps its current primary-surface fill** (the
   aw-033 `--surface-2` / `--fg-1` / `--hairline-strong` chrome) and gains the arrow glyph
   moved to the **right** of the label, rendered as an **up-right diagonal** (the
   `square-arrow-out-up-right` glyph the registry already carries, used by aw-062), reading
   `Work ↗`. Behaviour (bare `/agentheim:work` via `launchOrCopy`, theme-following, threads
   `skipPermissions`) is unchanged — only the icon glyph and its left→right order change.

## Acceptance criteria
- [ ] The topbar right group renders `[ ⚙ ] [ What's next ] [ Work ↗ ]`, flush-right
      (the aw-053 `marginLeft:auto` group), search field still left-anchored.
- [ ] "What's next" fires a seeded session via `launchOrCopy` (bridge → terminal; silent
      clipboard fallback when absent), threading `skipPermissions` when armed; it never
      writes lifecycle state (read-only, ADR-0017). The seeded text is the interim
      `WHATS_NEXT_COMMAND` constant (a raw NL prompt, no slash command) in
      `modeling-command.js`, beside `WORK_COMMAND`.
- [ ] "What's next" carries the `sun` glyph drawn from the styleguide icon registry
      unforked (ADR-0003) — no new glyph minted, no design-system child task.
- [ ] Work keeps its current primary-surface fill (no ochre; ADR-0016 untouched), with the
      label then a trailing up-right arrow glyph; its launch behaviour and theme-following
      are byte-unchanged apart from the icon glyph + side.
- [ ] Styleguide consumed unforked (ADR-0003); no new styleguide primitive forked for
      either button.
- [ ] `dashboard/dist/app.js` rebuilt (esbuild) so the deployed app carries the change.
- [ ] Pure logic (any new command constant/builder) unit-tested under `node --test`.

## Notes
**Settled (refinement 2026-06-17) — the "What's next" command: interim prompt now, align
later.** The button launches a session, but no dedicated skill backs it yet. The *process*
that produces a next-steps overview is itself a backlog item, **aw-031** ("Next-steps
overview when work is done"), still raw/unrefined. The builder chose **option (a)**: ship
an interim raw NL prompt now (the `WHATS_NEXT_COMMAND` constant above) and **do not** make
this task depend on aw-031 — that would block the whole topbar restyle (including the
ready Work ↗ change) behind an undesigned process task. aw-031 stays in `related_tasks`,
**not** `depends_on`. When aw-031 is refined and produces a real skill (e.g. a
`/agentheim:whats-next` command), a **later, separate task** swaps the constant from the
interim prompt to that skill's invocation — a one-line change to a single constant, no
rework of this button's UI or bridge wiring. (Splitting the button out from the Work
restyle was considered and rejected: both edit the same `BoardTopbar` and rebuild the same
`dist/app.js`, so they conflict-serialize anyway — no parallelism gained, extra bookkeeping
spent.)

**Settled (aw-065 refinement, 2026-06-17) — the accent fill: no ochre, use the existing
primary surface.** The mock paints Work (and, in aw-065, Quick Capture) in ochre, but
`--accent-ochre-soft` is **reserved for the selection accent** by **ADR-0016**. The builder
settled this shared question during aw-065's refinement by **not using ochre at all**: the
emphasised launch wears the existing **primary-surface** treatment (`--surface-2` fill,
`--fg-1` text, `--hairline-strong` border — the aw-033 Work chrome it already has). For
**this** task that means the "Work restyle" loses its accent-fill clause — Work keeps its
current primary-surface fill and only gains the trailing up-right arrow glyph + the
left→right icon order. No token repurposed, no design-system child, no new ADR (ADR-0016
untouched). Trade-off accepted: off-mock on colour. See aw-065 Notes.

Frontend task — gated on the approved styleguide (`design-system-001`, done). Shares the
`dashboard/dist/app.js` bundle with aw-065, so the two cannot build in parallel (the `work`
skill conflict-serializes shared-dist tasks).

## Outcome
The main-column topbar's right group now reads `[ ⚙ gear ] [ What's next ] [ Work ↗ ]`,
flush-right (aw-053 `marginLeft:auto` kept; search stays left-anchored).

- **What's next** — a new standing bordered-secondary chip (`sun` glyph, consumed unforked
  from the styleguide registry, ADR-0003) between the gear and Work. It fires the interim
  raw NL prompt `WHATS_NEXT_COMMAND` via `launchOrCopy` (bridge → terminal, silent clipboard
  fallback, ADR-0018), threads the armed `skipPermissions` cue, passes no `onResult`, writes
  no lifecycle state (read-only, ADR-0017). Not a slash command — no skill backs it yet
  (aw-031 is the future process); a later one-line constant swap aligns it when aw-031 lands.
- **Work restyle** — kept its primary-surface fill (no ochre, ADR-0016 untouched); the glyph
  moved to the RIGHT of the label and became the up-right diagonal `square-arrow-out-up-right`
  (`Work ↗`). Implemented via a new board-local `trailingIcon` prop on `LaunchButton` — the
  styleguide `Icon` primitive is consumed unchanged (no fork). Launch behaviour + theme-follow
  are byte-unchanged apart from the glyph + its side.

Key files: `dashboard/app/modeling-command.js` (new `WHATS_NEXT_COMMAND` constant +
re-export), `dashboard/app/board.js` (`LaunchButton` `trailingIcon` prop + `BoardTopbar`
three-action group), `dashboard/dist/app.js` (rebuilt via `node build.mjs`). Tests:
`dashboard/test/modeling-command.test.mjs` (+5) and `dashboard/test/topbar-right-align.test.mjs`
(+6). Full dashboard suite: 530 passing. BC README updated (topbar order + constants list).
</content>
</invoke>
