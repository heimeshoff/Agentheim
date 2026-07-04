---
id: agentic-workflow-d4q7f
title: Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked
status: done
type: bug
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [protocol, rotation, bookkeeping, cap-and-roll, index]
related_adrs: [0039, 0041, 0038, 0045, 0047]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-v8n3t]
---

## Why

`agentic-workflow-v8n3t` (ADR-0045) closed ADR-0039's deferred "who invokes it" non-decision for
`protocol.md` rotation by wiring `rotateProtocol` into `work`'s session-end flow. Its own Notes
section — and ADR-0045's explicit "Scope boundary" section — flagged that
`agentic-workflow-c8j3w`'s `rotateIndexDoneList` (`lib/index-rotation.mjs`), the sibling
cap-and-roll surface for a BC's `INDEX.md` done-list, shares the exact same trigger-less gap: the
mechanism and its tests (`lib/test/index-rotation.test.mjs`) exist, but nothing calls it. This
repo's live `agentic-workflow` done-list already sits at ~120 entries against the ~30-entry cap,
with no `done-archive/` directory — the same "doctrine on paper only" state ADR-0045 found for
`protocol.md` at 7,161 lines.

This is a near-exact parallel of ADR-0045, with one wrinkle protocol rotation does not have:
`modeling`'s Backlink (prior-art) matcher reads a BC's *rendered* done-list text, so whoever
consumes rotated data must correctly see rotated-out entries via `done-archive/YYYY-MM.md`. That
concern is a **read-side** matter, not a trigger-placement one — see the What section.

## What

