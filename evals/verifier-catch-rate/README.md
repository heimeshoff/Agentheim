# verifier-catch-rate eval

Measures the **real** `agents/verifier.md` agent's catch rate against
hand-authored fixtures with known planted defects. Spike
`agentic-workflow-v3h6p`.

## Fixture shape

Each `fixtures/<name>/` directory doubles as the "Worktree" a verifier spawn
would receive, and carries the full verifier-input tuple:

- `.agentheim/contexts/widgets/README.md` — the (synthetic) BC README
- `.agentheim/contexts/widgets/done/<task-id>-*.md` — the task file, already
  moved to `done/` (post-worker state, as the verifier would see it)
- `src/`, `test/` — the actual post-diff code, so the pre-resolved test
  command genuinely passes or fails (no simulated test results)
- `diff.patch` — the diff to paste into the verifier's `## The diff to audit`
  section
- `worker-success.txt` — the worker's strict `RESULT: SUCCESS` block, verbatim
- `meta.json` — `test_command` (the pre-resolved command, run from the
  fixture root), `launch_command` (`"none"` for the original 9 fixtures — no
  fixture declares a `## Runtime surface`, so verifier check 8 never fires
  for them; the resolved manifest text for the 3 `runtime-*` fixtures, see
  below), `iteration`
- `expected.json` — ground truth: `verdict`, planted `check` id, a
  `planted_defect` description, and free-form `notes`

`contradicts-adr` additionally carries
`.agentheim/knowledge/decisions/0001-widget-color-enum.md`, the ADR the task's
`related_adrs: [0001]` frontmatter points at.

The three `runtime-clean` / `runtime-boot-fail` / `runtime-probe-mismatch`
fixtures (`agentic-workflow-hz9m3`) additionally carry a `## Runtime surface`
manifest in their BC README and a real, tiny, stdlib-only HTTP server under
`src/` (`server.js`, `serve.js`, `launch.js`) that the manifest's
`launch`/`stop`/`probes`/`runfile` tuple genuinely boots and drives — see
"Check-8 fixtures" under Results below.

## Running a fixture against the real verifier

For each fixture, spawn `Agent(subagent_type: "verifier", prompt: ...)` with a
prompt built the same way `skills/work/SKILL.md`'s **Verifier Prompt
Template** builds one:

```
## Your inputs
Task file: <fixture>/.agentheim/contexts/widgets/done/<task-file>.md
Bounded context: widgets
BC README: <fixture>/.agentheim/contexts/widgets/README.md
Worktree: <fixture>/                       <!-- fixture root IS the worktree -->
Iteration: 1 of max 3

## The worker's strict SUCCESS return
<paste worker-success.txt verbatim>

## The diff to audit
<paste diff.patch, optionally preceded by a --stat summary>

## Pre-resolved test command
<meta.json.test_command>   (run from the Worktree path above)

## Pre-resolved launch command
<meta.json.launch_command>  (always "none" in this fixture set)

## Project context (read on demand if needed)
- .agentheim/vision.md
- .agentheim/context-map.md (if exists)
- .agentheim/knowledge/decisions/ (ADRs)

## Your job
Follow the checks in agents/verifier.md, in order, stopping at the first
failing check. Return exactly one verdict block per your agent definition.

Do not use Write, Edit, or any git command. You are read-only.
```

Run each fixture **k = 3** times (fresh spawn each time — no shared context
between runs). Score:

