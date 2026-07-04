# verifier-catch-rate — 2026-07-04 check-6 wording-fix re-run (real `agentheim:verifier`, opus-pinned)

Task `agentic-workflow-q7x2k`: closes the check-6 "narrated in the task's own
prose" loophole that `agentic-workflow-n7q4d` found and
`agentic-workflow-bx7k5`'s sonnet arm confirmed was a tier-independent wording
gap in `agents/verifier.md` itself, not a model-tier weakness. The fix edits
only `agents/verifier.md`'s check 6 section (an explicit no-carve-out
statement, a worked example anchored on `widgets-mab1`, and an explicit
over-flag / no-lowered-bar constraint) — no fixture files were changed, and
the verifier was **not** re-tuned to `sonnet`; every spawn below uses the
agent definition's own `model: opus` frontmatter (ADR-0031), unmodified.

## Method

Same runbook as prior passes: `evals/verifier-catch-rate/README.md`'s
spawn-prompt template, built from each fixture's own `done/` task file,
synthetic BC README, `diff.patch`, `worker-success.txt`, and `meta.json`'s
`test_command`/`launch_command`. Each real `Agent(subagent_type:
"agentheim:verifier", ...)` spawn is fresh/independent — no shared context
across runs, no model override.

Two fixtures were re-run, chosen for a structural reason, not convenience:
`agents/verifier.md` instructs the verifier to stop at the **first** failing
check. A wording-only edit confined to check 6 can only possibly change the
verdict of a spawn that (a) previously reached check 6 without having already
failed an earlier check, and (b) has a decision at stake in that check's
reasoning. Of the 16-fixture corpus:

- 14 fixtures' planted defects live at checks 1-5, 6b, 7, or 8 and already
  correctly FAIL before or at their own planted check — none of them can be
  affected by a check-6 wording change without altering their already-correct
  verdict (impossible: they already FAIL). Re-running all 14 at k=3 each would
  not exercise the edited text differently than the two below and was skipped
  on that structural argument, not budget alone.
- **`missing-adr-borderline`** is the fixture the fix directly targets — the
  known opus 0/6 floor.
- **`clean`** is the corpus's only PASS fixture whose task file narrates a
  real behavioral tradeoff in its own prose without that tradeoff being
  ADR-worthy (`## Why`: "repainting with the same color already in place
  should be rejected loudly rather than silently no-opping" — a throw-vs-no-op
  choice with no documented downstream consumer). It is exactly the shape the
  task's over-flag constraint warns about: a PASS fixture where a
  too-aggressive check-6 rewrite could most plausibly flip a false FAIL.
  `runtime-clean`, the corpus's other PASS fixture, was not re-run: its task
  file only justifies *why the feature exists* ("without opening the process
  logs"), it does not narrate an alternative-behavior tradeoff, so it is not a
  comparable at-risk case.

## Results

### `missing-adr-borderline` — the known opus floor

| Run | Verdict | Right-reason (cites check 6) |
|---|---|---|
| 1 | FAIL | yes — explicit check 6, names the silent-drop-vs-erroring/unbounded/compaction tradeoff and the downstream-analytics consequence; explicitly notes task-file narration does not waive the ADR requirement |
| 2 | FAIL | yes — same, explicitly quotes the "narration is evidence the decision exists, not a durable record of it" framing from the edited check text |
| 3 | FAIL | yes — same, again explicitly rejects the narration-as-substitute reasoning |

**3/3 FAIL, 3/3 right-reason, 0 verdict variance.** Closes the prior 0/6 miss
(`agentic-workflow-n7q4d`'s original k=3 baseline plus its reconfirmation
batch, both opus-pinned, both PASS). All three runs cite check 6 by name and
explicitly reject the "task file already explains it" reasoning the fix was
written to close — none relied on a different check or a lucky catch.

### `clean` — no-regression check on the PASS fixture most at risk of a false-FAIL

| Run | Verdict |
|---|---|
| 1 | PASS |
| 2 | PASS |
| 3 | PASS |

**3/3 PASS, 0 verdict variance.** The sharpened check 6 did not start
flagging `Widget.paint`'s throw-vs-no-op choice (narrated in the task's own
`## Why`) as ADR-worthy. No false-FAIL regression on the corpus's
highest-risk PASS fixture.

## Before / after summary

| Fixture | Before (opus, prior wording) | After (opus, this fix) |
|---|---|---|
| `missing-adr-borderline` | PASS 0/6 (floor, two independent k=3 batches) | **FAIL 3/3, right-reason 3/3** |
| `clean` | PASS 3/3 (ceiling) | PASS 3/3 (ceiling, unchanged) |

## Conclusion

The check-6 wording fix closes the documented opus miss without introducing a
false FAIL on the corpus's one PASS fixture that narrates a non-ADR-worthy
behavioral choice in its own prose — the specific failure mode the task's
over-flag constraint warned against. Combined with the structural argument
above (checks 1-5/6b/7/8's already-correct FAILs cannot be altered by a
check-6-only wording edit under the verifier's stop-at-first-failure
contract), this is treated as sufficient no-regression evidence across the
full 16-fixture corpus without re-running all 16 at k=3.

## Cost

6 real opus-pinned verifier spawns (3 `missing-adr-borderline` + 3 `clean`).

## Cross-reference

Prior opus baseline: `evals/verifier-catch-rate/results/2026-07-04-hardened-run.md`
(the original 0/6 finding) and `evals/verifier-catch-rate/results/2026-07-04-run.md`
(the `clean` ceiling baseline). Sonnet-arm cross-check that first traced the
gap to wording rather than tier:
`evals/verifier-catch-rate/results/2026-07-04-sonnet-arm-run.md`. Full
write-up: `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`'s
`agentic-workflow-q7x2k` addendum.
