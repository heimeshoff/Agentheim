---
id: ADR-0060
title: INDEX entry-length cap — new task/ADR bullets capped at ~60 words; a date-boundary lint grandfathers existing entries
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-ngzwz]
related_adrs: [0041, 0047, 0039, 0059, 0044]
---

# ADR-0060: INDEX entry-length cap — new task/ADR bullets capped at ~60 words; a date-boundary lint grandfathers existing entries

## Context

Dorc's July-2026 agent-time review, recommendation A6, named single INDEX bullets running
300-500 words as a per-session context tax on every worker and verifier that reads the
catalog. Agentheim's own `contexts/agentic-workflow/INDEX.md` shows the same drift: recent
ADR entries (`ADR-0057`, `ADR-0053`) run well over 100 words each. The two other pieces of
A6 (protocol rotation never firing, the done-list cap not enforced) are already closed by
ADR-0045/0047; this ADR closes the third: nothing capped an individual entry's *length*, only
the *list's* size. The INDEX is a catalog — it is supposed to point, not narrate; the ADR/task
file the pointer reaches is where detail belongs.

Per ADR-0059 (mechanize-or-drop, `agentic-workflow-z394j`), a task establishing a convention
must ship enforcement or explicitly record "prose-only, unenforced." This task is the
self-referential proof case ADR-0059 names — it must satisfy its own rule, and it ships
enforcement rather than taking the escape hatch.

Enforcement, however, cannot use ADR-0044's `GRANDFATHERED_IDS` shape verbatim: that pattern
allowlists a *single* known-bad id. Here, dozens of pre-existing entries across every BC's
`INDEX.md` and the top-level `.agentheim/knowledge/index.md` already exceed any sane cap —
enumerating them by id would be a large, brittle, one-time list that immediately goes stale as
more entries are written. The task's own Notes anticipated this: "grandfathering mirrors
ADR-0044's `GRANDFATHERED_IDS` pattern," but the *mechanism* of grandfathering has to scale
past one id.

## Decision

**A newly written INDEX task or ADR bullet is capped at ~2-3 sentences (~60 words): the claim
and the pointer, with any further detail living in the linked artifact. Existing over-length
entries are left verbatim — no retroactive rewrite (mirrors ADR-0039's verbatim cap-and-roll
discipline). Grandfathering is done by DATE, not by an id allowlist.**

### Where the cap is stated

- `skills/work/SKILL.md`'s "Index updates" section states the cap for the ADR-line prose the
  conductor hand-composes on every `adr-local`/`adr-global` insert, and cross-references
  `modeling` for task lines (the conductor never composes task-line prose itself — see below).
- `skills/modeling/SKILL.md`'s "Updating indexes" section states the cap for a task's `title:`
  frontmatter — the only prose a task INDEX line ever carries. `lib/task-lifecycle.mjs`'s
  `insertIndexLineAtTop` embeds the title into the INDEX line **verbatim and unchanged**, so
  the cap on the line is, mechanically, a cap on the title CAPTURE/REFINE authors.

### How grandfathering works: a date boundary, not an id allowlist

