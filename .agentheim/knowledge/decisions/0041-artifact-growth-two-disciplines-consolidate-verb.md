---
id: ADR-0041
title: Artifact-growth doctrine — cap-and-roll vs flag-and-consolidate; the modeling CONSOLIDATE verb
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-w7q2m, agentic-workflow-r2c7m, agentic-workflow-c8j3w]
related_adrs: [0017, 0022, 0026, 0027, 0039, 0038]
---

# ADR-0041: Artifact-growth doctrine — cap-and-roll vs flag-and-consolidate; the `modeling` CONSOLIDATE verb

## Context

Three `.agentheim/` artifacts grow monotonically as a project ages and are all **pre-loaded
whole** into worker/specialist spawn prompts or read in full by a skill's "before acting" step,
so unbounded growth silently taxes every spawn's context budget:

1. `.agentheim/knowledge/protocol.md` — a prepend-only chronological diary (`agentic-workflow-r2c7m`).
2. A BC `INDEX.md`'s done-task list — an append-only catalog (`agentic-workflow-c8j3w`).
3. A BC `README.md` — curated prose: ubiquitous language, invariants, per-feature narration
   (`agentic-workflow-w7q2m`, this task).

The first two are **lists of discrete, individually-addressable entries** (a protocol entry, a
done-task line) that no reader needs in aggregate — every reader of `protocol.md` opens only the
recent-activity window (ADR-0039's finding), and a done-task's INDEX line is only useful for the
one prior-art lookup pass, not for bulk reading. Because the entries are already atomic and
machine-legible, a script can **losslessly** move older ones out **verbatim**, with no judgment
required about what any individual entry means.

A BC README is different in kind. It is not a list of atomic entries — it is **curated prose**:
a term's definition might be one clause inside a paragraph that also states an invariant and
narrates three superseded implementations of the same feature. There is no line a script can cut
without either destroying a sentence's meaning or leaving orphaned fragments. Compaction here
means **rewriting**, not **relocating** — a fundamentally different operation that a deterministic
script cannot safely perform (it cannot tell "settled current-state fact" from "historical color
safe to compress" from "the only remaining sentence stating an invariant").

`agentic-workflow-w7q2m`'s own README was the live case: 811 lines at capture, 1006 by the time
this task ran (past the ~25k-token Read cap), because a decade of dashboard feature narration
("aw-020 did X, then aw-023 relocated it, then aw-026 removed it...") had accreted inside what
started as a glossary.

## Decision

**Artifact growth in this project splits into two disciplines, chosen by whether the artifact is
a list of atomic entries or curated prose:**

### 1. Cap-and-roll (mechanical, scripted, archived) — for lists

Applies to `protocol.md` (ADR-0039) and, prospectively, a BC `INDEX.md`'s done-task list
(`agentic-workflow-c8j3w`). Verbatim move of whole atomic entries, oldest-first, to a dated
archive file once a live-file line cap is crossed; no rewriting, no judgment, no human in the
loop, invoked as a k5n8f-family script (`lib/protocol-rotation.mjs` is the reference shape).
Safe *because* no reader needs the archived entries in the live read window.

### 2. Flag-and-consolidate (judgment, human-in-loop, in-place) — for prose

Applies to a BC `README.md`. No archive: the file is **rewritten in place**, because there is
nothing atomic to relocate — an entry's meaning is entangled with its neighbors. The builder
stays in the loop because only a human (or an LLM under a human's confirmation, per this
project's human-in-the-loop stance, ADR-0017) can judge which sentences are settled fact, which
are safe-to-fold history, and which are the last remaining statement of an invariant.

**Trigger:** a BC `README.md` at or over **600 lines** is flagged. This is a **line-count**
threshold — checkable without judgment or a tokenizer — calibrated against this BC's own prose
density (~34.8 tokens/line at capture time): a README becomes un-Readable in a single ~25k-token
pass around ~718 lines, so 600 leaves headroom to consolidate *before* that ceiling, not after.
`whats-next` surfaces the flag as a recommended-move line — `README <bc> is over the
consolidation threshold — consolidate` — riding its existing single advisory-write artifact
(ADR-0027 §4); no skill auto-rewrites README prose unattended.

**Procedure:** a fifth `modeling` verb, **CONSOLIDATE**, beside CAPTURE / REFINE / PROMOTE /
DISMISS — the same doctrine shape ADR-0022 fixed for DISMISS: a named verb with a precise
contract, builder-in-the-loop, its own scoped commit (ADR-0026). CONSOLIDATE:

- Reads the whole target README (paging as needed — the same constraint the flag exists to
  relieve).
- Merges redundant ubiquitous-language entries that describe the same term/feature from more
  than one angle.
- Folds superseded per-feature narration ("A did X, then B superseded it, then C removed it")
  into a settled, current-state summary — describing what's true *now*, keeping lineage only
  where it is itself load-bearing (an explicit, still-relevant supersession).
- **Never silently deletes a term or an invariant.** A genuinely dead term/invariant is only
  dropped after the builder explicitly confirms it — CONSOLIDATE shortens prose, it does not
  prune domain knowledge unilaterally.
- **Never breaks a backlink.** Every ADR id / task id left in the rewritten README must still
  resolve on disk; redundant repeated citations of an already-cited-nearby id may be trimmed, but
  never an id's sole remaining occurrence if it is the reader's only path to that context.
- Writes the rewritten README **in place** (no archive) and commits it — scoped `git add` of
  exactly the README and `protocol.md` — as its own `model(<bc>): consolidate <bc> README`
  commit (extending the message table in `references/commit-doctrine.md`).

CONSOLIDATE is deliberately **not** a k5n8f-family script and depends on nothing from the
cap-and-roll chain (`depends_on: []` on `agentic-workflow-w7q2m` is a direct consequence of this
split): it stands independent because its operation is categorically different, not because the
growth problem is unrelated.

## Consequences

### Positive
- One named framework — "is this a list or prose?" — decides which discipline any future growth
  surface gets, instead of each new growth problem re-deriving its own convention from scratch.
- The prose discipline keeps a human judging what "settled" means, so ubiquitous language and
  invariants cannot silently erode the way a purely mechanical rewrite risks.
- CONSOLIDATE reuses DISMISS's proven verb shape (named contract, builder-in-loop, scoped
  commit), so `modeling` gains a fifth action without inventing new mechanics.

### Negative
- Flag-and-consolidate cannot be fully automated or unattended — a README over threshold stays
  over threshold until a human sits down with `modeling` CONSOLIDATE, whereas cap-and-roll fires
  itself. This is accepted as the cost of never silently losing meaning.
- Judging "settled" vs "load-bearing history" is inherently soft; two consolidation passes by
  different people could reasonably fold different amounts. Mitigated by the explicit
  confirm-before-write step and by never deleting a term/invariant without sign-off.

### Neutral
- `agentic-workflow-c8j3w` (the INDEX done-list rotation) is unworked as of this ADR; it is
  expected to land as a cap-and-roll instance per ADR-0039's convention, not flag-and-consolidate
  — named here so the three growth surfaces (`r2c7m`, `c8j3w`, `w7q2m`) share one framework
  rather than three independent mental models.

## Alternatives considered

- **One unified mechanism for all three surfaces (always verbatim archive).** Rejected — a
  README's meaning lives in prose, not atomic entries; verbatim archival would either leave dead
  weight in the live file (defeating the point) or require splitting sentences at arbitrary line
  boundaries, corrupting meaning.
- **Let an LLM auto-rewrite the README unattended whenever it crosses the threshold.** Rejected —
  this project's human-in-the-loop stance (ADR-0017) and the explicit risk that "a machine can't
  safely rewrite ubiquitous language without dropping meaning" (this task's own capture) rule out
  unattended prose rewriting; CONSOLIDATE is deliberately builder-in-the-loop.
- **A calibrated token-count trigger instead of a line-count trigger.** Rejected for the trigger
  itself (though used to *derive* the line cap) — a tokenizer dependency is unnecessary machinery
  for a threshold whose only job is "flag before the Read cap bites"; a line count is checkable
  by any reader with no extra tooling.
- **Two separate ADRs (one for the CONSOLIDATE verb's contract, one for the two-disciplines
  framing).** Rejected in favor of this single ADR — the two questions are one decision in
  practice: the verb's contract *is* the concrete instance of the framing, and splitting them
  would force a future reader to cross-reference two documents to understand either.
