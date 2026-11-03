---
id: ADR-0083
title: Dashboard dist gains lazily-loaded esbuild code-split chunks for heavy renderers (mermaid first)
scope: global
status: accepted
date: 2026-11-03
supersedes: []
superseded_by: []
related_tasks: [design-system-kw15t, infrastructure-yaajt]
related_research: []
related_adrs: [ADR-0002, ADR-0003, ADR-0009, ADR-0013, ADR-0057]
---

# ADR-0083: Dashboard dist gains lazily-loaded esbuild code-split chunks for heavy renderers (mermaid first)

> **Amends [ADR-0003](0003-styleguide-esm-single-source.md)** (consumer 2, "the dashboard bundle"):
> the committed `dashboard/dist/` is no longer exactly **one** bundled `app.js`. It is **one entry
> (`app.js`) plus content-hashed chunks under `dist/chunks/`** that load only when a dynamic
> `import()` asks for them. Every other ADR-0003 clause stands: one source (the styleguide ESM),
> a buildless canvas with an import map, esbuild as the sole build-time tool, dependencies bundled
> in (no runtime CDN), React production build, committed output served as-is by ADR-0002's static
> handler.

## Context

design-system-kw15t makes the styleguide `Markdown` primitive render ```` ```mermaid ```` fences as
SVG diagrams in every doc the dashboard opens (builder-fixed: mermaid fences, rendered generically,
prose stays). Mermaid is by far the heaviest dependency the dashboard would carry: roughly
2.5–3.5 MB minified across its own internal diagram modules (d3, dagre, cytoscape, katex, langium
parser, DOMPurify, …), against an `app.js` that today bundles React, ReactDOM, marked and htm. Most
docs have no diagram.

Forces:

- **Zero-install, offline** (ADR-0002, design-system-003 / ADR-0008 precedent): no runtime CDN.
- **Committed, deterministic dist** (ADR-0003, ADR-0013 release step, ADR-0057 checkpoint guard,
  infrastructure-w45ce build stamp): `build.mjs` wipes and regenerates `dist/`; rebuilding unchanged
  source must reproduce the committed bytes; a worker's rebuild never reaches `main`.
- **Repo growth**: every rebuild that changes `app.js` commits a new blob of it. If mermaid lived in
  `app.js`, every UI change would re-commit ~3 MB (~1 MB compressed) of unchanged mermaid code.
- `build.mjs` today uses `outfile` (single file); esbuild `splitting` requires `format: 'esm'`
  (already set) **and** `outdir`.
- `static.mjs` already serves any in-root file under `dist/` (nested paths included) with a
  `.js → text/javascript` content type and the ADR-0002 traversal guard.

## Decision

1. **`build.mjs` switches from `outfile` to `outdir` + `splitting: true`**, with
   `entryNames: '[name]'` (so the entry is still `dist/app.js` and `index.html` is unchanged) and
   `chunkNames: 'chunks/[name]-[hash]'`. The `[hash]` stays: esbuild names shared chunks
   generically (`chunk`), so hash-less names would collide, and esbuild's hash is content-derived,
   so it is deterministic across identical rebuilds. Chunks whose content did not change keep their
   filename and bytes — git stores them once.
2. **Heavy, optional renderers are reached only through a dynamic `import()`** of a bare
   specifier from the styleguide source (`import("mermaid")`). esbuild turns it into a chunk
   graph under `dist/chunks/`; the canvas import map resolves the same specifier to a pinned
   esm.sh URL (ADR-0003 consumer 1 — the canvas is a dev/review surface and already pins its
   framework to esm.sh). No static import of such a library is permitted from the app's entry
   graph; a dist-build test enforces that the entry does not contain it.
3. **The dist contract becomes "entry + chunks"** for every existing guard: the no-CDN assertion
   scans every `.js` under `dist/`; the ADR-0057 `dashboard/dist/` prefix already covers
   `dist/chunks/`; the release step's `git add dashboard/dist` already stages chunk deletions.
4. **Dependency pins are build inputs.** `dashboard/package.json` and `dashboard/package-lock.json`
   join the build stamp's declared inputs, so bumping mermaid (or marked/react — a pre-existing
   gap) goes red in `dist-staleness.test.mjs` until rebuilt. The npm pin and the canvas
   import-map pin must name the same exact version (a test asserts it).
5. **Mermaid is the first, not the only, consumer** of this shape: any future heavy, rarely-needed
   renderer (math, charts) follows the same dynamic-import rule instead of growing `app.js`.

## Consequences

### Positive
- Docs without a diagram pay nothing: `app.js` grows only by the small fence-detection and
  loader code; mermaid chunks load on first fence and per diagram type.
- App-only rebuilds no longer re-commit the heavy library; mermaid chunk blobs change only when
  the mermaid pin changes.
- Offline and zero-install preserved; the static handler needs no change beyond a test.
- Same tool, same pipeline (ADR-0003's esbuild choice holds; mermaid itself is built with esbuild).

### Negative
- `dist/` goes from a handful of files to dozens of hashed chunk files; diffs of a rebuild are
  noisier (renamed chunks on a mermaid bump).
- Plugin install footprint grows by the full mermaid chunk set (~3 MB) even though most users
  load only a fraction; repo history grows by ~1 MB compressed per mermaid version bump.
- More `.js` files under `dist/` means more surface for the known Windows `autocrlf`
  phantom-modification (ADR-0057 Context) — the guard tolerates it, but `git status` noise grows.
- First diagram render has a one-time chunk-load latency (local, small).

### Neutral
- `index.html` still loads only `./app.js`; chunks are fetched by the browser relative to
  `app.js`'s URL.
- The build stamp hashes sources, never bundle bytes, so chunk hashing does not affect it.

## Alternatives considered
- **Eager: mermaid bundled into `app.js`** — simplest build, but every page pays ~3 MB parse and
  every UI rebuild re-commits it. Rejected on first-load and repo-growth cost; recorded so a
  future "just inline it" proposal knows the measured delta was the reason.
- **Vendor mermaid's prebuilt `dist/mermaid.esm.min.mjs` + its chunk dir verbatim** (copied like
  the webfonts, specifier marked external and rewritten to `./vendor/mermaid/...`). Keeps
  `outfile` untouched and uses upstream's tested build; rejected as the default because it couples
  the pipeline to mermaid's internal dist layout and adds a second bundling regime. It is the
  **fallback** if esbuild cannot bundle mermaid cleanly at the project's target.
- **Runtime CDN (esm.sh / jsdelivr)** — violates zero-install/offline (ADR-0002, ADR-0008).
  Rejected for the dashboard; acceptable only for the dev-only canvas import map.
- **Server-side render (mermaid-cli / puppeteer in the runtime)** — needs a headless browser and a
  `node_modules` at run time; breaks ADR-0002's stdlib-only server. Rejected.
- **A lighter renderer** (e.g. hand-rolled graph layout, beautiful-mermaid-style subsets,
  Graphviz-wasm) — either not mermaid syntax (the builder fixed mermaid fences, which also render
  on GitHub/VS Code) or not materially smaller. Rejected.

## References
- ADR-0002 (static handler, zero install), ADR-0003 (amended here), ADR-0009 (`build.mjs` is
  infrastructure's pipeline file), ADR-0013 (release rebuild step), ADR-0057 (checkpoint guard +
  build-stamp amendment).
- design-system-kw15t (mermaid fences), agentic-workflow-dd8yn (authoring side).
