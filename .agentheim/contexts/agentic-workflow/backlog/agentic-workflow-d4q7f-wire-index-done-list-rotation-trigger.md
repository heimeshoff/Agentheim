---
id: agentic-workflow-d4q7f
title: Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [protocol, rotation, bookkeeping, cap-and-roll, index]
related_adrs: [0039, 0041, 0038, 0045]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-v8n3t]
---

## Why

`agentic-workflow-v8n3t` (ADR-0045) closed ADR-0039's deferred "who invokes it" non-decision for
`protocol.md` rotation by wiring `rotateProtocol` into `work`'s session-end flow. Its own Notes
section flagged that `agentic-workflow-c8j3w`'s `rotateIndexDoneList`
(`lib/index-rotation.mjs`) — the sibling cap-and-roll surface for a BC's `INDEX.md` done-list —
shares the exact same trigger-less gap: the mechanism and tests exist, nothing calls it.

This is not a copy-paste of ADR-0045's mechanics. `c8j3w`'s doctrine already notes a reachability
wrinkle protocol rotation doesn't have: `modeling`'s prior-art (Backlink) matcher reads a BC's
rendered done-list text, so whichever trigger point is chosen must account for prior-art lookups
correctly seeing rotated-out entries via `done-archive/YYYY-MM.md` (the read-side pointer already
exists per ADR-0039 doctrine reuse — confirm it's actually wired, not just documented).

## What

Decide and wire a trigger for `rotateIndexDoneList` (or `rotateAllIndexDoneLists`), following the
same ADR-0038 three-layer boundary ADR-0045 used: script stays git-free, the calling skill owns
the scoped `git add` + commit of the rotated file set. Consider whether the natural call site is
`work`'s session-end flow (parallel to ADR-0045, since `work` is the skill that most often adds
done-list entries via task completion) or a different seam given the prior-art reachability
concern above. Write an ADR recording the decision (next free ADR number at capture time).

## Acceptance criteria

- [ ] A defined trigger invokes `rotateIndexDoneList`/`rotateAllIndexDoneLists` from skill prose,
      with the bootstrap command included.
- [ ] An ADR records the trigger decision, closing this specific deferred non-decision (as the
      BC README's `rotateIndexDoneList` entry currently notes it).
- [ ] Confirm (or fix) that `modeling`'s prior-art matcher actually reads `done-archive/` for a BC
      whose done-list has been rotated — not just that the doctrine says it should.
- [ ] Any new/changed `lib/` surface is covered by `node --test lib/test/*.test.mjs`, green;
      existing `lib/test/index-rotation.test.mjs` (if present) stays untouched.
