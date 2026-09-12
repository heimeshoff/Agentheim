---
id: infrastructure-j3rsn
title: Ship the VS Code bridge `.vsix` as a committed release artifact — un-ignore it, add a version-match lint and a `RELEASE.md` step, mirroring how `dashboard/dist/` reaches consumers
status: done
type: chore
context: infrastructure
created: 2026-09-12
completed:
depends_on: []
blocks: [infrastructure-js62b]
tags: [bridge, vsix, release, packaging, derived-artifact]
related_adrs: [0013, 0018, 0057, 0079]
related_research: []
prior_art: [infrastructure-w45ce, infrastructure-013, infrastructure-006]
---

## Why

ADR-0079 assumes `/setup` can install the VS Code bridge from "the cached
`.vsix`". No consumer cache contains one: `vscode-extension/*.vsix` is gitignored,
`@vscode/vsce` is a packaging-only devDependency, and `RELEASE.md` never packages
it. The builder's own cache happens to hold `.vsix` files only because their
marketplace is a local *directory* source that copies untracked files — a
GitHub-installed consumer gets nothing. Until the artifact ships, "install the
bridge" has nothing to point at.

The project already solved this exact shape once: `dashboard/dist/` is a
committed build artifact, kept honest by `dist-staleness.test.mjs` and by
`RELEASE.md` step 1, precisely because *the marketplace copies `main`, not the
tag* (ADR-0013's infrastructure-w45ce amendment). Building at install time was
rejected (builder ruling, 2026-09-12): it puts npm, network, and a `node_modules`
write into the consumer's plugin-cache directory, contradicting ADR-0002's
no-install-step charter.

## What

- Stop ignoring the shipped artifact: `.gitignore` no longer blanket-ignores
  `vscode-extension/*.vsix`; exactly one `vscode-extension/agentheim-bridge-<version>.vsix`
  is committed, packaged from the current `vscode-extension/package.json` version
  (`0.5.0` today). Stale local builds of older versions are deleted, not committed.
- Add `*.vsix` to `vscode-extension/.vscodeignore` — it excludes `test/**`,
  `.vscode/**`, `node_modules/**` today but not `*.vsix`, so the next
  `vsce package` would nest the previously committed artifact inside the new one.
- A `node --test` live-tree lint (`lib/test/` or `vscode-extension/test/`,
  stdlib-only): exactly one `agentheim-bridge-*.vsix` exists under
  `vscode-extension/`, and its filename's version segment equals `package.json`'s
  `version`. **Compare only — never rebuild.** A `.vsix` is a zip and is not
  byte-reproducible across builds (timestamps), so the `dist-staleness`
  content-hash pattern does not transfer.
- `RELEASE.md` gains a step beside the existing step 1 (`dashboard/dist/`
  rebuild) that packages, verifies, and stages the `.vsix` when
  `vscode-extension/` changed — carrying the same "the marketplace copies `main`,
  not the tag" rationale. ADR-0013 gets a short addendum recording the second
  committed derived artifact and the compare-only rule.

## Acceptance criteria

- [ ] Exactly one `vscode-extension/agentheim-bridge-*.vsix` is tracked by git (`git ls-files` returns one path), and its version segment equals `vscode-extension/package.json`'s `version`.
- [ ] A `node --test` check asserts that same invariant on the live tree (one file, version match) and passes; it reads and compares only, never invokes `vsce` or `npm`.
- [ ] `.gitignore` no longer matches the committed `.vsix` path (`git check-ignore` on it exits non-zero), and `vscode-extension/.vscodeignore` contains `*.vsix`.
- [ ] `RELEASE.md`'s checklist contains a `.vsix` package-verify-stage step adjacent to the `dashboard/dist/` step, naming the lint by file — asserted by a literal-substring doc check.
- [ ] ADR-0013 carries an addendum naming the `.vsix` as the second committed derived artifact and the compare-only (no rebuild) rule, with `related_tasks` including this id.
- [ ] `code --install-extension <the committed .vsix> --force` on the builder's machine installs `agentheim.agentheim-bridge` at the `package.json` version. [human-eye]

## Notes

Blocks infrastructure-js62b (`/setup install bridge` resolves this file from the
plugin cache via `lib/resolve-plugin-file.mjs`). Independent of
infrastructure-x56qm — touches disjoint files, so it may run in the same batch.

The committed artifact is a binary (~14 KB). Packaging: `cd vscode-extension &&
npm install && npx vsce package --allow-missing-repository` (README's existing
sequence). Delete `agentheim-bridge-0.2.1.vsix` / `0.4.0.vsix` from the working
tree rather than committing them.

Worker/verifier briefing: two `vscode-extension/test/bridge.test.mjs` cases fail
`EADDRINUSE` on `:31425` while the builder's live bridge runs — not a regression.
`dashboard/dist/app.js` shows a phantom EOL-only modification on this box; never
commit it.

## Outcome

The VS Code bridge `.vsix` now ships as a committed release artifact, mirroring how `dashboard/dist/` reaches consumers (ADR-0013's infrastructure-w45ce amendment), with a compare-only guard rather than a rebuild-comparison one (a `.vsix` is a zip and embeds a build timestamp, so it isn't byte-reproducible across builds).

- **`.gitignore`** no longer blanket-ignores `vscode-extension/*.vsix` (only `vscode-extension/node_modules/` stays ignored there); `git check-ignore` on the committed path exits non-zero, verified by a new test.
- **`vscode-extension/.vscodeignore`** gained `*.vsix` (so a previously committed `.vsix` never nests inside the next packaged one) and `vsix-lint.mjs` (release tooling, not extension runtime).
- **`vscode-extension/vsix-lint.mjs`** (new) — a pure, stdlib-only `checkVsixArtifact({ vscodeExtensionDir })` that reads (never rebuilds/repackages) a `vscode-extension/`-shaped directory and asserts exactly one `agentheim-bridge-<version>.vsix` is present, matching `package.json`'s `version`.
- **`vscode-extension/test/vsix-artifact.test.mjs`** (new, 8 tests) — exercises the lint against the live tree plus scratch-dir red-path cases (none present, more than one present, version mismatch, non-matching filenames ignored) and the `.gitignore`/`.vscodeignore` invariants.
- **`vscode-extension/test/release-checklist.test.mjs`** (new, 3 tests) — a literal-substring doc check on `RELEASE.md`: names `vsix-artifact.test.mjs` by file, asserts the `.vsix` packaging step is the step immediately after the dashboard/dist step (by parsing the checklist's numbered headings), and asserts the step documents itself as compare-only.
- **`RELEASE.md`** gained a new step 2, "Package, verify, and stage the VS Code bridge `.vsix`" (only if `vscode-extension/` changed), immediately after the existing dashboard/dist rebuild step; all later steps renumbered (3–8) and their cross-references ("Step 7"→"Step 8", "Step 3"→"Step 4") updated to match.
- **`vscode-extension/agentheim-bridge-0.5.0.vsix`** (new, ~14.6 KB) — packaged via `cd vscode-extension && npm install && npx vsce package --allow-missing-repository` from the current `package.json` version (`0.5.0`); no stale local builds existed in this worktree to delete. `vsix-lint.mjs` was added to `.vscodeignore` before this final package, so the artifact does not nest its own lint tooling.
- **`vscode-extension/package-lock.json`** — `npm install` (required because `vscode-extension/node_modules` is not a shared junction, per the conductor briefing) also synced the lockfile's stale `"version": "0.1.0"` to the manifest's actual `0.5.0`; a harmless, incidental correction, not a new decision.
- **ADR-0013 addendum reported** (see `ADR_0013_ADDENDUM` block) naming the `.vsix` as a second committed derived artifact and the compare-only rule, with `related_tasks` gaining this task's id.
- **README delta reported** (see `README_DELTA` block): the ADR-0013 Decisions bullet gains an `infrastructure-j3rsn` amendment sub-bullet; a new "Vsix freshness, compare-only" bullet is appended under Testing, alongside the existing "Dist freshness" entry.

Full BC suite (run from this worktree): `dashboard` 1000/1000 passing; `node --test lib/test/*.test.mjs` 718/718 passing; `node --test vscode-extension/test/*.test.mjs` 42/44 passing — the 2 failures are the pre-existing, environment-only `EADDRINUSE` cases on `bridge.test.mjs` (the builder's live bridge occupies `:31425`), not a regression; every new test in this task's own two files passes.

**Deferred, per the briefing:** the `[human-eye]` acceptance criterion — `code --install-extension vscode-extension/agentheim-bridge-0.5.0.vsix --force` installing `agentheim.agentheim-bridge` at `0.5.0` on the builder's machine — was not run by this worker; it is the builder's/verifier's step to perform.

Key files: `vscode-extension/vsix-lint.mjs`, `vscode-extension/test/vsix-artifact.test.mjs`, `vscode-extension/test/release-checklist.test.mjs`, `RELEASE.md`, `.gitignore`, `vscode-extension/.vscodeignore`, `vscode-extension/agentheim-bridge-0.5.0.vsix`, `vscode-extension/package-lock.json`.
