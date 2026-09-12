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

## Why this matters — the marketplace cache, now pinned to the release tag

The marketplace caches the last version it saw. Until `plugin.json` `version` actually
**moves** *and* the move is **pushed to `main`**, `/plugin` keeps telling every marketplace
user *"already at latest version"* — even though new work has landed. Users then silently
stall on stale code (this happened: the manifest drifted ~30 commits behind, and a
contributor on a fresh clone had to mirror the cache by hand). A release exists to move users
**off** "already at latest" — not just to change a number in a file. A bump that is never
pushed changes nothing.

`.claude-plugin/marketplace.json`'s `agentheim` entry is a `github` source pinned to
`ref: "v<plugin.json version>"` (see
[ADR-0081](.agentheim/knowledge/decisions/0081-marketplace-pins-release-tag-not-main.md)).
A relative-path `source` (what this repo shipped before ADR-0081) has no ref/sha pin, so it
always serves whatever ref the marketplace's clone of this repo happens to be on — `main` —
which can be a mid-rollout snapshot ahead of the promises it makes, labelled with a released
version string a consumer cannot then update out of. Pinning the ref means a consumer's
marketplace clone only ever installs a tagged, complete release, never a `main` snapshot
between releases. The ref moves in lockstep with the version bump (Step 3 below), and a
live-tree lint (`lib/marketplace-ref-lint.mjs`) fails on every commit where it doesn't.

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

Run these in order. The tag is created locally partway through, but changes nothing for
users by itself; the single atomic push in Step 7 is the point of no return.

1. **Rebuild and verify the dashboard bundle, then stage it.** The marketplace installs the
   pinned release tag (see
   [ADR-0081](.agentheim/knowledge/decisions/0081-marketplace-pins-release-tag-not-main.md)),
   and Step 6 below tags exactly the commit this checklist is building — so `dashboard/dist/`
   has to be fresh **at the tag**, which is the same tree as `main` only because you rebuild
   and stage it here, *before* the version-bump commit.
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
2. **Package, verify, and stage the VS Code bridge `.vsix`** (only if `vscode-extension/`
   changed). Like `dashboard/dist/`, the packaged `.vsix` is a committed derived artifact
   (ADR-0013's infrastructure-j3rsn addendum) — the marketplace installs the pinned release
   tag (ADR-0081), so the artifact must be fresh **at the tag**, same reasoning as Step 1.
   Delete any stale local `.vsix` from an older version before packaging; never commit more
   than one.
   ```
   cd vscode-extension
   npm install
   npx vsce package --allow-missing-repository
   npm test
   cd ..
   git add vscode-extension/agentheim-bridge-*.vsix
   git commit -m "chore(bridge): package vsix"
   ```
   `npm test` runs `vscode-extension/test/vsix-artifact.test.mjs` (infrastructure-j3rsn),
   which fails unless exactly one `agentheim-bridge-*.vsix` is present under
   `vscode-extension/` and its version segment matches `vscode-extension/package.json`'s
   `version`. This check is **compare-only** — it never rebuilds or repackages, unlike
   `dist-staleness.test.mjs`; a `.vsix` is a zip and is not byte-reproducible across builds
   (it embeds a timestamp), so there is no content-hash stamp to compare against instead.
   Skip this step and the release ships whatever `.vsix` (or none) happened to already be
   committed, stale or not.
3. **Bump the version and pin the marketplace ref.** Edit `.claude-plugin/plugin.json` → set
   `version` to the new `X.Y.Z` chosen above; touch nothing else in that manifest unless
   that's part of the release. Also edit `.claude-plugin/marketplace.json` → set the
   `agentheim` plugin entry's `source.ref` to `vX.Y.Z` — the exact tag string Step 6 below
   will cut. `lib/marketplace-ref-lint.mjs` fails the suite if these two ever disagree.
4. **Roll the CHANGELOG.** In [`CHANGELOG.md`](CHANGELOG.md), turn the top `## [Unreleased]`
   heading into a dated `## [X.Y.Z] - YYYY-MM-DD` section (leaving a fresh empty
   `## [Unreleased]` above it), fill it with what shipped grouped under Keep-a-Changelog
   subheads (`### Added` / `### Changed` / `### Fixed` / `### Docs`), and update the
   link-reference block at the bottom (`[Unreleased]` → `vX.Y.Z...HEAD`, plus a new
   `[X.Y.Z]: …/compare/vOLD...vX.Y.Z`). **This section is the single source of the release
   notes** — Step 8 publishes it verbatim, so compose it once, here. Omit bookkeeping noise
   (`chore(release)`/`chore(protocol)`/SHA-stamp/session-end commits).
5. **Commit the bump + changelog + ref.** A focused, scoped commit — never `git add -A`:
   ```
   git add .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md
   git commit -m "chore(release): vX.Y.Z"
   ```
6. **Tag the release locally, matching the manifest exactly.** The tag string must equal the
   manifest version with a `v` prefix — `plugin.json` `"version": "X.Y.Z"` ⇔ tag `vX.Y.Z` ⇔
   the `ref` Step 3 just wrote into `marketplace.json`. The tag now captures the CHANGELOG
   entry, so its compare links resolve. **Do not push yet** — pushing `main` naming a tag
   the remote doesn't have (or vice versa) would leave the marketplace's pinned `ref`
   dangling for anyone who updates in between; both reach `origin` together in Step 7:
   ```
   git tag -a vX.Y.Z -m "vX.Y.Z"
   ```
7. **Push `main` and the tag together, atomically.** This is the step that actually reaches
   marketplace users — until both are on `origin`, the marketplace keeps installing whatever
   the pinned `ref` named before, and the release has changed nothing for anyone. `dashboard/dist/`
   (Step 1) and, if changed, the bridge `.vsix` (Step 2) are each their own earlier commit, so
   they are already ancestors of the tagged release commit — part of the tree this tag names —
   so this push is also the moment the fresh dashboard and bridge reach every consumer that
   updates:
   ```
   git push --atomic origin main vX.Y.Z
   ```
   If this fails (rejected / non-fast-forward / auth) → stop and report verbatim; do not
   force-push, and do not fall back to two separate pushes — `--atomic` is what guarantees no
   consumer's marketplace clone ever reads a `ref` for a tag `origin` doesn't have yet. Verify
   with a one-line post-push check:
   ```
   git ls-remote origin refs/tags/vX.Y.Z
   ```
8. **Publish release notes on GitHub.** Create a GitHub Release on the tag so the change has a
   human-readable description under `/releases`. The notes are the **body of the `[X.Y.Z]`
   CHANGELOG section** from Step 4 — copy it verbatim, do not recompose. **Do not** use
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
