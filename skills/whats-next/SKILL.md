---
name: whats-next
description: Use whenever the user wants to know what to do next on an Agentheim project — they've just finished a batch of work, they're staring at an empty board, or they're simply not sure where to put their attention. Triggers on phrases like "what's next", "what should I do now", "what now", "where do I pick up", "I'm done — now what", "what's the next sensible step", "give me a recommendation", "is there anything to work on", "what should I build next", and on the dashboard topbar "What's next" launch. Reads the vision, the per-BC task boards (backlog / todo / doing / done), the recent protocol, and the open questions, then answers in plain prose: the single next sensible step and why — or two options when the project genuinely forks. Read-only: it recommends, it never moves tasks, commits, or edits anything.
---

# What's Next — Read the Project, Recommend the Next Move

The `whats-next` skill answers one question: *given everything that's been modeled, decided, and done so far, what is the single most sensible thing to do next — and why?*

It is the companion to the dashboard's "What's next" button. The builder presses it when a work batch just finished, when the board looks empty, or when they simply can't decide where to put their attention. The answer should read like a sharp colleague who knows the project glancing at the board and telling you, in a sentence or two, where to point yourself next — not a status report, not a backlog dump.

**This skill is read-only over lifecycle.** It reads `.agentheim/` and recommends. It never moves a task, never promotes, never commits, never edits the protocol. The recommendation is the entire output; acting on it is a separate, human-triggered step (`work`, `modeling`, `brainstorm`). Keeping it advisory is what makes it safe to press at any moment. It performs **one** write — and only one — the *advisory write* of its recommendation to `.agentheim/state/whats-next.md` (Step 4 below): an opinion *about* the state, not a change *to* it, distinct from a lifecycle write and explicitly carved out by **ADR-0027**. It performs no `git` action of any kind.

## How to think about this

You are not running a checklist — you are reading a situation. The artifacts below tell you where the project *is*; your job is to figure out where it most wants to go next and say so plainly. The priority ladder further down is the usual shape of that reasoning, but it is a guide to judgment, not a lookup table. When the situation doesn't fit the ladder, trust the situation.

Two failure modes to avoid above all:

- **Generic advice.** "You could refine your backlog" is useless. Name the actual task, quote the actual reason, point at the actual open question. Every recommendation must be anchored to something concrete you read.
- **Inventing scope.** When you suggest modeling something *new*, it must trace back to something already written down — an Open question in the vision, a gap against a stated success criterion, a "TODO / to be decided" left inside a task. Never conjure a feature the builder never hinted at, and never recommend anything the vision lists as a non-goal.

## Step 1 — Read the state (read-only)

Read these, cheapest and most informative first. Skip anything that doesn't exist and note its absence rather than guessing.

1. **`.agentheim/vision.md`** — the whole thing, but pay special attention to:
   - **Open questions** — the explicit list of things not yet built or not yet decided. This is the primary source for "what feature is missing".
   - **What success looks like** — so you can spot gaps between the goal and what's actually been done.
   - **Non-goals** — so you never recommend something the project has deliberately ruled out.
   - If `vision.md` is missing, that *is* the answer: recommend `brainstorm` first.
2. **`.agentheim/context-map.md`** (if it exists) — how the bounded contexts relate; useful for spotting a context that's been named but never built into.
3. **`.agentheim/knowledge/index.md`** (if it exists) — top-level catalog: current BCs, recent ADRs, global state.
4. **Each `.agentheim/contexts/*/INDEX.md`** — the per-BC task counts and lists by status. This is your fastest read of the board: how many tasks sit in backlog / todo / doing / done per context, and their titles. Prefer these lists over walking the directories.
5. **Each `.agentheim/contexts/*/README.md`'s line count** — a cheap, judgment-free check (`wc -l` or your file-read tool's reported line count; no tokenizer, no content read needed). A README at or over the **~600-line consolidation threshold** (ADR-0041) has grown past the point where it can reliably be read in one pass — flag it as a candidate `modeling` **CONSOLIDATE** recommendation (see Step 3 below). This is a background-maintenance signal, not new work the project asked for, so it rarely outranks anything live in `doing/` or a primed `todo/` — but note it so it can surface when nothing more urgent is happening, or as a brief aside.
6. **`.agentheim/knowledge/protocol.md`** — the first ~80–120 lines only (newest entries are on top). This tells you the *recent thread*: what just shipped, what was just dismissed, whether a work session ended cleanly or was interrupted, what the builder has been focused on. The live file is capped (ADR-0039) — older months roll out verbatim to `.agentheim/knowledge/protocol/YYYY-MM.md` — so this read-window stays recent-activity-only; there is no need to consult the archive here.
7. **The actual task files in `contexts/*/doing/`, `contexts/*/todo/`, and `contexts/*/backlog/`** — read these (not just the INDEX line) when you need their frontmatter to judge readiness:
   - `depends_on` — a todo task whose dependencies aren't all in `done/` is *not* actually ready; don't recommend running it.
   - `blocks` — finishing this one may unblock several others (a high-leverage pick).
   - `tags: [captured]` and acceptance criteria that say "To be defined during refinement" — this task is a raw capture and needs a `modeling` **refine** pass before it can be worked.
   - `created` date — to spot the stalest item, which is often the one most worth surfacing.

