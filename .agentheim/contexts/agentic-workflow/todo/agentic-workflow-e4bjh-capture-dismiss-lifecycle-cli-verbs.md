---
id: agentic-workflow-e4bjh
title: Finish the bookkeeping mechanization — capture and dismiss verbs on the lifecycle CLI
status: todo
type: refactor
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: [agentic-workflow-pt0gy]
tags: [captured, audit-2026-07-22-followup, mechanization, lifecycle-cli]
related_adrs: [0038, 0022, 0054, 0042, 0059]
related_research: []
prior_art: [agentic-workflow-k5n8f, agentic-workflow-t7m4c, agentic-workflow-wq7fn, agentic-workflow-p3v9k]
---

## Why

ADR-0038's mechanization stopped at promote/claim/complete/checkpoint. The capture and
dismiss paths — `modeling` CAPTURE/DISMISS, `quick-capture`, `brainstorm`'s foundation-task
minting — still hand-edit `INDEX.md` marker lists, counts, and `protocol.md`, even though
ADR-0038 declares that bookkeeping prose superseded. This is the last remaining
LLM-text-surgery-on-derived-state surface, flagged by the 2026-07-22 coverage audit as the
substantive tail of the survey's highest-leverage change.

It is also the single seam `agentic-workflow-pt0gy` (concurrent modeling sessions colliding
on protocol/INDEX/git index) needs: hand-edited markers cannot be made atomic or
conflict-free; a verb can.

## What

Add `capture` and `dismiss` to `lib/task-lifecycle-cli.mjs` (handlers in
`lib/task-lifecycle.mjs`), same three-layer boundary as the existing verbs (ADR-0038:
mover / git-free CLI / skill judgment+git), same compute-then-write atomicity (ADR-0054),
same enumerated manifest `{ok, changed, message, verb, id}` or structured
`{ok:false, code, reason}` rejection. Then wire `modeling`, `quick-capture`, and
`brainstorm` through them, deleting (not duplicating) the replaced hand-edit prose.

Four design decisions, settled with the builder on 2026-09-05 and pressure-tested by an
architect + tactical-modeler round (amendments folded in, see Notes):

1. **`capture <id>` registers a file the skill already wrote.** The skill authors
   `contexts/<bc>/backlog|todo/<id>-<slug>.md` exactly as today (task-file authoring never
   enters lib — the rich bodies brainstorm and modeling write are judgment). The verb resolves
   the file to exactly one of `backlog/` or `todo/`, validates frontmatter (id well-formed per
   `classifyTaskId` — token, legacy, or grandfathered; `status` equals the folder found;
   `context` equals `deriveContext(id)`; required fields present), inserts the INDEX line into
   the matching list and increments the matching count, and prepends the protocol entry.
   Protocol-entry templates live in lib like the other verbs, keyed by a caller-supplied
   `source` (`modeling` → `Modeling / Captured`, `quick-capture` → `Capture / Captured`); the
   judgment inputs are `summary` and `source`. Commit message in the manifest:
   `chore(<bc>): capture <id> — <title> [<id>]`. A missing BC `INDEX.md` is backfilled from
   `references/index-template.md` **only** when the BC's lifecycle folders hold nothing but
   the file being captured; otherwise the verb refuses `index-missing` (seeding a template's
   zero counts over real pre-existing tasks would be a silent desync).
2. **`dismiss` is two-phase in lib.** `dismiss <id> '{"plan":true}'` computes the ADR-0022
   cascade set with zero disk change and returns it (or the doing/done refusal naming the
   offender) as a `CascadeSet {leadId, memberIds}` plus a display projection
   `{id, title, bc, status, path}` per member so the skill's confirmation table needs no
   extra reads. `dismiss <id> '{"confirm":[...ids]}'` re-runs the **full** guarded
   computation (traversal and in-flight/shipped guard), refuses `cascade-drifted` if
   membership changed and `cascade-in-flight` if a member's lifecycle folder changed with
   membership unchanged, then hard-deletes every member, edits every spanned BC's INDEX,
   strips the dismissed ids from surviving tasks' `depends_on`/`blocks`/`prior_art` and ADRs'
   `related_tasks`, and prepends ONE bare `Modeling / Dismissed` entry. The manifest's
   `changed` lists every deleted path (a scoped `git add` of a deleted tracked path stages
   the deletion — verified, no `git rm` special case) plus every edited file. Commit:
   `chore(<bc>): dismiss <lead-id>` (name the set when small).
3. **brainstorm composes per task** (ADR-0042 pattern: composition owned by the caller). It
   calls `capture <id>` once per foundation task with `{"protocolEntry": false}` — a
   structural skip, no protocol read or write — and keeps writing vision, READMEs, the
   top-level index, and its ONE hand-formatted session protocol entry (that entry stays
   prose-only, recorded as such per ADR-0059).
