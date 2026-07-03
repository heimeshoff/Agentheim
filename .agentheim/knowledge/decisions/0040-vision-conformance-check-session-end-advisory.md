---
id: ADR-0040
title: Vision-conformance check lives at work's session-end, as an advisory read of two named vision sections
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-v6d4n, agentic-workflow-d6q4h, agentic-workflow-x4t2g]
related_adrs: [0027, 0017]
---

# ADR-0040: Vision-conformance check lives at work's session-end, as an advisory read of two named vision sections

## Context

The 2026-07-02 harness audit called for closing the Why→What loop: today nothing
evaluates whether just-shipped work still serves `vision.md`, so the vision can
silently rot while `work` proceeds and only a human happens to notice.
`agentic-workflow-x4t2g` closed the *read* half — planning skills now consult the
`whats-next` advisory before acting. This ADR is the *evaluation* half:
`agentic-workflow-v6d4n` — something that actually reads the vision's success
criteria and non-goals and judges whether the batch just completed still serves
them, then flags drift.

Three forks needed settling before this could be built:

1. **Where does it run?** Candidates were the **verifier gate** (per-task), a
   **standalone pass**, or `work`'s **session-end reconciliation** (batch-level,
   already the home `agentic-workflow-d6q4h` built for the carry-over
   reconciliation step).
2. **What does it emit?** A hard gate, or something advisory?
3. **How does it judge?** A full per-task vision essay, a bounded read of a
   couple of named sections, or something else?

## Decision

**Session-end home, advisory-only output, two-section bounded read — one pass per
session over the batch just shipped, never a per-task gate.**

### 1. Where it runs: `work`'s session-end reconciliation

Folded into the existing end-of-run reporting sequence in `skills/work/SKILL.md`,
as a new step 5 ("Vision-conformance pass"), sitting between the existing
concept-candidate / surprise-surfacing steps and `agentic-workflow-d6q4h`'s carry-over
reconciliation (now step 6) and the final protocol entry (now step 7).

Rejected:

- **The verifier gate.** The verifier's contract (`agents/verifier.md`) is frozen
  to "acceptance criteria + tests, one task at a time, fresh context, no
  project-wide judgment." Widening it to also re-read the vision on *every* task
  would need its own ADR reshaping that contract, and would repeat the same
  vision read once per task instead of once per session — the more expensive
  shape for no additional signal (drift is a batch-level property; a single
  task rarely *is* the drift, a run of them trending the same way is).
- **A standalone pass.** Session-end already exists as a batch-level checkpoint
  (`agentic-workflow-d6q4h`) with the completed-task summaries already in hand.
  A separate pass would re-derive that same batch context for no reason.

### 2. What it emits: an advisory, never a gate

Two advisory surfaces, both governed by the ADR-0027 advisory-write family (an
opinion *about* the state, not a change *to* it — no lifecycle write, no task
move, no blocking):

- **Always:** a `**Vision-conformance:**` line in the session-end protocol entry,
  formatted by `lib/vision-conformance.mjs`'s `formatConformanceLine` — either
  `none — batch aligns with vision`, or one clause per flagged task naming the
  task id, the diverged-from criterion/non-goal, and a short note.
- **When a flag is worth the builder's attention** (`worthSurfacing(flags)` is
  true — any non-empty flag set): the same `.agentheim/state/whats-next.md`
  artifact `whats-next` itself writes (ADR-0027) is (over)written with the
  same frozen shape — frontmatter `generated` + the three sections *Where
  things stand* / *Recommended move* / *Next* — with **Recommended move** naming
  the flagged task(s) and **Next** suggesting the builder review them rather than
  proceed. This is not a new file and not a second conflicting owner: the
  artifact is explicitly single-latest by ADR-0027's own design (whichever pass
  wrote it last is "the current recommendation"), and it is already read back
  by the *next* session's `work` Phase 3 batch planning and by `modeling`'s
  "Before acting" step (`agentic-workflow-x4t2g`) — so a session-end drift note
  naturally surfaces as planning input for whatever runs next, closing the loop
  the harness audit asked for without inventing a second read path. A clean
  batch (no flags) writes nothing here, so it never overwrites a genuinely
  useful existing recommendation with a bland "all clear."

It **never** hard-blocks a task, a commit, or the session itself — the human
decides what to do with a flagged drift. This matches vision.md's own "Not
autonomous" non-goal: the human stays in the loop at every gate, and this check
adds a note for that loop to see, not a new gate for it to clear.

### 3. How it judges: a cheap, bounded read

The pass reads exactly two named `vision.md` sections — "What success looks
like" and "Non-goals" — via `lib/vision-conformance.mjs`'s
`extractVisionSections`, plus the session batch's already-summarized
completed-task entries (material already in hand for the session-end summary,
no extra reads). It asks one judgment question per shipped task: *does this pull
toward a stated non-goal, or away from a stated success criterion?* This is
LLM judgment, not a keyword match, and is intentionally **not** a per-task deep
dive or a whole-vision essay — a conforming batch should produce zero flags, and
manufacturing drift to look thorough is exactly the failure mode to avoid.

When a task IS flagged, the flag must name the specific vision line it diverges
from (`lib/vision-conformance.mjs`'s `labelFor` — the item's leading **bold**
phrase, e.g. "Not autonomous.", or a short excerpt when unbolded) — never a vague
"seems off."

## What's deterministic vs. judged

`lib/vision-conformance.mjs` (unit-tested, `lib/test/vision-conformance.test.mjs`,
`node --test`) covers everything mechanical:

- `extractSection` / `extractVisionSections` — pulling the two named sections'
  bullet/numbered items out of `vision.md`'s markdown.
- `labelFor` — the quotable short label for a flagged item.
- `formatConformanceLine` — the protocol line's exact text shape.
- `worthSurfacing` — the named threshold for whether a flag set also earns a
  whats-next write (currently: any non-empty set — kept as one named predicate
  so the threshold has a single place to change later).

The judgment itself — does a given shipped task actually diverge — is
irreducibly an LLM call and is *not* unit-tested; it is exercised instead by
`evals/vision-conformance-check/`'s two fixtures (a planted drift-toward-a-non-goal
task that should flag, and a clean batch that should not), run as a documented
runbook rather than a full multi-spawn k=3 measured eval (out of scope for this
task's budget — see that directory's README for the exact gap, mirroring the
"Known gaps" transparency `agentic-workflow-v3h6p`'s verifier-catch-rate eval used).

## Consequences

- One bounded vision read per session, not per task — cheap, and matches the
  batch-level nature of drift (a trend across several shipped tasks, not
  usually a single task in isolation).
- The verifier's contract stays exactly as frozen as `agentic-workflow-036`
  left it — this ADR does not touch `agents/verifier.md`.
- The whats-next artifact gains a second legitimate writer. This is safe
  *because* ADR-0027 already specified the artifact as single-latest and
  overwritten, not append-only or multi-section-per-owner; a second writer
  using the identical frozen shape is exactly the kind of reuse that design
  allows, not a violation of it. Future readers of that artifact should not
  assume "whats-next skill wrote this" — only "the latest advisory pass wrote
  this."
- If false-positive flags prove noisy in practice, the fix is tightening step 2
  of the SKILL.md prose (the judgment instructions), not adding a gate — the
  advisory-only shape is not up for renegotiation by this ADR.
