---
id: ADR-0081
title: Marketplace pins the release tag, not `main` — closing the mid-rollout leak window
scope: infrastructure
status: accepted
date: 2026-09-12
related_tasks: [infrastructure-hnv3d]
related_adrs: [0013, 0059, 0078, 0002]
---

# ADR-0081: Marketplace pins the release tag, not `main` — closing the mid-rollout leak window

## Context

A consumer (Roman, project "Souls") installed Agentheim "0.9.3" and his dashboard showed only
*"Layout migration pending — run any Agentheim skill to finish migrating this project."* No
skill in his installed copy runs `migrate`, so the notice was a dead end: the board was empty,
and `/plugin update` reported "already at latest".

Reconstructed timeline (all 2026-09-06 unless noted) — **the triggering incident this ADR
records is the 2026-09-06 → 2026-09-11 window below**:

- 12:32 — `chore(release): v0.9.3` (commit f271fde). The tag's tree holds neither
  `lib/layout-migration.mjs` nor `lib/task-system-paths.mjs`.
- 14:32 — cj54k lands (path module, dual layout).
- 15:36 — e896r lands (the `migrate` verb).
- 15:37 — hxq1g lands (dashboard reads the two-root layout; a legacy tree renders the
  migration notice with zero columns).
- 2026-09-11 12:56 — zgav8 lands (every writing skill runs `migrate` as step 0). This is the
  commit that makes the notice's promise true.
- 2026-09-12 15:07 — g5ez5 lands (every consumer except `migrate` refuses a legacy tree).

`plugin.json` `version` stayed `0.9.3` throughout. `RELEASE.md` stated the mechanism plainly:
the marketplace does not install the tag — it copies the marketplace clone of `main` at
update time. So anyone who installed or updated between 15:37 on the 6th and 12:56 on the
11th received a `main` snapshot carrying a consumer-visible promise (the notice) five days
ahead of its fulfilment (step 0), labelled with a released version string. Because the string
did not move, the same consumer could not then pull the completed rollout either — ADR-0013's
own "already at latest" trap, seen from the other side.

ADR-0013 accepted "the manifest legitimately lagging `main` between releases" as a harmless
residual. This incident shows it is not harmless whenever `main` carries a multi-task rollout
whose parts are individually shippable but jointly user-visible — exactly the shape ADR-0078's
split produced (g5ez5 → cj54k / e896r / hxq1g / zgav8 / tgr31), and it will recur for any
future split unless the marketplace itself stops serving `main` between releases.

## Decision

### Mechanism — pin the marketplace manifest to the release tag

`.claude-plugin/marketplace.json`'s `agentheim` plugin entry changes from a relative-path
`source: "./"` to a `github` source pinned to the release tag:

```json
"source": { "source": "github", "repo": "heimeshoff/Agentheim", "ref": "vX.Y.Z" }
```

**Recon (docs, `code.claude.com/docs/en/plugin-marketplaces`, 2026-09-12).** A relative-path
`source` carries no `ref`/`sha` pin at all and always resolves to whatever ref the
marketplace's own clone happens to be checked out on — this is the leak's exact mechanism,
and it supersedes infrastructure-006's recon, which covered only version fields and never
inspected the `source` shape. A `github` source supports both `ref` (a branch or tag name)
and `sha`; `plugin.json`'s `version`, when set, remains the update-detection key for every
git-backed source regardless of which one it uses.

**Why a pinned `ref`, and not a `release` default branch.** Every existing consumer's
marketplace clone — Roman's included — already tracks `main` and re-reads
`marketplace.json` from it on every update. A pinned `ref` inside that same file therefore
reaches every existing consumer without anyone re-adding the marketplace. Changing the
GitHub repository's default branch to a `release` branch was considered and **rejected**:
the marketplace source configuration, not the GitHub default branch, determines what a
consumer's clone tracks, so existing clones would almost certainly stay pinned to `main`
regardless of what the default branch became — the fix would silently fail to reach exactly
the population it needs to reach.

**One release commit, one atomic push — but not the only commit that matters.** Because the
`ref` is a name, not a `sha`, the `chore(release): vX.Y.Z` commit bumps `plugin.json`
`version`, rolls `CHANGELOG.md`, **and** sets `marketplace.json`'s `ref` to `vX.Y.Z`, all
together. It is **not**, however, the only commit the release depends on: `RELEASE.md`'s
Steps 1 and 2 stage the dashboard rebuild and the packaged bridge `.vsix` in their own
earlier commits, each landing *before* the release commit. Because they are ancestors of it,
they are already part of the tree the release commit's tag will name — "fresh at the tag"
holds without needing those artifacts to share the release commit itself. The release commit
is tagged locally, then pushed with `git push --atomic origin main vX.Y.Z`. Order matters:
`main` naming a tag the remote doesn't have yet would break every install in the gap between
two separate pushes — `RELEASE.md` and `/release` previously pushed `main` (their old Step
4/Step 6) *before* tagging (their old Step 7/Step 5); both are reordered so the tag is cut
locally first and only one atomic push reaches `origin`. That atomic push, not the local tag
creation, is the point of no return: the tag alone changes nothing for users until it and
`main` are both on `origin`.

