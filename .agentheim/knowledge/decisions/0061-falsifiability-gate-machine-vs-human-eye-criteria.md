---
id: ADR-0061
title: Falsifiability gate — classify acceptance criteria machine-checkable vs human-eye; verifier escalates on metric drift
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-mxk6v]
related_adrs: [0036, 0059, 0060]
---

# ADR-0061: Falsifiability gate — classify acceptance criteria machine-checkable vs human-eye; verifier escalates on metric drift

## Context

Dorc's July-2026 agent-time review (recommendation A1) named the worst single burn of the
review period: a *perceptual* acceptance claim — "the slot visibly shows the captured frame"
— was allowed to become a machine-checked pixel metric at refinement time. Workers then
iterated on the metric, not the product: three separate worker passes each produced a metric
tuned to pass, across a six-task chain, and the feature still did not work for the player. The
verifier had no signal that metric-tuning, rather than product-fixing, was happening — nothing
distinguished "the test now passes because the code is right" from "the test now passes because
the test changed."

Two gaps compound here. First, refinement never asked whether a criterion was the kind of claim
a machine could actually decide — it let any acceptance criterion, however perceptual, drift
toward "make it pass a script" simply because that's the only lever a worker has. Second, even
once a criterion becomes machine-checked, the verifier's re-dispatch loop (`skills/
verification-before-completion/SKILL.md`, `agents/verifier.md`) treats every FAIL identically —
up to two retries before escalating — with no notion that a *changing* proxy metric against an
*unchanging* claim is itself evidence the claim was never well-specified as a machine-checkable
criterion in the first place.

Per ADR-0059 (mechanize-or-drop, `agentic-workflow-z394j`), a task establishing a convention
must ship enforcement or explicitly record "prose-only, unenforced." This task establishes two
conventions and treats them differently, deliberately:

- The `[human-eye]` marker + all-human-eye "builder-eye-only" note requirement is a plain
  mechanical predicate (word/marker presence, note-text presence) — mechanized, per ADR-0059's
  "mechanical wherever practical" bar.
- "Is this criterion genuinely perceptual, or just under-specified?" and "did the measurement
  for a criterion actually drift between iterations, or was the criterion legitimately
  re-refined?" are semantic judgments no lint can approximate — enforced via prompt-embedded
  verifier checks, the same shape ADR-0059 itself uses for "does this task establish a
  convention?" (its own check 6c is a judgment call, not a script).

## Decision

**Two coupled doctrine changes:**

### 1. Classify every acceptance criterion at refinement time

Every acceptance criterion is, by construction, one of two kinds:

- **Machine-checkable (default, no marker).** A test or a concrete inspectable artifact can
  decide it.
- **Human-eye.** Only a person looking at the actual result can judge it — a genuinely
  perceptual claim. Marked explicitly with a trailing `[human-eye]` on the bullet:
  `- [ ] The slot visibly shows the captured frame. [human-eye]`.

Classification happens in CAPTURE and REFINE (`skills/modeling/SKILL.md`), not left for
whichever worker or verifier later touches the task. If a criterion feels perceptual, the
refiner should first try sharpening it into something testable — the marker is for claims that
are *irreducibly* perceptual, not an escape hatch from writing a precise criterion.

A `[human-eye]` criterion is never a `backlog/`→`todo/` promotion blocker on its own. The one
thing it triggers: a task whose criteria are **all** `[human-eye]` must carry a specific `##
Notes` line — "Verification is builder-eye only — every acceptance criterion is human-eye
(ADR-0061); the verifier will report each as 'builder eye-check pending' rather than PASS/FAIL
any of them on an invented proxy" — before promotion (PROMOTE readiness step 2b; REFINE inherits
it via its existing "run PROMOTE's mechanics wholesale" auto-promote step; CAPTURE gets the same
requirement for a task landing directly in `todo/`).

**Routing to the builder's own eye-check.** A `[human-eye]` bullet's checkbox is deliberately
left **unchecked** through the whole lifecycle — worker and verifier never check it off, only
the builder does, by hand, once they've actually looked. That unchecked box, still visible
next to the marker on a `done/` task, *is* the routing signal to a builder-checks-by-eye step at
completion. No new artifact, no dashboard change, no `work`/worker.md edit — this is
deliberately the lightest mechanism that closes the loop, accepting that today nothing
*proactively* surfaces the pending count to the builder (a future task could add that to
`whats-next` or the dashboard; not required here — see Consequences).

### 2. The verifier treats metric drift as escalation fuel, not iteration fuel

`agents/verifier.md` check 1 (acceptance criteria coverage) never proxies a `[human-eye]`
criterion by an invented metric — it reports `builder eye-check pending` in PASS EVIDENCE, and a
`[human-eye]` criterion alone is never, on its own, a reason to FAIL that check.

A new check 1b (mirrored in `skills/verification-before-completion/SKILL.md`) fires only on
iteration 2 or 3. For any criterion whose *text* is unchanged since the prior iteration, the
verifier compares the measurement/proxy the current diff uses to satisfy it against what a
prior `## Verifier note (iteration N)` section (already embedded in the task file `work`
appends on each FAIL) recorded for that same criterion. Text unchanged + measurement unchanged
→ not drift, judge normally. Text unchanged + measurement **changed** → drift: the worker tuned
the metric instead of fixing the underlying claim. This is escalation fuel: the verifier FAILs
with `ITERATION_HINT: task-under-specified` rather than the ordinary `likely-fixable`. `work`'s
existing handling of that hint (`skills/work/SKILL.md` step 5: "do not re-dispatch even on
iteration 1 — treat as iteration-3") *already* escalates immediately regardless of the normal
2-retry cap — no new machinery in `work` was needed or added. Drift is itself evidence the
criterion was never truly falsifiable as worded, which is precisely what `task-under-specified`
already means.

This required one narrow, explicit carve-out to the verifier's "judge each iteration
independently, never read prior verifier notes" rule: check 1b — and only check 1b — may read
the task file's own accumulated `## Verifier note` sections, solely to compare a criterion's
recorded measurement against the current one. It must never use that history to bias
re-judgment of a criterion that shows no drift.

## Self-referential compliance (ADR-0059)

This task establishes two conventions and satisfies mechanize-or-drop for both, but with
different mechanisms, deliberately:

- **The `[human-eye]` marker + all-human-eye note requirement ships a real lint**, not the
  "prose-only, unenforced" marker: `lib/human-eye-criteria.mjs`'s live-tree `node --test` check
  (`lib/test/human-eye-criteria.test.mjs`) walks every task file across every BC's lifecycle
  folders and flags any task whose criteria are all `[human-eye]` but missing the required
  note. This is the sub-piece that is a plain mechanical predicate (marker presence, note-text
  presence) — mechanized because it is practical to mechanize.
- **The metric-drift escalation doctrine is judgment-embedded, not a lint** — check 1b in
  `agents/verifier.md` / `skills/verification-before-completion/SKILL.md`. "Did the measurement
  actually drift, or was the criterion legitimately re-refined?" is a semantic reading of prior
  FAIL reasons against the current diff, the same shape ADR-0059's own check 6c already uses for
  "does this task establish a convention?" — a predicate that resists a general-purpose lint. Per
  ADR-0059's own self-referential compliance note, a judgment-based prompt check counts as
  shipped enforcement when the predicate itself resists mechanization; this is not the
  "prose-only, unenforced" escape hatch, it is the same tier of enforcement ADR-0059 itself
  uses.
- **"Is this criterion genuinely perceptual?"** (the classification call itself) is likewise
  left as refiner judgment in `skills/modeling/SKILL.md` — no lint attempts it, for the same
  reason: it is inherently a reading of the criterion's meaning, not its shape.

## Consequences

### Positive
- Closes the exact gap the Dorc review named: a perceptual claim can no longer be silently
  absorbed into a machine-checked proxy at refinement time without a deliberate, visible
  decision.
- The verifier now has a structural signal — metric drift — that distinguishes "the worker
  fixed the product" from "the worker tuned the test," and treats the latter as a reason to
  stop looping and ask the builder, not as an ordinary retry.
- Reuses `ITERATION_HINT: task-under-specified`'s already-shipped immediate-escalation behavior
  rather than adding new machinery to `skills/work/SKILL.md` — zero risk of drifting out of
  sync with that skill's own retry-cap logic, and zero scope collision with any task that
  touches `work`'s dispatch loop directly.
- The unchecked-checkbox routing mechanism is free — no new artifact, no dashboard/work.md
  change — while still giving the builder a durable, visible signal on any `done/` task.

### Negative
- Nothing today *proactively* surfaces the count of pending builder eye-checks to the builder
  (e.g., in `whats-next` or the dashboard) — the builder has to notice the unchecked box when
  they look at a `done/` task. A future task could add a proactive surface; not required here,
  and deliberately left out to avoid touching `work`/dashboard code out of this task's scope.
- Check 1b's "read prior `## Verifier note` sections" carve-out is a narrow crack in the
  verifier's "judge independently" discipline — the same residual risk ADR-0059's own judgment
  gates carry: a careless verifier could let old reasoning bias a criterion that shows no real
  drift, even though the doctrine explicitly forbids it.
- The classification call ("is this really human-eye, or just under-specified?") is unmechanized
  and rests entirely on refiner judgment at CAPTURE/REFINE time — a criterion could be marked
  `[human-eye]` to dodge writing a precise, testable criterion. The doctrine's own guidance
  (sharpen first, mark only when irreducibly perceptual) is the only guard against this, and it
  is prose, not enforcement.

### Neutral
- Does not retroactively require any existing task to classify its criteria — the marker is
  opt-in going forward; an unmarked criterion is machine-checkable by default, which is also
  the correct classification for essentially every existing task.
- Does not change `skills/work/SKILL.md`'s dispatch/retry mechanics at all — reuses the existing
  `task-under-specified` hint's existing behavior unchanged.

## Alternatives considered

- **A dashboard/`whats-next` surface for pending builder eye-checks, shipped in this task.**
  Rejected for scope: this task's file list is `skills/modeling/SKILL.md`, `skills/
  verification-before-completion/SKILL.md`, `agents/verifier.md`, and the lint — extending into
  `dashboard/` or `skills/work/SKILL.md` would both exceed scope and risk collision with a
  separate, already-planned task (`agentic-workflow-vvmfy`) that also touches the verifier
  files. The unchecked-checkbox mechanism is a real, if less proactive, closing of the loop; a
  proactive surface remains a natural, separately-scoped follow-up.
- **A new `ITERATION_HINT` value (e.g. `metric-drift-escalate`) instead of reusing
  `task-under-specified`.** Rejected: would require editing `skills/work/SKILL.md`'s
  hint-handling logic to recognize it, which is both out of this task's scope and unnecessary —
  `task-under-specified`'s existing contract ("another worker pass won't help — the criteria are
  themselves ambiguous or missing") already describes exactly what metric drift proves.
- **Let the verifier re-derive drift by diffing test files across iterations directly (via
  `git log` on the worktree branch) instead of reading `## Verifier note` sections.** Rejected:
  the verifier is read-only and already has the task file's accumulated notes as the cheapest,
  already-present source of "what did the prior iteration check"; a `git log` dive adds Bash
  calls and complexity for the same information already sitting in the file the verifier reads
  first.
- **Mechanize "did the measurement drift" as a lint (e.g., hash the test file per criterion,
  compare hashes across iterations).** Rejected: comparing *whether a change in a test
  constitutes gaming the metric vs. a legitimate fix* requires reading intent, which a hash
  diff cannot distinguish from an unrelated refactor of the same test file — exactly the kind
  of predicate ADR-0059 says should stay judgment-based rather than forcing a brittle,
  gameable lint.
- **Block promotion of any task carrying a `[human-eye]` criterion.** Rejected: perceptual
  claims are legitimate and common (UI/UX work in particular); blocking them would either force
  every perceptual claim into a brittle proxy metric (recreating the exact Dorc-review failure)
  or make backlog refinement impossible for a large class of real work.

## References
- ADR-0036 — the verifier's existing tiered-observation precedent (mandatory stdlib HTTP floor,
  opt-in render tier, manual-note carve-out narrowed) that this ADR's human-eye handling sits
  alongside; observed-behavior-over-claimed-behavior is the adjacent spirit both share.
- ADR-0059 — mechanize-or-drop; the doctrine this task satisfies with a real lint for the
  mechanical half and a judgment-embedded check (mirroring ADR-0059's own check 6c) for the
  semantic half.
- ADR-0060 — the most recent sibling exemplar of a live-tree, date-free, loss-tolerant lint this
  task's `lib/human-eye-criteria.mjs` mirrors in shape.
- `skills/modeling/SKILL.md` — "Classifying acceptance criteria", CAPTURE step 4, REFINE step 3,
  PROMOTE step 2 + new step 2b (this task's implementation).
- `agents/verifier.md` check 1 + new check 1b, `skills/verification-before-completion/SKILL.md`
  (this task's implementation).
- `lib/human-eye-criteria.mjs` / `lib/test/human-eye-criteria.test.mjs` — the mechanized half.
