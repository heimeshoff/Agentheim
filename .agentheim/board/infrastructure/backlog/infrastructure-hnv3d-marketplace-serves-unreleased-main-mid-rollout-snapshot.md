---
id: infrastructure-hnv3d
title: The marketplace installs `main`, not the tag, under the last released version string — a consumer who installs between a tag and the next bump gets an unreleased mid-rollout snapshot and cannot update out of it; decide how releases stop leaking (Roman's 0.9.3 stuck on a dashboard migration notice no skill in his copy fulfils)
status: backlog
type: decision
context: infrastructure
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [release, marketplace, versioning, upgrade, rollout, plugin-contract]
related_adrs: [0013, 0078, 0002, 0057]
related_research: []
prior_art: [infrastructure-005, infrastructure-006, infrastructure-w45ce, infrastructure-j3rsn, infrastructure-rgknz]
---

## Why

A consumer (Roman, project "Souls") installed Agentheim "0.9.3" and his dashboard shows
only the notice *"Layout migration pending — run any Agentheim skill to finish migrating
this project."* No skill in his installed copy runs `migrate`, so the notice is a dead end:
the board is empty, and `/plugin update` reports "already at latest".

Reconstructed timeline (all 2026-09-06 unless noted):

- 12:32 — `chore(release): v0.9.3` (commit f271fde). The tag's tree holds neither
  `lib/layout-migration.mjs` nor `lib/task-system-paths.mjs`.
- 14:32 — cj54k lands (path module, dual layout).
- 15:36 — e896r lands (the `migrate` verb).
- 15:37 — hxq1g lands (dashboard reads the two-root layout; a legacy tree renders the
  migration notice with zero columns).
- 2026-09-11 12:56 — zgav8 lands (every writing skill runs `migrate` as step 0). This is
  the commit that makes the notice's promise true.
- 2026-09-12 15:07 — g5ez5 lands (every consumer except `migrate` refuses a legacy tree).

`plugin.json` `version` stayed `0.9.3` throughout and still is. `RELEASE.md` step 1 states
the mechanism plainly: *the marketplace does not install the tag — it copies the marketplace
clone of `main` at update time.* So anyone who installed or updated between 15:37 on the
6th and 12:56 on the 11th received a `main` snapshot carrying a consumer-visible promise
(the notice) five days ahead of its fulfilment (step 0), labelled with a released version
string. Because the string did not move, the same consumer now cannot pull the completed
rollout either — ADR-0013's own "already at latest" trap, seen from the other side.

ADR-0013 accepted "the manifest legitimately lagging `main` between releases" as a
residual, on the assumption that lag is harmless. This incident shows it is not harmless
whenever `main` carries a multi-task rollout whose parts are individually shippable but
jointly user-visible. That is exactly the shape ADR-0078's split produced (g5ez5 →
cj54k / e896r / hxq1g / zgav8 / tgr31), and it will recur for any future split.

## What

A decision (ADR) on how the marketplace stops serving unreleased `main`, plus whatever
minimal change implements it. Candidate directions, to be weighed in refinement:

1. **Serve the last release, not `main`.** Make what the marketplace clones move only at
   tag time — e.g. a `release` branch that `RELEASE.md` fast-forwards to the tag as its
   final step, with the GitHub default branch (or the marketplace source) pointed at it;
   or, if the marketplace source format supports pinning a ref, pin the tag there. `main`
   stays the development branch. Needs a recon of what `marketplace.json` `source`
   actually supports for a self-hosted marketplace (infrastructure-006 did the last recon).
2. **Rollout-ordering discipline in modeling.** A consumer-visible promise (a notice, a
   pointer, a command that names a step) must depend on the task that fulfils it, so
   integration order cannot ship the promise first. hxq1g should have carried
   `depends_on: [zgav8]`. Cheap, but prose-only unless a lint can recognise a "promise".
3. **Release per integrated batch.** Cut a patch/minor release at every work-session end,
   so `main` never lags a bump by more than one batch. Zero mechanism, but it makes every
   session end a release act — against ADR-0013's "deliberate act" framing.

These are not mutually exclusive; 1 fixes the leak, 2 removes the hazard even inside a
release, 3 shrinks the window. Refinement decides which combination, writes the ADR, and
spawns the implementation task(s).

Out of scope for this task: cutting 0.9.4 itself. That is the immediate remedy for Roman
and runs through the `release` skill now; this task is about the recurrence.

## Acceptance criteria

- [ ] An ADR in `.agentheim/knowledge/decisions/` records the chosen direction(s), amends
      ADR-0013's "lag is harmless" residual, and names the 2026-09-06 → 2026-09-11 window
      as the triggering incident.
- [ ] `RELEASE.md` is updated so that following it end to end leaves the marketplace
      serving exactly the tagged tree (direction 1), or the ADR records why the leak is
      accepted and which of 2 / 3 mitigates it instead.
- [ ] If direction 1 is chosen: after the change, the tree the marketplace clones equals
      the tree of the newest `vX.Y.Z` tag, checked by a test or a documented one-line
      `git` command in `RELEASE.md`.
- [ ] If direction 2 is chosen: `skills/modeling/SKILL.md` names the rule at the point
      where a split writes `depends_on`, with either an enforcement criterion or an explicit
      "prose-only, unenforced" marker (ADR-0059).
- [ ] The infrastructure BC README's release entry (ADR-0013 paragraph) reflects the new
      state in one settled current-state sentence.

## Notes

- Evidence: `git ls-tree v0.9.3 lib/layout-migration.mjs` returns nothing; commit dates
  above from `git log`; Roman's screenshots (dashboard on 127.0.0.1:41361 showing the
  notice; his session's diagnosis naming zgav8 as still in todo in his copy).
- Roman's own remedy today: wait for 0.9.4, then run any writing skill once (step 0
  migrates). His session also counted 104 references to `.agentheim/contexts/...` in his
  project, five of them outside `.agentheim/` (`CLAUDE.md`, `specs/README.md`, three files
  under `.claude/commands/`) — `migrate` rewrites none of those; see agentic-workflow-vsb06.
- ADR-0013 semver: ADR-0078 changes the `.agentheim/` layout; with the automatic
  on-upgrade migration it is arguably additive, but "when in doubt prefer major" is the
  ADR's own rule. The `release` skill run for 0.9.4 should make that call explicitly.
- Type is `decision` because the direction changes the work materially; the ADR is the
  deliverable, implementation tasks are spawned from it.
