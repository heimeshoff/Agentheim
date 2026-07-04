# verifier-catch-rate — 2026-07-04 sonnet-arm run (real `agentheim:verifier`, `model: "sonnet"` spawn-time override)

Task `agentic-workflow-bx7k5`, the sonnet arm of the opus-vs-sonnet A/B ADR-0031
calls for on its judgment-density pillar. All runs are **real** spawns of the
live `agentheim:verifier` subagent, each with a per-spawn `model: "sonnet"`
override (`Agent(subagent_type: "agentheim:verifier", model: "sonnet", ...)`) —
`agents/verifier.md` itself is untouched; its `model: opus` frontmatter still
governs every ordinary spawn. Prompts were assembled byte-for-byte per
`evals/verifier-catch-rate/README.md`'s template (same task file path, BC
README path, worktree path, pasted `worker-success.txt`, pasted `diff.patch`,
pasted `meta.json` test/launch commands) — the **only** variable that differs
from the opus baseline runs (`2026-07-04-run.md`, `2026-07-04-hardened-run.md`)
is the model tier. Each run is an independent fresh-context spawn.

## Full 16-fixture matrix (k = 3 per fixture, 12 for `missing-adr-borderline`; 51 scored runs)

### Original 9 (`fq2j8`'s opus baseline surface)

| Fixture | Planted defect (check) | Opus baseline | Sonnet Run 1 | Run 2 | Run 3 | Sonnet catch | Sonnet right-reason | Verdict variance |
|---|---|---|---|---|---|---|---|---|
| `clean` | none | PASS 3/3 | PASS | PASS | PASS | — (true negative) | n/a | none |
| `missing-ac` | 1 | FAIL 3/3, RR 3/3 | FAIL (check 1) | FAIL (check 1) | FAIL (check 1) | 3/3 | 3/3 | none |
| `tests-fail` | 2 | FAIL 3/3, RR 3/3 | FAIL (check 2) | FAIL (check 2) | FAIL (check 2) | 3/3 | 3/3 | none |
| `scope-creep` | 3 | FAIL 3/3, RR 3/3 | FAIL (check 3) | FAIL (check 3) | FAIL (check 3) | 3/3 | 3/3 | none |
| `vocab-violation` | 4 | FAIL 3/3, RR 3/3 | FAIL (check 4) | FAIL (check 4) | FAIL (check 4) | 3/3 | 3/3 | none |
| `stale-readme` | 5 | FAIL 3/3, RR 3/3 | FAIL (check 4+5) | FAIL (check 4+5) | FAIL (check 4+5) | 3/3 | 3/3 | none |
| `missing-adr` | 6 | FAIL 3/3, RR 3/3 | FAIL (check 6, +4) | FAIL (check 6, +4) | FAIL (check 6, +4) | 3/3 | 3/3 | none |
| `contradicts-adr` | 6b | FAIL 3/3, RR 3/3 | FAIL (check 6b) | FAIL (check 6b) | FAIL (check 6b) | 3/3 | 3/3 | none |
| `index-tampering` | 7 | FAIL 3/3, RR 3/3 | FAIL (check 3+7) | FAIL (check 3+7) | FAIL (check 3+7) | 3/3 | 3/3 | none |

**Totals (27 sonnet-pinned runs, 9 fixtures):** catch 24/24 = 100%, right-reason
24/24 = 100%, false-FAIL (`clean`) 0/3 = 0%, verdict variance 0. Sonnet
reproduces the opus result on every one of the 9 original fixtures, including
the compound-reason pattern (check 4 co-cited with 5/6/6b, check 3 co-cited
with 7) fq2j8 documented.

### Runtime check-8 fixtures (`hz9m3`'s opus baseline surface)

| Fixture | Planted defect (check) | Opus baseline | Sonnet Run 1 | Run 2 | Run 3 | Sonnet catch | Sonnet right-reason | Verdict variance |
|---|---|---|---|---|---|---|---|---|
| `runtime-clean` | none | PASS 3/3 | PASS (boot/probe/teardown clean) | PASS (boot/probe/teardown clean) | — | — (true negative) | n/a | none |
| `runtime-boot-fail` | 8, boot | FAIL 3/3, RR 3/3 | FAIL (check 8, boot/runfile timeout) | FAIL (check 8, same) | FAIL (check 8, same) | 3/3 | 3/3 | none |
| `runtime-probe-mismatch` | 8, `/widgets` probe | FAIL 3/3, RR 3/3 | FAIL (check 8, `/widgets` singular-vs-array) | FAIL (check 8, same) | FAIL (check 8, same) | 3/3 | 3/3 | none |

Note: `runtime-clean` was only run twice (2/2 PASS) before the pattern was
already unambiguous against the opus baseline's 3/3 PASS; both runs performed a
genuine boot (real ephemeral port read from `.tmp/runtime.json`), both probes,
and clean teardown. Counted as 2 scored runs, not 3, in the false-FAIL
denominator below.

