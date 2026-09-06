---
name: Commit doctrine
description: Scoped `git add` (never `-A`/`.`), one-task-one-commit with the trivial-squash carve-out, and the `[<task-id>]` trailer convention. ADR-0026.
---

# Commit doctrine

Every skill that produces `.agentheim/` markdown commits its own artifacts, scoped to exactly what it touched, so the working tree is clean after any session (ADR-0026). The skill that owns the bookkeeping owns the commit of that bookkeeping (ADR-0017).

## Scoped `git add` — mandatory, never `git add -A` / `git add .`

Every commit `git add`s an **explicit, enumerated** list of only the files the action actually touched. A blanket add would sweep in a concurrent sibling's in-flight work — another `work` worktree, a concurrent `modeling` session's markdown, a `quick-capture` in progress, or the user's own untouched WIP — and bundle or race it into the wrong commit. This is **load-bearing for concurrency safety**, not a style preference: several skills/sessions can be live against the same working tree at once, and only scoped adds keep their commits from colliding.

## One task, one commit

`work` folds all of a task's bookkeeping — the `doing → done` move, frontmatter rewrite, BC `INDEX.md` edits, ADR backlinks, and the `protocol.md` entry — into **one commit**, `git add`ed together with the worker's code `FILE_LIST`. **Post-ghcaj (agentic-workflow-ghcaj):** the README and ADR halves of that same commit are no longer part of the worker's stage — the worker branch carries source and tests only — they are the conductor's own materialization on `main` from the worker's `README_DELTA` and `ADRS` report blocks, staged alongside `FILE_LIST` in the same one commit. There is no separate post-commit write step, and no `commit: <sha>` frontmatter field.

The `commit:` field is **dropped** (ADR-0026) — a task's commit is discoverable from `git log` via the `[<task-id>]` trailer in the commit message, not a stored SHA. Never add a `commit: <sha>` field and never amend a task file after committing.

**One commit per task is the default.** A narrow carve-out allows folding a *wave* of trivial follow-ups into one shared commit (one `[<task-id>]` trailer per squashed task) only when **all** of:

- **(a) Same BC** — every task in the wave belongs to the same bounded context.
- **(b) Same file set** — no task in the wave touches a file no other task in the wave touches.
- **(c) No-behavior-change tweaks** — copy / chrome / token / formatting only; no new test, no new code path. A task that adds a test or a behavior gets its own commit.
- **(d) Same batch** — dispatched together and all passed verification.

When in doubt, don't squash — one commit per task is always safe.

## Message convention

The `[<task-id>]` trailer is the `git log` index for a task's commit:

| Action | Message |
|---|---|
| `work` (feature/bug/refactor/chore/spike/decision) | `<type>(<bc>): <summary> [<task-id>]` |
| `modeling` CAPTURE | `chore(<bc>): capture <task-id> — <title> [<task-id>]` |
| `modeling` REFINE | `model(<bc>): refine <task-id> — <title> [<task-id>]` |
| `modeling` PROMOTE | `model(<bc>): promote <task-id> — <title> [<task-id>]` |
| `modeling` DISMISS | `chore(<bc>): dismiss <id-or-cascade-set>` |
| `modeling` CONSOLIDATE | `model(<bc>): consolidate <bc> README` |
| `quick-capture` | `chore(<bc>): capture <task-id> — <title> [<task-id>]` |
| `quick-capture` re-route (user corrects the routing) | `chore(<new-bc>): re-route <task-id> → <new-bc> [<task-id>]` |
| `brainstorm` (session) | `chore(<bc-or-global>): brainstorm <topic> — vision created \| vision revised \| vision extended` |
| `research` (report clears the review gate) | `chore(<bc-or-global>): research <slug>` — drop the scope token (`chore: research <slug>`) when the report indexed globally |

`model` is the commit `<type>` prefix reserved for `modeling`'s REFINE/PROMOTE/CONSOLIDATE actions specifically — everything else `modeling` writes (CAPTURE, DISMISS) uses `chore`.

### `work`'s own non-task-commit shapes

