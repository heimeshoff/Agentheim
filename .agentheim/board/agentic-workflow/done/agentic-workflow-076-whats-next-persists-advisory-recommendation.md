---
id: agentic-workflow-076
title: What's next persists its recommendation as a single-latest advisory artifact (advisory write)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
depends_on: []
blocks: [agentic-workflow-073]
tags: [whats-next, skill, advisory-write]
related_adrs: [0027, 0017]
related_research: [work-session-presence-lock-2026-06-15, work-terminal-completion-signal-2026-06-15]
prior_art: [agentic-workflow-069]
---

## Why
The `whats-next` recommendation evaporates with the terminal it ran in — you can't glance at
it later, and the dashboard can't show it. For the recommendation to survive into the next
session (and feed the dashboard panel in **agentic-workflow-073**), the skill must persist it
to disk. ADR-0027 establishes that this is an **advisory write** — an opinion *about* the
state, not a *change to* it — distinct from a lifecycle write, so it does **not** re-open
ADR-0017 or the skill's read-only-over-lifecycle stance.

This is the **skill half** and the foundation: aw-073 (the dashboard render) depends on the
artifact this task produces. It has **no** frontend dependency and ships/commits independently.

## What
At the end of its run — after it prints its prose answer — the `whats-next` skill writes its
recommendation to **one** file, `.agentheim/state/whats-next.md`, per ADR-0027:

- ordinary frontmattered markdown: a `generated` ISO-8601 timestamp + three sections
  (**where things stand** / **recommended move (+ why)** / **next** — the same shape the
  skill already speaks in prose), so the dashboard renders it through its existing
  `withFrontmatterSection` + `Markdown` path with no new render code;
- **single-latest**: overwritten each run, never appended (it is not a log — history lives in
  `git`);
- under a new `.agentheim/state/` directory (sibling of `knowledge/` and `contexts/`), the home
  for advisory, machine-written, overwritten signals — **git-ignored** (transient working
  state, not versioned knowledge).

The skill stays read-only **over lifecycle**: it still never moves a task, promotes, commits,
or edits the protocol. It gains **only** this one advisory write and performs **no** git action.

## Acceptance criteria
- [x] Running the `whats-next` skill writes `.agentheim/state/whats-next.md` with frontmatter
      carrying a `generated` ISO-8601 timestamp and three markdown sections (where things stand
      / recommended move / next), **overwriting** any prior file (single-latest, never appended).
- [x] The skill writes **no other file**: no `contexts/` move, no `INDEX.md` / `protocol.md`
      edit, no ADR-backlink change, **no commit, no git action** — its read-only-over-lifecycle
      stance is otherwise unchanged (ADR-0027 §4).
- [x] `.agentheim/state/` is added to `.gitignore`, so the advisory artifact never enters
      version history.
- [x] `skills/whats-next/SKILL.md` gains a final step ("Persist the recommendation — advisory
      write") describing the write, and its read-only paragraph gains one carve-out sentence
      naming the single advisory write and pointing at ADR-0027.
- [x] When the skill has nothing meaningful to recommend (e.g. missing `vision.md` → it
      recommends `brainstorm`), it still writes a coherent artifact reflecting that answer —
      the file shape is always valid for the dashboard to read.

## Notes
Refined via `/agentheim:modeling refine agentic-workflow-073` on 2026-06-17; this task is the
skill half split out from that capture (the dashboard half is aw-073). **ADR-0027's artifact
shape is the frozen interface** between the two halves — keep the path, the `generated`
frontmatter key, and the three-section body exactly as specified so aw-073's reader doesn't
drift.

- The artifact path / shape / git-ignore decisions all live in **ADR-0027** (`state/` sibling,
  `/api/doc`-readable body, six guard rails). Read it before implementing.
- The "skill writes an on-disk signal, dashboard reasons about its freshness" pattern is the
  one the `work-session-presence-lock` / `work-terminal-completion-signal` research already
  worked through — the `generated` timestamp is the freshness cue the dashboard's staleness
  label (aw-073) keys off.
- No styleguide gate (no frontend). Ready to work.
- **Numbering note:** originally drafted as aw-074/075; two concurrent captures took those
  numbers mid-refine, so this skill task is aw-076 (IDs are never reused).

Prior art: aw-069 (the topbar button that fires this skill).

## Outcome
Doctrine + git-ignore change implementing ADR-0027's advisory-write contract for the `whats-next`
skill. No runnable assertions (documentation/skill-doctrine + `.gitignore`), so TDD does not apply.

- **`skills/whats-next/SKILL.md`** — gained a final **Step 4 — Persist the recommendation (advisory
  write)** that instructs a skill run to write its recommendation to the single file
  `.agentheim/state/whats-next.md` (creating `state/` if absent), with the frozen interface kept
  exactly: frontmatter `generated` ISO-8601 timestamp + three sections (*Where things stand* /
  *Recommended move* / *Next*), single-latest/overwritten-never-appended, a shape template, and the
  empty-vision/empty-board case still writing a coherent three-section artifact. The opening read-only
  paragraph gained one carve-out sentence naming the single advisory write and pointing at ADR-0027,
  and reaffirming the skill runs no `git` action and writes no other file.
- **`.gitignore`** — added `.agentheim/state/` (with an ADR-0027 comment) so the advisory artifact
  never enters version history.
- **agentic-workflow BC README** — added an advisory-write note to the `whats-next` topbar entry,
  introducing the *advisory write* vs *lifecycle write* domain language, the `.agentheim/state/`
  third top-level write location, and the path/shape, scoped to ADR-0027.

The artifact `.agentheim/state/whats-next.md` is **not** created by this task — it is written by the
skill at runtime. This task only authors the doctrine and git-ignores the directory. aw-073 (the
dashboard render) reads the artifact this doctrine produces; the frozen interface is preserved so its
reader does not drift. No new ADR (ADR-0027 already governs).
