---
id: agentic-workflow-048
title: Board card dismiss — hover-revealed red trash can with a confirmation dialog
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: 5864548
depends_on: [agentic-workflow-046, design-system-001-styleguide, design-system-017, design-system-018]
blocks: []
tags: [dashboard, board, card, dismiss, frontend, bridge]
related_adrs: [0022, 0017, 0018, 0003, 0016]
related_research: []
prior_art: [agentic-workflow-022, agentic-workflow-018, agentic-workflow-028]
---

## Why
A backlog or todo ticket sometimes simply needs to go away — a duplicate, a stray
capture, an abandoned idea. Today the board has no way to drop one; the only card
actions are launches (Refine / Promote / Work). The builder wants a quiet,
discoverable affordance: a red garbage can in the card's top-right corner that appears
on hover, with a confirmation step so a dismissal is never a one-misclick accident.

The board is read-only (ADR-0017), so this button does not delete anything itself — it
fires the `modeling` **DISMISS** verb (agentic-workflow-046, now done) through the VS Code
bridge (ADR-0018), exactly as Refine/Promote seed and fire their commands. The agent then
does the delete + bookkeeping, and the board live-updates (SSE) when the file disappears.

## What
On every **backlog** and **todo** card, render a **red trash-can icon button** in the
**top-right corner**:
- **Hidden by default; revealed on card hover** (and on the button's own keyboard focus,
  for accessibility).
- **Highlighted on button hover** (intensified red / background cue).
- **Backlog + todo only.** `doing` and `done` cards never show it (mirrors the
  backlog-only affordance precedent, aw-018 — and DISMISS itself refuses those states).
