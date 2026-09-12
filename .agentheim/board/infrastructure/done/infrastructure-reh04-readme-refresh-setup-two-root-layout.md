---
id: infrastructure-reh04
title: Refresh the repo README so `/setup` is part of the install flow, the state-layout tree and every quoted path reflect the two-root layout (ADR-0078), and the skills table, repo layout, and status reflect what shipped since the June restructure (0.8.8 → 0.9.4) — concise, no walkthrough
status: done
type: chore
context: infrastructure
created: 2026-09-13
completed:
depends_on: []
blocks: []
tags: [readme, docs, setup, two-root-layout, onboarding]
related_adrs: [0078, 0079, 0081]
related_research: []
prior_art: [infrastructure-x56qm, infrastructure-js62b]
---

## Why

The top-level `README.md` is the first thing a consumer reads and the only place the
install story is told end to end. Its last real restructure was 2026-06-19 (0.8.8); the
edits since (bridge upgrade note, one-paragraph `/setup` mention inside the Dashboard
section, 09-12) were patches on that skeleton. Meanwhile 0.8.9 → 0.9.4 changed things the
README states outright and now gets wrong:

- **`/setup` exists and is the primary per-machine step** (ADR-0079), but the Install
  section still ends at `/reload-plugins` — a new consumer only meets `/setup` if they
  scroll into the Dashboard section.
- **The `.agentheim/` tree is the retired single-root layout.** The "Project state layout"
  block shows `vision.md` at the root, `contexts/<bc>/backlog|todo|doing|done`, and
  `knowledge/protocol.md`. Since ADR-0078 it is `knowledge/` (vision, context map,
  `contexts/<bc>/README.md` + `INDEX.md`, decisions, research, index) and `board/` (per-BC
  `backlog/ todo/ doing/ done/` + `INDEX.md`, `protocol.md`, rolled `protocol/YYYY-MM.md`,
  `done-archive/`), plus advisory `state/`. The skills table repeats the stale paths
  (`.agentheim/vision.md`, `contexts/<bc>/backlog|todo/`).
- **The skills list is stale.** `capture` was renamed `quick-capture`; `inquire` and
  `whats-next` exist and are not in the table; "five skills" is no longer the count.
- **The repo layout and status are stale.** `lib/` (the mechanized lifecycle CLI), the
  committed bridge `.vsix` under `vscode-extension/`, and `evals/` vs. `references/` are
  misdescribed or missing; "Status" still reads "Iteration 1 validated (2026-04-24)".
- **Nothing tells a consumer what changed lately.** The CHANGELOG does, but the README
  has no pointer to it and no short "recent highlights" for a returning reader.

## What

Rewrite `README.md` in place — same voice, same overall section order, shorter where it
can be — so it is true for 0.9.4. Concretely:

1. **Install** gains a fourth step: run `/setup` once per machine after `/reload-plugins`
   to install the zero-token `agentheim-dashboard` CLI and, optionally, the VS Code bridge.
   Name it as re-runnable and as the upgrade path (the skew banner points at it). Keep the
   Dashboard section's command table; drop the duplicate explanation there.
2. **Project state layout** — replace the tree with the two-root layout and fix every
   quoted path in prose and in the skills table. Use the `knowledge/contexts/<bc>/…` and
   `board/<bc>/…` shapes; never introduce an `.agentheim/contexts/`-shaped literal
   (`lib/legacy-path-literal-lint.mjs` is tree-wide and has no README allowlist entry).
   Mention the on-upgrade `migrate` step in one sentence (every writing skill runs it as
   step 0; a legacy tree migrates itself the first time a skill runs).
3. **Skills table** — rename `capture` → `quick-capture`, add `inquire` and `whats-next`
   rows in the same terse shape, retitle the section away from "five". Keep the
   `quick-capture` vs. `modeling` paragraph.
