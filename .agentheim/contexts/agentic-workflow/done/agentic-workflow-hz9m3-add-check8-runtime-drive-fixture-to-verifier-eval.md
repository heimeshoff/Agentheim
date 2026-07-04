---
id: agentic-workflow-hz9m3
title: Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval
status: done
type: spike
context: agentic-workflow
created: 2026-07-03
completed: 2026-07-04
depends_on: []
blocks: []
tags: [harness-audit, verifier, evals, adr-0036]
related_adrs: [0036]
related_research: []
prior_art: [agentic-workflow-v3h6p, agentic-workflow-y8b4q, agentic-workflow-j7d4k]
---

## Why

`agentic-workflow-v3h6p` built the `verifier-catch-rate` fixture set covering
checks 1 through 7 (+6b), but explicitly left check 8 (runtime drive,
ADR-0036, added same-day by `agentic-workflow-y8b4q`, ratified by `j7d4k`)
unmeasured — it is the newest and most expensive verifier check, the one that
actually boots the app, and it has **zero** measured catch rate. Every one of
the 9 existing fixtures carries its own `.agentheim/contexts/widgets/README.md`
with **no** `## Runtime surface` block and `meta.json.launch_command: "none"`,
so check 8 never fires anywhere in the current set — by design, not omission
(see the eval README's "Known gaps"). Closing this gap is what makes the
verifier-catch-rate eval a full 8-check surface instead of a 7-check one.

## What

Add one or more **new** check-8 fixture directories under
`evals/verifier-catch-rate/fixtures/` that declare a real `## Runtime surface`
manifest and ship a tiny, genuinely-bootable stdlib HTTP server, then
real-spawn the live `agentheim:verifier` (opus-pinned, ADR-0031) against them
exactly as `v3h6p` did for checks 1–7. **Do not mutate the existing 9 measured
fixtures** — their READMEs and numbers stay byte-stable; a check-8 fixture is
additive.

Design constraints that make the fixture actually exercise check 8 (each is a
real trap the check-8 spec in `agents/verifier.md` imposes):

1. **Manifest-bearing README.** The fixture's `.agentheim/contexts/widgets/README.md`
   gains a `## Runtime surface` fenced block: `surfacePaths`, `launch`, `stop`,
   `runfile`, `probes` (endpoint + status + `bodyShape`). Reusing the `widgets`
   BC keeps the synthetic vocabulary identical to its siblings and is the
   recommended default; a distinct BC name (e.g. `gadgets`) is a cosmetic
   alternative, not a requirement — the real unit is the fixture directory, and
   each fixture's README is its own copy, so the manifest never leaks into the
   other 9.
2. **Real launcher + runfile + stop.** Ship a small stdlib-only launcher the
   manifest's `launch` boots from the fixture (worktree) root, which writes the
   **actual bound port** to `runfile` and can be torn down via `stop`. Bind a
   true ephemeral `:0` port and read the real port back from `runfile` —
   ADR-0036 pt 4 explicitly permits ephemeral `:0` as the stronger guarantee,
   and it sidesteps the dashboard's per-root-derived + 8-rung-ladder port logic
   entirely (that machinery exists to preserve browser `localStorage` across
   relaunch, which a fixture does not need).
3. **The diff must touch a `surfacePath`.** Check 8 fires only when a changed
   path (from `FILE_LIST` / `diff.patch`) matches `surfacePaths`. The fixture's
   `diff.patch` must edit a file under the declared glob (e.g. `src/server.js`
   under `src/**`) or check 8 silently no-ops and the fixture measures nothing.
4. **The fixture must pass checks 1–7.** Check 8 is the FINAL check and the
   verifier stops at the first failure, so a check-8 fixture must be clean on
   acceptance-criteria coverage, test execution, scope, vocabulary, README sync,
   ADRs, and index/protocol — otherwise the verifier FAILs earlier and never
   reaches check 8. This is the `v3h6p` `clean`-fixture lesson (its planted
   raw-string colours tripped check 4 before anything else) applied to check 8.
   For the probe-mismatch defect especially: the unit tests must pass and the AC
   must read as met on paper, so that **only the live drive** exposes the wrong
   runtime shape.

Build at least a **clean pass** (`runtime-clean`: boots, all probes match →
check 8 passes → overall PASS) plus the **two distinct check-8 FAIL paths**,
which is the diagnostic point of measuring this check at all:

| Fixture | Planted defect | check-8 FAIL path exercised |
|---|---|---|
| `runtime-clean` | none | — expected PASS (server boots, probes match) |
| `runtime-boot-fail` | server throws on startup / never writes a usable runfile | boot failure → FAIL, no probes attempted |
| `runtime-probe-mismatch` | server boots but a probe returns the wrong status/body shape | HTTP-floor mismatch → FAIL citing the probe (expected vs observed) |

Then real-spawn the verifier against each (k ≥ 3), following the same
prompt-assembly runbook in `evals/verifier-catch-rate/README.md` (the
`## Pre-resolved launch command` block now carries the resolved manifest instead
of `none`), and record catch rate / right-reason rate / false-FAIL /
variance alongside the existing numbers.

## Acceptance criteria

- [ ] One or more **new** fixture directories under
      `evals/verifier-catch-rate/fixtures/` carry a `## Runtime surface`
      manifest in their BC README and a real, tiny, stdlib-only HTTP server the
      `launch`/`stop`/`probes`/`runfile` tuple can actually boot and drive
      (ephemeral `:0`, actual port read from `runfile`). The existing 9
      fixtures are untouched.
- [ ] A `runtime-clean` clean-pass fixture **plus both** check-8 FAIL flavours —
      `runtime-boot-fail` (boot failure) and `runtime-probe-mismatch` (HTTP-floor
      probe mismatch) — each carrying the full verifier-input tuple, with
      `meta.json.launch_command` set to the resolved manifest (not `"none"`) and
      a `diff.patch` whose changed paths match `surfacePaths` so check 8 fires.
- [ ] Each fixture is clean on checks 1–7 (verified by reasoning through the
      tuple, or by a dry PASS on a boot-fixed variant) so the verifier actually
      reaches check 8 rather than FAILing earlier.
- [ ] Real verifier spawns (k ≥ 3 per fixture) recorded in
      `evals/verifier-catch-rate/results/` with catch rate, right-reason vs
      lucky-catch, false-FAIL (on `runtime-clean`), and per-fixture variance;
      any fixture not behaving as its `expected.json` predicts is corrected and
      re-run before being counted (the `v3h6p` `clean`-correction discipline).
- [ ] `evals/verifier-catch-rate/README.md`'s "Known gaps" section and the eval
      report (`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md`, or a
      dated follow-up) are updated to reflect check 8 now being measured.

## Notes

- **Structural precedent for the launch block:** `agentic-workflow-g9s3w`
  pre-loaded the test command into the verifier spawn; the
  `## Pre-resolved launch command` block mirrors it one-for-one. Read g9s3w's
  fixture/tuple handling as the model for how the resolved manifest rides into
  the spawn prompt.
- **Coordination with `agentic-workflow-fq2j8`** (the sibling spike that
  real-spawns the three already-built-but-unmeasured fixtures — stale-readme /
  missing-adr / contradicts-adr). Both this task and fq2j8 edit the same two
  files — `evals/verifier-catch-rate/README.md` "Known gaps" and the eval
  report's combined-numbers section. They are logically independent (no
  `depends_on`), but if worked in separate sessions they will collide on those
  two files at merge-back; prefer batching them, or land one and rebase the
  other. Not a hard dependency — flagged so the second worker doesn't clobber
  the first's numbers.
