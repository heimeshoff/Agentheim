# Index

Top-level catalog of this project's bounded contexts, global decisions, and research.
For BC-scoped artifacts, see each BC's `INDEX.md`.

> Updated by: `modeling` (BC creation), `work` (global ADRs), `research` (reports tagged global / cross-BC), backfill script.
> Hand-edits are fine but the skills will append at the section markers below.

---

## Bounded contexts

<!-- bc-list:start -->
- **agentic-workflow** — running a domain-driven, human-in-the-loop agentic workflow on Claude Code; the single core context — `contexts/agentic-workflow/INDEX.md`
- **design-system** — frontend infrastructure: the styleguide and component patterns any UI-bearing feature must conform to (supporting) — `contexts/design-system/INDEX.md`
- **infrastructure** — globally-true tech/runtime concerns; currently scoped tightly to the dashboard web-server runtime & transport (supporting) — `contexts/infrastructure/INDEX.md`
<!-- bc-list:end -->

## Global ADRs (scope: global)

<!-- adr-global:start -->
- **ADR-0044 — `deriveContext` becomes digit-lead-tolerant; the leading-letter rule downgrades from parser precondition to minting rule** (2026-07-04, accepted) — amends ADR-0028 §3–§4: the resolver (`deriveContext`) loosens its token branch to `[0-9a-hjkmnp-tv-z]{5}` so an already-shipped digit-leading out-of-spec token (`infrastructure-5w5gs`) resolves, while minters get *stricter* than the parser via a new pure `lib/id-grammar.mjs` (`classifyTaskId`/`isWellFormedTaskId`/`findMalformedTaskIds` + a `node --test` live-tree lint) with a `GRANDFATHERED_IDS` allowlist. A Postel split — forgiving reader, strict writer; the leading-letter rule is now a minting rule, not a parser precondition. Implements infrastructure-m3q7k — `knowledge/decisions/0044-derivecontext-digit-lead-tolerant-resolver-stricter-minter.md`
- **ADR-0031 — Per-agent model routing: decorrelate the adversarial gates, run the executor fleet mid-tier** (2026-07-02, accepted) — pins a `model:` family (sonnet/opus) per agent: `worker`/`researcher`/`orchestrator` → sonnet, `verifier`/`research-reviewer`/`architect`/`strategic-modeler`/`tactical-modeler` → opus. Producer and its adversarial gate never share a tier (worker→verifier, researcher→research-reviewer straddle sonnet/opus), decorrelating shared confabulations; the high-volume executor runs mid-tier behind its opus judge. Family names, not pinned versions, so it survives model releases. Implements agentic-workflow-j4m6r; updates the research-review doctrine's former "pins no model" admission — `knowledge/decisions/0031-per-agent-model-routing-decorrelate-adversarial-gates.md`
- **ADR-0028 — Collision-resistant task IDs: short random token** (2026-06-17, proposed) — replaces sequential-integer task ids with a `<bc>-<token>` scheme (token = 5 chars from Crockford base32 minus look-alikes `i l o u`, leading letter `[a-hjkmnp-tv-z]`), collision-free by construction for zero-coordination multi-branch capture; legacy `<bc>-NNN` ids coexist go-forward (no rewrite). Amends ADR-0022 §5 (retirement), cross-links ADR-0012 (filename-anchored resolution). Implementation split into aw-078/079/080 — `knowledge/decisions/0028-collision-resistant-task-ids-short-random-token.md`
<!-- adr-global:end -->

## Cross-BC research

Research reports relevant to more than one BC (or to the project as a whole). BC-specific
reports are listed in each BC's `INDEX.md`.

<!-- research-global:start -->
- **Structuring a GitHub README for a developer tool (Claude Code plugin + VS Code)** (2026-06-18) — proven section order (logo/tagline + badges → hero screenshot/GIF above the fold → one-paragraph what & why → Install → How it works/Philosophy → Usage → deeper links → Contributing → License); multi-environment install via one heading with labeled per-environment subsections, simplest path inline and longer paths folded in `<details>` (gum pattern); Claude Code plugin install is two-step (`/plugin marketplace add owner/repo` then `/plugin install name@marketplace`, name from marketplace.json) + `/reload-plugins`; dashboard screenshot near top with descriptive alt text inside `<picture>` + `prefers-color-scheme` for light/dark; exemplars gum / httpie / opencode / awesome-readme — `knowledge/research/readme-structure-developer-tool-2026-06-18.md`
- **Naming a Claude Code terminal/session: local IDE tab vs cloud session** (2026-06-15) — local IDE terminal tab (always "Claude") is NOT custom-nameable: no setting/flag/env var, the CLI overwrites the title every spinner tick (manual rename / OSC / `/rename` all lose), only workaround a third-party VS Code ext (Claude Terminal Name Sync, macOS/Linux only). BUT cloud / Remote-Control sessions auto-name from the first prompt and are user-renameable — because the named object there is an Anthropic-owned session-list row, not an OS terminal tab the CLI can't own. Documents the title precedence (`--name`/`/remote-control` > `/rename` > last meaningful message > placeholder). Native local auto-titling (#47176) closed not-planned — `knowledge/research/claude-code-terminal-session-naming-2026-06-15.md`
- **Detecting a live Work session (disable the button while one runs)** (2026-06-15) — project-scoped, work-only liveness marker; a clean SessionStart/SessionEnd bracket is NOT achievable, so the robust design is a skill-frontmatter `Stop` hook writing a lock + heartbeat timestamp, with a dashboard-side staleness window (mirrors the repo's pid-liveness reaping) — `knowledge/research/work-session-presence-lock-2026-06-15.md`
- **Knowing when the Work terminal is finished** (2026-06-15) — can the read-only dashboard learn when a `/agentheim:work` terminal session is done? Compares Claude Code hooks (Stop vs SessionEnd vs SubagentStop) against VS Code terminal-lifecycle APIs and headless `-p`; the deterministic on-disk signal is a pre-configured hook that writes a file — `knowledge/research/work-terminal-completion-signal-2026-06-15.md`
- **Dashboard button → Claude Code in a VS Code terminal** (2026-06-09) — bridge options for triggering `claude` from a Simple-Browser dashboard button; recommends a tiny localhost-listener VS Code extension — `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`
<!-- research-global:end -->

## Pointers

- Vision: `vision.md`
- Context map: `context-map.md` (not warranted — single-BC domain)
- Protocol (chronological log): `knowledge/protocol.md` — newest entries on top; capped at ~1,000 lines, older months roll out verbatim to `knowledge/protocol/YYYY-MM.md` (ADR-0039)
- All ADRs: `knowledge/decisions/`
- All research: `knowledge/research/`
