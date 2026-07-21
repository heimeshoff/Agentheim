---
id: ADR-0066
title: Session-start human-churn reconciliation — untrailed commits since last session end surfaced as an advisory
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-hhjjx]
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
