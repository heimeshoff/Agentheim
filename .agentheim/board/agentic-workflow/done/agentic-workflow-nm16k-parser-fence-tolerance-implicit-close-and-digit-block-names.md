---
id: agentic-workflow-nm16k
title: parseWorkerResult tolerates the two sidecar shape slips that have cost lost-result re-dispatches — an unclosed last block is implicitly closed at the RESULT_END sentinel with repair provenance, and block names may carry digits; amends ADR-0080 §3
status: done
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

## Verifier note (iteration 1)

REASONS:
- Acceptance criterion 3 ("Each of the three conditions failing still rejects `truncated-block`: ... **a four-backtick line after the unclosed opener** ...") is not met. `lib/worker-result.mjs` lines 166-179: the inner content scan breaks only on a bare close (`/^````\s*$/`) or a well-formed opener (`OPEN_FENCE_RE`). Any four-backtick line that is neither — a lowercase/leading-digit/space-bearing name, a name with trailing text, or five backticks — is pushed into `contentLines`, the scan reaches `j === lines.length`, and the implicit-close repair fires. Condition 2 of the task's `## What` (a) ("no other four-backtick line follows it") is therefore not implemented as a distinct condition; conditions 1 and 2 were collapsed into condition 1.
- Demonstrated against the worktree module, not inferred: with an unclosed `BACKLOG_ITEMS` followed by a stray line `` ````adr_amendment `` / `` ````ADR AMENDMENT `` / `` ````0ADR `` / `` ````ADR_AMENDMENT trailing text `` / ` ````` `, and `RESULT_END` as the last non-blank line, `parseWorkerResult` returns `ok: true`, `repairs: ['implicit-close:BACKLOG_ITEMS']`, and silently swallows both the stray fence line **and** all content the worker intended as a separate block into `blocks.backlogItems[0].body`. Before this diff every one of those texts rejected `truncated-block`. This is not hypothetical: the two motivating incidents composed (xh8tw's unclosed `BACKLOG_ITEMS` + w506e's non-conforming extra-block name) produce exactly this text, and the new behavior loses the amendment block silently instead of costing a re-dispatch — the silent mis-attribution ADR-0080 §3's fence-only truth exists to prevent. Note the same three names (`adr_amendment`, `0ADR`, `ADR AMENDMENT`) that criterion 5's test pins as `stray-fence` rejections are absorbed as content on this path.
- The test the diff offers for that criterion does not falsify the gap: `lib/test/worker-result.test.mjs` line 159, "a four-backtick line following the unclosed opener ... still rejects truncated-block", uses `` ````BACKLOG_ITEMS `` — a well-formed opener, i.e. the identical mechanism as the condition-1 test at line 128. No test exercises a four-backtick line that is neither an opener nor a bare close, which is the only class that distinguishes condition 2 from condition 1.
- The doc comment at `lib/worker-result.mjs` lines 138-142 and the inline comment at line 180 assert the scan runs off EOF "without encountering any further four-backtick line at all, which by construction means both 'this is the last opener' and 'no other four-backtick line follows it'". That claim is false for the cases above, so the code documents a rule it does not implement.
- The `ADR_AMENDMENT` text the conductor will append to ADR-0080 repeats the same incorrect claim ("the content scan runs off EOF encountering no further four-backtick line at all"). Its grammar-widening half, its date, and its pointer at this task are correct, but as written it would durably record a §3 rule the parser does not honor.

SUGGESTED_FIX: In `scanBlocks`, make implicit-close eligibility require that the unclosed region contained **no line matching `/^````/` at all** (track it while scanning, or break the inner loop on `/^````/` and distinguish the bare-close case) so a malformed four-backtick line still rejects `truncated-block`; add a test using a stray fence line that is neither an opener nor a bare close, and correct the doc comment, the inline comment, and the `ADR_AMENDMENT` text to state the condition the code actually enforces.

ITERATION_HINT: likely-fixable

## Verifier note (iteration 2)

REASONS:
- Check 5 (BC README sync): the parsed `readmeDelta` is `[]`, but the diff changes an invariant the BC README states verbatim. `.agentheim/knowledge/contexts/agentic-workflow/README.md:1255` (the **Worker RESULT redundancy — sidecar, trailing header repeat, source ladder (ADR-0080)** bullet) reads "`parseWorkerResult` tolerates a leading copy, a trailing copy, both, or neither, reporting `layout: {leadingHeader, trailingHeader, endSentinel, softMismatch}`". After this diff `layout` carries a fifth field, `repairs` (`lib/worker-result.mjs:400`, `:233`, and the JSDoc at `:442-443`), and the parser gains two new contract behaviours that bullet does not admit: the implicit-close-at-`RESULT_END` tolerance and the widened `[A-Z][A-Z0-9_]*` opening-fence name grammar. The worker reported both to `references/worker-return-format.md` and `skills/work/SKILL.md`, and to ADR-0080 via the `ADR_AMENDMENT` block, but not to the README — so the README's enumeration goes stale (4 of 5 fields) the moment this integrates. `agents/worker.md`'s fifth action requires a delta when a task "introduced or changed ubiquitous language, aggregates, events, commands, or invariants"; this changed an invariant the README restates.
- Non-blocking observation (not a required fix, and not the reason for this FAIL): acceptance criterion 5's clause "the block appearing in `blocks` by that name" is unsatisfiable as worded and was not implemented. `extractBlocksFromParsed` (`lib/worker-result.mjs:404-434`) returns a fixed four-key object (`readmeDelta, adrs, outcome, backlogItems`); extra tolerated blocks have never been surfaced by name (the pre-existing `EXTRA_ONE`/`EXTRA_TWO` tolerance test at `lib/test/worker-result.test.mjs:366` asserts the same). Confirmed against the worktree module directly: a text with a trailing `ADR_0082_AMENDMENT` block parses `ok:true` and `Object.keys(result.blocks)` is `readmeDelta,adrs,outcome,backlogItems`. The substantive half of the criterion — the digit-bearing name is accepted rather than rejected `stray-fence`, while `adr_amendment` / `0ADR` / `ADR AMENDMENT` still reject `stray-fence` — is implemented and tested, and matches `## What` (b), which only asks for the grammar widening. The clause is a wording error about pre-existing design, not a worker shortfall.

