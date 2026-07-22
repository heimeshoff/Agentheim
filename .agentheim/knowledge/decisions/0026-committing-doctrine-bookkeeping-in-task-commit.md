---
id: ADR-0026
title: Committing doctrine — every artifact-producing skill commits its own scoped .md; bookkeeping folds into the task commit
scope: agentic-workflow
status: accepted
date: 2026-06-17
related_tasks: [agentic-workflow-063, agentic-workflow-n3bbk]
related_adrs: [0007, 0017]
---

# ADR-0026: Committing doctrine — every artifact-producing skill commits its own scoped `.md`; bookkeeping folds into the task commit

## Context

Two recurring committing pains motivated this decision:

1. **Leftover uncommitted markdown.** `modeling`, `quick-capture`, and `brainstorm` all
   write `.md` artifacts — task files, `INDEX.md` lines, `protocol.md` entries — but none of
   them committed. After a modeling/capture/brainstorm session those changes just sat in the
   working tree until some later `work` session swept them in (or a human noticed). The
   working tree was routinely dirty with `.agentheim/` markdown that nobody had committed.

2. **`work` leaked its own bookkeeping out of the task commit.** The orchestrator committed
   the worker's code + the moved task file, captured the SHA, and *then* — after the
   commit — wrote `commit: <sha>` into the task frontmatter, edited the BC `INDEX.md`
   list/count, and prepended the `protocol.md` entry. Those landed in the working tree,
   never in the task's commit. The de-facto workaround became a separate trailing
   per-session "record SHAs + INDEX/protocol" commit (e.g. `243dcad`, `098c0b3`) — an extra
   commit every session, and a silent leak whenever it was forgotten. The root cause is a
   chicken-and-egg: you cannot write the commit SHA into frontmatter until *after* you
   commit, which forces all SHA-coupled bookkeeping out of the task commit.

The side-effect boundary from **ADR-0007** (the mover owns only the move; INDEX/protocol
side-effects stay with the skills) and the ownership rule from **ADR-0017** (skills are the
sole owners of task lifecycle *and* its bookkeeping) frame this: the skill that owns the
bookkeeping is the right place to own the *commit* of that bookkeeping.

## Decision

**Every skill that produces `.agentheim/` markdown commits its own artifacts, scoped, as
part of its own work — so the working tree is clean after any session.** Concretely:

1. **`work` folds bookkeeping into the task commit.** The orchestrator performs the
   `doing → done` task-file move + frontmatter rewrite, the BC `INDEX.md` edits, the
   ADR↔task backlink maintenance, and the `protocol.md` entry **before** committing, then
   `git add`s all of them together with the worker's `FILE_LIST`, the BC README (if
   updated), and any ADRs. A completed task's code + task-move + INDEX + protocol land in
   **one** commit. Nothing is left in the working tree afterward. This changes only *when*
   the skill performs those side-effects relative to its commit — it does **not** move them
   into `applyTaskMove`; ADR-0007's boundary is intact.

2. **The `commit:` frontmatter field is dropped.** There is no post-commit
   SHA-in-frontmatter write. A task's commit is discoverable from `git log` via the
   `[<task-id>]` trailer in every commit message, so the field was redundant *and* the only
   reason bookkeeping had to leak out of the task commit. The field is removed from the
   task-file template, the frontmatter field legend, the `quick-capture` template, and the
   `work` orchestrator's post-commit step. (Already-`done` task files keep whatever
   `commit:` value they were stamped with — those are frozen; we do not rewrite history.)

3. **One commit per task stays the default, with a precisely-bounded trivial-squash
   carve-out.** A *wave* of trivial follow-up tasks MAY be squashed into one commit when
   **all** of these hold: (a) every task in the wave is in the **same BC**; (b) they touch
   the **same file set** (no task in the wave touches a file no other in the wave touches);
   (c) each is a no-behavior-change tweak layered on the prior one (copy/chrome/token/format
   only — no new test, no new code path, no acceptance criterion that a test would newly
   cover); and (d) they were dispatched in the **same `work` batch**. The aw-064/065/066/067
   one-line topbar-chrome tweaks are the canonical example. This bends the vision's
   "one task = one commit" invariant, which is exactly why it is recorded here.

