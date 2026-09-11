---
id: agentic-workflow-s7d3k
title: Single-source the duplicated doctrine into references/ files
status: done
type: refactor
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: []
blocks: []
tags: [harness-audit, doctrine-drift, skills, single-sourcing]
related_adrs: [0026, 0028]
related_research: []
prior_art: [agentic-workflow-f7k2d]
---

## Why

Copy-pasted doctrine drifts. The audit (harness-audit-2026-07-02, "Doctrine
single-sourcing: Weak") found the same rules restated verbatim across skills, and
one had *already* diverged in production — the `TESTS_*` return-format drift that
`agentic-workflow-f7k2d` had to fix. Restating a rule in N files is N places for
it to silently fall out of sync; the fix that stops the class of bug (not just the
one instance) is to give each rule exactly one home. `references/modes.md` already
proves the pattern works: one file, everything else points at it.

## What

Extract each duplicated doctrine block into a **repo-root `references/` file** and
replace the inline copies with a **one-line summary + a repo-relative pointer** —
the `modes.md` pattern, generalized. This is a **relocation, not a rewrite**: the
authoritative text moves, its meaning does not.

### Confirmed duplication inventory (the work to do)

| Doctrine block | Current definition sites | Consumer type |
|---|---|---|
| **ID grammar** (Crockford base32, `i l o u` excluded, leading letter) | `skills/brainstorm/SKILL.md`, `skills/modeling/SKILL.md`, `skills/quick-capture/SKILL.md` | skills |
| **Commit doctrine** (scoped `git add`, never `git add -A`, `[<task-id>]` trailer) | `skills/work/SKILL.md`, `skills/modeling/SKILL.md`, `skills/quick-capture/SKILL.md`, `skills/brainstorm/SKILL.md` | skills |
| **Worker return format** (`TESTS_*` fields the verifier gates on) | `agents/worker.md`, `agents/verifier.md`, `skills/work/SKILL.md` | agents + skill |

Proposed homes (following the established repo-root `references/` convention):
`references/id-grammar.md`, `references/commit-doctrine.md`,
`references/worker-return-format.md`. Canonical wording is lifted from the ADR of
record where one exists — ID grammar ⇢ ADR-0028 §1, commit doctrine ⇢ ADR-0026 —
so the `references/` file and its ADR agree.

## Acceptance criteria

- [ ] ID grammar, commit doctrine, and worker return format each have **exactly one**
      definition site, under repo-root `references/`.
- [ ] Every skill/agent that needs a block carries only a **one-line summary + a
      repo-relative pointer** to its `references/` file (the `modes.md` shape), so the
      skill still reads without the hop.
- [ ] A grep for each block's distinctive phrase (`Crockford base32`,
      `never \`git add -A\``, `TESTS_PASSED`) finds **one authoritative definition**;
      remaining hits are one-line summaries/pointers, not restatements.
- [ ] **No behavior change** — the worker still emits, and the verifier still gates on,
      the identical `TESTS_*` contract; ID generation and commit scoping are unchanged.
      (This is the load-bearing check: the relocation must not re-introduce the f7k2d drift.)

## Notes

- **Unblocked.** The Notes originally said "sequence after f7k2d (fix the live drift
  first, then single-source so it can't recur)". `agentic-workflow-f7k2d` is now
  **done**, so that gate is satisfied — this task is ready to schedule.
- **Path-resolution caveat — resolved by reusing the proven mechanism.** The question
  was whether agents can read `references/` across plugin installs. The answer: this
  task introduces no new resolution scheme. A repo-root `references/` dir already
  exists and is pointed at by repo-relative path from *both* a skill
  (`modeling/SKILL.md` → `references/modes.md`) **and** an agent
  (`agents/worker.md` → `references/concept-template.md`). This task reuses that exact
  convention. Whether plugin-install path-resolution works at all is a **pre-existing
  property of every current `references/` pointer** — out of scope here, shared with
  `agentic-workflow-k5n8f`'s script-path caveat. If it ever proves broken, it's a
  separate task that fixes it uniformly for `modes.md` and these files together.
