# Agentic Workflow

## Purpose

The one bounded context of Agentheim: running a domain-driven, human-in-the-loop agentic
workflow on top of Claude Code. Everything the tool does — turning an idea into a vision,
a vision into a modeled backlog, and a backlog into committed code — happens here. There
is no second context to map against; the workflow *is* the domain.

## Classification

**core** — this is the product. There is nothing supporting or generic to factor out yet;
if a cross-cutting infrastructure concern ever earns its own home, it would split off as a
separate BC, but today the whole tool lives in this one.

## Actors

- **Builder** — the single human user. Drives every Socratic dialogue, reviews every gate,
  and is never bypassed: no code without a no-code brainstorm first, no `work` without
  reviewed tasks, escalation on repeated verification failure.
- **Internal machinery (not external actors)** — the `orchestrator` (router, never writes
  code), the specialists (`strategic-modeler`, `tactical-modeler`, `architect`,
  `researcher`, `worker`), and the two adversarial gates (`verifier`, `research-reviewer`).
  They are how the context does its work, not parties it serves.

## Ubiquitous language

> **Note on this section.** Consolidated in place 2026-07-03 (agentic-workflow-w7q2m, ADR-0041)
> from 1006 lines: per-feature narration chains were folded into settled summaries. Every term
> and invariant below survived; only historical blow-by-blow detail was compressed.

- **Skill** — a natural-language-triggered capability: `brainstorm`, `modeling`,
  `research`, `work` (plus doctrine docs: TDD, verification-before-completion,
  research-review). Triggered by phrasing, not slash commands.
- **Slash-command exception (`/dashboard`)** — the **single, deliberate** departure from the
  "phrasing, not slash commands" rule above (decided agentic-workflow-011). The dashboard is a
  process-launcher, not a Socratic dialogue, so a literal slash command (`/dashboard`,
  `/dashboard stop`, `/dashboard status`) is the right surface. Documenting the exception here
  keeps the principle intact: skills stay phrase-triggered; `/dashboard` is the named carve-out,
  not an erosion. The command file (`commands/dashboard.md`) is a thin trigger that passes the verb
  straight through to the one cross-platform launcher `dashboard/launch.mjs` — all OS-divergent
  spawn/kill/open logic stays there (ADR-0002). See *Dashboard* under Key commands.
- **Mode** — one of six conversational stances (Interrogator, Suggestor, Challenger,
  Storyteller, Facilitator, Synthesizer) for `brainstorm` and `modeling`. Serves model
  quality; switchable mid-session.
