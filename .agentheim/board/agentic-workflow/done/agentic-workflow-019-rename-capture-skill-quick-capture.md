---
id: agentic-workflow-019
title: Rename the `capture` skill to `quick-capture`
status: done
type: chore
context: agentic-workflow
created: 2026-06-14
completed: 2026-06-14
commit: df9792d
depends_on: []
blocks: []
tags: [skills, ubiquitous-language, rename]
related_adrs: []
related_research: []
prior_art: []
---

## Why
The dashboard's new backlog "Quick Capture" button (aw-020) launches the fast
idea-dump skill, and the builder wants that skill's name to match the button: the
invocation should read `/agentheim:quick-capture`, not `/agentheim:capture`.
"Quick Capture" is also the clearer ubiquitous-language name — it states the intent
(a quick jot) where bare "capture" is ambiguous against `modeling`'s own CAPTURE
action. This is a rename of an existing, working skill (`skills/capture/`), not a
new capability.

## What
Rename the `capture` skill to `quick-capture` end-to-end so the command resolves as
`/agentheim:quick-capture`, with no dangling references to the old name.

## Acceptance criteria
- [ ] The skill directory `skills/capture/` is renamed to `skills/quick-capture/` (git-tracked as a rename; the `evals/` subtree moves with it).
- [ ] `SKILL.md` frontmatter `name:` is `quick-capture`; the description/body text refer to the skill as "quick-capture" (trigger phrases like "quick capture", "jot this down", "capture this" stay — those are user phrasings, not the skill name).
- [ ] Cross-references to the old name are updated: `modeling`'s SKILL.md ("that's `capture`, not this" / handoff prose), `capture`'s own "Handoff to modeling" wiring, and any other skill or doc that names the `capture` skill or `/agentheim:capture`.
- [ ] Whatever registers the skill set (plugin manifest / marketplace entry, if the name is listed there rather than auto-discovered from the folder) lists `quick-capture`.
- [ ] Invoking `/agentheim:quick-capture` resolves to the renamed skill; the old `/agentheim:capture` no longer resolves (acceptable — this is a rename, not an alias).
- [ ] A grep for the standalone old skill name (`agentheim:capture`, `skills/capture`, the `name: capture` frontmatter) across the repo returns no stale hits. Do not blanket-rewrite the word "capture" — `modeling`'s CAPTURE action, the verb "capture", and `capture-workspace` eval artifacts are unrelated and must stay.

## Notes
- Scope boundary: this renames the **skill**, not the `modeling` skill's internal
  CAPTURE action and not the generic verb "capture" throughout the docs. Touch only
  references to the skill-as-named-capability.
- `skills/capture-workspace/` is eval/benchmark scratch for the capture skill — decide
  in work whether it travels with the rename or is left as-is (it's not user-facing).
- No ADR expected — a naming change to the ubiquitous language, not an architectural
  decision.

## Outcome
Renamed the `capture` skill to `quick-capture` end-to-end so the command resolves as
`/agentheim:quick-capture`.

- Skill directory moved `skills/capture/` → `skills/quick-capture/` (plain filesystem
  move; the `evals/` subtree travelled with it). Git will detect the rename when staged.
- `skills/quick-capture/SKILL.md` — frontmatter `name: capture` → `name: quick-capture`;
  the description's closing sentence, the `# Quick Capture` header, the "low-friction
  sibling" line, the "reached for" line, the "Quick-capture vs. modeling" heading + its
  bullet, the ambiguity default line, and the task-template "Captured via `quick-capture`"
  marker all updated to name the skill `quick-capture`.
- `skills/quick-capture/evals/evals.json` — `"skill_name": "capture"` → `"quick-capture"`.
- BC README "Key commands" — the entering-intent `Capture` → `Quick Capture` to match the
  renamed skill.

Scope held precisely: the `modeling` skill's internal CAPTURE action, the generic verb
"capture"/"captured", the user trigger phrases ("capture this", "quick capture", "jot this
down"), the protocol "Capture" event-type label, and the `capture-workspace/` eval scratch
were all left untouched — none names the skill-as-capability.

Registration: skills are auto-discovered from the `skills/` folder (the `.claude-plugin/`
`plugin.json` and `marketplace.json` do not list skills by name), and there is no explicit
slash-command file for the skill, so the folder rename alone makes `/agentheim:quick-capture`
resolve and retires `/agentheim:capture`. No manifest edit was needed.

Verification: a repo-wide grep for `agentheim:capture`, the `skills/capture` path, and the
`name: capture` frontmatter returns zero stale hits outside the intentionally-untouched
`capture-workspace/` eval scratch and the historical `repo-review-2026-06-10.md` /
`protocol.md`. No automated skill-naming test/lint exists in the repo.

Key files:
- `skills/quick-capture/SKILL.md`
- `skills/quick-capture/evals/evals.json`
- `.agentheim/contexts/agentic-workflow/README.md`

Unblocks aw-020 (dashboard "Quick Capture" launch button), whose invocation now reads
`/agentheim:quick-capture`.
</content>
