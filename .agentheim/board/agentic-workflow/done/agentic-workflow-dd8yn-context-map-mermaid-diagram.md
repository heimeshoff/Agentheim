---
id: agentic-workflow-dd8yn
title: context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it
status: done
type: feature
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: []
tags: [context-map, mermaid, diagram, brainstorm, strategic-modeler]
related_adrs: [ADR-0059, ADR-0068, ADR-0084]
related_research: []
prior_art: [agentic-workflow-060]
---

## Why
The builder wants to *see* the bounded contexts and their relationships at a glance on the
dashboard instead of reading prose only. Decided with the builder on 2026-11-03:
- The diagram is **authored in the file** as a ```` ```mermaid ```` fence. The dashboard does not
  derive it from prose. An authored fence also renders on GitHub and in VS Code.
- **Diagram + prose.** The diagram sits alongside the existing Contexts / Relationships prose and
  does not replace it.
- **Prose is the source of truth.** The diagram is a view of it. On conflict, the prose wins and
  the diagram gets fixed.
- **Only the strategic-modeler (and brainstorm, when it first writes the map) edits the
  diagram.** A worker's README_DELTA can only append bullets to a section
  (`lib/readme-delta.mjs`), so it cannot edit inside a fence. Workers keep reporting only the
  prose relationship. The strategic-modeler brings the diagram up to date the next time it
  touches the map, so the diagram may briefly lag the prose.
- **Backfill when next touched.** An existing prose-only `context-map.md` gets its diagram the
  next time the strategic-modeler updates that map. There is no migration step or command.
- **Enforcement: lint the doctrine surfaces** (ADR-0059). This repo has no `context-map.md` of its
  own, so a check over a real map would never run here. The lint guards the files that can
  actually drift: the template and the agent contracts.

## What
1. **Canonical notation — new `references/context-map-notation.md`.** This is the single home
   for the notation (ADR-0068). Other surfaces point at it and do not restate it. Content:
   - The diagram lives in a `## Diagram` section placed between `## Contexts` and
     `## Relationships`. It holds exactly one ```` ```mermaid ```` fence starting with
     `flowchart LR`.
   - **Nodes:** one per `### <Context>` heading under `## Contexts`. The node id is the context's
     kebab-case name, and the label is `"<Context name><br/><small>core|supporting|generic</small>"`.
   - **Classification styling is theme-neutral:** a `classDef` per class uses stroke width and
     dash only, never fill or stroke colours, so the dashboard's token theming
     (design-system-kw15t) controls colour. For example: `classDef core stroke-width:3px;`,
     `classDef supporting stroke-width:1px;`,
     `classDef generic stroke-width:1px,stroke-dasharray:4 3;`. Each node gets `:::core` /
     `:::supporting` / `:::generic`.
   - **Edges:** one per relationship in `## Relationships`. Directional edges point
     **upstream → downstream**. Edge labels use a fixed vocabulary:
     `customer-supplier` (`U -->|customer-supplier| D`), `conformist`, `ACL` (on the
     downstream side's edge, `U -->|ACL| D`), `OHS/PL`, `events` (publishes → subscribes, when no
     DDD label fits). Symmetric relationships use `<-->`: `partnership`, `shared kernel`.
     Separate-ways pairs get **no edge**.
   - One complete worked example (3–4 contexts covering most edge kinds).
   - The rules from the Why section: prose wins on conflict; only the strategic-modeler and
     brainstorm edit the diagram; existing maps get a diagram when next touched.
2. **`skills/brainstorm/SKILL.md` § "Producing context-map.md":** the template gains the
   `## Diagram` section with a short mermaid skeleton and a one-line pointer to
   `references/context-map-notation.md`. Brainstorm writes the diagram whenever it writes a
   context map.
3. **`agents/strategic-modeler.md`:** the context-discovery output and the "Suggested
   context-map.md changes" output include the diagram. The agent must (a) keep the diagram
   consistent with the Relationships prose on every map change, and (b) add a missing diagram
   (backfill) when it touches a prose-only map. Point at the notation reference rather than
   restating it.
4. **`agents/worker.md`** (the context-map `README_DELTA` bullet): one sentence saying workers
   never edit the `## Diagram` fence. They report the prose relationship only, and the
   strategic-modeler reconciles the diagram.
5. **Live-tree lint** in `lib/` plus a `node --test` file in `lib/test/` (following the shape of
   the existing doctrine lints, e.g. `doctrine-line-pointer`). It fails if any of these is true:
   - `references/context-map-notation.md` is missing, or has no ```` ```mermaid ```` example
     starting with `flowchart LR`.
   - brainstorm's context-map template has no `## Diagram` section containing a
     ```` ```mermaid ```` fence, or no pointer to `references/context-map-notation.md`.
   - `agents/strategic-modeler.md` does not mention the `## Diagram` section and does not point
     at `references/context-map-notation.md`.
   - `agents/worker.md` has lost its "never edit the diagram fence" sentence (anchor on a stable
     phrase the worker chooses and the test pins).

