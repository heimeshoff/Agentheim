---
id: agentic-workflow-073
title: Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
depends_on: [design-system-001, agentic-workflow-076]
blocks: []
tags: [dashboard, frontend, whats-next, ui]
related_adrs: [0027, 0017, 0023, 0021, 0009, 0003]
related_research: [work-session-presence-lock-2026-06-15, work-terminal-completion-signal-2026-06-15]
prior_art: [agentic-workflow-069, agentic-workflow-064, agentic-workflow-043, agentic-workflow-065]
---

## Why
The `whats-next` recommendation should be visible on the dashboard — where the builder
actually decides what to do next — not only in whatever terminal the bridge spawned. Press
the topbar **What's next** button (aw-069); a few moments later the recommendation appears
*in* the dashboard, above the prompt bar, and is still there when the dashboard is reopened
in a later session. This is the **dashboard half** of the feature; the skill half (writing
the artifact) is **agentic-workflow-076**, which this task depends on and which has now
shipped.

## What
The dashboard reads the single-latest recommendation artifact the `whats-next` skill writes
(`.agentheim/state/whats-next.md`, defined by ADR-0027 and produced by aw-074) and renders it
as a **structured panel above the board prompt bar** — styleguide-consumed (unforked,
ADR-0003), light/dark aware, refreshing live over the existing SSE consumer. The panel is
**dismissible**; the dismissed state persists across reloads and a *newer* recommendation
re-shows it.

The artifact is ordinary frontmattered markdown (a `generated` ISO-8601 timestamp + three
sections: where things stand / recommended move / next), so it flows through the existing
`withFrontmatterSection` (aw-043) + unforked `Markdown` primitive with **no new render code**.
The dashboard does **not** receive raw HTML — the skill emits structured data and the
dashboard owns the pixels (refinement decision).

## Acceptance criteria
- [ ] On the **board view only**, the dashboard renders the recommendation as a panel
      **above** the prompt bar's `Prompt` title, composing cleanly with the prompt field and
      the three `PromptLaunchCard`s; styleguide consumed **unforked** (ADR-0003), light/dark
      aware.
- [ ] The panel fetches the body via the existing `GET /api/doc?path=.agentheim/state/whats-next.md`
      (reusing the `startsWith(root)` in-root guard); **no** body enters `/api/tree` (ADR-0023
      — tree stays pointers/metadata only).
- [ ] **Absent artifact** → the panel renders nothing (no empty shell, no error). A
      **malformed / partial** artifact renders what is parseable and never throws.
- [ ] The panel updates **live**: a newer write triggers the existing SSE `tree-changed` frame
      (ADR-0006), the panel re-fetches `/api/doc` and re-renders.
- [ ] The panel shows a **staleness cue** derived from the artifact's `generated` timestamp;
      nothing else keys behaviour off it (ADR-0027 §4).
- [ ] A **dismiss/collapse** affordance hides the panel; the dismissed state persists across
      reload in a new versioned `localStorage` store `dashboard/app/whats-next-state.js`
      (mirroring `theme-state.js` / board-view-state.js), **keyed by `generated`** so a newer
      recommendation re-shows. Every degraded path (malformed / stale-version / absent /
      non-boolean / no backend) resolves to **"not dismissed"**, never throws.
- [ ] Pure helpers are unit-tested under `node --test` (the dismiss store + all degraded paths
      + the newer-timestamp re-show; any pure staleness formatter). Dashboard `dist/` rebuilt
      via esbuild; existing tests stay green.

## Notes
Refined via `/agentheim:modeling refine agentic-workflow-073` on 2026-06-17. The original
single capture was **split** into the skill half (aw-076, the advisory write) and this
dashboard half; **ADR-0027's artifact shape is the frozen interface** between them so they
cannot drift. Architect round routed through the orchestrator.

**Second refinement pass (2026-06-17):** both dependencies have now shipped —
`design-system-001` (styleguide gate) and `agentic-workflow-076` (the advisory write this
panel reads). The frozen interface (ADR-0027 §2/§4) was confirmed against the shipped skill:
artifact path `.agentheim/state/whats-next.md`, frontmatter `generated` timestamp, three body
sections (where things stand / recommended move / next), read via `/api/doc`. The artifact
isn't on disk yet (git-ignored, written only when `whats-next` next runs) — which is exactly
the **absent-artifact → render nothing** acceptance criterion, so it does not block work. With
both gates met and concrete acceptance criteria in place, this task is **ready to promote**.
(Also corrected a stale cross-reference in *Why* that named the skill half as aw-074 — it is
aw-076.)

- **Frontend gate** — depends on the approved styleguide (`design-system-001`), consumed
  unforked (ADR-0003). Both gates now met: the styleguide shipped and aw-076 shipped the
  artifact it reads.
