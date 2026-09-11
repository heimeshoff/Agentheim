---
id: agentic-workflow-049
title: Topbar settings menu — collapse Stop dashboard / theme / skip-permissions into a gear dropdown
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: f46e6e3
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, topbar, ui]
related_adrs: [ADR-0003, ADR-0017, ADR-0019]
related_research: []
prior_art: [agentic-workflow-029, agentic-workflow-028, agentic-workflow-021, agentic-workflow-017, agentic-workflow-026]
---

## Why
The main-column topbar has accumulated four separate controls — **Stop dashboard** (far
left), the **theme** toggle, the **skip-permissions** toggle, and the **Work** launch.
Three of those are settings/utility actions that don't need to occupy permanent bar real
estate; only Work is a primary action worth a standing button. Collapsing the utilities
behind a single gear menu declutters the topbar and gives the three controls a natural home
as the dashboard's settings surface grows.

This knowingly supersedes a micro-decision from aw-021, which kept the skip-permissions
toggle inline *"not a settings panel (there is one setting today)"*. With three controls now
collapsing together, the "one setting" rationale no longer applies — a settings menu is
warranted.

## What
Introduce a **settings gear icon** in the main-column topbar, immediately to the **left of
the Work button**. Clicking it opens a **dropdown menu** containing the three controls that
currently live in the topbar:

