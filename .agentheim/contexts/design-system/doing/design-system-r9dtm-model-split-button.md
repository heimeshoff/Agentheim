---
id: design-system-r9dtm
title: ModelSplitButton — the ochre Enter button widens into a labelled split button with a caret
status: doing
type: feature
context: design-system
created: 2026-07-13
completed:
depends_on: []
blocks: [agentic-workflow-m2vkp]
tags: [styleguide, button, prompt-bar, accent, menu]
related_adrs: [0003, 0048, 0051]
related_research: []
prior_art: [design-system-xr4sb, design-system-r4k8m]
---

## Why
The prompt bar's launch affordance is currently two things: a small bordered `↵`
hint glyph and, next to it, the 34×34 ochre `EnterButton` (`styleguide/app/button.js`).
The builder only wants **one** control there — the ochre one — and wants it to
carry information it does not carry today: **which model the session it launches
will run on**, plus a way to change that model.

That turns the square icon-only `EnterButton` into a **split button**: a wide
primary region (still the launch), a label (the model name — "Opus", "Haiku",
"Sonnet", "Fable"), and a caret region on the right that opens a menu. That is a
new *shape*, not a new *color*: ADR-0048's carve-out already licenses ochre for
the primed primary action, and ADR-0051 extends the ochre wayfinding exception to
the prompt bar. The primitive lives here, not in `board.js`, because ADR-0003 is
explicit that the board consumes styleguide primitives **unforked** — the board
must not hand-roll its own ochre split button.

## What
Add a `ModelSplitButton` to `.agentheim/contexts/design-system/styleguide/app/button.js`
(sibling to `EnterButton`, which stays for any other caller) and show it in the
styleguide page alongside the existing button specimens.

Shape:

```
┌────────────────────────────┬────┐
│  ↵   Opus                  │  ▾ │   ← one ochre surface, one hairline divider
└────────────────────────────┴────┘
   primary region: launches      caret region: opens the model menu
```

- **Primary region** — the `corner-down-left` glyph the `EnterButton` already
  uses, plus the model label. Clicking it fires `onClick` (the launch).
- **Caret region** — a small chevron/triangle, visually separated from the primary
  region by a divider on the ochre surface. Clicking it fires `onOpenMenu`, never
  the launch. The two regions are two `<button>`s inside one bordered group, not
  one button with a click-position test.
- **Menu** — a small popover listing the model options, current one marked. The
  primitive owns the popover's paint and keyboard behavior (↑/↓/Enter/Escape,
  click-outside to close); the *contents* (which models exist, which is current)
  are props, so the styleguide never learns Agentheim's model list.
- **Locked state** — a `locked` prop renders the label but no caret and no menu
  (the caret region is absent, not merely disabled), for the Quick Capture case
  where the model is pinned. The primary region still launches.
- **Disabled state** — `disabled` keeps `EnterButton`'s current semantics (0.55
  opacity, default cursor, no click) and applies to both regions.

## Acceptance criteria
- [ ] `ModelSplitButton` is exported from `styleguide/app/button.js` and rendered
      in the styleguide page with specimens for: normal, locked, disabled, and
      menu-open.
- [ ] Props: `{ label, onClick, onOpenMenu, options, value, onSelect, locked, disabled, ariaLabel }`.
      No Agentheim-specific model names appear anywhere in the styleguide — the
      model list arrives as `options`.
- [ ] Clicking the primary region calls `onClick` and never opens the menu;
      clicking the caret calls `onOpenMenu` / toggles the menu and never calls
      `onClick`.
- [ ] `locked` renders no caret region at all and the menu is unreachable by mouse
      or keyboard; the primary region still launches.
- [ ] `disabled` renders both regions non-interactive at 0.55 opacity, matching
      `EnterButton`'s existing disabled treatment.
- [ ] Keyboard: the caret region is reachable by Tab, opens on Enter/Space; inside
      the open menu ↑/↓ move, Enter selects, Escape closes and returns focus to the
      caret (no keyboard trap — same WCAG 2.1.2 discipline as
      agentic-workflow-tkq7v's Escape-blurs rule).
- [ ] The open menu has `role="menu"` with `role="menuitemradio"` items and
      `aria-checked` on the current one; the caret carries `aria-haspopup="menu"`
      and `aria-expanded`.
- [ ] Ochre comes from `var(--accent-ochre)` / `var(--accent-ochre-fg)` — no new
      color token, no hard-coded hex. The menu surface uses `--surface-*` /
      `--hairline*` like every other popover.
- [ ] `EnterButton` is left in place, unchanged and still exported (nothing else
      that consumes it breaks).
- [ ] The styleguide's own tests cover the click-region split, the locked variant,
      and the menu's keyboard behavior.

## Notes
- **ADR-0003 is the reason this task exists separately** from the board work: the
  board must consume this primitive, not fork it. `agentic-workflow-m2vkp` (the
  prompt-bar task) `depends_on` this one.
- ADR-0048 licenses the ochre on the *primed primary action*. The caret region is
  part of the same primed action, so it stays on the ochre surface (divider, not a
  second color). Don't introduce a neutral caret button beside an ochre one —
  that reads as two actions of different weight, which is exactly what the builder
  is asking to collapse.
- The width: no fixed px. The button grows to fit its longest label so switching
  Opus → Fable doesn't reflow the row — set a `min-width` from the longest option,
  or size the label region to the widest of `options`.
