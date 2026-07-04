---
id: agentic-workflow-fq2j8
title: Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier
status: todo
type: spike
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: [agentic-workflow-bx7k5]
tags: [harness-audit, verifier, evals]
related_adrs: [0031, 0036]
related_research: []
prior_art: [agentic-workflow-v3h6p]
---

## Why

`agentic-workflow-v3h6p` built the full 9-fixture `verifier-catch-rate` set
(`evals/verifier-catch-rate/fixtures/`) but real-spawned the verifier against
only 6 of them (missing-ac, tests-fail, scope-creep, vocab-violation,
index-tampering, clean) for spike time/spend reasons — 18 runs, 100%
right-reason catch rate, 0% false-FAIL. `stale-readme` (check 5), `missing-adr`
(check 6), and `contradicts-adr` (check 6b) are fully built (task file, diff,
worker-success, expected.json) but have never been run against the real verifier.

The whole-surface number is still unmeasured. Naively combining the 2026-07-03
six-fixture numbers with a fresh three-fixture run would be **apples-to-oranges**:
`agents/verifier.md` changed after that baseline (check 8 / runtime-drive added by
`agentic-workflow-y8b4q`; the ADR-0043 `Stop`/`SubagentStop` heartbeat hook added
by `agentic-workflow-m9w5c`, commit `edad0d5`, 2026-07-03 18:08). So the eval is
re-run **in full** — all 9 fixtures in one coherent pass against the *current*
verifier — giving a single internally-consistent dataset that also re-baselines
the original 6. (Builder call, 2026-07-04: full re-run over the cheaper 3-only
combine.)

## What

Spawn the real `agentheim:verifier` agent (opus-pinned per ADR-0031) against
**all 9 fixtures**, k = 3 runs each (27 fresh, independent spawns), following the
spawn-prompt runbook in `evals/verifier-catch-rate/README.md`. Score each run
(catch / lucky-catch / miss / false-FAIL) per that runbook, then report the
full-surface numbers — catch rate, right-reason rate, false-FAIL rate, per-fixture
verdict variance — across all 9 combined. Record the run in a new dated results
file and a dated eval report, superseding the 2026-07-03 partial.

## Acceptance criteria

- [ ] All 9 fixtures run 3× each against the real `agentheim:verifier` in one
      coherent pass (27 scored runs); every verdict (and cited check, for FAILs)
      recorded per run.
- [ ] The 3 previously-unmeasured fixtures land their planted checks:
      `stale-readme` → FAIL/check 5, `missing-adr` → FAIL/check 6,
      `contradicts-adr` → FAIL/check 6b (right-reason, not a lucky catch).
- [ ] Combined full-9 numbers reported: overall catch rate, right-reason vs
      lucky-catch rate, false-FAIL rate (on `clean`), and per-fixture verdict
      variance across the 3 runs.
- [ ] Any fixture not behaving as its `expected.json` predicts is corrected and
      re-run before being counted (mirroring the `clean`-fixture v1 correction in
      v3h6p) — a fixture-authoring bug is fixed, not scored as a verifier result.
- [ ] Results recorded in `evals/verifier-catch-rate/results/2026-07-04-run.md`
      plus a dated report `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`;
      the README "Known gaps" note and the 2026-07-03 results "not run" section are
      updated to point at the completed full pass, and a protocol entry is written.
- [ ] Any verifier-prompt weakness the run exposes becomes a follow-up capture
      (id noted in the report). This full pass is the baseline the opus-vs-sonnet
      A/B (`agentic-workflow-bx7k5`) builds on.

## Notes

- **Runbook.** `evals/verifier-catch-rate/README.md` — build each spawn prompt
  from the fixture's own files (task file in `.agentheim/contexts/widgets/done/`,
  the synthetic BC README, `diff.patch`, `worker-success.txt`, and `meta.json`'s
  `test_command` / `launch_command` / `iteration`). The fixture root *is* the
  worktree. `launch_command` is `"none"` for every fixture, so verifier check 8
  (runtime drive) never fires here — that gap is `agentic-workflow-hz9m3`, out of
  scope.
- **Scope decision (2026-07-04).** Builder chose re-run-all-9 (~27 opus-pinned
  spawns, ~12–15k tokens each per v3h6p's cost note) over the cheaper 3-only
  combine (~9 spawns) — buying a single internally-consistent dataset and a
  re-baseline against the current `agents/verifier.md`, not a cross-date splice.
- **Node gotcha.** The fixtures' `test_command` is bare `node --test` run from the
  fixture root (auto-discovers `test/`). The 2026-07-03 work session found the
  *directory-argument* form (`node --test <dir>`) errors on Node v25.2.0 while the
  glob form runs clean; the bare form should be unaffected, but if a fixture's test
  command errors on the harness's own Node, fall back to the glob form.
- Spike deliverable is the measurement and what it teaches — the durable artifacts
  are the recorded numbers, not new harness code.