- **Stop dashboard** (today aw-028's quiet far-left launch)
- **Theme** (light/dark) toggle (aw-017)
- **Skip-permissions** armed toggle (aw-021)

The **Work** launch stays a standing button in the topbar, with the gear to its left. After
this change the topbar reads: `[breadcrumb] … [⚙ ▾] [ Work ]` — the standalone Stop /
theme / skip-perms buttons are no longer rendered inline; they live only inside the menu.

The three controls keep all their existing behavior and persistence unchanged — this is a
**relocation into a popover**, not a re-implementation:
- The theme toggle still feeds `ThemeCtx` / `theme-state.js` and animates the flip.
- The skip-permissions toggle keeps its persisted armed state (`skip-permissions-state.js`),
  its armed/danger `--obligation` treatment, and its effect on the per-launch cue. **The
  armed/danger hue must stay visible** on the toggle inside the menu — see acceptance criteria.
- Stop dashboard keeps its `launchOrCopy` bridge path and the post-stop `StoppedOverlay`.

### Resolved decisions (refinement, 2026-06-16)

1. **Primitive: board-local dropdown (path 2).** The styleguide exposes **no** Menu /
   Dropdown / Popover primitive (the only "Popover" reference is an `--shadow-md` elevation
   token comment in `foundations2.js`). So this is built as a **board-local, token-matched
   dropdown** — the established board-control precedent (the sort `<select>`, the group-by
   toggle), the styleguide consumed **unforked** (ADR-0003). A `design-system` follow-up
   capture (**design-system-015**) is filed to promote a shared `Menu`/`Popover` primitive
   later, mirroring how aw-014 filed ds-005 for the shared collapsible. **This task does NOT
   depend on ds-015** — it ships the board-local control now; ds-015 retires it later.
2. **Gear glyph: reuse the existing `settings-2` glyph** (the two-slider glyph already in
   `styleguide/app/icons.js`). It reads as "settings"; **no styleguide edit, no gate reopen**.
   Do not add a new cog glyph.
3. **Closed gear: NO armed cue.** The closed gear stays neutral even when skip-permissions
   is armed. The armed/danger `--obligation` hue lives **only on the skip-permissions toggle
   inside the open menu** — fully consistent with the amended ADR-0019 stance that the toggle
   is the single control wearing the full danger hue. (The per-launch button icon cue on the
   four launch buttons, aw-041/ADR-0019, is unaffected by this task.)
4. **Menu persistence: toggles keep the menu open.** Flipping the theme toggle or the
   skip-permissions toggle **keeps the menu open** (so both can be adjusted in one visit).
   The menu closes on: selecting **Stop dashboard** (which then shows the stopped overlay),
   **Esc**, and **outside click**.

## Acceptance criteria
- [ ] A settings **gear icon** (the existing `settings-2` glyph) renders in the main-column topbar, immediately left of the Work button.
- [ ] Clicking the gear opens a dropdown/popover menu; the menu contains exactly three items: Stop dashboard, the theme toggle, and the skip-permissions toggle.
- [ ] The standalone inline Stop dashboard / theme / skip-permissions controls are **removed** from the topbar — they appear only inside the menu.
- [ ] The Work button remains a standing button in the topbar (not moved into the menu).
- [ ] Each control inside the menu retains its existing behavior and persistence: theme flip + persistence (`theme-state.js`), skip-permissions armed state + persistence (`skip-permissions-state.js`), Stop dashboard bridge launch (`launchOrCopy`) + stopped overlay (`StoppedOverlay`).
- [ ] The skip-permissions item still wears its **armed/danger** (`--obligation`) treatment when armed, inside the menu, so a dangerous state is not hidden by being tucked away. The **closed gear carries no armed cue** (decision 3) — danger is signalled only on the toggle inside the open menu.
- [ ] The menu **dismisses** on outside click, on Esc, and on selecting **Stop dashboard** (which then shows the stopped overlay). Flipping the **theme** or **skip-permissions** toggle **keeps the menu open** (decision 4).
- [ ] The menu is reachable and operable by keyboard: the gear is focusable, Enter/Space opens it, menu items are focusable, and Esc closes it — consistent with the styleguide's interaction conventions.
- [ ] The dropdown is **board-local, token-matched** (built from styleguide tokens, the styleguide consumed unforked — ADR-0003); it adds **no** new styleguide primitive and **no** styleguide-source edit, so the design-system gate is not reopened.
- [ ] Honors the active light/dark theme (tokens, not hardcoded colors) and `prefers-reduced-motion` for any open/close transition.
- [ ] The dashboard `dist/` is **rebuilt from source** (`node build.mjs`) — it is a derived artifact (ADR-0003); the source edit alone does not update the bundle.

## Notes
**Relocation, not rewrite.** Reuse the existing control implementations and their persistence
stores as-is. The risk is regressing the skip-permissions armed/danger signalling (aw-021 /
aw-030 / aw-041 / ADR-0019) — the danger hue must survive the move into the menu (it now lives
on the toggle inside the open menu, never on the closed gear).

**Shared-primitive follow-up:** **design-system-015** (filed at this refinement) will promote a
shared `Menu`/`Popover` styleguide primitive once this board-local dropdown is the second
consumer pattern worth unifying. This task ships first and is retired into that primitive later
— the aw-014 → ds-005 sequencing.

**Frontend gate:** depends on `design-system-001-styleguide` per the BC frontend gate. The gate
is OPEN (re-approved by the builder); this task adds no styleguide-source change, so it does not
reopen it.

## Outcome

Introduced a board-local `SettingsMenu` component in `dashboard/app/board.js`: a settings
**gear** (the reused `settings-2` glyph, consumed unforked — no styleguide edit) sitting
immediately left of the standing **Work** launch in `BoardTopbar`. Clicking it opens a
token-matched dropdown collapsing the three utility controls — **Stop dashboard**, the
**theme** toggle, and the **skip-permissions** armed toggle — that aw-029/aw-028 had spread
inline across the topbar. The three controls keep their existing implementations and
persistence as-is (relocation, not rewrite); the skip-permissions toggle still wears its
`--obligation` armed/danger hue inside the open menu.

All four resolved decisions honored: (1) board-local dropdown built from tokens (the shared
`Menu`/`Popover` primitive is the existing ds-015 follow-up); (2) the existing `settings-2`
glyph reused, no styleguide source touched; (3) the **closed gear carries no armed cue** — the
danger hue lives only on the toggle inside the open menu; (4) the theme + skip-permissions
toggles **keep the menu open**, while Esc, outside click, and selecting Stop dashboard close
it. The gear is keyboard-operable (focusable, Enter/Space opens, `aria-haspopup`/`aria-expanded`,
Esc closes) and the reveal honors `prefers-reduced-motion` (a board-local inline opacity/translate
transition, not a styleguide keyframe — the shared CSS is copied verbatim from the styleguide
source per ADR-0003 and is never edited here).

**Key files**
- `dashboard/app/board.js` — new `SettingsMenu`; `BoardTopbar` rewired to `[⚙][Work]`.
- `dashboard/test/settings-menu.test.mjs` — new static-guard suite (14 tests).
- `dashboard/test/shell-relayout.test.mjs`, `dashboard/test/stop-dashboard.test.mjs` — updated
  the now-superseded inline-placement guards to point at `SettingsMenu`.
- `dashboard/dist/*` — rebuilt from source (`node build.mjs`, ADR-0003 derived artifact).
- `.agentheim/contexts/agentic-workflow/README.md` — documented the topbar settings menu and
  updated the theme / skip-permissions / Stop-dashboard control homes.

Full dashboard suite green (412/412). No styleguide source edited; the design-system gate is
not reopened. The shared-primitive follow-up `design-system-015` already exists in
`design-system/todo/` (filed at refinement) — no new backlog item created.
