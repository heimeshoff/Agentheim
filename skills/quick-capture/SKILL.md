---
name: quick-capture
description: Use whenever the user wants to dump an idea, bug, or feature into the backlog FAST — no conversation, no questions, no refinement. This is the quick-jot entry point: the user is offloading a thought and wants to keep moving, not think it through. Triggers on phrases like "capture this", "jot this down", "quick capture", "note for later", "dump this in the backlog", "just file it", "add this without discussing", "brain-dump", "stick this in <bc>", "log this idea", "don't ask, just record it", and on rapid-fire multi-idea lists ("three things: A, B, C"). Routes each idea to the best-fit bounded context, writes one backlog task per idea, and reports where each landed in a single line — then gets out of the way. If the user instead wants to think an idea through, refine it, or talk it over, that's `modeling`, not this. Quick-capture never asks clarifying questions and never writes to todo — captured tasks are deliberately raw and always need a later refinement pass.
model: haiku
---

# Quick Capture — Fast idea dump into the backlog

`quick-capture` is the low-friction sibling of `modeling`. Its entire job is to take an idea
out of the user's head and into a backlog task **as fast as possible**, so they can keep
their train of thought going. No Socratic dialogue, no clarifying questions, no
refinement — just route, write, report, done.

The user reached for `quick-capture` (not `modeling`) because they want to *offload*, not
*think*. Honour that. Every question you ask is friction that defeats the point. If an
idea genuinely needs thinking through, that's what `modeling` is for — and these captured
tasks will get exactly that treatment later (see "Handoff to modeling" below).

## Quick-capture vs. modeling — which is this?

Both create backlog tasks, so the trigger phrases overlap. Disambiguate by **intent**:

- **`quick-capture`** — the user is dumping and moving on. Signals: "just", "quick", "don't
  ask", "for later", rapid-fire lists, terse one-liners, an explicit BC ("stick this in
  infrastructure"). They do not want a conversation.
- **`modeling`** — the user wants to work the idea: explore it, refine acceptance
  criteria, decide where it lives, talk it through. Signals: questions back to you,
  "let's think about", "help me model", "what should this look like".

When it's genuinely ambiguous, **default to `quick-capture`** — it's the cheaper mistake. A
too-thin task gets refined later; a too-heavy conversation the user didn't want wastes
their time and can't be undone. If you capture and the user clearly wanted to model, they
will tell you, and you can pick up the task in `modeling` from there.

## Before acting

You need just enough context to route. Read, in this order, and stop as soon as you can route:

1. `.agentheim/contexts/*/README.md` — the BCs that exist and their ubiquitous language.
   This is the one read you always need. (Prefer the `## Purpose` and `## Ubiquitous
   language` sections.)
2. `.agentheim/context-map.md` (if it exists) — only if routing is unclear from READMEs.

Do **not** read the whole backlog, every INDEX, or the protocol just to capture. Capture
is meant to be cheap. You only touch the *target* BC's INDEX (to append) and the protocol
(to log) — see below.

**If no bounded contexts exist yet:** the project hasn't been brainstormed. Don't invent a
BC. Tell the user in one line and offer to run `brainstorm` first (or, for a throwaway
one-liner in a greenfield repo, offer a default `contexts/main/`). Don't block on it
silently.

## The flow

For each idea in the user's message:

1. **Split, if needed.** If the message contains several distinct ideas ("three things:
   …", a bulleted list, "and also…"), treat each as its own capture and produce one task
   per idea. Keep genuinely-coupled thoughts together; split only what's independently
   workable. When unsure whether two lines are one idea or two, prefer **one** task — a
   refiner can split it, but merging two scattered tasks is harder.

2. **Route to a bounded context** (no question — pick the best fit and file it):
   - Match the idea's language to a BC's ubiquitous language.
   - **Infrastructure test** — for anything about runtime, hosting, persistence config,
     secrets, observability, CI/CD, deployment, shared transport, or base-library choice,
     ask: *"if this one BC didn't exist, would the change still need to happen?"* Yes →
     it's globally true → `contexts/infrastructure/`. No → it's BC-local → the originating
     BC. In genuine doubt, prefer the originating BC.
   - Never spawn a new BC from a capture (no `monitoring/`, `deploy/`, etc.). If an idea
     seems to want its own BC, file it in the closest existing one and note in the task
     that it may warrant a `brainstorm` extension. `infrastructure/` and `design-system/`
     are the homes for cross-cutting tech and UI concerns respectively.
   - If the user **named** a BC ("put this in infrastructure"), use it — don't second-guess.

3. **Pick the type.** Infer `type` from the idea with a quick heuristic — `bug` if it
   describes something broken, `decision` if it's a "should we / which way" question,
   `chore` for maintenance, `spike` for "investigate", else `feature`. Don't agonize;
   refinement can correct it. **If the type lands on `spike`,** the task body must carry
   the stop-loss clause (ADR-0065): "if, mid-spike, the mitigation is already known and
   cheap, record it and stop." Include it verbatim or in substance — the literal word
   "stop-loss," or the clause's own "record it and stop" wording, satisfies
   `lib/spike-stop-loss.mjs`'s live-tree lint. Add it to the `## Notes` section of the
   template below when minting a spike.

4. **Write the task to `backlog/`.** Always backlog, never todo — captured tasks are raw
   by definition and must pass through refinement before a worker sees them. Use the
   format below. Fill `Why`/`What` from the user's words (lightly cleaned up, not
   expanded — don't invent scope they didn't state). Leave acceptance criteria as a single
   "to be refined" placeholder; capture's job is not to manufacture criteria the user
   didn't give.

