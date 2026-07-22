---
id: 0069
title: Audit-closure doctrine — disposition the three open undershoot residuals, define the audit PASS bar and dated audit stamp with delta-scoping, and ban raw line-number pointers in doctrine prose
scope: agentic-workflow
status: accepted
date: 2026-07-22
supersedes: []
superseded_by: []
related_tasks: [agentic-workflow-f3wqm]
related_research: []
---

# ADR-0069: Audit-closure doctrine — disposition the three open undershoot residuals, define the audit PASS bar and dated audit stamp with delta-scoping, and ban raw line-number pointers in doctrine prose

## Note on ADR numbering

Minted provisionally as 0069 (the newest ADR on disk at the time this task started was
0068). Per ADR-0058, this number is only a local guess against this worktree's own view —
the conductor finalizes the true number against `main`'s real state at squash-merge
integration, renumbering on collision.

## Context

The builder has now asked "did we miss something?" three times, and each full-tree audit
produced fresh findings. The recurrence has two structural causes, not one:

1. **Judgment residuals left undispositioned get re-found by every fresh auditor.** A
   residual an audit surfaces but doesn't resolve — fix it, or explicitly decline it — has
   no visible record distinguishing "not yet decided" from "considered and set aside." The
   next auditor, with no way to tell the two apart, re-raises it as if it were new.
   ADR-0067 proved the counter-pattern works: once a decline is a visible decision record,
   no auditor re-raises it.
2. **Un-mechanized finding classes recur by construction.** Stale line-number pointers were
   found and fixed in three consecutive audits (most recently `agentic-workflow-e7dnq`,
   then `agentic-workflow-k9pbh`) because each fix corrected the *specific* stale pointers
   found that day, not the *shape* that produces them — a raw line number embedded in prose
   that goes stale the instant the referenced file is edited.

A third, compounding cause is that an unbounded full-tree audit has no defined PASS
state — nothing says an audit is *done*, so the same ground gets walked again on the next
"did we miss something?" ask, at full cost, whether or not anything actually changed since
the last pass.

Three specific residuals from the 2026-07-22 four-agent audit were, at the start of this
task, undispositioned and would have been re-found by the next audit:

1. **Vacuum-guard conditional refusal** — both call sites (`skills/work/SKILL.md` Phase 2
   step 8, `skills/modeling/SKILL.md` Opening step 2) placed the do-not-self-generate
   refusal so that it only textually applied when an open vision question existed to point
   at instead.
2. **Check 1b cross-task blindness** — the ADR-0061 metric-drift detector only compares a
   task against its own iteration history; a proxy drifting across a chain of fresh
   iteration-1 tasks produces no signal.
3. **Untyped investigation tasks** — an "investigate why X" task captured as `bug`/`chore`
   escapes the whole ADR-0065 apparatus (stop-loss clause, dispatch-ordering preference),
   which keys on `type: spike`.

## Decision

### 1. Disposition the three residuals

**Residual 1 — vacuum-guard conditional refusal: FIX.**

Re-reading `skills/work/SKILL.md` step 8 against ADR-0064's own Context (the Dorc failure
this ADR closes was agent capacity flowing to self-discoverable filler when the board went
quiet) confirms the gap is real for `work`: the refusal sentence lived *inside* the "if
`extractOpenQuestions` returns ≥1 item" branch, so an empty ready set with a fully-resolved
"Open questions" section carried no textual refusal at all — precisely the case where a
session, finding literally nothing to point at, would be most tempted to go find its own
busywork. Fixed: the refusal now sits immediately after the "run this only when step 7
found zero ready tasks" trigger, unconditionally, before the `extractOpenQuestions` read
even happens. The two open-items-only actions (surfacing the item, writing the
vacuum-guard session-end entry, the hard-gate exemption) stay nested under the "if it
returns ≥1 items" branch exactly as before — only the refusal itself moved.

Re-checking `skills/modeling/SKILL.md`'s Opening step 2 against the same standard found a
**sharper problem than the task's own framing described**: modeling's prose carried **no
explicit do-not-self-generate refusal sentence at all**, in or out of the branch — only an
implicit one, expressed as "the guard... never blocks capture" and "still fall straight
through to inviting a new idea (CAPTURE)." Behaviorally this was already correct (both
branches route to inviting the *user* to CAPTURE, never to modeling manufacturing a backlog
item itself), so there was no live bug — but the doctrine this task exists to make
standing practice is that the refusal be a *stated, unconditional* sentence, not an
implication a reader has to derive. Fixed the same way: step 2 now opens with an explicit,
unconditional "the do-not-self-generate refusal applies before anything else runs" sentence,
ahead of the vacuum-guard read, worded for modeling's actual shape (an empty backlog always
falls through to *inviting* CAPTURE, never to *inventing* it).

