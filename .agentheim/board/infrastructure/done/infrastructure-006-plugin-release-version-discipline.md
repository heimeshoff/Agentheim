---
id: infrastructure-006
title: Plugin release discipline — stop the manifest version from silently drifting
status: done
type: decision
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: e6ded37
depends_on: []
blocks: []
tags: [plugin, packaging, distribution, release, version, semver]
related_adrs: [ADR-0013]
related_research: []
prior_art: [infrastructure-005]
---

## Why

`.claude-plugin/plugin.json` `version` drifted ~30 commits behind `main` (see
infrastructure-005): feature work landed but the manifest stayed at 0.7.0, so `/plugin`
told every marketplace user *"already at latest version"* and they silently stalled on
stale code — a contributor had to mirror the cache by hand to get current. Nothing in the
workflow today forces a bump, so without a policy this *will* recur. The bump itself
(infrastructure-005) is the patch; this task decides the policy that prevents the next
drift.

## What

Record, as an ADR, the **release discipline** that keeps a marketplace user able to pull
what's intended to ship — and write the discoverable artifact that policy points at.

**Decided direction (refine pass, 2026-06-08 — builder):**

- **Mechanism: a documented release checklist.** Not a CI guard, not auto-derivation from
  commit history. A deliberate, written release procedure the builder runs. (CI was
  weighed and rejected: it would be the repo's first CI; the builder chose the cheap,
  zero-infra path and accepts that it leans on discipline.)
- **Trigger: deliberate releases, decoupled from per-commit work.** The manifest is *not*
  bumped on every commit and is allowed to lag `main` between releases. The bump happens
  when the builder decides to **cut a release**.
- **A release is one unforgettable act: cutting a `vX.Y.Z` git tag.** The checklist *is*
  the definition of how a tag is cut — so the bump can't be skipped without skipping the
  act of releasing itself. The tag must match `plugin.json` `version`. This gives the
  trigger a recognizable shape and leaves a tag trail documenting every release.

This is a `decision` task: its primary output is the ADR. Because the chosen enforcement
is *only a document* (no tooling), the worker also writes the checklist artifact itself
rather than spawning a near-empty follow-up.

## Acceptance criteria

- [ ] An ADR is recorded in `.agentheim/knowledge/decisions/` stating: mechanism =
      documented release checklist (CI guard and commit-derived versioning explicitly
      considered and rejected, with the one-line rationale for each).
- [ ] The ADR states the trigger explicitly — a release = cutting a `vX.Y.Z` git tag,
      performed deliberately by the builder; the manifest may lag `main` between releases.
- [ ] The ADR defines the semver convention for a markdown/prompt plugin (no code API):
      what counts as patch / minor / major (e.g. patch = doc/copy fixes; minor = new skill,
      BC capability, or feature; major = breaking change to the plugin contract — a removed
      skill or changed command surface). A sensible default is acceptable; the point is the
      ADR commits to *a* rule rather than leaving it implicit.
- [ ] A release checklist is written as a discoverable artifact — a top-level `RELEASE.md`
      (or equivalent) — with the ordered steps: bump `plugin.json` `version` → commit →
      push to `main` → tag `vX.Y.Z` matching the manifest. The checklist names **push to
      `main`** explicitly as the step that actually propagates to marketplace users (a bump
      that isn't pushed changes nothing).
- [ ] The infrastructure BC README points at `RELEASE.md` under Decisions / Open questions
      so a future contributor finds the rule where they'd look — not only in the ADR.
- [ ] The checklist notes the marketplace-cache behavior the contributor hit, so the policy
      is understood to move users off "already at latest", not just to change a number.

## Notes

- Spun out of infrastructure-005's open process question. 005 shipped the current bump;
  006 stops the recurrence.
- **Refine recon (2026-06-08):** only one version source exists — `marketplace.json`
  carries no `version` field, so `/plugin` reads `plugin.json` `version` alone; the policy
  governs exactly one number. No CI / git hooks / release tooling exist today; a GitHub
  remote does (`heimeshoff/agentheim`), so CI *was* feasible but was rejected in favor of
  the checklist.
- **Accepted residual risk:** a checklist run from memory is the same failure class as
  today's drift. Mitigated (not eliminated) by binding the bump to the act of tagging —
  the only thing that makes it unforgettable short of CI. If drift recurs despite the
  checklist, the escalation path is the rejected CI backstop (revisit then, not now).
- A local git pre-commit/pre-push hook was considered and is *not* sufficient: it protects
  only the machine it's installed on, so a contributor on a fresh clone (exactly the macOS
  case that triggered this) is unprotected.

## Outcome

Recorded the release-discipline decision and shipped the artifact it points at. No code; the
deliverables are documents.

- **ADR-0013** (`.agentheim/knowledge/decisions/0013-plugin-release-discipline.md`) — the
  decision of record. Mechanism = documented checklist (CI guard and commit-derived
  versioning each considered and rejected with one-line rationale; local git hook rejected as
  fresh-clone-unprotected). Trigger = a release is cutting a `vX.Y.Z` git tag matching
  `plugin.json` `version`, performed deliberately; manifest may lag `main` between releases.
  Semver convention defined against the plugin *contract* (patch = doc/copy; minor = new
  skill/command/capability; major = breaking change to the skill or command surface).
- **`RELEASE.md`** (repo root) — the discoverable ordered checklist: bump `plugin.json`
  `version` → commit → **push to `main`** (named explicitly as the step that propagates to
  marketplace users) → tag `vX.Y.Z` matching the manifest. Notes the marketplace-cache
  behaviour (users stuck on *"already at latest"* until the manifest moves **and** is pushed).
  Confirms `plugin.json` `version` is the single version source — no second one introduced.
- **Infrastructure BC README** — added the ADR-0013 entry under Decisions and resolved the
  *plugin packaging/distribution* future-remit Open question, pointing future contributors at
  `RELEASE.md` where they'd look.

Enforcement is doc-only by design; no follow-up tooling task created. The documented
escalation path if drift recurs is the rejected CI backstop.
