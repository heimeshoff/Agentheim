---
id: agentic-workflow-gvcy8
title: Exempt the design-system styleguide source (.agentheim/knowledge/contexts/design-system/styleguide/) from the worker bookkeeping-path guard — it is source code, not bookkeeping
status: todo
type: bug
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: [design-system-kw15t]
tags: [worktree, checkpoint-guard, styleguide, two-root-layout]
related_adrs: [ADR-0057, ADR-0074, ADR-0078, ADR-0003]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-q7v3k, agentic-workflow-g5ez5]
---

## Why
Two shipped rules collide:
- **ADR-0078** (the two-root layout migration, 2026-09-11) moved the design-system **styleguide
  source code** to `.agentheim/knowledge/contexts/design-system/styleguide/`. That directory holds
  `app/*.js` (incl. the `Markdown` primitive), `styles/`, `index.html` and `test/`.
  `dashboard/build.mjs` bundles it from there via `styleguideDir()` (ADR-0003: the styleguide is
  the single source of UI truth).
- **agentic-workflow-ghcaj / ADR-0074** made a worker's branch code-only. The checkpoint guard
  (`lib/derived-artifact-guard.mjs`, `BOOKKEEPING_PATH_PREFIXES = ['.agentheim/']`) silently
  refuses every `.agentheim/` path with reason `bookkeeping-path`, and `agents/worker.md` forbids
  any write under `.agentheim/`.

Result: no worker can change the styleguide. Its edits are dropped at checkpoint, so the task
either fails verification or "succeeds" without its UI change. No styleguide source has changed
since the migration, so this is latent. design-system-kw15t (mermaid rendering in the `Markdown`
primitive) is the first task to hit it.

Builder decision (2026-11-03): exempt the styleguide subtree, rather than move the styleguide out
of `.agentheim/`.

## What
- `lib/derived-artifact-guard.mjs`: add a narrow, named allow-list carve-out from
  `BOOKKEEPING_PATH_PREFIXES`. For example, `SOURCE_UNDER_AGENTHEIM_PREFIXES =
  ['.agentheim/knowledge/contexts/design-system/styleguide/']` is checked before the bookkeeping
  refusal, so those paths stage like ordinary source.
  - Derive the prefix from `lib/task-system-paths.mjs`'s `styleguideDir()` (the board layout) if
    practical, rather than a second hard-coded literal, so the two cannot drift.
  - Everything else under `.agentheim/` stays refused exactly as today.
- Doctrine surfaces that state "never write under `.agentheim/`" gain the one carve-out, stated
  once canonically and pointed to from the others (ADR-0068):
  - `agents/worker.md`
  - the worker rules in `skills/work/SKILL.md` (Subagent Prompt Template rule 10 and the checkpoint
    paragraph)
  - `references/worker-return-format.md` (FILE_LIST "never a .agentheim/ path")
  - `agents/verifier.md` (its no-`.agentheim/`-paths scope check)
  - `references/lib-bootstrap.md` if it restates the rule
- The merge-conflict ladder's rung 2 (`skills/work/SKILL.md`, "clean the worktree of derived
  churn") must not `checkout --` styleguide source as if it were bookkeeping. Align it with the
  guard.
- Record the decision as an ADR amending ADR-0074 (and noting ADR-0078). The worker reports it in
  its ADRS block; the conductor finalizes the number.

## Acceptance criteria
- [ ] `filterCheckpointPaths` (or the guard's equivalent export) stages a path under `.agentheim/knowledge/contexts/design-system/styleguide/` (e.g. `app/primitives.js`, `styles/agentheim.css`, `index.html`) and still refuses `.agentheim/board/**`, `.agentheim/knowledge/decisions/**`, the design-system README, and a sibling path such as `.agentheim/knowledge/contexts/design-system/README.md` with `bookkeeping-path` (`node --test`).
- [ ] The real CLI path `node lib/task-lifecycle-cli.mjs checkpoint <id> <json>` (run with cwd in a fixture worktree) returns a styleguide path in `changed`, not in `refused` (test).
- [ ] The carve-out prefix is not a second hand-maintained copy of the styleguide location. A test asserts it equals the board-layout `styleguideDir()` relative path, so moving the styleguide breaks the test.
- [ ] Every doctrine surface listed in What states the carve-out, or points at its single canonical statement. A live-tree lint/test pins the canonical sentence and fails if `agents/worker.md` or `skills/work/SKILL.md` loses the pointer (ADR-0059 enforcement).
- [ ] The verifier's scope check no longer FAILs a diff solely because it touches styleguide source; any other `.agentheim/` path in a diff still fails it.
- [ ] Merge-ladder rung 2 prose no longer lists styleguide source among the paths it reverts.
- [ ] `node --test lib/test/*.test.mjs` shows no new failures. The pre-existing "real checkpoint invocation" failure may stay; if the fix happens to repair it, say so in the Outcome.

## Notes
- Scope is deliberately narrow: only the styleguide subtree, the one place ADR-0078 put real code
  under `.agentheim/`. If other source-under-`.agentheim/` cases exist, list them in the Outcome as
  follow-ups rather than widening the carve-out.
- Workers still never write task files, READMEs, ADRs, INDEXes or protocol. ghcaj's report-carried
  bookkeeping model is unchanged.
- Found while preparing design-system-kw15t, which now depends on this task.
