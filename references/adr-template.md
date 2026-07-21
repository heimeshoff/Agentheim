# ADR template

Use this shape for every architecture / domain decision record under `.agentheim/knowledge/decisions/`.

Filename convention: `NNNN-kebab-slug.md`, zero-padded 4-digit sequential number. Mint a
**provisional** number by looking at the existing ADRs in `.agentheim/knowledge/decisions/`
(equivalently, `lib/adr-allocation.mjs`'s `nextAdrNumber(decisionsDir)`) and taking the next one —
this is only a local guess, not authoritative, when you're a worker writing inside your own
`.worktrees/<task-id>/` (ADR-0032): a sibling worker in a different worktree can guess the same
number, and you cannot see its file. The conductor finalizes the true number against `main`'s real
state at squash-merge integration time (`finalizeAdrNumbering`, ADR-0058), renumbering on collision
so two parallel workers never end up with the same final number, and so a minted-but-never-merged
guess never leaves a hole in the sequence.

```markdown
---
id: 0007
title: Use Postgres as primary store for billing context
scope: billing           # bc-name | global
status: accepted         # proposed | accepted | superseded | deprecated
date: YYYY-MM-DD
supersedes: []           # list of ADR ids
superseded_by: []        # populated when this ADR is replaced
related_tasks: [billing-014]
related_research: [datastore-comparison-2026-04-24]
---

# ADR 0007: Use Postgres as primary store for billing context

## Context
What forces this decision. What was true about the world that made
this question come up. Keep it factual.

## Decision
The decision in one or two sentences. What we are doing.

## Consequences
### Positive
- Things that get better / become possible.

### Negative
- Things that get worse / become harder. Name them honestly.

### Neutral
- Side effects that are neither good nor bad, but worth knowing.

## Alternatives considered
- **Alternative A** — why we didn't pick it, in one or two sentences.
- **Alternative B** — same.

## References
Links to research reports, external docs, prior ADRs.
```

## Writing guidance

- **Context is about forces, not solutions.** If you find yourself writing "we decided to" in the Context section, it belongs in Decision.
- **Name the negatives.** An ADR with only positives is either lying or underthought.
- **Cite alternatives even if they were obviously worse.** Future readers need to know you considered them.
- **Keep it short.** If an ADR is three pages, you're writing a design doc, not a decision record.
