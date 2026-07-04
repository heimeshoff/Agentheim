# verifier-catch-rate — 2026-07-04 hardened-corpus run (real `agentheim:verifier`, opus-pinned)

Task `agentic-workflow-n7q4d`, prerequisite to `agentic-workflow-bx7k5`.
All runs are **real** spawns of the live `agentheim:verifier` subagent
(`agents/verifier.md`, opus per ADR-0031) — no scripted reproduction. Each run
is an independent fresh-context spawn (no shared state between runs of the
same fixture, and no shared state with the `fq2j8`/`hz9m3` 2026-07-04 pass).

**Why this run exists:** `fq2j8`'s full 9-fixture opus baseline, plus
`hz9m3`'s 3 check-8 fixtures, landed **36/36 scored runs at zero variance**
across all 12 fixtures — a corpus that opus already ceilings, and so cannot
discriminate the opus-vs-sonnet A/B `bx7k5` needs. This run adds four new,
deliberately harder fixtures targeting the judgment checks (5, 6, 6b) and the
harder end of check 8, and records their opus baseline so `bx7k5` has a
same-set comparison surface with real discriminating potential.

## The four new fixtures (k = 3 each, 12 scored runs + 9 discarded/rework runs)

| Fixture | Planted defect (check) | Expected | Run 1 | Run 2 | Run 3 | Catch rate | Right-reason rate | Variance |
|---|---|---|---|---|---|---|---|---|
| `stale-readme-partial` | 5 — BC README sync (partial update) | FAIL / check 5 | FAIL (check 4+5) | FAIL (check 4+5) | FAIL (check 4+5) | 3/3 | 3/3 | none |
| `missing-adr-borderline` (v1, contaminated — discarded) | 6 — ADRs for decisions | FAIL / check 6 | FAIL (check 4, lucky/wrong-reason) | PASS | PASS | 0/3 | 0/3 | **3/3 disagreement, but contaminated (see below)** |
| `missing-adr-borderline` (v2, corrected — dataset of record) | 6 — ADRs for decisions | FAIL / check 6 | PASS | PASS | PASS | 0/3 | 0/3 | none — unanimous miss |
| `contradicts-adr-partial` | 6b — honored related ADRs (partial/secondary-path contradiction) | FAIL / check 6b | FAIL (check 6b) | FAIL (check 6b) | FAIL (check 6b) | 3/3 | 3/3 | none |
| `runtime-probe-subtle-mismatch` | 8 — runtime drive, nested-field probe mismatch | FAIL / check 8 | FAIL (check 8, `/widgets` nested `color`/`colour`) | FAIL (check 8, same) | FAIL (check 8, same) | 3/3 | 3/3 | none |

**`missing-adr-borderline` needed one rework cycle before it produced a clean
signal** — see "A fixture-authoring bug, not a discriminator" below. The v1
row is kept in this table for transparency but is **not** part of the scored
dataset of record; the v2 row (6 further scored runs across two independent
k=3 batches, all PASS) is.

### `missing-adr-borderline` — a fixture-authoring bug, not a discriminator (v1 → v2)

The first k=3 batch (v1) reused this corpus's stock synthetic-widgets README
boilerplate verbatim, including the line "**Color** — one of `red`, `blue`,
`green`, represented as the `Color` enum, never as a raw string." — but the
fixture's own `Widget.paint(color)` stores `color` as a raw string with no
enum validation (an authoring oversight, not the intended defect). Run 1
correctly caught this as a **real, but unintended** check-4 violation (lucky
catch, wrong reason relative to `expected.json`); runs 2 and 3 judged the
raw-string handling as "pre-existing scaffolding, orthogonal to this task"
and PASSed without ever reaching check 6. All three runs were contaminated —
none engaged with the actual planted defect (the undocumented `PaintHistory`
truncation decision) at all.

