---
id: agentic-workflow-es288
title: Open doc readers (slide-over + main-pane reader) re-fetch when the tree changes, follow a moved task by id, and never flicker on unchanged text
status: doing
type: feature
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, live-update, sse, docs]
related_adrs: [ADR-0006, ADR-0070, ADR-0017, ADR-0001]
related_research: []
prior_art: [agentic-workflow-007, agentic-workflow-027, agentic-workflow-mvt8x, agentic-workflow-bmn29]
---

## Why
SlideOver re-fetches `/api/doc` only when `intent` changes, and MainPaneReader only when `doc`
changes. A doc edited on disk while it is open stays stale until it is reopened. That includes a
context-map diagram rewritten by the strategic-modeler (agentic-workflow-dd8yn). It also includes
an open task whose file moves folder (todo → doing → done): its old path 404s.

## What
Both readers re-fetch their open doc whenever the board's live-tree hub delivers a structural
update. That happens on a structural `tree-changed` frame, on `hello`/reconnect, and on the hub's
visibility replay (ADR-0070 §6).

They react to every structural update, not only one naming their own path. The watcher
(`dashboard/watcher.mjs`) debounces a burst of mutations into ONE frame that carries only the
LAST queued path. So "context-map.md, then protocol.md" in one burst arrives as a frame naming
`protocol.md`, and a path-exact match would miss the edit (builder decision at refine,
2026-11-03).

When the re-fetched text is byte-identical to what is shown, the reader does NOT update state.
The `Markdown` `source` prop stays the same, and no mermaid diagram re-renders.

A TASK open in the slide-over is followed by id. On each structural update the slide-over looks
up the open task's `id` in the delivered tree. If its `path` changed, it re-fetches from the new
path, and the Drawer's path sub-line updates to match. If the id is gone from the tree (dismissed
or deleted), it keeps showing the last good content.

**Wiring.** Neither reader constructs an EventSource or subscribes to the hub itself. `board.js`
owns the single module-level hub and injects a subscription into each reader as a prop, for
example `subscribeTree(cb) → unsubscribe`, backed by the existing structural `useLiveTree` /
`liveTreeHub.subscribeStructural`. The prop defaults to a no-op so existing tests and mounts are
unaffected. The board is always subscribed structurally, so the hub's shared fetch means this
adds no extra `/api/tree` request. The only added cost is one `/api/doc` GET per structural
update while a doc is open.

## Acceptance criteria
- [ ] MainPaneReader, with an injected `subscribeTree` fake and `fetchDoc` spy: each delivered
  tree triggers exactly one re-fetch of `doc.path`. This includes a tree delivered after a frame
  naming an unrelated path such as `.agentheim/board/protocol.md`. Changed text replaces the
  body.
- [ ] SlideOver, under the same harness: each delivered tree triggers exactly one re-fetch of the
  open intent's path, and changed text replaces the Drawer item's body.
- [ ] Byte-identical re-fetched text causes no state update: the `source` prop passed to
  `Markdown` is the same string as before, checked with a render probe or prop spy, in both
  readers.
- [ ] A live re-fetch never shows a loading state. MainPaneReader stays in phase `ready` with no
  "Loading document…", and SlideOver never swaps back to `_Loading…_`. The slide-over's
  `expanded` state is NOT reset by a live re-fetch; only a new `intent` resets it, as today.
- [ ] A failed live re-fetch (rejected or non-OK) keeps the last good content. It never flips to
  the error body. The error body stays reserved for the initial open.
- [ ] Moved task: an open task intent `{id: X, path: …/todo/X-….md}` and a delivered tree where X
  now has path `…/doing/X-….md` lead to a re-fetch from the NEW path and an updated path
  sub-line. A tree without X triggers no re-fetch and keeps the last content.
- [ ] Ordering and teardown. A re-fetch response that resolves after a newer re-fetch started, or
  after the intent or doc changed or closed, is dropped (last-started wins). Unmounting, or
  closing the slide-over, calls the unsubscribe that `subscribeTree` returned.
- [ ] No reader constructs its own EventSource or imports the hub:
  `live-tree-source-guard.test.mjs` stays green, extended if needed to cover `slide-over.js` and
  `main-pane-reader.js`. `board.js` passes a hub-backed `subscribeTree` to both readers, asserted
  by a test or a source check.
- [ ] `dashboard/dist/` is rebuilt and committed, and `dist-build.test.mjs` is green.

## Notes
- Refined 2026-11-03. Builder decisions:
  - Re-fetch on every structural update rather than a path match. The watcher's last-path-only
    debounce is the reason.
  - Follow a moved task by id from the delivered tree.
- This is a consumer-side fail-open choice consistent with ADR-0070 §4, which treats the path as a
  hint only. No new ADR.
- Not in scope: making the watcher emit every path of a burst. That would be an infrastructure
  change. The same last-path-only behaviour means an ADVISORY subscriber (WhatsNextPanel,
  InFlightLane) can miss its artifact's change when another write lands later in the same burst.
  That is a separate, uncaptured observation.
- Pairs with design-system-kw15t (mermaid fences), but does not depend on it.
- Not done in the reader: diffing or patching. A changed doc is re-fetched whole and re-rendered,
  per ADR-0001 and ADR-0070 §3.
