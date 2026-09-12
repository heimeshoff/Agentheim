---
id: agentic-workflow-qwfq3
title: Worker RESULT survives a lost transcript — the worker writes its RESULT to a conductor-designated sidecar under `.worktrees/.results/`, repeats the header block after the four fenced blocks behind a `RESULT_END` sentinel, and the conductor reads it through a mechanized sidecar → transcript → unescaped-notification ladder whose floor is a lost-result re-dispatch into the same worktree under its own one-shot budget (ADR-0080)
status: todo
type: bug
context: agentic-workflow
created: 2026-09-12
completed:
depends_on: []
blocks: [agentic-workflow-gwh69]
tags: [captured, worker-contract, worker-result, mechanization, work-skill, transcript-loss, harness]
related_adrs: [0080, 0074, 0032, 0072, 0059]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-q7v3k, agentic-workflow-r7dq3]
---

## Why

Post-ghcaj (ADR-0074) the worker's strict `RESULT: SUCCESS` block is the **only** channel
through which a worker's work reaches `main`: nine one-line header fields (`TASK_ID`,
`SUMMARY`, `FILES_CHANGED`, `FILE_LIST`, `ADRS_WRITTEN`, `TESTS_ADDED`, `TESTS_PASSING`,
`TDD_SKIPPED`, `CONCEPT_CANDIDATE`) followed by the four four-backtick-fenced blocks
(`README_DELTA` / `ADRS` / `OUTCOME` / `BACKLOG_ITEMS`), parsed by `lib/worker-result.mjs`'s
`parseWorkerResult` against the prose contract in `references/worker-return-format.md`.
`FILE_LIST` feeds the ADR-0057 checkpoint guard (`partitionCheckpointFiles`), `TESTS_*`
feed the verifier's gate, and the blocks feed every materialization step in
`skills/work/SKILL.md`'s "PASS / SKIP" (a)–(f).

That channel has now been lost **twice in two sessions, three dispatches out of six**, via
two independent harness behaviours the project does not control:

- (a) the Agent tool's per-subagent transcript `.output` file is sometimes **0 bytes**, so the
  harness's completion-notification text is the only surviving copy of the RESULT; and
- (b) that notification copy is **HTML-entity-escaped** (`&lt;` `&gt;` `&amp;`) and, for a
  long RESULT, **truncated from the top** — both times this session it began at the
  ````README_DELTA fence, dropping every header line including `FILE_LIST`.

