---
id: ADR-0065
title: Remediation outranks further diagnosis at dispatch; spikes carry a mid-spike stop-loss clause
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-rx630, agentic-workflow-t8kfq]
related_adrs: [0059, 0060, 0032]
---

# ADR-0065: Remediation outranks further diagnosis at dispatch; spikes carry a mid-spike stop-loss clause

## Context

Dorc's July-2026 agent-time review, recommendation A5, named a concrete waste: three
diagnosis spikes ran sequentially on the same defect family while the already-diagnosed,
cheap root-cause remediation for that family sat untouched in the backlog. One of those
spikes pinned exactly which node caused the symptom — and then applied the same workaround
it would have applied without running the diagnosis at all. Two doctrine gaps compounded:
nothing in `work`'s dispatch ordering preferred a known fix over further investigation of a
thread already investigated, and nothing told a worker mid-spike that it was allowed to stop
once it already had enough to act on.

## Decision

**1. Dispatch ordering (`skills/work/SKILL.md`, Phase 3 step 4).** When the conductor picks
tasks for a batch, a ready remediation task whose root cause is already diagnosed and whose
fix is cheap outranks a ready further-diagnosis `spike` on the **same thread**. "Same thread"
is defined narrowly and mechanically: the two tasks share a `tags` entry naming the defect
family, one is named in the other's `depends_on`/`blocks`, or one is named in the other's
`prior_art`. This is a **dispatch-ordering preference, not a gate** — a ready spike is never
pulled from the batch on this basis, only ordered behind the remediation. A builder who
explicitly asks for deeper diagnosis on that thread still gets it dispatched as asked; the
preference only resolves an otherwise-unforced tie among already-ready tasks.

**2. Spike stop-loss (`skills/modeling/SKILL.md` task-format notes, `agents/worker.md`
execution doctrine).** Every `type: spike` task carries a standing clause: "if, mid-spike,
the mitigation is already known and cheap, record it and stop." A worker who reaches that
point ends the spike early with the recorded mitigation instead of completing the fuller
diagnosis the task's acceptance criteria describe. This is a **legitimate completion**, not
an abandoned task — the worker records the early stop and the mitigation in the task's
`## Outcome`, moves it `doing/` → `done/`, and returns `SUCCESS` exactly as for a
fully-diagnosed spike.

### Mechanize-or-drop (ADR-0059)

This task establishes two conventions and treats them differently under ADR-0059:

- **Dispatch ordering is prose-only, unenforced.** "Is a remediation task's root cause
  already diagnosed, and is its fix cheap" is a judgment call about task content the
  conductor makes while reading the ready set each batch — the same shape as the existing
  Phase 3 advisory weighting (`whats-next.md`) and the ADR-0059 convention-check itself,
  neither of which is a `node --test` lint either. No cheap mechanical predicate distinguishes
  "diagnosed and cheap" from "still needs investigation" without re-litigating the judgment a
  lint can't make. The accepted risk: a careless conductor read can still order a spike ahead
  of its remediation on a given thread: this is caught the same way stale dispatch ordering
  always is, by outcome (a later Dorc-style review) rather than a live-tree gate.
