---
id: agentic-workflow-051
title: Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: dd970ca
depends_on: [design-system-001]
blocks: []
tags: [dashboard, skip-permissions, dismiss, board]
related_adrs: [0019, 0018, 0017, 0022]
related_research: []
prior_art: [agentic-workflow-048, agentic-workflow-021, agentic-workflow-030, agentic-workflow-041]
---

## Why
The board's four launch buttons (Quick Capture / Modeling / Research, the prompt-bar
pair + Research, plus the per-card Refine / Promote and the topbar Work) all honour the
armed skip-permissions toggle (aw-021 / ADR-0019): when armed, each threads
`skipPermissions: true` through `launchOrCopy` so the spawned session runs
`claude --dangerously-skip-permissions`. The per-card **dismiss (trash-can)** button
(aw-048) is the one bridge launch that deliberately does **not** — aw-048 chose to keep a
destructive intent behind its normal permission prompt, mirroring the Stop button (aw-028).

The builder wants the dismiss button brought in line with the rest: when the toggle is
armed, dismiss should "take in the armed signal" too and skip permissions like every other
launch.

⚠️ This **reverses** an explicit aw-048 safety decision. Captured to backlog (not todo) on
purpose so that reversal — dropping the permission prompt on a hard-deleting cascade
(ADR-0022) — gets a deliberate look before it's worker-ready.

## What
Make the dismiss trash-can's bridge launch thread the armed `skipPermissions` flag from the
shared store, exactly the way the launch buttons do — instead of always omitting it.

- In `dashboard/app/board.js`, the trash-can's `launchOrCopy` call for
  `/agentheim:modeling dismiss <id>` reads the same `skip-permissions-state.js` armed value
  the launch buttons read, and POSTs `{ prompt, skipPermissions: true }` **only when armed**
  (omit the field when off — never send `false`; keep the OFF path byte-identical, per the
  strict-`true` contract in amended ADR-0018).
- The OFF / unarmed path stays exactly as aw-048 shipped (normal permission prompt).
- Update the aw-048 narrative in the BC README (the "Board card dismiss" bullet currently
  states the opposite) so the documented behaviour matches.

## Acceptance criteria
- [ ] When the armed toggle is ON, clicking Confirm on the dismiss dialog launches a
      session that runs `claude --dangerously-skip-permissions "/agentheim:modeling dismiss <id>"`.
- [ ] When the toggle is OFF, the dismiss launch is byte-identical to aw-048 today
      (`skipPermissions` omitted, not sent as `false`).
- [ ] The dismiss button reads the **same** armed store (`skip-permissions-state.js`) the
      launch buttons read — no second source of truth, no `/api/bridge` probe on render.
- [ ] The clipboard fallback still carries **no** bypass (the slash command pastes into a
      running session; `--dangerously-skip-permissions` is startup-only) — unchanged from
      the launch buttons.
- [ ] Pure unit coverage (`node --test`) for both armed states' body shape, mirroring the
      existing `launchOrCopy` / dismiss-command tests.
- [ ] The BC README "Board card dismiss" bullet is updated to state the new behaviour
      (no longer "deliberately does not thread skipPermissions").

## Notes
- **Open question — the armed cue is invisible here.** The launch buttons signal armed
  state with a `--obligation`-tinted icon (aw-030 → aw-041). The trash-can icon is
  *already* `--obligation`-tinted because it is destructive (aw-048) — so the standard
  per-launch cue is a no-op on it. Refinement should decide whether armed-dismiss needs any
  distinct at-a-glance cue (e.g. an intensified fill, matching the button's own hover state)
  or whether "the toggle is the single control wearing the danger hue" (aw-041 doctrine)
  makes a per-button cue unnecessary here. The amended ADR-0018 per-launch mandate may need
  a one-line note that dismiss satisfies it trivially.
- **Safety reversal — confirm intent before promote.** aw-048 and the Stop button (aw-028)
  both keep destructive/irreversible actions behind the normal prompt. This task removes
  that prompt for dismiss when armed. The cascade dismiss still lists + re-confirms the full
  dependent subtree *inside* the spawned `modeling` session (ADR-0022), so the in-session
  guard survives even with `--dangerously-skip-permissions` — but worth the builder's
  explicit nod that that in-session re-confirm is sufficient protection.
- Scope is the one `launchOrCopy` call + its tests + the README bullet. No new ADR expected
  (this is a behavioural flip within ADR-0018/0019 territory, not a new decision) — but if
  the team decides dismiss should be a *standing* exception or the safety reversal warrants
  a recorded rationale, a `type: decision` task / ADR-0019 amendment may be warranted.
- Prior art: aw-048 (the dismiss button being changed), aw-021 (the armed toggle + store),
  aw-030 / aw-041 (the per-launch cue narrowing).

## Outcome
The per-card dismiss trash-can now honours the armed skip-permissions toggle exactly like the
four launch buttons, reversing aw-048's deliberate omission.

- `dashboard/app/board.js` — `CardTrashCan` gained a `skipPermissions = false` prop and its
  `launchOrCopy` call now threads `skipPermissions: skipPermissions === true` (strict-`true`),
  so the bridge POSTs `{ prompt, skipPermissions: true }` only when armed and omits the field
  otherwise (OFF path byte-identical to aw-048). `BoardCard` threads its existing
  `skipPermissions` prop down into `CardTrashCan`; the rest of the chain
  (DashboardApp → DashboardBoard → BoardColumn → BoardCard) already carried it for the launch
  buttons, so no new source of truth and no `/api/bridge` probe on render.
- The clipboard fallback still carries no bypass (`--dangerously-skip-permissions` is
  startup-only) — covered by an armed-with-no-bridge test.
- `dashboard/test/board-card-dismiss.test.mjs` — replaced the "does NOT thread skipPermissions"
  guard with five new tests: source-level wiring (strict-`true` thread, prop-not-second-source,
  BoardCard threading) plus end-to-end body shape for both armed states driving the real
  `launchOrCopy` + `dismissCommandFor` (armed → `{prompt, skipPermissions:true}`; off → field
  omitted; armed-no-bridge → clipboard copies the bare command).
- Full dashboard suite green: 434/434 (429 prior + 5 new). `dashboard/dist/` rebuilt (esbuild)
  so the deployed app threads `skipPermissions:n===!0` into the dismiss launch.
- BC README "Board card dismiss" bullet updated to the new behaviour.

**Open question resolved (no distinct armed cue).** The trash glyph is already `--obligation`-
tinted because it is destructive (aw-048); under aw-041 doctrine "the toggle is the single
control wearing the danger hue", so the standard per-launch cue is a visual no-op and dismiss
satisfies ADR-0018's per-launch mandate trivially. No separate dot/border/cue added.

**Safety reversal accepted.** Dropping the permission prompt on a hard-deleting cascade is safe
because the spawned `modeling` session lists + re-confirms the full dependent subtree INSIDE the
session before deleting (ADR-0022) — that in-session guard survives `--dangerously-skip-permissions`.
No new ADR written: this is a behavioural flip within existing ADR-0018/0019 territory, not a new
decision (per the task's Notes; the README/code carry the rationale).

Key files: `dashboard/app/board.js`, `dashboard/test/board-card-dismiss.test.mjs`,
`dashboard/dist/app.js` (rebuilt), `.agentheim/contexts/agentic-workflow/README.md`.
