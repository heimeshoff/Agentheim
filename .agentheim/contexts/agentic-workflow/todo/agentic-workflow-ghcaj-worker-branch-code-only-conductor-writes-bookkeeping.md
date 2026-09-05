---
id: agentic-workflow-ghcaj
title: Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report
status: todo
type: refactor
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-pcwnn]
blocks: []
tags: [captured, worktree, merge-back, mechanization, rework, bookkeeping]
related_adrs: [0032, 0037, 0057, 0058, 0026, 0038, 0063, 0059, 0041, 0042, 0061]
related_research: []
prior_art: [agentic-workflow-f6m2q, agentic-workflow-t7m4c, agentic-workflow-k9t3w, agentic-workflow-w2njd, agentic-workflow-q7v3k, agentic-workflow-hmgav]
---

## Why

Parallel worktree batches conflict at merge-back far more often than the builder expects,
and the protocol record shows the conflicts are **never code** — git's 3-way merge has
reconciled every parallel code edit cleanly since ADR-0032 landed. Every real merge-back
conflict has been a `.agentheim/` prose artifact or a derived build artifact:

- the BC `README.md` — two same-BC workers rewrite the same bullet, or an additive entry
  collides with a wholesale rewrite (w7q2m vs t7m4c/q3n7k, 2026-07-03);
- an ADR amendment appended by two workers at the same anchor (tkq7v vs spv0k, 2026-07-13);
- `dashboard/dist/app.js` — since made unstageable by ADR-0057;
- the task file's own `doing → done` move, which the worker still performs inside its worktree.

In a single-core-BC project like this one, *almost every task* touches the same README, so
the conductor keeps holding ready tasks "to the next wave" on the Phase 3 advisory, and the
parallelism ADR-0032 was meant to unlock is throttled by prose, not by code.

The builder's framing: **orchestration and ticket wrangling belong on `main`; the worker's
worktree exists only for the implementation.** The conductor already writes INDEX/protocol on
`main` (ADR-0032/0038); this task moves the *remaining* `.agentheim/` writes — README delta,
ADR files, the task-file move and its `## Outcome`, follow-up backlog items — out of the
worker's branch and onto `main` too.

## What

Shrink what a worker's private branch may contain to **source and tests only**. The worker
never writes under `.agentheim/` — not its README, not an ADR, not its own task file, not a
backlog item. Everything it would have written travels in its strict `RESULT` block as
structured blocks, and the conductor materializes all of it on `main`, sequentially, after
the code squash-merges, inside the one integrating commit ADR-0026 requires. This is the
**report-carried** design (the orchestrator round rejected the alternative of leaving the
files in the worktree unstaged and re-applying them at integration: that merely relocates
the textual merge, and under ADR-0038's git-free `lib/` boundary there is no 3-way machinery
to relocate it to). It is also the port-shaped answer for the planned rework: a remote
TaskStore has no files a worker could edit — it must report.

### 1. Worker return format grows four structured blocks

`references/worker-return-format.md` (the single source, restated nowhere) gains, on
`RESULT: SUCCESS`, four multi-line fenced blocks after the existing one-line fields:

