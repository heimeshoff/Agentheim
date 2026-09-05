---
id: infrastructure-w45ce
title: A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
status: done
type: bug
context: infrastructure
created: 2026-09-05
completed: 2026-09-05
depends_on: []
blocks: []
tags: [release, plugin, marketplace, dashboard, dist, derived-artifact, consumer-install]
related_adrs: [0013, 0057, 0003, 0002]
related_research: []
prior_art: [infrastructure-006, infrastructure-005, agentic-workflow-q7v3k, infrastructure-010]
---

## Why

A consumer project that installs or updates Agentheim through the marketplace gets whatever
`dashboard/dist/` is **committed on `main`** — the plugin cache is a verbatim copy (verified
2026-09-05: the installed `0.9.2` cache dir's `dist/` is byte-identical to the repo's). But
nothing in the workflow keeps that committed `dist/` in step with its sources:

- ADR-0057 / agentic-workflow-q7v3k made "workers never rebuild `dist/`" **structural** — the
  conductor's checkpoint stage drops any `dashboard/dist/` path, so a worker's rebuild is
  inert. That is correct for integration, but it means the **only** place a rebuilt `dist/`
  can ever reach `main` is a deliberate builder commit.
- `RELEASE.md` (the ADR-0013 checklist) has **no such step**. It bumps the manifest, rolls the
  CHANGELOG, pushes, tags. The dashboard bundle is never mentioned.
- The marketplace does not install the **tag** — it copies the marketplace clone of `main` at
  update time (the installed cache records `gitCommitSha bc47e66`, two commits *past* the
  `v0.9.2` tag), labelled with whatever `plugin.json` says. So "fresh at the tag" is not even
  the right invariant; `dist/` has to be fresh on `main` whenever the manifest version moves.

Today `main` is already in that broken state: `dashboard/app/prompt-mode.js` changed on
2026-07-15 (agentic-workflow-p5k9m, the Modeling-tab session-name carve-out) while
`dashboard/dist/` was last rebuilt on 2026-07-13. The next release cut by the checklist as
written ships a dashboard that still carries the pre-p5k9m bundle — the builder's field
report ("after updating the plugin the dashboard is not properly updated") is exactly this
class of defect, and it will recur on every release that lands a `dashboard/app/` or
styleguide change without a hand rebuild.

## What

Make "a release ships a fresh dashboard" hold by construction, at both ends:

1. **Release step.** `RELEASE.md` gains a step *before* the bump commit: rebuild `dist/`
   (`cd dashboard && npm ci && npm run build`), run the dashboard suite, and stage
   `dashboard/dist/` in the release commit (or a preceding `chore(dashboard): rebuild dist`
   commit). Amend ADR-0013 to name the dashboard bundle as part of the release contract, and
   state the marketplace-installs-`main`-not-the-tag finding so the checklist's "push to
   main" step is understood as the actual ship moment.
2. **Staleness check.** A stdlib-only, `node --test` live-tree check that **fails** when the
   committed `dist/` lags its inputs. Suggested shape (open to the worker): `build.mjs` writes
   `dist/.build-stamp.json` = a content hash over `dashboard/app/**`, the styleguide source
   `build.mjs` consumes, `dashboard/assets/**`, and `build.mjs` itself; the test recomputes the
   hash over the tree and compares — no esbuild/node_modules needed to *check*, only to
   *rebuild*. The failure message must say what to run. This check runs in the same suite the
   verifier already runs, so a release cut from a stale `main` is caught before the tag, and
   a `main` that drifts between releases is visibly red rather than silently stale.
3. **Heal `main` now.** Rebuild and commit the current `dist/` so the p5k9m change (and
   anything else since 2026-07-13) is actually in the bundle.

The check is the durable half; the checklist step is the human-readable half. Neither alone
is enough: the checklist was already the ADR-0013 mechanism and it drifted.

## Acceptance criteria

- [x] `RELEASE.md` has an explicit, ordered "rebuild + verify + stage `dashboard/dist/`"
      step ahead of the `chore(release): vX.Y.Z` commit, and ADR-0013 is amended to cover the
      dashboard bundle and the marketplace-copies-`main` behaviour.
- [x] A `node --test` check (stdlib-only at check time) fails on a tree whose `dashboard/dist/`
      is older than any of its declared inputs, and passes right after `npm run build`. The
      failure text names the rebuild command.
- [x] The check is exercised in the existing suite path the verifier runs. A worker who
      changes `dashboard/app/` without a rebuild must not be blocked by it (the ADR-0057 guard
      still drops the rebuild at checkpoint); instead the check reads red on `main` until the
      builder's rebuild lands. Document this interplay in the check's header and in the
      q7v3k/ADR-0057 doctrine so the two guards are read as complementary, not contradictory.
- [x] `main`'s committed `dist/` is rebuilt from current sources in this task and the check
      is green afterwards. [human-eye] A `/dashboard` launch from a fresh marketplace install
      of the next release shows the post-p5k9m behaviour (a Modeling-tab launch named from the
      typed text alone, no `Modeling:` prefix). — rebuild done and verified in-worktree
      (see Outcome); the marketplace-install leg of this criterion needs a real install and
      is left for the builder/next release to confirm.
- [x] The derived-artifact guard (`lib/derived-artifact-guard.mjs`) still drops
      `dashboard/dist/` from a worker checkpoint — this task adds a builder-side rebuild path,
      it does not reopen the worker-side one.

## Notes

- Sibling task infrastructure-rgknz covers the **runtime** half of the same field report: an
  already-running dashboard process from the *previous* plugin version is reused (or serves
  from a deleted cache dir) after an update. Independent — this task is about what gets
  shipped, that one is about what gets served.
