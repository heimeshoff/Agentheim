---
topic: Structuring a GitHub README for a developer tool (Claude Code plugin + VS Code), with install, philosophy, and dashboard screenshot
date: 2026-06-18
requested_by: user
related_tasks: []
---

# Research: Structuring a GitHub README for Agentheim

## Question
What is a good way to structure a GitHub README for a developer tool — specifically a Claude Code plugin + VS Code-style tool — that must explain installation across multiple environments (Claude Code and VS Code), convey the idea/philosophy and how it works, and show a screenshot of a dashboard? How do well-regarded projects do this?

## Summary
- **Use the proven section order**: logo/tagline + badges → hero screenshot/GIF (above the fold) → one-paragraph "what & why" → Quick Start/Install → How it works / Philosophy → Usage → deeper links → Contributing → License. This is the consensus across makeareadme.com, freeCodeCamp, and the awesome-readme exemplars.
- **For multi-environment install (Claude Code plugin + VS Code), give each its own labeled subsection and collapse the long one** with `<details>`. `charmbracelet/gum` is the gold-standard pattern: simplest path first, advanced/OS-specific paths folded away.
- **The screenshot goes near the top**, right after badges/tagline, with descriptive alt text, ideally inside a `<picture>` element so it renders well in both light and dark GitHub themes.
- **A short "How it works / Philosophy" section is worth it for an opinionated tool like Agentheim** — but keep it to a few paragraphs or one diagram. The strong examples put philosophy in the tagline + short intro and defer depth to external docs.
- **Claude Code plugin install is a two-step**: add the marketplace by `owner/repo`, then install the named plugin — quote it exactly rather than paraphrase (load-bearing, primary-sourced).

## Findings

### 1. Conventional structure & section ordering
makeareadme.com's canonical order: Name → Description → Badges → Visuals → Installation → Usage → Support → Roadmap → Contributing → Authors → License → Project status [1]. freeCodeCamp and DEV guides converge on the same skeleton, add that a **table of contents** is worth it once the README gets long, and that the README must answer **what / why / how**, broken up with headers and bullets rather than walls of text [2][3].

**Above the fold** (what a visitor sees before scrolling) should carry: a self-explanatory name/logo, a one-line tagline, badges, and a hero visual — visitors decide within seconds whether to keep reading [3][6]. Exemplars confirm this: httpie opens with logo → tagline ("human-friendly HTTP client for the API era") → badge row → animated GIF, then a brief intro [4]. gum opens with tagline ("A tool for glamorous shell scripts") + badges, then jumps to a practical example before install [5].

A real disagreement in ordering: makeareadme puts **Install before Usage**, but gum deliberately shows a **tutorial/example before installation** so readers understand *why* before *how* [5]. For an opinionated workflow tool, leading with a glimpse of the idea before install is defensible.

### 2. Multi-environment installation (Claude Code plugin + VS Code)
No single authority covers "install across multiple clients," but the cross-checked best practice from gum and opencode is:
- **One install heading, with a clearly labeled subsection per environment** (e.g. `### In Claude Code`, `### In VS Code`). opencode presents npm / Homebrew / Scoop / Pacman / Nix / desktop installers as distinct labeled paths under one Installation section [7].
- **Simplest path first, complex paths collapsed.** gum lists one-line package-manager installs inline, then puts multi-step Debian/Fedora setups inside `<details>` collapsible blocks [5]. This is the key technique here: the Claude Code one-liner stays visible; longer VS Code or manual setup folds away.
- **Each environment gets a copy-pasteable command block**, not prose.

For the **Claude Code plugin** path, the authoritative install pattern (Anthropic docs) is two-step: add the marketplace by GitHub `owner/repo` shorthand, then install the named plugin [8]:

```
/plugin marketplace add heimeshoff/agentheim
/plugin install agentheim@agentheim
```

The marketplace name after `@` is whatever `.claude-plugin/marketplace.json` declares — confirm it matches before publishing. Mention that users run `/reload-plugins` to activate, and that plugin commands are namespaced by plugin name (e.g. `/agentheim:...`) [8]. Primary-sourced and load-bearing — quote it exactly.

For the **VS Code** path, follow VS Code marketplace README conventions: state what it does, show a feature screenshot/GIF, give install steps, and note that the same README renders on both GitHub and the VS Marketplace (so verify rendering, and prefer images committed to the repo with relative paths that `vsce` rewrites via the `repository` field) [9][10].

### 3. Conveying the idea / philosophy / how it works
Strong exemplars keep philosophy **lightweight and front-loaded**, not a dissertation:
- The **tagline does most of the work** — httpie and gum encode their philosophy in a single descriptive line rather than a section [4][5].
- A **short intro paragraph** after the hero image states what it is, who it's for, and the core idea [1][2].
- Deeper philosophy / how-it-works is typically a **brief dedicated section or a small conceptual diagram**, with depth deferred to external docs [4][5][7].

For Agentheim (an opinionated agentic DDD workflow), a short **"How it works"** section — ideally with one diagram showing the plugin ↔ workflow ↔ local dashboard loop — fits this pattern, since the value isn't obvious from a tagline alone. "Readme Driven Development" (Tom Preston-Werner) and "Art of Readme" are the canonical essays on this conceptual framing [11].

