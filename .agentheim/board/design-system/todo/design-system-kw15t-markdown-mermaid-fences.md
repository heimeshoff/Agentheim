---
id: design-system-kw15t
title: Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)
status: todo
type: feature
context: design-system
created: 2026-11-03
completed:
depends_on: [design-system-001-styleguide, infrastructure-yaajt, agentic-workflow-gvcy8]
blocks: []
tags: [dashboard, markdown, mermaid, diagram]
related_adrs: [ADR-0002, ADR-0003, ADR-0009, ADR-0016, ADR-0048, ADR-0056, ADR-0057, ADR-0083]
related_research: []
prior_art: [design-system-003]
---

## Why
The builder wants the context map shown on the dashboard as a diagram, not only as prose. The
agreed approach (builder, 2026-11-03) is that the diagram is *authored* in the markdown as a
```` ```mermaid ```` fence (see agentic-workflow-dd8yn), and the dashboard renders it.

Rendering is generic: every doc the dashboard opens (context map, ADRs, BC READMEs, research, task
bodies) gets the same treatment. That makes diagrams a general-purpose tool rather than a
context-map special case. The prose stays, and the diagram supplements it.

## What
Extend the styleguide `Markdown` primitive so a fenced code block with language `mermaid` renders
as an SVG diagram, and every other fence renders unchanged. The primitive is marked 12.0.2 + gfm,
consumed unforked by the dashboard's slide-over Drawer and main-pane reader. Mermaid ships as a
lazily-loaded esbuild chunk via `import("mermaid")`, per ADR-0083 (accepted). The build pipeline
support is infrastructure-yaajt, which this task depends on.

- New styleguide module `app/mermaid-render.js`:
  - `mermaidThemeVariables(readToken)` — a pure mapping from design tokens to mermaid
    themeVariables (theme `base`).
  - `renderMermaidBlocks(rootEl, { loadMermaid, readToken })` — wraps each
    `pre > code.language-mermaid` in a `div.md-mermaid`. The code block stays visible until the SVG
    is ready.
    - Renders run through a serialized promise queue, because mermaid's `initialize`/`render` are
      global.
    - The SVG is swapped in only if the container is still connected and the render generation
      still matches.
    - Falls back to the code block on error.
  - A module-level render cache, capped at about 50 entries, keyed on hash(source) +
    hash(resolved themeVariables).
    - On reuse, rewrite the SVG ids (`agentheim-mmd-<n>-`). This way the same diagram shown in the
      slide-over and the main pane never shares an `#id` or marker target.
  - A single `MutationObserver` on `document.documentElement`
    (`attributeFilter: ['data-theme']`) that re-renders mounted diagrams when the theme flips.
    - Don't hang this off ThemeCtx: child effects run before the app's data-theme effect, so they
      would read the old theme's colours.
- `Markdown`:
  - Gains an optional `mermaidLoader` prop. It defaults to the real dynamic import.
  - Calls `renderMermaidBlocks` in its post-process effect (deps: `htmlOut`).
  - The highlighter skips `language-mermaid`.
- Mermaid config:
  - `startOnLoad:false`, `securityLevel:'strict'`, `suppressErrorRendering:true`, `theme:'base'`,
    and `darkMode` taken from `data-theme`.
  - `await document.fonts.ready` before rendering.
  - Call `mermaid.parse(src)` before `render`.
  - On error, remove `#<id>` and `#d<id>` from `document.body`.
- Theme mapping. Only hex tokens go into themeVariables, because `color-mix()` values break
  mermaid's colour parser. Trim each value, because `getPropertyValue` returns a leading space.

  | Token | themeVariables |
  |---|---|
  | `--surface-2` | `primaryColor`, `mainBkg` |
  | `--surface-1` | `secondaryColor`, `tertiaryColor`, `clusterBkg`, `edgeLabelBackground` |
  | `--hairline-strong` | `primaryBorderColor`, `nodeBorder` |
  | `--hairline` | `clusterBorder` |
  | `--fg-1` | `primaryTextColor`, `titleColor` |
  | `--fg-2` | `textColor` |
  | `--fg-3` | `lineColor` |
  | `--surface-0` | `background` |
  | `--font-ui` | `fontFamily` |

  Never use `--accent-ochre*`: it is reserved (ADR-0016, ADR-0048).
- `styles/agentheim.css`:
  - Scoped reset: `.prose .md-mermaid :is(p, span, div) { margin:0; line-height:inherit }`.
  - `.prose .md-mermaid svg { max-width:100%; height:auto }`.
  - A `.md-mermaid-error` note styled from tokens: `--fg-3` text, `--obligation` hairline, no ochre.
