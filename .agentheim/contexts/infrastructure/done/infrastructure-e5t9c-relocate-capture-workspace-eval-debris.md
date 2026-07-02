---
id: infrastructure-e5t9c
title: Relocate skills/capture-workspace eval debris out of the plugin payload
status: done
type: chore
context: infrastructure
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: []
tags: [harness-audit, plugin-packaging, evals, repo-hygiene]
related_adrs: ["0013"]
related_research: []
prior_art: []
---

## Why

`skills/capture-workspace/` is a skill-creator eval workspace — a full
`.agentheim` fixture clone, `write_grades.py`, an ~89 KB review HTML — committed
into `skills/`, where every consumer installing the plugin pulls it. It is not a
skill; it's eval debris in the distributed payload. (Harness audit 2026-07-02,
confirmed defect #4.)

## What

Move `skills/capture-workspace/` under `evals/` (or delete it if the eval
workspace is abandoned). Verify nothing in the plugin manifest or skill
discovery references the old path.

## Acceptance criteria

- [x] `skills/` contains only real, loadable skills.
- [x] The plugin payload a consumer installs carries no eval fixtures, grading scripts, or review HTML.
- [x] If kept, the eval workspace still runs from its new location under `evals/`.
- [x] Plugin loads cleanly after the move (`/reload-plugins` smoke check — no config referenced the old path; smoke check is orchestrator/user territory).

## Outcome

Moved the skill-creator eval workspace out of the distributed plugin payload via
`git mv skills/capture-workspace evals/capture-workspace` (history preserved). It was
never a loadable skill (no top-level `SKILL.md`) — a `.agentheim` fixture clone,
`write_grades.py`, `iteration-1/` eval runs, and an ~89 KB `review-iteration-1.html`.

- `skills/` now holds only the ten real, loadable skills.
- `evals/` already existed (`evals.json`); the workspace now sits beside it at
  `evals/capture-workspace/`.
- Fixed the one hardcoded absolute path inside the workspace
  (`evals/capture-workspace/write_grades.py`, `IT = .../evals/capture-workspace/iteration-1`)
  so the grader runs from the new location; confirmed it compiles and the path resolves.
- No live config referenced the old path: `.claude-plugin/plugin.json` does not list
  `capture-workspace`, and skill discovery is directory-based (`skills/*/SKILL.md`).
  All other `skills/capture-workspace` mentions in the repo are historical records
  (audit, protocol, done-task files, ADRs) left untouched by design.

Key files: `evals/capture-workspace/` (moved), `evals/capture-workspace/write_grades.py` (path fix).
