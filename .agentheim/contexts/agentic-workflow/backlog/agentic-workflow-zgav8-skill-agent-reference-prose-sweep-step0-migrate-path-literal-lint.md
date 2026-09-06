---
id: agentic-workflow-zgav8
title: Prose sweep for the two-root layout — every skill, agent, and reference spells `board/` and `knowledge/contexts/`, the five entry skills run `migrate` as "Before acting" step 0, and a permanent live-tree lint fails on any reappearing legacy path literal
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-e896r]
blocks: [agentic-workflow-tgr31]
tags: [layout, doctrine, skills, lint, upgrade]
related_adrs: [0078, 0059, 0068, 0074, 0075]
related_research: []
prior_art: [agentic-workflow-fn59c, agentic-workflow-r7dq3, agentic-workflow-ghcaj]
---

## Why

About 180 path mentions across `skills/`, `agents/`, and `references/` spell the old
layout (`skills/work/SKILL.md` 43, `skills/modeling/SKILL.md` 35,
`skills/brainstorm/SKILL.md` 32, `references/index-template.md` 19, then a tail). Once
cj54k and e896r land, code resolves both layouts but the prose still sends agents to
`contexts/<bc>/todo/`. This child moves the doctrine, wires the migration trigger
(ADR-0078 §4) into the skills that touch a project first, and ships the lint that keeps the
old paths from creeping back — bounded by an enumerated file list with a closure rule, the
shape that converged the ghcaj sweep on its next iteration.

## What

1. **Step 0 in five skills.** `modeling`, `quick-capture`, `work`, `brainstorm`, `research`
   gain, as the first item of "Before acting" (before any read of vision, index, protocol,
   or backlog): run `lib/task-lifecycle-cli.mjs migrate` via the usual bootstrap; on
   `noop:true` say nothing; on `ok:true` commit `changed` via `scoped-commit` with the
   manifest's message and tell the builder in one line what moved; on `mixed-layout` /
   `worktree-active` / `lock-timeout` stop and surface the reason. `work` runs it in
   Phase 1 before any batch claim.
2. **Path sweep** over the enumerated surface: `skills/{modeling,work,brainstorm,
   quick-capture,research,whats-next,inquire,dashboard}/SKILL.md`, `agents/{worker,
   verifier,strategic-modeler,tactical-modeler,orchestrator,architect,researcher}.md`,
   `references/{lib-bootstrap,commit-doctrine,bc-readme-template,index-template,
   task-index-template,knowledge-index-template,modes,id-grammar}.md`. Every
   `contexts/<bc>/<lifecycle>/`, `contexts/<bc>/INDEX.md`, `contexts/<bc>/README.md`,
   root `vision.md` / `context-map.md`, `knowledge/protocol` mention becomes its ADR-0078
   path. `brainstorm` writes new BC READMEs under `knowledge/contexts/<bc>/` and the
   knowledge-half INDEX beside them. Closure rule: the sweep is done when the lint below
   passes; a mention the lint exempts (a quoted historical example) is left verbatim.
3. **`references/index-template.md`** shrinks to a legacy-labelled pointer at the two
   templates cj54k created (deleted outright in g5ez5's closure).
4. **Permanent lint `lib/legacy-path-literal-lint.mjs`** (+ `lib/test/…test.mjs`, live
   tree): walks `lib/`, `dashboard/` (source, not `dist/`), `skills/`, `agents/`,
   `references/`, and every `.agentheim/knowledge/contexts/*/README.md` (after tgr31; the
   legacy README path before it) and fails on `.agentheim/contexts/`, `contexts/<bc>/INDEX.md`,
   `contexts/<bc>/<lifecycle>/`, `.agentheim/vision.md`, `.agentheim/context-map.md`,
   `knowledge/protocol`. Exempt: `.agentheim/board/protocol*`, `knowledge/decisions/`,
   `lib/layout-migration.mjs` and its tests, `lib/task-system-paths.mjs`'s legacy branch,
   and fixture builders under `lib/test/`. Exemptions are an enumerated list in the module.

Out of scope: dashboard files (hxq1g), running the migration on this repo (tgr31),
flipping legacy to refused (g5ez5 closure).

## Acceptance criteria

- [ ] `lib/test/legacy-path-literal-lint.test.mjs` fails on a fixture tree containing each
      forbidden literal once, and passes clean on the merged tree.
- [ ] A grep of the five entry skills shows the `migrate` invocation as the first
      numbered item of "Before acting" (and, in `work`, ahead of the first `claim`), each
      naming the four manifest outcomes and the `scoped-commit` step.
- [ ] Every file in the enumerated sweep list contains zero forbidden literals outside the
      lint's exemptions (the lint is the check; no separate hand count).
- [ ] `brainstorm`'s foundation step writes the BC README and knowledge-half INDEX under
      `knowledge/contexts/<bc>/` and lets `capture` create `board/<bc>/` — a fresh-project
      walk-through in the skill text names those paths and no `contexts/` path.
- [ ] `references/index-template.md` is a pointer of ≤ 15 lines naming the two templates
      and the word "legacy".
- [ ] `npm test` is green with this repo's `.agentheim/` still legacy (the lint's README
      walk uses `detectLayout` to find READMEs).

## Notes

- **ADR-0059 disposition:** the path-literal convention is enforced by
  `legacy-path-literal-lint`. The step-0 *ordering* ("migrate before any other read") is
  **prose-only, unenforced** — the same limitation ADR-0074 recorded for conductor
  sequencing; a skill's own step order cannot be linted.
- ADR-0068 (drift-twice): where a skill restates a path rule that also lives in
  `references/lib-bootstrap.md`, replace the restatement with a pointer rather than
  synchronizing a second copy.
- Largest child by file count; hand the worker the enumerated list up front (conductor
  gotcha from the ghcaj sweep).
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.
