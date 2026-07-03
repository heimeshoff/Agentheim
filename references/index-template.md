# Index templates

Two flat, append-on-creation catalogs. Indexes only **point** — they never duplicate artifact content.

## Top-level: `.agentheim/knowledge/index.md`

State-of-the-world entry point. Skills read this for orientation before any deep work.

```markdown
# Index

Top-level catalog of this project's bounded contexts, global decisions, and research.
For BC-scoped artifacts, see each BC's `INDEX.md`.

> Updated by: `modeling` (BC creation), `work` (global ADRs), `research` (reports tagged global / cross-BC), backfill script.
> Hand-edits are fine but the skills will append at the section markers below.

---

## Bounded contexts

<!-- bc-list:start -->
- **<bc-name>** — <one-line purpose from BC README> — `contexts/<bc-name>/INDEX.md`
<!-- bc-list:end -->

## Global ADRs (scope: global)

<!-- adr-global:start -->
- **NNNN** — <title> — <YYYY-MM-DD> — `knowledge/decisions/NNNN-<slug>.md`
<!-- adr-global:end -->

## Cross-BC research

Research reports relevant to more than one BC (or to the project as a whole). BC-specific
reports are listed in each BC's `INDEX.md`.

<!-- research-global:start -->
- **<slug>** — <one-line topic> — <YYYY-MM-DD> — `knowledge/research/<slug>-<date>.md`
<!-- research-global:end -->

## Pointers

- Vision: `vision.md`
- Context map: `context-map.md` (if exists)
- Protocol (chronological log): `knowledge/protocol.md` — newest entries on top; capped at ~1,000 lines, older months roll out verbatim to `knowledge/protocol/YYYY-MM.md` (ADR-0039)
- All ADRs: `knowledge/decisions/`
- All research: `knowledge/research/`
```

The `<!-- name:start --> ... <!-- name:end -->` markers are how the skills locate where to append. Do not remove them — the backfill script and append logic look for them.

## Per-BC: `.agentheim/contexts/<bc>/INDEX.md`

BC-local catalog. Workers read this before designing; model reads it to find prior art and related decisions.

```markdown
# <BC name> — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

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

Capped at ~30 live entries (`lib/index-rotation.mjs`'s `DEFAULT_CAP_ENTRIES`); once rotation has
rolled a month out, this header is rewritten in place to name the archive location and the block
above holds only the live cap. Rolled-out months land verbatim, newest-on-top, in
`contexts/<bc>/done-archive/YYYY-MM.md` — the same cap-and-roll convention ADR-0039 established
for `protocol.md` (agentic-workflow-r2c7m), applied here to the INDEX done-list
(agentic-workflow-c8j3w). Rotation never touches the actual `done/<task-id>-<slug>.md` files or
the `**Done:** N` lifetime count above, so `depends_on`/`blocks` resolution and the dashboard
search corpus (ADR-0023) are unaffected; `modeling`'s prior-art matcher additionally checks
`done-archive/` when present.

### Backlog
<!-- backlog-list:start -->
- **<task-id>** — <title> — `backlog/<task-id>-<slug>.md`
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **NNNN** — <title> — <YYYY-MM-DD> — `../../knowledge/decisions/NNNN-<slug>.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
- **<slug>** — <one-line topic> — <YYYY-MM-DD> — `../../knowledge/research/<slug>-<date>.md`
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
- **<concept>** — <one-line description> — derived_from: [<ids>] — `concepts/<concept>.md`
<!-- concepts:end -->

## Pointers

- BC README (ubiquitous language, invariants): `README.md`
- Done-list archive (entries rolled out beyond the live cap, if any): `done-archive/YYYY-MM.md` (ADR-0039 convention, agentic-workflow-c8j3w)
```

## Append rules

When a skill creates an artifact, it inserts a new line **immediately after** the matching `:start` marker (so newest entries are on top within each section).

Examples:

- `modeling` writes `contexts/auth/backlog/auth-003-password-reset.md` → inserts under `<!-- backlog-list:start -->` in `contexts/auth/INDEX.md`. Also increments the Backlog count under `<!-- task-counts:start -->`.
- `work` writes `knowledge/decisions/0014-postgres-billing.md` with `scope: billing` → inserts under `<!-- adr-local:start -->` in `contexts/billing/INDEX.md`. If `scope: global`, inserts under `<!-- adr-global:start -->` in `knowledge/index.md` instead.
- `research` writes `knowledge/research/auth-tokens-2026-05-13.md` with `related_tasks: [auth-007]` → inserts under `<!-- research-local:start -->` in `contexts/auth/INDEX.md`. If the report's `related_tasks` spans multiple BCs (or none yet), inserts under `<!-- research-global:start -->` in `knowledge/index.md`.

## When the index file doesn't exist yet

Create it from this template before appending. Each skill should do this lazily — first artifact for a BC creates that BC's INDEX.md; the first global artifact creates `knowledge/index.md`.