4. **Since the last restructure** — a short list (at most 8 bullets, one line each) of the
   changes a consumer notices, drawn from `CHANGELOG.md` 0.8.9 → 0.9.4, with a link to the
   CHANGELOG for the rest. Candidates: two-root layout + `migrate`; `/setup` + zero-token
   dashboard CLI; `/dashboard` demoted to a pointer; `/agentheim:work <id>` scoped batches;
   worker branch carries source and tests only, conductor materializes bookkeeping
   (ADR-0074); lost-transcript RESULT ladder (ADR-0080); marketplace pins the release tag
   (ADR-0081); the `[human-eye]` falsifiability gate; per-worker git worktree isolation;
   live in-flight lane + What's Next on the dashboard. Pick the ones that change what a
   consumer does or sees; leave harness-internal lints out.
5. **Layout of this repo** — add `lib/` (lifecycle CLI, lints, resolvers), `vscode-extension/`
   (bridge source + committed `.vsix`), `docs/`, and make the `commands/` line match the
   two-command reality. **Status** — replace the April iteration-1 line with the current
   version and a one-line pointer to the CHANGELOG; keep the "load-bearing disciplines"
   sentence.

Out of scope: `dashboard/README.md`, `vscode-extension/README.md`, the workflow guide
(`agentheim-workflow.{pdf,html}`), and the CHANGELOG itself.

## Acceptance criteria

- [ ] `README.md`'s Install section contains a `/setup` step after `/reload-plugins`, and
      `/setup` is described as one-time-per-machine and re-runnable (upgrade path).
- [ ] The "Project state layout" tree shows `knowledge/` and `board/` as the two roots
      with `knowledge/contexts/<bc>/README.md`, `board/<bc>/{backlog,todo,doing,done}/`,
      and `board/protocol.md`; no line in `README.md` still shows `vision.md`,
      `context-map.md`, or `protocol.md` at a location the two-root layout does not use.
- [ ] Grepping `README.md` for `contexts/<bc>/backlog`, `.agentheim/vision.md`, and
      `knowledge/protocol.md` returns nothing, and `node --test lib/test/*.test.mjs` stays
      green — in particular the legacy-path-literal lint reports no new hit in `README.md`.
- [ ] The skills table has rows for `brainstorm`, `quick-capture`, `modeling`, `work`,
      `research`, `inquire`, and `whats-next`; the string `capture` no longer appears as a
      skill name on its own.
- [ ] A section listing the notable changes since 0.8.8 exists, has at most 8 bullets, and
      links to `CHANGELOG.md`; every ADR it cites resolves to a file under
      `.agentheim/knowledge/decisions/`.
- [ ] Every relative link in `README.md` resolves to a path that exists in the repo.
- [ ] "Layout of this repo" names `lib/` and `vscode-extension/`; "Status" names the
      current plugin version from `.claude-plugin/plugin.json` and no longer contains
      "Iteration 1 validated".
- [ ] The README is no longer than it is today (170 lines) by more than ~30 lines; the
      rewritten sections read as a single, current description rather than a changelog
      pasted into prose. [human-eye]

## Notes

- Prior art: infrastructure-x56qm (`/setup` installs the CLI; `/dashboard` → pointer) and
  infrastructure-js62b (`/setup` installs/removes the bridge) each made a small README edit
  — those are the only places `/setup` is mentioned today, both inside the Dashboard section.
- The README is a consumer product surface, not a doctrine-bearing path — no
  mechanize-or-drop convention check applies (ADR-0059 amendment).
- One `[human-eye]` criterion, the rest machine-checkable; the verifier reports the
  human-eye one as "builder eye-check pending" (ADR-0061).
- Facts to draw from, all already on disk: `CHANGELOG.md` 0.8.9 → 0.9.4, ADR-0078
  (layout), ADR-0079 (`/setup`), ADR-0081 (marketplace pin), `commands/setup.md`,
  `skills/*/SKILL.md` frontmatter for the skills table wording.
- The `docs/dashboard-*.png` screenshots may predate the docked prompt console (0.9.0) —
  note it in the RESULT if they look stale; re-shooting them is a separate task.
- Known pre-existing red on `main`: `index-entry-length.test.mjs` fails on the
  agentic-workflow-qwfq3 INDEX entry (62 words); not this task's to fix.

## Outcome

Rewrote the repo-root `README.md` (170 → 197 lines, within the +30-line budget) for 0.9.4:

