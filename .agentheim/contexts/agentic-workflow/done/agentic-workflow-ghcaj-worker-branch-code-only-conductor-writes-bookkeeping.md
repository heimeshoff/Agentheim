---
id: agentic-workflow-ghcaj
title: Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report
status: done
type: refactor
context: agentic-workflow
created: 2026-09-05
completed: 2026-09-06
depends_on: [agentic-workflow-pcwnn]
blocks: []
tags: [captured, worktree, merge-back, mechanization, rework, bookkeeping]
related_adrs: [0032, 0037, 0057, 0058, 0026, 0038, 0063, 0059, 0041, 0042, 0061, 0072, 0074]
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
- [ ] One new ADR (title below) amends ADR-0032 choreography steps 3, 4, and 6, records the report-carried choice over worktree-carried, the two-op grammar and its monotone invariant, the conductor-merges-prose rule and why ADR-0032's no-auto-guess clause is intact, the on-`main` annotation rule, the retired `BC_README_UPDATED` field, the un-bundling of `MAX_PARALLEL` from the Phase 3 change, the dead moved-from-`doing/` detection, and the mechanize-or-drop declaration (helpers mechanized, sequencing prose-only); backlinked to ADR-0032, ADR-0057, ADR-0058, ADR-0063, ADR-0041, and ADR-0072 (pcwnn's ladder).

### Doctrine-consistency sweep — bounded surface list (refined 2026-09-06 after five verification FAILs)

The five prose criteria above name what each surface must *say*. Verification iterations 1–5 all
FAILed on a different reading: that every surface must also contain *no residual pre-ghcaj
statement* — and each verifier drew that sweep's boundary wider than the last (`skills/work` →
`agents/worker` → the README's `lib/` inventory → `references/commit-doctrine.md` and `lib/` code
comments). This criterion fixes the boundary so the loop converges. It is prose-only, unenforced
(ADR-0059): a phrase lint over 1,300 README lines would be brittle, so the list itself is the
mechanism.

**The check.** A surface is consistent when it contains no present-tense statement that (a) the
worker moves its own task file (`doing → done`, `doing → backlog`) or edits it (`## Outcome`,
`## Worker note`, Notes); (b) the worker writes a README bullet, an ADR file, or a backlog file
inside its worktree; (c) the squash-merge carries a task file or an ADR file onto `main`, or
`complete` is idempotent *because* the worktree already moved the file; (d) the task-file, README,
or BC-index path handed to a worker or verifier is a worktree copy; (e) `BC_README_UPDATED` /
`NEW_BACKLOG_ITEMS` are live fields. A statement explicitly marked vestigial, post-ghcaj,
amended-by-ghcaj, or retired, or one describing the conductor doing these things on `main`, is
consistent.

**The surfaces — this list is exhaustive; the verifier reads each in full and checks nothing else:**

