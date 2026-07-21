---
id: ADR-0058
title: ADR number allocation is collision-proof — workers mint a provisional number, the conductor finalizes it against `main`'s true state at squash-merge integration
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-hmgav]
related_adrs: [0028, 0032, 0038, 0042]
---

# ADR-0058: ADR number allocation is collision-proof — workers mint a provisional number, the conductor finalizes it against `main`'s true state at squash-merge integration

## Context

Dorc's July-2026 agent-time review (recommendation A6) surfaced two concrete failures under
manual ADR numbering ("look at existing ADRs, pick the next number", `references/adr-template.md`
line 5): one ADR number was minted but its file never committed, leaving a permanent hole; and two
workers in the same batch minted the same number for two different decisions. Agentheim runs the
same parallel-worker model that produced those failures — ADR-0032's per-worker git worktree
isolation. A worker in `.worktrees/<task-id>/` scans only its own worktree's `decisions/` listing
when it eyeballs "the next number"; it structurally cannot see a sibling worker's freshly-minted
ADR file sitting in a different, still-unmerged worktree. Two siblings can therefore guess the same
number, and the file for either guess never becomes real until (if ever) its worktree's branch is
squash-merged — so a bounced or failed task's guess, under the old convention, had no recorded
disposition.

This is the same failure family ADR-0028 already solved for task ids, but ADR ids carry a
convention task ids do not: ordinal continuity is a real, actively-used property (ADR-0038's own
"Note on ADR numbering" self-correction — reserved 0037, collided, refiled as 0038 — reads as
history precisely because the reader can see the sequence and its exception). Copying ADR-0028's
answer verbatim (a random token suffix) would work but throws that property away for no benefit
specific to ADRs, where the id space is small (dozens, not thousands) and typed by humans reading
`git log` and cross-references far more often than task ids are.

## Decision

**ADR numbers stay a small ordinal sequence. A worker's own guess at "the next number" is
explicitly provisional — it is what the worker writes into its ADR file inside its own worktree,
exactly as before. The number only becomes authoritative when the conductor, at squash-merge
integration time, runs it through `lib/adr-allocation.mjs`'s `finalizeAdrNumbering` against
`main`'s real `decisions/` directory, immediately after `git merge --squash` stages the worker's
files and before the integrating `git add`/commit.**

This is the "conductor-assigns-at-integration" shape named in this task's own brief, chosen over
the other two candidates because it exploits an invariant ADR-0032 already establishes rather than
inventing a new one: *"`main` is written only by the conductor, only sequentially"* (ADR-0032,
Decision). That single-threaded choke point is a free, zero-coordination place to assign a number
authoritatively — no worker ever needs to coordinate with any other worker, and the conductor never
needs to coordinate with itself, because it already processes one squash-merge at a time.

### 1. `nextAdrNumber(decisionsDir)` — the provisional mint

A worker (or a direct-commit skill such as `modeling`) calls this — or equivalently just eyeballs
the directory, the two are defined to agree — to pick a number for a brand-new ADR file: current
max `NNNN-*.md` in `decisionsDir` plus one, zero-padded to 4 digits. This is unchanged behavior
from before this ADR; the only thing that changes is that it is now explicitly **not**
authoritative, and there is a mechanized function agreeing with the manual eyeball so the two never
silently diverge.

### 2. `finalizeAdrNumbering(decisionsDir, provisionalFilenames)` — the authority

Called by the conductor, once per task that reports a non-empty `ADRS_WRITTEN`, against `main`'s
real `decisionsDir`, at the point in `skills/work/SKILL.md`'s "PASS / SKIP" choreography where
`git merge --squash` has just staged the worker's branch delta (including its ADR file(s)) onto the
main working tree, but before the enumerated `git add` + commit. Every `NNNN-*.md` file already in
`decisionsDir` OTHER than the ones just named is treated as already-final — true by the same
ADR-0032 invariant: any earlier same-batch task's ADR has already been finalized and committed by
the time this call runs, because integration is sequential.

The provisional file(s) are assigned sequential numbers starting at `(true max of everything else)
+ 1`, **regardless of what number they currently carry**. This one uniform rule handles both
failure modes named in the Dorc review with no special-casing:

- **Collision** (a sibling already landed the guessed number): the guessed number is already taken
  by a different, already-final file, so the new number differs from the old one and a rename
  fires.
- **A minted-but-never-merged number leaves no hole**: nothing is required to "record" this case
  because nothing on `main` was ever touched. A worker's provisional file lives only in its own
  worktree; if the task bounces or fails (ADR-0032's FAIL quarantine — "nothing merges to `main`"),
  `finalizeAdrNumbering` is simply never called with that filename, so no slot on `main` was ever
  consumed by the guess. A later task's `nextAdrNumber` call sees the same true max and mints the
  same number the abandoned worker guessed — nothing was ever "reserved" to become a permanent gap.
- **An over-guess** (the worker's worktree view was stale and it picked a number higher than the
  true next-free) is corrected the same way, closing a gap the naive "only fix real collisions"
  version of this rule would have let through.

When the rename fires, `finalizeAdrNumbering` rewrites the file's own frontmatter `id:` line and H1
heading in place, renames it on disk, and appends a short "## Note on ADR numbering" section
recording the old number — mirroring the precedent ADR-0038 already set by hand for its own
0037→0038 collision, now automatic. It returns `{changed: [oldPath, newPath], renumbered:
[{from, to, oldFilename, newFilename}]}`, matching `applyTaskMove`'s `changed: [fromPath, toPath]`
manifest convention for a rename (ADR-0038), for the conductor's scoped `git add`.

### 3. Git-free, layer-2-shaped (ADR-0038)

`lib/adr-allocation.mjs` never shells out to `git` — plain `fs` reads, a rename, and a content
rewrite, exactly like `applyTaskMove`'s move-on-disk. It makes no judgment call beyond "what is the
true next-free number": the caller (the conductor) decides *when* to invoke it (only when
`ADRS_WRITTEN` is non-empty) and owns the actual `git add`/commit, matching ADR-0038 Ruling B's
three-layer split (mover-shaped helper / git-free script / skill judgment+git).

