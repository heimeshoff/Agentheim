---
id: ADR-0045
title: Protocol rotation trigger — work's session-end check, closing ADR-0039's deferred invocation-point non-decision
scope: agentic-workflow
status: accepted
date: 2026-07-04
related_tasks: [agentic-workflow-v8n3t, agentic-workflow-r2c7m]
related_adrs: [0039, 0041, 0038]
---

# ADR-0045: Protocol rotation trigger — work's session-end check

## Context

ADR-0039 fixed `rotateProtocol`'s mechanism (verbatim monthly archive, live-file cap, git-free,
month derived from entry headings) but explicitly deferred *who invokes it* to a follow-on task
("Non-decisions (deferred)" / "Wire rotation into `work`'s session-end step as part of this
task. Deferred, not rejected."). Nothing ever picked that up: by the time
`agentic-workflow-v8n3t` was captured, the live `.agentheim/knowledge/protocol.md` had grown to
7,161/7,187 lines against the ~1,000-line steady-state cap, and no
`.agentheim/knowledge/protocol/` archive directory existed. The cap was doctrine on paper only —
exactly the audit gap the 2026-07-04 harness-audit follow-up flagged.

ADR-0041's cap-and-roll doctrine already characterizes this class of artifact ("no human in
loop, self-firing... fires itself") — the missing piece was purely a call site, not a new
mechanism or a policy change.

## Decision

**`work`'s end-of-run flow invokes `rotateProtocol` once per session, immediately after step 7's
session-end protocol entry has been prepended and committed** (`skills/work/SKILL.md`, a new
"Protocol rotation check (session-end)" step + dedicated section, mirroring the existing
"Vision-conformance check (session-end)" pattern).

Why this point in the flow:

1. **It's the moment the file has just grown.** The session-end entry is the last write to
   `protocol.md` in a normal session — checking right after it means rotation reacts to the
   session's own growth immediately, rather than waiting for some future session to notice.
2. **It already sits at a natural end-of-run seam.** `work` already runs two other session-end
   passes here (vision-conformance, carry-over reconciliation) — adding a third cheap,
   deterministic check costs nothing structurally new.
3. **One call site, not three.** The task's own "alternatives to weigh" considered a
   session-*start* check duplicated across every protocol-writing skill (`work`/`modeling`/
   `research`) — rejected as tripling the call sites for a check that's just as effective run
   once, at the one skill (`work`) whose sessions are both the most frequent protocol-writer and
   already the site of the biggest single-session entry volume (a batch's per-task commits).
4. **It honors ADR-0041's self-firing framing.** No human decision is needed to fire it — it's a
   cheap boolean (`rotated: true/false`) checked every session, not a flagged judgment call a
   human must act on (that's the FLAG-AND-CONSOLIDATE discipline, reserved for prose artifacts
   like the BC README).

### Mechanics (ADR-0038 three-layer boundary preserved)

- **The script stays git-free** (unchanged from ADR-0039) — `rotateProtocol` never shells out to
  `git`.
- **The skill owns the git write.** `work`'s new step invokes the script via the standard
  env-free plugin bootstrap (`lib/resolve-plugin-file.mjs`'s homedir→cache→semver-max pattern,
  the same shape the `claim`/`complete` CLI invocations already use) so the trigger resolves
  correctly from an installed-plugin consumer, not just this repo. It prints the manifest
  `{ok:true, rotated, changed:[paths], rolledMonths, liveLines}` on stdout.
- **`rotated: false`** (the common case) → no-op: no commit, no protocol entry. The check must be
  invisible on every session that doesn't need it.
- **`rotated: true`** → `git add` exactly the manifest's `changed` paths (the rewritten
  `protocol.md` plus every archive file it lists) — never `git add -A` — and commit as its own
  scoped commit, separate from the session-end entry's own commit:
  `chore(agentic-workflow): rotate protocol — <rolledMonths> [<last-task-id>]`.
- **No new protocol log entry for the rotation itself.** Logging "rotation ran" as a diary line
  would itself be a write to the very file being capped — the commit message and manifest are
  the audit trail, spot-checkable against `git log` and the archive files' content.

### Scope boundary — INDEX done-list rotation is a documented follow-up, not this decision

`agentic-workflow-c8j3w`'s `rotateIndexDoneList` (`lib/index-rotation.mjs`) is the sibling
cap-and-roll surface for a BC's `INDEX.md` done-list and shares the exact same trigger-less gap
this ADR closes for `protocol.md`. This ADR does **not** wire that trigger — `v8n3t`'s task scope
was protocol rotation only, and INDEX rotation carries an extra wrinkle (`modeling`'s prior-art
matcher reads the done-list, so its rotation trigger needs its own reachability reasoning, not a
copy-paste of this ADR's mechanics). A follow-up backlog item captures this rather than silently
widening this task.

## Alternatives considered

- **Session-start check in every protocol-writing skill (`work`, `modeling`, `research`).**
  Rejected — catches growth even in a session that never reaches its own end-of-run step (e.g. an
  interrupted session), but triples the call sites for a check whose cost/benefit doesn't need
  that redundancy: `work` sessions are both frequent and the dominant source of entry volume, and
  an interrupted session simply defers the check to the next session that does reach end-of-run,
  which is an acceptable steady-state approximation (the same posture ADR-0039 §"Consequences"
  already accepts for the current-month-never-rolls cap itself).
- **A manual maintenance verb only (no automatic call site).** Rejected — this is exactly the
  status quo that produced the 7,161-line live file with zero archive files; a manual-only verb
  reproduces the "nothing ever runs it" failure this ADR exists to fix.
- **Wiring the INDEX done-list rotation trigger in the same task/ADR.** Rejected (deferred, not
  ruled out) — `c8j3w`'s reachability constraint (the `modeling` prior-art matcher's read
  dependency on the done-list) means that trigger needs its own design pass, not this ADR's
  copy-pasted mechanics; scoping it in here would either under-design that surface or blow this
  task's boundary. Captured as a follow-up backlog item instead.

## Consequences

**Positive:** ADR-0039's deferred non-decision is now closed; the cap is enforced in practice on
every `work` session, not just stated in doctrine. The mechanism is unchanged and its existing
test coverage (`lib/test/protocol-rotation.test.mjs`) needs no modification — this decision is
purely a new call site in skill prose.

**Negative:** a session that never reaches `work`'s end-of-run step (e.g., killed mid-batch, or a
session that only ever runs `modeling`/`research` and never `work`) still leaves the file
uncapped until a future `work` session runs to completion. Accepted as a steady-state
approximation, consistent with ADR-0039's own acceptance of current-month overshoot.

**Neutral:** the sibling INDEX done-list rotation trigger remains unwired; a follow-up backlog
item exists to pick it up.
