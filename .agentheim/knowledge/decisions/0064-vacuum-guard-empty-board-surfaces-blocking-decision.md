---
id: ADR-0064
title: Vacuum guard — an empty board surfaces the open vision decision instead of minting filler; session-end batch-mix line
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-qz1h7, agentic-workflow-v4gmt, agentic-workflow-r4gcz, agentic-workflow-f3wqm]
related_adrs: [0040, 0027, 0059, 0038, 0017, 0069]
---

# ADR-0064: Vacuum guard — an empty board surfaces the open vision decision instead of minting filler; session-end batch-mix line

## Context

Dorc's July-2026 agent-time review (recommendation A2) found a concrete failure: with
`todo/` empty across all six BCs and `vision.md`'s own "Brainstorm on existing code"
open question still unmade, agent capacity flowed to what was self-discoverable — the
harness's own test failures and cleanup — producing a week that was roughly two-thirds
meta-work. Nothing in `work` or `modeling` distinguished "genuinely nothing to do" from
"the highest-leverage next step is a decision only the builder can make" — both looked
like an empty board, and an empty board quietly invited the session to go find *something*
to do rather than name the actual blocker.

Two gaps compound this:

1. **No refusal-to-self-generate.** When the ready set is empty, nothing stops a session
   from reaching for self-generated filler (a manufactured chore, unrelated harness
   churn) instead of surfacing that a real decision is waiting.
2. **No per-session drift visibility.** Even when a session *does* do useful work, nothing
   measures the mix of what kind of work it was — the two-thirds-meta-work pattern was
   only visible in hindsight, a week later, not while it was happening.

`agentic-workflow-v6d4n`/ADR-0040 (vision-conformance check) is the closest existing
pattern for both: a session-end advisory that reads two bounded vision.md sections and a
git-free `lib/` helper for the deterministic parts, LLM judgment for the rest. This task
is the sibling: same shape, two new advisory surfaces.

## Decision

**Two coupled, advisory-only mechanisms, both in the ADR-0027/ADR-0040 family — never a
hard gate:**

### 1. Vacuum guard

When `work`'s Phase 2 finds **zero ready tasks across every BC** (Phase 2 new step 8), or
`modeling`'s Opening flow finds an **empty backlog** (step 2), both read `vision.md`'s
"## Open questions" section through `lib/vacuum-guard.mjs`'s `extractOpenQuestions` —
which excludes items already marked resolved (the existing `~~struck-through~~ *Resolved
YYYY-MM-DD.*` convention) and reads each remaining item's age via a new
`(open since YYYY-MM-DD)` annotation convention (see "What's deterministic vs. judged"
below).

**The session does not self-generate substitute work, unconditionally, the moment the ready
set/backlog is found empty** — no manufactured chore task, no wandering into unrelated
harness/test-suite maintenance on its own initiative — regardless of whether
`extractOpenQuestions` then turns up anything to point at instead.

### Amendment (agentic-workflow-f3wqm/ADR-0069): refusal-placement fix

As originally shipped, the paragraph above was written (and both call sites implemented it)
as a bullet nested *inside* "if one or more genuinely open items exist" — so the refusal only
textually applied when there was an open vision question to surface instead. An empty ready
set with a fully-resolved "Open questions" section carried no refusal at all: exactly the
case where a session finding nothing to point at is most tempted to invent its own filler,
the original Dorc failure this ADR exists to close. The 2026-07-22 audit-closure task
(`agentic-workflow-f3wqm`, ADR-0069) found this and moved the refusal to sit unconditionally
on "the ready set/backlog is empty," ahead of the `extractOpenQuestions` read, at both call
sites (`skills/work/SKILL.md` step 8, `skills/modeling/SKILL.md` Opening step 2 — the latter
was found to have carried no explicit refusal sentence at all, only an implicit one via its
"still falls through to inviting CAPTURE" framing; ADR-0069 made it explicit too). The
open-items-only actions below (surfacing the item, the vacuum-guard session-end entry, the
hard-gate exemption) are unchanged — only the refusal's placement moved.

If one or more genuinely open items exist:

- It **surfaces the open item(s) with their age** (`formatVacuumGuardLine`, e.g.
  "Brainstorm on existing code (next iteration). (open 46 days)"), framed as the single
  highest-leverage thing the builder can do right now.
- `work` stops there for the run rather than proceeding through the full dispatch
  machinery; `modeling` surfaces the item(s) and then still falls through to inviting new
  CAPTURE — an empty backlog with an open vision decision doesn't forbid new capture, it
  just makes sure the open decision isn't buried under it.

