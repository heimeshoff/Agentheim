---
description: Release Agentheim itself (maintainer-only, run from the Agentheim source repo) — bump the manifest, pin the marketplace ref, roll the CHANGELOG, tag, push main and the tag atomically, and publish GitHub release notes for vX.Y.Z. Refuses in projects that merely use Agentheim as a plugin.
argument-hint: "x.y.z"
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Grep
---

# /release — cut an Agentheim release

This command automates the **`RELEASE.md` checklist** end-to-end for the version
passed as the argument. `RELEASE.md` is the policy of record (semver against the
plugin contract; ADR-0013). This card is its executable form — keep the two in
sync; if they ever disagree, `RELEASE.md` wins.

A release is **one act with marketplace consequences**: pushing a bumped manifest
to `main` is what moves every plugin user off *"already at latest"*. Treat it as
outward-facing — run the steps in order, stop and report on the first failure, and
never force-push or `git add -A`.

## Why this is a project-local command — invisible to plugin consumers

This card lives in the Agentheim repo's **`.claude/commands/`**, *not* in the plugin's
distributed **`commands/`** directory (where `/dashboard` lives). That placement is
deliberate and load-bearing: project commands are loaded **only** when you are working
in *this* repo, so they are **never shipped to projects that install Agentheim as a
plugin** and never appear in a consumer's command list. `/release` releases Agentheim
*itself* — it has no meaning in a consumer project, so consumers must not even see it.

> Keep this file under `.claude/commands/`. If it is ever moved into the plugin's
> `commands/` directory it becomes `agentheim:release` and leaks into every install —
> exactly what we do not want.

## Precondition — operate only on the Agentheim source repo

This is the **mirror image of `/dashboard`**. `/dashboard` reaches into the plugin via
`$CLAUDE_PLUGIN_ROOT` and runs against a **foreign** cwd. `/release` is the opposite: it
operates on the **current working directory's git repo**, and that repo **must be the
Agentheim source repo**. The `.claude/commands/` placement already keeps consumers from
ever seeing this command; the checks below are the belt-and-suspenders guard against
running it against the wrong repo (e.g. a copy, or a fresh clone with a misconfigured
remote).

**Do not** use `$CLAUDE_PLUGIN_ROOT` anywhere in this command — every path is
**cwd-relative** (`./.claude-plugin/plugin.json`), and every git op targets the cwd
repo's `origin`.

Before doing anything else, confirm **all** of these. If **any** fails → **STOP** and
tell the builder: *"`/release` only releases the Agentheim source repo, and this does not
look like it — refusing so I don't bump/push the wrong repository."* Make no edits, no
commits.

1. `./.claude-plugin/plugin.json` exists **at cwd** and its `name` is exactly
   `agentheim`. (A consumer project does not carry Agentheim's own manifest; this file
   ships *inside* the plugin, not into projects that install it.)
2. `./RELEASE.md` and `./.claude-plugin/marketplace.json` both exist at cwd — the
   Agentheim **source** repo markers.
3. `git remote get-url origin` resolves and points at the Agentheim repository
   (case-insensitively contains `heimeshoff/Agentheim`). This guarantees the push and
   tag in later steps land on Agentheim's own remote, never a foreign project's.

Only if all three hold are you in the Agentheim source repo and may proceed.

The requested version is: `$ARGUMENTS`

## Step 0 — validate the argument (stop on any failure)

1. If `$ARGUMENTS` is empty or not exactly three dot-separated integers
   (`X.Y.Z`, no `v` prefix, no suffix) → stop and tell the builder the expected
   form is `/release x.y.z` (e.g. `/release 0.8.4`).
2. Read `.claude-plugin/plugin.json` and note the current `version` — call it
   `OLD`. This is the **only** version source (`marketplace.json` carries none).
3. Compare `X.Y.Z` against `OLD` by semver. If it is **not strictly greater**
   (equal or lower) → stop and report; a release must move the number forward.
4. `git tag --list vX.Y.Z` — if the tag already exists → stop and report; the
   release was already cut.
5. `git status --porcelain` — capture the pre-existing dirty/untracked files
   **now**, so later steps add *only* release files and never sweep these in.

If all five pass, state the transition plainly: `OLD → X.Y.Z` and the semver
level it implies (patch / minor / major), then proceed.

## Step 1 — mid-rollout advisory (read-only; advisory, not a gate)

Before touching anything, check whether `main` is mid-rollout of a change that shouldn't
ship yet — a consumer-visible promise (a notice, a pointer, a command that names a step)
that outruns its own fulfilment across several still-in-flight tasks. This is exactly the
hazard [ADR-0081](.agentheim/knowledge/decisions/0081-marketplace-pins-release-tag-not-main.md)
records: pinning the marketplace `ref` stops it leaking a `main` snapshot *between* releases,
but a release cut mid-rollout still ships that snapshot, deliberately, at the tag.

1. List every task file under every `.agentheim/board/*/todo/` and `.agentheim/board/*/doing/`
   directory across all bounded contexts (id + title from frontmatter).
2. If that list is non-empty, show it to the builder and ask plainly: *"Is `main` mid-rollout
   of a change that shouldn't ship as this release?"* Wait for an explicit answer.
3. If the builder says yes, or is unsure → **stop**; do not proceed until they say it's safe.
4. If the builder says no, or the list is empty → proceed to Step 2.

This is advisory, not a gate: it surfaces the question at the one moment a release freezes a
tree into a tag, and leaves the judgment call to the builder, who has context a static check
does not.

## Step 2 — bump the manifest and pin the marketplace ref

Edit `.claude-plugin/plugin.json` → set `version` to `X.Y.Z`. Touch nothing else
in that manifest.

