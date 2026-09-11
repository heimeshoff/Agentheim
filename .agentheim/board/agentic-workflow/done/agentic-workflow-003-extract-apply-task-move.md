---
id: agentic-workflow-003
title: Extract applyTaskMove — one shared Task-lifecycle mover for skills and the dashboard
status: done
type: refactor
context: agentic-workflow
created: 2026-06-05
completed: 2026-06-06
commit: 2378b0b
depends_on: [agentic-workflow-002]
blocks: [agentic-workflow-001, agentic-workflow-009]
tags: [task-lifecycle, invariants, refactor, shared-logic, dashboard]
related_adrs: [ADR-0001, ADR-0007]
related_research: []
prior_art: []
---

## Why

The dashboard write path (infrastructure-001's `POST /api/task/move`) and the skills
(`modeling` promote, `work` claim/complete) both move tasks between lifecycle folders. If
each implements its own move, the UI and the skills will drift on what a valid move is the
moment either side changes. agentic-workflow-002 decided there must be **one shared
operation**; this task extracts it. Until it exists, the dashboard cannot safely write —
so it is a prerequisite for agentic-workflow-001, not an optional cleanup.

This is a `refactor`: the move logic already happens (the skills do it in prose today); the
work is to make it a single callable unit that enforces the Task aggregate's invariants in
exactly one place.

## What

Extract a single operation — `applyTaskMove(rootDir, id, from, to)` — that is the **only**
writer of task-lifecycle state, called by both the skills' worker and the dashboard write
endpoint. Per agentic-workflow-002 it must:

1. **Validate the transition** against the legal-move policy (v1 UI: `backlog→todo` only;
   skills may use the fuller set), including `depends_on` guards (e.g. the frontend /
   styleguide gate — a frontend task may not promote ahead of its dependencies).
2. **Enforce *status matches folder*** — a move is the folder rename **and** the frontmatter
   `status` rewrite, performed together; never one without the other.
3. **Perform the move** atomically (rename within the same filesystem).
4. **Return** success with the new state, or a **structured rejection** carrying a domain
   reason string (so the transport can translate it to a 4xx, and skills can surface it).

It must also accept an **optimistic precondition** (expected `from` folder + the file's
mtime) and reject — without mutating anything — if disk disagrees, so the concurrency story
in agentic-workflow-002 has one enforcement point.

## Acceptance criteria

- [ ] A single `applyTaskMove(rootDir, id, from, to)` operation exists as a callable unit
      (not inline skill prose) and is the only code path that moves a task between lifecycle
      folders.
- [ ] It updates folder **and** frontmatter `status` atomically; a partial move (folder
      moved but status stale, or vice versa) is impossible.
- [ ] It rejects illegal transitions per agentic-workflow-002's policy with a structured
      domain reason, and enforces `depends_on` guards (a frontend task cannot promote ahead
      of the styleguide).
- [ ] It honors an optimistic precondition (expected `from` + mtime) and makes no
      filesystem change when the precondition fails.
- [ ] Both call sites use it: the skills' task-move path and infrastructure-001's
      `POST /api/task/move` (the latter wired when that task is built).
- [ ] Tests cover: a legal `backlog→todo` promote, a rejected illegal move, a blocked
      promote (unmet `depends_on`), and a stale-precondition rejection.

## Notes

- Depends on agentic-workflow-002 because that decision defines the legal-move policy and
  invariants this operation enforces. Do not start until 002's ADR is settled.
- Keep it pure-ish: take `rootDir` explicitly (no ambient cwd), so both the skill context
  and the dashboard runtime (which discovers its own root) can call it identically.
- This is where the index/protocol side effects of a move are decided too: a promote that
  the dashboard performs should leave the same INDEX/count updates a skill-driven promote
  does, or explicitly defer index maintenance to the skills — settle this with the worker
  and record it (it may warrant a line in the ADR).
  **Settled in ADR-0007:** `applyTaskMove` owns ONLY the move + status rewrite + precondition;
  INDEX/protocol side-effects stay with the skills/orchestrator. A dashboard promote does not
  touch indexes in v1 (the board rebuilds from disk; the index reconciles on the next skill
  pass).

## Outcome

Extracted the single Task-lifecycle mover as **`lib/task-lifecycle.mjs`** — BC-owned
agentic-workflow domain logic (node stdlib only, ESM `.mjs`), placed at repo root in a new
`lib/` so both a skill context and the dashboard runtime (agentic-workflow-009) import it
identically without it being buried in transport. The transport's routing was **not** touched
(that wiring is agentic-workflow-009; infrastructure-003 is concurrently editing
`dashboard/server.mjs`).

`applyTaskMove(rootDir, id, from, to, options)`:
- Validates `from→to` against the legal-move policy. `options.policy` is `'ui'` (default —
  Promote `backlog→todo` only, per ADR-0001's v1 surface) or `'skill'` (the fuller forward
  set: Promote, Claim, Complete). Backward moves and skips are illegal under both.
- Enforces the `depends_on` frontend gate on Promote: a task with an unmet dependency (the
  dependency file not yet in any BC's `done/`) is rejected `blocked-dependency`. The
  styleguide gate is enforced here.
- Enforces *status matches folder* — rewrites frontmatter `status` to the destination then
  renames; a partial move (folder moved but status stale, or vice versa) is impossible.
- Honors the optimistic precondition: rejects `stale-precondition` (no filesystem change) if
  the file is not actually in `from`, or if `options.expectedMtimeMs` disagrees with disk.
- Returns `{ ok: true, state }` or a structured rejection `{ ok: false, code, reason }`
  (`code` ∈ illegal-move | blocked-dependency | stale-precondition | not-found), so transport
  can map to 4xx and skills can surface the reason.

Recorded **ADR-0007** to settle the side-effect boundary: the mover owns only the move;
INDEX/protocol maintenance stays with the skills/orchestrator (dashboard index maintenance is
out of scope for v1).

11 tests via `node --test` cover: legal `backlog→todo` promote (move + status rewrite),
rejected illegal `doing→done`, blocked promote on unmet `depends_on` (and the satisfied case),
stale-precondition by wrong `from` and by wrong mtime (and the matching-mtime success),
not-found, and both directions of the `policy` switch. All green; the existing 33 dashboard
tests still pass.

Note: the BC README's `applyTaskMove` entry now lists the as-built signature, policy options,
rejection codes, and side-effect boundary. The skills' prose move paths (`modeling`/`work`)
should adopt a call to this operation when next edited — that adoption is left to those skill
files' own maintenance and is not a code change in this BC's `lib/`.

Key files:
- `lib/task-lifecycle.mjs` — the operation.
- `lib/test/task-lifecycle.test.mjs` — the tests.
- `.agentheim/knowledge/decisions/0007-task-move-side-effect-boundary.md` — ADR-0007.
- `.agentheim/contexts/agentic-workflow/README.md` — updated ubiquitous-language entry.