- Canvas: the `styleguide/index.html` import map adds `"mermaid": "https://esm.sh/mermaid@<exact>"`.
  The canvas is dev-only, and import maps also cover dynamic `import()`. The Markdown section shows
  a mermaid example: a small flowchart plus an invalid fence.

Out of scope:
- Re-fetching open docs on SSE. They don't re-fetch today; that is agentic-workflow-es288. This
  task only guarantees a re-render when the `source` prop changes.
- Authoring the context-map diagram (agentic-workflow-dd8yn).

## Acceptance criteria
- [ ] jsdom test on `Markdown` with an injected fake loader:
  - A ```` ```mermaid ```` fence ends up as a `div.md-mermaid` containing the fake's `<svg>`.
  - A ```` ```js ```` fence in the same doc is still a highlighted `pre code`.
  - A doc with no mermaid fence never calls the loader.
- [ ] Invalid-source test. The fake's `parse`/`render` throws and appends a stray `#d<id>` element
  to `document.body`. Afterwards:
  - The original code block stays.
  - A `.md-mermaid-error` note with `role="note"` follows it.
  - The rest of the doc renders.
  - `document.body` has no stray element.
- [ ] `mermaidThemeVariables` unit test (`node --test`, no DOM), using fake dark and light token
  readers:
  - Every colour value matches `/^#[0-9a-f]{3,8}$/i`.
  - The two themes give different `primaryColor` and `primaryTextColor`.
  - `darkMode` follows the theme.
  - No value comes from an `--accent-ochre*` token.
  - `fontFamily` comes from `--font-ui`.
- [ ] Theme-switch jsdom test:
  - Flipping `data-theme` on `document.documentElement` re-renders each mounted diagram once with
    the new themeVariables.
  - Flipping back re-inserts from the cache without calling the fake `render` again.
- [ ] Source-change test: re-rendering `Markdown` with a changed `source` (one diagram edited, one
  unchanged) calls `render` only for the edited diagram. Every rendered SVG id in the container is
  unique.
- [ ] Config test: the fake's `initialize` receives `securityLevel:'strict'`, `startOnLoad:false`
  and `theme:'base'`.
- [ ] Lazy load and offline, checked in a scratch build in `dist-build.test.mjs`:
  - `app.js` contains `import("./chunks/` and no mermaid-only marker string. The worker picks a
    stable marker and documents it in the test.
  - Some file under `chunks/` contains that marker.
  - No `.js` file under `dist/` contains `esm.sh`, `unpkg`, `cdn.jsdelivr`, `cdnjs` or a dynamic
    `import("http`. If harmless documentation URLs inside mermaid trip this check, narrow it to
    real load sites rather than dropping it.
  - `app.js` grows by at most 20 KB over the pre-task baseline.
  - Record in this task's Outcome: the baseline and new `app.js` sizes, the total `chunks/` size,
    and the bytes fetched for a first flowchart.
- [ ] Canvas: the `styleguide/index.html` import map maps `mermaid` to `https://esm.sh/mermaid@<v>`.
  A test asserts that `<v>` equals the exact `mermaid` version in `dashboard/package.json`, and
  asserts the same for `marked`, `react` and `htm`.
- [ ] Diagrams use the design-system tokens (node fill, stroke, text, font), show no clipped labels,
  and re-render correctly when switching between Dark and Light. Check this in the canvas Markdown
  section and on the live dashboard: the context map in the main pane and an ADR in the slide-over.
  This also serves as the design-system gate re-review of the new canvas specimen. [human-eye]

## Notes
- Shipping decision: ADR-0083 (accepted 2026-11-03). The dynamic `import()` is the only allowed way
  to reach mermaid; a static import would pull it into `app.js`.
- Security: marked passes raw HTML through (frontmatter.js relies on this), and this task does not
  widen that. The SVG goes in through the same post-process pattern as the existing highlighter.
  `strict` sanitizes labels and disables click callbacks. `startOnLoad:false` stops a raw-HTML
  `<div class="mermaid">` in a doc from being picked up automatically.
- `dist/` is a derived artifact (ADR-0003/0057), so the worker does not commit it.
- Node tests resolve bare specifiers through the ADR-0056 hook. Tests never call the real loader and
  always inject a fake: jsdom has no `getBBox`, so real mermaid cannot render there.
- Size and first-render latency are unmeasured; the lazy-load criterion above records them.
- Paired with agentic-workflow-dd8yn; neither blocks the other.