Each time the conductor recovered by hand: reconstructing `FILE_LIST` from the worktree's
`git status --porcelain` (which happened to match the Outcome's "Key files" list exactly),
composing `SUMMARY` / `FILES_CHANGED` / `TESTS_ADDED` from the Outcome prose, dropping stray
`</ADRS>`-style lines, and unescaping entities before parsing — see the "Work session ended"
protocol entries of 2026-09-12 16:20 (Conductor note) and 18:07 (Conductor note 1). That is a
judgment-heavy manual recovery repeated per incident, with no test and no record of which
fields were measured versus reconstructed — precisely the shape ADR-0059 (mechanize-or-drop)
and ADR-0038 (three-layer boundary; git-free, `node --test`-covered lib) say must become a
mechanized, tested step or be dropped. The verifier, meanwhile, was handed a RESULT the
conductor had partly authored, which ADR-0062's runner-first doctrine never contemplated.

The root cause (the harness's transcript loss and notification escaping/truncation) is outside
the project's control and is **not** this task's target. What IS under the project's control:
the worker's return format, the conductor prose in `skills/work/SKILL.md`, the parser in
`lib/worker-result.mjs`, the iteration budget in `lib/merge-conflict-ladder.mjs`, and the
verifier's inputs.

## What

Implement **ADR-0080** (written at refinement, 2026-09-12 — read it first; it records every
design call below with the alternatives rejected). Six pieces, all inside `agentic-workflow`:

**1. Sidecar copy — the primary fix.** The Subagent Prompt Template's `## Your task` block gains
`Result file: <ABSOLUTE-PATH>`, the absolute form of
`resultSidecarRelativePath(taskId, iteration)` (a new pure export of `lib/worker-result.mjs`
returning `.worktrees/.results/<task-id>.iter-<N>.md`; `<N>` is the verification iteration
this dispatch is judged at). The worker's final action, for every RESULT kind, is to write its
exact RESULT text there with the Write tool and then return the same text. This is the **one
sanctioned worker write outside its worktree** — a narrowing of ADR-0032 §3's workspace
confinement, not of rule 10 (`.agentheim/` stays untouchable; the checkpoint guard still
refuses anything there). The conductor deletes any file at that path before spawning, and after
the worker returns records whether the sidecar was present with a matching `TASK_ID`
(`sidecar: present | missing` — the compliance signal `agentic-workflow-gwh69`'s gate reads).
No per-teardown deletion anywhere: a single **session-end sweep** in "Reconciling stranded
carry-over" deletes every `.worktrees/.results/*.md` whose `<task-id>` has no live worktree in
`git worktree list --porcelain` and reports the count; a kept (escalated) worktree keeps its
sidecars because the worktree is still listed.

**2. Truncation-tolerant layout.** On SUCCESS, after the closing fence of the last fenced block,
the worker repeats the header block verbatim — the `RESULT: SUCCESS` line plus the nine fields —
then a final line reading exactly `RESULT_END`. BOUNCED and FAILED end with `RESULT_END` alone.
Both copies are kept: a top-truncation keeps the trailing headers, a bottom-truncation keeps the
leading ones, `RESULT_END` proves the tail is intact. Honest recovery window: the trailing copy
rescues only a top-truncation that lands at or before the first opening fence; a cut inside a
block loses that block and no rung short of re-dispatch recovers it.

**3. Parser grammar** (`parseWorkerResult`), settled rules:
- Fence boundaries come from `extractBlocks`'s own scan (it returns the index after the last
  closing fence it consumed) — never a raw re-scan for `````. A top-level four-backtick line
  that is not a well-formed opening fence (`^````[A-Z_]+\s*$`) or the closing fence of an open
  block is rejected `stray-fence`, never silently skipped.
- Leading region = lines before the first opening fence; trailing region = lines after the last
  closing fence. A header copy counts only when **complete** (the `RESULT:` line plus every
  required field for that value); an incomplete fragment is discarded, never compared.
- The text's first non-blank line must still be either `RESULT:` or an opening fence — no
  preamble is tolerated; anything else is `missing-result-line` exactly as today.
- Both copies present: values compared trimmed and whitespace-collapsed. A difference in a
  mechanically consumed field (`RESULT`, `TASK_ID`, `FILES_CHANGED`, `FILE_LIST`,
  `ADRS_WRITTEN`, `TESTS_ADDED`, `TESTS_PASSING`, `TDD_SKIPPED`) rejects
  `{ok:false, code:'header-mismatch', field}`; a difference in a prose field (`SUMMARY`,
  `CONCEPT_CANDIDATE`) is reported in `layout.softMismatch` and the leading copy wins.
- A trailing-only copy whose value is BOUNCED or FAILED with fenced blocks above it rejects
  `layout-conflict`.
- `RESULT` never lands in `fields` (`Object.keys(fields)` equals `SUCCESS_FIELDS` regardless of
  source). Every `ok:true` result — SUCCESS, BOUNCED, FAILED — carries
  `layout: {leadingHeader, trailingHeader, endSentinel, softMismatch}`.
- A `RESULT:` / `RESULT_END` line inside a fenced block is content. This task's own worker will
  quote the format inside `OUTCOME`, so the spoof case is exercised on day one.
- Backward-compatible: a leading-only RESULT without `RESULT_END` parses to identical `fields`
  and `blocks`; the existing extra-fenced-block tolerance (r4mzp shape) survives.

**4. Unescape + mechanized source selection** — two new pure exports of `lib/worker-result.mjs`:
`unescapeNotificationCopy(text)` (single left-to-right pass over `&lt; &gt; &amp; &quot;
&#39;` and numeric `&#NNN;` / `&#xHH;`, so `&amp;lt;` becomes `&lt;` never `<`; drops any line
that is solely `</NAME>` for one of the four block names; plain text returns byte-identical),
and `selectResultSource({taskId, sidecar, transcript, notification})` — tries sidecar, then
transcript, then `unescapeNotificationCopy(notification)`; a candidate counts only if it
parses and its `TASK_ID` equals `taskId`; returns `{ok:true, source, parsed, attempts}` or
`{ok:false, code:'no-valid-source', attempts}` with `attempts` as `[{source, code}]`. The
conductor gathers the three strings and calls this; it never chooses in prose.

**5. Lost-result re-dispatch under its own one-shot budget.** `no-valid-source` → re-dispatch
the worker into the SAME worktree with the standard template plus a prepended paragraph ("your
prior RESULT was lost in transit; the worktree already holds your finished work; re-read the
task, run the suite from the worktree, write the sidecar, return the RESULT"). Mechanized in
`lib/merge-conflict-ladder.mjs`: `createLadderState()` gains `lostResultUsedThisWorktree`,
`onLostResult(state)` returns `dispatch-lost-result` once per worktree lifetime and `escalate`
thereafter, never touches `decideAfterVerifierVerdict`'s iteration count (the re-dispatch
re-runs the **same** iteration number), and `onWorktreeTeardown()` resets it — mirroring
ADR-0072's merge-conflict one-shot, and for ADR-0072's own reason: a transport loss is not
evidence about the diff, so it must not consume a verifier-FAIL iteration. A second loss on
the same worktree escalates as its own kind: salvage patch tagged `lost-result`, worktree kept,
`## Salvage note` appended, reported on its own End-of-run line ("Lost-result escalations"),
never in "Escalated after verification". Lost-result re-dispatches are tallied on their own
line, so `PASS (iteration N)` and the dispatch tally keep their meaning. A lost RESULT never
tears the worktree down and is never hand-parsed or hand-completed.

**6. Observability + docs + lint.** The completion protocol entries gain
`**Result source:** <sidecar|transcript|notification|re-dispatch> · layout <leading/trailing/
sentinel> · sidecar <present|missing>` (measured, ADR-0038 Ruling B). `references/worker-
return-format.md` is the single source for the new shape; `agents/worker.md` and the template
point at it. `agents/verifier.md`'s parenthetical restatement of the nine field names — already
drifted once (f7k2d) — is **deleted and replaced by a pointer** (ADR-0068 second-drift rule), and
the new lint `lib/worker-result-contract.mjs` keeps every restatement site honest.

**Deferred behind evidence — `reconstructResultFromWorktree`** (split to
`agentic-workflow-gwh69`). Honest tradeoff: reconstruction *preserves* the worker's authored
`ADRS` / `README_DELTA` / `OUTCOME` / `BACKLOG_ITEMS` blocks while a re-dispatch *re-authors*
them; but reconstruction can only ever fabricate `TESTS_*` as `unknown`, and pieces 1 and 2
cover every incident seen so far. Pieces 1 and 2 are **correlated** defences (both are prose
instructions to the same worker in the same prompt; one bout of non-compliance can drop both),
which is why the completion entry measures `sidecar` and `layout` on every task — that
compliance signal, not only a fired re-dispatch, opens gwh69's gate.

## Acceptance criteria

- [ ] `lib/worker-result.mjs` exports `resultSidecarRelativePath(taskId, iteration)` returning
      `.worktrees/.results/<task-id>.iter-<N>.md` (forward slashes; throws on a non-positive
      integer iteration); a test pins the string.
- [ ] `parseWorkerResult` accepts a SUCCESS header copy before the first fence, after the last
      closing fence, or both, per the grammar in What §3. `lib/test/worker-result.test.mjs`
      covers, and every pre-existing test there passes unchanged: leading-only without sentinel
      (identical `fields`/`blocks` to today); leading+sentinel; trailing-only (text begins at a
      ````README_DELTA fence); both-equal; mechanical mismatch (`FILE_LIST`, returns `field`);
      prose-only mismatch (`SUMMARY`, ok with `layout.softMismatch`, leading value wins);
      whitespace-only difference (ok, no soft mismatch); incomplete trailing fragment (ignored,
      `layout.trailingHeader === false`); `stray-fence`; `layout-conflict`; preamble before the
      leading `RESULT:` line still `missing-result-line`; BOUNCED and FAILED with `RESULT_END`
      (`layout.endSentinel === true`); `RESULT` absent from `fields` in every case.
- [ ] Spoof test: a SUCCESS text whose `OUTCOME` and `BACKLOG_ITEMS` content each contain the
      literal lines `RESULT: SUCCESS` and `RESULT_END` parses with those lines as block content
      and `layout.trailingHeader === false`.
- [ ] Tolerance test: two extra ````NAME blocks between `BACKLOG_ITEMS` and the trailing copy
      parse with the four `blocks` intact and `layout.trailingHeader === true`.
- [ ] `unescapeNotificationCopy` per What §4: tests pin `&amp;lt;` → `&lt;`, the 2026-09-12
      16:20 incident fixture (entities + two stray closing-tag lines) round-tripping to a
      `parseWorkerResult`-valid text, and byte-identity on plain input.
- [ ] `selectResultSource` per What §4: tests cover sidecar valid (source `sidecar`); sidecar
      empty + transcript valid (`transcript`); sidecar with wrong `TASK_ID` + transcript valid
      (`transcript`, attempts records the sidecar's `task-id-mismatch`); sidecar unparseable +
      transcript empty + escaped top-truncated notification with trailing headers
      (`notification`); all three dead (`no-valid-source`, three attempts). `lib/worker-result.mjs`
      stays stdlib-free, git-free and side-effect-free (ADR-0038).
- [ ] `lib/merge-conflict-ladder.mjs`: `createLadderState()` carries
      `lostResultUsedThisWorktree: false`; `onLostResult(state)` returns
      `{decision:'dispatch-lost-result', state}` on first use and `{decision:'escalate', state}`
      on the second; it never changes `ladderUsedThisWorktree`; `onWorktreeTeardown()` resets
      both flags; `onMergeBackConflict` is unchanged. Tests in `lib/test/merge-conflict-ladder.test.mjs`
      cover all four and the independence of the two one-shots (a spent merge-conflict budget
      leaves the lost-result budget available, and vice versa).
- [ ] `references/worker-return-format.md` documents the `Result file:` field, the
      write-then-return final action for every RESULT kind, the trailing header repeat (SUCCESS
      only, verbatim including the `RESULT: SUCCESS` line), the `RESULT_END` sentinel (every
      kind), and the sidecar path convention; its three code samples show the new shape.
      `agents/worker.md`'s return-format section names `Result file:` and the final action,
      states it is the one sanctioned write outside the worktree, and points at the reference
      for the format (no restated field list).
- [ ] `skills/work/SKILL.md`: the Subagent Prompt Template's `## Your task` block carries
      `Result file: <ABSOLUTE-PATH>`; Phase 4 step 6 replaces "Parse its strict return format"
      with: pre-spawn sidecar deletion, gather the three strings, call `selectResultSource`,
      the lost-result re-dispatch via `onLostResult` with its prepended paragraph and same-
      iteration rule, the never-hand-parse rule; the "Task verified and completed" and "Task
      completed (verification skipped)" entry shapes carry the `**Result source:**` line;
      "Salvaging a worktree's diff" names the `lost-result` tag; End-of-run reporting gains
      "Lost-result re-dispatches" and "Lost-result escalations" lines; "Reconciling stranded
      carry-over" gains the sidecar sweep step and its session-end count.
- [ ] The Verifier Prompt Template carries the `Result source:` line (informational; verifier
      behaviour unchanged) and `agents/verifier.md`'s inputs list names it; the parenthetical
      nine-field restatement in `agents/verifier.md` is deleted in favour of a pointer to
      `references/worker-return-format.md`.
- [ ] Enforcement (ADR-0059): `lib/worker-result-contract.mjs` + `lib/test/worker-result-contract.test.mjs`
      (stdlib-only, side-effect-free, loss-tolerant, in the shape of `lib/agent-spawn-namespace.mjs`)
      fail on the live tree if (a) the SUCCESS code block in `references/worker-return-format.md`
      does not list exactly `SUCCESS_FIELDS` in order; (b) that reference lacks the literal
      `RESULT_END`, `Result file:`, or `.worktrees/.results/`; (c) `agents/worker.md` or the
      Subagent Prompt Template in `skills/work/SKILL.md` lacks `Result file:`; (d) any `.md`
      under `agents/` or `skills/` other than the reference carries all nine field names on one
      line (a restated field list — the ADR-0068 second-drift guard).
- [ ] ADR-0080's `status:` is flipped from `proposed` to `accepted` (reported via the `ADRS`
      block's existing-ADR-amendment path, or noted in `OUTCOME` for the conductor to apply).
- [ ] `node --test lib/test/*.test.mjs` is green on the live tree after the change, excluding
      the two known pre-existing environmental flakes named in Notes.

## Notes

- **Incidents (three, two sessions):** infrastructure-r4mzp, 2026-09-12 ~16:20 — transcript
  `.output` empty, RESULT reconstructed from the HTML-escaped notification (entities unescaped,
  two stray `</ADRS>` / `</OUTCOME>` lines dropped); infrastructure-j3rsn iteration 1,
  2026-09-12 ~17:00 — transcript empty, notification top-truncated at the ````README_DELTA
  fence, headers rebuilt from worktree `git status --porcelain`; infrastructure-js62b
  iteration 1, 2026-09-12 ~17:46 — same shape as j3rsn. In every case the reconstructed
  `FILE_LIST` matched the Outcome's key-files list exactly, so no fidelity loss was observed —
  but nothing measured that, and nothing would have caught a mismatch.
- **Type call:** `bug`, not `spike` — the failure is reproducible and the remediation is
  known and cheap. Diagnosing *why* the harness drops the transcript or escapes/truncates the
  notification is out of scope; the contract is being made robust to a lossy channel it was
  designed assuming lossless.
- **Refinement (2026-09-12):** the capture's three open choices and an orchestrator critique
  (architect + tactical-modeler) are resolved in ADR-0080 — sidecar location with the three
  rejected alternatives, both-copies layout, single-pass unescape, structural fence
  boundaries, normalized header comparison, the separate lost-result budget, the session-end
  sweep instead of per-teardown deletion, and the evidence-gated deferral of reconstruction.
  Don't relitigate them in the worker; implement them.
- **For the worker and the verifier — known environmental flakes on the builder's machine,
  not regressions:** `lib/test/bridge.test.mjs` fails `EADDRINUSE` on :31425 while the real
  VS Code bridge is running, and `lib/test/foreign-launch.test.mjs` can fail `EPERM` in its
  `rmSync` teardown. Neither touches this task's files; report them as pre-existing.
- **ADR-0068 (drift-twice):** paste `references/worker-return-format.md`'s content into the
  spawn prompt as the template already instructs; restate nothing by hand. The lint's (d)
  predicate is what keeps the verifier's deleted parenthetical from creeping back.
- **Existing ladder tests:** `lib/test/merge-conflict-ladder.test.mjs` may deep-equal the
  state shape — extend those assertions for the new flag; that file is not under the
  "unchanged" rule (only `worker-result.test.mjs` is).
- **Why `.worktrees/.results/` and not beside the worktree directory:** `git worktree list
  --porcelain` enumerates worktree directories only and `git status --porcelain` never lists
  ignored `/.worktrees/` content, so a sidecar dropped beside its worktree is invisible to
  both halves of session-end reconciliation; a dedicated subfolder is enumerable with one
  `readdir` and gives the sweep a single place to look.
- **Prior art:** agentic-workflow-ghcaj (the report-carried contract and `parseWorkerResult`),
  agentic-workflow-q7v3k (guard the conductor's stage from the worker's self-reported
  `FILE_LIST`), agentic-workflow-r7dq3 (the post-ghcaj doctrine sweep across the same files
  this task edits).
- Related ADRs beyond the frontmatter cap: ADR-0038 (git-free lib, Ruling B), ADR-0057
  (checkpoint guard), ADR-0062 (runner-first — why rung 4 re-runs the suite rather than
  reconstructing `TESTS_PASSING`), ADR-0063 (salvage tag precedent), ADR-0068 (drift-twice).