Wire a trigger for `rotateAllIndexDoneLists` (the parameterless, all-BC entry point that mirrors
`rotateProtocol`'s global shape) following the same ADR-0038 three-layer boundary ADR-0045 used:
the script stays git-free, `work` owns the scoped `git add` + commit of the rotated file set.

**Call site — settled, not re-opened.** The trigger is `work`'s session-end flow, as a second
self-firing cap-and-roll check immediately after the ADR-0045 protocol-rotation check (a new step
in `skills/work/SKILL.md`, mirroring the "Protocol rotation check (session-end)" section). Rationale:
the `INDEX.md` done-list grows via `completeTask` during a `work` batch, so session-end is exactly
the seam at which the list has just grown — the same argument ADR-0045 made for `protocol.md`.

**The reachability concern does not move the trigger.** `modeling`'s prior-art matcher reading the
done-list is a *read-side* dependency, already handled by (a) rotation rewriting the `### Done (...)`
header to name `done-archive/` (`archivedDoneHeader` in `lib/index-rotation.mjs`), and (b)
`skills/modeling/SKILL.md`'s Backlink-lookup prose already instructing a read of
`contexts/<bc>/done-archive/*.md` when a BC's done-list has been rotated. The trigger therefore
stays at `work` session-end; the follow-up work is to *confirm* both halves of that read-side
contract still hold, not to relocate the trigger.

**ADR.** Write **ADR-0047** (ADR-0046 was minted after this task was refined for an unrelated
decision — next free number is 0047) recording the trigger decision — the mechanism/trigger
split mirrors ADR-0039 (mechanism) → ADR-0045 (trigger). ADR-0047 closes the deferred non-decision
ADR-0045's "Scope boundary" and "Alternatives considered" sections explicitly punted to this
follow-up. Expect it to be short: it reuses ADR-0045's reasoning wholesale and adds only the
read-side reachability confirmation as its distinguishing content.

## Acceptance criteria

- [x] `work`'s session-end flow invokes `rotateAllIndexDoneLists` via the standard env-free plugin
      bootstrap (homedir→cache→semver-max, `lib/resolve-plugin-file.mjs` shape — the same one the
      protocol-rotation check and the `claim`/`complete` CLIs already use), pointed at
      `lib/index-rotation.mjs`. A new "INDEX done-list rotation check (session-end)" step + section
      in `skills/work/SKILL.md`, sibling to the protocol-rotation one.
- [x] `rotated: false` (the common case) is a silent no-op — no commit, no protocol entry. On
      `rotated: true`, `work` `git add`s **exactly** the manifest's `changed` paths (rewritten
      `INDEX.md`(es) + the `done-archive/YYYY-MM.md` files) — never `git add -A` — and commits its
      own scoped commit, separate from the protocol-rotation commit:
      `chore(agentic-workflow): rotate INDEX done-list — <bc>:<rolledMonths> [<last-task-id>]`
      (or `chore: …` when the session completed no task, mirroring ADR-0045's fallback trailer).
      No new protocol log entry for the rotation itself (parallel to ADR-0045 — logging it would be
      a write to a capped surface; the commit + archive files are the audit trail).
- [x] **ADR-0047** records the trigger decision, closing this specific deferred non-decision (as
      ADR-0045's Scope-boundary section and the BC README's `rotateIndexDoneList` note both flag).
      Bidirectional links updated: `related_adrs` on this task, `related_tasks: [agentic-workflow-d4q7f]`
      on the ADR.
- [x] **Run the first real rotation on this repo** (parallel to v8n3t/ADR-0045 draining protocol
      2026-06): wiring the trigger and running it once rolls the `agentic-workflow` done-list's
      closed months (2026-06 and any earlier) out to `contexts/agentic-workflow/done-archive/`,
      leaving the live list at the current month (2026-07) under cap. Sanity-check the buckets are
      derived from real `completed:` dates (verified present on done tasks), not clone mtimes, so
      the archive splits by true completion month.
- [x] **Confirm (or fix) the read-side reachability contract** — both halves: (a) a rotated
      `INDEX.md` names `done-archive/` in its `### Done (...)` header, and (b) `modeling`'s Backlink
      prior-art matcher actually reads `contexts/<bc>/done-archive/*.md` for a rotated BC. Both are
      documented today; verify they hold end-to-end against the just-rotated repo. No prose/code
      change expected unless a real gap surfaces.
- [x] No new `lib/` surface is expected (this is a skill-prose call site, exactly like ADR-0045
      added none): `lib/test/index-rotation.test.mjs` stays untouched and green under
      `node --test lib/test/*.test.mjs`. Only if AC5's confirmation surfaces a genuine gap does any
      code/test change follow, covered by the same command.

## Notes

- **Why no orchestrator/architect pass at refine time:** this is a direct application of the
  *ratified* ADR-0045 pattern to the documented follow-up surface ADR-0045 itself named. The design
  is settled by precedent; the worker's job is execution + the read-side confirmation, not a fresh
  architectural decision.
- **`rotateAllIndexDoneLists` vs single-BC `rotateIndexDoneList`:** use the all-BC entry point at
  the `work` seam — it mirrors `rotateProtocol`'s parameterless global shape and future-proofs the
  trigger for the `design-system` / `infrastructure` BCs' done-lists without a second call site.
- **Cap:** `DEFAULT_CAP_ENTRIES = 30`. The mechanism never rolls the current (newest) month however
  large, and never touches the `**Done:** N` lifetime count or the `done/<id>.md` task files
  (reachability for `depends_on`/`blocks` resolution and dashboard search is unaffected by
  construction — see the `lib/index-rotation.mjs` module doc).
- **Recurring Windows friction to expect:** autocrlf may re-CRLF `INDEX.md` in the working tree;
  the mechanism is CRLF-round-trip-safe by design (splits on `\n` only, marker regex tolerates
  `\r?\n`), but the worker should still LF-normalize before a mechanized run if the 8th-session
  pattern recurs (see the 2026-07-04 21:05 session-end note).

## Outcome

Wired `rotateAllIndexDoneLists`'s trigger into `work`'s session-end flow (`skills/work/SKILL.md`):
a new end-of-run step 9 + "INDEX done-list rotation check (session-end)" section runs immediately
after step 8's protocol-rotation check, invoking `lib/index-rotation.mjs` via the standard
env-free plugin bootstrap and, on `rotated: true`, committing the top-level manifest's `changed`
paths as their own scoped commit (`chore(agentic-workflow): rotate INDEX done-list —
<bc>:<rolledMonths>[, ...] [<task-id>]`). ADR-0047 records the decision, closing ADR-0045's
deferred sibling-surface scope boundary, with the read-side reachability contract confirmed rather
than re-engineered (both halves — the archive-naming header and `modeling`'s Backlink matcher
reading `done-archive/` — were already in place from `agentic-workflow-c8j3w`). BC README updated
to replace the "trigger deferred" note on `rotateIndexDoneList` with the wired-trigger description.

Ran the mechanism for real against this repo (the proof case): `node lib/index-rotation.mjs`
rolled `agentic-workflow`'s one closed-out older month, **2026-06** (37 entries), verbatim to
`.agentheim/contexts/agentic-workflow/done-archive/2026-06.md` (created — no prior archive dir
existed), leaving the live `INDEX.md` done-list at the current month (2026-07, also 37 entries —
correctly never rolled even though it alone exceeds the ~30 cap, ADR-0039's accepted steady-state
overshoot). `design-system` and `infrastructure` were both already under cap (25 entries each) and
correctly did not rotate. Spot-checked that months are derived from real `completed:` frontmatter
(e.g. `agentic-workflow-m2v8d` → `completed: 2026-06-19`), not clone mtimes. Confirmed the rotated
`### Done (...)` header now names `done-archive/`, and that `skills/modeling/SKILL.md`'s Backlink
matcher already reads `contexts/<bc>/done-archive/*.md` for a rotated BC — no gap surfaced, no
prose change needed there. Full suite (`node --test lib/test/*.test.mjs`) green at 183/183;
`lib/test/index-rotation.test.mjs` untouched, no new `lib/` surface added.

Key files: `skills/work/SKILL.md`,
`.agentheim/knowledge/decisions/0047-index-done-list-rotation-trigger-work-session-end-check.md`,
`.agentheim/contexts/agentic-workflow/README.md`, `.agentheim/contexts/agentic-workflow/INDEX.md`,
`.agentheim/contexts/agentic-workflow/done-archive/2026-06.md`.
</content>