- [ ] `agents/worker.md`
- [ ] `agents/verifier.md`
- [ ] `skills/work/SKILL.md`
- [ ] `skills/verification-before-completion/SKILL.md`
- [ ] `skills/modeling/SKILL.md` — the task-file field legend only (the `completed` line)
- [ ] `references/worker-return-format.md`
- [ ] `references/commit-doctrine.md`
- [ ] `.agentheim/contexts/agentic-workflow/README.md` — these `## Ubiquitous language` bullets only, by lead-in: **Per-worker git worktree isolation (ADR-0032 …)**, **Worker branch carries source and tests only …**, **Worktree-abandonment diff salvage (ADR-0063 …)**, **Merge-back conflict ladder (ADR-0072 …)**, **Derived-artifact checkpoint guard (ADR-0057 …)**, **`claimBatch` / `completeTask`**, **`lib/adr-allocation.mjs`**; plus the `## Key events` and `## Key commands` sections
- [ ] Doctrine comments in `lib/task-lifecycle.mjs` (the `completeTask` block), `lib/task-lifecycle-cli.mjs` (`MOVED_FROM_DOING_FOLDERS`, `findMovedFromDoingPath`, `checkpointFiles`), and `lib/derived-artifact-guard.mjs` (the guard's header comment)
- [ ] The task's own ADR

**Out of scope, by decision, not omission:** every other file — in particular prior ADRs
0001–0072 (accepted history; the new ADR amends them), `done/` and `done-archive/` task files,
`evals/**` fixtures and dated eval records under `.agentheim/knowledge/`, `protocol.md`, every
`INDEX.md`, the repo-root `README.md`, `CLAUDE.md`, `docs/`, `dashboard/**`, and test titles.

**Closure rule.** A residual statement found *outside* the list is not a FAIL for this task: the
verifier names it in its verdict, and the conductor captures it as a follow-up backlog item. Only a
residual statement *inside* the list fails the task.

**Known open items at refinement time (iteration-5 verifier), all inside the list:** the README's
**Derived-artifact checkpoint guard (ADR-0057 …)** bullet (`FILE_LIST` "only ever names the task
file's NEW lifecycle location"; refusals "today: `dashboard/dist/` only"); `references/commit-doctrine.md`
line 16 (README/ADRs attributed to the worker's staging); the three checkpoint comment blocks in
`lib/task-lifecycle-cli.mjs`.

## Notes

- *Refinement 2026-09-06 01:55 (escalation re-route, task stays in `doing/`).* Five verification
  FAILs (iterations 1–3 in the 22:57 session, 4–5 in the 01:15 resume), all on residual pre-ghcaj
  prose, none on code/tests/ADR. The bounded sweep criterion above replaces the open-ended reading.
  The kept worktree `.worktrees/agentic-workflow-ghcaj` (branch `aw/agentic-workflow-ghcaj`) holds
  the accepted implementation plus five verifier notes, a conductor note and a salvage note; salvage
  patch `.agentheim/salvage/agentic-workflow-ghcaj-escalated-iter5.patch`. *For the conductor at
  integration:* the branch conflicts with `main` in the README's **`claimBatch` / `completeTask`**
  bullet — e4bjh appended the `captureTask` / `dismissTask` bullet where iteration 5 appended a
  "Post-ghcaj" paragraph; additive, ghcaj's paragraph first, e4bjh's bullet after — ADR-0072 ladder.
  The provisional ADR-0073 finalizes to ADR-0074 (ADR-0058).

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
- *Sibling `pcwnn`* → **now `depends_on`** (shipped 2026-09-06 as ADR-0072 while this
  refinement ran, so the dependency is already met). Logically independent, but pcwnn rewrote "Merge-back conflicts", the Verifier Prompt Template, `worker.md`,
  the README git-model entry, and `lib/worktree-salvage.mjs` — every file this task edits.
  Dispatching both in one batch would have manufactured exactly the prose conflict this task
  exists to remove; this task now edits on top of ADR-0072's text. Once ghcaj lands, pcwnn's ladder allow-list is code-only by construction, and its
  rung-4 `done → doing` revert is vestigial. pcwnn's `done/` file is frozen, so its `blocks:` backlink is not written.

**Worker note for whoever executes this task:** you run under the *pre-ghcaj* choreography —
edit the README, write the ADR, and move your task file in your worktree exactly as
`agents/worker.md` says today. The new rules take effect for the *next* batch after you land.

## Outcome

Shipped the report-carried bookkeeping redesign end to end: five new/extended pure helpers,
their tests (including a tmpdir git fixture proving both the "both intents survive" collision
behavior and the one-commit integration shape), and the four doctrine surfaces + BC README +
one ADR that describe the new choreography for the *next* batch.

**Code (all `node --test`-covered, 465/465 green):**
- `lib/readme-delta.mjs` (new) — `applyReadmeDelta`, the two-op (`append`/`replace`) grammar
  with the `(section, termHead)` anchor and the four dispositions (`applied`/`merged`/
  `appended-fallback`/`noop-already`). Tests: `lib/test/readme-delta.test.mjs`.
- `lib/worker-result.mjs` (new) — `parseWorkerResult`, the four-backtick block-fence grammar
  for `README_DELTA`/`ADRS`/`OUTCOME`/`BACKLOG_ITEMS`. Tests: `lib/test/worker-result.test.mjs`.
- `lib/task-lifecycle.mjs` — new `materializeTaskFile(rootDir, body)`, in its own delimited
  region before `completeTask` (per the sibling-merge guidance). Tests:
  `lib/test/materialize-task-file.test.mjs`.
- `lib/derived-artifact-guard.mjs` — new `BOOKKEEPING_PATH_PREFIXES` (`.agentheim/`) and the
  `bookkeeping-path` refusal reason in `partitionCheckpointFiles`. Existing tests updated
  (`lib/test/derived-artifact-guard.test.mjs`, `lib/test/task-lifecycle-cli.test.mjs` — the
  three moved-from-`doing/` tests now assert the vestigial-detection-but-refused behavior).
- `lib/worktree-salvage.mjs` — new `bookkeepingSalvagePath`. Tests appended to
  `lib/test/worktree-salvage.test.mjs`.
- `lib/test/integration-commit-shape.test.mjs` (new) — the bounded ADR-0038/ADR-0072-style
  tmpdir git fixture: one test proves two sequential workers' README replaces + provisional-
  collision ADRs land contiguous with zero conflict markers and a clean squash-merge in both
  orders; the other drives squash-merge → `applyReadmeDelta` → ADR write +
  `finalizeAdrNumbering` → `## Outcome` append → `complete` → `materializeTaskFile` into ONE
  commit, and asserts the worker branch's own tree has no `.agentheim/` diff at all.

**Prose (doctrine for the next batch):**
- `references/worker-return-format.md` — the four new SUCCESS blocks, retiring
  `BC_README_UPDATED` and `NEW_BACKLOG_ITEMS`.
- `agents/worker.md` — actions 4–6 rewritten to REPORT instead of write; "What you do NOT do"
  gains the blanket `.agentheim/` prohibition.
- `skills/work/SKILL.md` — Phase 3's same-BC-README annotation retired; the "PASS / SKIP"
  integration order now runs `applyReadmeDelta` → ADR write + `finalizeAdrNumbering` → Outcome
  append → `complete` → `materializeTaskFile` → INDEX/backlinks before the one scoped commit;
  "BOUNCE integration" no longer squash-merges; "Handling the verdict" writes annotations to
  `main`'s one copy of the task file; the Subagent Prompt Template's Rules 4/6/7/8/10 restate
  the new contract; the completion protocol entry gains optional `**README delta:**` and
  `**README length:**` lines.
- `agents/verifier.md` / `skills/verification-before-completion/SKILL.md` — checks 3, 5, 6, 6c,
  and 7 rewritten to judge the parsed `readmeDelta`/`adrs`/`outcome` blocks instead of a
  README/ADR diff; the auto-SKIP rule now reads `FILES_CHANGED == 0` AND one `adrs` entry.
- BC README — `## Key events`/`## Key commands` normalized to bullet lists; a new git-model
  entry states the code-only branch, the delta grammar's monotone invariant, the on-`main`
  annotation rule, and the one-writer-per-`.agentheim/`-file invariant (work side; the
  concurrent `pt0gy` backlog task covers the modeling side).
- `.agentheim/knowledge/decisions/0073-worker-branch-source-and-tests-only-conductor-materializes-bookkeeping.md`
  (provisional — the conductor finalizes the number) — amends ADR-0032 §3/§4/§6, records the
  report-carried choice, the monotone delta grammar, the collision/merge rule and why ADR-0032's
  no-auto-guess clause survives it, the on-`main` annotation rule, the retired fields, the
  un-bundled `MAX_PARALLEL` decision, the now-dead moved-from-`doing/` detection, and the
  mechanize-or-drop declaration.

**Not done in this task (explicitly out of scope):** the conductor's INDEX insertion for this
ADR and the task↔ADR frontmatter backlinks are left for the conductor, per the task's own
instruction.

### Iteration 6 (2026-09-06) — merge-conflict resolution + bounded sweep closure

Resolved the ADR-0072 rung-3/4 merge conflict in the BC README (lines ~1089-1124): kept
iteration 5's "Post-ghcaj" continuation paragraph of the `claimBatch` / `completeTask` bullet
first, then e4bjh's new `captureTask` / `dismissTask` bullet immediately after it — both
intents survive, no other file in the merge conflicted. Closed the three items the
iteration-5 verifier named, all inside the bounded surface list: appended a "Post-ghcaj"
amendment to the README's **Derived-artifact checkpoint guard (ADR-0057 …)** bullet (the guard
now refuses two families, `derived-artifact` and `bookkeeping-path`, and the moved-from-`doing/`
detection is marked vestigial); corrected `references/commit-doctrine.md`'s "one commit"
paragraph so the README/ADR halves of that commit are attributed to the conductor's own
materialization from `README_DELTA`/`ADRS`, not the worker's stage; added short vestigial notes
to `lib/task-lifecycle-cli.mjs`'s `MOVED_FROM_DOING_FOLDERS` comment, `findMovedFromDoingPath`'s
JSDoc, and `checkpointFiles`'s JSDoc (comment-only, no behavior change). A final pass over the
enumerated surface list also caught one more residual in `skills/work/SKILL.md`'s "Finalize the
ADR's number first" paragraph (still said the worker's squash-merge stages the ADR file) and
fixed it to point at PASS/SKIP integration step (b) instead. `node --test lib/test/*.test.mjs`
is 493/493 green from the worktree (e4bjh's merge added its own tests on top of the prior
465).

**Sizing.** Larger than pcwnn: five small pure helpers (`lib/readme-delta.mjs`,
`lib/worker-result.mjs`, `materializeTaskFile` in `lib/task-lifecycle.mjs`, the guard prefix,
the salvage path), one tmpdir git fixture, four prose surfaces, one ADR. Not split: the
helpers are meaningless without the choreography and the choreography is unverifiable without
the helpers. Suggested ADR title: *Worker branch carries source and tests only — the conductor
materializes README delta / ADR / task-move / backlog-item bookkeeping on `main` at
squash-merge integration (amends ADR-0032 §3, §4, §6)*.

### Iteration 2

Fixed the two stale `skills/work/SKILL.md` prose lines flagged by the iteration-1 verifier: the
Subagent Prompt Template lead-in (no longer claims the Rules list is "unchanged" or that the
worker "still owns" a `doing → done` move; now states the worker runs no git, writes nothing
under `.agentheim/`, and owns no task-file move) and the "Index updates" table's **doing → done**
row (no longer implies the squash could have carried the task file to `done/`; now states
`complete` performs the real move, here for the first time, per step (d)). No other files
touched; `node --test lib/test/*.test.mjs` re-verified 465/465 green.

### Iteration 3

Systematic sweep of `skills/work/SKILL.md` for every remaining stale worktree-location claim
about the task file, beyond the three the iteration-2 verifier flagged. Corrected sentences:

- Phase 4 step 5 (dispatch loop): "every other absolute path you pass (task file, BC README,
  BC index) is the copy inside that worktree, not the main tree" → now states the `Workspace`,
  BC README, and BC index paths point into the worktree while the task-file path is `main`'s
  one copy, read-only to the worker.
