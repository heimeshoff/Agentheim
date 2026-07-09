---
id: agentic-workflow-dk3vz
title: rotateIndexDoneList reads an unparseable done-list as empty — silent {ok:true, liveEntries:0}
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-09
completed:
depends_on: []
blocks: []
tags: [index, rotation, cap-and-roll, bookkeeping, silent-failure]
related_adrs: [0039, 0047]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-d4q7f, agentic-workflow-v8n3t]
---

## Why

`parseDoneListEntries` (`lib/index-rotation.mjs`) skips any non-blank done-list line that doesn't
match `ENTRY_LINE` — deliberately loss-tolerant per line, so one malformed entry never aborts a
rotation. But when *no* line matches (a project whose done-list is written in any other shape),
the same tolerance turns into a silent wrong answer: `rotateIndexDoneList` returns
`{ok: true, rotated: false, liveEntries: 0}` — indistinguishable from a genuinely empty list. The
cap can never fire for that project, and the manifest actively asserts everything is fine, so the
ADR-0047 session-end check surfaces nothing.

Field report (WisdomHeim vault, 2026-07-09, plugin ~0.8.x): all four BCs reported
`liveEntries: 0`, including one with six done tasks recorded as markdown-link lines.

There is a second, sharper face by inspection of current `main`: on a done-list that is
*partially* parseable and over cap, a firing rotation rewrites the block from `keptEntries` only —
every unmatched non-blank line is silently deleted from the live `INDEX.md` and lands in no
archive file. Per-line loss-tolerance is fine for *skipping*; it is not fine once the block gets
*rewritten* around the skipped lines.

## What

Distinguish "empty" from "unparseable", and never rewrite a block containing lines the parser
didn't understand.

Direction:

1. **All-unparseable:** when the `done-list` block contains non-blank lines but zero match
   `ENTRY_LINE`, return a structured failure (`{ok:false, code:'unparseable-done-list', context,
   reason}`) or at minimum a populated `warnings: []` channel on the manifest — implementer's
   choice, but the ADR-0047 session-end check in `skills/work/SKILL.md` must surface whichever
   signal is chosen instead of treating the run as a clean no-op.
2. **Partially unparseable + rotation firing:** either refuse to rotate that BC (same structured
   signal) or carry unmatched lines through the rewrite verbatim — but never drop them. Refusing
   is the simpler contract and matches the fail-closed posture of ADR-0038.

## Acceptance criteria

- [ ] A non-empty done-list block with zero `ENTRY_LINE` matches no longer yields a bare
      `{ok:true, rotated:false, liveEntries:0}` — the chosen signal (error code or warnings) is
      present and names the BC.
- [ ] A partially parseable done-list over cap loses no line: rotation either refuses with the
      same signal or preserves unmatched lines verbatim in the rewritten block. A test pins
      whichever behavior is chosen.
- [ ] `skills/work/SKILL.md`'s INDEX-rotation session-end check documents how the new signal is
      handled (surfaced to the builder, not swallowed).
- [ ] Existing suite (`node --test lib/test/*.test.mjs`) stays green.

## Notes

- The blank-line skip and the single-malformed-line skip (when the rest of the block parses and
  no rotation fires) can stay as-is — the defect is the *aggregate* silent zero and the
  *rewrite-time* drop, not per-line tolerance itself.
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` (transplanted
  here 2026-07-09 after verifying against `main`).
