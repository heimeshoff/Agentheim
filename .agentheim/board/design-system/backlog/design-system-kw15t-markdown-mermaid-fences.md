---
id: design-system-kw15t
title: Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)
status: backlog
type: feature
context: design-system
created: 2026-11-03
completed:
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, markdown, mermaid, diagram]
related_adrs: [ADR-0002, ADR-0003]
related_research: []
prior_art: [design-system-003]
---

## Why
The builder wants the context map shown on the dashboard as a diagram, not just prose.
The agreed approach (builder, 2026-11-03) is that the diagram is *authored* in the markdown as a
```` ```mermaid ```` fence (see agentic-workflow-dd8yn), and the dashboard renders it. Rendering
is generic: any doc the dashboard opens (context map, ADRs, BC READMEs, research, task bodies)
gets the same treatment, so diagrams become a general-purpose tool rather than a context-map
special case.

## What
Extend the styleguide `Markdown` primitive (marked 12.0.2 + gfm, consumed unforked by the
dashboard slide-over / main-pane reader, agentic-workflow-007) so a fenced code block with
language `mermaid` renders as an SVG diagram instead of a code block. Every other fence renders
unchanged.

## Acceptance criteria
- [ ] A ```` ```mermaid ```` fence in a doc opened in the dashboard renders as an SVG diagram; other fenced languages still render as code blocks (jsdom test on the Markdown primitive's output).
- [ ] An invalid mermaid source does not break the doc: it falls back to the original code block plus a visible, token-styled error note, and the rest of the doc renders (test).
- [ ] The dashboard stays zero-install and works offline: no runtime CDN fetch for mermaid. The library ships in the committed `dashboard/dist/` (or a lazily-loaded chunk of it) per ADR-0002 / ADR-0003, following the design-system-003 offline-vendoring precedent (test: no external URL in the dist output for mermaid).
- [ ] Docs without a mermaid fence do not pay the mermaid load cost (lazy load on first mermaid fence), *or* the refinement records an explicit decision to load eagerly, with the measured bundle-size delta.
- [ ] The diagram uses the design-system tokens (node fill, stroke, text, font) and re-renders correctly when the dashboard theme switches between light and dark. [human-eye]
- [ ] The styleguide canvas shows a mermaid example under the Markdown primitive. Its buildless import map must resolve mermaid the same way it resolves `marked` (ADR-0003 consumer 1).

## Notes
- **Open decision for refinement (architect):** how mermaid ships. Options: (a) bundle it into
  `dist/` eagerly. This is simplest, but mermaid is large (~1–3 MB min), which hurts first load on
  every page. (b) Use an esbuild code-split chunk imported dynamically on the first mermaid fence.
  `static.mjs` must serve the chunk, and the committed-dist rule still holds. (c) A CDN load. This
  looks ruled out by the offline precedent (design-system-003) and ADR-0002's zero-install stance.
  Leaning toward (b). It may warrant an ADR amending ADR-0003's bundle shape.
- Security: render with mermaid `securityLevel: 'strict'` (the docs are local, but marked already
  passes raw HTML through; don't widen that).
- The live-update path (SSE resync) must re-render diagrams when the doc changes on disk.
- Entry points: `dashboard/app/slide-over.js` (Markdown → marked), `dashboard/app/frontmatter.js`
  (pre-marked transforms), `dashboard/build.mjs` (esbuild), `dashboard/static.mjs`.
- Paired with agentic-workflow-dd8yn (the skills that author the mermaid block). Neither blocks
  the other: an authored block also renders on GitHub and in VS Code.
