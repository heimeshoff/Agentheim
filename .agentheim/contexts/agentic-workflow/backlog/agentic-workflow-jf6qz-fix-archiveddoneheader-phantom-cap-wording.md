---
id: agentic-workflow-jf6qz
title: Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; also correct the live INDEX headers
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: [agentic-workflow-mqwnc]
blocks: []
tags: [captured, audit-2026-07-22-followup, doctrine-drift]
related_adrs: [0047, 0039]
related_research: []
prior_art: [agentic-workflow-mqwnc, agentic-workflow-c8j3w]
---

## Why

`agentic-workflow-mqwnc` corrects the misleading "most recent 30" done-list header wording in
`references/index-template.md` (the template). But that wording is **also machine-generated**
by `lib/index-rotation.mjs`'s `archivedDoneHeader(capEntries)`:

```js
function archivedDoneHeader(capEntries) {
  return (
    `### Done (most recent ${capEntries}; older entries archived verbatim under ` +
    `\`done-archive/\` — kept for prior-art search, ADR-0039 convention)`
  );
}
```

`rotateIndexDoneList` overwrites the live `### Done (...)` header line with this string
(`lib/index-rotation.mjs:338`, the `DONE_HEADER_LINE` replace) every time it actually rotates a
month out. So:

1. The **live** `.agentheim/contexts/*/INDEX.md` headers still say "most recent 30" today — a
   worker can't legally correct them (conductor-owned; that's exactly why mqwnc was re-scoped
   to leave them alone), and they'd be regenerated from `archivedDoneHeader` anyway.
2. Even after mqwnc fixes the template, the **next** real rotation for any BC silently
   regenerates the exact "most recent N" text the template sweep just removed — the doc fix is
   not durable without this code fix.

This is the code-owned half of mqwnc's original criterion #3, split out per the escalation
(ADR-0032 worker/conductor boundary, ADR-0059 mechanize-or-drop).

## What

1. Update `archivedDoneHeader` to emit wording matching mqwnc's corrected
   `references/index-template.md` header prose — describing current-month-live /
   closed-months-archived, **not** a numeric "most recent N" claim. (`capEntries` may stop
   being a meaningful input to the header string; decide whether it's still needed.)
2. Update the matching assertion(s) in `lib/test/index-rotation.test.mjs` (they almost
   certainly assert the current literal string), and add coverage that a rotation run
   regenerates a header consistent with the template prose.
3. **Decide and implement how the three CURRENT live INDEX headers get corrected** — this is
   the open design question this task must resolve during its own refinement (it is NOT
   todo-ready until it is):
   - **Option A — normalize on the existing conductor seam:** have `rotateAllIndexDoneLists`
     (the session-end INDEX-rotation check, ADR-0047) rewrite the header line to
     `archivedDoneHeader`'s current output even on a no-op run where no month rolls, and count
     that header-only correction as a `changed` path worth committing. Closes the loop through
     an already-conductor-owned path, no worker INDEX edit — but changes the rotation check's
     "quiet no-op" contract, so weigh it against ADR-0047's fully-quiet-common-case rule.
   - **Option B — accept eventual correction:** fix only the code + template; the live headers
     self-correct on each BC's next real month-roll. Simpler, no behavior change, but the live
     "most recent 30" persists (cosmetically wrong) until a month closes.
   - Pick one (or a better third), record the rationale, and — per ADR-0059 — if this
     establishes a convention (e.g. "rotation always normalizes the header"), ship its
     enforcement or mark it prose-only.

## Acceptance criteria

- [ ] To be finalized during refinement. Firm so far: `archivedDoneHeader`'s returned string no
      longer contains "most recent N"; the matching `lib/test/index-rotation.test.mjs`
      assertion(s) updated; `node --test lib/test/*.test.mjs` green.
- [ ] The live-header-correction approach (What #3) is decided, implemented, and the three live
      `contexts/*/INDEX.md` headers end up consistent with `references/index-template.md`'s prose
      (whether immediately via Option A or on next rotation via Option B — state which).

## Notes

Captured during `agentic-workflow-mqwnc` (doc-only micro-sweep) and brought onto `main` +
refined during mqwnc's `modeling` REFINE (2026-07-22). `depends_on: agentic-workflow-mqwnc` so
the canonical header prose (in `references/index-template.md`) exists for the code and tests to
match. Stays in `backlog/` until What #3's design question is resolved — it carries a genuine
decision, not just an implementation.
