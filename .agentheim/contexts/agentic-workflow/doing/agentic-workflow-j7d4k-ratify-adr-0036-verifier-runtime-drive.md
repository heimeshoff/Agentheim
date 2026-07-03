---
id: agentic-workflow-j7d4k
title: Ratify ADR-0036 — verifier runtime-drive end-to-end check
status: doing
type: decision
context: agentic-workflow
created: 2026-07-03
completed:
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
</content>
