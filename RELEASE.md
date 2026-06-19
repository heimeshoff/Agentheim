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

1. **Bump the version.** Edit `.claude-plugin/plugin.json` → set `version` to the new
   `X.Y.Z` chosen above. This is the single field that matters; touch nothing else in the
   manifest unless that's part of the release.
2. **Commit the bump.** A focused commit, e.g. `chore(release): vX.Y.Z`.
3. **Push to `main`.** `git push origin main`. **This is the step that actually reaches
   marketplace users** — until the bumped manifest is on `main`'s remote, the marketplace
   cache keeps serving "already at latest" and the release has changed nothing for anyone.
4. **Tag the release, matching the manifest exactly.** The tag string must equal the manifest
   version with a `v` prefix — `plugin.json` `"version": "X.Y.Z"` ⇔ tag `vX.Y.Z`:
   ```
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
5. **Publish release notes on GitHub.** Create a GitHub Release on the tag so the change has a
   human-readable description under `/releases`. Write the notes by hand from the protocol
   "Release shipped" entry for this version — **do not** use `--generate-notes`, which dumps
   every raw `chore`/protocol commit since the last tag (we commit straight to `main`):
   ```
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "<one-paragraph summary, semver level + what landed>"
   ```
   The protocol entry and the release notes say the same thing — write it once, reuse it.

A release is complete only when the tag is pushed **and** the bumped manifest is on `main`'s
remote. The pushed manifest is what moves users; the tag is what marks (and remembers) the
release; the GitHub Release is where a human reads *what changed*.

> Requires the GitHub CLI (`gh`), authenticated once via `gh auth login`. If `gh` isn't
> installed, the release still "counts" (tag + pushed manifest), but cut the Release object
> later or via the web UI (`Releases → Draft a new release → pick the tag`).
