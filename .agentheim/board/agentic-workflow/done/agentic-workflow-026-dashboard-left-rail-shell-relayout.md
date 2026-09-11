---
id: agentic-workflow-026
title: Rewrite the dashboard shell to the styleguide's left-rail layout (Components in context)
status: done
type: refactor
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 0ab1f34
depends_on: [design-system-001]
blocks: [agentic-workflow-027]
tags: [dashboard, frontend, ui, shell, styleguide]
related_adrs: [0009, 0011, 0017, 0003, 0018, 0019]
related_research: []
prior_art: [agentic-workflow-006, agentic-workflow-008, agentic-workflow-009, agentic-workflow-017]
---

## Why

The live dashboard shell (`dashboard/app/board.js` → `DashboardApp` + `ShellRail`) is a
**horizontal top header** (brand · Board/Library inline nav · skip-permissions · theme
toggle) over a centered 1160px `<main>` that stacks either the board or the library grid.
The approved styleguide section 05 — **"Components in context"** (`styleguide/app/live.js`
→ `LiveApp`) — assembles the canonical product chrome differently: a full-height **left
rail** (brand → Board nav → a scrollable **Workspace file-tree** → footer) beside a **main
column** (a 52px topbar over the scrollable board), with the drawer from the right, all in
one bordered, elevated frame. The builder wants the live dashboard rewritten to read as
that assembled product — and, specifically, the library's content (the file-tree) shown in
the left rail with a **Board re-select option at the very top** of that menu.

## What

Replace the centered `<main>` + horizontal `ShellRail` with a full-height **flex-row
shell**: a left **rail** beside a main column (a **topbar** over the scrollable board).

- **Compose the rail from styleguide primitives** (`Glyph`, `RailItem`, `TreeGroup` /
  `TreeItem`) — **not** the styleguide `AppRail`, which is hardwired to the demo `LIBRARY`
  constant — exactly as today's `ShellRail` already composes from primitives (consumed
  unforked, ADR-0003). Top-to-bottom the rail carries: brand (`Glyph` + "Agentheim" + the
  live `projectName` when present) → a **Board** `RailItem` (the "reselect the board"
  option at the very top, and the **only** nav `RailItem` — there is **no** separate
  "Library" item; the always-visible tree below *is* the library) → a divider → a
  "Workspace" label → the **live** library tree fed by the existing `treeToLibrary(tree)`
  (`dashboard/app/library.js`), never the styleguide demo data → a **rail footer** holding
  the **theme toggle** and the **skip-permissions armed toggle** (relocated out of the
  retired horizontal header — the footer gives the skip-permissions danger treatment a
  stable home, ADR-0019).
- **Main-pane topbar:** a board title / breadcrumb plus a primary action button styled like
  the §05 **"New ticket"** button — the **filled inverse** look (`background`/`border:
  var(--fg-1)`, `color: var(--surface-0)`), most likely a new `LaunchButton` emphasis
  variant. This button **is the Work launch** — it performs a **read-only launch** of the
  bare `/agentheim:work` via `launchOrCopy` (`WORK_COMMAND`; ADR-0017/ADR-0018), threading
  `skipPermissions` (aw-021) and passing **no** `onResult` (Work never consumed a prompt) —
  it never creates a ticket, since the board is a projection of disk. **No Search box** is
  rendered (the §05 search is dropped — the dashboard is read-only with no search backend).
- **Consequence for the board prompt bar (aw-023/aw-024):** the Work button **moves out of
  the prompt bar into this topbar**. The prompt bar keeps **only** its textarea + the
  **Quick Capture / Modeling** pair (the aw-024 two-thirds/one-third split collapses back —
  the prompt bar no longer carries a right-side Work action). `WORK_COMMAND` and the
  `launchOrCopy`/`LaunchButton` wiring are reused unchanged; only the button's *home* changes.
- In this task, clicking a **non-task** library row in the rail still opens the **slide-over**
  (open-intent path unchanged) — re-routing non-task docs into the main content pane is the
  follow-on aw-027 (so this task can land as one coherent shell-relayout commit).

No styleguide file is modified; this is a pure consumer-side recomposition (ADR-0003 /
ADR-0009).

## Acceptance criteria

- [ ] The shell renders as a **flex-row** — a full-height left rail beside a main column
      (topbar over the scrollable board) — replacing the centered 1160px `<main>` +
      horizontal `ShellRail`.
- [ ] The left rail shows, in order: brand (`Glyph` + "Agentheim" + live `projectName` when
      present) → a **Board** `RailItem` at the top (the **only** nav item — **no** separate
      "Library" `RailItem`) → divider → "Workspace" label → the live file-tree
      (`TreeGroup`/`TreeItem` over `treeToLibrary(tree)`) → a **rail footer** → all from
      styleguide primitives imported as-is (no fork).
- [ ] The rail's library tree is driven by the **live** `/api/tree` projection, never the
      styleguide demo `LIBRARY` constant.
- [ ] A main-column **topbar** renders above the scrollable board with a board title /
      breadcrumb and a primary action button styled as the §05 inverse button
      (`background: var(--fg-1)`; `color: var(--surface-0)`). **No Search box** is rendered.
- [ ] That topbar button **is the Work launch**: it performs a **read-only launch** of the
      bare `/agentheim:work` via `launchOrCopy` (reusing `WORK_COMMAND`), never a lifecycle
      write; bridge-absent still falls back to the silent clipboard copy; it threads
      `skipPermissions` and passes no `onResult`.
- [ ] The board **prompt bar** keeps **only** its textarea + Quick Capture / Modeling pair —
      its right-side **Work** button is **removed** (relocated to the topbar); Quick Capture /
      Modeling prompt-seeding is otherwise unchanged.
