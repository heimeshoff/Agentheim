---
id: infrastructure-rgknz
title: The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it
status: done
type: bug
context: infrastructure
created: 2026-09-05
completed: 2026-09-05
depends_on: []
blocks: []
tags: [plugin, marketplace, dashboard, runtime, runfile, launch, consumer-install]
related_adrs: [0002, 0053]
related_research: []
prior_art: [infrastructure-010, infrastructure-008, infrastructure-019, infrastructure-v8r3q]
---

## Why

`launch.mjs` reuses any live server it finds in the runfile
(`.agentheim/.dashboard/runtime.json` = `{ pid, port, startedAt }`) — "reuses a live server,
replaces a stale one", where *stale* means only "pid is dead". The runfile records **no
plugin version and no plugin root**. So after a marketplace update in a consumer project:

- the dashboard process spawned from the **previous** version's cache dir is still alive;
- `/dashboard` resolves the **newest** cache dir by semver (infrastructure-010) but then reads
  the runfile, sees a live pid, and reports `already running` — the builder gets the old UI;
- worse, if the marketplace removed the previous version's cache dir on update (the cache on
  this machine holds exactly one version dir), the old process's `assetRoot` is a path that
  no longer exists — `static.mjs` reads `dist/` per request from `path.join(__dirname,
  'dist')`, so every asset request 404s ("Dashboard assets not built yet") while the runfile
  still claims a healthy runtime.

Either way the builder's experience matches the field report: "I updated the plugin and the
dashboard didn't update." Sibling infrastructure-w45ce fixes what gets *shipped*; this task
fixes what gets *served* once a newer version is on disk.

## What

Make version skew between the live runtime and the installed plugin a **replace** condition,
not a reuse:

- The runfile gains the serving process's plugin version (from the cache dir's
  `.claude-plugin/plugin.json`) and its resolved plugin root:
  `{ pid, port, startedAt, pluginVersion, pluginRoot }`. Older runfiles without the fields
  are treated as "unknown → replace" (fail toward freshness).
- `launch.mjs`'s reuse decision compares the runfile's version/root against the launcher's
  own (the newest semver-max cache dir the `/dashboard` bootstrap resolved). Mismatch → stop
  the old pid through the existing external kill path, then launch fresh, and say so:
  `replaced <old-version> → <new-version>`.
- `status` reports the serving version next to pid/port so skew is visible without a launch.
- Optional, only if cheap: expose the serving version on the read API so the About page can
  show it.

## Acceptance criteria

- [ ] `runtime.json` written by `serve.mjs` carries `pluginVersion` and `pluginRoot`; the
      runfile reader tolerates their absence.
- [ ] Given a live runfile whose `pluginVersion` differs from the launcher's version, `launch`
      stops the old process, launches a new one, and reports `replaced`; given equal versions
      it still reports `already running`. Unit-tested on the pure decision, integration-tested
      on the foreign-project seam infrastructure-009/010 established (runfile lands under the
      consumer project).
- [ ] `status` prints the serving plugin version.
- [ ] A dead-`assetRoot` runtime (old cache dir removed) is detected as replace-worthy, not
      reused — via the version mismatch above or an explicit `existsSync(assetRoot)` probe at
      launch.
- [ ] `commands/dashboard.md` and the infrastructure README's **Runfile** / **Launch / Stop**
      entries describe the version-aware reuse rule; ADR-0002 gets an addendum.
- [ ] `static.mjs` sends `Cache-Control: no-cache` on every asset response (today it sends no
      cache headers at all), so a browser or VS Code Simple Browser tab left open across an
      update revalidates `app.js` against the new server instead of replaying a cached bundle.
      Cheap hardening, one header, covered by an existing static-handler test.

## Notes

