---
id: ADR-0074
title: Worker branch carries source and tests only — the conductor materializes README delta / ADR / task-move / backlog-item bookkeeping on `main` at squash-merge integration (amends ADR-0032 §3, §4, §6)
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-ghcaj]
related_adrs: [0032, 0037, 0057, 0058, 0026, 0038, 0063, 0059, 0041, 0042, 0061, 0072]
---

# ADR-0074: Worker branch carries source and tests only — the conductor materializes bookkeeping on `main` at squash-merge integration

## Context

Parallel worktree batches (ADR-0032) conflict at merge-back far more often than the model was
meant to allow, and the protocol record shows the conflicts are **never code** — git's 3-way
merge has reconciled every parallel code edit cleanly since ADR-0032 landed. Every real
merge-back conflict recorded so far has been a `.agentheim/` prose artifact: the BC `README.md`
(two same-BC workers rewrite the same bullet, or an additive entry collides with a wholesale
rewrite — 2026-07-03), an ADR amendment appended by two workers at the same anchor
(2026-07-13), or `dashboard/dist/app.js` (already made unstageable by ADR-0057). In a
single-core-BC project like this one, almost every task touches the same README, so the
conductor keeps holding ready tasks "to the next wave" on the Phase 3 advisory — the
parallelism ADR-0032 exists to unlock is throttled by prose, not by code.

ADR-0032 already established that `main` is written only by the conductor, only sequentially
(steps 4 and 6 of its choreography), and that the worker writes its own BC README, its ADRs,
and its own task-file move — all **inside its worktree** (step 3). This ADR narrows step 3 to
source and tests only, and moves everything else it used to cover onto the conductor's already-
existing steps 4 and 6.

## Decision

**Shrink what a worker's private branch may contain to source and tests only.** The worker
never writes under `.agentheim/` — not its README, not an ADR, not its own task file, not a
backlog item. Everything it would have written travels in its strict `RESULT` block as four new
structured fenced blocks (`README_DELTA`, `ADRS`, `OUTCOME`, `BACKLOG_ITEMS` —
`references/worker-return-format.md`), and the conductor materializes all of it on `main`,
sequentially, after the code squash-merges, inside the one integrating commit ADR-0026
requires.

### Report-carried, not worktree-carried — the alternative considered and rejected

The orchestrator round considered leaving the bookkeeping files in the worktree, unstaged, and
re-applying them at integration (a "worktree-carried, staged-later" design). Rejected: that
merely relocates the textual merge from squash-merge time to a later re-apply step, and under
ADR-0038's git-free `lib/` boundary there is no 3-way machinery to relocate it to — a worktree
diff of a README file is exactly the git-conflict shape this task exists to eliminate, wherever
it's replayed. Report-carried is also the port-shaped answer for the planned rework: a remote
TaskStore has no files a worker could edit at all — it must report. The return-format blocks are
designed once here, for that seam.

### The two-op README delta grammar, and its monotone invariant

`lib/readme-delta.mjs`'s `applyReadmeDelta(content, {section, ops}) → {content, dispositions}`
is a pure, git-free, two-op grammar:

- **`append`** — a new bullet at the end of the named section's bullet list.
- **`replace`** — anchored on `(section, termHead)`, where `termHead` is the bullet's bold
  lead-in truncated at its first `(`, whitespace-collapsed (bold lead-ins are **not** unique
  across sections in the real README — `**Bounded context (modeled)**` appears in both
  `## Ubiquitous language` and `## Aggregates` — so the section is part of the key).
  `expected` is the old bullet text the worker read, compared whitespace-collapsed, an
  optimistic precondition mirroring `applyTaskMove`'s mtime check.

**No `remove`, no `rename-section`, no section creation.** This is deliberate and is the
grammar's load-bearing invariant: *delta application is monotone in the set of terms and
invariants a README states — only CONSOLIDATE (ADR-0041), builder in the loop, may reduce it.*
An append-only grammar was considered too weak (workers legitimately amend existing bullets —
`agentic-workflow-rw6ck` and `agentic-workflow-pcwnn` both do); a full free-form replace was
considered too strong (it reopens same-target collisions with no structure to resolve them by).
The two-op grammar with the `(section, termHead)` anchor is the middle: expressive enough for a
worker's real edits, structured enough for the conductor to resolve a collision without
guessing.

A delta naming a section that does not exist lands as an `append` into `## Ubiquitous language`
with disposition `appended-fallback` — never a silently created section, never a refusal that
strands already-merged code without its README entry.

### The collision rule, and why ADR-0032's no-auto-guess clause survives it