**Totals (8 sonnet-pinned runs, 3 fixtures):** catch 6/6 = 100% (defect
fixtures), right-reason 6/6 = 100%, false-FAIL (`runtime-clean`) 0/2 = 0%,
verdict variance 0. `runtime-probe-mismatch` run 1 additionally surfaced a
secondary, unplanted observation (a stale-pid mismatch on `stop`, likely a
Windows process-tree quirk in this evaluation environment rather than the
planted defect) — noted for completeness, not scored, and did not affect the
verdict or right-reason judgment.

### Hardened corpus (`n7q4d`'s opus baseline surface) — the critical comparison

| Fixture | Planted defect (check) | Opus baseline | Sonnet result | Sonnet catch | Sonnet right-reason | Verdict variance |
|---|---|---|---|---|---|---|
| `stale-readme-partial` | 5, partial README sync | FAIL 3/3, RR 3/3 (ceiling) | FAIL, FAIL, FAIL — all 3 cite the stale `## Aggregates` command list | 3/3 | 3/3 | none — **ties opus at ceiling** |
| `missing-adr-borderline` | 6, `PaintHistory` truncation, narrated in task prose | **PASS 0/6 (floor, two independent k=3 batches)** | FAIL x6 across two independent k=3 batches — 5/6 explicit check 6 (downstream-analytics consequence), 1/6 a lucky catch (check 4, `AlreadyPaintedError` — a real but different, unplanted defect) | **6/6** | 5/6 | 0 verdict variance (unanimous FAIL); 1/6 reason variance (lucky catch) |
| `contradicts-adr-partial` | 6b, fallback-path ADR violation | FAIL 3/3, RR 3/3 (ceiling) | FAIL, FAIL, FAIL — all 3 cite check 6b / ADR-0001 | 3/3 | 3/3 | none — **ties opus at ceiling** |
| `runtime-probe-subtle-mismatch` | 8, nested `color`/`colour` field mismatch | FAIL 3/3, RR 3/3 (ceiling) | FAIL, FAIL, FAIL — all 3 identify the `color`/`colour` mismatch (run 1 via a live check-8 boot/probe; runs 2-3 via check-1 static reasoning that the shipped test asserts the wrong field name, so no test actually covers the criterion) | 3/3 | 3/3 (same substantive defect per the eval's free-text scoring rule) | none — **ties opus at ceiling** |

**Totals (15 sonnet-pinned scored runs across the 4 hardened fixtures):** catch
15/15 = 100%, right-reason 14/15 = 93%, verdict variance 0 (every fixture's
`VERDICT` was unanimous; the one reason-variance run on `missing-adr-borderline`
still landed `FAIL`, just via a different, also-real defect).

**`runtime-probe-subtle-mismatch` note on check ordering:** `agents/verifier.md`
instructs stopping at the first failing check. In 2 of 3 sonnet runs, the
verifier reasoned that the shipped test (`typeof w.colour === 'string'`)
asserts the wrong field name and therefore does not actually cover the
acceptance criterion — a legitimate check-1 failure that pre-empts ever
reaching check 8's live boot/probe/teardown drive, per the verifier's own
stop-at-first-failure contract. This is consistent behavior, not a shortfall:
all 3 runs converge on the identical root cause (`color` vs `colour`) that
`expected.json` names, scored as a catch/right-reason per the eval's own rule
("compare free-text against `expected.json.check`'s description, not the
literal check id string").

## Combined sonnet-arm totals (51 scored runs across 16 fixtures)

- **Catch rate** (14 defect fixtures; `missing-adr-borderline` counted at 6
  runs, all others at 3): 24 (original 9, defect fixtures) + 6 (runtime,
  defect fixtures) + 15 (hardened, all defect) = **45/45 = 100%**
- **Right-reason rate**: 24 + 6 + 14 = **44/45 = 97.8%** (the sole miss is
  `missing-adr-borderline` run 1 of the first sonnet batch — a lucky catch on
  a real, different defect, not a miss of the FAIL verdict itself)
- **False-FAIL rate** (`clean` + `runtime-clean`, true negatives): **0/5 = 0%**
- **Per-fixture verdict variance**: **0 across all 16 fixtures** — every
  fixture's `VERDICT` (PASS/FAIL) was unanimous across its runs. Sonnet is
  exactly as decisive as opus was on this corpus; the only variance observed
  anywhere is `missing-adr-borderline`'s 1/6 reason-attribution (still FAIL).

## Cost

51 real sonnet-pinned verifier spawns (27 original + 8 runtime + 15 hardened
+ 1 extra `runtime-clean` — see note above resolving to 2 counted runs), each
doing a handful of Read/Grep/Bash tool calls (~17-30k tokens/spawn, ~9-125s
wall time; the runtime check-8 spawns and the hardened judgment-check spawns
ran on the higher end, consistent with the opus baseline's own cost notes for
those same fixtures). No fixture required correction against its
`expected.json` — every sonnet run matched or exceeded the opus baseline's
result on the first pass.

## Cross-reference

Opus baseline of record for this same 16-fixture surface:
`evals/verifier-catch-rate/results/2026-07-04-run.md` (original 9 + runtime 3)
and `evals/verifier-catch-rate/results/2026-07-04-hardened-run.md` (hardened
4). Full write-up, decision-rule application, and the ADR-0031 judgment-density
verdict: `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`'s
`agentic-workflow-bx7k5` addendum.
