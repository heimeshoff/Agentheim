---
id: ADR-0067
title: Two undocumented 2026-07-02 survey dispositions — decline a mandatory mid-batch checkpoint; decline the Haiku thin-agent wrapper
scope: agentic-workflow
status: accepted
date: 2026-07-22
related_tasks: [agentic-workflow-znwve]
related_adrs: [0059, 0064, 0032, 0038, 0027]
---

# ADR-0067: Two undocumented 2026-07-02 survey dispositions — decline a mandatory mid-batch checkpoint; decline the Haiku thin-agent wrapper

## Context

The 2026-07-22 coverage audit re-checked every item from the 2026-07-02 harness survey and
found all of them either shipped or declined-with-rationale, except two with no recorded
disposition anywhere: a proposed mandatory mid-batch human checkpoint (Opus review gap 6),
and a proposed Haiku thin-agent wrapper for `quick-capture`/`whats-next`/`inquire`. The
second was actually decided — declined, in prose, inside the audit document itself — but
that decline was never promoted to a decision record, leaving it invisible to anyone who
didn't happen to read that specific audit doc. Per ADR-0059's visible-decision principle
(a convention-establishing choice, made or declined, must be recorded, not defaulted into
silently), both gaps close here: one freshly decided, one decline made visible.

## Decision

### 1. Mid-batch human checkpoint — declined

**`work` will not gain a mandatory pause-and-confirm checkpoint partway through a long
batch.** The loop keeps its existing shape: dispatch a capped wave (`MAX_PARALLEL`,
default 3), integrate, re-scan, dispatch the next wave, continuing "until todo is empty
(or the user stops it)" (`skills/work/SKILL.md`'s own framing) with no designed pause in
between waves.

**Reasoning, weighing the existing mitigations against the gap:**

- **vision.md's non-goal #3 ("Not autonomous") already names the loop's gates
  exhaustively**, and a mid-batch checkpoint is not one of them: "no-code brainstorm, user
  review before `work`, escalation after failed verification." The human reviews the
  `todo/` set *before* invoking `work` — that is the designed pre-batch gate — and the
  loop's own doc string is explicit that it is supposed to keep going once invoked, not
  pause partway. A mandatory mid-batch stop would be new scope the vision doesn't ask
  for, not a gap the vision implies should be closed.
- **The existing mitigations already provide real, signal-based checkpoints, not just a
  time-based approximation of one:**
  - **Between-wave re-scan** (Phase 4 step 7 → Phase 2) already happens after every wave,
    and waves are capped at `MAX_PARALLEL: 3` by design (Phase 3 step 4's own rationale:
    merge-conflict surface and verifier review load, not throughput) — so "a long batch"
    is already broken into short, frequently-re-scanned segments, not one uninterrupted
    stretch. There is no batch shape where dozens of tasks land with no re-scan between
    them.
  - **FAIL escalates at iteration 3** (`skills/work/SKILL.md`, "End-of-run reporting")
    surfaces to the user *exactly when something is actually going wrong* — a worker
    genuinely stuck on a task. This is a better checkpoint trigger than a blind periodic
    pause: it fires on the signal that matters (real trouble) rather than on elapsed
    waves/tasks regardless of whether anything needs attention, so it doesn't force the
    builder to rubber-stamp waves that have nothing to say.
  - **Vacuum guard** (ADR-0064) halts the loop the moment the ready set goes empty and
    surfaces the actual open decision blocking further work, rather than letting the
    session drift into self-generated filler.
- **The harness is a synchronous, watched conversation, not a detached background job.**
  Every wave's dispatch, verification, and commit happens as visible tool calls in the
  same session the builder is present for; the builder already has full ability to
  interject and stop the run at any point without a designed pause forcing the issue. A
  scripted "continue? y/n" prompt would not add interruptibility that doesn't already
  exist — it would only add friction to the very trigger phrases `work` documents itself
  against ("let's go", "run the workers", "ship what's ready"), which explicitly ask for
  an uninterrupted run.
- **No measured threshold exists to set a checkpoint cadence by.** `MAX_PARALLEL`'s own
  doc comment states its default (3) is a guess pending real wall-clock data from the
  b8x2v duration/iteration protocol fields, not a settled number — inventing a *second*
  arbitrary cadence (every N waves? every N minutes? every N tasks?) with even less
  evidence behind it would compound the same problem this project already flags as
  unresolved for a simpler, already-existing knob.

This is a **declined-for-now** disposition, not a permanent close: if a future incident
shows a batch actually drifting away from builder intent across many uninterrupted waves —
something the between-wave re-scan, FAIL-escalation, and vacuum guard collectively failed
to catch — that concrete incident is grounds to revisit, the same posture ADR-0059's
mechanize-or-drop doctrine and ADR-0064's advisory-only stance both take toward their own
open edges.

### 2. Haiku thin-agent wrapper — declined

