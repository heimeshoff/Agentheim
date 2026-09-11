---
id: agentic-workflow-062
title: Dashboard About page — left-rail item below Board, profile bio + Ko-fi support
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: c9ac4d5
depends_on: [design-system-001, agentic-workflow-058]
blocks: []
tags: [dashboard, frontend, about, ui, rail]
related_adrs: [0025, 0021, 0009, 0011, 0003, 0017]
related_research: []
prior_art: [agentic-workflow-026, agentic-workflow-027, agentic-workflow-008, agentic-workflow-040]
---

## Why
The dashboard has no "who built this / how to support it" surface. The builder wants
the same About experience his WhisperHeim app has: a short personal introduction and a
way for users to support the open-source work (Ko-fi). It gives Agentheim a face and a
support path without leaving the dashboard.

This is the **"future About page"** ADR-0025 explicitly anticipated: a second built-in
static page that drops into the `mainView` third-view-state pattern aw-058 establishes —
so it is now "a one-line `mainView` enum extension, not another shell-state invention."

## What
Add an **About** navigation item to the dashboard's left rail (`ShellRail`), in the
**primary-nav region below Board** (alongside the Workflow item aw-058 adds). Selecting
**About** shows a built-in About page in the **main content area**, mirroring the **top
two cards** of WhisperHeim's About page
(`WhisperHeim/src/WhisperHeim/Views/Pages/AboutPage.xaml`):

1. **Profile & contact card** — a circular profile photo beside a bio describing Marco
   as a person, plus a *Get in touch* list of contact links.
2. **Support card** — a "buy me a coffee" line, the **Ko-fi gradient button**
   (`https://ko-fi.com/heimeshoff`), a closing thank-you line, and a *View on GitHub*
   link.

The deeper WhisperHeim sections (Philosophy / AI-Models bento grid) are **out of scope** —
only these two cards.

Scope confirmed with the builder: **both cards in full** (bio + contact links + Ko-fi +
GitHub) and **include the profile photo** (an image asset committed into the dashboard's
served files — reuse `WhisperHeim/src/WhisperHeim/Assets/heimeshoff.jpg`).

### Routing (governed by ADR-0025 — extend the aw-058 scaffold, do not reinvent)
- aw-058 lands `mainView` (`"board" | "workflow"`, default `"board"`) in `DashboardApp`
  (`dashboard/app/board.js`). This task **extends the enum** to add `"about"`.
- Add an **About `RailItem`** below Board (in the same primary-nav region as Workflow)
  with `active=${mainView === "about"}` and its own `onSelectAbout` handler that sets
  `mainView = "about"` and clears **both** `selectedDoc` and `openIntent`.
- **Thread the reset:** every existing handler that lands something else in the main pane
  — `onSelectBoard`, `onSelectWorkflow`, `onOpen` (task + doc branches), `onOpenSearch`,
  `onOpenFullScreen` — must reset `mainView` to `"board"` (or its own value), so the
  three+ states stay **mutually exclusive by construction** (the one mechanical risk
  ADR-0025 calls out). Main-pane render precedence extends to
  `workflow → about → document → board` (exact ordering per the aw-058 implementation).
- `intent-route.js` (`isTaskIntent`) and `main-pane-reader.js` stay **byte-unchanged** —
  the About page is **not** an open-intent (no `status`, no `path`, no `/api/doc` fetch),
  per ADR-0021/ADR-0025.

### Content (starting copy — adapted from WhisperHeim to Agentheim; builder may tweak wording)
- **Bio (describes the person):**
  - "Hi, I'm **Marco Heimeshoff** — trainer, consultant, and conference organiser focused
    on **Domain-Driven Design** and **collaborative modeling**."
  - "DDD is all about creating a *ubiquitous language* within *bounded contexts* — and
    Agentheim brings that same discipline to building software with Claude Code, so the
    model corners ambiguity instead of producing plausible-looking mush."
  - "When I'm not helping teams design meaningful software, I enjoy building open-source
    tools like this one to make life a little smoother."
