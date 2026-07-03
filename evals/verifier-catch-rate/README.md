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
  fixture root), `launch_command` (always `"none"` here — no fixture declares
  a `## Runtime surface`, so verifier check 8 never fires for this eval; see
  "Known gaps" below), `iteration`
- `expected.json` — ground truth: `verdict`, planted `check` id, a
  `planted_defect` description, and free-form `notes`

`contradicts-adr` additionally carries
`.agentheim/knowledge/decisions/0001-widget-color-enum.md`, the ADR the task's
`related_adrs: [0001]` frontmatter points at.

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

See `results/2026-07-03-run.md` for the recorded numbers from this spike's
real-spawn pass, and the eval report at
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md` for the full
write-up, per-fixture variance, and follow-up captures.

## Known gaps (logged, not measured this pass)

- **Check 8 (runtime drive, ADR-0036)** is out of scope for this fixture set —
  it needs a `## Runtime surface` manifest + a `## Pre-resolved launch
  command` carrying a real `launch`/`stop`/`probes` tuple, which this
  synthetic `widgets` BC does not declare. `meta.json.launch_command` is
  `"none"` everywhere, so check 8 never fires for any fixture here — by
  design, not omission.
- **`stale-readme`, `missing-adr`, `contradicts-adr`** fixtures are fully
  built (task file, diff, worker-success, expected.json) but were **not**
  run against the real verifier in this pass — see the report for why
  (spike time/spend budget) and what a follow-up run would need.