4. **Scope: one task, both verbs.** Same precedent as k5n8f (promote + spine) and t7m4c
   (claim + complete): both verbs touch the same lib/CLI/test files, so one worker avoids a
   self-inflicted merge conflict. `quick-capture`'s cross-BC re-route stays hand-edited and
   out of scope (follow-up capture).

Mechanizing ADR-0022's prose cascade surfaced two live on-disk contradictions that the
verb must not re-implement (the worker's ADR amends ADR-0022 accordingly):

- **`blocks` and `depends_on` are not mirrored.** `design-system-001` lists
  `blocks: [agentic-workflow-001]` but agentic-workflow-001's `depends_on` does not name it;
  `agentic-workflow-002` blocks 001 and 003 with the same asymmetry. ADR-0022's "equivalently,
  follow `blocks` edges forward" is factually false. The cascade follows **`depends_on`
  only**; `blocks` is reconciliation-only (stripped, never traversed); a `blocks`-only edge
  is reported as an advisory in the plan, never as a member.
- **Membership and stripping match on exact frontmatter `id`.** `agentic-workflow-mvt8x`
  carries `depends_on: [design-system-001-styleguide]` while that task's real id is
  `design-system-001`. A hard delete must never resolve an id by filename or prefix; a
  dangling or non-exact reference is reported as an advisory.

## Acceptance criteria

- [ ] `capture <id>` resolves a task file already written by the caller to exactly one of `backlog/` or `todo/`; rejects fail-closed with `{ok:false, code, reason}` when the file is in neither or both, and when frontmatter fails validation (id per `classifyTaskId` token/legacy/grandfathered, `status` equals the folder found, `context` equals `deriveContext(id)`, required fields present) — no file is created or edited on any rejection.
- [ ] `capture` inserts into the matching list (`backlog-list` / `todo-list`) and increments the matching count with a unified line format that always includes `(type)` — quick-capture's current `(type)`-less line is retired; backfills a missing BC `INDEX.md` from `references/index-template.md` (read via a sibling-relative path off the module's own `import.meta.url`, never `lib/resolve-plugin-file.mjs` and never an embedded copy) only when the BC's four lifecycle folders hold nothing but the captured file, and refuses `index-missing` otherwise.
- [ ] `capture` accepts `{"protocolEntry": false}` as a structural skip — no `protocol.md` read or write occurs — verified by a test asserting the file is byte-identical afterwards; with the flag absent the entry template is selected by `source` (`modeling` / `quick-capture`) and carries the caller's `summary`.
- [ ] `dismiss <id> '{"plan":true}'` performs zero disk writes and returns a `CascadeSet {leadId, memberIds}` (canonically sorted, `depends_on` edges only, exact frontmatter-`id` matching across all BCs) plus a `{id, title, bc, status, path}` projection per member; any `blocks`-only edge and any dangling or non-exact reference is reported as an advisory, never as a member; a member in `doing/` or `done/` yields the refusal naming it, still with zero writes.
- [ ] `dismiss <id> '{"confirm":[...ids]}'` recomputes the full guarded cascade (traversal and in-flight/shipped guard), refuses `cascade-drifted` when membership differs from the confirmed list and `cascade-in-flight` when a member's lifecycle folder changed with membership unchanged — both before any write.
- [ ] On confirmed dismiss, writes proceed INDEX edits → task-file unlinks → surviving backlink stripping → protocol entry; INDEX count deltas derive from lines actually removed (a strict `removeIndexLine` variant that reports its removal count), never from cascade-set cardinality; stripping touches only ids in this dismiss's confirmed set (a pre-existing unrelated dangling reference is left alone); the manifest's `changed` lists every deleted path plus every edited file across every spanned BC.
- [ ] Cascade membership and backlink stripping match on exact frontmatter `id` equality only, never `resolveTaskFile`-style filename resolution — covered by a regression fixture mirroring the live `design-system-001-styleguide` vs `design-system-001` mismatch.
- [ ] `node --test` covers both verbs' full manifest shapes; every rejection code (`index-missing`, `cascade-drifted`, `cascade-in-flight`, the capture validation codes); compute-then-write atomicity (a forced throw mid-compute leaves disk untouched); a cross-BC dismiss editing two INDEX files; and the `depends_on`-only amendment (a fixture with an unmirrored `blocks` edge asserting it is not cascaded but is stripped).
- [ ] `skills/modeling/SKILL.md` (CAPTURE steps 6-7, the DISMISS flow, "Updating indexes", "Protocol logging"), `skills/quick-capture/SKILL.md` (steps 5-7, "Updating the index", "Protocol logging"), and `skills/brainstorm/SKILL.md` ("Protocol logging", "Indexes") have their hand-edit bookkeeping prose deleted, not duplicated, replaced by "call the CLI, commit its manifest" in PROMOTE's already-rewritten shape; brainstorm's session entry is explicitly marked prose-only. [human-eye]
- [ ] The `agentic-workflow` README gains a `capture` / `dismiss` entry beside `promoteTask` / `claimBatch` / `completeTask`; the worker's ADR (number via `lib/adr-allocation.mjs`, ADR-0058) records the decisions and amends ADR-0022; both are backlinked (`related_adrs` here, `related_tasks` there). [human-eye]
- [ ] ADR-0059 mechanize-or-drop: the conventions this task establishes (authoring-vs-registration split, `depends_on`-only cascade edges, exact-id-only matching, template backfill only on an empty BC) ship with their enforcement in the `node --test` coverage above; the one prose-only convention (brainstorm's hand-formatted session entry) is recorded as such in the ADR.

## Notes

**Amendments from the 2026-09-05 orchestrator round** (architect + tactical-modeler, no
conflicts between them):
- Confirm re-runs the full guarded computation; the id-set diff is a courtesy on top, not
  the safety property. Two distinct codes: `cascade-drifted` (membership), `cascade-in-flight`
  (a member's folder changed).
- Write order INDEX → unlink → strip → protocol reverses ADR-0022 §4's listed order: a crash
  after unlink-before-reconcile leaves an unrecoverable "ready and invisible" desync, whereas
  this order leaves every residual failure "blocked and visible" (ADR-0055's own logic).
- Today's `removeIndexLine` silently no-ops on a missing line while the count still
  decrements — hence the strict variant and removal-count-derived deltas.
- `blocks` / `prior_art` / ADR `related_tasks` have no parse or write helpers in `lib/` today;
  the stripping is net-new code, not wiring.
- Reading `index-template.md` sibling-relative off `import.meta.url` works identically in the
  repo and in an installed plugin cache (the file ships beside `lib/`).
- The unguarded lost-update window on `INDEX.md` / `protocol.md` (no version precondition,
  unlike the task file's `expectedMtimeMs`) is inherited from promote/claim/complete and made
  wider by dismiss (longest compute, N-BC writes). Out of scope here — explicitly deferred to
  `agentic-workflow-pt0gy`, which depends on this task.

**ADR outline** (worker writes it during the task, ADR-0042 precedent; number via
`lib/adr-allocation.mjs`):
1. Title: capture/dismiss mechanization — registration not authoring, `depends_on`-only
   cascade, exact-id matching, residual-safe write order (amends ADR-0022).
2. Context: mechanizing ADR-0022's prose cascade surfaced two live contradictions
   (`blocks`/`depends_on` non-mirroring; id-vs-filename mismatch) and an unsafe write order.
3. Decision: cascade edge = `depends_on` only, `blocks` reconciliation-only; membership by
   exact frontmatter id; write order INDEX → unlink → strip → protocol; count deltas from the
   actual removed-line count; two-phase plan/confirm with `cascade-drifted` / `cascade-in-flight`.
4. Capture: registers a skill-authored file; backfill only on an otherwise-empty BC;
   `protocolEntry:false` is structural; templates keyed by `source`.
5. brainstorm composition per ADR-0042; its session entry is prose-only (ADR-0059).
6. Consequences: a `blocks`-only dependent is not cascaded (advisory instead) — accepted, the
   alternative deletes on the authority of an unmaintained field.
7. Alternatives: keep "equivalently, follow `blocks`" (rejected, factually false);
   filename-resolution matching (rejected, un-auditable for a hard delete); single-shot
   `--force` dismiss (rejected, preview and delete can disagree); structured-fields capture
   with lib rendering the template (rejected, moves the task-file format out of the skills).

**Test-fixture note:** `lib/test/task-lifecycle.test.mjs`'s `makeProject()` builds one
throwaway `.agentheim/contexts/<bc>/` tree with a single task file via `mkdtempSync`. The
cascade / backlink / cross-BC scenarios need a multi-file, multi-BC variant — extend
`makeProject` to accept an array of task specs (with `depends_on` / `blocks` edges and
pre-existing `INDEX.md` files) rather than adding a parallel helper.

**Follow-up captures, not blockers** (surfaced by the tactical-modeler; builder's call):
- A live-tree lint for `blocks`-only asymmetric edges (the field is documented as
  auto-populated but has demonstrably drifted).
- A `reindex` verb that re-projects a BC's INDEX from folder contents, motivated by the
  `index-missing` refusal — and a natural home for pt0gy's read-model regeneration shape.
- `quick-capture`'s cross-BC re-route as a `reroute` verb.

Original open questions (2026-07-22) and their answers: argument shape → register-from-disk;
cascade location → lib, two-phase; brainstorm composition → per-task with protocol
suppressed, session entry stays; protocol templates → in lib, keyed by `source`.
