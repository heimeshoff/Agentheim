/* ============================================================
   Agentheim — dashboard prompt-bar MODEL selector: pure judgment
   (ADR-0050's fifth amendment, agentic-workflow-m2vkp)

   Sibling module to `prompt-mode.js`, on a SECOND, orthogonal axis: not WHICH
   mode is highlighted, but WHICH MODEL the launched session will run on. Same
   discipline — no React, no htm, no DOM, `node --test`-able, joining the pure
   module family (board-sort.js / board-group.js / prompt-mode.js).

   Four displayable models, in the fixed order Fable · Opus · Sonnet · Haiku,
   each `{ id, label }` where `id` is the exact value `--model` accepts (an
   alias, not a full model name) and `label` is Agentheim's display copy. The
   ids are NOT this module's own invention — they are the settled, closed
   allowlist `infrastructure-h5wnq` shipped in `vscode-extension/src/bridge.js`
   (`MODEL_ALLOWLIST = ['fable', 'opus', 'sonnet', 'haiku']`); this module's
   `PROMPT_MODELS` ids and that allowlist MUST agree, or a selection here would
   silently spawn with no `--model` flag at all (the bridge's contract: an
   allowlist miss is quiet, never an error).

   Two invariants mirror ADR-0050's original three (index-always-in-range,
   total-deterministic-wraparound) on this new axis:
     - `clampPromptModelIndex` — the one in-range guard, mirroring
       `clampPromptModeIndex`.
     - `nextPromptModelIndex` — the total, never-throws wraparound step,
       mirroring `nextPromptModeIndex`. Driven by Ctrl+M (a FIFTH, disjoint
       `promptBarKeyIntent` label, CYCLE_MODEL — classified in prompt-mode.js,
       NOT here, since the keydown classifier stays the ONE place a keystroke
       becomes an intent, ADR-0050 invariant 4).

   The genuinely new judgment on this axis is the PIN: Quick Capture is always
   Haiku, regardless of what's selected. `isModelLockedForMode` /
   `modelForMode` carry that as a READ-TIME PROJECTION, not a mutation —
   `modelForMode` never writes the stored selection, so switching away from
   Quick Capture and back always restores whatever was selected before the
   pin was read. Storing the pin instead would silently eat the builder's
   choice every time they filed a quick idea.
   ============================================================ */

import { DEFAULT_PROMPT_MODE_INDEX } from './prompt-mode.js';

// The four models, in the FIXED order Fable · Opus · Sonnet · Haiku. `id` is
// the exact `--model` alias the bridge's MODEL_ALLOWLIST accepts
// (infrastructure-h5wnq) — NOT a full model name, which the allowlist does
// NOT contain and would silently degrade to no `--model` flag at all.
export const PROMPT_MODELS = [
  { id: 'fable', label: 'Fable' },
  { id: 'opus', label: 'Opus' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
];

// The default model on mount (the builder's ruling): Opus, index 1. Unlike
// `DEFAULT_PROMPT_MODE_INDEX`, this is NOT also a post-launch reset target —
// this task's fifth ADR-0050 amendment reverses the reset-to-default rule on
// BOTH axes; the selected model, like the highlighted mode, survives a launch.
export const DEFAULT_PROMPT_MODEL_INDEX = 1;

/**
 * The one in-range guard every call site on this axis uses (mirrors
 * `clampPromptModeIndex`).
 * @param {*} index — a candidate index; may be missing, NaN, a float,
 *   negative, out of range, or not a number at all.
 * @returns {number} a valid integer index in `0..PROMPT_MODELS.length - 1`.
 *   Any value that is not itself already a valid in-range integer degrades to
 *   `DEFAULT_PROMPT_MODEL_INDEX` (1, Opus) — never NaN, never out of range,
 *   never a throw.
 */
export function clampPromptModelIndex(index) {
  const len = PROMPT_MODELS.length;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n >= len) return DEFAULT_PROMPT_MODEL_INDEX;
  return n;
}

/**
 * The total, never-throws wraparound step behind Ctrl+M (mirrors
 * `nextPromptModeIndex`). Defined for every current index (even an
 * out-of-range one — it clamps first) and every direction.
 * @param {*} current — the current selected model index (clamped internally).
 * @param {number} direction — any negative number steps BACKWARD (wraps from
 *   Fable, index 0, to Haiku, the last index); any non-negative number steps
 *   FORWARD (wraps from Haiku, the last index, to Fable, index 0).
 * @returns {number} the next valid index, wrapped.
 */
export function nextPromptModelIndex(current, direction) {
  const len = PROMPT_MODELS.length;
  const base = clampPromptModelIndex(current);
  const step = direction < 0 ? -1 : 1;
  return (base + step + len) % len;
}

