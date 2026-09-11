---
id: agentic-workflow-030
title: Board buttons — hover shadow + background highlight; armed launch cue keeps only the dot (no red border/text)
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 7e7e191
depends_on: [design-system-001]
blocks: []
tags: [dashboard, board, launch-button, hover, skip-permissions]
related_adrs: [0019, 0018, 0003]
related_research: []
prior_art: [agentic-workflow-021]
---

## Why
Two things about the board's buttons read wrong to the Builder:

1. **Hover gives no feedback.** Today a `LaunchButton` only nudges its border
   color on hover (board.js:305-306). The Builder wants the same "raised, clearly
   hovered" feel the cards get — a stronger shadow and a background-color change —
   without the content shifting upward.
2. **The danger hue over-paints every armed launch button.** When the
   skip-permissions toggle is armed, each of the four launch buttons currently
   turns red across the board — an `--obligation`-tinted border *and* a red label,
   plus the small red indicator dot (board.js:283, 299, 301, 307-310; aw-021,
   amended ADR-0018, ADR-0019). The Builder wants **no button** to carry red
   coloring or red outlining — **but the red indicator dot stays.** So the armed
   per-launch cue is *kept*, reduced to the dot alone; only the button-wide red
   (border + label color) is removed. The skip-permissions toggle remains the only
   control that wears the full danger treatment.

This **keeps** the amended ADR-0018 per-launch "skips permissions" cue intact (the
dot still flags each armed launch at a glance); it only narrows ADR-0019's visual
treatment from "`--obligation` border + dot" down to "dot only." Not a reversal of
the cue — a toning-down of how loudly it's drawn.

## What
In `dashboard/app/board.js` `LaunchButton`:

- **Hover treatment (all non-flashed buttons).** On hover, apply a stronger
  `box-shadow` (styleguide `--shadow-sm`/`--shadow-md` scale, consumed unforked)
  and change the `background` to highlight that the pointer is over the button.
  The button content must **not** move on hover (no `translateY`/transform
  offset). Replace the border-only `onMouseEnter`/`onMouseLeave` handlers
  accordingly; keep the `:focus`/`focusable` affordance intact.
- **Tone down the armed cue to the dot only.** Drop the `armed` branch's
  button-wide red: the `--obligation` text color (line 299) and the `--obligation`
  border (line 301) — armed buttons take the **normal** idle/hover label color and
  border, identical to unarmed buttons. **Keep the red indicator dot** (lines
  307-310) and its `--obligation` fill: it remains the at-a-glance per-launch
  "skips permissions" flag. Note the armed branch currently renders the dot
  *instead of* the icon (line 307's ternary) — keep that as-is unless the worker
  finds the icon+dot together reads better; the dot must remain present when armed.
  The `aria-label`/`title` "skips permissions" wording stays.
- **Leave the skip-permissions toggle untouched.** The toggle (board.js:704-733)
  keeps its `--obligation` armed/danger treatment — it is the single control that
  signals the bypass.

This is the only behavioral change to the bridge launch path: armed launches still
send `{ prompt, skipPermissions: true }` exactly as before (aw-021). Only the
per-button red *border + label color* is removed; the dot cue and the payload are
untouched.

## Acceptance criteria
- [ ] On hover, every launch button shows a stronger box-shadow and a changed
      background color; the button's content does not move (no `translateY`/
      transform).
- [ ] When the skip-permissions toggle is **armed**, no launch button shows a red
      `--obligation` label color or red border — the button body is identical to an
      unarmed button — **except** the red indicator dot, which **remains**.
- [ ] The skip-permissions toggle itself still shows its `--obligation` armed
      treatment.
- [ ] The launch payload is unchanged: armed launches still POST
      `skipPermissions: true`; unarmed still omit the field (never `false`).
- [ ] Styleguide consumed unforked (ADR-0003); dashboard `dist/` rebuilt.
- [ ] ADR-0019's wording is updated (folded into this task's commit) to record that
      the armed per-launch cue is now the **dot alone**, not an `--obligation`
      border + label tint. The amended ADR-0018 per-launch-cue mandate still holds
      (the dot satisfies it) — a narrowing, not a reversal. Bidirectional
      `related_adrs` ↔ `related_tasks` links updated. (A full superseding ADR is
      not warranted; an amendment note suffices.)

## Notes
- **Cue kept, just quieter (Builder decision).** The amended ADR-0018 wanted a
  per-launch "skips permissions" cue so an armed launch reads as
  permission-bypassing at the moment of clicking it. The Builder chose to **keep
  that cue as the red dot** and only strip the louder button-wide red (border +
  label). So the per-launch warning survives — every armed button still carries its
  dot — and the toggle stays the one control with the full danger treatment. ADR-0019
  gets an amendment note (dot-only), not a superseding decision.
- Sibling capture: the *cards'* matching hover treatment lives in
  **design-system-008** (styleguide `TicketCard`). The button hover here is
  board-local (`LaunchButton` is defined in board.js), so it stays in this BC. No
  hard dependency between the two.
- The `--obligation` token stays in use only by the toggle. The confetti and
  status palettes were already kept clear of it (ADR-0014/0016) — unchanged.

## Outcome
`LaunchButton` in `dashboard/app/board.js` now gives every non-flashed launch button a
hover RAISE — a `var(--shadow-md)` box-shadow plus a `var(--surface-2)` background
highlight, with the `transition` extended to animate box-shadow + background. No
`translateY`/transform: the content stays put. The old border-only
`onMouseEnter`/`onMouseLeave` handlers were replaced; the `focusable` `:focus`
affordance is intact, and the flash (launched/copied) treatment still wins.

The armed per-launch cue was narrowed to the **dot alone**: the `armed` branch no
longer tints the label or border with `--obligation`, so an armed button's body is
identical to an unarmed one. The `--obligation`-filled indicator dot (rendered instead
of the icon) stays, keeping the at-a-glance "skips permissions" `aria-label`/`title`.
The `SkipPermissionsToggle` and the launch payload are untouched — armed launches still
POST `skipPermissions: true`; unarmed omit the field.

ADR-0019 gained an in-file **Amendment** (dot-only per-launch cue; toggle keeps the
full treatment; amended ADR-0018 mandate still satisfied) with bidirectional
`related_tasks` ↔ `related_adrs` links. No new ADR was warranted.

Tests: new source-reading static guard `dashboard/test/launch-button-hover.test.mjs`
(8 tests, red-first) locks the hover shadow+background+no-transform behavior and the
dot-only armed cue. Full dashboard suite green (307 tests). `dashboard/dist/app.js`
rebuilt.

Key files:
- `dashboard/app/board.js` — `LaunchButton` hover handlers + armed branch
- `dashboard/dist/app.js` — rebuilt bundle
- `dashboard/test/launch-button-hover.test.mjs` — new guard suite
- `.agentheim/knowledge/decisions/0019-dashboard-armed-launch-danger-token.md` — amendment
- `.agentheim/contexts/agentic-workflow/README.md` — armed-cue wording narrowed
