---
id: ADR-0080
title: Worker RESULT redundancy — a conductor-designated sidecar, a trailing header repeat behind `RESULT_END`, and a mechanized source ladder whose floor is a lost-result re-dispatch under its own one-shot budget
scope: agentic-workflow
status: accepted
date: 2026-09-12
related_tasks: [agentic-workflow-qwfq3]
related_adrs: [0032, 0038, 0059, 0062, 0063, 0068, 0072, 0074]
---

# ADR-0080: Worker RESULT redundancy — a conductor-designated sidecar, a trailing header repeat behind `RESULT_END`, and a mechanized source ladder whose floor is a lost-result re-dispatch under its own one-shot budget

## Context

Since agentic-workflow-ghcaj (ADR-0074) a worker's strict `RESULT` block is the **only**
channel through which its work reaches `main`: the nine one-line header fields feed the
ADR-0057 checkpoint guard and the verifier's gate; the four four-backtick-fenced blocks feed
every bookkeeping materialization the conductor performs at squash-merge integration. The
contract was designed assuming the channel is lossless.

It is not. On 2026-09-12, across two work sessions, the RESULT was lost on three of six
dispatches by two harness behaviours the project does not control:

- the Agent tool's per-subagent transcript `.output` file was **0 bytes**, leaving the
  harness's completion-notification text as the only surviving copy; and
- that notification copy is **HTML-entity-escaped** and, for a long RESULT, **truncated from
  the top** — twice it began at the ````README_DELTA fence, dropping every header line.

Each time the conductor recovered by hand — unescaping entities, dropping stray `</ADRS>`-style
lines, rebuilding `FILE_LIST` from the worktree's porcelain, composing `SUMMARY` and the counts
from the Outcome prose — and handed the verifier a RESULT it had partly authored. That is the
judgment-heavy, untested, unrecorded manual step ADR-0059 says must be mechanized or dropped,
and a reconstruction presented as a measurement is what ADR-0038 Ruling B forbids.

The root cause is the harness's, and diagnosing it is not this decision's target. What the
project controls is the return format, the parser (`lib/worker-result.mjs`), the conductor
prose (`skills/work/SKILL.md`), the iteration budget (`lib/merge-conflict-ladder.mjs`), and
the verifier's inputs. This ADR was written at refinement of agentic-workflow-qwfq3 (2026-09-12),
after an orchestrator critique (architect + tactical-modeler), because every load-bearing call
was made there and a task file's Notes section is archived out of reach once the task is done.

## Decision

### 1. The sidecar — one sanctioned worker write outside its worktree

The conductor's spawn prompt gains a `Result file:` field naming the absolute form of
`resultSidecarRelativePath(taskId, iteration)` = `.worktrees/.results/<task-id>.iter-<N>.md`
(`<N>` = the verification iteration the dispatch is judged at). The worker's final action, for
**every** RESULT kind, is to write its exact RESULT text there and then return the same text.

This narrows ADR-0032 §3's workspace confinement by exactly one path family. It does not touch
rule 10 (`.agentheim/` stays untouchable and the checkpoint guard still refuses every
`.agentheim/` path) — the sidecar is harness scratch, the same category as the worktree itself,
and never enters the worker's branch (so ADR-0074's "source and tests only" is unaffected).

Why `.worktrees/.results/` and not the alternatives:

- **Beside the worktree directory** (`.worktrees/<task-id>.result.md`) — invisible to both
  halves of session-end reconciliation: `git worktree list --porcelain` enumerates worktree
  *directories* only, and `git status --porcelain` never lists ignored `/.worktrees/` content.
  A sidecar outliving its worktree would accumulate silently, the exact failure "Reconciling
  stranded carry-over" exists to close.
- **The conductor's session scratchpad** — session-specific, so a stranded worktree found by a
  later session would have lost its last RESULT; and the scratchpad path is not exported to
  the Bash tool, so the worker would need it passed anyway.
- **A git-ignored path inside the worktree** — shows in porcelain and would need excluding from
  every path-gathering site.
- **`.agentheim/salvage/`** (ADR-0063's home for the conductor's salvage patch) — the sidecar's
  *author* is the worker, which rule 10 bars from `.agentheim/` entirely; ADR-0063 is precedent
  for a git-ignored recovery artifact, not for its location.

Lifecycle: the conductor deletes any file at the designated path **before** spawning (a stale
iteration-1 sidecar must never be read as iteration 2's RESULT — the `.iter-<N>` suffix is the
second guard). After the worker returns, the conductor records `sidecar: present | missing`
(present = exists at the exact path and its parsed `TASK_ID` matches) on the completion entry.
There is **no per-teardown deletion** — five teardown paths would be five places to miss one.
Instead one session-end sweep in "Reconciling stranded carry-over" deletes every
`.worktrees/.results/*.md` whose `<task-id>` has no live worktree and reports the count; a kept
(escalated) worktree keeps its sidecars because it is still listed.