SUGGESTED_FIX: Re-dispatch for the `README_DELTA` block only — no code change is needed. Report one `replace` op on `## Ubiquitous language`, anchored on the term head `Worker RESULT redundancy — sidecar, trailing header repeat, source ladder`, rewriting the `layout` tuple to `{leadingHeader, trailingHeader, endSentinel, softMismatch, repairs}` and adding one clause for the ADR-0080 §3 amendment (widened `[A-Z][A-Z0-9_]*` block-name grammar; implicit close of the last unclosed block at a trailing `RESULT_END` under its three conditions, `repairs: ['implicit-close:<BLOCK>']`, surfaced as the `· repaired <repairs>` suffix on the `**Result source:**` line per ADR-0038 Ruling B). Supply `expected` whitespace-collapsed from the current bullet text, and keep the bullet's trailing `See ADR-0080 (...)` pointer intact.

ITERATION_HINT: likely-fixable

## Outcome

`lib/worker-result.mjs`'s `scanBlocks` now tolerates the two sidecar shape slips that cost lost-result re-dispatches on infrastructure-xh8tw and infrastructure-w506e, amending ADR-0080 §3:

- **Implicit close at the `RESULT_END` sentinel — three conditions, all required.** (1) the unclosed block is the LAST opening fence in the text; (2) no four-backtick-prefixed line (`/^````/`) — a bare close, a well-formed opener, or a malformed one (wrong case, leading digit, embedded space, trailing text, five-plus backticks) — appears anywhere in the unclosed region; (3) the text's last non-blank line is exactly `RESULT_END`. When all three hold, the block is implicitly closed at the sentinel instead of rejected `truncated-block`. Within the unclosed region, the last line matching `RESULT: SUCCESS|BOUNCED|FAILED` (if any) splits it: everything before is the block's content, everything from it up to (not including) `RESULT_END` becomes the recovered trailing header region; if absent, the block's content runs to the sentinel and the trailing region holds the sentinel alone. Every `ok:true` result carries `layout.repairs` — `['implicit-close:<BLOCK>']` here, `[]` on every clean parse — so a repaired read is measured and labelled, never passed off as a clean one (ADR-0038 Ruling B). A malformed four-backtick line inside a block that goes on to close NORMALLY (via its own real closing fence) is still tolerated as ordinary content, unchanged from before — it is tracked (`sawForeignFenceLine`), not acted on, and only disqualifies the repair once the block turns out unclosed. (Iteration-1 gap, closed in iteration 2: the inner content scan originally only recognized a bare close or a well-formed opener as "a four-backtick line following the unclosed opener," so a malformed line — e.g. a stray ` ````adr_amendment ` — was silently swallowed as content and the repair fired anyway, mis-attributing the stray block's content into the recovered block. The verifier's exact composed-incident fixture — unclosed `BACKLOG_ITEMS` + a stray ` ````adr_amendment ` line + `RESULT_END` — now rejects `truncated-block` naming `BACKLOG_ITEMS`, confirmed directly against the module.)
- **Widened block-name grammar.** The opening-fence name grammar widens from `[A-Z_]+` to `[A-Z][A-Z0-9_]*` in all three sites that matched it (`scanBlocks`'s open match, its second-opener look-ahead, and `parseWorkerResult`'s first-line `startsWithFence` test) — a leading uppercase letter, then any mix of uppercase letters, digits, and underscores. `ADR_0082_AMENDMENT`-shaped names now parse; lowercase, leading-digit, or space-bearing names still reject `stray-fence`.

