---
id: agentic-workflow-qwfq3
title: Worker RESULT survives a lost transcript — the worker also writes its RESULT to a conductor-designated sidecar file, repeats the header fields after the four blocks, and lib/worker-result.mjs gains a mechanized unescape-and-reconstruct fallback so the conductor never hand-rebuilds FILE_LIST from a truncated notification
status: backlog
type: bug
context: agentic-workflow
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [captured, worker-contract, worker-result, mechanization, work-skill, transcript-loss, harness]
related_adrs: [0074, 0059, 0038, 0057, 0032]
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
the project's control and is **not** this task's target — ADR-0065 prefers a known-cheap
remediation over further diagnosis. What IS under the project's control: the worker's return
format, the conductor prose in `skills/work/SKILL.md`, the parser in `lib/worker-result.mjs`,
and the verifier's inputs.

## What

Make the RESULT contract robust to loss of its primary copy, in three layers, all inside
`agentic-workflow`:

1. **A belt-and-braces sidecar copy the worker writes.** The conductor's spawn prompt gains a
   `Result file:` field naming an absolute path the worker writes its byte-identical RESULT
   text to (via the Write tool) as its final action before returning it. Proposed location:
   `<repo-root>/.worktrees/<task-id>.result.md` — outside the worktree but inside the already
   git-ignored `.worktrees/` directory, so it never appears in the worktree's `git status`,
   never reaches the checkpoint guard, and is deleted with the worktree at teardown. This does
   not weaken the worker's "never write under `.agentheim/`" rule (ADR-0074): the sidecar is
   harness scratch, like the worktree itself.

2. **A truncation-tolerant layout.** The worker repeats the nine header fields **after** the
   `BACKLOG_ITEMS` block (a trailing header repeat, terminated by a `RESULT_END` sentinel line),
   so a top-truncated copy still carries every header. `parseWorkerResult` accepts the header
   block in either or both positions and rejects `header-mismatch` when both are present and
   disagree. (Today's `extractBlocks` already skips non-fence lines after the last block, so
   the trailing repeat is backward-compatible with the current parser.)

3. **A mechanized, tested fallback ladder in `lib/worker-result.mjs`** the conductor runs
   instead of hand-recovering: `unescapeNotificationCopy(text)` (entity decode + stray
   closing-tag line drop) and `reconstructResultFromWorktree({partialText, changedPaths,
   worktreeRoot, taskId})` (rebuild the missing headers from the conductor-supplied changed
   path list and the surviving `OUTCOME` / `ADRS` blocks, marking every rebuilt field with
   explicit `reconstructed` provenance and never fabricating `TESTS_PASSING`). The module stays
   stdlib-free, git-free and side-effect-free — the conductor gathers the path list with git and
   passes it in.

The conductor's order of preference becomes: sidecar file → transcript `.output` →
unescaped notification copy → reconstruct from worktree; whichever source actually produced
the parsed RESULT is recorded as a measured `**Result source:**` line on the task's completion
protocol entry (ADR-0038 Ruling B — never a fabricated "parsed cleanly"). The verifier is handed
only a `parseWorkerResult`-valid RESULT plus the list of reconstructed fields; a RESULT that
still fails to parse after the whole ladder is a `FAILED` dispatch, never a hand-parse.

## Acceptance criteria

- [ ] `parseWorkerResult` accepts a SUCCESS text whose nine header fields appear after the
      `BACKLOG_ITEMS` block (trailing repeat, followed by a `RESULT_END` line) as well as
      before the blocks; when both copies are present and any field differs it returns
      `{ok:false, code:'header-mismatch', field}`. `lib/test/worker-result.test.mjs` covers
      leading-only, trailing-only, both-equal, and mismatch, and every pre-existing test in
      that file still passes unchanged.
- [ ] `lib/worker-result.mjs` exports `unescapeNotificationCopy(text)`: decodes `&lt;`
      `&gt;` `&amp;` `&quot;` `&#39;` and numeric entities in one pass, drops stray lines that
      are solely a closing tag of a block name (`</ADRS>`, `</OUTCOME>`), and is a no-op on
      already-plain text. Tests: an escaped fixture shaped like the 2026-09-12 16:20 incident
      round-trips to a `parseWorkerResult`-valid text; a plain RESULT is returned byte-identical.
