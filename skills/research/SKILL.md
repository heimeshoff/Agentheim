---
name: research
description: Use whenever the user or another skill needs external information gathered from the web — state of the art on a topic, comparison of approaches, documentation for a library, domain knowledge from outside the codebase. Triggers on phrases like "research X", "find out about", "what's the state of the art for", "look up how others do", "compare options for", "gather info on", and also triggers internally when brainstorm or model hits an "I don't know enough" wall. Produces a research report in .agentheim/knowledge/research/ that can be referenced from tasks, ADRs, and modeling sessions. Every report passes through a fresh-context `research-reviewer` agent (see `skills/research-review/SKILL.md`) that re-verifies its checkable claims against primary sources before the report is citable.
---

# Research — Web Investigation with Written Output

The `research` skill is how external knowledge enters the workflow. It runs WebFetch and WebSearch, synthesizes the findings, and produces a markdown report that other skills can cite.

## Scope

Research is about understanding, not decision-making. Produce a report; do not produce an ADR. Decisions come later — in `modeling` or `work` — and they cite research reports.

## Inputs

Accept one of:
- A concrete question ("how do people implement optimistic locking in event-sourced systems?")
- A topic area ("rate limiting strategies")
- A library/product name ("Temporal.io — what does it do and who uses it?")

If the request is vague ("research auth"), narrow it once with the user before running.

## Running

Delegate to the `agentheim:researcher` agent. The researcher will:
1. Start with WebSearch for a breadth pass
2. Follow up with WebFetch on the most promising 3–7 sources
3. If multiple independent angles exist, run them in parallel (multiple WebSearch/WebFetch tool calls in the same message)
4. Cross-check claims across sources — single-source claims get flagged as such
5. Write the report

When the researcher returns, the report is **not yet citable.** Every report goes through the **review gate** (below) before any task, ADR, or modeling session is allowed to cite it. Keep this gate inside the research skill — at the researcher-spawn boundary — so every caller (`brainstorm`, `model`, `work` all trigger research internally) inherits it without each one re-implementing the check.

## Report format

Files land at `.agentheim/knowledge/research/<slug>-<date>.md`:

```markdown
---
topic: [one-line topic]
date: 2026-04-24
requested_by: [brainstorm | model | work | user]
related_tasks: []
---

# Research: [Topic]

## Question
What we wanted to know, in one or two sentences.

## Summary
3–6 bullet answers. Lead with what's decision-relevant, not with what's novel.

## Findings
Subsections as needed. Each claim cites its source(s). Disagreements
between sources are named, not hidden.

## Sources
Numbered list with URL, title, and one-line relevance note per source.

## Unverified claims
Only present when the review gate hit its cap with claims no primary
source could settle. Each is also marked inline in Findings as
`⚠️ UNVERIFIED`. (Omit this section entirely when there are none.)

## Open questions
Things we wanted to answer and couldn't, or that would need primary research.
```

A checkable claim that survived the gate without a primary source is marked **inline** where it appears — `… the price is $0.40 / M tokens ⚠️ UNVERIFIED (no public pricing page found)` — and collected in the `## Unverified claims` subsection. This is the terminal state for the genuinely-uncheckable: labeled, never silently asserted.

## Review gate (post-write, pre-cite)

A report the researcher returns is not yet citable. Every report goes through the `research-review` gate — a separate `research-reviewer` agent re-verifies the report's decision-critical checkable claims against primary sources, with fresh context and its own web access. This is the structural defense against plausible-but-wrong *facts*, mirroring how `work` gates plausible-but-wrong *code* through the `verifier`.

The full doctrine lives in `skills/research-review/SKILL.md`. The operational integration here:

### When to skip the gate

Skip (ship immediately) only when:

