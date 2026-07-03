---
title: verifier-catch-rate eval — measuring the real verifier's catch rate against planted defects
date: 2026-07-03
scope: agentic-workflow
related_tasks: [agentic-workflow-v3h6p]
related_adrs: [0031]
---

# verifier-catch-rate eval — 2026-07-03

Spike `agentic-workflow-v3h6p`. The verifier gate is the load-bearing quality
mechanism in the harness — "wrong work is caught by structure, not luck" —
and until this pass it had zero measured performance. This eval builds a
repeatable, fixture-based harness that spawns the **real** `agentheim:verifier`
subagent (not a scripted reproduction) against hand-authored fixtures with
known planted defects, and scores its verdicts against ground truth.

## Headline numbers

Real spawns of the live, opus-pinned (ADR-0031) `agentheim:verifier` agent,
k = 3 runs per fixture, against 6 of the 9 built fixtures (the load-bearing
subset — see "What was not measured" below):

- **Catch rate**: 15/15 = **100%** (5 defect fixtures x 3 runs each)
- **Right-reason rate**: 15/15 = **100%** — every catch cited the check the
  defect was planted under; zero lucky catches
- **False-FAIL rate**: 0/3 = **0%** (on the corrected `clean` fixture)
- **Per-fixture verdict variance**: 0 across all 6 measured fixtures — every
  fixture's 3 runs agreed unanimously (verdict, and cited check for FAILs)

Full per-run table: `evals/verifier-catch-rate/results/2026-07-03-run.md`.

## Design

Four ratified design calls (task frontmatter, `## Notes`) constrained the
build: (1) spawn the real verifier, not a scripted stand-in — the gate *is*
an LLM, a deterministic reproduction measures the wrong thing; (2) aim for
the full 7-check surface (now effectively 8 checks as of ADR-0036, added the
same day), subset-with-logging acceptable; (3) score as a rate over k >= 3
runs, not a single boolean; (4) a catch only counts when `VERDICT: FAIL` AND
the reasons/hint name the planted check — a FAIL for the wrong reason is a
"lucky catch," tallied separately.

**Fixture shape.** Each `evals/verifier-catch-rate/fixtures/<name>/` doubles
as the "Worktree" a real verifier spawn receives: a synthetic `widgets`
bounded context (Widget aggregate, `paint(color)` command, `Color` /
`AlreadyPaintedError` in its Ubiquitous language) with the task file already
moved to `done/`, the actual post-diff `src/`/`test/` code (so `node --test`
gives a genuinely real pass/fail, never simulated), `diff.patch`, the
worker's strict `RESULT: SUCCESS` block, and `expected.json` ground truth.
This mirrors `agents/verifier.md`'s documented input tuple one-for-one
(task file, BC README, diff, worker SUCCESS block, pre-resolved test
command, pre-resolved launch command, iteration number) — the same shape
`g9s3w` and `f7k2d` established for the real spawn template in
`skills/work/SKILL.md`.

## Full fixture table (9 built; 6 real-measured this pass)

| Fixture | Planted defect | Check | Real-run this pass? |
|---|---|---|---|
| `missing-ac` | Implements 1 of 2 acceptance criteria | 1 — AC coverage | Yes — 3/3 right-reason catch |
| `tests-fail` | Added test genuinely fails; worker falsely claims `TESTS_PASSING: yes` | 2 — test execution | Yes — 3/3 right-reason catch |
| `scope-creep` | Diff touches an unrelated production file | 3 — scope discipline | Yes — 3/3 right-reason catch |
| `vocab-violation` | New domain term (`WidgetLacqueringStrategy`) absent from README | 4 — ubiquitous language | Yes — 3/3 right-reason catch |
| `stale-readme` | New domain event, `BC_README_UPDATED: no` | 5 — BC README sync | No — fixture built, unmeasured (`agentic-workflow-fq2j8`) |
| `missing-adr` | Embeds a representational "why not X" decision, no ADR | 6 — ADRs for decisions | No — fixture built, unmeasured (`agentic-workflow-fq2j8`) |
| `contradicts-adr` | Diff violates the task's own `related_adrs` decision | 6b — honored related ADRs | No — fixture built, unmeasured (`agentic-workflow-fq2j8`) |
| `index-tampering` | Diff modifies the BC's `INDEX.md` | 7 — no protocol/index tampering | Yes — 3/3 right-reason catch |
| `clean` | None (true negative) | — | Yes — 3/3 PASS (after a fixture correction, see below) |

