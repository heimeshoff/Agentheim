---
id: ADR-0066
title: Session-start human-churn reconciliation — untrailed commits since last session end surfaced as an advisory
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-hhjjx, agentic-workflow-pzacx, agentic-workflow-m7xva]
related_adrs: [0026, 0027, 0038, 0064, 0040]
---

# ADR-0066: Session-start human-churn reconciliation — untrailed commits since last session end surfaced as an advisory

## Context

Dorc's July-2026 agent-time review (recommendation A6) found a concrete failure pattern:
the builder's out-of-band commits — a level reorg, a raw edit to a file governed by an
ADR, landed straight on `main` with no worker/skill in the loop and no amendment
recorded — left the agents' world model stale. Tests pinned to the old state then failed
mysteriously, and whole tasks came to exist only to chase that churn after the fact. The
drift was discoverable at session start — nothing looked.

**agentic-workflow-d6q4h** (ADR-0026's session-end carry-over reconciliation) already
solved the mirror-image problem at the *other* end of the session: stranded
working-tree/worktree files nobody committed. This task is that pattern's remaining,
final piece for the *start* of a session: not "what did this session leave dirty" but
"what changed on `main` since the last session ended that no worker or skill produced."

The `[<task-id>]` commit-trailer convention (ADR-0026) — every `work`, `modeling`, and
`quick-capture` commit carries a bracketed task-id trailer in its subject line — makes a
human/out-of-band commit cheaply detectable: a commit with no bracketed trailer at all is
either such a commit, or a human one. Dorc's own review lacked any such convention to
lean on; Agentheim already has it, so this reconciliation is materially cheaper here than
it would have been for Dorc.

## Decision

**A new `work` session-start step, advisory-only, in the ADR-0027 family — never a gate,
never an auto-filed task.**

### 1. When it runs

Once per session, at the end of Phase 1 (Recovery check), before Phase 2's
dependency-graph scan — independent of which Phase-1 recovery scenario applied. A fresh
project with no prior "Work session ended" protocol entry skips the whole reconciliation
silently (there is nothing yet to compare against) — this is not a degraded case worth
surfacing, just the natural absence of a boundary on session one.

### 2. What it detects

1. Resolve the most recent `## YYYY-MM-DD HH:MM -- Work session ended` protocol entry as
   the commit-range boundary (`lib/session-start-churn.mjs`'s `resolveSinceLastSessionEnd`).
2. The conductor runs, on the main tree, the one git read this reconciliation needs:
   `git log --since="<since>" --name-only --format="%x1eCOMMIT%x1f%H%x1f%s"`. This stays
   **prose**, in `skills/work/SKILL.md` — never inside a `lib/` module (ADR-0038's
   git-free boundary).
3. `parseCommitLog` turns the raw text into structured `{sha, subject, files}` records;
   `hasTaskTrailer`/`findUntrailedCommits` filter to commits whose subject carries no
   `[<task-id>]` bracketed trailer at all.
4. The skill (not the `lib/` helper) judges which of those commits' touched files land on
   a **governed surface** — a file an ADR describes, or a file a BC README documents as
   load-bearing (its `## Runtime surface` manifest, ubiquitous-language entries, Key
   commands). This is genuine judgment, per ADR-0038's three-layer boundary — a skim of
   familiar ADRs/READMEs, not an exhaustive index cross-reference gating Phase 2.

### 3. What it surfaces

A **session-start line**, printed before Phase 2's "X tasks ready..." summary, listing
each untrailed commit (`formatUntrailedCommitLine`: short sha, subject, touched files)
with the governed-surface flag appended where step 4 found one, or the whole-batch
`formatHumanChurnSummary`'s "none" line when the commit range is clean. When at least one
commit is flagged as touching a governed surface, the step also (over)writes
`.agentheim/state/whats-next.md` (ADR-0027) naming the flagged commit(s) and inviting the
builder to approve an explicit re-alignment task via `modeling`.

**Never auto-files a task, never gates.** The step recommends; the builder decides
whether a re-alignment task is worth capturing. Phase 2 proceeds exactly as it otherwise
would, regardless of what this step finds.

### 4. Deliberately no attempt to distinguish human commits from trailer-less machine commits

Not every trailer-less commit is a human commit — `modeling` DISMISS and `brainstorm`'s
session commit are legitimate machine commits that also omit the `[<task-id>]` bracket
by the existing ADR-0026 message convention (see `references/commit-doctrine.md`'s
table). This reconciliation does not try to tell the two apart. The asymmetry is
deliberate: this is advisory-only, so an occasional familiar machine-commit line costs
the builder one glance to recognize and dismiss, while silently excluding a genuine human
commit (by trying to be clever about which trailer-less shapes are "expected") would
defeat the mechanism's entire purpose. A future task could special-case the known
machine shapes if the false-positive rate ever proves annoying in practice; nothing about
this ADR forecloses that, but it is not worth the coupling today for an advisory line the
builder already has to read regardless.

### 5. `lib/session-start-churn.mjs` — git-free (ADR-0038), `node --test`-covered

Deterministic and therefore mechanized: `resolveSinceLastSessionEnd` (protocol-text
parsing for the session-end boundary), `parseCommitLog` (the documented `git log`
output shape → structured commits, loss-tolerant), `hasTaskTrailer`/`findUntrailedCommits`
(the trailer predicate + filter), and `formatUntrailedCommitLine`/`formatHumanChurnSummary`
(the advisory text shape). The module never shells out to git and never writes — the one
git read is a conductor prose step in `skills/work/SKILL.md`, exactly mirroring how
`lib/worktree-salvage.mjs`'s git reads stay conductor-only (ADR-0063).

Left as skill judgment, not mechanized: which touched files count as "governed" (step
2.4 above) and how to word the builder-facing recommendation — there is no deterministic
"is this file governed" oracle short of a full ADR/README path index, which this task
does not build (see "Alternatives considered").

### Mechanize-or-drop (ADR-0059)

This task establishes one convention and states its enforcement status per ADR-0059:

1. **Trailer parsing / commit-range resolution.** Mechanized — `lib/session-start-churn.mjs`
   is the enforcement, `node --test`-covered.
2. **"What counts as governed" and the recommendation wording.** Prose-only, unenforced —
   this is genuine per-session judgment (ADR-0038's three-layer boundary), the same shape
   as the vision-conformance pass's "does this task diverge from the vision" judgment
   (ADR-0040), which is likewise not mechanized. A lint could only check that *some* text
   was produced, not that the judgment was any good — not worth the coupling.

## Consequences

- Out-of-band commits are visible at the start of the very next session that reads
  protocol.md, instead of silently accumulating drift until a test failure or a
  confused worker surfaces the symptom weeks later.
- Composes cleanly with the vacuum guard and vision-conformance passes (both ADR-0027
  family, both write the same single-latest `whats-next.md`): this step's write happens
  earliest, at session start; later same-session writes (vacuum guard in Phase 2,
  vision-conformance at session end) naturally supersede it, exactly as the existing
  "whichever pass wrote it last is current" precedent already establishes. No new
  collision-avoidance mechanism was needed.
- A handful of known machine-commit shapes (`modeling` DISMISS, `brainstorm`) will
  routinely appear in the untrailed-commit list alongside genuine human commits — an
  accepted, named cost of favoring recall over precision on an advisory-only signal.
- Nothing about task dispatch, verification, or commit behavior changes — this is
  strictly additive session-start reporting.

## Alternatives considered

- **Special-case the known machine-commit shapes (`modeling` DISMISS, `brainstorm`) out
  of the flagged list.** Rejected for now: it would require this reconciliation to parse
  and trust each machine shape's exact prose convention, which drifts whenever those
  commit messages change, and the cost of not doing so is one extra glance per session at
  worst. Revisit if the false-positive rate proves genuinely annoying.
- **Build a governed-path index (every ADR's referenced paths, every BC README's
  documented surfaces, pre-computed) so "is this file governed" becomes a mechanical
  lookup.** Rejected: no such index exists today, ADRs reference files in free prose (no
  structured `paths:` frontmatter field), and building one is a substantially larger task
  than this reconciliation step — the judgment skim is cheap enough at session-start
  scale (one commit range, typically a handful of commits) that the mechanization isn't
  worth its own maintenance burden yet.
- **Gate Phase 2 on the builder acknowledging the human-churn line before proceeding.**
  Rejected outright: contradicts vision.md's "Not autonomous" non-goal read the other
  direction — this mechanism exists to *inform*, not to add friction to every session
  start. Every sibling advisory in this family (vacuum guard, vision-conformance,
  carry-over reconciliation) is non-blocking; this one follows the same doctrine.

## Amendment — 2026-07-22 (agentic-workflow-pzacx): mechanize the known-shapes recognition; one summary line replaces per-commit itemization

This is the revisit section 4 and "Alternatives considered" both named as open ("a future task
could special-case the known machine shapes if the false-positive rate ever proves annoying").
The condition was met on two fronts:

1. **Cost of the prose-only stance.** Keeping the "known machine shapes" enumeration in sync
   across `skills/work/SKILL.md`, this ADR, and the BC README had already cost two dedicated
   fix-tasks in one week (agentic-workflow-d7ksw, agentic-workflow-c5nvb) — every enumeration
   drifted independently because nothing mechanically enforced they stay in lockstep with
   `references/commit-doctrine.md`'s actual table. The same audit that flagged that drift also
   found every one of those enumerations omitted `modeling` CONSOLIDATE, which
   `references/commit-doctrine.md` itself has defined as trailer-less since the CONSOLIDATE verb
   was introduced — so a CONSOLIDATE commit silently read as human churn on every prior session.
2. **Consumer-repo false-positive rate.** This project self-hosts, so machine commits dominate
   its own history and the "known machine shapes" cost was mostly theoretical here. In a consumer
   repo where a solo builder commits by hand constantly, the *original* prose-only design flagged
   nearly every commit for a governed-surface judgment skim, every session — the false-positive
   rate the original "Alternatives considered" entry treated as hypothetical is the *common* case
   for a consumer install.

**Decision:** `lib/session-start-churn.mjs` gains `recognizeMachineShape` — a closed, deterministic
pattern set matching `references/commit-doctrine.md`'s complete known-shapes table exactly
(`modeling` DISMISS, `modeling` CONSOLIDATE, `brainstorm`'s session commit, `research`'s
report-cleared-review commit, and `work`'s own four bare fallback shapes: reconcile stranded
carry-over, session-end bookkeeping, protocol rotation, INDEX done-list rotation — eight entries
total) — plus `partitionUntrailedCommits` (splits an untrailed-commit list into
`recognized`/`human`) and `formatChurnSummaryLine` (the new one-line report: "N recognized
machine-shape commits, M human commits"). `skills/work/SKILL.md`'s churn step now prints exactly
that one summary line, always, and itemizes individual commit lines (`formatUntrailedCommitLine`,
unchanged) **only** for the governed-surface hits its judgment step (section 2.4, unchanged) finds
— applied to every untrailed commit, recognized or human alike, since a known machine shape
touching a governed file is still worth a glance.

**What does not change:** section 4's core stance — a subject matching none of the known shapes is
still counted as human, full stop. This amendment narrows the *known* set from "assume nothing" to
"mechanically recognize this closed list", it does not attempt to reduce false negatives on
genuinely novel machine shapes; recall over precision on the unknown case is unchanged. The
"Alternatives considered" entry rejecting this exact move is superseded by this amendment — the
false-positive cost it weighed against ("one extra glance per session at worst") no longer holds in
a consumer install, and the maintenance cost it worried about (drifting prose) is now borne by a
`node --test`-covered pattern set instead of three independent hand-written enumerations.

**Iteration-2 correction (same task, same day):** the first pass of this amendment shipped
`MACHINE_SHAPES` missing the `research` row — `chore(<bc-or-global>): research <slug>` /
`chore: research <slug>` — which `references/commit-doctrine.md` had gained earlier the same
session (agentic-workflow-n3bbk), landing just before this task's worktree was cut. The verifier
caught the omission (the exact false-positive class this amendment exists to close, mirroring the
CONSOLIDATE gap it does fix); `research` was added to `MACHINE_SHAPES`, `node --test` coverage
added for both its BC-scoped and global forms, and the "authoritative, complete list" claim in
`skills/work/SKILL.md` and this module's header comment corrected to name all eight entries the
completeness audit above confirms is the full trailer-less set of both `commit-doctrine.md` tables.

**Related, same task, not part of this ADR's decision:** the same task (agentic-workflow-pzacx)
also consumer-tuned the session-**end** carry-over reconciliation (`agentic-workflow-d6q4h`'s
mechanism, `skills/work/SKILL.md`'s "Reconciling stranded carry-over" section) — per-file asks now
scope to `.agentheim/`-owned paths only, with everything else batched into one `left behind (user
WIP, N files)` line. That mechanism's decision of record isn't a standalone ADR (it lives in the
`d6q4h` task file and ADR-0026's committing doctrine), so its tuning is recorded there and in the
BC README, not duplicated as a second ADR here.

## Amendment — 2026-07-22 (agentic-workflow-m7xva): table extension (batch-capture, release-flow shapes) + delete-and-pointer on the churn-behavior paragraph (ADR-0068)

A 2026-07-22 post-survey audit found two problems with the pzacx amendment above, both fixed
by this task:

1. **`references/commit-doctrine.md`'s churn-behavior paragraph had drifted a third time.**
   It still stated the pre-pzacx stance ("deliberately does not try to distinguish these known
   machine shapes from a real human commit") even though `recognizeMachineShape` /
   `partitionUntrailedCommits` do exactly that. This is the same restatement's *third* drift
   (after `agentic-workflow-d7ksw` and `agentic-workflow-c5nvb`), so ADR-0068's drift-twice
   rule applies: the paragraph was deleted and replaced with a one-line pointer to
   `lib/session-start-churn.mjs` and this ADR — it will not be re-synced a fourth time.
2. **`MACHINE_SHAPES` (and its source table) were missing three real machine shapes**, so
   genuine machine commits were miscounted as human churn: a legacy trailer-less
   batch-capture summary commit (`2e2b241`), the release-manifest-bump commit
   (`chore(release): vX.Y.Z`, `2ac05bc`), and the release protocol-record commit
   (`chore(protocol): record vX.Y.Z release shipped [work]`, `a328700`). All three are now
   in `MACHINE_SHAPES` and in a new "Batch-capture and release-flow shapes" table in
   `references/commit-doctrine.md`, bringing the closed set to eleven entries. The release
   protocol-record shape's `[work]` token is documented as a sanctioned pseudo-trailer *and*
   given its own `MACHINE_SHAPES` row, since it already happens to satisfy `hasTaskTrailer`'s
   bracket-only predicate today — both are recorded so the table stays 1:1 with the code
   regardless of how that predicate evolves.

`node --test` coverage (`lib/test/session-start-churn.test.mjs`) asserts all three real
historical subjects partition as machine, not human, and the existing eight-shape coverage
stays green.

## References

- ADR-0026 — the `[<task-id>]` commit-trailer convention this reconciliation reads.
- ADR-0027 — the advisory-write family (`whats-next`, single-latest) this step's
  optional write joins.
- ADR-0038 — the git-free `lib/` boundary; the three-layer split (deterministic
  mechanism vs. skill judgment) this ADR follows.
- ADR-0040 — vision-conformance check; the nearest prior-art shape for a session-scoped
  advisory pass with a git-free `lib/` half and a judgment half.
- ADR-0064 — vacuum guard / batch-mix line; the sibling session-scoped advisory this
  step composes with over the shared `whats-next.md` artifact.
- `agentic-workflow-d6q4h` — the session-**end** carry-over reconciliation this task
  mirrors at the other end of the session.
- `skills/work/SKILL.md` — "Session-start human-churn reconciliation" (Phase 1) and
  `lib/session-start-churn.mjs` / `lib/test/session-start-churn.test.mjs` (this task's
  implementation).
