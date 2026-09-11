---
id: design-system-003
title: Vendor the dashboard's webfonts offline (local @font-face, drop the Google Fonts CDN @import)
status: done
type: chore
context: design-system
created: 2026-06-06
completed: 2026-06-06
commit: e9a41cc
depends_on: []
blocks: []
tags: [styleguide, design-system, fonts, offline, css, frontend]
related_adrs: [ADR-0003, ADR-0008]
related_research: []
prior_art: [design-system-001, design-system-002]
---

## Why

`infrastructure-002` (esbuild → committed `dashboard/dist/`, commit `e37dac9`) made the
dashboard's **framework** fully offline — React / ReactDOM / `marked` / `htm` are bundled in,
no CDN, no Babel at view time. But one network dependency survives at view time: the
styleguide token CSS still pulls **webfonts** from the Google Fonts CDN.

`styleguide/styles/colors_and_type.css` `@import`s **Inter Tight** and **JetBrains Mono**
from `fonts.googleapis.com`. So opening the dashboard (or the canvas) still hits the network
for fonts — and on a genuinely offline machine the type falls back to system fonts, breaking
visual fidelity to the approved styleguide (JetBrains Mono is load-bearing for the
`AGH-128` / `ADR-0007` ID treatment).

This was surfaced as a documented residual during `infrastructure-002` verification. It lives
in **design-system** because the token CSS is this BC's owned, single-source-of-truth artifact
— infrastructure bundles that CSS verbatim and must not edit it (ADR-0003's single-source
rule). The fix is a design-system source change; the dashboard dist then picks it up on the
next `infrastructure-002` rebuild.

## What

Replace the runtime Google Fonts CDN `@import` with **locally committed font files** and
`@font-face` rules, so the styleguide (and therefore the bundled dashboard) renders with the
correct type **with no network access at view time**.

