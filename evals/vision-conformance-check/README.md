# vision-conformance-check eval

Exercises the **LLM judgment** half of `work`'s session-end vision-conformance
pass (`agentic-workflow-v6d4n`, ADR-0040) — the part
`lib/vision-conformance.mjs`'s unit tests (`lib/test/vision-conformance.test.mjs`)
deliberately do NOT cover, because "does this shipped task pull toward a
non-goal / away from a success criterion" is genuine reasoning, not a
deterministic function of its inputs.

This is a **documented runbook fixture**, not a full multi-spawn k=3 measured
eval (out of scope for this task's budget) — mirroring the "Known gaps"
transparency `agentic-workflow-v3h6p`'s `evals/verifier-catch-rate/` used for
its own un-run fixtures. A follow-up could promote this to a real k=3 run
against a spawned agent the same way that eval did against the `verifier`.

## Fixture shape

Each `fixtures/<name>/` directory carries exactly the bounded inputs
`skills/work/SKILL.md`'s "Vision-conformance check (session-end)" section
says the pass reads — nothing more:

- `vision-excerpt.md` — the two named `vision.md` sections only ("What
  success looks like" + "Non-goals"), verbatim from this repo's real
  `.agentheim/vision.md` at the time this eval was written.
- `session-batch.md` — the session's already-summarized completed-task
  entries (the same material the session-end step already has in hand from
  its plain-prose summary — step 1 of "End-of-run reporting"), plus a
  grader's note explaining the intended ground truth.
- `expected.json` — ground truth: whether the pass should flag anything
  (`expect_flag`), and if so, which task(s) and which specific criterion/
  non-goal each diverges from.

Two fixtures:

- **`planted-drift/`** — three synthetic tasks, each one a deliberate drift
  toward vision.md's Non-goals #3 ("Not autonomous") by removing a
  human-in-the-loop checkpoint the vision names explicitly (escalation after
  failed verification, the carry-over reconciliation's per-file user
  disposition, the pre-`work` user review step). Should flag all three,
  each naming "Not autonomous." as the diverged-from non-goal.
- **`clean-batch/`** — four real, already-shipped tasks from this repo's own
  history (`d6q4h`, `k5n8f`, `v3h6p`, the worktree-isolation ADR-0032 work).
  None removes a checkpoint or drifts toward any non-goal. Should raise
  **zero** flags.

## Running a fixture

Follow `skills/work/SKILL.md`'s "Vision-conformance check (session-end)"
steps 1–4 by hand (or via a fresh subagent spawn for a less-contaminated
read):

1. Read `vision-excerpt.md` as if it were the extracted
   `extractVisionSections` output (What success looks like / Non-goals).
2. Read `session-batch.md`'s completed-task list (ignore the "Note for eval
   graders" section — that's grading scaffolding, not something the real
   session-end pass would ever see).
3. For each task, ask: does it pull toward a stated non-goal, or away from a
   stated success criterion?
4. For anything flagged, name the specific criterion/non-goal it diverges
   from (the `labelFor` convention — the item's leading bold phrase).
5. Compare the resulting flag set against `expected.json`.

Score:

- **Catch** — flags the expected task(s) and names the expected diverged-from
  non-goal/criterion (compare in substance, not exact wording).
- **Miss** — `planted-drift/` produces fewer flags than expected, or none.
- **False positive** — `clean-batch/` produces any flag at all.

## Results

See `results/2026-07-03-run.md` for the worker's own manual runbook pass
(performed while writing this eval, as a sanity check that the SKILL.md prose
actually produces the intended judgment on both fixtures) — not a k=3
multi-spawn measurement.
