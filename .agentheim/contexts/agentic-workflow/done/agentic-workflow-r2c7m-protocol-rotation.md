---
id: agentic-workflow-r2c7m
title: Protocol rotation — cap protocol.md and roll to monthly files
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: [agentic-workflow-k5n8f]
blocks: [agentic-workflow-c8j3w]
tags: [harness-audit, protocol, observability, concurrency]
related_adrs: ["0039"]
related_research: []
prior_art: []
---

## Why

`protocol.md` is a good diary but it's prose, prepend-only, ~5.7k lines,
unbounded — and every skill races to prepend at line 4. Concurrent sessions are
explicitly supported; this file is the collision point the scoped-add rule
doesn't cover. (Harness audit 2026-07-02, observability gap.)

Unlike its sibling [[agentic-workflow-c8j3w]] (INDEX done-list rotation), the
protocol has **no reachability constraint**: every reader — `work`,
`modeling`, `whats-next` — opens only the *first ~80–120 lines* for "recent
activity" and nothing does prior-art or keyword lookup against it. So rolling
older entries out of the live file is **lossless for every reader**. That makes
this the simpler of the two rotations, and the one whose archive convention the
other two ([[agentic-workflow-c8j3w]], [[agentic-workflow-w7q2m]]) reuse.

## What

Cap the live `protocol.md` and roll older entries, **verbatim**, to dated
monthly files under `knowledge/protocol/`. Refinement settled the four open
questions; the recommended defaults below are **confirmed 2026-07-03** under the
builder's autonomous-refinement authorization (each remains a one-line change if
work surfaces a reason to flip it):

1. **Mechanism — a k5n8f-family script.** Rotation is a deterministic step in
   the [[agentic-workflow-k5n8f]] lifecycle-script family, not skill prose or
   hand-edited surgery. `depends_on: k5n8f` because (a) k5n8f resolves the
   cross-project plugin-script path resolution any shipped script needs (the
   `$CLAUDE_PLUGIN_ROOT` / home-cache resolver pattern, infrastructure-010),
   (b) it mirrors c8j3w's sibling decision (rotation as a k5n8f-family script),
   and (c) k5n8f's **atomic prepend** is the actual fix for the line-4
   concurrency collision in the Why — rotation alone only *shrinks* the window,
   it doesn't close it.

2. **Trigger — cap-triggered, month-named.** The live file is capped at **N ≈
   1,000 lines** (≈10× the ~100-line read window every reader uses). When it
   exceeds the cap, whole **older months** roll out verbatim into
   `knowledge/protocol/YYYY-MM.md` (named by the month of the entries they
   hold), youngest-month-first inside each archive file to match the live file's
   newest-on-top order. This reconciles the title's "monthly files" with the
   original AC's "under a cap": monthly is the **archive granularity**, the cap
   is the **live-file guarantee**.

3. **A rotation-doctrine ADR is written during work.** It records the
   convention — verbatim move (never rewrite/summarize), dated monthly archive
   files, the live cap, newest-on-top ordering preserved, and the pointer — so
   [[agentic-workflow-c8j3w]] and [[agentic-workflow-w7q2m]] cite a stable
   decision of record instead of prose scattered across three tasks. (c8j3w
   already assumes this: "applies r2c7m's rotation decision.")

4. **Machine-readable `runs/` JSONL is out of scope.** A structured event stream
   is a live-observability concern — it belongs with
   [[agentic-workflow-m9w5c]], not this verbatim-text rotation.

## Acceptance criteria