- **Install** now ends with a fourth `/setup` step inside the fenced command block, with a
  new paragraph naming it one-time-per-machine, re-runnable, and the upgrade path (the skew
  banner points here).
- **Dashboard** section keeps the `agentheim-dashboard`/`stop`/`status` command table and the
  `/dashboard`-is-a-pointer paragraph verbatim (both pinned by
  `dashboard/test/readme-docs.test.mjs`), but the preceding sentence no longer re-explains what
  `/setup` does — it now just points back at Install.
- **Project state layout** tree rewritten to the two-root shape from ADR-0078:
  `knowledge/{vision.md,context-map.md,index.md,decisions/,research/,contexts/<bc>/{README.md,INDEX.md,concepts/}}`
  and `board/{protocol.md,protocol/YYYY-MM.md,<bc>/{INDEX.md,backlog/,todo/,doing/,done/,done-archive/}}`,
  plus a one-sentence mention of the on-upgrade `migrate` step every writing skill runs. No
  line in the file still places `vision.md`, `context-map.md`, or `protocol.md` at their old
  single-root locations, and a grep for the legacy-path-literal-lint's forbidden shapes
  (`contexts/<bc>/backlog`, `.agentheim/vision.md`, `knowledge/protocol`, `contexts/*/`) returns
  nothing.
- **Skills table** retitled "## The skills" (was "## The five skills"), rows renamed
  `capture` → `quick-capture` and two new rows added for `inquire` and `whats-next`; the
  `quick-capture` vs. `modeling` disambiguation paragraph kept and reworded to the new name.
  The "How it works" intro paragraph now says "seven skills" and names both `/setup` and
  `/dashboard` as the two deliberate slash-command exceptions.
- **New "Since the last restructure (0.8.8 → 0.9.4)" section** (8 bullets, at the cap) added
  between "Layout of this repo" and "Status": two-root layout + `migrate` (ADR-0078), `/setup`
  + zero-token CLI (ADR-0079), `/dashboard` as pointer (ADR-0079), `/agentheim:work <id>`
  scoped batches (ADR-0071), worker-branch-source-and-tests-only (ADR-0074), the lost-transcript
  RESULT sidecar (ADR-0080), the marketplace release-tag pin (ADR-0081), and the
  machine-checkable/human-eye falsifiability split (ADR-0061) — each linking to its ADR file
  under `.agentheim/knowledge/decisions/`, closing with a link to `CHANGELOG.md`.
- **Layout of this repo** gained `lib/` and `vscode-extension/` lines; the `skills/` line
  names the current skill set instead of the stale `capture`-era list.
- **Status** replaced "Iteration 1 validated (2026-04-24)..." with "Currently **0.9.4**." (read
  from `.claude-plugin/plugin.json`), keeping the load-bearing-disciplines sentence unchanged.

Verification: `node --test lib/test/*.test.mjs` from the worktree root — 817/818 pass; the one
failure (`lib/test/index-entry-length.test.mjs` on the `agentic-workflow-qwfq3` INDEX entry,
62 words) is the pre-existing, briefed, unrelated red on `main`. `cd dashboard && npm test`
(after `npm install`, since this worktree had no `dashboard/node_modules`) — 1015/1015 pass,
including all 5 `readme-docs.test.mjs` assertions. `git status --porcelain` in the worktree
shows only `README.md` modified — the dashboard-suite `dist/` rebuild left no tracked diff.
Manually checked every relative link in the rewritten README resolves to an existing file
(`agentheim-workflow.{pdf,html}`, `CHANGELOG.md`, `RELEASE.md`, `LICENSE`, `dashboard/README.md`,
`vscode-extension/README.md`, and all nine cited `.agentheim/knowledge/decisions/*.md` ADRs).

Also checked per the task's Notes: `docs/dashboard-{light,dark}.png` already show the docked
prompt console (0.9.0+) with the Quick Capture/Modeling/Inquire/Research mode tabs, so they are
current, not stale — no re-shoot follow-up filed.

Out of scope, untouched as instructed: `dashboard/README.md`, `vscode-extension/README.md`,
`agentheim-workflow.{pdf,html}`, `CHANGELOG.md`.
