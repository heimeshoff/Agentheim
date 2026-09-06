---
id: agentic-workflow-fn59c
title: Wire every remaining hand-written protocol, INDEX, and git edit in work, brainstorm, research, and quick-capture onto the locked lifecycle verbs (log, index-add, capture, bounce, reroute, scoped-commit), deleting the replaced prose, so main has exactly one class of writer per bookkeeping file project-wide
status: todo
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-qd24q]
blocks: []
tags: [concurrency, bookkeeping, mechanization, lifecycle-cli, doctrine-sweep]
related_adrs: [0026, 0028, 0038, 0059, 0068, 0069, 0073, 0074, 0075, 0077]
related_research: []
prior_art: [agentic-workflow-e4bjh, agentic-workflow-ghcaj, agentic-workflow-pt0gy, agentic-workflow-r7dq3]
---

## Why

`agentic-workflow-pt0gy` (ADR-0075) rewired only `modeling` and `quick-capture`'s commit path
onto the locked verbs — the sessions that actually run in parallel — and left the other
hand-writers in place, because a five-skill doctrine sweep in one task is the shape that took
`agentic-workflow-ghcaj` six verification iterations until it was bounded (ADR-0074).
`agentic-workflow-qd24q` built the two count-coupled verbs (`bounce`, `reroute`) that
`log`/`index-add` may not legally stand in for — shipped 2026-09-06 as ADR-0077 (plus
ADR-0028 §8, re-routing), so every verb this sweep calls now exists.

The lock only protects writers that take it. Every remaining hand-write below is a
read-modify-write on the same hot files (`protocol.md`, a BC `INDEX.md`, `knowledge/index.md`)
that a concurrent modeling session's verb can interleave with, and every hand-composed
`git add` + `git commit` on `main` still races a sibling's `.git/index.lock` without
`scoped-commit`'s retry. Until each goes through a locked verb, "exactly one class of writer
per bookkeeping file" — the invariant pt0gy and ghcaj together claim — is only true on the
modeling side. This task makes it true project-wide, and is the bounded, enumerated sweep the
ghcaj lesson calls for: a fixed row list, a closure rule, and a verifier that checks the list.

## What

Migrate every hand-write in the enumerated surface list below onto a locked verb, deleting
(not duplicating) the replaced prose, in the same "supply the judgment inputs, call the verb,
commit its manifest" shape PROMOTE/CAPTURE already have (ADR-0038, ADR-0073, ADR-0075).
Prose-only — no `lib/` change; every verb this task calls exists (`agentic-workflow-qd24q`
shipped as ADR-0077). Wire each surface to the verb's **actual** contract as recorded in
ADR-0077 — manifest shape, protocol-entry field set, and rejection ladder — not to the
pre-ship description this task was first written against.

- **Wire, don't build:** backlog-item materialization at PASS/SKIP integration
  (`skills/work/SKILL.md`, step (e)) calls the existing `capture` verb after
  `materializeTaskFile` instead of hand-inserting the INDEX line and count.
