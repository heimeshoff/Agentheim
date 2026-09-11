# Concept template

Concept pages are the **opt-in** synthesis layer. They live at
`.agentheim/knowledge/contexts/<bc>/concepts/<concept>.md` and consolidate what a project knows
about one cross-cutting topic inside a bounded context — pulling signal from
ADRs, research reports, and done tasks into a single readable page.

## When to create one

Only when **all** of these are true:

1. **3+ artifacts converge.** At least three ADRs, research reports, or done tasks
   in the same BC bear on the concept. Fewer than that, and the source artifacts
   themselves are enough.
2. **A worker would otherwise re-derive the picture.** If the next task touching
   this concept can read one ADR and get going, you don't need a synthesis page.
   You need one when "what do we know about X" would otherwise be ten minutes
   of grepping.
3. **The user agrees.** Workers may *flag* convergence in their SUCCESS return
   (`CONCEPT_CANDIDATE: <name> — converging on N artifacts`), but they must not
   create the page themselves. The user decides.

If you're not sure whether to create one, don't. ADRs and research reports are
already cross-linked via frontmatter; the per-BC `INDEX.md` already catalogs them.
The concept page only earns its keep when those aren't enough.

## What goes in it

Synthesis, not duplication. The page summarises *what the project knows* — the
ADRs and research reports remain authoritative. A concept page that copies entire
ADR sections is doing it wrong; one that says "for the decision rationale, see
ADR 0014" is doing it right.

## Hard caps

- **60 lines max** (excluding frontmatter and the auto-generated footer). If
  you can't say it in 60 lines, the concept is too big — split it.
- **derived_from must list every source.** This is what makes drift detectable
  later. An undeclared source is a bug in the page.
- **No code blocks longer than 5 lines.** Code belongs in the codebase; the
  concept page references it, doesn't copy it.

## File format

```markdown
---
name: reading-session
description: How the Book BC models in-progress reads, sessions, and resumption
context: books
created: 2026-04-24
last_updated: 2026-04-24
derived_from:
  - 0007            # ADR ids
  - 0011
  - reading-session-research-2026-04-10   # research slugs
  - books-014       # done task ids
max_lines: 60
---

# Reading session — concept

## What it is
One paragraph defining the concept in the BC's ubiquitous language.

## Why it exists
The forces that pushed the project to introduce this concept — typically a
synthesis of the "Context" sections of the ADRs in `derived_from`.

## Current shape
The aggregate / entity / event / workflow that realises the concept today. Keep
this short — three to six bullets pointing at the authoritative locations:

- Aggregate `Book` in `src/books/book.ts` holds the reading-session state.
- ADR 0007 — single-session-per-book invariant.
- ADR 0011 — session resumption after device handoff.

## Open questions
Things this concept hasn't resolved yet — pulled forward from the source
artifacts' own open questions sections.

## See also
- `[ADR 0007]` — single session invariant
- `[ADR 0011]` — resumption
- `[research/reading-session-research-2026-04-10]`
- `[done/books-014-resumable-sessions]`
```

## How the wiki / index sees it

When created, the concept page gets a line under `<!-- concepts:start -->` in
the BC's `INDEX.md`. Workers grep `concepts/` on demand — concept pages are
**never** auto-loaded into worker prompts. The index points; the worker reads.

## Drift

`derived_from` is the drift detector. If an ADR in `derived_from` becomes
`superseded`, or a research report is replaced by a newer one, the concept page
is stale until it's revised. A future `lint` skill (deferred — Stage 8 in the
memory plan) will flag this. For now, the maintainer who touches a source ADR
should also touch any concept page that lists it.

## Workers may flag, but not write

In a SUCCESS return, a worker may add:

```
CONCEPT_CANDIDATE: <name> — converging on <N> artifacts (<id list>)
```

The orchestrator surfaces this at end-of-batch. The user decides whether to
create the page (via a manual write or a future `modeling` extension for concept
creation). Never auto-create.