- **Read path** — reuse `/api/doc`, **not** a new endpoint and **not** a fold into `/api/tree`
  (ADR-0027 §3); the recommendation is a document *body* and `/api/doc` already carries bodies
  behind the in-root guard, exactly as the main-pane reader and slide-over do (ADR-0021).
- **Render precedent** — the markdown flows through the same `withFrontmatterSection` (aw-043)
  + `Markdown` path both detail surfaces already use, so the frontmatter folds to a quiet
  collapsed section and the three body sections render with no bespoke renderer.
- **Dismiss persistence** — the versioned-localStorage view-state precedent (aw-014 / ADR-0015,
  `theme-state.js` aw-017); keyed by `generated` so dismissing one recommendation doesn't
  permanently suppress the next.
- **Scope** — board view only; the panel sits above the `Prompt` title (aw-054) and the three
  launch cards (aw-065). No ochre (ADR-0016); the danger token is irrelevant here.

Prior art: aw-069 (button fires the skill), aw-064 (button created), aw-043 (frontmatter-folding
render path it reuses), aw-065 (prompt-bar layout it sits above).

## Outcome
The dashboard now renders the `whats-next` advisory recommendation (ADR-0027) as a dismissible
panel **above** the board prompt bar's `Prompt` title — the dashboard half of the feature, reading
the artifact the skill half (aw-076) writes. No new ADR: every decision (read via `/api/doc`, render
via `withFrontmatterSection` + `Markdown`, dismiss persistence, staleness cue) was already
constrained by ADR-0027 §3/§4 and the aw-014/aw-017 versioned-localStorage precedent.

- **NEW `dashboard/app/whats-next-state.js`** — pure, framework-free, unit-tested. The dismiss store
  (`loadDismissed` / `saveDismissed` / `isDismissed`) is a single versioned `localStorage` key
  **keyed by the artifact's `generated` stamp**, so dismissing one recommendation never suppresses
  the next — a newer `generated` re-shows. `formatStaleness(generated, now)` is the pure staleness
  formatter (just now / N minutes|hours|days ago; "" for unparseable; future clamps to "just now").
  Exports `WHATS_NEXT_DOC_PATH = '.agentheim/state/whats-next.md'`. **Every** degraded path
  (malformed / stale-version / absent / non-string / no-backend / throwing storage) resolves to
  "not dismissed", never throws.
- **`dashboard/app/board.js`** — new `WhatsNextPanel` (placed before `BoardPromptBar`, composed as
  the first child of the prompt-bar `<section>`, above the `Prompt` title). It fetches the artifact
  through the existing `/api/doc` carrier (`docUrl(WHATS_NEXT_DOC_PATH)` — never `/api/tree`,
  ADR-0023), renders it through the unforked styleguide `Markdown` + `withFrontmatterSection` path
  (aw-043), re-fetches on every SSE frame via `useLiveTree` (ADR-0006), shows the staleness cue, and
  carries a token-styled dismiss control. Absent artifact (fetch failure) / blank body → renders
  nothing (no shell, no error); a partial body renders what is parseable. The `generated` stamp is
  read with the **same** `parseFrontmatter` the render path uses, so the dismiss key cannot drift
  from what renders. New imports: `Markdown`, `docUrl`, `withFrontmatterSection` / `parseFrontmatter`,
  and the four `whats-next-state.js` helpers.
- **agentic-workflow BC README** — added a `WhatsNextPanel` paragraph to the *Board prompt bar*
  section (read surface, /api/doc path, render reuse, SSE live refresh, staleness cue, the new
  dismiss store keyed by `generated`, read-only-over-artifact, the degraded-path guarantees).

Tests: NEW `dashboard/test/whats-next-state.test.mjs` (21 cases — doc path, every load/save/isDismissed
degraded path, the newer-timestamp re-show, the full staleness formatter incl. future-clamp and
unparseable) and NEW `dashboard/test/whats-next-panel.test.mjs` (9 static-source guards — Markdown
render, /api/doc not /api/tree, absent→nothing, SSE re-fetch, staleness cue, dismiss-keyed-by-generated,
panel-above-Prompt-title, token-styled-unforked). Full dashboard suite green (588 tests, was 558).
`dashboard/dist/` rebuilt via `node build.mjs` (the bundle carries the panel + artifact path).

Key files: `dashboard/app/whats-next-state.js`, `dashboard/app/board.js`,
`dashboard/test/whats-next-state.test.mjs`, `dashboard/test/whats-next-panel.test.mjs`,
`dashboard/dist/app.js`, `.agentheim/contexts/agentic-workflow/README.md`.
