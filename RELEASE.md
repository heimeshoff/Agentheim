# Releasing Agentheim

Agentheim ships as a Claude Code plugin through the plugin marketplace. The marketplace
decides whether a user is up to date by reading **one** number: `version` in
`.claude-plugin/plugin.json`. That is the **only** version source — `marketplace.json`
carries no version field; do not add a second one.

A **release is one act: cutting a `vX.Y.Z` git tag.** This checklist *is* how a tag is cut,
so the version bump can't be skipped without skipping the release itself. The manifest is
**not** bumped per commit — it is allowed to lag `main` between releases. Bump only when you
deliberately cut a release.

> Policy of record: [ADR-0013 — Plugin release discipline](.agentheim/knowledge/decisions/0013-plugin-release-discipline.md).

## Why this matters — the marketplace cache

The marketplace caches the last version it saw. Until `plugin.json` `version` actually
**moves** *and* the move is **pushed to `main`**, `/plugin` keeps telling every marketplace
user *"already at latest version"* — even though new work has landed. Users then silently
stall on stale code (this happened: the manifest drifted ~30 commits behind, and a
contributor on a fresh clone had to mirror the cache by hand). A release exists to move users
**off** "already at latest" — not just to change a number in a file. A bump that is never
pushed changes nothing.

## Choosing the new version (semver)

Agentheim has no code API, so semver is defined against the **plugin contract** — the skills,
commands, and `.agentheim/` layout a user depends on:

- **patch (`x.y.Z`)** — doc / prompt-copy / wording fixes; clarification only, no new
  capability and no contract change.
- **minor (`x.Y.0`)** — additive capability: a new skill, command, BC capability, or feature.
  Existing skills and commands keep working unchanged.
- **major (`X.0.0`)** — a breaking change to the contract: a removed/renamed skill, a
  changed/removed command surface, a changed hook shape, or a `.agentheim/` layout change
  that breaks existing projects.

When unsure between patch and minor, pick **minor**. When unsure between minor and major,
pick **major**.

## Release checklist

Run these in order. The tag is the last step and the point of no return.

1. **Rebuild and verify the dashboard bundle, then stage it.** The marketplace does not
   install the tag — it copies the marketplace clone of `main` at update time (see
   [ADR-0013](.agentheim/knowledge/decisions/0013-plugin-release-discipline.md)'s dashboard
   amendment), so `dashboard/dist/` must be fresh **on `main`**, not merely at some tag.
   ```
   cd dashboard
   npm ci
   npm run build
   npm test
   cd ..
   git add dashboard/dist
   git commit -m "chore(dashboard): rebuild dist"
   ```
   `npm test` runs `dashboard/test/dist-staleness.test.mjs` (infrastructure-w45ce), which
   fails if the bundle you just built doesn't match current sources — it shouldn't, right
   after a build, but this is the same check that protects `main` between releases (see the
   infrastructure BC README's "Dist freshness" note). Skip this step and the release ships
   whatever bundle happened to already be committed, stale or not.
2. **Bump the version.** Edit `.claude-plugin/plugin.json` → set `version` to the new
   `X.Y.Z` chosen above. This is the single field that matters; touch nothing else in the
   manifest unless that's part of the release.
3. **Roll the CHANGELOG.** In [`CHANGELOG.md`](CHANGELOG.md), turn the top `## [Unreleased]`
   heading into a dated `## [X.Y.Z] - YYYY-MM-DD` section (leaving a fresh empty
   `## [Unreleased]` above it), fill it with what shipped grouped under Keep-a-Changelog
   subheads (`### Added` / `### Changed` / `### Fixed` / `### Docs`), and update the
   link-reference block at the bottom (`[Unreleased]` → `vX.Y.Z...HEAD`, plus a new
   `[X.Y.Z]: …/compare/vOLD...vX.Y.Z`). **This section is the single source of the release
   notes** — Step 7 publishes it verbatim, so compose it once, here. Omit bookkeeping noise
   (`chore(release)`/`chore(protocol)`/SHA-stamp/session-end commits).
4. **Commit the bump + changelog.** A focused, scoped commit — never `git add -A`:
   ```
   git add .claude-plugin/plugin.json CHANGELOG.md
   git commit -m "chore(release): vX.Y.Z"
   ```
5. **Push to `main`.** `git push origin main`. **This is the step that actually reaches
   marketplace users** — until the bumped manifest is on `main`'s remote, the marketplace
   cache keeps serving "already at latest" and the release has changed nothing for anyone.
   By this point `dashboard/dist/` is on `main` too (Step 1), so this push is also the moment
   the fresh dashboard reaches every consumer that updates.
6. **Tag the release, matching the manifest exactly.** The tag string must equal the manifest
   version with a `v` prefix — `plugin.json` `"version": "X.Y.Z"` ⇔ tag `vX.Y.Z`. The tag now
   captures the CHANGELOG entry, so its compare links resolve:
   ```
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
7. **Publish release notes on GitHub.** Create a GitHub Release on the tag so the change has a
   human-readable description under `/releases`. The notes are the **body of the `[X.Y.Z]`
   CHANGELOG section** from Step 3 — copy it verbatim, do not recompose. **Do not** use
   `--generate-notes`, which dumps every raw `chore`/protocol commit since the last tag (we
   commit straight to `main`):
   ```
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <changelog-section-body>
   ```
   If `gh` is unavailable, the release still counts (manifest + tag pushed, CHANGELOG live);
   create the Release object later with `scripts/backfill-github-releases.ps1` (it reads the
   CHANGELOG and backfills any tag missing a Release), or via the web UI.

A release is complete only when the tag is pushed **and** the bumped manifest is on `main`'s
remote. The pushed manifest is what moves users; the tag is what marks (and remembers) the
release; the CHANGELOG and the GitHub Release are where a human reads *what changed* (the
CHANGELOG is the source; the Release mirrors it).

> Requires the GitHub CLI (`gh`), authenticated once via `gh auth login`. If `gh` isn't
> installed, the release still "counts" (tag + pushed manifest), but cut the Release object
> later or via the web UI (`Releases → Draft a new release → pick the tag`).
