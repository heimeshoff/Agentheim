---
id: design-system-018
title: Shared Button + Modal + ConfirmDialog primitives (centered, scrim, Esc-to-cancel)
status: done
type: feature
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 29482ee
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-048]
tags: [styleguide, modal, dialog, confirm, overlay, button]
related_adrs: [0003, 0005, 0014, 0016]
related_research: []
prior_art: [design-system-005, design-system-015]
---

## Why
The styleguide has **no centered modal / confirm-dialog primitive**. The `Drawer` is a
side panel, the `Menu` (design-system-015) is an anchored popover, and aw-028's
`StoppedOverlay` is a full-pane cover — none is a small, centered, scrim-backed confirm
dialog. The board's per-card dismiss (agentic-workflow-048) needs exactly that, and is
building a **board-local, token-matched** confirm overlay in the meantime (the same
board-local-first → shared-primitive sequencing as aw-014 → ds-005 and aw-049 → ds-015).
This task captures the shared primitive that should eventually retire that board-local
control so confirm dialogs live once, in the styleguide.

## What
Add a **three-layer** primitive family to the styleguide (builder decisions, 2026-06-16):

1. **`Button` (base, new — builder decision 2026-06-16).** The styleguide has **no shared
   text/label button** today — only the icon-only ghost `IconButton` (`app/drawer.js`).
   `ConfirmDialog`'s Cancel/Confirm controls need a labelled button, so this task adds the
   missing primitive rather than hand-rolling button styling inside the dialog:
   - A token-composed labelled button — `--font-ui`, `--radius-sm`/`--radius-md`, hairline,
     `--surface-*`, the existing hover-transition language (`--duration-fast` / `--ease-base`,
     the `IconButton` precedent).
   - **Two variants: `neutral` (default) and `destructive`.** `destructive` tints the button
     with the `--obligation` danger family (`#8C3A3A` light / `#B86C6C` dark, with
     `--obligation-soft` for hover/fill) — the same red aw-048's trash uses; ADR-0016 keeps
     danger off the **reserved selection accent** (`--accent-ochre-soft`).
   - Presentational and stateless beyond local hover — no React-free state module needed
     (unlike `Modal`'s focus-trap logic below).
   - Authored in **htm, no JSX** (ADR-0005); consumed unforked (ADR-0003).
   - **Note:** `Button` is folded into ds-018 because its `destructive` variant exists *for*
     the destructive Confirm — they're co-designed. If scope feels heavy at work-time it can
     be lifted to its own task (with `Modal`/`ConfirmDialog` depending on it); the layering is
     kept clean so that split stays trivial.

2. **`Modal` (centered shell).** A generic centered-panel-over-scrim shell — the reusable
   chrome. **Note the `Drawer` (the machinery to lift) is a *contained* overlay
   (`position: absolute; inset: 0; z-index: 40`, scoped to its pane, sliding in from the
   right) — `Modal` deliberately does NOT copy that containment:**
   - **Placement: `position: fixed`, centered on the whole viewport** (builder decision
     2026-06-16), stacked **above everything including the `Drawer`** (a `z-index` above the
     Drawer's `40`). A `Modal` opened from a board card covers the screen, not a container.
   - A **centered** panel over a **scrim** (dimmed backdrop). The panel is composed from
     existing tokens (`--surface-1`, hairline, `--radius-md`, an elevation role at least
     `--shadow-md`); the **scrim matches the `Drawer`'s exact dim — `rgba(8,9,12,0.40)`**
     (there is no `--scrim` token; the Drawer hard-codes this value, so reuse it verbatim for
     a consistent backdrop rather than inventing a new dim).
   - **Dismissal:** Esc and scrim-click both invoke the consumer's `onClose` — lifted from the
     `Drawer` (its `window` keydown-Escape listener + scrim `onClick`). Body content is
     arbitrary (the `Menu`/`Collapsible` body-agnostic seam — ds-005/ds-015).
   - **Reveal motion: fade + slight scale-up** (builder decision 2026-06-16) — the scrim fades
     in and the panel eases from ~`scale(0.97)` → `scale(1)` with opacity, over
     `--duration-base` / `--ease-base` (a centered sibling of the Drawer's slide; "slide from
     the right" does not transfer to a centered panel). **Stripped under
     `prefers-reduced-motion`** to a hard show (ADR-0014 strip-to-plain; the standing
     ambient-motion contract, same as `Menu`'s one-frame reveal).
   - **Full focus trap** (builder decision): focus moves into the panel on open, **Tab /
     Shift-Tab cycle stays contained** within the panel while open, and focus **returns to
     the trigger** on close.
   - Authored in **htm tagged templates, no JSX shipped** (ADR-0005); consumed unforked
     across the BC boundary (ADR-0003).

3. **`ConfirmDialog` (composed over `Modal` + `Button`).** The confirm-specific affordance:
   - Renders consumer-supplied **title** + **body**, plus a **Cancel** `Button` (neutral) and
     a **Confirm** `Button`. The consumer owns the copy and the labels (the "styleguide owns
     look/placement, consumer owns behavior" seam — ds-005 `Collapsible`, ds-006
     `cornerAction`, ds-015 `Menu`).
   - **Esc, scrim-click, and Cancel all cancel** (cancel = the `Modal`'s `onClose`); a
     **Confirm** action invokes the consumer's confirm callback.
   - **Optional `destructive` variant** (builder decision): when set, the **Confirm renders
     the `destructive` `Button`** (the `--obligation` tint above). Default → a neutral Confirm
     `Button`. This exists because the primitive's first real use is a destructive dismiss.

## Acceptance criteria
- [ ] A styleguide `Button` primitive renders a labelled, token-composed button with a
      `neutral` (default) and a `destructive` variant; `destructive` draws from the
      `--obligation` family (not the reserved accent, ADR-0016). htm-authored, no JSX
      (ADR-0005), consumed unforked (ADR-0003).
- [ ] A styleguide `Modal` renders a **viewport-fixed, centered**, scrim-backed panel from
      existing tokens, with arbitrary body content; the scrim matches the Drawer's
      `rgba(8,9,12,0.40)` dim; consumed unforked (ADR-0003), htm-authored, no JSX (ADR-0005).
- [ ] The `Modal` stacks **above the Drawer** (a `z-index` greater than the Drawer's `40`),
      so a Modal opened over a slide-over is not occluded.
- [ ] A styleguide `ConfirmDialog` composes over `Modal` and `Button`, rendering
      consumer-supplied title/body with a Cancel (neutral `Button`) + Confirm (`Button`)
      control.
- [ ] Esc, scrim-click, and Cancel all dismiss without firing confirm; Confirm fires the
      consumer callback.
- [ ] `ConfirmDialog` accepts a `destructive` flag that renders the Confirm as the
      `destructive` `Button` (`--obligation` tint); default Confirm stays neutral.
- [ ] **Full focus trap:** focus moves into the panel on open, Tab/Shift-Tab stay contained
      within the panel while open, and focus returns to the trigger on close. Confirm/Cancel
      are keyboard-operable.
- [ ] Reveal is **fade + slight scale-up** (panel ~`scale(0.97)` → `scale(1)` with opacity,
      scrim fades) and honors `prefers-reduced-motion` (stripped to a hard show under
      `reduce`).
- [ ] Pure focus-trap / dismiss-key decisions are factored into a React-free state module
      (e.g. `app/modal-state.js`) testable under `node --test` without the canvas import
      map — mirroring `collapsible-state.js` (ds-005) and `menu-state.js` (ds-015). (`Button`
      is presentational — no state module of its own.)
- [ ] Demonstrated on the styleguide canvas — `Button` (both variants), `Modal`, and
      `ConfirmDialog` (including a `destructive` specimen) — consistent with the existing
      token language. The visible addition reopens the design-system gate for builder
      re-review (the ds-005/007/009/015 precedent).
- [ ] (Follow-up, not in this task) aw-048's board-local confirm overlay can be migrated to
      consume `ConfirmDialog`.

## Notes
- **Promoted ahead of the hold (builder override, 2026-06-16).** The build-later trigger below
  was knowingly overridden — promoted to `todo` while aw-048's board-local confirm is still in
  backlog (zero shipped consumers, no second consumer). The shared primitive is being built
  ahead of a proven board-local shape; the canvas specimens are the proof-of-shape in lieu of
  a shipped consumer. The follow-up to migrate aw-048 onto `ConfirmDialog` still stands.
- **Build-later trigger (superseded by the override above).** By its own extraction logic this is
  build-later: ds-005 waited for *two* consumers before promoting a board-local control to
  the shared styleguide. Today there is **zero shipped consumers** — aw-048 hasn't shipped
  its board-local confirm overlay yet. Promote this to `todo` only once **(a)** aw-048's
  board-local confirm exists to prove the shape, and **(b)** a second confirm/modal consumer
  (or a deliberate builder call to unify the single one) justifies the shared primitive.
  This mirrors the ds-015 hold (a single consumer was not enough on its own).
- **Closest existing analog to reuse:** the `Drawer` (`app/drawer.js`, from ds-001) already
  implements scrim + Esc + scrim-click dismissal + a reduced-motion-stripped reveal. `Modal`
  is the **centered** sibling of that same machinery — lift the dismissal approach (the
  `window` keydown-Escape listener, the scrim `onClick`, the `requestAnimationFrame` shown-flag
  reveal toggle, the 200ms unmount delay) and the scrim dim (`rgba(8,9,12,0.40)`) rather than
  re-inventing them. **But three things differ deliberately:** (1) the Drawer is a *contained*
  overlay (`position: absolute; inset: 0; z-index: 40`, scoped to its pane) — `Modal` is
  **`position: fixed`, viewport-centered, above the Drawer**; (2) the reveal is **fade +
  scale-up**, not the Drawer's `translateX` slide; (3) `Modal` adds a **full focus trap**
  (the Drawer has none). Don't fork the Drawer — write `Modal` fresh, borrowing its proven bits.
- **No shared text-button primitive exists today** — only the icon-only `IconButton`
  (`app/drawer.js`). That's why ds-018 introduces `Button` (builder decision 2026-06-16); the
  `IconButton` hover/transition styling is the closest look to echo. `--obligation`
  (`#8C3A3A` light / `#B86C6C` dark) + `--obligation-soft` are confirmed present in
  `styles/colors_and_type.css`.
- **Not a blocker for aw-048** — that ships a board-local overlay now and migrates later.
- Mirrors the primitive-extraction pattern: a board-local control proves the shape, then a
  second would-be consumer justifies promoting it to the shared styleguide.

## Outcome
Shipped the three-layer confirm-dialog family to the styleguide, all authored in htm/no-JSX
(ADR-0005) and consumable unforked (ADR-0003):

- **`Button` (`styleguide/app/button.js`)** — the styleguide's first shared labelled button.
  `neutral` (default) + `destructive` variants; `destructive` draws from the `--obligation`
  danger family, never the reserved ochre accent (ADR-0016). Presentational, no state module.
- **`Modal` (`styleguide/app/modal.js`)** — the `Drawer`'s centered sibling. `position: fixed`,
  viewport-centered, `zIndex: 60` (stacks above the Drawer's `40`); scrim reuses the Drawer's
  exact `rgba(8,9,12,0.40)` dim; reveal is fade + `scale(0.97)→scale(1)`, stripped to a hard
  show under `prefers-reduced-motion` (ADR-0014); panel at `--shadow-lg`. Full focus trap —
  focus moves in on open, Tab/Shift-Tab stay contained, focus returns to the trigger on close.
- **`ConfirmDialog` (`styleguide/app/confirm-dialog.js`)** — composes `Modal` + `Button`.
  Consumer-supplied title/body; Cancel (neutral) + Confirm (neutral OR `destructive` via flag).
  Esc / scrim-click / Cancel all route through `onClose`; Confirm fires `onConfirm`.
- **`modal-state.js`** — React-free `isDismissKey` / `isTrapKey` / `nextTrapFocusIndex` (the
  focus-trap wrap math), testable under `node --test` without the canvas import map; mirrors
  `collapsible-state` / `menu-state`.
- **Canvas** — new section 12 (`ModalSection`) in `app/app.js`: Button (both variants) + a live
  ConfirmDialog specimen in neutral and destructive forms. Empty states renumbered to section 13.
- **Tests** — `styleguide/test/modal.test.mjs` (19 tests): pure dismiss/trap decisions +
  source-guards for fixed/centered placement, the scrim dim, z-index > 40, fade+scale reveal,
  reduced-motion strip, focus-trap delegation, `--obligation` (not accent) danger, Modal+Button
  composition, and canvas documentation. Full styleguide suite 73/73 green.

The visible canvas addition reopens the design-system gate for builder re-review (the
ds-005/007/009/015/017 precedent). `dist/` was NOT rebuilt — no shipped dashboard consumer yet;
`agentic-workflow-048` rebuilds it when it migrates the board's confirm onto `ConfirmDialog`
(the deferred follow-up, still standing). No ADR written — the load-bearing decisions were all
cornered in this task and grounded in ADRs 0003/0005/0014/0016.
