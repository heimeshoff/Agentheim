---
id: ADR-0068
title: Drift-twice rule — a restatement that drifts a second time is deleted and pointered, never re-synced
scope: agentic-workflow
status: accepted
date: 2026-07-22
related_tasks: [agentic-workflow-zbbsw]
related_adrs: [0059]
---

# ADR-0068: Drift-twice rule — a restatement that drifts a second time is deleted and pointered, never re-synced

## Context

The doctrine-audit meta-loop (Dorc review → follow-up batch → residual batches) is
structurally refueled: every rule restated in 2-4 files generates genuine drift findings for
the next audit round, and each round re-synchronizes prose that will drift again. Concrete
evidence:

- `references/commit-doctrine.md`'s known-shapes text — created to support the churn
  advisory — needed sync fixes in two of the three residual batches within one week
  (`agentic-workflow-d7ksw`, `agentic-workflow-c5nvb`).
- `skills/verification-before-completion/SKILL.md` (the "verification doctrine" restatement
  of `agents/verifier.md`) needed a six-drift sync (`agentic-workflow-s9wtc`) and still
  carried a stale PASS-flow sentence two days later (`agentic-workflow-cvptc`).
- `agentic-workflow-s7d3k` already single-sourced three duplicated doctrine blocks (ID
  grammar, commit doctrine, worker return format) into `references/` files precisely because
  restating them in N places let one drift silently (the `agentic-workflow-f7k2d`
  `TESTS_*` incident) before anyone noticed.

The missing bound on the meta-loop isn't a cap on audits — it's making each audit round
permanently shrink the drift surface. Re-synchronizing a restatement every time it drifts
treats the symptom, not the cause: the restatement itself is the recurring cost. This
finishes the 2026-07-02 audit's recommendation #8, which the remediation wave only
half-executed (it single-sourced the blocks known-duplicated at the time, but left the
general convergence rule unstated, so new restatements keep appearing and drifting the same
way).

## Decision

**When a restatement of doctrine is found drifted for the second time, the fix deletes the
restatement and leaves a pointer to the canonical source — it never re-synchronizes the
copy a second time.**

- **First-time drift** may still be fixed in place by re-syncing the copy. The copy might be
  earning its keep (local context, adjacency to a specific flow) and one drift is not yet
  proof it isn't.
- **Second-time drift on the same restatement is proof the copy costs more than it
  serves.** The fix is not a third careful sync — it is deleting the restatement entirely
  and replacing it with a one-line pointer to the canonical source (the `references/*.md`
  pattern `agentic-workflow-s7d3k` already established, or the ADR itself where no
  `references/` file exists yet).

### Where this applies

- **Modeling's REFINE flow**, when interrogating a task that fixes a doctrine restatement
  drift (`skills/modeling/SKILL.md`) — this is where a drift-fix task gets shaped, and
  where the choice between "sync in place" and "delete and pointer" must be made before the
  task's acceptance criteria are written.