- **Vision** — the strategic root artifact: what's being built, for whom, why.
- **Bounded context (modeled)** — a domain area *in the builder's project*, given a
  `contexts/<name>/` folder. (Note the recursion: this README is itself such a folder, for
  Agentheim's own domain.)
- **Task** — a unit of work as a markdown file with frontmatter, moving through a
  lifecycle. `type`: feature | bug | refactor | chore | spike | decision.
- **Orchestrator / Specialist** — the router agent and the focused agents it delegates to.
  The orchestrator never writes code or does deep modeling itself. Distinct from the
  **conductor**: the non-code-writing driving loop of the `work` skill itself (scan the
  DAG, dispatch worker subagents, commit, log) — a role the session plays, not an agent
  the orchestrator can route to.
- **Scoped run (ADR-0071, agentic-workflow-swj2q)** — invoking `/agentheim:work` with one or
  more explicit task ids narrows the conductor's loop to exactly that named set: the DAG gate
  still fail-closes on an unmet/dangling `depends_on` (ADR-0038 Ruling A) and an id not
  currently in `todo/` is refused (naming its actual lifecycle folder), but nothing else is
  picked up mid-run — the loop ends once the named set reaches a terminal state, rather than
  looping until `todo/` is empty (the bare `/agentheim:work` default). See `skills/work/SKILL.md`'s
  "Argument grammar".
- **Adversarial gate** — a fresh-context skeptic with no exposure to the producer's
  reasoning, judging the producer's output. `verifier` audits a worker's diff before
  commit; `research-reviewer` re-verifies a report before it's citable. A deliberate,
  recurring motif.
- **ADR** — Architecture Decision Record, global or BC-scoped; flows through the backlog as
  `type: decision`.
- **Mechanize-or-drop (ADR-0059, agentic-workflow-z394j)** — a task that *establishes a
  convention* (a naming/format/structural rule other tasks or agents are meant to follow
  going forward, not a one-off choice) must either ship enforcement in the same task (a lint,
  a live-tree `node --test` check, or a build failure) or explicitly record **"prose-only,
  unenforced"** in the task file — so an unenforced convention is a visible decision, never
  an accident. Gated at two points, mirroring the existing ADR gate: `skills/modeling/SKILL.md`'s
  CAPTURE/PROMOTE readiness checks (REFINE inherits PROMOTE's check), and `agents/verifier.md`
  check 6c (mirrored in `skills/verification-before-completion/SKILL.md`). ADR-0044 (id-grammar
  minting) and ADR-0052 (`agentheim:` namespace lint) are the in-house exemplars this doctrine
  generalizes. **Scoped to doctrine-bearing surfaces only** — `skills/`, `agents/`,
  `references/`, `lib/`, `.agentheim/knowledge/`, or a BC README's convention/ubiquitous-language
  section (ADR-0059 amendment, agentic-workflow-z3grd): a task/diff confined to consumer
  product surfaces skips both gates entirely, stating the scope and the skip. See ADR-0059.
- **INDEX entry-length cap (ADR-0060, agentic-workflow-ngzwz)** — a newly written INDEX task
  or ADR bullet is capped at **~2-3 sentences, ~60 words**: the claim and the pointer, detail
  living in the linked task/ADR file, never the catalog line itself. A task's `title:`
  frontmatter is what lands verbatim in its INDEX line (`insertIndexLineAtTop` embeds it
  unchanged), so the cap is really a cap on titles `modeling` authors/refines; the ADR-line
  prose `work` hand-composes on every `adr-local`/`adr-global` insert is capped the same way.
  Existing over-length entries are left verbatim — no retroactive rewrite (mirrors ADR-0039's
  verbatim discipline). Grandfathering is by DATE, not an id allowlist: `lib/index-entry-
  length.mjs`'s live-tree lint flags a new entry (linked artifact dated strictly after
  `ADOPTION_DATE`) that exceeds the cap, and never touches an entry dated on/before it — the
  ADR-0044 `GRANDFATHERED_IDS` idea, scaled past a single stray id. See ADR-0060.
- **Falsifiability gate — machine-checkable vs. human-eye acceptance criteria (ADR-0061,
  agentic-workflow-mxk6v)** — every acceptance criterion is classified at CAPTURE/REFINE time:
  **machine-checkable** (default, unmarked — a test or artifact can decide it) or **human-eye**
  (a genuinely perceptual claim, marked with a trailing `[human-eye]` bullet suffix). A
  `[human-eye]` criterion is never a promotion blocker on its own; a task whose criteria are
  **all** `[human-eye]` needs a specific "Verification is builder-eye only" `## Notes` line
  before promotion (PROMOTE readiness step 2b), enforced by `lib/human-eye-criteria.mjs`'s
  live-tree lint. The verifier (`agents/verifier.md` check 1) never proxies a `[human-eye]`
  criterion with an invented metric — it reports `builder eye-check pending`; the criterion's
  checkbox stays unchecked through `done/` as the routing signal to the builder's own eye-check.
  **Metric drift is escalation fuel, not iteration fuel** (check 1b): on iteration 2/3, if a
  criterion's text is unchanged but the measurement/proxy checking it changed since the prior
  `## Verifier note`, the verifier FAILs with `ITERATION_HINT: task-under-specified` — reusing
  `work`'s existing immediate-escalation handling for that hint rather than granting another
  retry. Closes the Dorc July-2026 review's worst-named burn: a perceptual claim smuggled into a
  machine-checked metric, tuned by three worker iterations while the product stayed broken. See
  ADR-0061, ADR-0059, ADR-0036.
- **Runner-first testing (ADR-0062, agentic-workflow-vvmfy)** — a test verdict comes **only**
  from the project's runner (the pre-resolved test command, `agentic-workflow-g9s3w`, or the
  verifier's discovery fallback) — its exit status or structured report (TAP, JUnit XML,
  `node --test`'s summary), never a test's own printed "PASS." A printed-green with no runner
  actually invoked and checked is **unverified**, not evidence, and FAILs `agents/verifier.md`
  check 2 (mirrored in `skills/verification-before-completion/SKILL.md`). Governs only
  machine-checkable criteria — a `[human-eye]` criterion (ADR-0061) never reaches a runner at
  all. Coupled with `skills/test-driven-development/SKILL.md`'s **runner-first rule**: a
  project's (or a mixed-stack project's ecosystem's) first test-bearing task must establish the
  runner and prove it actually fails on a failure before the test corpus grows; for ecosystems
  with no trustworthy native runner, that task must instead build an **external-runner
  fallback** that owns the verdict (Dorc's `run_smokes` + SmokeGuard shape — capture each test's
  real pass/fail signal outside an untrustworthy exit code, aggregate to one summary, exit
  non-zero iff anything failed). Closes the Dorc July-2026 review's A4 finding: 155 smoke tests
  trusted on their own say-so before anyone ran them together, 23% bad on the first honest run.
  See ADR-0062, ADR-0059 (self-referential compliance: prose-only judgment enforced by the
  verifier check, not a lint — the predicate reads live execution output, not committed source),
  ADR-0061, ADR-0036.
- **Protocol** — the chronological project diary, newest on top; every action appends.
- **Index** — a flat catalog (`knowledge/index.md` + per-BC `INDEX.md`) that *points*,
  never duplicates. The memory layer for prior-art and dependency lookup.
- **Commit doctrine** — every skill that produces `.agentheim/` markdown commits its own artifacts, scoped, so the working tree is clean after any session (ADR-0026). `work` folds the task-move + `INDEX.md` + `protocol.md` + ADR-backlink bookkeeping into the task's integrating commit **before** committing (no post-commit write); `modeling` / `quick-capture` / `brainstorm` each commit the `.md` they wrote at end-of-action. Every commit is a **scoped `git add`** of only that skill's own files — **never `git add -A`** — load-bearing because `modeling` can run concurrently with `work`. A task's commit is found in `git log` via the `[<task-id>]` message trailer; there is **no `commit:` frontmatter field** (ADR-0026 dropped the SHA chicken-and-egg). One task = one commit, with a bounded **trivial-squash carve-out** for a same-BC / same-files / no-behavior-change / same-batch wave of follow-ups. At session end `work` **reconciles stranded carry-over**: `git status --porcelain` surfaces every stranded file. **`.agentheim/`-owned paths** get the full per-file disposition (commit deliberately, or leave with a named owner) — never auto-swept, never assumed. **Everything else** (agentic-workflow-pzacx consumer-tuning: a consumer's working tree routinely carries the builder's own WIP outside `.agentheim/`, where per-file interrogation is friction with a foregone "leave behind" answer) is batched into one line — `left behind (user WIP, N files)` — no per-file ask, no commit offered. See ADR-0026, ADR-0017, ADR-0007. **Post-pt0gy git model (agentic-workflow-pt0gy), completed project-wide by agentic-workflow-fn59c:** "exactly one class of writer per bookkeeping file" is now real everywhere — across `work` and every markdown-producing skill (`modeling`, `quick-capture`, `brainstorm`, `research`) — not aspirational and not confined to the modeling side. Every capture-side writer (`promoteTask`, `claimBatch`, `completeTask`, `captureTask`, `dismissTask`'s confirm phase, `rotateProtocol`, `rotateIndexDoneList`'s per-BC body) plus the two new mechanics verbs below acquire **one project-wide advisory lock** (`lib/lifecycle-lock.mjs`, `.agentheim/state/lifecycle.lock`, gitignored/advisory per ADR-0027) before touching `INDEX.md`/`protocol.md`, serializing two concurrent `modeling` sessions (or a session and `quick-capture`) instead of letting them race the same hot spot. Two opts-only mechanics verbs on `lib/task-lifecycle-cli.mjs` — **`log`** (prepends one protocol entry from caller-supplied `title`/`body`; the CLI stamps only the timestamp — every word of `title`/`body` stays judgment) and **`index-add`** (inserts one line into a non-task-list marker block — legal surface `bc-list` / `adr-global` / `research-global` / `adr-local` / `research-local` / `concepts`; refuses all five task-status sections, including `task-counts`, as `task-list-section-forbidden`; splits a duplicate id two ways — byte-identical line is a no-op `skipped:true`, a different line is `duplicate-id-conflict`; never backfills a missing INDEX.md) — give the remaining hand-edited REFINE/CONSOLIDATE protocol entries and the rare `bc-list` insert a locked, mechanized seam, exactly like `capture`/`promote`/`dismiss` already had. **`lib/scoped-commit.mjs`**'s `runScopedCommit` replaces every hand-composed `git add` + `git commit` in `modeling` and `quick-capture`, refusing `-A`/`.`/a glob outright and retrying `add`/`commit` independently (bounded backoff) on a sibling's `.git/index.lock`, never deleting the lock itself. `work`'s BOUNCE `doing → backlog` move and `quick-capture`'s cross-BC re-route — the two count-coupled hand-writers neither `log` nor `index-add` may legally touch — now ride the two verbs `agentic-workflow-qd24q` added, **`bounce`** and **`reroute`** (ADR-0077), and every other remaining hand-write across `work`, `brainstorm`, `research`, and `quick-capture` was wired onto `log`/`index-add`/`capture`/`scoped-commit` by `agentic-workflow-fn59c`: `main` now has exactly one class of writer per bookkeeping file, project-wide.
- **Per-worker git worktree isolation (ADR-0032, agentic-workflow-f6m2q)** — every parallel
  `work` worker runs in its own git worktree at `<repo-root>/.worktrees/<task-id>/` on a
  private branch `aw/<task-id>`, gitignored and outside `.agentheim/`. A **batch-start claim
  commit** moves the whole batch `todo → doing` first (the one deliberate ADR-0026 amendment:
  this half of the lifecycle move rides its own commit) so each worktree's base already holds
  its task in `doing/`; the conductor makes an ephemeral `wip` commit per iteration. The
  verifier's diff/test run are scoped to `git -C <worktree> show HEAD`, so a sibling's changes
  are structurally absent. On PASS/SKIP the conductor `git merge --squash`es the branch onto
  `main`, folds in the usual bookkeeping into **one** commit, then tears the worktree down;
  `RESULT: BOUNCED` gets the same treatment with no verifier (ADR-0037). On FAIL, `main` needs
  no rollback by construction; the worktree is reused across re-dispatch and, on iteration 3,
  **kept** for inspection. A real merge-back conflict aborts with `git reset --hard HEAD`
  (**not** `git merge --abort`, which errors on a squash merge) and surfaces to the user. Tasks
  touching `dashboard/` get a lazily-created `node_modules` junction/symlink to the main tree's
  one copy (`lib/worktree-node-modules.mjs`); **removing that link is mandatory before `git
  worktree remove`** — skipping it silently deletes the shared `node_modules`. Session-end
  reconciliation and recovery both walk `git worktree list --porcelain` alongside `git status
  --porcelain`. See ADR-0032, ADR-0037, ADR-0026, ADR-0007, ADR-0017, ADR-0028.
- **Worker branch carries source and tests only — report-carried bookkeeping (amends ADR-0032
  §3/§4/§6, agentic-workflow-ghcaj)** — a worker's private worktree/branch never writes under
  `.agentheim/` again: not its README, not an ADR, not its own task file, not a backlog item.
  Everything it would have written travels in four new fenced blocks on its `RESULT: SUCCESS`
  (`README_DELTA`, `ADRS`, `OUTCOME`, `BACKLOG_ITEMS` — `references/worker-return-format.md`;
  `BC_README_UPDATED` and the old id-only `NEW_BACKLOG_ITEMS` field are retired), parsed
  mechanically by `lib/worker-result.mjs`'s `parseWorkerResult` (four-backtick fences so an
  ADR body's own three-backtick code sample nests without ambiguity). The conductor
  materializes all of it on `main`, sequentially, at squash-merge integration, in one commit
  (ADR-0026 shape): `applyReadmeDelta` → write ADR file(s) + `finalizeAdrNumbering` (ADR-0058,
  unchanged) → append `## Outcome` to the task file → `complete` (the real `doing → done` move,
  here for the first time) → `materializeTaskFile` per backlog item → INDEX/backlink inserts.
  `lib/readme-delta.mjs`'s `applyReadmeDelta(content, {section, ops})` is a two-op grammar —
  `append` (a new bullet at a section's end) and `replace` (anchored on `(section, termHead)`,
  the bullet's bold lead-in truncated at its first `(`, whitespace-collapsed; `expected` is an
  optimistic precondition compared whitespace-collapsed) — deliberately **monotone**: no
  `remove`, no `rename-section`, no section creation, preserving ADR-0041's own invariant that
  only CONSOLIDATE (builder in the loop) may reduce a README's stated terms/invariants. A
  `replace` whose `expected` no longer matches (a sibling landed first, the conductor's own
  earlier write, or a concurrent `modeling` session) never clobbers or refuses — the conductor
  **merges both intents onto the bullet** (`disposition: 'merged'`, pcwnn's authority rule:
  never undo the other change, re-express your own on top), which is why ADR-0032's "no merge
  is ever auto-guessed" clause stays intact: there is no git conflict here to auto-resolve,
  only a prose merge the conductor — already the sole `main` writer and judgment layer — was
  always going to make. A delta naming a missing section lands as `appended-fallback` into
  `## Ubiquitous language`, never a silent drop. The checkpoint guard gained a second frozen
  prefix, `.agentheim/` (`lib/derived-artifact-guard.mjs`'s `BOOKKEEPING_PATH_PREFIXES`,
  reason `bookkeeping-path`), so a worker that still writes there is rendered inert, not
  failed — ADR-0057's posture, extended. `checkpointFiles`'s moved-from-`doing/` detection
  (agentic-workflow-w2njd) is now vestigial for the worker path (no task file ever moves
  inside a worktree again) — kept with this note, not removed; a follow-up may clean it up.
  BOUNCE no longer squash-merges at all: the conductor performs the `doing → backlog` move and
  the `## Worker note` directly on `main` from the worker's `REASON` alone. Task-file mid-batch
  annotations (`## Verifier note`, `## Salvage note`, pcwnn's `## Merge-conflict note`) are now
  conductor-written into `main`'s one copy of the task file, uncommitted between iterations —
  the worker and the verifier are always handed that same absolute path; reading never needed
  worktree isolation, only writing did. `main` now has **exactly one writer per `.agentheim/`
  file on the `work` side** of this project (the parallel `modeling`-side sibling,
  agentic-workflow-pt0gy, covers the modeling-session half of the same invariant). See
  ADR-ghcaj (amends ADR-0032, backlinked to ADR-0057, ADR-0058, ADR-0063, ADR-0041, ADR-0072).
- **Worktree-abandonment diff salvage (ADR-0063, agentic-workflow-hvqa4)** — every path that
  abandons a worker's worktree with un-merged changes still in it (FAIL-iteration-3
  escalation, BOUNCE, an orphaned worktree's "discard" disposition) captures the worktree's
  diff to a patch **before** any `git worktree remove`: `git -C <worktree> diff <fork-point>`
  written to `.agentheim/salvage/<task-id>-<tag>.patch` (`escalated-iterN` / `bounced` /
  `discarded`), gitignored, an advisory rescue artifact never deleted by `work` on its own
  initiative. Skipped on an empty diff. Named explicitly wherever the abandonment reaches the
  user — the escalation summary, the carry-over discard disposition line — not just stored.
  Closes a confirmed incident (Dorc review A1): an escalated task's already-verified fix once
  vanished with the branch it lived on. The naming/path convention is mechanized
  (`lib/worktree-salvage.mjs`, `node --test`-covered, git-free per ADR-0038); the "salvage
  before every removal" sequencing itself is prose-only, unenforced (ADR-0059) — a lint could
  only check after-the-fact artifact existence, with no reliable way to catch a skipped
  capture before the branch is already gone. See ADR-0063, ADR-0032, ADR-0037, ADR-0038,
  ADR-0027, ADR-0059.
- **Merge-back conflict ladder (ADR-0072, agentic-workflow-pcwnn)** — a real squash-merge
  conflict at merge-back no longer defaults straight to "abort and surface". A spike found no
  separate "rebase" rung exists (a squash conflict on `main` and a real `git merge main`
  inside the loser's worktree are the same 3-way merge, so they conflict on the same paths) —
  ADR-0032's named rebase enhancement is retired in favor of a seven-rung ladder: reset `main`
  + salvage the loser's diff first (`MERGE_CONFLICT_TAG` on `lib/worktree-salvage.mjs`), clean
  derived churn from the worktree (never `git stash`), a **real merge** of `main` into the
  branch (`git -C <worktree> merge --abort` is the correct undo *there* — the opposite of
  `main`'s `git reset --hard HEAD`), a **resolve-conflict dispatch to the same worker** in the
  same worktree (orientation + authority + an allow-list, rendered by
  `lib/merge-conflict-ladder.mjs`'s `buildResolveDispatchPrompt`), a fail-closed checkpoint
  (no residual `U` path, no residual marker), a **mandatory re-verify** against the new base
  (two-dot `diff main HEAD`, byte-equal to what the eventual squash stages), and builder
  escalation as the **last** rung, not the first. The ladder fires **at most once per worktree
  lifetime** — a resolve dispatch never touches the ordinary FAIL-iteration counter
  (`lib/merge-conflict-ladder.mjs`'s `createLadderState`/`onMergeBackConflict`/
  `decideAfterVerifierVerdict`/`onWorktreeTeardown`), so a post-resolve FAIL continues that
  counter from its prior value and a **second** conflict on the same worktree escalates
  without a further dispatch. `INDEX.md`/`protocol.md` are excluded from the conflict surface
  **by construction** — they are conductor-direct writes on `main` the worker branch never
  touches, so the resolution allow-list can never contain them. Unmerged-path parsing (plus
  the fail-closed `AA`-under-`knowledge/decisions/` guard, ADR-0058) is mechanized in
  `lib/merge-conflict-ladder.mjs`; the seven-rung sequencing itself is prose-only, unenforced
  (ADR-0059), same posture as ADR-0063's own salvage-ordering rule. Six governing git facts
  (disjoint-hunk squash order-independence, the squash-vs-real-merge abort asymmetry, the
  two-dot-diff/squash equivalence, the dirty-tracked-file refusal, an untracked ignored dir's
  immunity to both) are pinned by `lib/test/git-facts-merge-conflict.test.mjs` — a **bounded,
  test-only exception** to "`lib/` is git-free" (ADR-0038): it shells out to real `git`, but
  only inside a throwaway repo it creates itself via `fs.mkdtempSync(path.join(os.tmpdir(),
  ...))`, never an env-derived path, never this project's own repo, and `test.skip`s entirely
  when `git --version` fails. See ADR-0072, ADR-0032, ADR-0037, ADR-0063, ADR-0038, ADR-0057,
  ADR-0058, ADR-0059.
- **Derived-artifact checkpoint guard (ADR-0057, agentic-workflow-q7v3k)** — workers never
  stage or merge a rebuilt `dashboard/dist/` (it is derived, bundled output, ADR-0003; the
  conductor rebuilds it from **merged** source at integration). Running the test suite
  rebuilds `dashboard/dist/` inside a worker's worktree unavoidably
  (`dashboard/test/dist-build.test.mjs`'s `before()` hook does this on every run) — this is
  expected and harmless *in the worktree*, and no longer relies on any prompt-level
  prohibition holding. Enforcement lives at the one seam a rebuilt artifact must cross to
  reach `main`: the conductor's checkpoint stage, before the wip-commit. `lib/task-lifecycle-
  cli.mjs`'s `checkpoint` verb (wrapping `lib/derived-artifact-guard.mjs`'s
  `partitionCheckpointFiles`) filters the worker's `FILE_LIST` into `{changed, refused}` —
  `refused` (today: any `dashboard/dist/` path, segment-boundary matched, plus anything
  resolving outside the worktree) is silently dropped from `git add` and never fails the
  task. The conductor's own sanctioned rebuild, on `main` at integration, never routes
  through `checkpoint` at all — it isn't exempted by an actor check, it is a different code
  path by construction, since `checkpoint` only ever runs against a worktree. `checkpoint`
  also closes a second gap in the same seam (agentic-workflow-w2njd): a worker's `FILE_LIST`
  (or the conductor's BOUNCE fileList) only ever names the task file's NEW lifecycle location
  (`done/` or `backlog/`); the moved-from `doing/` path — every task's known starting folder,
  ADR-0032 — is detected from that one entry and folded into `changed` too, so `git add
  <changed>` stages the deletion half of the rename, not just the addition. Without this, the
  wip commit's tree held the task file in both lifecycle folders at once. See ADR-0057,
  ADR-0003, ADR-0032, ADR-0038.
  **Post-ghcaj (agentic-workflow-ghcaj):** `refused` is no longer a single family — the guard
  now refuses two prefix lists, `derived-artifact` (`dashboard/dist/`, unchanged) and
  `bookkeeping-path` (`BOOKKEEPING_PATH_PREFIXES`, `.agentheim/`), since the worker branch
  carries source and tests only and any `.agentheim/` write it still made in its worktree is
  silently dropped the same way. The moved-from-`doing/` detection described above is now
  vestigial: a worker's `FILE_LIST` never names a task file at all (it names source and test
  paths only), and no task file ever moves inside a worktree — the conductor performs the one
  `doing → done`/`doing → backlog` move directly on `main` at integration. Kept, not removed,
  pending a follow-up cleanup task.
- **Vision-conformance check (session-end, ADR-0040, agentic-workflow-v6d4n)** — a bounded
  advisory pass folded into `work`'s end-of-run reporting, closing the Why→What loop. It reads
  exactly two named `vision.md` sections ("What success looks like", "Non-goals") plus the
  batch's completed-task summaries, and asks one judgment question per shipped task: does it
  pull toward a non-goal or away from a success criterion? It **never blocks** — always a
  `**Vision-conformance:**` protocol line, and, only when a flag is worth attention, an
  (over)write of the same single-latest `.agentheim/state/whats-next.md` artifact `whats-next`
  writes. LLM judgment is exercised by `evals/vision-conformance-check/`'s fixtures; the
  deterministic extraction/formatting halves are unit-tested.
- **Vacuum guard & batch-mix visibility (ADR-0064, agentic-workflow-qz1h7)** — an empty ready
  set / backlog is a *user decision waiting*, not agent fuel. When `work`'s Phase 2 finds zero
  ready tasks across every BC, `modeling`'s Opening flow finds an empty backlog, or `whats-next`
  reaches its empty-board rung (Step 2 rung 5), all three check
  `vision.md`'s "## Open questions" section (via `lib/vacuum-guard.mjs`'s `extractOpenQuestions`,
  which excludes already-resolved struck-through items and reads each remaining item's
  `(open since YYYY-MM-DD)` annotation). **The session refuses to self-generate substitute
  filler unconditionally, the moment the ready set/backlog is found empty** — no manufactured
  chore, no unrelated harness cleanup — regardless of whether `extractOpenQuestions` then turns
  up anything to point at instead (refusal-placement fix, agentic-workflow-f3wqm/ADR-0069
  amending this ADR: the original prose had nested the refusal inside the "open items exist"
  branch, so an empty board with a fully-resolved Open Questions section had no textual refusal
  to hold it). When genuinely open items exist, the session additionally
  surfaces the decision(s) with their age (`formatVacuumGuardLine`, e.g. "Brainstorm on
  existing code (next iteration). (open 46 days)") as the highest-leverage builder action
  available. **The exit itself still writes a minimal session-end protocol entry**
  (`## ... -- Work session ended` heading, `Type: Work / Session end`, `Completed: 0`, one line
  noting the vacuum exit — agentic-workflow-c5nvb) rather than skipping the boundary entirely:
  without it, `resolveSinceLastSessionEnd`'s window reaches back past the vacuum-guard session
  and the session-start human-churn reconciliation below re-flags the same untrailed commits
  every subsequent session. No batch-mix line, vision-conformance pass, or carry-over
  reconciliation runs for this minimal entry — it exists solely to give the *next* session's
  churn check a boundary. Session-end also gains a **batch-mix line**: every completed task is classified
  product-facing / harness / bookkeeping by `classifyTask` (type `feature`/`decision` →
  product-facing; type `chore` whose touched files are entirely protocol/INDEX/state surfaces →
  bookkeeping, else harness; type `bug`/`refactor` whose touched files are entirely product
  surfaces (none under `lib/`, `skills/`, `agents/`, `references/`, `evals/`, or
  `.agentheim/knowledge/decisions/`) → product-facing, else harness — consumer-tuning,
  agentic-workflow-r4gcz, so a consumer project's own product bug-fixing/refactoring session no
  longer reads as false-positive meta-work drift; everything else, e.g. `spike` → harness
  unconditionally), rendered by `formatBatchMixLine` into
  the protocol entry's `**Batch mix:**` line, so drift toward meta-work is visible per session
  instead of discovered a week later (Dorc review recommendation A2). Both halves are advisory,
  never a gate — an explicit builder request always overrides the guard (vision non-goal 3). The
  open-question annotation convention and the batch-mix classification are both mechanized
  (`lib/vacuum-guard.mjs`, `node --test`-covered, git-free per ADR-0038) per ADR-0059's
  mechanize-or-drop doctrine. See ADR-0064, ADR-0040, ADR-0027, ADR-0059, ADR-0038.
- **Remediation-over-diagnosis / spike stop-loss (ADR-0065, agentic-workflow-rx630)** — two
  coupled doctrine changes closing Dorc review recommendation A5. (1) **Dispatch ordering**
  (`skills/work/SKILL.md` Phase 3 step 4, and mirrored as `whats-next`'s own tiebreak at its
  Step 2 rung 2): a ready remediation task whose root cause is already
  diagnosed and whose fix is cheap outranks a ready further-diagnosis `spike` on the **same
  thread** — shared `tags`, a `depends_on`/`blocks` link, or a `prior_art` link. Ordering only,
  never a gate: a builder who explicitly wants deeper diagnosis still gets it. (2) **Spike
  stop-loss**: every `type: spike` task carries a standing clause — "if, mid-spike, the
  mitigation is already known and cheap, record it and stop" — and a worker ending a spike
  early on that clause records the mitigation in `## Outcome` and completes normally; this is
  a legitimate completion, not a bounce or fail. The ordering half is prose-only, unenforced
  (ADR-0059) — it's a judgment call the same shape as the existing planning-advisory weighting.
  The stop-loss clause ships enforcement: `lib/spike-stop-loss.mjs` is a date-grandfathered
  live-tree lint (mirrors ADR-0060's shape) flagging any `type: spike` task minted after
  adoption whose body lacks the clause. **Amended (agentic-workflow-t8kfq):** the two halves
  originally fought the verification path itself — an early-stopped spike's unmet
  fuller-diagnosis criteria got FAILed by verifier check 1, and a same-thread remediation
  stranded in `backlog/` (rather than `todo/`) raised no dispatch signal at all. Verifier check
  1 (`agents/verifier.md`) now carves out the ADR-0065 early-stop case explicitly — it checks
  the recorded mitigation, not the skipped diagnosis — and `skills/work/SKILL.md` Phase 3 step
  4 now surfaces (advisory only, never a gate, never an auto-promote) a same-thread remediation
  found unpromoted in `backlog/` when dispatching a same-thread spike. Both additions are
  prose-only/unenforced per ADR-0059, same shape as the ordering half. See ADR-0065.
- **Session-start human-churn reconciliation (ADR-0066, agentic-workflow-hhjjx)** — the
  mirror image of `agentic-workflow-d6q4h`'s session-**end** carry-over reconciliation, at
  the other end of the session, closing the third and final piece of Dorc review
  recommendation A6. Once per session, at the end of `work`'s Phase 1, before Phase 2:
  resolve the last `## ... -- Work session ended` protocol entry as a boundary
  (`lib/session-start-churn.mjs`'s `resolveSinceLastSessionEnd`; a fresh project with no
  such entry skips silently), have the conductor read `git log --since=... --name-only
  --format="%x1eCOMMIT%x1f%H%x1f%s"` (a prose step, never a `lib/` git read, ADR-0038),
  and filter to commits carrying no `[<task-id>]` bracketed trailer (ADR-0026) via
  `parseCommitLog`/`findUntrailedCommits`. **Consumer-tuning amendment (agentic-workflow-pzacx):**
  `partitionUntrailedCommits` then mechanically splits that set into recognized known-machine-shape
  commits and genuinely human ones, via `recognizeMachineShape`'s closed, deterministic pattern
  set matching every trailer-less row of `references/commit-doctrine.md`'s three tables — its
  "Message convention" table's four trailer-less rows (`modeling` DISMISS, `modeling` CONSOLIDATE
  — an audit-found gap every prior enumeration omitted — `brainstorm`'s session commit, and
  `research`'s report-cleared-review commit, added mid-session by agentic-workflow-n3bbk and
  initially missed here too until an iteration-2 verifier catch), its "`work`'s own
  non-task-commit shapes" table's four bare fallback rows reached only when a session completes no
  task (reconcile-stranded-carry-over, session-end bookkeeping, both rotation commits; batch-start
  and BOUNCE integration always carry a trailer, so they're never on this list), and its
  "Batch-capture and release-flow shapes" table's three rows added by agentic-workflow-m7xva (a
  legacy trailer-less batch-capture summary commit, the release-manifest-bump commit, and the
  release protocol-record commit whose `[work]` token is a sanctioned pseudo-trailer given its
  own row) — eleven entries total. The commit-doctrine.md paragraph describing this mechanism
  had drifted out of sync a third time by the same task; per ADR-0068 it is now a one-line pointer
  to `lib/session-start-churn.mjs`/this ADR rather than a fourth restatement. The skill prints
  one summary line — `formatChurnSummaryLine`'s "N recognized
  machine-shape commits, M human commits" — then judges (not the git-free `lib/` helper) which
  touched files land on a governed surface — an ADR-described file, or one a BC README documents
  as load-bearing — and **itemizes only those governed-surface hits** (`formatUntrailedCommitLine`
  per hit), plus, when a governed hit exists, a `whats-next.md` write (ADR-0027) recommending the
  builder approve an explicit re-alignment task. Advisory only: never auto-files a task, never
  gates Phase 2. A subject matching none of the known shapes is still counted as human, unchanged
  — recall over precision on the genuinely-unknown case is exactly as before; only the
  hand-maintained prose enumeration of the *known* shapes (which drifted twice in one week —
  agentic-workflow-d7ksw, agentic-workflow-c5nvb) is now mechanized. See
  ADR-0066, ADR-0026, ADR-0027, ADR-0038, ADR-0059.
- **Audit-closure doctrine (ADR-0069, agentic-workflow-f3wqm)** — closes the recurring
  "did we miss something?" loop: undispositioned judgment residuals get re-found by every
  fresh audit, and un-mechanized finding classes recur by construction. Three parts. **(1)
  Dispositioning residuals** — a residual from a consistency audit gets fix or
  decline-with-rationale, ADR-0067 posture (revisit-on-evidence, never silent); this ADR's
  own three dispositions are the exemplar (vacuum-guard refusal-placement fixed — see the
  amendment on the *Vacuum guard* entry above; cross-task metric-drift blindness declined
  pending incident; untyped investigation tasks declined pending incident, but nudged toward
  `type: spike` in `modeling`'s field legend). **(2) The audit PASS bar** — an audit passes
  when it yields zero findings of class contradiction / lost-rule / code-doctrine-behavior-
  mismatch; cosmetic classes (stale pointers, counts, wording) are fixed-or-dismissed the same
  session, never carried; declined judgment findings land as ADR dispositions the same wave.
  **(3) Dated audit stamp + delta-scoping** — each audit appends a dated entry to
  `.agentheim/knowledge/audit-log.md` naming the bar applied, the verdict, the HEAD audited,
  and any open dispositions; the next "did we miss something?" audit scopes to the diff since
  the last stamp plus that stamp's open dispositions, not a full-tree re-audit, unless the
  builder explicitly asks for one. The PASS bar and the stamp convention are both **prose-only,
  unenforced** (ADR-0059) — audit conduct is conductor/auditor judgment, not lintable. **(4)**
  ships a fourth, orthogonal, MECHANIZED piece: `lib/doctrine-line-pointer.mjs`'s live-tree
  lint bans raw line-number pointers (`~:NNN`, `(:NNN-NNN)`, `file.md:NNN`, `#LNNN`) in
  `skills/`/`agents/`/`references/` prose — doctrine must cite another passage by a greppable
  anchor (a step/section/rule name) instead, since a raw line number silently goes stale the
  moment the referenced file is edited (the class recurred across three consecutive audits).
  See ADR-0069, ADR-0067, ADR-0064, ADR-0059, ADR-0061.
- **README consolidation trigger / CONSOLIDATE (ADR-0041, agentic-workflow-w7q2m)** — a BC
  `README.md` at or over **~600 lines** has crossed the point where it can no longer reliably
  be read in one pass (this BC's own README, at 1006 lines, was the case that forced this
  decision). `whats-next` surfaces an over-threshold BC as a recommended-move line (`README
  <bc> is over the consolidation threshold — consolidate`); no skill auto-rewrites prose
  unattended. The `modeling` skill's fifth action, **CONSOLIDATE**, does the rewrite **in
  place**, builder-in-the-loop: merges redundant ubiquitous-language entries, folds superseded
  per-feature narration into settled summaries, never silently drops a term or invariant, never
  breaks a backlink. This is the **flag-and-consolidate** discipline (judgment, in-place, no
  archive) — the deliberate opposite of the k5n8f family's **cap-and-roll** (verbatim, scripted,
  archived) used for the protocol (ADR-0039). See ADR-0041, ADR-0022, ADR-0026, ADR-0027,
  ADR-0017.
- **Tree projection** — the single read model every dashboard view and the SSE consumer rebuild
  from. `GET /api/tree` (`dashboard/tree.mjs`, agentic-workflow-005) walks `.agentheim/` and
  returns, per BC, its four lifecycle folders, each task's frontmatter projection (`id, title,
  status, type, context, path, mtimeMs, dependsOn, blocks`), and the *locations* of vision /
  context-map / BC READMEs+INDEXes+concepts / ADRs / research — pointers and metadata only,
  never document bodies. ADR/research locations carry an additive `mtimeMs` meta map so the
  read-only dashboard can distinguish a modified doc from an untouched one (stat failure
  degrades to `mtimeMs: null`). `project.name` is parsed from `vision.md`'s heading — the one
  projection value drawn from a document body rather than frontmatter. `dependsOn`/`blocks`
  are raw, unresolved id arrays (resolved client-side, pooled across BCs). Every read is
  loss-tolerant: missing/malformed frontmatter falls back to folder/BC name. Document bodies
  are carried separately by `GET /api/doc?path=<in-root path>`. Both endpoints are pure reads,
  share the `startsWith(root)` guard. See ADR-0002.
- **Identity-stable projection** — `treeToColumns` reconciles against the previous
  projection: a task whose projected ticket is value-equal to the prior one keeps the
  **same object**. Re-projecting an unchanged tree therefore commits nothing, and a
  single task move re-renders a single card. Memoized `BoardCard`/`BoardColumn` depend
  on this — without it a re-fetch allocates fresh objects and every shallow prop
  compare fails. Consumers may rely on the identity. See board-data.js.
- **Content search** — `GET /api/search?q=<term>` (`dashboard/search.mjs`, agentic-workflow-050,
  ADR-0023) is the read-only server's first endpoint to open document *bodies* in bulk: a pure
  walk/rank/excerpt core (stdlib-only, loss-tolerant, mirroring `tree.mjs`). Returns `{ query,
  results: [...] }`, matching **title + body only** (frontmatter never searched),
  case-insensitive substring. The corpus is single-sourced from the tree projection (Bounded
  contexts → Concepts → Decisions → Research → Tickets), so a new artifact kind becomes
  searchable for free. Ranking is title-hits-first, then fixed category order. Results carry
  the existing open-intent shapes (ADR-0021). An empty/short (`< 2` char) query returns no
  results with no walk. Pure read, writes nothing (ADR-0017). The topbar UI that consumes it is
  under *Global search* below.
- **Dashboard frontend app** — the live dashboard UI, owned by this BC, living in
  `dashboard/app/` (entry `dashboard/app/app.js`). It *consumes* the design-system styleguide
  source across the BC boundary (`Column`/`TicketCard`/`ColumnHeader`/`EmptyColumn`/`html`
  as-is, never forked) so the styleguide stays the single source of UI truth (ADR-0003).
  esbuild bundles this app into the committed `dashboard/dist/` the static handler serves; the
  styleguide canvas remains a separate buildless review surface. The three original view tasks
  — **board** (agentic-workflow-006), **slide-over** (aw-007), **library/navigation** (aw-008)
  — compose into this one app shell (see *Shell layout* below for the current rail/topbar
  composition). See ADR-0009, ADR-0011.
- **Board view** — the dashboard's home view (agentic-workflow-006): a **flat** Kanban of the
  four lifecycle columns (`backlog`/`todo`/`doing`/`done`) pooling tasks from **all** bounded
  contexts — no swimlanes; each card carries its BC via the styleguide `context` chip. Rendered
  over the live tree projection; a status-driven, loss-tolerant transform
  (`dashboard/app/board-data.js`) buckets each task by status (unknown status → backlog).
  **Read-only** (ADR-0017): clicking a card emits an *open-this-task* intent the slide-over
  consumes; the board never writes a lifecycle move. It stays **live** via the SSE stream,
  re-fetching `/api/tree` on any change. Backlog cards carry a *Refine / Promote* launch pair
  (see below) to seed `modeling` commands. See ADR-0009, ADR-0017.
- **Board-wide sort + grouping — the "View" chip** (agentic-workflow-012/014, rebuilt
  **board-wide** by agentic-workflow-c2ver per the ADR-0015 amendment landed by
  agentic-workflow-qf945): ONE `ViewChip`, composed on the shared `Menu` primitive (ds-015)
  unforked, drives sort + group-by-bounded-context **identically for all four lifecycle
  columns** — no column keeps an independent affordance. The chip's trigger summarizes the
  live choice ("Recently modified" / "Recently modified · grouped by context"). Orderings:
  **Name** asc/desc and **Modification-date** desc/asc (per-task `mtimeMs`); default is
  modification-date descending. `dashboard/app/board-sort.js` (`sortTickets`, unit-tested) is
  a **pure** function run board-side after `treeToColumns`; ties break by `id` ascending,
  absent/`null` `mtimeMs` sorts oldest, never a throw. Toggling group **on** partitions each
  column's cards into per-BC sections (header = BC name + card count; empty BCs render no
  section; sections sort BC-name ascending); each section is independently **collapsible**,
  **per column** (unchanged granularity — see the next bullet). Pipeline is **project → sort
  (board-wide, board-sort.js) → group (board-wide, board-group.js) → per-column collapse/peek
  applied locally** — grouping only partitions, never re-orders, so sort semantics hold inside
  each section. `groupTickets` (`dashboard/app/board-group.js`, unit-tested) is **pure**. Both
  the sort and grouped choice **persist** across reloads in the versioned `localStorage`
  view-state store as ONE board-wide `lens` (ADR-0015 amendment); a board with no stored lens
  defaults to flat + default sort. The collapsible section header is board-local (the
  styleguide `TreeGroup` primitive doesn't fit externally-persisted collapse state on
  `TicketCard`s — flagged as design-system-005 for a shared primitive). See ADR-0015,
  ADR-0009, ADR-0003.
- **Collapsible Done column** — the **Done** column (the one column that grows unbounded)
  carries a board-only **collapse/peek** control (agentic-workflow-m2v8d, replacing aw-072's
  hide control), a sibling of the sort/group controls (ADR-0003). A **double-chevron glyph
  swap** (`chevrons-up` expanded ⇄ `chevrons-down` collapsed, not a CSS rotate) toggles a
  **height-clamped peek** of the most-recent completions — `max-height` ≈3.5 average cards +
  `overflow: hidden` + a bottom `mask-image` gradient fade (a visual height target, not a node
  count). The clamp is **orthogonal to grouping**: one `max-height` on the whole column body,
  never per-section. **Expanded by default**; the choice persists via the board view-state
  store (the additive `peek` boolean). Collapsing is **presentation-only** — no `/api` write,
  Done's tasks still exist on disk (ADR-0017/ADR-0001). The clamp is derived at render by the
  pure `peekClampStyle` (`board-view-state.js`, unit-tested). See ADR-0015, ADR-0017, ADR-0003.
- **Hover dependency ring — "pulse what's rendered"** (agentic-workflow-k5p8w, building on the
  `dependsOn`/`blocks` raw id arrays the projection carries and the styleguide's directional
  ring, design-system-w4t9k / ADR-0034): hovering a **backlog** or **todo** card resolves its
  edges against the **full pooled ticket set** and rings each currently-rendered target —
  **solid** for a `depends_on` target (waiting-on), **dashed** for a `blocks` target
  (holding-up). Only backlog/todo cards are a hover *source*; a target can be any status. The
  resolution is a **pure** function, `resolveHoverDependencies`
  (`dashboard/app/board-dependencies.js`, unit-tested): dangling ids drop silently, ids dedupe,
  the hovered card's own id excludes, and a malformed id present in both lists resolves
  **waiting-on wins** (never a throw). The React glue (`hostHover` idiom, `board.js`) is thin,
  untested DOM wiring — transient, client-side only, never persisted (ADR-0017). Deliberately
  **excludes** collapsed-group markers, Done-peek markers, and off-viewport edge blinks — that's
  the next entry's layer. See ADR-0002, ADR-0003, ADR-0017.
- **Hidden and off-viewport dependency markers — "signal what isn't [rendered]"**
  (agentic-workflow-h9v3m, closing the gap k5p8w left, consuming design-system-b7n2s's
  primitives): the same hover session classifies every resolved target id into one of three
  states. **(1) Hidden in a collapsed group** — a pure, data-layer derivation, no DOM
  (`annotateSectionHiddenDependency`/`donePeekHasHiddenDependency`,
  `dashboard/app/board-dependency-groups.js`), flagging a collapsed section or peeked Done
  column holding a target id, wired onto the section header. **(2) Visible vs. off-viewport** —
  an `IntersectionObserver` on the app's sole scroll container, mounted only for an active
  hover, classifies a rendered-but-not-intersecting target **above/below** via the pure
  `classifyEdge(rect, rootBounds)`, driving a board-built edge indicator pinned to the scroll
  container's edge (scroll-reactivity is free). **(3) Done-peek refinement** — one bounded rect
  check against the clamp body tells "genuinely below the clamp" from "still visible". Every
  read is **transient hover-scoped presentation state only** — no disk write (ADR-0033 pt. 4).
  The data layer is fully `node --test`-covered; the observer wiring is untested DOM glue. See
  ADR-0033, ADR-0017, ADR-0014, ADR-0029.
- **Persisted board view-state (v2, board-wide lens)** — persisted across reloads in a
  **single versioned `localStorage` store** (`dashboard/app/board-view-state.js`, key
  `agentheim.board.viewState`; agentic-workflow-014/aw-c2ver, ADR-0015). `VIEW_STATE_VERSION`
  is **2**: the store now carries two independently-scoped pieces — a **board-wide `lens`**
  (`{ grouped, sort }`, ONE choice for the whole board, driven by the single ViewChip) and
  **`columns`** (the per-`(column, BC)` `collapsed[]` section state + the Done `peek` flag,
  retained at their original column-scoped granularity). This **reverses** ADR-0009's
  "in-session only, no `localStorage`" clause, but the reversal is bounded to **presentation
  view-state** — the store never records lifecycle truth, which stays a pure projection of disk.
  **Dormant retention**: flipping the board-wide `grouped` flag off then back on does NOT clear
  a column's stored `collapsed[]` — it goes dormant while flat and reappears intact once
  grouping is re-enabled, because `collapsed[]` lives entirely under `columns`, untouched by the
  lens. **Hard reset on version mismatch**: a blob at any version other than `2` — including the
  retired v1 per-column shape, a stale/malformed/absent blob — degrades WHOLESALE to board-wide
  defaults (flat + default sort; every column's `collapsed: []`, `peek: false`), never a throw,
  and never a field-by-field migration attempt (deliberate, per the ADR). See ADR-0015, ADR-0001.
- **Persisted theme choice (light/dark toggle)** — the dashboard consumes the styleguide's
  "dark-first with a light toggle" `ThemeToggle` **unforked** (ADR-0003), living in the topbar
  **settings menu**, feeding `ThemeCtx.Provider` and a `data-theme` effect animated by the
  styleguide `theme-fade` transition. Resolution + persistence is a **separate** versioned
  `localStorage` store (`dashboard/app/theme-state.js`, key `agentheim.dashboard.theme`), same
  safe-degradation shape as the view-state store. **First visit** (no stored override): OS
  `prefers-color-scheme` wins; once toggled, the override is remembered. A malformed/absent
  blob degrades to the system default; the resolved theme is read once on mount so an SSE
  re-projection never resets it mid-session. See ADR-0015, ADR-0009, ADR-0003.
- **Persisted skip-permissions armed toggle** — a control in the topbar **settings menu**
  (agentic-workflow-049; introduced aw-021), **off by default**, that when **armed** makes
  **every** bridge launch (Quick Capture / Modeling / Inquire / Research, Work, and the
  per-card Refine/Promote/Dismiss pair) request a skip-permissions session: `launchOrCopy`
  threads an optional `skipPermissions` flag through its one shared seam, POSTing
  `{ prompt, skipPermissions: true }`; the bridge (infrastructure-016) seeds
  `claude --dangerously-skip-permissions "<prompt>"`. When **off** the field is **omitted,
  never sent `false`**, byte-identical to unarmed. The armed choice lives in its own versioned
  `localStorage` store (`dashboard/app/skip-permissions-state.js`, default OFF) whose every
  degraded path resolves to **OFF**, never a throw, never on — presentation view-state only
  (ADR-0017/ADR-0001), carrying an **armed/danger** `--obligation` treatment (ADR-0003, never
  the reserved `--accent-ochre-soft`, ADR-0016) so it never reads as neutral. Per **amended
  ADR-0018**, when armed **each** launch button also tints its icon `--obligation`, reflecting
  the armed toggle state, never a live bridge probe; the **clipboard fallback never carries the
  bypass** (startup-only). See ADR-0019, ADR-0018, ADR-0016, ADR-0003, ADR-0015, ADR-0017,
  ADR-0001.
- **Backlog card launch pair (Refine / Promote)** — a backlog ticket invites two real next
  actions: **deepen** it or **mark it ready**. Each backlog card surfaces both
  (agentic-workflow-022) as a **two-button launch group** in the styleguide `TicketCard`'s
  `cornerAction` slot (design-system-006). **Refine** (primary) seeds `/agentheim:modeling
  refine <id>`; **Promote** (quiet) seeds `/agentheim:modeling promote <id>` — explicit verbs
  matching `modeling`'s routing, **backlog-only** since Promote only ever runs backlog → todo.
  Each button opens a real interactive Claude session through the VS Code **bridge**
  (ADR-0018), falling back **silently** to a clipboard copy when absent (`launchOrCopy`, shared
  with every other launch). Command strings are pure functions of the id
  (`refineCommandFor`/`promoteCommandFor`, `dashboard/app/modeling-command.js`, unit-tested).
  The **add-ticket affordances are backlog-only** too (agentic-workflow-018): `EmptyColumn`'s
  "Add ticket" and `ColumnHeader`'s `+` are optional slots keyed off `onAdd` (default OFF) —
  the board is a projection of disk (ADR-0001). See ADR-0018, ADR-0003, ADR-0009, ADR-0001.
- **Todo card launch (Work)** — the topbar's standing Work button (agentic-workflow-024)
  launches the **bare** `/agentheim:work`, dispatching the whole ready set; a todo card
  sometimes needs to run **alone**. Each todo card surfaces a single-button **Work** launch
  (agentic-workflow-g4zce) in the same `cornerAction` slot the backlog pair uses
  (design-system-006), styled primary with a trailing `↗` glyph like the topbar Work button
  (agentic-workflow-064). It seeds the **scoped-run grammar** `/agentheim:work` gained in
  ADR-0071 — `/agentheim:work <id>` runs exactly that task, never the whole ready set — via
  `workCommandFor(id)` (`dashboard/app/modeling-command.js`, unit-tested), through the same
  `launchOrCopy` bridge/clipboard path and armed-`skipPermissions` cue as every other launch.
  The top-right dismiss trash can (below) still applies to todo cards; the two coexist without
  overlap (bottom-right vs. top-right). See ADR-0071, ADR-0018, ADR-0003, ADR-0017, ADR-0001.
- **Board card dismiss (hover-revealed trash can)** — a **backlog** or **todo** ticket
  sometimes just needs to go away. Each such card carries a **red trash-can button** in its
  **top-right corner** (agentic-workflow-048): hidden at `opacity: 0`, revealed on hover or
  focus. **Backlog + todo only** — doing/done never show it (DISMISS refuses those states,
  ADR-0022). It's a board-local overlay, not the `cornerAction` slot (Refine/Promote's home) —
  `TicketCard` stays **unforked**. The trash glyph (design-system-017) is `--obligation`-tinted
  (ADR-0016). Clicking opens the shared **`ConfirmDialog`** (design-system-018, unforked) with
  `destructive=true`; **Confirm** fires `/agentheim:modeling dismiss <id>` (`dismissCommandFor`,
  unit-tested) through `launchOrCopy`; Cancel/Esc/scrim-click close it with no effect. The
  board is **read-only** (ADR-0017): the button only *seeds-and-fires* — the spawned `modeling`
  session runs the full **cascade** dismiss with its own re-confirmation of the dependent
  subtree (ADR-0022). Threads the armed `skipPermissions` signal (agentic-workflow-051) like
  every other launch. See ADR-0022, ADR-0017, ADR-0018, ADR-0019, ADR-0003, ADR-0016.
- **Board prompt bar — the docked two-row console (Quick Capture / Modeling / Inquire /
  Research / Plain)** — rebuilt (agentic-workflow-bz3az) from aw-023/aw-065/aw-068's board-flow
  "Prompt" title + row of flat launch cards into the 1b **docked bottom-center console**, then
  conformed exactly to Section 1b's layout by agentic-workflow-q7r3x, then given a **fifth mode,
  Plain**, by agentic-workflow-m3vhq:
  `position: fixed`, ~780px, a raised `--surface-1` panel at the `--shadow-lg` elevation, above
  the board in z-order — so it never pushes board content and stays put through the aw-067
  `scroll-quiet` scroll. Two rows, separated by a horizontal `--hairline` divider: a **top row of
  FIVE EDGE-TO-EDGE, equal-width mode-tab cells** (`PromptModeTab`, one per `PROMPT_MODES` entry —
  Quick Capture · Modeling · Inquire · Research · Plain, each a name + one-line meaning), no
  inter-cell gap, no horizontal panel padding on the row — the panel's own `overflow: hidden` +
  `border-radius` clip the row's two end cells to the shell's rounded corners instead. A thin
  `--hairline` divider sits on the trailing edge of every cell but the last. Subtitles read,
  lowercased and fuller: *file it fast, no ceremony* (Quick Capture) · *shape into structure*
  (Modeling) · *ask the codebase* (Inquire) · *dig deeper* (Research) · *straight to Claude, no
  skill* (Plain). Glyphs are the concrete design-system-xr4sb set, consumed unforked (ADR-0003)
  from `styleguide/app/icons.js`: `plus` (Quick Capture) · `diamond` (Modeling) ·
  `message-circle-question` (Inquire, its deliberate design-system-r4k8m glyph, unchanged) ·
  `circle-dot` (Research) — `diamond`/`circle-dot` replace the undeliberate `compass`/`search`
  defaults Modeling and Research previously wore — · `bot` (Plain, an existing glyph reused, no
  new icon). The **bottom row** carries a bright, bold ochre `❯` chevron, a genuinely
  **multi-line auto-growing** `<textarea>` (soft-wraps, grows to a max then scrolls — aw-038's
  growth band, unchanged; the re-measure that grows/shrinks it is driven by a single
  `useLayoutEffect` keyed on `prompt`, not a per-call-site `autoGrowField` invocation —
  agentic-workflow-vsg9d moved it there after a direct call from `onResult` was found to measure
  the textarea's DOM *before* React had committed the post-launch clear, leaving the field
  visibly stuck at its grown height until the next keystroke), and (agentic-workflow-m2vkp) the
  styleguide's **`ModelSplitButton`**
  primitive (`styleguide/app/button.js`, design-system-r9dtm, ADR-0003, consumed unforked) as the
  **one** launch affordance — the old bordered `↵` keyboard hint span is **deleted outright**, its
  "Enter launches · Shift+Enter for a new line" affordance folded into the split button's
  tooltip/`aria-label`. `ModelSplitButton` widens the prior `EnterButton` (now unused by this bar)
  into a labelled split button: a primary region (the solid-`--accent-ochre` fill, the
  `corner-down-left` glyph in `--accent-ochre-fg`, plus the current model's name) that launches
  exactly as `EnterButton` used to, and a caret that opens a model menu — never launching itself.
  `locked` (Quick Capture, or no bridge reachable) renders **no caret region at all**, not merely
  a disabled one. Wrapped in a plain `<span title=...>` (not a fork) so the tooltip can still
  reflect the live seeded command **and** which model will run it, **or** (agentic-workflow-m3vhq)
  the reason the launch can't fire yet.
  - **Keyboard-committed selection model (ADR-0050, amended by agentic-workflow-p8k4d,
    agentic-workflow-m3vhq, agentic-workflow-aqyqd, agentic-workflow-tkq7v, and
    agentic-workflow-m2vkp, `dashboard/app/prompt-mode.js`)** — the
    five modes carry a single committed `highlightedMode` **index**, not five independent
    booleans: `PROMPT_MODES` (fixed order, each `{label, subtitle, icon, commandFor}` — no
    `requiresPrompt` key on any entry; aqyqd retires it, see below), `clampPromptModeIndex` (the
    one in-range guard every call site uses,
    now bounding `0..4`), `nextPromptModeIndex(current, direction)` (total, wrapping cycle —
    forward past Plain wraps to Quick Capture, backward before Quick Capture wraps to Plain), and
    `promptBarKeyIntent(event)` (classifies every keydown into exactly one of **launch** — bare
    Enter OR Ctrl+Enter (p8k4d: bare Enter now launches, reversing aw-038's original swallow
    rule; Ctrl+Enter is kept as a harmless alias) — **newline** — Shift+Enter, regardless of Ctrl
    (p8k4d, new: lets the textarea insert its own line break natively, retiring aw-038's
    single-logical-line collapse — `sanitizePromptLine` is deleted, the field stores its raw
    value) — **cycle** — Tab (no Ctrl/Alt) or Shift+Tab (agentic-workflow-tkq7v reverses the
    original Ctrl+←/→ trigger, freeing native word-jump/word-select inside the now-multi-line
    field; Ctrl+Tab/Alt+Tab stay pass-through so browser tab-switch chords are never shadowed) —
    **cycle_model** — Ctrl+M (agentic-workflow-m2vkp, ADR-0050's fifth amendment; see the model
    axis below) — or **pass-through**, so no keystroke is ever double-handled;
    **untouched by m3vhq** — bare Enter on an empty Plain prompt still classifies as `launch`).
    **Escape blurs the prompt textarea** (agentic-workflow-tkq7v — checked in `onPromptKeyDown`
    ahead of `promptBarKeyIntent`, not a sixth intent label — the WCAG 2.1.2 keyboard-trap
    mitigation for hijacking Tab while the field has focus; it never clears the typed prompt).
    Defaults to Quick Capture (index 0) on mount. **The mode highlight SURVIVES a successful
    launch** (agentic-workflow-m2vkp reverses the Decision's original "resets to 0" clause —
    `onResult` no longer calls `setHighlightedMode`; firing three Modeling prompts in a row no
    longer means re-selecting Modeling three times). **Two orthogonal channels:** the committed
    highlight changes only on a deliberate act — a tab click, or Tab/Shift+Tab — hover is a
    separate, transient, presentation-only channel that never reads or writes it. The
    **Launched/Copied flash is a third, independent channel** (agentic-workflow-spv0k, ADR-0050's
    fifth [historically-numbered fourth] amendment): `BoardPromptBar` tracks a `firedMode` index,
    set inside `fire()`'s own success branches to the mode that actually launched, and
    `PromptModeTab` paints its flash from `firedMode === index`, never from `highlighted` — this
    independence is now simply how the two pieces of state relate, since m2vkp retired the reset
    the flash fix was originally written to survive. **p8k4d reverses click-to-launch:** clicking
    a tab now **only** moves the committed highlight; it no longer fires anything. The ONE
    `fire(modeIndex)` function in `BoardPromptBar` is now reached only by bare Enter, Ctrl+Enter,
    or the split button's primary region — all three behaviourally identical: the same seeded
    command (reached via `PROMPT_MODES[i].commandFor(prompt)`), the same `launchOrCopy`
    bridge-or-clipboard path, the same armed `skipPermissions` thread, the same `onResult`
    clear-textarea + confetti (no longer a highlight reset). **Ctrl+Space** (p8k4d, new) focuses
    the prompt `<textarea>` from anywhere on the board via a window-scoped `document` keydown
    listener (registered/torn down in a `useEffect`) — the same listener now also handles Ctrl+M
    (agentic-workflow-m2vkp, see below). **Decline-to-launch, generalized to every mode
    (introduced Plain-only by agentic-workflow-m3vhq, generalized by agentic-workflow-aqyqd —
    ADR-0050's third amendment)** — the prompt bar is a prompt console: with no prompt there is
    nothing to send, in **any** mode, not just Plain. The one predicate `canFirePromptMode(index,
    prompt)` decides this — `true` exactly when the trimmed prompt is non-empty, for every index
    alike (`index` is kept in the signature for call-site/test stability but is deliberately
    **unread** — the `requiresPrompt` per-mode flag m3vhq introduced is **retired entirely**, not
    set `true` on all five entries: once there is no exception, the per-mode axis is a fiction) —
    consulted by **both** `fire()`'s guard (a decline is a true no-op: no bridge call, no
    clipboard, no confetti, no highlight/model change) **and** the split button's `disabled` state
    (the styleguide `ModelSplitButton`'s `disabled` prop, consumed unforked — never a
    `pointer-events` fake). When disabled, the tooltip/`aria-label` read *"Type a prompt to launch
    \<Label\>"* for whichever mode is highlighted, rather than rendering an empty/bare command
    string. The four legacy modes' bare-command constants
    (`QUICK_CAPTURE_COMMAND`/`MODELING_COMMAND`/`INQUIRE_COMMAND`/`RESEARCH_COMMAND`,
    `modeling-command.js`) and their empty-prompt degrade branches are **left in place** —
    correct, pure, unit-tested — but are now unreachable from the board (bare sessions launch
    from the terminal instead); each constant carries a comment recording this so a later reader
    doesn't "restore" the bare launch by accident. `prompt-mode.js` is a fifth pure,
    framework-free, `node --test`-covered module in the `board-sort.js`/`board-group.js`/
    `search-results.js` family.
  - **The model axis (ADR-0050's fifth amendment, agentic-workflow-m2vkp,
    `dashboard/app/prompt-model.js`)** — a **second, orthogonal** committed-selection channel,
    `selectedModel`, sibling to `highlightedMode` but on a different axis entirely: not WHICH
    skill fires, but WHAT MODEL the launched session runs on. `PROMPT_MODELS` (Fable · Opus ·
    Sonnet · Haiku, each `{id, label}` — `id` is the exact short alias the bridge's
    `MODEL_ALLOWLIST` accepts, `infrastructure-h5wnq`, `vscode-extension/src/bridge.js`; a value
    outside that allowlist spawns with no `--model` flag at all, quietly), `DEFAULT_PROMPT_MODEL_INDEX`
    (Opus, the mount default), `clampPromptModelIndex` / `nextPromptModelIndex` (the same
    in-range-guard / total-wraparound shape `prompt-mode.js` established, mirrored on this axis).
    **Quick Capture pins the resolved model to Haiku** — `isModelLockedForMode` /
    `modelForMode(modeIndex, selectedModelIndex)` — as a **read-time projection, never a
    mutation**: selecting Opus on Modeling, switching to Quick Capture (which resolves and shows
    Haiku), then switching back to Modeling restores Opus, because `selectedModel` itself is
    never overwritten by the pin. `modelForMode` is the ONE resolver both the split button's label
    and `fire()`'s launch payload consult. **No bridge, no model promise — and, since
    agentic-workflow-n4qte, no STALE bridge either.** `probeBridge` (`infrastructure-h5wnq`, grown
    by `infrastructure-v8r3q`, `bridge-launch.js`) is called once on mount and stores its WHOLE
    `{ present, capabilities }` result (`bridge`, `board.js`), not a bare boolean — two distinct
    facts are derived off that one probe. **`bridgeSupportsModel`** (`present &&
    capabilities.includes('model')`) gates the ONE control a grey-out CAN cover —
    `modelLocked = !bridgeSupportsModel || isModelLockedForMode(highlightedMode)` — so a bridge
    that is present but too old to have advertised `'model'` (0.4.0 on disk, 0.2.0 running in the
    live extension host — the exact stale-host scenario `infrastructure-v8r3q` exists for) renders
    **identically locked** to no bridge at all, names no model (`"Default"`, keyed off
    `bridgeSupportsModel`, not mere presence — a locked button that still read a real model name
    would be the silent lie this task removed), and Ctrl+M is a no-op. **`bridgeSkewed`**
    (`present && KNOWN_CAPABILITIES.some(c => !capabilities.includes(c))`, `KNOWN_CAPABILITIES`
    exported from `bridge-launch.js` as the dashboard's own "fields I know how to send") is the
    SEPARATE, GENERAL "this extension as a whole is stale" signal — it drives a dismissible,
    session-local (ADR-0017, no persistence) banner in the docked console ("Your VS Code bridge is
    running an older version. Some launch options are unavailable until you reload the window."),
    built board-local from the `--obligation` / `--obligation-soft` advisory-tint family
    (ADR-0016) since no styleguide Banner/Alert primitive exists yet and this is a first-time
    consumer. The banner and the lock coincide today (the only bridge in the wild missing
    `'model'` misses `'name'` too) but are deliberately DERIVED SEPARATELY — the banner fires on
    ANY missing capability, not `'model'` specifically, so a future bridge shipping `'model'` but
    lacking a not-yet-invented fifth capability still raises it, and it never fires for plain
    absence or for forward-skew (a bridge advertising MORE than `KNOWN_CAPABILITIES`). **Ctrl+M
    cycles the selected model** (`PROMPT_KEY_INTENT.CYCLE_MODEL`,
    a fifth disjoint `promptBarKeyIntent` label, wired both field-focused, via the classifier, and
    window-scoped alongside Ctrl+Space) — a true no-op (no state change, no flash) whenever
    `modelLocked`. **The two handlers are kept mutually exclusive** by
    `shouldWindowCtrlMHandle(event, promptFieldEl)` (`prompt-model.js`): the window-scoped listener
    refuses to act whenever the keydown's `target` IS the prompt field, leaving that case entirely
    to the field's own `onPromptKeyDown` — without this guard, a keydown dispatched on the focused
    field still bubbles natively to `document` (React `createRoot`), so both handlers would fire on
    the same keystroke and `selectedModel` would advance by two instead of one (caught in
    verification of agentic-workflow-m2vkp's iteration 1; see ADR-0050's fifth amendment's
    iteration-2 correction). `fire()` threads the resolved model's `id` into `launchOrCopy`'s `model` field,
    which rides a bridge launch as `--model <id>`. This does **not** touch ADR-0031 (per-agent
    model routing) — that pins a model per *agent role* inside the workflow engine; this selector
    picks the *session's* main-loop model; the two compose rather than conflict.
  - **Paint (ADR-0051 amending ADR-0048; ADR-0016 for the rest)** — the highlighted tab alone
    wears the bounded ochre wayfinding exception, now (agentic-workflow-q7r3x) a **filled cell
    background** (`--surface-2`) **plus a full-width ochre bottom inset underline**
    (`--accent-ochre` text, the nav-rail idiom turned into a horizontal underline) — replacing
    the earlier rounded-pill-with-gaps look that read as a four-sided ochre box rather than a
    wayfinding underline. This is the **second** surface ADR-0048's carve-out names, beside the
    nav-rail active item — Plain's tab (agentic-workflow-m3vhq) follows the identical rule, no
    new paint decision. The other, non-highlighted tabs de-emphasize by opacity (ADR-0016's
    unchanged default) — no ring, no new hue, no cell fill. The launch affordance is the
    styleguide's **`ModelSplitButton`** primitive (design-system-r9dtm, ADR-0003, replacing
    `EnterButton` — agentic-workflow-m2vkp), which owns its own already-licensed ADR-0048 "primed
    primary action" paint (a solid `--accent-ochre` fill, the `corner-down-left` glyph in
    `--accent-ochre-fg`, now plus the resolved model's label) plus its own `disabled` de-emphasis
    by opacity (`0.55`, `--accent-ochre` fill kept literal) and `locked` treatment (no caret region
    at all, absent rather than merely disabled) — board.js no longer re-implements any of it
    locally.
  - Every launch opens a real interactive Claude session through the VS Code **bridge**
    (ADR-0018): `GET /api/bridge` (infrastructure-014) discovers the listener, `GET /health`
    confirms it, `POST /run { prompt }` fires it. **Bridge-absence is a normal mode, never an
    error** — any failure falls back **silently** to a clipboard copy with the same quiet
    "Copied" feedback, via the same pure `launchOrCopy` (`dashboard/app/bridge-launch.js`) every
    other launch button shares. Launching a session is an **external side-effect**, not a
    lifecycle write (ADR-0001). `WhatsNextPanel` no longer composes inside this bar (it would
    float inside the fixed overlay) — it renders directly in `DashboardBoard`, in-flow, above the
    `BoardHeader` count strip, its dismiss/SSE wiring unchanged. See ADR-0050, ADR-0051,
    ADR-0048, ADR-0018, ADR-0016, ADR-0003, ADR-0001, ADR-0009, ADR-0031, ADR-0017.
- **`WhatsNextPanel`** (aw-073 / ADR-0027; dismiss rewired to a bounded on-disk delete by
  aw-vmk1z / ADR-0046; rebuilt into a numbered **flight-plan stepper** by agentic-workflow-a2pm1
  / ADR-0048; hoisted out of the now-fixed `BoardPromptBar` by agentic-workflow-bz3az) — renders
  directly in `DashboardBoard`, **above** the `BoardHeader` count strip: the dashboard half of
  the What's next feature, reading the single-latest advisory artifact
  (`.agentheim/state/whats-next.md`)
  through the existing `/api/doc` body carrier. It is a **glanceable advisory card, not a
  document**: the leading YAML is stripped, and the three named body sections (*where things
  stand* / *recommended move* / *next*) render as **three NUMBERED, CONNECTED steps** — a
  horizontal connector row of numbered circles above three height-capped CARDs (each scrolling
  its own overflow), one card per step — so the strip never pushes the board down. Both the
  circle numbering and the step-2 hero are **position-based, not text-matched**: step 2 (the
  *second* parsed column, whichever section actually lands there) wears the licensed
  `--emphasis-border` hero carve-out (a named token border + matching shadow, ADR-0048) — no
  other surface in the region carries it. Split by the pure, loss-tolerant
  `splitWhatsNextSections` (`dashboard/app/whats-next-state.js`) — a degraded body just yields
  fewer circles/cards, never an invented step; each card renders its content through the
  unforked styleguide `Markdown` primitive. Re-fetches on every SSE `tree-changed` frame, shows
  a staleness cue from the `generated` timestamp (render-only), and is **dismissible** —
  dismiss now issues `DELETE /api/whats-next`
  (`dashboard/whats-next-delete.mjs`), the dashboard's one bounded write exception to ADR-0017
  (ADR-0046, amending ADR-0027 §4.5): no request body, no client-supplied path, the target
  derived server-side and asserted against the one allowed absolute path by **exact string
  equality** (never a prefix match — a `state/` prefix would also match the sibling
  `state/in-flight.json`) before any `unlink`; idempotent (`204`, already-absent is success,
  never `404`). The click optimistically clears the local body (`setBody(null)`) and disk
  convergence (unlink → SSE `tree-changed` → re-fetch `404`s → renders nothing) is the durable
  truth behind it. The former `localStorage` dismiss store (`loadDismissed`/`saveDismissed`/
  `isDismissed`) is **retired entirely** — disk presence/absence is now the sole source of
  dismiss truth. Every degraded path (absent/malformed artifact) resolves to "render nothing",
  never a throw.
- **`InFlightLane`** (agentic-workflow-m9w5c / ADR-0043) — sits below the board header, above
  the columns: renders **live observability** for a running `work` batch — how many
  workers/verifiers have run this session, and since when. Reads a SECOND advisory artifact
  (`.agentheim/state/in-flight.json`, the ADR-0027 category extended by ADR-0043) through the
  same `/api/doc` carrier `WhatsNextPanel` uses. Unlike `whats-next.md` (written by a skill's
  prose), this artifact is written by real Claude Code **`Stop`/`SubagentStop` command hooks**:
  a `Stop` hook in `skills/work/SKILL.md`'s own frontmatter heartbeats it every orchestrator
  turn while `work` is active, and a `Stop` hook in each of `agents/worker.md` /
  `agents/verifier.md`'s frontmatter (auto-converted to `SubagentStop` when that subagent
  completes) records `{agentType, agentId, completedAt}`. The pure transition core
  (`lib/agent-heartbeat.mjs`) and the dashboard-side reader (`dashboard/app/in-flight-state.js`)
  share ONE crash-safety rule: a heartbeat older than the staleness window (5 minutes) is
  treated as a dead session — the hook starts a fresh record, and the panel renders **nothing**
  rather than a zombie lane surviving a crashed/killed session. Read-only over the artifact
  (ADR-0017) — only the hooks write it; the panel never does. Deliberately does **not** touch
  the existing doing-column pulse (`doingPulseClass`, design-system ADR-0014) — a different,
  already-shipped, cross-BC signal this feature leaves untouched. See ADR-0043, ADR-0027,
  ADR-0017, ADR-0014.
- **Shell layout (aw-026, styleguide §05)** — the live shell is the styleguide "Components in
  context" full-height **left rail** beside a **main column**: a ~52px **topbar** (the global
  **search field**, aw-052 — plus two standing launches: ochre-CTA **What's next** and primary
  **Work**) over the scrollable board. **Work** launches the bare `/agentheim:work` via
  `launchOrCopy`, `emphasis="primary"`, threading `skipPermissions`; as of **aw-064** it renders
  `Work ↗` with the glyph trailing the label. **What's next** (aw-064; recolored **aw-vk6mc**)
  fires the bare `/agentheim:whats-next` through the same path — the read-only `whats-next`
  skill, which itself performs **one** *advisory write* (ADR-0027): a single-latest, git-ignored
  recommendation at `.agentheim/state/whats-next.md`, an opinion *about* the state rather than a
  change *to* it, so it does not re-open ADR-0017's read-only stance. **aw-vk6mc** recolors the
  What's-next button to a new `LaunchButton` `emphasis="cta"` treatment — `--accent-ochre` text
  on an `--accent-ochre-soft` fill with an `--accent-ochre` border — licensed by ADR-0048's
  accent carve-out (design-system-vw12e): the button *fires* the whats-next skill, so it is a
  primed primary action, not the passive equivalent-state selection ADR-0016 reserves the accent
  from. **Work** is untouched (still `emphasis="primary"`, no ochre). The armed
  skip-permissions cue still wins over every idle treatment (aw-041): the launch icon tints
  `--obligation` red regardless of emphasis, including the new ochre `cta` fill. As of **aw-x4t2g** the
  advisory feeds back into planning: `modeling`'s "Before acting" and `work`'s Phase 3
  batch-planning both read it when present and surface its *recommended move* + age — never
  auto-picking, auto-promoting, or overriding the dependency DAG. The rail is composed from
  styleguide **primitives** (`Glyph`/`RailItem`/`Collapsible`/`TreeItem`), fed by the **live**
  `treeToLibrary(/api/tree)` projection, and drives a **"new item" attention cue**
  (design-system-v8k2p, aw-n4h7q): a research report or ADR created/modified during the current
  page session **blinks** until clicked or reloaded — a pure, in-memory-only session-baseline
  diff (`rail-attention.js`), no disk/`localStorage` write (ADR-0017). The outer shell frame is
  bounded to the viewport (`height: 100dvh`, `overflow: hidden`; aw-067), so rail + topbar stay
  fixed and the inner `scroll-quiet` region is the sole vertical scroll container. **1a
  single-panel shape (aw-wsfsk)**: the builder's chosen left-nav shape over 1b's split icon-rail
  + tree. The rail is **236px** wide; the tree header reads **"WORKSPACE"**; a **footer status
  line** (`"all clear · N done"`) renders below the tree, computed by the pure, unit-tested
  `library-data.footerStatusLine` off the same grouped tree projection (N counts the Decisions/ADR
  group — loss-tolerant: a missing Decisions group degrades to the bare `"all clear"`, never a
  throw). The **active primary-nav item** (Board/Workflow/About) renders an **ochre inset rail**
  (`inset 2px 0 0 var(--accent-ochre)`, via the `RailNavSlot` wrapper) — a **bounded ADR-0048
  wayfinding exception** to ADR-0016's de-emphasis-for-selection default, scoped to this one
  surface only. See ADR-0009, ADR-0003, ADR-0017, ADR-0018, ADR-0027, ADR-0048, ADR-0016.
- **Topbar settings menu (aw-049; consumes the shared primitive as of design-system-015)** —
  a **dropdown** (`SettingsMenu`) behind a single **settings gear** (`settings-2` glyph,
  unforked) sitting left of the What's next + Work launches. Collapses three utility controls —
  **Stop dashboard**, **theme** toggle, **skip-permissions** armed toggle — that were previously
  spread across the topbar; only Work stays standing. Consumes the shared styleguide
  `Menu`/`Popover` primitive (design-system-015, ADR-0003), retiring the earlier board-local
  dropdown machinery. **Dismissal:** Esc, outside click, and selecting Stop close the menu;
  flipping theme or skip-permissions **keeps it open**. The **closed gear carries no armed cue**
  — the danger hue lives only on the toggle inside the open menu. Keyboard-operable
  (focusable, Enter/Space opens, `aria-haspopup`/`aria-expanded`, Esc closes), honors
  `prefers-reduced-motion`. See ADR-0003, ADR-0017, ADR-0019.
- **Stop dashboard from the UI (aw-028; relocated aw-049; reversed to a direct server call by
  aw-h4n2v / ADR-0053)** — a quiet `StopDashboardButton` living inside the topbar settings menu;
  selecting it POSTs the scoped **runtime self-lifecycle** endpoint `POST /api/stop` directly —
  no bridge, no spawned session, no `STOP_DASHBOARD_COMMAND` (retired). The server ends its
  **own** process and removes its **own** runfile
  (`.agentheim/.dashboard/runtime.json`) on this explicit builder command; the response is fully
  flushed before the process exits (`res.on('finish')` gates the cleanup) so the browser's fetch
  always resolves. This **reverses aw-028's original seam** ("the server is never asked to stop
  itself") and, because there is no bridge in the path, **removes the bridge-present/absent
  asymmetry** aw-028 accepted — Stop now works identically in any browser tab. **No confirmation
  step.** Does **not** thread `skipPermissions` (a stop carries no danger hue). Selecting Stop
  closes the menu first, then — only on a **truthful 2xx** (not merely on dispatch) — flips a
  shell-level "stopped" state, rendering a board-local full-pane **"Dashboard stopped — safe to
  close this tab"** overlay (composed from tokens, not the `Drawer` primitive); a failed/
  unreachable POST closes the menu quietly with no overlay. `stopDashboard(root)` /
  `terminate()` and the `/dashboard stop` CLI/skill are **unchanged** — they still own the
  out-of-process kill path. See ADR-0053, ADR-0017, ADR-0046, ADR-0018, ADR-0001, ADR-0003.
- **Live-update (SSE consumer)** — the board keeps itself current (agentic-workflow-009) by
  subscribing to `GET /api/events` (infrastructure-003/ADR-0006). EventSource auto-reconnects
  and the board re-syncs, no missed-event bookkeeping. This is the **only** way state reaches
  the board (ADR-0017). Since **agentic-workflow-mvt8x / ADR-0070**, the tab holds this
  subscription through a shared **live-tree hub** (below), not a per-component
  `createLiveUpdate` call — see that entry for the current shape; the framing above ("re-fetch
  `/api/tree` and re-project the whole board" on **every** frame) is the pre-hub design and no
  longer describes advisory frames. See ADR-0012, ADR-0006, ADR-0017, ADR-0070.
- **Live-tree hub (one subscription, one fetch, many consumers)** — the tab holds **exactly one** `/api/events` source (ADR-0006's "a long-lived connection per open board tab", finally realized), owned by a refcounted, framework-free hub (`dashboard/app/live-tree-hub.js`) that also owns the single `/api/tree` fetch. Board, rail, and the advisory panels *subscribe*; they never construct `createLiveUpdate`/`EventSource` themselves. First subscriber opens the source, last unsubscribe closes it, concurrent subscribers share one in-flight fetch, and each consumer applies its own projection (`treeToColumns` / `treeToLibrary`) to the one payload. Enforced by a source guard: `createLiveUpdate(` and `new EventSource(` appear only in the hub. A hidden tab (agentic-workflow-bmn29, ADR-0070 §6) pauses delivery instead of closing the source: `handleFrame` records what arrived per category in a pending set and replays it at most once, never unconditionally, on becoming visible again — an empty pending set replays nothing. The visibility signal is injectable (`{ isHidden, onChange }`, defaulting to `document.visibilityState`/`visibilitychange`) and, like source construction, has exactly one home: the same guard now also asserts `visibilitychange`/`visibilityState`/`document.hidden` appear only in the hub. See ADR-0070, ADR-0006.
- **Structural / advisory / runtime frame** — the read-side counterpart to ADR-0027's
  write-side category split. A `tree-changed` frame under `.agentheim/contexts/**` or
  `.agentheim/knowledge/**` is **structural**: board and rail re-sync. A frame under
  `.agentheim/state/**` is **advisory** — it was produced by an advisory write
  (ADR-0027/0043) and re-syncs ONLY the panel that reads that artifact
  (`whats-next.md` → `WhatsNextPanel`, `in-flight.json` → `InFlightLane`), never the
  board or rail. A frame under `.agentheim/.dashboard/**` is **runtime** (runfile, bridge
  discovery file, last-port marker — infrastructure transport bookkeeping) and re-syncs
  nobody. An absent, malformed, or unrecognized path classifies as **structural** — fail
  open, so a classification miss costs a wasted fetch, never a stale board. A new advisory
  artifact must register with the router (mechanized: `dashboard/test/live-frame-registration.test.mjs`).
  See ADR-0070, ADR-0027, ADR-0043.
- **Frame routing is not frame interpretation** — the pointer stays a pointer: it
  selects the re-sync's **audience**, never its **meaning**. Deciding WHO re-syncs is
  addressing; deciding WHAT CHANGED in the model would be interpretation, and remains
  forbidden (ADR-0001). Every routed consumer still re-fetches its whole artifact and
  re-projects from scratch — nothing diffed, nothing patched, idempotence intact.
  See ADR-0070, ADR-0006.
- **No lifecycle write path (read-only-over-lifecycle dashboard)** — the dashboard never
  writes lifecycle state (ADR-0017). The former drag-to-Promote endpoint (`POST
  /api/task/move`, agentic-workflow-009) and its client were **removed**: cards are not drag
  sources, columns are not drop targets. Task-lifecycle transitions are owned entirely by the
  skills, which move files on disk together with the readiness check, gate guard, INDEX
  update, and protocol entry; the board reflects those moves via live-update. On top of reads +
  the SSE stream + static assets, the HTTP server carries **two** narrow, non-lifecycle
  exceptions, each its own named write category (ADR-0053 amends ADR-0017's read-only framing
  and ADR-0046's earlier "exactly one write" claim to make room for the second): as of
  **aw-vmk1z / ADR-0046**, `DELETE /api/whats-next` deletes ONLY the advisory `whats-next`
  artifact (see `WhatsNextPanel` above); as of **aw-h4n2v / ADR-0053**, `POST /api/stop` — a
  **runtime self-lifecycle** write, sibling to the forbidden lifecycle category and the advisory
  category — ends the server's own process and removes its own runfile (see *Stop dashboard from
  the UI* above). Neither touches a task, `INDEX.md`, or `protocol.md`. See ADR-0017, ADR-0007,
  ADR-0046, ADR-0053.
- **Slide-over** — the dashboard's right-hand detail panel (agentic-workflow-007): a
  Notion-style drawer for a board **task**. As of **aw-027** it is **task-only** — the
  open-intent SPLITS on artifact kind (see *Open-intent routing*), so non-task documents render
  in the main pane instead. Fetches the body via `GET /api/doc?path=`, rendering markdown
  **client-side** through the approved styleguide `Drawer`+`Markdown` (unforked, ADR-0003),
  passing a *doc-shaped* item so the real in-root path is carried (ADR-0010, reshaped by
  ADR-0021). The header leads with the item `title` (design-system-014); Esc and scrim-click
  close it. An **in-place expand chevron** (`Drawer`'s ds-020 body-top chevron,
  agentic-workflow-074) widens the drawer in place to fill the main content area instead of a
  separate full-screen maximize button — the slide-over owns the controlled `expanded` state
  and the rail-aware `expandedWidth` fact, while the animation lives in the unforked `Drawer`.
  Reopening a task **resets to collapsed**. See ADR-0010, ADR-0021, ADR-0009, ADR-0003,
  ADR-0014.
- **Global search (topbar)** — the dashboard's search surface (agentic-workflow-052): the
  topbar's leading slot is the **global search field** that, as you type, queries
  `GET /api/search` and opens a floating panel of **category-grouped** results, each row a
  title + matched-text excerpt. Consumes the design-system `SearchField` combobox **unforked**
  (design-system-016, ADR-0003): ds-016 owns the input chrome and keyboard model; the dashboard
  owns the controlled query, a **~200ms debounce**, a **min-length-2 fetch gate**, and the pure
  transform (`searchResultsToGroups`, `dashboard/app/search-results.js`) that buckets ranked
  results into ds-016's `groups`. Selecting a result loads the document into the **main content
  pane** for both non-task docs and tickets (the "open in full screen" path, not the
  slide-over). Empty query shows no panel; a no-match query
  shows ds-016's honest "No matches" line. Read-only (ADR-0017). See ADR-0023, ADR-0021,
  ADR-0017, ADR-0009, ADR-0003.
- **Main-pane reader** — the dashboard's reading surface for a non-task **document**
  (agentic-workflow-027): vision, context map, BC README, ADR, research. Selecting a rail row
  opens its document in the **main content area** (where the board otherwise sits), not the
  slide-over. Reuses the `/api/doc` fetch, rendering markdown client-side through the unforked
  styleguide `Markdown` primitive, with a comfortable centered measure (`maxWidth: 760`,
  agentic-workflow-040) and a header leading with `doc.title`. Shows EITHER the selected
  document OR the board (default); the rail's **Board** item returns to the board. See
  ADR-0021.
- **Frontmatter folding** — both render surfaces share one pure helper,
  `dashboard/app/frontmatter.js` (`parseFrontmatter`/`frontmatterSection`/
  `withFrontmatterSection`, unit-tested, agentic-workflow-043), that strips a document's leading
  YAML frontmatter (which `marked` would otherwise render as one large bold setext heading) and
  re-emits it as a quiet, collapsed-by-default native `<details><summary>Front matter</summary>`
  table prepended to the stripped body — upstream of `Markdown`, so the same composed string
  flows through both the `Drawer` and the direct `Markdown` reader, both unforked. A document
  with no frontmatter passes through unchanged.
- **Open-intent routing** — the shell (`DashboardApp`) routes every clicked artifact on
  artifact KIND via the pure `isTaskIntent` (`dashboard/app/intent-route.js`,
  agentic-workflow-027): a `status`-carrying intent is a **task** → slide-over; a `type`-carrying,
  `status`-less intent is a **non-task document** → main pane (`openIntent` / `selectedDoc`
  state pair). See ADR-0021. As of **aw-058 (ADR-0025)** a third state, `mainView` (`"board" |
  "workflow" | "about"`, default `"board"`), sits beside them for **built-in static pages**
  (neither a task nor a disk-fetched document), mutually exclusive by construction. **aw-062**
  added the `"about"` page (builder bio + Ko-fi card). The `"workflow"` page (aw-059) carries
  three named segments — **Preparation** (`brainstorm`), **Capturing** (`quick-capture`/
  `modeling`/`research` gated by `research-reviewer`/DISMISS), **Promote & Work** (`modeling`
  PROMOTE → `work`'s parallel TDD workers → the `verifier` gate → one task = one commit) — each
  carried (aw-060) by a hand-authored flow diagram (board-local HTML+CSS, no SVG, no
  diagramming library, gates as edge checkpoints). Stays static/read-only, styleguide unforked.
  As of **aw-q3n7k** the guide covers the two later skills: **Promote & Work opens with `whats-next`**
  (a `WNode`+`WArrow` "recommends" ahead of `modeling` PROMOTE, at the planning moment — advisory,
  never moves a task), and a fourth **un-numbered "Any time" note** below the segments names `inquire`
  as a read-only, code-grounded lens *outside* the flow (deliberately not appended into any segment's
  skill list, since it isn't a step).
- **Library / navigation** — the dashboard's discovery surface (agentic-workflow-008): makes
  the *non-task* knowledge base browsable — vision, context map, every BC README, **per-BC
  concept pages**, ADRs, research — drawn from the artifact-location half of the tree
  projection (tasks deliberately excluded; the board owns them). The pure, unit-tested
  `treeToLibrary` (`dashboard/app/library-data.js`) pools locations into fixed groups — Product
  / Bounded contexts / **Concepts** / Research / Decisions — rendered through the approved
  styleguide `Collapsible`/`TreeItem` (unforked; `concept` is a ds-021 registry entry).
  Selecting any row routes to the **main-pane reader**. As of **aw-026** this tree is **always
  visible in the left rail** — the separate board↔library toggle is retired. See ADR-0011,
  ADR-0021, ADR-0009.
- **Task transition** — a lifecycle move of a task between folders (`backlog→todo` Promote,
  `todo→doing` Claim, `doing→done` Complete), never a raw file operation: it is a command on the
  **Task** aggregate, enforcing *status matches folder*. Owned by the skills (`modeling` /
  `work`), not the dashboard, which is read-only (ADR-0017).
- **`applyTaskMove`** — the canonical lifecycle-transition operation, owned by
  agentic-workflow and available to the skills; enforcer of *status matches folder* and the
  legal-move policy. Built in agentic-workflow-003 as `lib/task-lifecycle.mjs` (BC-owned domain
  logic, node stdlib only). The dashboard does **not** call it (ADR-0017). Signature
  `applyTaskMove(rootDir, id, from, to, options)` — `options.policy` is `'skill'` (the forward
  set: Promote, Claim, Complete) or `'ui'` (a retained, no-longer-wired restricted set);
  `options.expectedMtimeMs` is the optimistic mtime precondition. Returns `{ ok: true, state }`
  or `{ ok: false, code, reason }`. It owns ONLY the move + status rewrite + precondition;
  INDEX/protocol side-effects stay with the skills (ADR-0007). Resolves the real on-disk
  `<id>-<slug>.md` filename, preserved across the move (ADR-0012). See ADR-0017, ADR-0007,
  ADR-0012.
- **`promoteTask` / the `task-lifecycle` CLI** — the git-free, mechanized PROMOTE lifecycle
  script (ADR-0038, agentic-workflow-k5n8f). Three concentric layers, one owner each: (1)
  `applyTaskMove` (above); (2) `promoteTask(rootDir, id, opts)` in `lib/task-lifecycle.mjs` —
  calls the mover, then performs deterministic bookkeeping (INDEX marker + count delta,
  protocol prepend); NEVER runs `git`; outputs an enumerated manifest `{ changed, message,
  verb, id }` or `applyTaskMove`'s rejection verbatim; (3) `lib/task-lifecycle-cli.mjs` — a thin
  argv → `discoverRoot(cwd)` → handler → print-manifest wrapper; (4) `modeling`'s PROMOTE flow
  owns the remaining judgment (readiness) and git (scoped add + commit). See ADR-0038, ADR-0007,
  ADR-0026.
- **Compute-then-write atomicity (ADR-0054, agentic-workflow-wq7fn).** All three mechanized
  verbs — `promoteTask`, `claimBatch`, `completeTask` — resolve their source read-only, then
  compute the FULL new `INDEX.md` + `protocol.md` content PURELY (no disk writes) inside a
  `try`; a throw from `removeIndexLine`/`insertIndexLineAtTop`/`adjustIndexCount`/
  `prependProtocolEntry` is caught and returned as `{ok:false, code:'bookkeeping-marker-mismatch',
  reason}` with nothing moved and nothing written. `applyTaskMove` is the only disk mutation,
  and the last one before the two writes. This supersedes k5n8f's AC #5 dry-run marker mirror
  (`validateBookkeepingMarkers` — deleted): the computation itself is now the guard, so every
  future throw site is fail-closed for free, with no second hand-maintained copy of "what could
  go wrong" to keep in sync. `adjustIndexCount` additionally (a) rejects a decrement that would
  take a count below zero — naming the label/current value/delta — instead of silently writing
  e.g. `-1` (which previously made the label's own regex unmatchable for every subsequent
  mutation in that BC), and (b) scopes its replace to inside the `<!-- task-counts:start/end
  -->` block, mirroring `removeIndexLine`'s block capture, so a colliding same-labeled line
  elsewhere in the file is never the one edited. `applyTaskMove`'s own source-resolution
  precondition is extracted into `resolveSourceOrReject` — one implementation, called by both
  `applyTaskMove` and every verb's compute phase, so a source-missing rejection is never
  re-derived by speculatively invoking the mover as an oracle. See ADR-0054, ADR-0038.
  **`applyTaskMove` is itself internally two mutations, ordered write-destination-then-
  unlink-source (ADR-0055, agentic-workflow-rwxms)**: it writes the status-rewritten body
  directly to the destination path (backfilling a missing destination lifecycle folder via
  `mkdirSync(..., {recursive:true})` rather than rejecting it — folder disk-absence only ever
  means "currently empty," never a domain refusal), then unlinks the source — never rewriting
  the source file in place. This amends, rather than reopens, the "only disk mutation" framing
  above.
- **`claimBatch` / `completeTask`** — the git-free CLAIM and COMPLETE lifecycle scripts, matched to
  the ADR-0032 worktree/squash-merge model (agentic-workflow-t7m4c), same three-layer boundary as
  `promoteTask`. **`claimBatch(rootDir, ids, opts)` is BATCH-shaped**: it claims whichever id list
  the caller hands it — the DAG's whole ready set on an unscoped `work` run, or a builder-named
  subset on a **scoped run** (`/agentheim:work <task-id>` or a small explicit id list, ADR-0071,
  agentic-workflow-swj2q — see `skills/work/SKILL.md`'s "Argument grammar"; the script itself is
  unaware of the distinction, it just claims the ids it's given) — `todo → doing` and returns ONE
  manifest — every id's move via `applyTaskMove`, INDEX marker/count edits grouped **per BC** (a
  batch may span contexts), and one `protocol.md` "Batch started" entry;
  fail-loud (all ids pre-checked to resolve in `todo/` before any move, so one bad id aborts the
  batch with nothing moved; a rarer mid-batch vanish race after the pre-check surfaces the split
  `claimed` manifest with neither file written — ADR-0054 left this residual race unchanged), and
  the commit `message` drops the `<bc>` token when the batch spans contexts. **`completeTask(rootDir,
  id, opts)` is single-task-shaped** and **idempotent** w.r.t. a file already in `done/` (under
  ADR-0032 the worker's worktree does the `doing → done` move, so by the time the conductor runs
  `complete` on `main` after the squash-merge the file is already there): it resolves its source
  `doing/`, else `done/`, before any move (ADR-0054) — the `done/` case is the idempotent no-op
  move, and bookkeeping proceeds against the file already there. **ADR-0042:** `completeTask` has no
  batch mode — the trivial-squash carve-out is composed by the CALLER (`work` runs `complete` once
  per task and folds the manifests' `changed` paths + `[<id>]` trailers into one commit), since a
  batch-complete verb would have to invent a shared summary/`<type>` across tasks, the judgment
  ADR-0038 reserves for the skill. Both reuse `lib/task-lifecycle-cli.mjs` — `claim <id-1>,<id-2>,…`
  and `complete <task-id>` (with an optional JSON opts positional for `complete`'s richer
  bookkeeping fields). See ADR-0038, ADR-0007, ADR-0026, ADR-0032, ADR-0042, ADR-0054.
  **Post-ghcaj (agentic-workflow-ghcaj, amending the paragraph above):** the ordinary path no
  longer relies on `completeTask`'s `done/`-resolving branch to be a no-op — the worker branch
  carries source and tests only (it never touches `.agentheim/`), so the CONDUCTOR performs the
  real `doing → done` move on `main` at squash-merge integration step (d), the first time the
  file moves at all. The `done/`-resolving idempotent branch described above is retained
  purely for a resumed/interrupted session — a re-run of `complete` after a crash finds the
  file already moved and is a true no-op there, not on the ordinary path.
- **`captureTask` / `dismissTask`** — the git-free CAPTURE and DISMISS lifecycle scripts
  (ADR-0073, agentic-workflow-e4bjh), completing ADR-0038's mechanization boundary. Both live
  in a separate module, `lib/task-lifecycle-capture-dismiss.mjs`, wired into the same
  `lib/task-lifecycle-cli.mjs` dispatch table as `promote`/`claim`/`complete`.
  **`captureTask(rootDir, id, opts)`** registers a task file the CALLER already wrote to
  `backlog/` or `todo/` — it never authors task-file prose, only validates frontmatter
  (id well-formed or grandfathered, status/context/required-fields), inserts the matching
  INDEX line (a unified format that always carries `(type)`) + count delta, and — unless
  `opts.protocolEntry: false` (a structural skip `brainstorm`'s per-task foundation capture
  uses) — prepends a protocol entry keyed by `opts.source` (`modeling` / `quick-capture`). A
  missing BC `INDEX.md` is backfilled from `references/index-template.md` (read
  sibling-relative off the module's own `import.meta.url`) only when the BC holds nothing but
  the captured file; otherwise it refuses `index-missing`. **`dismissTask(rootDir, id, opts)`**
  is two-phase: `{plan:true}` computes the ADR-0022-amended cascade with zero disk writes,
  returning a `CascadeSet {leadId, memberIds}` plus a display projection and an advisory list;
  `{confirm:[...ids]}` recomputes the FULL guarded cascade fresh (never trusting the plan),
  refusing `cascade-drifted` (membership changed) or `cascade-in-flight` (a member's folder
  changed) before any write, then performs the hard delete in the order INDEX edits → unlinks
  → surviving-backlink stripping → protocol entry (ADR-0073 reverses ADR-0022 §4's order for
  crash-safety). **ADR-0073 amends ADR-0022**: the cascade edge is `depends_on` ONLY (`blocks`
  is reconciliation-only, never traversed — the live `blocks`/`depends_on` asymmetry made
  "equivalently, follow blocks" false); cascade membership and backlink stripping match on
  EXACT frontmatter `id` equality only, never filename/prefix resolution (the live
  `design-system-001-styleguide` vs `design-system-001` mismatch); INDEX count deltas derive
  from a strict `removeIndexLine` variant's actual removal count, never cascade-set
  cardinality. See ADR-0073, ADR-0038, ADR-0022, ADR-0054, ADR-0042, ADR-0059.
- **`lib/adr-allocation.mjs`** — collision-proof ADR number allocation (ADR-0058,
  agentic-workflow-hmgav), extending the ADR-0042 "composition owned by the caller at the
  squash-merge boundary" pattern to ADR numbering instead of copying ADR-0028's random-token
  answer (ADR ids keep ordinal continuity — a property actively used, unlike task ids).
  **`nextAdrNumber(decisionsDir)`** — a PROVISIONAL mint: current max `NNNN-*.md` in
  `decisionsDir` plus one. Called by a worker inside its own ADR-0032 worktree (or a
  direct-commit skill); not authoritative — a sibling worker in a different worktree can guess
  the same number and neither can see the other's file. **`finalizeAdrNumbering(decisionsDir,
  provisionalFilenames)`** — the AUTHORITATIVE step, conductor-only: called against `main`'s real
  `decisions/`. **Post-ghcaj (agentic-workflow-ghcaj):** the worker's `git merge --squash` no
  longer stages any ADR file — the worker branch carries source and tests only, and each ADR
  body travels in the RESULT block's `ADRS` fenced field instead. The conductor writes each
  `ADRS` block's body directly to `decisions/` on `main` first, under its worker-guessed
  provisional filename, and only then calls `finalizeAdrNumbering` against that same `main`
  `decisions/`, ahead of the integrating `git add`/commit. Exploits ADR-0032's "`main` written
  only by the conductor, only sequentially" invariant — every OTHER `NNNN-*.md` file already in
  `decisionsDir` is by construction already final. Assigns the provisional file(s) sequential
  numbers starting at the true max + 1 REGARDLESS of their guessed number, so both a collision (a
  sibling already landed the guess) and an over-guess (leaving a gap) are corrected by one
  uniform rule; on rename it rewrites the file's filename + frontmatter `id:` + H1 heading and
  appends a "Note on ADR numbering" trail, mirroring ADR-0038's own hand-written 0037→0038
  renumbering precedent, now automatic. Returns `{changed: [oldPath, newPath], renumbered:
  [{from, to, oldFilename, newFilename}]}`, matching `applyTaskMove`'s rename manifest shape. A
  bounced/failed task's `ADRS` block is simply never materialized to disk at all (post-ghcaj) —
  there is no provisional file to pass to `finalizeAdrNumbering` or to clean up, so it never
  consumes a slot and leaves no hole. Git-free (ADR-0038):
  plain `fs` rename + content rewrite, no `git` shell-out. Wired into `skills/work/SKILL.md`'s
  "Per ADR written" bookkeeping step, ahead of index insertion and backlinks. Scoped to the
  worktree/squash-merge (`work`) path only — `modeling`/`quick-capture`/`brainstorm`'s
  direct-commit ADR writes keep the old unmechanized convention (ADR-0058 §4). See ADR-0058,
  ADR-0028, ADR-0032, ADR-0038, ADR-0042.
- **`lib/resolve-plugin-file.mjs`** — the env-independent in-plugin file resolver
  (generalizes infrastructure-010's `dashboard/resolve-launcher.mjs`, which now delegates to
  it — agentic-workflow-k5n8f). `locatePluginFile(relPath, opts)` resolves a path inside the
  installed plugin cache, or short-circuits to a repo-local copy when running from the
  Agentheim repo itself. Never trusts `$CLAUDE_PLUGIN_ROOT` for correctness; fails loud, never
  a `.`-relative fallback. How the `task-lifecycle` CLI above is meant to be located from an
  installed-plugin consumer's skill invocation, not just the dashboard's launcher.
- **`rotateProtocol` / protocol rotation** — the deterministic, git-free cap-and-roll script
  for `.agentheim/knowledge/protocol.md` (ADR-0039, agentic-workflow-r2c7m; a k5n8f-family
  script). `rotateProtocol(rootDir, opts)` (`lib/protocol-rotation.mjs`) caps the live file at
  `capLines` (default ≈1,000) and, when exceeded, rolls whole **older** months out **verbatim**
  — oldest-first, stopping once back under the cap — to dated
  `.agentheim/knowledge/protocol/YYYY-MM.md` archive files. The **current month is never
  rolled**, so every archive file is written exactly once; newest-on-top order is preserved
  both live and per-archive. Returns `{ok:true, rotated, changed, rolledMonths, liveLines}`;
  invocable directly (`node lib/protocol-rotation.mjs`, no verb/id argv). Every skill's
  first-~100-line read is unaffected by construction. **Trigger wired (ADR-0045,
  agentic-workflow-v8n3t):** `work`'s end-of-run flow invokes it once per session, immediately
  after the session-end protocol entry is committed, via the standard env-free plugin bootstrap;
  a `rotated: true` manifest gets its own scoped commit of the `changed` paths, closing ADR-0039's
  previously-deferred "who invokes it" non-decision. See ADR-0039, ADR-0045, ADR-0038, ADR-0026,
  ADR-0032.
- **`rotateIndexDoneList` / INDEX done-list rotation** — the deterministic, git-free cap-and-roll
  script for a BC's `INDEX.md` `done-list` block (agentic-workflow-c8j3w; applies ADR-0039's
  convention, established for `protocol.md`, to a second growth surface — a k5n8f-family
  script). `rotateIndexDoneList(rootDir, context, opts)` (`lib/index-rotation.mjs`) caps the live
  list at `capEntries` (default ≈30) and, when exceeded, rolls whole **older** months out
  **verbatim** — oldest-first, stopping once back under the cap — to dated
  `contexts/<bc>/done-archive/YYYY-MM.md` archive files. A done-list line carries no date of its
  own, so an entry's month is derived from the `completed:` frontmatter of the task file it
  points at (mtime, then `'unknown'`, as loss-tolerant fallbacks). The **current month is never
  rolled**; the `### Done (...)` header is rewritten to name the archive location only when a
  rotation actually happens; the `**Done:** N` lifetime count and the actual
  `done/<id>-<slug>.md` task files are never touched, so `depends_on`/`blocks` resolution
  (`resolveTaskFile` walks `done/` directly) and the dashboard search corpus (`buildTree`,
  ADR-0023) stay unaffected by rotation by construction — only `modeling`'s Backlink-lookup
  prior-art matcher, which reads the done-list's rendered text, needed pointing at
  `done-archive/` as an additional input. `rotateAllIndexDoneLists(rootDir, opts)` rotates every
  BC found under `contexts/`; returns `{ok:true, rotated, changed, contexts}`; invocable directly
  (`node lib/index-rotation.mjs`, no verb/id argv, no context argv). **Trigger wired (ADR-0047,
  agentic-workflow-d4q7f):** `work`'s end-of-run flow invokes `rotateAllIndexDoneLists` once per
  session, immediately after the ADR-0045 protocol-rotation check, via the same standard env-free
  plugin bootstrap; a `rotated: true` manifest gets its own scoped commit of the top-level
  `changed` paths, closing ADR-0045's previously-deferred sibling-surface scope boundary. First
  real run against this repo (2026-07-04) rolled `agentic-workflow`'s 2026-06 done-list entries to
  `contexts/agentic-workflow/done-archive/2026-06.md`; `design-system` and `infrastructure` were
  already under cap and did not rotate. **Fail-closed on an unparseable done-list (ADR-0047
  amendment, agentic-workflow-dk3vz):** a BC's per-BC result is one of three shapes, not two — beside
  `rotated:true`/`rotated:false`, a BC can REFUSE (`{ok:false, code:'unparseable-done-list' |
  'missing-done-list-markers', context, reason}`, writing nothing) whenever the cap question is
  unanswerable (zero done-list lines matched the expected shape) or a pending rewrite would silently
  drop unmatched lines; a partially-parseable list that isn't destructive to skip instead reports
  `{ok:true, rotated:false, liveEntries, unmatched:K}` (`K > 0`), visible but not fatal.
  `rotateAllIndexDoneLists` catches a per-BC throw (missing markers) rather than letting it escape and
  strand an already-rotated, alphabetically-earlier BC's manifest; the top-level manifest always stays
  `{ok:true, ...}` with a refusing BC simply absent from top-level `changed`. `work`'s session-end
  check surfaces every refusal and every unmatched report in its end-of-run summary; its old
  unqualified "`rotated:false` ⇒ silent no-op" rule is narrowed to apply only when no BC refused and
  none reported unmatched lines. **Header wording fixed + heal-on-no-op carve-out (ADR-0047 amendment,
  agentic-workflow-jf6qz):** `archivedDoneHeader()` no longer takes a `capEntries` argument or emits a
  numeric "most recent N" claim — that string was itself the phantom-cap wording ADR-0039 warns
  against (the current month is never rolled however large it grows, so a fixed-N figure is always
  eventually false); it now emits `### Done (current-month entries live; older months archived
  verbatim under \`done-archive/\` — kept for prior-art search, ADR-0039 convention)`, matching
  `references/index-template.md`'s corrected post-rotation prose. Because the fix alone can't
  retroactively correct a live header a worker cannot hand-edit, a no-op (non-rotating) run now also
  heals a stale header — rewriting it to the corrected form and reporting `healed:true` — **only when**
  a `done-archive/` already exists for that BC (never a false archive claim on a never-rotated BC),
  idempotent (fires at most once per BC). `rotateAllIndexDoneLists` collects a healed BC's `changed`
  path exactly like a rotated BC's and surfaces a top-level `healed` boolean; `work`'s "silent no-op"
  rule is narrowed once more to also require no BC reported `healed:true`. See ADR-0039, ADR-0041,
  ADR-0023, ADR-0038, ADR-0026, ADR-0045, ADR-0047, ADR-0059.
- **`findDuplicateTaskIds`** — the duplicate-id guard (`lib/duplicate-id-check.mjs`, BC-owned,
  node stdlib only), the ADR-0028 **insurance** against the residual token-collision tail and
  the legacy-vs-token clash a bug could produce. A pure, loss-tolerant whole-tree walk collects
  each task file's id (frontmatter first, filename-stem fallback) and returns every id claimed
  by more than one file, **shape-agnostic** (compared as whole strings). Exercised by
  `node --test` (the repo has no CI), whose suite also asserts the **live** tree has no
  duplicates. See ADR-0028, ADR-0022, ADR-0012.
- **`lib/agent-heartbeat.mjs` / `lib/hook-agent-signal.mjs`** (agentic-workflow-m9w5c, ADR-0043)
  — the live-observability hook signal behind `InFlightLane` above. `agent-heartbeat.mjs` is the
  PURE transition core (`applyHeartbeat`, `applyAgentCompletion`, `isStale`, `STALE_WINDOW_MS`) —
  I/O-free, fully unit-tested. `hook-agent-signal.mjs` is the thin CLI glue a Claude Code `Stop`/
  `SubagentStop` command hook invokes: reads the hook's stdin JSON payload, resolves the project
  root (`${CLAUDE_PROJECT_DIR}` first, `discoverRoot` fallback), applies the matching pure
  transition, and writes `.agentheim/state/in-flight.json` — an ADVISORY write (ADR-0027
  category), never a lifecycle write. `runHook(mode, deps)` is exported so tests drive it with
  injected stdin/root/clock rather than a real subprocess; a real-subprocess smoke test additionally
  confirms the CLI entrypoint itself (real stdin, real `${CLAUDE_PROJECT_DIR}`) works end to end.
  Every failure path (unreadable stdin, unresolvable root, an unwritable `state/` dir) is
  swallowed and the script exits 0 — a hook must never crash the session it observes. See
  ADR-0043, ADR-0027.
- **Hook COMMAND path is env-independent (agentic-workflow-g7p2x, ADR-0043 amendment).**
  The three `Stop` hook registrations above (`skills/work/SKILL.md`, `agents/worker.md`,
  `agents/verifier.md`) do **not** locate `lib/hook-agent-signal.mjs` via
  `${CLAUDE_PROJECT_DIR}` — that reuse was the bug (`${CLAUDE_PROJECT_DIR}` is the
  *write target* the script resolves internally, correct only for that role; using it
  to find the *script itself* only works when the project **is** the plugin). Each
  hook command is instead a self-contained `node -e` bootstrap — homedir -> plugin
  cache -> semver-max version dir -> `lib/hook-agent-signal.mjs`, with a repo-local
  `process.cwd()` short-circuit for dogfood development — the same pattern
  `lib/resolve-plugin-file.mjs` (infrastructure-010) and the `work` skill's
  claim/complete verbs already use. `${CLAUDE_PLUGIN_ROOT}` was investigated and
  rejected as the fix: documented for hook contexts, but confirmed to have open,
  unresolved non-injection bugs upstream (anthropics/claude-code #43380, #66557,
  #24529) as of the investigation. See `lib/test/hook-command-path.test.mjs` for the
  real-subprocess reproduction (foreign-project write succeeds; the old literal
  command string reproducibly does not) and the ADR-0043 amendment for the full
  writeup.
- **`lib/lifecycle-lock.mjs`, `log` / `index-add`, `lib/scoped-commit.mjs`** (agentic-workflow-pt0gy) — the modeling-side concurrency fix. **`lib/lifecycle-lock.mjs`** is one project-wide advisory lock at `.agentheim/state/lifecycle.lock` (gitignored/advisory, ADR-0027; the dashboard's frame router has no subscriber for this path, ADR-0070) — `fs.openSync(path, 'wx')` (atomic exclusive-create, POSIX and Windows, stdlib only), contents `{pid, hostname, startedAt}`. `withLifecycleLock(rootDir, fn, opts)` acquires (a synchronous `Atomics.wait`-based poll, 100ms interval, 10s bound, both injectable — none of the seven writer functions nor their existing synchronous tests turn `async`), runs `fn`, and always releases in `finally` (a bounded 3×20ms retry for Windows `EBUSY`/`EPERM`; never throws out of `finally`). Staleness = dead pid only (`process.kill(pid, 0)`, copied from `dashboard/runfile.mjs`'s `isPidAlive` rather than imported — no second `lib -> dashboard` import); a live holder is never auto-broken by age, and two waiters that both judge a lock stale race fairly on the next `'wx'` open. Acquired INSIDE `promoteTask`, `claimBatch`, `completeTask` (`lib/task-lifecycle.mjs`), `captureTask` and `dismissTask`'s confirm phase only — never its zero-write plan phase (`lib/task-lifecycle-capture-dismiss.mjs`), `rotateProtocol` (`lib/protocol-rotation.mjs`), and `rotateIndexDoneList`'s per-BC body, not `rotateAllIndexDoneLists`' loop (`lib/index-rotation.mjs`) — never at a CLI dispatch layer, since the two rotation scripts are independent entry points `work` bootstraps directly. `applyTaskMove` stays lock-unaware. `discoverRoot(cwd)` resolving to a worktree's own root means a verb running inside one takes a DIFFERENT lock file than `main` — documented, harmless today (only the unlocked `checkpoint` ever runs in a worktree, post-ghcaj). **`log` / `index-add`** are two new opts-only mechanics verbs on `lib/task-lifecycle-cli.mjs` (a per-verb arity table now distinguishes `'id'` verbs, argv unchanged, from these two `'opts'` verbs, argv `<verb> [json-opts]`, no positional id) — see the Commit doctrine entry above for their contracts. **`lib/scoped-commit.mjs`**'s `runScopedCommit(cwd, paths, message, opts)` is the one ASYNC function this task introduces (git-aware layer 3, ADR-0038's git-free CLI boundary unchanged) — see the Commit doctrine entry above.
- **`writeFileAtomic` (`lib/atomic-write.mjs`, agentic-workflow-vhz69)** — the same-directory temp-file + `renameSync` primitive every `INDEX.md`/`protocol.md`/archive write now goes through: `promoteTask`/`claimBatch`/`completeTask`'s two writes, `applyTaskMove`'s destination write, `materializeTaskFile`, `captureTask`/`dismissTask`'s confirm phase (including the surviving-backlink rewrites to a survivor task file or an ADR's `related_tasks`), `rotateProtocol`, and `rotateIndexDoneList` (including its header-heal path). This folds `writeNormalizedFile`'s previously-duplicated pair (`task-lifecycle.mjs` / `task-lifecycle-capture-dismiss.mjs`) into one exported implementation, imported by the latter. Temp name `.<basename>.<pid>.<counter>.tmp`, written beside the target so the rename is a same-filesystem metadata op; unlinked in a `finally` on any throw after it exists; a bounded 3×20ms EPERM/EBUSY retry on the rename (mirrors `lib/lifecycle-lock.mjs`'s release retry) before a structured `AtomicWriteError`, target untouched. Neither `.agentheim/contexts/<bc>/` nor `.agentheim/knowledge/` matches the dashboard frame router's ADVISORY/RUNTIME prefixes (`dashboard/app/live-frame-router.js`), so a temp-file create classifies STRUCTURAL — the same category the real write already produces — and `dashboard/watcher.mjs`'s 150ms debounce collapses the create+rename burst into the single `tree-changed` frame the write already emits, so no extra frame is observed in practice. Atomic against process death, not power loss (no `fsync`).
- **`bounce` / `reroute` — the two count-coupled lifecycle verbs pt0gy left open (agentic-workflow-qd24q, ADR-0077)** — `bounce <id> {"reason":...}` moves `doing → backlog` under its own dedicated `LEGAL_MOVES.bounce` policy key (never a widened `'skill'` — that policy's forward-only property stays real and unchanged for its three existing callers), appending the caller's `## Worker note` through `applyTaskMove`'s new `options.transformBody` hook so the note rides the mover's ONE destination write, never a second write; rejects `not-found`/`illegal-move`/`missing-reason`/`lock-timeout` with nothing written. `reroute <id> {"to": <bc>}` relocates a `backlog`-only task **across bounded contexts**, minting a fresh `<to-bc>-<token>` id (`lib/id-grammar.mjs`'s new `mintTaskId`, ADR-0044-backstopped) and RETIRING the old one rather than keeping it — `deriveContext`/`captureTask`'s `context-mismatch` guard would otherwise permanently disagree with a kept id. The new file carries `rerouted_from: <old-id>` as the crash-retry idempotence marker (old/new ids differ, so ADR-0055's usual same-id duplicate self-heal can't fire here), written BEFORE the old file is unlinked — ADR-0055's ordering, hand-rolled since a `backlog → backlog` relocation has no status change and never wraps `applyTaskMove`. Re-points (never strips) every project-wide `depends_on`/`blocks`/`prior_art`/`related_tasks` backlink, generalizing `dismissTask`'s own strip traversal into a shared `mapIdsInField` (ADR-0068 single-source, `dismissTask`'s own tests stay green unchanged). Legal only `backlog → backlog`; rejects `same-bc`/`not-in-backlog`/`unknown-bc`/`index-missing`/`lock-timeout` with nothing written. Wiring the remaining hand-writers (`work`'s BOUNCE integration, `quick-capture`'s cross-BC re-route) onto these two verbs is `agentic-workflow-fn59c`. See ADR-0077, ADR-0075, ADR-0055, ADR-0028 §8.
- **Layout (`legacy` / `board` / `mixed`, ADR-0078)** — which of the two `.agentheim/` root shapes a project's tree is actually in. `legacy`: `.agentheim/contexts/<bc>/...` plus `.agentheim/knowledge/protocol.md` (today's shape, this repo's own tree included). `board`: `.agentheim/board/<bc>/...` (task-system churn) plus `.agentheim/knowledge/contexts/<bc>/...` (durable knowledge) — the ADR-0078 target shape. `mixed`: both shapes present, or an ambiguous split-`vision.md` tree — every path getter and enumerator refuses it with a structured `mixed-layout` error rather than guessing. Resolved once per invocation by `lib/task-system-paths.mjs`'s `detectLayout`.
- **Task-system paths module (`lib/task-system-paths.mjs`, agentic-workflow-cj54k)** — the one place every lifecycle verb, rotation script, and live-tree lint resolves a `.agentheim/`-rooted path through: `detectLayout` plus a getter per path (`taskFolderPath`, `taskIndexPath`, `doneArchiveDir`, `protocolPath`, `protocolArchiveDir`, `knowledgeIndexPath`, `bcReadmePath`, `bcConceptsDir`, `topIndexPath`, `decisionsDir`, `researchDir`, `visionPath`, `contextMapPath`, `styleguideDir`), each accepting an `opts.layout` override, plus two enumerators (`listBoardContexts`, `listKnowledgeContexts`). Resolves correctly against whichever layout is actually on disk during the ADR-0078 transition window (this repo's own tree stays `legacy` until agentic-workflow-tgr31's dogfood migration); a later task hardens it to refuse `legacy` once that migration lands.
- **`migrate` verb (`lib/layout-migration.mjs`, agentic-workflow-e896r)** — the ADR-0078 §4 migration mover: a git-free, opts-only verb on `lib/task-lifecycle-cli.mjs` that moves a `legacy`-layout `.agentheim/` into the `board` layout. `detectLayout` is called EXACTLY ONCE, up front (never re-detected mid-move, since every `task-system-paths.mjs` getter throws `mixed-layout` on a genuinely mixed tree) — `board` returns `{ok:true, noop:true, changed:[]}` (zero writes, unlocked, mirroring `dismissTask`'s zero-write plan phase); `mixed` refuses `{ok:false, code:'mixed-layout'}` naming the root, zero writes; `legacy` proceeds under `withLifecycleLock` (ADR-0075): `fs.renameSync`s every lifecycle folder, `done-archive/`, `README.md`, `concepts/`, the design-system `styleguide/`, `vision.md`/`context-map.md`, and `protocol.md`+its archive dir into their `board`-layout destinations (so `git log --follow` survives); `board/` is created unconditionally even with zero BCs moved, closing the re-migrate-forever trap. A pure `splitIndexContent(text, bc)` splits each per-BC combined `INDEX.md` into its task half (`board/<bc>/INDEX.md`) and knowledge half (`knowledge/contexts/<bc>/INDEX.md`) — byte-verbatim except the adr-local/research-local relative-link depth rewrite and exactly one new cross-half Pointers line per half — written via `writeFileAtomic`; a marker block absent from the source (a legal empty BC) is never synthesized. Two further pure helpers, `rewriteTopIndexPointers` (only `knowledge/protocol.md`/its archive path move to `../board/`; the `bc-list` block and the `vision.md`/`context-map.md` Pointers lines are left untouched — they resolve correctly once they sit beside `index.md`) and `rewriteReadmeContent` (a BC README's literal `contexts/<bc>/<lifecycle-or-INDEX>` mentions, root `vision.md`/`context-map.md` mentions, and `knowledge/protocol.md` mentions move to their `board`/`knowledge`-prefixed equivalents; the same link-depth rewrite applies), rewrite the two remaining stale-pointer surfaces item 3 of the task names. A read-only `git worktree list --porcelain` guard refuses `worktree-active` when an `aw/<task-id>` worker worktree is registered (it still carries the legacy tree). The emptied `contexts/` tree is removed once every file under it has moved or split out. `migrate`'s legacy-reading path is PERMANENT (ADR-0078 §5) — never gated behind any later refuse-legacy hardening applied to other consumers. Manifest: `{ok:true, verb:'migrate', changed:['.agentheim'], moved, message}`, a single directory pathspec `runScopedCommit` accepts directly. Wiring it into skill prose (zgav8) and running it on this repo (tgr31) are separate, later tasks.

## Aggregates

- **Task** — protects: status always matches its folder (`backlog/` → `todo/` → `doing/` →
  `done/`); one task = one commit (with a bounded **trivial-squash carve-out**, ADR-0026);
  IDs are stable and never renumbered. New ids are `<bc>-<token>` — a 5-char random token,
  leading letter, collision-free by construction for multi-branch capture (ADR-0028); legacy
  `<bc>-NNN` sequential ids coexist untouched (go-forward, no rewrite). The two shapes are
  disjoint (token leads with a letter, legacy tail is all digits). A **dismissed** id
  (ADR-0022) is retired, not reused — by construction for tokens, by the next-free-number
  rule for legacy ids.
- **Vision** — protects: a single, two-minute-readable strategic root per project.
- **Knowledge base** (protocol + ADRs + research + indexes) — protects: every action is
  logged; indexes point rather than duplicate; ADR↔task backlinks stay bidirectional.
- **Bounded context (modeled)** — protects: a task belongs to exactly one BC; the BC's
  ubiquitous language is the single source of truth its tasks, code, and ADRs conform to; its
  `README.md` stays consolidated under the ~600-line trigger (ADR-0041) so it stays Read-able
  in one pass.

## Key events

Past-tense, domain-language (normalized to a bullet list, agentic-workflow-ghcaj — every
`README_DELTA` target section now shares the same bullet-extent shape; `## Runtime surface`'s
YAML fence stays the one deliberate exception, out of scope for deltas).

- Vision created
- Bounded context identified
- Idea captured
- Task refined
- Task promoted
- Task claimed
- Task completed
- Task verified
- Task bounced
- Task dismissed
- README consolidated
- Decision recorded (ADR)
- Research published
- Research reviewed

## Key commands

Intents entering the context (normalized to a bullet list, agentic-workflow-ghcaj).

- Brainstorm
- Quick Capture
- Refine
- Promote
- Dismiss
- Consolidate
- Work
- Research
- Dashboard

**Test command:** `node --test lib/test/*.test.mjs` (run from the repo root; the Node-25 explicit
glob form is required — the bare-dir form `node --test lib/test/` finds nothing under Node 25).
This covers every `lib/` module in this BC, including the three live-tree lints
(`lib/human-eye-criteria.mjs`, `lib/index-entry-length.mjs`, `lib/spike-stop-loss.mjs`) that
assert invariants against this repo's own `.agentheim/` tree — see ADR-0059's "Self-hosting-only
enforcement scope" note. Declared here so `work`'s per-batch test-command resolution (the BC
README first, then the project root — `agentic-workflow-g9s3w`) finds a command for any
`lib/`-touching task instead of fail-closing (agentic-workflow-b4yrm).

**Dismiss** (the `modeling` skill's fourth action, agentic-workflow-046) hard-deletes a
`backlog/`/`todo/` task under one confirmation, cascading to its **entire transitive dependent
subtree** (ADR-0022). Refuses the whole operation if any task in the set is in `doing/`/`done/`.
Around the raw `.md` deletes the skill reconciles bookkeeping for the whole set (INDEX
line+count per dismissed id, stripped backlinks from surviving tasks/ADRs, one bare protocol
entry); dismissed ids are retired, never reused. The removal lives entirely in the skill, never
a server endpoint (ADR-0017) — the dashboard's per-card trash-can only *seeds and fires* the
command through the bridge. See ADR-0022, ADR-0017, ADR-0007.

**Consolidate** (the `modeling` skill's fifth action, ADR-0041) rewrites a BC's `README.md`
**in place** once it crosses the ~600-line trigger — builder-in-the-loop, no archive, never
silently dropping a term, invariant, or backlink. Flagged by `whats-next`'s advisory line;
actually run by the builder via `modeling`. See ADR-0041, ADR-0027, ADR-0017.

**Dashboard** launches the local web UI over the project's `.agentheim/` folder — a flat Kanban
board, a task-only slide-over, and a main-pane reader for non-task documents, live-updating as
skills move files on disk. **Read-only** (ADR-0017): the board reflects the skills' moves,
never makes them. Invoked via the `/dashboard` slash command (agentic-workflow-011 — the
documented slash-command exception above), with three verbs: bare `/dashboard`
launches-or-reuses the detached server and **prints** the served URL (it does not open a
browser itself); `/dashboard stop` terminates it; `/dashboard status` reports running/not +
port from the runfile only. Thin trigger over `dashboard/launch.mjs`.

## Runtime surface

The manifest the verifier's **runtime-drive check** (check 8, ADR-0036) resolves once per batch
and reuses across every re-dispatch iteration — mirroring how the pre-resolved test command is
resolved once and reused. Declares what to boot, how, and what "up" means for this BC's one
runtime surface, the dashboard. Absent-manifest BCs get no check 8 at all; a manifest present but
un-touched by a given diff (no changed path matches `surfacePaths`) also draws no drive for that
task — exempt by default, no cargo-cult ceremony.

```yaml
surfacePaths:
  - dashboard/**
launch: node dashboard/launch.mjs
stop: node dashboard/launch.mjs stop
runfile: .agentheim/.dashboard/runtime.json   # read the ACTUAL bound port from here — never
                                               # assume the derived value; the 8-rung ladder
                                               # (ADR-0002 §infra-018/019) can move it
probes:
  - path: /healthz
    method: GET
    status: 200
    bodyShape: '{ status: "ok", root: string }'
  - path: /api/tree
    method: GET
    status: 200
    bodyShape: '{ contexts/lifecycle/task projection per ADR-0002 — pointers+metadata, not bodies }'
renderPaths: []   # opt-in only via a task's `runtime_render: true`; no browser capability is
                  # wired into this project yet, so the render tier never fires today
```

`launch`/`stop` delegate all OS-divergent spawn/kill logic to the one cross-platform launcher,
`dashboard/launch.mjs` (ADR-0002) — the check never hand-rolls `process.kill`. Both probes are
**reads** (ADR-0017: the dashboard is read-only, so every `probes` entry here must stay a read
endpoint). `launch` binds `cwd: tmpdir()` (ADR-0004), so a leaked server from a failed teardown
holds no lock on the worktree that spawned it.

## Relationships with other contexts

- **design-system** — this BC's first UI-bearing feature (the `dashboard`,
  agentic-workflow-001) depends on the design-system styleguide. **Frontend gate:** every
  UI/frontend task here must list `design-system-001-styleguide` in its `depends_on`, and
  no frontend task may be promoted to `todo` ahead of the approved styleguide.

A `context-map.md` may now be warranted as the BC count grows beyond one; revisit during
the next modeling pass.

## Open questions

- **Brainstorm on existing code (next iteration).** When `brainstorm` runs in a folder that
  already contains code, it should reverse-engineer a best-guess vision and domain from the
  code, present it, then continue the Socratic dialogue. Likely multi-agent; to be built via
  the skill-creator. Not present today.
- **Does `infrastructure/` ever split out?** For a markdown-and-prompts plugin there's no
  runtime infrastructure yet. Revisit if a genuine cross-cutting concern appears.
- **Merge gap.** `research-reviewer` + the `research-review` doctrine doc exist, but
  `skills/research/SKILL.md` is the older copy that doesn't call the gate. Reconcile on merge.
- **Stale framing.** `references/modes.md` still says modes are "designed for workshop use";
  with teaching dropped, rephrase toward model quality.
