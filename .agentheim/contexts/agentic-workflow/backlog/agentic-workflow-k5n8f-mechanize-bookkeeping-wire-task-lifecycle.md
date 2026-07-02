---
id: agentic-workflow-k5n8f
title: Mechanize the bookkeeping — wire lib/task-lifecycle.mjs and script the lifecycle operations
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, bookkeeping, task-lifecycle, scripts, index, protocol]
related_adrs: ["0007", "0026"]
related_research: []
prior_art: [agentic-workflow-003, agentic-workflow-078, agentic-workflow-080, agentic-workflow-063]
---

## Why

Two findings compound (harness audit 2026-07-02, confirmed defect #2 + the
single highest-leverage recommendation):

1. **`lib/task-lifecycle.mjs` is wired to nothing.** Its header says it's "owned
   by and used by the skills" — but no skill references it. The invariants it
   encodes and tests (legal-move policy, status-rewrite-plus-rename atomicity,
   mtime precondition, `depends_on` promote gate) live in dead code, while live
   enforcement is prompt prose re-stated across four skills. Worse, they
   disagree: `work/SKILL.md:25` treats a missing `depends_on` target as
   satisfied-with-warning; `dependencySatisfied()` (`lib/task-lifecycle.mjs:98`)
   returns false. Two sources of truth, opposite semantics.
2. **The main `work`/`modeling` context is a bookkeeping clerk.** Hand-edited
   INDEX marker lists and counts, line-4 protocol prepends, bidirectional
   ADR↔task backlink reconciliation, enumerated `git add` lists — roughly half
   of `work/SKILL.md` and a third of `modeling/SKILL.md` is mechanical text
   surgery. It burns orchestrator context and is the harness's largest error
   surface; `scripts/backfill-indexes.ps1` proves the indexes are regenerable,
   yet five skills maintain them incrementally by hand.

## What

Move the mechanical bookkeeping out of prompts into deterministic scripts,
starting by actually wiring the existing lib:

- `node scripts/complete-task.mjs <id>` — move + status rewrite + INDEX edit +
  protocol entry + backlink reconciliation + scoped `git add` + commit.
- Siblings for claim / promote / capture / dismiss.
- Skills shrink from hundreds of prompt lines of text-surgery instructions to
  "run the script"; the prose stays only as the human-readable contract.

## Acceptance criteria

- [ ] The missing-`depends_on`-target semantics divergence is resolved first: one decision, both sources (`work/SKILL.md`, `dependencySatisfied()`) agree.
- [ ] `lib/task-lifecycle.mjs` is invoked by at least the complete/promote paths — no longer dead code.
- [ ] Lifecycle scripts perform the INDEX marker edits, protocol prepend, backlink reconciliation, and scoped add/commit deterministically.
- [ ] `work/SKILL.md` and `modeling/SKILL.md` delegate those steps to the scripts; the removed prompt-prose is gone, not duplicated.
- [ ] Scripts are covered by `node --test` (extend the existing lib tests).

## Notes

The audit argues this attacks four findings at once: deletes the largest error
surface, reclaims the work/modeling context budget, makes the structural rules
mechanically unviolatable (resolving most of the missing-hooks gap), and
unblocks session-model downgrades. Open question to settle during refinement:
whether plugin-shipped scripts resolve reliably across consumer projects — the
`/dashboard` `$CLAUDE_PLUGIN_ROOT` failure (infrastructure-010) says path
resolution needs the same home-cache resolver treatment; reuse that pattern.