- The user invoked research with `--no-verify` or said "skip review this run" — opt-out is per-run, never persistent.
- The report makes no checkable claims at all (pure synthesis of the user's own context) — rare; when unsure, run the gate.

Otherwise, gate.

### Gate dispatch and the loop

1. Track the iteration count for this report (start at 1).
2. Spawn a `research-reviewer` subagent via Agent with `subagent_type: "agentheim:research-reviewer"` using the **Research-Reviewer Prompt Template** below. Hand it only the report path, the original question, and the iteration number — never the researcher's reasoning trail. (Per-agent model routing is pinned by ADR-0031: `researcher` runs `sonnet`, `research-reviewer` runs `opus` — the two never share a tier, decorrelating shared blind spots the way `research-review`'s doctrine calls for. The routing lives in each agent's own frontmatter `model:` field, not here. See `skills/research-review/SKILL.md`, ADR-0031.)
3. Wait for the verdict and handle it:

**`VERDICT: PASS`** → the report is citable. Proceed to indexing and protocol logging below.

**`VERDICT: SKIP`** → ship as on PASS; note "review skipped: no checkable claims" in the protocol entry.

**`VERDICT: FAIL`, iteration 1 or 2, `ITERATION_HINT: likely-fixable`** → re-dispatch the **`agentheim:researcher`** (not the reviewer) with the reviewer's `CHALLENGED_CLAIMS` block verbatim. Instruct it to re-verify each challenged claim against the named `PRIMARY_SOURCE`, correct what's wrong, and re-run the gate (`iteration = N + 1`). Cap at **3 iterations** — mirror `work`'s verifier cap.

**`VERDICT: FAIL`, iteration 3 (or any iteration with `ITERATION_HINT: genuinely-unverifiable`)** → stop looping. Re-dispatch the `agentheim:researcher` one final time to **label, not block**: for each surviving challenged claim, mark it inline `⚠️ UNVERIFIED` (with a one-line reason) and add it to the report's `## Unverified claims` subsection. Then ship. Surviving unverified claims are never silently passed and never infinitely looped.

### Research-Reviewer Prompt Template

Spawn each reviewer with `Agent(subagent_type: "agentheim:research-reviewer", prompt: <the-below>)`. Fill the placeholders.

```
You are a research-reviewer agent auditing one report with fresh context and your own web access. You have no exposure to the researcher's reasoning — only the report and the original question. Re-verify; do not proofread.

## Your inputs
Report (read-only — do NOT edit it): <ABSOLUTE-PATH>
Original question the research was meant to answer: <QUESTION>
Iteration: <N> of max 3

## Your job
Follow the checks in `agents/research-reviewer.md`, in order. Inventory the report's checkable claims, then independently re-verify the decision-critical ones against PRIMARY sources using your own WebSearch/WebFetch — do not trust the report's adjacent citations. Return exactly one verdict block — VERDICT: PASS, VERDICT: FAIL, or VERDICT: SKIP — per the strict formats in your agent definition.

Do not use Write or Edit — you are read-only on the report. Re-verify with the web; do not fix the report.
```

When the research skill spawned multiple researchers in parallel for independent topics, gate each report with its own reviewer; launch the reviewers as parallel Agent calls in one message. Each reviewer sees only its own report.

## Linking back

When a research report influences a task or decision:
- The task's Notes section gets a link to the report
- The task's `related_research` frontmatter gets the report's slug (so workers pre-load it)
- The ADR (if one results) gets the report in its references and its `related_research` frontmatter
- The report's frontmatter `related_tasks` gets updated

This bidirectional linking is how knowledge stays findable.

## Updating indexes

After the researcher writes the report, register it via the mechanized **`index-add`** verb (agentic-workflow-fn59c, ADR-0075) — never a hand-edit — so the report is discoverable. Index template lives at `references/index-template.md`. The report's `<slug>-<date>` (the filename's identifying portion, e.g. `auth-tokens-2026-05-13`) is the `id` `index-add` dedupes on:

- If the report's `related_tasks` are all in **one BC**, or the topic is clearly scoped to one BC → `node -e "<the same env-free bootstrap modeling/SKILL.md's PROMOTE flow uses, targeting lib/task-lifecycle-cli.mjs>" index-add '{"bc":"<bc-name>","section":"research-local","id":"<slug>-<date>","line":"<the composed one-line entry>"}'`.
- If the report spans multiple BCs, has no tasks yet, or is project-level → the same call with `{"bc":null,"section":"research-global",...}`.

It returns `{ok:true, changed:[indexPath], skipped, verb:'index-add', id, message:null}` — fold `changed` into this run's commit (see "Committing" below) — or a structured rejection: `index-missing` (the target `INDEX.md` doesn't exist yet — `index-add` never backfills a fresh template over what may be a live index; build it from `references/index-template.md` by hand first, then re-run) or `duplicate-id-conflict` (this report already has a *different* line in the block). A byte-identical re-run is a silent no-op (`skipped:true`).

A later task or ADR that adopts this report should update the inserted line's BC scope if it migrates from global to BC-local (rare) — this stays a hand-edit, since `index-add` only ever inserts, it never rewrites an existing line.

## Protocol logging

After the report clears the review gate, compose the entry's `title`/`body` yourself and prepend it via the **`log`** mechanics verb (agentic-workflow-fn59c) — never a hand file edit; it calls `readProtocolOrDefault` internally, so nothing here creates `protocol.md` by hand even if it's missing:

```
node -e "<the same env-free bootstrap modeling/SKILL.md's PROMOTE flow uses, targeting lib/task-lifecycle-cli.mjs>" log '{"title":"Research: [topic]","body":"**Type:** Research\n**Requested by:** brainstorm | model | work | user\n**Report:** knowledge/research/<slug>-<date>.md\n**Review:** PASS (iteration N) | labeled-unverified (iteration 3) | skipped (no checkable claims)\n**Summary:** [2-3 bullet findings]"}'
```