- **Catch** — `VERDICT: FAIL` **and** the `REASONS` / `SUGGESTED_FIX` name the
  check the defect was planted under (compare free-text against
  `expected.json.check`'s description, not the literal check id string).
- **Lucky catch** — `VERDICT: FAIL` for a real but *different* reason than the
  planted defect (tallied separately, does not count toward catch rate).
- **Miss** — `VERDICT: PASS` (or `SKIP`) on a defect fixture.
- **False FAIL** — `VERDICT: FAIL` on the `clean` fixture (any reason).

## What makes a valid tier-discriminator (methodology)

A fixture earns its place in this corpus only if it is **both**:

- **(a) Hard** — it strains the pinned model on reasoning depth: a miss, a
  lucky/wrong-reason catch, or a flip-flop across k runs. A fixture the model
  unanimously right-reason catches at zero variance teaches nothing about a
  weaker tier on its own — it is corpus-limited (the model is already at
  ceiling on it). It may still be kept, but only with an **explicit,
  fixture-specific argument** for why a weaker tier could plausibly diverge
  even though the pinned model did not (e.g. "the naive shortcut a weaker
  tier might take — checking X — is satisfied here, so only a deeper read of
  Y catches it").
- **(b) Unambiguous** — the planted defect is one a fair reader agrees is
  genuinely there, not a contested FAIL/PASS call.

**Non-zero verdict variance across k runs is a keep signal only *after*
ground truth is shown uncontested — never on its own.** A fixture can produce
variance for two structurally different reasons: the model is near its
reasoning ceiling on a fixture with **one correct answer** (a real
discriminator — a weaker tier would likely do worse), or the fixture's
**ground truth is itself genuinely contested**, in which case even the
strongest pinned model can't settle it, and a weaker tier's flip-flopping on
the same fixture measures noise, not tier. Retaining the second kind is
*worse* than a false tie: it lets an A/B read "opus 2/3, sonnet 1/3" as
vindicating a judgment-density hypothesis when both tiers are merely guessing
with different bias — a false vindication of the incumbent on noise, not a
genuine tier signal. Concretely: before treating any variance as a retain
signal, show the ground truth is uncontested (ideally by anchoring the
fixture's expected verdict against an established precedent elsewhere in the
corpus, the way `agentic-workflow-n7q4d`'s `missing-adr-borderline` fixture
was checked against the original `missing-adr` fixture's identical narration
pattern).

**Objective, structurally-verifiable ground truth (e.g. check 8's declared
vs. observed body shape — a textual/structural fact, not a judgment call) is
inherently immune to the contested-ground trap and can be hardened freely.**
The judgment checks (5 BC-README-sync, 6 ADRs-for-decisions, 6b
honored-related-ADRs) are exactly where "genuinely borderline" can shade into
"genuinely contested" — author and evaluate those with this gate explicitly
in mind; borderline ADR-worthiness (or README-staleness, or
ADR-honoring) must still resolve to a defensible right answer, not a
coin-flip, before any variance on it is trusted.

## Results

See `results/2026-07-04-run.md` for the recorded numbers from the completed
full 9-fixture x k=3 pass (`agentic-workflow-fq2j8`), plus that same file's
addendum section (`agentic-workflow-hz9m3`) covering the 3 check-8 fixtures
below, and `results/2026-07-04-hardened-run.md` (`agentic-workflow-n7q4d`)
for the 4 additional, deliberately harder fixtures. The eval reports at
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md` (and its two
addenda) have the full write-ups, per-fixture variance, and follow-up
captures. The `agentic-workflow-fq2j8` pass supersedes `results/2026-07-03-run.md`
(the original spike's 6-fixture partial) as the dataset of record — see the
latter file for why it was superseded (the verifier definition changed
underneath it: check 8 / ADR-0036, and the ADR-0043 heartbeat hook).

**Combined dataset of record (original 12-fixture pass): 36 scored real
verifier spawns across 12 fixtures** — catch rate 30/30 = 100%, right-reason
rate 30/30 = 100%, false-FAIL rate 0/6 = 0%, verdict variance 0 across all 12
fixtures. That zero-variance ceiling — including on the three judgment
checks — is exactly why `agentic-workflow-n7q4d` hardened the corpus further;
see below.

### Hardened corpus (`agentic-workflow-n7q4d`): 4 new fixtures, one real miss found

Four additional fixtures target the judgment checks (5/6/6b) and a harder
check-8 shape, each real-spawned k≥3 against the opus-pinned verifier (21
total spawns: 12 scored + 3 discarded-to-a-fixture-fix + 6 scored
reconfirmation). Full detail and retention reasoning:
`evals/verifier-catch-rate/results/2026-07-04-hardened-run.md`.

- `stale-readme-partial` (check 5, partial not absent README sync) — FAIL
  3/3, right-reason 3/3, zero variance. Ceilings opus; retained on an
  explicit argument.
- `missing-adr-borderline` (check 6, decision narrated in the task's own
  prose rather than flagged by a code comment) — **PASS 0/6 across two
  independent k=3 batches — a genuine, reproducible opus miss**, not corpus
  noise (checked against this exact corpus's own `missing-adr` fixture as
  precedent). The standout finding: a real judgment-density gap in the
  current verifier.
- `contradicts-adr-partial` (check 6b, contradiction confined to a secondary,
  sympathetically-framed method) — FAIL 3/3, right-reason 3/3, zero variance.
  Ceilings opus; retained on an explicit argument.
- `runtime-probe-subtle-mismatch` (check 8, nested field-name mismatch behind
  a correct top-level shape and a genuinely HTTP-driving unit test) — FAIL
  3/3, right-reason 3/3, zero variance, clean boot/probe/teardown every run.
  Ceilings opus; retained on an explicit argument; ground truth objectively
  uncontested (`color` vs `colour`).

**Combined dataset of record across both passes: 54 scored real verifier
spawns across 16 fixtures.** `agentic-workflow-bx7k5`'s sonnet arm now has a
same-set opus baseline that includes at least one fixture (`missing-adr-borderline`)
with demonstrated discriminating potential, not only a ceiling-saturated set.

### The sonnet arm (`agentic-workflow-bx7k5`): judgment-density pillar tested, opus pin unchanged

`agentic-workflow-bx7k5` real-spawned the verifier with a per-spawn
`model: "sonnet"` override (no edit to `agents/verifier.md`) across all 16
fixtures, k ≥ 3 (51 scored spawns; k = 6 for `missing-adr-borderline` across
two independent batches). Result: sonnet tied opus at ceiling on all 15
opus-ceiling fixtures (inconclusive on those, by construction), and **caught
the opus-floor `missing-adr-borderline` 6/6 where opus missed it 0/6** —
direct evidence against ADR-0031's judgment-density rationale on this corpus,
but **not** a license to route the verifier to sonnet: ADR-0031's
decorrelation pillar is independent, unmeasured by any catch-rate eval, and
alone sufficient to keep the opus pin given `worker = sonnet`. Full numbers:
`evals/verifier-catch-rate/results/2026-07-04-sonnet-arm-run.md`. Full
write-up and the decision-rule application:
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`'s
`agentic-workflow-bx7k5` addendum. The `missing-adr-borderline` divergence
turned out to be a **verifier check-6 wording gap**, not a tier effect —
tracked as `agentic-workflow-q7x2k`.

### The check-6 wording fix (`agentic-workflow-q7x2k`): opus floor closed

`agentic-workflow-q7x2k` edited `agents/verifier.md`'s check 6 section to
close the "narrated in the task's own prose" loophole `bx7k5` traced the
`missing-adr-borderline` divergence to: an explicit no-carve-out statement, a
worked example anchored on `widgets-mab1`, and an explicit over-flag /
no-lowered-bar constraint. Re-run against the real opus-pinned verifier (no
model override): `missing-adr-borderline` now FAILs 3/3, right-reason 3/3
(closing the prior 0/6 miss), and `clean` (the PASS fixture most at risk of a
false-FAIL from an over-broadened check 6) still PASSes 3/3 — no regression.
Full numbers: `evals/verifier-catch-rate/results/2026-07-04-check6-wording-fix-run.md`.
Write-up: `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`'s
`agentic-workflow-q7x2k` addendum. **Combined dataset of record: 60 scored
real verifier spawns across 16 fixtures.**

### Check-8 (runtime drive, ADR-0036) fixtures

Three additive fixtures close the check-8 gap noted below:
`runtime-clean`, `runtime-boot-fail`, `runtime-probe-mismatch`. Each carries
a real `## Runtime surface` manifest in its synthetic `widgets` BC README
(a tiny stdlib-only HTTP server exposing `GET /healthz` and `GET /widgets`,
launched via `src/launch.js` — a true ephemeral `:0` bind, the actual port
read back from `.tmp/runtime.json`, torn down via `src/launch.js stop`), so
`meta.json.launch_command` carries the resolved manifest instead of `"none"`
and the diff's `src/**` paths genuinely trigger check 8:

- `runtime-clean` — boots, both probes match → PASS, 3/3, false-FAIL 0/3.
- `runtime-boot-fail` — the boot entrypoint calls an unexported function and
  throws before the server ever binds a port, so no runfile is written →
  FAIL citing the boot/runfile timeout, 3/3, right-reason 3/3.
- `runtime-probe-mismatch` — the server boots, but the `/widgets` route
  returns a stale singular shape (`{ widget: ... }`) instead of the
  documented `{ widgets: [...] }`; the unit suite passes because it never
  drives that route over real HTTP → FAIL citing the `/widgets` probe's
  expected-vs-observed body, 3/3, right-reason 3/3.

Teardown (`stop`) was confirmed clean on every one of the 9 runs, including
after the boot failure and the probe mismatch.

## Known gaps (logged, not measured)

- ~~Check 8 (runtime drive, ADR-0036) is out of scope for this fixture
  set~~ — **closed by `agentic-workflow-hz9m3`** (see "Check-8 fixtures"
  above). The original 9 fixtures still declare no `## Runtime surface`
  manifest and still carry `meta.json.launch_command: "none"` (untouched,
  by design — check 8 correctly never fires for them); the 3 new fixtures
  above are where check 8 is now measured.
- **`stale-readme`, `missing-adr`, `contradicts-adr`** — previously unmeasured
  as of 2026-07-03; all three were real-spawned and landed their planted
  checks in the 2026-07-04 full pass (see `results/2026-07-04-run.md`). No
  gap remains here.
- ~~The 12-fixture corpus ceilings opus (zero variance everywhere), so it
  cannot discriminate model tiers for `agentic-workflow-bx7k5`'s planned
  A/B~~ — addressed by `agentic-workflow-n7q4d`: 4 new, harder fixtures
  (`stale-readme-partial`, `missing-adr-borderline`, `contradicts-adr-partial`,
  `runtime-probe-subtle-mismatch`) were added and real-spawned k≥3 against
  opus; `missing-adr-borderline` is a demonstrated, reproducible opus miss
  (see "Hardened corpus" under Results above and
  `results/2026-07-04-hardened-run.md`).
- ~~The remaining gap — actually running the sonnet arm against this hardened
  16-fixture corpus — is `agentic-workflow-bx7k5` itself.~~ — **closed by
  `agentic-workflow-bx7k5`**: 51 real sonnet-pinned spawns across all 16
  fixtures (see "The sonnet arm" under Results above and
  `results/2026-07-04-sonnet-arm-run.md`). Sonnet tied opus at ceiling on all
  15 opus-ceiling fixtures and caught the opus-floor `missing-adr-borderline`
  6/6 where opus missed it 0/6 — evidence against ADR-0031's judgment-density
  rationale on this corpus, but not a license to route the verifier to
  sonnet (decorrelation, pillar 2, is independent and unmeasured here — see
  the addendum in `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`).
  The divergence traced to a verifier check-6 wording gap, not a tier effect
  — tracked separately as `agentic-workflow-q7x2k`.
- ~~The check-6 wording gap itself~~ — **closed by `agentic-workflow-q7x2k`**:
  `agents/verifier.md`'s check 6 was sharpened to remove the task-file-narration
  carve-out (see "The check-6 wording fix" under Results above).
  `missing-adr-borderline` now FAILs 3/3 (opus-pinned, right-reason 3/3),
  closing the prior 0/6 floor, with no regression on `clean` (3/3 PASS).
  This eval's designed surface is now fully measured on both tiers; any future
  work here is generalizing the harness to
  the `research-reviewer` structural twin noted in the sibling-tasks note
  below.
