---
id: agentic-workflow-dd8yn
title: context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it
status: backlog
type: feature
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: []
tags: [context-map, mermaid, diagram, brainstorm, strategic-modeler]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-060]
---

## Why
The builder wants to *see* the bounded contexts and their relationships at a glance on the
dashboard instead of reading prose only. Decided with the builder on 2026-11-03:
- The diagram is **authored in the file** as a ```` ```mermaid ```` fence. The dashboard does not
  derive it from prose. An authored fence also renders on GitHub and in VS Code.
- **Diagram + prose.** The diagram sits alongside the existing Contexts / Relationships prose and
  does not replace it. Agents read the prose (purpose, language, actors, the reasoning behind each
  relationship). The diagram shows the map's shape.

## What
- `skills/brainstorm/SKILL.md` § "Producing context-map.md": the template gains a
  `## Diagram` section with a ```` ```mermaid ```` `flowchart` (or `graph LR`). It has one node per
  context, labelled with its name and classification (core / supporting / generic), and one edge
  per relationship, labelled with its DDD pattern (customer-supplier U→D, ACL, OHS/PL, shared
  kernel, partnership, conformist). Separate-ways pairs get no edge.
- `agents/strategic-modeler.md`: context discovery and context impact analysis output includes
  the diagram, and keeps it in sync with the prose when contexts or relationships change.
- `agents/worker.md`: a worker's append-only context-map `README_DELTA` that adds a relationship
  also appends the matching edge. Alternatively, record that diagram edits are strategic-modeler
  only, which is a refinement call.
- Define a small, fixed notation (node shape per classification, edge label vocabulary) so maps
  look the same across projects.

## Acceptance criteria
- [ ] brainstorm's context-map template includes a `## Diagram` section with a mermaid example that follows the defined notation.
- [ ] strategic-modeler's output contract names the diagram and the rule that it stays consistent with the Relationships prose.
- [ ] The notation (classification → node style, DDD pattern → edge label) is written down in exactly one canonical place, and the other surfaces point at it rather than restating it (ADR-0068).
- [ ] Convention enforcement (ADR-0059): either a live-tree lint that fails when a `context-map.md` lacks a mermaid block, or when a context in `## Contexts` has no diagram node, **or** an explicit "prose-only, unenforced" marker recorded here. Decide in refinement.

## Notes
- This establishes a convention on doctrine-bearing surfaces (`skills/`, `agents/`), so it stays
  in backlog until the enforcement-or-marker choice above is made (ADR-0059).
- Rendering on the dashboard is design-system-kw15t. The two are independent.
- Existing consumer projects with a prose-only context-map: decide whether the
  strategic-modeler backfills a diagram the next time it touches the map (lazy), or whether that is
  never done. Agentheim's own repo has no context-map.md (single-BC note in index.md), so there is
  nothing to backfill here.
- Consider whether the diagram should be labelled as derived from the prose (prose wins on
  conflict). This mirrors how other generated/derived artifacts are guarded.