### 4. Screenshots & visual media
Cross-checked best practices [3][6][12]:
- **Placement**: near the top, immediately after badges/tagline — the hero visual sells the tool in the first seconds.
- **Alt text always**, descriptive: `alt="Agentheim dashboard showing the workflow board"` not `alt="screenshot"` — for accessibility and broken-link fallback [3][6].
- **GIF vs static**: a GIF demonstrating the workflow communicates more than a static shot; a clean static screenshot of the **dashboard** is ideal as the hero (dashboards photograph well static). Do both — static hero up top, GIF demo lower down. Capture tools cited: ScreenToGif, vhs, Gifski [11].
- **Hosting**: for a few small images, commit them to the repo (e.g. `docs/` or `.github/`) and reference with **relative paths** — versioned and `vsce`-compatible. For many/large assets, external hosting is preferred [12]. Max single GIF/MP4 on GitHub is 50 MB; compress images (e.g. TinyPNG) to avoid throttling [3]. ⚠️ UNVERIFIED (the 50 MB figure could not be confirmed against a primary GitHub docs page during review).
- **Light/dark mode**: dashboard screenshots with a fixed background can look bad in the opposite theme. Use a `<picture>` element [13]:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/dashboard-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/dashboard-light.png">
  <img alt="Agentheim dashboard" src="docs/dashboard-light.png">
</picture>
```

The `<img>` fallback is mandatory for renderers that don't support `<picture>` or `prefers-color-scheme` [13].

### 5. Exemplary READMEs to model on
- **gum** (`charmbracelet/gum`) — best-in-class for **multi-platform install without overwhelm** (collapsible `<details>`, simplest-first ordering) and tagline-driven philosophy; example-before-install flow [5].
- **httpie** (`httpie/cli`) — clean above-the-fold (logo → tagline → badges → GIF), philosophy in the tagline, depth deferred to docs [4].
- **opencode** (`sst/opencode`) — directly analogous AI dev tool: multiple labeled install paths under one section, short concept explanation, docs deferred externally [7].
- **awesome-readme** (`matiassingers/awesome-readme`) — curates 100+ exemplars and the canonical guide essays [11].

### 6. GitHub-specific conventions
- **Badges** via Shields.io (version, license, build, downloads) — keep the row short and meaningful [1].
- **Table of contents** once the README scrolls several screens [2][3].
- **Collapsible sections** via `<details><summary>…</summary>…</details>` for long install/advanced material — the single most useful tool for the multi-environment install problem [5].
- **Relative image paths** for repo-committed assets (versioned, marketplace-compatible) vs hosted URLs for large media [12].
- **Light/dark images** via `<picture>` + `prefers-color-scheme`, always with an `<img>` fallback [13].
- **Repo social preview**: set a custom social preview image in repo Settings so shared links show a branded card (a GitHub repo feature, outside the README itself).
- VS Code marketplace also expects **LICENSE, CHANGELOG.md, and SUPPORT.md** at the root for a complete listing [9].

## Sources
1. [makeareadme.com](https://www.makeareadme.com/) — canonical section order and install/usage/visuals guidance.
2. [freeCodeCamp: How to Write a Good README](https://www.freecodecamp.org/news/how-to-write-a-good-readme-file/) — what/why/how, TOC, scannability.
3. [DEV: 15 Essential Sections Every README Needs](https://dev.to/georgekobaidze/15-essential-sections-every-readme-needs-give-your-project-what-it-deserves-fie) — section checklist, alt text, image sizing.
4. [httpie/cli README](https://github.com/httpie/cli) — above-the-fold example, tagline-as-philosophy, deferred docs.
5. [charmbracelet/gum README](https://github.com/charmbracelet/gum) — multi-platform install with collapsibles; example-before-install.
6. [Medium: Make Your Readme Better with Images and GIFs](https://medium.com/@alenanikulina0/make-your-readme-better-with-images-and-gifs-b141bd54bff3) — image placement and alt text.
7. [sst/opencode README](https://github.com/sst/opencode) — analogous AI dev tool, multi-environment install layout.
8. [Claude Code Docs: Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) — authoritative `/plugin marketplace add` + `/plugin install` syntax (primary source).
9. [VS Code: Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) — marketplace README, relative-path rewriting, LICENSE/CHANGELOG/SUPPORT.
10. [VS Code: Extension Marketplace](https://code.visualstudio.com/docs/editor/extension-marketplace) — extensions surface their README on the marketplace page.
11. [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) — curated exemplars and canonical essays (Art of Readme, RDD).
12. [AgentGIF: Embed GIFs in GitHub README](https://agentgif.com/guides/embed-gif-github-readme/) — repo-hosted vs external image hosting tradeoffs.
13. [GitHub Blog: Light/dark mode images in Markdown](https://github.blog/developer-skills/github/how-to-make-your-images-in-markdown-on-github-adjust-for-dark-mode-and-light-mode/) — exact `<picture>` + `prefers-color-scheme` syntax (primary source).

## Open questions
- **Exact marketplace name** for the `@` suffix in the Claude Code install command depends on Agentheim's `.claude-plugin/marketplace.json` — verify against the repo before publishing.
- **Whether Agentheim actually ships a VS Code *extension*** vs. just runs alongside VS Code wasn't confirmable from the web. If there's no published marketplace extension, the VS Code section should describe how it's used inside VS Code rather than an extension install.

## Unverified claims
- The **50 MB max single GIF/MP4 upload size on GitHub** could not be settled against a primary GitHub docs page during review; marked `⚠️ UNVERIFIED` inline in Findings §4.