**`quick-capture`, `whats-next`, and `inquire` will not be restructured into thin
Haiku-model subagents.** This ratifies, as a recorded decision, the disposition already
reached in the 2026-07-22 audit document itself: *"Not worth restructuring into an agent
just to save pennies."* All three are today lightweight, single-turn conductor-level
skill invocations with no subagent fan-out; wrapping each in a dedicated Haiku agent would
add the machinery a subagent spawn requires (prompt template, strict return-format
parsing, its own `agentheim:`-namespaced identifier per ADR-0052) purely to shift a
handful of cheap tokens from the conductor's model tier to a cheaper one — a cost this
project has never measured as material for these three specific flows, and a mechanism
this project would then have to maintain (prompt drift, return-format parsing failures)
in perpetuity for a saving nobody has shown is worth it.

Recording this here satisfies ADR-0059: a declined direction is now a visible decision
record, not a line buried in a point-in-time audit document that a future session has no
reason to go back and read.

## Consequences

### Positive
- Closes the exact audit-found gap: every 2026-07-02 survey item now has a recorded
  disposition, landed or declined, discoverable via the knowledge index rather than only
  in a point-in-time audit document.
- `work`'s loop shape stays simple — no new pause/confirm state machine, no new cadence
  knob to tune, no added friction on the trigger phrases the skill explicitly documents
  itself against.
- The Haiku-decline record gives a future session a reason *not* to re-propose the same
  wrapper without first checking whether the underlying economics changed (materially
  higher per-invocation token cost measured, or a fourth/fifth thin skill added to the
  same family making shared wrapper machinery cheaper per-flow).

### Negative
- The mid-batch-checkpoint decline is a judgment call resting partly on "the builder is
  watching the conversation anyway," which is true for an interactive session but would
  not hold if `work` were ever invoked from a truly headless, unattended context (a
  scheduled/CI trigger with nobody watching) — that shift in how `work` is invoked would
  invalidate this ADR's central argument and should prompt a revisit, not a silent
  continuation of this decline.
- Neither decline forecloses re-litigation; both are declared open-to-revisit-on-evidence
  rather than closed permanently, which means a future session must actually re-read this
  ADR's reasoning rather than assume "declined" means "settled forever."

### Neutral
- Does not touch any existing mechanism (between-wave re-scan, FAIL-iteration-3 escalation,
  vacuum guard, or the three thin skills) — this ADR ratifies the current shape, it
  changes no code.

## Alternatives considered

- **Implement a periodic mid-batch pause (e.g., every 3 waves or every N minutes) that
  requires explicit builder confirmation to continue.** Rejected: no measured signal
  exists to size N by (mirrors `MAX_PARALLEL`'s own unresolved measurement gap), and it
  would add friction to a documented "run until done" trigger class without addressing a
  concrete observed failure — the between-wave re-scan and FAIL-iteration-3 escalation
  already interrupt the loop on the signals that actually matter.
- **Implement a lighter, informational mid-batch line (no hard block) every N waves,
  summarizing progress without pausing.** Considered a smaller reasonable variant of
  option 1, but still requires the same unjustified cadence knob and duplicates
  information the batch-mix line (ADR-0064) and per-task protocol entries already
  surface at wave granularity — declined for now on the same evidence-gap grounds.
  Revisit alongside the checkpoint decline above if a concrete incident ever motivates it.
- **Wrap `quick-capture`/`whats-next`/`inquire` in Haiku subagents for cost savings.**
  Rejected per the audit's own rationale, now ratified here: the token savings are
  unmeasured and likely marginal for three lightweight, single-turn flows, while the
  subagent machinery (prompt template, strict-return parsing, namespaced identifier)
  is real, ongoing maintenance surface.

## References

- ADR-0059 — mechanize-or-drop / visible-decision principle; the doctrine both
  dispositions in this ADR satisfy.
- ADR-0064 — vacuum guard and batch-mix line; the existing advisory-only precedent this
  ADR declines to extend with a new hard checkpoint.
- ADR-0032 — per-worker worktree isolation; establishes the wave/dispatch shape (batch
  cap, FAIL-iteration handling) this ADR reasons from.
- ADR-0038 — three-layer lifecycle-mechanization boundary; the same "judgment calls stay
  in skill prose, not a script" posture this ADR's own declines rest on.
- ADR-0027 — advisory-write family; the pattern (surface, never gate) both existing
  mitigations for the mid-batch-checkpoint gap already follow.
- `.agentheim/vision.md` non-goal #3 ("Not autonomous") — the three named gates this ADR
  reads as deliberately exhaustive.
- `skills/work/SKILL.md` Phase 3 step 4 (`MAX_PARALLEL` rationale), Phase 4 step 7
  (between-wave re-scan), "End-of-run reporting" (FAIL-iteration-3 escalation).
- The 2026-07-22 coverage audit document — source of both undocumented dispositions this
  ADR closes.
