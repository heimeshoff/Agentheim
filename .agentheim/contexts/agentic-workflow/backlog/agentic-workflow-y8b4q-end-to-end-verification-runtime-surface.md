---
id: agentic-workflow-y8b4q
title: End-to-end verification step for tasks with a runtime surface
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-j7d4k]
blocks: []
tags: [harness-audit, verifier, verification, e2e, ui]
related_adrs: [0036, 0002, 0017, 0032]
related_research: []
prior_art: []
---

## Why

Verification stops at the unit-test suite — no step ever *runs the app* and observes
the change end-to-end. The UI-task carve-out is the softest spot: a worker's
self-reported "exercised manually" note is accepted as evidence by a verifier who never
sees the screen (`agents/verifier.md` check 1, and the same carve-out in
`skills/verification-before-completion/SKILL.md`). The What-loop is strong on inner
execution, weak on closure. (Harness audit 2026-07-02, Phase 1 + recommendation #10.)

## What

Add a **runtime-drive check** to the verifier that boots the app and observes the change
end-to-end for tasks touching a runtime surface, replacing the self-reported manual note
as sufficient evidence. The design is ADR-0036 (whose ratification is the blocking
decision task **agentic-workflow-j7d4k** — do not work this until that ratifies, since it
may shift the shape below). In outline:

1. **Per-BC runtime-surface manifest** — a `## Runtime surface` fenced block in the BC
   README declaring `surfacePaths` (allowlist globs), `launch`, `stop`, `probes`
   (endpoint + expected status/body-shape), optional `renderPaths`. Absent manifest → the
   BC has no runtime surface; nothing outside `surfacePaths` triggers the check.
2. **`work` pre-resolves it** once per batch per BC and passes a `## Pre-resolved launch
   command` block into the verifier spawn — mirroring the existing `## Pre-resolved test
   command` seam (reused across FAIL iterations, never re-hunted).
3. **Verifier check 8 "Runtime drive"** (new final check) — fires only when the diff
   touches a `surfacePath`; boots from the worktree root, asserts the HTTP floor, runs the
   opt-in render tier only when `runtime_render: true` + a browser capability is present,
   and **always tears down** by delegating to `stop`. Floor miss or boot failure → FAIL
   citing the probe.
4. **Doctrine narrowed** — the manual-exercise carve-out in both `verifier.md` and the
   SKILL shrinks to "covers only the visual-DOM delta, only when render infra is absent,
   never substitutes for the HTTP floor."

## Acceptance criteria

- [ ] A task whose diff touches a `surfacePath` gets an observable end-to-end HTTP-floor check as part of verification (server boots from the worktree, declared `probes` assert status + body shape), not just the unit suite.
- [ ] The worker's "manually exercised" self-report is no longer sufficient on its own for a runtime-surface change — the doctrine carve-out in `agents/verifier.md` (check 1) and `skills/verification-before-completion/SKILL.md` is narrowed accordingly.
- [ ] Tasks with no runtime surface (docs, doctrine, pure refactors, any diff touching no `surfacePath`) trigger no drive — exempt by default, no cargo-cult ceremony.
- [ ] `work` resolves the runtime-surface manifest once per batch per BC and passes a `## Pre-resolved launch command` block into the verifier spawn; the verifier consumes it without re-hunting (parity with the pre-resolved test command).
- [ ] The drive works from inside a per-worker `aw/<id>` worktree (ADR-0032): boots on the launcher's ephemeral loopback port (no fixed port), and teardown is guaranteed via `stop` so a leaked server never wedges the batch. A boot from a clean worktree that never binds → FAIL.
- [ ] The render tier is opt-in (`runtime_render: true` + an already-present browser capability) and mandates no new heavy dependency; the HTTP floor is stdlib-only. Absent render infra, only the visual-DOM delta falls back to the manual note.
- [ ] The agentic-workflow BC README carries a `## Runtime surface` manifest for the dashboard (`surfacePaths`, `launch`/`stop` via `dashboard/launch.mjs`, and `probes` for at least the read endpoints — e.g. `/api/tree`).
- [ ] The verifier stays read-only (no Write/Edit, no git-write) and its strict PASS/FAIL/SKIP verdict format is unchanged, so `work` still parses it deterministically.

## Notes

**Blocked on ADR-0036 ratification (agentic-workflow-j7d4k).** The three directional
choices baked into the AC above are recommended defaults, unconfirmed by the builder at
refine time (they were away): verifier drives (vs `work`/worker), tiered HTTP-floor +
opt-in render (vs HTTP-only or mandatory browser), diff-path trigger (vs frontmatter flag
or verifier judgment). If ratification overturns any, re-sync these criteria.

**Why the worktree interaction is not a blocker (ADR-0032 already designed it out):** the
launcher spawns the server with `cwd: tmpdir()` — so even a leaked process holds no lock
that could wedge `git worktree remove --force` — and binds an ephemeral `127.0.0.1` port,
so parallel worktree drives never collide and no Windows firewall prompt fires. The
dashboard server is stdlib-only, so the HTTP floor boots without `node_modules`; only the
render tier needs the ADR-0032 node_modules junction, which is already linked whenever a
`dashboard/` diff is in play.

**Cross-OS:** all OS-divergent boot/teardown stays inside `dashboard/launch.mjs`
(ADR-0002) — the verifier must delegate boot and teardown to the launcher, never
hand-roll a `process.kill`, to stay OS-agnostic.

**Files the implementing worker will touch:** `agents/verifier.md` (insert check 8;
narrow check 1; add the `## Pre-resolved launch command` input), `skills/verification-before-completion/SKILL.md`
(narrow the carve-out, add the check to the ordered list), `skills/work/SKILL.md` (launch-descriptor
resolution beside the test-command resolution; add the block to the verifier spawn template),
the agentic-workflow BC README (`## Runtime surface` manifest). No change to
`dashboard/launch.mjs` for the HTTP floor — it already returns `{action, pid, port}` and
supports `stop`.

**Possible sub-split** if one worker finds it too large: (a) manifest + `work` resolution +
the pre-resolved block + trigger, then (b) verifier check 8 + doctrine rewrite depending on (a).

Pairs with **agentic-workflow-v3h6p** (eval-harness the verifier): once this check exists,
the eval can measure whether the runtime drive actually catches planted runtime/UI defects.
</content>
