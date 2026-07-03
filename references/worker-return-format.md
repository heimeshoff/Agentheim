---
name: Worker return format
description: The strict RESULT block a worker emits (SUCCESS / BOUNCED / FAILED), including the `TESTS_*` fields the verifier gates on. No ADR of record — this is the agreed text across `agents/worker.md`, `agents/verifier.md`, and `skills/work/SKILL.md`.
---

# Worker return format

A worker returns ONLY one of the following blocks. No prose, no preamble, no "here's what I did" — the conductor (and the verifier) parse this deterministically.

### For successful completion

```
RESULT: SUCCESS
TASK_ID: <task-id>
SUMMARY: <one or two sentences in domain language — what was achieved>
FILES_CHANGED: <integer count>
FILE_LIST: <comma-separated absolute paths of every file created or modified, EXCLUDING the task file that was moved>
BC_README_UPDATED: yes | no
ADRS_WRITTEN: <comma-separated filenames under .agentheim/knowledge/decisions/, or "none">
NEW_BACKLOG_ITEMS: <comma-separated task ids created in a backlog/ during the work, or "none">
TESTS_ADDED: <integer count of new tests written for this task>
TESTS_PASSING: yes | no
TDD_SKIPPED: <reason from the legitimate-skip categories, or "no" if TDD was followed>
CONCEPT_CANDIDATE: <concept-name> — converging on N artifacts (<comma-separated ids>) | none
```

`CONCEPT_CANDIDATE` is for opt-in concept page hints (see `references/concept-template.md`). Use it when, mid-task, the worker noticed that 3+ ADRs / research reports / done tasks in the BC converge on a single concept that doesn't yet have a synthesis page in `contexts/<bc>/concepts/`. The worker never creates the page — the user decides. If no convergence was noticed, `CONCEPT_CANDIDATE: none`.

If `TESTS_PASSING: no`, the worker must **not** return SUCCESS. That's either a FAIL (couldn't get tests green) or a BOUNCE (the task as specified can't be satisfied). Returning SUCCESS with failing tests is a protocol violation the verifier catches (see "No protocol, index, or git tampering" / test-execution checks in `agents/verifier.md`).

### For a bounce (task was under-refined)

```
RESULT: BOUNCED
TASK_ID: <task-id>
REASON: <one or two sentences on what was missing that prevented proceeding>
```

### For a failure (something broke that could not be recovered from)

```
RESULT: FAILED
TASK_ID: <task-id>
ERROR: <where it went wrong and why, one or two sentences>
```

## Why the verifier depends on this

The verifier's test-execution check ("If `TESTS_ADDED > 0` in the worker's return, run the project's test suite") and the protocol task-completion entry's "Tests added" field both draw their only source from the `TESTS_ADDED` / `TESTS_PASSING` / `TDD_SKIPPED` fields above. Any site that restates this block must restate it **exactly** — a stale or partial copy silently disables the verifier's trigger (this drifted once; see `agentic-workflow-f7k2d`). Prefer pointing here over restating.
