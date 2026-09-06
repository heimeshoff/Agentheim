---
name: modeling
description: Use whenever the user wants to capture an idea, bug, feature request, refinement, or change to an existing bounded context — anything from "the button should be green" to "we need a whole new subscription subsystem". Also use when the user wants to refine existing backlog items or promote refined items to ready-to-work. Triggers on phrases like "I have an idea", "let's model this", "let's do some modeling", "capture this", "add this to the backlog", "refine the auth backlog", "promote X to todo", "we should also", "what if we added", "there's a bug", "change the color of", "the domain needs to handle". Creates task markdown files in the appropriate bounded context with the right status, and can spawn deeper modeling sessions via the orchestrator. Supports six switchable conversational modes (Interrogator [default], Suggestor, Challenger, Storyteller, Facilitator, Synthesizer) during CAPTURE and REFINE — see references/modes.md.
---

# Modeling — Capture, Refine, Promote, Dismiss, Consolidate

The `modeling` skill is the main entry point for the user's stream of ideas. Every thought — from a one-line bug to a cross-context architectural shift — enters the system here and ends up as a task file in a bounded context. It also owns the *removal* of a task that will never be worked (DISMISS) and the *rewrite* of a BC README that has grown past the point where it can be read in one pass (CONSOLIDATE), since the dashboard is read-only by design (ADR-0017) and all `.agentheim/` markdown changes belong to the skills.

## The five actions

Decide which action applies based on what the user said and the current state of `.agentheim/`:

| Action | When | What it does |
|---|---|---|
| **CAPTURE** | User is describing something new | Turns the idea into one or more task files. Places them in `backlog/` if under-refined, or `todo/` if the idea is already concrete enough to work on. |
| **REFINE** | User wants to work through an existing backlog item, OR the user invoked model with no new idea and backlog items exist | Picks a backlog task, deepens it via the orchestrator, splits it if needed, updates acceptance criteria and dependencies. **Auto-promotes to `todo/` the moment the task clears the readiness gate** — no separate ask; readiness *is* the promotion trigger. |
| **PROMOTE** | User explicitly wants a task ready for work | Moves a task from `backlog/` to `todo/`, verifying it has enough detail to be picked up by a worker. |
| **DISMISS** | User wants to drop a `backlog/`/`todo/` task that will never be worked — a stray capture, a duplicate, a since-abandoned idea | Hard-deletes the named task **and its entire transitive dependent subtree** under one confirmation, then reconciles all the bookkeeping (INDEX lines + counts, surviving backlinks, one protocol entry). Refuses if any task in the set is in `doing/` or `done/`. |
| **CONSOLIDATE** | A BC's `README.md` has crossed the ~600-line consolidation threshold — self-named by the builder, or flagged by `whats-next`'s advisory line | Rewrites the README **in place**, builder-in-the-loop: merges redundant ubiquitous-language entries, folds superseded per-feature narration into settled current-state summaries. Never silently drops a term or invariant, never breaks a backlink. No archive — this is the *flag-and-consolidate* discipline (judgment, in-place), the deliberate opposite of the k5n8f family's *cap-and-roll* (verbatim, scripted, archived) used for the protocol (ADR-0039) and, prospectively, an INDEX done-list. See ADR-0041. |

### Disambiguating intent

- If the user gives a concrete idea ("add dark mode") → CAPTURE directly. Don't make them wade through the backlog first when they already know what they want to add.
- If the user invoked `modeling` with **no concrete new idea** ("let's model", "let's do some modeling", "what's in the backlog?", or a bare invocation) → run the **Opening flow** below: show the backlog, offer to refine, fall through to capture.
- If the user says "promote X" / "X is ready" → PROMOTE
- If the user says "dismiss X" / "delete X" / "drop X" / "remove X" / "X is dead" / "we won't do X" → DISMISS (resolve X per "Identifying which task the user means", then run the DISMISS flow). DISMISS is also the verb the dashboard's per-card trash-can fires as `/agentheim:modeling dismiss <id>`.
- If the user says "consolidate X README" / "the X README is too big" / "shrink the X README", or is responding to a `whats-next` consolidation flag → CONSOLIDATE (resolve X to a BC, then run the CONSOLIDATE flow).
- If ambiguous, ask once. Don't guess wrong and then have to undo. **Be especially careful before DISMISS** — it hard-deletes files (and possibly a whole subtree). Never infer DISMISS from a soft phrase; require an explicit drop/delete/dismiss intent or the literal command.

### Opening flow (bare invocation)

This runs only when the user opened `modeling` without handing you a concrete new idea — they want to work the backlog, or they haven't decided yet. The point is to surface what's already pending before inviting new thought, so existing ideas get refined instead of quietly accumulating.

1. **Gather the backlog.** After the "Before acting" reads, collect every task in `contexts/*/backlog/` across all BCs. Prefer the per-BC `INDEX.md` backlog lists (already loaded) over re-scanning directories.

2. **If the backlog is empty, the do-not-self-generate refusal applies unconditionally, before anything else runs.** No manufacturing a backlog item or task on your own initiative just because the backlog is empty (ADR-0064; refusal-placement fix agentic-workflow-f3wqm/ADR-0064 amendment) — an empty backlog always falls through to *inviting the user* to CAPTURE something new, never to modeling inventing it, whether or not the vacuum guard below turns up an open vision question to point at instead. Then run the vacuum guard (ADR-0064, agentic-workflow-qz1h7): read `.agentheim/vision.md`'s "## Open questions" section (already read in "Before acting") through `lib/vacuum-guard.mjs`'s `extractOpenQuestions` — it filters out already-resolved (struck-through) items and returns each remaining item with its `since` date. Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §3 (vacuum guard). If it returns **one or more** open items, surface them first — one line per item naming it and its age via `formatVacuumGuardLine` (e.g. "Brainstorm on existing code (next iteration). (open 46 days)") — framed as the single highest-leverage thing the builder could decide right now, ahead of capturing anything new. This is advisory, not a gate (vision non-goal 3, "Not autonomous") — after surfacing it, still fall straight through to inviting a new idea (CAPTURE) exactly as below; the guard only makes sure an unmade decision doesn't get buried under an empty backlog, it never blocks capture. If `extractOpenQuestions` returns nothing (no unresolved open questions, or vision.md is missing), the refusal above still holds — there's simply no open item to surface; say so in one line and go straight to inviting a new idea (CAPTURE). Don't show an empty table.

3. **If the backlog has tasks, present them as a table** and ask whether the user wants to refine any before capturing something new. Use this shape:

   ```
   You have N items in the backlog:

   | ID        | Title                      | BC      | Type    | Age   |
   |-----------|----------------------------|---------|---------|-------|
   | auth-003  | Password reset flow        | auth    | feature | 12d   |
   | books-007 | Reading-session timeout    | books   | bug     | 3d    |

   Want to refine any of these before we capture something new? (give me an ID, or say "new" / "no" to capture instead)
   ```

   - Sort oldest-first (stalest items are the ones most worth surfacing), unless a task carries a priority flag.
   - "Age" is days since the `created` date relative to today; keep it compact ("3d", "2w"). Omit the column if `created` dates aren't available rather than guessing.
   - Keep it scannable. If the backlog is large (say >15), show the oldest 15 and note how many more exist ("…and 8 more — ask to see them or name one").