**Never a hard gate.** If the builder explicitly asks for something else anyway ("do it
anyway", "add a chore for the flaky test"), the session does exactly that. The guard only
suppresses work a session would invent *unprompted*; it never refuses an explicit builder
request — vision.md's "Not autonomous" non-goal (#3: the human stays in the loop at every
gate) is untouched by this ADR, not renegotiated by it.

### 2. Session-end batch-mix line

`work`'s end-of-run reporting gains one new step (new step 6, between the
vision-conformance pass and the carry-over reconciliation): every task the session
completed is classified **product-facing** / **harness** / **bookkeeping** by
`lib/vacuum-guard.mjs`'s `classifyTask`, and the tally is rendered by `formatBatchMixLine`
into a new `**Batch mix:**` line on the session-end protocol entry (e.g. `62%
product-facing / 25% harness / 13% bookkeeping (8 tasks)`). Purely descriptive — it
influences nothing about dispatch, verification, or commit — it exists only so drift
toward meta-work is visible per session, not discovered a week later from reading back
through the protocol log by hand.

**The classification heuristic** (documented in `classifyTask`'s doc comment, mirrored in
`skills/work/SKILL.md`'s new step 6):

1. `type: chore` whose touched files are **entirely** protocol/INDEX/state bookkeeping
   surfaces (`.agentheim/knowledge/protocol.md`, a BC's `INDEX.md`,
   `.agentheim/state/...`) → **bookkeeping**. A chore that *also* touches anything else
   (a cleanup chore editing real skill/lib/agent files) → **harness**, not bookkeeping —
   it changed the machinery, it didn't just log about it.
2. `type: feature` or `type: decision` → **product-facing**. For Agentheim's own
   self-hosting repo the "product" *is* the framework's builder-facing capability, so a
   shipped feature or a judgment call that changes that capability counts as
   product-facing even when its files live under `skills/`/`lib/` — this bucket is keyed
   on `type` alone, deliberately, unlike buckets 1 and 3's file-based checks.
3. `type: bug` or `type: refactor` whose touched files are **entirely** product surfaces
   (none under `lib/`, `skills/`, `agents/`, `references/`, `evals/`, or
   `.agentheim/knowledge/decisions/`) → **product-facing**. Any touch on a harness/
   doctrine surface (even mixed with product files), or no files at all, → **harness**
   — internal machinery maintenance that is neither new builder-facing capability nor
   pure bookkeeping. (Amended by the consumer-tuning note below — originally this
   bucket classified every `bug`/`refactor` task as harness unconditionally, by type
   alone, same as bucket 2.)
4. Any other type (`spike`, or an unrecognized type) → **harness**, unconditionally.

The inputs (`{type, files}` per completed task) are already in the conductor's hands by
session end: `type` from the task file frontmatter, `files` from the worker's SUCCESS
`FILE_LIST` (already used for the checkpoint stage) — no new reads.

### Amendment (agentic-workflow-r4gcz): bug/refactor bucketing made path-aware

The 2026-07-22 post-survey audit (overshoot class) found bucket 3 as originally shipped
(`qz1h7`) bucketed every `type: bug`/`type: refactor` task as **harness** unconditionally,
mirroring bucket 2's type-alone keying. That keying is deliberate for bucket 2 (feature/
decision) because for Agentheim's own self-hosting repo the "product" *is* the framework's
builder-facing capability — but a `bug`/`refactor` task in a **consumer** project (e.g. the
Dorc game) that fixes or refactors the consumer's own product code never touches the
framework's machinery at all, and the unconditional type-alone rule read that entire
session as majority-harness drift — the meta-work detector this line exists to power
emitting a false positive against the exact kind of legitimate work it should stay silent
on.

The fix: bucket 3 is now **path-aware**, reusing the same harness/doctrine segment-match
shape `agentic-workflow-qz1h7` had already written (and `agentic-workflow-v4gmt` found
unused and removed as dead code at the time — this amendment gives those segments their
intended job). A `bug`/`refactor` task classifies **product-facing** only when every
touched file lands outside `lib/`, `skills/`, `agents/`, `references/`, `evals/`, and
`.agentheim/knowledge/decisions/`; any touch on one of those surfaces (or no files at all)
still classifies **harness** — the same conservative "entirely-or-else" bias bucket 1 uses
for bookkeeping, so a mixed bug/refactor (touching both product and harness files) resolves
toward the bucket this line exists to surface, not away from it. Buckets 1 (chore) and 2
(feature/decision) are unchanged; bucket 4 (spike/other) stays unconditionally harness —
only `bug`/`refactor` was producing the false-positive signal.

