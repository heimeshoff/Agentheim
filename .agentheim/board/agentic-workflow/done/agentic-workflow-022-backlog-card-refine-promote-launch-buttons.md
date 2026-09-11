---
id: agentic-workflow-022
title: Backlog cards get Refine & Promote launch buttons, each seeded with the ticket id
status: done
type: feature
context: agentic-workflow
created: 2026-06-14
completed: 2026-06-14
commit: b4a5e55
depends_on: [design-system-001, agentic-workflow-020, infrastructure-012, infrastructure-014]
blocks: []
tags: [dashboard, board, backlog, modeling, promote, launch]
related_adrs: [0001, 0003, 0009, 0018]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-020, agentic-workflow-016]
---

## Why
aw-020 turned the backlog *column's* add affordance into two launch buttons
(Quick Capture / Modeling) that start a seeded interactive Claude session through
the VS Code bridge (ADR-0018), with a silent clipboard fallback. It deliberately
left the per-*card* affordance as aw-016's single Copy button, which only copies
`/agentheim:modeling <id>` for the builder to paste.

The builder wants each backlog *card* to start the work directly too — and to
offer the two real actions a backlog item invites: **deepen it** or **mark it
ready**. So the per-card Copy button becomes **two launch buttons**, each opening
a real terminal seeded with that ticket's id:

- **Refine** → `/agentheim:modeling refine <id>` (the full Socratic refinement of that ticket).
- **Promote** → `/agentheim:modeling promote <id>` (the readiness check + backlog → todo move).

This is the per-card sibling of aw-020's column pair, reusing the exact same
launch mechanism.

## What
Replace the per-card backlog Copy affordance (aw-016) with a **Refine / Promote**
launch-button group, composed by the board **into the styleguide `TicketCard`'s
existing single `cornerAction` render-prop slot** (design-system-006) — wired
through the same bridge path aw-020 introduced. No new styleguide primitive and no
design-system child task (refine decision, 2026-06-14): `cornerAction` is a
render-prop whose contract is "consumer owns what renders"; the board returns a
two-button group instead of one icon button. The styleguide keeps owning the
slot's placement and its click-isolation wrapper; the board owns the group's
internal layout. This is consuming the primitive unforked (ADR-0003), not
extending or forking it.

1. **Two-button group in the `cornerAction` slot** on backlog cards only.
   todo/doing/done cards pass no `cornerAction`, so they are unaffected. Promote
   only ever runs backlog → todo, so it belongs only here.