4. **Branch on the answer:**
   - User names a task (by id, number, or keyword) → **REFINE** that task (see REFINE flow; resolve the reference per "Identifying which task the user means").
   - User says "no" / "new" / "capture" / starts describing something fresh → **CAPTURE** (see CAPTURE flow).
   - User is vague → ask once which they meant; don't assume.

### Identifying which task the user means (REFINE / PROMOTE / DISMISS)

When the user references an existing task, support all of these:

- **Exact id** — `books-007` → that exact task
- **Numeric only** — `007` → find task with that number across all BCs; if multiple BCs have the same number, list them and ask
- **Keyword / fuzzy** — `password` or `reading session` → match substring (case-insensitive) against task `title` and filename across `backlog/` and `todo/` of all BCs
- **No argument** — list all backlog (and todo, for PROMOTE context) tasks grouped by BC and let the user pick

When there are multiple matches, show a compact summary (id, title, status, BC) and ask which one — don't silently pick the first.

DISMISS resolves its target by the exact same rules (exact id / number / keyword, list-on-ambiguity). It additionally scans `doing/` and `done/` while resolving so it can refuse early with a clear message when the named task is already in flight or shipped — only `backlog/` and `todo/` tasks are dismissable.

CONSOLIDATE targets a **bounded context**, not a task — resolve by BC name (exact or fuzzy against `contexts/*/`). If the name is ambiguous or missing, list every BC alongside its current README line count and let the user pick.

## Before acting

