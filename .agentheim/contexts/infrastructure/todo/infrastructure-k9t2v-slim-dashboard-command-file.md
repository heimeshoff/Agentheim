---
id: infrastructure-k9t2v
title: Slim `commands/dashboard.md` — one bootstrap instead of three pasted copies, and the `$CLAUDE_PLUGIN_ROOT` archaeology moved out to ADR-0002
status: todo
type: chore
context: infrastructure
created: 2026-09-11
completed:
depends_on: []
blocks: []
tags: [dashboard, commands, context-budget]
related_adrs: [0002]
related_research: []
prior_art: [infrastructure-008, infrastructure-009, infrastructure-010]
---

## Why

`/dashboard` is injected into context on every invocation. The file is currently
77 lines / 5,651 chars ≈ 1,450 tokens, and it earned that size by accretion:
infrastructure-008 and infrastructure-010 each appended their rationale rather
than replacing it.

Two concrete defects, independent of any token argument:

1. **The same ~900-char `node -e` bootstrap is pasted three times verbatim**
   (no-arg / `stop` / `status`), differing only in the trailing argument. A
   fourth fix to the resolver means editing three identical strings and hoping
   they stay identical — exactly the shape ADR-0068's drift rule is about.
2. **~40 lines are historical rationale** — why `${CLAUDE_PLUGIN_ROOT:-.}`
   collapsed to `.` in v0.8.3, why the homedir→cache→semver-max walk replaced
   it. That is ADR material. It belongs where a reader goes *looking* for it,
   not in a file the model re-reads on every launch.

The token saving is real but modest, and this task should not be sold as the
fix for the builder's 60k complaint — see Notes.

## What

Rewrite `commands/dashboard.md` down to the trigger and nothing else: the
frontmatter, one bootstrap invocation with `$ARGUMENTS` passed straight
through, and the two behavioural instructions the model actually needs
(detached launcher → report its output verbatim; do not poll or open anything).

Move the `$CLAUDE_PLUGIN_ROOT` history to ADR-0002 as an addendum (or to
`dashboard/README.md` if it reads better as operator documentation), and leave a
one-line pointer in the command.

Behaviour must be byte-identical for all three verbs. This is a prose and
duplication cut, not a change to how the launcher is found.

## Acceptance criteria

- [ ] `commands/dashboard.md` contains the `node -e` bootstrap **exactly once**, with the verb supplied via `$ARGUMENTS` (empty / `stop` / `status`).
- [ ] `commands/dashboard.md` is under 20 lines.
- [ ] All three verbs behave as before — the command-card invocation test seam from infrastructure-009 passes unchanged.
- [ ] The `$CLAUDE_PLUGIN_ROOT`-is-empty rationale is reachable from ADR-0002 (addendum) or `dashboard/README.md`, and the command carries a one-line pointer to it. No rationale is lost.
- [ ] A live-tree lint under `lib/test/` (run via `node --test lib/test/*.test.mjs`) asserts the bootstrap literal occurs exactly once in `commands/dashboard.md`, so re-duplication fails the suite.

## Notes

**Measured cost, so nobody re-litigates this from memory.** Transcript
`~/.claude/projects/C--src-heimeshoff-agentic-agentheim/5a60fda1-3f86-4846-a1ae-f64ee10c066e.jsonl`,
the builder's `/agentheim:dashboard` run:

| Turn | Input tokens | Breakdown |
|---|---|---|
| 1 — reads the command, fires Bash | 59,405 | 35,613 cache-read + 23,790 cache-write |
| 2 — reports the URL back | 60,000 | 59,403 cache-read + 594 write |

The command file is ~1,450 of that first turn — **~2.4%**. The remaining ~58k is
the Claude Code session baseline (tool schemas, MCP server tool lists, the skill
roster, CLAUDE.md, memory, git status), which any first prompt in that session
pays regardless of which command is typed. The second turn is structural: a tool
call always costs a follow-up turn.

So this task buys roughly 1.2k tokens per invocation and removes the
triple-duplication hazard. It does **not** turn 60k into 6k. Whether the command
should exist at all, given a zero-token CLI path, is infrastructure-r4mzp.

The `node --test` invocation needs the explicit glob form —
`node --test lib/test/*.test.mjs` — the bare-directory form finds nothing under
Node 25 on this box.
