---
id: infrastructure-007
title: Bump plugin version to 0.8.2 + cut v0.8.2 tag to unblock marketplace updates
status: done
type: chore
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: 6e69b80
depends_on: []
blocks: []
tags: [plugin, packaging, distribution, release, version, marketplace]
related_adrs: [0013]
related_research: []
prior_art: [infrastructure-005]
---

## Why

A tester on the marketplace can't get the current plugin: `/plugin` keeps reporting
*"already at latest"*. Verified against the repo on 2026-06-08:

- Tag **`v0.8.1`** was cut (commit `6252320`, now `main` HEAD) carrying real new content —
  the `capture` skill and the POSIX dashboard fixes.
- But `.claude-plugin/plugin.json` **at that tag and on `main` still reads `0.8.0`** — the
  manifest was never bumped when `v0.8.1` was tagged.

The marketplace keys the update decision off the manifest `version` (the sole version
source — `marketplace.json` carries none). Since the manifest didn't move past `0.8.0`,
every user already on `0.8.0` is told they're current and never pulls `v0.8.1`'s content.

This is the **second** occurrence of the same drift (see prior art `infrastructure-005`,
which bumped `0.7.0 → 0.8.0` for the same reason) — and it happened on the *first release
after* `infrastructure-006` / **ADR-0013** codified the discipline meant to prevent it.
The checklist ran from memory and the bump was skipped. (Whether ADR-0013's manual
checklist needs an automated guard is a separate, deliberately-not-captured decision; this
task is only the immediate unblock.)

## What

Correct the missed bump by treating `v0.8.1`'s manifest as a skipped step and shipping a
fresh release: bump `.claude-plugin/plugin.json` `version` from `0.8.0` to **`0.8.2`** and
cut a new **`v0.8.2`** tag on `main`. The already-published `v0.8.1` tag is left untouched
(never rewrite a published tag). Once `main` carries a `0.8.2` manifest and the tag is
pushed, `/plugin` sees `0.8.2 > 0.8.0` and offers the update.

The version mechanics follow **ADR-0013** and the top-level **`RELEASE.md`** checklist
(bump → commit → push to `main` → tag).

## Acceptance criteria

- [ ] `.claude-plugin/plugin.json` `version` reads `0.8.2`.
- [ ] No other manifest fields changed; no other version reference needs to agree
      (repo-wide check — `marketplace.json` carries no version; no CHANGELOG / README badge).
- [ ] The bump commit lands on `main`.
- [ ] A new annotated tag **`v0.8.2`** is cut pointing at the bump commit and pushed; the
      existing `v0.8.1` tag is unchanged.
- [ ] After push, the manifest version on `main` (`0.8.2`) is strictly greater than the
      last version any marketplace user could already hold (`0.8.0`) — i.e. the update is
      actually offered.

## Notes

- The tag-cut + push to `main` is the deliberate **release act** per `RELEASE.md` — it's a
  human/builder step, not something a worker does to git. The worker-satisfiable core is
  the manifest edit; the tag/push closes the release.
- Semver note (builder's call, captured as decided): the new content in this line includes
  a new skill (`capture`), which ADR-0013's contract-based semver would read as a *minor*
  bump. The builder chose **`0.8.2`** to keep continuity with the already-cut `v0.8.1`
  patch tag and treat this purely as the missing-bump correction. If a minor is preferred
  instead, `0.9.0` is the alternative — but the released line is already `v0.8.1`, so `0.8.2`
  is the consistent next step.
- One-line code change; the value of capturing it is making sure it lands and the tag is
  cut, since the recurrence is the actual problem.

## Outcome

Bumped the sole version source `.claude-plugin/plugin.json` `version` from `0.8.0` to
`0.8.2`, no other field touched. This corrects the bump that was skipped when `v0.8.1`
was tagged (the manifest stayed at `0.8.0`, so the marketplace kept telling users they
were "already at latest"). The published `v0.8.1` tag is left untouched.

Repo-wide version sanity check (Grep across the tree) confirmed no other version source
needs to agree: `marketplace.json` carries no version (per ADR-0013), there is no
CHANGELOG or README version badge, and the only other `version` hits are independent —
the dashboard app's own `0.1.0` package metadata and eval/workspace fixture snapshots,
none of which are the release manifest.

Worker scope was the manifest edit only. The release act — the bump commit landing on
`main`, the annotated `v0.8.2` tag pointing at that commit, and the push to `main` — is
completed by the orchestrator (the builder authorized the full release), not by this
worker. Once pushed, `0.8.2 > 0.8.0` so `/plugin` offers the update.

Key file: `.claude-plugin/plugin.json`.
