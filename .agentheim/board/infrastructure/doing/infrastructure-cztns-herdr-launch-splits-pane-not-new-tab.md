---
id: infrastructure-cztns
title: A Herdr-mediated launch into an existing project workspace should open the new session in a new pane, split right off the focused pane, instead of a new tab; amends ADR-0082 §5
status: doing
type: feature
context: infrastructure
created: 2026-11-01
completed:
depends_on: []
blocks: []
tags: [herdr, bridge, launch, pane]
related_adrs: [0082]
related_research: []
prior_art: [infrastructure-xh8tw, infrastructure-w506e, infrastructure-nz2e8, infrastructure-p3k9r]
---

## Why

Builder request (2026-11-01): "The herdr bridge should start a new session in a new pane, not in
a new tab." Today a board launch into an existing workspace for the project runs
`herdr tab create --workspace <id> …`, so each new session gets its own tab. The builder wants
the new session to open next to the one they are already looking at, in the same tab.

## What

Change ADR-0082 §5's **warm-workspace** branch in `dashboard/bridge-launch-api.mjs`:

- **Warm (a pane in the snapshot matches the project root, via `cwdsMatch`):** stop calling
  `tab create`. Pick a split target in that workspace and run
  `herdr pane split --pane <target> --direction right --cwd <root> --focus`.
  The new pane is where `agent start --pane <id>` launches Claude. That step does not change.
  - **Split target = the focused pane of the workspace's active tab.** Resolve it from
    `api snapshot`. The workspace record carries `active_tab_id`, and each pane carries `tab_id`,
    `workspace_id`, and `focused`. The snapshot also has a top-level `focused_pane_id` /
    `focused_workspace_id`, plus `layouts[].focused_pane_id` for each tab. The worker picks the
    most direct reliable source and records the choice in the ADR amendment.
  - **Fallback:** if no focused pane can be resolved in that workspace, split the cwd-matched
    pane, which is always available.
- **Cold (no matching pane):** unchanged. `workspace create --cwd <root> --label <name> --focus`
  already gives the session a fresh pane, the new workspace's root pane.
- **Label:** `pane split` has no `--label`. If the session name should still be visible in Herdr,
  use `herdr pane rename` on the new pane, and treat it as best-effort like the rest of the
  post-create steps. Otherwise, document that the name now shows only through the agent name /
  `claude -n`. The worker decides which and records it in the amendment.
- All of the §6 request-path budget still applies. The split is **awaited** before the `202`; if
  it fails, the endpoint returns a non-2xx `502` (the error text names the pane split). Every
  `herdr` child still carries `HERDR_CHILD_OPTIONS` (`windowsHide: true`, infrastructure-nz2e8).

## Acceptance criteria

- [ ] Matching-cwd pane present: the handler calls `pane split` with `--direction right`,
      `--cwd <root>`, `--focus`, and `--pane <focused pane of that workspace's active tab>`. It
      makes **no** `tab create` call and no `workspace create` call
      (`dashboard/test/bridge-launch-api.test.mjs`; replaces the existing "matching-cwd pane ->
      tab create" test).
- [ ] Matching-cwd pane present but no focused pane resolvable in that workspace: `pane split`
      targets the cwd-matched pane.
- [ ] When the focused pane lives in a **different** workspace from the cwd-matched one, the
      split still lands in the project's workspace and never in the foreign one.
- [ ] `agent start --pane <id>` uses the pane id that `pane split` returned. The result shape is
      verified against the live Herdr 0.9.0 install (expected `result.pane.pane_id`, a `PaneInfo`,
      but not yet confirmed; see Notes). A missing pane id returns the existing
      `502 herdr did not report a pane id`.
- [ ] A `pane split` failure returns a non-2xx response before any `202` is committed, mirroring
      the existing tab/workspace-create failure test.
- [ ] No matching-cwd pane: still `workspace create … --focus` (the existing test stays green).
- [ ] The `pane split` exec call carries `HERDR_CHILD_OPTIONS` (`windowsHide: true`), asserted
      the same way infrastructure-nz2e8 asserts the other call sites.
- [ ] The ADR-0082 §5 amendment is reported in the RESULT block (`ADR_AMENDMENT`). It covers
      the warm branch (split instead of tab), how the split target is chosen, the direction, and
      the label decision.
- [ ] `dashboard/dist/` is rebuilt **by the conductor at integration, from source**, never by
      the worker, if the frontend changes at all. A server-only change does not need a rebuild.
- [ ] Launching from the board while a Claude session for this project is already open in Herdr
      opens the new session as a right-hand split of the focused pane in the same tab, with
      focus on it. [human-eye]

## Notes

- **Builder decisions (2026-11-01, during capture):** split the **focused pane** (fallback: the
  cwd-matched pane), direction **right**. The cold path is unchanged. "Auto by size" was
  considered and rejected as extra logic nobody asked for.
- **Herdr CLI (0.9.0, checked live during capture):**
  `herdr pane split [PANE_ID] --pane <ID> | --current, --direction right|down, --ratio <f>,
  --cwd <path>, --env K=V, --focus | --no-focus`. Its socket method is `pane.split` with
  `PaneSplitParams {target_pane_id, direction, cwd, env, focus(default false), ratio,
  workspace_id}`. The success response shape for `pane split` was **not** confirmed. Capture it
  with one live call before you assert a field path, the same way infrastructure-p3k9r verified
  `root_pane.pane_id`.
- The binary is not on Git Bash PATH on the builder's box:
  `~/.herdr/packages/standalone/releases/0.9.0-x86_64-pc-windows-msvc/herdr.exe`.
- **Test hazard:** two `bridge.test.mjs` fixed-port tests fail with EADDRINUSE on :31425 while
  the builder's live VS Code bridge runs. This is pre-existing, not a regression. Brief the
  verifier.
- Open for later (not built here): a per-launch choice between pane and tab. If wanted, add it
  as a body field the way ADR-0082 §5 already sketches `focus: false`.
