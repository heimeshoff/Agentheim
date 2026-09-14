---
id: infrastructure-vw66n
title: Make the README present the dashboard's three launch modes — VS Code bridge, Herdr bridge, or plain copy-to-clipboard — as equal, switchable-anytime choices via /setup use bridge, instead of burying Herdr inside the VS Code bridge section
status: done
type: chore
context: infrastructure
created: 2026-09-14
completed:
depends_on: []
blocks: []
tags: [readme, docs, setup, bridge, herdr, vscode, onboarding]
related_adrs: [0018, 0079, 0082]
related_research: []
prior_art: [infrastructure-reh04, infrastructure-vpbks, infrastructure-e8h9f]
---

## Why

v0.9.5 shipped Herdr as a first-class dashboard bridge kind (ADR-0082), but the top-level
`README.md` still tells the pre-Herdr story. The Install section (line ~33), the Status/what
shipped list (line ~183), and the Dashboard section all say `/setup` installs "optionally, the
VS Code bridge". The only Herdr mention is a single paragraph *inside* the collapsed
"Optional: VS Code bridge" `<details>` block, where it reads as a footnote to VS Code rather than
an alternative to it. A reader who doesn't use VS Code — e.g. someone living in Herdr — has no
reason to expand that block and never learns their setup is supported.

The builder wants people to know up front that they pick how dashboard launch buttons behave, and
can switch at any time with `/setup`:

- **VS Code bridge** (`vscode`, the default) — launch buttons open a real `Claude` terminal in VS Code via the bridge extension.
- **Herdr bridge** (`herdr`) — the dashboard server drives the local `herdr` CLI to open the session in Herdr; no extension install.
- **Copy to clipboard** (`none`) — no bridge at all; every launch button just copies its seeded command to paste into any terminal.

## What

Restructure the README's bridge documentation around the choice, not around VS Code:

1. **Install section** — the `/setup` paragraph names the choice: `/setup` installs the dashboard CLI
   and lets you pick how launch buttons open sessions (VS Code, Herdr, or copy-to-clipboard),
   switchable any time with `/setup use bridge <vscode|herdr|none>`.
2. **Dashboard section** — replace the single "Optional: VS Code bridge" framing with a short,
   *visible* (not collapsed) "Launch modes" explanation: the three kinds, one or two sentences each
   (what happens on click, what you need installed), the `/setup use bridge <kind>` switch command,
   that `/setup` with no argument / `status` shows the current selection, and that the clipboard
   fallback is always the floor when the selected bridge is unreachable.
3. **Per-kind detail** — keep the existing VS Code install/activate/upgrade/from-source material,
   but in its own collapsed block clearly titled for VS Code. Add a short Herdr block (prerequisite:
   Herdr installed and its server running; the dashboard server shells out to `herdr`, no
   browser-reachable listener; sessions land focused in a per-project workspace). Clipboard needs no block
   beyond its sentence in step 2.
4. **Status / shipped list and repo-layout comments** — update any remaining "optionally, the VS Code
   bridge" wording so it no longer implies VS Code is the only bridge.

Keep the README's current concise tone — no walkthrough, link ADR-0082 (and ADR-0018 for VS Code)
for depth. Documentation only: no code, no `commands/setup.md` or `lib/` changes.

## Acceptance criteria

- [ ] The Install section's `/setup` paragraph names all three launch modes (VS Code, Herdr, copy to clipboard) and the `/setup use bridge <vscode|herdr|none>` switch command.
- [ ] The Dashboard section contains a non-collapsed (outside any `<details>`) passage listing the three kinds `vscode`, `herdr`, `none`, each with what happens when a launch button is clicked, and states the selection can be changed at any time by re-running `/setup use bridge <kind>`.
- [ ] That passage says `none` means launch buttons copy the seeded command to the clipboard, and that the clipboard fallback also applies whenever the selected bridge is unreachable.
- [ ] Herdr is no longer documented only inside the VS Code `<details>` block: a Herdr-specific passage (outside the VS Code block) states its prerequisite (Herdr installed with its server running) and that no extension install is needed, linking ADR-0082.
- [ ] The existing VS Code bridge install/activate/upgrade/from-source/uninstall content is preserved, in a block whose summary names VS Code explicitly.
- [ ] `grep -n "optionally, the VS Code bridge" README.md` returns no matches, and no other README sentence states or implies VS Code is the only available bridge.
- [ ] Every relative link in the changed README sections (ADRs, `vscode-extension/README.md`, `dashboard/README.md`) resolves to a file on disk.
- [ ] Only `README.md` changes in the diff.

## Notes