Chosen over the simpler alternative of scoping the whole type-based rule to self-hosting
installs (detecting "is this the Agentheim repo itself" and branching the heuristic on
that): a path-aware bucket 3 requires no install-detection machinery, generalizes to any
consumer project shape without a special case, and degrades identically for Agentheim's own
self-hosting repo (its own `bug`/`refactor` tasks routinely do touch `lib/`/`skills/`/
`agents/`/`references/`, so they continue to classify harness exactly as before this
amendment).

## What's deterministic vs. judged

`lib/vacuum-guard.mjs` (unit-tested, `lib/test/vacuum-guard.test.mjs`, `node --test`,
git-free per ADR-0038 — callers hand in already-known task metadata rather than the
module shelling out to git) covers everything mechanical:

- `extractOpenQuestions` — pulling vision.md's "## Open questions" items, excluding
  resolved ones, parsing the `since` annotation. Reuses `vision-conformance.mjs`'s
  `extractSection`/`labelFor` rather than duplicating markdown-list extraction.
- `ageInDays` — whole days between a since-date and now, UTC-midnight granularity, `null`
  for missing/malformed input rather than throwing.
- `isVacuum` — the named trigger predicate (ready-count zero AND open items exist), one
  place to change the threshold later, mirroring `worthSurfacing` in
  `vision-conformance.mjs`.
- `formatVacuumGuardLine` — the exact surfaced-text shape.
- `classifyTask` / `classifyBatch` / `formatBatchMixLine` — the batch-mix heuristic and
  the protocol line's exact text shape.

**Judgment that stays in skill prose, not the lib:** whether to actually *invoke* the
guard (is the ready set really, truly empty — the calling skill still owns that read),
and how to word the surfaced recommendation to the builder in context. Unlike the
vision-conformance pass, there is no LLM judgment call analogous to "does this task
diverge from a vision line" here — open-question extraction and batch classification are
both fully mechanical once the inputs are in hand, which is why this ADR's `lib/` surface
is larger than ADR-0040's judgment-heavy pass.

## The `(open since YYYY-MM-DD)` annotation convention

`extractOpenQuestions` needs each open item's start date to compute age, and vision.md's
existing "Open questions" section carried no such field — only *resolved* items carried a
date (`*Resolved YYYY-MM-DD.*`). Rather than have the lib shell out to `git log -S` to
infer an item's origin (which would violate ADR-0038's git-free `lib/` boundary and be
fragile across squash/rebase history), this task establishes a lightweight prose
convention: an open item's first line carries `(open since YYYY-MM-DD)` immediately after
its bold heading, e.g.:

```
- **Brainstorm on existing code (next iteration).** (open since 2026-06-05) When
  `brainstorm` is invoked in a folder that already contains code, ...
```

The date must be on the item's *first* markdown line — `extractSection`'s list-item
extraction only captures a bullet's first physical line, not its wrapped continuation, so
an annotation placed later would be silently invisible to the extractor (this is existing
`vision-conformance.mjs` behavior, not new to this ADR). `vision.md`'s one existing open
item ("Brainstorm on existing code") is backfilled with `(open since 2026-06-05)` — the
date confirmed via `git log -S"Brainstorm on existing code" --follow -- .agentheim/
vision.md`, which shows the line present since the vision file's initial commit
(`e116a87`, 2026-06-05). That git read is a one-time editorial backfill done by this task,
not something the shipped mechanism repeats — from here forward, a newly-captured open
question simply carries its `since` date at the moment `modeling` or `brainstorm` adds it
to vision.md (prose convention, not mechanized — see "Mechanize-or-drop" below).

## Mechanize-or-drop (ADR-0059)

This task establishes two conventions and must state, for each, whether it ships
enforcement or is prose-only:

1. **The open-question extraction + age computation.** Mechanized — `extractOpenQuestions`
   and `ageInDays` are the enforcement: any vision.md open item lacking a `since` date
   simply renders as "open — since date not recorded" rather than a computed age, so a
   missing annotation degrades gracefully instead of erroring, but the *parsing* of the
   convention (once present) is fully machine-checked and unit-tested.
2. **The batch-mix classification heuristic.** Mechanized — `classifyTask` /
   `classifyBatch` / `formatBatchMixLine` are the enforcement; the heuristic itself is a
   deterministic function of `{type, files}`, not a judgment call, so it belongs in the
   git-free `lib/` layer exactly as ADR-0038 draws that boundary. The `agentic-workflow-
   r4gcz` consumer-tuning amendment above ships its own `node --test` coverage in the same
   module and file — no separate mechanize-or-drop call needed for the amendment itself.
