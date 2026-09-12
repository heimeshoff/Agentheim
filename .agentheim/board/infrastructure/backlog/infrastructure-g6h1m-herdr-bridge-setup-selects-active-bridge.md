---
id: infrastructure-g6h1m
title: Herdr bridge — the dashboard's launch buttons open a Claude session in Herdr; `/setup` selects the active bridge (VS Code, Herdr, or none) and reports it; clipboard fallback whenever the selected bridge is not live
status: backlog
type: feature
context: infrastructure
created: 2026-09-13
completed:
depends_on: [design-system-001]
blocks: []
tags: [dashboard, bridge, herdr, setup, launch, clipboard]
related_adrs: [0018, 0079, 0082]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09, claude-code-terminal-session-naming-2026-06-15]
prior_art: [infrastructure-c6fzb, infrastructure-js62b, infrastructure-x56qm, infrastructure-kr9pd, infrastructure-w6p4k]
---

## Why

Every launch button on the board (Quick Capture, Modeling, Refine, Promote, the
per-card Work button) resolves through one decision: is the VS Code bridge live?
If yes, `POST /run` opens a terminal in VS Code; if not, the slash command lands on
the clipboard (`dashboard/app/bridge-launch.js`, ADR-0018). That decision is
hard-wired to a single bridge. The builder now runs Claude sessions inside
**Herdr** (herdr.dev — "terminal workspace manager for AI coding agents", installed
here as 0.9.0), and from the dashboard in a plain browser tab the buttons can only
copy. Herdr has everything a bridge needs — a persistent server behind a local
socket, a `herdr` CLI that creates a tab with a cwd and starts a recognized
`claude` agent in its pane with raw argv — so the same button should be able to
open the session there.

The bridge choice is a per-machine fact, exactly the kind `/setup` already owns
(ADR-0079: install the CLI, install the VS Code bridge, report state). So `/setup`
is where the builder says which bridge the dashboard should use.

## What

