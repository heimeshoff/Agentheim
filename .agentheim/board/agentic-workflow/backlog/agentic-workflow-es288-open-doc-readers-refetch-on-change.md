---
id: agentic-workflow-es288
title: Open doc readers (slide-over + main-pane reader) re-fetch when their file changes on disk
status: backlog
type: feature
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, live-update, sse, docs]
related_adrs: [ADR-0006, ADR-0070]
related_research: []
prior_art: [agentic-workflow-007, agentic-workflow-027]
---

## Why
SlideOver re-fetches `/api/doc` only when `intent` changes, and MainPaneReader only when `doc`
changes. A doc edited on disk while it is open stays stale until it is reopened. That includes a
context-map diagram rewritten by the strategic-modeler (agentic-workflow-dd8yn). The live-tree hub
already receives `tree-changed` frames with a path hint. The builder asked for this as an optional
follow-up on 2026-11-03. Nothing depends on it.

## What
- Re-fetch the open doc when a frame names its path.
- Platform path hints are unreliable (ADR-0070 §4), so also re-fetch on a STRUCTURAL frame that
  carries no path, and on reconnect.
- When the re-fetched text is unchanged, skip the `setItem`/`setBody` call. This keeps the Markdown
  primitive's `source` unchanged, so no mermaid diagram re-renders.

## Acceptance criteria
- [ ] With an injected hub and fetcher, a frame naming the open doc's path triggers exactly one
  re-fetch. A frame naming a different `.agentheim/knowledge/**` path triggers none. A frame with no
  path does trigger a re-fetch.
- [ ] Byte-identical re-fetched text does not change the `source` prop passed to `Markdown`
  (checked with a render probe or prop spy).
- [ ] Neither reader constructs its own EventSource: `live-tree-source-guard.test.mjs` stays green.

## Notes
- This is still a raw follow-up. Refine it before promoting, for example the exact frame-routing
  API on `live-tree-hub.js` (agentic-workflow-mvt8x).
- Pairs with design-system-kw15t, but is independent of it.
