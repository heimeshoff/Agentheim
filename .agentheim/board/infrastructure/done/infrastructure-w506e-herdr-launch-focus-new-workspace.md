---
id: infrastructure-w506e
title: Herdr launch leaves the new session unfocused — a dashboard launch into a cold Herdr lands in an unfocused workspace, so the TUI opens on the bare home shell; pass --focus on workspace/tab create for parity with the VS Code bridge's terminal.show(), amending ADR-0082 §5
status: done
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

## Outcome

`handleBridgeLaunch` (`dashboard/bridge-launch-api.mjs`) now passes `--focus` — never
`--no-focus` — to both Herdr topology calls: the `workspace create` branch (no matching-cwd
pane) and the `tab create --workspace <id>` branch (a reused workspace). A board launch is the
builder's own explicit gesture; Herdr focus is intra-Herdr (which workspace the TUI renders),
not OS window focus, so nothing pulls the builder out of the browser — this brings the Herdr
bridge to parity with the VS Code bridge's unconditional `terminal.show()` (ADR-0018).

`dashboard/test/bridge-launch-api.test.mjs`'s two infrastructure-p3k9r "captured herdr 0.9.0
(protocol 22)" tests (one per branch) now additionally assert the exact `workspace create` /
`tab create` argv via `assert.deepEqual`, confirming `--focus` and the absence of `--no-focus`.
Verified red-without-the-fix: temporarily reverting only the production file made exactly these
two assertions fail (`assert.deepEqual` on the `--no-focus` vs `--focus` element), nothing else.
No other test that referenced `--no-focus` pinned it as an expected *argv* value (only two code
comments describing the historical p3k9r capture's literal invocation remain — those describe
what was actually run to produce that fixture, not current behavior, and are left as an accurate
historical record). The ADR-0018 argv-parity test and the `MODEL_ALLOWLIST` pin are untouched.

**Live cold-start confirmation (2026-09-14, herdr 0.9.0, protocol 22).** Machine bridge selection
was already `herdr` in `~/.config/agentheim/config.json` (untouched). Started a second dashboard
instance from this worktree (`node dashboard/launch.mjs`, port 42005, its own git-ignored
`.agentheim/.dashboard/runtime.json` inside the worktree — removed by `POST /api/stop` at the
end). `GET /api/bridge` supplied the per-process token. `herdr api snapshot` before the launch
showed `focused_workspace_id: "wB"` (this worker's own live pane; the only other workspace
present on this machine at check time — no separate bare "marco" workspace was live). A real
`POST /api/bridge/launch {"prompt":"echo focus check","name":"w506e-focus-check"}` returned
`202 {"ok":true}`; since the launch's cwd (the worktree root) matched no existing pane, it took
the `workspace create --focus` branch, creating workspace `wC`. A fresh `api snapshot` afterwards
showed `focused_workspace_id: "wC"` and the new agent entry (`name: "w506e-focus-check"`) with
`"focused": true` — the created workspace became the focused one, and the previously-focused `wB`
flipped to `"focused": false`. `herdr workspace close wC` removed it; a fresh `api snapshot`
confirmed zero residue (only `wB` remained). The "fading in and out" half of the original
builder report was not observed or chased further (out of scope per the task).

`dashboard/bridge-launch-api.mjs`'s comments above the topology `try` block were left unchanged
(they describe ADR-0082 §6's fire-and-report budget, not the focus flag). ADR-0082 §5's "Never
steals focus" text is superseded via the `ADR_0082_AMENDMENT` block in this task's RESULT — the
conductor applies it to the existing ADR file on `main`. The infrastructure README's
"Herdr-mediated launch — the fourth write category" bullet is updated via `README_DELTA` to read
`--focus` in both quoted argv fragments and to note the amendment.

`node --test dashboard/test/*.test.mjs lib/test/*.test.mjs` passes (1946/1946) on a clean final
run. One unrelated, pre-existing flake was observed during earlier runs and is NOT part of this
task's change: `lib/test/layout-migration.test.mjs`'s "migrate holds the lifecycle lock for its
whole write phase" test failed once out of four runs with a lock-contention timing race
(`legacy-layout` refusal racing a concurrent `log` call); it passed in isolation on every other
attempt (3/3) and touches code this task never modified (`lib/`, not `dashboard/bridge-launch-api.mjs`).
Neither of the two documented pre-existing Windows flakes (`bridge.test.mjs` EADDRINUSE,
`foreign-launch.test.mjs` EPERM) was observed in this run.
