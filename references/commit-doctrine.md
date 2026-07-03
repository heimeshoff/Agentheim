---
name: Commit doctrine
description: Scoped `git add` (never `-A`/`.`), one-task-one-commit with the trivial-squash carve-out, and the `[<task-id>]` trailer convention. ADR-0026.
---

# Commit doctrine

Every skill that produces `.agentheim/` markdown commits its own artifacts, scoped to exactly what it touched, so the working tree is clean after any session (ADR-0026). The skill that owns the bookkeeping owns the commit of that bookkeeping (ADR-0017).

## Scoped `git add` — mandatory, never `git add -A` / `git add .`

Every commit `git add`s an **explicit, enumerated** list of only the files the action actually touched. A blanket add would sweep in a concurrent sibling's in-flight work — another `work` worktree, a concurrent `modeling` session's markdown, a `quick-capture` in progress, or the user's own untouched WIP — and bundle or race it into the wrong commit. This is **load-bearing for concurrency safety**, not a style preference: several skills/sessions can be live against the same working tree at once, and only scoped adds keep their commits from colliding.

## One task, one commit

`work` folds all of a task's bookkeeping — the `doing → done` move, frontmatter rewrite, BC `INDEX.md` edits, ADR backlinks, and the `protocol.md` entry — into **one commit**, `git add`ed together with the worker's `FILE_LIST`, README, and ADRs. There is no separate post-commit write step, and no `commit: <sha>` frontmatter field.

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
| `brainstorm` (session) | `chore(<bc-or-global>): brainstorm <topic> — vision created \| revised \| extended` |

`model` is the commit `<type>` prefix reserved for `modeling`'s REFINE/PROMOTE/CONSOLIDATE actions specifically — everything else `modeling` writes (CAPTURE, DISMISS) uses `chore`.

ADR of record: `.agentheim/knowledge/decisions/0026-committing-doctrine-bookkeeping-in-task-commit.md`. CONSOLIDATE's contract (trigger, scope, "never silently drop a term or invariant") is fixed by `.agentheim/knowledge/decisions/0041-artifact-growth-two-disciplines-consolidate-verb.md`.
