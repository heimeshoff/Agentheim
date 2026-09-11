---
id: agentic-workflow-hmgav
title: Central ADR number allocation — collision-proof minting under parallel workers
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [bookkeeping, adr, lifecycle, dorc-review]
related_adrs: [0028, 0032, 0038, 0042, 0058]
related_research: []
prior_art: [agentic-workflow-t7m4c]
---

## Why

Dorc review recommendation A6 (surviving piece 2 of 3): manual ADR numbering failed
under parallel workers — one ADR number was minted but its file never committed (a
permanent hole), and two workers collided minting the same number in the same batch.
Agentheim runs the same parallel-worker model (ADR-0032 worktrees), so the same failure
is live here: two workers in isolated worktrees cannot see each other's freshly minted
ADR files.

## What

Make ADR id allocation collision-proof. This is the same failure family ADR-0028 solved
for task ids, but ADRs carry an *ordinal* convention (ADR-0057 > ADR-0038 reads as
history) worth weighing before copying the random-token answer. Candidate shapes:

- a lifecycle-CLI verb that allocates the next number against disk at **integration
  time** (the conductor is single-threaded at squash-merge — workers mint a provisional
  id, the conductor assigns the final number when folding to main), or
- random-token ADR ids (zero-coordination, but abandons ordinality), or
- a reserved-range / allocation-file scheme.

Decide, record the decision as an ADR, implement the mechanism.

## Acceptance criteria

- [x] A decision ADR weighs ordinal continuity vs zero-coordination and picks a scheme.
- [x] The mechanism is implemented such that two parallel workers cannot end up with the
      same final ADR number, and a minted number cannot silently vanish (no committed
      hole in the sequence without a record).
- [x] Existing ADR ids and their backlinks are unchanged.
- [x] Worker/orchestrator doctrine (`agents/worker.md`, ADR-writing steps) points at the
      allocation mechanism instead of "next free number".
- [x] If a helper lands in `lib/`, it is git-free (ADR-0038) with `node --test` coverage.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. The conductor-assigns-at-merge
shape fits the existing ADR-0042 pattern (composition owned by the caller at the
squash-merge boundary); worth evaluating first.

Decision recorded in **ADR-0058**: workers keep minting a provisional number in their own
worktree; the conductor finalizes it against `main`'s true state at squash-merge integration
time, exploiting ADR-0032's "`main` written only by the conductor, only sequentially"
invariant. Chosen over ADR-0028's random-token answer because ADR ids actively use ordinal
continuity (unlike task ids); chosen over a reserved-range/allocation-file scheme because it
would reintroduce shared mutable state across isolated worktrees for no benefit over the
already-existing single-threaded merge point.

## Outcome

Implemented collision-proof ADR number allocation as a two-function split matching the
worker-worktree / conductor-squash-merge boundary (ADR-0032), recorded in **ADR-0058**.

- **`lib/adr-allocation.mjs`** (new, git-free, `node --test` covered):
  - `nextAdrNumber(decisionsDir)` — the PROVISIONAL mint (current max `NNNN-*.md` plus one),
    what a worker calls (or eyeballs, defined to agree) inside its own worktree.
  - `finalizeAdrNumbering(decisionsDir, provisionalFilenames)` — the AUTHORITATIVE step, run
    by the conductor against `main`'s real `decisions/` dir after a worker's squash-merge
    stages its ADR file(s) but before the integrating commit. Assigns sequential numbers
    starting at the true max of every OTHER file plus one, regardless of the guessed number —
    one rule handles both a same-number collision with an already-landed sibling ADR and an
    over-guessed number that would otherwise leave a gap. On rename it rewrites the file's
    filename, frontmatter `id:`, and H1 heading, and appends a "Note on ADR numbering" trail
    (mirroring ADR-0038's own hand-written 0037→0038 precedent, now automatic). A
    bounced/failed task's provisional file is simply never passed in (ADR-0032's FAIL
    quarantine never merges to `main`), so it never consumes a slot — no committed hole,
    ever, by construction, with nothing to explicitly "record."
- **`lib/test/adr-allocation.test.mjs`** (new, 8 tests, TDD red→green): empty-dir mint,
  max+1 mint, no-op when the guess is already correct, collision-renumber, over-guess
  gap-correction, multi-file-in-one-call sequential assignment (both the already-correct and
  the collision sub-cases), and the "discarded provisional file leaves no hole" case. Full
  `lib/test/*.test.mjs` suite: 237/237 green.
- **`references/adr-template.md`** — replaced "Look at existing ADRs to pick the next
  number" (the informal, un-mechanized convention this task existed to fix) with the
  provisional-mint / conductor-finalizes framing.
- **`agents/worker.md`** — Fourth action ("record decisions") now names the provisional-mint
  convention explicitly and points at the conductor's finalize step, instead of leaving ADR
  numbering as an implicit, undocumented eyeball.
- **`skills/work/SKILL.md`** — "Per ADR written" bookkeeping (Git authority, PASS/SKIP) gained
  a new first step: run `finalizeAdrNumbering` before index insertion / backlinks, since a
  rename changes the filename and id every later step depends on; documents that a renumber
  also requires patching the task's own Notes/Outcome references to the new number (the
  finalize step itself only touches the ADR file's identity, not prose elsewhere).
- **BC README** — new entry describing both functions, the ADR-0032 invariant they exploit,
  and the explicit scope carve-out (worktree/squash-merge path only; `modeling` /
  `quick-capture` / `brainstorm`'s direct-commit ADR writes are unchanged — flagged as a
  smaller residual risk for a future task, not expanded here).
- Existing ADR ids/backlinks (ADR-0001 through ADR-0057) are untouched — the mechanism only
  ever renumbers a still-provisional file at the moment it is finalized, never a
  already-committed one.

Key files: `lib/adr-allocation.mjs`, `lib/test/adr-allocation.test.mjs`,
`.agentheim/knowledge/decisions/0058-adr-number-allocation-conductor-finalizes-at-squash-merge.md`,
`references/adr-template.md`, `agents/worker.md`, `skills/work/SKILL.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
