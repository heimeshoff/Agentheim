# Vision: Agentheim

## Purpose

Agentheim is a domain-driven agentic harness for Claude Code, installed once as a
plugin and used across projects. It turns a raw idea into a vision, a vision into a
modeled backlog of bounded contexts, and a backlog into parallel, dependency-aware
execution — with ADRs, a protocol log, and per-BC READMEs falling out as a side
effect. Its reason for existing is to stop the agent from producing plausible-looking
domain work that is quietly wrong, by holding DDD discipline and a Socratic dialogue
between the builder and the model at every step.

## Users

One user: the **builder** — a practitioner using Claude Code to build real projects who
wants the agent to corner ambiguity and respect domain boundaries instead of dissolving
into vibe-coded mush. Agentheim was previously used for teaching; from now on it is a
building tool only. The six conversational modes survive solely as instruments for
reaching a better model — different ways of pressing on an idea until it holds — not as
a workshop device.

## The problem

Left alone, Claude Code produces domain work that looks right and is wrong in ways the
builder won't notice until it's expensive to undo. Concretely, without Agentheim:

- The model jumps to code before the domain is understood — no bounded contexts, no
  ubiquitous language, just files.
- Decisions get made and lost — no ADRs, no protocol — so weeks later neither the
  builder nor the model knows *why* it's built this way.
- Context rots — one long thread, early decisions forgotten, settled questions
  re-litigated, the model contradicting itself.
- Work doesn't parallelize — everything runs as one linear thread instead of
  dependency-aware fan-out.
- The model accepts whatever the builder says and runs with it — no pushback, no
  surfacing of conflations, no cornering of vague acceptance criteria. A fast model,
  and a shallow one.

The last point is the keystone: the acute pain is **an agreeable agent that produces
shallow domain work at speed.** Every load-bearing feature is a structural defense
against exactly that.

## What success looks like

- A builder can go idea → vision → modeled backlog → shipped code without the model
  losing the *why* along the way.
- `brainstorm` and `modeling` are genuine **Socratic dialogues** — the model questions,
  surfaces conflations, and presses on weak acceptance criteria rather than transcribing.
- Knowledge is durable: ADRs, a chronological protocol log, and per-BC READMEs mean the
  reasoning behind the system survives the conversation that produced it.
- Wrong work is caught by structure, not luck: two fresh-context adversarial gates
  (`verifier` for code, `research-reviewer` for research) reject plausible-but-wrong
  output before it's committed or cited.
- Independent work runs in parallel, respecting the dependency DAG, without two workers
  colliding on the same file.

## Non-goals

1. **Not a teaching/workshop tool.** The modes now serve model quality, not pedagogy.
2. **Not a general-purpose agent harness.** It is opinionated DDD or nothing — it won't
   pretend to be framework-agnostic about *method*.
3. **Not autonomous.** The human stays in the loop at every gate: no-code brainstorm,
   user review before `work`, escalation after failed verification. It does not go
   idea → shipped without the builder.
4. **Not stack-prescriptive.** The scaffolding is fixed and English, but the architect
   picks the tech per project and the domain language can be anything. Agentheim does not
   care whether it's Postgres or Python.
5. **Not a SaaS / not multi-tenant.** It is a local Claude Code plugin; all state lives in
   `.agentheim/` inside the project repo, nowhere else.

## Ubiquitous language (seed)

- **Skill** — a natural-language-triggered capability: `brainstorm`, `modeling`,
  `research`, `work` (plus the doctrine docs TDD, verification-before-completion,
  research-review). No slash commands to memorize.
- **Bounded context (BC)** — a domain area with its own ubiquitous language and rules,
  given a `contexts/<name>/` folder with README, INDEX, and a task lifecycle.
- **Vision / Context map** — the two strategic artifacts: what's being built and why, and
  how the bounded contexts relate.
- **Orchestrator** — the router agent. Never writes code; decides which specialist acts,
  runs them (in parallel when independent), integrates the result. Not to be confused with
  the **conductor**: the `work` skill's own driving loop (scan, dispatch workers, commit,
  log) — a session role, not a spawned agent.
- **Specialists** — `strategic-modeler`, `tactical-modeler`, `architect`, `researcher`,
  `worker`. Each has a tighter focus than the orchestrator.
- **Adversarial gate** — a fresh-context skeptic with no exposure to the producer's
  reasoning, gating the producer's output. Two of them: `verifier` (audits a worker's
  diff before commit) and `research-reviewer` (re-verifies a report before it's citable).
  This is a deliberate, recurring design motif — not two coincidences.
- **Task lifecycle** — `backlog/` → `todo/` → `doing/` → `done/`, one task = one commit.
- **Protocol** — the chronological project diary, newest on top; every action appends.
- **ADR** — an Architecture Decision Record, global or BC-scoped, flowing through the same
  backlog discipline as features (`type: decision`).
- **Mode** — one of six conversational stances (Interrogator, Suggestor, Challenger,
  Storyteller, Facilitator, Synthesizer) for `brainstorm` and `modeling`. Serves model
  quality, switchable mid-session.

## Open questions

- **Brainstorm on existing code (next iteration).** (open since 2026-06-05) When
  `brainstorm` is invoked in a folder that already contains code, it should first
  reverse-engineer a best-guess vision and domain from the code, present that, and
  *then* continue the Socratic dialogue as usual. Likely needs multiple collaborating
  agents to analyze an existing system; to be built later via the skill-creator. Not
  present today.
- ~~**Branch/registry merge gap.**~~ *Resolved 2026-06-07.* `skills/research/SKILL.md`
  now wires in the review gate end-to-end (post-write, pre-cite), spawning the
  `research-reviewer` with fresh context and looping to a 3-iteration cap.
- ~~**Stale modes framing.**~~ *Resolved 2026-06-07.* `references/modes.md` no longer
  frames the modes as a workshop/teaching device; they are described as instruments for
  model quality, and the group/room/participants language was reconciled to the single
  builder.
</content>
</invoke>
