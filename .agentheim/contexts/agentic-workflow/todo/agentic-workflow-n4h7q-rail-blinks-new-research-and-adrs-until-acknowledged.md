---
id: agentic-workflow-n4h7q
title: Left rail blinks new or updated research docs and ADRs until clicked or reloaded
status: todo
type: feature
context: agentic-workflow
created: 2026-06-19
depends_on: [design-system-001, design-system-v8k2p, agentic-workflow-t3b9k]
blocks: []
tags: [dashboard, rail, live-update, navigation, research, adr, motion]
related_adrs: [0009, 0011, 0012, 0014, 0017, 0021]
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
Track which research/ADR rail entries are **new or updated during the current page session**
and render them with the styleguide attention cue (`design-system-v8k2p`) until the builder
clicks them or reloads the page.

- **Scope: research reports and ADRs only.** (Other artifact kinds — BCs, concepts, tasks —
  are out of scope for this task; the builder asked specifically for research + ADRs.)
- **"New" is session-scoped, in-memory, and keyed on path *and* mtime.** On first render,
  record a baseline **map of each research/ADR path → its `mtimeMs`** (the projection carries
  this mtime per the dependency `agentic-workflow-t3b9k`). On each subsequent live re-projection,
  a path is flagged "new/attention" when it is **either**:
  - **created** — absent from the baseline map (a path that didn't exist at load), **or**
  - **modified** — present in the baseline but with a **newer `mtimeMs`** than its baseline value
    (builder decision 2026-06-19 — *modified also blinks*, not created-only).

  **Reload resets the baseline**, so nothing is "new" on a fresh page. No `localStorage`, no
  disk write — the dashboard stays read-only over `.agentheim/` (ADR-0017); this is presentation
  state only, like the SSE projection itself.
- **Reconcile against the live tree each frame (builder decision 2026-06-19).** A flagged path
  that **vanishes** from the projection before being clicked (its file was moved or removed)
  silently drops out of the flagged set, and its group header's cue recomputes — losing the cue
  if that was the group's only new leaf. No orphaned blink left behind. The flagged set is always
  the intersection of "created-or-modified vs baseline" with "present in the current projection".
- **No cap on a flood (builder decision 2026-06-19).** When a batch of research/ADR docs arrives
  in one frame (e.g. a research session writes several at once), **all** of them blink — every
  flagged leaf gets the cue and propagates to its group header. The cue is low-amplitude and
  reduced-motion-strippable (ADR-0014), so a batch stays non-noisy without a cap.
- **Collapsed-group visibility.** A new leaf flags the cue on its own row **and propagates** the
  cue to its parent group header (Research / Decisions), so an arrival under a collapsed group is
  still noticeable. Expanding the group reveals the blinking leaf.
- **Clearing — mtime-versioned (builder decisions 2026-06-19).** Clicking a flagged entry clears
  **only that entry**, recording the **mtime it was cleared at** (it opens in the main-pane reader
  anyway, ADR-0021/aw-027). Other flagged entries keep blinking until each is individually clicked.
  Because clearing is keyed to a specific mtime, a **subsequent modification** of the same doc
  (a still-newer `mtimeMs` than the cleared snapshot) **re-flags** it. A group header's cue is
  **derived** — present whenever any of its leaves is currently flagged — so it clears
  automatically once all its new leaves are cleared, and re-appears if any leaf re-flags. A page
  reload clears everything.
- Apply the cue by threading the `design-system-v8k2p` flag into the rail's `TreeItem` rows
  and `Collapsible`/`TreeGroup` headers; the "is this path new (created or modified) / which group
  inherits it / which are cleared" computation is a **pure, `node --test`-able** transform over the
  projection (paths + mtimes) + the session baseline map + the cleared map (mirrors `board-sort` /
  `board-group` / `slide-over-data`).
- Rebuild `dashboard/dist/app.js` (esbuild) so the deployed app carries the cue (ADR-0009 —
  this is the consuming task that rebuilds dist for `design-system-v8k2p`).

## Acceptance criteria
- [ ] A research/ADR entry that appears in the rail **after** initial page load (created, via SSE
      re-projection) blinks, using the `design-system-v8k2p` cue.
- [ ] An entry whose file is **modified** after initial load (a newer `mtimeMs` than baseline) also
      blinks.
- [ ] An entry present and **unchanged** since initial load does **not** blink.
- [ ] A flagged entry whose file **vanishes** before being clicked drops out cleanly and its group
      header recomputes — no orphaned blink.
- [ ] A batch of new/updated entries arriving in one frame **all** blink — no cap.
- [ ] A new entry under a collapsed group propagates the cue to that group's header; the leaf
      itself blinks when the group is expanded.
- [ ] Clicking a flagged entry clears only that entry; other flagged entries keep blinking.
- [ ] An entry **modified again** after it was cleared (a still-newer `mtimeMs` than at clear time)
      re-blinks.
- [ ] A group header's cue clears once all its new leaves are cleared (derived from leaf state).
- [ ] Reloading the page clears all blinking (baseline resets — nothing is "new").
- [ ] No `/api` write and no `localStorage` write — purely in-memory presentation state
      (ADR-0017).
- [ ] The "which paths are new (created or modified) / which group inherits the cue / which are
      cleared" logic is a pure function covered under `node --test`.
- [ ] `dashboard/dist/app.js` rebuilt; the full dashboard suite stays green.

## Notes
- Depends on `design-system-v8k2p` (the cue), the styleguide gate (`design-system-001`), **and**
  `agentic-workflow-t3b9k` (mtime carried on research/ADR location pointers in `/api/tree` —
  required for the *modified-also-blinks* detection; without it the dashboard cannot see a
  re-saved doc at the same path).
- Detection seam: `agentic-workflow-009` / `dashboard/app/live-update.js` already re-fetches
  `/api/tree` on every `tree-changed`; this task adds a diff-against-baseline layer on top —
  it must **not** re-interpret the SSE pointer as a transition (the watcher stays
  transport-only, ADR-0012). The rail tree is `treeToLibrary` (`library-data.js`, [[ADR-0011]]).
- Rail group precedent: `agentic-workflow-066` (Research open / Decisions collapsed by default),
  `agentic-workflow-056` (Research above Decisions), `agentic-workflow-075` (Concepts rail group).
- **Edge cases resolved in refinement (2026-06-19):**
  - *Vanishing flagged artifact* → reconcile the flagged set against the live projection every
    frame; drop it silently and recompute the group header.
  - *Flood of docs in one frame* → no cap; every flagged leaf blinks.
  - *Modified vs created* → **both** blink. "Modified" is detected via the per-pointer `mtimeMs`
    that `agentic-workflow-t3b9k` adds to the projection; clearing is mtime-versioned so a later
    edit re-blinks the same doc.
- Read-only contract: clicking still routes through the existing open-intent (ADR-0021); the
  only new state is the in-memory baseline map + cleared map.
