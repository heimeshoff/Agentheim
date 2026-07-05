/* ============================================================
   Agentheim — dashboard prompt-bar mode + keyboard model (ADR-0050,
   agentic-workflow-bz3az)

   Pure, framework-free judgment behind the board prompt bar's docked two-row
   console: which of the four modes (Quick Capture / Modeling / Inquire /
   Research) is the single COMMITTED highlight, how Ctrl+←/→ cycles it, and how
   a keydown on the prompt field is classified into exactly one of four
   disjoint intents. No React, no htm, no DOM, so this is unit-testable under
   `node --test`, joining the pure-module family (board-sort.js / board-group.js
   / search-results.js).

   ADR-0050 names this module and its exported shape (PROMPT_MODES,
   nextPromptModeIndex, clampPromptModeIndex, promptBarKeyIntent) and states
   four invariants this module's tests must cover:
     1. Exactly-one-highlighted — `highlightedMode` is a SINGLE index, so
        "none" and "more than one" are unrepresentable by construction.
     2. Index always in range — `clampPromptModeIndex` is the one guard every
        call site (cycling, mount default, reset) uses rather than re-deriving
        the bound inline.
     3. Total, deterministic wraparound — `nextPromptModeIndex` is defined for
        every current index and either direction, never throws, never returns
        out-of-range.
     4. Disjoint key-intent classification — `promptBarKeyIntent` classifies
        every keydown into exactly one of 'swallow' | 'cycle' | 'launch' |
        'pass', so bare Enter (aw-038's swallow) and Ctrl+Enter (launch) can
        never collide or double-handle the same keystroke.

   Color/paint is explicitly out of scope here (ADR-0050 "Out of scope") — this
   module carries only the interaction judgment; ADR-0048/ADR-0051 govern how
   the highlighted tab is painted, in board.js.
   ============================================================ */

import {
  quickCaptureCommandFor,
  modelingCommandFor,
  inquireCommandFor,
  researchCommandFor,
} from './modeling-command.js';

// The four modes, in the FIXED order the board renders them (ADR-0050):
// Quick Capture (index 0, the default/reset target) · Modeling · Inquire ·
// Research. Each entry carries what BoardPromptBar needs to render a tab and
// fire its launch: a label, a one-line meaning (subtitle), a registry glyph
// name, and the pure `*CommandFor(prompt)` builder (modeling-command.js) that
// seeds the launch with the live textarea value.
export const PROMPT_MODES = [
  { id: 'quick-capture', label: 'Quick Capture', subtitle: 'File it fast', icon: 'plus', commandFor: quickCaptureCommandFor },
  { id: 'modeling', label: 'Modeling', subtitle: 'Shape into structure', icon: 'compass', commandFor: modelingCommandFor },
  { id: 'inquire', label: 'Inquire', subtitle: 'Ask the codebase', icon: 'message-circle-question', commandFor: inquireCommandFor },
  { id: 'research', label: 'Research', subtitle: 'Dig deeper', icon: 'search', commandFor: researchCommandFor },
];

// The default AND reset target (ADR-0050 §default/reset): Quick Capture,
// index 0. Mount-time state and the post-launch reset both read this rather
// than a bare literal `0` scattered across call sites.
export const DEFAULT_PROMPT_MODE_INDEX = 0;

/**
 * Invariant 2 (index always in range): clamp any candidate index into a valid
 * `PROMPT_MODES` index (0..3). Every other operation in this module that could
 * move `highlightedMode` (cycling, a caller's mount-time default, a reset)
 * routes through this guard rather than re-deriving the bound inline.
 * @param {*} index — a candidate index; may be missing, NaN, a float, negative,
 *   out of range, or not a number at all.
 * @returns {number} a valid integer index in `0..PROMPT_MODES.length - 1`. Any
 *   value that is not itself already a valid in-range integer degrades to
 *   `DEFAULT_PROMPT_MODE_INDEX` (0) — never NaN, never out of range, never a
 *   throw.
 */
export function clampPromptModeIndex(index) {
  const len = PROMPT_MODES.length;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n >= len) return DEFAULT_PROMPT_MODE_INDEX;
  return n;
}

/**
 * Invariant 3 (total, deterministic wraparound): the pure step function behind
 * Ctrl+← / Ctrl+→. Defined for every current index (even an out-of-range one —
 * it clamps first) and every direction; never throws, never returns
 * out-of-range.
 * @param {*} current — the current highlightedMode (clamped internally).
 * @param {number} direction — the step direction: any negative number steps
 *   BACKWARD (Ctrl+←; before Quick Capture wraps to Research); any
 *   non-negative number steps FORWARD (Ctrl+→; past Research wraps to Quick
 *   Capture).
 * @returns {number} the next valid index, wrapped.
 */
export function nextPromptModeIndex(current, direction) {
  const len = PROMPT_MODES.length;
  const base = clampPromptModeIndex(current);
  const step = direction < 0 ? -1 : 1;
  return (base + step + len) % len;
}

// The four disjoint key-intent labels `promptBarKeyIntent` classifies every
// keydown into (invariant 4). Exported so call sites compare against these
// rather than repeating the string literals.
export const PROMPT_KEY_INTENT = {
  SWALLOW: 'swallow',
  CYCLE: 'cycle',
  LAUNCH: 'launch',
  PASS: 'pass',
};

/**
 * Invariant 4 (disjoint key-intent classification): classify a single keydown
 * event-like object into exactly one of four mutually exclusive intents:
 *   - 'swallow' — bare Enter (no Ctrl). No newline, no launch (aw-038,
 *     untouched by ADR-0050).
 *   - 'launch'  — Ctrl+Enter. Fires the highlighted mode's command exactly as
 *     a click on that tab would.
 *   - 'cycle'   — Ctrl+ArrowLeft / Ctrl+ArrowRight. Moves `highlightedMode`
 *     (via `nextPromptModeIndex`); the caller reads `event.key` itself to pick
 *     the direction (ArrowRight → forward, ArrowLeft → backward).
 *   - 'pass'    — everything else (ordinary typing, unmodified navigation,
 *     any other modified/unmodified key).
 * Because this is the ONE function every call site consults, bare Enter and
 * Ctrl+Enter can never collide or be double-handled — there is no code path
 * where both 'swallow' and 'launch' logic run for the same keystroke.
 * @param {{key?: string, ctrlKey?: boolean}} event — a keydown event (or a
 *   plain object shaped like one, for tests).
 * @returns {'swallow'|'cycle'|'launch'|'pass'} one of `PROMPT_KEY_INTENT`'s
 *   four labels. A malformed/absent event (no string `key`) degrades to
 *   'pass' — never a throw.
 */
export function promptBarKeyIntent(event) {
  if (!event || typeof event.key !== 'string') return PROMPT_KEY_INTENT.PASS;
  const ctrl = event.ctrlKey === true;
  if (event.key === 'Enter') return ctrl ? PROMPT_KEY_INTENT.LAUNCH : PROMPT_KEY_INTENT.SWALLOW;
  if (ctrl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return PROMPT_KEY_INTENT.CYCLE;
  return PROMPT_KEY_INTENT.PASS;
}
