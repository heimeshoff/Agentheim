# Design System

## Purpose

The home for Agentheim's **frontend infrastructure** — the visual language, component
patterns, and styleguide that any UI-bearing feature in any other BC must conform to.
It exists so that frontend work has a single reviewed source of truth for look-and-feel
instead of each feature inventing its own.

It was created the moment Agentheim grew its first UI-bearing feature (the `dashboard`,
in the `agentic-workflow` BC). Before that, Agentheim was a markdown-and-prompts plugin
with no frontend at all.

## Classification

**supporting** — it serves other BCs' UI work; it is not the product itself. Today its
only consumer is `agentic-workflow`'s `dashboard` feature.

## The styleguide gate

Every UI/frontend task in any BC must list this BC's styleguide task
(`design-system-001-styleguide`) in its `depends_on`, and no frontend task may be
promoted to `todo` ahead of the styleguide. The styleguide is reviewed and approved by
the builder before any BC implements its UI.

## The styleguide

The styleguide artifact lives at `styleguide/` and is the reviewed visual language all UI
conforms to. Direction (decided 2026-06-05): a refined, content-first developer tool —
"Linear precision, Notion calm, Vercel restraint" — **dark-first with a light toggle**,
quiet by default, color used only to signal **ticket status** and **content type**. Derived
from the Ledger design system. Tokens are the source of truth in
`styleguide/styles/colors_and_type.css` (surfaces, type, spacing, radii, motion) and
`styleguide/styles/agentheim.css` (status + content-type palettes, elevation, markdown
reading scale). The canvas (`styleguide/index.html`) documents the tokens and renders every
component pattern in context.

### Source architecture (ESM single source — ADR-0003, ADR-0005)

As of `design-system-002`, the styleguide source under `styleguide/app/*.js` is **native
ES modules** — the single source of truth feeding two consumers (ADR-0003): the buildless
reviewable canvas and the esbuild-bundled dashboard dist (`infrastructure-002`). Every
cross-file symbol is an explicit `export`/`import`; there are no `window.*` globals and no
in-browser Babel. Views are authored with **htm tagged templates** (`app/html.js`), parsed
at runtime — **no JSX is shipped to the browser** (ADR-0005). The canvas
(`styleguide/index.html`) loads `app/app.js` via `<script type="module">` with an
**import map** resolving `react`, `react-dom/client`, `marked`, and `htm` to pinned esm.sh
URLs; opening the file needs no toolchain. Tokens (`styles/*.css`) are unchanged.

> **Gate status after the ESM migration (`design-system-002`): OPEN — re-approved by the
> builder 2026-06-06** ("looks good, everything works"). The builder reviewed the migrated
> canvas (`styleguide/index.html` — sections 05–10 + the live kanban→drawer demo) and
> confirmed visual parity. The gate now stands open against the **migrated ESM source**, not
> just the original in-browser-Babel artifact.

> **Gate re-confirmed after the offline-webfonts change (`design-system-003`): OPEN —
> re-approved by the builder 2026-06-06.** Vendoring the webfonts locally edited the gated
> token CSS (`styles/colors_and_type.css`), lightly reopening the gate; the visual delta was
> nil (same Inter Tight / JetBrains Mono families and weights, now served from `styles/fonts/`
> instead of the Google Fonts CDN), and the builder re-confirmed. The gate stands open against
> the now-fully-offline styleguide.

> **Approved by the builder 2026-06-05** — the styleguide gate is open. Frontend tasks in
> any BC may now be promoted (each still subject to its own other dependencies). See
> `design-system-001` (done).

### Webfonts — vendored locally (offline, ADR-0008)

As of `design-system-003` the type families are **committed locally**, not pulled from a
CDN. The token CSS no longer `@import`s Google Fonts; instead `styles/colors_and_type.css`
declares `@font-face` rules pointing at `styles/fonts/`:

- `InterTight-latin.woff2` — Inter Tight, variable weight axis (covers 400/500/600).
- `JetBrainsMono-latin.woff2` — JetBrains Mono, variable weight axis (covers 400/500).

These are the Google Fonts **latin-subset** woff2 (variable fonts), so one file per family
covers every weight the tokens use; only the latin subset is vendored (the styleguide is
latin-only content). OFL 1.1 licenses sit beside the fonts (`*-OFL.txt`). The `url()` is
`fonts/<file>.woff2`, **relative to the CSS**, so it resolves both in the source canvas
(`styleguide/styles/fonts/`) and in the dashboard dist (`infrastructure`'s `build.mjs`
copies `styles/fonts/` → `dist/fonts/`). Result: the canvas and the bundled dashboard
render the correct type with **no network at view time**. Adding non-latin glyphs later
requires vendoring the matching subset. See ADR-0008.

## Relationships with other contexts

- **agentic-workflow** — depends on this BC's styleguide for its `dashboard` feature.
- **infrastructure** — the styleguide ships as plain static assets (no install); the
  dashboard's runtime (`infrastructure-001`) should vendor/pre-bundle the CDN scripts the
  canvas currently loads. See `design-system-001` → Delivery.

## Pointers

- Styleguide artifact: `styleguide/index.html` (+ `styleguide/styles/`, `styleguide/app/*.js` ES modules; entry `app/app.js`)
- BC index: `INDEX.md`
