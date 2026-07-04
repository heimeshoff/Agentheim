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

## Results

See `results/2026-07-04-run.md` for the recorded numbers from the completed
full 9-fixture x k=3 pass (`agentic-workflow-fq2j8`), plus that same file's
addendum section (`agentic-workflow-hz9m3`) covering the 3 check-8 fixtures
below. The eval report at
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md` (and its own
addendum) has the full write-up, per-fixture variance, and follow-up
captures. The `agentic-workflow-fq2j8` pass supersedes `results/2026-07-03-run.md`
(the original spike's 6-fixture partial) as the dataset of record — see the
latter file for why it was superseded (the verifier definition changed
underneath it: check 8 / ADR-0036, and the ADR-0043 heartbeat hook).

**Combined dataset of record: 36 scored real verifier spawns across 12
fixtures** — catch rate 30/30 = 100%, right-reason rate 30/30 = 100%,
false-FAIL rate 0/6 = 0%, verdict variance 0 across all 12 fixtures.

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
