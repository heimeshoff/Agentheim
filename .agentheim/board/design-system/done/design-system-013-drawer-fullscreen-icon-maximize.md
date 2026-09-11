---
id: design-system-013
title: Drawer "Open in full screen" uses a maximize glyph, not the external-link icon
status: done
type: chore
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 4956ff2
depends_on: [design-system-001]
blocks: []
tags: [styleguide, drawer, icons, slide-over, ui]
related_adrs: [0003]
related_research: []
prior_art: [design-system-009]
---

## Why

The slide-over / item-details header carries an **"Open in full screen"** action (added in
design-system-009, wired to the dashboard main pane in agentic-workflow-039). It currently renders the
`square-arrow-out-up-right` glyph — the canonical **"open in a new tab / external link"** icon. That
reads as "leave this page / open elsewhere", which is the wrong mental model: the action **maximizes the
task into the main content pane**, it does not navigate away. A fullscreen/maximize glyph fits the
behaviour.

## What

Swap the icon the `Drawer` header uses for the "Open in full screen" action to a **maximize / expand**
glyph (four corners pointing outward — the conventional "enter fullscreen" cue).

- Add the glyph to the styleguide icon set: `.agentheim/contexts/design-system/styleguide/app/icons.js`
  (`LUCIDE` map). Recommended Lucide `maximize`:

  ```
  "maximize": '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  ```

- Point the action at it in `.agentheim/contexts/design-system/styleguide/app/drawer.js`. The icon name
  appears in **both** header variants (`HeaderMinimal` and `HeaderContextual`) on the
  `onOpenFullScreen` `IconButton` — change both. The `title` / `aria-label` ("Open in full screen") stay.

- The `square-arrow-out-up-right` glyph stays in `icons.js` unless nothing else references it (it may
  still be used elsewhere — check before removing; safe default is to leave it).

## Acceptance criteria

- [ ] The Drawer "Open in full screen" action renders a **maximize/expand** glyph (four outward corners), not `square-arrow-out-up-right`.
- [ ] The new glyph exists in `icons.js`'s `LUCIDE` map; `Icon name="…"` resolves it (no empty `inner`).
- [ ] **Both** `HeaderMinimal` and `HeaderContextual` use the new icon name (both render the action).
- [ ] The action's `title` and `aria-label` remain "Open in full screen"; behaviour (`onOpenFullScreen`) is unchanged.
- [ ] Styleguide tests stay green (`styleguide/test`, `node --test`).
- [ ] Dashboard `dist/` rebuilt (`cd dashboard && node build.mjs`) so the **item-details slide-over** actually shows the new icon — the visible outcome the request asked for. Existing dashboard tests stay green.

## Notes

- **Cross-BC consumption (build touch):** the dashboard imports `Drawer` directly from the styleguide
  source (`dashboard/app/slide-over.js` → `…/styleguide/app/drawer.js`) and esbuild bundles it into
  `dashboard/dist/app.js`. A pure icon swap needs **no wiring change** (no new prop, no API change) — only
  a `node build.mjs` rebuild for the live slide-over to pick it up. This mirrors the design-system-009 →
  agentic-workflow-039 precedent. The rebuild step touches `dashboard/` (agentic-workflow territory); flag
  to the orchestrator so the build artifact is regenerated as part of this change rather than left stale.
- **Icon choice latitude:** `maximize` is the recommended fit. `expand` / `scan` / `maximize-2` are
  defensible alternatives if the four-outward-corners reads too heavy at 16px — worker's call, but stay
  with a fullscreen/expand semantic, not an external-link or arrow glyph.
- **Consumed unforked (ADR-0003):** the dashboard imports the styleguide `Drawer` as-is; changing the
  icon at the source is the correct single-source edit — do not fork the Drawer in the dashboard.
- Prior art: **design-system-009** (created the "Open in full screen" action + its bare
  `onOpenFullScreen` callback) and **agentic-workflow-039** (wired that callback to the dashboard main
  pane). This task only changes the glyph that action wears.

## Outcome

The Drawer "Open in full screen" action now wears a **`maximize`** glyph (four outward corners — the
fullscreen/expand cue) instead of the external-link `square-arrow-out-up-right`, which read as "navigate
away" — the wrong mental model for an action that maximizes the task into the dashboard main pane.

- Added `"maximize"` to the `LUCIDE` map in `styleguide/app/icons.js` (Lucide `maximize` geometry).
- Swapped the icon name on the `onOpenFullScreen` `IconButton` in **both** header variants
  (`HeaderMinimal` and `HeaderContextual`) in `styleguide/app/drawer.js`. Title / aria-label
  ("Open in full screen") and the `onOpenFullScreen` behaviour are unchanged.
- Left `square-arrow-out-up-right` in `icons.js` — it is still used by the foundations2 icon gallery.
- Updated `styleguide/test/drawer.test.mjs`: the glyph guards now assert `name="maximize"` (and that the
  external-link glyph no longer dresses the action), plus a new guard that the `maximize` glyph resolves
  in `icons.js`. Styleguide suite: 37 pass, 0 fail.
- Rebuilt the dashboard bundle (`cd dashboard && node build.mjs`, ADR-0003 single-source) so the live
  item-details slide-over shows the new glyph; `dashboard/dist/app.js` regenerated. Dashboard suite: 395
  pass, 0 fail.

No ADR — a glyph swap within the established single-source pattern; the rationale is captured here and in
the BC README.

Key files: `styleguide/app/icons.js`, `styleguide/app/drawer.js`, `styleguide/test/drawer.test.mjs`,
`dashboard/dist/app.js` (derived), BC README.
