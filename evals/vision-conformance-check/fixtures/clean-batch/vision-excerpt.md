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
