# Top-level index template

The flat, append-on-creation top-level catalog. It only **points** — it never duplicates
artifact content. For the per-BC templates (task-status half and knowledge half), see
`references/task-index-template.md` and `references/knowledge-index-template.md`.

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
- Protocol (chronological log): `../board/protocol.md` — newest entries on top; capped at ~1,000 lines, older months roll out verbatim to `../board/protocol/YYYY-MM.md` (ADR-0039)
- All ADRs: `knowledge/decisions/`
- All research: `knowledge/research/`
```

The `<!-- name:start --> ... <!-- name:end -->` markers are how the skills locate where to append. Do not remove them — the backfill script and append logic look for them.

## Append rules

When a skill creates an artifact, it inserts a new line **immediately after** the matching `:start` marker (so newest entries are on top within each section).

Examples:

- `modeling` writes `board/auth/backlog/auth-003-password-reset.md` → inserts under `<!-- backlog-list:start -->` in `board/auth/INDEX.md` (the task half). Also increments the Backlog count under `<!-- task-counts:start -->`.
- `work` writes `knowledge/decisions/0014-postgres-billing.md` with `scope: billing` → inserts under `<!-- adr-local:start -->` in `knowledge/contexts/billing/INDEX.md` (the knowledge half). If `scope: global`, inserts under `<!-- adr-global:start -->` in `knowledge/index.md` instead.
- `research` writes `knowledge/research/auth-tokens-2026-05-13.md` with `related_tasks: [auth-007]` → inserts under `<!-- research-local:start -->` in `knowledge/contexts/auth/INDEX.md`. If the report's `related_tasks` spans multiple BCs (or none yet), inserts under `<!-- research-global:start -->` in `knowledge/index.md`.

## When the index file doesn't exist yet

Create it from this template before appending. Each skill should do this lazily — the first
global artifact creates `knowledge/index.md`. For a BC's own `INDEX.md` halves, see
`references/task-index-template.md` and `references/knowledge-index-template.md`.