You don't need to read every `done/` file — the counts and recent protocol are enough to understand momentum.

## Step 2 — Locate the project on the ladder

This is the usual order of priority. Read it as "what's the most valuable lever right now", and let the actual situation override it when it clearly should.

1. **Work was interrupted** — `contexts/*/doing/` has any task in it. Half-done work rots and blocks the board; finishing it almost always beats starting something new. Recommend resuming it (`work` picks up `doing/` first). If two or more sit in `doing/`, note that a parallel session was interrupted.

2. **The pipeline is primed** — `todo/` has tasks whose dependencies are all satisfied. The thinking is already done; the highest-value move is to *execute*. Recommend running `work`. If several are ready, mention the highest-leverage one (most `blocks`, or the one continuing the current thread) but the move is the same: run `work`.

3. **Refined work is waiting one step back** — `todo/` is empty but `backlog/` holds an item that's already concrete (clear acceptance criteria, dependencies satisfied, not tagged `[captured]`). Recommend promoting it (`modeling` → promote) and working it. Favor one that *continues the thread* visible in the recent protocol — momentum is real and context is already loaded.

4. **The backlog is raw** — `backlog/` holds captures that aren't worked-ready (`[captured]`, "to be defined during refinement", thin acceptance criteria). Recommend a `modeling` **refine** pass on the most valuable / stalest one, naming it.

5. **The board is empty but the vision isn't done** — nothing in doing/todo/backlog worth acting on, but the vision has unanswered **Open questions** or visible gaps against **What success looks like**. Recommend a `modeling` session to capture the missing piece — and say *which* piece, quoting the open question or the unmet success criterion.

6. **The vision itself is thin or missing** — recommend `brainstorm` to establish (or deepen) the vision before anything else.

A task in `doing/` outranks a primed `todo/`, which outranks backlog work, which outranks new modeling — because finishing beats starting, and executing decided work beats deciding more. But a tiny stale chore in `doing/` shouldn't outrank an urgent, just-surfaced bug in `todo/`; if the situation argues against the ladder, follow the situation and say why.

**A README over the consolidation threshold (Step 1.5) sits outside this ladder** — it's upkeep, not new value, so it normally rides along as a brief second mention rather than displacing the top recommendation. It's worth promoting to the primary recommendation only when the ladder itself is quiet (nothing in `doing/`, nothing primed in `todo/`) — i.e. around rung 4–6 — since there's genuinely nothing more valuable to point at.

## Step 3 — Answer in plain prose

Write the recommendation the way you'd say it out loud to the builder. Short, concrete, reasoned. Structure it loosely like this — adapt freely, these are not rigid headings:

- **One line on where things stand.** "Your board is clear — nothing in flight, todo empty, three things waiting in the backlog." Orient them in a sentence.
- **The recommendation, with the why.** What to do next and the reason it's the sensible move *right now* — tied to the specific task, open question, or thread you read. This is the heart of the answer; spend your words here.
- **A second option, only if the project genuinely forks.** When there are two clearly sensible and roughly comparable next moves (e.g. *continue the thread you were on* vs. *address a freshly captured pain*), lay out both briefly and say what would make you lean each way. Don't manufacture a second option to fill space — one clear recommendation is better than two muddy ones. Never more than two.
- **The concrete next move.** End with the one action to take: which skill to invoke and on what — e.g. "Run `work`.", or "Say `refine agentic-workflow-063` and I'll deepen it.", or "Let's `brainstorm` the existing-code path." Make it a thing the builder can do in their next breath.

Keep the whole thing tight — a few short paragraphs, plain language. No tables, no status dumps, no exhaustive backlog listings, no ticket-by-ticket walkthrough. If the builder wants the full board they have the dashboard; what they want from *you* is a clear pointer and the reasoning behind it.