3. **"A newly-captured open question carries a `since` date at capture time."** This one
   half is **prose-only, unenforced** — there is no cheap mechanical check that a human
   (or `brainstorm`/`modeling`) remembered to write the annotation when adding a new open
   question to vision.md; the closest a lint could get is "does every non-resolved item
   under this heading contain the literal substring `(open since `", which would be a
   brittle, gameable check for a convention this narrow (one section, edited rarely, by a
   builder-facing skill already reading this ADR's doctrine). Mechanizing this fully would
   mean gating `brainstorm`/`modeling`'s vision.md writes behind a structural check on that
   one section — judged not worth the coupling for a convention that degrades gracefully
   (an un-annotated item just shows "since date not recorded" instead of failing) rather
   than silently corrupting anything.

## Consequences

- An empty board now distinguishes "nothing to do" from "a decision is waiting" — the
  exact ambiguity the Dorc review found the harness quietly collapsing into
  self-generated busywork.
- Per-session batch-mix visibility catches meta-work drift while it's happening, not a
  week later from reading back through the protocol log.
- Neither mechanism blocks anything — an explicit builder request always overrides the
  guard, and the batch-mix line never influences dispatch, verification, or commit.
  vision.md's "Not autonomous" non-goal holds exactly as it does for every other advisory
  in the ADR-0027 family.
- `lib/vacuum-guard.mjs` reuses `vision-conformance.mjs`'s `extractSection`/`labelFor`
  rather than duplicating markdown-list extraction, keeping the two session-end advisory
  passes visibly related rather than accidentally divergent implementations of the same
  idea.
- The batch-mix percentages are rounded independently and are not forced to sum to
  exactly 100 — a legible-at-a-glance advisory, not an audited statistic; tightening this
  is a future ADR's call if it ever matters.

## Alternatives considered

- **Compute open-question age via `git log -S` inside the `lib/` helper.** Rejected: would
  violate ADR-0038's git-free `lib/` boundary and be fragile across history rewrites
  (squash-merge, rebase) that don't preserve a clean "first introduced" signal for every
  future open item the way it happened to for this task's one backfilled example. The
  `(open since YYYY-MM-DD)` prose annotation is cheaper, git-free, and degrades gracefully
  when absent.
- **Classify batch-mix by bounded context (BC) instead of task type + files.** Rejected:
  for Agentheim's own self-hosting repo, every current BC (`agentic-workflow`,
  `infrastructure`, `design-system`) is itself framework machinery — a BC-keyed
  classification would read every task as "harness" regardless of whether it shipped new
  builder-facing capability or just cleaned up test flakiness, collapsing exactly the
  distinction this line exists to surface. Type + touched-file-surface is the heuristic
  that actually separates "new capability" from "internal upkeep" from "pure logging."
- **Hard-block `work`/`modeling` from proceeding at all when the guard fires.** Rejected
  outright: contradicts vision.md's "Not autonomous" non-goal — the framework never
  refuses an explicit builder request, only suppresses what it would have invented
  unprompted.

## References

- ADR-0040 — vision-conformance check; the closest existing pattern (session-end
  advisory, `lib/`+`node --test` for the deterministic half).
- ADR-0027 — advisory-write family; `whats-next` is the natural surface for the
  "blocking decision + age" line to feed forward into.
- ADR-0059 — mechanize-or-drop; the doctrine this ADR's "Mechanize-or-drop" section
  self-referentially satisfies.
- ADR-0038 — the git-free `lib/` boundary `vacuum-guard.mjs` holds to.
- `skills/work/SKILL.md` — Phase 2 step 8 (vacuum guard), end-of-run reporting step 6
  (batch-mix classification), the session-end protocol entry's `**Batch mix:**` line.
- `skills/modeling/SKILL.md` — Opening flow step 2 (vacuum guard on an empty backlog).
- `lib/vacuum-guard.mjs`, `lib/test/vacuum-guard.test.mjs` (this task's implementation).
- `agentic-workflow-v4gmt` — removed the harness/doctrine segment regexes as dead code
  before this amendment gave them a real caller.
- `agentic-workflow-r4gcz` — consumer-tuning amendment making bucket 3 (`bug`/`refactor`)
  path-aware; see "Amendment" above.
- `agentic-workflow-f3wqm` / ADR-0069 — audit-closure doctrine; the refusal-placement fix
  making the do-not-self-generate refusal unconditional on an empty ready set/backlog,
  amending this ADR (see "Amendment" above).
