---
id: infrastructure-009
title: Add a test seam for slash-command card invocation (catch project-relative launcher paths)
status: done
type: chore
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: ac9ae4d
depends_on: []
blocks: []
tags: [dashboard, command, launcher, testing, plugin]
related_adrs: [ADR-0002]
related_research: []
prior_art: [infrastructure-008, infrastructure-004]
---

## Why

infrastructure-008 fixed the `/dashboard` command card so it invokes `launch.mjs` by its
plugin-rooted path (`node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"`) instead of a
bare project-relative `node dashboard/launch.mjs`, which broke in every foreign consumer
project. That bug — and its sibling infrastructure-004 — were both "project-root
assumption" regressions that **no test would have caught**: the command card is markdown
prose with no automated invocation check, and the launcher's printed hint was a plain
string. The fix was verified by an ad-hoc end-to-end simulation, not a committed test, so
the next edit to the card can silently reintroduce the same class of bug.

## What

Add a **stdlib-only** test seam — committed, both static and executable — that guards the
dashboard launcher invocation against the project-relative-path regression class:

1. **Static command-card guard** — `dashboard/test/command-card.test.mjs`: read
   `commands/dashboard.md`, extract the fenced `node ...launch.mjs` lines, and assert:
   - all three verbs are present (launch / stop / status);
   - every launcher invocation carries a `${CLAUDE_PLUGIN_ROOT...}` prefix — no bare
     `node dashboard/launch.mjs`;
   - no `cd` directive in the card (the launcher must run from the consumer-project cwd).

2. **Launcher hint-string guard** — assert `launch.mjs`'s user-facing printed hint strings
   do not reference a bare project-relative `node dashboard/launch.mjs` invocation (the
   stop-hint infrastructure-008 corrected to `/dashboard stop`). Same project-relative-path
   class as the card bug, one layer over: a future edit could reintroduce a misleading hint.
   May live in `command-card.test.mjs` or a sibling — worker's call.

3. **Foreign-project integration test** — `dashboard/test/foreign-launch.test.mjs`: create a
   temp project containing only `.agentheim/` (no `dashboard/`), export `CLAUDE_PLUGIN_ROOT`
   pointing at the repo, run the **exact card command form** for launch → status → stop with
   cwd in the temp project, and assert: launch succeeds, the **runfile lands under the temp
   project's** `.agentheim/.dashboard/`, status reports running, stop tears it down. This
   makes the hand-run infrastructure-008 simulation permanent. It **must clean up** (stop the
   server via the launcher's own `stop` path + remove the temp dir) in a `finally`, so a
   failed assertion never orphans a detached process or leaks a temp project.

## Acceptance criteria

- [ ] A committed **static** test fails if `commands/dashboard.md` reintroduces a
      project-relative launcher path, or drops one of the three verbs (the
      infrastructure-008 regression).
- [ ] A committed test fails if `launch.mjs` prints a project-relative
      `node dashboard/launch.mjs` invocation hint.
- [ ] A committed **integration** test launches the dashboard in a temp foreign project
      (`.agentheim/` only, no `dashboard/`) via the plugin-rooted command form and asserts
      the runfile lands under that project; status and stop work; the test cleans up the
      process and temp dir even on assertion failure.
- [ ] All tests are **stdlib-only** (`node:test`, `node:assert`, `node:fs`,
      `node:child_process`, …) — no new dependency, consistent with ADR-0002's
      zero-dependency rule.
- [ ] Runs green in the existing `node --test "dashboard/test/*.test.mjs"` suite on **Windows
      and POSIX**.

## Notes

Filed by the infrastructure-008 worker as a TDD-skip follow-up; refined 2026-06-08 to commit
to **both** the static guard and the integration test (the manual 008 simulation made
permanent), and to extend the static guard to the launcher's printed hint strings.

- The risk area is the integration test's **detached-process teardown**: launch spawns a
  detached, `unref`'d process (ADR-0002) on an ephemeral port; the test must stop it via the
  launcher's own `stop` path (which reads the runfile) and remove the temp dir in a `finally`,
  so a failed assertion never orphans a server or leaks a temp project. Windows
  `process.kill` / `taskkill` semantics (ADR-0002) are the cross-platform edge to watch.
- Prior art: **infrastructure-008** (the fix this guards) ran the simulation by hand in a
  temp foreign project — reuse that shape. **infrastructure-004** is the sibling project-root
  regression one layer down (module-relative asset resolution).
- Governing decision: **ADR-0002** (Node-stdlib, zero-dependency runtime; walk-up-from-cwd
  project discovery). This task adds no decision — it makes an existing contract testable —
  so no ADR.

## Outcome

Added a committed, stdlib-only test seam (8 new tests) guarding the dashboard launcher
invocation against the project-relative-path regression class. All 132 dashboard tests
green on Windows; written separator-agnostic for POSIX.

- `dashboard/test/command-card.test.mjs` — static guard over `commands/dashboard.md`:
  asserts all three verbs (launch/stop/status) present, every launcher invocation carries a
  `${CLAUDE_PLUGIN_ROOT...}` prefix, no `cd` directive, and `launch.mjs` prints no bare
  `node dashboard/launch.mjs` hint string. Includes Red-proof unit cases that exercise the
  extractor/predicate against deliberately-bad (pre-008) card samples. Verified genuinely
  Red by a temporary real card mutation (`status` verb made project-relative → 1 failure;
  card restored byte-exact).
- `dashboard/test/foreign-launch.test.mjs` — foreign-project integration test: creates a
  temp project with only `.agentheim/`, runs the EXACT card command form via `bash -c`
  (authentic `${CLAUDE_PLUGIN_ROOT:-.}` expansion) with `CLAUDE_PLUGIN_ROOT`=repo and cwd in
  the temp project, asserts launch succeeds (no module-not-found), runfile lands under the
  FOREIGN project's `.agentheim/.dashboard/`, status reports running, stop tears it down.
  Mandatory teardown (launcher's own stop path + temp-dir removal) in `finally` — no orphaned
  detached process, no leaked temp dir on assertion failure. Skips cleanly (no false-fail) if
  bash is unavailable. Makes the hand-run infrastructure-008 simulation permanent.
- `dashboard/test/helpers/card.mjs` — extracted pure helpers
  (`extractLauncherInvocations` / `verbOf` / `isPluginRooted`) shared by both test files,
  placed outside `*.test.mjs` so cross-import never double-registers tests under `node --test`.
- Infrastructure BC README updated to note the contract is now test-guarded.
