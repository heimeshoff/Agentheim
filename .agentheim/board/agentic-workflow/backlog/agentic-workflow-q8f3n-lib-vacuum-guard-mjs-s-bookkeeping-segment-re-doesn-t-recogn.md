---
id: agentic-workflow-q8f3n
title: `lib/vacuum-guard.mjs`'s `BOOKKEEPING_SEGMENT_RE` doesn't recognize `board/`/`knowledge/contexts/` INDEX paths
status: backlog
type: bug
context: agentic-workflow
created: 2026-09-11
depends_on: []
blocks: []
tags: [layout, vacuum-guard, batch-mix]
related_adrs: [0078, 0064]
related_research: []
prior_art: [agentic-workflow-zgav8]
---

## Why

While sweeping legacy `.agentheim/contexts/`-shaped path literals out of doctrine prose and
`lib/`/`dashboard/` source for ADR-0078 (agentic-workflow-zgav8), this line was found in
`lib/vacuum-guard.mjs`'s "Batch-mix classification" section:

```js
const BOOKKEEPING_SEGMENT_RE =
  /[\\/]\.agentheim[\\/](knowledge[\\/]protocol\.md$|contexts[\\/][^\\/]+[\\/]INDEX\.md$|state[\\/])/;
```

Used by `classifyTaskType`'s bucket-3 (bookkeeping) check for a `type: chore` task's
`FILE_LIST`. It correctly matches `.agentheim/contexts/<bc>/INDEX.md` (the legacy combined
per-BC INDEX) but has never been updated for ADR-0078's two-root layout: it does NOT match
`.agentheim/board/<bc>/INDEX.md` (the task half) nor
`.agentheim/knowledge/contexts/<bc>/INDEX.md` (the knowledge half). Under the current
`'legacy'` tree this is silently correct (there's only one INDEX.md shape today), but once
this repo migrates (agentic-workflow-tgr31) a `chore` task touching only a BC's INDEX.md
would stop classifying as `bookkeeping` and would instead classify as `harness` (since
`HARNESS_SEGMENT_RE` matches any `lib/` path but a bare `board/...`/`knowledge/contexts/...`
path matches neither `HARNESS_SEGMENT_RE` nor the (updated) bookkeeping regex, falling
through to whatever bucket-2 logic decides) — a quiet behavior drift in `work`'s end-of-run
batch-mix line (ADR-0064), not a crash, so it was out of scope for zgav8's own prose/doc-
comment mandate over this file (ADR-0078's own Neutral consequences text says
`lib/vacuum-guard.mjs` "carries no path literals" — true of its `extractOpenQuestions`
half, not this regex, which zgav8 left untouched to avoid a functional-behavior change
needing its own new tests, outside a doctrine-sweep task's scope).

Note also: `.agentheim/board/protocol.md`'s replacement for `knowledge/protocol.md` in the
regex's first alternative needs the same fix — this repo's post-migration protocol path
moves under `board/`, not `knowledge/`.

## What

Widen `BOOKKEEPING_SEGMENT_RE` (or replace it with a call through
`lib/task-system-paths.mjs`'s getters, matching the cj54k/zgav8 discipline used elsewhere)
so it recognizes all three shapes — legacy combined INDEX, board-layout task-half INDEX,
and knowledge-layout knowledge-half INDEX — plus the `board/protocol.md` path, under
whichever layout `detectLayout` resolves. Add fixture coverage in
`lib/test/vacuum-guard.test.mjs` proving a `board/<bc>/INDEX.md`-only `FILE_LIST` still
classifies `bookkeeping`.

## Acceptance criteria

- [ ] `classifyTaskType` (or its caller) classifies a `type: chore` task whose `FILE_LIST`
      touches only `.agentheim/board/<bc>/INDEX.md` (or the knowledge-half equivalent) as
      `bookkeeping`, matching today's legacy-shape behavior.
- [ ] A new test fixture proves this under a `'board'`-layout root; the existing legacy-shape
      test keeps passing.
- [ ] `node --test lib/test/vacuum-guard.test.mjs` and the full `lib/test/*.test.mjs` suite
      stay green.

## Notes

- ADR-0059 disposition: this is enforced by the same test file the fix lands in — no
  separate ADR needed for a targeted regex fix.
- Discovered during agentic-workflow-zgav8; out of that task's scope on purpose (prose/doc-
  comment sweep only, not a functional-behavior change).
