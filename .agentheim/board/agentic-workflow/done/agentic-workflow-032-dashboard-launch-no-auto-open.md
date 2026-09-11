---
id: agentic-workflow-032
title: Dashboard launch no longer auto-opens the browser
status: done
type: chore
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 74f23cf
depends_on: []
blocks: []
tags: [dashboard, launch]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-011]
---

## Why
Starting the dashboard server currently hijacks the default browser — it spawns
an OS-native opener at the served URL on every `launch`. The builder doesn't want
that side effect: starting the server and opening a tab are separate decisions,
and the auto-open is unwanted (steals focus, opens a tab the builder may not need,
and is noisy when the dashboard is already running and just being re-launched).

## What
Remove the automatic browser-open from the dashboard launch path. After this
change, `launch` starts (or reuses) the detached server and prints the URL, but
does **not** open a browser — the builder opens the printed URL themselves.

The auto-open lives in `dashboard/launch.mjs`:
- The CLI `launch` branch calls `openBrowser(url)` and prints
  `Opening it in your default browser…` (around `launch.mjs:169-170`).
- `openBrowser`, `browserCommand`, and the OS-divergent opener notes are the
  supporting machinery.

Remove the `openBrowser(url)` call and the "Opening it in your default browser…"
line from the CLI block. The `openBrowser` / `browserCommand` helpers may be
deleted along with their tests if nothing else references them — confirm no other
caller exists before removing, otherwise just drop the CLI invocation.

## Acceptance criteria
- [ ] Running `launch` (fresh or `reused`) does not spawn any browser opener.
- [ ] The launch output still prints the served URL, pid, and the stop hint;
      the "Opening it in your default browser…" line is gone.
- [ ] No dead/unreferenced `openBrowser` machinery is left behind: either it is
      removed entirely (with its tests), or a remaining caller is documented.
- [ ] `dashboard/` test suite stays green (update or remove the browser-open
      tests to match the new behavior).

## Notes
- This reverses the auto-open delivered by **agentic-workflow-011**
  ("/dashboard command — launch, stop, status, auto-open").
- Scope confirmed with the builder: **remove entirely**, not an opt-in `--open`
  flag. If a future need for opt-in opening arises, that's a separate capture.
- `stop` and `status` branches are untouched.
- Read-only/lifecycle invariants are unaffected (this is launch UX only); no ADR
  expected — but if removing the opener turns out to reopen a launch-behavior
  decision, fold a short ADR into the commit.

## Outcome
Removed the dashboard launch auto-open entirely. The CLI `launch` branch now prints the
served URL + pid + stop hint and returns; it no longer spawns a browser opener. The
`openBrowser` / `browserCommand` helpers (added by aw-011) had no other production caller,
so both were deleted from `dashboard/launch.mjs` along with their auto-open / per-platform /
detached-spawn / error-swallow tests in `dashboard/test/status-open.test.mjs`. The
`status`-verb tests stay intact; a new guard asserts `openBrowser`/`browserCommand` are no
longer exported. `stop` and `status` branches untouched.

No ADR needed — launch UX only, no read-only/lifecycle invariant touched. Docs updated:
`dashboard/README.md` (usage line, launch-behavior paragraph, module-map entry) and the BC
README's dashboard paragraph.

Key files:
- `dashboard/launch.mjs` — removed `openBrowser`/`browserCommand`, removed the CLI auto-open
  call + "Opening it in your default browser…" line, updated the header comment.
- `dashboard/test/status-open.test.mjs` — dropped opener tests, added the not-exported guard.

Tests: full `dashboard/` suite green (304 pass); the lone `events.test.mjs` SSE-watcher
failure is the documented pre-existing flake — passes in isolation, unrelated to this change.