Edit `.claude-plugin/marketplace.json` → set the `agentheim` plugin entry's `source.ref` to
`vX.Y.Z` — the exact tag string Step 5 below will cut. `lib/marketplace-ref-lint.mjs` fails
the suite if these two ever disagree.

## Step 3 — roll the CHANGELOG

`CHANGELOG.md` is the **single source of the release notes** — the GitHub Release
in Step 7 is published *from* it, so compose the notes here, once.

1. Find the previous release tag and read what landed since it. The `vX.Y.Z` tag
   does **not** exist yet at this step, so diff against `HEAD`:
   ```
   git describe --tags --abbrev=0      # the most recent existing tag = OLD's tag
   git log --oneline <prev-tag>..HEAD
   ```
2. In `CHANGELOG.md`, convert the top `## [Unreleased]` heading into a new dated
   release section and leave a fresh empty `## [Unreleased]` above it:
   ```markdown
   ## [Unreleased]

   ## [X.Y.Z] - YYYY-MM-DD
   ```
3. Fill the new section with what shipped, grouped under Keep-a-Changelog
   subheads (`### Added` / `### Changed` / `### Fixed` / `### Docs`), in the
   builder's voice:
   - Lead with the headline capability/fix; group features and bug fixes by theme.
   - **Omit the noise** — `chore(release)`, `chore(protocol)`, SHA-stamp /
     session-end / capture / promote bookkeeping commits are not changelog
     entries. (This is exactly why we never use `gh --generate-notes`, which would
     dump them all — we commit straight to `main`.)
   - Fold in anything maintainers already accrued under `[Unreleased]`.
   - Cross-check terse subjects against the `.agentheim/knowledge/protocol.md`
     "Task verified and completed" entries since the last release.
4. Update the link-reference block at the bottom of the file: point `[Unreleased]`
   at `vX.Y.Z...HEAD`, and add a new `[X.Y.Z]: …/compare/vOLD...vX.Y.Z` line.

## Step 4 — commit the bump + changelog + ref (scoped add only)

```
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
```

Use **only** that pathspec — never `git add -A`/`.` (the working tree may carry
unrelated edits from a parallel session, per the Step 0.5 snapshot).

## Step 5 — tag the release locally

```
git tag -a vX.Y.Z -m "vX.Y.Z"
```

The tag string must equal the manifest version with a `v` prefix — and it's also the exact
`ref` string Step 2 just wrote into `marketplace.json`. The tag now captures the CHANGELOG
entry, so its compare links resolve. **Do not push yet** — pushing `main` naming a tag the
remote doesn't have (or vice versa) would leave the marketplace's pinned `ref` dangling for
anyone who updates in between; both reach `origin` together in Step 6.

## Step 6 — push main and the tag together, atomically

```
git push --atomic origin main vX.Y.Z
```

If this fails (rejected / non-fast-forward / auth) → stop and report verbatim. Do **not**
force-push, and do not fall back to two separate pushes — `--atomic` is what guarantees no
consumer's marketplace clone ever reads a `ref` for a tag `origin` doesn't have yet. The
release has changed nothing for users until this succeeds. Verify with a one-line check:

```
git ls-remote origin refs/tags/vX.Y.Z
```

## Step 7 — publish the GitHub Release (from the CHANGELOG)

First check the CLI is available and authenticated: `gh auth status`.

The release notes are the **body of the `## [X.Y.Z]` section you wrote in Step 3** —
do not recompose them; copy that section verbatim (minus its heading line).

- **If `gh` works** → create the release on the tag with those notes. For
  multi-line notes, write the section body to a temp file and use `--notes-file`:

  ```
  gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <section-body-file>
  ```

- **If `gh` is missing or not authenticated** → do **not** fail the release (it
  already "counts": manifest pushed + tag pushed, and the CHANGELOG entry is live
  on `main`). Tell the builder the Release object isn't created yet, and that
  `scripts/backfill-github-releases.ps1` will create it — and any other missing
  ones — from the CHANGELOG after `gh auth login`. Offer the web-UI fallback too
  (*Releases → Draft a new release → pick tag `vX.Y.Z` → paste the section →
  Publish*).

## Step 8 — log to the protocol

Prepend a `Release shipped` entry to `.agentheim/knowledge/protocol.md` (newest on
top, right after the `---` on line 4). Use today's date and this shape:

```markdown
## YYYY-MM-DD HH:MM -- Release shipped: vX.Y.Z

**Type:** Release
**Version:** OLD → X.Y.Z (<patch|minor|major> — <one-line what & why>)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `<short-sha>`
**Marketplace ref:** `.claude-plugin/marketplace.json` pinned to `vX.Y.Z` (same commit)
**Changelog:** `CHANGELOG.md` `[Unreleased]` → `[X.Y.Z]` section rolled (same commit)
**Pushed:** yes — `main` + `vX.Y.Z` atomically (`<range>` on `origin/main`)
**Tag:** `vX.Y.Z` (annotated) → `<short-sha>`, pushed to origin
**GitHub Release:** created via `gh` (from CHANGELOG) | deferred (gh unavailable — backfill script will create it)

---
```

Then commit and push just the protocol:

```
git add .agentheim/knowledge/protocol.md
git commit -m "chore(protocol): record vX.Y.Z release shipped [work]"
git push origin main
```

## Step 9 — report

Tell the builder, in plain prose: `OLD → X.Y.Z` shipped; `main` and the `vX.Y.Z` tag pushed
atomically, with the marketplace `ref` pinned to it (this is what clears the marketplace
"already at latest" cache and stops it serving `main` in between releases); CHANGELOG
rolled; the GitHub Release status (created from the CHANGELOG, or the backfill script /
web-UI fallback if deferred). Surface anything that needed a fallback.
