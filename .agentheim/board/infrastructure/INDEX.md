# Infrastructure — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 1
- **Todo:** 3
- **Doing:** 0
- **Done:** 41
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
- **infrastructure-vpbks** — Herdr bridge frontend — `launchOrCopy`/`probeBridge` dispatch on `/api/bridge`'s `kind`, call the mediated-launch endpoint when Herdr is selected, keep the VS Code path unmodified otherwise, and document the three-way selection in the repo README (feature) — `todo/infrastructure-vpbks-herdr-bridge-frontend-kind-dispatch.md`
- **infrastructure-xh8tw** — Herdr bridge server — `POST /api/bridge/launch` opens a Claude session in Herdr behind a per-process token; `GET /api/bridge` grows `kind`/`live`; workspace reuse by project cwd via `api snapshot`; agent start is fire-and-forget behind an immediate 202 (feature) — `todo/infrastructure-xh8tw-herdr-bridge-server-mediated-launch-endpoint.md`
- **infrastructure-e8h9f** — Herdr bridge foundation — `/setup use bridge <vscode|herdr|none>` persists the selection to a per-machine config file, `status` reports Herdr install/liveness, and a shared `lib/resolve-herdr.mjs` finds the binary for both `/setup` and the dashboard server (feature) — `todo/infrastructure-e8h9f-herdr-bridge-foundation-setup-selection-and-resolver.md`
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

### Done (current-month entries live; older months archived verbatim under `done-archive/` — kept for prior-art search, ADR-0039 convention)
<!-- done-list:start -->
- **infrastructure-reh04** — Refresh the repo README so `/setup` is part of the install flow, the state-layout tree and every quoted path reflect the two-root layout (ADR-0078), and the skills table, repo layout, and status reflect what shipped since the June restructure (0.8.8 → 0.9.4) — concise, no walkthrough (chore) — `done/infrastructure-reh04-readme-refresh-setup-two-root-layout.md`
- **infrastructure-hnv3d** — The marketplace installs `main`, not the tag, under the last released version string — a consumer who installs between a tag and the next bump gets an unreleased mid-rollout snapshot and cannot update out of it; decide how releases stop leaking (Roman's 0.9.3 stuck on a dashboard migration notice no skill in his copy fulfils) (decision) — `done/infrastructure-hnv3d-marketplace-serves-unreleased-main-mid-rollout-snapshot.md`
- **infrastructure-kr9pd** — `/setup` bridge verbs fail on win32 when the `.vsix` or `code.cmd` path holds a cmd.exe metacharacter but no space — `quoteArgWindows` leaves such segments unquoted and `cmd.exe` splits them (bug) — `done/infrastructure-kr9pd-setup-bridge-win32-metachar-quoting.md`
- **infrastructure-js62b** — `/setup` installs, upgrades and removes the VS Code bridge from the shipped `.vsix`, reports its install state, and the dashboard's skew banner names `/setup` as the remedy (feature) — `done/infrastructure-js62b-setup-installs-and-removes-vscode-bridge.md`
- **infrastructure-x56qm** — `/setup` installs the zero-token dashboard CLI into `<home>/.local/bin` and `/dashboard` becomes a pointer, so a consumer's daily dashboard launch costs no model turn (feature) — `done/infrastructure-x56qm-setup-command-installs-cli-and-bridge.md`
- **infrastructure-j3rsn** — Ship the VS Code bridge `.vsix` as a committed release artifact — un-ignore it, add a version-match lint and a `RELEASE.md` step, mirroring how `dashboard/dist/` reaches consumers (chore) — `done/infrastructure-j3rsn-ship-bridge-vsix-as-committed-release-artifact.md`
- **infrastructure-r4mzp** — Does `/dashboard` still earn its place as a slash command, now that launching the dashboard costs ~120k tokens across two turns while a shell invocation costs zero? (decision) — `done/infrastructure-r4mzp-does-dashboard-command-still-earn-its-place.md`
- **infrastructure-k9t2v** — Slim `commands/dashboard.md` — one bootstrap instead of three pasted copies, and the `$CLAUDE_PLUGIN_ROOT` archaeology moved out to ADR-0002 (chore) — `done/infrastructure-k9t2v-slim-dashboard-command-file.md`
- **infrastructure-rgknz** — The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it (bug) — `done/infrastructure-rgknz-dashboard-runtime-notices-plugin-update.md`
- **infrastructure-w45ce** — A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check (bug) — `done/infrastructure-w45ce-release-ships-fresh-dashboard-dist.md`
- **infrastructure-w6p4k** — Drop the "modeling:" prefix from bridge-derived session names (chore) — `done/infrastructure-w6p4k-drop-modeling-prefix-bridge-session-name.md`
- **infrastructure-v8r3q** — The bridge advertises what it can honour — a live /health capability handshake, plus a structural guard that stops a fourth silent drift (bug) — `done/infrastructure-v8r3q-bridge-capability-handshake.md`
- **infrastructure-d2n8s** — A DOM-render test harness — so a test can mount the board, dispatch a real keydown, and see what a source-regex suite structurally cannot (feature) — `done/infrastructure-d2n8s-dom-render-test-harness.md`
- **infrastructure-h5wnq** — The model rides the launch — POST /run carries a model, the bridge spawns claude --model, and the dashboard learns whether a bridge is even there (feature) — `done/infrastructure-h5wnq-model-rides-the-launch.md`
- **infrastructure-c6fzb** — Bridge-launched sessions carry a derived name — createTerminal({name}) + claude -n (feature) — `done/infrastructure-c6fzb-bridge-session-name-launch.md`
- **infrastructure-nz6k4** — Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found") (bug) — `done/infrastructure-nz6k4-agent-spawn-plugin-namespace.md`
- **infrastructure-h8k2m** — Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/ (bug) — `done/infrastructure-h8k2m-batch-start-leaves-stale-todo-copy.md`
- **infrastructure-m3q7k** — deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token (bug) — `done/infrastructure-m3q7k-derivecontext-leading-digit-token-id.md`
- **infrastructure-5w5gs** — task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation (bug) — `done/infrastructure-5w5gs-task-lifecycle-cli-crlf-line-endings.md`
- **infrastructure-q8m4t** — Support quotation marks (Gänsefüsschen) in prompts (bug) — `done/infrastructure-q8m4t-quotation-marks-in-prompts.md`
- **infrastructure-e5t9c** — Relocate skills/capture-workspace eval debris out of the plugin payload (chore) — `done/infrastructure-e5t9c-relocate-capture-workspace-eval-debris.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **infrastructure-g6h1m** — Herdr bridge — the dashboard's launch buttons open a Claude session in Herdr; `/setup` selects the active bridge (VS Code, Herdr, or none) and reports it; clipboard fallback whenever the selected bridge is not live (feature) — `backlog/infrastructure-g6h1m-herdr-bridge-setup-selects-active-bridge.md`
<!-- backlog-list:end -->


## Pointers

- Knowledge half (ADRs / research / concepts / BC README) for this BC: `../../knowledge/contexts/infrastructure/INDEX.md`