- **The spike stop-loss clause ships enforcement.** Unlike the ordering judgment, "does this
  `type: spike` task's body carry the clause" is a mechanically checkable structural
  predicate — the same shape ADR-0060's INDEX entry-length cap used. `lib/spike-stop-loss.mjs`
  is a git-free, side-effect-free live-tree lint (`lib/test/spike-stop-loss.test.mjs`) that
  walks every lifecycle folder of every BC and flags a `type: spike` task file created
  strictly after `ADOPTION_DATE` (2026-07-21) whose body lacks the clause (either the literal
  word "stop-loss" or the clause's own "record it and stop" wording). It mirrors
  `lib/index-entry-length.mjs`'s date-grandfather shape exactly: every spike task already on
  disk predates this doctrine and is grandfathered, never retroactively rewritten; only a
  spike task minted after adoption must carry the clause. `skills/modeling/SKILL.md`'s `type`
  field legend now instructs task authors to include the clause when minting a new spike task,
  so the lint should never actually fire going forward rather than merely catching drift after
  the fact.

### Amended (agentic-workflow-t8kfq): verifier carve-out + backlog-remediation surface line

The 2026-07-22 post-survey audit found the two halves above fought the verification path
itself, an overshoot the founding decision didn't anticipate:

- **Verifier carve-out (`agents/verifier.md` check 1).** The worker doctrine above makes an
  early-stopped spike a legitimate `SUCCESS` completion with the fuller-diagnosis acceptance
  criteria left unmet — but verifier check 1 originally required every criterion to map to a
  test or artifact, with no exception for this case. Left as-is, the first real early stop got
  FAILed and re-dispatched to finish exactly the diagnosis this ADR told it to skip,
  reproducing the Dorc waste this ADR exists to prevent. Check 1 now names the ADR-0065
  early-stop case explicitly: when the worker's return or the task's `## Outcome` records an
  early stop on a `type: spike` task, the unmet fuller-diagnosis criteria are not FAIL
  evidence — the verifier instead checks that the stop-loss clause is present in the task body
  and that `## Outcome` names a concrete recorded mitigation, and judges *that record*, not the
  skipped diagnosis. A spike claiming an early stop with no named mitigation still fails the
  check — the carve-out excuses the skipped diagnosis, never a missing record of it.
- **Backlog-remediation surface line (`skills/work/SKILL.md` Phase 3 step 4).** This ADR's
  founding incident had the diagnosed remediation sitting in **`backlog/`**, not `todo/`, while
  spikes ran — the original dispatch-ordering preference only reorders among already-*ready*
  (`todo/`) tasks, so that exact shape still dispatched the spike first with no signal raised.
  Dispatch now surfaces (never gates, never auto-promotes) a same-thread remediation found
  unpromoted in `backlog/` when a same-thread `type: spike` is picked for the batch, one line
  in the batch rationale, so a builder can choose to promote the remediation first.

Both additions are judgment calls of the same shape as the ordering preference above and are
dispositioned identically under ADR-0059: **prose-only, unenforced.** "Does the worker's return
record an ADR-0065 early stop per doctrine" and "is this backlog task really the same thread as
this ready spike" are read-and-judge calls, not mechanical predicates a lint could evaluate
without re-litigating the judgment itself — the same reasoning that kept the original ordering
preference prose-only. No new lint was added for either.

## Consequences

### Positive
- Closes the Dorc-named waste directly: a diagnosed, cheap fix no longer waits behind spikes
  re-investigating ground already covered.
- A worker mid-spike now has explicit, recorded permission to stop once it has enough to act
  on, instead of an implicit incentive to run the acceptance criteria to the letter even after
  the useful answer is already in hand.
- The stop-loss clause's enforcement is cheap and self-limiting: it only ever governs newly
  minted spike tasks, and a spike task minted per the updated modeling doctrine satisfies it
  by construction.

### Negative
- The dispatch-ordering half is judgment-based and unenforced — a conductor can still misapply
  or overlook it, the same residual risk every prose-only convention under ADR-0059 carries.
- "Same thread" linkage (tags / depends_on / blocks / prior_art) only catches threads that
  were tagged or linked consistently at capture time; a defect family split across
  inconsistently tagged tasks won't be recognized as the same thread by this rule.

### Neutral
- Does not change spike doctrine's TDD-skip posture (`agents/worker.md`) — a stopped-early
  spike still follows the existing "smoke test only if it's a walking-skeleton spike"
  allowance; the stop-loss clause governs *when* the spike ends, not whether it was tested.

## Alternatives considered

- **Mechanize the dispatch-ordering preference as a lint over task graphs.** Rejected:
  "root cause already diagnosed and fix is cheap" is not derivable from task frontmatter or
  file structure alone — it requires reading and understanding task prose, the same judgment
  ADR-0059's own convention-check already treats as inherently prompt-based rather than
  script-based.
- **A hard gate instead of an ordering preference** (block the spike from the batch entirely
  when a same-thread remediation is ready). Rejected per the task's own Notes: a builder who
  wants deeper diagnosis before accepting a known-cheap fix should still get it — ordering
  captures the common-case waste without removing a legitimate one-off override.
- **No stop-loss enforcement, prose-only** (the ADR-0059 escape hatch). Rejected: the
  structural predicate ("does the spike task's body carry the clause") is exactly as cheap to
  mechanize as ADR-0060's entry-length cap was, and the project's own history (ADR-0059's
  Context) shows prose-only conventions get violated before anyone notices; shipping the lint
  costs one small file and stays green today with zero retroactive rewriting.

## References
- ADR-0059 — mechanize-or-drop; governs the ship-enforcement-or-record-the-risk choice made
  here for each of this task's two conventions separately.
- ADR-0060 — the date-grandfathered live-tree lint shape `lib/spike-stop-loss.mjs` mirrors.
- ADR-0032 — per-worker worktree isolation; the batch-dispatch mechanics this ADR's ordering
  preference slots into (`skills/work/SKILL.md` Phase 3/4).
- `skills/work/SKILL.md` Phase 3 step 4 — dispatch-ordering implementation.
- `skills/modeling/SKILL.md` `type` field legend — spike task-format implementation.
- `agents/worker.md` "Third action" TDD-skip notes — spike stop-loss execution doctrine.
- `lib/spike-stop-loss.mjs`, `lib/test/spike-stop-loss.test.mjs` — the lint and its tests.
- agentic-workflow-t8kfq — the "Amended" section's verifier carve-out (`agents/verifier.md`
  check 1) and backlog-remediation surface line (`skills/work/SKILL.md` Phase 3 step 4).
