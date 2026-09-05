---
id: infrastructure-rgknz
title: The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it
status: backlog
type: bug
context: infrastructure
created: 2026-09-05
completed:
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
