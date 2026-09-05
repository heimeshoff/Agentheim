---
id: ADR-0073
title: Capture/dismiss mechanization — registration not authoring, depends_on-only cascade, exact-id matching, residual-safe write order (amends ADR-0022)
scope: agentic-workflow
status: accepted
date: 2026-09-06
related_tasks: [agentic-workflow-e4bjh]
related_adrs: [0038, 0022, 0054, 0042, 0059]
---

# ADR-0073: Capture/dismiss mechanization — registration not authoring, `depends_on`-only cascade, exact-id matching, residual-safe write order (amends ADR-0022)

## Context

ADR-0038's mechanization boundary stopped at PROMOTE/CLAIM/COMPLETE/checkpoint
(agentic-workflow-k5n8f, -t7m4c, -q7v3k). The capture path (`modeling`'s CAPTURE,
`quick-capture`, `brainstorm`'s foundation-task minting) and the DISMISS path
still hand-edited `INDEX.md` marker lists, count lines, and `protocol.md` even
though ADR-0038 already declared that class of bookkeeping prose superseded.
Mechanizing DISMISS's cascade (ADR-0022) required first resolving two live,
on-disk contradictions in that ADR's text:

- **`blocks` and `depends_on` are not mirrored.** `design-system-001` lists
  `blocks: [agentic-workflow-001]` but `agentic-workflow-001`'s `depends_on`
  does not name it back — a real, on-disk asymmetry. ADR-0022's "equivalently,
  follow `blocks` edges forward" is factually false as a description of the
  data.
- **Membership matched by filename, not exact id.** `agentic-workflow-mvt8x`
  carries `depends_on: [design-system-001-styleguide]`, but that task's real
  frontmatter id is `design-system-001`. A hard-delete cascade must never
  resolve a reference by filename-style prefix matching (the `resolveTaskFile`
  shape used for a folder *move*, where a near-miss is harmless) — for a
  *delete*, an un-audited near-match risks silently pulling in, or silently
  leaving orphaned, the wrong task.

Separately, ADR-0054 already established compute-then-write atomicity and a
`removeIndexLine` weakness (silently no-ops on a missing line while a caller's
assumed count-delta still fires) for the three existing verbs; the same class
of bug would recur in DISMISS if its count deltas were derived from cascade-set
cardinality rather than from lines actually removed.

## Decision

### Capture is registration, not authoring

`capture <id>` (`captureTask` in the new `lib/task-lifecycle-capture-dismiss.mjs`
module) registers a task file the **caller already wrote** to exactly one of
`backlog/` or `todo/` — it never authors task-file prose; that judgment stays
with `modeling`, `quick-capture`, and `brainstorm`. It validates the resolved
file's frontmatter (id well-formed per `classifyTaskId`'s token/legacy split,
or on `id-grammar.mjs`'s `GRANDFATHERED_IDS` allowlist; `status` equal to the
folder found; `context` equal to `deriveContext(id)`; `title`/`type`/`created`
present), inserts the INDEX line into the matching list with a **unified
line format that always includes `(type)`** (retiring quick-capture's
`(type)`-less line), and increments the matching count. Every rejection is
fail-closed with `{ok:false, code, reason}` and writes nothing.

**`protocolEntry:false` is a structural skip** — no `protocol.md` read or
write occurs at all — used by `brainstorm`'s per-task foundation-task capture,
which keeps its own single hand-formatted session entry. When a protocol entry
*is* written, its template is selected by the caller-supplied `source`
(`modeling` → `Modeling / Captured`; `quick-capture` → `Capture / Captured`),
carrying the caller's `summary` — both judgment inputs, matching ADR-0038
Ruling B's "the CLI makes no judgment call" constraint.

**A missing BC `INDEX.md` is backfilled from `references/index-template.md`
only when the BC's four lifecycle folders hold nothing but the file being
captured** — read sibling-relative off `task-lifecycle-capture-dismiss.mjs`'s
own `import.meta.url` (never `lib/resolve-plugin-file.mjs`, which resolves an
*executable entry point* across the repo/plugin-cache boundary, and never an
embedded copy, which would just be a second hand-typed template to drift).
Otherwise the verb refuses `index-missing`: seeding a template's zero counts
over real pre-existing tasks would be a silent desync, not a convenience.

### DISMISS's cascade follows `depends_on` only; membership is exact-id-only