- Windows `autocrlf` phantom-modifies `dashboard/dist/app.js` (noted in the guard's header);
  a content-hash stamp should normalise line endings or hash the sources only, never the
  bundle bytes, so the check isn't red on a clean Windows checkout.
- Marketplace evidence (2026-09-05): `~/.claude/plugins/installed_plugins.json` →
  `agentheim@agentheim` version `0.9.2`, `gitCommitSha bc47e66` (= `main` two commits past
  `v0.9.2`); the marketplace clone under `~/.claude/plugins/marketplaces/agentheim` was at
  `c35bafa` (2026-07-23 `main`). The tag is a marker, not the shipped ref.
- The worker needs `dashboard/node_modules` (`npm ci`) for the one-time rebuild in this task;
  the check itself must not.

## Outcome

Both halves landed:

1. **Release step + ADR-0013 amendment.** `RELEASE.md` gained Step 1 (ahead of the version
   bump / `chore(release)` commit): rebuild `dashboard/dist/`, run the dashboard suite, and
   commit it as its own `chore(dashboard): rebuild dist`. ADR-0013 gained an amendment section
   naming the dashboard bundle as part of the release contract and recording the
   marketplace-copies-`main`-not-the-tag finding.
2. **Staleness check.** New `dashboard/build-stamp.mjs` (stdlib-only: `node:crypto` +
   `node:fs` + `node:path`) computes a SHA-256 over the declared inputs (`dashboard/app/**`,
   `dashboard/assets/**`, `dashboard/build.mjs`, and the styleguide `app/**` + `styles/**`
   source `build.mjs` consumes), normalising text files' line endings to LF so a clean
   Windows `autocrlf` checkout never phantom-fails it — bundle bytes are never hashed.
   `build.mjs` writes the stamp to `<outDir>/.build-stamp.json` on every real build.
   `dashboard/test/dist-staleness.test.mjs` reads the **committed** `dashboard/dist/`'s stamp
   and compares; it never rebuilds, so it needs no esbuild/`node_modules` to run.
3. **The design trap (dispatch note 2).** `dashboard/test/dist-build.test.mjs`'s `before()`
   hook previously rebuilt the real `dashboard/dist/` in place on every suite run, which would
   have made a naive "dist matches source" assertion permanently green (ADR-0057's alternative
   (a), now cited by name in both the new test file's header and ADR-0057's amendment below).
   Fixed by redirecting that hook's rebuild into a `node:os.tmpdir()` scratch directory
   (`build.mjs` now accepts an optional output-dir CLI arg) — the suite no longer touches the
   committed `dashboard/dist/` at all, so the staleness check reads honest, undisturbed state.
   Red-test proof (no mutation of the real committed dist/ required): `checkDistFreshness`
   is a pure function taking `distDir` as a parameter, so its ABSENT-stamp and STALE-stamp
   red paths are proven against synthetic `mkdtempSync` scratch dirs in
   `dist-staleness.test.mjs`, verified to fail-for-the-right-reason before `build-stamp.mjs`
   existed (`ERR_MODULE_NOT_FOUND`) and then to go red/green correctly once it did.
4. **Heal `main`.** Ran the real rebuild in this worktree (`cd dashboard && npm run build`,
   no `npm ci` — `dashboard/node_modules` is the junction to the main tree's install) —
   `dashboard/dist/app.js`/`index.html` now include the 2026-07-15 prompt-mode.js fix and
   every other source change since the 2026-07-13 bundle, and
   `dashboard/dist/.build-stamp.json` is newly present. `dist-staleness.test.mjs`'s freshness
   assertion against the real committed dist passed immediately after.
   **Per dispatch note 1, this rebuild does NOT travel on this branch**: ADR-0057's checkpoint
   guard drops every `dashboard/dist/` path from staging, by design. The conductor must run
   the same rebuild (`cd dashboard && npm run build`, from the merged-onto-`main` source) at
   integration and stage `dashboard/dist/` (including the new `.build-stamp.json`) in the
   integrating commit — otherwise this task's healed bundle never reaches `main` and
   `dist-staleness.test.mjs` will read red on `main` post-merge.
5. **Guard unchanged.** `lib/derived-artifact-guard.mjs` was not modified. Added one test
   (`derived-artifact-guard.test.mjs`) asserting it drops the new
   `dashboard/dist/.build-stamp.json` artifact under the same `derived-artifact` reason as
   the bundle, with no special-casing needed (the existing `dashboard/dist/` prefix already
   covers it).

Full BC suite: 1290 passing (1284 baseline + 5 new `dist-staleness.test.mjs` tests + 1 new
`derived-artifact-guard.test.mjs` test), 0 failing, run from the worktree root.

Key files: `dashboard/build-stamp.mjs` (new), `dashboard/test/dist-staleness.test.mjs` (new),
`dashboard/build.mjs` (writes the stamp, accepts an out-dir override),
`dashboard/test/dist-build.test.mjs` (scratch-dir rebuild), `RELEASE.md`,
`.agentheim/knowledge/decisions/0013-plugin-release-discipline.md`,
`.agentheim/knowledge/decisions/0057-derived-artifacts-unstageable-from-worktree-checkpoint-guard.md`,
`.agentheim/contexts/infrastructure/README.md`,
`lib/test/derived-artifact-guard.test.mjs`.

`dashboard/dist/**` (including the new `.build-stamp.json`) was rebuilt in this worktree to
prove the check goes green, but is deliberately excluded from this task's file list per
ADR-0057 — see point 4 above for the conductor's required integration-rebuild step.
