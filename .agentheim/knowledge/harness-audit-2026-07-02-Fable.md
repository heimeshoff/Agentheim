# Agentheim Harness Audit — 2026-07-02

> Rigorous audit of the Agentheim agentic harness: workflow, gaps, orchestration,
> and model routing. Produced by a full read of every agent definition, all eleven
> skills, the `/dashboard` command, `lib/`, the dashboard server and app source,
> the templates, the evals, and this repo's own `.agentheim/` (vision, 30 ADRs,
> indexes, protocol). Includes **three confirmed defects**.
>
> **Updated same day:** cross-checked against the parallel Opus audit
> (`agentheim-harness-audit-Opus.md`). Five of its findings survived verification
> against the repo and are folded in below, marked **⊕**.

---

## Phase 0 — Inventory

**Agents** (`agents/*.md` — none has a `model:` field; all inherit the session model):

| Agent | Purpose | Tools |
|---|---|---|
| `orchestrator` | Routes modeling/refinement questions to specialists, aggregates, surfaces conflicts | R/W/E/Grep/Glob/Bash/Agent |
| `worker` | Executes one refined task end-to-end, TDD, strict return block, no git | R/W/E/Grep/Glob/Bash/Agent |
| `verifier` | Fresh-context post-SUCCESS audit of the diff vs. acceptance criteria; PASS/FAIL/SKIP | read-only + Bash |
| `architect` | Cross-cutting tech decisions, ADR drafts | R/W/E/Grep/Glob |
| `strategic-modeler` | BC identification, context map, classification | R/W/E/Grep/Glob |
| `tactical-modeler` | Aggregates/events/commands/invariants inside one BC | R/W/E/Grep/Glob |
| `researcher` | Web research → cited report | + WebSearch/WebFetch |
| `research-reviewer` | Fresh-context re-verification of checkable claims against primary sources | read-only + web |

**Skills:** `brainstorm` (vision + architecture-foundation pass), `modeling`
(CAPTURE/REFINE/PROMOTE/DISMISS — 443 lines, the heaviest), `quick-capture`
(no-questions dump to backlog), `work` (the parallel worker loop, 396 lines),
`research` (+ `research-review` doctrine), `whats-next` (read-only recommendation
+ one advisory write), `inquire` (read-only Q&A), `test-driven-development` and
`verification-before-completion` (doctrine documents). One command: `/dashboard`.
**Zero hooks** — every structural rule is prompt-enforced.

**Memory/context system:** `vision.md` → `context-map.md` → per-BC `README.md`
(ubiquitous language) + `INDEX.md` (marker-based lists/counts, LLM-edited) → task
files with backlink frontmatter (`depends_on`, `related_adrs`, `prior_art`,
`related_research`) → `knowledge/` (ADRs, research, `protocol.md` prepend-only
diary — currently 5,726 lines) → `state/whats-next.md` (advisory, git-ignored).
Context flows to workers via pre-loaded blocks pasted into spawn prompts (ADRs in
full, prior-art excerpts, protocol head-100) — genuinely good context engineering.

**Dashboard:** read-only (ADR-0017) — Node stdlib server, SSE live updates,
Kanban board. It **observes**; it does not drive the loop. Its buttons fire skill
invocations (`/agentheim:modeling promote <id>`, work, whats-next) into a real
Claude terminal via the VS Code bridge extension (ADR-0018). The human is the
scheduler.

**Assumption:** sessions run on Opus-class models by default; no per-agent
routing exists anywhere today. Nothing critical was ambiguous enough to block on.

---

## Confirmed defects (fix these regardless of anything else)

**1. Return-format drift silently disables the verifier's test-execution check.**
`agents/worker.md:128-130` requires `TESTS_ADDED`, `TESTS_PASSING`, `TDD_SKIPPED`
in the SUCCESS block, and `agents/verifier.md:49` gates its check 2 on "If
`TESTS_ADDED > 0` … run the test suite." But the spawn template the worker
actually receives — `skills/work/SKILL.md:350-358` — omits all three fields and
says "return ONLY the following, nothing else." A compliant worker therefore
never reports test counts, the verifier's trigger never fires as specified, and
the protocol entry's "**Tests added:** N" (`work/SKILL.md:245`) has no source.
This is exactly the drift class that copy-pasted doctrine invites (the format
lives in two files that disagree). Five-minute fix: add the three lines to the
template in `work/SKILL.md`.

