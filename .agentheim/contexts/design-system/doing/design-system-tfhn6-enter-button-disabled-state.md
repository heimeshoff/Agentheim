---
id: design-system-tfhn6
title: EnterButton gains a disabled state
status: doing
type: feature
context: design-system
created: 2026-07-09
completed:
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-m3vhq]
tags: [dashboard, prompt-bar]
related_adrs: [0003, 0048, 0051, 0016]
related_research: []
prior_art: [design-system-xr4sb]
---

## Why
`agentic-workflow-m3vhq` adds a **Plain** prompt-bar mode — the first mode that can
*decline to launch* (an empty prompt has no command to fire). Its Enter button must
therefore render **disabled** when there is nothing to send. It cannot.

`design-system-xr4sb` shipped `EnterButton` (`styleguide/app/button.js`) with exactly
three props — `{ onClick, size, ariaLabel }` — and `agentic-workflow-q7r3x` then swapped
the dashboard's board-local Enter button for that primitive, consumed **unforked**
(ADR-0003). So the board can no longer express a disabled Enter button without either
forking the primitive (forbidden) or faking it consumer-side (an a11y lie: a wrapper's
`pointer-events: none` leaves the underlying `<button>` focusable and announcing as
enabled).

More than one button eventually needs this. **No styleguide primitive supports a
disabled state today** — the only `disabled` anywhere in the design system is a
focus-trap selector in `modal.js`. This task closes that gap once, on the primitive,
rather than once per consumer.

The shape is xr4sb's verbatim: a styleguide-owned primitive lands in `design-system` so
its `agentic-workflow` consumer can wire it without forking.

## What
One prop on one primitive: `EnterButton` learns `disabled`.

The paint is **de-emphasis by opacity** (ADR-0016), *not* a fill swap. The `--accent-ochre`
fill and the `--accent-ochre-fg` glyph are a deliberately contrast-matched pair (xr4sb
added `--accent-ochre-fg` precisely because `--accent-ochre` inverts lightness across
themes, so a generic foreground token would go illegible in one of them). Dimming both
together with a single `opacity` preserves that pairing in both themes; swapping the fill
to `--surface-2` would strand `--accent-ochre-fg` on an unvetted surface and require a
fresh two-theme contrast check.

It also keeps the shipped guard green: `styleguide/test/enter-button.test.mjs` asserts
`background: "var(--accent-ochre)"` as a **literal**, so a conditional fill would break a
test xr4sb wrote to protect ADR-0048's carve-out.

## Acceptance criteria
- [ ] `EnterButton` gains a `disabled = false` prop, forwarded to the underlying
      `<button>` as the **real `disabled` attribute** — so it leaves the tab order and
      cannot be activated by click *or* keyboard. Same component, no variant, no fork:
      every existing consumer keeps importing `EnterButton` unchanged (ADR-0003).
- [ ] Disabled paint is opacity-only (ADR-0016): `background` stays the **literal**
      `var(--accent-ochre)` and the glyph stays `--accent-ochre-fg`; when disabled the
      button sets `opacity: 0.55` (the established resting-dim value — `PromptModeTab`'s
      non-highlighted tab uses the same) and `cursor: default`. Enabled, it stays
      `opacity: 1` / `cursor: pointer`.
- [ ] The five existing assertions in `styleguide/test/enter-button.test.mjs` stay green
      **unmodified** — in particular the literal `background: "var(--accent-ochre)"` match.
      That guard passing *is* the mechanical proof the fill was not swapped.
- [ ] New assertions in the same suite: the `disabled` prop exists and defaults to
      `false`; it reaches the `<button>`'s `disabled` attribute; the disabled branch sets
      an `opacity` below 1 and `cursor: default`; the enabled branch leaves both alone.
- [ ] The canvas documents it as a **second specimen** beside the existing
      `Enter — icon variant (--accent-ochre)` one in `ButtonRow`
      (`styleguide/app/app.js`, section 12 "Button — neutral, destructive & Enter"), so a
      reviewer sees enabled and disabled side by side. The canvas guard asserts both render.
- [ ] `dashboard/dist/` is **not** rebuilt here — it is a derived artifact (ADR-0003), and
      the consuming task `agentic-workflow-m3vhq` rebuilds it when the disabled button
      actually renders on the board. Standing ds-021 / r4k8m / xr4sb precedent.
- [ ] The styleguide gate **reopens** (visible canvas change) — add the gate-reopen note
      to the BC README at execution, per the same standing precedent xr4sb followed.
- [ ] Styleguide + dashboard suites green.

## Notes
- **Blocks `agentic-workflow-m3vhq`** (the dashboard consumer that wires this in). Scope
  here is the primitive only: `canFirePromptMode`, the `fire()` guard, the fifth
  `PROMPT_MODES` entry and the `title` / `aria-label` copy are all consumer-side and live
  in m3vhq — not here.
- **No hover state to suppress.** `EnterButton` has no hover styling at all (no
  `useState(hover)`, unlike `Button` / `PromptModeTab`), so m3vhq's "no hover affordance
  when disabled" is satisfied by construction. A worker should *not* add a hover state
  here in order to then disable it.
- **Why the primitive and not a consumer-side wrapper.** board.js already wraps
  `EnterButton` in a `<span title=…>`, and giving that span `opacity` + `pointer-events:
  none` would look right. But `pointer-events` does not block the keyboard: the button
  would stay focusable, stay announced as enabled, and still fire on Enter. The disabled
  *attribute* is a property of the button element, so it belongs on the button element.
- **This is the styleguide's first disabled state.** Documented once, on the primitive.
  No other primitive is touched by this task — but the shape established here (real
  attribute + ADR-0016 opacity, never a fill swap) is the one a later `Button` /
  `IconButton` disabled state should follow.
- The `title` tooltip m3vhq wants on a disabled button lives on board.js's existing
  wrapper `<span>`, which is not itself disabled — so the tooltip still shows. Nothing
  needed here for it.
