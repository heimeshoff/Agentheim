# Verifier catch-rate eval — 2026-07-04 full 9-fixture pass

Supersedes `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md` as
the dataset of record. Task `agentic-workflow-fq2j8`, finishing what
`agentic-workflow-v3h6p` built (the fixture set) and started measuring
(6 of 9 fixtures, 2026-07-03).

## Why a fresh full run, not just the 3 remaining fixtures

`agents/verifier.md` changed twice after the 2026-07-03 baseline was recorded:

1. Check 8 (runtime drive, ADR-0036) was added by `agentic-workflow-y8b4q`.
2. The ADR-0043 `Stop`/`SubagentStop` heartbeat hook was added by
   `agentic-workflow-m9w5c` (commit `edad0d5`, 2026-07-03 18:08).

Combining 2026-07-03's 6-fixture numbers with a fresh 3-fixture run would
mean scoring two different verifier definitions as if they were one dataset.
The builder chose to re-run all 9 fixtures x k=3 (27 spawns) in one sitting
against the current verifier, producing a single internally-consistent
dataset that also re-baselines the original 6 — over the cheaper "just run
the missing 3 and combine" option (~9 spawns).

## Method

Same runbook as v3h6p: `evals/verifier-catch-rate/README.md`'s spawn-prompt
template, built from each fixture's own `done/` task file, synthetic BC
README, `diff.patch`, `worker-success.txt`, and `meta.json`'s
`test_command`/`launch_command`. `launch_command` is `"none"` for every
fixture (no fixture declares a `## Runtime surface` manifest per ADR-0036),
so check 8 never fired in this pass — that gap is `agentic-workflow-hz9m3`,
out of scope here.

Each of the 9 fixtures was run k = 3 times, fresh independent spawn each
time. Before committing to the full 24-run remainder, a single scout run was
made per previously-unmeasured fixture (`stale-readme`, `missing-adr`,
`contradicts-adr`) specifically to check a real risk: check 4 (ubiquitous
language) is ordered *before* checks 5, 6, and 6b in `agents/verifier.md`,
and all three of those fixtures' planted defects involve a color-representation
change that also reads as a check-4 violation on its face. If the verifier
strictly stopped at the first ordinally-failing check, it would report check
4 for all three and never reach the intended planted check — a genuine
fixture-design flaw requiring correction, the same class of issue v3h6p's
`clean` v1→v2 fix addressed. The scouts (and all 8 subsequent runs across
these 3 fixtures) showed this did not happen: the verifier's REASONS blocks
consistently named the specific planted check (sometimes as the lead reason,
sometimes as one of several cited together), so no fixture correction was
needed this pass.

## Results

Full table: `evals/verifier-catch-rate/results/2026-07-04-run.md`.

**Totals (27 scored runs, 9 fixtures):**
- **Catch rate** (8 defect fixtures x 3 = 24 runs): **24/24 = 100%**
- **Right-reason rate**: **24/24 = 100%** — zero lucky catches, zero misses
- **False-FAIL rate** (`clean`): **0/3 = 0%**
- **Per-fixture verdict variance**: **0** across all 9 fixtures — every
  fixture's `VERDICT` was unanimous across its 3 runs, and every FAIL
  unanimously cited its planted check.

This re-baselines the original 6 fixtures (`missing-ac`, `tests-fail`,
`scope-creep`, `vocab-violation`, `index-tampering`, `clean`) against the
current verifier — they scored identically to the 2026-07-03 pass (100%
catch, 100% right-reason, 0% false-FAIL) — and lands the 3 fixtures that were
previously fixture-ready but unmeasured, all landing their intended planted
check on every run:

- `stale-readme` → FAIL, check 5 cited every run (alongside check 4, since
  the new `WidgetRepainted` event is both a new term and a stale-README
  fact).
- `missing-adr` → FAIL, check 6 cited every run (alongside check 4/5, since
  the undocumented hex-color decision is also a README contradiction).
- `contradicts-adr` → FAIL, check 6b (or its substantive equivalent — see
  the results file's note on run 2's unlabeled-but-substantively-matching
  reasoning) cited every run.

## What this run teaches

**The verifier does not necessarily short-circuit at the first check that
happens to apply superficially.** Three fixtures had a genuine risk of a
"lucky but wrong" FAIL — citing check 4 instead of the intentionally-planted
check 5/6/6b — because the check list in `agents/verifier.md` runs checks in
a fixed order and check 4 precedes the later ones. Across all 8 runs on
these 3 fixtures, the verifier's REASONS block always surfaced the
specifically-intended check, either as the lead reason or alongside others.
This is a positive finding about the verifier's robustness, not a discovered
weakness — no follow-up capture against the verifier itself is warranted
from this observation.

**No verifier-prompt weakness was exposed this pass.** No follow-up backlog
item was filed against `agents/verifier.md` as a result of this run.

## Continuity note

