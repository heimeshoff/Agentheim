---
id: agentic-workflow-069
title: Topbar "What's next" button fires the /agentheim:whats-next skill (replaces the interim raw prompt)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 2cad350
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, topbar, ui]
related_adrs: [0018, 0017, 0003]
related_research: []
prior_art: [agentic-workflow-064]
---

## Why
aw-064 shipped the topbar **What's next** button wired to an **interim raw
natural-language prompt** (`WHATS_NEXT_COMMAND`) because no skill backed it yet — the
placeholder "future process" was aw-031 ("Next-steps overview when work is done"). That
plan is now resolved a different way: a real `whats-next` skill was created directly
(commit 76b0e9c, `skills/whats-next/SKILL.md`), and aw-031 was **dismissed** (2026-06-17).
The button should now invoke the skill of the same name instead of pasting a raw prompt —
exactly the "one-line change" the code comment and BC README already anticipate.

## What
Swap `WHATS_NEXT_COMMAND` in `dashboard/app/modeling-command.js` from the interim raw
prompt string to the fully-qualified slash command `/agentheim:whats-next` — a bare
constant mirroring `WORK_COMMAND` (no `*CommandFor(prompt)` builder; What's next ignores
the prompt-bar textarea). Everything around it is unchanged: the button still launches
through the same `launchOrCopy` bridge path (clipboard fallback copies the same slash
command), keeps its placement between the gear and Work, its `sun` glyph, its
`skipPermissions` threading, no `onResult`, and its read-only contract. No UI or bridge
rework — only the constant (and the docs/tests/dist that name it) changes.

## Acceptance criteria
- [ ] `WHATS_NEXT_COMMAND` is `'/agentheim:whats-next'` (fully-qualified, like
      `WORK_COMMAND` / `STOP_DASHBOARD_COMMAND`), replacing the raw NL prompt string.
- [ ] The constant's doc comment is rewritten: it now names the real skill, drops the
      "interim raw natural-language prompt / no skill backs it yet / aw-031 future process"
      framing, and matches the bare-constant rationale used for `WORK_COMMAND`.
- [ ] The topbar **What's next** button launches `/agentheim:whats-next` via the existing
      `launchOrCopy` path; the bridge-absent fallback copies the same slash command.
      Button placement, glyph, `skipPermissions` threading, no `onResult`, and the
      read-only contract (ADR-0017) are all unchanged.
- [ ] Tests that assert `WHATS_NEXT_COMMAND`'s value and the topbar wiring are updated to
      the slash command (the `modeling-command` + topbar-right-align suites), and the full
      dashboard suite passes.
- [ ] `dashboard/dist/app.js` is rebuilt (esbuild) so the served app carries the change.
- [ ] The BC README's **What's next** descriptions (the *Shell layout* and *Topbar settings
      menu* / launch-command bullets) are updated to state the button fires
      `/agentheim:whats-next`, dropping the "interim raw prompt / no skill yet" language.

## Notes
- One-line swap by design: the `WHATS_NEXT_COMMAND` comment already says *"When aw-031
  lands a real skill (e.g. `/agentheim:whats-next`), a later one-line change swaps this
  constant to that invocation — no rework of the button's UI or bridge wiring."* This task
  is that change; aw-031 was dismissed because the skill was created directly instead.
- Skill reference: `skills/whats-next/SKILL.md`, invocation `/agentheim:whats-next`,
  read-only (reads vision / boards / protocol / open questions, recommends the next step,
  never moves or commits). It already lists the dashboard topbar "What's next" launch among
  its triggers, so the two halves meet once the constant points at it.
- Bridge/launch contract is unchanged (ADR-0018): the extension wraps a slash command the
  same way it wraps any prompt; the clipboard fallback pastes it into a running session.
- Frontend task → depends on the approved styleguide (`design-system-001`); styleguide
  consumed unforked (ADR-0003). Read-only over `.agentheim/` (ADR-0017).
- Prior art: aw-064 created the button and the interim constant.

## Outcome
The topbar **What's next** button now fires the real `whats-next` skill. `WHATS_NEXT_COMMAND`
in `dashboard/app/modeling-command.js` was swapped from the interim raw natural-language prompt
to the fully-qualified bare slash command `'/agentheim:whats-next'` (mirroring `WORK_COMMAND`),
and its doc comment was rewritten to name the real skill and drop the "interim / no skill yet /
aw-031" framing. The button's UI, glyph, placement, `skipPermissions` threading, no-`onResult`
read-only contract (ADR-0017), and the `launchOrCopy` bridge path (ADR-0018) are all unchanged —
the bridge wraps a slash command identically to any prompt, and the clipboard fallback copies the
same string. The `modeling-command` and `topbar-right-align` test assertions were updated to the
slash-command value/wiring; the full dashboard suite passes (542 tests). `dashboard/dist/app.js`
was rebuilt via esbuild so the served bundle carries the change. The BC README's two launch-command
descriptions (Shell layout / launchOrCopy source-of-truth) were updated accordingly.

Key files:
- `dashboard/app/modeling-command.js` — the `WHATS_NEXT_COMMAND` constant + rewritten doc comment
- `dashboard/dist/app.js` — rebuilt bundle
- `dashboard/test/modeling-command.test.mjs`, `dashboard/test/topbar-right-align.test.mjs` — updated assertions
- `.agentheim/contexts/agentic-workflow/README.md` — What's-next launch-command descriptions
