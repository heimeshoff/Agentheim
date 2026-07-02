---
id: infrastructure-e5t9c
title: Relocate skills/capture-workspace eval debris out of the plugin payload
status: todo
type: chore
context: infrastructure
created: 2026-07-02
completed:
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

- [ ] `skills/` contains only real, loadable skills.
- [ ] The plugin payload a consumer installs carries no eval fixtures, grading scripts, or review HTML.
- [ ] If kept, the eval workspace still runs from its new location under `evals/`.
- [ ] Plugin loads cleanly after the move (`/reload-plugins` smoke check).