4. **Markdown-producing skills commit their own scoped artifacts at end-of-action.**
   `modeling` (CAPTURE / REFINE / PROMOTE / DISMISS), `quick-capture`, `brainstorm`, and
   `research` each `git add` *only* the `.md` files they touched (new/updated task files or
   report + the BC or global `INDEX.md` + `protocol.md` + any ADRs/vision/context-map they
   wrote) and commit them at the end of the action, with a defined message convention
   (below). `research` commits once its report clears the review gate (PASS, SKIP, or the
   iteration-3 labeled-unverified outcome) — see `skills/research/SKILL.md`'s own Committing
   section. The commit is **silent** (no confirm prompt) — matching `work`, and matching the
   user complaint that drove this (leftover uncommitted markdown is the cost of *not*
   auto-committing). This is a narrow, deliberate exception to the global "commit only when
   asked" stance: these skills commit only their own `.agentheim/` markdown bookkeeping,
   never the builder's source code.

5. **Scoped `git add` is mandatory, never `git add -A`.** `modeling` sometimes runs
   concurrently with `work`. Each skill `git add`s an explicit, enumerated list of only its
   own artifacts. A blanket `git add -A` / `git add .` would sweep in a concurrent sibling's
   in-flight files (a half-written task, a worker's un-verified code) and bundle or race
   them into the wrong commit. The scoped-add rule is load-bearing for concurrency safety,
   not a style preference.

### Commit-message convention

All commits carry the `[<task-id>]` (or, for brainstorm, a session marker) trailer so
`git log` is the SHA index that the dropped `commit:` field used to be.

| Skill / action | Message |
|---|---|
| `work` (task complete) | `<type>(<bc>): <summary> [<task-id>]` (unchanged) |
| `work` (trivial-squash wave) | `<type>(<bc>): <summary> [<id-1>] [<id-2>] …` (one trailer per squashed task) |
| `quick-capture` | `chore(<bc>): capture <task-id> — <title> [<task-id>]` |
| `modeling` CAPTURE | `chore(<bc>): capture <task-id> — <title> [<task-id>]` |
| `modeling` REFINE | `model(<bc>): refine <task-id> — <title> [<task-id>]` |
| `modeling` PROMOTE | `model(<bc>): promote <task-id> — <title> [<task-id>]` |
| `modeling` DISMISS | `chore(<bc>): dismiss <id-or-cascade-set>` (one commit for the whole cascade) |
| `brainstorm` | `chore(<bc-or-global>): brainstorm <topic> — vision created/revised/extended` |
| `research` | `chore(<bc-or-global>): research <slug>` (scope token dropped when indexed globally) |

`model` is introduced as a commit `<type>` prefix for modeling's REFINE/PROMOTE markdown
commits (it is not a task `type:`; task types stay feature/bug/refactor/chore/spike/decision).

## Consequences

**Positive**

- The working tree is clean after **any** session — `work`, `modeling`, `quick-capture`,
  `brainstorm`. No leftover uncommitted `.md`, no trailing per-session bookkeeping commit.
- `work` is back to one commit per task with no SHA chicken-and-egg; the extra
  "record SHAs + INDEX/protocol" commit per session is gone.
- Concurrent `modeling` + `work` sessions never bundle or race each other's markdown,
  because every add is scoped to the skill's own enumerated artifacts.
- `git log` is the single, honest commit index (via `[<task-id>]` trailers); no derived
  `commit:` field to drift or leak.

**Negative**

- Markdown-producing skills now make commits silently — a small departure from
  "commit only when asked", bounded to `.agentheim/` bookkeeping. A builder who wants to
  review before committing must say so; the default is auto-commit.
- The trivial-squash carve-out means a few commits carry multiple `[<task-id>]` trailers,
  so "one commit ↔ one task" is no longer a strict 1:1 for those waves.

**Neutral**

- ADR-0007's mover boundary is unchanged — bookkeeping side-effects still live in the
  skills, only their commit timing moved.
- Already-`done` task files keep their historical `commit:` value; the field simply stops
  being written and is dropped from the templates and legend.

## Alternatives considered

- **Keep writing `commit: <sha>` via a post-commit amend.** Either leaves the same leak
  (a second commit) or forces a history-rewriting amend on every task. Rejected — `git log`
  already carries the SHA↔task link via the message trailer; the field is redundant.
- **Per-session bundling instead of per-task commits.** Considered and rejected by the
  builder during refinement — per-task granularity is the value of the lifecycle; the only
  relaxation wanted is the trivial-squash carve-out for genuine no-op follow-up waves.
- **Prompt the user before each markdown commit.** Argued for by the global "commit only
  when asked" stance, but it reintroduces friction on the fast path (`quick-capture`'s whole
  point is speed) and the original complaint was about *uncommitted* markdown. Rejected in
  favour of silent auto-commit, matching `work`.

Builds on **ADR-0007** (side-effect boundary kept intact) and **ADR-0017** (skills own the
lifecycle and its bookkeeping — therefore the commit of that bookkeeping).