The table above covers per-task commits. `work` also mints a handful of trailer-less-by-convention or session-scoped shapes of its own, all documented in `skills/work/SKILL.md`:

| Shape | Message |
|---|---|
| Batch-start claim commit (Phase 4 step 1, ADR-0032's ADR-0026 amendment) | `chore(<bc>): batch start [<id-1>] [<id-2>] …` (single-BC batch), or `chore: batch start […]` (multi-BC batch, no `<bc>` token) |
| BOUNCE integration (ADR-0037, no longer squash-merges since agentic-workflow-ghcaj — a conductor-only `doing → backlog` move on `main` plus a `## Worker note`) | `chore(<bc>): task bounced — <title> [<task-id>]` |
| Reconcile stranded carry-over (session-end, per orphaned file/set) | `chore(<bc>): reconcile stranded <short-desc> [<last-task-id>]`, or `chore: reconcile stranded <short-desc>` if no task ran this session |
| Session-end bookkeeping (the one post-commit protocol write) | `chore(<bc>): work session end bookkeeping [<last-task-id>]`, or `chore: work session end bookkeeping` if the session committed nothing |
| Protocol rotation (ADR-0039/ADR-0045, self-firing at session-end) | `chore(agentic-workflow): rotate protocol — <rolledMonths joined with ", "> [<last-task-id>]`, or `chore: rotate protocol — ...` if no task ran |
| INDEX done-list rotation (ADR-0047, self-firing at session-end) | `chore(agentic-workflow): rotate INDEX done-list — <bc>:<rolledMonths joined with ", ">[, <bc2>:<rolledMonths2>...] [<last-task-id>]`, or `chore: rotate INDEX done-list — ...` if no task ran |

The batch-start and BOUNCE-integration shapes always carry at least one bracketed id; the
reconcile-stranded/session-end/rotation shapes reuse the last relevant task's id as their
trailer when one is available, and fall back to a plain `chore: ...` (no bracketed trailer at
all) when the session ran no task. This table (plus the "Batch-capture and release-flow
shapes" table below) is what lets a reader recognize one of these known shapes at a glance
instead of mistaking it for out-of-band drift — the session-start human-churn
reconciliation's actual recognition behavior lives in `lib/session-start-churn.mjs`'s
`MACHINE_SHAPES` / `recognizeMachineShape` (ADR-0066, including its pzacx amendment), not
restated here (ADR-0068 — this paragraph drifted out of sync with that mechanism twice
already).

### Batch-capture and release-flow shapes

Three more genuinely trailer-less shapes, outside `work`'s own table above:

| Shape | Message |
|---|---|
| Batch-capture summary — `modeling` CAPTURE / `quick-capture` capturing several tasks in one commit, legacy form with no per-task `[<task-id>]` trailer at all | `chore(<bc>): capture N <description>` |
| Release manifest bump (`/release` command / `RELEASE.md` Step 3) | `chore(release): vX.Y.Z` |
| Release protocol record (`/release` command / `RELEASE.md` Step 7) | `chore(protocol): record vX.Y.Z release shipped [work]` (an optional `(<aside>)` may sit before `[work]`) |

The release protocol-record shape's trailing `[work]` is a **sanctioned pseudo-trailer**, not
a task-id — it happens to also satisfy the bare bracket-only predicate `hasTaskTrailer` uses,
so today it never actually reaches the human-churn list via that predicate. It is still given
its own row here and its own `MACHINE_SHAPES` entry in `lib/session-start-churn.mjs`, rather
than relying on that coincidence, so the shape stays explicitly documented and the
table↔`MACHINE_SHAPES` 1:1 agreement holds regardless of how `hasTaskTrailer` evolves.

ADR of record: `.agentheim/knowledge/decisions/0026-committing-doctrine-bookkeeping-in-task-commit.md`. CONSOLIDATE's contract (trigger, scope, "never silently drop a term or invariant") is fixed by `.agentheim/knowledge/decisions/0041-artifact-growth-two-disciplines-consolidate-verb.md`.