5. **Register the task with the mechanized `capture` verb.** Once the task file is written,
   run:

   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','task-lifecycle-cli.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','task-lifecycle-cli.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no task-lifecycle CLI found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" capture <id> '{"source":"quick-capture","summary":"<1 line — the idea as captured>"}'
   ```

   (The same env-free homedir→cache→semver-max bootstrap `modeling/SKILL.md`'s PROMOTE flow
   uses, targeting the same CLI's `capture` verb.) It performs the INDEX marker insert +
   count delta and prepends the `Capture / Captured` protocol entry, in one mechanized step
   (ADR-0038, ADR-0073) — not optional: the dashboard and the other skills find tasks through
   the index, so a task that isn't registered is effectively invisible. It backfills a
   missing BC `INDEX.md` from `references/index-template.md` when the BC holds nothing but
   this task; otherwise a `{ok:false, code:'index-missing'}` rejection means something is off
   (a mis-typed BC name is the usual cause) — fix it and re-run rather than hand-editing the
   index.

6. **Commit** — `git add` exactly the manifest's `changed` paths from step 5 plus the new
   task file itself, then commit with the manifest's `message` (already
   `chore(<bc>): capture <task-id> — <title> [<task-id>]`). Details in "Committing" below.
   This is what keeps the working tree clean after a capture (ADR-0026) — the old behavior
   left the new task file, INDEX, and protocol all uncommitted.

7. **Report and stop.** One line per task: `✓ <id> → backlog · "<title>" (<bc>)`. If you
   had to guess the BC, say so and invite a re-route in the same breath — e.g. *"routed to
   agentic-workflow on a guess; reply with a BC to move it."* Then stop. Don't ask "want me
   to refine it?" — if they do, they'll say so.

## Task file format

Files live at `contexts/<bc>/backlog/<id>-<slug>.md`. Same shape every other skill reads:

```markdown
---
id: <bc>-<token>
title: <short imperative title>
status: backlog
type: feature
context: <bc>
created: <YYYY-MM-DD>
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
<the user's reason, in their words — or "Not stated at capture." if they gave none>

## What
<the idea, lightly cleaned up. Do not expand scope the user didn't state.>

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `quick-capture` on <date> — raw, unrefined. Needs a `modeling` refine pass before
it can be promoted. <Any verbatim extra context the user gave that didn't fit above.>
```

Keep the frontmatter values clean — **no inline `# …` comments**; the dashboard
parses the whole line as the value. `type` is one of
`feature | bug | refactor | chore | spike | decision`, and the `captured` tag
marks the item a raw dump so `modeling`'s REFINE knows it still needs a pass.

**Keep `related_adrs` / `related_research` / `prior_art` empty.** Capture deliberately
skips the prior-art matcher — running it is a read-heavy step whose payoff is an
interactive "is this a duplicate?" conversation, and capture doesn't converse. `modeling`'s
REFINE re-runs that matcher from scratch anyway, so nothing is lost by deferring it. (If
you happen to *know* from the BC README that an obviously-identical done task exists, you
may mention it in one line when reporting — but never block the capture on it.)

### ID convention

Emit a fresh id `<bc>-<token>` per the id grammar in `references/id-grammar.md` (ADR-0028 §1) — generate the token randomly, never scan existing files for a "next number". When capturing several tasks into the same BC at once, mint an independent fresh token for each. Legacy `<bc>-NNN` ids already on disk are kept as-is — never rewrite them.

After minting, verify each new id with `classifyTaskId` from `lib/id-grammar.mjs`: if `classifyTaskId(newId) !== 'token'` (e.g. it leads with a digit), discard it and mint a fresh one — no need to ask the user, a random token is free and non-interactive (ADR-0044). Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §6.

## Updating the index