- **BOUNCE integration** calls `bounce <id> '{"reason": "<worker REASON verbatim>"}'` and
  commits its manifest (`changed:[newBacklogPath, oldDoingPath, indexPath, protocolPath]`,
  `message:'chore(<bc>): task bounced — <title> [<id>]'`) via `scoped-commit`; the
  "`policy:'skill'` is not itself legal for this transition — do it as the plain file move"
  passage and the Index-updates table's "still hand-edited" row die. State the verb's
  fail-closed ladder and the conductor's reaction to each: `lock-timeout` → retry once the
  sibling's lock clears (never delete `lifecycle.lock`); `illegal-move` → the task is no
  longer in `doing/` (a retry after a completed bounce, or a race) — locate it, surface,
  never fall back to a hand move; `missing-reason` → the worker's `REASON` was lost, recover
  it from the worker before re-running (the reason is the one judgment input and rides the
  move's single write, so it cannot be appended afterwards); `not-found` → escalate.
  The "Task bounced" template in Protocol logging is corrected to the field set the verb
  actually writes — `**Type:** Work / Task bounced`, `**BC:**`, `**From → To:** doing →
  backlog`, `**Reason:**` — replacing today's `**Task:**` / `**Moved to:**` shape.
- **quick-capture's "Re-routing after the fact"** calls `reroute <id> '{"to": "<bc>"}'` and
  commits **the manifest's `changed` array as returned** — it is open-ended
  (`[newTaskPath, oldTaskPath, oldIndexPath, newIndexPath, protocolPath,
  ...everyBacklinkFileTouched]`), so today's fixed five-path enumeration under-commits
  whenever a backlink was re-pointed and must go. The "keep the original id" sentence and
  the "prose-only, unenforced — tracked in `agentic-workflow-qd24q`" disposition are replaced
  by the verb's actual contract: a fresh `<to-bc>-<token>` id is minted and the old one
  retired, the new file carries `rerouted_from: <old-id>`, every `depends_on` / `blocks` /
  `prior_art` / `related_tasks` backlink is re-pointed (never stripped), and one
  `Modeling / Re-routed: <old-id> → <new-id>` protocol entry is written. The report line
  echoes the manifest's `newId` field to the builder (the old id is gone). State the
  rejection ladder — `missing-to`, `same-bc`, `not-in-backlog`, `unknown-bc`,
  `index-missing`, `lock-timeout` — and that each leaves nothing written; on
  `index-missing` (a non-empty target BC without an `INDEX.md`) the builder decides, the
  skill never backfills by hand.
- **Dead protocol-header template in `work`:** while touching `work`'s Protocol-logging section
  (rows 1/5/6), delete the "If `protocol.md` doesn't exist, create it with:" template for a
  pointer — the same dead prose pt0gy already deleted from `modeling` and row 12 names for
  `research` (every verb calls `readProtocolOrDefault`). Surfaced by the 2026-09-06
  refinement's grep; folded in here explicitly rather than left for the closure rule.
- **Verification-failed entries under the iteration loop:** one `log` call per iteration, not
  one per task at escalation — the protocol is the observability record
  (agentic-workflow-b8x2v), and each iteration's verdict is a distinct measured event.

### Enumerated surface list (exhaustive as of a fresh grep on 2026-09-06, re-confirmed by the second refinement's orchestrator round and again by the third, post-ADR-0077, on the same day)

Each hand-write, its file and section, and its target verb:

| # | File — section | Hand-write today | Target |
|---|---|---|---|
| 1 | `skills/work/SKILL.md` — Phase 2 step 8 (vacuum guard), "Write a minimal session-end protocol entry, then stop" (c5nvb shape) | protocol prepend + hand commit | `log` + `scoped-commit` |
| 2 | `skills/work/SKILL.md` — BOUNCE integration, steps 2–4 | `doing → backlog` move, `## Worker note` append, INDEX doing/backlog edit + counts, `Task bounced` entry, commit | `bounce` + `scoped-commit`, with the rejection ladder stated (see What) |
| 3 | `skills/work/SKILL.md` — PASS/SKIP integration step (e) "Materialize any new backlog items" | `backlog-list` insert + count per item | existing `capture` (`protocolEntry: false`, the brainstorm precedent) |
| 4 | `skills/work/SKILL.md` — "Index updates (conductor-owned)": adr-local / adr-global insert, the `doing → backlog` table row, the BACKLOG_ITEMS paragraph, the "create it from the template" sentence | INDEX marker inserts | `index-add` (task-list row → `bounce`; backlog items → `capture`) |
| 5 | `skills/work/SKILL.md` — "Protocol logging": **Verification failed**, **Task bounced** (→ `bounce`; its template's field set corrected to `**BC:**` / `**From → To:** doing → backlog` / `**Reason:**`, what the verb writes), **Task failed**; plus the dead header-creation template | protocol prepend | `log` |
| 6 | `skills/work/SKILL.md` — "End-of-run reporting" step 8 session-end entry (full shape, batch-mix line, vision-conformance line) + its scoped commit | protocol prepend + hand commit | `log` + `scoped-commit` |
| 7 | `skills/work/SKILL.md` — every remaining hand-composed `git add` + `git commit` on `main` (batch-start claim commit, PASS/SKIP integrating commit, FAILED, rotation checks' own commits, carry-over reconciliation commits) | git | `scoped-commit` |
| 8 | `skills/brainstorm/SKILL.md` — "Protocol logging" session entry (stays one hand-*authored* narrative, prose-only per ADR-0073; only the *prepend* is mechanized) | protocol prepend | `log` |
| 9 | `skills/brainstorm/SKILL.md` — "Indexes": `bc-list` insert in `knowledge/index.md`, `adr-global` insert, and the "creating the file from the template first" prose | INDEX marker inserts | `index-add` (`bc: null`) |
| 10 | `skills/brainstorm/SKILL.md` — Committing | git | `scoped-commit` |
| 11 | `skills/research/SKILL.md` — "Updating indexes": `research-local` / `research-global` insert and the "create it from the template first" prose | INDEX marker inserts | `index-add` |
| 12 | `skills/research/SKILL.md` — "Protocol logging" post-review-gate entry (including the "creating the file with its header" prose, which dies) | protocol prepend | `log` |
| 13 | `skills/research/SKILL.md` — Committing | git | `scoped-commit` |
| 14 | `skills/quick-capture/SKILL.md` — "Re-routing after the fact" (including its fixed five-path commit sentence) | two BCs' `backlog-list` + counts, `context:` rewrite, "keep the original id", commit | `reroute` + `scoped-commit` of the manifest's full `changed` array; `newId` echoed to the builder |
| 15 | `agents/worker.md`, `agents/verifier.md` — any passage still describing a hand INDEX/protocol edit | prose | **confirmed empty** on 2026-09-06 (both files carry only "never write under `.agentheim/`" / "never run git" rules) — record the confirmation in Outcome, no edit |

**Out of scope:** `.agentheim/` READMEs' narrative history; the vision; ADR bodies other than
the amendment this task writes; `checkpoint` (unlocked by design, ADR-0075); the `whats-next`,
`inquire`, and `dashboard` skills (read-only; `whats-next`'s advisory write is not a
bookkeeping surface); the `modeling` skill (already wired by pt0gy).

**Closure rule:** a hand-write found outside this list is a **follow-up backlog capture**,
never a FAIL — the list is exhaustive as of the refinement date's grep, and the verifier
checks the list, not "every surface agrees" (the ghcaj lesson, ADR-0069 audit-closure shape).

## Acceptance criteria

- [ ] Surface rows 1–14 each call the named verb (`log`, `index-add`, `capture`, `bounce`, `reroute`, `scoped-commit`); the replaced hand-edit prose is deleted, not duplicated, and each skill's Protocol-logging / Index-updates / Committing section reads as "supply the judgment inputs, call the verb, commit its manifest". Row 15's empty confirmation is recorded in Outcome. [human-eye]
- [ ] `work`'s dead "If `protocol.md` doesn't exist, create it with:" template is deleted for a pointer to `readProtocolOrDefault`, alongside rows 1/5/6; the same for `research`'s (row 12) and the "create it from the template" sentences in rows 4, 9, 11.
- [ ] `brainstorm`'s session entry remains hand-authored prose (ADR-0073's prose-only disposition stands) — only its prepend moves to `log`; the ADR-0059 note in `brainstorm/SKILL.md` is updated to say so.
- [ ] `quick-capture/SKILL.md`'s re-route section states the verb's real contract (new id minted and the manifest's `newId` reported to the builder, old retired, `rerouted_from` marker, backlinks re-pointed never stripped, one `Modeling / Re-routed` entry), commits the manifest's full `changed` array rather than a fixed path list, lists the rejection ladder (`missing-to`, `same-bc`, `not-in-backlog`, `unknown-bc`, `index-missing`, `lock-timeout`), and drops both the "keep the original id" sentence and the "prose-only, unenforced" disposition.
- [ ] `work/SKILL.md`'s BOUNCE integration states `bounce`'s rejection ladder (`not-found`, `illegal-move`, `missing-reason`, `lock-timeout`) with the conductor's reaction to each, never a hand-move fallback; its "Task bounced" protocol template carries exactly the field set `bounceTask` writes (`**Type:** Work / Task bounced`, `**BC:**`, `**From → To:** doing → backlog`, `**Reason:**`).
- [ ] A fresh grep for hand-prepend / hand-insert idioms across `skills/*/SKILL.md` and `agents/*.md` (`prepend … protocol.md`, `insert under <!-- …:start -->`, `create it from … template`, `git add`, `git commit`) returns only pointers to verbs or "never do this" rules — recorded in the task's Outcome with the grep used. Anything found outside rows 1–15 is captured as a follow-up per the closure rule, never fixed in-task. [human-eye]
- [ ] The agentic-workflow README's *Commit doctrine* entry drops pt0gy's "modeling-side half" / "two count-coupled hand-writers remain open" qualifiers and states that `main` has exactly one class of writer per bookkeeping file across `work` and every markdown-producing skill; **ADR-0077** (qd24q's ADR) gains a short Consequences addendum saying the same and marking this task's conventions prose-only (amend in place, no new ADR number; this task's id is already in its `related_tasks`). [human-eye]
- [ ] ADR-0059: every convention this task establishes is prose-only by nature (skill doctrine) and is marked so in the amended ADR; the grep recorded in Outcome is its enforcement floor.
- [ ] The full `lib/test/*.test.mjs` suite is green on the merged tree (ADR-0062) — no `lib/` behavior changed.

## Notes

Split out of `agentic-workflow-qd24q` at its second 2026-09-06 refinement, by builder
decision: qd24q keeps its id and becomes the code-only verb build (`bounce`, `reroute`), so
ADR-0075's, the README's, and `quick-capture/SKILL.md`'s existing pointers to it stay true;
this task is the prose-only wiring sweep and waited in `backlog/` behind PROMOTE's fail-closed
`depends_on` gate (ADR-0038 Ruling A, `blocked-dependency`) until qd24q was in `done/`.

Third refinement (2026-09-06, after qd24q shipped at aad4a48 as ADR-0077): an architect round
diffed every row against the shipped contracts and the current skill text. Rows 3, 4, 6, 8–13
needed no change; rows 1, 2, 5, 14 were sharpened to the real manifests, protocol field set,
and rejection ladders (see What), and no hand-write outside rows 1–15 was found. `reroute`'s
`missing-to` rejection is in the code but not in ADR-0077 §3's ladder text — cite the code
(`lib/task-lifecycle-capture-dismiss.mjs`) when wiring row 14, and add the code to ADR-0077's
ladder in the same Consequences addendum this task writes.

File-disjoint with qd24q by construction: qd24q touches `lib/`, its tests, one ADR, and the
README's lib inventory; this task touches the four skill files, the two agent files (read
only), the README's Commit-doctrine entry, and qd24q's ADR (amendment). Sequenced, never
parallel, so no merge-back conflict on `skills/work/SKILL.md` is possible.

The orchestrator round that produced the split (architect + tactical-modeler, 2026-09-06)
independently re-grepped every row's section and found rows 1–14 unchanged and row 15 empty;
its one adjacent finding — `work`'s dead protocol-header template — is folded into rows 5 and
the second acceptance criterion above rather than left to the closure rule.
