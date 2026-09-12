---
id: infrastructure-hnv3d
title: The marketplace installs `main`, not the tag, under the last released version string — a consumer who installs between a tag and the next bump gets an unreleased mid-rollout snapshot and cannot update out of it; decide how releases stop leaking (Roman's 0.9.3 stuck on a dashboard migration notice no skill in his copy fulfils)
status: done
type: decision
context: infrastructure
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [release, marketplace, versioning, upgrade, rollout, plugin-contract]
related_adrs: [0013, 0078, 0002, 0057, 0081]
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

A decision (ADR) on how the marketplace stops serving unreleased `main`, plus the minimal
change that implements it. The worker writes both the ADR and its artifacts, as in
infrastructure-006; no follow-up implementation task is spawned.

### Decided direction (refine pass, 2026-09-12, builder)

**Direction 1, by pinning the tag in the marketplace manifest.** `.claude-plugin/marketplace.json`'s
plugin entry changes from `"source": "./"` to a `github` source pinned to the release tag:

```json
"source": { "source": "github", "repo": "heimeshoff/Agentheim", "ref": "vX.Y.Z" }
```

- **Why this and not a `release` default branch.** Consumers' marketplace clones track
  `main` and re-read `marketplace.json` from it on every update, so a pinned `ref` reaches
  every existing consumer (Roman included) without anyone re-adding the marketplace. Changing
  the GitHub default branch would most likely leave existing clones on `main`.
- **Recon (docs, `code.claude.com/docs/en/plugin-marketplaces`, 2026-09-12).** A relative-path
  source has no `ref`/`sha` pin and serves whatever ref the marketplace clone is on. That is the
  leak's mechanism, and it supersedes infrastructure-006's recon, which only covered version fields. The `github`
  source supports `ref` (branch or tag) and `sha`. `plugin.json` `version`, when set, is the
  update-detection key for every git source.
- **One release commit, one atomic push.** The `ref` is a name, not a SHA, so the
  `chore(release): vX.Y.Z` commit bumps `plugin.json` `version`, rolls `CHANGELOG.md`, **and**
  sets the `marketplace.json` `ref` to `vX.Y.Z` together. That commit is tagged, then
  `git push --atomic origin main vX.Y.Z` pushes both. The order matters: `main` naming a tag
  the remote doesn't have yet would break every install in between. Today's `/release` pushes
  `main` (Step 4) *before* tagging (Step 5), so those steps must be reordered.
- **Invariant, enforced.** On every commit of `main`, the `marketplace.json` plugin `ref`
  equals `"v" + plugin.json.version`. A live-tree `node --test` lint checks it (ADR-0059).
- **Safe to land any time.** Landing this with `ref: v0.9.3` makes new installs get the
  consistent `v0.9.3` tag tree. Installs already on a `main` snapshot labelled 0.9.3 see the
  same version string and don't move; they move at the next release, which they needed anyway.
- **Dogfooding consequence, accepted.** The builder's local `directory` marketplace reads the
  same `marketplace.json`, so other projects on this machine get the released tag, not the
  working tree. This repo itself keeps running its own `lib/` through the cwd-first bootstraps.
  No dev channel is wanted; the ADR records this as accepted.

**Direction 2 as a `/release` preflight advisory, not a modeling lint.** Pinning closes the
window between releases, but a release cut mid-rollout would still ship a promise ahead of
its fulfilment. So `.claude/commands/release.md` gains a step before the release commit. It
lists every task in any BC's `todo/` and `doing/` (id + title), asks the builder whether
`main` is mid-rollout, and proceeds or stops on the answer. It is advisory, not a gate, and
runs at the one moment the hazard matters. No prose rule is added to `skills/modeling/SKILL.md`.

**Direction 3 (release per integrated batch): not adopted.** It would make every session end
a release act, against ADR-0013's "deliberate act" framing, and pinning already closes the leak.

### Original candidate directions (as captured)

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
release, 3 shrinks the window. The refine pass above chose 1 (pinned tag) + 2 (as a
`/release` preflight advisory) and rejected 3.

Out of scope for this task: cutting 0.9.4 itself. That is the immediate remedy for Roman
and runs through `/release`; this task is about the recurrence. Either order works: 0.9.4
can be cut before or after this lands (see "Safe to land any time").

## Acceptance criteria

- [ ] A new ADR in `.agentheim/knowledge/decisions/` records: the pinned-`ref` mechanism
      (with the docs recon on relative-path vs `github` sources); the release-branch
      alternative and why it was rejected (existing clones stay on `main`); direction 2 as
      the `/release` preflight advisory; direction 3 as rejected; the accepted dogfooding
      consequence. It names the 2026-09-06 → 2026-09-11 window as the triggering incident.
- [ ] ADR-0013 gains a short amendment pointing at the new ADR. It retires the "manifest
      legitimately lagging `main` is harmless" residual, and notes that the infrastructure-w45ce
      and infrastructure-j3rsn "fresh on `main`, because the marketplace copies `main`" rationale
      is now "fresh at the tag", which the release commit makes the same tree.
- [ ] `.claude-plugin/marketplace.json`'s `agentheim` plugin entry is a
      `{"source": "github", "repo": "heimeshoff/Agentheim", "ref": "v<plugin.json version>"}`
      source (currently `v0.9.3`); no `version` field is added to `marketplace.json`
      (`plugin.json` stays the sole version source).
- [ ] A live-tree lint (a `lib/` module + `lib/test/*.test.mjs`, stdlib-only, no network)
      fails when the `marketplace.json` `agentheim` entry is not a `github` source, has no
      `ref`, or its `ref` differs from `"v" + plugin.json.version`. It carries fixture tests for
      each red case plus the green case, and passes on the live tree.
- [ ] `RELEASE.md` is updated so that following it end to end leaves the marketplace serving
      exactly the tagged tree. The bump step also sets the `marketplace.json` `ref`, the
      commit step stages `.claude-plugin/marketplace.json`, and the tag is created locally before
      a single `git push --atomic origin main vX.Y.Z`. The "Why this matters" section and the
      Step 1/2 "the marketplace copies `main`" rationale are rewritten for the pinned model, and
      the docs mention the one-line post-push check
      `git ls-remote origin refs/tags/vX.Y.Z`.
- [ ] `.claude/commands/release.md` matches `RELEASE.md`: Step 1 also sets the `ref`, Step 3
      stages `marketplace.json`, and the tag is created before one atomic push of `main` + tag
      (no step pushes `main` without the tag). It also gains a preflight step before the
      release commit that lists every `todo/` and `doing/` task across all BCs under
      `.agentheim/board/` and asks the builder whether `main` is mid-rollout before continuing.
- [ ] The infrastructure BC README's ADR-0013 entry reflects the new state in one settled
      current-state sentence (the marketplace installs the pinned release tag, not `main`),
      with the new ADR's id cited. The w45ce/j3rsn amendment bullets no longer claim the
      marketplace copies `main`.
- [ ] `node --test lib/test/*.test.mjs` is no redder than on `main` before the change.

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
- Type is `decision` because the ADR is the primary deliverable. The direction was settled in
  refinement and its artifacts are small (a manifest edit, one lint, two release docs, and a
  README sentence), so the worker ships them in the same task rather than spawning follow-ups.
- **Post-release confirmation (builder, not verifiable by the worker, needs a real
  marketplace):** after the first release under the pinned model, a fresh `/plugin update`
  in a consumer project records a `gitCommitSha` in `~/.claude/plugins/installed_plugins.json`
  equal to `git rev-parse vX.Y.Z^{commit}`.
- **Pre-existing reds to brief the worker/verifier on:** `index-entry-length.test.mjs` is red
  on `main` (qwfq3). Bridge fixed-port tests fail EADDRINUSE while the builder's bridge runs,
  and `foreign-launch.test.mjs` flakes EPERM in teardown on Windows.
- The `repo` casing follows the `origin` remote (`heimeshoff/Agentheim`); GitHub resolves
  either casing.

## Verifier note (iteration 1)

**VERDICT:** FAIL

**REASONS:**
- Check 1 (RELEASE.md criterion): Step 7 (`RELEASE.md:129-130`) claims "`dashboard/dist/` (Step 1) and, if changed, the bridge `.vsix` (Step 2) are in the same commit" — contradicted by the same file: Step 1 makes its own `chore(dashboard): rebuild dist` commit (line 69) and Step 2 its own `chore(bridge): package vsix` commit (line 89); both are ancestors of the tagged release commit, not part of it.
- Check 1 (RELEASE.md criterion): line 54 still says "The tag is the last step and the point of no return." Under the new flow the tag is created locally at Step 6 ("Do not push yet"); the Step 7 atomic push is what reaches users. Preamble not rewritten for the pinned model.
- Check 1 (ADR-0013 amendment criterion): the `ADR_AMENDMENT` block says the release commit is "the same commit that stages the dashboard rebuild / packaged `.vsix`, bumps the version, and sets the new pinned `ref`" — false per RELEASE.md Steps 1/2/5 (three separate commits). The criterion only asked for "fresh at the tag, which the release commit makes the same tree" (true, since the tag's tree includes the earlier rebuild commits).
- Check 5 (readmeDelta misdescribes the diff): the replaced w45ce sub-bullet says "the release commit (bump + rebuild, staged together)"; the diff keeps the rebuild as its own commit ahead of `chore(release)`.
- Check 1 (README criterion, secondary): the criterion asks for "one settled current-state sentence"; the delta adds a five-sentence "**Amendment (infrastructure-hnv3d, ADR-0081)**" paragraph inside the ADR-0013 entry — amendment history, not one settled current-state sentence. (Anchor/expected match; w45ce/j3rsn bullets no longer claim the marketplace copies `main`.)
- Minor: `.claude/commands/release.md` frontmatter `description` (line 2) still lists the old order "push main, tag".
- Everything else passes: suite 811/812 (only the known index-entry-length red), all 6 marketplace-ref-lint tests incl. live-tree; marketplace.json pin; atomic-push reorder; ls-remote check; preflight advisory; ADR-0081 well-formed.

**SUGGESTED_FIX:** Wording-only fix. In RELEASE.md Step 7, the ADR_AMENDMENT block, and the README_DELTA w45ce bullet, state that the rebuild/`.vsix` commits precede the release commit and are therefore part of the tagged tree (not "the same commit"). Rewrite RELEASE.md line 54 so the atomic push, not the tag, is the point of no return. Replace the README Amendment paragraph with one current-state sentence citing ADR-0081. Update the `/release` command description's step order.

**ITERATION_HINT:** likely-fixable

## Outcome

The marketplace no longer serves an unreleased `main` snapshot under a released version
string. `.claude-plugin/marketplace.json`'s `agentheim` entry is now a `github` source pinned
to `ref: "v0.9.3"` (matching `plugin.json`'s current version) instead of the relative-path
`"./"` that always resolved to whatever `main` happened to be. A new stdlib-only, live-tree
lint, `lib/marketplace-ref-lint.mjs` (tested by `lib/test/marketplace-ref-lint.test.mjs`),
fails whenever the entry isn't a `github` source, has no `ref`, or the `ref` disagrees with
`"v" + plugin.json.version` — it passes on the live tree today and carries fixture tests for
each red case plus the green case.

`RELEASE.md` and `.claude/commands/release.md` were both updated so following either end to
end leaves the marketplace serving exactly the tagged tree: the bump step now also sets the
`ref`, the commit step stages `marketplace.json`, the tag is created locally, and a single
`git push --atomic origin main vX.Y.Z` replaces the previous push-then-tag order (which could
have left a tag-naming `main` on the remote before the tag itself existed). Both docs mention
the one-line post-push check `git ls-remote origin refs/tags/vX.Y.Z`. `.claude/commands/release.md`
also gained a new Step 1: a mid-rollout preflight advisory that lists every `todo/`/`doing/`
task across all bounded contexts and asks the builder whether `main` is mid-rollout before
proceeding — advisory, not a gate. Its frontmatter `description` was updated to name the new
step order (bump + pin ref, roll changelog, tag, atomic push) instead of the old "push main,
tag" order.

**Iteration 2 correction.** The iteration-1 diff twice implied the dashboard-rebuild and
`.vsix`-packaging commits (`RELEASE.md` Steps 1/2) land *in the same commit* as the release
commit (`chore(release): vX.Y.Z`). They do not: each is its own earlier commit, and because
they are ancestors of the release commit, they are already part of the tree the release
commit's tag names — "fresh at the tag" holds through ancestry, not co-location. `RELEASE.md`
Step 7 and the `ADR_AMENDMENT`/`ADRS` text below now say this precisely. `RELEASE.md`'s
"Run these in order" preamble (line 54) is also rewritten: the tag is created locally
partway through (Step 6) and changes nothing for users by itself; the atomic push (Step 7)
is the actual point of no return. The `README_DELTA`'s w45ce sub-bullet is corrected the same
way, and the multi-sentence "Amendment (infrastructure-hnv3d, ADR-0081)" paragraph inside the
ADR-0013 README entry is replaced with one settled current-state sentence citing ADR-0081, per
the acceptance criterion's "one settled current-state sentence" wording.

ADR-0081 (`.agentheim/knowledge/decisions/0081-marketplace-pins-release-tag-not-main.md`,
provisional number) records the pinned-`ref` mechanism, the docs recon on relative-path vs.
`github` sources, the rejected release-branch alternative, direction 2 as the `/release`
preflight advisory, direction 3 (release-per-batch) as rejected, and the accepted dogfooding
consequence, naming the 2026-09-06 → 2026-09-11 window as the triggering incident; its
"one release commit" paragraph now explicitly distinguishes the release commit itself from
the earlier ancestor commits it depends on. ADR-0013 is amended (see the reported
`ADR_AMENDMENT` block) to retire its "manifest lagging `main` is harmless" residual and to
correctly attribute "fresh at the tag" to ancestry rather than co-commit. The infrastructure
BC README's ADR-0013 entry is updated via the reported `README_DELTA` to reflect the new state
with one settled current-state sentence citing ADR-0081, and the w45ce/j3rsn amendment
bullets no longer claim the marketplace copies `main`.

`node --test lib/test/*.test.mjs` is no redder than on `main` before this change: 811/812
passing after this iteration's wording fixes too, with only the pre-existing
`index-entry-length.test.mjs` red (qwfq3's over-length INDEX entry, unrelated to this task).
An earlier, isolated `lifecycle-lock.test.mjs` EPERM failure seen during one iteration-1
full-suite run was confirmed a Windows-concurrency flake (passed cleanly in isolation and on
a full-suite rerun) and did not recur in iteration 2's run.

Key files (unchanged across both iterations): `.claude-plugin/marketplace.json`,
`RELEASE.md`, `.claude/commands/release.md`, `lib/marketplace-ref-lint.mjs`,
`lib/test/marketplace-ref-lint.test.mjs`.