Mechanized (ADR-0038, ADR-0073) — the `capture` verb run in step 5 of "The flow" above
performs both the INDEX marker insert and the protocol prepend in one call; there is
nothing to hand-edit here. Its line format always carries `(type)`:

```
- **<id>** — <title> (<type>) — `backlog/<id>-<slug>.md`
```

(This retires the older, `(type)`-less line format quick-capture used to hand-type.) If
the BC has no `INDEX.md` yet, `capture` backfills one from `references/index-template.md`
automatically, but only when the BC holds nothing but the task just captured — otherwise it
refuses `index-missing` rather than seed a template's zero counts over real pre-existing
tasks; build the index by hand from the template in that case.

## Protocol logging

Mechanized (ADR-0038, ADR-0073) — the same `capture` call prepends the entry, keyed by
`"source":"quick-capture"`:

```markdown
## <YYYY-MM-DD HH:MM> -- Capture / Captured: <task-id> - <title>

**Type:** Capture
**BC:** <bc-name>
**Filed to:** backlog
**Summary:** <1 line — the idea as captured>

---
```

Nothing to hand-format here — the shape above is the script's actual output, kept as the
human-readable contract. For a multi-idea dump, one `capture` call (and therefore one
entry) per task is correct — the protocol is a diary, not a transcript.

## Committing

Quick-capture commits its own markdown so the working tree is clean after a capture. Commit doctrine lives in `references/commit-doctrine.md` (ADR-0026) — scoped `git add` is mandatory here too: `quick-capture` can run while a `work` or `modeling` session has its own in-flight files on the working tree, so a blanket add would bundle or race them. After writing the task file(s) and running `capture` for each:

1. `git add` an **explicit, enumerated** list of *only* this capture's artifacts: the new
   task file(s) plus each `capture` call's manifest `changed` paths (the target BC's
   `INDEX.md` and `.agentheim/knowledge/protocol.md`). Never `git add -A` / `git add .`.
2. Commit silently (no confirmation prompt — capture's whole point is speed) with:
   ```
   chore(<bc>): capture <task-id> — <title> [<task-id>]
   ```
3. **Multi-idea dump:** one commit **per task** keeps the per-task granularity (each carries
   its own `[<task-id>]` trailer), which the later refine/work passes rely on. Commit each
   task with its own scoped add as you write it.

If the project isn't a git repo, skip the commit silently — write the files as before and
report; the working-tree-clean guarantee only applies under git.

## Re-routing after the fact

If the user corrects the BC after you report ("no, that's infrastructure"), just **move the
file**: relocate `backlog/<id>-<slug>.md` to the new BC's `backlog/`, update the `context`
frontmatter field, remove the index line from the old BC's INDEX and add it to the new
one's (fixing both Backlog counts), and append a one-line protocol note. Don't re-capture
or renumber — it's the same task, only its home changed. (If the BC short-code is part of
the id, keep the original id; ids are stable and renumbering breaks references.) Then
**commit the re-route** with a scoped add of exactly those touched files (the moved task
file's new and old paths, both BCs' `INDEX.md`, and `protocol.md`) — never `git add -A`,
per `references/commit-doctrine.md` — under `chore(<new-bc>): re-route <task-id> → <new-bc> [<task-id>]` (ADR-0026).

## Handoff to modeling — why "raw" is fine

Captured tasks are intentionally thin, and that's the design, not a defect. When the user
later runs `modeling` on one, REFINE reads the captured `Why`/`What` and treats it **as if
it were the user's first description of the idea** — the same starting point a fresh
`modeling` CAPTURE would have. So capture's only obligations are: get the idea down
faithfully, route it to a plausible BC, and make it discoverable (index + protocol).
Everything else — acceptance criteria, dependencies, prior-art links, ADRs, the styleguide
gate, splitting into sub-tasks — is refinement's job, and capture must not pre-empt it.

## What capture deliberately does NOT do

These are not omissions to fix later — they're the point of having a separate skill:

- **No clarifying questions.** Ever. If you feel the urge to ask, you've drifted into
  `modeling`. File what you have and let refinement surface the gaps.
- **No conversational modes.** Capture is pure scribe — it doesn't adopt Interrogator/
  Suggestor/etc. (Those live in `modeling` and `brainstorm`, where conversation is the
  point.)
- **No writing to `todo/`.** Captured work is unrefined by definition; promoting it would
  skip the human-in-the-loop refinement gate.
- **No prior-art interrogation, no orchestrator, no specialists.** Those are refinement
  tools. Capture stays a single, fast pass with no sub-agent fan-out.
- **No styleguide gate.** That gate fires at promote time; since capture only ever writes
  to backlog, it never applies here. A captured frontend task gets its
  `design-system-001-styleguide` dependency added during refinement, not at capture.
