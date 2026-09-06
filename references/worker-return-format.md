---
name: Worker return format
description: The strict RESULT block a worker emits (SUCCESS / BOUNCED / FAILED), including the `TESTS_*` fields the verifier gates on and (post agentic-workflow-ghcaj) the four SUCCESS blocks that carry `.agentheim/` bookkeeping. No ADR of record for the pre-ghcaj shape; ADR-ghcaj (amends ADR-0032 §3/§4/§6) records the report-carried redesign below. This is the agreed text across `agents/worker.md`, `agents/verifier.md`, and `skills/work/SKILL.md`.
---

# Worker return format

A worker returns ONLY one of the following blocks. No prose, no preamble, no "here's what I did" — the conductor (and the verifier) parse this deterministically, via `lib/worker-result.mjs`'s `parseWorkerResult`.

**Worker branch carries source and tests only (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6).** A worker never writes under `.agentheim/` in its worktree — not its README, not an ADR, not its own task file, not a backlog item. Everything it would have written travels in the four SUCCESS blocks below as structured data; the conductor materializes all of it on `main`, sequentially, at squash-merge integration (`skills/work/SKILL.md`'s "PASS / SKIP" §(a)–(f)). `BC_README_UPDATED` and `NEW_BACKLOG_ITEMS` are **retired** — a non-empty `README_DELTA` / `BACKLOG_ITEMS` block is the signal now.

### For successful completion

```
RESULT: SUCCESS
TASK_ID: <task-id>
SUMMARY: <one or two sentences in domain language — what was achieved>
FILES_CHANGED: <integer count — source and tests only, EXCLUDING .agentheim/ paths>
FILE_LIST: <comma-separated absolute paths of every SOURCE/TEST file created or modified — never a .agentheim/ path>
ADRS_WRITTEN: <comma-separated provisional filenames named in the ADRS block below, or "none">
TESTS_ADDED: <integer count of new tests written for this task>
TESTS_PASSING: yes | no
TDD_SKIPPED: <reason from the legitimate-skip categories, or "no" if TDD was followed>
CONCEPT_CANDIDATE: <concept-name> — converging on N artifacts (<comma-separated ids>) | none
```

Then, in this exact order, the four fenced blocks below. Each is wrapped in a **four-backtick** fence (` ```` `, not three) whose opening line is the four backticks immediately followed by the block name with no space, and whose closing line is the four backticks alone — four, not three, so the block's OWN content (an ADR quoting a shell command, a README delta `body` embedding a code sample) can freely use ordinary three-backtick fences without ambiguity. An empty block is still present, fenced, with empty (or `[]`) content — never omitted.

````README_DELTA
[
  {
    "document": "README.md",
    "section": "Ubiquitous language",
    "ops": [
      { "op": "append", "body": "- **Term** — a new definition." },
      { "op": "replace", "anchor": "Existing Term", "expected": "- **Existing Term** — the bullet text you read, verbatim, whitespace not required to match exactly.", "body": "- **Existing Term** — the bullet's new full text." }
    ]
  }
]
````

A JSON array of documents (`lib/readme-delta.mjs`'s `applyReadmeDelta` input shape). `document` is `"README.md"` (the default, your BC's README) or `"context-map.md"` (append-only — a worker contradicting an existing cross-context relationship is a strategic-modeling call, not a worker's; use `append` only). Two ops, no more:

- **`append`** — `{op:"append", body}`: a new bullet at the end of the named section's bullet list.
- **`replace`** — `{op:"replace", anchor, body, expected}`: `anchor` is the bullet's bold lead-in truncated at its first `(`, whitespace-collapsed (e.g. `Bounded context` for a bullet reading `- **Bounded context (modeled)** — ...`) — a field separate from `body` so a bullet may rename its own lead-in. `expected` is the OLD bullet text you read (compared whitespace-collapsed, never byte-exact) — an optimistic precondition. If a sibling or the conductor's own earlier write has already changed that bullet by the time your delta applies, the conductor merges both intents onto the bullet rather than clobbering either one (`disposition: "merged"`) — you'll never see this; it's handled entirely on `main`.

There is no `remove`, no `rename-section`, no section creation — deletion and restructuring stay CONSOLIDATE's job (ADR-0041), builder in the loop. A delta naming a section that doesn't exist lands as an `append` into `## Ubiquitous language` rather than being dropped or refused. `[]` when the task changed no ubiquitous language, aggregate, event, command, or invariant.

````ADRS
<!-- ADR: 0099-example-decision.md -->
---
id: ADR-0099
title: Example decision
scope: <bc>
status: accepted
date: <today>
related_tasks: [<task-id>]
related_adrs: [...]
---

# ADR-0099: Example decision

## Context

...

## Decision

...
````

Zero or more full ADR bodies, one per decision, each preceded by its own `<!-- ADR: <provisional-filename> -->` marker. The provisional filename follows ADR-0058's `NNNN-<slug>.md` convention — call `nextAdrNumber(decisionsDir)` **read-only** against your worktree's mirrored `decisions/` dir to pick the `id:` text and the `NNNN` in the filename; this number is **provisional only**, never authoritative — the conductor's `finalizeAdrNumbering` renumbers at squash-merge integration if a sibling already claimed it or your guess overshot. Empty (no markers) when the task made no new decision worth an ADR.

````OUTCOME
## Outcome

<description of what was achieved, pointers to key files>
````

The full `## Outcome` section — heading included — the conductor appends verbatim to your task file on `main` before moving it `doing → done`. This replaces your own edit of that file: **you never write your task file's `## Outcome` yourself and you never move it** — the task file path handed to you is on `main` and is **read-only** to you.

````BACKLOG_ITEMS
<!-- TASK: agentic-workflow-ab3f9-some-follow-up.md -->
---
id: agentic-workflow-ab3f9
title: Some follow-up
status: backlog
type: chore
context: <bc>
created: <today>
...
---

## Why

...
````

Zero or more **full task-file bodies** (frontmatter + sections), one per follow-up discovered mid-work, each preceded by its own `<!-- TASK: <filename> -->` marker. Mint the id per `references/id-grammar.md`; the conductor materializes each body verbatim via `lib/task-lifecycle.mjs`'s `materializeTaskFile` and inserts its INDEX line — you never write the file yourself. This replaces the old id-only `NEW_BACKLOG_ITEMS` field, which was sufficient only because the worker wrote the file itself. Empty (no markers) when you found no follow-ups.

`CONCEPT_CANDIDATE` is for opt-in concept page hints (see `references/concept-template.md`). Use it when, mid-task, the worker noticed that 3+ ADRs / research reports / done tasks in the BC converge on a single concept that doesn't yet have a synthesis page in `contexts/<bc>/concepts/`. The worker never creates the page — the user decides. If no convergence was noticed, `CONCEPT_CANDIDATE: none`.

`TESTS_PASSING` is the runner's own verdict (ADR-0062), not the worker's impression of one — read the test runner's exit status or its structured report (TAP, JUnit XML, `node --test`'s own summary line), never infer `yes` from a test printing its own success message with no runner actually invoked and its exit status checked.

If `TESTS_PASSING: no`, the worker must **not** return SUCCESS. That's either a FAIL (couldn't get tests green) or a BOUNCE (the task as specified can't be satisfied). Returning SUCCESS with failing tests is a protocol violation the verifier catches (see "No protocol, index, or git tampering" / test-execution checks in `agents/verifier.md`).

### For a bounce (task was under-refined)

```
RESULT: BOUNCED
TASK_ID: <task-id>
REASON: <one or two sentences on what was missing that prevented proceeding>
```

No blocks — a BOUNCE reports nothing to materialize. The conductor moves the task file `doing → backlog` and appends `## Worker note` **on `main`**; the worker never touches its own task file for a BOUNCE either.

### For a failure (something broke that could not be recovered from)

```
RESULT: FAILED
TASK_ID: <task-id>
ERROR: <where it went wrong and why, one or two sentences>
```

## Why the verifier depends on this

The verifier's test-execution check ("If `TESTS_ADDED > 0` in the worker's return, run the project's test suite") and the protocol task-completion entry's "Tests added" field both draw their only source from the `TESTS_ADDED` / `TESTS_PASSING` / `TDD_SKIPPED` fields above. Any site that restates this block must restate it **exactly** — a stale or partial copy silently disables the verifier's trigger (this drifted once; see `agentic-workflow-f7k2d`). Prefer pointing here over restating.

Parsing is mechanized, not conductor prose (ADR-0059 mechanize-or-drop): `lib/worker-result.mjs`'s `parseWorkerResult(text)` returns `{result, fields, blocks}` on success, or a structured rejection naming the malformed/truncated block — the one-line fields above were always safely hand-parsed (one line each, no internal structure), but the four blocks carry nested markdown fences and JSON, which a prose parse would get wrong exactly where it matters most.
