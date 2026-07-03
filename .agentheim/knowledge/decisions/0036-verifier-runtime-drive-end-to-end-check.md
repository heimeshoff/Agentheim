---
id: ADR-0036
title: Verifier runtime-drive check — boot-and-observe the app end-to-end in its worktree
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-j7d4k, agentic-workflow-y8b4q]
related_adrs: [0002, 0004, 0017, 0032]
---

# ADR-0036: Verifier runtime-drive check — boot-and-observe the app end-to-end in its worktree

> `related_tasks`: `agentic-workflow-j7d4k` (ratify this ADR) blocks
> `agentic-workflow-y8b4q` (implement the check). These are the split of the
> original y8b4q "end-to-end verification step" capture. **Ratified** via the
> j7d4k decision task (see the Ratification note below) — status `accepted`. It
> was pre-written during the y8b4q refine (the ADR-0034 / r9k2p precedent), from an
> architect design; the three directional choices below (verifier drives / tiered
> observation / diff-path trigger) were confirmed as recommended, unchanged, at
> ratification.

## Context

Verification stops at the unit suite. Both `agents/verifier.md` (check 1) and
`skills/verification-before-completion/SKILL.md` (check 1) accept a worker's
self-reported *"manually exercised"* note as sufficient evidence for UI tasks — a
fresh-eyes gate that never runs the app or sees the screen. Nothing ever boots the
runtime surface and observes the change end-to-end. This is the softest spot in the
verification story and the one the vision most directly indicts: an agreeable agent
reporting shallow work as done, accepted on its word.

Since ADR-0032 the verifier already runs inside a per-worker git worktree with its
Bash tool, and `dashboard/launch.mjs` (ADR-0002, ADR-0004) already boots the
read-only dashboard server (ADR-0017) detached, with `cwd: tmpdir()` (ADR-0004) so
it never locks the project. **Corrected at ratification:** the launcher's port is
*not* ephemeral `:0` today — ADR-0002's infrastructure-018/019 addenda changed it to
a **deterministic, project-root-derived, last-good-sticky** port (with a bounded
8-rung ladder on collision), so that browser `localStorage` (theme, board
view-state, skip-permissions) survives relaunch. Every primitive a boot-and-observe
check needs still exists and is OS-centralized in the launcher — the child spawn,
the detached lifecycle, the neutral cwd, the runfile — but isolation across parallel
worktree drives rests on **distinct worktree roots deriving distinct ports** (ADR-0032
gives each worktree its own absolute path, so the ADR-0002 hash input differs) plus
the ladder, not on a literal ephemeral bind. See Decision point 4.

## Decision

Add a runtime-drive check to the verifier and a per-BC **runtime-surface manifest**
that `work` resolves once per batch, mirroring the pre-resolved test command.

1. **Manifest.** A `## Runtime surface` fenced block in each BC README declares
   `surfacePaths` (allowlist globs), `launch`, `stop`, `probes` (endpoint + expected
   status/shape), and optional `renderPaths`. Absent manifest → the BC has no runtime
   surface. Everything outside `surfacePaths` is exempt **by default** — this is the
   docs/doctrine carve-out, emergent from the allowlist, not a second list to sync.

2. **Resolution.** `work` parses the manifest once per batch per BC (cached, reused
   across FAIL iterations like the test command) and passes it as a new
   `## Pre-resolved launch command` block into every verifier spawn; `none` when the
   BC declares no surface.

3. **Check 8 "Runtime drive" (new, final check).** Fires only when the diff touches a
   `surfacePath`. Boots via `launch` from the worktree root, asserts the **HTTP floor**
   (all `probes` — loopback GET, status + declared body shape, via Node stdlib), and —
   only when the task frontmatter carries `runtime_render: true` **and** a browser
   capability is present — runs the render tier. **Guarantees teardown** by delegating
   to `stop`. Any floor miss or boot failure → **FAIL** citing the probe (expected vs
   observed), `ITERATION_HINT: likely-fixable`. Placed **last** because it is the most
   expensive check and the verifier stops at the first failure.

