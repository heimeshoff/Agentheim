---
id: agentic-workflow-nm16k
title: parseWorkerResult tolerates the two sidecar shape slips that have cost lost-result re-dispatches — an unclosed last block is implicitly closed at the RESULT_END sentinel with repair provenance, and block names may carry digits; amends ADR-0080 §3
status: todo
type: feature
context: agentic-workflow
created: 2026-09-14
completed:
depends_on: []
blocks: []
tags: [worker-contract, worker-result, mechanization, work-skill, transcript-loss, harness]
related_adrs: [0080, 0038, 0059, 0062]
related_research: []
prior_art: [agentic-workflow-qwfq3, agentic-workflow-ghcaj]
---

## Why

Since the ADR-0080 sidecar + trailing-repeat contract shipped (`937b598`, 2026-09-12), 11
worker dispatches have run. Header loss — the failure ADR-0080 guards against — happened 0
times; the sidecar was present in all 8 completions. But 2 of those 11 dispatches still cost a
full lost-result re-dispatch, both because `parseWorkerResult` rejected a sidecar that was
present, complete in substance, and off by one syntactic slip:

- **infrastructure-xh8tw iteration 1 (2026-09-13):** the `BACKLOG_ITEMS` fence was never
  closed → `truncated-block`. The leading header had parsed; the worker rewrote the sidecar,
  no code changed.
- **infrastructure-w506e iteration 1 (2026-09-14):** the task Notes mandated an extra block
  named `ADR_0082_AMENDMENT`; `scanBlocks`' opening-fence grammar is `[A-Z_]+` (no digits), so
  the line read as a `stray-fence`. The worker rewrote it as `ADR_AMENDMENT`, no code changed.

Each re-dispatch is a second worker turn spent re-typing a report the conductor already had.
Both slips are deterministic syntax the parser can absorb without guessing at any value —
unlike header reconstruction (agentic-workflow-gwh69, dismissed 2026-09-14 after its own
11/11-clean closing rule), which would have rescued neither. The evidence trail is in gwh69's
Notes (gate checks 2026-09-12 through 2026-09-14) and the two session-end entries.

## What

Two changes to `lib/worker-result.mjs`'s `scanBlocks` (currently ~line 117), plus the
contract text that states the grammar. Fence-only truth (ADR-0080 §3) is preserved: the only
non-fence line that gains structural meaning is the `RESULT_END` sentinel, and only at EOF.

**(a) Implicit close at the sentinel.** When a block never closes, `scanBlocks` currently
rejects `truncated-block`. New rule, applied only when **all** of these hold:

1. the unclosed block is the **last** opening fence in the text;
2. no other four-backtick line follows it;
3. the last non-blank line of the whole text is exactly `RESULT_END`.

Then: within the unclosed region, find the **last** line matching `RESULT: SUCCESS`,
`RESULT: BOUNCED`, or `RESULT: FAILED` (exact, trimmed). If present, the lines from it up to
(not including) `RESULT_END` become `trailingLines` and everything before it is the block's
content; if absent, the block's content runs to the sentinel and `trailingLines` holds the
sentinel alone. The block is recorded as closed. `parseWorkerResult`'s `layout` gains
`repairs` — `['implicit-close:<BLOCK>']` here, `[]` on every clean parse. Any of the three
conditions failing → `truncated-block`, unchanged. The repair can only turn a rejection into
a parse; a text that parses today parses identically (every existing fixture pins this).

**(b) Block-name grammar.** The opening-fence name grammar widens from `[A-Z_]+` to
`[A-Z][A-Z0-9_]*` in every opening-fence regex in `lib/worker-result.mjs` (three sites today:
the `scanBlocks` open match, its look-ahead for a second opener, and the first-line
`startsWithFence` test). The one-line header field grammar (`[A-Z_]+:`) is unchanged — those
names are fixed. Lowercase, leading-digit, or space-bearing names still reject `stray-fence`.

**(c) Provenance and contract text.**