- [x] `protocol.md` stays under the stated cap (N ≈ 1,000 lines); entries beyond it are moved **verbatim** to `knowledge/protocol/YYYY-MM.md` monthly files, never rewritten or summarized.
- [x] Archive files preserve the live file's **newest-on-top** ordering, so a skill reading a rolled month sees the same shape as the live file.
- [x] Skills' "read the first ~80–120 lines" pattern still yields recent activity unchanged — the most-recent entries always stay in the live file.
- [x] Rotation is **deterministic** — a k5n8f-family script run the same way every time, not ad-hoc summarization or hand-edited marker surgery.
- [x] A rotation-doctrine ADR is written and the archive convention (verbatim move, monthly dated files, live cap, ordering) is recorded there; the ADR is backlinked into this task's `related_adrs`.
- [x] The indexes/pointers that reference `protocol.md` (`knowledge/index.md` Pointers, per-BC INDEX pointers, and the skills that read it) name the `knowledge/protocol/` rollover location. Skill prose (`work`/`modeling`/`whats-next` SKILL.md) done by this worker; `knowledge/index.md` and per-BC `INDEX.md` pointer edits are conductor-owned (Rule 3) — left as an explicit conductor-apply list in this worker's SUCCESS return.
- [x] Covered by `node --test` alongside the k5n8f lifecycle-script tests (cap boundary, verbatim move, ordering preserved, live-file recency).

## Outcome

Shipped `lib/protocol-rotation.mjs` — a k5n8f-family, git-free, deterministic script.
`parseProtocolEntries(content)` slices each protocol entry's raw text (heading line
through trailing separator) without reformatting, so rotation is a pure relocation,
immune to `\n`/`\r\n` disagreement. `rotateProtocol(rootDir, opts)` caps the live file
at `DEFAULT_CAP_LINES` (1000) and, once exceeded, rolls whole **older** months out
oldest-first to `.agentheim/knowledge/protocol/YYYY-MM.md`, stopping as soon as the
live file is back under the cap or only the current month remains (the current month
is never rolled, however large). A thin `runCli`/`main` wrapper mirrors
`lib/task-lifecycle-cli.mjs`'s testable-CLI shape (`node lib/protocol-rotation.mjs`,
no verb/id — a single idempotent operation). ADR-0039 records the doctrine (verbatim
move, monthly archive granularity, live cap, current-month-never-rolls, newest-on-top
preservation) for `[[agentic-workflow-c8j3w]]` and `[[agentic-workflow-w7q2m]]` to
cite. `skills/work/SKILL.md`, `skills/modeling/SKILL.md`, and
`skills/whats-next/SKILL.md`'s protocol-read prose now name the rollover location;
`work/SKILL.md`'s "Protocol logging" section also gained a short rotation-doctrine
note. 13 new tests in `lib/test/protocol-rotation.test.mjs` (cap boundary — under,
exactly-at, over; verbatim byte-for-byte move; newest-on-top ordering preserved in
the archive; current-month-never-rolls; multi-month oldest-first stop-as-soon-as-fit;
idempotent re-run; missing-file no-op; `runCli` + real-process invocation), full
`lib/test/` suite green (78/78). Two index/pointer edits are conductor-owned per Rule
3 and are listed verbatim in this worker's SUCCESS return for the conductor to apply.

## Notes

Sibling of INDEX rotation ([[agentic-workflow-c8j3w]]) and README consolidation
([[agentic-workflow-w7q2m]]) — the three growth surfaces. r2c7m fixes the
archive convention *first* (c8j3w depends on it precisely to reuse it, not
diverge); c8j3w then **applies** the same cap-and-roll shape to the INDEX
artifact (with the extra reachability constraint the protocol doesn't have), and
w7q2m handles the README's judgment-driven consolidation.

**Standalone-now alternative (if k5n8f slips):** rotation *can* be specified and
shipped independently of k5n8f — a standalone deterministic script — at the cost
of solving cross-project script-path resolution itself and leaving the line-4
prepend collision only narrowed, not closed. If the builder wants this shippable
ahead of k5n8f, drop the `depends_on` and fold the atomic-prepend win back into
k5n8f later. The refinement chose the coupled path for symmetry with c8j3w and
because the collision fix is the point.

Source: harness audit 2026-07-02, observability gap. Refined 2026-07-03.