### 2. The layout — both header copies, and a `RESULT_END` sentinel

On SUCCESS the worker repeats the header block **verbatim** — the `RESULT: SUCCESS` line plus
the nine fields — after the closing fence of the last fenced block, then ends with a line
reading exactly `RESULT_END`. BOUNCED and FAILED end with `RESULT_END` alone. Both copies are
kept: a top-truncation keeps the trailing headers, a bottom-truncation keeps the leading ones,
and the sentinel proves the tail is intact. The trailing copy includes the `RESULT:` line so a
self-describing tail never has to be guessed at.

Honest recovery window: the trailing copy rescues only a top-truncation landing at or before
the first opening fence. A cut inside a block loses that block; no rung short of re-dispatch
recovers it.

### 3. Parser grammar (`parseWorkerResult`)

- Fence boundaries come from `extractBlocks`'s own scan (it returns the index after the last
  closing fence it consumed) — never a raw re-scan for a four-backtick line. A top-level
  four-backtick line that is neither a well-formed opening fence (`^````[A-Z_]+\s*$`) nor the
  closing fence of an open block rejects `stray-fence`, never silently skipped.
- Leading region = lines before the first opening fence; trailing region = lines after the
  last closing fence. A header copy counts only when **complete** (`RESULT:` line plus every
  required field for that value); an incomplete fragment is discarded, never compared.
- The text's first non-blank line must be `RESULT:` or an opening fence — no preamble is
  tolerated; anything else is `missing-result-line`, exactly as before.
- Both copies present: values compared trimmed and whitespace-collapsed. A difference in a
  mechanically consumed field (`RESULT`, `TASK_ID`, `FILES_CHANGED`, `FILE_LIST`,
  `ADRS_WRITTEN`, `TESTS_ADDED`, `TESTS_PASSING`, `TDD_SKIPPED`) rejects `header-mismatch`
  naming the field; a difference in a prose field (`SUMMARY`, `CONCEPT_CANDIDATE`) is reported
  as `layout.softMismatch` and the leading copy wins.
- A trailing-only BOUNCED/FAILED copy with fenced blocks above it rejects `layout-conflict`.
- `RESULT` never lands in `fields`; every `ok:true` result carries
  `layout: {leadingHeader, trailingHeader, endSentinel, softMismatch}`.
- A `RESULT:` / `RESULT_END` line inside a fenced block is content — header detection runs only
  in the two regions above.
- Backward-compatible: a leading-only RESULT without `RESULT_END` parses to identical `fields`
  and `blocks`; the existing tolerance for extra fenced blocks after `BACKLOG_ITEMS` survives.

### 4. The source ladder — mechanized selection, never a prose choice

Two pure exports of `lib/worker-result.mjs`: `unescapeNotificationCopy(text)` (a single
left-to-right pass over `&lt; &gt; &amp; &quot; &#39;` and numeric entities — so `&amp;lt;`
becomes `&lt;`, never `<`, because the harness escapes the whole text exactly once — plus
dropping any line that is solely `</NAME>` for one of the four block names; plain text is
returned byte-identical), and `selectResultSource({taskId, sidecar, transcript, notification})`,
which tries the sidecar, then the transcript, then the unescaped notification; a candidate
counts only if it parses and its `TASK_ID` matches; it returns `{source, parsed, attempts}` or
`{code:'no-valid-source', attempts}`. The conductor gathers the three strings and calls it.

### 5. The floor — a lost-result re-dispatch under its own one-shot budget

`no-valid-source` → the worker is re-dispatched into the **same** worktree with a prepended
paragraph (its prior RESULT was lost in transit, the worktree already holds finished work,
re-run the suite, write the sidecar, return the RESULT). This reuses the same-worktree
re-dispatch path ADR-0072 established — with its budget discipline, and for its reason: a
transport loss is not evidence about the diff, so it must not consume a verifier-FAIL
iteration. Counting it against the cap-3 counter would escalate the healthiest tasks (one real
FAIL, one lost RESULT, one sibling conflict → escalation with nothing to suggest).

