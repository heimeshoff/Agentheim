---
id: agentic-workflow-041
title: Armed skip-permissions per-launch cue becomes a red icon, not a separate dot
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 15cfda5
depends_on: [design-system-001]
blocks: []
tags: [dashboard, board, launch-button, skip-permissions, icon]
related_adrs: [0019, 0018]
related_research: []
prior_art: [agentic-workflow-030, agentic-workflow-021]
---

## Why
The armed per-launch "skips permissions" cue currently renders a small
`--obligation`-filled **indicator dot** *instead of* the button's icon
(board.js armed branch; aw-030 narrowed this from the old border + label tint
down to the dot alone — amended ADR-0019). The Builder finds the separate dot
the wrong shape for the signal: the button already has an icon, and a second
glyph (the dot) appearing in its place reads as a swap rather than a state.

The cleaner cue is to **colour the existing icon red** when armed and **drop the
dot entirely**. The icon stays put; only its colour changes to the danger hue —
so an armed launch button reads as "this one bypasses permissions" without
introducing or removing a glyph.

This **keeps** the amended ADR-0018 per-launch cue mandate intact (every armed
launch still carries an at-a-glance "skips permissions" flag — now the red icon
satisfies it) and **further narrows** ADR-0019's visual treatment: from
"dot alone" (aw-030) down to "the icon, tinted with `--obligation`." A
continuation of the aw-030 toning-down, not a reversal — the cue survives, the
dot does not. The skip-permissions toggle remains the single control wearing the
full danger treatment.

## What
In `dashboard/app/board.js` `LaunchButton`:

- **Remove the indicator dot.** Delete the armed branch's red dot element (and
  the `icon ? dot : icon` style ternary that renders the dot *in place of* the
  icon). The icon is now **always** rendered, armed or not.
- **Tint the icon red when armed.** When the skip-permissions toggle is armed,
  the button's icon takes the `--obligation` colour (the existing styleguide
  danger token, consumed unforked — ADR-0003). When unarmed, the icon takes its
  normal idle/hover colour, identical to today. No other part of the button body
  changes colour (border + label stay normal in both states — aw-030's
  "no button-wide red" rule still holds).
- **Keep the accessibility wording.** The armed `aria-label`/`title`
  "skips permissions" wording stays, now attached to the red-icon state rather
  than the dot.
- **Leave the skip-permissions toggle untouched.** It keeps its full
  `--obligation` armed/danger treatment — still the one control that signals the
  bypass (board.js `SkipPermissionsToggle`).

No behavioural change to the launch path: armed launches still POST
`{ prompt, skipPermissions: true }`; unarmed still **omit** the field (never
`false`) — byte-identical to aw-021.

## Acceptance criteria
- [ ] No launch button renders the separate red indicator dot anymore — the dot
      element and its in-place-of-icon ternary are removed; the icon is always
      present.
- [ ] When the skip-permissions toggle is **armed**, every launch button's icon
      is tinted with `--obligation` (red); when **unarmed**, the icon is its
      normal colour.
- [ ] An armed button's border and label colour are unchanged from unarmed
      (no button-wide red — aw-030's rule preserved); only the icon colour moves.
- [ ] The armed `aria-label`/`title` "skips permissions" wording is retained.
- [ ] The skip-permissions toggle still shows its full `--obligation` armed
      treatment.
- [ ] The launch payload is unchanged: armed launches POST
      `skipPermissions: true`; unarmed omit the field (never `false`).
- [ ] Styleguide consumed unforked (ADR-0003); dashboard `dist/` rebuilt.
- [ ] ADR-0019's wording is updated (folded into this task's commit) to record
      that the armed per-launch cue is now the **red icon**, not a dot. The
      amended ADR-0018 per-launch-cue mandate still holds (the red icon satisfies
      it) — a further narrowing, not a reversal. Bidirectional
      `related_adrs` ↔ `related_tasks` links updated. (An amendment note suffices;
      a full superseding ADR is not warranted — same call as aw-030.)

## Notes
- **Continuation of aw-030, same shape of decision.** aw-030 took the cue from
  "border + label tint + dot" down to "dot only" and recorded it as an ADR-0019
  amendment (not a superseding ADR). This goes one step further — "dot only" →
  "red icon" — and should be recorded the same way: an in-file ADR-0019
  amendment note, bidirectional links updated. The aw-030 task is the closest
  prior art for both the code site (the `LaunchButton` armed branch) and the
  test approach (the source-reading static guard in
  `dashboard/test/launch-button-hover.test.mjs` — extend or mirror it to lock
  "no dot element" + "icon tinted `--obligation` when armed").
- **The `--obligation` token stays in use** by the toggle (full treatment) and
  now the armed icon (colour only). The confetti and status palettes remain
  clear of it (ADR-0014/0016) — unchanged.
- The README's *Persisted skip-permissions armed toggle* entry currently
  describes the cue as "a small `--obligation`-filled indicator dot" — the worker
  should update that wording to "the button's icon tinted with `--obligation`"
  when this lands.

## Outcome
The armed per-launch cue in `dashboard/app/board.js` `LaunchButton` is now the
**icon tinted `--obligation`**, not a separate dot. Removed the indicator-dot
`<span>` and the `armed ? dot : icon` ternary; the `<${Icon}>` is now rendered
unconditionally, its `color` branching `flashed → --st-done`, else
`armed → --obligation`, else the normal emphasis idle color. Border + label color
stay normal in both armed/unarmed states (aw-030's "no button-wide red" rule
preserved); the armed `aria-label`/`title` "skips permissions" wording is retained.
`SkipPermissionsToggle` and the launch payload (`skipPermissions: true` armed /
omitted unarmed — aw-021) are untouched.

ADR-0019 gained a second in-file amendment (2026-06-15, aw-041) recording the
dot → red-icon narrowing, with `related_tasks` and the Decision/first-amendment
cross-references updated. The aw README's *Persisted skip-permissions armed toggle*
entry now describes the cue as the icon tinted `--obligation`.

The static guard `dashboard/test/launch-button-hover.test.mjs` was extended/mirrored
(now 10 tests): asserts no separate dot element / "This launch skips permissions"
span survives, the icon is always rendered (no `armed ? span : icon` swap), and the
icon color branches to `--obligation` when armed. Full `node --test` suite green
(353). `dashboard/dist/` rebuilt (`node build.mjs`).

Key files: `dashboard/app/board.js` (LaunchButton icon-tint), `dashboard/dist/app.js`,
`dashboard/test/launch-button-hover.test.mjs`, ADR-0019, aw README.
