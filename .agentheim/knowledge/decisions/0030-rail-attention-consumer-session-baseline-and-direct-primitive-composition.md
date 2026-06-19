---
id: ADR-0030
title: The rail "new item" cue is consumer-driven from an in-memory session baseline, rendered by composing Collapsible + TreeItem directly (not via TreeGroup)
scope: agentic-workflow
status: accepted
date: 2026-06-19
related_tasks: [agentic-workflow-n4h7q]
related_adrs: [ADR-0029, ADR-0017, ADR-0011, ADR-0012, ADR-0003, ADR-0021]
---

# ADR-0030: The rail "new item" cue is consumer-driven from an in-memory session baseline, rendered by composing Collapsible + TreeItem directly

## Context

ADR-0029 / `design-system-v8k2p` shipped the styleguide half of the rail "new
item" attention cue: an opt-in `attention` boolean on `TreeItem` (a row) and the
shared `Collapsible` (a group header). It deliberately left **two things to the
consumer** (`agentic-workflow-n4h7q`): (a) *which* research/ADR rows are new, and
(b) the until-acknowledged lifecycle. This ADR records how the dashboard answers
both, and one rendering-seam decision that fell out of it.

Two constraints frame the answer. The dashboard is **read-only over `.agentheim/`**
(ADR-0017): it may hold presentation state but must never write `/api`, disk, or
`localStorage`. And the live tree already re-projects `treeToLibrary(/api/tree)`
on every SSE frame (ADR-0011/0012) — the cue must sit *on top of* that re-fetch,
never re-interpret the raw SSE pointer as a transition.

## Decision

**1. "New" is detected by diffing the live projection against a per-session
baseline of `path → mtimeMs`, held in memory.** On the first landed projection the
rail freezes a baseline map of every research/ADR pointer's `mtimeMs` (read from
aw-t3b9k's `locations.adrsMeta` / `researchMeta`). Each subsequent re-projection
recomputes the same map and a path flags when it is **created** (absent from the
baseline) or **modified** (a strictly newer `mtimeMs`). The baseline + a `cleared`
map (path → mtime acknowledged) are the only new state, and they are **in-memory
presentation state only** — a page reload remounts the rail and re-freezes the
baseline, which *is* the acknowledgement-by-reload model. No `/api` write, no
`localStorage`, no disk (ADR-0017). The detection/clearing logic is a **pure,
`node --test`-able** transform (`rail-attention.js`: `railMtimeIndex` /
`flaggedPaths` / `annotateGroups`), mirroring `board-sort` / `board-group`.

**2. The flagged set is always reconciled against the live projection; clearing is
mtime-versioned; there is no cap.** A flagged path that vanishes from the
projection (file moved/removed) drops out silently — the flagged set is the
intersection of "created-or-modified vs baseline, not cleared at this mtime" with
"present in the current projection," so there is never an orphaned blink. A group
header's cue is **derived** (true whenever any leaf is flagged), so it clears once
all its leaves are cleared and re-appears if any re-flags. Clicking clears **only**
that entry, recording the mtime acknowledged; a still-newer edit beats the cleared
mark and re-flags. No cap — a batch arriving in one frame all blink (the cue is
low-amplitude and reduced-motion-strippable, ADR-0029/0014, so a flood stays
quiet).

**3. The rail composes the styleguide `Collapsible` (group header) + `TreeItem`
(rows) DIRECTLY, retiring the `TreeGroup` convenience in this consumer.** The cue's
`attention` flag lives on `Collapsible` and `TreeItem`, but the styleguide
`TreeGroup` convenience (which wraps both) has **no attention seam** — it neither
takes a per-item attention map nor a group-level flag. The obvious alternative —
editing `TreeGroup` to thread attention — would **fork the styleguide** (ADR-0003:
the design-system is the single source, consumed unforked; only the styleguide gate
may change it). So the dashboard instead composes the **same two primitives
`TreeGroup` itself composes**, directly in the rail render, preserving its existing
body spacing (`gap 1 / paddingLeft 8`) and the Decisions-collapsed-by-default
(aw-066) byte-for-byte. This keeps the styleguide unforked while giving the consumer
the per-row + derived-group control the cue needs.

## Consequences

- The dashboard's rail render no longer uses `TreeGroup`; it owns the
  `Collapsible` + `TreeItem` composition. Source guards (`shell-relayout`,
  `workflow-rail-routing`, `rail-default-open`) were updated to the new idiom; the
  `defaultOpen` and per-row `selected` behavior is preserved. A future styleguide
  change that adds an attention seam to `TreeGroup` could fold this back, but that
  is a styleguide-gate decision, not a dashboard one.
- "New" is **session-scoped and forgetful by design** — there is no cross-reload
  memory, no notification history. This is the deliberate read-only posture
  (ADR-0017): the disk is the source of truth; the cue is a glance-level hint, not
  a durable inbox.
- The mtime dependency is load-bearing: "modified blinks" only works because
  aw-t3b9k carries `mtimeMs` on the research/ADR pointers. A null (unstattable)
  mtime can never satisfy a "newer-than" test, so it degrades to created-detection
  on path presence alone — never a spurious re-flag.

See `agentic-workflow-n4h7q`, ADR-0029 (the styleguide cue), ADR-0017 (read-only),
ADR-0011/0012 (the live re-projection seam), ADR-0003 (single source / unforked),
ADR-0021 (the open-intent the click routes through).
