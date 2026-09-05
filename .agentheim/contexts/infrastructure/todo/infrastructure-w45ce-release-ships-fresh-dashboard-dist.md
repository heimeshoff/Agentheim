---
id: infrastructure-w45ce
title: A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
status: todo
type: bug
context: infrastructure
created: 2026-09-05
completed:
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

- [ ] `RELEASE.md` has an explicit, ordered "rebuild + verify + stage `dashboard/dist/`"
      step ahead of the `chore(release): vX.Y.Z` commit, and ADR-0013 is amended to cover the
      dashboard bundle and the marketplace-copies-`main` behaviour.
- [ ] A `node --test` check (stdlib-only at check time) fails on a tree whose `dashboard/dist/`
      is older than any of its declared inputs, and passes right after `npm run build`. The
      failure text names the rebuild command.
- [ ] The check is exercised in the existing suite path the verifier runs. A worker who
      changes `dashboard/app/` without a rebuild must not be blocked by it (the ADR-0057 guard
      still drops the rebuild at checkpoint); instead the check reads red on `main` until the
      builder's rebuild lands. Document this interplay in the check's header and in the
      q7v3k/ADR-0057 doctrine so the two guards are read as complementary, not contradictory.
- [ ] `main`'s committed `dist/` is rebuilt from current sources in this task and the check
      is green afterwards. [human-eye] A `/dashboard` launch from a fresh marketplace install
      of the next release shows the post-p5k9m behaviour (a Modeling-tab launch named from the
      typed text alone, no `Modeling:` prefix).
- [ ] The derived-artifact guard (`lib/derived-artifact-guard.mjs`) still drops
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