- **`README_DELTA`** — a list of documents, each `{document, section, ops}`. `document` is
  the BC README (default) or `context-map.md` (append-only; a worker contradicting an existing
  cross-context relationship is a strategic-modeling call, not a worker's). Ops are the two in
  §2. Empty list when the task changed no ubiquitous language, aggregate, event, command, or
  invariant.
- **`ADRS`** — full ADR bodies, one per decision, each with its provisional filename per
  ADR-0058 (`NNNN-<slug>.md`). The worker may still call `nextAdrNumber(decisionsDir)`
  **read-only** against its worktree's mirrored `decisions/` to pick the `id:` text it writes
  into the body; the number stays provisional and the conductor finalizes it (§3).
- **`OUTCOME`** — the `## Outcome` section text for the task file (description + pointers to
  key files), replacing the worker's own edit of that file.
- **`BACKLOG_ITEMS`** — **full task-file bodies** (frontmatter + sections, ids minted per the
  id grammar) for follow-ups discovered mid-work; replaces today's id-only `NEW_BACKLOG_ITEMS`,
  which was sufficient only because the worker wrote the files itself.

`BC_README_UPDATED: yes|no` is retired — a non-empty `README_DELTA` is the signal. `FILE_LIST`
carries source and tests only. `BOUNCED` and `FAILED` are unchanged in shape.

**Parsing is mechanized** — a new git-free `lib/worker-result.mjs` (`parseWorkerResult(text)
→ {result, fields, blocks}` or a structured rejection naming the malformed block) replaces
conductor-prose parsing for the SUCCESS block. This is a deliberate mechanize-or-drop call
(ADR-0059): the one-line fields were safely parsed by prose; multi-line blocks carrying ADR
bodies and README bullets with their own nested fences are not.

### 2. README delta grammar — two ops, one invariant, applied by a pure helper

A new git-free `lib/readme-delta.mjs` exports `applyReadmeDelta(content, {section, ops}) →
{content, dispositions}` (ADR-0038 layer 2; ADR-0054 compute-then-write — the conductor
writes the returned content once, never edits in place).

- **Bullet extent** is explicit: a col-0 `- ` up to the next col-0 `- `, header, marker, or
  EOF (README entries run 5–30 lines; the extent rule is what makes `replace` well-defined).
- **Anchor** is `(section, termHead)` where `termHead` is the bullet's bold lead-in up to its
  first `(`, whitespace-collapsed. Bold lead-ins are **not unique across sections** in the real
  README (`**Vision**`, `**Bounded context (modeled)**` each appear twice), so the section is
  part of the key.
- **`append`** — `{op: 'append', body}`: a new bullet at the end of the section's bullet list.
- **`replace`** — `{op: 'replace', anchor, body, expected}`: `anchor` is a field separate from
  `body` (so a bullet may rename its own lead-in); `expected` is the old bullet text the worker
  read, compared whitespace-collapsed, never byte-exact (an optimistic precondition, the same
  idea as `applyTaskMove`'s mtime check).
- **No `remove`, no `rename-section`, no section creation.** Deletion and restructuring are
  CONSOLIDATE's job (ADR-0041); the invariant this grammar preserves is ADR-0041's own — *delta
  application is monotone in the set of terms and invariants; only CONSOLIDATE, builder in the
  loop, may reduce it.* A delta naming a section that does not exist lands as an `append` in
  `## Ubiquitous language` with disposition `appended-fallback` — never a silently created
  section, never a refusal that strands already-merged code without its README entry.
- **Per-op disposition**, returned to the caller: `applied` | `merged` | `appended-fallback` |
  `noop-already` (the bullet already reads as the incoming body — a re-dispatched worker
  re-reporting the same delta).
- **Collision rule** (`replace` whose anchor is gone or whose `expected` no longer matches the
  current bullet — a sibling integrated earlier this batch, the conductor's own earlier write,
  or a concurrent `modeling` session): the conductor — the sole `main` writer and already the
  judgment layer — merges the incoming body onto the current one so **both intents survive**
  (pcwnn's authority rule: never undo the other change, re-express your own on top), records
  disposition `merged`, and writes a `**README delta:**` line in the completion protocol entry
  quoting the anchor and the *observed* current text — never attributing the mismatch to a
  "sibling", which is only one of three possible causes. No worker re-dispatch, no builder
  escalation for a one-bullet prose merge. ADR-0032's "no merge is ever auto-guessed" is
  intact: it guards against a machine discarding one side of a git conflict, and here there is
  no git conflict and nothing is discarded. The disposition also travels to the verifier (§4)
  so the merge is never silent.
- **Prerequisite normalization**: `## Key events` and `## Key commands` in the agentic-workflow
  README are not bullet lists today — this task normalizes them to bullets so every delta
  target section has the same shape. `## Runtime surface` (a YAML fence, ADR-0036) is **out of
  scope** for deltas; a task that must change it bounces as under-refined.

### 3. Checkpoint refuses `.agentheim/`; the conductor materializes on `main`

- **Checkpoint guard**: `partitionCheckpointFiles` gains a second frozen prefix list —
  `.agentheim/` — refused with reason `bookkeeping-path` (distinct from `derived-artifact`),
  tested with absolute OS-native paths as ADR-0057 insists. A worker that still writes under
  `.agentheim/` in its worktree is inert, not failed — the same posture as `dashboard/dist/`.
  `checkpointFiles`'s moved-from-`doing/` detection (w2njd) becomes dead for the worker path
  (no task file ever moves in a worktree again); keep it with a doctrine note, remove in a
  follow-up.
- **Integration on `main`, PASS/SKIP**, after `git merge --squash aw/<id>` stages the code and
  before the one `git add`/commit, in this order: (a) `applyReadmeDelta` per document; (b)
  write each `ADRS` body to `decisions/<provisional-filename>`, then `finalizeAdrNumbering`
  (ADR-0058, **unchanged** — it has no opinion about who wrote the provisional file or when);
  (c) append `OUTCOME` as `## Outcome` to the task file; (d) `complete <id>` — `completeTask`'s
  non-idempotent branch now performs the real `doing → done` move on `main`; (e) write each
  `BACKLOG_ITEMS` body via a new git-free helper `materializeTaskFile(rootDir, body)` (nothing
  in `lib/task-lifecycle.mjs` writes a *new* task file today) and insert its INDEX line; (f)
  INDEX ADR insert + backlinks as today. The `complete` manifest's `changed` plus every path
  (a)–(f) wrote is the scoped `git add`. One commit, ADR-0026 shape.
- **Task-file annotations mid-batch** — `## Verifier note (iteration N)`, `## Salvage note`,
  pcwnn's `## Merge-conflict note` — are conductor-written into **`main`'s copy** of the task
  file, uncommitted between iterations (the posture today's "Verification failed" protocol
  entry already takes), committed by the integrating or escalation commit. The worker and the
  verifier are handed the task file's absolute path **on `main`** — reading never needed
  worktree isolation, only writing did, and the worker no longer writes it. There is exactly
  one copy, so verifier check 1b (ADR-0061) keeps working unmodified. The worktree's
  `.agentheim/` is never touched by anyone.
- **BOUNCE** no longer squash-merges: the worker returns `REASON` only; the conductor moves
  `doing → backlog` on `main`, appends `## Worker note`, salvages the (code-only) diff, and
  tears down. pcwnn's rung 4 `done → doing` revert inside the worktree becomes vestigial for
  the same reason — note it there.
- **Phase 3 advisory** loses its same-BC-README annotation entirely. `MAX_PARALLEL` default
  stays 3 — its rationale in `skills/work/SKILL.md` is verifier review load, not merge risk;
  raising it is a separate, evidence-gated builder decision and the ADR says so explicitly.

### 4. Verifier

The verifier receives the parsed `README_DELTA` (with the conductor's dispositions when
re-verifying after a merge), `ADRS`, and `OUTCOME` blocks alongside the code diff. Check 5
("confirm the README diff contains the relevant changes") has no README diff to read anymore
and is rewritten to judge `README_DELTA` directly against the diff's new aggregate / event /
command / invariant. Check 7 FAILs on any `.agentheim/` path in the code diff. Check 6c's
scope gate (doctrine-bearing paths in the diff) also fires when `ADRS` or `README_DELTA` is
non-empty — a pure-decision, zero-code convention change can never trip the path gate. The
decision-task auto-SKIP becomes `type: decision` AND `FILES_CHANGED == 0` AND `ADRS` has
exactly one entry.

### 5. Salvage

The ADR-0063 patch is code-only now. When a SUCCESS-then-escalation (or a later discard)
abandons a worktree whose worker had returned structured blocks, the conductor also writes
those blocks verbatim to `.agentheim/salvage/<id>-<tag>.bookkeeping.md` via a new
`bookkeepingSalvagePath(salvageRoot, taskId, tag)` in `lib/worktree-salvage.mjs` (its own
function — `salvagePatchPath` hardcodes `.patch`), named in the same `## Salvage note`.

## Acceptance criteria

Fixture-testable (`node --test`, `lib/test/`; tmpdir fixtures via `fs.mkdtempSync`, never
the live tree):

- [ ] **Checkpoint refuses bookkeeping paths.** `partitionCheckpointFiles(worktreeRoot, fileList)` refuses every absolute OS-native path under `<worktreeRoot>/.agentheim/` with reason `bookkeeping-path`, keeps refusing `dashboard/dist/` as `derived-artifact`, and passes source/test paths; `.agentheim-notes.md` at the root is not refused (segment-boundary match).
- [ ] **Delta grammar.** `applyReadmeDelta`: `append` lands at the end of the named section's bullet list; `replace` matches on `(section, termHead)` with the bold lead-in truncated at its first `(` and whitespace-collapsed, and replaces the whole bullet extent (multi-line bullets); a same-`termHead` bullet in another section is never touched; a missing section yields `appended-fallback` into `## Ubiquitous language`; a re-applied identical delta yields `noop-already`; `expected` compares whitespace-collapsed.
- [ ] **Both intents survive.** Two deltas from two workers against the same base — both `replace` the same bullet, both `append` to the same section, both add an ADR with the same provisional number — applied sequentially on one `main` fixture leave a README containing both contributions (second `replace` reports `merged`, its `expected` mismatch surfaced), two ADRs with contiguous final numbers, zero git conflict markers, and the code squash-merges cleanly (throwaway-repo fixture, the pcwnn bounded git-fact exception).
- [ ] **Return-format parser.** `parseWorkerResult` parses a SUCCESS block with all four fenced blocks (including an ADR body that itself contains a fenced code block), an empty `README_DELTA`, and each of `BOUNCED` / `FAILED`; a malformed or truncated block returns a structured rejection naming the block, never a partial success.
- [ ] **Materialize a task file.** `materializeTaskFile(rootDir, body)` writes `contexts/<bc>/backlog/<id>-<slug>.md` from a body whose frontmatter passes `classifyTaskId`, refuses an id already on disk in any lifecycle folder, and returns `{changed}` for the scoped add.
- [ ] **Salvage sibling.** `bookkeepingSalvagePath(root, id, tag)` yields `<root>/<id>-<tag>.bookkeeping.md`, distinct from `salvagePatchPath` for the same `(id, tag)`.
- [ ] **Integration commit shape.** A fixture driving squash-merge → `applyReadmeDelta` → ADR write + `finalizeAdrNumbering` → `OUTCOME` append → `complete` → `materializeTaskFile` yields ONE commit whose tree holds code + README + ADR(s) + `done/<task>` (with `## Outcome`, no `doing/` duplicate) + new backlog file + INDEX + protocol, and the worker branch's own tree has no change under `.agentheim/`.

Prose (`agents/worker.md`, `skills/work/SKILL.md`, `agents/verifier.md`,
`skills/verification-before-completion/SKILL.md`, `references/worker-return-format.md`, the
agentic-workflow README git-model entry, one ADR) — the conductor's **sequencing** is
prose-only, unenforced per ADR-0059 (the ADR-0063 precedent); the helpers above pin every
fact the sequence rests on:

- [ ] `agents/worker.md` actions 4–6 and the Subagent Prompt Template's Rules 4, 6, 7, 8 say: never write under `.agentheim/`; report `README_DELTA` / `ADRS` / `OUTCOME` / `BACKLOG_ITEMS`; the task file path handed to you is on `main` and is read-only; `nextAdrNumber` is read-only provisional minting.
- [ ] `skills/work/SKILL.md` "PASS / SKIP" lists the integration order §3(a)–(f) with the scoped `git add` set; "BOUNCE integration" drops the squash-merge; "Handling the verdict" writes annotations to `main`'s task file; Phase 3 loses the same-BC-README annotation; the `NEW_BACKLOG_ITEMS` INDEX step becomes materialize + insert; a `**README delta:**` protocol line is specified for `merged` / `appended-fallback` dispositions quoting the observed text; the completion entry gains an advisory `**README length:**` line when the README exceeds the ADR-0041 threshold after a delta (advisory only, never gates — the README is already at 1272 lines and accretion needs a visible valve).
- [ ] The Verifier Prompt Template carries the parsed blocks; `agents/verifier.md` check 5 judges `README_DELTA` against the diff, check 7 fails on `.agentheim/` diff paths, check 6c's scope gate fires on non-empty `ADRS`/`README_DELTA`, and the auto-SKIP rule reads `FILES_CHANGED == 0` AND one `ADRS` entry.
- [ ] `## Key events` / `## Key commands` in the agentic-workflow README are bullet lists; the README git-model entry states the code-only branch, the delta grammar's monotone invariant, the on-`main` annotation rule, and that `main` now has exactly one writer per `.agentheim/` file on the work side (the pt0gy sibling covers the modeling side).
- [ ] One new ADR (title below) amends ADR-0032 choreography steps 3, 4, and 6, records the report-carried choice over worktree-carried, the two-op grammar and its monotone invariant, the conductor-merges-prose rule and why ADR-0032's no-auto-guess clause is intact, the on-`main` annotation rule, the retired `BC_README_UPDATED` field, the un-bundling of `MAX_PARALLEL` from the Phase 3 change, the dead moved-from-`doing/` detection, and the mechanize-or-drop declaration (helpers mechanized, sequencing prose-only); backlinked to ADR-0032, ADR-0057, ADR-0058, ADR-0063, ADR-0041, and pcwnn's ADR.

## Notes

Captured via `modeling` on 2026-09-05 from the builder's complaint that parallel worktrees
conflict "very often". Evidence gathered at capture: protocol entries 2026-07-03 15:32
(w7q2m README conflict, resolved by hand), 2026-07-13 10:45 §(1)–(2) (ADR-0050 amendment +
README bullet + dist bundle conflict), and the recurring "held to next wave — same BC README"
lines in batch-start entries across June/July.

**Refined 2026-09-06** (orchestrator round: architect on the choreography, return-format,
verifier, salvage, sequencing, and enforcement; tactical-modeler on the delta grammar against
the real README). All seven decisions resolved, amendments folded in above. Open questions
from capture, resolved:

- *Shape of `README_DELTA`* → two ops with a `(section, termHead)` anchor and a monotone
  invariant; append-only + CONSOLIDATE was too weak (workers legitimately amend existing
  bullets — rw6ck, pcwnn both do), full free-form replace too strong (re-opens same-target
  collisions with no structure); the optimistic `expected` precondition plus the conductor's
  both-intents-survive merge is the middle.
- *`type: decision` tasks* → the ADR body travels in `ADRS`; auto-SKIP rewritten (§4).
- *ADR-0058 interaction* → `finalizeAdrNumbering` unchanged; the conductor writes the
  provisional file first, then finalizes — same function, same input shape.
- *Rework ports* → this is the seam: the worker reports, the conductor writes; a remote
  TaskStore / DecisionStore implements §3(a)–(f) with no worktree at all. The return-format
  blocks are designed once here.
- *Sibling `pcwnn`* → **now `depends_on`**. Logically independent, but pcwnn (in `doing/` since
  2026-09-05 23:30) rewrites "Merge-back conflicts", the Verifier Prompt Template, `worker.md`,
  the README git-model entry, and `lib/worktree-salvage.mjs` — every file this task edits.
  Dispatching both in one batch would manufacture exactly the prose conflict this task exists
  to remove. Once ghcaj lands, pcwnn's ladder allow-list is code-only by construction, and its
  rung-4 `done → doing` revert is vestigial. pcwnn's own `blocks:` backlink is deliberately
  not written here — its `doing/` file is mid-squash in a live worktree and editing `main`'s
  copy would risk the same rename+modify collision; the conductor or the next refine adds it.

**Worker note for whoever executes this task:** you run under the *pre-ghcaj* choreography —
edit the README, write the ADR, and move your task file in your worktree exactly as
`agents/worker.md` says today. The new rules take effect for the *next* batch after you land.

**Sizing.** Larger than pcwnn: five small pure helpers (`lib/readme-delta.mjs`,
`lib/worker-result.mjs`, `materializeTaskFile` in `lib/task-lifecycle.mjs`, the guard prefix,
the salvage path), one tmpdir git fixture, four prose surfaces, one ADR. Not split: the
helpers are meaningless without the choreography and the choreography is unverifiable without
the helpers. Suggested ADR title: *Worker branch carries source and tests only — the conductor
materializes README delta / ADR / task-move / backlog-item bookkeeping on `main` at
squash-merge integration (amends ADR-0032 §3, §4, §6)*.
