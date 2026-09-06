---
id: agentic-workflow-qd24q
title: Route the remaining hand-written protocol and INDEX edits through the locked lifecycle verbs — work, brainstorm, research, quick-capture — and add the two count-coupled verbs (bounce, reroute) pt0gy could not cover
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-pt0gy]
blocks: []
tags: [concurrency, bookkeeping, mechanization, lifecycle-cli, doctrine-sweep]
related_adrs: [0026, 0038, 0059, 0068, 0073, 0074]
related_research: []
prior_art: [agentic-workflow-e4bjh, agentic-workflow-ghcaj, agentic-workflow-k5n8f, agentic-workflow-t7m4c]
---

## Why

`agentic-workflow-pt0gy` puts a cross-process lock inside every mechanized lifecycle writer
and adds two mechanics verbs (`log`, `index-add`) so a skill never has to hand-prepend a
protocol entry or hand-insert an INDEX line again. It rewires only `modeling` and
`quick-capture`'s commit path — the sessions that actually run in parallel — and leaves the
other hand-writers in place, because a five-skill doctrine sweep in one task is the shape
that took `agentic-workflow-ghcaj` six verification iterations until it was bounded.

The lock only protects writers that take it. Every remaining hand-write below is a
read-modify-write on the same hot files (`protocol.md`, a BC `INDEX.md`, `knowledge/index.md`)
that a concurrent modeling session's verb can interleave with. Until each one goes through a
locked verb, "exactly one class of writer per bookkeeping file" — the invariant pt0gy and
ghcaj together claim — is only true on the modeling side.

Two of the hand-writes are **count-coupled** (they move a task between lifecycle folders and
must edit two list blocks and two counts together). `log`/`index-add` may not legally touch
a task list (pt0gy's five-section deny-list), so those need lifecycle verbs of their own.

## What

Migrate every hand-write in the enumerated surface list below onto a locked verb, deleting
(not duplicating) the replaced prose in PROMOTE/CAPTURE's already-rewritten "call the CLI,
commit its manifest" shape (ADR-0038, ADR-0073). Two new verbs land on
`lib/task-lifecycle-cli.mjs`, same three-layer boundary (ADR-0038), same compute-then-write
atomicity (ADR-0054), same lock (pt0gy), same enumerated-manifest / structured-rejection
contract:

1. **`bounce <id> '{"reason": "..."}'`** — the BOUNCE integration's `doing → backlog` move
   (currently hand-performed because that transition is illegal under `applyTaskMove`'s
   `policy:'skill'`; decide in the ADR whether the mover gains a `bounce` policy or the verb
   moves the file itself), the `## Worker note` append from the worker's `REASON` (judgment
   input, passed in), the `doing-list` removal + `backlog-list` insert + both count deltas,
   and the `Task bounced` protocol entry. Manifest message:
   `chore(<bc>): task bounced — <title> [<id>]`.
2. **`reroute <id> '{"to": "<bc>"}'`** — quick-capture's cross-BC re-route: move the file
   between two BCs' `backlog/` folders, rewrite `context:` (and the id? — **decide in the
   ADR**: the id carries the BC prefix per ADR-0028, so a re-route either mints a new id and
   retires the old one or keeps a now-misleading prefix; both are defensible, neither is
   silent), remove from the old BC's `backlog-list` (count −1), insert into the new BC's
   (count +1, backfilling an empty BC's INDEX under `captureTask`'s otherwise-empty rule
   only), strip and re-point backlinks, and prepend one protocol entry. Manifest message:
   `chore(<new-bc>): re-route <id> → <new-bc> [<id>]`. This closes the ADR-0059 "prose-only,
   unenforced" disposition pt0gy recorded for the re-route.
3. **Wire, don't build:** backlog-item materialization at PASS/SKIP integration
   (`skills/work/SKILL.md`, step (e)) calls the existing `capture` verb after
   `materializeTaskFile` instead of hand-inserting the INDEX line and count.

### Enumerated surface list (exhaustive as of a fresh grep on 2026-09-06)

Each hand-write, its file and section, and its target verb:

| # | File — section | Hand-write today | Target |
|---|---|---|---|
| 1 | `skills/work/SKILL.md` — Phase 1 "Write a minimal session-end protocol entry, then stop" (c5nvb shape) | protocol prepend | `log` |
| 2 | `skills/work/SKILL.md` — BOUNCE integration, steps 3–4 | `doing → backlog` move, INDEX doing/backlog edit + counts, `Task bounced` entry, commit | `bounce` + `scoped-commit` |
| 3 | `skills/work/SKILL.md` — PASS/SKIP integration step (e) "Materialize any new backlog items" | `backlog-list` insert + count per item | existing `capture` |
| 4 | `skills/work/SKILL.md` — "Index updates (conductor-owned)": adr-local / adr-global insert, research pointers, the doing → backlog row, concept-page links | INDEX marker inserts | `index-add` (task-list row → `bounce`) |
| 5 | `skills/work/SKILL.md` — "Protocol logging": Batch started (already via `claim`), Task verified and completed / completed (verification skipped) (already via `complete`), **Verification failed**, **Task bounced** (→ `bounce`), **Task failed** | protocol prepend | `log` |
| 6 | `skills/work/SKILL.md` — "End-of-run reporting" session-end entry (full shape, batch-mix line, vision-conformance line) | protocol prepend | `log` |
| 7 | `skills/work/SKILL.md` — every remaining hand-composed `git add` + `git commit` on `main` (batch-start, integration, bounce, session-end, rotation checks) | git | `scoped-commit` |
| 8 | `skills/brainstorm/SKILL.md` — "Protocol logging" session entry (stays one hand-*authored* narrative, prose-only per ADR-0073; only the *prepend* is mechanized) | protocol prepend | `log` |
| 9 | `skills/brainstorm/SKILL.md` — "Indexes": `bc-list` insert in `knowledge/index.md`, `adr-global` insert | INDEX marker inserts | `index-add` (`bc: null`) |
| 10 | `skills/brainstorm/SKILL.md` — Committing | git | `scoped-commit` |
| 11 | `skills/research/SKILL.md` — index placement rule: `research-local` / `research-global` insert | INDEX marker inserts | `index-add` |
| 12 | `skills/research/SKILL.md` — "Protocol logging" post-review-gate entry (including the "create the file with its header" prose, which dies) | protocol prepend | `log` |
| 13 | `skills/research/SKILL.md` — Committing | git | `scoped-commit` |
| 14 | `skills/quick-capture/SKILL.md` — "Re-routing after the fact" | two BCs' `backlog-list` + counts, `context:` rewrite, commit | `reroute` + `scoped-commit` |
| 15 | `agents/worker.md`, `agents/verifier.md` — any passage still describing a hand INDEX/protocol edit (post-ghcaj these should be none; confirm) | prose | pointer or delete |

