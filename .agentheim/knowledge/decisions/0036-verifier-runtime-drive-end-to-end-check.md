---
id: ADR-0036
title: Verifier runtime-drive check — boot-and-observe the app end-to-end in its worktree
scope: agentic-workflow
status: proposed
date: 2026-07-03
related_tasks: [agentic-workflow-j7d4k, agentic-workflow-y8b4q]
related_adrs: [0002, 0017, 0032]
---

# ADR-0036: Verifier runtime-drive check — boot-and-observe the app end-to-end in its worktree

> `related_tasks`: `agentic-workflow-j7d4k` (ratify this ADR) blocks
> `agentic-workflow-y8b4q` (implement the check). These are the split of the
> original y8b4q "end-to-end verification step" capture. This ADR is **proposed**
> — the j7d4k decision task is the builder's review-and-ratify gate. It was
> pre-written during the y8b4q refine (the ADR-0034 / r9k2p precedent), from an
> architect design; the three directional choices below (verifier drives / tiered
> observation / diff-path trigger) are recommended defaults the builder still
> confirms at ratification.

## Context

Verification stops at the unit suite. Both `agents/verifier.md` (check 1) and
`skills/verification-before-completion/SKILL.md` (check 1) accept a worker's
self-reported *"manually exercised"* note as sufficient evidence for UI tasks — a
fresh-eyes gate that never runs the app or sees the screen. Nothing ever boots the
runtime surface and observes the change end-to-end. This is the softest spot in the
verification story and the one the vision most directly indicts: an agreeable agent
reporting shallow work as done, accepted on its word.

Since ADR-0032 the verifier already runs inside a per-worker git worktree with its
Bash tool, and `dashboard/launch.mjs` (ADR-0002) already boots the read-only
dashboard server (ADR-0017) detached, on an **ephemeral loopback port**, with
`cwd: tmpdir()` so it never locks the project. Every primitive a boot-and-observe
check needs already exists and is OS-centralized in the launcher.

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

4. **Isolation.** Keep the launcher's ephemeral loopback port (**never** a fixed port)
   so parallel worktree drives never collide; keep `cwd: tmpdir()` so a leaked server
   can never wedge `git worktree remove --force`.

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
- **Fixed port for the drive.** Rejected — reintroduces the cross-worktree race ADR-0032
  removed; ephemeral loopback is already collision-free.
- **Mandatory headless browser for all UI tasks.** Rejected — violates the
  no-heavy-dependency constraint; the HTTP floor catches boot/build/shape breaks with
  zero deps, render is opt-in.
- **Denylist of exempt paths.** Rejected — rots; an allowlist of surface globs makes
  docs/doctrine exempt by default.
- **A new drive-runner agent.** Rejected — the verifier already has Bash and the worktree;
  a second agent adds a spawn and splits the single fresh-eyes gate.

## Open questions (resolve at ratification / implementation)

- Manifest home: BC README fenced block (recommended — single source next to its prose)
  vs a dedicated `runtime-surface.yml`. Confirm the parse target `work` will read.
- Boot timeout → FAIL or SKIP-with-note? Recommend FAIL (a clean worktree that won't boot
  is a real defect); the builder may prefer a grace path for a flaky first boot.
- When the render tier *does* run, does it assert DOM state or a screenshot diff? Out of
  scope for this seam — leave the render-probe shape to a follow-up once a browser
  capability actually lands.
</content>
</invoke>