- **Scoped as a single relocation task** (not split per block): identical mechanical
  method each time, no behavior change, so per-block splitting would add
  INDEX/protocol/commit ceremony without reducing risk.
- **Adjacency, not dependency, with `agentic-workflow-k5n8f`** (mechanize the
  bookkeeping): k5n8f may move some commit/lifecycle *mechanics* into scripts, which
  touches the same commit-doctrine prose. They don't block each other; whichever lands
  first, the other points at the single `references/commit-doctrine.md` rather than
  re-describing it. Worth doing s7d3k first so k5n8f's scripts can cite one source.
- **Modeling note:** kept in-house rather than routed through the orchestrator — this
  is harness-internal doctrine refactoring, not project-domain modeling, and the
  duplication inventory was verified directly against the skill/agent files.

## Outcome

Created three repo-root reference files and collapsed every duplicated definition site
in the inventory down to a one-line summary + repo-relative pointer, following the
`references/modes.md` pattern:

- `references/id-grammar.md` — the `<bc>-<token>` Crockford base32 grammar, ADR-0028 §1
  as the ADR of record. Callers: `skills/brainstorm/SKILL.md`, `skills/modeling/SKILL.md`,
  `skills/quick-capture/SKILL.md` (each `### ID convention` section now points here).
- `references/commit-doctrine.md` — scoped `git add` (mandatory, never `-A`/`.`),
  one-task-one-commit + trivial-squash carve-out, and the message/trailer convention
  table, ADR-0026 as the ADR of record. Callers: `skills/work/SKILL.md` (multiple sites:
  Git authority doctrine line, PASS/SKIP step 3, the SHA-not-written-back note, the
  trivial-squash section, end-of-run session-end commit, and both carry-over
  reconciliation bullets), `skills/modeling/SKILL.md` (`## Committing`, DISMISS step 8),
  `skills/quick-capture/SKILL.md` (`## Committing`, re-routing), `skills/brainstorm/SKILL.md`
  (`## Committing`).
- `references/worker-return-format.md` — the strict `RESULT: SUCCESS | BOUNCED | FAILED`
  block including the `TESTS_*` fields the verifier gates on. No ADR of record — this is
  the text `agents/worker.md`, `agents/verifier.md`, and `skills/work/SKILL.md`'s
  subagent-prompt template now all point at, replacing the second live copy that had
  already drifted once (`agentic-workflow-f7k2d`). `skills/work/SKILL.md`'s template
  explicitly instructs the conductor to paste this file's content into the spawn prompt
  at dispatch time (mirroring the existing "paste the ADR content here" pattern for
  pre-loaded ADRs), so a spawned worker still receives the full concrete format inline —
  no behavior change, only where the canonical text lives.

Verified via grep (AC 3): `Crockford base32` / the full id-tail regex now appear only in
`references/id-grammar.md`; the full `git add -A` rationale clause + trivial-squash
carve-out conditions appear only in `references/commit-doctrine.md` (remaining hits across
the four skills are bare "never `git add -A`" reminders with a pointer, not restated
rationale); the full `TESTS_PASSING: yes | no` return-block template appears only in
`references/worker-return-format.md` (the one incidental other hit,
`skills/test-driven-development/SKILL.md`, was outside this task's confirmed duplication
inventory and left untouched — a distinct description of what TDD requires the worker to
report, not a copy of the RESULT block itself).

No production code touched — pure doctrine/markdown relocation, TDD not applicable.

Key files: `references/id-grammar.md`, `references/commit-doctrine.md`,
`references/worker-return-format.md`, `skills/work/SKILL.md`, `skills/modeling/SKILL.md`,
`skills/quick-capture/SKILL.md`, `skills/brainstorm/SKILL.md`, `agents/worker.md`,
`agents/verifier.md`.