- `skills/work/SKILL.md`'s `**Result source:**` line appends `· repaired <repairs>` when
  `layout.repairs` is non-empty (ADR-0038 Ruling B: a repaired read is labelled, never passed
  off as a clean measurement). Repaired fields are *read*, not guessed, so the verifier's
  runner-first rule (ADR-0062) is untouched.
- `references/worker-return-format.md` states the widened grammar and the implicit-close rule
  as a *parser tolerance*, explicitly not a license to omit the closing fence — the worker
  contract still mandates every fence closed.
- ADR-0080 §3's grammar sentence is amended (the `[A-Z_]+` literal and the `truncated-block`
  rule) via an amendment note, reported in the RESULT's ADR block — see Notes for the block
  name to use.

## Acceptance criteria

- [ ] `lib/test/worker-result.test.mjs`: a fixture built from the xh8tw shape (leading header,
      four blocks, `BACKLOG_ITEMS` never closed, trailing header copy, `RESULT_END`) parses
      with `layout.repairs` equal to `['implicit-close:BACKLOG_ITEMS']`, `layout.trailingHeader`
      true, and the `BACKLOG_ITEMS` content excluding the trailing header lines.
- [ ] The same fixture with the trailing header copy removed parses (leading header only),
      `repairs` still `['implicit-close:BACKLOG_ITEMS']`, `trailingHeader` false.
- [ ] Each of the three conditions failing still rejects `truncated-block`: an unclosed block
      that is not the last opener; a four-backtick line after the unclosed opener; a text whose
      last non-blank line is not `RESULT_END`.
- [ ] Every pre-existing fixture in `lib/test/worker-result.test.mjs` parses byte-identically
      to before, with `layout.repairs` equal to `[]` — a test asserts the empty array on at
      least one clean leading-only, one trailing-only, and one both-copies fixture.
- [ ] A fixture with an extra block named `ADR_0082_AMENDMENT` (after `BACKLOG_ITEMS`, before
      the trailing header) parses, the block appearing in `blocks` by that name; names
      `adr_amendment`, `0ADR`, and `ADR AMENDMENT` still reject `stray-fence`.
- [ ] `skills/work/SKILL.md` Protocol logging documents the `· repaired <repairs>` suffix on
      the `**Result source:**` line; `references/worker-return-format.md` states the
      `[A-Z][A-Z0-9_]*` grammar and the implicit-close tolerance with its three conditions.
- [ ] ADR-0080 carries an amendment note under its Amendments section updating §3's grammar
      literal and its `truncated-block` rule to the above, dated and pointing at this task.
- [ ] `node --test lib/test/*.test.mjs` is green on the live tree (the two environmental
      flakes named in qwfq3's Notes excepted: bridge fixed-port EADDRINUSE while a live bridge
      runs, and foreign-launch EPERM teardown).

## Notes

- **Worker briefing, load-bearing:** the conductor parses *this task's own* RESULT with the
  parser on `main`, not the one in your worktree — so your report must satisfy the **old**
  grammar. Name the ADR-0080 amendment block `ADR_AMENDMENT` (letters and underscore only, no
  digits) and close every four-backtick fence, including `BACKLOG_ITEMS`. A slip here
  reproduces the very incident this task closes and costs a re-dispatch.
- Convention check (ADR-0059): the widened grammar and the implicit-close rule are format
  conventions other artifacts follow; enforcement is the parser test set above, shipped in
  the same task — no prose-only marker needed.
- Why condition 3 is the sentinel and not the trailing header: a `RESULT: SUCCESS` line can
  legitimately appear inside a block (a `README_DELTA` documenting the format does exactly
  that), so it is only trusted as a *split point* inside an already-condemned region, never
  as a close signal on its own. `RESULT_END` at EOF is unambiguous by contract.
- Whether xh8tw's iteration-1 sidecar carried `RESULT_END` is unrecorded (5 of the 8
  post-contract completion entries omitted the `**Result source:**` line). If it did not, (a)
  would not have fired for it either — that is by design; a missing sentinel is a larger slip
  than a missing fence and stays a re-dispatch.
- Out of scope: any header reconstruction (gwh69, dismissed), and any worker-side lint of task
  Notes for mandated block names — (b) makes digit-bearing names legal instead.
