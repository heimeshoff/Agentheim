---
id: ADR-0039
title: Protocol rotation doctrine — verbatim monthly archive, live-file cap, newest-on-top preserved
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-r2c7m]
related_adrs: [0007, 0026, 0032, 0038]
---

# ADR-0039: Protocol rotation doctrine — verbatim monthly archive, live-file cap, newest-on-top preserved

## Context

`.agentheim/knowledge/protocol.md` is a prose, prepend-only, chronological diary that every
`work`/`modeling`/`whats-next` invocation prepends to and reads the top ~80–120 lines of for
"recent activity." It is unbounded and, at the time of this task, ~6,500 lines. Nothing —
`modeling`'s prior-art lookup, the dashboard search corpus, any skill's read path — does
keyword or prior-art lookup against `protocol.md`; every reader opens only the recent-activity
window. That makes rolling older entries out of the live file **lossless for every reader** —
the one property that made this the "simpler" of the three growth-surface rotations (the
other two: `[[agentic-workflow-c8j3w]]`'s INDEX done-list, which does carry a reachability
constraint since `modeling`'s prior-art matcher reads it, and `[[agentic-workflow-w7q2m]]`'s
README consolidation).

agentic-workflow-r2c7m's refinement fixed the mechanism, trigger, and archive shape as defaults
(recorded in the task's What section) but required a rotation-doctrine ADR be written during
work so `c8j3w` and `w7q2m` — both explicitly designed to reuse this convention rather than
invent their own — cite a stable decision of record instead of prose scattered across three
task files.

## Decision

### The convention

1. **Verbatim move, never rewrite.** An entry's raw text — its `## <date> -- <title>` heading
   line through its trailing separator, exactly as it sits in the live file — is relocated
   unchanged. No summarization, no reformatting, no re-encoding. This also makes rotation
   immune to whichever line-ending convention (`\n` vs `\r\n`) the live file happens to be
   checked out with, since the mechanism never reconstructs separators — it only slices and
   concatenates the file's own bytes.
2. **Archive granularity is monthly, dated files.** Older entries roll to
   `.agentheim/knowledge/protocol/YYYY-MM.md`, named by the calendar month of the entries they
   hold (derived from each entry's own `## YYYY-MM-DD...` heading, not the rotation run's
   clock).
3. **The live file is capped, not the archive.** `protocol.md` is capped at **N ≈ 1,000
   lines** — roughly 10x the ~100-line window every reader actually opens. This reconciles the
   task title's "monthly files" with the "under a cap" acceptance criterion: monthly is the
   *archive* granularity, the cap is the *live-file* guarantee.
4. **Whole months roll, never a split month.** Rotation only ever rolls a month that is no
   longer the *current* month (the month containing the newest entry). The current month is
   **never** rolled out, however large it grows — a live file can therefore temporarily exceed
   the cap if a single month's activity alone exceeds it; the doctrine treats the cap as a
   steady-state target, not a hard per-run bound. This also means a given month's archive file
   is written **exactly once**, in full, the first time rotation runs after that month has
   closed — no month is ever split across two archive-write operations under normal operation.
5. **Rolling is oldest-first and stops as soon as it can.** When the cap is exceeded, whole
   older months roll out oldest-first until the live file is back under the cap or only the
   current month remains — never further than necessary.
6. **Newest-on-top order is preserved everywhere.** The live file's ordering is untouched
   (only a suffix of it is removed). Inside each archive file, a month's entries keep their
   original relative order (newest-on-top within that month) — a skill reading a rolled month
   sees the same shape as it would have in the live file.
7. **Mechanism: a k5n8f-family script, not skill prose.** Rotation is `rotateProtocol(rootDir,
   opts)` in `lib/protocol-rotation.mjs` — stdlib-only, git-free (it never shells out to
   `git`), deterministic (same input → same output), returning an enumerated manifest
   `{ok:true, rotated, changed:[paths], rolledMonths:[...], liveLines}` for its caller to `git
   add` and commit. A thin `runCli`/`main` wrapper (mirroring `lib/task-lifecycle-cli.mjs`'s
   testable-CLI shape) makes it invocable as `node lib/protocol-rotation.mjs` directly. Unlike
   the task-lifecycle CLI, rotation takes no verb/id argv — it is a single, parameterless,
   idempotent operation over whatever `protocol.md` currently holds.
8. **Machine-readable `runs/` JSONL is explicitly out of scope** — a structured event stream is
   a live-observability concern belonging with `[[agentic-workflow-m9w5c]]`, not this
   verbatim-text rotation.

### Non-decisions (deferred)

This ADR does **not** decide when/how often rotation actually runs in practice (e.g. whether
`work`'s session-end step invokes it, or it's a periodic maintenance action) — that's an
invocation-point question for whichever future task wires it into a skill's flow. This task
ships the deterministic mechanism and its test coverage; it does not change any skill's runtime
behavior beyond the read-side pointer updates below.

## Consequences

**Positive:** one convention, cited by name, for all three growth-surface rotations
(`c8j3w`'s INDEX done-list, `w7q2m`'s README consolidation can point at "the same archive
shape" instead of re-deriving it). Verbatim-slice design makes the mechanism trivially testable
and immune to the CRLF/LF disagreement a Windows checkout (`core.autocrlf=true`) can introduce
into a live text file. No reader's behavior changes — the recent-activity read window is
unaffected by design (property established in the task's Why, restated here as the doctrine's
justification for lossless rotation).

**Negative:** if a single month's activity volume alone exceeds the cap, the live file exceeds
its stated cap until the month closes and a new rotation run fires — an accepted steady-state
approximation, not a hard bound. Any future reader that DOES need keyword/prior-art reach into
old protocol entries would need to also read the archive directory — none does today, but this
is now a documented constraint for any who might in the future.

**Neutral:** the invocation point (when rotation actually runs) is left to a follow-on task;
this ADR fixes only the archive convention and the script's contract.

## Alternatives considered

- **Cap the archive too (rolling window, oldest entries deleted).** Rejected — the project's
  chronological diary is meant to be a durable record; deletion contradicts "verbatim move,"
  which this ADR requires.
- **Split a month across live and archive files when the cap trips mid-month.** Rejected —
  adds real complexity (an archive file could then be written to more than once, requiring
  merge logic) for a benefit (a slightly tighter cap bound) the doctrine doesn't need; the
  current-month-never-rolls rule keeps every archive file a single, one-shot write.
  Considered and dropped by lib/protocol-rotation.mjs's rotateProtocol design.
- **A single flat archive file (no monthly split).** Rejected — defeats the point of dated,
  human-navigable archive files and diverges from the archive shape `c8j3w`/`w7q2m` are meant
  to reuse.
- **Wire rotation into `work`'s session-end step as part of this task.** Deferred, not
  rejected — this task's acceptance criteria scope to the script + tests + doctrine + read-side
  pointers; deciding exactly where in a skill's flow to call `rotateProtocol` is left to a
  follow-on task rather than guessed here.