- **Get in touch:** heimeshoff.de · Bluesky `@Heimeshoff.de`
  (`https://bsky.app/profile/heimeshoff.de`) · LinkedIn `linkedin.com/in/heimeshoff`.
- **Support card:** "If you enjoy Agentheim and want to support my open-source work, you
  can buy me a coffee!" → **Ko-fi button** → `https://ko-fi.com/heimeshoff` → "Otherwise,
  just enjoy using Agentheim for free — and thanks for giving it a try!" → *View on GitHub*
  → `https://github.com/heimeshoff/Agentheim` (the Agentheim repo, **not** WhisperHeim's).

## Acceptance criteria
- [ ] The left rail shows an **About** `RailItem` in the primary-nav region **below Board**
      (composed from the styleguide `RailItem` primitive, consumed unforked — ADR-0003),
      keyboard-operable like the existing rail items.
- [ ] Clicking **About** shows the About page in the **main content area** via the
      `mainView === "about"` state; the About rail item reads `active` and Board/Workflow
      do not; no two rail rows highlight at once.
- [ ] Clicking **Board** (or Workflow, or opening a task/doc/search result) leaves About
      and resets the main pane correctly — the About page never lingers under a later
      click (mutual exclusivity by construction; the ADR-0025 reset is threaded through
      every handler).
- [ ] **Profile card** renders the circular profile photo + the three-paragraph bio +
      the *Get in touch* links. Links open the external target (new tab / `target=_blank`
      with safe `rel`), not in-app navigation.
- [ ] **Support card** renders the support copy, the **Ko-fi gradient button** linking to
      `https://ko-fi.com/heimeshoff`, the closing line, and the *View on GitHub* link to
      `https://github.com/heimeshoff/Agentheim` — both open in a new tab.
- [ ] A **profile image asset** is committed into the dashboard's served files and loads
      on the page (no broken image).
- [ ] `intent-route.js` (`isTaskIntent`) and `main-pane-reader.js` are **byte-unchanged**;
      the About page is never routed as an open-intent.
- [ ] Presentation-only — no writes to `.agentheim/`, no new server write endpoint; the
      dashboard stays read-only (ADR-0017).
- [ ] Built from styleguide **tokens / primitives, unforked** (ADR-0003); the gradient
      Ko-fi button is **board-local token-matched** (the styleguide has no such button —
      adapt WhisperHeim's blue gradient to the Agentheim palette; do **not** fork the
      styleguide), following the StoppedOverlay / board-control precedent.
- [ ] Honors light/dark theme (text / surface tokens resolve per active theme).
- [ ] `dashboard/dist/app.js` is rebuilt (esbuild) so the deployed app carries the change.

## Notes
- **Depends on aw-058** (the `mainView` routing scaffold). Build About *after* aw-058 so
  the third-view-state machinery exists; this task only **extends** the enum + adds the
  rail item + content, per **ADR-0025** (read it first — it spells out the precedence, the
  per-handler resets, and the rail-active predicates). If aw-058 ships first, the About
  page is genuinely a small additive change.
- **Static asset path.** Find where the dashboard serves static files from (the esbuild
  `dist/` static handler) and commit the profile image there; reference it with a served
  URL, not a filesystem path. Reuse `heimeshoff.jpg` from WhisperHeim's `Assets/`.
- The About rail item is **fixed nav chrome**, not part of the live `treeToLibrary` tree
  (ADR-0011 keeps the tree as the library; About is navigation like Board/Workflow).
- **References:**
  - WhisperHeim source for the two cards:
    `WhisperHeim/src/WhisperHeim/Views/Pages/AboutPage.xaml` (Profile & Contact card lines
    ~50–162, Support & GitHub card lines ~164–230) and `.xaml.cs`
    (`https://ko-fi.com/heimeshoff`, `Hyperlink_RequestNavigate` handlers).
  - Shell / rail: `dashboard/app/board.js` (`ShellRail`, `RailItem`, `DashboardApp`),
    `dashboard/app/main-pane-reader.js`, `dashboard/app/intent-route.js`.
  - ADRs: ADR-0025 (third main-pane view state for built-in static pages — governing),
    ADR-0021 (open-intent split), ADR-0009 (frontend app shell), ADR-0011 (rail tree =
    library), ADR-0003 (styleguide unforked), ADR-0017 (read-only).

## Outcome
Extended the aw-058 `mainView` scaffold (ADR-0025) with a second built-in static page —
the **About** page — exactly as the ADR anticipated (a one-line enum extension, not new
shell-state).

- **Routing.** `mainView` enum widened to `"board" | "workflow" | "about"`. Added the
  `onSelectAbout` handler (sets `mainView="about"`, clears `selectedDoc` + `openIntent`),
  threaded it + `mainView` into `ShellRail`, and inserted the `mainView === "about"`
  render branch so precedence is **workflow → about → document → board**. Every other
  main-pane handler still resets `mainView` to `"board"` (mutual exclusivity by
  construction). The Board rail predicate was widened to `mainView === "board" &&
  !selectedId` so no two rail rows highlight across board/workflow/about/doc.
- **Rail.** An **About** `RailItem` (icon `bot`) sits directly below Workflow,
  `active=${mainView === "about"}`, keyboard-operable like its siblings — composed from
  the styleguide `RailItem` primitive, unforked (ADR-0003); it is fixed nav chrome, not
  part of the `treeToLibrary` tree (ADR-0011).
- **Page.** `AboutPage` renders the top two WhisperHeim cards adapted to Agentheim: a
  **profile card** (circular `/heimeshoff.jpg` photo + three-paragraph bio + Get-in-touch
  links to heimeshoff.de / Bluesky / LinkedIn) and a **support card** (copy → board-local
  **Ko-fi gradient button** → ko-fi.com/heimeshoff → thank-you → View on GitHub →
  github.com/heimeshoff/Agentheim). All external links open in a new tab with
  `rel="noopener noreferrer"`. The Ko-fi gradient is board-local and token-matched
  (drawn from `--st-doing`→`--st-todo`, no raw hex, no styleguide fork — StoppedOverlay
  precedent, ADR-0003); all text/surface colors resolve through tokens so light/dark is
  honored.
- **Asset.** The profile photo was copied to `dashboard/assets/heimeshoff.jpg` (the build
  source) and `build.mjs` now copies `assets/` flat into `dist/` after the dist wipe, so
  the served `/heimeshoff.jpg` URL survives rebuilds. Verified it serves as `image/jpeg`.
- **Invariants held.** `intent-route.js` (`isTaskIntent`) and `main-pane-reader.js` are
  byte-unchanged (the About page is never an open-intent, no `/api/doc`, no write —
  ADR-0021 / ADR-0017). `dashboard/dist/app.js` rebuilt via esbuild.
- **Tests.** Added `dashboard/test/about-rail-routing.test.mjs` (the about enum branch,
  `onSelectAbout` clears + sets, the reset threaded through every handler, the About
  RailItem placement + active predicate, precedence, the byte-unchanged locks, the
  external-link `rel`/`target`, the served-URL photo, token theming). Updated the aw-058
  `workflow-rail-routing.test.mjs` and `shell-relayout.test.mjs` to the widened Board
  predicate + three rail items. Full dashboard `node --test` suite green (506/506).

Key files: `dashboard/app/board.js` (AboutPage / AboutCard / AboutLink / KofiButton,
ShellRail, DashboardApp), `dashboard/build.mjs`, `dashboard/assets/heimeshoff.jpg`.

No new ADR: ADR-0025 governs the routing; the board-local Ko-fi gradient follows the
established StoppedOverlay / board-control precedent already covered by ADR-0003, so it is
noted inline rather than as a new decision.
</content>