**Out of scope:** `.agentheim/` READMEs' narrative history; the vision; ADR bodies other than
the one this task writes; `checkpoint` (unlocked by design); the `whats-next`, `inquire`, and
`dashboard` skills (read-only; `whats-next`'s advisory write is not a bookkeeping surface).

**Closure rule:** a hand-write found outside this list is a **follow-up backlog capture**,
never a FAIL — the list is exhaustive as of the refinement date's grep, and the verifier
checks the list, not "every surface agrees" (the ghcaj lesson, ADR-0069 audit-closure shape).

## Acceptance criteria

- [ ] `bounce <id>` exists on `lib/task-lifecycle-cli.mjs`: lock-held, compute-then-write, moves `doing → backlog`, appends the `## Worker note` from the caller-supplied reason, edits both list blocks and both counts (deltas from lines actually removed/inserted, the ADR-0073 strict variant), prepends the `Task bounced` entry, returns the enumerated manifest; rejects fail-closed (`not-found`, `illegal-move` when the task is not in `doing/`, `missing-reason`) with nothing written. `node --test` covered.
- [ ] `reroute <id> '{"to": bc}'` exists: lock-held, moves the file between BCs' `backlog/`, applies the id/context decision the ADR records, edits both BCs' INDEX blocks and counts, re-points backlinks, prepends one entry; rejects `same-bc`, `not-in-backlog`, `unknown-bc`, `index-missing` (non-empty target BC) with nothing written. `node --test` covered, including a cross-BC fixture with an existing dependent that references the moved id.
- [ ] Surface rows 1–14 each call the named verb (`log`, `index-add`, `capture`, `bounce`, `reroute`, `scoped-commit`); the replaced hand-edit prose is deleted, not duplicated, and each skill's Protocol-logging / Index-updates section reads as "supply the judgment inputs, call the verb, commit its manifest". Row 15 confirmed empty or fixed. [human-eye]
- [ ] `brainstorm`'s session entry remains hand-authored prose (ADR-0073's prose-only disposition stands) — only its prepend moves to `log`; the ADR-0059 note in `brainstorm/SKILL.md` is updated to say so.
- [ ] A fresh grep for hand-prepend / hand-insert idioms across `skills/*/SKILL.md` and `agents/*.md` (`prepend … protocol.md`, `insert under <!-- …:start -->`, `git add`, `git commit`) returns only pointers to verbs — recorded in the task's Outcome with the grep used. Anything found outside rows 1–15 is captured as a follow-up per the closure rule, never fixed in-task. [human-eye]
- [ ] The full `lib/test/*.test.mjs` suite is green on the merged tree (ADR-0062).
- [ ] The worker's ADR (ADR-0058 numbering) records both verb contracts, the `bounce` policy decision, the re-route id decision, and states that with this task `main` has exactly one class of writer per bookkeeping file across `work` and every modeling-side skill; the agentic-workflow README's *Commit doctrine* entry drops pt0gy's "modeling side only" qualifier and the lib inventory gains `bounce` / `reroute`. [human-eye]
- [ ] ADR-0059: every convention this task establishes ships enforcement (the verbs' tests, the grep recorded in Outcome) or is explicitly marked prose-only.

## Notes

Split out of `agentic-workflow-pt0gy` at its 2026-09-06 refinement by builder decision; the
surface list and the three count-coupled gaps (bounce, reroute, materialization) were
identified by the orchestrator's architect + tactical-modeler round for that refinement.

**Open design questions for the worker's ADR (not blockers):** whether `applyTaskMove` gains
a `bounce` policy or `bounce` moves the file itself (ADR-0007's mover boundary either way);
whether `reroute` mints a new id (ADR-0028 prefix semantics) or keeps the old one; whether
`work`'s "Verification failed" entries — several per task under the iteration loop — should
each be a `log` call or one call per task at escalation (lean: one per iteration, the
protocol is the observability record per agentic-workflow-b8x2v).

**Related follow-ups the tactical-modeler surfaced during pt0gy, not part of this task:**
promoting `discoverRoot` from `dashboard/` into `lib/` so `lib/` stops importing from the
dashboard; removing the vestigial `MOVED_FROM_DOING_FOLDERS` / `findMovedFromDoingPath` path
in `task-lifecycle-cli.mjs` (already noted post-ghcaj). Capture separately if wanted.