- Clicking it opens the shared styleguide **`ConfirmDialog`** (design-system-018, now done —
  consumed **unforked**, ADR-0003), passing `destructive=true`, a `title`
  ("Dismiss '<title>'?") and body copy. Confirming (the dialog's `onConfirm`) fires
  `/agentheim:modeling dismiss <id>` via `launchOrCopy` (the existing bridge path), falling
  back **silently** to clipboard when the bridge is absent. Cancelling — the dialog's
  `onClose`, reached by the Cancel button, Esc, **or** scrim-click — closes it and does
  nothing. `ConfirmDialog` already owns the scrim, the centered viewport-fixed panel, the
  focus trap, the fade+scale reveal (reduced-motion stripped), and stacking above the
  slide-over Drawer — the board supplies only `open`, the copy, and the two callbacks.
  - **Cascade caveat (ADR-0022):** the DISMISS verb the button fires can delete a whole
    dependent subtree, not just this one card. The board card can only name the card it
    sits on, so the dialog's copy must make clear that confirming runs the *agent's*
    cascade dismiss — which itself **lists and re-confirms the full cascade set inside the
    spawned session** before deleting anything. The button is a seed-and-fire, not the
    final say; it does **not** compute the cascade set itself (the board is read-only over
    disk, ADR-0017).
- The click is **propagation-isolated** so dismissing never opens the slide-over.

### Placement — a board-local top-right overlay, not `cornerAction`
The capture assumed the trash would "share or compete with" the styleguide `TicketCard`
`cornerAction` slot. It does not: **`cornerAction` is the card's *bottom-right meta row*
slot** (design-system-006), where the backlog Refine/Promote pair already lives (aw-022).
The trash can wants the **top-right corner**, for which `TicketCard` exposes **no slot**.

So the trash can is a **board-local overlay positioned over the card**, with `TicketCard`
consumed **unforked** (ADR-0003): the board wraps each backlog/todo card in its own
`position: relative` host and absolutely positions the trash button at the host's
top-right, as a *sibling* of the card (outside the card's own `overflow: hidden`). This
means the two affordances **coexist cleanly** — on **backlog** cards the trash sits
top-right while Refine/Promote keep the bottom-right `cornerAction`; on **todo** cards the
trash stands alone (todo passes no `cornerAction`). No `TicketCard` prop is added and no
styleguide edit is made for placement (the trash *glyph* is the one styleguide addition —
see ds-017 below).

The card's own hover state lives inside `TicketCard` and does not surface to the board, so
the **hover reveal is driven by the board-local host wrapper** (its own
`onMouseEnter`/`onMouseLeave`, the `LaunchButton`/`TicketCard` hover-state precedent) plus
the button's own focus — the button is always in the DOM at `opacity: 0` and transitions
to `opacity: 1` on host hover or button focus, so it is keyboard-reachable without a
pointer.

## Acceptance criteria
- [ ] Backlog and todo cards show a trash-can button in the **top-right** corner;
      doing/done cards never do.
- [ ] The button is hidden (opacity 0) until the card is hovered **or** the button itself
      is keyboard-focused, and visibly highlights on its own hover.
- [ ] On backlog cards the trash (top-right) coexists with the Refine/Promote
      `cornerAction` pair (bottom-right); on todo cards the trash stands alone. The
      styleguide `TicketCard` is consumed unforked — no new prop, no styleguide edit for
      placement.
- [ ] The trash icon is the shared `Icon name="trash-2"` glyph (added by ds-017), tinted
      with the styleguide danger token (`--obligation`), consumed unforked.
- [ ] Clicking opens the shared styleguide `ConfirmDialog` (ds-018) with `destructive=true`,
      naming the task; the board consumes it **unforked** (no fork, no styleguide edit). Confirm
      fires the dismiss command; cancel (Cancel button, Esc, or scrim-click — all the dialog's
      own `onClose`) closes with no effect.
- [ ] The dialog body copy makes clear the agent runs the cascade dismiss and will list +
      re-confirm the full set in the spawned session (the button names only this card).
- [ ] The dashboard `dist/` bundle is rebuilt (esbuild) so the deployed app actually imports
      `ConfirmDialog` — ds-018 deliberately did **not** rebuild `dist/` (it had no shipped
      consumer); aw-048 is that consumer and owns the rebuild.
- [ ] On confirm with the bridge present, `POST /run` is sent with
      `/agentheim:modeling dismiss <id>`; with the bridge absent it silently copies the
      command to the clipboard (quiet "Copied" feedback), never throwing.
- [ ] Dismissing never opens the slide-over (propagation stopped on the button and the
      dialog).
- [ ] After the agent deletes the file, the card disappears from the board via the
      existing SSE live-update — no dashboard write path is added (ADR-0017 holds).
- [ ] The board stays read-only: no new server endpoint, no disk write from the client.
- [ ] `dismissCommandFor(id)` is a pure, unit-tested function (see Notes); a
      missing/non-string id degrades to the bare verb command, never `[object Object]`,
      never a throw.

## Notes
- **Trash glyph → design-system (ds-017).** Decision (builder, 2026-06-16): rather than
  hand-rolling a board-local inline SVG, add the Lucide `trash-2` glyph to the shared
  `icons.js` `LUCIDE` set via **design-system-017** and consume it as `Icon name="trash-2"`.
  Keeps icons in one place (the board never hand-rolls inline SVGs today), at the cost of a
  blocking dependency on ds-017. The icon is tinted with the existing `--obligation` danger
  token family — consumed unforked (ADR-0003), the same red the skip-permissions cue uses
  (aw-021/aw-041), deliberately **not** the reserved selection accent `--accent-ochre-soft`
  (ADR-0016).
- **Confirmation dialog → consume the shared `ConfirmDialog` (ds-018, now DONE).** Refine
  decision (builder, 2026-06-16): at capture time the styleguide had **no** centered confirm
  primitive, so the dialog was specced as a board-local hand-rolled overlay with ds-018 merely
  *filed* as a follow-up. **ds-018 has since shipped** (commit `29482ee`): `styleguide/app/`
  now exports `Button` (neutral + `destructive`/`--obligation`), `Modal` (viewport-fixed,
  centered, scrim `rgba(8,9,12,0.40)`, `zIndex:60` above the Drawer's 40, fade+scale reveal
  stripped under reduced-motion, full focus trap), and `ConfirmDialog` composed over both. So
  aw-048 **no longer hand-rolls anything** — it imports `ConfirmDialog` from the committed dist
  and consumes it **unforked** (ADR-0003), exactly as the board already consumes
  `TicketCard`/`Drawer`/`Menu`. This collapses the original board-local overlay work to a thin
  consumer: `ConfirmDialog({ open, title, children: <cascade-caveat copy>, onClose, onConfirm,
  destructive: true })`. The aw-014 → ds-005 / aw-049 → ds-015 board-local-first →
  shared-primitive sequencing is **already complete** here — ds-018 was promoted ahead of its
  own build-later hold (builder override, protocol 2026-06-16 13:30) precisely so aw-048 could
  consume it directly and skip the board-local stage. The `destructive` Confirm draws from the
  `--obligation` family, never the reserved ochre accent (ADR-0016).
- **ds-018 reopened the design-system gate.** Its visible canvas addition (section 12: `Button`
  both variants + a live `ConfirmDialog` neutral/destructive) reopened the styleguide gate
  (work session-end note, 2026-06-16 13:35). The builder should re-review the canvas
  (`styleguide/index.html` → section 12) before aw-048 ships its dialog onto `ConfirmDialog` —
  the standing ds-005/007/009/015/017 gate precedent.
- **Command string** is a pure function of the id — extend `modeling-command.js`
  (`dismissCommandFor(id)` → `/agentheim:modeling dismiss <id>`, unit-tested under
  `node --test`), mirroring `refineCommandFor`/`promoteCommandFor` and reusing the shared
  `safeId` helper; a missing/non-string id degrades to the bare verb command
  (`/agentheim:modeling dismiss`), never `[object Object]`, never a throw.
- **Reuses** `launchOrCopy` (`bridge-launch.js`) unchanged — same bridge contract as
  every other launch button. (Does **not** thread `skipPermissions`: a dismiss is a
  destructive intent that should keep its normal permission prompt; mirrors the Stop
  button's non-arming, aw-028. Refinement decision — revisit only if the builder wants it
  armable.)
- **All four dependencies are now done** — the task is dependency-clear. `agentic-workflow-046`
  (the DISMISS verb) is done, so the button has a real verb to fire; the frontend styleguide
  gate (`design-system-001-styleguide`) is approved; the trash-glyph gate (`design-system-017`,
  commit `984d317`) is done; and the confirm-dialog gate (`design-system-018`, commit `29482ee`)
  is done. ds-017 and ds-018 each reopened the styleguide gate for builder canvas re-review — the
  one remaining human checkpoint before this is worked.
- **Renumbered from aw-047** at capture time — a concurrent session had already taken
  047 for an unrelated task (detail surfaces lead with title); resolved per the
  duplicate-id rule by moving this, the less-integrated one, to the next free number.

## Outcome
Backlog and todo cards now carry a hover-revealed red trash can in the top-right corner that
seeds-and-fires the `modeling` DISMISS verb through the VS Code bridge.

- `dashboard/app/modeling-command.js` — added the pure `dismissCommandFor(id)` builder
  (`/agentheim:modeling dismiss <id>`), mirroring `refineCommandFor`/`promoteCommandFor` (shared
  `safeId`, explicit-verb, degrade-on-empty to the bare verb command, trims).
- `dashboard/app/board.js` — imports `ConfirmDialog` (ds-018) and `dismissCommandFor`; new
  `CardTrashCan` component renders the shared `Icon name="trash-2"` tinted `--obligation`, opacity-0
  until host hover OR own focus, highlighting on its own hover; clicking opens the shared
  `ConfirmDialog` (`destructive=true`) whose Confirm fires `dismissCommandFor(ticket.id)` via
  `launchOrCopy` (no `skipPermissions` threaded — mirrors Stop, aw-028) and whose dialog body conveys
  the agent's cascade dismiss + in-session re-confirmation (ADR-0022). `BoardCard` wraps backlog/todo
  cards in a `position: relative` host with the trash as a top-right sibling overlay; doing/done get
  the bare card. `TicketCard` consumed unforked — no new prop, no styleguide edit.
- Tests: 7 new unit tests for `dismissCommandFor` in `dashboard/test/modeling-command.test.mjs`
  (red→green), plus 11 board-glue static guards in the new
  `dashboard/test/board-card-dismiss.test.mjs` (mirroring backlog-card-launch / stop-dashboard idiom).
- `dashboard/dist/` rebuilt (esbuild) so the deployed bundle imports `ConfirmDialog` and carries the
  dismiss wiring (ds-018 had left dist unbuilt; aw-048 is its first consumer). Full suite: 429 pass.
- BC README updated with a *Board card dismiss* affordance bullet.
- No ADR written — all decisions were pre-made by ADR-0022/0017/0018/0003/0016 and the task refinement.
