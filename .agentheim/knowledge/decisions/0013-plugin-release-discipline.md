---
id: ADR-0013
title: Plugin release discipline — manifest bump bound to a versioned git tag, by checklist
scope: infrastructure
status: accepted
date: 2026-06-08
related_tasks: [infrastructure-005, infrastructure-006, infrastructure-w45ce]
related_adrs: [0003, 0057]
---

# ADR-0013: Plugin release discipline — manifest bump bound to a versioned git tag, by checklist

## Context

Agentheim is a Claude Code plugin distributed as **markdown and prompts** through the
plugin marketplace. The marketplace decides whether a user is up to date by reading a
single number: `version` in `.claude-plugin/plugin.json`. `marketplace.json` carries **no**
version field (confirmed by recon in infrastructure-006), so `plugin.json` `version` is the
**sole** version source and the only thing this policy governs.

That number silently drifted ~30 commits behind `main` (infrastructure-005). Feature work
landed, but nothing bumped the manifest, so `/plugin` told every marketplace user *"already
at latest version"* and they stalled on stale code — a contributor on a fresh macOS clone
had to mirror the cache by hand to get current. Worse, the marketplace **caches** the last
seen version: until the manifest number actually moves *and is pushed*, the cache keeps
answering "already at latest," so the staleness is invisible from the user side.

Nothing in the workflow forces a bump, so without a policy this **will** recur.
infrastructure-005 shipped the patch (bumped `0.7.0 → 0.8.0`); this ADR records the policy
that stops the next drift.

The repo has no CI and no git hooks today, but a GitHub remote (`heimeshoff/agentheim`)
exists, so a CI backstop *was* feasible. It was deliberately not chosen — see Alternatives.

## Decision

### Mechanism — a documented release checklist, not tooling

Release discipline is enforced by a **documented, human-run checklist** (`RELEASE.md` at the
repo root), not by automation. This is a deliberate choice of the cheap, zero-infrastructure
path: it would otherwise be the repo's *first* piece of CI, for a plugin that has no build
to gate. We accept that it leans on discipline rather than enforcement, and bind that
discipline to the one act that can't be silently skipped (below).

### Trigger — a release is cutting a `vX.Y.Z` git tag, deliberately

The manifest is **not** bumped on every commit. It is **allowed to lag `main`** between
releases. The bump happens only when the builder decides to **cut a release**, and a release
is defined as exactly one unforgettable act: **tagging `vX.Y.Z`**.

`RELEASE.md` *is* the definition of how that tag is cut — bumping `plugin.json` `version` is
step one of cutting the tag. So the bump cannot be skipped without skipping the act of
releasing itself. The tag string must match `plugin.json` `version` exactly (`v0.8.0` ⇔
`"version": "0.8.0"`). This gives "release" a recognizable shape and leaves a `git tag`
trail that documents every release after the fact.

### Semver convention for a code-less plugin

Agentheim has no code API, so semver is defined against the **plugin contract** — the surface
a user or downstream automation depends on (skills, commands, the artifact/folder layout the
skills assume):

- **patch (`x.y.Z`)** — documentation, prompt copy, and wording fixes that change *how* a
  skill behaves only by clarification; no new capability, no contract change.
- **minor (`x.Y.0`)** — a new capability that is **additive**: a new skill, a new command,
  a new BC capability, a new feature. Existing skills/commands keep working unchanged.
- **major (`X.0.0`)** — a **breaking** change to the plugin contract: a removed or renamed
  skill, a changed/removed command surface, or a change to the `.agentheim/` layout that
  breaks projects already on the previous version.

When in doubt between minor and patch, prefer **minor** (additive capability is the common
case and under-signalling a new skill as a patch hides it from users). When in doubt between
major and minor, prefer **major** (over-signalling a break is safe; under-signalling one
strands users).

## Consequences

**Positive**

- Zero new infrastructure; nothing to build, install, or maintain.
- The bump is bound to a visible, deliberate act (tagging), the strongest "don't forget"
  short of CI, and leaves an auditable tag history of releases.
- One version source (`plugin.json` `version`), one tag convention — no second number to
  keep in sync.
