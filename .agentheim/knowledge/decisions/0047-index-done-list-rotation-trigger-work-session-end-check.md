---
id: ADR-0047
title: INDEX done-list rotation trigger — work's session-end check, closing ADR-0045's deferred sibling-surface scope boundary
scope: agentic-workflow
status: accepted
date: 2026-07-04
related_tasks: [agentic-workflow-d4q7f]
related_adrs: [0039, 0041, 0038, 0045]
---

# ADR-0047: INDEX done-list rotation trigger — work's session-end check

## Context

ADR-0045 wired `rotateProtocol`'s trigger into `work`'s session-end flow but explicitly deferred
its sibling surface — `agentic-workflow-c8j3w`'s `rotateIndexDoneList` (`lib/index-rotation.mjs`),
the cap-and-roll mechanism for a bounded context's `INDEX.md` done-list — to a named follow-up
(`agentic-workflow-d4q7f`, this task). Nothing had ever invoked it: this repo's live
`agentic-workflow` done-list held ~120 entries against the ~30-entry cap, with no `done-archive/`
directory, the same "doctrine on paper only" state ADR-0045 found for `protocol.md` at 7,161 lines.

Unlike the protocol surface, INDEX done-list rotation has one extra wrinkle: `modeling`'s Backlink
prior-art matcher reads a BC's *rendered* done-list text (not the `done/` folder directly), so
whoever consumes rotated-out entries needs a way to still find them. This is a **read-side**
concern, not a reason to relocate the trigger — see Decision below.

## Decision

**`work`'s end-of-run flow invokes `rotateAllIndexDoneLists` once per session, immediately after
the ADR-0045 protocol-rotation check** (`skills/work/SKILL.md`, a new end-of-run step 9 + "INDEX
done-list rotation check (session-end)" section, structurally mirroring ADR-0045's protocol-rotation
step and section). Rationale: a BC's `INDEX.md` done-list grows via `completeTask` during a `work`
batch, so session-end is exactly the seam at which the list has just grown — the identical argument
ADR-0045 made for `protocol.md`.

Why the all-BC entry point (`rotateAllIndexDoneLists`, not the single-BC `rotateIndexDoneList`):
one call site, parameterless, mirrors `rotateProtocol`'s global shape, and future-proofs the trigger
for every BC's done-list (not just `agentic-workflow`'s) without a second seam.

### Mechanics (ADR-0038 three-layer boundary preserved, identical shape to ADR-0045)
- `lib/index-rotation.mjs` stays git-free — it never shells out to `git`.
- `work`'s new step invokes it via the standard env-free plugin bootstrap
  (`lib/resolve-plugin-file.mjs`'s homedir→cache→semver-max pattern), printing
  `{ok:true, rotated, changed:[paths], contexts:{<bc>:{rotated, changed, rolledMonths, liveEntries}}}`
  — note this manifest shape differs from the protocol check's (`rolledMonths` lives per-BC under
  `contexts`, not at the top level, because rotation runs across every BC in one call).
- `rotated: false` (the common case) → no-op: no commit, no protocol entry.
- `rotated: true` → `git add` exactly the top-level manifest's `changed` paths (every rewritten
  `INDEX.md` plus every new/appended `done-archive/YYYY-MM.md`) — never `git add -A` — and commit as
  its own scoped commit, separate from both the session-end-entry commit and the protocol-rotation
  commit: `chore(agentic-workflow): rotate INDEX done-list — <bc>:<rolledMonths>[, <bc2>:<rolledMonths2>...] [<last-task-id>]`.
- No new protocol log entry for the rotation itself — the commit message and archive files are the
  audit trail, identical reasoning to ADR-0045.

### The read-side reachability concern is confirmed, not re-engineered
Both halves of the contract ADR-0045's Scope-boundary section flagged were already documented and
are confirmed to hold end-to-end against this repo's first real rotation:
1. A rotated `INDEX.md` names its archive location in the `### Done (...)` header
   (`archivedDoneHeader` in `lib/index-rotation.mjs`) — verified: the rotated `agentic-workflow`
   `INDEX.md` now reads `### Done (most recent 30; older entries archived verbatim under
   done-archive/ — kept for prior-art search, ADR-0039 convention)`.
2. `skills/modeling/SKILL.md`'s Backlink prior-art matcher already instructs checking
   `contexts/<bc>/done-archive/*.md` when a BC's done-list header names an archive location — this
   prose was added by `agentic-workflow-c8j3w` and needed no change.

No prose or code change was required for this concern — it was a confirmation pass, exactly as
`agentic-workflow-d4q7f`'s "What" section anticipated.

## Alternatives considered
- A session-start check in every done-list-writing skill — rejected, same reasoning as ADR-0045
  (triples call sites for no added benefit; `completeTask` only runs inside `work`/`modeling`
  anyway, and `work`'s session-end is the natural aggregation point).
- Relocating the trigger to account for the read-side reachability wrinkle — rejected: the
  wrinkle is a read-side matter fully handled by the archive-header-naming + Backlink-matcher
  pairing already in place; moving the *write*-side trigger would not have addressed a *read*-side
  concern.
- Folding this into ADR-0045 itself — rejected at that time (ADR-0045's own text), to keep the
  reachability reasoning as its own decision pass rather than rushing it alongside the protocol
  trigger.

## Consequences
Positive: ADR-0045's deferred sibling-surface scope boundary is closed; the ~30-entry cap is now
enforced on every `work` session for every BC's done-list. Mechanism unchanged — `lib/index-rotation.mjs`
and its tests needed no modification, purely a new call site in skill prose. Ran for real against
this repo: `agentic-workflow`'s done-list rolled 2026-06 (37 entries) to
`contexts/agentic-workflow/done-archive/2026-06.md`, leaving the live list at the current month
(2026-07, 37 entries — never rolled even though it alone exceeds the cap, the accepted steady-state
overshoot ADR-0039 established for `protocol.md`'s equivalent case). `design-system` and
`infrastructure` were both already under cap (25 entries each) and correctly did not rotate.
Negative: a session that never reaches `work`'s end-of-run step still leaves a BC's done-list
uncapped until a future `work` session completes (same accepted approximation as ADR-0045).
