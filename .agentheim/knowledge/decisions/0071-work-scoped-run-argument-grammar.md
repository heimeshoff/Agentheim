---
id: ADR-0071
title: "`work` argument grammar — a named task-id list scopes the run; the DAG gate stays fail-closed, no mid-run pickup"
scope: agentic-workflow
status: accepted
date: 2026-09-05
related_tasks: [agentic-workflow-swj2q]
related_adrs: [0032, 0038, 0026]
---

# ADR-0071: `work` argument grammar — a named task-id list scopes the run; the DAG gate stays fail-closed, no mid-run pickup

## Context

`/agentheim:work` has always had exactly one shape: scan every `contexts/*/todo/`, build the
DAG, dispatch the whole ready set (capped at `MAX_PARALLEL`), and loop until `todo/` is empty.
The only user-settable knobs `skills/work/SKILL.md` names are `MAX_PARALLEL` and `--no-verify`.
There was **no argument contract for a task id** — `/agentheim:work agentic-workflow-xyz` was
never refused, but nothing in the skill bound it either, so whether a session honoured it was a
heuristic of that session, not a guarantee.

The builder wants to point at one todo card and say "work on *this* one" — to ship a single
small fix while larger todo items wait, or to run one task in isolation without a batch's
merge-order ceremony. The dashboard's planned per-card Work button
(agentic-workflow-g4zce, blocked on this task) needs a deterministic command to seed, which
requires the argument's meaning to be a documented contract, not a per-session guess.

## Decision

**`/agentheim:work` gains a second termination mode, selected by whether the invocation names
one or more task ids.** This is a **selection filter** layered on the existing Phase 2–4
machinery, not a new execution path:

- **Bare `/agentheim:work`** — unchanged: the whole ready set, looping until `todo/` is empty
  (today's only behaviour).
- **`/agentheim:work <task-id>`** or **`/agentheim:work <id-1> <id-2> …`** (space- or
  comma-separated) — a **scoped run**: the batch is exactly the named id(s) (subject to the
  same `MAX_PARALLEL` cap, dispatched in successive waves if the named set exceeds it). The loop
  ends once every named id has reached a terminal state (integrated, bounced, failed, or
  escalated) — it never re-scans for newly promoted or newly-ready `todo/` tasks mid-run.
- `--no-verify` composes with either mode unchanged — it is an orthogonal opt-out of the
  verification gate, not a selector.

**The DAG gate is never bypassed by naming a task.** A named id resolves by **exact string
match only** — no fuzzy or keyword matching, which stays `modeling`'s job. Resolution has three
fail-closed outcomes, checked before any file moves:

1. The id doesn't exist anywhere in the project → refuse, naming the id.
2. The id exists but isn't in any BC's `todo/` → refuse, naming its actual lifecycle folder.
3. The id is in `todo/` but not ready (an unmet or dangling `depends_on`, per ADR-0038 Ruling
   A's existing fail-closed rule) → refuse, naming every unmet/dangling id. The `claim` verb is
   never invoked for a refused id.

A mixed invocation (some named ids valid-and-ready, others refused) refuses the **whole**
invocation rather than silently dropping the bad ones — silent partial substitution would be
exactly the "truncate silently" failure the existing cap-triggered protocol rule already
forbids for the unscoped case.

Phase 1's recovery check (a stranded `doing/` task from an interrupted session) always runs
**first**, scoped or not — naming a task never authorizes skipping recovery.

The "Batch started" protocol entry records that a run was scoped and how many other ready
tasks were left undispatched, using the same `parallel` JSON opt the cap-triggered case already
composes (e.g. `"parallel":"scoped — builder named agentic-workflow-xyz; 3 other ready tasks
not dispatched"`) — a scoped batch is never mistaken for an accidental truncation.

**No `lib/` change was needed.** `lib/task-lifecycle-cli.mjs`'s `claim` verb already accepts an
arbitrary comma-separated id list (`claimBatch(rootDir, ids, opts)` is id-list-shaped, not
"whole-ready-set"-shaped) — a scoped run is simply the conductor handing `claim` the builder's
named ids instead of the DAG's full ready set. The change is entirely in `skills/work/SKILL.md`
prose: a new "Argument grammar" section (referenced from Phase 2 step 5/7, Phase 3 step 4,
Phase 4 steps 1/7, Protocol logging, and End-of-run reporting) plus this ADR.

## Consequences

**Positive**

- The builder can run one named task without the batch's merge-order ceremony, and the
  dashboard's planned per-card Work button (agentic-workflow-g4zce) has a deterministic,
  documented command to seed.
- The DAG gate's fail-closed posture (ADR-0038 Ruling A) is preserved exactly for the scoped
  case — naming a task cannot force a dispatch a dependency graph would otherwise refuse.
- Zero `lib/` risk: the CLI's existing id-list shape absorbs this unchanged; only prose changed.

**Negative**

- One more mode for the conductor to hold in mind: "did the builder name ids this run?" gates
  whether Phase 4 step 7 re-scans or terminates. A conductor that forgets this branches
  incorrectly (re-scanning on a scoped run, silently widening it back to the full ready set) —
  mitigated by cross-references at every phase boundary that touches selection or termination,
  rather than one section the conductor might read once and forget.
- A scoped run whose named set exceeds `MAX_PARALLEL` needs multiple dispatch waves within the
  same run (Phase 4 step 7's "continue from the remaining named ids" branch) — a slightly more
  stateful loop than the simple "one wave, done" case of a single named id.

**Neutral**

- Every other mechanism (worktree isolation, the verifier gate, squash-merge integration,
  `complete`, session-end bookkeeping, vision conformance) is completely untouched — this ADR
  only changes *which* tasks Phase 2–4 selects and *when* the loop in Phase 4 step 7 stops.

**ADR-0059 disposition (mechanize-or-drop)**

This ADR establishes a convention two other doctrine surfaces (the BC README's
ubiquitous-language entry and agentic-workflow-g4zce's planned dashboard Work button) cite by
name: `skills/work/SKILL.md`'s "Argument grammar" section. Per ADR-0059, a convention cited by
name from elsewhere must either ship mechanical enforcement or be recorded as an explicit,
visible exception. This one ships enforcement, not an exception: `lib/work-argument-grammar-section.mjs`
+ `lib/test/work-argument-grammar-section.test.mjs` (added on verifier iteration 1) is a
live-tree lint asserting `skills/work/SKILL.md` still carries a top-level "## Argument grammar"
heading — the one plain mechanical predicate available (does the cited section still exist?).
The *semantic* content of the grammar (exact-match resolution, fail-closed refusal, composition
with `--no-verify`) stays a judgment call for the verifier/human, same as ADR-0059's own
self-referential carve-out for judgment-based checks (mirrors `lib/human-eye-criteria.mjs`'s
doc comment on this point) — mechanizing "is the prose still correct" is not practical, only
"does the doctrine surface it's named after still exist" is.

## Alternatives considered

- **A `--task <id>` flag instead of bare positional ids.** Rejected as unnecessary ceremony —
  task ids are already collision-resistant (ADR-0028) and unambiguous against `MAX_PARALLEL`'s
  own prose-knob shape (a number vs. an id string can't be confused), so a bare positional list
  reads cleanly without a flag.
- **Fuzzy/keyword resolution of a partial or descriptive id.** Rejected — that is exactly
  `modeling`'s judgment-laden territory (title search, semantic matching); `work`'s job is
  mechanical dispatch, and a wrong guess dispatching the wrong task is a worse failure mode than
  refusing an unrecognized id.
- **Silently drop unready/unresolved ids from a mixed named set and dispatch the rest.**
  Rejected — indistinguishable from the "truncate silently" anti-pattern the existing
  cap-triggered protocol rule already forbids; refusing the whole invocation keeps the contract
  simple and honest.
- **Let a scoped run still re-scan and pick up newly-ready tasks mid-run.** Rejected — it would
  make "scoped" mean nothing different from "unscoped, just starting narrower," defeating the
  builder's actual ask ("run *this one*, and stop").

Builds on **ADR-0032** (the worktree/squash-merge batch model, unchanged by this decision — a
scoped batch is still just a batch), **ADR-0038 Ruling A** (fail-closed `depends_on`, applied
identically to named ids), and **ADR-0026** (the "never truncate silently" protocol discipline,
extended to name a scoped run explicitly rather than let it read as an accidental cap).
