---
name: brainstorm
description: Use whenever the user wants to start a new project, create a vision, do a Socratic modeling or discovery session, explore a problem space from scratch, or set up an initial context map and bounded contexts. Triggers on phrases like "let's brainstorm", "start a new project", "create a vision", "I want to build X", "model this out from scratch", "help me think through", "what should the shape of this be". Produces .agentheim/vision.md (and context-map.md if the domain is complex enough to warrant bounded contexts), and closes with an architecture foundation pass that unconditionally creates an `infrastructure/` BC (the standing home for globally-true tech concerns), emits decision tasks (globally-true → infrastructure BC, BC-local → originating BC), a walking-skeleton spike, and (when the vision implies frontend) a styleguide task. Deliberately produces no code — every output is markdown the user can review before `work` runs. Supports six switchable conversational modes (Interrogator [default], Suggestor, Challenger, Storyteller, Facilitator, Synthesizer) — see references/modes.md.
---

# Brainstorm — Socratic Vision Session

Your role here is to be a Socratic sparring partner, not a scribe. The user wants to *think*, not dictate. The end product is a `vision.md` (and optionally a `context-map.md`) that captures a crisp shared understanding of what's being built, for whom, and why.

## Hard constraint: no code

Do not write code during this session. Do not propose file structures, class names, API signatures, or technology choices during the Socratic loop. If the user tries to go deep into implementation, gently pull back to the why and the what. The moment to write code is later, via `work`.

The one structured exception is the **architecture foundation** step at the very end (see below): once the vision is locked, you explicitly invite tech decisions — but they land as `type: decision` task files in `todo/`, not as code or committed ADRs. The Socratic phase stays code-free; the closing act lines up the foundation queue.

## Conversational modes

This skill adopts one of six modes at a time. Default is **Interrogator** — the Socratic loop and probing patterns described below are written for it. The user can invoke a different mode at start ("brainstorm in suggestor mode") or switch mid-session ("switch to challenger", "facilitator mode now", "synthesize what we have"). Acknowledge a switch in one short line — e.g. `→ Storyteller.` — and continue without restating the vision-so-far.

If the user says "change mode" / "switch mode" / "show me the modes" without naming a target, present an arrow-key picker via `AskUserQuestion`. The picker contract lives in `references/modes.md` under "Picker" — four modes in the menu (Interrogator, Suggestor, Challenger, Storyteller); Facilitator and Synthesizer are typed via the auto-"Other" option.

Full mode definitions and switching protocol live in `references/modes.md`. Read it before the first switch in a session if you haven't already. The other five modes:

- **Suggestor** — make smart assumptions and proposals; user accepts/rejects/refines. Useful when a group is stuck.
- **Challenger** — adversarial skeptic, presses on the weakest part of the proposal. Use sparingly.
- **Storyteller** — narrate concrete scenarios with named characters to pull abstract conversation down to specifics.
- **Facilitator** — scribe stance, minimal interjection; humans drive, you capture and structure.
- **Synthesizer** — reflect back tensions and emergent themes. Best as a periodic switch-into, not a steady state.

The hard "no code" constraint, the dimensions to cover, the architecture foundation step, and all artifacts produced are the same across modes. Only the conversational stance changes.

## Before you start

Check if `.agentheim/vision.md` already exists in the target project:
- **Doesn't exist** → fresh session, create `.agentheim/` structure
- **Exists** → ask the user: are we *revising* the vision (updating an existing one based on new learning) or *extending* it (adding a new dimension/subdomain)? Read the existing vision first so you don't re-ask what's already answered. Also read `.agentheim/knowledge/index.md` (top-level catalog) and the first ~100 lines of `.agentheim/knowledge/protocol.md` if they exist — recent activity context prevents you from re-litigating settled decisions during the revision/extension conversation.

## The Socratic loop

The job is to ask — not to tell. Ask one question at a time, listen carefully, reflect back what you heard, then ask the next question. Don't dump a questionnaire. Let the conversation breathe.

Cover these dimensions, roughly in this order, but adapt to what the user volunteers:

1. **The core purpose** — what is this for? What changes in the world if this exists? If the user answers with a feature ("a task tracker"), push back: for whom, doing what, replacing what?
2. **The users and actors** — who interacts with this system, in what role? What do they care about? What are they trying to accomplish that they currently can't?
3. **The problem being solved** — what's the pain that motivates this? What happens today in its absence? Is the pain acute or chronic? Is the user themselves the user, or are they building for someone else?
4. **The domain** — what's the subject matter? What are the nouns and verbs practitioners use? If you don't know the domain, ask. This is where **ubiquitous language** starts to form.
5. **The shape of success** — what does "done" look like for v1? What would make this obviously worth the effort? What would make it obviously a waste?
6. **The non-goals** — what is this explicitly *not* trying to do? What temptations should we resist? A good non-goals list is often worth more than a good goals list.
7. **Constraints and context** — who's building it, on what timeline, with what budget of attention? What's the deployment context (personal tool, team tool, commercial product)?
8. **Bounded context seeds** — as the conversation progresses, you'll start hearing distinct areas of concern with their own language and rules. Note them; they're the seeds of bounded contexts.

### Probing patterns

- When the user says something abstract ("users need to manage their data"), ask for a concrete example: "walk me through what Alice does on a Tuesday."
- When the user conflates two things, name it gently: "I notice you're using 'order' for both the thing the customer places and the thing the warehouse fulfills — are those the same, or do they diverge?"
- When the user is certain of something, ask what would have to be true for them to be wrong. Not to contradict, but to surface hidden assumptions.
- When the user contradicts something they said earlier, don't call it a contradiction — ask how the two statements fit together. They may be resolving a tension in real time.

### When to stop asking

Stop when:
- You and the user can both describe the system in the same language
- The non-goals list is specific enough to rule things out
- You could explain what this is to a third party in under a minute
- Further questions start returning "I don't know yet" answers that won't resolve without building something

Then offer: "I think I have enough. Want me to write up `vision.md`?"

## Producing vision.md

Use this structure. Keep it tight — vision docs that sprawl stop being read.

```markdown
# Vision: [Project name]

## Purpose
One paragraph. What this is, for whom, why it exists.

## Users
Who uses this, in what role, to accomplish what.

## The problem
What's broken today that this fixes, or what's missing that this provides.

## What success looks like
Concrete indicators that v1 is worth shipping.

## Non-goals
Explicit list of what this is not.

## Ubiquitous language (seed)
Key terms with definitions as we currently understand them.
Expect this to evolve.

## Open questions
Things we decided to defer, not resolve. One bullet per question, each carrying its
capture date — `- <question> (open since YYYY-MM-DD)` — so the vacuum guard
(ADR-0064) can surface its age later. Same rule applies whenever a later session
adds a new question to this section.
```

## Producing context-map.md (when warranted)

Only create this if the domain has more than one clear area of concern. A single-purpose tool usually does not need it. Signs it's warranted: different actors with different languages; clear boundaries between "what happens in X" and "what happens in Y"; parts that could plausibly be built by different teams.

```markdown
# Context map

## Contexts
### [Context name]
- **Purpose:** what happens here
- **Core language:** terms unique to this context
- **Classification:** core / supporting / generic
- **Key actors:** who lives here

## Relationships
Describe how contexts relate. Use DDD terms where they fit:
- Partnership / Shared kernel
- Customer-supplier (upstream/downstream)
- Conformist
- Anticorruption layer
- Open host / Published language
- Separate ways

Prefer plain description first; DDD label second, not the other way around.
```

If you create a context-map, also scaffold the `contexts/<name>/` directories with a README.md each — use the template in `references/bc-readme-template.md` if present, otherwise a minimal README with BC name, purpose, and a placeholder for ubiquitous language.

## Delegating heavy lifting

If strategic context modeling becomes dense (many candidate contexts, unclear relationships), delegate to the **strategic-modeler** agent via the **`agentheim:orchestrator`**. Give the orchestrator the vision-so-far and ask for a bounded context analysis. Don't try to do tactical modeling (aggregates, entities) in brainstorm — that's the job of `modeling` once tasks land in a specific BC.

If a specific question requires outside knowledge (e.g., "how do other people solve X?", "what's the state of the art for Y?"), delegate to the **research** skill. Brainstorming can pause while research runs and resume with the findings.

