---
id: agentic-workflow-n4h7q
title: Left rail blinks newly-created research docs and ADRs until clicked or reloaded
status: backlog
type: feature
context: agentic-workflow
created: 2026-06-19
depends_on: [design-system-001, design-system-v8k2p]
blocks: []
tags: [dashboard, rail, live-update, navigation, research, adr, motion]
related_adrs: [0011, 0017, 0009, 0014]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-008, agentic-workflow-066, agentic-workflow-075]
---

## Why
The dashboard's left rail is live — it re-projects `treeToLibrary(/api/tree)` on every SSE
`tree-changed` frame (`agentic-workflow-009`, ADR-0011), so a research report or ADR the
agent writes in a parallel session appears in the rail within a frame. But it appears
**silently**: a new entry slides into the Research or Decisions group with nothing to draw
the builder's eye, and the Decisions group is collapsed by default (`agentic-workflow-066`),
so a new ADR can land completely unseen. The builder wants new knowledge artifacts to
**announce themselves** — blink in the rail until acknowledged.

This is the **dashboard half** of the feature; the blink cue itself is the styleguide
capability `design-system-v8k2p`, consumed unforked (ADR-0003).

## What
Track which research/ADR rail entries are **newly created during the current page session**
and render them with the styleguide attention cue (`design-system-v8k2p`) until the builder
clicks them or reloads the page.

- **Scope: research reports and ADRs only.** (Other artifact kinds — BCs, concepts, tasks —
  are out of scope for this task; the builder asked specifically for research + ADRs.)
- **"New" is session-scoped, in-memory.** On first render, record the set of research/ADR
  paths the projection carries as the baseline. Each subsequent live re-projection diffs
  against the baseline; a path not in the baseline is "new" and gets flagged. **Reload
  resets the baseline**, so nothing is "new" on a fresh page (this is exactly what "until the
  page has reloaded" means). No `localStorage`, no disk write — the dashboard stays read-only
  over `.agentheim/` (ADR-0017); this is presentation state only, like the SSE projection
  itself.
- **Collapsed-group visibility (builder decision 2026-06-19).** A new leaf flags the cue on
  its own row **and propagates** the cue to its parent group header (Research / Decisions), so
  an arrival under a collapsed group is still noticeable. Expanding the group reveals the
  blinking leaf.
- **Clearing (builder decision 2026-06-19).** Clicking a blinking entry clears **only that
  entry's** cue (it opens in the main-pane reader anyway, ADR-0021/aw-027). Other new entries
  keep blinking until each is individually clicked. A group header's cue clears once **all**
  its new leaves have been cleared. A page reload clears everything.
- Apply the cue by threading the `design-system-v8k2p` flag into the rail's `TreeItem` rows
  and `Collapsible`/`TreeGroup` headers; the "is this path new / which group inherits it"
  computation is a **pure, `node --test`-able** transform over the projection + the session
  baseline + the cleared set (mirrors `board-sort` / `board-group` / `slide-over-data`).
- Rebuild `dashboard/dist/app.js` (esbuild) so the deployed app carries the cue (ADR-0009 —
  this is the consuming task that rebuilds dist for `design-system-v8k2p`).

## Acceptance criteria
- [ ] A research/ADR entry that appears in the rail **after** initial page load (via SSE
      re-projection) blinks, using the `design-system-v8k2p` cue.
- [ ] An entry already present on initial load does **not** blink.
- [ ] A new entry under a collapsed group propagates the cue to that group's header; the leaf
      itself blinks when the group is expanded.
- [ ] Clicking a blinking entry clears only that entry; other new entries keep blinking.
- [ ] A group header's cue clears once all its new leaves are cleared.
- [ ] Reloading the page clears all blinking (baseline resets — nothing is "new").
- [ ] No `/api` write and no `localStorage` write — purely in-memory presentation state
      (ADR-0017).
- [ ] The "which paths are new / which group inherits the cue / which are cleared" logic is a
      pure function covered under `node --test`.
- [ ] `dashboard/dist/app.js` rebuilt; the full dashboard suite stays green.

## Notes
- Depends on `design-system-v8k2p` (the cue) **and** the styleguide gate (`design-system-001`).
- Detection seam: `agentic-workflow-009` / `dashboard/app/live-update.js` already re-fetches
  `/api/tree` on every `tree-changed`; this task adds a diff-against-baseline layer on top —
  it must **not** re-interpret the SSE pointer as a transition (the watcher stays
  transport-only, ADR-0012). The rail tree is `treeToLibrary` (`library-data.js`, [[ADR-0011]]).
- Rail group precedent: `agentic-workflow-066` (Research open / Decisions collapsed by default),
  `agentic-workflow-056` (Research above Decisions), `agentic-workflow-075` (Concepts rail group).
- Edge cases for refine: an artifact that appears then disappears (e.g. a research file moved/
  removed) before being clicked; a flood of new docs at once; whether a doc that is *modified*
  (not created) counts as new (default: **no** — created-only, keyed on path presence, since
  the projection carries pointers/metadata, not body diffs).
- Read-only contract: clicking still routes through the existing open-intent (ADR-0021); the
  only new state is the in-memory "seen" set.
