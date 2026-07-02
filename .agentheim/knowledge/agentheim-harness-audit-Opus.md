# Agentheim Harness Audit

**Repo audited:** `C:\src\heimeshoff\agentic\agentheim` (the plugin's own source repo, self-hosting its `.agentheim/` state — the harness itself was audited, not a consumer project). Plugin `v0.8.8`.

**One assumption to confirm:** the prompt's `[fill in: repo path]` was blank, so the source repo was audited. If the intent was to audit a *consumer* project that installed Agentheim, that changes the workload/model-routing math (though the harness behaves the same).

---

## Phase 0 — Inventory

**Agents (`agents/*.md`, 8):**

| Agent | One-line purpose |
|---|---|
| `orchestrator` | Router; picks specialists, runs them (parallel when independent), integrates, drafts ADRs. Writes no code. |
| `strategic-modeler` | Where things live — bounded contexts, classification, context map. |
| `tactical-modeler` | What's inside a BC — aggregates, invariants, events/commands. |
| `architect` | Cross-cutting tech — stack, persistence, transport, integration. |
| `researcher` | Web gather → citation-rich report. |
| `research-reviewer` | Fresh-eyes gate that re-verifies a report's checkable claims against primary sources. |
| `worker` | Executes one refined task TDD-style; moves the file, writes code + ADRs + README, never touches git. |
| `verifier` | Fresh-eyes gate that audits a worker's diff against acceptance criteria and runs tests. |

**Skills (`skills/*/SKILL.md`):** `brainstorm`, `modeling`, `quick-capture`, `work`, `research` (the 5 core), plus `whats-next`, `inquire`, and three **doctrine docs** consumed by agents (`test-driven-development`, `verification-before-completion`, `research-review`). `release` is a maintainer command. `capture-workspace/` is an eval harness, not runtime.

**Commands:** exactly one — `/dashboard` (launch/stop/status).

**Hooks:** **none.** No `hooks/` dir, no `settings.json` in the plugin. (The README's "reloads skills and hooks" is aspirational — there are zero hooks, despite three research reports scoping a `Stop`-hook for work-session liveness.)

**Memory/context system:** all state in the project's `.agentheim/` — `vision.md`, optional `context-map.md`, `contexts/<bc>/{README,INDEX,backlog,todo,doing,done,concepts}`, and `knowledge/{index.md, protocol.md, decisions/, research/}`. Task files are markdown+frontmatter; the two `INDEX.md` tiers plus `protocol.md` are the "memory layer." Advisory `state/whats-next.md` is git-ignored.

**Dashboard:** stdlib-`node:http` server, read-only projection of disk over HTTP+SSE. **No write endpoints** (ADR-0017 deleted the one promote path). Its only outbound agency is fire-and-forget: launch buttons open a *human-visible* seeded Claude session via a loopback VS Code bridge extension. It does not dispatch agents or move tasks.

**Model assignment:** **none, anywhere.** No `model:` frontmatter on any agent or skill. Every agent inherits the session model — meaning Opus 4.8 runs *everything* from strategic modeling down to one-line-chore workers and diff-verifiers.

---

## Phase 1 — Workflow analysis

Lifecycle: **intake → plan → decompose → execute → verify → done.**

| Stage | Owner | Trigger → next | Assessment |
|---|---|---|---|
| Intake | `brainstorm` / `quick-capture` / `modeling` CAPTURE | user phrasing | Strong. Three intake speeds (Socratic vision / zero-friction dump / conversational capture) is a genuinely good design. |
| Plan | `brainstorm` architecture-foundation pass | vision locked → decision tasks + walking-skeleton + styleguide | Strong and unusually disciplined: unconditional `infrastructure/` BC, foundation queue, no code. |
| Decompose | `modeling` REFINE → `orchestrator` → specialists | user refines → `todo/` | Strong, but **entirely human-pull**. Nothing proposes a backlog from vision gaps except `whats-next` (advisory only). |
| Execute | `work` conductor → `worker` (×≤3) | `todo/` ready → `doing/` | Strong parallel-DAG design; conflict pre-scan on file paths. |
| Verify | `verifier` gate | worker SUCCESS → PASS/FAIL/SKIP | Strong. Fresh-context, read-only, 3-iteration cap, fail-closed doctrine. |
| Done | `work` git authority | PASS → one scoped commit | Strong bookkeeping discipline (ADR-0026), but see friction below. |

**The Three Loops** are cleanly separated — this is the harness's best structural property:

- **Why** — `brainstorm` (vision) + `whats-next` (pointing). Well served.
- **What** — `modeling` + strategic/tactical modelers. Well served.
- **How** — `work`/`worker`/`verifier`/TDD. Well served, with a gate.

**Where the loops are under-served:** the **Why→What feedback edge is missing.** Once `vision.md` is written, nothing structurally re-checks shipped work against it. `verifier` checks a diff against *acceptance criteria*, never against the vision's *success criteria* or *non-goals*. `whats-next` reads the vision but only *advises*; its output (`state/whats-next.md`) is consumed by the dashboard UI and nothing else — it never re-enters the loop as a planning input. So the vision can quietly drift from what's being built and only a human notices.

**Concrete friction points:**

1. **Working-tree carry-over stranding.** The scoped-`git add` rule (load-bearing for concurrency, ADR-0026) means anything a skill didn't explicitly enumerate is left uncommitted. The protocol log shows this repeatedly: *"Working-tree carry-over (untouched, as in prior sessions): pre-existing parallel-session changes … left uncommitted."* The safety mechanism systematically produces orphaned dirty state that accumulates silently.

2. **Nested subagent fan-out with no cost visibility.** A `worker` holds the `Agent` tool and can spawn `orchestrator`, which spawns specialists. During `work`, that's up to 3 parallel workers → each possibly an orchestrator → each possibly 2–4 specialists. Three levels deep, and re-dispatch on FAIL re-runs the whole chain. Nothing tracks or caps the cumulative spend.

3. **`MAX_PARALLEL = 3` is a bare magic number** in `work/SKILL.md` with no rationale, no relation to task size, no user-visible knob beyond "unless the user asked otherwise." Meanwhile `research` fan-out is entirely uncapped.

4. **Re-derivation is mostly well-defended** (pre-loaded ADRs/prior-art/protocol excerpt in the worker prompt is good context hygiene) — but every `verifier` re-discovers the test command from scratch each iteration, and every `research-reviewer` re-does all web work the researcher already did (deliberate for fresh-eyes, but doubles web cost with no budget).

5. **Stale README claim.** README §Dashboard: *"Its one write-back is dragging a card backlog→todo to Promote."* That path was **removed** by ADR-0017; the board is now fully inert. Doc contradicts the built system.

---

## Phase 2 — Gap analysis (ranked by real cost)

**Genuinely missing:**

1. **Cost / token / latency tracking — completely absent.** No file references tokens, cost, or budget. Given the fan-out (parallel workers + verifiers + up to 2 re-dispatches; research = N researchers × up to 3 reviewer iterations, all on the session model), this is the **most expensive gap in practice.** Opus 4.8 runs on every one-line-chore worker and every trivial-diff verify with zero visibility into what a `work` batch costs.

2. **Enforceable model routing — absent (and it's not just cost).** The research doctrine explicitly leans on model *decorrelation* as "the primary defense" (*"Same model for both. Shared training memory means shared confabulations."* — `research-review`), then admits *"agentheim pins no model."* So today `researcher` and `research-reviewer` almost certainly share a model, and `worker`/`verifier` share a model — defeating the exact adversarial-gate premise the vision is built on. The gates are structurally fresh-context but *statistically correlated*. This is a correctness gap wearing a cost gap's clothing.

3. **Live observability — absent.** The dashboard shows only committed resting state. During a `work` run, in-flight workers/verifiers are **invisible** — no live agent status, no progress, no trace, until files land and the watcher fires. For a harness whose whole pitch is parallel dependency-aware execution, the parallelism can't be seen happening.

4. **No hooks / lifecycle automation.** No `SessionStart`/`Stop`/`SubagentStop` hooks despite research reports designing exactly these. Everything is prompt-triggered; there's no deterministic on-disk signal that a session ran or finished (which is *why* the dashboard is blind in gap #3).

**Present but weak:**

5. **Rollback / idempotency — partial.** FAIL rolls the task `done→doing` and reverts frontmatter (good), but a worker that half-writes code then dies `RESULT: FAILED` leaves the task in `doing/` and the partial diff on the tree with no cleanup — recovery is "tell the user at the end."

6. **Human-in-the-loop gates — good but front-loaded.** Strong gates at brainstorm (no code), pre-work (styleguide), post-verify (escalation). But mid-`work`, a long autonomous batch has no checkpoint until the batch ends.

7. **Concurrency control — weak** (gap #3/#4 above): one magic cap, uncapped research, no global ceiling across nested spawns.

**Well-covered (credit where due):** verification/definition-of-done enforcement (verifier + research-reviewer, fail-closed, capped) is genuinely strong and better than most harnesses. Context isolation between subagents (fresh-context gates, pre-loaded blocks, strict return formats) is excellent. Knowledge durability (ADRs + protocol + INDEX backlinks) is excellent.

---

## Phase 3 — Orchestration & model routing

**Pattern:** the current **orchestrator–worker with fresh-eyes adversarial gates** is the *right* pattern for this workload — don't change it. Parallelize where it already does (independent specialists; independent workers on non-conflicting files; parallel verifiers) and serialize where it already does (git writes, dependency-ordered tasks). The one structural add worth making is a **blackboard read-back for the Why loop**: let `whats-next`'s output actually feed `modeling`/`work` planning instead of dead-ending at the dashboard.

**The enforceable lever is agent frontmatter.** Skills run in the main session and inherit its model (a skill's model can't be pinned without restructuring it into a subagent), but all 8 **agents** accept a `model:` field today. That's where routing should live.

| Component | Type | Current model | Recommended | Rationale |
|---|---|---|---|---|
| `worker` | agent | inherit (Opus) | **Sonnet 5** | Highest-volume agent (3× parallel + re-dispatches). Strong coder at ~⅕ the cost; the verifier catches its misses. **This one pin is most of the cost win.** |
| `verifier` | agent | inherit (Opus) | **Opus 4.8** | Their own doctrine: a false PASS compounds into `main`. Put the strongest skeptic on the gate **and** decorrelate it from the Sonnet worker. Lower volume than workers (one per success). |
| `researcher` | agent | inherit (Opus) | **Sonnet 5** | Tool-heavy execution (search/fetch/synthesize). Must differ from the reviewer; cheaper; gated downstream. |
| `research-reviewer` | agent | inherit (Opus) | **Opus 4.8** | The claim gate. Stronger skeptic + decorrelated from Sonnet researcher — directly closes the "shared confabulation" hole the doctrine flags as primary. |
| `strategic-modeler` | agent | inherit (Opus) | **Opus 4.8** | Boundary/classification errors poison everything downstream; rare, high cost-of-failure. Where **Fable 5/Mythos** *could* change the calculus: greenfield decomposition of a genuinely complex multi-subdomain vision. Overkill for the typical 1–3 BC project. |
| `tactical-modeler` | agent | inherit (Opus) | **Opus 4.8** | Invariant discovery is the DDD correctness crux — the exact "plausible but wrong" the vision exists to prevent. Keep the strong model. |
| `architect` | agent | inherit (Opus) | **Opus 4.8** | Locks in stack; rare; high cost-of-failure. |
| `orchestrator` | agent | inherit (Opus) | **Sonnet 5** | Routes and integrates — judgment, not deep domain work; invoked often (modeling + mid-worker consults). A mis-route costs one recoverable specialist round. Escalate to Opus only for explicitly multi-context features. |
| `brainstorm` | skill (session) | inherit | **Opus 4.8** | Vision quality is set here and is near-unrecoverable. Not pinnable — run the session on Opus. |
| `modeling` (REFINE) | skill (session) | inherit | **Opus 4.8** | Cornering ambiguity is the point. CAPTURE is light; REFINE needs the strong model. |
| `work` (conductor) | skill (session) | inherit | **Opus 4.8** | One conductor vs N Sonnet workers — marginal Opus cost is small, and it holds batch correctness (DAG, conflict scan, commit discipline). |
| `research` / `whats-next` / `inquire` | skill (session) | inherit | **Sonnet 5** | Coordination / read-and-judge; moderate reasoning. |
| `quick-capture` | skill (session) | inherit | **Haiku 4.5** | Classify an idea to a BC + write a templated file. Frequent, cheap, mis-route is cheap to fix. Textbook Haiku — but only realizable if invoked as a subagent (see below). |
| `/dashboard` | command | inherit | **Haiku 4.5** | Pure process launch, no reasoning. |

**Inline vs promote:** `quick-capture`, `whats-next`, and `inquire` are read/route/write tasks that would each benefit from running on a *cheaper* model than the interactive session — but as skills they can't. If cost matters, the highest-value **structural** change is to give them a thin agent wrapper (a `capture-router` / `advisor` agent with `model: haiku`/`sonnet`) so the routing actually lands on the cheap tier. Conversely, nothing here should be *promoted* from inline to subagent for isolation reasons — context hygiene is already good.

**Split-context note:** the `worker → orchestrator → specialist` nesting is fine for isolation but should carry a **depth/cost budget** once tracking exists — it's the one place fan-out can quietly explode.

---

## Phase 4 — Recommendations

**Quick wins (low effort, high leverage):**

1. **★ Pin `model:` on the 8 agents** (worker→Sonnet, verifier→Opus, researcher→Sonnet, reviewer→Opus, orchestrator→Sonnet, three modelers/architect→Opus). One frontmatter line per file, zero logic change. **Effort: ~30 min. Impact: large cost drop + closes the decorrelation correctness hole in one move.**
2. **Fix the stale README** promote claim (contradicts ADR-0017). Effort: trivial. Impact: doc integrity.
3. **Add a `work`-batch cost line to the end-of-run report and the session-end protocol entry** (even a rough token/commit tally). Effort: small, prompt-only. Impact: first-ever cost visibility.
4. **Make `MAX_PARALLEL` a documented, user-settable knob** and add a global cap on nested spawns. Effort: small.

**Deeper refactors (higher effort, higher payoff):**

5. **Live observability via hooks.** Add `SubagentStop`/`Stop` hooks (already designed in the research) that write agent-status + timing (+ token counts if available) to `.agentheim/state/`, and have the dashboard render an in-flight lane. Turns the dashboard from resting-state observer into a live control-*view*. Effort: medium. Impact: closes the single biggest capability gap.
6. **Close the Why→What loop.** Make `whats-next`'s advisory artifact an actual planning input: let `modeling`/`work` read it, and add a lightweight "does this still serve the vision's success criteria / violate a non-goal?" check somewhere in the verify or session-end path. Effort: medium. Impact: stops silent vision drift — the thing the whole harness exists to prevent.
7. **Carry-over reconciliation.** At `work` session-end, detect stranded working-tree files and surface/commit them deliberately instead of leaving them for "prior sessions." Effort: small–medium.

**Single highest-leverage change: recommendation #1 — pin models on the agents.**

It wins because it's the only change that is simultaneously (a) trivial effort — eight one-line frontmatter edits, no code, shippable today; (b) a large **cost** reduction — workers are the highest-volume agent and Sonnet is ~5× cheaper than the Opus they inherit today; and (c) a **correctness** fix, not just a cost fix — putting Opus on `verifier` and `research-reviewer` while their producers run Sonnet finally realizes the model-*decorrelation* the research doctrine calls "the primary defense" and currently admits is unmet. Every other improvement is additive; this one is the harness finally doing what its own vision says it does, for near-zero effort.

---

## What to check next if going deeper

- Whether the target *consumer* projects have richer domains than this self-hosted repo — the dogfood workload here is ~84% dashboard UI (the `agentic-workflow` BC is really "the dashboard"), which under-exercises the strategic/tactical modelers the routing table leans on.
- Whether Claude Code's current subagent runner actually honors 3-level nested `Agent` spawns in this setup, since the `worker→orchestrator→specialist` chain depends on it.
