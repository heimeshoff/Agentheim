# Task-half index template

The task-status half of a bounded context's per-BC index (ADR-0078). Under the `board/`
layout this is the WHOLE of `board/<bc>/INDEX.md` — tasks by status only, nothing else;
the knowledge half (ADRs / research / concepts) lives in a separate file, see
`references/knowledge-index-template.md`.

Under the (transitional, `'legacy'`-layout) shape there is no separate task-half file on
disk — the two halves are still the SAME `.agentheim/contexts/<bc>/INDEX.md`, rendered from
the LEGACY combined template kept in `references/index-template.md`'s "Per-BC (LEGACY
combined shape)" section. This file is read only once `lib/task-system-paths.mjs`'s
`detectLayout` resolves `'board'`.

## Per-BC (task half): `.agentheim/board/<bc>/INDEX.md`

Task-board catalog. Workers and `work`'s conductor read this to find what is ready, what is
in flight, and what is done.

```markdown
# <BC name> — Index (task board)

Catalog of this bounded context's tasks by status.

> Updated by: `modeling` (tasks), the lifecycle verbs (promote / claim / complete / capture / dismiss / bounce / reroute).
> Hand-edits are fine but the verbs will append at the section markers below.

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** N
- **Todo:** N
- **Doing:** N
- **Done:** N
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
- **<task-id>** — <title> — depends_on: [...] — `todo/<task-id>-<slug>.md`
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
- **<task-id>** — <title> — `doing/<task-id>-<slug>.md`
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **<task-id>** — <title> — <YYYY-MM-DD completed> — `done/<task-id>-<slug>.md`
<!-- done-list:end -->

Current-month entries stay live in full — the nominal ~30-entry figure
(`lib/index-rotation.mjs`'s `DEFAULT_CAP_ENTRIES`) is a steady-state target, not a hard cap, so a
busy month can legitimately hold well past 30 live entries (ADR-0039); rotation never splits a
month. Once a whole month closes and rotation rolls it out, this header is rewritten in place to
name the archive location (ADR-0047) and the block above holds only the still-live entries.
Rolled-out months land verbatim, newest-on-top, in `done-archive/YYYY-MM.md` — the same
cap-and-roll convention ADR-0039 established for `protocol.md` (agentic-workflow-r2c7m), applied
here to the INDEX done-list (agentic-workflow-c8j3w). Rotation never touches the actual
`done/<task-id>-<slug>.md` files or the `**Done:** N` lifetime count above, so `depends_on`/
`blocks` resolution and the dashboard search corpus (ADR-0023) are unaffected; `modeling`'s
prior-art matcher additionally checks `done-archive/` when present.

### Backlog
<!-- backlog-list:start -->
- **<task-id>** — <title> — `backlog/<task-id>-<slug>.md`
<!-- backlog-list:end -->

## Pointers

- Done-list archive (entries rolled out beyond the live cap, if any): `done-archive/YYYY-MM.md` (ADR-0039 convention, agentic-workflow-c8j3w)
- Knowledge half (ADRs / research / concepts / BC README) for this BC: `../../knowledge/contexts/<bc-name>/INDEX.md`
```

The `<!-- name:start --> ... <!-- name:end -->` markers are how the lifecycle verbs locate
where to append/remove. Do not remove them.

## Append rules

- `modeling` writes `board/auth/backlog/auth-003-password-reset.md` → inserts under
  `<!-- backlog-list:start -->` in `board/auth/INDEX.md`. Also increments the Backlog count
  under `<!-- task-counts:start -->`.
- Every forward lifecycle move (promote / claim / complete) moves the matching line between
  marker blocks and adjusts both counts together — never one without the other.

## When the index file doesn't exist yet

Create it from this template before appending. `captureTask`'s empty-BC backfill
(ADR-0078 §6) does this on demand under the `board/` layout — it never authors the
knowledge half (`README.md`, the knowledge-half `INDEX.md`); that stays with `modeling` /
`brainstorm`, since a BC exists only once its README does.