## Acceptance criteria
- [ ] `references/context-map-notation.md` exists and defines the section placement, node format, theme-neutral `classDef` per classification, the upstream→downstream edge direction, and the fixed edge-label vocabulary (including separate-ways = no edge). It has one complete mermaid example and states the prose-wins / modeler-only / backfill-when-next-touched rules.
- [ ] The notation's example contains no colour values (`fill`, `color`, or a colour in `stroke`). The lint asserts this.
- [ ] brainstorm's context-map template has a `## Diagram` section with a ```` ```mermaid ```` skeleton and points at the notation file without restating it.
- [ ] `agents/strategic-modeler.md` requires the diagram in its context-map outputs, requires keeping it consistent with the Relationships prose, and requires backfilling it when touching a prose-only map. It points at the notation file.
- [ ] `agents/worker.md` states workers never edit the `## Diagram` fence and report the prose relationship only.
- [ ] A live-tree `node --test` lint passes on the current tree and fails on a fixture or mutation for each guarded surface (missing notation file, template without a Diagram fence, strategic-modeler without the pointer, worker.md without the sentence).
- [ ] The whole `lib/` and `dashboard/` test suites still pass.

## Notes
- The convention check (ADR-0059) is satisfied by the enforcement criterion above (the lint).
  The lint is deliberately scoped to the doctrine surfaces, not to a real `context-map.md`,
  because this repo has none (single-BC note in `knowledge/index.md`).
- If a validator for a real `context-map.md` (one fence, a node per context) is wanted later,
  capture it as a follow-up. It is out of scope here.
- Independent of design-system-kw15t (dashboard rendering). The theme-neutral `classDef` choice
  exists so kw15t's token theming controls colour.
- Mermaid syntax notes for the worker: `<br/>` in quoted labels works in flowcharts, and edge
  labels with spaces need `|...|` (quotes optional). Validate the example against mermaid's
  flowchart grammar by eye, or with mermaid's parser if kw15t has already vendored it.

## Verifier note (iteration 1)

**REASONS:**
- Checks 1–3 pass. Every criterion maps to a diff artifact or a lint test, the new test file passes 8/8, and the full-suite failures are pre-existing or flaky (the checkpoint real-invocation test fails on main; the layout-migration lock test is flaky). The scope is clean and no `.agentheim/` paths were touched.
- Check 4/5 (ubiquitous language and README sync) FAILS. `README_DELTA` is `[]`, but the diff introduces a new BC convention/invariant and new vocabulary:
  - the context-map `## Diagram` (an authored mermaid fence; prose is the source of truth);
  - only the strategic-modeler and brainstorm edit the diagram; workers never edit the fence;
  - backfill when next touched;
  - the canonical `references/context-map-notation.md`;
  - a new mechanized live-tree lint, `lib/context-map-notation-lint.mjs`.

  The README records every comparable convention as a ubiquitous-language bullet naming its ADR and lint. Its "Test command" paragraph also lists the live-tree lints ("the three live-tree lints (human-eye-criteria, index-entry-length, spike-stop-loss)"). Both go stale on merge with an empty delta.
- Advisory: no ADR covers the authored-not-derived / prose-wins decision, which has a downstream consequence for design-system-kw15t. Consider a short ADR, or record why none is needed.

**SUGGESTED_FIX:** Report a `README_DELTA` for `.agentheim/knowledge/contexts/agentic-workflow/README.md` that does two things:
- Appends a ubiquitous-language bullet for the context-map diagram notation: the authored `## Diagram` mermaid fence, prose wins, modeler/brainstorm-only edits, workers never edit it, backfill when next touched, a pointer to `references/context-map-notation.md`, and enforcement by `lib/context-map-notation-lint.mjs` (ADR-0059, ADR-0068).
- Updates the Test command paragraph's list of live-tree lints (a `replace` op anchored on that paragraph if it is a bullet; otherwise an append that names the new lint).

Consider an ADR for the authored-not-derived, prose-wins decision.

**ITERATION_HINT:** likely-fixable

## Outcome

The context map carries an authored mermaid `## Diagram`. The notation is canonical in `references/context-map-notation.md` and enforced by `lib/context-map-notation-lint.mjs`, with 8 tests in `lib/test/context-map-notation-lint.test.mjs`. The strategic-modeler and brainstorm instructions own the fence, and `agents/worker.md` forbids workers from editing it. The authored-not-derived, prose-wins decision is recorded in ADR-0084, and the BC README is updated through a delta in iteration 2.