2. **Emphasis (refine decision):** **Refine is the primary action** (the expected
   default — most backlog items need deepening before they're ready); **Promote is
   visually de-emphasised** (quiet), being the rarer, more committing action.
3. **Seeded prompt per button**, built by pure logic that appends the card's id:
   - Refine → `/agentheim:modeling refine <id>`
   - Promote → `/agentheim:modeling promote <id>`
4. **Launch via bridge with clipboard fallback** — reuse aw-020's `launchOrCopy`
   (`dashboard/app/bridge-launch.js`) unchanged: discover (`GET /api/bridge`) →
   probe (`GET /health`) → launch (`POST /run { prompt }`) → else copy the same
   command string. Bridge-absent is a normal mode: silently degrade to clipboard,
   never an error toast or console crash.

The board stays a projection of disk (ADR-0001) — launching a session is an
external side-effect, not a lifecycle write.

## Acceptance criteria
- [ ] Each **backlog** card renders **two** labelled buttons, "Refine" and "Promote", in the `TicketCard` `cornerAction` slot, replacing the single per-card Copy affordance (aw-016). Cards in todo/doing/done pass no `cornerAction` and are unaffected.
- [ ] **Refine** is the primary/emphasised action and **Promote** is rendered quiet/de-emphasised; both stay within the styleguide's quiet-by-default law (token-styled, no new hue).
- [ ] **Refine** seeds `/agentheim:modeling refine <id>` and **Promote** seeds `/agentheim:modeling promote <id>`, where `<id>` is that card's ticket id. When the bridge is available each opens an interactive terminal running `claude "<that command>"`.
- [ ] Activating either button does **not** open the slide-over (the click must not bubble to the card's `onClick`) — relies on the styleguide slot's existing stop-propagation wrapper (design-system-006); assert it holds for both buttons.
- [ ] When the page is not in VS Code's Simple Browser **or** the bridge is unreachable, each button falls back to copying its own command to the clipboard, with the existing quiet "copied" feedback and the existing no-throw clipboard guard (aw-016 / aw-020).
- [ ] Bridge-unavailable degrades silently to clipboard (timeout / connection-refused / not-in-Simple-Browser) — no error toast, no console crash, no broken-looking button. (Reuses aw-020 `launchOrCopy`; no new fallback logic.)
- [ ] The exact per-button command strings are produced by pure, unit-tested logic (extend `modeling-command.js` with a refine-command and a promote-command builder that append the id) under `node --test`, including the missing/empty/whitespace-id degradation already covered for `modelingCommandFor`.
- [ ] The `TicketCard` is consumed from the styleguide **unforked** (ADR-0003): the board returns the two-button group from the existing `cornerAction` render-prop; the styleguide is **not** modified.
- [ ] The dashboard `dist/` is rebuilt so the served bundle carries the change.

## Notes
- **Reuses, doesn't rebuild, the launch path:** `dashboard/app/bridge-launch.js`
  `launchOrCopy` and the `GET /api/bridge` discovery (infrastructure-014) are
  already in place from aw-020. This task is React glue (per-card buttons) +
  two new pure command builders, not new transport.
- **Command builder:** extend `dashboard/app/modeling-command.js`. Today
  `modelingCommandFor(id)` returns `/agentheim:modeling <id>` (the old Copy
  string). Add explicit `refineCommandFor(id)` → `/agentheim:modeling refine <id>`
  and `promoteCommandFor(id)` → `/agentheim:modeling promote <id>`. Keep the same
  trim / degrade-on-empty contract. Decide during work whether the old
  `modelingCommandFor` is retired with its sole caller (the removed Copy button)
  or kept for the bare column command — check remaining callers before deleting.
- **Verbs are explicit on purpose** (builder decision, 2026-06-14): `refine` and
  `promote` read unambiguously to the `modeling` skill's REFINE / PROMOTE routing
  and are symmetric, rather than relying on bare-id implicit refine.
- **Styleguide gate — resolved at refine (2026-06-14), no child task.** The gate
  (design-system-001) is met. The open question was how two actions fit a card
  whose `cornerAction` slot (design-system-006) was built for one control. Decided:
  **reuse the existing slot** — `cornerAction` is a render-prop ("consumer owns
  what renders"), so the board returns a two-button group; the styleguide keeps
  owning slot placement + the stop-propagation wrapper. This is unforked
  consumption (ADR-0003), so **no design-system child task is filed** and aw-022
  takes **no new dependency**. The alternative (a dedicated styleguide two-action
  affordance) was considered and declined as heavier than warranted.
  - *Worth a one-line note in the design-system README / this BC's README during
    work:* design-system-006's `cornerAction` is now demonstrated carrying a
    consumer-composed multi-control group, not just a single icon button — within
    its render-prop contract, but worth recording so a future reader doesn't read
    the slot as single-control-only. No ADR judged necessary (it neither
    supersedes nor diverges from ADR-0003/ds-006 — it exercises them); flag to the
    verifier if it disagrees.
- **Per-button visual (in-scope worker judgment):** exact treatment of "Refine
  primary, Promote quiet" (e.g. filled-vs-text, or relative weight) is left to the
  worker within the styleguide's quiet-by-default law — the *relationship* (Refine
  primary, Promote de-emphasised) is fixed; the pixels are not.
- Bridge launch mechanism research: `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.
  Bridge contract: ADR-0018.

## Outcome
Each backlog card's single Copy affordance (aw-016) is replaced by a **Refine /
Promote** launch-button group composed into the styleguide `TicketCard`'s existing
single `cornerAction` render-prop slot (ds-006) — consumed **unforked** (ADR-0003),
the styleguide untouched. **Refine** (primary/emphasised) seeds
`/agentheim:modeling refine <id>`; **Promote** (quiet/de-emphasised) seeds
`/agentheim:modeling promote <id>`. Each launches a real interactive Claude session
through the VS Code bridge (ADR-0018), reusing aw-020's `launchOrCopy` unchanged
with the silent clipboard fallback. Backlog-only — todo/doing/done pass no
`cornerAction`. Launching is an external side-effect, not a lifecycle write
(ADR-0001).

Key files:
- `dashboard/app/modeling-command.js` — added pure `refineCommandFor(id)` /
  `promoteCommandFor(id)` (explicit-verb, same trim/degrade-on-empty contract; empty
  id → bare verb command). Retired the now-callerless `modelingCommandFor`;
  `MODELING_COMMAND` / `QUICK_CAPTURE_COMMAND` stay for the column pair.
- `dashboard/app/board.js` — new `BacklogCardLaunchPair`; `LaunchButton` gained
  `emphasis` (primary/quiet/default) + defensive `isolateClick`; `BoardCard`'s
  backlog `cornerAction` now returns the pair; `CopyCommandButton` removed.
- `dashboard/test/modeling-command.test.mjs` — replaced the per-card builder tests
  with refine/promote coverage (distinctness, verb, id-degradation, trim).
- `dashboard/test/backlog-card-launch.test.mjs` (new) — static board-glue guard:
  cornerAction wired to the pair, Copy gone, primary/quiet emphasis, defensive
  isolateClick, unforked consumption + styleguide stop-propagation wrapper intact.
- `dashboard/dist/` rebuilt so the served bundle carries the change.

Notes:
- No ADR written — this exercises ADR-0003 / ds-006 (neither supersedes nor
  diverges), per the refine decision; flagged to the verifier.
- `cornerAction` is now demonstrated carrying a consumer-composed multi-control
  group within its render-prop contract — recorded in the agentic-workflow README;
  a matching one-liner is worth adding to the **design-system** README (the worker
  may only edit this BC's README — flagged to the orchestrator).
- Promote uses the existing `arrow-right` glyph (forward in the pipeline);
  `arrow-up` is not in the styleguide icon set and adding one would fork it.
- Full dashboard suite: **226 green** (was 217; +11 modeling-command rewrite, +6
  new board guard, dist rebuilt fresh in dist-build's before hook).