All 38 originally-pre-existing tests in `lib/test/worker-result.test.mjs` pass byte-identically (three `layout` `deepEqual` fixtures gained an explicit `repairs: []` to keep matching the widened layout shape). 9 new tests across iterations 1–2 cover: the xh8tw incident shape (unclosed `BACKLOG_ITEMS`, trailing header copy, `RESULT_END` → repairs recorded, trailing header recovered, backlog item content excludes the header lines); the same fixture with the trailing header copy removed (repairs still recorded, `trailingHeader: false`); the three failing-condition cases (not-the-last-opener, a four-backtick line intervening, no `RESULT_END` at EOF) still rejecting `truncated-block`; the widened grammar accepting `ADR_0082_AMENDMENT` while still rejecting `adr_amendment` / `0ADR` / `ADR AMENDMENT` as `stray-fence`; the iteration-2 regression coverage — a malformed four-backtick line (`adr_amendment`, `0ADR`, `ADR AMENDMENT`, a name with trailing text, five backticks) inside the unclosed region always rejects `truncated-block` naming `BACKLOG_ITEMS`; and a pin test proving a malformed four-backtick line inside a block that DOES close normally is still tolerated as content, `layout.repairs` staying `[]`.

`skills/work/SKILL.md`'s two `**Result source:**` completion-entry templates (PASS and SKIPPED shapes) document the `· repaired <repairs>` suffix, appended only when `layout.repairs` is non-empty. `references/worker-return-format.md` states the widened `[A-Z][A-Z0-9_]*` grammar and the implicit-close tolerance with its three conditions, explicit that every fence must still be closed — this is a parser tolerance, not a license to omit one — and documents `layout.repairs` in "Parsing is mechanized". The `scanBlocks` doc comment and its inline comments now state all three conditions the code actually enforces, matching the task's `## What` (a) enumeration.

Iteration 3 made no code change (the verifier's iteration-2 finding was BC README sync only): the `README_DELTA` block above replaces the single `Worker RESULT redundancy — sidecar, trailing header repeat, source ladder (ADR-0080)` bullet in `## Ubiquitous language` with a version whose `layout` tuple includes `repairs` and that states the ADR-0080 §3 amendment inline, dry-run-verified via `applyReadmeDelta` (disposition `applied`, once CRLF-normalized to match the conductor's own integration step). The verifier's non-blocking observation on acceptance criterion 5's "the block appearing in `blocks` by that name" wording: the extra-block test asserts `result.ok === true` rather than inspecting a raw per-name list (the public `parseWorkerResult` return never exposes one — only the four canonical blocks land in `.blocks`), mirroring the pre-existing "tolerance: extra NAME blocks" test's own pattern; the criterion's substantive half (the digit-bearing name parses instead of rejecting) is fully covered.

Files: `lib/worker-result.mjs`, `lib/test/worker-result.test.mjs`, `references/worker-return-format.md`, `skills/work/SKILL.md`. `node --test lib/test/*.test.mjs` is green: 868/868 (`pass 868`, `fail 0` — runner's own summary line, re-confirmed at iteration 3 with no code change since iteration 2).