This task's execution spanned a worktree continuation: the 27-run matrix and
this report's body were produced in an earlier pass within the same task
worktree, then finishing bookkeeping (this README's cross-links, the eval
README's "Known gaps" section, and the 2026-07-03 results file's "not run"
section) was completed afterward. Before relying on the earlier pass's
numbers, 2 additional confirmatory spawns were real-run against the current
`agents/verifier.md` — one against `contradicts-adr` (reproduced FAIL, citing
the ADR-0001 raw-string contradiction, substantively matching check 6b) and
one against `clean` (reproduced PASS). Both matched the recorded dataset,
corroborating its provenance. These 2 spawns are confirmatory only and are
not counted in the 27-run matrix above.

## Follow-ups already tracked (unaffected by this pass)

- ~~Check 8 (runtime drive) has no fixture in this set~~ — closed by
  `agentic-workflow-hz9m3` (addendum below): three new fixtures
  (`runtime-clean`, `runtime-boot-fail`, `runtime-probe-mismatch`) now
  measure check 8 directly.
- Opus-vs-sonnet routing A/B on the verifier — `agentic-workflow-bx7k5`, which
  this full-9 pass is the baseline for.

## Cost

27 real opus-pinned verifier spawns, ~14-18k tokens each, ~15-70s wall time
per spawn. No spawns were discarded to a fixture correction (contrast
v3h6p's 3 discarded `clean` v1 runs).

## Addendum (`agentic-workflow-hz9m3`, same date): check 8 (runtime drive, ADR-0036) measured

The 27-run matrix above ran with every fixture declaring
`meta.json.launch_command: "none"` — no fixture had a `## Runtime surface`
manifest, so check 8 (the newest, final, most expensive check) never fired
anywhere in this eval. This addendum closes that gap with three **new**,
additive fixtures (the existing 9 and their recorded numbers above are
untouched):

- `runtime-clean` — a genuine stdlib-only HTTP server (`GET /healthz`, `GET
  /widgets`) that boots via `src/launch.js` (true ephemeral `:0` bind,
  actual port read back from `.tmp/runtime.json`, per ADR-0036 pt 4's
  recommended stronger isolation), with both probes matching the manifest.
  Expected/observed: PASS, 3/3.
- `runtime-boot-fail` — `src/serve.js` (the detached boot entrypoint) calls
  `warmCache()`, a function `src/server.js` never exports; the child throws
  synchronously before `server.listen()`, so no runfile is ever written.
  `src/launch.js`'s wait loop times out deterministically (~4s) and reports
  the boot failure with a nonzero exit; no probe is attempted. The unit
  suite passes regardless (it imports `server.js` directly and never
  exercises the boot path), so only the live drive exposes the defect.
  Expected/observed: FAIL citing the boot/runfile timeout, 3/3, right-reason
  3/3.
- `runtime-probe-mismatch` — the server boots cleanly, but the `/widgets`
  route hand-rolls a stale singular response (`{ widget: <first> }`) instead
  of calling the correct, unit-tested `buildWidgetsPayload()` helper
  (`{ widgets: [...] }`). No test drives `/widgets` over real HTTP, so
  `node --test` passes 2/2 and the acceptance criterion reads as met on
  paper. Only the check-8 HTTP-floor probe exposes the shape mismatch (`200`
  observed vs. `200` expected — status matches, body shape does not).
  Expected/observed: FAIL citing the `/widgets` probe's expected-vs-observed
  body, 3/3, right-reason 3/3.

**Totals for the addendum (9 further scored runs, 3 fixtures):** catch rate
6/6 = 100% (defect fixtures only), right-reason rate 6/6 = 100%, false-FAIL
rate (`runtime-clean`) 0/3 = 0%, verdict variance 0. No fixture required
correction against its `expected.json` — unlike v3h6p's `clean` v1→v2 fix,
every run matched its prediction on the first pass, so nothing was
discarded or re-run. Teardown (`stop`) was confirmed clean on every run,
including after `runtime-boot-fail`'s boot failure and
`runtime-probe-mismatch`'s probe mismatch, satisfying ADR-0036 pt 3's
unconditional-teardown requirement.

**Combined dataset of record for this BC: 36 scored real verifier spawns
across 12 fixtures** — catch rate 30/30 = 100%, right-reason rate 30/30 =
100%, false-FAIL rate 0/6 = 0%, verdict variance 0 across all 12 fixtures.
Full table: `evals/verifier-catch-rate/results/2026-07-04-run.md`'s
addendum section.

**What this teaches, specific to check 8:** the two realistic defect shapes
this addendum planted — a boot-time wiring bug invisible to unit tests
because they import the module directly rather than exercising the actual
process entrypoint, and a route-handler bug invisible to unit tests because
they cover the underlying helper function but never drive the route itself
over real HTTP — are exactly the class of gap ADR-0036 was written to close.
Both were caught, with the correct reason, on every single real spawn. No
verifier-prompt weakness was exposed; no new follow-up capture is warranted
against `agents/verifier.md` from this addendum.

**Cost (addendum):** 9 further real opus-pinned verifier spawns
(~18-20k tokens each, ~44-70s wall time per spawn — check 8's boot+probe+
teardown cycle is visibly more expensive than checks 1-7 alone, consistent
with ADR-0036 pt 3 placing it last as "the most expensive check"). No spawns
discarded to a fixture correction.

## Addendum (`agentic-workflow-n7q4d`, same date): the corpus hardened — a real opus miss found

The 36 scored runs above (12 fixtures, `fq2j8` + `hz9m3`) landed **zero
variance across every fixture** — including the three judgment checks
(`stale-readme`/5, `missing-adr`/6, `contradicts-adr`/6b) that were supposed
to be where a model-tier gap surfaces. That ceiling meant the planned
opus-vs-sonnet A/B (`agentic-workflow-bx7k5`) had no discriminating corpus to
run against — it would most likely land "both ~100%, inconclusive." This
task hardens the corpus before spending the sonnet arm. Full detail,
per-fixture opus baseline, and the retention reasoning for each fixture:
`evals/verifier-catch-rate/results/2026-07-04-hardened-run.md`. Summary:

- **Four new fixtures**, each targeting a judgment check (5, 6, 6b) or a
  harder check-8 shape, k=3 real opus-pinned spawns each (12 scored + 9
  discarded/rework spawns for `missing-adr-borderline`, 21 total).
- **`stale-readme-partial`** (check 5, partial README sync — `BC_README_UPDATED: yes`
  is literally true but only one of two relevant README sections was
  refreshed): FAIL 3/3, right-reason 3/3, zero variance. Ceilings opus;
  retained on an explicit argument (a weaker tier could plausibly stop at
  "README was touched" without checking which section).
- **`missing-adr-borderline`** (check 6, a `PaintHistory`-truncation decision
  with a documented downstream-analytics consequence, narrated in the task's
  own `## Why`/`## What` rather than flagged by a code comment): **a genuine,
  reproducible opus MISS** — 0/6 catch across two independent k=3 batches
  (the first batch needed a rework: its README inherited an unrelated
  "Color... never as a raw string" mandate the fixture's own code violated,
  contaminating one run with a lucky wrong-reason catch; removing that
  confound and re-running produced a clean, unanimous 3/3 PASS, replicating
  the first batch's other 2/3). Opus consistently reasons the decision "is
  dictated by the task's own `## What`, not an independent worker choice, so
  no ADR is owed" — a reading check 6's text does not support (it asks only
  whether a decision needing "why?" lacks an ADR) and that this exact
  corpus's own sibling fixture (`missing-adr`, narrated identically in its own
  `## What`) was correctly FAILed for. This is the standout finding of the
  hardening pass: a real, articulable, reproducible judgment gap in the
  current opus-pinned verifier, not corpus noise — directly useful to
  `bx7k5`.
