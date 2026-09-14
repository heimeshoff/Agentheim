---
id: infrastructure-vw66n
title: Make the README present the dashboard's three launch modes — VS Code bridge, Herdr bridge, or plain copy-to-clipboard — as equal, switchable-anytime choices via /setup use bridge, instead of burying Herdr inside the VS Code bridge section
status: todo
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
