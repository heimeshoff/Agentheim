---
id: agentic-workflow-017
title: Wire the styleguide light/dark theme toggle into the dashboard
status: done
type: feature
context: agentic-workflow
created: 2026-06-09
completed: 2026-06-09
commit: ccdf43d
depends_on: [design-system-001]
blocks: []
tags: [dashboard, theme, frontend, styleguide]
related_adrs: [0003, 0009, 0015]
related_research: []
prior_art: [agentic-workflow-015]
---

## Why
The styleguide is "dark-first **with a light toggle**" and ships a complete, working
theme switch — a `Segmented` Dark/Light control in its TopBar, the `data-theme`
documentElement mechanism, a `theme-fade` transition, and a full set of light-mode
tokens. The dashboard, the styleguide's only consumer, never wires any of this up: the
shell hardcodes `const [theme] = useState("dark")` (`dashboard/app/board.js:497`) with no
setter and no control, so the live dashboard is permanently dark. The builder wants the
documented toggle to exist in the actual design.

## What
Give the dashboard a working light/dark switch by **consuming the styleguide's existing
toggle, unforked** (ADR-0003) — no new design-system source. Concretely:

- Replace the hardcoded `useState("dark")` in `DashboardApp` with real theme state +
  setter, feeding the existing `ThemeCtx.Provider` (already imported, `board.js:40`/`531`)
  and the existing `data-theme` effect.
- Render the styleguide's `Segmented` Dark/Light control (sun/moon icons + labels,
  exported from `styleguide/app/live.js`, the same control `styleguide/app/app.js`'s
  `TopBar` uses) inside the dashboard `ShellRail` header (`board.js:456`), alongside the
  project name and the board↔library switch.
- Apply the `theme-fade` transition on flip, matching the styleguide `App()` effect
  (`styleguide/app/app.js:272`) so the dashboard re-themes with the same motion.
- **Persist + system default:** on first visit (no stored choice) honor the OS
  `prefers-color-scheme`; once the user toggles, remember that override across reloads in
  **versioned `localStorage`**, following the ADR-0015 / `board-view-state.js` precedent
  (versioned key; malformed / stale-version / absent all degrade safely to the system
  default). The choice must survive SSE live re-projections (not reset), like board
  view-state.

## Acceptance criteria
- [ ] `DashboardApp` owns real theme state with a setter (no hardcoded `useState("dark")`); `ThemeCtx.Provider` value reflects the current theme.
- [ ] The styleguide `Segmented` Dark/Light control is rendered in the `ShellRail` header via an unforked import from `styleguide/app/live.js` — no design-system source is modified.
- [ ] Toggling sets `data-theme` on `documentElement` and the dashboard visibly re-themes (light-mode tokens apply across the board, library, and slide-over).
- [ ] The `theme-fade` transition class is applied on flip, matching the styleguide `App()` behaviour.
- [ ] First visit with no stored choice honors `prefers-color-scheme` (system dark → dark, system light → light).
- [ ] After the user toggles, the choice persists across a reload via versioned `localStorage`; a malformed, stale-version, or absent value degrades safely to the system default.
- [ ] The chosen theme survives an SSE live re-projection (does not reset to default mid-session).
- [ ] The dashboard `dist/` bundle is rebuilt so the served artifact reflects the change (ADR-0003 — `dist/` is derived).
- [ ] Tests cover the persistence/default resolution: versioned round-trip, malformed/stale/absent → system default, and `prefers-color-scheme` honored on first visit.

## Notes
- **Everything needed already exists on the styleguide side** — `Segmented` (`live.js`),
  `ThemeCtx` (`foundations.js`), the `[data-theme]` light/dark tokens
  (`styleguide/styles/colors_and_type.css`), and `theme-fade`. This task is pure
  consumption; it does **not** reopen the styleguide gate.
- **Persistence precedent:** mirror `dashboard/app/board-view-state.js` (ADR-0015) — a
  versioned `localStorage` store with safe degradation. Theme is a sibling concern to the
  per-column view-state; consider whether it shares that store's versioning convention or
  gets its own small key. Worker's call at TDD time.
- **Placement:** the `ShellRail` header (`board.js:456`) is the dashboard analogue of the
  styleguide `TopBar`; the toggle belongs there next to the project name (aw-015) and the
  board↔library switch. The styleguide puts the same control in the same chrome position.
- **Gate:** frontend task → `depends_on: [design-system-001]` (styleguide gate, OPEN since
  2026-06-05). No new styleguide review needed since no design-system source changes.
- Leave the exact persistence key name, the system-preference listener (static read vs.
  live `matchMedia` subscription), and the precise header layout to the worker.

## Outcome
The dashboard now has a working light/dark switch, consuming the styleguide's existing
toggle unforked (ADR-0003) — no design-system source touched.

Worker decisions:
- **Own key, not shared.** Theme persists under its own versioned `localStorage` key
  `agentheim.dashboard.theme` (not the board's `agentheim.board.viewState`). Theme is a
  global page concern, not a per-column lens, and the two evolve independently — a new pure
  module `dashboard/app/theme-state.js` mirrors `board-view-state.js`'s versioned-envelope +
  safe-degradation shape (`THEME_KEY`, `THEME_VERSION`, `loadTheme`/`saveTheme`,
  `systemTheme`, and the single first-paint decision `resolveTheme`).
- **Static read of `prefers-color-scheme`** (a one-time `window.matchMedia` read in the
  lazy `useState` initializer), not a live `matchMedia` subscription — first visit honors
  the OS preference; once the user toggles, the stored override wins on reload. The
  one-time read means an SSE re-projection of `/api/tree` (re-render of the surfaces below)
  never resets the chosen theme.
- **No new ADR.** Pure unforked consumption (ADR-0003) over the established ADR-0015
  persistence precedent; the separate-key call is recorded in code + README.

Wiring in `dashboard/app/board.js`: `DashboardApp` replaces the hardcoded
`useState("dark")` with `resolveTheme(window.localStorage, window.matchMedia)`-seeded
state + an `onThemeChange` that persists via `saveTheme`; the `data-theme` effect now adds
the `theme-fade` class on flip (matching the styleguide `App()` behaviour, 320ms). The
styleguide `Segmented` Dark/Light control (sun/moon) renders in `ShellRail` at the right
end of the header, next to the project name and board↔library switch.

Tests: 13 new pure-store tests in `dashboard/test/theme-state.test.mjs` (versioned
round-trip, malformed/stale/absent/unknown → null → system default, `prefers-color-scheme`
honored on first visit, override beats system). Full dashboard suite green (196 tests,
including the fresh `dist/` rebuild assertions). `dashboard/dist/` rebuilt.

Key files: `dashboard/app/theme-state.js`, `dashboard/app/board.js`,
`dashboard/test/theme-state.test.mjs`, `dashboard/dist/app.js`,
`.agentheim/contexts/agentic-workflow/README.md`.
