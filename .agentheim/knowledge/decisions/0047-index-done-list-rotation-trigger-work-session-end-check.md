---
id: ADR-0047
title: INDEX done-list rotation trigger — work's session-end check, closing ADR-0045's deferred sibling-surface scope boundary
scope: agentic-workflow
status: accepted
date: 2026-07-04
related_tasks: [agentic-workflow-d4q7f, agentic-workflow-dk3vz]
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

## Amendment — 2026-07-09 (agentic-workflow-dk3vz): a third manifest branch — per-BC refusal — and the narrowed no-op

A field report (WisdomHeim vault, 2026-07-09) found `rotateIndexDoneList` silently reporting
`{ok:true, rotated:false, liveEntries:0}` for every BC whose done-list is written in a shape
`parseDoneListEntries`'s `ENTRY_LINE` regex doesn't match — indistinguishable from a genuinely empty
list, so the cap never fires and this ADR's session-end check surfaces nothing. Two further faces
surfaced once traced against `main`: a firing rotation on a partially-parseable, over-cap list
silently dropped every unmatched line on rewrite (landed in no archive), and `rotateAllIndexDoneLists`
propagated a per-BC missing-markers throw uncaught, discarding the whole run's manifest — including
any healthy BC that had *already rotated and written files* earlier in the sorted BC walk, stranding
that BC's rotation uncommitted behind `work`'s own "treat a non-zero exit as a soft failure: change
nothing" branch (the Mechanics section above, verbatim, before this amendment: *"`rotated: false` (the
common case) → no-op: no commit, no protocol entry"* — a two-branch shape, `rotated:true` /
`rotated:false`, with no notion of a BC refusing at all).

This amendment adds a **third branch** to the per-BC manifest, extends `rotateAllIndexDoneLists` to
catch a per-BC throw rather than let it escape, and narrows `work`'s "silent no-op is correct" rule
accordingly. Everything else the Decision above established — the trigger's placement (session-end,
immediately after the protocol-rotation check), the all-BC entry point, the commit shape and message
template, the top-level `ok:true`/exit-`0` posture, and the confirmed read-side reachability contract
(archive-header naming + Backlink matcher) — is **unchanged**.

1. **A BC's own result is now one of three shapes, not two.** Beside `{ok:true, rotated:true, ...}`
   and `{ok:true, rotated:false, ...}`, a BC can now REFUSE: `{ok:false, code, context, reason}`,
   writing nothing. Two codes: `unparseable-done-list` (zero lines matched at all, or a pending
   rewrite would have silently dropped unmatched lines) and `missing-done-list-markers` (the done-list
   markers themselves are absent — the former uncaught-throw case, now caught per BC inside
   `rotateAllIndexDoneLists` instead of escaping the loop). **The top-level manifest is untouched by
   a refusal**: `ok` stays `true`, `runCli`'s exit code stays `0`, and top-level `changed` simply omits
   the refusing BC's paths — preserving ADR-0038's "`ok:false` ⇒ nothing written" invariant at the
   per-BC grain without letting one BC's refusal strand another's already-written rotation, the exact
   stranding scenario the field report's third face described.
2. **A partially parseable done-list that isn't destructive to skip is reported, not refused.** When a
   BC's done-list has unmatched non-blank lines but is either under cap or over cap with no month
   actually rollable, it returns `{ok:true, rotated:false, liveEntries:N, unmatched:K}` with `K > 0` —
   visible, not fatal, nothing written. Refusal is reserved for when the answer would be wrong (zero
   matches) or the rewrite would be destructive (a firing rotation would drop unmatched lines).
3. **`work`'s "silent no-op is correct" rule is narrowed.** The Mechanics section's old rule —
   `rotated: false` ⇒ no commit, no protocol entry, fully silent — now applies only when, in addition,
   no BC returned `ok === false` and no BC reported `unmatched > 0`. `skills/work/SKILL.md`'s "INDEX
   done-list rotation check" section gained a step that iterates `contexts` and surfaces every
   refusal (BC + code + reason) and every unmatched-line report (BC + count) in the end-of-run
   summary — visibility only, never a session block, and never a reason to skip committing the
   healthy BCs' `changed` paths.
4. **Accepted consequence, stated plainly:** a BC whose done-list stays malformed refuses to rotate on
   every session and its live list grows past cap until a human fixes the offending line. This is the
   fail-closed trade taken knowingly — loud every session rather than silently wrong once. The
   rejected alternative (carrying an unmatched line through the rewrite verbatim) cannot preserve the
   line's *position*: an unmatched line has no `completed:` date and therefore no month, so it can only
   stay live while the entries around it roll away — verbatim in bytes, not in order.

No change to `lib/index-rotation.mjs`'s exported function names or `parseDoneListEntries`'s signature
and its two pre-existing tests (still returns an entry array, still throws on missing markers) — the
new `parseDoneList(content) → {entries, unmatched, nonBlank}` sits underneath it, additive only.