It returns `{changed:[protocolPath], message:null, verb:'log', timestamp}` — fold `protocolPath` into this run's commit (see "Committing" below). Renders the exact shape below; kept as the human-readable contract, not a template to compose by hand:

```markdown
## YYYY-MM-DD HH:MM -- Research: [topic]

**Type:** Research
**Requested by:** brainstorm | model | work | user
**Report:** knowledge/research/<slug>-<date>.md
**Review:** PASS (iteration N) | labeled-unverified (iteration 3) | skipped (no checkable claims)
**Summary:** [2-3 bullet findings]

---
```

## Committing

Research commits its own markdown once a report clears the review gate (PASS, SKIP, or the
iteration-3 labeled-unverified outcome), so the working tree is clean after a research run,
via the **`scoped-commit`** helper (`lib/scoped-commit.mjs`'s `runScopedCommit(cwd, paths,
message)`), not a hand-composed `git add` + `git commit` (agentic-workflow-fn59c). Commit
doctrine (scoped add, never `-A` / `.` / a glob, the message convention) lives in
`references/commit-doctrine.md` (ADR-0026) — `scoped-commit` *enforces* the never-`-A`/`.`/
glob half of that doctrine (`{ok:false, code:'invalid-path'}`) rather than leaving it
prose-only. Research can run while a `work`, `modeling`, or `quick-capture` session has its
own in-flight files on the working tree, so the scoped-add rule is load-bearing here, not a
style choice — and `scoped-commit` retries `add`/`commit` independently, with a bounded
backoff, on a sibling session's own `.git/index.lock` (agentic-workflow-pt0gy) — never delete
`.git/index.lock` by hand; a live sibling may still hold it. After the indexing and protocol
logging steps above:

1. Call `scoped-commit` with an **explicit, enumerated** list of *only* this run's artifacts:
   the new report file (`.agentheim/knowledge/research/<slug>-<date>.md`), the `INDEX.md`
   `index-add` named in its `changed` (the BC-local `contexts/<bc>/INDEX.md`, or the global
   `.agentheim/knowledge/index.md`), and `.agentheim/knowledge/protocol.md` (from `log`'s
   `changed`). If a citing task/ADR's `related_research` or Notes were updated in the same
   pass, include that task/ADR file too. Never `-A` / `.` — `scoped-commit` refuses either
   outright.
2. Commit silently (no confirmation prompt, matching the other markdown-producing skills) with:
   ```
   chore(<bc-or-global>): research <slug>
   ```
   Use the BC short-code when the report indexed BC-local; when it indexed globally, drop
   the scope token entirely (`chore: research <slug>`), matching the same no-token convention
   used by `work`'s own multi-BC shapes. Runnable through the same env-free
   homedir→cache→semver-max bootstrap used above, targeting `lib/scoped-commit.mjs`'s
   `runScopedCommit` instead of the task-lifecycle CLI's `main` — see `modeling/SKILL.md`'s
   "Committing" section for the full one-liner.
3. When multiple parallel researchers each finish and clear their own gate independently,
   commit each report separately with its own scoped `scoped-commit` call — don't batch
   several reports into one commit.

If the project isn't a git repo, skip the commit silently — write the files as before and
report; the working-tree-clean guarantee only applies under git.

## Parallelism

Research is naturally parallelizable. If the user asks for research on multiple distinct topics, spawn multiple `agentheim:researcher` agents rather than serializing. Each writes its own report.

**Default cap: 3 concurrent researchers**, matching `work`'s `MAX_PARALLEL` default and for the same reason — review load. Each researcher's report goes through its own `research-reviewer` gate before it ships (see "Review gate" above), so the binding constraint isn't the research itself (which parallelizes cleanly) but how many independent review verdicts the dispatching session can absorb and act on at once. If more than 3 distinct topics are requested, run the first 3 concurrently and queue the rest for the next wave rather than fanning out further. This is a default, not a hard ceiling: if the user explicitly asks for more topics in parallel ("research all 5 of these at once"), honor that — the cap only applies absent an explicit ask, exactly like `MAX_PARALLEL` in `skills/work/SKILL.md`. If the cap holds a topic back to a later wave, say so to the user when you report the wave's results — silent truncation of the requested topic list is not acceptable, matching `work`'s "never truncate silently" rule for its own batch cap.

## What NOT to do

- Do not fetch URLs the user did not authorize and that you don't have independent reason to trust
- Do not paraphrase without source attribution — readers need to trace claims
- Do not write advocacy — the report should leave the decision to the reader
- Do not let research scope-creep into a dissertation. Stop when the question is answered to decision-adequate depth.