When a `replace`'s `expected` no longer matches the bullet's current text (a sibling integrated
earlier this batch, the conductor's own earlier write this batch, or a concurrent `modeling`
session), the conductor — already the sole `main` writer and the judgment layer ADR-0032 built
— **merges the incoming body onto the current bullet** (inserting it immediately after the
anchor's extent) so both intents survive, disposition `merged`, never a silent overwrite and
never a refusal. This is pcwnn's authority rule applied to prose: never undo the other change,
re-express your own on top.

**ADR-0032's "no merge is ever auto-guessed" clause is intact, not weakened.** That clause
guards against a machine discarding one side of a **git conflict** at merge-back. Under this
ADR there is no git conflict at that seam anymore — `applyReadmeDelta` and
`finalizeAdrNumbering` apply sequentially on `main`, never as a 3-way merge — so there is
nothing for the clause to protect against here, and nothing is discarded: both the current
bullet and the incoming one survive in the document. The disposition (`merged` /
`appended-fallback`) also travels to the verifier, so the merge is never silent even though it
is never surfaced to the user as an interruption.

### On-`main` task-file annotations

`## Verifier note (iteration N)`, `## Salvage note`, and (ADR-0072) `## Merge-conflict note`
are now written into **`main`'s copy** of the task file, uncommitted between iterations —
committed by the eventual integrating or escalation commit. There is exactly one copy of the
task file at any time: it never moves inside a worker's worktree at all anymore, not even the
`doing → done` move, which now happens for the first time at PASS/SKIP integration. Reading a
task file never needed worktree isolation in the first place — only writing did, and the
worker no longer writes it.

### Retired fields, and un-bundled decisions

- **`BC_README_UPDATED` is retired.** A non-empty `README_DELTA` is the signal now.
- **The old id-only `NEW_BACKLOG_ITEMS` field is retired**, replaced by `BACKLOG_ITEMS` carrying
  full task-file bodies — the id-only shape was sufficient only because the worker wrote the
  file itself; it no longer does.
- **`MAX_PARALLEL` is explicitly un-bundled from this task.** Phase 3's same-BC-README advisory
  annotation is retired outright (the collision it warned about can no longer happen at
  merge-back), but raising the default parallelism cap is a separate, evidence-gated builder
  decision this ADR does not make.
- **`checkpointFiles`'s moved-from-`doing/` detection (agentic-workflow-w2njd) is now dead** for
  the worker path — no task file ever moves inside a worktree again, so the detection can never
  find anything to fold in. Kept in place with a doctrine note rather than removed; a follow-up
  task may clean it up once the dead branch has been observed to never fire.

### Mechanize-or-drop declaration (ADR-0059)

Two different mechanizability postures, stated explicitly:

1. **Mechanized:** `lib/readme-delta.mjs` (the delta grammar), `lib/worker-result.mjs` (RESULT
   block parsing, including the four-backtick block-fence grammar), `lib/task-lifecycle.mjs`'s
   new `materializeTaskFile`, `lib/derived-artifact-guard.mjs`'s new `BOOKKEEPING_PATH_PREFIXES`
   / `bookkeeping-path` reason, and `lib/worktree-salvage.mjs`'s new `bookkeepingSalvagePath` —
   all pure, all git-free, all `node --test`-covered, including a tmpdir git fixture
   (`lib/test/integration-commit-shape.test.mjs`, the bounded ADR-0038/ADR-0072 exception)
   pinning the one-commit integration shape and the both-intents-survive collision behavior.
2. **Prose-only, unenforced:** the conductor's **sequencing** — squash-merge, then apply the
   README delta(s), then write the ADR(s) and finalize numbering, then append the Outcome, then
   complete, then materialize backlog items, then insert INDEX/backlinks, then the one `git add`
   and commit (`skills/work/SKILL.md`'s "PASS / SKIP" §(a)–(f)) — is conductor-executed prose,
   the same category ADR-0063's "salvage before every removal" ordering and ADR-0072's
   seven-rung ladder sequencing already occupy. A lint could only check after-the-fact artifacts
   (a README delta was applied, an ADR file exists) with no reliable way to catch a *skipped*
   step at the moment it matters, before the commit has already landed. Building a
   plausible-looking but unreliable lint here would be worse than none.

## Consequences

**Positive**
- The two recorded classes of real merge-back conflict (README, ADR-amendment) can no longer
  occur at merge-back at all — they are resolved as a prose merge on `main`, sequentially,
  never as a git 3-way merge.
- The Phase 3 same-BC-README advisory throttle is retired outright, unblocking the parallelism
  ADR-0032 was meant to unlock, without needing to touch `MAX_PARALLEL` itself.
- The report-carried shape is reusable verbatim by a future remote TaskStore/DecisionStore port
  — the seam was designed once, here.
- Task-file annotations collapse to one copy, removing an entire class of "which copy is
  authoritative" bookkeeping ADR-0032 had to carry.

**Negative**
- The conductor's PASS/SKIP integration order grows from two steps (squash, complete) to six
  (squash, README delta, ADR write + finalize, Outcome append, complete, materialize backlog
  items) before the one commit — more sequencing to hold correctly, mitigated only partially by
  mechanizing each individual step.
- A worker's `RESULT` block is materially larger and more structured (four fenced blocks vs.
  none) — more for a worker to compose correctly and more for `parseWorkerResult` to reject
  cleanly when malformed.
- The checkpoint guard's `bookkeeping-path` refusal and the vestigial moved-from-`doing/`
  detection are two pieces of "renders inert" prose/dead-branch reasoning a future reader has
  to hold at once, mirroring ADR-0057's own accepted tradeoff.

**Neutral**
- Complements ADR-0072 (the merge-back conflict ladder): once this ADR lands, the ladder fires
  almost exclusively on genuine code conflicts — rare in this project's history — since prose
  conflicts mostly vanish. Neither ADR blocks the other.
- `scope: agentic-workflow`, matching its doctrine lineage (ADR-0032/0026/0007) — in this
  single-BC repo, semantically equivalent to `global`.

## Alternatives considered

- **Worktree-carried, staged-later** (leave bookkeeping files in the worktree, re-apply at
  integration). Rejected — see "Report-carried, not worktree-carried" above: this relocates the
  textual merge rather than removing it, and there is no 3-way machinery in git-free `lib/` to
  relocate it to.
- **Append-only README delta grammar.** Rejected — workers legitimately amend existing bullets,
  not just add new ones; an append-only grammar would force every amendment through CONSOLIDATE,
  overloading a builder-in-the-loop operation with routine maintenance.
- **Full free-form `replace` (raw old-text/new-text diff).** Rejected — reopens the exact
  same-target collision problem this ADR exists to structure away, with no anchor to resolve it
  by.
- **Auto-resolve a collision by preferring the later worker's body outright (last-write-wins).**
  Rejected — silently discards the earlier worker's verified, already-integrated intent, which
  is precisely what ADR-0032's no-auto-guess clause was written to prevent in the git case; the
  merge-both-intents rule is the direct analogue that preserves the same spirit in the prose case.
- **Mechanize the conductor's integration sequencing as a single script.** Rejected per the
  mechanize-or-drop declaration above — the sequencing spans multiple judgment calls (does this
  delta's `document` field resolve to a real BC, is this ADR's `scope:` local or global) better
  suited to conductor prose than a brittle script.

## References

- ADR-0032 — the worktree-isolation model and choreography steps 3/4/6 this ADR amends.
- ADR-0057 — the derived-artifact checkpoint guard; this ADR's `bookkeeping-path` reason is a
  second frozen prefix on the same guard.
- ADR-0058 — ADR number allocation; `finalizeAdrNumbering` is unchanged, only who writes the
  provisional file (the conductor, from the worker's `ADRS` block) and when.
- ADR-0063 — worktree-abandonment salvage; this ADR's `bookkeepingSalvagePath` is a sibling
  function to `salvagePatchPath` for the worker's reported blocks.
- ADR-0041 — the README consolidation trigger and CONSOLIDATE verb; this ADR's delta grammar
  preserves ADR-0041's own monotone invariant.
- ADR-0072 — the merge-back conflict ladder; complementary, not overlapping (code conflicts
  only, once this ADR lands).
- `lib/readme-delta.mjs`, `lib/worker-result.mjs`, `lib/task-lifecycle.mjs`'s
  `materializeTaskFile`, `lib/derived-artifact-guard.mjs`'s `BOOKKEEPING_PATH_PREFIXES`,
  `lib/worktree-salvage.mjs`'s `bookkeepingSalvagePath`, `lib/test/integration-commit-shape.test.mjs`
  — this task's implementation.

## Note on ADR numbering

Minted provisionally as ADR-0073 in its worker worktree. A sibling task's ADR already claimed that number (or the guess overshot the true count) by the time this task's conductor finalized numbering at squash-merge integration (`lib/adr-allocation.mjs`'s `finalizeAdrNumbering`, ADR-0058) — this ADR was renumbered to **ADR-0074**, the true next-free number on `main` at that moment. No content besides this identity changed.
