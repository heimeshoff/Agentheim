# Index

Top-level catalog of this project's bounded contexts, global decisions, and research.
For BC-scoped artifacts, see each BC's `INDEX.md`.

> Updated by: `modeling` (BC creation), `work` (global ADRs), `research` (reports tagged global / cross-BC), backfill script.
> Hand-edits are fine but the skills will append at the section markers below.

---

## Bounded contexts

<!-- bc-list:start -->
- **agentic-workflow** — running a domain-driven, human-in-the-loop agentic workflow on Claude Code; the single core context — `contexts/agentic-workflow/INDEX.md`
- **design-system** — frontend infrastructure: the styleguide and component patterns any UI-bearing feature must conform to (supporting) — `contexts/design-system/INDEX.md`
- **infrastructure** — globally-true tech/runtime concerns; currently scoped tightly to the dashboard web-server runtime & transport (supporting) — `contexts/infrastructure/INDEX.md`
<!-- bc-list:end -->

## Global ADRs (scope: global)

<!-- adr-global:start -->
<!-- adr-global:end -->

## Cross-BC research

Research reports relevant to more than one BC (or to the project as a whole). BC-specific
reports are listed in each BC's `INDEX.md`.

<!-- research-global:start -->
<!-- research-global:end -->

## Pointers

- Vision: `vision.md`
- Context map: `context-map.md` (not warranted — single-BC domain)
- Protocol (chronological log): `knowledge/protocol.md` — newest entries on top
- All ADRs: `knowledge/decisions/`
- All research: `knowledge/research/`