**Check 8 (runtime drive, ADR-0036)** has no fixture at all — it needs a
`## Runtime surface` manifest + a real bootable HTTP server in the tuple,
which the synthetic `widgets` BC does not declare. Logged as out-of-scope
for this spike, not silently skipped — see `agentic-workflow-hz9m3` for the
follow-up.

## The one real finding: a fixture-authoring bug that exposed the verifier being read *literally*

The first version of `clean` used raw string literals (`'red'`, `'blue'`)
for `Widget.color`. Its own BC README defined `Color` as "represented as the
`Color` enum, **never as a raw string**." All 3 real verifier runs against
that version correctly `FAIL`ed under check 4 (ubiquitous language) — a
genuine, correct catch of an inconsistency I (the fixture author) introduced
by accident, not a false positive against clean code. Fixed by introducing
an actual `Color` enum (`Object.freeze({RED, BLUE, GREEN})`) and referencing
it from both the implementation and the tests; the corrected fixture then
came back `PASS` 3/3.

This is the eval's one substantive discovery: **the verifier enforces BC
README wording completely literally, down to representation-level clauses**,
not just named-concept presence. That is arguably correct per
`agents/verifier.md`'s "On being strict" section (fail-closed bias, false-FAIL
is cheap, false-PASS is expensive), so it is recorded as a **lesson for
fixture (and BC README) authors** — keep such constraints precise — rather
than a verifier-prompt defect. No follow-up capture was filed against
`agents/verifier.md` itself for this; the check performed exactly as its
own spec describes.

## What was not measured this pass, and why

- **`stale-readme`, `missing-adr`, `contradicts-adr`** — fully built
  (including `contradicts-adr`'s own `.agentheim/knowledge/decisions/0001-widget-color-enum.md`)
  but not real-spawned, purely for spike time/spend budget (18 real spawns +
  3 fixture-bug spawns already run; the full 9x3 matrix would have been 27).
  Follow-up: `agentic-workflow-fq2j8`.
- **Check 8 (runtime drive)** — no fixture built; needs a runtime surface.
  Follow-up: `agentic-workflow-hz9m3`.
- **Opus vs sonnet A/B** — ADR-0031 pins the verifier to opus by design
  (decorrelation from the sonnet-pinned worker). This eval's baseline is
  exactly what's needed to answer "does opus-on-the-gate earn its spend?" by
  re-running the same fixtures with the verifier pinned to sonnet. Not run
  this pass (a distinct experiment, not part of `v3h6p`'s scope). Follow-up:
  `agentic-workflow-bx7k5`.

## Verifier-prompt weaknesses exposed

None, in the measured subset — every one of the 5 defect fixtures was
caught for the right reason on all 3 runs, and the (corrected) clean fixture
never drew a false FAIL. This is itself a meaningful result: it is evidence
*against* the audit's founding worry ("nobody knows whether the verifier
actually catches planted defects") for the checks measured, on a small,
synthetic corpus. It is not evidence the verifier is flawless — a 100%
result on 18 runs across 5 defect types plus one clean fixture is a
promising floor, not a ceiling, and three checks (5, 6, 6b) plus all of
check 8 remain completely unmeasured. The three follow-up captures above
exist specifically to close that gap and to stress the model-routing
decision (ADR-0031) the same measurement now makes falsifiable.

## Artifacts

- `evals/verifier-catch-rate/fixtures/<name>/` — the 9 fixtures (task file,
  BC README, real code + tests, `diff.patch`, `worker-success.txt`,
  `meta.json`, `expected.json`)
- `evals/verifier-catch-rate/README.md` — the runbook (prompt-assembly
  template, scoring rules, known gaps)
- `evals/verifier-catch-rate/results/2026-07-03-run.md` — the full per-run
  table for this pass, including the `clean` v1→v2 correction
- Follow-up backlog items: `agentic-workflow-fq2j8` (remaining 3 fixtures),
  `agentic-workflow-hz9m3` (check-8 fixture), `agentic-workflow-bx7k5`
  (opus vs sonnet A/B)
