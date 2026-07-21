---
id: agentic-workflow-hmgav
title: Central ADR number allocation — collision-proof minting under parallel workers
status: todo
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [bookkeeping, adr, lifecycle, dorc-review]
related_adrs: [0028, 0032]
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

- [ ] A decision ADR weighs ordinal continuity vs zero-coordination and picks a scheme.
- [ ] The mechanism is implemented such that two parallel workers cannot end up with the
      same final ADR number, and a minted number cannot silently vanish (no committed
      hole in the sequence without a record).
- [ ] Existing ADR ids and their backlinks are unchanged.
- [ ] Worker/orchestrator doctrine (`agents/worker.md`, ADR-writing steps) points at the
      allocation mechanism instead of "next free number".
- [ ] If a helper lands in `lib/`, it is git-free (ADR-0038) with `node --test` coverage.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. The conductor-assigns-at-merge
shape fits the existing ADR-0042 pattern (composition owned by the caller at the
squash-merge boundary); worth evaluating first.
