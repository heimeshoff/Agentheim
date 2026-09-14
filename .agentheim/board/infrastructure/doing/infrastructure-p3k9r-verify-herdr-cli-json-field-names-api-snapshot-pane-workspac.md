---
id: infrastructure-p3k9r
title: Verify Herdr CLI JSON field names (api snapshot pane workspace id, tab/workspace create result shape) against a live install
status: doing
type: spike
context: infrastructure
created: 2026-09-13
completed:
depends_on: [infrastructure-xh8tw]
blocks: []
tags: [herdr, bridge, launch]
related_adrs: [0082]
related_research: []
prior_art: []
---

## Why

infrastructure-xh8tw's `POST /api/bridge/launch` topology code (`herdr api snapshot` →
matching `tab create`/`workspace create` → `agent start --pane <id>`) infers two JSON shapes
that were never checked against a real `herdr` binary — every `node --test` case in
`dashboard/test/bridge-launch-api.test.mjs` uses an injected fake `exec` whose fixtures were
hand-guessed:

1. Which per-pane key on `api snapshot`'s `.result.snapshot.panes[]` names the owning
   workspace. The implementation reads `pane.workspace_id ?? pane.workspace`.
2. The `.result` shape of `tab create` / `workspace create`. The implementation reads
   `topology.result.root_pane` and passes it straight through as the pane id
   (`String(paneId)` → `agent start --pane`).

**Refinement finding (2026-09-14, read-only probe of the live Herdr 0.9.0 install, protocol 22):**

- Shape 1 is **confirmed**: a live `api snapshot` pane carries `workspace_id` (alongside
  `pane_id`, `tab_id`, `cwd`, `terminal_id`, `agent_status`, `focused`, `revision`, `scroll`).
  The `?? pane.workspace` fallback matches nothing real.
- Shape 2 is **almost certainly wrong**: `herdr api schema --json` types `root_pane` in both
  `workspace_created` (`.result.{type, workspace, tab, root_pane}`) and `tab_created`
  (`.result.{type, tab, root_pane}`) as a **`PaneInfo` object** whose id lives at `.pane_id` —
  not a string. `herdr --skill` reads the sibling `pane split` result the same way
  (`.result.pane.pane_id`). If the CLI prints the socket result verbatim (as `api snapshot`
  does, wrapped in `{id, result}`), the current code sends `--pane "[object Object]"` and every
  Herdr launch dies after the 202, invisibly (ADR-0082 §6 fire-and-report), while the fixtures
  (`root_pane: 'w1:p1'`) keep the suite green.

The only thing the schema cannot settle is whether the CLI's printed JSON for `tab create` /
`workspace create` is exactly the socket `ResponseResult` — that needs one real invocation.

## What

Run the real Herdr binary once, in a disposable workspace, capture the verbatim JSON of
`workspace create` and `tab create --workspace <id>`, and make `dashboard/bridge-launch-api.mjs`
read exactly what Herdr prints. Rebuild the `exec` fixtures for `api snapshot`, `workspace create`
and `tab create` from the captured JSON so the suite can no longer be green against a shape Herdr
never emits. While the real snapshot is in hand, check that the workspace-reuse comparison
(`pane.cwd === root`) actually matches for this repo's root — Herdr reports native Windows paths
(`C:\Users\marco` style), and a silent mismatch degrades every launch to a fresh workspace.

## Acceptance criteria

- [ ] `dashboard/bridge-launch-api.mjs` derives the pane id for `agent start --pane` from the
      shape the captured `workspace create` / `tab create` JSON actually has (expected per schema:
      `.result.root_pane.pane_id`); a missing id still yields the existing 502
      `herdr did not report a pane id`, covered by a `node --test` case.
- [ ] The pane-to-workspace read is the single confirmed key `pane.workspace_id`; the
      `?? pane.workspace` fallback is removed.
- [ ] `dashboard/test/bridge-launch-api.test.mjs` has at least one fixture each for
      `api snapshot`, `workspace create` and `tab create` whose `result` subtree is the verbatim
      captured JSON (ids and paths as captured, other panes may be trimmed), each annotated with
      the Herdr version and protocol number it was captured from (`herdr 0.9.0`, protocol 22).
- [ ] The workspace-reuse comparison is verified against the captured snapshot for this repo's
      discovered root: either it matches as-is (recorded in the task Outcome with both strings),
      or it is normalized (`path.resolve` both sides, case-insensitive on `win32`) with a
      `node --test` case using the captured native-path form.
- [ ] The probe leaves nothing behind: the disposable workspace used for the capture is closed
      (`herdr workspace close`) before the task reports, and `herdr api snapshot` afterwards
      shows no `p3k9r` labelled tab or workspace.
- [ ] `node --test dashboard/test/*.test.mjs lib/test/*.test.mjs` passes.

## Notes

**Stop-loss (ADR-0065):** if, mid-spike, the mitigation is already known and cheap — the field
names are confirmed wrong and the fix is a one-line key rename plus a fixture rebuilt from the
captured JSON — record it and stop; do the fix as this task's own remediation rather than filing
a further diagnosis spike. After the 2026-09-14 finding this is the expected path: one live
capture confirms the object shape, then `.root_pane` → `.root_pane.pane_id` plus fixtures.

**Binary.** `herdr` is NOT on Git Bash's PATH on this machine. Use
`~/.herdr/packages/standalone/releases/0.9.0-x86_64-pc-windows-msvc/herdr.exe` (the
`%LOCALAPPDATA%/Programs/Herdr/bin` symlink also works from PowerShell). The server is
persistent; `herdr status` answers from any shell.

**Read-only vs mutating.** `herdr --version`, `herdr api snapshot`, `herdr api schema --json`,
`herdr --skill` and `<verb> --help` are side-effect free. `workspace create` / `tab create`
execute with defaults — never omit arguments to "probe" them (Herdr's own guide, `herdr --skill`).
Capture procedure: `workspace create --cwd <scratch dir> --label p3k9r-probe --no-focus`, read
its workspace id from the printed JSON, `tab create --workspace <id> --cwd <scratch dir>
--label p3k9r-probe --no-focus`, save both outputs, then close the workspace.

**Evidence already captured (2026-09-14):**
- `api snapshot` → `{id, result:{type, snapshot:{agents, focused_pane_id, focused_tab_id,
  focused_workspace_id, layouts, panes[], protocol, tabs[], version, workspaces[]}}}`; pane
  entry `{"agent_status":"unknown","cwd":"C:\\Users\\marco","focused":true,"pane_id":"w3:p1",
  "revision":0,"scroll":{...},"tab_id":"w3:t1","terminal_id":"term_…","workspace_id":"w3"}`.
- `api schema --json` `success_response.$defs.ResponseResult.oneOf[3]` = `workspace_created`
  `{type, workspace: WorkspaceInfo, tab: TabInfo, root_pane: PaneInfo}`; `oneOf[10]` =
  `tab_created` `{type, tab: TabInfo, root_pane: PaneInfo}`; `PaneInfo.pane_id: string`,
  `WorkspaceInfo.workspace_id: string`, `TabInfo.tab_id: string`.
- `tab create --help` confirms `--workspace <WORKSPACE_ID> --cwd --label --env --focus/--no-focus`;
  `workspace create --help` confirms `--cwd --label --env --focus/--no-focus`. The flags the
  implementation passes exist.

**Downstream.** `listAgentNames` / `agent start` in the same file also parse Herdr JSON with
hand-guessed fixtures; they are out of scope here unless the live capture happens to show them
wrong too — if so, record it in the Outcome and file a follow-up backlog item rather than widening
this spike.
