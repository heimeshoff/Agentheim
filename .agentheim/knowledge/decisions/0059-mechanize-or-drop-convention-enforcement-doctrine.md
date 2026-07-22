---
id: ADR-0059
title: Mechanize-or-drop — a convention-establishing task ships its enforcement or records "prose-only, unenforced"
scope: agentic-workflow
status: accepted
date: 2026-07-21
related_tasks: [agentic-workflow-z394j, agentic-workflow-b4yrm]
related_adrs: [0044, 0052, 0038]
---

# ADR-0059: Mechanize-or-drop — a convention-establishing task ships its enforcement or records "prose-only, unenforced"

## Context

Dorc's July-2026 agent-time review (recommendation A3) surfaced a concrete failure: agents
twice violated a convention that was *literally in their context* (the no-hand-typed-UID
rule) before the cheap enforcement — a one-evening text lint — was proposed, only after the
violation had already caused the week's largest rabbit hole. Prose rules do not reliably bind
agent behavior; the project's own history already proves the alternative works.
`agentic-workflow-078`/ADR-0044 (the id-grammar minting rule) and `infrastructure-nz6k4`/
ADR-0052 (the `agentheim:` agent-spawn namespace rule) both shipped a live-tree `node --test`
lint *in the same task* that introduced the convention, and neither has regressed since.
What was missing was not the pattern — it already existed twice — but a standing doctrine
that makes "ship enforcement" the default expectation for the *next* convention-establishing
task, rather than something a task happens to do when the author remembers to.

Nothing before this ADR asked, at the two points where it matters — readiness (can this task
be promoted to `todo/`?) and verification (is this diff committable?) — whether a task
establishing a convention had done anything about enforcing it. A task could quietly land a
brand-new "always do X" rule in prose only, with no mechanism ever catching a future
violation, and nothing in the pipeline would notice.

## Decision

**A task that establishes a convention — a naming, format, or structural rule other tasks,
agents, or artifacts are expected to follow going forward, not a one-off choice scoped to
that task alone — must either ship its enforcement in the same task (a lint, a live-tree
`node --test` check, or a build failure) or explicitly record "prose-only, unenforced" in the
task file. An unenforced convention becomes a visible, recorded decision, never an accident.**

This is deliberately **not** a blanket "every convention must be mechanized" rule — some
conventions genuinely resist cheap mechanization (a stylistic preference, a rule that would
require semantic understanding no lint can approximate), and forcing a lint in those cases
would produce brittle, gamed checks worse than no check at all. The doctrine's actual bar is
lower and cheaper: **the choice must be made and recorded**, not defaulted into silently. A
task that writes "prose-only, unenforced — mechanizing this would require X, judged not worth
it because Y" has fully satisfied the doctrine even though it ships no lint at all.

### Where the gate lives

Two points, mirroring how the project already gates ADR-worthiness (the existing "check 6"
ADR gate in `agents/verifier.md`, which this doctrine is deliberately modeled on):

1. **Readiness (`skills/modeling/SKILL.md`)** — CAPTURE's "Decide refinement level" step and
   PROMOTE's "Check readiness" step both gained a **convention check**: a task judged to
   establish a convention is not "Ready" / does not pass readiness unless it carries either
   an enforcement acceptance criterion or the "prose-only, unenforced" marker. REFINE reuses
   PROMOTE's readiness check verbatim (per its existing auto-promote step), so all three flows
   named in this task's acceptance criteria are covered by the same two edits.
2. **Verification (`agents/verifier.md` check 6c, mirrored in
   `skills/verification-before-completion/SKILL.md`)** — a fresh-eyes check, sitting beside
   the existing ADR gate (check 6/6b), judging whether the diff establishes a convention and,
   if so, whether the task file carries enforcement-that-the-diff-actually-ships or the
   explicit marker. Neither present is a FAIL, analogous to a missing ADR.

Both gates are **judgment calls made by an LLM reading the task/diff**, not a deterministic
script — the same shape the existing ADR gate already uses successfully. "Does this task
establish a convention?" is a semantic question (unlike ADR-0044's leading-letter-token shape
or ADR-0052's bare-agent-name grep, which are mechanically checkable once *identified* as the
convention to enforce) that resists a general-purpose lint; a human-legible prompt-embedded
check judged by a careful reader is the right-sized mechanism for *detecting* a
convention-establishing task, even though the *enforcement it demands* of that task should
itself be mechanical wherever practical.

## Self-referential compliance

This task (`agentic-workflow-z394j`) is itself a convention-establishing task — it must
satisfy its own rule. **It ships enforcement, not a "prose-only, unenforced" marker**: its own
acceptance criteria #1 and #2 *are* the enforcement — the modeling readiness gate and the
verifier check 6c this ADR describes are exactly the mechanism that will flag a *future*
convention-establishing task that ships neither enforcement nor the marker. This is the same
shape ADR-0044/ADR-0052 used (mechanism shipped in the same task as the rule it enforces),
adapted to a doctrine whose "mechanism" is necessarily a judgment-based prompt check rather
than a `node --test` script, because — per the "Where the gate lives" section above —
identifying "does this establish a convention" is not a mechanically checkable predicate the
way ADR-0044's token shape or ADR-0052's bare-name grep are.