4. **Isolation (revised at ratification).** The manifest's `launch` command MUST bind a
   port **unique per worktree**, and the runtime-drive check MUST read the *actual*
   bound port from the launcher's runfile (`runtime.json` for the dashboard BC; the
   equivalent for any other BC's `launch`) rather than assume a fixed or derived value —
   because a ladder fallback can move it. For BCs (like the dashboard) whose existing
   launcher derives its port from the worktree's own absolute root (ADR-0002 §infra-018/019),
   this per-root derivation already delivers practical (low-but-nonzero-collision, ladder-backed)
   isolation with **zero new infra**, which is preferred over forcing a verification-only
   ephemeral-`:0` override — that would fork the launcher's port logic and contradict this
   ADR's own thesis of reusing the existing launcher unchanged. A manifest author MAY still
   choose true ephemeral `:0` for a BC's `launch` as a stronger guarantee; it is not required.
   Keep `cwd: tmpdir()` (ADR-0004) so a leaked server can never wedge
   `git worktree remove --force`.

5. **No new mandatory dependency.** The HTTP floor is stdlib-only and **required** for
   every runtime surface. The render tier is opt-in per task and runs only against a
   browser capability **already present**; absent it, the floor is asserted and only the
   visual-DOM delta falls back to the manual note.

6. **Doctrine rewrite.** In both `verifier.md` check 1 and the SKILL, the manual-exercise
   carve-out is **narrowed**: a manual note covers only the visual-DOM delta when render
   infra is absent, and **never** substitutes for the HTTP floor.

"Read-only" continues to mean no Write/Edit and no git-write; spawning a read-only
server and killing it is the same category as running the test suite via Bash, which the
verifier already does.

## Consequences

**Positive** — the fresh-eyes gate now actually runs the app; the largest self-report
hole closes; zero new mandatory infra; parallel-safe by reusing ADR-0032/0002 isolation;
the trigger is a one-line allowlist that can't rot far from the README prose describing
it.

**Negative** — one more expensive check per runtime-touching task; a per-BC manifest to
maintain; the render tier remains best-effort where no browser exists.

**Neutral** — worker rules unchanged; verifier tool list unchanged (already has Bash);
all OS divergence stays inside `dashboard/launch.mjs`.

## Alternatives considered

- **`work` drives, hands an artifact to the verifier.** Rejected as the default —
  separates drive from judge but adds a runtime-drive responsibility the conductor owns
  none of today, and the verifier already has Bash + the worktree. (Revisit if verifier
  spawn cost proves too high.)
- **The worker drives in its TDD loop; verifier only inspects the recording.** Rejected —
  re-introduces the exact self-report weakness this ADR closes; the gate must see the
  screen itself.
- **Fixed literal port for the drive (same port for every worktree).** Rejected —
  reintroduces the cross-worktree race ADR-0032 removed. (Corrected at ratification:
  the launcher's actual per-BC port need not be literally ephemeral — see Decision
  point 4 — but it must vary per worktree, which either a true ephemeral `:0` bind or
  ADR-0002's per-root derivation + ladder both satisfy; a shared literal does not.)
- **Mandatory headless browser for all UI tasks.** Rejected — violates the
  no-heavy-dependency constraint; the HTTP floor catches boot/build/shape breaks with
  zero deps, render is opt-in.
- **Denylist of exempt paths.** Rejected — rots; an allowlist of surface globs makes
  docs/doctrine exempt by default.
- **A new drive-runner agent.** Rejected — the verifier already has Bash and the worktree;
  a second agent adds a spawn and splits the single fresh-eyes gate.

## Open questions — resolved at ratification (agentic-workflow-j7d4k)

- **Manifest home: BC README fenced block.** Confirmed as recommended. A `## Runtime
  surface` fenced block in the BC's `README.md` is the single source of truth; `work`
  parses that block's fence contents (a small line-based `key: value` / list format,
  not a separate file) once per batch per BC, exactly as it already resolves the
  pre-loaded test command. No dedicated `runtime-surface.yml` — one fewer file to keep
  in sync with the README prose describing the surface.