**Fix:** removed the enum-mandate sentence from this fixture's README
(`## Ubiquitous language` now reads simply "**Color** — one of `red`, `blue`,
`green`." with no enum-vs-string prescription), isolating the fixture to
check 6 alone. No other file changed. Re-ran a fresh k=3 (v2, `2026-07-04`,
same day) — see the table row above: **unanimous PASS, 3/3**, all three runs
reaching and explicitly reasoning about check 6, all three waiving the ADR
requirement because "the cap value and the silent-drop behavior are both
explicitly dictated by the task's own `## What`/`## Acceptance criteria` — a
task-author decision the worker implemented verbatim, not an independent
choice, so no ADR is owed."

**This reasoning is a genuine, reproducible miss, not a fixture-design
artifact — see the "What this run teaches" section below for why the
combined 6/6 PASS across two independent batches is being retained as a real
discriminator rather than reworked further.**

## Cost

12 scored real opus-pinned verifier spawns (the clean 4-fixture x k=3
matrix) + 3 discarded contaminated spawns (`missing-adr-borderline` v1,
superseded by v2's clean 3) + 6 confirmatory spawns (`missing-adr-borderline`
v2's two independent k=3 batches, both fully scored and both counted) = **21
total real opus-pinned verifier spawns** for this task, each doing a handful
of Read/Grep/Bash tool calls (~16-25k tokens/spawn depending on whether check
8's boot/probe/teardown cycle fired). Above the spike's original ~9-12
estimate because `missing-adr-borderline` needed a rework-and-reconfirm
cycle — the reconfirmation (a second independent k=3 batch, not just a
single scout re-run) was judged necessary given how consequential the
finding is for `bx7k5`.

## What this run teaches

**`missing-adr-borderline` is the standout finding: a genuine, reproducible
opus miss, not corpus noise.** Six independent scored runs across two
separate k=3 batches (0/6 catch) all reach the same wrong conclusion via the
same reasoning: when a task's own `## Why`/`## What` narrates the tradeoff
behind an embedded decision, opus treats that narration as substituting for
an ADR ("not an independent worker decision, so nothing to flag"). This
directly contradicts check 6's own text, which asks only whether "the diff
embeds a decision a future maintainer would ask 'why?' about" with "no ADR"
covering it — it draws no exception for a decision explained in the task
file's prose. It also contradicts this exact corpus's own precedent: the
original `missing-adr` fixture (`v3h6p`/`fq2j8`) narrates its decision
identically in its own `## What` ("a representational decision a future
maintainer would clearly ask 'why not keep the enum?' about") and was
correctly FAILed 3/3 for it. A task file is scoped and ephemeral (it moves to
`done/`); an ADR is the durable, project-wide-discoverable record `.agentheim/knowledge/decisions/`
and BC READMEs point future maintainers at — check 6 exists precisely because
the former does not substitute for the latter. Given that standard, and given
the corpus's own sibling fixture proves the standard is applied correctly
elsewhere, this fixture's ground truth is unambiguous: check 6 should fire,
and it unanimously does not. This is exactly the kind of judgment-density gap
ADR-0031 hypothesizes an opus verifier defends against and a weaker tier
would likely replicate or worsen — making it the single most valuable
fixture for `bx7k5`'s A/B.

**The other three fixtures ceiling at opus (zero variance, 3/3 right-reason
catch each) — retained anyway, each with an explicit, fixture-specific
argument for why a weaker tier could plausibly diverge even though opus did
not (see the eval README's "what makes a valid tier-discriminator" note for
the general principle):**

- `stale-readme-partial` — `BC_README_UPDATED: yes` is literally true and the
  README diff genuinely touches the Ubiquitous language section; only the
  Aggregates section's command list was left stale. A verifier relying on
  "was the README touched at all" as a shortcut would pass this; opus instead
  read the Aggregates section specifically. A weaker tier that pattern-matches
  on the presence of a README hunk is a real risk this fixture is built to
  expose.
- `contradicts-adr-partial` — the primary, most-scrutinized code path
  (`paint()`) is fully ADR-0001-compliant; the contradiction is confined to a
  secondary `paintOrFallback()` method framed sympathetically (pipeline
  resilience) in the task's own `## Why`. A shallower single-pass read that
  stops at "the primary command honors the ADR" is a real risk; opus read
  past the sympathetic framing to the ADR's literal "MUST always" text with no
  carve-out.
- `runtime-probe-subtle-mismatch` — unlike the original `runtime-probe-mismatch`
  (which shipped no HTTP-level test for `/widgets` at all), this fixture
  genuinely drives `/widgets` over real HTTP in its unit suite — the naive
  "is the route tested live" heuristic is satisfied. The defect only surfaces
  by comparing the manifest's declared **nested** field name (`color`) against
  the observed nested field name (`colour`), not top-level shape. A weaker
  tier that checks "route is HTTP-tested, top-level shape matches" and stops
  there is a real risk this fixture is built to expose. Ground truth here is
  additionally the most immune to any contested-ground concern: `color` vs
  `colour` is an objective, textual, structurally verifiable mismatch.

## Retention dispositions (against the task's hard-AND-unambiguous bar)

| Fixture | (a) Hard? | (b) Unambiguous? | Disposition |
|---|---|---|---|
| `stale-readme-partial` | Ceiling (0 variance, 3/3 right-reason) — retained on explicit-argument clause, not raw variance | Yes — Aggregates section factually omits a documented command | **Retain** |
| `missing-adr-borderline` | Yes — unanimous 6/6 miss across two independent batches, reproducible wrong reasoning | Yes — corpus's own sibling fixture (`missing-adr`) sets the precedent that task-file narration does not excuse an ADR | **Retain (standout)** |
| `contradicts-adr-partial` | Ceiling (0 variance, 3/3 right-reason) — retained on explicit-argument clause | Yes — ADR-0001's "MUST always" text carves out no fallback exception | **Retain** |
| `runtime-probe-subtle-mismatch` | Ceiling (0 variance, 3/3 right-reason) — retained on explicit-argument clause | Yes, objectively (`color` vs `colour` is textual, not a judgment call) | **Retain** |

All four fixtures are retained; none were dropped. `missing-adr-borderline`
required one rework cycle (README confound removed) before its signal became
attributable to check 6 rather than an authoring bug.

## Combined dataset of record (all 16 fixtures, all real opus-pinned spawns)

Adding this run's 12 scored + 6 scored (`missing-adr-borderline` v2's two
batches) = 18 further scored runs to the prior 36 (`fq2j8` + `hz9m3`):
**54 total scored real verifier spawns across 16 fixtures.** Aggregate catch
rate on defect fixtures: 12 fixtures caught (100% catch where caught applies)
+ `missing-adr-borderline`'s 0/6 — see the eval README's updated "Results"
section for the exact combined arithmetic, which intentionally reports
`missing-adr-borderline` separately rather than folding its 0% into a single
blended percentage, since averaging a designed-to-be-hard miss into a
ceiling-heavy aggregate would obscure the one number that actually matters
for `bx7k5`.