**Residual 2 — check 1b cross-task blindness: DECLINED, pending a concrete incident.**

ADR-0061 check 1b compares a criterion's recorded measurement against the *same task's*
prior `## Verifier note` sections — it has no notion of a proxy drifting across a *chain*
of separate tasks, each starting its own fresh iteration-1 history. Detecting that shape
would require the verifier to read every task in a `prior_art`/`tags`-linked chain and
diff each one's accepted measurement against the others' — genuinely new cross-task state
no current mechanism holds (check 1b's whole design, per ADR-0061's own Alternatives
considered, deliberately stays task-local specifically to avoid the complexity of reasoning
across the task graph).

This is the same evidence-gap grounds ADR-0067 declined the mid-batch checkpoint on: no
concrete incident has yet shown this exact chain-drift shape actually happening (the
Dorc-review burn ADR-0061 closes was a single six-task chain caught by other means —
the builder's own "it still doesn't work" report — not a case where cross-task check 1b
would have caught it earlier than that report did). Building cross-task drift detection
now would be speculative hardening against a shape that is plausible but unobserved.
**Declined for now, revisit the moment a concrete chain-drift incident surfaces** — not
a permanent close.

**Residual 3 — untyped investigation tasks: DECLINED, pending a concrete incident, with a
one-sentence nudge added.**