**Invariant, enforced.** On every commit of `main`, `marketplace.json`'s `agentheim` entry
`ref` equals `"v" + plugin.json.version`. A stdlib-only, live-tree `node --test` lint
(`lib/marketplace-ref-lint.mjs`, per ADR-0059's mechanize-or-drop doctrine) fails whenever
the entry isn't a `github` source, has no `ref`, or the `ref` disagrees with the version.

**Safe to land any time.** Landing this with `ref: v0.9.3` (today's actual version) makes new
installs get the consistent, complete `v0.9.3` tag tree immediately. Installs already sitting
on a `main` snapshot labelled `0.9.3` see the same version string and don't move — they move
at the next release, which they needed anyway regardless of this change.

**Dogfooding consequence, accepted.** The builder's own local `directory`-source marketplace
(used to install Agentheim into *other* projects on this machine during development) reads
this same `marketplace.json`, so those other projects now receive the released tag rather
than the live working tree — dogfooding unreleased work in another project requires cutting a
release first. This repo's own skills and `lib/` are unaffected: this repo runs its own tree
directly through the cwd-first bootstraps, never through a marketplace install of itself. No
separate "dev channel" mechanism is introduced; this residual cost is accepted, not mitigated.

### Direction 2 — a `/release` preflight advisory, not a modeling lint

Pinning the `ref` closes the window *between* releases, but a release cut while `main` is
mid-rollout would still ship that snapshot deliberately, at the tag. So `.claude/commands/release.md`
gains a step before the release commit: it lists every task in any bounded context's `todo/`
and `doing/` (id + title), asks the builder whether `main` is mid-rollout, and proceeds or
stops on the answer. This is **advisory, not a gate** — it runs at the one moment the hazard
actually matters, and leaves the judgment call to the builder, who has context a static check
cannot approximate (a "promise ahead of its fulfilment" is a semantic property no lint can
recognize generally). No prose rule is added to `skills/modeling/SKILL.md`: the original
candidate direction — a hard `depends_on` between a promise-carrying task and the task that
fulfils it — was considered but rejected as a permanent modeling rule (see Alternatives);
the preflight advisory is the cheaper, one-time-per-release check that actually catches it.

### Direction 3 (release per integrated batch) — not adopted

Cutting a release at every work-session end would keep `main` from ever lagging a bump by
more than one batch, but it makes every session end a release act — directly against
ADR-0013's "a release is exactly one deliberate, unforgettable act" framing — and the pinned
`ref` (direction 1) already closes the actual leak mechanism on its own. Rejected.

## Alternatives considered

- **A `release` default branch instead of a pinned `ref`.** See "Why a pinned `ref`" above —
  rejected because it would most likely leave existing consumer clones on `main`, the exact
  population the fix must reach.
- **Rollout-ordering discipline in modeling (a permanent `depends_on` rule for
  consumer-visible promises).** Would remove the hazard even inside a release (hxq1g should
  have carried `depends_on: [zgav8]`), but is prose-only unless a lint can recognize a
  "promise" — no such lint is proposed here. Not adopted as a standing rule; the `/release`
  preflight advisory (direction 2) covers the same hazard cheaply, once, at release time,
  without asking every future task author to reason about it.
- **Release per integrated batch (direction 3).** See above — rejected.

## Consequences

**Positive**

- Closes the mid-rollout leak permanently: once pinned, a consumer's marketplace clone only
  ever installs a tagged, complete release tree, never an in-between `main` snapshot.
- Small mechanism cost: one manifest field, one lint, a checklist reorder — no new
  infrastructure, consistent with ADR-0013's zero-infra philosophy.
- The `/release` preflight advisory catches the *remaining* hazard (a release cut deliberately
  mid-rollout) at the one moment it's cheap to ask a human.

**Negative / accepted residual risk**

- Dogfooding other projects on the builder's machine now requires a release cut before they
  can pick up new Agentheim work via the marketplace (accepted above).
- The `/release` preflight is advisory, not a gate — a builder can still answer "no"
  incorrectly and ship mid-rollout. This matches ADR-0013's existing "discipline, not
  enforcement" posture rather than introducing a new failure class.

**Neutral**

- The escalation path already named in ADR-0013 (a CI guard, rejected for cost) is unchanged;
  it would also cover this invariant at no new design cost if drift in this mechanism recurs.

## Scope note

This ADR records the decision. Its concrete artifacts are the `marketplace.json` pin,
`lib/marketplace-ref-lint.mjs` + `lib/test/marketplace-ref-lint.test.mjs`, the `RELEASE.md`
and `.claude/commands/release.md` reorders, an amendment to ADR-0013, and an infrastructure
BC README sentence. There is no follow-up implementation task — the worker ships the ADR and
its artifacts together, as infrastructure-006 did.