- **Workers executing a drift-fix task** — a worker who discovers, mid-task, that the
  restatement they were asked to sync has already drifted before (checkable via the BC's
  `done/` history or the restatement's own task-file `prior_art`) should prefer deleting and
  pointering over a third sync, even if the task description asked only for a sync.

**Wave-scale application:** `agentic-workflow-bx01e` ("Strip duplicated rationale narration
from the big prompts") is the concrete wave-scale instance of this rule — rather than
re-syncing the Dorc pixel-metric anecdote and other duplicated rationale across six files
one more time, it deletes the narration and replaces it with `(ADR-NNNN)` pointers.

### Enforcement disposition

**Prose-only, unenforced** (ADR-0059). "Found drifted a second time" is a judgment over
task history — it requires recognizing that the *same* restatement, not merely a
superficially similar one, was the subject of an earlier drift-fix task, and deciding
whether the current fix is really a second occurrence. That is not a lintable predicate: no
grep or `node --test` check can reliably identify "this prose block is a restatement of that
other prose block, and this is its second fix" without the same semantic judgment a human or
LLM reader brings. Per ADR-0059's mechanize-or-drop doctrine, this choice — mechanize or
record prose-only — has been made and recorded here rather than defaulted into silently: the
visible-decision record is this ADR plus the one-line pointer from modeling's REFINE flow.

## Consequences

### Positive
- Bounds the doctrine-audit meta-loop: instead of every audit round re-syncing the same
  drifted copies indefinitely, the second occurrence permanently removes a restatement from
  the drift surface. The surface can only shrink over time, never stay flat.
- Gives REFINE and workers a concrete, citable rule for a decision they were already making
  ad hoc (sync vs. delete-and-pointer) — reduces re-litigation of the same judgment call
  each time a drift-fix task is shaped.
- Consistent with the `references/modes.md` / `agentic-workflow-s7d3k` pattern already
  proven in this codebase: the destination for a deleted restatement is never novel, it's
  the same single-source shape already in use.

### Negative
- Judgment-only enforcement means a REFINE session or worker can miss that a restatement is
  on its second drift and sync it a third time anyway — the same residual risk ADR-0059's
  other judgment gates (readiness check, verifier check 6c) already carry.
- Requires whoever shapes the drift-fix task to actually check prior drift history (the
  BC's `done/` folder, the restatement's own prior_art chain) rather than treating each
  drift report as a fresh, isolated bug — an added step, though a cheap one given `done/`
  tasks are already searchable.

### Neutral
- Does not retroactively require every past drift-fixed restatement to be audited for a
  second occurrence — it governs drift-fix tasks shaped from this point forward.
- Does not change what counts as "canonical source" — the existing `references/*.md` /
  ADR-of-record convention (`agentic-workflow-s7d3k`) already defines where a pointer goes;
  this ADR only decides *when* a restatement must move there instead of being re-synced.

## Alternatives considered

- **Always sync in place, never delete.** Rejected: this is the status quo that produced
  the evidence in Context — commit-doctrine's known-shapes text and the verification
  doctrine restatement both kept drifting because the underlying incentive (a nearby copy is
  convenient to read without a hop) was never weighed against the recurring sync cost. Doing
  nothing does not bound the meta-loop.
- **Delete on first drift, no first-time grace period.** Rejected: a first drift doesn't yet
  prove the restatement isn't earning its keep — some restatements are one-off typos or
  genuinely worth a local copy for a flow that reads it constantly. Deleting on the first
  occurrence would be more aggressive than the evidence justifies and risks stripping
  legitimately useful local context prematurely.
- **Mechanize a "restatement fingerprint" lint that flags near-duplicate prose blocks across
  files automatically.** Rejected for this task's scope: identifying that two prose blocks
  are "the same restatement" (versus two independently-written but topically similar
  passages) is exactly the semantic judgment ADR-0059 already carves out as resisting cheap
  mechanization; building a fuzzy-text-similarity lint would be exactly the kind of brittle,
  gamed check ADR-0059 warns against forcing where none is warranted.

## References
- ADR-0059 — mechanize-or-drop doctrine; this ADR's enforcement disposition
  ("prose-only, unenforced") is made under that doctrine's explicit escape hatch.
- `agentic-workflow-s7d3k` — single-sourced the first three duplicated doctrine blocks into
  `references/*.md`; establishes the "delete restatement, leave a pointer" destination
  pattern this ADR's rule reuses.
- `agentic-workflow-s9wtc` — the six-drift verification-doctrine sync that is this ADR's
  concrete second-drift evidence (a `agentic-workflow-cvptc` third drift followed two days
  later).
- `agentic-workflow-bx01e` — the wave-scale application of this rule (todo/, depends on
  several drift-fix tasks landing first).
- `skills/modeling/SKILL.md` REFINE flow, step 3 — carries the one-line pointer to this ADR
  where drift-fix tasks get shaped.