- **A/B sibling:** `agentic-workflow-bx7k5` (opus-vs-sonnet verifier routing)
  will want these check-8 fixtures in its fixture pool once they exist — another
  reason to keep them faithful, self-contained tuples.
- **Platform reality:** the verifier boots the fixture server via its Bash tool
  on this Windows checkout. The launcher/stop must be cross-platform (detached
  spawn + pid/port runfile + kill-via-`stop`); an ephemeral `:0` stdlib server
  is the smallest thing that satisfies check 8's HTTP floor with zero new deps.
- Spike deliverable, per `v3h6p`: the durable artifacts are the fixtures, the
  pinned `expected.json` ground truth, and the recorded numbers — not a polished
  runner. The measurement is the point.

## Outcome

Added three new, additive fixtures under `evals/verifier-catch-rate/fixtures/`
that each declare a real `## Runtime surface` manifest and ship a genuinely
bootable stdlib-only HTTP server (`src/server.js` — `createServer()` +
`buildWidgetsPayload()`; `src/serve.js` — the detached boot entrypoint;
`src/launch.js` — a cross-platform launch/stop CLI mirroring
`dashboard/launch.mjs`'s pattern, binding a true ephemeral `:0` port per
ADR-0036 pt 4 and writing the actual bound port to `.tmp/runtime.json`):

- `runtime-clean` — both `GET /healthz` and `GET /widgets` boot and match the
  manifest's declared probes; expected/measured PASS, 3/3, false-FAIL 0/3.
- `runtime-boot-fail` — `serve.js` calls `warmCache()`, which `server.js`
  never exports, so the detached child throws before `server.listen()` and
  no runfile is ever written; `launch.js`'s wait loop times out
  deterministically (~4s). Unit tests still pass (they import `server.js`
  directly, never `serve.js`), so only the live drive exposes the defect.
  Expected/measured FAIL citing the boot/runfile timeout, 3/3, right-reason
  3/3.
- `runtime-probe-mismatch` — the server boots, but the `/widgets` route
  hand-rolls a stale `{ widget: <first> }` shape instead of calling the
  correct, unit-tested `buildWidgetsPayload()`; no test drives `/widgets`
  over real HTTP so the unit suite passes and the AC reads as met on paper.
  Expected/measured FAIL citing the `/widgets` probe's expected-vs-observed
  body, 3/3, right-reason 3/3.

Real-spawned the live `agentheim:verifier` (opus-pinned) k=3 per fixture (9
total real spawns). All 9 runs matched their fixture's `expected.json`
exactly on the first pass — no fixture-correction cycle was needed (unlike
v3h6p's `clean` v1→v2 fix). Teardown (`stop`) was confirmed clean on every
run, including after the boot failure and the probe mismatch, satisfying
ADR-0036 pt 3's unconditional-teardown requirement. Full numbers recorded in
`evals/verifier-catch-rate/results/2026-07-04-run.md`'s addendum section and
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md`'s addendum
section; `evals/verifier-catch-rate/README.md`'s "Known gaps" and "Results"
sections updated to reflect check 8 now being measured (combined dataset of
record: 36 scored real verifier spawns across 12 fixtures, 100% catch rate,
100% right-reason rate, 0% false-FAIL, 0 verdict variance). The original 9
fixtures and their recorded numbers are untouched (verified via `git
status` — only additive new directories plus the three doc files above).

No ADR was warranted — ADR-0036 already governs the manifest/check-8 shape;
this task only builds fixtures against the existing, ratified design.
</content>
</invoke>