## Self-hosting-only enforcement scope (amendment, agentic-workflow-b4yrm, 2026-07-22)

Every `node --test`-covered convention lint this doctrine has produced so far —
`lib/human-eye-criteria.mjs`, `lib/index-entry-length.mjs`, `lib/spike-stop-loss.mjs` — asserts
its invariant against **the live `.agentheim/` tree at the location `node --test
lib/test/*.test.mjs` is actually run from** (each test resolves its own repo root via
`import.meta.url`, then walks that root's `contexts/*` folders). That is exactly this repo's own
root when the suite runs here, during Agentheim's own development — the self-hosting case these
lints were built and proven against. It is **not** the same thing in a consumer install: a
project that installs Agentheim as a plugin gets the plugin's cached `lib/test/*.test.mjs` files
sitting under `~/.claude/plugins/cache/agentheim/agentheim/<version>/lib/test/`, with no wiring
that runs that suite against the *consumer's own* `.agentheim/` tree — nothing in the consumer's
build/CI ever invokes it, and even if something did, the `import.meta.url`-relative repo-root walk
would resolve to the plugin's cache checkout, not the consumer's project.

**This scoping is a deliberate, visible decision, not an oversight the doctrine failed to catch.**
Mechanizing these three lints so they *also* run inside every consumer install would require
either shipping a consumer-facing test/CI hook the plugin installs into the host project (a new
distribution mechanism, out of scope for the conventions themselves) or re-pointing each lint's
root-resolution at the consumer's project root instead of the plugin's own — both real projects,
neither justified by any consumer-side incident so far. Per this ADR's own bar ("the choice must
be made and recorded, not defaulted into silently"), the three lints stay **self-hosting-only
enforcement**; every consumer project gets the **prose-only** convention the corresponding skill
step already documents (the mechanize-or-drop doctrine itself, the human-eye-criteria note, the
index-entry-length cap, the spike stop-loss clause) — enforced by agent judgment in a consumer
install, exactly as every convention was before this ADR, with no lint backing it there. Should a
consumer-side violation ever surface, revisit distributing the lints rather than treating this
note as a permanent close.

## Consequences

### Positive
- Closes the exact gap the Dorc review named: an unenforced convention can no longer land
  silently — it must be a recorded, deliberate choice.
- Reuses an already-proven gate shape (the ADR check) rather than inventing new machinery,
  keeping the doctrine cheap to hold in an agent's context.
- The "prose-only, unenforced" escape hatch keeps the doctrine honest — it does not force
  brittle lints onto conventions that genuinely don't mechanize well, which would create
  pressure to game or skip the check instead.

### Negative
- Both gates are judgment calls, not deterministic checks — a careless reader (worker at
  readiness time, verifier at commit time) can still misjudge whether a task "establishes a
  convention" and let one through unflagged, the same residual risk the existing ADR gate
  already carries.
- Adds one more readiness/verification question to hold in mind per task, a small ongoing
  cognitive cost against the recurrence this doctrine prevents.

### Neutral
- Does not retroactively require every past convention (documented pre-ADR-0059) to gain
  enforcement or a marker — it governs tasks refined/verified from this point forward.

## Alternatives considered

- **Blanket "every convention must ship a lint," no prose-only escape hatch.** Rejected: some
  conventions (naming taste, structural preferences with no cheap mechanical test) would force
  either a brittle gamed lint or an outright ban on capturing them at all — worse than
  requiring the choice be visible.
- **A standalone mechanized script that greps task files for convention language.** Rejected
  for this task's scope: "does this task establish a convention" is a semantic judgment a
  keyword grep would both over- and under-fire on; the existing ADR-gate shape (LLM judgment
  at readiness + verification) is the right-sized mechanism, and building a new script here
  would duplicate machinery for a check that already has a proven pattern to reuse.
- **Gate only at verification, skip readiness.** Rejected: catching the gap at PROMOTE time is
  cheaper than catching it after a worker has already spent effort on a diff — REFINE's
  auto-promote step means the readiness gate is nearly free to add given PROMOTE's check
  already exists.

## References
- ADR-0044 — id-grammar minting rule; in-house exemplar of enforcement shipped with the rule.
- ADR-0052 — `agentheim:` agent-spawn namespace rule; the second in-house exemplar.
- ADR-0038 — the three-layer lifecycle-mechanization boundary; the general principle that a
  judgment-laden decision belongs with the skill/agent making the call, not a git-free script,
  which is why this doctrine's gate is prompt-embedded judgment rather than a `lib/` lint.
- `skills/modeling/SKILL.md` — CAPTURE step 4, PROMOTE step 2 (this task's implementation).
- `agents/verifier.md` check 6c, `skills/verification-before-completion/SKILL.md` (this task's
  implementation).