**2. `lib/task-lifecycle.mjs` is wired to nothing.** Its own header says it's
"owned by and used by the skills (`modeling`/`work`)" — but no skill references
it (grepped; only the committed eval fixture mentions it). The dashboard doesn't
call it either (read-only since ADR-0017). So the invariants it encodes and tests
— legal-move policy, status-rewrite-plus-rename atomicity, mtime precondition,
the `depends_on` promote gate — live in dead code, while live enforcement is LLM
prose discipline re-stated in four skills. Worse, the two disagree:
`work/SKILL.md:25` treats a *missing* `depends_on` target as
satisfied-with-warning, while `dependencySatisfied()`
(`lib/task-lifecycle.mjs:98`) returns false. Two sources of truth, opposite
semantics.

**3. Stale README.** `README.md:74` claims the dashboard's "one write-back is
dragging a card `backlog→todo` to Promote." The board explicitly carries **no**
drag affordances (`dashboard/app/board.js:1114`); Promote is a bridge-launched
`/agentheim:modeling promote <id>`. ADR-0017 is the truth; the README predates it.

**4. Committed eval debris in the plugin payload.** `skills/capture-workspace/`
is a skill-creator eval workspace (a full `.agentheim` fixture clone,
`write_grades.py`, an 89 KB review HTML) committed into `skills/`, where every
consumer installing the plugin pulls it. Move it under `evals/` or delete it.

---

## Phase 1 — Workflow analysis

The lifecycle — brainstorm → capture/model → refine → promote → work (dispatch →
TDD → verify → commit) — is coherent and unusually well-guarded. The two
fresh-context gates (verifier, research-reviewer) with strict parseable verdicts,
capped iterations, and escalate-to-human terminal states are the strongest part
of the design. The pre-loaded context blocks in worker spawns are the right
answer to context isolation. Human checkpoints are well-placed (promote gate,
styleguide gate, DISMISS single-confirm, verification escalation).

The frictions, in order of real cost:

### The main `work` context is a bookkeeping clerk

After each PASS, the orchestrating session hand-edits INDEX marker lists and
counts, prepends protocol entries at line 4, reconciles bidirectional ADR↔task
backlinks, and assembles enumerated `git add` lists — roughly half of
`work/SKILL.md` and a third of `modeling/SKILL.md` is instructions for mechanical
text surgery. This burns the orchestrator's context across long batches (the
thing the skill explicitly says it's trying to protect), and it's the harness's
largest error surface: the INDEX counts, duplicate lines, and missed backlinks
can only drift, because an LLM is doing a job a script does perfectly. The tell:
`scripts/backfill-indexes.ps1` already exists — the indexes are *provably
regenerable*, yet five skills maintain them incrementally by hand.

### Parallel workers share one working tree

Conflict detection before dispatch is textual guesswork — scanning
`What`/`Acceptance criteria`/`Notes` for file paths (`work/SKILL.md:33`). Tasks
rarely name every file they'll touch. And the deeper problem: when N workers'
uncommitted changes coexist, each verifier "sees only its own task's diff" as
*text*, but when it **runs the test suite** (check 2), it runs it against a tree
containing all siblings' changes. A sibling's broken change can fail an innocent
task's verification — or mask a real failure. Similarly, a FAILed task's changes
stay on the tree while siblings commit around them, contaminating subsequent
verifier runs. MAX_PARALLEL=3 limits the blast radius but doesn't remove it.

⊕ **The scoped-add rule has a confirmed waste product: stranded carry-over.**
Anything a skill didn't explicitly enumerate in its `git add` list is left
uncommitted — forever. This is not hypothetical: `protocol.md:47` and
`protocol.md:93` record the *same two files* ("Working-tree carry-over
(untouched, as in prior sessions)") orphaned across multiple sessions, each
session dutifully stepping around them. The concurrency safety mechanism
systematically produces dirty state that accumulates silently. Fix: a
session-end reconciliation step in `work` that detects stranded files and
surfaces or commits them deliberately.

### ⊕ The verifier gets none of the worker's context treatment

Workers receive pre-loaded ADR blocks, prior-art excerpts, and protocol
head-100 — but the verifier re-discovers the project's test command from
scratch on **every iteration** (`agents/verifier.md:49-53`: hunt through
`package.json`/`Makefile`/`pyproject.toml`/`*.csproj`). An inconsistency inside
the harness's strongest mechanism. Fix: pre-load the test command (and the BC
README path) into the verifier spawn prompt exactly as workers get ADRs.

### Consultation depth and the two "orchestrators"