- **Boot timeout → FAIL.** Confirmed as recommended. A clean worktree (committed base +
  this task's diff only, per ADR-0032) that fails to boot is a real defect, not
  environmental flakiness — the isolation ADR-0032 guarantees removes the "noisy
  neighbor" excuse a SKIP-with-note would otherwise paper over. No grace/retry path;
  FAIL cites the timeout plainly (`ITERATION_HINT: likely-fixable`, per Decision point 3).
- **Render-tier assertion shape (DOM vs screenshot) — deferred.** Confirmed out of scope
  for this ADR. The render tier remains opt-in (`runtime_render: true` + browser
  capability present) and its assertion shape is left to a follow-up ADR once a concrete
  browser capability lands in the harness. This ADR fixes only the HTTP-floor contract as
  mandatory.

## Ratification note (agentic-workflow-j7d4k)

Reviewed against ADR-0002 (including its infra-018/019 addenda), ADR-0004, ADR-0017, and
ADR-0032. Findings:

- **The three directional decisions are confirmed as designed, unchanged:** verifier
  drives (extends the verifier's ordered checks, Decision point 3); tiered observation
  (mandatory stdlib HTTP floor + opt-in capability-gated render tier, points 3/5); diff-path
  allowlist trigger (`surfacePaths` manifest, points 1/3). None of these three choices
  depended on the stale claim found below, and each still holds against the alternatives
  the ADR itself rejects.
- **One factual staleness found and corrected, not a ratification blocker.** The Context
  cited `dashboard/launch.mjs` as already binding "an ephemeral loopback port," and
  Decision point 4 required every manifest `launch` to preserve that ephemeral bind.
  Direct inspection of ADR-0002 shows two later addenda (infrastructure-018,
  infrastructure-019) changed the *actual* dashboard launcher to a **deterministic,
  project-root-derived, last-good-sticky** port (for origin-keyed `localStorage`
  persistence), not ephemeral `:0`. Consulted `architect` directly (single-specialist,
  transport question under ADR-0002) to confirm the fix: since each ADR-0032 worktree has
  a distinct absolute root, the existing per-root derivation already gives
  low-but-nonzero-collision isolation (backed by the 8-rung ladder) with **zero new
  infra** — cleaner than forcing a verification-only ephemeral override that would fork
  the launcher's port logic and undercut this ADR's own "reuse the launcher unchanged"
  thesis. Context, Decision point 4, and the "Fixed port" alternative are corrected
  in-place above to state the real requirement: the `launch` command must bind a port
  **unique per worktree** (ephemeral or derived, either satisfies it) and the check reads
  the actual bound port from the launcher's runfile, never an assumed value. The
  `cwd: tmpdir()` claim is confirmed **accurate** (verified directly in
  `dashboard/launch.mjs`) but was mis-cited to ADR-0002; corrected to ADR-0004 (now added
  to `related_adrs`), whose own status is `proposed` — a pre-existing gap in that ADR, out
  of this task's scope to ratify.
- **Open questions settled** as recorded above: manifest home = BC README fenced block;
  boot timeout = FAIL, no grace path; render-tier assertion shape deferred to a follow-up
  once a browser capability exists.
- `related_tasks` already names the real child ids (`agentic-workflow-j7d4k`,
  `agentic-workflow-y8b4q`); no placeholder ids found.

**y8b4q re-synced.** y8b4q's AC #56 and its "worktree interaction" Notes paragraph did bake
in the stale "ephemeral loopback port (no fixed port)" claim as literal acceptance
criteria/rationale — edited in place to the corrected requirement (unique port per
worktree via either the dashboard's existing per-root-derived+ladder bind or a true
ephemeral override; read the actual bound port from the runfile, never assume it). No
other AC, the manifest shape, or the check's placement/behavior changed.

Verdict: **ratified — status set to `accepted`.**
</content>
</invoke>