Forcing every "investigate why X" capture into `type: spike` at CAPTURE/REFINE time would
require either a keyword-matching heuristic (which will both over-fire on legitimately
non-investigative bug/chore tasks that happen to use investigative *language* and
under-fire on investigation-shaped tasks that don't) or a judgment call with no
enforcement backing it — exactly the kind of brittle-or-toothless choice ADR-0059 warns
against forcing. No concrete incident has yet shown an untyped investigation task actually
escaping the ADR-0065 apparatus and causing harm (the residual is a structural gap found by
audit, not a lived failure). **Declined pending a concrete incident**, same posture as
residual 2 — but the audit's own diagnosis (the escape hatch is real, even if unexercised)
is cheap to mitigate at zero enforcement cost: `skills/modeling/SKILL.md`'s `type` field
legend gains one sentence nudging an investigation-shaped capture toward `type: spike`, so
a refiner reading the legend at CAPTURE time is pointed at the right type before the gap
can bite, without inventing a lint for a predicate that resists cheap mechanization.

### 2. The audit PASS bar

A consistency audit ("did we miss something?") **passes** when it yields:

- **Zero findings of class contradiction / lost-rule / code-doctrine-behavior-mismatch.**
  These are the classes that actually indicate the tree is wrong — two doctrine passages
  disagreeing, a rule that used to exist and silently vanished, or prose describing
  behavior the code no longer exhibits (or never did).
- **Cosmetic classes (stale pointers, stale counts, wording drift) fixed-or-dismissed in
  the same session** — never carried forward, never counted as "missed" by a future audit.
  A cosmetic finding that isn't worth fixing gets a one-line dismissal in the audit's own
  record, not silence.
- **Judgment findings (overshoot / undershoot opinions) that the auditor declines to act
  on land as an ADR disposition in the same wave**, per ADR-0067's posture: fix, or
  decline-with-rationale-and-revisit-on-evidence — never left as an unrecorded opinion for
  the next auditor to independently rediscover.

**Enforcement disposition (ADR-0059): prose-only, unenforced.** Whether a given finding
belongs to "contradiction / lost-rule / mismatch" versus "cosmetic" versus "judgment
opinion" is a semantic read of the finding's content and the tree's actual state — the same
kind of predicate ADR-0059's own check 6c and ADR-0061's check 1b already treat as
resisting cheap mechanization. No lint can classify a prose finding into one of these three
buckets; a careful auditor (human or LLM) applying this bar is the right-sized mechanism.

### 3. Dated audit stamp + delta-scoping

Every audit run against this PASS bar ends with a dated entry appended to
`.agentheim/knowledge/audit-log.md` (newest on top, mirroring `protocol.md`'s convention),
naming:

- **the bar applied** (this ADR's PASS bar, or an explicit note if a different bar was
  used and why),
- **the verdict** (PASS, or a summary of what's still open and why),
- **the HEAD commit audited**, and
- **any open dispositions** carried forward (declined-pending-incident items, pointing at
  the ADR that recorded the decline).

**The next "did we miss something?" audit scopes to the diff since the last stamp's HEAD,
plus that stamp's still-open dispositions** — it does not re-walk the full tree from
scratch. A full-tree re-audit only runs on the builder's explicit request. This is what
actually bounds the audit-audit-audit meta-loop: each audit's cost becomes proportional to
what changed since the last one, not to the whole tree's size every time.

**Enforcement disposition (ADR-0059): prose-only, unenforced.** "What changed since the
last stamp" is a `git diff` a conductor/auditor reads and reasons over, not a predicate a
lint checks; "is the stamp itself accurate" is likewise a judgment call about whether the
audit that produced it actually applied the bar honestly. Nothing here resists
mechanization because it's *hard* to check — it resists mechanization because the thing
being recorded (an audit's own honest self-report) is inherently a prose judgment, the same
class ADR-0068's drift-twice rule and ADR-0064's "since date at capture time" convention
both already carry unenforced.

**First stamp, written by this task:** see `.agentheim/knowledge/audit-log.md`'s
2026-07-22 entry — the bar applied retroactively to the 2026-07-22 four-agent audit, its
verdict, the HEAD audited (`53f1708652b5e47c85ef9ac70a2679526d899577`, the merged base
this task's own worktree forked from), and residuals 2 and 3 above carried forward as this
ADR's own open dispositions.

### 4. Ban raw line-number pointers in doctrine prose

`skills/`, `agents/`, `references/` prose must reference another doctrine passage by a
**greppable anchor** — a step name, a section heading, a rule name (e.g. "Phase 3 step 4",
"Runner-first step 2") — never a raw line-number pointer, because a line number silently
goes stale the instant the referenced file is edited, and nothing signals the staleness
until a human happens to follow the pointer and finds it wrong. This is the exact class
that produced findings in three consecutive audits.

**Enforcement disposition (ADR-0059): mechanized.** `lib/doctrine-line-pointer.mjs`'s
live-tree `node --test` lint (`lib/test/doctrine-line-pointer.test.mjs`) walks every `.md`
file under `skills/`, `agents/`, `references/` and flags any line matching a recognized
raw-pointer shape (`~:NNN`/`~:NNN-NNN`, `(:NNN)`/`(:NNN-NNN)`, `name.md:NNN`/`name.mjs:NNN`,
`#LNNN`/`#LNNN-LMMM`), unless the exact occurrence is named in the module's own `ALLOWLIST`
with an inline rationale. Unlike the INDEX entry-length cap (ADR-0060,
`agentic-workflow-ngzwz`), this lint is **not date-grandfathered** — a raw line-number
pointer has never been a legitimate design choice in this codebase, only a drift bug, so
there is no "pre-existing and fine" boundary to draw the way there is for INDEX prose
length. The escape hatch is instead the explicit `ALLOWLIST`, which is **empty today**: a
grep of the live tree at the time this lint shipped found zero remaining occurrences of any
recognized shape (the prior three audits' fixes, most recently `agentic-workflow-k9pbh`,
had already cleared every instance found so far) — the lint ships green with nothing to
grandfather.

## Consequences

### Positive
- The three named residuals stop being re-found: each now has a visible disposition (two
  fixes, two declines-with-revisit-on-evidence for the two genuinely evidence-gapped
  cases, one already-fixed-plus-nudge for the third).
- The audit PASS bar gives "did we miss something?" a defined stopping condition for the
  first time — an audit can now actually report "done," not just "here are more findings."
- The dated stamp + delta-scoping convention bounds the cost of every future audit to the
  diff since the last one, rather than a full-tree walk every time — the structural fix
  for the meta-loop's actual cost driver.
- The line-pointer lint permanently closes a finding class that had independently
  resurfaced in three consecutive audits, at zero ongoing review cost from here forward.

### Negative
- The PASS bar and the audit-stamp convention are both prose-only — a careless or rushed
  audit can still skip writing the stamp, or misclassify a real contradiction as
  "cosmetic," and nothing catches it mechanically. This is the same residual risk every
  ADR-0059 judgment gate already carries.
- Declining residuals 2 and 3 pending a concrete incident means both gaps remain real and
  exploitable until that incident happens — a chain of tasks could still drift past check
  1b's blindness, and an untyped investigation task could still escape ADR-0065's
  apparatus, with only a field-legend nudge (not enforcement) standing against the latter.
- The line-pointer lint's allowlist mechanism, being unbounded by date, could in principle
  accumulate entries over time the way a date-grandfather list never would — this is judged
  acceptable because, unlike INDEX prose length, a raw pointer is never legitimately
  "old and fine," so any future allowlist entry should be rare and should carry real
  scrutiny of its rationale, not a rubber stamp.

### Neutral
- Does not retroactively re-audit any tree state before this task; it governs audits run
  from this point forward.
- Does not change `work`'s or `modeling`'s dispatch/promotion mechanics beyond the two
  refusal-placement edits — no new gate, no new blocking condition.

## Alternatives considered

- **Mechanize residual 2 (cross-task drift) now, speculatively, rather than declining it.**
  Rejected: no concrete incident has shown the chain-drift shape actually causing harm, and
  building cross-task state into a currently task-local check is real new complexity
  (reading a `prior_art`/`tags`-linked chain, diffing measurements across separate task
  files) that ADR-0061's own design deliberately avoided for the same reason. Speculative
  hardening against an unobserved failure mode is exactly the kind of premature machinery
  ADR-0059 warns against.
- **Force every investigation-shaped capture into `type: spike` via a keyword-matching
  lint.** Rejected: "does this capture read as an investigation" is a semantic judgment a
  keyword grep would both over- and under-fire on (mirrors ADR-0059's own rejected
  "standalone mechanized convention-language grep" alternative) — a legend nudge read by
  the refiner at capture time is the right-sized mechanism for a predicate this soft.
- **Date-grandfather the line-pointer lint like the INDEX entry-length cap, rather than
  an allowlist.** Rejected: a date boundary implicitly says "pointers written before
  adoption date were a legitimate choice back then" — false here. Every raw pointer found
  in this codebase's history has been a drift bug, not a design choice at the time it was
  written, so grandfathering by date would falsely bless past mistakes as acceptable
  instead of just not having found them yet. An empty, explicit allowlist correctly states
  "there is nothing to except" rather than "everything before some date gets a pass."
- **Re-run a full-tree audit every time instead of adopting delta-scoping.** Rejected:
  this is the status quo the Context section names as the actual cost driver of the
  meta-loop — the same ground walked at full cost on every "did we miss something?" ask,
  regardless of how little changed since the last pass.

## References

- ADR-0067 — the decline-as-visible-record posture (revisit-on-evidence, never silent) this
  ADR's own three dispositions mirror exactly.
- ADR-0068 — drift-twice single-source rule; the sibling doctrine bounding a related but
  distinct recurring cost (restatement drift vs. this ADR's audit-residual drift).
- ADR-0064 — vacuum guard; amended here by the refusal-placement fix (residual 1). See
  `skills/work/SKILL.md` step 8, `skills/modeling/SKILL.md` Opening step 2.
- ADR-0059 — mechanize-or-drop; every enforcement disposition in this ADR (mechanized for
  the line-pointer lint, prose-only for the PASS bar and the audit stamp) is made under
  its doctrine.
- ADR-0061 — falsifiability gate / check 1b; the cross-task blindness this ADR declines
  to close (residual 2) is check 1b's own known task-local scoping.
- ADR-0065 — remediation-over-diagnosis / spike stop-loss; the apparatus an untyped
  investigation task escapes (residual 3), and the `type: spike` legend this ADR nudges
  toward.
- ADR-0060 — INDEX entry-length cap; the date-grandfathered lint shape this ADR's
  line-pointer lint deliberately does NOT reuse (see Alternatives considered).
- `lib/doctrine-line-pointer.mjs`, `lib/test/doctrine-line-pointer.test.mjs` — the
  mechanized half of this ADR (part 4).
- `.agentheim/knowledge/audit-log.md` — the dated audit-stamp record this ADR establishes
  and writes its first entry to.
- `agentic-workflow-e7dnq`, `agentic-workflow-k9pbh` — the two prior audits whose fixes
  cleared every line-pointer occurrence this lint now finds green.