`lib/index-entry-length.mjs` exports `ADOPTION_DATE` (`2026-07-21`, the day this task shipped)
and `MAX_WORDS` (`60`). Its live-tree scanner, `findOverLengthIndexEntries`, walks every per-BC
`INDEX.md` plus the top-level `index.md`, extracts each task/ADR bullet's descriptive prose,
and for any entry over `MAX_WORDS` looks up the **date of the artifact the entry points at** —
a task's `completed` frontmatter (falling back to `created` for a not-yet-done task), or an
ADR's `date` frontmatter. An entry dated **on or before** `ADOPTION_DATE` is grandfathered
(never flagged, mirroring ADR-0039's "left verbatim" stance); only an entry dated **strictly
after** `ADOPTION_DATE` is held to the cap.

This scales the ADR-0044 grandfathering *idea* (an already-shipped violation is never
retroactively flagged or rewritten) to a surface where a per-id allowlist would be
impractical — the date already sitting in every artifact's frontmatter does the same job an
explicit list would, without anyone having to enumerate today's ~150 done tasks and ~50 ADRs
by hand.

The lint is loss-tolerant by construction (mirroring `lib/id-grammar.mjs` /
`lib/index-rotation.mjs`): an unparseable bullet, an unreadable linked file, or a missing date
is never flagged — "can't tell" degrades to "don't flag it," never to a false positive that
would abort or mis-fail a scan.

### The same-day blind spot (an accepted, recorded gap)

Because the boundary compares dates (not timestamps or a marker in the file), an entry written
**on** `ADOPTION_DATE` itself is indistinguishable from a pre-adoption entry and is also
grandfathered — including this very task's own INDEX insertions (its done-list line, and
`ADR-0060`'s own `adr-local` entry), both dated `2026-07-21`. Enforcement is therefore
effectively "starting the day after adoption," not "starting the instant this task merges."
This is a deliberate, accepted tradeoff (see Alternatives) rather than an oversight, and is
recorded here so it is never mistaken for a bug in the lint.

## Consequences

### Positive
- Closes the third and last piece of Dorc's A6 finding — new INDEX bullets stay a catalog
  entry, not a narrative, keeping the per-session context tax bounded going forward.
- Satisfies ADR-0059's mechanize-or-drop rule with a real lint, not the "prose-only,
  unenforced" escape hatch — a second, differently-shaped exemplar (date-boundary
  grandfathering rather than ADR-0044's id-allowlist grandfathering) for future
  convention-establishing tasks to draw on.
- The lint is green on the current tree despite the many pre-existing 100-500 word entries
  the Dorc review flagged — grandfathering makes adoption non-disruptive rather than requiring
  either a mass rewrite (forbidden by the verbatim discipline) or a blanket exemption that
  would defeat the point.

### Negative
- The same-day blind spot means the doctrine's very first day of real activity produces zero
  enforced entries — a residual, accepted gap, not a defect being hidden.
- A date-based boundary is a proxy for "when was this entry written," not a direct measurement
  (an entry can, in principle, be added to the INDEX well after its task's `completed` date,
  e.g. during a later INDEX repair) — the same category of imprecision `lib/index-rotation.mjs`
  already accepts for its own month-bucketing (`deriveEntryMonth`'s fallback chain).
- Two different places state the cap (`work` for ADR-line prose, `modeling` for task titles)
  because two different skills compose that prose — a reader must know which half of the
  doctrine governs which line shape, mirroring the split ADR-0038's three-layer boundary
  already normalizes elsewhere in this project.

### Neutral
- Does not retroactively require any pre-adoption entry to shrink or move — it governs entries
  written from `ADOPTION_DATE` forward only, per the no-retroactive-rewrite decision.
- Does not touch `lib/index-rotation.mjs`'s entry-*count* cap (ADR-0039/agentic-workflow-c8j3w)
  — that discipline bounds how many entries the live list holds; this ADR bounds how long each
  individual entry is. The two are complementary, not overlapping.

## Alternatives considered

- **An explicit `GRANDFATHERED_IDS`-style allowlist, ADR-0044's exact shape.** Rejected: viable
  for a single known stray id, impractical here — dozens of pre-existing entries across every
  BC would need enumerating by hand, and the list would need a manual addition every time a
  future entry happened to exceed the cap for a legitimate, judged reason, which is exactly
  the maintenance burden a date boundary avoids by construction.
- **Retroactively rewrite every over-length entry to fit the cap.** Rejected outright: violates
  the verbatim discipline ADR-0039 established for the sibling cap-and-roll surface (the
  done-list) — an INDEX entry, once written, is not silently rewritten by a later, unrelated
  task. A CONSOLIDATE-style, builder-approved cleanup remains available as a separate,
  deliberate action if ever warranted.
- **Insert a literal adoption marker into each `INDEX.md`, entries above it are "new."** Would
  have been more precise than a date proxy (no same-day blind spot), but requires this task to
  edit every BC's `INDEX.md` and the top-level `index.md` — forbidden by this task's own
  file-scope rule (INDEX.md is the conductor's file, never a worker's) and inconsistent with
  "the lint reads INDEX files; it never edits them."
- **Enforce only at verification (`agents/verifier.md`), skip a standalone lint module.** Passed
  over: a live-tree `node --test` check, run the same way `lib/id-grammar.mjs`'s and
  `lib/index-rotation.mjs`'s checks already are, is cheaper to hold in context and cheaper to
  run than adding a new judgment-call gate to the verifier's prompt for a predicate that is, in
  this case, fully mechanical (word count + date comparison) — unlike ADR-0059's own
  "does this establish a convention" question, which genuinely resists mechanization.

## References
- ADR-0059 — mechanize-or-drop; the doctrine this task satisfies with a lint, not the
  "prose-only, unenforced" marker.
- ADR-0044 — the `GRANDFATHERED_IDS` shape this ADR's date-boundary grandfathering generalizes
  from a single-id allowlist to a scalable proxy.
- ADR-0039 — protocol rotation's verbatim cap-and-roll discipline; the "never retroactively
  rewrite" stance this ADR mirrors for individual entries rather than whole archived months.
- ADR-0041 — the artifact-growth two-disciplines framing (cap-and-roll vs flag-and-consolidate)
  this ADR's cap sits alongside as a third, entry-level growth control.
- ADR-0047 — INDEX done-list rotation trigger; the sibling entry-*count* cap this ADR's
  entry-*length* cap complements without overlapping.
- `lib/index-entry-length.mjs` / `lib/test/index-entry-length.test.mjs` — this task's
  implementation.
- `skills/work/SKILL.md` "Index updates", `skills/modeling/SKILL.md` "Updating indexes" — this
  task's doctrine-statement implementation.
