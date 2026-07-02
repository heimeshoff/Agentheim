---
id: agentic-workflow-d8q3n
title: Carry depends_on/blocks through the /api/tree per-task projection
status: todo
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: [agentic-workflow-k5p8w, agentic-workflow-r9k2p]
tags: [dashboard, tree-projection, dependencies]
related_adrs: [0002]
related_research: []
prior_art: [agentic-workflow-013, agentic-workflow-t3b9k]
---

## Why
`agentic-workflow-r9k2p`'s hover-dependency feature needs to know, for any card on the
board, which other cards it `depends_on` and `blocks`. The `/api/tree` projection
(`dashboard/tree.mjs`) currently drops both fields — `projectTask` only carries
`id, title, status, type, context, path, mtimeMs`. Task frontmatter already has real
`depends_on`/`blocks` arrays (every task file does); the projection just never
surfaces them.

## What
`projectTask` (`dashboard/tree.mjs`) gains two new fields on the projected task
object, read straight off the already-parsed frontmatter:

- `dependsOn` — the raw, unresolved array of task-id strings from `fm.depends_on`.
- `blocks` — the raw, unresolved array of task-id strings from `fm.blocks`.

`parseFrontmatter` already turns `depends_on: [a, b]` into `['a', 'b']` and
`blocks: []` into `[]` (the existing bracket-list handling), so this is additive
projection, not new parsing.

Add a small total helper beside `mtimeOf`:

```js
// Frontmatter list fields (depends_on / blocks) round-trip as raw, unresolved
// id-string arrays — pointers+metadata only (ADR-0002); the board resolves them
// against the live tree, loss-tolerantly. Absent/scalar/malformed → [].
function idList(v) {
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s) : [];
}
```

...and add `dependsOn: idList(fm.depends_on)`, `blocks: idList(fm.blocks)` to the
`task` object literal in `projectTask` (after `mtimeMs`).

**No server-side resolution or dedupe.** This stays inside ADR-0002's "pointers +
metadata only" contract: an id-string is metadata, a resolved edge (which card that
id actually points at) is a relationship the *board* derives, board-side, against the
live pooled projection — not something `tree.mjs` computes (it walks one BC folder at
a time; the full id universe only exists after `board-data.treeToColumns` pools every
BC). Duplicate ids are preserved raw (no dedupe here) — deduping, like resolution, is
the consumer's job.

**Downstream note (NOT this task's scope):** `dashboard/app/board-data.js`'s
`treeTicket` drops any field it doesn't explicitly name, so it will need
`dependsOn`/`blocks` added when consumed — that carry lands with
`agentic-workflow-k5p8w`, not here.

## Acceptance criteria
- [ ] A task with `depends_on: [a, b]` and `blocks: [c]` in frontmatter projects
      `task.dependsOn` deep-equal to `['a', 'b']` and `task.blocks` deep-equal to
      `['c']`.
- [ ] A task with neither key present projects both as `[]`.
- [ ] A task with `blocks: []` projects `task.blocks` as `[]`.
- [ ] A task with a malformed/scalar `depends_on` (no brackets) projects `[]` — never
      throws, never returns a bare string.
- [ ] Duplicate ids are preserved (`depends_on: [a, a]` → `['a', 'a']`) — no
      server-side dedupe.
- [ ] An unreadable or frontmatter-less task file still produces a card (existing
      fallback-id behavior unchanged) with `dependsOn: []`, `blocks: []`.
- [ ] `node --test dashboard/test/tree.test.mjs` covers all of the above, mirroring
      the existing `mtimeMs` test shapes (aw-013).

## Notes
Precedent: `agentic-workflow-013` (added `mtimeMs`) and `agentic-workflow-t3b9k`
(added `mtimeMs` to ADR/research pointer meta) — same shape of additive, loss-tolerant
projection change. This task does not touch `board-data.js` — that carry is
`agentic-workflow-k5p8w`'s job, matching the existing `mtimeMs` precedent where the
projection and the consumer landed as separate, sequenced tasks.

Naming: `dependsOn`/`blocks` (camelCase for the first) matches the projection's
existing JSON-shape convention (`mtimeMs`, not `mtime_ms`); `blocks` is already one
word. If a worker prefers verbatim `depends_on`, that's defensible too — just keep it
byte-consistent with whatever `board-data.treeTicket` reads downstream.
