---
id: design-system-me97j
title: ModelSplitButton's `disabled` deadens the model caret along with Enter — an empty prompt shouldn't block picking a model
status: doing
type: bug
context: design-system
created: 2026-07-13
completed:
depends_on: [design-system-001]
blocks: []
tags: [model-split-button, prompt-console, disabled, affordance]
related_adrs: []
related_research: []
prior_art: [design-system-r9dtm, design-system-tfhn6, design-system-k3f7q]
---

## Why

With an empty prompt the dashboard's prompt console correctly greys out the Enter
button — there is nothing to launch. But it greys out the **model caret beside it**
too, so the builder cannot open the model menu until they have typed something. That
is backwards: choosing which model a future launch will use is exactly the kind of
thing you do *before* writing the prompt, and nothing about a blank prompt makes the
choice invalid.

The cause is that `ModelSplitButton` has only ever had **one** interactivity gate for
**two** regions. `design-system-r9dtm` widened `EnterButton` into the split button and
carried `EnterButton`'s `disabled` prop (`design-system-tfhn6`) across the whole new
widget wholesale — `.agentheim/contexts/design-system/styleguide/app/button.js`:

- `canOpenMenu = !locked && !disabled` (~L229) — `disabled` suppresses the caret click,
- the caret `<button>` gets the real `disabled` attribute (~L330), taking it out of the
  tab order as well,
- and `opacity: disabled ? 0.55 : 1` sits on the flex wrapper that *encloses both*
  regions (~L299), so the caret is painted dead too.

The consumer supplies the truth that exposes it: `dashboard/app/board.js` (~L1373)
passes `disabled=${!canFire}`, and `canFire` is derived purely from prompt-blankness
(`canFirePromptMode(highlightedMode, prompt)`, ~L1276). There is no in-flight or
launching state folded into it. So the *only* thing `disabled` ever means here is
**"there is nothing to launch"** — a statement about the primary region that has no
bearing whatever on the caret.

## What

Narrow `disabled` to govern the **primary (launch) region only**. The caret region's
sole gate becomes `locked` — which already removes the caret *entirely* (Quick
Capture's pinned model), so a locked split button is unaffected by this change.

Concretely, in `styleguide/app/button.js`'s `ModelSplitButton`:

- `canOpenMenu = !locked` — drop the `&& !disabled`.
- Remove the `disabled` attribute from the caret `<button>`; it keeps its pointer
  cursor and stays in the tab order (a blank prompt must not make the model menu
  keyboard-unreachable either).
- Move `opacity: 0.55` **off the wrapper and onto the primary `<button>` alone**, so
  the Enter half reads dead and the caret half reads live. The builder chose this at
  capture over keeping the whole surface dimmed: a control that is painted disabled but
  still responds to clicks is a lying affordance. The hairline divider and the shared
  ochre surface stay as they are — this is an opacity change on one child, not a new
  colour or a second button.
- The primary `<button>`'s own `disabled` attribute, its `default` cursor, and the
  `onClick` guard are all unchanged. `EnterButton` (the icon-only sibling) is
  untouched — its single region *is* the primary, so `tfhn6`'s semantics still hold
  there verbatim.
- Update the `disabled` prop's docblock, which currently promises "both regions
  non-interactive at 0.55 opacity" — that sentence is the bug, written down.

`dashboard/app/board.js` needs **no change**: it keeps passing `disabled=${!canFire}`,
and that now means what it always should have meant. The styleguide canvas's disabled
`ModelSplitButton` specimen (`styleguide/app/app.js`) should show the new two-tone
state, since a specimen that still paints the caret dead would contradict the
component.

## Acceptance criteria

- [ ] With `disabled` true and `locked` false, the caret is clickable and the menu
      opens — asserted in the DOM harness, not by reading source
      (`dashboard/test/model-split-button-dom.test.mjs` /
      `.agentheim/contexts/design-system/styleguide/test/model-split-button.test.mjs`).
- [ ] With `disabled` true, the caret `<button>` carries no `disabled` attribute and is
      keyboard-reachable; opening it via Enter/Space and selecting a model with the
      arrow keys still fires `onSelect`.
- [ ] With `disabled` true, the **primary** `<button>` is still genuinely disabled:
      `disabled` attribute present, `onClick` never fires.
- [ ] With `disabled` true, the 0.55 opacity is on the primary region only — the caret
      region renders at full opacity.
- [ ] `locked` still removes the caret region entirely, regardless of `disabled`
      (existing behaviour must not regress).
- [ ] In the dashboard prompt console with an empty prompt: Enter is greyed and inert,
      the model menu opens and a selection sticks.
- [ ] The `disabled` docblock in `button.js` no longer claims both regions go
      non-interactive.
- [ ] Full test suite green (`node --test lib/test/*.test.mjs`, plus the dashboard and
      styleguide suites).

## Notes

- **Do not run `node build.mjs`.** Per ADR-0057 the conductor regenerates
  `dashboard/dist/` from merged source at integration; workers leave `dashboard/dist/`
  out of their file list entirely. `board.js` imports `button.js` directly from the
  styleguide, so the bundled dashboard picks this up on that rebuild — the worker does
  not need to (and must not) do it.
- Two bridge tests in `dashboard/test/bridge.test.mjs` fail with `EADDRINUSE` on
  :31425 whenever the builder's real bridge is live in VS Code, and
  `foreign-launch.test.mjs` can flake `EPERM` in teardown on this Windows box. Both are
  pre-existing and unrelated to this change — do not chase them.
- Prior art: `design-system-r9dtm` introduced `ModelSplitButton` and is where the
  single-gate `disabled` came from; `design-system-tfhn6` is the `EnterButton` disabled
  state it inherited (correctly, for a one-region button); `design-system-k3f7q` was the
  previous fix to this same widget (menu placement + the console clip) and established
  that a `ModelSplitButton` bug is provable through the DOM harness rather than by
  regex over source.
