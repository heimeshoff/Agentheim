---
id: agentic-workflow-j7d4k
title: Ratify ADR-0036 — verifier runtime-drive end-to-end check
status: done
type: decision
context: agentic-workflow
created: 2026-07-03
completed: 2026-07-03
depends_on: []
blocks: [agentic-workflow-y8b4q]
tags: [harness-audit, verifier, verification, e2e, adr]
related_adrs: [0036, 0002, 0017, 0032]
related_research: []
prior_art: []
---

## Why

The end-to-end verification feature (y8b4q) rests on real, reversible decisions —
who drives the app, what "observing" means, how the trigger fires, where the
runtime-surface manifest lives, and how the drive behaves inside a per-worker
worktree. ADR-0036 was pre-written during the y8b4q refine to capture that design,
but it stands **proposed**: it changes the verifier's contract and the verification
doctrine, so it deserves the builder's explicit sign-off before any code moves. This
task is that gate (the ADR-0032 / k9t3w precedent — ratify the decision, then
implement it in the blocked feature task).

## What

Review ADR-0036 and either ratify it (`proposed` → `accepted`) or send it back with
changes. The three directional choices to confirm or overturn:

- **Verifier drives** (extend the verifier's ordered checks) rather than `work` or the
  worker driving.
- **Tiered observation** — a required stdlib HTTP floor, an opt-in capability-gated
  render tier — rather than HTTP-only or a mandatory headless browser.
- **Diff-path trigger** — an allowlist `surfacePaths` manifest per BC — rather than a
  modeler-set frontmatter flag or per-case verifier judgment.

Also settle the ADR's open questions: manifest home (BC README fenced block vs a
dedicated file), boot-timeout disposition (FAIL vs SKIP-with-note), and whether the
render tier — when present — asserts DOM state or a screenshot diff.

## Acceptance criteria

- [ ] ADR-0036's three directional decisions are each confirmed or overturned, with the ADR body updated to match if overturned.
- [ ] The manifest home and boot-timeout disposition are decided and written into the ADR.
- [ ] ADR-0036 status is moved to `accepted` (or the ADR is rewritten and the design in y8b4q re-synced to the new decision).
- [ ] `blocks: [agentic-workflow-y8b4q]` still holds — y8b4q is not worked until this ratifies.

## Notes

Output is the ratified ADR, not code. If ratification materially changes the design,
re-sync y8b4q's acceptance criteria before it is promoted. Pairs with the verifier
eval-harness task (agentic-workflow-v3h6p): once this check exists, the eval measures
whether the runtime drive actually catches planted UI/runtime defects.

## Outcome

ADR-0036 ratified: `status: proposed → accepted`. All three directional decisions
(verifier drives, tiered HTTP-floor + opt-in render observation, diff-path `surfacePaths`
allowlist trigger) confirmed as designed. Open questions settled in the ADR body: manifest
home = BC README `## Runtime surface` fenced block; boot timeout = FAIL (no grace path);
render-tier assertion shape (DOM vs screenshot) deferred to a follow-up ADR.

One factual staleness found during review and corrected (consulted `architect` directly,
single-specialist transport question under ADR-0002): the ADR's Context and Decision point
4 claimed the dashboard launcher binds "an ephemeral loopback port" — actually, ADR-0002's
infra-018/019 addenda changed it to a deterministic project-root-derived, last-good-sticky
port. Corrected the Context, Decision point 4, and the "Fixed port" alternative to state
the real requirement (port unique per worktree, read from the runfile — the dashboard's
existing per-root derivation + ladder already satisfies this via ADR-0032's distinct
worktree roots). Also corrected a mis-citation: `cwd: tmpdir()` is ADR-0004's decision
(verified live in `dashboard/launch.mjs`), not ADR-0002's; ADR-0004 added to `related_adrs`.

Because y8b4q's own acceptance criteria (AC #56) and Notes baked in the same stale
ephemeral-port claim as literal text, re-synced y8b4q per this task's explicit exception —
narrow edits only, no change to manifest shape or check behavior. `blocks:
[agentic-workflow-y8b4q]` held throughout; y8b4q was never worked before this ratified.

Key files: `.agentheim/knowledge/decisions/0036-verifier-runtime-drive-end-to-end-check.md`
(ratified), `.agentheim/contexts/agentic-workflow/backlog/agentic-workflow-y8b4q-end-to-end-verification-runtime-surface.md`
(re-synced).
</content>
