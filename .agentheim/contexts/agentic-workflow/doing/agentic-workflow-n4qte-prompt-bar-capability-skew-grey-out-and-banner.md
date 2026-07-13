---
id: agentic-workflow-n4qte
title: Prompt bar greys out the model selector — and warns loudly — when the live bridge is too old to honour it
status: doing
type: bug
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: [infrastructure-v8r3q]
blocks: []
tags: [bridge, prompt-bar, model-selector, silent-failure, ux]
related_adrs: [0016, 0017, 0018, 0035, 0050, 0056]
related_research: []
prior_art: [agentic-workflow-m2vkp, infrastructure-h5wnq, infrastructure-c6fzb]
---

## Why

`infrastructure-v8r3q` ships a trustworthy `{ present, capabilities }` signal
(`probeBridge`) and a wire-level guarantee that `launchOrCopy` never sends `model`/`name` to a
bridge that can't honour them. But the prompt bar itself still only asks "is a bridge there at
all?" (`bridgePresent`, `agentic-workflow-m2vkp`) — it has no notion of "is a bridge there
*that supports what I'm about to send it*?" A builder on a stale-but-present bridge (0.4.0 on
disk, 0.2.0 running in the live extension host — the exact scenario that motivated
`infrastructure-v8r3q`) sees a fully live, unlocked model selector, picks Sonnet, and — thanks
to `infrastructure-v8r3q`'s wire guarantee — the field is now silently dropped *before it ever
reaches the bridge* rather than dropped by the bridge. That is strictly safer than before (no
model runs that wasn't chosen), but it is **still silent**: the selector looks live, claims to
launch on Sonnet, and the session runs on whatever the bridge defaults to, with nothing telling
the builder why.

`infrastructure-h5wnq` already established the precedent for exactly this shape of honesty:
the model selector greys out (`locked`) when **no** bridge is reachable, because a
clipboard-copied command can't carry `--model`. This task extends that same honesty from
*bridge absent* to *bridge present but too old* — the builder's own ruling
(`infrastructure-v8r3q`'s Notes) — and adds a **one-time dismissible banner**, because a
builder who never opens the model selector would otherwise never learn his extension is stale
at all: the skew affects launching generally (every launch silently names every session
"Claude" too — see below), not just the one control a grey-out can cover.

**There is no session-name control to grey out.** The original backlog task's acceptance
criteria asked for "the session-name field" to become unavailable the same way the model
selector does. There is no such control in the UI: the prompt bar always derives a launch name
from the highlighted mode via `nameForPromptMode(index, prompt)`
(`dashboard/app/prompt-mode.js`) — there is nothing to disable. A stale bridge silently naming
every dashboard-launched tab "Claude" (ignoring the `-n <name>` pair entirely) is precisely
the scenario the banner exists to announce; this task does not invent a name control that
doesn't belong.

## What

The prompt bar now derives **two distinct facts** from the one mount-time probe, and it matters
that they are separate:

| Fact | Condition | Drives |
|---|---|---|
| **`bridgeSupportsModel`** | `present && capabilities.includes('model')` | The model selector's `locked` state, its label, its tooltip — the *one control* a grey-out can cover. |
| **`bridgeSkewed`** | `present && KNOWN_CAPABILITIES.some(c => !capabilities.includes(c))` | The banner — the announcement that the *extension as a whole* is stale, covering the launch paths (session naming) that have no control to grey out. |

Today these coincide: the only bridge in the wild that misses `model` is a legacy one that
misses `name` too. They are still derived separately, because the **banner is the general skew
announcement and the lock is the specific model gate** — a future bridge that ships `model` but
lacks a not-yet-invented fourth field must still raise the banner (builder's ruling, 2026-07-13),
and a `'model'`-only trigger would go silent for exactly that case. See §3.

1. **Extend the model-lock condition from presence to capability.** `board.js`'s
   `BoardPromptBar` currently stores only a boolean (`const [bridgePresent, setBridgePresent]`,
   L1057) — it throws `capabilities` away at L1091 (`setBridgePresent(!!(res && res.present))`).
   Store `probeBridge`'s whole `{ present, capabilities }` result instead (one state slot, e.g.
   `const [bridge, setBridge] = useState({ present: false, capabilities: [] })`), and derive:
   - `bridgeSupportsModel = bridge.present && bridge.capabilities.includes('model')`
   - `modelLocked = !bridgeSupportsModel || isModelLockedForMode(highlightedMode)`

   The split button renders `locked` in both the absent case and the present-but-too-old case —
   same visual/keyboard treatment `infrastructure-h5wnq` already built (no caret, no menu, Ctrl+M
   a no-op), because from the selector's point of view "can't reach a bridge that supports this"
   and "no bridge at all" are the same fact. A probe that never resolves leaves the initial
   `{ present: false, capabilities: [] }` in place, which locks — the existing safe default,
   preserved.

2. **Rewire the label and the tooltip off `bridgePresent` too — not just the lock.** This is the
   subtle half, and skipping it re-creates the exact silent lie this task exists to kill.
   `board.js` L1287-1292 currently reads:

   ```js
   const modelLabel = bridgePresent ? resolvedModel.label : "Default";
   const modelHint = !bridgePresent
     ? "No bridge reachable — …cannot carry a model choice"
     : isModelLockedForMode(highlightedMode)
       ? "Quick Capture always runs on Haiku"
       : `Running on ${resolvedModel.label} — Ctrl+M cycles`;
   ```

   Against a stale bridge, `bridgePresent` is **true** — so if only `modelLocked` is rewired, the
   button renders locked *while still reading "Opus"* and claiming *"Running on Opus — Ctrl+M
   cycles"*, naming a model that `infrastructure-v8r3q`'s wire guarantee has already omitted from
   the request. Both must key off `bridgeSupportsModel`:
   - `modelLabel = bridgeSupportsModel ? resolvedModel.label : "Default"` — the honest label,
     because the dashboard genuinely does not know what a legacy bridge will default to. Same
     word as the absent-bridge case, deliberately: in both, no model choice reaches the CLI.
   - `modelHint` gains a **third branch** naming the real remedy, distinct from the other two:
     bridge present but lacking `'model'` → *"Your VS Code bridge is running an older version —
     reload your VS Code window to pick up model selection."* Do not reuse the "no bridge
     reachable" wording; the remedies differ (there is nothing to reload for a genuinely absent
     bridge — install/open the extension instead).

3. **A dismissible skew banner, keyed on *any* missing capability.** Export a
   `KNOWN_CAPABILITIES` constant from `dashboard/app/bridge-launch.js` — the dashboard's own
   statement of *"the set of POST /run fields I know how to send"*, which is exactly what
   `runOnBridge`'s per-field allowlist (L160-162) already encodes inline:

   ```js
   export const KNOWN_CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model'];
   ```

   It is a **peer of, not an import of**, the extension's `CAPABILITIES` (`vscode-extension/src/bridge.js`
   L44) — the two ends of the same handshake, deliberately not coupled across the package boundary
   (`bridge-launch.test.mjs` L29-31 already states this rationale for its test-local literal;
   that literal should now import the real constant instead of duplicating it a third time).

   Then, when the mount-time probe detects
   `bridge.present && KNOWN_CAPABILITIES.some(c => !bridge.capabilities.includes(c))`, render a
   dismissible banner in the prompt bar's docked console with **generic copy that names no
   specific field** (builder's ruling — it must stay true when a fourth field arrives):

   > *"Your VS Code bridge is running an older version. Some launch options are unavailable until
   > you reload the window."*

   - **Not absence.** No bridge at all stays exactly as silent as `infrastructure-h5wnq` left it
     (absence is a normal mode, ADR-0018's absence-detection contract, which this task does not
     touch) — the banner fires only for the *present-but-old* case.
   - **Not forward-skew.** A bridge advertising *more* than `KNOWN_CAPABILITIES` (a newer
     extension than the dashboard) satisfies `some(missing) === false` → no banner. Correct: a
     field the dashboard never sends is not the builder's problem to be warned about.
   - **Dismiss is session-local** (no persistence, ADR-0017) — it must not re-appear on every
     re-render while mounted, but a fresh page load re-probes and shows it again if the skew is
     still there. Mount-only probing is deliberate: the remedy (*reload the VS Code window*)
     reloads the Simple Browser tab along with it, so the banner clears on the natural next mount.
   - **Build it board-local, not a new styleguide primitive.** Checked the styleguide source
     (`.agentheim/contexts/design-system/styleguide/app/`) — there is no existing
     Banner/Alert/Callout/Toast component to reuse, and this is a **first-time** consumer.
     `design-system-015`'s own precedent (Menu/Popover) explicitly defers promotion to a
     shared primitive until a *second* consumer appears ("a single board-local control can
     stand un-promoted indefinitely"); do the same here — build the banner directly in
     `board.js`, token-styled (the `--obligation` / `--obligation-soft` advisory-tint family
     `button.js`'s `destructive` variant already uses is the closest existing semantic match
     for "something needs your attention," per ADR-0016), not a hand-rolled color. Promote it
     to the styleguide only if/when a second banner-shaped consumer shows up.

4. **Mirror the structural guard on the dashboard side.** `infrastructure-v8r3q` added an
   executable guard on the *extension* (`vscode-extension/test/bridge.test.mjs` L666-681:
   source-scan `bridge.js`, assert every `parsed?.<field>` read is declared in `CAPABILITIES`
   and every declared capability is actually read). The dashboard has **no such guard** — its
   allowlist is three hand-written `caps.includes('…')` calls that a fourth field could silently
   skip, which is precisely the drift class that whole task existed to close. Introducing
   `KNOWN_CAPABILITIES` gives the mirror an anchor: add the symmetric source-scan guard to
   `dashboard/test/bridge-launch.test.mjs` — every `caps.includes('<x>')` in `bridge-launch.js`
   names an `<x>` declared in `KNOWN_CAPABILITIES`, and every declared capability beyond the
   always-sent baseline (`prompt`, `skipPermissions`) is actually gated that way. Keep it as
   narrow as the extension's (same "if a future field is read via different syntax, widen the
   guard then, not now" caveat).

5. **Regression coverage via the DOM harness, not a source-regex suite.** The AC below ("the
   UI must not report a successful model/name launch against a legacy bridge") is a *live
   render + event* behavior — exactly what `dashboard/test/dom-harness.mjs` +
   `resolve-hook.mjs` (ADR-0056) exist for, and exactly what a regex-over-source assertion
   structurally cannot see (it can pin that a string like `"reload your VS Code window"`
   appears in `board.js`, but not that the split button actually renders `locked`, that a
   click on it doesn't open the menu, or that a mocked legacy `/health` actually produces the
   banner in the DOM). Add DOM tests (new file, e.g.
   `dashboard/test/board-prompt-bar-capability-dom.test.mjs`, following
   `board-prompt-bar-dom.test.mjs`'s and `model-split-button-dom.test.mjs`'s pattern) that
   mount `BoardPromptBar` with a mocked `fetch` returning a legacy-shaped `/health` (`present`
   but no `capabilities`) and assert: the split button renders locked (no caret, `aria-haspopup`
   absent or `locked`'s equivalent DOM signature), the label reads "Default" (**not** "Opus"),
   the tooltip carries the reload message, and the banner is present in the DOM with the correct
   copy. Cover all three probe outcomes as distinct mounts — **absent** (no banner, locked,
   "No bridge reachable" hint), **legacy/skewed** (banner, locked, reload hint), **full**
   (no banner, unlocked, model named). Existing regex-suited assertions (layout/token/structure
   guards, the tooltip string itself) can stay in the existing `board-prompt-bar.test.mjs`/regex
   files — this task is not a big-bang migration, per the BC README's own "what it still cannot
   see" note.

## Acceptance criteria

- [ ] `BoardPromptBar` stores `probeBridge`'s whole `{ present, capabilities }` result, not a
      bare boolean — the `capabilities` array is no longer discarded at the probe callback.
- [ ] `modelLocked` is true whenever the mount-time probe is absent **or** present-but-missing
      `'model'` from `capabilities`, in addition to the existing Quick-Capture pin — i.e.
      `bridgeSupportsModel = present && capabilities.includes('model')`,
      `modelLocked = !bridgeSupportsModel || isModelLockedForMode(highlightedMode)`.
- [ ] The split button's `locked` rendering (no caret, no menu, Ctrl+M no-op) is visually and
      behaviorally identical for "bridge absent" and "bridge present but too old" — verified by
      a DOM test that mounts each case and asserts the same locked DOM shape.
- [ ] **`modelLabel` reads "Default" — not a model name — against a stale bridge**, i.e. it keys
      off `bridgeSupportsModel`, not `bridgePresent`. A locked button that still says "Opus" is
      the silent lie this task exists to remove; a DOM test pins this explicitly.
- [ ] `modelHint`/`splitButtonTitle` names the real remedy for the too-old case ("reload your
      VS Code window…"), textually distinct from **both** the "no bridge reachable" wording and
      the Quick-Capture wording — three branches, keyed off `bridgeSupportsModel`.
- [ ] `KNOWN_CAPABILITIES` is exported from `dashboard/app/bridge-launch.js` as the dashboard's
      declared POST /run field set, `runOnBridge`'s allowlist and `bridge-launch.test.mjs`'s
      `FULL_CAPABILITIES` literal both resolve to it (one source of truth on the dashboard side),
      and it remains an independent peer of the extension's `CAPABILITIES` — **not** a cross-package
      import.
- [ ] A dismissible banner renders when (and only when)
      `present === true && KNOWN_CAPABILITIES.some(c => !capabilities.includes(c))` — **any**
      missing capability, not `'model'` specifically. It does not render for plain absence, does
      not render for forward-skew (a bridge advertising more than the dashboard knows), and does
      not persist across a fresh mount's re-probe (session-local dismiss only).
- [ ] The banner's copy is **generic** — it names no specific field, so it stays true when a
      fourth capability arrives: "Your VS Code bridge is running an older version. Some launch
      options are unavailable until you reload the window."
- [ ] The Notes/rationale above (no session-name control exists to grey out) is reflected by
      NOT inventing one — confirmed by review that no new disabled/greyed name affordance was
      added anywhere in this diff.
- [ ] A dashboard-side structural guard mirrors the extension's (`bridge.test.mjs` L666-681):
      every `caps.includes('<x>')` gate in `bridge-launch.js` names an `<x>` declared in
      `KNOWN_CAPABILITIES`, and every declared capability beyond the always-sent baseline
      (`prompt`, `skipPermissions`) is actually gated that way. A fourth field added to one side
      and not the other fails the suite.
- [ ] DOM-harness regression test(s) (`dashboard/test/*-dom.test.mjs`, ADR-0056 pattern) mount
      `BoardPromptBar` against all three probe outcomes (absent / legacy-skewed / full) and, for
      the legacy case, firing a launch does **not** produce a "launched on \<model\>" success
      signal for a non-default model — the resolved/displayed model reads the locked/default
      state, matching what `infrastructure-v8r3q`'s wire-level omission actually sends.
- [ ] `dashboard/dist/` is rebuilt from source (`node build.mjs`) since `board.js` changes.
- [ ] Full dashboard + design-system-styleguide test suites stay green (noting the two
      pre-existing, environmental `bridge.test.mjs` `EADDRINUSE` failures are out of this BC's
      scope entirely — this task never touches `vscode-extension/src/`).

## Notes

- **Dependency satisfied 2026-07-13** — `infrastructure-v8r3q` is in `done/`. Verified on disk:
  `probeBridge` resolves `{ present, capabilities }` (`bridge-launch.js` L276-288),
  `LEGACY_CAPABILITIES = ['prompt', 'skipPermissions']` (L54), `runOnBridge` gates `name`/`model`
  on the live-probed set (L161-162), and the extension advertises
  `CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model']` (`vscode-extension/src/bridge.js`
  L44). Every contract this task consumes exists. Nothing blocks it.
- Read `dashboard/app/board.js` around the `BoardPromptBar` component before touching it — this
  is a narrow extension of existing, well-commented logic, not a rewrite. Line refs verified
  2026-07-13: the `bridgePresent` state L1057, the mount probe that discards `capabilities`
  L1085-1094, the `modelLocked` derivation L1099, and `modelLabel`/`modelHint`/`splitButtonTitle`
  L1286-1293.
- **Builder ruling, 2026-07-13 (refinement): the banner keys on *any* missing capability, not on
  `'model'`.** The narrower `'model'`-only trigger was rejected because it would go silent for a
  future bridge that ships `model` but lacks a not-yet-invented fourth field — the very drift
  class `infrastructure-v8r3q`'s structural guard was built to make impossible. The cost of the
  general rule, accepted knowingly, is that the banner's copy must stay generic ("some launch
  options") rather than naming *"Model and session-name selection"* as the original capture did.
  The consequence: **banner and lock are now derived from different conditions** (see the table
  in `What`) — they coincide today and are still written as two separate derivations on purpose.
- `design-system-r9dtm`'s `ModelSplitButton` already has both `locked` and `disabled` props
  with distinct semantics (`locked` = caret/menu genuinely absent; `disabled` = both regions
  dimmed but present) — this task reuses `locked` exactly as `infrastructure-h5wnq` already
  does for the absent-bridge case; it does not need a third visual state.
- The banner is new UI surface with no existing precedent in this codebase to copy verbatim.
  Refinement settled the two questions that were open at capture: **probe cadence** is
  mount-only (§3 — the remedy reloads the Simple Browser tab along with the VS Code window, so
  re-probe-on-focus buys nothing), and **the token family** is `--obligation` / `--obligation-soft`
  (§3, per ADR-0016). What remains genuinely open is only the fine placement/interaction detail —
  exact position within the docked console, dismiss-icon vs text link. Pick the obvious thing; if
  it raises a real design-system question rather than a preference, consult the architect or
  tactical-modeler directly (single-specialist question, ADR-0035) rather than guessing silently.
- `agentic-workflow-m2vkp`'s README entry (`.agentheim/contexts/agentic-workflow/README.md`,
  the "model axis" bullet, ~L406-437) is the ubiquitous-language home for this control; update
  it to mention the capability-aware lock and the banner rather than leaving it describing only
  the absent-bridge case.