Read the current state:
1. `.agentheim/vision.md` (for context — if missing, offer to run `brainstorm` first)
2. `.agentheim/context-map.md` (if exists)
3. `.agentheim/contexts/*/README.md` (to know what BCs exist and their language)
4. `.agentheim/knowledge/index.md` (top-level catalog — current BCs, recent ADRs, global state) — if missing, the project hasn't been indexed; surface this and continue
5. `.agentheim/knowledge/protocol.md` — read the first ~100 lines (newest entries are on top, so this gives recent activity). Skip if it doesn't exist yet. The live file is capped (ADR-0039) — older months roll out verbatim to `.agentheim/knowledge/protocol/YYYY-MM.md`, so this read stays recent-activity-only regardless of the live file's age.
6. **Check the planning advisory (read-only weight, never a directive).** If `.agentheim/state/whats-next.md` exists, read it and note its latest *recommended move* + age (`generated` timestamp) to the builder in **one line** before acting — e.g. `whats-next (2h ago): <recommended move>`. Compare `generated` against the newest `## … -- Work / …` entry in the protocol excerpt just read in step 5: newer than that entry → surface as **current**; older → surface as **stale — background context**, weighted less; no Work entries yet in the protocol → not stale. Let this weight which REFINE/CAPTURE questions you lean into (e.g. lean toward the recommended area when opening REFINE, or note alignment/drift during CAPTURE) — it **never** auto-picks a task to refine, auto-routes a capture, or overrides the user's explicit ask (ADR-0027 §4, ADR-0017). A missing artifact is silent — no line, no error. A malformed / partial / headingless artifact degrades gracefully: read whatever is parseable (at minimum the `generated` stamp or a recommended-move line, if either is present) and proceed without blocking the session; never throw.
7. `.agentheim/contexts/*/backlog/*.md` (to understand what's pending)
8. **For CAPTURE only:** once you've identified the candidate BC, scan `.agentheim/contexts/<bc>/done/` for prior art on keywords/tags from the user's idea. See the "Prior art lookup" section.

If no bounded contexts exist yet, and the idea is non-trivial, propose running `brainstorm` first. Small ideas (bug fixes, copy changes) in a greenfield project can get a default `contexts/main/` until real structure emerges.

## Conversational modes

This skill adopts one of six modes during the conversational portions of **CAPTURE** and **REFINE**. The defaults differ by action:

- **CAPTURE defaults to Facilitator** — when the user (or a room) is volunteering a new idea, the scribe stance lets the human(s) drive while you capture and structure. Resist the urge to question or suggest until the idea has been articulated; CAPTURE is fundamentally about not getting in the way of incoming thought.
- **REFINE defaults to Interrogator** — refinement is where ambiguity gets cornered, so naive/critical questions are the right starting stance. The questioning patterns in the REFINE flow below are written for it.

The user can override the default at invocation ("capture this in challenger mode", "refine auth-003 as the storyteller") or switch mid-action ("switch to suggestor", "synthesize what we have"). Acknowledge a switch in one short line — e.g. `→ Suggestor.` — and continue.

If the user says "change mode" / "switch mode" / "show me the modes" without naming a target, present an arrow-key picker via `AskUserQuestion`. The picker contract lives in `references/modes.md` under "Picker" — four modes in the menu (Interrogator, Suggestor, Challenger, Storyteller); Facilitator and Synthesizer are typed via the auto-"Other" option.

Full mode definitions and switching protocol live in `references/modes.md`. The full set:

- **Interrogator** — naive/critical questions one at a time. REFINE default.
- **Suggestor** — make smart assumptions and proposals; user accepts/rejects/refines. Useful for tiny captures or stuck refinement.
- **Challenger** — adversarial skeptic, presses on weak acceptance criteria or shaky scope. Use sparingly.
- **Storyteller** — narrate concrete scenarios with named characters to surface acceptance criteria from lived behavior.
- **Facilitator** — scribe stance; minimal interjection, captures and structures what the room says. CAPTURE default.
- **Synthesizer** — reflect back tensions and emergent themes across the backlog or a refinement thread. Best as a periodic switch-into.

PROMOTE and DISMISS are mechanical (readiness check + file move; resolve + cascade + confirm + bookkeeping) and run the same regardless of mode. CONSOLIDATE is judgment work over prose, not a conversational mode itself — it always runs builder-in-the-loop, confirming what gets folded/dropped before writing. Task file format, ID conventions, the styleguide gate, protocol logging, and orchestrator handoffs are all mode-agnostic.

## CAPTURE flow

1. **Understand the idea.** If the user gave one sentence, ask follow-ups to get: the why, the acceptance criteria, anything that constrains the solution. Don't ask more than 3-4 questions. For tiny things ("change button color"), one question may be enough, or none.

2. **Route to the right bounded context.** Match the idea's language to a BC's ubiquitous language. If it spans multiple BCs, say so and create a task in each (or a parent+child structure — see below). If it doesn't fit any BC and isn't trivial, that's a signal the context map needs revisiting — surface it.

   **Infrastructure-flavored captures** (anything about runtime, hosting, persistence configuration, secrets, observability, CI/CD, deployment, shared transport, base library choice) get a sharper routing rule:

   - **Globally true** — the concern applies across every BC, or stands on its own independent of any single BC. *Examples:* "switch from npm to pnpm", "add OpenTelemetry tracing", "rotate the production database password", "upgrade the base container image". → Capture in `contexts/infrastructure/`.
   - **BC-local** — the concern is only true for one BC. *Examples:* "the Library BC needs full-text search via Postgres tsvector", "Transcription should retry failed jobs in its own queue", "Auth's session store should move to Redis (no other BC uses Redis)". → Capture in the originating BC.

   The test: *"if this BC didn't exist, would the change still need to happen?"* — if yes, it's globally true and lands in `infrastructure/`; if no, it's BC-local and stays in the originating BC. When in genuine doubt (the change might go cross-cutting later but starts BC-local), prefer the originating BC — moving a task up to `infrastructure/` later is cheaper than retroactively scoping out a global decision that turned out not to apply.

   **Do not spawn new infra-flavored BCs.** Captures that feel like they want their own `monitoring/`, `secrets/`, `deploy/` BC are global infra concerns — they go in `contexts/infrastructure/`, not a new BC. If a genuinely new BC seems warranted from an infra capture, surface it for a `brainstorm` extension session rather than letting `model` spawn it. The exception is `design-system/` — already a first-class BC for frontend infrastructure, and `model` may add tasks to it but does not create competing UI-infra BCs.

   If `contexts/infrastructure/` doesn't exist (e.g., `brainstorm` was skipped), surface that — offer to run `brainstorm` in extension mode to add the infrastructure BC, or create the BC explicitly with a minimal README before capturing the task.

3. **Prior-art lookup.** Run the matcher described in "Backlink lookup" below against the target BC's `INDEX.md` (ADRs, research, done tasks) and the top-level index (global ADRs, cross-BC research). Surface every match score ≥ 2 to the user *before* writing the task file. For each prior-art hit (done task), give the user three outcomes: "yes related", "not relevant", or "this is the same task — exit CAPTURE, REFINE that one instead". Skip this step for trivial captures (single-line copy changes, obvious bug fixes).

4. **Decide refinement level.**
   - **Under-refined → backlog/**: The idea needs more thought, research, or breaking down before anyone could work on it.
   - **Ready → todo/**: The idea is small, well-understood, or already deeply discussed. A worker could pick it up and execute without ambiguity.
   - **Convention check (ADR-0059, mechanize-or-drop) — doctrine-bearing surfaces only:** this check applies only when the idea's scope touches a doctrine-bearing path — `skills/`, `agents/`, `references/`, `lib/`, `.agentheim/knowledge/`, or a BC README's convention/ubiquitous-language section. A capture confined to consumer product surfaces skips this check entirely — self-hosting harness development keeps full coverage; a consumer's product tasks essentially never establish harness-style conventions (ADR-0059 amendment, `agentic-workflow-z3grd`). Where it applies: if the idea *establishes a convention* — a naming, format, or structural rule that other tasks, agents, or artifacts are meant to follow going forward, not a one-off choice scoped to this task alone — it does not count as "Ready" unless it also carries either an enforcement acceptance criterion (a lint, a live-tree `node --test` check, or a build failure shipped in the same task) or an explicit **"prose-only, unenforced"** marker recorded in the task file. Neither present → route to `backlog/` regardless of how well-understood the idea otherwise reads; a missing enforcement-or-marker choice is exactly the kind of ambiguity backlog exists to resolve. See ADR-0044 and ADR-0052 for in-house exemplars of the enforced pattern.
   - **Falsifiability classification (ADR-0061):** classify every acceptance criterion as it's written — machine-checkable (the default, no marker) or `[human-eye]` (see "Classifying acceptance criteria" below). Human-eye criteria are never a `backlog/` blocker on their own. But if a task landing directly in `todo/` ends up with **every** criterion `[human-eye]`, add the same builder-eye-only `## Notes` line PROMOTE's readiness check requires (below) before placing it — don't let a directly-captured task skip the note just because it bypassed PROMOTE's CLI path.

5. **Delegate deep modeling if needed.** For complex ideas (new feature, domain change, architectural impact), spawn the **`agentheim:orchestrator`** agent with the idea and current state. It will route to `tactical-modeler`, `strategic-modeler`, `architect`, or `researcher` as appropriate, and come back with a refined task (or task set) plus any ADRs. For infrastructure-flavored captures, the orchestrator will typically route to `architect` first.

6. **Write the task file(s).** Include the user-confirmed `related_adrs`, `related_research`, `prior_art` from step 3 in the frontmatter. See task format below.

7. **Register + commit.** CAPTURE's bookkeeping — the INDEX marker insert + count delta, and the protocol prepend — is mechanized (ADR-0038, ADR-0073): once per task file just written, run `lib/task-lifecycle-cli.mjs capture <task-id> '{"source":"modeling","summary":"<1-2 sentences>"}'` (the same env-free bootstrap as the PROMOTE flow's step 3, below). It validates the file's own frontmatter (id well-formed, `status`/`context` matching where it was written, required fields present), inserts the INDEX line + count delta, and prepends the `Modeling / Captured` protocol entry — or returns `{ok:false, code, reason}` if something about the just-written file is wrong, in which case fix the file and re-run rather than hand-editing the index. It acquires the lifecycle lock itself (agentic-workflow-pt0gy) — a concurrent sibling session's own capture/promote/dismiss/log/index-add waits, it never races. Then commit via `scoped-commit` (see "Committing" below) with exactly the manifest's `changed` paths plus the new task file(s), and the manifest's `message` (already `chore(<bc>): capture <task-id> — <title> [<task-id>]`). If a brand-new BC is being created during this CAPTURE (rare), insert its line under `<!-- bc-list:start -->` in `.agentheim/knowledge/index.md` via `lib/task-lifecycle-cli.mjs index-add '{"bc":null,"section":"bc-list","id":"<bc-name>","line":"- **<bc-name>** — <one-line purpose> — \`contexts/<bc-name>/INDEX.md\`"}'` first — the `capture` CLI call only ever touches the target BC's own index.

## REFINE flow

1. If no specific backlog item was named, list the backlog across all contexts and ask which to refine. Prefer oldest-first or user-priority if flagged.

2. Read the task, its BC's README, and any related tasks (dependencies, siblings).

3. **Interrogate the task.** Questions typically needed:
   - Is the goal still correct?
   - What are the acceptance criteria?
   - What does this depend on? What depends on it?
   - Does this split into smaller tasks?
   - Does this reveal a decision that should become an ADR?
   - **Classify each acceptance criterion (ADR-0061):** machine-checkable (default) or `[human-eye]`? Try sharpening a perceptual-feeling criterion into something testable first. See "Classifying acceptance criteria" below.
   - **Shaping a drift-fix task on a doctrine restatement found drifted before?** Check whether this is its *second* drift (ADR-0068) — if so, the fix deletes the restatement and pointers the canonical source, it does not re-synchronize the copy a second time.

4. **Delegate to the `agentheim:orchestrator`** for depth. Give it the task and the BC context. It will route to specialists.

5. **Update the task file** with refined content. If it splits, create child tasks and update `depends_on` — each child registers through `capture` (see "Updating indexes" below), never a hand-edited INDEX line. If a decision was made, write an ADR to `.agentheim/knowledge/decisions/`.

5b. **Log the refinement.** Run `lib/task-lifecycle-cli.mjs log '{"title":"Modeling / Refined: <task-id> - <title>","body":"**Type:** Modeling / Refine\n**BC:** <bc-name>\n**Status after:** backlog | todo\n**Summary:** <what was clarified, added, or split>\n**Split into:** <new task ids, if split>\n**ADRs written:** <ADR ids, if any>"}'` (same bootstrap as PROMOTE's step 3, targeting `log` instead of `promote`). This prepends the protocol entry, locked, and returns `{changed:[protocolPath], message:null, verb:'log', timestamp}` — fold `protocolPath` into the commit below.

6. **Commit the refinement.** Commit via `scoped-commit` (see "Committing" below) with exactly the touched files — the refined task file (and any child task files if it split, via their own `capture` manifests), the BC `INDEX.md` if a `capture` call touched it, `protocol.md` (from step 5b's `log` manifest), and any ADR written — under `model(<bc>): refine <task-id> — <title> [<task-id>]` (one trailer per task if the refinement split into several).

7. **Auto-promote the moment it's ready — don't ask, just promote.** When refinement has carried a task over the readiness bar, promoting it is not a separate decision the builder needs to make — it's the natural completion of the refinement, so do it automatically rather than stopping to say "this looks ready, say `promote` to promote it". The builder asked you to refine; a task that is now workable belongs in `todo/`.

   Concretely, run the **PROMOTE flow** on the task (or, if the refinement split it, on each resulting child) as its own step, right after the refinement commit above:
   - Apply PROMOTE's **readiness check** and the **styleguide gate** unchanged. These are the guardrails that make silent promotion safe: a task missing acceptance criteria, blocked on an unmet dependency, or a frontend task sitting ahead of the styleguide must *not* slip into `todo/`. If a task fails the check, leave it in `backlog/`, say in one line what's still missing, and offer to keep refining — that is the not-ready branch, unchanged.
   - For a task that passes, run PROMOTE's mechanics wholesale (the `task-lifecycle-cli.mjs promote <id>` CLI, its scoped promotion commit, and the protocol entry it generates). Reuse PROMOTE — don't hand-roll a `backlog → todo` move here.
   - **Announce it in one line** so the task doesn't silently vanish from the builder's backlog mid-session: `→ promoted <task-id> to todo/`. This is a notification, not a confirmation prompt — you're telling the builder what you did, not asking permission. (Commit stays silent per "Committing"; the one-line notice is the human-facing signal.)

   The only time refinement ends *without* auto-promotion is when the task genuinely isn't ready — it stays in `backlog/` for another pass. "Ready but awaiting the user's go-ahead" is not a state this skill produces anymore.

## PROMOTE flow

PROMOTE's mechanics — the `backlog → todo` move, the INDEX marker edit + count delta, and the protocol prepend — are mechanized (ADR-0038): `lib/task-lifecycle-cli.mjs promote <id>` performs all of it and returns an enumerated manifest `{changed, message, verb, id}`, or a structured `{ok:false, code, reason}` rejection. This flow keeps only what the CLI deliberately does NOT decide — **judgment** (readiness) and **git** (the scoped commit) — per ADR-0038's three-layer boundary (`applyTaskMove` mover / git-free CLI / skill judgment+git).

1. Find the task (user may name it by id or title, or describe it).

2. Check readiness:
   - Has an acceptance criteria section with at least one concrete criterion
   - Has a clear scope (not "improve the UX")
   - Dependencies are known and either met or tracked — **fail-closed** (ADR-0038 Ruling A): a `depends_on` id in no lifecycle folder blocks promotion. The CLI enforces this via `applyTaskMove`'s gate in step 3, surfacing a rejection rather than a hand-check.
   - **Convention check (ADR-0059, mechanize-or-drop) — doctrine-bearing surfaces only:** applies only when the task's diff/scope touches `skills/`, `agents/`, `references/`, `lib/`, `.agentheim/knowledge/`, or a BC README's convention/ubiquitous-language section; a task confined to consumer product surfaces skips it entirely (ADR-0059 amendment, `agentic-workflow-z3grd`). Where it applies: a task that *establishes a convention* — a naming/format/structural rule other tasks or agents are meant to follow going forward — must carry either an enforcement acceptance criterion (lint, `node --test` check, or build failure) or an explicit **"prose-only, unenforced"** marker. Neither present → not ready; send back to REFINE. See ADR-0044 / ADR-0052 for shipped-enforcement exemplars.
   - **Falsifiability classification (ADR-0061):** every acceptance criterion is either machine-checkable (default) or carries the explicit `[human-eye]` marker — **not itself a promotion blocker**: a task with some, or even all, human-eye criteria is still promotable. It changes only what happens next (step 2b).

2b. **All-human-eye note.** If **every** acceptance criterion in the task carries `[human-eye]`, add — unless a matching line is already present — this exact line to the task's `## Notes` section before running the CLI in step 3:

   > Verification is builder-eye only — every acceptance criterion is human-eye (ADR-0061);
   > the verifier will report each as "builder eye-check pending" rather than PASS/FAIL any
   > of them on an invented proxy.

   `lib/human-eye-criteria.mjs`'s live-tree lint enforces this (ADR-0059 mechanize-or-drop) on any `todo/doing/done` task whose criteria are all `[human-eye]` (a `backlog/` resident is legal without the note by design, ADR-0061). Edit the task file in place, in `backlog/`, before the move — the CLI's manifest then naturally covers the edit since it commits the same (now-relocated) file.

3. If ready, run the CLI — git-free, it only writes files, never `git`:

   ```
   node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','task-lifecycle-cli.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','task-lifecycle-cli.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no task-lifecycle CLI found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.main(process.argv.slice(1))).catch(e=>{console.error(e.message);process.exit(1)});" promote <task-id>
   ```

   (The same env-free homedir→cache→semver-max bootstrap infrastructure-010 established for `/dashboard`, generalized by `lib/resolve-plugin-file.mjs`.) It prints the manifest on success, or `{ok:false, code, reason}` on a domain rejection (e.g. `blocked-dependency`, `illegal-move`) — treat a rejection the same as "not ready" in step 4.

4. If not ready (step 2's checklist fails, or the CLI rejects in step 3), tell the user what's missing and offer to switch to the REFINE action on this task.

5. **Commit the promotion.** Commit via `scoped-commit` (see "Committing" below) with exactly the manifest's `changed` paths from step 3, under the manifest's `message` (already the `model(<bc>): promote <task-id> — <title> [<task-id>]` convention — see `references/commit-doctrine.md`). Nothing to commit if the task wasn't ready and stayed in `backlog/`.

## DISMISS flow

DISMISS hard-deletes a task that will never be worked, **plus its entire transitive dependent subtree**, and then reconciles every record that pointed at the deleted ids. The contract is frozen by **ADR-0022, amended by ADR-0073** — follow both precisely. The disposition is a hard delete (no archive folder, no `status: dismissed` flag): these are unstarted ideas, little history is lost, and the protocol entry preserves the record that they were dropped.

DISMISS's mechanics — cascade computation, the in-flight/shipped guard, the INDEX marker edits + count deltas, surviving-backlink stripping, and the protocol prepend — are mechanized (ADR-0038, ADR-0073): `lib/task-lifecycle-cli.mjs dismiss <id> <json-opts>` performs all of it, two-phase, and returns an enumerated manifest or a structured `{ok:false, code, reason}` rejection. This flow keeps only what the CLI does NOT decide — **resolving which task the user means** and **the confirm/cancel gesture** — per ADR-0038's three-layer boundary. (DISMISS is a delete, not a move, so it does **not** call `applyTaskMove` — but the CLI follows the same git-free, judgment-free rule.)

1. **Resolve the named task** X (exact id / number / keyword — see "Identifying which task the user means"; list matches on ambiguity).

2. **Plan the cascade.** Run the bootstrap (the same one PROMOTE's step 3 uses) with `dismiss <X> '{"plan":true}'`. This performs **zero disk writes** and returns `{ok:true, cascade:{leadId, memberIds}, members:[{id,title,bc,status,path}], advisories}` — or `{ok:false, code:'in-flight-or-shipped', reason}` naming the offending `doing/`/`done/` task (X itself included), or `{ok:false, code:'not-found', reason}` if X doesn't resolve. `memberIds` follows **`depends_on` edges only** (ADR-0073 amends ADR-0022: `blocks` is reconciliation-only, never traversed) and matches on **exact frontmatter id**, never filename/prefix resolution — a near-miss or a `blocks`-only edge surfaces in `advisories`, never as a member. A rejection here ends the flow; tell the user what's blocking it.

3. **Surface the full cascade set and confirm once.** Present the complete `members` list — id + title for every task, grouped by BC, so the blast radius is visible — and take a **single** confirm/cancel. If the set is just `{X}`, say so plainly. **Cancel changes nothing on disk** (the plan step already wrote nothing). Never split this into per-task confirmations, and never delete more than the set you showed.

   ```
   Dismissing aw-046 will also remove every task queued behind it:

   | ID        | Title                                  | BC               | Status  |
   |-----------|----------------------------------------|------------------|---------|
   | aw-046    | Modeling DISMISS verb                  | agentic-workflow | backlog |
   | aw-048    | Dashboard per-card trash-can           | agentic-workflow | backlog |

   This hard-deletes 2 task files. Confirm? (yes / cancel)
   ```

4. **On confirm, run `dismiss <X> '{"confirm":[<memberIds from step 2>]}'`.** This recomputes the FULL guarded cascade fresh — never trusting the plan — and refuses `cascade-drifted` (membership changed since planning) or `cascade-in-flight` (a member's lifecycle folder changed) before writing anything; re-run from step 2 in either case and re-confirm with the user. On success it hard-deletes every member `.md` file, edits every spanned BC's `INDEX.md` (count deltas derived from lines actually removed, never from the set's size), strips every dismissed id from surviving tasks' `depends_on`/`blocks`/`prior_art` and ADRs' `related_tasks`, and prepends **one** bare `Modeling / Dismissed` entry to `protocol.md` — no builder-typed reason, id + title + timestamp is the record.

5. **IDs are gone, never reused.** For new token ids this holds **by construction** (ADR-0028 §5): the generator emits a random token and never consults history, so a dismissed token is simply one of ~23M points the generator will, with overwhelming probability, never emit again — there is no counter to advance or rewind. For legacy `<bc>-NNN` ids the original rule is retained verbatim: a dismissed number is retired, consistent with "never renumber" — a future capture takes the next free number, never a dismissed one.

6. **Commit the dismissal.** Commit via `scoped-commit` (see "Committing" below) with exactly the manifest's `changed` paths from step 4 (every deleted path plus every edited file — `scoped-commit`'s plain `git add` stages a deletion the same as an edit, no `git rm` special case needed), under the manifest's `message` (already `chore(<bc>): dismiss <lead-id-or-set>`, per `references/commit-doctrine.md`/ADR-0026). Note that even though a DISMISS legitimately spans multiple BCs, `changed` stays an explicit enumeration of only the cascade's files.

## CONSOLIDATE flow

CONSOLIDATE rewrites a BC's `README.md` **in place** to bring it back under the ~600-line consolidation trigger, with the builder in the loop throughout (**ADR-0041**). Unlike DISMISS/PROMOTE (mechanical), CONSOLIDATE is **judgment work over prose** — no script, because a machine can't safely rewrite ubiquitous language without dropping meaning. This is the family's **flag-and-consolidate** discipline (judgment, human-in-loop, in place, no archive) — the deliberate opposite of the k5n8f family's **cap-and-roll** (verbatim, scripted, archived) used for `protocol.md` (ADR-0039) and, prospectively, a BC `INDEX.md` done-list.

1. **Resolve the target BC** (see "Identifying which task the user means" above). If the named README is already under the ~600-line threshold, say so and ask whether the user wants a lighter consolidation anyway — CONSOLIDATE is never auto-triggered by the skill itself, only requested or flagged (by `whats-next`'s advisory line).

2. **Read the whole README.** Page it if a single `Read` can't cover it. Build a mental inventory of every ubiquitous-language term, invariant, aggregate, and backlink (ADR id, task id) currently stated, so nothing can be lost without you noticing.

3. **Consolidate, section by section**, especially dense per-feature narration (the "aw-0NN did X, then aw-0MM superseded it" chains):
   - **Fold superseded narration into a settled, current-state summary.** Describe what's true *now*; keep lineage only where it is itself load-bearing.
   - **Merge redundant entries** describing the same term/feature from more than one angle or place.
   - **Never silently delete a term or an invariant.** If something is genuinely dead, say so explicitly to the builder and get an explicit yes before dropping it.
   - **Preserve backlinks.** Every ADR id / task id that remains must still resolve. Redundant repeated citations may be trimmed, but never an id's sole remaining occurrence.

4. **Verify backlinks resolve** before showing the rewrite: grep every remaining ADR id / task id reference against disk. Fix or flag anything that doesn't resolve.

5. **Confirm with the builder** before writing — summarize what was merged, folded, and (with explicit sign-off per step 3) dropped.

6. **Write the rewritten `README.md` in place.** No archive file, no rolled-out history.

7. **Log the consolidation.** Run `lib/task-lifecycle-cli.mjs log '{"title":"Modeling / Consolidated: <bc> README","body":"**Type:** Modeling / Consolidate\n**BC:** <bc-name>\n**Before → After:** <N> lines → <M> lines\n**Summary:** <1-2 sentences on what was merged/folded; note anything dropped, with builder sign-off>"}'` (same bootstrap as PROMOTE's step 3, targeting `log`). No task ids, no `**Filed to**`/`**Status after**` — CONSOLIDATE never touches a task file or a lifecycle move.

8. **Commit the consolidation.** Commit via `scoped-commit` (see "Committing" below) with exactly the rewritten `README.md` and `protocol.md` (from step 7's `log` manifest) — never the task files or `INDEX.md` — under `model(<bc>): consolidate <bc> README`.

## Task file format

Files live as `contexts/<bc>/<status>/<id>-<slug>.md`. Example: `contexts/auth/backlog/auth-003-password-reset-flow.md`.

```markdown
---
id: auth-003
title: Password reset flow
status: backlog
type: feature
context: auth
created: 2026-04-24
completed:
depends_on: []
blocks: []
tags: []
related_adrs: []
related_research: []
prior_art: []
---

## Why
Why this exists. The user problem or domain pressure behind it.

## What
What the change is, in domain language.

## Acceptance criteria
- [ ] Concrete, testable outcomes.
- [ ] One bullet per criterion.
- [ ] Perceptual claims that resist testing: mark with a trailing `[human-eye]` (ADR-0061) —
      see "Classifying acceptance criteria" below.

## Notes
Open questions, links to ADRs, references to research reports,
rough sketches — anything a worker or refiner would want.
```

Keep the frontmatter values clean — **no inline `# …` comments** (the dashboard parses the whole line as the value; a leaked comment on `status` once blanked the board). The field legend lives here instead:

- `status` — one of `backlog | todo | doing | done` (also the lifecycle folder).
- `type` — one of `feature | bug | refactor | chore | spike | decision`. A `spike` task's body must carry the **stop-loss clause** (ADR-0065, agentic-workflow-rx630): "if, mid-spike, the mitigation is already known and cheap, record it and stop" — verbatim or in substance, satisfying `lib/spike-stop-loss.mjs`'s live-tree lint. Without it a worker has no standing permission to end the spike early with a recorded mitigation. An "investigate why X" / "find out what's causing Y" capture is investigation-shaped even if it reads like a `bug` or `chore` at a glance — prefer `type: spike` for it so it gets the stop-loss clause and ADR-0065's ordering preference, rather than letting it escape that apparatus under a different label (agentic-workflow-f3wqm; declined mechanization, see the audit-closure ADR).
- `completed` — left empty; the conductor sets the date when it applies the worker's reported `OUTCOME` at integration (post-ghcaj — the worker never edits its own task file). (No `commit:` field — ADR-0026 dropped it; found via `git log`'s `[<task-id>]` trailer.)
- `depends_on` — list of task ids this one waits on; `blocks` is the optional reverse edge, maintained by modeling (CAPTURE / REFINE) when it writes the task file — never auto-mirrored from `depends_on` by any mechanized helper (ADR-0073) and never written by the worker.
- `related_adrs` — ADR ids (e.g. `[0007]`); auto-populated by model at capture/refine, orchestrator appends ADRs it writes.
- `related_research` — research slugs (e.g. `[auth-tokens-2026-04-24]`); auto-populated by model from the research index.
- `prior_art` — done task ids from the same BC matching keyword/tags; auto-populated by model at capture.

### ID convention

Emit a fresh id `<bc>-<token>` per the id grammar in `references/id-grammar.md` (ADR-0028 §1) — generate the token randomly, never scan existing files for a "next number". Legacy `<bc>-NNN` ids (e.g. `auth-003`) already on disk are kept as-is — never rewrite them.

After minting, verify the new id with `classifyTaskId` from `lib/id-grammar.mjs` (ADR-0044 mint-time backstop): if `classifyTaskId(newId) !== 'token'`, the token is out-of-spec — discard it and mint a fresh one, no need to ask the user. Runnable in a consumer install via the resolve-plugin-file-convention bootstrap in `references/lib-bootstrap.md` §6.

### Classifying acceptance criteria (ADR-0061)

Every acceptance criterion is, by construction, one of two kinds (ADR-0061) — irreducibly
perceptual claims must never be refined into an invented machine metric standing in for a
human judgment. Refinement (CAPTURE or REFINE) is where the classification call gets made —
not left for whichever worker or verifier happens to touch the task later:

- **Machine-checkable (default, no marker).** A test or a concrete inspectable artifact can decide it. This is the ordinary case — leave the bullet as-is.
- **Human-eye.** Only a person looking at the actual result can judge it — a genuinely perceptual claim ("the animation feels smooth", "the copy reads naturally"). Mark it explicitly with a trailing `[human-eye]` on the bullet:

  ```markdown
  - [ ] The slot visibly shows the captured frame. [human-eye]
  ```

If a criterion feels perceptual, try sharpening it into something testable first — `[human-eye]` is for claims that are irreducibly perceptual, not an escape hatch. A `[human-eye]` bullet's checkbox is deliberately **left unchecked through the whole lifecycle** — only the builder checks it, by hand, once they've actually looked; that unchecked box, still visible on a `done/` task, *is* the routing signal to a builder-checks-by-eye step at completion.

Human-eye criteria are never a `backlog/`→`todo/` blocker on their own (see PROMOTE's readiness check). The one thing they trigger: a task whose criteria are **all** `[human-eye]` needs the builder-eye-only `## Notes` line PROMOTE's readiness check adds (or CAPTURE) before it's ready. See ADR-0061; `agents/verifier.md` check 1 and `skills/verification-before-completion/SKILL.md` for how the verifier treats these criteria (never proxied — reported "builder eye-check pending").

## Decisions as tasks

When modeling surfaces a genuine architectural or domain decision that deserves its own treatment (rather than being an implementation detail of a feature), create a task with `type: decision`. Its output when worked is an ADR in `.agentheim/knowledge/decisions/`, not code. This lets decisions flow through the same backlog discipline as features.

## Frontend tasks: styleguide gate

If the project has a `contexts/design-system/` BC with a styleguide task (set up by `brainstorm`'s architecture foundation step), every captured frontend / UI task in any BC must include the styleguide task in its `depends_on`. Read the BC's README before capturing — frontend-bearing BCs carry a note that points at the styleguide task id.

If you're capturing the project's first frontend task and no styleguide task exists, **stop and surface that**. Offer either:
- Running `brainstorm` in extension mode to add the foundation step, or
- Capturing a `design-system-001-styleguide` task explicitly, with this captured task depending on it.

Never promote a frontend task to `todo/` ahead of the styleguide. The styleguide is reviewed with the user before any BC implements its UI — that's the gate.

## Delegating to the orchestrator

The `modeling` skill itself does not do deep modeling — it routes. For anything non-trivial, hand off to the `agentheim:orchestrator` agent with:
- The idea or task being refined
- The target BC's README (ubiquitous language)
- The vision.md
- The context map
- A clear question: "refine this task" or "decompose this idea into tasks" or "tell me what BCs this touches"

The orchestrator picks specialists. Respect its output and integrate it into the task files.

## Research is fair game mid-model

If the user or the orchestrator hits an "we don't know enough about X" wall, kick off the `research` skill in parallel. Continue modeling what you can while research runs; fold its report into the task's Notes section when ready.

## Backlink lookup (auto-populate task frontmatter)

The point is to stop workers arriving in isolation. Whenever a task is being written or updated, pre-compute its backlinks so the worker doesn't have to re-derive them.

### When

- **CAPTURE** — after the BC is decided, before writing the task file.
- **REFINE** — after the orchestrator's specialist round, before writing the updated task file. Re-run from scratch each time (cheap; catches new ADRs/research that arrived since last refinement).

### Inputs

- The candidate task's `title`, `tags`, `What` body, and target BC.
- The target BC's `INDEX.md` (already loaded in "Before acting") — has the per-BC ADR list, research list, done-task list.
- If the BC's done-list has been rotated (ADR-0039's cap-and-roll convention applied to the INDEX done-list, agentic-workflow-c8j3w), it names its archive location in the `### Done (...)` header — check `contexts/<bc>/done-archive/*.md` too so a task rolled out of the live list is still findable by keyword. The archived line is byte-identical to its old live-list line, so the same slug/tag matcher applies unchanged.
- The top-level `.agentheim/knowledge/index.md` — has the global ADR list and cross-BC research list.

### Matcher (cheap-first)

For each candidate artifact in the indexes:

1. **Slug overlap** — split the artifact's slug on `-` and the task's title on whitespace. Count words present in both (case-insensitive, ignore stopwords: `the / a / an / of / for / and / to / in / on`). Score = matches.
2. **Tag overlap** — if the artifact's source file has any of the task's `tags` in its frontmatter, +2 per shared tag.
3. **Threshold** — score ≥ 2 qualifies. Below that, do not auto-link.

Cap each list at 5 entries. If you have more than 5 candidates above threshold, take the highest-scored.

### What to populate

- `related_adrs`: ADR ids from (BC-scoped ADRs + global ADRs) that scored ≥ 2.
- `related_research`: research slugs from (BC-scoped + cross-BC research) that scored ≥ 2.
- `prior_art`: done task ids in the same BC that scored ≥ 2. (CAPTURE only — REFINE may already have human-curated prior_art; only add new entries, never remove.)

### Surface to user

For CAPTURE: before writing the task, show the user a one-line block per matched item ("Found prior art: auth-002 (Login session pinning, completed 2026-03-14). Read it?"). Three short outcomes the user can pick:

- "Yes, related" → keep in `prior_art` / `related_*`.
- "No, not relevant" → drop from the list.
- "This is the same — don't capture, update auth-002 instead" → exit CAPTURE, switch to REFINE on the prior task.

For tiny captures (single-line copy changes, trivial bug fixes), skip the matcher entirely. Don't burn context on lookups for `change button color`.

### Bidirectional link maintenance

When the orchestrator writes an ADR scoped to this task during REFINE:
1. Add the ADR id to `related_adrs` in the task frontmatter.
2. Add the task id to `related_tasks` in the ADR frontmatter.

When `work` records `ADRS_WRITTEN` for a SUCCESS task, do the same — append the ADR id to that task's `related_adrs` and update the ADR's `related_tasks`. (See `work/SKILL.md` "Index updates" — the bidirectional ADR↔task link maintenance lives in the same step.)

## Updating indexes

After writing or moving a task file, update the BC's `INDEX.md` so other skills (and you, on the next invocation) can find it without scanning directories. The template lives at `references/index-template.md`.

**Where to update:**

- **CAPTURE (backlog/ or todo/):** mechanized (ADR-0038, ADR-0073) — `lib/task-lifecycle-cli.mjs capture <id> <json-opts>` performs the marker insert and count delta (a unified line format that always carries `(type)`) as part of its manifest; see CAPTURE step 7 above. Nothing to hand-edit here. It also backfills a missing `INDEX.md` from `references/index-template.md` when the BC holds nothing but the captured file.
- **PROMOTE (backlog → todo):** mechanized (ADR-0038) — `lib/task-lifecycle-cli.mjs promote <id>` performs the marker edit and count delta as part of its manifest; see the PROMOTE flow above. Nothing to hand-edit here.
- **REFINE that splits a task:** children register through `capture` (INDEX line + count together, mechanized — ADR-0038, ADR-0073), exactly like any newly captured task. **The parent's own INDEX line is left alone** — hand-removing it would desync the count from the folder (the parent file still sits in `backlog/` until something moves it). If the parent is superseded by its children, DISMISS it explicitly — its own cascade + bookkeeping, never a bare line removal here (agentic-workflow-pt0gy).
- **DISMISS:** mechanized (ADR-0038, ADR-0073) — `lib/task-lifecycle-cli.mjs dismiss <id> <json-opts>` removes every cascade member's line from its BC `INDEX.md` and decrements the matching count from lines actually removed, as part of its manifest; see the DISMISS flow above. The set may span BCs — editing several BCs' indexes in one DISMISS is the sanctioned exception below.

If a BC's `INDEX.md` doesn't exist yet: `capture` backfills it automatically (see above) when the BC is otherwise empty, and refuses `index-missing` otherwise — in the refusal case, or for any other index creation, build it from `references/index-template.md` with the BC name filled in by hand. Do not invent sections — only the templated markers are append targets.

**Entry-length cap (ADR-0060):** a task's `title:` frontmatter is what lands verbatim in its INDEX task line (the mechanized lifecycle scripts embed it unchanged) — keep a newly authored or refined title to **~2-3 sentences, ~60 words**: the claim and the pointer, not a walkthrough. Detail belongs in the task file's `Why`/`What` sections, never the title. Applies going forward only; an existing over-length title already on disk is left verbatim — no retroactive rewrite (mirrors ADR-0039's verbatim cap-and-roll discipline). A live-tree lint (`lib/index-entry-length.mjs`, `node --test`) flags a new INDEX entry — one dated after the doctrine's adoption — that still exceeds the cap.

**What not to do:**
- Do not edit the index across multiple BCs in one skill invocation unless a single capture genuinely lands in multiple BCs, **or a DISMISS cascade set spans BCs** (ADR-0022 — the sanctioned exception).
- Do not auto-rewrite the entire file — only insert/remove at the markers. Preserve any human-added prose elsewhere.
- Do not append duplicate entries — if the line is already present (same task-id), skip.

If a brand-new BC is being created during CAPTURE (rare — model normally does not create BCs; that's brainstorm's job), also insert under `<!-- bc-list:start -->` in `.agentheim/knowledge/index.md` via `index-add` (see CAPTURE step 7 above) — never a hand-edit.

## Protocol logging

Every action prepends one entry to `.agentheim/knowledge/protocol.md` — mechanized end to end (ADR-0038, ADR-0073, agentic-workflow-pt0gy). Nothing here hand-creates the file or hand-prepends an entry any more; every path below routes through a lifecycle-lock-held verb that already calls `readProtocolOrDefault` (seeding the standard header itself, once, the first time any verb ever touches a fresh project's `protocol.md`) and `prependProtocolEntry`.

- **CAPTURE** (`Modeling / Captured: <task-id> - [title]`, `**Type:** Modeling / Capture`, `**BC:**`, `**Filed to:** backlog | todo`, `**Summary:**`) and **PROMOTE** (`Modeling / Promoted: <task-id> - [title]`, `**Type:** Modeling / Promote`, `**BC:**`, `**From → To:** backlog → todo`) — `lib/task-lifecycle-cli.mjs capture <id>` / `promote <id>` generate and prepend them as part of their manifests; see the CAPTURE and PROMOTE flows above. `capture`'s `{"protocolEntry": false}` opt skips the protocol write entirely (no entry at all) — `brainstorm`'s per-task foundation capture uses it, keeping its own single hand-formatted session entry instead (see `brainstorm/SKILL.md`).
- **DISMISS** (`Modeling / Dismissed: <id-or-id-list>`, `**Type:** Modeling / Dismiss`, `**Dismissed:**` one line per cascade member — `<task-id> - <title> (<bc>)`) — `lib/task-lifecycle-cli.mjs dismiss <id> '{"confirm":[...]}'` generates and prepends it as part of its manifest; see the DISMISS flow above. It is **bare** — no builder-typed reason. One entry per dismiss regardless of how many tasks the cascade removed.
- **REFINE** (`Modeling / Refined: <task-id> - [title]`, `**Type:** Modeling / Refine`, `**BC:**`, `**Status after:** backlog | todo`, `**Summary:**`, `**Split into:**` if split, `**ADRs written:**` if any) and **CONSOLIDATE** (`Modeling / Consolidated: <bc> README`, `**Type:** Modeling / Consolidate`, `**BC:**`, `**Before → After:** <N> lines → <M> lines`, `**Summary:**` — no task ids, no `**Filed to**`/`**Status after**`, since neither touches a task file or a lifecycle move) — these two carry judgment `title`/`body` text no CLI verb can synthesize, so REFINE step 5b and CONSOLIDATE step 7 above compose that text and hand it to the **`log`** mechanics verb (`lib/task-lifecycle-cli.mjs log '{"title":"...","body":"..."}'`), which renders the `## <timestamp> -- <title>` heading (the one mechanical part — a hand-typed clock reading is a fabricated measurement, ADR-0038 Ruling B) and prepends `title` + `body` verbatim. `log` never guesses a title or body; it only stamps the timestamp.

If the action is non-trivial (multiple tasks created from one capture, refinement that produced ADRs, batch promotion), one entry per "thing the user asked for" is enough — don't prepend five entries for a single conversation turn.

## Committing

Each action — CAPTURE, REFINE, PROMOTE, DISMISS, CONSOLIDATE — commits its own markdown at the end of the action, so the working tree is clean afterward, via the **`scoped-commit`** helper (`lib/scoped-commit.mjs`'s `runScopedCommit(cwd, paths, message)`), not a hand-composed `git add` + `git commit`. Commit doctrine (scoped add, never `-A` / `.` / a glob, the `[<task-id>]` trailer, message convention per action) lives in `references/commit-doctrine.md` (ADR-0026) — `scoped-commit` now *enforces* the never-`-A`/`.`/glob half of that doctrine (`{ok:false, code:'invalid-path'}`) rather than leaving it prose-only. `modeling` sometimes runs concurrently with a `work` session and with `quick-capture`, so the scoped-add rule is load-bearing here, not a style choice: each action passes an explicit, enumerated list of only the `.md` files it touched — the task file(s) it wrote or moved, the BC `INDEX.md`(es), `protocol.md`, and any ADR / vision / context-map it produced. CONSOLIDATE's scope is narrower than the rest: only the rewritten BC `README.md` and `protocol.md` — never a task file, never `INDEX.md` (a README rewrite touches no task's lifecycle).

`scoped-commit` retries `git add` and `git commit` independently, with a bounded backoff, when either step collides with a sibling session's own `.git/index.lock` — the git-side half of this task's concurrency fix (agentic-workflow-pt0gy), alongside the lifecycle lock that already serializes `capture`/`promote`/`dismiss`/`log`/`index-add` themselves. On `{ok:false, code:'git-index-lock-exhausted'}` (a sibling held the git lock for the whole retry window), tell the builder the commit didn't land and offer to retry — never delete `.git/index.lock` by hand; a live sibling may still hold it. Runnable through the same env-free homedir→cache→semver-max bootstrap already used above, targeting `lib/scoped-commit.mjs`'s `runScopedCommit` instead of the task-lifecycle CLI's `main`:

```
node -e "const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');const sv=/^(\d+)\.(\d+)\.(\d+)$/;const c=p.join(os.homedir(),'.claude','plugins','cache','agentheim','agentheim');const cand=[p.join(process.cwd(),'lib','scoped-commit.mjs')];let vs=[];try{vs=fs.readdirSync(c).filter(n=>sv.test(n)).sort((a,b)=>{const A=a.match(sv),B=b.match(sv);for(let i=1;i<4;i++){const d=+B[i]-+A[i];if(d)return d}return 0})}catch{}for(const v of vs)cand.push(p.join(c,v,'lib','scoped-commit.mjs'));const r=cand.find(fs.existsSync);if(!r){console.error('no scoped-commit module found under '+c+' (is the plugin installed?)');process.exit(1)}import(u.pathToFileURL(r).href).then(m=>m.runScopedCommit(process.argv[1], JSON.parse(process.argv[2]), process.argv[3])).then(res=>{console.log(JSON.stringify(res));process.exit(res.ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)});" "<repo-root>" '["<path1>","<path2>"]' "<commit message>"
```

`model` is a commit-message `<type>` prefix for modeling's markdown commits — it is **not** a task `type:` (those stay feature/bug/refactor/chore/spike/decision).

Commit **silently** — no confirmation prompt. The user's complaint that drove this doctrine was *leftover uncommitted* markdown; auto-committing the bookkeeping (and only the bookkeeping — never the builder's source code) is the fix, matching `work`. If the project isn't a git repo, skip the commit silently; the working-tree-clean guarantee only applies under git.