- **Builder's answer (2026-09-05 refine):** the observed symptom was "the dashboard didn't
  load the newest version" — old UI, no `already running` message noticed. That is consistent
  with every mechanism this task and w45ce cover, and it also fits the simplest reading,
  which is not a bug in this task: **no release has been cut since v0.9.2 (2026-07-13)**, so
  the marketplace has nothing newer to install — the consumer cache stays at `main@bc47e66`
  however often `/plugin` is updated, because `plugin.json` still says `0.9.2` (ADR-0013's
  "manifest may lag `main`"). Cutting the next release (with w45ce's fresh `dist/`) is the
  actual unblock for that reading; this task makes sure that once a newer version *is* on
  disk, the runtime serves it rather than an older live process.
- Marketplace treatment of the previous version dir on update (removed vs kept) is still
  unconfirmed — the cache on this machine holds only `0.9.2`. The fix does not depend on the
  answer: version mismatch replaces either way, and the `assetRoot` probe covers removal.
- Reuse/replace on version skew is the dashboard analogue of infrastructure-v8r3q's bridge
  capability handshake: the answering process reports what *it* is, and the caller decides
  from a live signal rather than from an on-disk assumption.
- ADR-0002 gets a new dated addendum ("version-aware reuse", 2026-09-05) at the end of the
  file, following the infrastructure-019 addendum pattern.

## Outcome

The runfile now carries the serving process's plugin identity —
`{ pid, port, startedAt, pluginVersion, pluginRoot }` — computed by a new shared,
stdlib-only, injectable resolver `dashboard/plugin-version.mjs`
(`resolvePluginRoot(moduleDir)` = `path.resolve(moduleDir, '..')`,
`readPluginVersion(pluginRoot)` reads `.claude-plugin/plugin.json`'s `version`, `null` on
any failure). `serve.mjs` writes both fields at bind time; `server.mjs` reuses the same
resolver to expose `version` on `GET /healthz`, cheaply, for a future About-page display.

`launch.mjs` gained a pure, unit-tested `decideReuseOrReplace(existing, launcher,
rootExists)` — no I/O, `rootExists` probed by the caller via `existsSync` on the runfile's
`pluginRoot` — that reuses ONLY on equal `pluginVersion` AND an existing `pluginRoot`;
every other case (missing fields on an older runfile, a `pluginRoot` that no longer exists,
or a version mismatch) is a replace: the outgoing pid is stopped through the existing
`terminate` path, a fresh server is spawned, and the CLI reports `replaced <old> → <new>`.
A dead pid is unaffected — `inspectExisting`'s existing stale-reap runs first, unchanged.
`status` now prints the serving `pluginVersion` alongside pid/port.

`static.mjs` sends `Cache-Control: no-cache` on every asset and index response (previously
none), so a tab left open across a plugin update revalidates against the new server rather
than replaying a cached bundle.

Documentation: `commands/dashboard.md` gained a "Version-aware reuse" section;
the infrastructure README's **Launch / Stop** and **Runfile** entries were updated in place
(new prose, no restructuring); ADR-0002 gained a new dated addendum
("Addendum — version-aware reuse (2026-09-05, infrastructure-rgknz)") at the end of the
file, following the infrastructure-019 addendum pattern — it also records a verification
note: Node resolves an ES module loaded through a symlink/junction to its REAL path for
`import.meta.url` (confirmed empirically), so the foreign-project seam's symlinked fake-cache
harness cannot simulate two genuinely different on-disk plugin versions; the version-skew
integration test therefore forces the skew directly on the written runfile (same live pid, a
manipulated `pluginVersion`) while still running at the real foreign-project +
env-independent-resolver + literal card-command seam and asserting the runfile lands under
the consumer project.

Key files:
- `dashboard/plugin-version.mjs` (new) + `dashboard/test/plugin-version.test.mjs` (new)
- `dashboard/runfile.mjs` (writeRunfile carries pluginVersion/pluginRoot) +
  `dashboard/test/runfile.test.mjs` (round-trip + absence-tolerance tests)
- `dashboard/launch.mjs` (`decideReuseOrReplace`, replace-branch in `launchDashboard`,
  `statusDashboard` reports `pluginVersion`, CLI reports `replaced <old> → <new>`) +
  `dashboard/test/launch.test.mjs` (pure-decision tests + live replace-flow test)
- `dashboard/test/foreign-launch-version-skew.test.mjs` (new — foreign-project seam
  integration test)
- `dashboard/serve.mjs` (writes pluginVersion/pluginRoot at bind time)
- `dashboard/server.mjs` (`GET /healthz` exposes `version`) +
  `dashboard/test/server.test.mjs` (healthz version test + Cache-Control tests)
- `dashboard/static.mjs` (`Cache-Control: no-cache` on asset + index responses)
- `commands/dashboard.md`, `.agentheim/contexts/infrastructure/README.md`,
  `.agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md`

No new backlog items. The optional read-API version exposure was cheap (one field on the
existing `/healthz` endpoint, computed via the same shared resolver already needed
elsewhere) and was included rather than skipped.