/**
 * Ctrl+M must cycle `selectedModel` exactly ONCE per keystroke, no matter
 * where on the board it is pressed — but it has two possible dispatch paths
 * in `board.js`: the prompt field's own `onKeyDown` (owns it via
 * `promptBarKeyIntent`'s CYCLE_MODEL label whenever the field is the event's
 * target) and a window-scoped `document` keydown fallback (owns it
 * everywhere else, mirroring the existing Ctrl+Space pattern). Because React
 * mounts under `createRoot`, a keydown dispatched on the field is handled by
 * the field's own listener AND still bubbles natively to `document` — so
 * without a guard, BOTH paths would act on the same keystroke and
 * `selectedModel` would advance by two (a real bug caught in
 * agentic-workflow-m2vkp iteration 1 verification).
 *
 * This is the ONE mutual-exclusion guard the window-scoped fallback consults
 * before acting: it refuses whenever the event's `target` is the prompt
 * field itself, deferring entirely to the field's own handler in that case.
 * The field's own handler needs no matching guard — it is only ever invoked
 * for events targeting the field (or a descendant), and `promptBarKeyIntent`
 * already decided it owns Ctrl+M.
 * @param {{target?: *}} event — a keydown event (or a plain object shaped
 *   like one, for tests).
 * @param {*} promptFieldEl — the prompt textarea's own DOM node (or a
 *   sentinel standing in for it in tests).
 * @returns {boolean} `true` when the window-scoped fallback should act on
 *   this keystroke, `false` when the field already owns it. A missing/null
 *   `event` or `promptFieldEl` degrades to `true` (act) — never a throw —
 *   since there is then no field to defer to.
 */
export function shouldWindowCtrlMHandle(event, promptFieldEl) {
  const originatesInField = !!(event && promptFieldEl && event.target === promptFieldEl);
  return !originatesInField;
}

// The index of Haiku within PROMPT_MODELS — Quick Capture's pinned model.
// Looked up by id rather than a bare literal `3`, so reordering PROMPT_MODELS
// can never silently repin Quick Capture to the wrong model. Guarded through
// clampPromptModelIndex so a lookup miss (which should never happen) degrades
// to the default rather than pinning to -1.
const HAIKU_MODEL_INDEX = clampPromptModelIndex(PROMPT_MODELS.findIndex((m) => m.id === 'haiku'));

/**
 * `true` for Quick Capture (the one mode whose model is pinned), `false` for
 * every other mode. A missing/NaN/out-of-range `modeIndex` is simply "not
 * Quick Capture" — never a throw.
 *
 * Deliberately NOT `Number(modeIndex) === DEFAULT_PROMPT_MODE_INDEX` (the
 * verifier caught this on iteration 1 of agentic-workflow-m2vkp): `Number()`
 * coerces `null`, `''`, `false`, and `[]` all to `0`, which would report them
 * as "locked" — contradicting this function's own contract above, that a
 * missing index is simply "not Quick Capture". Only a genuine integer index
 * that equals `DEFAULT_PROMPT_MODE_INDEX` locks; every other shape (missing,
 * NaN, a non-number, a non-integer) reports `false`.
 * @param {*} modeIndex — a `prompt-mode.js` `PROMPT_MODES` index.
 * @returns {boolean}
 */
export function isModelLockedForMode(modeIndex) {
  return typeof modeIndex === 'number' && Number.isInteger(modeIndex) && modeIndex === DEFAULT_PROMPT_MODE_INDEX;
}

/**
 * The ONE resolver both the split button's label and `fire()`'s launch
 * payload consult — never re-derived independently at either call site.
 *
 * This is a READ-TIME PROJECTION, not a mutation: Quick Capture always
 * resolves to Haiku regardless of `selectedModelIndex`, but the stored
 * selection itself is never touched here or anywhere else. Switching
 * Modeling(Opus) -> Quick Capture (resolves Haiku) -> Modeling restores Opus,
 * because the selection was never overwritten by the pin.
 * @param {*} modeIndex — the highlighted `PROMPT_MODES` index.
 * @param {*} selectedModelIndex — the stored selected model index (clamped
 *   internally).
 * @returns {number} an index into `PROMPT_MODELS`: `HAIKU_MODEL_INDEX` when
 *   `modeIndex` is Quick Capture, the clamped `selectedModelIndex` otherwise.
 *   Never throws, never out of range.
 */
export function modelForMode(modeIndex, selectedModelIndex) {
  if (isModelLockedForMode(modeIndex)) return HAIKU_MODEL_INDEX;
  return clampPromptModelIndex(selectedModelIndex);
}
