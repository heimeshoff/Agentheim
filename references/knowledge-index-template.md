# Knowledge-half index template

The knowledge half of a bounded context's per-BC index (ADR-0078): ADRs, research, and
concept synthesis pages scoped to this BC. Under the `board/` layout this file's rendering
becomes `.agentheim/knowledge/contexts/<bc>/INDEX.md`, filed beside the BC's `README.md` —
the durable, per-BC catalog. The task-status half (tasks by status) lives in a separate
file, see `references/task-index-template.md`.

Under the (transitional, `'legacy'`-layout) shape there is no separate knowledge-half file
on disk — the two halves are still the SAME `.agentheim/contexts/<bc>/INDEX.md`, rendered
from the LEGACY combined template kept in `references/index-template.md`'s "Per-BC (LEGACY
combined shape)" section. This file is read only once `lib/task-system-paths.mjs`'s
`detectLayout` resolves `'board'`.

`capture`'s empty-BC backfill never renders this half on its own — a BC's knowledge half is
created alongside its `README.md` by `modeling` / `brainstorm` (ADR-0078 §6: a BC exists
when its README does, a task-only folder with no README is a lint finding, not a BC).

## Per-BC (knowledge half): `.agentheim/knowledge/contexts/<bc>/INDEX.md`

BC-local knowledge catalog. `modeling` reads this to find prior art and related decisions;
`work` reads it before designing.

```markdown
# <BC name> — Index (knowledge)

Catalog of ADRs, research, and concept synthesis pages scoped to this bounded context.

> Updated by: `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).
> Hand-edits are fine but the skills will append at the section markers below.

---

## ADRs scoped to this BC

<!-- adr-local:start -->
- **NNNN** — <title> — <YYYY-MM-DD> — `../../decisions/NNNN-<slug>.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
- **<slug>** — <one-line topic> — <YYYY-MM-DD> — `../../research/<slug>-<date>.md`
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
- **<concept>** — <one-line description> — derived_from: [<ids>] — `concepts/<concept>.md`
<!-- concepts:end -->

## Pointers

- BC README (ubiquitous language, invariants): `README.md`
- Task board (tasks by status) for this BC: `../../../board/<bc-name>/INDEX.md`
```

The `<!-- name:start --> ... <!-- name:end -->` markers are how `index-add` locates where to
append. Do not remove them.

## Append rules

- `work` writes `knowledge/decisions/0014-postgres-billing.md` with `scope: billing` →
  inserts under `<!-- adr-local:start -->` in `knowledge/contexts/billing/INDEX.md`. If
  `scope: global`, inserts under `<!-- adr-global:start -->` in `knowledge/index.md` instead.
- `research` writes `knowledge/research/auth-tokens-2026-05-13.md` with
  `related_tasks: [auth-007]` → inserts under `<!-- research-local:start -->` in
  `knowledge/contexts/auth/INDEX.md`.

## When the index file doesn't exist yet

A BC's knowledge half is created alongside its `README.md`, never on its own — see
`modeling` / `brainstorm`.