Amending ADR-0022 directly: **the cascade edge is `depends_on` only.**
`blocks` is reconciliation-only — stripped from surviving tasks' frontmatter
like `prior_art` already was, but never traversed to pull a task into the
delete set. A `blocks`-only edge (a cascade member's `blocks` naming a task
whose own `depends_on` doesn't reciprocally list it) is surfaced as an
**advisory**, never as a member.

**Membership and backlink-stripping match on exact frontmatter `id` equality
only** — never `resolveTaskFile`-style filename or prefix resolution. A
task's `depends_on`/`blocks` entry that near-matches a cascade member's id
by filename-style prefix, without being an exact match, is surfaced as a
**dangling-reference advisory**, never treated as a member and never stripped
(only ids in the confirmed set are ever stripped from a survivor).

### Two-phase, with the full guard re-run on confirm

`dismiss <id> '{"plan":true}'` computes the cascade set with **zero disk
writes**: `CascadeSet {leadId, memberIds}` (canonically sorted) plus a
`{id, title, bc, status, path}` display projection per member, and the
advisory list above. A member already in `doing/`/`done/` refuses
(`in-flight-or-shipped`), still with zero writes.

`dismiss <id> '{"confirm":[...ids]}'` **recomputes the full guarded cascade
fresh** — traversal and the in-flight/shipped guard — rather than trusting the
planned set. Two distinct rejection codes, both before any write:
`cascade-drifted` when the freshly recomputed membership differs from
`confirm`, and `cascade-in-flight` when membership is unchanged but a member's
lifecycle folder changed since planning. The id-set diff is a courtesy check
layered on the recomputation, not a substitute for it — trusting the plan's
own membership without re-deriving it from current disk state would reopen
exactly the TOCTOU window `resolveSourceOrReject` was extracted to close
elsewhere in the mechanized-verb family (ADR-0054).

### Write order reverses ADR-0022 §4's listed order

On a confirmed dismiss: **INDEX edits → task-file unlinks → surviving-backlink
stripping → protocol entry.** ADR-0022 §4 listed hard-delete first, bookkeeping
after. This ADR reverses that ordering: a crash after unlink-before-reconcile
leaves an unrecoverable "ready and invisible" desync (a surviving task's stale
`depends_on` still names a file that no longer exists, and nothing in the
INDEX or protocol recorded that anything happened at all), whereas
INDEX-first leaves every residual failure "blocked and visible" — the same
principle ADR-0055 already applied to `applyTaskMove`'s own internal ordering.

INDEX count deltas are derived from a **strict `removeIndexLine` variant**
that reports how many lines it actually removed, never from cascade-set
cardinality — closing the same silent-no-op class of bug ADR-0054's Notes
flagged for the existing `removeIndexLine`. Backlink stripping (surviving
tasks' `depends_on`/`blocks`/`prior_art`, and any ADR's `related_tasks`)
touches only ids in *this* dismiss's confirmed set — a pre-existing, unrelated
dangling reference elsewhere is left untouched.

### brainstorm composes per task (ADR-0042 precedent)

`brainstorm` calls `capture <id>` once per foundation task (the walking
skeleton, the styleguide, each decision task) with `{"protocolEntry": false}`,
and keeps writing vision/README/top-level-index content and its **one**
hand-formatted session protocol entry directly, as it does today. Per
ADR-0042's "composition owned by the caller" pattern: the script stays
single-task-shaped, and the caller composes the batch.

### Scope: one task, both verbs

Same precedent as k5n8f (promote + spine) and t7m4c (claim + complete): both
verbs land in one new module (`lib/task-lifecycle-capture-dismiss.mjs`,
wired into the existing `lib/task-lifecycle-cli.mjs` dispatch table) so one
worker avoids a self-inflicted merge conflict. `quick-capture`'s cross-BC
re-route stays hand-edited and out of scope (a follow-up `reroute` verb is
backlogged, not built here).

## Why a separate module instead of extending `lib/task-lifecycle.mjs`

`captureTask`/`dismissTask` live in a new module rather than inside the
existing `task-lifecycle.mjs`, deliberately: this task ran concurrently with
a sibling task also editing `task-lifecycle.mjs` and its CLI. A handful of
small private helpers (`parseFrontmatterField`, `formatProtocolTimestamp`,
`readNormalizedFile`/`writeNormalizedFile`/`readProtocolOrDefault`,
block-scoped `adjustIndexCount`, and a `resolveTaskFile`-equivalent) are
duplicated rather than imported, because they are not exported from
`task-lifecycle.mjs` and exporting them would mean editing that shared
module's existing lines. The pure edit primitives it already exports
(`insertIndexLineAtTop`, `prependProtocolEntry`, `normalizeText`/
`denormalizeText`, `deriveContext`, `LIFECYCLE_FOLDERS`) are reused directly.
This trades a small amount of duplication for a self-contained, additive diff
that merges cleanly alongside a concurrent sibling's edits to the shared
file — the same "additive, localized hunks over reshuffling existing code"
principle ADR-0058's provisional-numbering scheme already applies to ADR
allocation under concurrent worktrees.

## ADR-0059 mechanize-or-drop dispositions

This task establishes several conventions; per ADR-0059 each must ship
enforcement or be explicitly marked prose-only:

- **Authoring-vs-registration split** (capture never writes task-file prose,
  only registers a caller-authored file) — **enforced**: `captureTask`'s
  frontmatter validation (id/status/context/required-fields) is exercised by
  `lib/test/task-lifecycle-capture-dismiss.test.mjs`'s rejection-code tests.
- **`depends_on`-only cascade edges** — **enforced**: a `blocks`-only fixture
  test asserts the edge is not cascaded but is stripped.
- **Exact-id-only matching** (never filename/prefix resolution for cascade
  membership or stripping) — **enforced**: a regression fixture mirroring the
  live `design-system-001-styleguide` vs `design-system-001` mismatch.
- **Template backfill only on an otherwise-empty BC** — **enforced**: both the
  positive (backfill) and negative (`index-missing` refusal) paths are tested.
- **Unified capture INDEX line always carrying `(type)`** — **enforced** by
  the same INDEX-line-format assertions in the capture tests; the skill-prose
  side of this (quick-capture's line-format section) is updated in the same
  task, not left to drift.
- **`brainstorm`'s hand-formatted session protocol entry stays prose-only** —
  **explicitly prose-only, unenforced**: composing N structurally-similar
  protocol entries into one hand-written narrative summary is exactly the
  judgment work ADR-0038's three-layer boundary reserves for the skill, not a
  mechanically checkable shape a lint could verify without also constraining
  the prose itself.

## Consequences

**Positive:** the capture and dismiss paths join promote/claim/complete under
one deterministic, tested bookkeeping mechanism — the last remaining
LLM-text-surgery-on-derived-state surface ADR-0038 targeted is closed. The two
live ADR-0022 contradictions (the `blocks`/`depends_on` asymmetry and the
id-vs-filename mismatch) are fixed at the mechanization boundary rather than
carried forward as latent bugs a hand-editing skill could still reproduce.
DISMISS's write-order reversal removes an unrecoverable desync class
(ready-and-invisible) in favor of a recoverable one (blocked-and-visible).

**Negative:** a handful of small helpers are duplicated between
`task-lifecycle.mjs` and the new module rather than shared, a deliberate
trade against merge risk under concurrent worktree development (see above) —
a future maintainer folding the two modules together should re-examine
whether that duplication is still justified once no concurrent edit is
in flight.

**Neutral:** `applyTaskMove`, `promoteTask`, `claimBatch`, and `completeTask`
are untouched by this ADR. This ADR only widens the same three-layer boundary
(ADR-0038) and the same compute-then-write atomicity (ADR-0054) to two more
verbs; it does not revisit either decision. The unguarded lost-update window
on `INDEX.md`/`protocol.md` under concurrent modeling sessions (no version
precondition, unlike the task file's `expectedMtimeMs`) is inherited unchanged
from promote/claim/complete, made wider here by dismiss's larger write set —
explicitly deferred to `agentic-workflow-pt0gy`, which depends on this task.

## Alternatives considered

- **Keep ADR-0022's "equivalently, follow `blocks`" as an additional cascade
  edge alongside `depends_on`.** Rejected: the live data shows the two fields
  are not mirrored, so treating `blocks` as authoritative would cascade-delete
  tasks the builder never intended to touch, on the strength of a field this
  same audit shows is already unmaintained.
- **Filename/prefix resolution for cascade membership (mirroring
  `resolveTaskFile`'s move-time leniency).** Rejected: appropriate for a
  *move*, where a near-miss is harmless and recoverable; wrong for a *hard
  delete*, where an un-audited near-match is exactly the kind of silent,
  unrecoverable mistake the vision's "catch wrong work by structure" ethos
  exists to prevent.
- **Extend `task-lifecycle.mjs` in place instead of a new module.** Rejected
  for this task specifically (not as a general precedent) — a concurrent
  sibling task was editing the same file; a new, additive module avoided a
  self-inflicted merge conflict at negligible duplication cost.
- **Structured-fields capture, with the library rendering the task-file
  template from caller-supplied fields.** Rejected: this would move task-file
  authoring (the rich `Why`/`What`/acceptance-criteria prose the skills write
  today) out of the skills and into a git-free, judgment-free library layer —
  exactly the boundary ADR-0038 draws the other way.

## References
- ADR-0038 — the three-layer mechanization boundary (mover / git-free CLI /
  skill judgment+git) this task extends to capture/dismiss.
- ADR-0022 — the original DISMISS cascade decision; amended here (cascade edge
  = `depends_on` only, exact-id matching, reversed write order).
- ADR-0054 — compute-then-write atomicity and the `removeIndexLine`
  silent-no-op weakness this task's strict variant closes for DISMISS.
- ADR-0042 — `completeTask` stays single-task-shaped, composition owned by the
  caller; the same pattern `brainstorm`'s per-task capture composition reuses.
- ADR-0059 — mechanize-or-drop; dispositions recorded above.
- `agentic-workflow-e4bjh` — this task.