**When a BC's README is over the consolidation threshold** (flagged in Step 1.5), fold in a line using this exact phrasing so it stays a recognizable, greppable signal: `README <bc> is over the consolidation threshold — consolidate`. Say it as a plain aside when the main recommendation outranks it ("...and separately, `README <bc> is over the consolidation threshold — consolidate` whenever you get a spare moment"), or lead with it as the recommendation itself when the board is otherwise quiet. Never invent this line for a README you haven't actually measured.

### Tone

Talk like a colleague who knows the codebase, not a report generator. It's fine to have a point of view ("I'd finish aw-060 first — it's unblocked and you're already in the workflow-guide headspace"). Explain the *why* in terms the builder cares about (momentum, leverage, unblocking, closing a known gap), not in terms of the mechanics of the ladder. The builder should finish reading and immediately know what to do and feel good about why.

## Example shapes

**Example — primed pipeline (the easy case):**

> You've got four tasks ready in `todo/` and nothing half-finished, so the next move is simply to build. I'd run `work` — `design-system-012` (the token refactor) is the one to watch since three other tasks depend on it, and finishing it unblocks the most.
>
> **Next:** run `work`.

**Example — a genuine fork (two options):**

> Your board is clear: nothing in flight, todo's empty, and the backlog has three items. There are two sensible directions here.
>
> **Continue the thread.** You just shipped the Workflow guide page, and `agentic-workflow-060` (the hand-authored diagrams) is now unblocked and sitting in the backlog — it finishes what you started while the context is still warm. Promote and work it.
>
> **Address the pain you flagged.** `agentic-workflow-063` ("optimize the committing pattern") is a raw capture about commits being too noisy and files getting left out — a real friction in the daily loop, but it's unrefined, so it needs a modeling pass before it can be worked.
>
> I'd lean toward the diagrams: it's already unblocked, it's a quick win, and momentum matters. Save the committing-pattern work for when you've got the appetite to think it through properly.
>
> **Next:** say `promote agentic-workflow-060` to queue the diagrams, or `refine agentic-workflow-063` to start unpacking the commit problem.

**Example — empty board, gap against the vision:**

> Everything's shipped — board's clear, no backlog. But the vision still carries one open question you haven't touched: brainstorming on *existing* code, where Agentheim reverse-engineers a vision from a repo that already has code before continuing the Socratic dialogue. That's the biggest unbuilt piece of the stated vision.
>
> **Next:** let's `brainstorm` that existing-code path and turn it into a modeled backlog.

## Step 4 — Persist the recommendation (advisory write)

After you've printed the prose answer, persist it once so it survives the terminal it ran in and the dashboard can surface it. This is the skill's **single advisory write** (ADR-0027) — an opinion *about* the state, not a change *to* it. It is **not** a lifecycle write: you still move no task, promote nothing, edit no `INDEX.md` or `protocol.md`, reconcile no ADR backlink, and run **no** `git` command.

Write the recommendation to exactly **one** file — `.agentheim/state/whats-next.md` — and nowhere else. Create the `.agentheim/state/` directory if it does not yet exist (it is a sibling of `knowledge/` and `contexts/`, the home for advisory machine-written signals, and is git-ignored).

The file is **single-latest**: overwrite it in full each run, never append. It is not a log — history lives in `git`, not in a growing file.

Its shape is the frozen interface the dashboard reads (ADR-0027), so keep it exactly:

- **Frontmatter** carrying a `generated` key set to the current **ISO-8601** timestamp (e.g. `generated: 2026-06-17T21:43:00Z`). This is a descriptive staleness cue for the dashboard's rendering only; nothing keys behavior off it.
- **Three markdown sections**, in this order, mirroring the prose you just spoke:
  1. **Where things stand** — the one-line orientation on the board's state.
  2. **Recommended move** — the recommendation and the *why*, anchored to the concrete task / open question / thread you read. (When the project genuinely forks, lay out the two options here, as in your prose — never more than two.)
  3. **Next** — the single concrete action (which skill to invoke and on what).

Shape template:

```markdown
---
generated: 2026-06-17T21:43:00Z
---

## Where things stand

<one-line orientation>

## Recommended move

<the recommendation + the why>

## Next

<the one concrete action>
```

**Always write a coherent artifact, even in the empty cases.** When you have little to recommend — `vision.md` is missing so the answer is `brainstorm`, or the board is empty — still write all three sections reflecting *that* answer (where things stand: "no vision yet" / "board is clear"; recommended move + next: `brainstorm` / capture the missing piece). The file is always valid markdown with the `generated` frontmatter and the three sections, so the dashboard never has to special-case an empty or malformed recommendation.

Write the file and stop. Do not commit it, do not stage it, do not touch any other file.