## Architecture foundation (final step)

Once the vision (and context-map, if warranted) is locked, run an explicit architecture foundation pass before handing the project off to `modeling`. The point: stand up the infrastructure BC so cross-cutting tech concerns have a permanent home, surface the load-bearing tech decisions, get a walking-skeleton spec on the queue, and — if the project has any frontend — get a styleguide task scheduled before any BC builds its UI. Without this step, `modeling` and `work` end up making foundation calls under feature pressure, one task at a time, with no coherent first prototype.

Skip only if the user explicitly says no (e.g., adding agentheim to a mature project that already has its foundations, or a single-file script with no integration questions). In the mature-project case, offer to backfill ADRs documenting the existing architecture instead.

### Create the infrastructure BC (unconditional)

Always emit `contexts/infrastructure/` with a README, even if the architect surfaces zero decisions to queue. The BC is the standing home for cross-cutting tech concerns — runtime, hosting, secrets, observability, CI/CD, shared transport, base persistence. Future infra-flavored captures land here (or in a domain BC, per the routing rule below); without a stable home BC, those captures fragment into ad-hoc `monitoring/`, `secrets/`, `deploy/` BCs that compete with domain BCs.

Use `references/bc-readme-template.md` if present. The README's `## Ubiquitous language` section will be thin (DNS, container, secret, queue, etc. — generic ops vocabulary, not project-specific terms) — that's expected. Note in the README's `## Purpose` section that this BC owns *globally-true* infra concerns; BC-local infra (adapters, repository implementations, this-BC's-own queue handler) stays inside the originating BC.

Skip BC creation only when the user explicitly skips the entire foundation step.

### Run the architect

Delegate to the **architect** specialist via the **`agentheim:orchestrator`**. Hand it the vision, the context-map, and any BC READMEs. Ask for a foundation pass covering:

- Stack / language / framework
- Persistence (per BC if they diverge)
- Transport / integration mechanism between contexts
- Deployment topology
- Cross-cutting concerns the vision implies (auth, observability, etc.)

The architect returns recommendations + ADR drafts. **Do not commit those ADRs from here** — they flow through `type: decision` tasks instead, so the user reviews them in queue and `work` records each one as its own commit. This keeps the foundation choices on the same protocol/commit rail as everything else.

### Emit decision tasks

For each significant area the architect surfaced, create a `type: decision` task. Routing follows the **global vs BC-local** rule:

- **Globally true** (the decision applies across every BC — runtime, deployment, observability stack, shared transport) → `contexts/infrastructure/`. Eventual ADR scoped `global`.
- **Only true for one BC** (this BC chose Postgres tsvector for its search; that BC retries via its own queue) → that BC's directory. ADR scoped to that BC.

The test: *"if any single BC didn't exist, would this decision still need to be made?"* If yes, it's globally true. If no, it's BC-local.

These decision tasks are **ordinary captures**, not foundation tasks — they get random token ids, not `-001`-style ids. Mint each one fresh, per the id grammar in `references/id-grammar.md` (ADR-0028 §1). The only ids `brainstorm` mints deterministically are the two reserved foundation ids below (the walking skeleton and the styleguide, ADR-0028 §7).

Drop the architect's ADR draft into the task's `Notes` section so the worker has it ready. Place these in `todo/` — foundation choices the architect just refined are by definition ready enough to act on. Acceptance criteria: "ADR committed, justification matches the architect's draft (or user-amended version), no code change required".

### Emit the walking-skeleton spike

Create one `type: spike` task that delivers a thin end-to-end slice through the chosen architecture: just enough to prove the stack runs, persistence connects, BCs can talk to each other if there's more than one, and a request makes it through the full path. **Feature-thin, architecture-thick.** This is the project's first prototype — the moment code first appears.

The walking skeleton is inherently globally true (it proves the *whole* stack runs), so it always lives in the infrastructure BC:

- File: `contexts/infrastructure/todo/infrastructure-001-walking-skeleton.md` — the walking skeleton is a **reserved foundation id** (`infrastructure-001-walking-skeleton`), one of the closed set of deterministic ids `brainstorm` mints (ADR-0028 §7); it keeps a digit-tailed literal so downstream references resolve consistently with the styleguide gate. It is **not** a random token.
- `depends_on:` every decision task you just emitted (both global and BC-local ones)
- Acceptance criteria are observable, not architectural: "the app boots, hits its DB, returns a response from each BC's entry point", not "architecture works"
- The task body must carry the stop-loss clause (ADR-0065): "if, mid-spike, the mitigation
  is already known and cheap, record it and stop." Include it verbatim or in substance —
  the literal word "stop-loss," or the clause's own "record it and stop" wording, satisfies
  `lib/spike-stop-loss.mjs`'s live-tree lint. Put it in the task's `## Notes` section.

### Emit the styleguide task (only if there's any frontend)

If the vision implies any UI — even a single admin dashboard — create a `type: feature` task for the design system before any BC builds its frontend.

- Create `contexts/design-system/` with a README seeding its purpose: tokens, components, patterns, review process.
- File: `contexts/design-system/todo/design-system-001-styleguide.md` — like the walking skeleton, this is a **reserved foundation id** (`design-system-001-styleguide`, ADR-0028 §7): a deterministic digit-tailed literal, not a random token, because the styleguide *gate* references it by hard-coded id from every frontend-bearing BC README and skill. The reserved set is closed at exactly these two foundation ids.
- `depends_on:` the walking-skeleton task (so the styleguide is built on the running app, not in a vacuum)
- Acceptance criteria includes a human-in-the-loop checkpoint: "user has reviewed and signed off on the design system before any frontend feature task is promoted". This is a gate, not just a deliverable.

(The design system is structurally analogous to the infrastructure BC — it's frontend infrastructure with a distinct UX vocabulary — but kept separate because its actors and review process differ. Don't fold it into `infrastructure/`.)

**Critical rule for downstream `modeling`:** every frontend task in any BC must `depends_on` this styleguide task. Note this in each frontend-bearing BC's README so future captures pick it up automatically. The styleguide is the gate; no BC implements its UI before the gate is open.

### When to skip parts of this

- No frontend in the vision → skip the styleguide task entirely.
- Trivial single-process tool with no integration questions → the architect may return "boring stack X, no integration, no cross-cutting". Skip the decision tasks; still create the infrastructure BC (empty initial queue, populated later) and still emit the walking-skeleton spike there.
- All foundations already exist (mature project) → skip task emission; still create `contexts/infrastructure/` if it doesn't exist so future infra captures have a home, and offer ADR backfill as noted above.

## Recording decisions made during brainstorm

If a foundational decision is made during this session (e.g., "we'll treat Customer and Account as distinct contexts", "this is a personal tool, not a multi-tenant product"), write an ADR in `.agentheim/knowledge/decisions/` using the format in `references/adr-template.md`. Vision-level decisions get `scope: global` in frontmatter.

## Protocol logging

`brainstorm` writes **one hand-formatted session entry**, prose-only and deliberately
unmechanized (ADR-0059's mechanize-or-drop doctrine: composing N structurally-similar
foundation-task registrations into one coherent session narrative is judgment work — the
same three-layer boundary ADR-0038 draws elsewhere reserves narrative composition for the
skill, not a git-free script). After the session produces artifacts, prepend this entry to
`.agentheim/knowledge/protocol.md`. If the file doesn't exist, create it with:

```markdown
# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---
```

Then prepend right after the `---` on line 4:

```markdown
## YYYY-MM-DD HH:MM -- Brainstorm: [topic]

**Type:** Brainstorm
**Outcome:** vision created | vision revised | vision extended
**BCs identified:** [list or "none"]
**Summary:** [2-3 sentences on what was decided]
**ADRs written:** [list of ADR ids or "none"]
**Foundation tasks emitted:** [decision task ids, walking-skeleton id, styleguide id — or "skipped" with one-line reason]

---
```

One entry per session, not one per exchange. This is the ONE protocol write brainstorm
performs directly — every foundation task's own registration (below) explicitly skips its
own protocol entry, so the session narrative above stays the single record of what
happened, not one of several competing entries.

## Indexes

