---
name: capture
description: Use whenever the user wants to dump an idea, bug, or feature into the backlog FAST — no conversation, no questions, no refinement. This is the quick-jot entry point: the user is offloading a thought and wants to keep moving, not think it through. Triggers on phrases like "capture this", "jot this down", "quick capture", "note for later", "dump this in the backlog", "just file it", "add this without discussing", "brain-dump", "stick this in <bc>", "log this idea", "don't ask, just record it", and on rapid-fire multi-idea lists ("three things: A, B, C"). Routes each idea to the best-fit bounded context, writes one backlog task per idea, and reports where each landed in a single line — then gets out of the way. If the user instead wants to think an idea through, refine it, or talk it over, that's `modeling`, not this. Capture never asks clarifying questions and never writes to todo — captured tasks are deliberately raw and always need a later refinement pass.
---

# Capture — Fast idea dump into the backlog

`capture` is the low-friction sibling of `modeling`. Its entire job is to take an idea
out of the user's head and into a backlog task **as fast as possible**, so they can keep
their train of thought going. No Socratic dialogue, no clarifying questions, no
refinement — just route, write, report, done.

The user reached for `capture` (not `modeling`) because they want to *offload*, not
*think*. Honour that. Every question you ask is friction that defeats the point. If an
idea genuinely needs thinking through, that's what `modeling` is for — and these captured
tasks will get exactly that treatment later (see "Handoff to modeling" below).

## Capture vs. modeling — which is this?

Both create backlog tasks, so the trigger phrases overlap. Disambiguate by **intent**:

- **`capture`** — the user is dumping and moving on. Signals: "just", "quick", "don't
  ask", "for later", rapid-fire lists, terse one-liners, an explicit BC ("stick this in
  infrastructure"). They do not want a conversation.
- **`modeling`** — the user wants to work the idea: explore it, refine acceptance
  criteria, decide where it lives, talk it through. Signals: questions back to you,
  "let's think about", "help me model", "what should this look like".

When it's genuinely ambiguous, **default to `capture`** — it's the cheaper mistake. A
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
   refinement can correct it.

4. **Write the task to `backlog/`.** Always backlog, never todo — captured tasks are raw
   by definition and must pass through refinement before a worker sees them. Use the
   format below. Fill `Why`/`What` from the user's words (lightly cleaned up, not
   expanded — don't invent scope they didn't state). Leave acceptance criteria as a single
   "to be refined" placeholder; capture's job is not to manufacture criteria the user
   didn't give.

5. **Update the target BC's `INDEX.md`** — insert under `<!-- backlog-list:start -->` and
   increment the Backlog count. (Details below.) This is not optional: the dashboard and
   the other skills find tasks through the index, so a task that isn't indexed is
   effectively invisible.

6. **Log to the protocol** — prepend one Capture entry (details below).

7. **Report and stop.** One line per task: `✓ <id> → backlog · "<title>" (<bc>)`. If you
   had to guess the BC, say so and invite a re-route in the same breath — e.g. *"routed to
   agentic-workflow on a guess; reply with a BC to move it."* Then stop. Don't ask "want me
   to refine it?" — if they do, they'll say so.

## Task file format

Files live at `contexts/<bc>/backlog/<id>-<slug>.md`. Same shape every other skill reads:

```markdown
---
id: <bc-short>-<NNN>
title: <short imperative title>
status: backlog
type: feature              # feature | bug | refactor | chore | spike | decision
context: <bc>
created: <YYYY-MM-DD>
completed:
commit:
depends_on: []
blocks: []
tags: [captured]           # mark captured so refinement knows it's a raw dump
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
Captured via `capture` on <date> — raw, unrefined. Needs a `modeling` refine pass before
it can be promoted. <Any verbatim extra context the user gave that didn't fit above.>
```

**Keep `related_adrs` / `related_research` / `prior_art` empty.** Capture deliberately
skips the prior-art matcher — running it is a read-heavy step whose payoff is an
interactive "is this a duplicate?" conversation, and capture doesn't converse. `modeling`'s
REFINE re-runs that matcher from scratch anyway, so nothing is lost by deferring it. (If
you happen to *know* from the BC README that an obviously-identical done task exists, you
may mention it in one line when reporting — but never block the capture on it.)

### ID convention

`<bc-short>-<NNN>`, zero-padded. Determine the next number by scanning **all four**
lifecycle folders (`backlog/ todo/ doing/ done/`) of the target BC for the highest existing
`<bc>-NNN` and adding one. IDs are stable and never reused — never renumber, even after a
deletion. When capturing several tasks into the same BC at once, increment sequentially
(`-012`, `-013`, …).

## Updating the index

Insert a line **immediately after** `<!-- backlog-list:start -->` in
`contexts/<bc>/INDEX.md`:

```
- **<id>** — <title> — `backlog/<id>-<slug>.md`
```

Then bump the Backlog number under `<!-- task-counts:start -->`. Only touch those two
markers — never rewrite the file, never duplicate an existing line. If the BC has no
`INDEX.md` yet, create it from `references/index-template.md` with the BC name filled in,
then append.

## Protocol logging

Prepend one entry per capture to `.agentheim/knowledge/protocol.md`, right after the `---`
on line 4 (newest on top). If the file doesn't exist, create it with the standard header
first (`# Protocol` / "Chronological log…" / "Newest entries on top." / `---`).

```markdown
## <YYYY-MM-DD HH:MM> -- Capture / Captured: <task-id> - <title>

**Type:** Capture
**BC:** <bc-name>
**Filed to:** backlog
**Summary:** <1 line — the idea as captured>

---
```

For a multi-idea dump, one entry per task is fine, but keep each to a single summary line —
the protocol is a diary, not a transcript.

## Re-routing after the fact

If the user corrects the BC after you report ("no, that's infrastructure"), just **move the
file**: relocate `backlog/<id>-<slug>.md` to the new BC's `backlog/`, update the `context`
frontmatter field, remove the index line from the old BC's INDEX and add it to the new
one's (fixing both Backlog counts), and append a one-line protocol note. Don't re-capture
or renumber — it's the same task, only its home changed. (If the BC short-code is part of
the id, keep the original id; ids are stable and renumbering breaks references.)

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