- Subagent Prompt Template lead-in: "every absolute path you fill in points inside the task's
  worktree (ADR-0032), not the main tree" → now scopes that claim to the `Workspace`/README/index
  paths only, and states the task-file path is `main`'s one copy, read-only, never the
  worktree's — agreeing with the template line six lines below.
- Verifier Prompt Template: "Task file (currently in doing/ or done/, inside the worktree
  below)" → "currently in `doing/`, on `main` — read-only".
- `agents/verifier.md` "What you are given": the same "currently in `doing/` or `done/`" claim
  (no worktree wording, but implied the file could reach `done/` pre-integration) → corrected
  to the same on-`main`, read-only, `doing/`-only wording.
- `skills/verification-before-completion/SKILL.md`: "the task file's absolute path (in `doing/`
  or `done/`, inside the worktree)" → "in `doing/`, on `main` — read-only".
- "Git authority" section: "Workers only move files and write content, inside their own
  worktree" → workers no longer move any file (not even their own task file); corrected to
  "Workers only write content — source and tests, inside their own worktree; they move no
  files... that move happens on `main`, at PASS/SKIP integration step (d)".
- Merge-back conflict ladder rung 4: "revert the task file `done → doing` inside the worktree
  exactly as the FAIL path does" → marked vestigial (agentic-workflow-ghcaj), matching the
  Subagent Prompt Template's "Resolve-conflict dispatch" section which already carried the
  correct, vestigial-noting text.