1. **`/setup` selects the active bridge.** A new verb (working name `use bridge
   <vscode|herdr|none>`) persists the choice per machine, outside any project tree
   (ADR-0079's "user-level, once per machine" property). `status` reports the
   selection, and reports Herdr the way it already reports the VS Code bridge:
   `herdr` on PATH or not, its version, and whether its server is running
   (`herdr status` / socket present). No default is silently assumed: with no
   selection recorded, the dashboard behaves exactly as today (VS Code bridge if
   live, else clipboard), so an existing install does not change behaviour on
   upgrade.

2. **A Herdr bridge transport.** The browser cannot reach Herdr's socket, so the
   Herdr path is necessarily **server-mediated**: the dashboard's own Node runtime
   (which already knows the project root) performs the launch. Launch shape,
   verified against the installed 0.9.0 CLI:
   - `herdr tab create --cwd <project-root> --label <name> --no-focus` → root pane id
     (or a workspace, see open questions);
   - `herdr agent start <name> --kind claude --pane <pane-id> -- <argv>` where
     `<argv>` is ADR-0018's launch descriptor verbatim: `['-n', <name>, '--model',
     <id>, '--dangerously-skip-permissions', <prompt>]` with each optional pair
     present only when armed — raw argv, no shell, no escaping.
   - Herdr's live agent name grammar is `[a-z][a-z0-9_-]{0,31}` and must be unique
     among live agents — narrower than the `-n` display name (free text, ~60 chars).
     The bridge derives a Herdr-legal, unique name from the display name; the `-n`
     value stays the human one.

3. **The frontend decides by bridge kind.** `launchOrCopy` / `probeBridge` learn
   the selected bridge from the dashboard (the natural spot is `GET /api/bridge`,
   which today only speaks VS Code): `vscode` → the existing discover/health/run
   path untouched; `herdr` → a same-origin launch request the server fulfils;
   `none` or absent → clipboard. The absence contract is unchanged in spirit: the
   first failure on the selected path collapses silently to the clipboard.

4. **Parity of the extras.** `name`, `model` (closed allowlist, ADR-0018 /
   infrastructure-h5wnq), and strict-`true` `skipPermissions` ride the Herdr launch
   exactly as they ride the VS Code launch. The Herdr path advertises a
   `capabilities` set the same way `/health` does (infrastructure-v8r3q), so the
   prompt bar's model selector greys out when the selected bridge is not live or
   too old, whichever bridge is selected.

## Acceptance criteria

- [ ] `lib/setup-cli.mjs` accepts `use bridge vscode`, `use bridge herdr`, `use bridge none`, persists the choice in a per-machine location outside any project tree, and `status` JSON carries the selection plus a `herdr` key (`onPath`, `version`, `serverRunning`) mirroring the existing `bridge` key; `commands/setup.md` documents the verb.
- [ ] With `herdr` selected and the Herdr server running, every board launch button (Quick Capture, Modeling, Refine, Promote, per-card Work) opens a Claude session inside Herdr whose cwd is the project root and whose seeded prompt is byte-identical to the string the VS Code path would POST (one source of truth, `modeling-command.js`).
- [ ] `name`, `model` and `skipPermissions` reach the Herdr-launched `claude` as raw argv in ADR-0018's order, with the same closed model allowlist and strict-`true` bypass rule; a `node --test` case per field, including the rejected-value → no-flag behaviour.
- [ ] The derived Herdr agent name always satisfies `[a-z][a-z0-9_-]{0,31}` and does not collide with a live agent; unit-tested against the display names the VS Code path already derives.
- [ ] Absence contract: with `herdr` selected, each of {herdr not on PATH, server not running, tab/agent creation fails, `agent start` times out, launch request rejected} collapses silently to the clipboard fallback — `launchOrCopy` resolves `{via:'clipboard'}` and never throws; one `node --test` case per failure mode.
- [ ] With `vscode` selected or no selection recorded, behaviour is unchanged: every existing bridge test (`bridge-launch`, `bridge-api`, prompt-bar capability/DOM tests) passes without modification.
- [ ] `probeBridge` resolves `{present, capabilities}` for the selected kind, so the model selector greys out when the selected bridge is not live — DOM-tested for both kinds.
- [ ] The Herdr launch endpoint cannot be driven by an arbitrary web page: a defense equivalent to the VS Code bridge's per-activation token (token, or a same-origin check) is present and tested (a cross-origin request with a prompt is refused).
- [ ] The repo README's bridge section explains the three-way selection and the clipboard fallback in a few lines. [human-eye]

## Notes

**Superseded (2026-09-13 REFINE).** The seven open questions below were settled by ADR-0082 and
the work re-filed as three chained tasks in `todo/`: infrastructure-e8h9f (foundation: `/setup`
selection, config file, binary resolver), infrastructure-xh8tw (server: `POST /api/bridge/launch`,
token, topology), infrastructure-vpbks (frontend: `kind` dispatch, README). This parent stays only
until it is DISMISSed; the questions are kept below as the record of what was open.

**Filed to backlog** — the mechanism is clear, the design has open choices a REFINE
round (orchestrator → architect) should settle before a worker picks it up:

1. **Where the per-machine selection lives.** Candidates: a small JSON beside the
   installed CLI (`<home>/.local/bin` is a bin dir, awkward), `<home>/.agentheim/`
   (new), or the platform config dir. It must be readable by both `/setup` (write)
   and the dashboard server (read) and never land in a project tree.
2. **Server-mediated launch is a new write category?** ADR-0017 makes the dashboard
   read-only for lifecycle writes; ADR-0053 carved out "runtime self-lifecycle" for
   `POST /api/stop`. Spawning an external session is neither a lifecycle write nor
   self-lifecycle — it is the same external side-effect class as the clipboard
   copy, but performed by the server process rather than the browser. Likely an
   ADR amending ADR-0018 (bridge is now a kind, not a singleton) and naming this
   category; the architect should rule whether `GET /api/bridge` grows a `kind`
   field or a sibling endpoint is cleaner.
3. **Security.** The VS Code bridge relies on a per-activation token only the
   dashboard origin can learn. A same-origin `POST` that spawns `claude` with an
   attacker-chosen prompt and `skipPermissions:true` is a CSRF-shaped risk from any
   page on the machine. ADR-0053 chose no `Origin` check for `/api/stop`; that
   ruling should not be copied blindly here — the blast radius is different.
4. **Herdr topology.** New tab in the workspace whose cwd matches the project root
   (reuse via `herdr workspace list`), or always a fresh workspace? `tab create`
   and `workspace create` both take `--cwd`, `--label`, `--no-focus`. Default should
   probably be "tab in the matching workspace, else new workspace", never stealing
   focus.
5. **Liveness probe budget.** The VS Code path budgets ~800 ms for `/health`.
   `herdr status` is a process spawn; the server should cache liveness briefly or
   probe the socket file plus a cheap `herdr api snapshot`. `agent start` itself
   waits up to 30 s for readiness — the launch request must not block the UI on it
   (fire-and-report, like the VS Code `202`).
6. **Herdr's own guidance** says an AI agent should only drive Herdr from inside a
   Herdr pane (`HERDR_ENV=1`). That is policy for agents, not a technical gate —
   `herdr status` answers from any shell — and the bridge is a deterministic
   launcher, not an agent. Worth one line in the ADR so nobody later "fixes" it.
7. **Clipboard fallback stays the floor.** Neither bridge can carry `--model` or the
   bypass onto the clipboard (a pasted slash command has no startup flags) — the
   existing asymmetry (ADR-0018 amendment, infrastructure-h5wnq) extends unchanged.

Herdr facts verified on this machine (2026-09-13): `herdr 0.9.0`, protocol 22, server
running, socket under `%APPDATA%/herdr/herdr.sock`; `herdr agent start --kind` lists
`claude`; `herdr api schema --json` prints the full socket schema; `herdr --skill`
prints the agent-facing CLI guide. Install root `~/.herdr/packages/standalone/releases/`.

Prior art beyond the frontmatter matcher: infrastructure-h5wnq (model rides the
launch, `probeBridge`), infrastructure-v8r3q (capability handshake), agentic-workflow-020
(`bridge-launch.js`, the absence contract), agentic-workflow-g4zce (per-card Work
button). ADR-0002 (dashboard runtime), ADR-0017 (read-only board), ADR-0053 (write
categories) frame question 2.