- A future contributor finds the rule both in this ADR and in a discoverable top-level
  `RELEASE.md` linked from the infrastructure BC README.

**Negative / accepted residual risk**

- A checklist run from memory is the **same failure class** as today's drift — the bump can
  still be forgotten if the builder skips `RELEASE.md`. This is mitigated, not eliminated,
  by binding it to the tag act.
- The manifest legitimately lagging `main` between releases means `main` is not always the
  "released" state; the tag, not `HEAD`, marks what shipped.

**Neutral**

- The escalation path if drift recurs despite the checklist is the rejected CI backstop —
  revisit *then*, not now.

## Alternatives considered

- **CI guard (GitHub Action asserting the manifest bumped / tag-matches-manifest).** The
  only option that *enforces* rather than relies on discipline, and feasible given the
  existing remote. Rejected for now: it would be the repo's first CI, infrastructure cost a
  zero-runtime markdown plugin doesn't yet warrant. Held as the documented escalation path.
- **Commit-derived / auto-incremented version (derive from commit count or conventional
  commits).** Removes the manual step entirely. Rejected: couples the marketplace number to
  commit cadence, so the manifest churns on every commit and "released" loses meaning;
  also needs tooling, defeating the zero-infra goal.
- **Local git pre-commit / pre-push hook.** Rejected as insufficient: a hook protects only
  the machine it is installed on, so a contributor on a fresh clone — exactly the macOS case
  that triggered this — is unprotected. Not portable, not a policy.
- **A second version source (e.g. a `version` in `marketplace.json` or a README badge).**
  Rejected: `plugin.json` `version` is the only number the marketplace reads; a second source
  invites exactly the drift this ADR exists to prevent.

## Scope note

This ADR records the decision. Its concrete artifacts are `RELEASE.md` (the ordered checklist
the builder runs) at the repo root and the infrastructure BC README pointer to it. There is
**no follow-up tooling task** — enforcement is doc-only by design.

## Amendment (infrastructure-w45ce): the dashboard bundle is part of the release contract

**Finding.** The plugin contract this ADR's semver convention governs is not only skills,
commands, and `.agentheim/` layout — it also includes `dashboard/dist/`, the pre-bundled UI
asset set a marketplace consumer runs (ADR-0003). Nothing in the original checklist mentioned
it, so a release could — and, verified on 2026-09-05, **did** — ship a stale bundle: `main`'s
committed `dist/` lagged a merged UI change (`dashboard/app/prompt-mode.js`, 2026-07-15) by
two days at the time this was caught, with no step anywhere that would have noticed.

**Second finding, which changes what "released" means for this artifact.** The marketplace
does **not** install the tag. It copies the marketplace clone of `main` **at update time** —
verified against a live installed cache (`gitCommitSha` two commits past the `v0.9.2` tag).
So "fresh dashboard at the tag" was never the right invariant to begin with; `dashboard/dist/`
has to be fresh **on `main`** whenever a release is cut, because `main` — not the tag — is
what a marketplace update actually copies. This sharpens `RELEASE.md`'s existing "push to
main is the step that reaches users" framing: it was already true for the manifest bump, and
it is equally true for the dashboard bundle.

**Decision.** `RELEASE.md`'s checklist gains a step *before* the version-bump commit:
rebuild `dashboard/dist/` from current `main` (`cd dashboard && npm ci && npm run build`), run
the dashboard suite (which includes `dashboard/test/dist-staleness.test.mjs`, the durable half
of this discipline — see ADR-0057's amendment below), and stage the rebuilt `dist/` in its own
`chore(dashboard): rebuild dist` commit ahead of `chore(release): vX.Y.Z`. This keeps the
existing doc-only enforcement mechanism (a checklist, not CI) but adds the one artifact this
ADR's original scope missed.

**Consequence.** The escalation path already named in this ADR's Consequences section (a CI
guard, rejected for cost) now also covers "assert `dashboard/dist/` matches a fresh build" —
still not adopted; `dist-staleness.test.mjs` under the existing test suite is the interim,
already-adopted equivalent of that backstop (see ADR-0057's amendment).