Mechanized in `lib/merge-conflict-ladder.mjs`: `createLadderState()` gains
`lostResultUsedThisWorktree`; `onLostResult(state)` returns `dispatch-lost-result` once per
worktree lifetime and `escalate` thereafter; it never touches `decideAfterVerifierVerdict`'s
iteration (the re-dispatch re-runs the same iteration number) nor `ladderUsedThisWorktree`;
`onWorktreeTeardown()` resets both. A second loss on the same worktree escalates **as its own
kind**: salvage patch tagged `lost-result`, worktree kept, `## Salvage note` appended, its own
End-of-run line — never folded into "Escalated after verification". Lost-result re-dispatches
are tallied on their own line so `PASS (iteration N)` and the dispatch tally keep their meaning
as a verifier-spend signal. A lost RESULT never tears the worktree down and is never
hand-parsed or hand-completed.

### 6. Observability

Every completion entry carries a measured `**Result source:** <sidecar|transcript|
notification|re-dispatch> · layout <leading/trailing/sentinel> · sidecar <present|missing>`
line (ADR-0038 Ruling B). This is also the compliance signal for §7.

### 7. Deferred behind evidence — mechanical reconstruction

The capture's third layer, `reconstructResultFromWorktree` (rebuild the headers from the
worktree's changed paths and the surviving blocks with explicit `reconstructed` provenance),
is **not** built now. It is fully specified in agentic-workflow-gwh69 and gated: promote only
once the protocol shows either a fired re-dispatch rung or two or more completions with
`sidecar missing` / no trailing header after this ships. The tradeoff is stated honestly there:
reconstruction preserves the worker's authored blocks but can only fabricate `TESTS_*` as
`unknown`; re-dispatch re-authors the blocks but measures the tests. §1 and §2 are
**correlated** defences (both are prose instructions to the same worker in the same prompt),
which is why §6 measures compliance on every task rather than waiting for a total loss.

## Mechanize-or-drop declaration (ADR-0059)

Mechanized with `node --test` coverage: the parser grammar (§3), `unescapeNotificationCopy` and
`selectResultSource` (§4), the lost-result one-shot (§5), the sidecar path builder (§1), and a
live-tree lint `lib/worker-result-contract.mjs` that fails if the reference's SUCCESS sample
drifts from `SUCCESS_FIELDS`, if the reference lacks `RESULT_END` / `Result file:` /
`.worktrees/.results/`, if `agents/worker.md` or the spawn template lacks `Result file:`, or if
any other `agents/` / `skills/` markdown restates all nine field names on one line.

Prose-only, unenforced: the conductor's pre-spawn sidecar deletion, the session-end sweep, the
prepended re-dispatch paragraph, and the `**Result source:**` line's presence on completion
entries. These are conductor choreography a lint cannot see; the observability line is the
audit trail.

## Amendments to prior ADRs

- **ADR-0032 §3** (worker runs in the worktree): the worker gains exactly one sanctioned write
  outside its worktree — the designated sidecar under `.worktrees/.results/`. Nothing else.
- **ADR-0074** (return format): the SUCCESS shape gains the trailing header repeat; every shape
  gains `RESULT_END`; the report-carried contract is otherwise unchanged.
- **ADR-0072 Budget**: a second, structurally separate one-shot-per-worktree budget joins the
  merge-conflict one, on the same state object and with the same reset point.
- **ADR-0068**: `agents/verifier.md`'s parenthetical nine-field restatement — already drifted
  once (agentic-workflow-f7k2d) — is deleted in favour of a pointer; the lint keeps it deleted.

## Consequences

- A lost transcript costs the conductor a `readFile` and a function call instead of a
  hand-recovery, and the verifier is never again handed a partly conductor-authored RESULT.
- The worker's prompt grows by one field and its RESULT by ten lines; workers under context
  pressure may skip either — measured per task, never assumed.
- `.worktrees/.results/` is a new ignored subfolder with one owner (the sweep).
- A second lost RESULT on one worktree is an escalation of a new kind the builder will see
  labelled as transport loss, not as a failing task.

## Alternatives considered

- **Reconstruct from the worktree now** (the capture's proposal) — deferred, §7.
- **Trailing copy only** — loses everything to a bottom-truncation and breaks every in-flight
  worker; rejected.
- **Count the lost-result re-dispatch as a FAIL iteration** — the category error ADR-0072
  already ruled out; rejected.
- **Per-teardown sidecar deletion** — five sites to keep in sync; replaced by one sweep.
- **Byte-exact header comparison** — false-positives on an honest retype with cosmetic
  whitespace drift; replaced by normalized comparison with a mechanical/prose split.

## References

- Incidents: protocol entries "Work session ended" 2026-09-12 16:20 and 18:07.
- agentic-workflow-qwfq3 (implements §1–§6), agentic-workflow-gwh69 (§7, gated).
- `lib/worker-result.mjs`, `lib/merge-conflict-ladder.mjs`, `references/worker-return-format.md`,
  `agents/worker.md`, `agents/verifier.md`, `skills/work/SKILL.md`.