Redundant re-derivation is mostly avoided — pre-loaded blocks, "don't re-fetch
protocol," INDEX-over-directory-scan are all good — but the
worker→orchestrator→specialist consultation path is three contexts deep, and each
hop re-reads vision/context-map/README. For the common single-specialist question
("does this need an ACL?"), the worker could spawn the `architect` directly; the
orchestrator agent earns its keep only when multiple specialists must be
aggregated and conflicts surfaced. Also, "orchestrator" names two different
things — the agent, and the `work` skill's main loop ("The orchestrator (you)",
`work/SKILL.md:10`) — a genuine confusion for anyone (human or model) reading the
docs.

### Three Loops (What / How / Why)

The *Why* loop (brainstorm/vision/non-goals) is well-served — the
architecture-foundation pass and styleguide gate are better than most harnesses.
The *How* loop (modeling, ADRs, ubiquitous language) is well-served, arguably
over-ceremonied for tiny tasks (though the trivial-capture carve-outs mitigate).
The *What* loop is strong on inner execution but **weak on closure**: nothing
ever checks done work against the vision's "What success looks like," and
verification stops at the unit-test suite — no step ever *runs the app* and
observes the change end-to-end. The UI-task carve-out ("exercise manually and
note it") makes this the softest spot: a manual-exercise *note* is accepted as
evidence by a verifier who never sees the screen. `whats-next` partially closes
the outer loop (it reads gaps against success criteria) — good, but advisory-only
and human-triggered.

⊕ The actionable mechanism (Opus's, verified): `state/whats-next.md` currently
dead-ends at the dashboard UI — no other skill references it (grepped). Make it
a real planning input: have `modeling` and `work` read it at session start, so
the vision-gap analysis re-enters the loop instead of waiting for a human to
relay it.

---

## Phase 2 — Gap analysis

Ranked by what each gap actually costs:

| Capability | Status | Assessment |
|---|---|---|
| Worker isolation / concurrency safety | **Genuinely missing** | Shared working tree + text-based conflict prediction + test-suite cross-contamination. The most likely source of *silent* wrong verdicts. |
| Deterministic bookkeeping | **Present but wrong layer** | Invariants exist in dead code (`lib/`); live enforcement is prompt prose. Highest ongoing token + error cost. |
| Cost & token tracking | **Genuinely missing** | Nothing records tokens, wall time, or verify-iteration stats. You cannot answer "what does a work batch cost" or "is the verifier earning its spend." Protocol entries could carry this for near-zero effort. |
| Guardrails via hooks | **Genuinely missing, partially excusable** | Worker git/protocol/INDEX prohibitions are prompt-only, caught post-hoc by the verifier. Session-wide hooks can't distinguish worker from orchestrator, so the honest fix is not hooks but *moving git and bookkeeping into scripts* so the prohibition becomes structural. |
| Observability / run inspection | **Weak** | `protocol.md` is a good diary but it's prose, prepend-only, 5.7k lines, unbounded, and every skill races to prepend at line 4 (concurrent sessions are explicitly supported — this file is the collision point the scoped-add rule doesn't cover). Needs rotation (e.g., monthly `protocol-2026-07.md`) and ideally a machine-readable `runs/` JSONL beside it. ⊕ And it's blind in the *present tense*: during a `work` batch nothing on disk reflects in-flight workers, so the dashboard cannot show the parallelism that is the product's whole pitch. `SubagentStop`/`Stop` hooks writing status+timing to `.agentheim/state/` sidestep my hooks objection — observability hooks don't need to distinguish worker from orchestrator; they just record. |
| ⊕ Fan-out caps / spawn budget | **Genuinely missing** | `work` caps at a bare `MAX_PARALLEL = 3` — no rationale, no documented knob. `research` fan-out is entirely uncapped ("spawn multiple researcher agents rather than serializing", `research/SKILL.md:160`). Nested worker→orchestrator→specialist spawns have no global ceiling, and a FAIL re-dispatch re-runs the whole chain. Once cost tracking exists, this is where it must enforce. |
| End-to-end verification | **Weak** | Verifier runs unit tests only. No "drive the affected flow" step; UI evidence is a self-reported note. |
| Error recovery / retries / idempotency | **Present and good** | Recovery check, BOUNCE, capped re-dispatch, escalate-to-user, mtime preconditions in the (dead) lib. Best-covered area. |
| Context/memory management | **Present and good** | Pre-loaded blocks, head-100 protocol reads, concept pages, per-BC scoping. One hole: no compaction policy for BC READMEs or the growing indexes. |
| Eval coverage of the agentic core | **Weak** | The dashboard has ~60 test files (excellent); the agentic core has 4 prompts in `evals.json` and one abandoned eval workspace. The verifier gate — the load-bearing quality mechanism — has never been eval-harnessed (does it actually catch planted defects?). |
| Doctrine single-sourcing | **Weak** | ID convention duplicated verbatim in 3 files, strict return format in 2 (already diverged — defect #1), commit rules in 4. `references/modes.md` proves the right pattern; apply it to the rest. |

---

## Phase 3 — Orchestration & model routing

### Pattern verdict: keep orchestrator–worker with fresh-context gates

It fits the workload (independent, dependency-gated tasks; judgment gates after
execution). Don't move to blackboard or pipeline. The changes needed are *within*
the pattern:

- **(a)** Isolate workers in git worktrees, merging on PASS — this makes conflict
  detection real instead of textual, uncontaminates verifier test runs, and
  would let MAX_PARALLEL rise safely.
- **(b)** Flatten the worker→orchestrator→specialist chain to worker→specialist
  for single-specialist questions, keeping the orchestrator agent for
  multi-specialist aggregation during `modeling` REFINE.
- **(c)** Rename one of the two "orchestrators."

### Model routing

Current state: no `model:` frontmatter anywhere — every agent inherits the
session model, so today the verifier, the worker, and a one-line capture all run
on whatever the session runs on. Claude Code agent frontmatter supports `model:`;
skills cannot pin (they run in the main session), so skill-level routing is
really "what model do you run the session on."

| Component | Type | Current model | Recommended model | Rationale |
|---|---|---|---|---|
| Session (brainstorm, modeling, work loop) | skills | inherit (session) | **Opus 4.8**; Fable/Mythos when available | The Socratic sparring and refinement judgment *is* the product per `vision.md` ("an agreeable agent that produces shallow domain work" is the enemy). This is where Mythos-tier genuinely changes the calculus — pushback quality, conflation-spotting, and cross-artifact synthesis are frontier-model behaviors. |
| `worker` | agent | inherit | **Sonnet 5** | Highest invocation volume and token spend. Tasks arrive *refined* with pre-loaded ADRs and TDD discipline; the verifier gate bounds the cost of failure to a re-dispatch. Textbook case for cheap execution behind a strong gate. Biggest single cost lever in the harness. |
| `verifier` | agent | inherit | **Opus 4.8** | Judgment-dense; the harness's own doctrine says a false PASS compounds while a false FAIL is cheap. And `research-review/SKILL.md:27` already articulates why reviewer ≠ researcher model decorrelates shared blind spots — apply that argument to code: Sonnet worker + Opus verifier is the decorrelated pair. Do **not** economize here. |
| `research-reviewer` | agent | inherit | **Opus 4.8** | Same decorrelation logic, stated explicitly in the doctrine ("Same model for both" is listed as an anti-pattern — currently violated by default!). |
| `researcher` | agent | inherit | **Sonnet 5** | Retrieval + synthesis, gated downstream. Speed matters (blocks modeling sessions). |
| `orchestrator` | agent | inherit | **Sonnet 5** | Routing table is heuristic lookup; aggregation needs competence, not frontier reasoning. On Opus, that's paying frontier rates for a dispatcher. |
| `architect` | agent | inherit | **Opus 4.8** | Low frequency, decisions constrain everything downstream, ADR quality is the deliverable. Cost per call is irrelevant at this call rate. |
| `strategic-modeler` | agent | inherit | **Opus 4.8** | Boundary mistakes are the most expensive class of error in a DDD harness and the hardest to undo. Rare calls. |
| `tactical-modeler` | agent | inherit | **Opus 4.8** (Sonnet 5 acceptable) | Invariant/aggregate design rewards depth; call rate is low enough that the saving from Sonnet is noise. |
| `/dashboard` | command | n/a | n/a | Runs one `node -e` bootstrap; no model-sensitive work. |
| `quick-capture`, `whats-next`, `inquire` | skills | session | session (see note) | `quick-capture` is the one genuinely Haiku-shaped job (route + write + report) but it can't be pinned as a skill. Not worth restructuring into an agent just to save pennies. |

**Where Haiku 4.5 fits: almost nowhere — and that's a finding, not a gap.** The
classification/counting/format-shuffling work a Haiku tier usually absorbs is
exactly the work that should become deterministic scripts here (index edits,
protocol entries, commit assembly). Fill the cheap seats with code, not with a
cheaper model.

The default heuristic ("strongest orchestrates, cheapest executes") holds for the
work loop, but note it *inverts* at the gates: the executor (worker) can be
mid-tier precisely because the judge (verifier) is top-tier. Weakening the judge
to strengthen the executor would be the wrong trade everywhere in this harness.

---

## Phase 4 — Recommendations

### Quick wins (hours)

1. **Fix the `TESTS_*` template drift** in `skills/work/SKILL.md` (defect #1).
   Highest defect-severity-to-effort ratio in the audit.
2. **Add `model:` frontmatter** per the table above — eight one-line edits;
   immediately buys the worker/verifier decorrelation the harness's own doctrine
   demands and cuts worker-fleet cost substantially.
3. **Fix `README.md:74`**; relocate `skills/capture-workspace/` out of the plugin
   payload.
4. **Protocol rotation:** cap `protocol.md` at ~1,000 lines, roll to
   `knowledge/protocol/2026-07.md`. Also removes the line-4 prepend collision
   between concurrent sessions.
5. **Add `Duration`/`Iterations`** (and token counts if the harness exposes them)
   to work/verification protocol entries — near-free observability.

### Deeper refactors (days)

6. **Mechanize the bookkeeping** — see "highest-leverage change" below.
7. **Worktree isolation per worker:** dispatch each worker into its own git
   worktree; on `VERDICT: PASS`, merge + commit; on FAIL, the worktree holds the
   iteration state without contaminating siblings. Makes conflict *prevention*
   structural, fixes verifier test-run contamination, and lets MAX_PARALLEL rise
   safely.
8. **Single-source the duplicated doctrine** (ID grammar, return formats, commit
   rules) into `references/` files that skills point at — the `modes.md` pattern,
   generalized. Defect #1 is the proof this class of bug is live.
9. **Eval-harness the verifier:** plant known defects (missing criterion, scope
   creep, vocabulary violation) in fixture diffs and measure catch rate. It's the
   load-bearing gate and currently has zero measured performance.
10. **An end-to-end verification step** for tasks with a runtime surface (drive
    the flow, not just the suite), replacing the self-reported "manual exercise
    note" for UI tasks.

### ⊕ Folded in from the Opus audit (verified against the repo)

11. **Carry-over reconciliation** (quick win): at `work` session end, detect
    stranded working-tree files and surface or commit them deliberately.
    `protocol.md:47`/`:93` prove the leak is live.
12. **Pre-load the test command into the verifier spawn prompt** (quick win):
    ends the per-iteration rediscovery at `agents/verifier.md:49-53`; symmetric
    with the worker's pre-loaded blocks.
13. **Document `MAX_PARALLEL` as a user-settable knob, cap `research` fan-out,
    and add a global ceiling on nested spawns** (quick win): all three fan-out
    surfaces are currently either magic or unbounded.
14. **Live observability hooks** (deeper): `SubagentStop`/`Stop` hooks write
    agent status + timing to `.agentheim/state/`; the dashboard renders an
    in-flight lane. Complements #4/#5, which only fix the historical record.
15. **Feed `whats-next` back into planning** (deeper; half-credit — the
    weak-closure *finding* is in Phase 1 above, the *mechanism* is Opus's):
    `modeling`/`work` read `state/whats-next.md` at session start instead of
    letting it dead-end at the dashboard.

### The single highest-leverage change

**#6 — move mechanical bookkeeping out of prompts into deterministic scripts,
starting by actually wiring `lib/task-lifecycle.mjs`.** One
`node scripts/complete-task.mjs <id>` doing move + status rewrite + INDEX edit +
protocol entry + backlink reconciliation + scoped `git add` + commit, and
siblings for claim/promote/capture/dismiss.

It wins because it attacks four findings at once:

1. It deletes the harness's largest error surface (LLM text-surgery on derived
   state).
2. It reclaims a huge share of the `work`/`modeling` context budget (hundreds of
   prompt lines shrink to "run the script").
3. It makes the structural rules *mechanically* unviolatable instead of
   prompt-enforced (resolving most of the missing-hooks gap).
4. It unblocks the model downgrades in Phase 3 — the main reason the
   orchestrating loop needs a frontier model today is that it's hand-performing
   fiddly bookkeeping a Sonnet-driven loop would botch.

The invariants are already written and tested; they're just sitting in a module
nothing calls.

### Where the audit is uncertain

- Whether Claude Code plugin skills can reliably invoke plugin-shipped scripts
  across consumer projects — the `/dashboard` command's `$CLAUDE_PLUGIN_ROOT`
  saga suggests path resolution needs the same home-cache bootstrap treatment
  (reuse that pattern).
- Real batch behavior hasn't been measured — the verifier-contamination and
  INDEX-drift claims are structural inferences from the specs, not observed
  incidents. Ten minutes of `git log --grep 'Verification failed'` archaeology
  on a consumer project would confirm how often they bite in practice.
- ⊕ The dogfood workload here is heavily dashboard-UI-skewed, which
  under-exercises the strategic/tactical modelers — the Phase 3 routing
  recommendations for those agents rest on almost no observed invocations.
