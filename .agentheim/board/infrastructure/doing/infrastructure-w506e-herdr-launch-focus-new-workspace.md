---
id: infrastructure-w506e
title: Herdr launch leaves the new session unfocused — a dashboard launch into a cold Herdr lands in an unfocused workspace, so the TUI opens on the bare home shell; pass --focus on workspace/tab create for parity with the VS Code bridge's terminal.show(), amending ADR-0082 §5
status: doing
type: bug
context: infrastructure
created: 2026-09-14
completed:
depends_on: []
blocks: []
tags: [herdr, bridge, launch, focus]
related_adrs: [0082, 0018]
related_research: []
prior_art: [infrastructure-xh8tw, infrastructure-p3k9r, infrastructure-vpbks]
---

## Why

**Builder report (2026-09-14).** With no Herdr terminal open, clicking a board launch button
made Herdr "start to open a terminal, fade in and out, then show an empty screen". Only after
opening a terminal by hand and switching workspaces was the Claude session visible — it had
been running the whole time.

**Reproduced against the live install (2026-09-14, Herdr 0.9.0, protocol 22, read-only
snapshots before/after one real `POST /api/bridge/launch`):**

1. Herdr's *server* outlives the TUI. After the builder closed their terminal, `api snapshot`
   still held one workspace — `w6`, label `marco`, one pane at `cwd: C:\Users\marco`,
   `agent_status: unknown`, `focused: true`. `focused_workspace_id` is **never null** in this
   state; a "nothing is focused" check would never fire.
2. The dashboard launch (`202 {ok:true}`) created `w9` via `workspace create … --no-focus`
   and started the Claude agent in `w9:p1` (`agent_status: idle`, `interactive_ready: true`).
   `focused_workspace_id` stayed `w6`; the agent entry reported `focused: false`.
3. A TUI client attaching to the server shows the focused workspace — `w6`, a bare home-dir
   shell with nothing in it. That *is* the "empty screen". The session sat one workspace over.
4. `workspace create --focus` works with **no** TUI client attached: the CLI returned
   `root_pane.focused: true` and `focused_workspace_id` moved to the new workspace, with no
   `no_foreground_client` error. So focusing at create time is available and cheap.

The `tab create --workspace <id> … --no-focus` branch has the same defect in miniature: a
reused workspace gets a new, non-active tab, so even a focused workspace shows the *old* tab.

**Why the rule was wrong for this caller.** ADR-0082 §5 says "Never steals focus", protecting a
builder who is mid-conversation in another Herdr pane. But a board launch is the builder's own
explicit gesture — they just asked for a session — and Herdr focus is intra-Herdr (which
workspace the TUI renders), not OS window focus; nothing pulls the builder out of the browser.
The VS Code bridge already resolves this the other way: ADR-0018's frozen mechanism is
`createTerminal()` + **`terminal.show()`** (`vscode-extension/extension.js`), i.e. it reveals the
launched terminal. The Herdr kind should have the same parity here as it already has for argv,
body shape, and the token header.

The "fading in and out" half of the report was **not** reproduced (no screen to observe from a
shell); it is recorded as builder-observed only. If the worker sees it on a cold-start check,
note it in the Outcome — it is out of scope to chase further.

## What

Make a Herdr-mediated launch focus what it just created: replace `--no-focus` with `--focus` on
both topology calls in `dashboard/bridge-launch-api.mjs`'s `handleBridgeLaunch` (the
`workspace create` and the `tab create --workspace <id>` branches, currently lines ~305-312),
so the TUI — whether already attached or opened afterwards — renders the new session. Update
the fixtures/assertions that pin `--no-focus`, and record the ADR-0082 §5 amendment.

## Acceptance criteria

- [ ] `handleBridgeLaunch` passes `--focus` (and never `--no-focus`) to both `workspace create`
      and `tab create`; a `node --test` case per branch asserts the exact argv, using the
      infrastructure-p3k9r captured fixtures (`CAPTURED_*` constants in
      `dashboard/test/bridge-launch-api.test.mjs`).
- [ ] Every existing test that pinned `--no-focus` is updated rather than deleted; the
      ADR-0018 argv-parity test and the `MODEL_ALLOWLIST` pin are untouched.
- [ ] One cold-start confirmation against the live install, recorded in the task Outcome with
      the before/after `focused_workspace_id` and the agent entry's `focused` value: with only
      the bare `marco` workspace focused, a real `POST /api/bridge/launch` ends with
      `focused_workspace_id` equal to the newly created workspace. Then close that workspace
      (`herdr workspace close <id>`) and confirm a fresh `api snapshot` carries no trace of it.
- [ ] ADR-0082 §5 is amended in place — "Never steals focus" becomes "Focuses the created
      workspace/tab — a board launch is the builder's explicit gesture, Herdr focus is
      intra-Herdr not OS focus, and this mirrors ADR-0018's `terminal.show()`" — with a dated
      amendment note naming this task. The infrastructure README bullet that quotes the
      `--no-focus` argv (the **Herdr-mediated launch — the fourth write category** bullet in
      Ubiquitous language) is updated via `README_DELTA` to say `--focus`.
- [ ] `node --test dashboard/test/*.test.mjs lib/test/*.test.mjs` passes.

## Notes

**Rejected alternative — conditional focus.** Focusing only when the currently focused pane
holds no agent (so an in-progress conversation is never covered) was considered. Rejected:
the builder clicked launch, so seeing the launched session is the expected result even when
another agent is running; VS Code's `terminal.show()` is unconditional too; and a heuristic on
`agents[].focused` adds a branch with no fixture behind it. If a future builder wants "launch
in the background", that is a body-field opt-in (`focus: false`), not the default.

**ADR amendment mechanics.** The worker never writes under `.agentheim/`. Report the ADR-0082
§5 amendment as a separate extra fenced block **after** `BACKLOG_ITEMS`, named
`ADR_0082_AMENDMENT`, containing the replacement §5 text plus the dated note — the conductor
applies it to the existing file on `main`. Do **not** put an existing ADR into the `ADRS`
block (that block is for new ADRs and goes through `finalizeAdrNumbering`).

**Binary.** `herdr` is not on Git Bash's PATH. Use
`C:\Users\marco\.herdr\packages\standalone\releases\0.9.0-x86_64-pc-windows-msvc\herdr.exe`.
`api snapshot`, `status`, `--help` are read-only. The only mutating calls this task needs are
the one real dashboard launch (through `POST /api/bridge/launch` with the token from
`GET /api/bridge` on the running dashboard, port in `.agentheim/.dashboard/runtime.json` —
restart the dashboard from the worktree-built code first, or the launch exercises the old
server) and the `workspace close` that removes what it created. Never close `w6`/`marco` or
any workspace you did not create.

**Where the evidence came from.** Snapshots T0/T1/T2 and the `--focus` probe are in the
2026-09-14 modeling session that captured this task; the probe workspaces `w9` (kink-repro)
and `wA` (kink-probe) were closed and `api snapshot` confirmed zero residue.