- Commit the needed **woff2** files for Inter Tight and JetBrains Mono (only the weights/styles
  the styleguide actually uses — check the current `@import` URL's `wght` axis and the CSS for
  which weights are referenced; don't vendor the whole family).
- Add `@font-face` declarations in the design-system token CSS pointing at the local files;
  remove the `fonts.googleapis.com` `@import`.
- Keep the **same families, weights, and rendering** — this is a delivery-mechanism change,
  not a type-design change. Tokens (the type scale, the `--font-*` variables) are unchanged.

## Acceptance criteria

- [ ] No `fonts.googleapis.com` / `fonts.gstatic.com` (or any CDN) reference remains in
      `styleguide/styles/*.css`; the `@import` is gone.
- [ ] The required Inter Tight + JetBrains Mono **woff2** files are committed in the
      design-system source (a sensible location under `styleguide/`, e.g. `styleguide/fonts/`),
      and referenced by local-path `@font-face` rules.
- [ ] Only the weights/styles the styleguide uses are vendored (no whole-family dump).
- [ ] The buildless canvas (`styleguide/index.html`) renders the correct fonts **with the
      network disabled** — no FOUT-to-system-font, no 404s.
- [ ] After an `infrastructure-002` rebuild, the committed `dashboard/dist/` serves the fonts
      locally and the dashboard renders the correct type **fully offline** (close the last
      view-time network dependency).
- [ ] Visual parity with the approved styleguide is preserved (same type everywhere,
      especially the JetBrains Mono ID treatment).

## Notes

- **Re-approval / gate:** this edits the gated styleguide source (`colors_and_type.css`),
  reopening the approved artifact like `design-system-002` did. The visual delta should be
  *nil* (same fonts, local delivery), so expect at most a lightweight builder re-confirmation
  rather than a full re-review — but the styleguide gate still applies. See `design-system-002`
  for how the last re-approval was handled.
- **Downstream rebuild:** `infrastructure-002` bundles the token CSS verbatim into
  `dashboard/dist/`. After this change, `dist/` must be **rebuilt and re-committed**
  (`cd dashboard && npm install && npm run build`) for the dashboard to pick up the local
  fonts. The build also currently **copies** the two token CSS files into `dist/` — confirm the
  local font paths resolve correctly once served from `dashboard/dist/` (relative paths must be
  valid from the dist root, or the fonts must be copied into dist alongside the CSS). Settle
  this path question during the work — it may need a one-line tweak to `dashboard/build.mjs`,
  which is **infrastructure**'s file, so coordinate the seam (this task owns the source/CSS; the
  dist-copy mechanics belong to infrastructure-002's pipeline).
- **Licensing:** Inter Tight and JetBrains Mono are both OFL-licensed and redistributable —
  committing the woff2 files is fine; include the license/attribution as the OFL requires.
- **Source of the fonts:** fetch the exact woff2 the current Google Fonts `@import` resolves to
  (so glyph coverage/hinting matches), or the upstream releases (rsms/inter, JetBrains/JetBrainsMono).
- **Why backlog, not todo:** captured as a tracked residual, not yet queued for work (builder's
  call). Concrete enough to promote when wanted.

## Outcome

The styleguide's webfonts are now vendored locally — the last view-time network dependency
is closed. Both the buildless canvas and the bundled dashboard render the correct type fully
offline.

**What was done:**

- Dropped the `fonts.googleapis.com` `@import` from `styleguide/styles/colors_and_type.css`
  and replaced it with two local `@font-face` rules.
- Vendored the **Google Fonts `latin`-subset woff2** for each family under
  `styleguide/styles/fonts/`:
  - `InterTight-latin.woff2` (44 KB) — Inter Tight, variable font; `@font-face` declares
    `font-weight: 100 900`, covering the tokens' 400/500/600.
  - `JetBrainsMono-latin.woff2` (31 KB) — JetBrains Mono, variable font; `@font-face`
    declares `font-weight: 100 800`, covering the tokens' 400/500.
  - One file per family because the Google woff2 are variable along the weight axis; only
    the latin subset is shipped (styleguide content is latin-only). Both validated as real
    woff2 (`wOF2` signature, internal length == file length).
- Committed the **OFL 1.1 licenses** beside the fonts: `InterTight-OFL.txt`,
  `JetBrainsMono-OFL.txt`.
- **Path resolution / dist-copy (the ADR-0003 seam):** the `@font-face` `url()` is
  `fonts/<file>.woff2`, relative to the CSS, so it resolves identically in both consumers —
  `styleguide/styles/fonts/` for the source canvas, and `dashboard/dist/fonts/` for the
  bundle. infrastructure's `dashboard/build.mjs` copies the token CSS to the dist **root**
  (flat), so I added a one-line `cp(styles/fonts → dist/fonts)` step mirroring the existing
  CSS copy (trivial, certain path-copy on the consuming side). Rebuilt and re-committed
  `dashboard/dist/` (`node build.mjs`); verified `dist/fonts/` holds the woff2 + licenses
  and the dist CSS references `fonts/…woff2` resolving from the dist root.
- Confirmed **no** `fonts.googleapis.com` / `fonts.gstatic.com` / `@import` remains in
  `styleguide/styles/*.css`.

**Key files:** `styleguide/styles/colors_and_type.css`,
`styleguide/styles/fonts/{InterTight,JetBrainsMono}-latin.woff2` + `*-OFL.txt`,
`dashboard/build.mjs`, `dashboard/dist/` (rebuilt). Decision recorded in
ADR-0008 (`.agentheim/knowledge/decisions/0008-vendored-webfonts-latin-subset.md`).

**Gate:** this edits the gated `colors_and_type.css`, reopening the styleguide gate (as
`design-system-002` did). Visual delta is nil — same families/weights, local delivery — so
expect a lightweight builder re-confirm. **Re-confirmed by the builder 2026-06-06** — the gate
stands open against the now-fully-offline styleguide.
