---
id: agentic-workflow-v8n3t
title: Wire a trigger for protocol rotation — rotateProtocol is never invoked
status: doing
type: bug
context: agentic-workflow
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [protocol, rotation, bookkeeping, cap-and-roll]
related_adrs: [0039, 0041, 0038]
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