### 4. Scope of this task: the worktree/squash-merge path only

This task wires the finalize step into `skills/work/SKILL.md`'s Git-authority doctrine (the
worktree/squash-merge flow, ADR-0032) and updates `agents/worker.md` and
`references/adr-template.md` to point at `nextAdrNumber` as the provisional-mint convention. It
deliberately does **not** touch `modeling`/`quick-capture`/`brainstorm`, which commit ADRs directly
to `main` without a worktree. Those skills share the same latent risk only if two independent
sessions mint an ADR concurrently on the same branch before either commits — a materially rarer
window than a parallel `work` batch, and out of this task's named scope (its `related_adrs` and
Notes both point at the ADR-0032 worktree case specifically). Left as a backlog item for whoever
next touches those skills' ADR-writing steps, rather than expanded here.

## Consequences

### Positive
- Two parallel workers can never end up with the same final ADR number — the conductor is the
  single sequential writer to `main`(ADR-0032) and now also the single sequential *numberer*.
- A minted-but-never-merged number never leaves a hole, by construction: nothing about it ever
  touches `main` unless `finalizeAdrNumbering` runs, which only happens on a real, committed merge.
- Ordinal continuity is preserved — unlike ADR-0028's task-id answer, ADR ids keep reading as
  history (`ADR-0057` was decided before `ADR-0058`), which the project actively relies on (ADR
  cross-references, ADR-0038's own numbering footnote).
- The mechanism costs nothing in the common case: a solo task's provisional guess is almost always
  already correct, so `finalizeAdrNumbering` is a no-op read-and-compare, not a rewrite.

### Negative
- When a rename does fire, any prose OUTSIDE the ADR file itself that already cites the provisional
  number (the task's own Notes/Outcome section being folded into the same commit, a BC README
  pointer) is not automatically patched — only the ADR file's own identity (frontmatter + heading)
  is. The conductor doctrine names this as a manual judgment step at the same commit boundary
  (it has both artifacts in hand), not an automated sweep; a stale cross-reference elsewhere is
  possible in the rare collision case, mitigated by the in-file "Note on ADR numbering" trail.
- The mechanism only covers the worktree/squash-merge (`work`) path; direct-commit skills keep the
  old unmechanized convention and share a smaller residual risk (see §4).

### Neutral
- `nextAdrNumber` and manual eyeballing are defined to agree, so nothing about how a worker actually
  picks its provisional number changes day to day — only what happens to that guess afterward.

## Alternatives considered

- **Random-token ADR ids (copy ADR-0028 verbatim).** Zero-coordination like this decision, but
  abandons ordinal continuity — a property ADR ids actively use (cross-references read as history,
  ADR-0038's own numbering footnote) and task ids never had. Rejected: ADR-0028's own rationale for
  giving up ordering doesn't transfer — task ids are typed constantly in `dismiss`/`refine` and the
  dashboard never sorted by them anyway, whereas ADR numbers are read as a timeline by humans far
  more than they're typed.
- **A reserved-range / allocation-file scheme** (each worker claims a range or writes a
  claim-ticket to a shared allocation file before minting). Rejected: reintroduces exactly the kind
  of shared mutable state across isolated worktrees this whole problem stems from — a worker still
  can't see a sibling's claim file in a different worktree without some coordination mechanism, and
  building one is strictly more machinery than exploiting the conductor's already-existing
  single-threaded merge point.
- **Renumber unconditionally on every finalize call, even when the guess is already correct.**
  Considered for uniformity; rejected as needless churn — `finalizeAdrNumbering`'s no-op branch
  (`oldNumber === newNumber`) already gives the same end state for zero cost, without touching a
  file (and its git history) that didn't need to change.
- **Patch every cross-reference to a renumbered ADR automatically (grep the repo, rewrite
  citations).** Rejected for this task's scope: high complexity (BC READMEs, other tasks' Notes,
  the task's own Outcome) for a case that is rare by construction (ADR-writing tasks rarely run in
  the same batch), and the in-file numbering note already gives a reader a trail. Left as a future
  enhancement if the residual risk is ever observed to bite, mirroring how ADR-0032 left an
  automatic-rebase enhancement future-not-baseline for its own rarer edge case.

## References
- ADR-0028 — collision-resistant task ids; the sibling problem this ADR solves differently for a
  different id shape.
- ADR-0032 — per-worker worktree isolation; the "`main` written only by the conductor, only
  sequentially" invariant this decision exploits directly.
- ADR-0038 — the three-layer lifecycle-mechanization boundary (mover / git-free script / skill
  judgment+git) this module's shape follows, and the 0037→0038 hand-renumbering precedent this
  ADR's auto-generated note mirrors.
- ADR-0042 — "composition owned by the caller at the squash-merge boundary", the pattern this
  decision extends from task completion to ADR numbering.
- `lib/adr-allocation.mjs`, `lib/test/adr-allocation.test.mjs` — this task's implementation.