- **`contradicts-adr-partial`** (check 6b, ADR-0001 compliant in the primary
  `paint()` path, violated only in a secondary `paintOrFallback()` resilience
  method framed sympathetically in the task's own `## Why`): FAIL 3/3,
  right-reason 3/3 (all three additionally flagged `ITERATION_HINT:
  task-under-specified`, reasoning the acceptance criteria themselves bake in
  the contradiction — a sharper read than planted, still scored as a
  substantive check-6b catch). Ceilings opus; retained on an explicit
  argument (a shallower read that stops at "the primary command honors the
  ADR" is a real risk this fixture is built to expose).
- **`runtime-probe-subtle-mismatch`** (check 8, a nested per-item field-name
  mismatch — `color` declared, `colour` served — behind a top-level shape
  that is correct and, unlike the original `runtime-probe-mismatch`, a unit
  suite that genuinely drives `/widgets` over live HTTP): FAIL 3/3,
  right-reason 3/3, boot/probe/teardown clean on every run. Ceilings opus;
  retained on an explicit argument (a weaker tier could plausibly stop at
  "route is HTTP-tested, top-level shape matches"), and check 8's ground
  truth is additionally the most immune to any contested-ground concern —
  `color` vs `colour` is a textual, structural fact, not a judgment call.
- **Methodology tightened**: the eval README now carries a "what makes a
  valid tier-discriminator" note (hard AND unambiguous — never contested)
  addressing a conflation this task's own refinement caught: non-zero opus
  variance is a keep signal only *after* a fixture's ground truth is shown
  uncontested, since a fixture whose ground truth even opus can't settle would
  make a weaker tier's flip-flopping measure noise, not tier — a false
  vindication of the incumbent, worse than a false tie. None of the four new
  fixtures actually needed this clause in the end (all four resolved to
  defensible, uncontested ground truth once `missing-adr-borderline`'s
  authoring confound was removed) — but it governed how `missing-adr-borderline`'s
  v1 contaminated result was read and discarded rather than mistakenly kept.
- **Combined dataset of record: 54 scored real verifier spawns across 16
  fixtures.** `bx7k5`'s sonnet arm now has a same-set opus baseline with at
  least one demonstrated discriminating fixture (`missing-adr-borderline`)
  plus three ceiling-but-argued fixtures, rather than a corpus that opus
  saturates everywhere.
- **Cost:** 21 real opus-pinned verifier spawns (12 scored + 3 discarded + 6
  scored reconfirmation), ~16-25k tokens/spawn.