- User wrote "Herder"; the product and CLI are **Herdr** (https://herdr.dev) — use that spelling.
- Source of truth for the three kinds and their semantics: ADR-0082 (§1 per-machine config
  `<home>/.config/agentheim/config.json`, `bridge: null` behaves as `vscode`; §8 clipboard floor) and
  `commands/setup.md` (`status` fields `activeBridge`, `herdr.{onPath,version,serverRunning}`).
- Prior art: infrastructure-reh04 (last README refresh, same concise-no-walkthrough brief);
  infrastructure-vpbks added the current one-paragraph Herdr mention; infrastructure-e8h9f shipped
  `/setup use bridge`.
- Current bridge text lives at README.md ~lines 33, 79, 91-121, 170-174, 183.

## Verifier note (iteration 1)

**REASONS:**
- Acceptance criterion 6's second conjunct is unmet ("no other README sentence states or implies VS Code is the only available bridge"). `README.md:104` (the `<details>` block's opening paragraph, carried over unchanged by this diff) still reads: "Because the dashboard runs inside VS Code's sandboxed Simple Browser, **the only way to reach a real, visible terminal is a tiny local VS Code bridge extension**". Post-ADR-0082 this is both an exclusivity claim and factually stale: the Herdr path reaches a real, visible terminal from that same sandboxed Simple Browser via a **same-origin** `POST /api/bridge/launch` to the dashboard's own server (per the infrastructure BC README's "Herdr-mediated launch, frontend dispatch" entry — "same origin as the dashboard itself, never `127.0.0.1:<port>`"), with no extension installed at all.
- Same paragraph, `README.md:104`: "**Without it**, the buttons **silently fall back to copying the command to the clipboard** — that's a normal mode, not an error, so installing the bridge is optional." This asserts a VS-Code-extension-or-clipboard binary. With `herdr` selected, "without it" the buttons launch through Herdr, not the clipboard, so this sentence also implies VS Code is the only bridge. The corrective sentence two lines down (`README.md:106`, "only one of three choices — see **Launch modes** above") does not repair the two claims above it; criterion 6 scopes to every README sentence, not to the section's net impression.
- Criteria 1, 2, 3, 4, 5, 7 and 8 were checked and do hold: the Install paragraph (`README.md:33`) names all three modes and the switch command; the non-collapsed `### Launch modes` section (`README.md:91-99`, outside any `<details>`) lists `vscode`/`herdr`/`none` with click behavior, switchability and the `/setup` status report; `none` = clipboard plus the unreachable-bridge floor is stated (`README.md:97,99`); the Herdr passage outside the VS Code block states the prerequisite and "no extension to install" and links ADR-0082 (`README.md:96`); the VS Code install/activate/upgrade/from-source/uninstall content is preserved under a summary naming VS Code (`README.md:101-131`); `grep -n "optionally, the VS Code bridge" README.md` returns no matches (exit 1); all six relative links in the changed regions resolve on disk; and `git show HEAD --name-only` lists `README.md` alone. The defect above is the sole blocker.

**SUGGESTED_FIX:** Rewrite the two stale sentences in the `<details>` opening paragraph at `README.md:104` so the VS Code extension is described as the way *this kind* reaches a terminal rather than "the only way" — e.g. frame the sandbox constraint as "when `vscode` is the selected mode, the dashboard reaches a real terminal through this local listener" and change "Without it, the buttons silently fall back to copying" to "without it (and with no other bridge selected), the buttons fall back to copying". No test pins this wording (`grep` for "only way to reach" / "Without it, the buttons" across `lib/test/` and `dashboard/test/` returns nothing), so the fix stays confined to `README.md`, preserving criterion 8.

**ITERATION_HINT:** likely-fixable

## Outcome

Restructured the top-level `README.md`'s bridge documentation to present `vscode` / `herdr` / `none` as three equal, switchable-anytime launch modes instead of burying Herdr as a footnote inside the VS Code bridge section:

- **Install section** (~line 33-ish paragraph on `/setup`): now names all three launch modes and the `/setup use bridge <vscode|herdr|none>` switch command.
- **Dashboard section**: added a new, non-collapsed "### Launch modes" passage (README.md lines ~91-99) listing all three kinds, what each does on click, how to switch (`/setup use bridge <kind>`), how to check the current selection, and that the clipboard fallback is always the floor when the selected bridge is unreachable.
- **Per-kind detail**: kept the existing VS Code install/activate/upgrade/from-source material inside its own collapsed `<details>` block (now clearly framed as one of three choices, with a "Three-way selection" callout linking back to Launch modes and ADR-0082), and the block already contains Herdr's prerequisite text (Herdr installed, server running, dashboard shells out to the `herdr` CLI, no browser-reachable listener, sessions land focused in a per-project workspace) per ADR-0082.
- **Status/shipped list and repo-layout comments**: updated so no remaining wording implies VS Code is the only bridge.

**Iteration 2 fix**: the verifier flagged that the VS Code `<details>` block's opening paragraph (~line 104) still said "the only way to reach a real, visible terminal is a tiny local VS Code bridge extension" and "Without it, the buttons silently fall back to copying the command to the clipboard" — both read as VS-Code-or-clipboard binary statements that contradicted the three-way framing established elsewhere. Rewrote both sentences: the extension is now described as how the `vscode` mode reaches a terminal ("When the `vscode` bridge kind is selected, it reaches a real, visible terminal... via a tiny local VS Code bridge extension"), and the fallback sentence now reads "Without it — and with no other bridge selected — the buttons fall back to copying the command to the clipboard", removing the "silently" qualifier duplication issue and the extension-or-clipboard binary implication. Re-scanned the entire README for any other sentence implying VS Code is the only bridge (searched for "only way", "only bridge", "requires... vs code", "must install", "need the... bridge", "the only", "silently") — no other instances found; the remaining "silently falls back" sentences (Launch modes passage line 99, the Three-way-selection callout line 106) already correctly describe the clipboard floor as applying to whichever of the three kinds is selected, not VS-Code-specific.

Kept `dashboard/test/readme-docs.test.mjs`'s literal-substring assertions green across both iterations. Diff is scoped to `README.md` only (verified via `git status --porcelain`). Full suite run from the worktree root (`node --test lib/test/*.test.mjs dashboard/test/*.test.mjs`): 1955 tests, 1955 pass, 0 fail — including the dashboard test files (bridge.test.mjs, foreign-launch.test.mjs, events.test.mjs, layout-migration.test.mjs) which are noted as occasionally flaky on this Windows box but ran clean this pass.
