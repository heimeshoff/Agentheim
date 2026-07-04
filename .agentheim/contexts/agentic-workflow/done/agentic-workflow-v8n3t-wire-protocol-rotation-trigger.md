---
id: agentic-workflow-v8n3t
title: Wire a trigger for protocol rotation — rotateProtocol is never invoked
status: done
type: bug
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [protocol, rotation, bookkeeping, cap-and-roll]
related_adrs: [0039, 0041, 0038, 0045]
related_research: []
prior_art: [agentic-workflow-r2c7m]
---

## Why

ADR-0039 established the cap-and-roll doctrine and `agentic-workflow-r2c7m` built the
mechanism (`lib/protocol-rotation.mjs`, `rotateProtocol` — deterministic, git-free,
month-derived-from-headings, byte-for-byte slices, tested). But ADR-0039 explicitly
deferred *who invokes it* to its "Non-decisions (deferred)" section, and nothing ever
has: this repo's live `protocol.md` is **7,161 lines against the ~1,000-line cap** and
no `.agentheim/knowledge/protocol/` archive directory exists. Skills that read the
head ~100 lines are unaffected, but the cap is doctrine without enforcement — the
2026-07-04 harness-audit follow-up identified this as the one audit expectation that
exists only on paper.

## What

Decide the trigger and wire it, closing ADR-0039's deferred non-decision:

- **Leading candidate:** `work`'s session-end flow (after the session-end protocol
  entry is prepended and committed) runs a rotation check — if the live file exceeds
  the cap and holds closed-out months, invoke `rotateProtocol` and commit the
  resulting file set as its own scoped commit. Cheap, deterministic, k5n8f-family,
  and it runs exactly when the file has just grown.
- **Alternatives to weigh:** a session-start check in each protocol-writing skill
  (`work`/`modeling`/`research` — catches growth even when `work` never runs, but
  triples the call sites), or a manual maintenance verb only (keeps skills lean but
  reproduces exactly the "nothing ever runs it" failure being fixed here).

The decision goes in an ADR (amending or extending ADR-0039). Invocation follows the
ADR-0038 three-layer boundary: the script stays git-free; the calling skill owns the
scoped `git add` + commit of the rotated file set. Script resolution uses the standard
env-free plugin bootstrap (`lib/resolve-plugin-file.mjs`, infrastructure-010 pattern)
so the trigger works in consumer installs, not just this repo.

Then run it for real: this repo is the proof case.

## Acceptance criteria

- [ ] A defined trigger invokes `rotateProtocol` — the chosen skill flow's prose
      instructs the invocation (bootstrap command included), so the cap is enforced in
      practice, not just stated in ADR-0039.
- [ ] An ADR records the trigger decision with the options considered, explicitly
      closing ADR-0039's "who invokes it" deferred non-decision.
- [ ] Rotation executed once on this repo: live `protocol.md` retains the current
      month (and stays near the ~1,000-line steady-state cap), older months land
      verbatim in `.agentheim/knowledge/protocol/YYYY-MM.md`, newest-on-top order
      preserved, byte-identical entries (spot-check a rolled entry against git
      history).
- [ ] Any new or changed `lib/` surface is covered by `node --test lib/test/*.test.mjs`
      and the suite is green; existing protocol-rotation tests stay untouched.

## Notes

- `lib/protocol-rotation.mjs` deliberately avoids `Date.now()` — the month comes from
  entry headings. The trigger must not reintroduce a wall-clock dependency into the
  lib layer; if the trigger needs "current month is never rolled", that guard already
  lives in `rotateProtocol` itself.
- `protocol.md` and `INDEX.md` must stay LF — the mechanized lifecycle CLI throws on
  CRLF (see infrastructure-5w5gs). Rotation writes must preserve LF.
- The INDEX done-list rotation (`agentic-workflow-c8j3w`, `lib/index-rotation.mjs`)
  is the sibling cap-and-roll surface — check whether it shares the same
  trigger-less gap; if so, surface it as a follow-up capture rather than widening
  this task's scope.

## Outcome

Wired `rotateProtocol`'s trigger into `work`'s session-end flow (`skills/work/SKILL.md`): a new
end-of-run step 8 + "Protocol rotation check (session-end)" section runs immediately after the
session-end protocol entry (step 7) is committed, invoking `lib/protocol-rotation.mjs` via the
standard env-free plugin bootstrap and, on `rotated: true`, committing the manifest's `changed`
paths as their own scoped commit (`chore(agentic-workflow): rotate protocol — <rolledMonths>
[<task-id>]`). ADR-0045 records the decision, closing ADR-0039's deferred "who invokes it"
non-decision, with the alternatives considered (session-start triple-call-site, manual-only verb,
folding in the INDEX done-list trigger). BC README updated to reflect the wired trigger and to
correct the `rotateIndexDoneList` entry's now-inaccurate "like rotateProtocol" comparison.

Ran the mechanism for real against this repo (the proof case): `node lib/protocol-rotation.mjs`
rolled the one closed-out older month, **2026-06**, verbatim to
`.agentheim/knowledge/protocol/2026-06.md` (created — no prior archive dir existed), leaving the
live `protocol.md` at **1,468 lines**, all July (the current month, correctly never rolled even
though July's own volume alone exceeds the ~1,000 cap — ADR-0039's accepted steady-state
overshoot). Spot-checked a rolled entry (2026-06-23 Capture) byte-identical against
`git show HEAD:.agentheim/knowledge/protocol.md` (CRLF/LF-normalized comparison only — the
working tree's `core.autocrlf=true` checkout artifact, not a rotation defect; `git ls-files
--eol` confirms both files are `i/lf`, so the committed blob stays LF). Full suite
(`node --test lib/test/*.test.mjs`) green at 176/176 both before and after the real run;
`lib/test/protocol-rotation.test.mjs` untouched.

Surfaced the sibling gap rather than widening scope: `agentic-workflow-d4q7f` (new backlog item)
captures wiring `rotateIndexDoneList`'s own trigger, noting its extra reachability wrinkle
(`modeling`'s prior-art matcher reads the done-list) that keeps it from being a copy-paste of this
ADR's mechanics.

Key files: `skills/work/SKILL.md`, `.agentheim/knowledge/decisions/0045-protocol-rotation-trigger-work-session-end-check.md`,
`.agentheim/contexts/agentic-workflow/README.md`,
`.agentheim/knowledge/protocol.md`, `.agentheim/knowledge/protocol/2026-06.md`,
`.agentheim/contexts/agentic-workflow/backlog/agentic-workflow-d4q7f-wire-index-done-list-rotation-trigger.md`.