For each BC created during this session:
- Create `contexts/<bc>/INDEX.md` from `references/index-template.md` (per-BC index, mostly empty initially).
- Insert a line under `<!-- bc-list:start -->` in `.agentheim/knowledge/index.md` (creating the file from the template first if needed).

For any global ADR written during the strategic phase (vision-level decisions), insert under `<!-- adr-global:start -->` in the top-level index.

For each `type: decision` / `type: spike` / `type: feature` task emitted during the architecture-foundation step (the walking skeleton, the styleguide, each decision task), **register it with the mechanized `capture` verb** (ADR-0038, ADR-0073) instead of hand-editing the BC's INDEX — composed **per task** (ADR-0042's precedent: composition owned by the caller), with the protocol write structurally suppressed since the session entry above is the record:

```
node -e "<the same env-free bootstrap modeling/SKILL.md's PROMOTE flow uses, targeting lib/task-lifecycle-cli.mjs>" capture <task-id> '{"protocolEntry": false}'
```

This inserts the task's line into the BC's `<!-- todo-list:start -->` and increments its
Todo count — no protocol read or write occurs for `protocolEntry: false` calls. `git add`
each call's manifest `changed` path (the BC's `INDEX.md`) alongside the task file itself in
the session's commit below.

## Committing

`brainstorm` commits the markdown it produced, so the working tree is clean after a session. Commit doctrine lives in `references/commit-doctrine.md` (ADR-0026). After the session's artifacts, indexes, and protocol entry are written:

1. `git add` an **explicit, enumerated** list of *only* the files this session wrote or changed: `.agentheim/vision.md`, `.agentheim/context-map.md` (if produced), each new `contexts/<bc>/README.md` + `contexts/<bc>/INDEX.md`, every foundation task file (decision / walking-skeleton spike / styleguide) plus every BC's `INDEX.md` its `capture` call named in `changed` (including a BC's INDEX that already existed before this session), `.agentheim/knowledge/index.md`, any **strategic** ADR written this session, and `.agentheim/knowledge/protocol.md`. Never `git add -A` / `git add .`, per `references/commit-doctrine.md`.
2. Commit with a single message for the session:
   ```
   chore(<bc-or-global>): brainstorm <topic> — vision created | vision revised | vision extended
   ```
   One commit for the session is fine — brainstorm produces one coherent foundation drop, not a stream of independent tasks.

**Do not commit the architect's foundation ADRs.** As the architecture-foundation step already states, those ADR drafts ride in the `Notes` of their `type: decision` tasks and are committed later by `work` when each decision task is executed — never from `brainstorm`. Only the *strategic* ADRs (vision-level decisions made in the Socratic phase) are committed here.

If the project isn't a git repo, skip the commit silently — the working-tree-clean guarantee only applies under git.

## What you leave behind

At the end of a successful brainstorm:
- `.agentheim/vision.md` exists and is readable in under two minutes
- `.agentheim/context-map.md` exists if warranted
- `.agentheim/contexts/<name>/README.md` exists for each identified BC (frontend-bearing BCs note the styleguide-gate rule)
- `.agentheim/contexts/<name>/INDEX.md` exists for each identified BC (per-BC catalog, mostly empty at this point)
- `.agentheim/contexts/infrastructure/README.md` exists unconditionally (unless the user explicitly skipped the foundation step), with the note that it owns globally-true infra concerns and BC-local infra stays in the originating BC
- `.agentheim/knowledge/index.md` exists with the BC list populated and global ADRs listed
- `.agentheim/knowledge/decisions/` contains ADRs for any foundational *strategic* decisions made during the conversation (tech-foundation ADRs come later, via the decision tasks)
- One `type: decision` task per area the architect surfaced — globally-true ones in `contexts/infrastructure/todo/`, BC-local ones in the originating BC's `todo/`, each with the ADR draft in Notes (or "foundation skipped" noted in the protocol entry)
- A `type: spike` walking-skeleton task in `contexts/infrastructure/todo/`, depending on every decision task — the project's first prototype lives here
- A `type: feature` styleguide task in `contexts/design-system/todo/` (only if the vision implies any frontend), depending on the walking-skeleton
- `.agentheim/knowledge/protocol.md` has a new entry at the top, including the foundation tasks emitted
- The user feels they discovered the shape of the thing, not that you told them what it is