Everything else — the "Index updates" table, "Handling the verdict", "BOUNCE integration", the
Salvaging section, the Resolve-conflict dispatch subsection, `agents/worker.md`, and
`references/worker-return-format.md` — was already consistent with the on-`main`, read-only,
task-file-never-in-a-worktree rule (fixed by iteration 2 or correct from the start); verified by
a full-file grep sweep for `inside the worktree`, `inside that worktree`, `worktree's copy`,
`copy inside`, `doing → done`/`done → doing` location claims, and `## Verifier note` placement.
No code, test, ADR, or README change. `node --test lib/test/*.test.mjs` re-verified 465/465
green from the worktree root.

### Iteration 4

The iteration-3 verifier had scoped its grep sweep to `skills/work/SKILL.md` and sibling
prose files but had never actually swept `agents/worker.md` itself — the five passages it
named (Resolve-conflict dispatch, First-action bounce, UI-test-infra TDD-skip bullet, spike
stop-loss, follow-up-backlog bullet) still instructed the pre-ghcaj worker behavior (worker
moves its own task file, worker writes a `## Worker note`/backlog file itself). Fixed all
five in `agents/worker.md`, plus two more stale passages a whole-doctrine-surface grep turned
up: `skills/modeling/SKILL.md`'s field legend ("the worker sets the date when the task is
done" for `completed:`) and `skills/work/SKILL.md`'s ADR-backlink line ("the worker writes
the ADR" — now "the worker drafts the ADR body ... but never writes the file"), plus
`agents/worker.md`'s Fourth-action "reference it from the task's Notes section" (the worker
never edits Notes; now "mention it in your `OUTCOME` block's text"). Grepped `agents/*.md`,
`skills/*/SKILL.md`, `skills/*/references/*.md`, `references/*.md`, `README.md`, `CLAUDE.md`,
`docs/*.md`, `evals/**` for every remaining "worker moves/writes/sets" location claim; no
further hits — the rest of the doctrine surface (`agents/verifier.md`,
`references/worker-return-format.md`, `skills/verification-before-completion/SKILL.md`,
`skills/work/SKILL.md`'s integration-order prose) was already consistent. No code or test
change. `node --test lib/test/*.test.mjs` re-verified 465/465 green from the worktree root.

## Verifier note (iteration 1)

**VERDICT: FAIL**

REASONS:
- `skills/work/SKILL.md` — the lead-in sentence immediately above the `## Subagent Prompt Template`'s code fence still reads: "The `## Rules — CRITICAL` list below is **unchanged**: the worker still never runs git and still owns only its own `doing → done` move — only *which* tree it operates in has changed." The diff leaves this line untouched while rewriting Rules 4, 6, 7 and adding Rule 10 six lines below it. It is now false on both counts and directly contradicts Rule 4 ("Do NOT touch any task file … not even your own"), Rule 7 ("Do NOT move your task file from doing/ to done/ — you never do this anymore"), Rule 10, `agents/worker.md`'s new actions, `references/worker-return-format.md`, the new BC README git-model entry, and ADR-0073's on-`main` annotation section. This falsifies acceptance criterion 8 as a whole: the template a conductor reads top-down announces the opposite of the rules it then states, and per this task's own ADR-0059 mechanize-or-drop declaration the conductor's sequencing is prose-only and unenforced — this prose is the only enforcement there is, so a self-contradicting sentence in it is a live defect, not cosmetics.
- `skills/work/SKILL.md` — the "Index updates" table's **doing → done** row (also untouched by the diff) still describes `complete` as running "(idempotently, whether or not the squash already carried the file to `done/`)". Post-ghcaj the squash can never carry the task file anywhere — the worker branch has no `.agentheim/` path at all — and this contradicts the diff's own new step (d) ("Unlike before ghcaj, this is **not** a no-op-detecting idempotent path in the ordinary case … performs a REAL move here"). Acceptance criterion 9 covers this file's integration-order doctrine; the table row is now stale against it.

SUGGESTED_FIX: Rewrite the Subagent Prompt Template lead-in so it states what is actually true post-ghcaj (the worker runs no git, writes nothing under `.agentheim/`, and no longer owns any task-file move; only source and tests live in the worktree), and correct the parenthetical in the **doing → done** Index-updates row so it no longer implies the squash could have carried the task file to `done/`. No code, test, ADR, or README change is needed — everything else in this diff verified clean.

ITERATION_HINT: likely-fixable

Verified green (do not redo): `node --test lib/test/*.test.mjs` 465/465 from the worktree; fixture criteria 1–7 all have behavior-shaped tests; scope, ubiquitous language, README sync, ADR quality and backlinks, related-ADR consistency, git-free runtime lib, no protocol/INDEX/git tampering; check 8 did not fire.

## Verifier note (iteration 2)

**VERDICT: FAIL**

REASONS:
- `skills/work/SKILL.md` Phase 4 step 5 (untouched by the diff) still instructs the conductor: "its `## Your task` block now carries a `Workspace` field pointing at the task's worktree; every other absolute path you pass (task file, BC README, BC index) is the copy inside that worktree, not the main tree." Post-ghcaj the task-file path handed to the worker is on `main` — stated explicitly by the diff's own §3 rule (annotations appended to the task file on `main`; a re-dispatched worker and the next verifier both read it from the same absolute path), by the template line the diff added ("Task file (currently in doing/, on `main` — read-only to you…)"), by Rule 4, by `agents/worker.md`, and by `references/worker-return-format.md`. Following the untouched step hands the worker the worktree copy and silently breaks the FAIL re-dispatch loop this task redesigns. Same defect class as iteration 1: the sequencing is prose-only and unenforced (ADR-0059), so this prose is the enforcement. Falsifies acceptance criterion 8.
- `skills/work/SKILL.md` Subagent Prompt Template lead-in — iteration 2 rewrote this sentence but left its first half false: it still opens "Fill the placeholders — every absolute path you fill in points inside the task's worktree (ADR-0032), not the main tree." Six lines below, inside its own fence, the template says the task file path is on `main`. (The second half — Rules-list and task-move claims — is now correct; the doing → done Index-updates row is also correctly fixed.)
- `skills/work/SKILL.md` Verifier Prompt Template (untouched) still reads "Task file (currently in doing/ or done/, inside the worktree below): <ABSOLUTE-PATH>". Post-ghcaj the task file is never inside a worktree and never in `done/` at verification time — it sits in `doing/` on `main` until integration step (d). Relevant to acceptance criterion 10.

SUGGESTED_FIX: In `skills/work/SKILL.md`, correct the three location claims so they match the on-`main` task-file rule the diff establishes: Phase 4 step 5 should say the `Workspace`, BC README and BC index paths point into the worktree while the task-file path is `main`'s one copy, read-only; drop or qualify the "every absolute path … points inside the task's worktree, not the main tree" clause in the Subagent Prompt Template lead-in; change the Verifier Prompt Template's task-file line to "currently in `doing/`, on `main`". No code, test, ADR, or README change is needed — `node --test lib/test/*.test.mjs` is 465/465 green; check 8 does not fire.

ITERATION_HINT: likely-fixable

## Verifier note (iteration 3) — escalated to the builder

**VERDICT: FAIL** (iteration cap reached; no further re-dispatch)

REASONS (all in `agents/worker.md`, untouched by the diff; code, tests 465/465, ADR, README, `skills/work/SKILL.md` sweep all verified clean):
- First action (verify workability) still instructs the worker to move its own task file on a bounce: "Move the file back to `backlog/`, update its `status` frontmatter to `backlog`, add a `## Worker note` section … and return `RESULT: BOUNCED`." Contradicts the diff's own read-only rule, Rule 8, and `references/worker-return-format.md`.
- Third action, spike stop-loss (ADR-0065) still reads: "Move the task `doing/` → `done/` and return `RESULT: SUCCESS` exactly as you would for a fully-diagnosed spike." Post-ghcaj the move is the conductor's integration step (d).
- Third action still reads: "If mid-work you discover follow-up tasks … **create them in the BC's `backlog/`**." Post-ghcaj the worker reports full bodies in `BACKLOG_ITEMS` and the conductor materializes them (stated four lines away). Same defect, milder, in the UI-test-infra sentence ("create a backlog item").
- Inputs you receive, Resolve-conflict dispatch still asserts "occasionally you'll be re-invoked on a task whose file is already `done/` in your own worktree" and "the conductor already reverted the task file to `doing/` before dispatching you" — the diff itself marks that revert vestigial in `skills/work/SKILL.md`.
- Together these falsify acceptance criterion 8: actions 4–6 and Rules 4/6/7/8/10 were rewritten, but the same file's First action, Third action, spike clause, and Inputs section still instruct the opposite. The choreography is prose-only (ADR-0059), so this prose is the only enforcement.

SUGGESTED_FIX: In `agents/worker.md`, rewrite the four passages to match the rule the rest of the file states — bounce: return `RESULT: BOUNCED` with a `REASON` only, move nothing (the conductor performs `doing → backlog` and the `## Worker note` on `main`); spike stop-loss: report the `## Outcome` text in the `OUTCOME` block and return `RESULT: SUCCESS`; follow-ups: report full bodies in `BACKLOG_ITEMS`, never create files in `backlog/`; resolve-conflict inputs: drop the "already `done/` in your own worktree" / "conductor already reverted" claims, mark the revert vestigial as `skills/work/SKILL.md` does, note the task file stays in `doing/` on `main` with a `## Merge-conflict note` appended there. No code, test, ADR, or README change is needed.

ITERATION_HINT: likely-fixable

## Verifier note (iteration 4) — resumed past the cap by the builder's re-invocation of `work`

**VERDICT: FAIL**

REASONS:
- `.agentheim/contexts/agentic-workflow/README.md:1077-1082` (untouched by the diff) — the `claimBatch / completeTask` inventory bullet still reads: "**`completeTask(rootDir, id, opts)` is single-task-shaped** and **idempotent** w.r.t. a file already in `done/` (**under ADR-0032 the worker's worktree does the `doing → done` move, so by the time the conductor runs `complete` on `main` after the squash-merge the file is already there**): … the `done/` case is the idempotent no-op move, and bookkeeping proceeds against the file already there." This is the identical claim iteration 1 FAILed in `skills/work/SKILL.md`'s **doing → done** Index-updates row; the worker fixed it there (line 393) and in step (d) (line 321, "performs a REAL move here"), but not in the BC README. It is present tense, not marked vestigial, and directly contradicts this same README's new ghcaj entry 900 lines above it (line 176: "`complete` (the real `doing → done` move, here for the first time)"; line 196: "no task file ever moves inside a worktree again"). Exactly the defect class under sweep — a doctrine surface asserting the worker moves its own task file.
- `.agentheim/contexts/agentic-workflow/README.md:1096-1099` — the `lib/adr-allocation.mjs` bullet still describes `finalizeAdrNumbering` as "called against `main`'s real `decisions/` **after a worker's `git merge --squash` stages its ADR file(s)** but before the integrating `git add`/commit." Post-ghcaj the worker branch contains no ADR file, so the squash stages nothing — the conductor writes the body from the `ADRS` block first, *then* finalizes. The task redesigns this exact sequencing deliberately (§3(b), and Notes → "*ADR-0058 interaction* → `finalizeAdrNumbering` unchanged; the conductor writes the provisional file first, then finalizes"), and the new README entry states the corrected order at line 174. Same bullet, lines 1107-1109, follows from the same stale premise: "A bounced/failed task's provisional file is simply never passed to `finalizeAdrNumbering` (ADR-0032's FAIL quarantine — nothing merges to `main`), so it never consumes a slot" — post-ghcaj there is no provisional file on disk at all on a bounce/fail.
- Together these falsify the README half of the doctrine-consistency requirement (acceptance criterion 11's file): the BC README now states both the old and the new rule for who moves the task file and who writes the ADR file, ~900 lines apart, with no amendment pointer between them — unlike the ADR-0032 → ghcaj git-model entries at lines 149-201, which sit adjacent and do amend each other. The choreography is prose-only and unenforced (ADR-0059), and the BC README is the memory every future session reads first, so this prose is the enforcement.

SUGGESTED_FIX: In `.agentheim/contexts/agentic-workflow/README.md`, correct the two `lib/` inventory bullets: the `completeTask` parenthetical should say the conductor performs the real `doing → done` move on `main` at integration step (d) post-ghcaj, with the `done/`-resolving branch retained only for a resumed/interrupted session; the `finalizeAdrNumbering` sentence should say the conductor writes each `ADRS` body to `decisions/` on `main` and *then* calls `finalizeAdrNumbering` (the squash-merge no longer stages any ADR file), and the bounce/fail sentence should say the `ADRS` block is simply never materialized. The whole BC README still needs the same sweep the worker ran over `agents/*.md`, `skills/*/SKILL.md` and `references/*.md` — its iteration-4 grep list covered the repo-root `README.md`, not `.agentheim/contexts/agentic-workflow/README.md`. No code, test, ADR, or `agents/`/`skills/`/`references/` change is needed: `node --test lib/test/*.test.mjs` is 465/465 green from the worktree, all seven fixture criteria have behavior-shaped tests, `agents/worker.md`'s five iteration-3 passages plus the Fourth-action Notes reference, `skills/modeling/SKILL.md`'s `completed:` legend and `skills/work/SKILL.md`'s ADR-backlink line are all correctly fixed, scope and ubiquitous language are clean, no protocol/INDEX/git tampering, and check 8 does not fire (no `dashboard/**` path).

ITERATION_HINT: likely-fixable

## Verifier note (iteration 5) — escalated to the builder again

**VERDICT: FAIL**

REASONS:
- `.agentheim/contexts/agentic-workflow/README.md:269-274` (untouched by the iteration-5 diff) — the ADR-0057/`checkpoint` bullet still states the pre-ghcaj rule in present tense: "a worker's `FILE_LIST` (or the conductor's BOUNCE fileList) **only ever names the task file's NEW lifecycle location** (`done/` or `backlog/`); the moved-from `doing/` path … is detected from that one entry and folded into `changed` too, so `git add <changed>` stages the deletion half of the rename." Post-ghcaj a worker's `FILE_LIST` never names a task file at all, and no task file ever moves inside a worktree — this passage carries no vestigial/post-ghcaj/amended marker of its own and directly contradicts `skills/work/SKILL.md:173` and this same README's ghcaj entry at lines 195-197. Same defect class as iteration 4 (README:1077-1082, 1096-1099), same file, same `## Ubiquitous language` section; the iteration-5 delta corrected only those two named bullets (HEAD touches README lines 1086-1121 only), so the whole-README sweep the iteration was dispatched to perform did not happen.
- `.agentheim/contexts/agentic-workflow/README.md:263-265` — the same bullet describes `partitionCheckpointFiles`'s current contract as `refused` = "(today: any `dashboard/dist/` path, segment-boundary matched, plus anything resolving outside the worktree)". This very task added a second refusal family (`bookkeeping-path`, `BOOKKEEPING_PATH_PREFIXES`), so the README's own description of the guard it just extended is wrong at the word "today".
- `references/commit-doctrine.md:16` — "`git add`ed together with **the worker's `FILE_LIST`, README, and ADRs**". Post-ghcaj the README and ADR(s) in that commit are the conductor's own writes materialized on `main` from the `README_DELTA`/`ADRS` blocks; the worker contributes only the code `FILE_LIST`. `references/*.md` is inside the doctrine sweep and this attribution is unmarked.
- `lib/task-lifecycle-cli.mjs:63-70`, `:79-86`, `:122-129` — the `MOVED_FROM_DOING_FOLDERS` comment, `findMovedFromDoingPath`'s JSDoc, and `checkpointFiles`'s JSDoc all state the pre-ghcaj rule in present tense with no vestigial note. The task's own `## What` §3 requires this detection be "kept with a doctrine note"; that note exists in `skills/work/SKILL.md` and the BC README but nowhere at the code it describes, and the mechanism is now fully dead (BOUNCE no longer squash-merges, so even the conductor's BOUNCE fileList never names a task file).

SUGGESTED_FIX: Append a "Post-ghcaj (agentic-workflow-ghcaj)" amendment to the BC README's ADR-0057/`checkpoint` bullet in the same shape the iteration-5 delta already used twice — the guard now refuses two families (`derived-artifact` and `bookkeeping-path`), and the moved-from-`doing/` detection is vestigial because a worker's FILE_LIST is source and tests only and no task file moves in a worktree; correct `references/commit-doctrine.md:16` so the README/ADR halves of the one commit are attributed to the conductor's materialization, not to the worker; and add the same short vestigial note to `lib/task-lifecycle-cli.mjs`'s three checkpoint comment blocks (the task's §3 explicitly sanctions keeping the code with a doctrine note). Nothing else needs to change — `node --test lib/test/*.test.mjs` is 465/465 green from the worktree, all seven fixture criteria (1-7) have behavior-named tests, criteria 8-10 and criterion 11's bullet normalization plus the git-model entry at README:167-206 are all verified clean, the ADR body is well-formed and backlinked, scope and ubiquitous language are clean, no protocol/INDEX/git tampering, and check 8 does not fire.

ITERATION_HINT: likely-fixable

## Conductor note (2026-09-06 01:40) — integration blocker beyond the verifier

Independently of the verifier's findings, the branch no longer squash-merges cleanly onto `main`: `git merge-tree main aw/agentic-workflow-ghcaj` reports a content conflict in `.agentheim/contexts/agentic-workflow/README.md` around line 1089 — e4bjh's integration appended the new `captureTask` / `dismissTask` inventory bullet immediately after the `claimBatch / completeTask` bullet, and iteration 5 appended a "Post-ghcaj" continuation paragraph to that same bullet. Both intents survive by placing the ghcaj paragraph first (it continues the `completeTask` bullet) and e4bjh's bullet after it. Per ADR-0072 this goes through the merge-back ladder (merge `main` into this worktree, same-worker resolve, re-verify) once the doctrine sweep is accepted — it was not started, to keep the escalation state simple.

## Salvage note (iteration 5 escalation)

Salvaged diff: `C:\src\heimeshoff\agentic\Agentheim\.agentheim\salvage\agentic-workflow-ghcaj-escalated-iter5.patch` (apply with `git apply <patch>` against a scratch checkout, or open it directly to review).

## Merge-conflict note (iteration 6)

**Sibling:** agentic-workflow-e4bjh — capture and dismiss verbs join the lifecycle CLI (new `lib/task-lifecycle-capture-dismiss.mjs`); modeling, quick-capture and brainstorm now call the CLI instead of hand-editing bookkeeping; ADR-0073 amends ADR-0022. Integrated on `main` 2026-09-06 as commit 412973b.
**New base SHA:** b10cf831daf7e8b27e2b92fc5efe4cdd208e3471 (`main` after the 01:55 refinement of this task)
**Ladder entry:** ADR-0072 rung 3 — `git merge main` performed inside this worktree on 2026-09-06, entered from the read-only `git merge-tree` preview the iteration-5 conductor note recorded (same 3-way merge as the squash, ADR-0072 fact (b)), so no squash was attempted on `main` and no reset was needed there. One-shot budget for this worktree now spent.
**Resolution allow-list:**
- `.agentheim/contexts/agentic-workflow/README.md` (one `UU` hunk, lines 1089–1124: HEAD = iteration 5's "Post-ghcaj" continuation paragraph of the **`claimBatch` / `completeTask`** bullet; main = e4bjh's new **`captureTask` / `dismissTask`** bullet appended right after that bullet — additive; ghcaj's paragraph first, e4bjh's bullet after)
**Sibling's `git log -1 --stat main` scoped to the allow-list:**
```
412973b refactor(agentic-workflow): capture and dismiss verbs join the lifecycle CLI … [agentic-workflow-e4bjh]
 .agentheim/contexts/agentic-workflow/README.md | 26 ++++++++++++++++++++++++++
 1 file changed, 26 insertions(+)
```
Also auto-merged without conflict (no action needed): this task file, `lib/test/task-lifecycle-cli.test.mjs`, `skills/modeling/SKILL.md`. Note that `main`'s ADR-0073 (e4bjh's, `0073-capture-dismiss-…`) now sits beside this task's provisional `0073-worker-branch-…` in `decisions/` — different slugs, no `AA` collision; ADR-0058's `finalizeAdrNumbering` renumbers this task's ADR to 0074 at integration on `main`. Do not renumber it yourself.