- [ ] The theme toggle and the skip-permissions armed toggle live in the **rail footer** and
      remain functional (persisted state + armed/danger treatment unchanged); the old
      horizontal header is gone.
- [ ] Clicking a board card still opens the slide-over (open-intent path unchanged in this
      task).
- [ ] `/api/tree`, `/api/doc`, `/api/events` remain the only data sources; no new write
      path; SSE live-update still re-projects the board within a frame.
- [ ] No styleguide file is modified.

## Notes

Decomposed from a single capture by the orchestrator (tactical-modeler) into A→B; this is
task **A**. Task **B** is aw-027 (non-task docs render in the main pane; slide-over becomes
task-only) and depends on this one.

**Open questions settled in the REFINE pass (2026-06-15)** — all four resolved with the
builder to the orchestrator's recommended option, now folded into *What* / *Acceptance
criteria* above:

- **`BoardPromptBar` vs. the topbar button.** → The topbar's inverse button **becomes** the
  **Work** launch; the prompt bar keeps only its textarea + Quick Capture / Modeling (aw-024's
  right-side Work button is removed/relocated to the topbar). One Work entry point.
- **Topbar Search box.** → **Dropped** — read-only dashboard, no search backend; don't ship a
  non-functional control. (A search surface can be captured separately if ever wanted.)
- **Where the theme + skip-permissions toggles live.** → **Rail footer** — gives the
  skip-permissions danger treatment a stable home; the old horizontal header is retired.
- **Does the Library `RailItem` survive?** → **Dropped** — the always-visible Workspace tree
  *is* the library; only the **Board** item sits above the tree. (The `view: "library"`
  branch / full-pane library surface is formally retired in aw-027.)

Dependency note (REFINE 2026-06-15): the original `depends_on` carried **aw-025** (the
temporary celebration-test button). That was dropped — aw-025 is a throwaway and is itself
under-refined, so blocking a permanent shell-relayout on it was backwards. The only real
overlap is that both edit `board.js`; that is a **work-scheduling** concern (don't run the
two in parallel), not a hard dependency. design-system-001 (the styleguide gate) is **done**,
so with aw-025 removed this task was promoted backlog → todo.

Index drift note: aw-025 was present in `backlog/` but missing from the BC INDEX when this
task was captured; the INDEX backlog list was corrected at the same time.

## Outcome

The live dashboard shell was rewritten from a horizontal-header-over-centered-`<main>`
layout to the styleguide §05 "Components in context" **full-height left-rail** layout —
pure consumer-side recomposition, no styleguide file touched (ADR-0003 / ADR-0009).

What changed in `dashboard/app/board.js`:

- **`DashboardApp`** is now a **flex-row** shell: `ShellRail` (left) beside a main column
  that stacks a `BoardTopbar` over the scrollable `DashboardBoard`. The centered 1160px
  `<main>`, the `view` state, the board↔library toggle, and the full-pane `DashboardLibrary`
  mount are all retired (the `library.js` view file is left in place for aw-027 to remove).
- **`ShellRail`** is rewritten to a vertical full-height `<nav>` composed from styleguide
  **primitives** (`Glyph` / `RailItem` / `TreeGroup`/`TreeItem`, never the demo `AppRail`):
  brand (`Glyph` + "Agentheim" + live `projectName`) → a single **Board** `RailItem` →
  divider → "Workspace" label → the **live** `treeToLibrary(/api/tree)` tree (re-fetched on
  every SSE frame via `useLiveTree`) → a **footer** holding the relocated theme toggle +
  skip-permissions armed toggle (danger treatment preserved, ADR-0019). No separate Library
  `RailItem` — the always-visible tree *is* the library (ADR-0011).
- **`BoardTopbar`** (new) renders the §05 board title/breadcrumb + the **inverse** Work
  launch (no Search box). The Work button reuses `WORK_COMMAND` / `launchOrCopy` /
  `LaunchButton` unchanged, threads `skipPermissions`, passes **no** `onResult`.
- **`LaunchButton`** gained an `emphasis="inverse"` variant (`background`/`border: --fg-1`,
  `color: --surface-0`) — a board-local emphasis, styleguide consumed unforked.
- **`BoardPromptBar`** lost its aw-024 right-side Work button + two-thirds/one-third split;
  it collapses back to a full-width textarea above the unchanged Quick Capture / Modeling
  pair. One Work entry point now lives in the topbar.

The dashboard stays read-only (ADR-0017): `/api/tree`, `/api/doc`, `/api/events` remain the
only data sources; non-task rows + cards still open the universal slide-over; SSE
re-projection re-fetches both the board and the rail tree within a frame.

Tests: added `dashboard/test/shell-relayout.test.mjs` (13 source-reading static guards for
the rail composition, the single Board RailItem, the live-tree feed, the footer toggles, the
inverse topbar Work launch, and the no-styleguide-edit invariant); rewrote the aw-024
assertions in `dashboard/test/board-prompt-bar.test.mjs` to lock the Work button's removal
from the prompt bar. Full dashboard suite **272 green** (was 262). `dashboard/dist/app.js`
rebuilt via `npm run build`.

Key files: `dashboard/app/board.js`, `dashboard/dist/app.js`,
`dashboard/test/shell-relayout.test.mjs`, `dashboard/test/board-prompt-bar.test.mjs`,
`.agentheim/contexts/agentic-workflow/README.md`.

No ADR written — the refactor composes the settled ADRs (0009/0011/0017/0003/0018/0019)
unchanged; the `inverse` emphasis is a board-local variant under ADR-0003, not a new
decision.