- [ ] `lib/worker-result.mjs` exports `reconstructResultFromWorktree({partialText,
      changedPaths, worktreeRoot, taskId})`: given a top-truncated text whose first non-blank
      line is a ````-fence and a conductor-gathered list of worktree-relative changed paths
      (from `git status --porcelain` UNION `git diff --name-only <fork-point>...HEAD`, because a
      wip-checkpointed iteration leaves porcelain empty), it returns `{ok:true, text, fields,
      reconstructed:[...]}` where `FILE_LIST` is the absolute paths of every changed path that
      `partitionCheckpointFiles` would stage (derived artifacts and `.agentheim/` paths
      excluded), `FILES_CHANGED` is that count, `TASK_ID` is `taskId`, `ADRS_WRITTEN` is derived
      from the `ADRS` block's `<!-- ADR: -->` markers, `SUMMARY` is the first sentence of the
      `OUTCOME` body, `TESTS_ADDED` / `TESTS_PASSING` / `TDD_SKIPPED` are `unknown` (never
      guessed), and `text` parses cleanly through `parseWorkerResult`. Rejects `not-truncated`
      when the input already has a `RESULT:` line. Tests use a fixture built from the
      infrastructure-js62b iteration-1 shape. The module remains stdlib-free, git-free and
      side-effect-free (ADR-0038).
- [ ] `references/worker-return-format.md` and `agents/worker.md` document the `Result file:`
      spawn field, the worker's write-then-return final action, the trailing header repeat and
      the `RESULT_END` sentinel; `skills/work/SKILL.md`'s Subagent Prompt Template carries the
      `Result file:` line, and its Phase 4 step 6 replaces "Parse its strict return format"
      with the four-rung source ladder above, the measured `**Result source:**` completion-entry
      line, and the rule that a RESULT still unparseable after the ladder is a `FAILED` dispatch.
      Worktree teardown (PASS/SKIP step 10, BOUNCE, FAILED, salvage paths) deletes the sidecar.
- [ ] `agents/verifier.md` and the Verifier Prompt Template state that the verifier receives
      only a `parseWorkerResult`-valid RESULT plus the `reconstructed` field list, and that a
      non-empty `reconstructed` list (or `TESTS_PASSING: unknown`) makes the runner-first suite
      run mandatory regardless of `TESTS_ADDED` (ADR-0062).
- [ ] Enforcement (ADR-0059): a live-tree `node --test` lint in `lib/` (its own module plus
      test, in the pattern of `lib/agent-spawn-namespace.mjs`) fails if `SUCCESS_FIELDS` in
      `lib/worker-result.mjs` differs from the field list stated in
      `references/worker-return-format.md`, or if any of `references/worker-return-format.md`,
      `agents/worker.md`, or `skills/work/SKILL.md`'s Subagent Prompt Template omits the
      `Result file:` field or the `RESULT_END` sentinel — closing the return-format restatement
      drift class (agentic-workflow-f7k2d) mechanically.
- [ ] `node --test lib/test/*.test.mjs` is green on the live tree after the change.

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
  already known and cheap (ADR-0065 remediation-over-diagnosis). Diagnosing *why* the harness
  drops the transcript or escapes/truncates the notification is out of scope; the contract is
  being made robust to a lossy channel it was designed assuming lossless.
- **Open design choices for REFINE:** (1) sidecar location — `.worktrees/<id>.result.md`
  (proposed; already git-ignored, outside the worktree, torn down with it) versus the
  conductor's session scratchpad (session-specific, but the worker would need the absolute
  path passed anyway) versus a git-ignored path *inside* the worktree (simplest for the worker
  but then it shows in porcelain and must be excluded from reconstruction); (2) replace the
  leading headers with the trailing ones outright, or keep both (proposed: both — a
  bottom-truncated copy then still has the leading ones); (3) whether `unescapeNotificationCopy`
  can ever double-decode a legitimately escaped `&amp;amp;` inside an ADR body — the harness
  escapes the whole text once, so a single pass is exact, but a test should pin that.
- **ADR-0068 (drift-twice):** the return format was already found drifted once
  (agentic-workflow-f7k2d, archived under `done-archive/2026-07.md`). Restate nothing in
  `skills/work/SKILL.md`'s template by hand — paste `references/worker-return-format.md`'s
  content as it already instructs, and let the new lint be the guard.
- **Parser tolerance already relied on:** the r4mzp worker returned two extra fenced blocks
  after `BACKLOG_ITEMS` (an existing-ADR addendum and another task's Notes) and the parser
  tolerated them; the trailing header repeat must not break that tolerance.
- **Prior art:** agentic-workflow-ghcaj (the report-carried contract and `parseWorkerResult`),
  agentic-workflow-q7v3k (guard the conductor's stage from the worker's self-reported
  `FILE_LIST` — the same `partitionCheckpointFiles` the reconstruction must feed through),
  agentic-workflow-r7dq3 (the post-ghcaj doctrine sweep across the same four files this task
  edits). ADR-0063's salvage patch under `.agentheim/salvage/` is the closest precedent for a
  conductor-side, git-ignored recovery artifact.
- Related ADRs beyond the frontmatter cap: ADR-0062 (runner-first — why `TESTS_PASSING` is
  never reconstructed), ADR-0065 (remediation over diagnosis), ADR-0068 (drift-twice).
