/* ============================================================
   Agentheim — dashboard prompt-bar mode + keyboard model (ADR-0050,
   agentic-workflow-bz3az)

   Pure, framework-free judgment behind the board prompt bar's docked two-row
   console: which of the five modes (Quick Capture / Modeling / Inquire /
   Research / Plain — Plain appended last by agentic-workflow-m3vhq) is the
   single COMMITTED highlight, how Ctrl+←/→ cycles it, how a keydown on the
   prompt field is classified into exactly one of four disjoint intents, and
   (since m3vhq) whether the highlighted mode can fire at all right now. No
   React, no htm, no DOM, so this is unit-testable under `node --test`,
   joining the pure-module family (board-sort.js / board-group.js /
   search-results.js).

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
        every keydown into exactly one of 'newline' | 'cycle' | 'launch' |
        'pass', so Shift+Enter (a newline) and bare/Ctrl+Enter (launch) can
        never collide or double-handle the same keystroke.

   AMENDED by agentic-workflow-p8k4d (see ADR-0050's "## Amendment" section):
   bare Enter now LAUNCHES (reversing the original 'swallow' rule inherited
   from aw-038), and Shift+Enter is a new 'newline' intent — the textarea is
   allowed to insert the line break natively, retiring aw-038's single-line
   collapse. The 'swallow' label no longer exists.

   AMENDED by agentic-workflow-m3vhq (see ADR-0050's second "## Amendment"
   section): a fifth mode, Plain, is appended last, and index bounds/wrap
   targets move from 0..3 to 0..4 accordingly (invariants 1-3 otherwise
   unchanged). Plain introduces a genuinely new property this module now also
   carries: a mode may DECLINE to launch. `canFirePromptMode(index, prompt)`
   is the one predicate both `fire()`'s guard and the Enter button's disabled
   state consult; `promptBarKeyIntent` (invariant 4) is UNTOUCHED by this —
   bare Enter still classifies as 'launch' regardless of mode/prompt content,
   the decline happens downstream in fire(), not in the classifier.

   Color/paint is explicitly out of scope here (ADR-0050 "Out of scope") — this
   module carries only the interaction judgment; ADR-0048/ADR-0051 govern how
   the highlighted tab is painted, in board.js.
   ============================================================ */

import {
  quickCaptureCommandFor,
  modelingCommandFor,
  inquireCommandFor,
  researchCommandFor,
  plainCommandFor,
} from './modeling-command.js';

// The five modes, in the FIXED order the board renders them (ADR-0050,
// amended by agentic-workflow-m3vhq): Quick Capture (index 0, the
// default/reset target) · Modeling · Inquire · Research · Plain (appended
// last). Each entry carries what BoardPromptBar needs to render a tab and
// fire its launch: a label, a one-line meaning (subtitle), a registry glyph
// name, and the pure `*CommandFor(prompt)` builder (modeling-command.js) that
// seeds the launch with the live textarea value.
// Subtitles and glyphs conform to Section 1b (agentic-workflow-q7r3x):
// subtitles are lowercased and fuller; the glyphs are the concrete
// design-system-xr4sb set — Inquire keeps its deliberate
// design-system-r4k8m glyph (`message-circle-question`, unforked, 1b's bare
// "?" is superseded), while Modeling and Research move off the undeliberate
// `compass` / `search` defaults onto xr4sb's settled `diamond` / `circle-dot`.
// agentic-workflow-m3vhq appends a FIFTH mode, Plain, LAST. Quick Capture
// stays index 0 (the mount default and post-launch reset target, unchanged) —
// Plain is a peer, not a promoted baseline. Plain is the first mode carrying
// `requiresPrompt: true`: unlike the four legacy modes (whose bare commands
// are meaningful even on an empty prompt), Plain's command IS the prompt —
// an empty prompt has nothing to send, so Plain is the first mode that can
// DECLINE to launch (see `canFirePromptMode` below).
export const PROMPT_MODES = [
  { id: 'quick-capture', label: 'Quick Capture', subtitle: 'file it fast, no ceremony', icon: 'plus', commandFor: quickCaptureCommandFor },
  { id: 'modeling', label: 'Modeling', subtitle: 'shape into structure', icon: 'diamond', commandFor: modelingCommandFor },
  { id: 'inquire', label: 'Inquire', subtitle: 'ask the codebase', icon: 'message-circle-question', commandFor: inquireCommandFor },
  { id: 'research', label: 'Research', subtitle: 'dig deeper', icon: 'circle-dot', commandFor: researchCommandFor },
  { id: 'plain', label: 'Plain', subtitle: 'straight to Claude, no skill', icon: 'bot', commandFor: plainCommandFor, requiresPrompt: true },
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

/**
 * The ONE predicate that decides whether a mode can fire right now
 * (agentic-workflow-m3vhq). Both `fire()`'s guard (board.js) and the Enter
 * button's `disabled` state consult this single function rather than each
 * re-deriving "can this mode launch?" independently.
 *
 * Plain (`requiresPrompt: true`) is the first mode that can DECLINE to
 * launch: its command IS the prompt, so an empty/whitespace-only prompt has
 * nothing to send. The four legacy modes always fire, empty prompt or not —
 * their bare commands (`/agentheim:modeling`, etc.) are meaningful on their
 * own.
 * @param {*} index — a candidate PROMPT_MODES index (clamped internally, so
 *   an out-of-range index never throws).
 * @param {*} prompt — the live textarea contents (trimmed internally; a
 *   missing/non-string prompt is treated as empty).
 * @returns {boolean} `false` exactly when the mode at `index` has
 *   `requiresPrompt: true` AND the trimmed prompt is empty; `true` otherwise.
 *   Pure: no DOM, no I/O, never throws.
 */
export function canFirePromptMode(index, prompt) {
  const mode = PROMPT_MODES[clampPromptModeIndex(index)];
  if (!mode.requiresPrompt) return true;
  const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
  return trimmed.length > 0;
}

// The four disjoint key-intent labels `promptBarKeyIntent` classifies every
// keydown into (invariant 4). Exported so call sites compare against these
// rather than repeating the string literals.
//
// AMENDED by agentic-workflow-p8k4d: 'swallow' is retired and replaced by
// 'newline' (Shift+Enter, letting the textarea insert its line break
// natively). Bare Enter moves from 'swallow' to 'launch'.
export const PROMPT_KEY_INTENT = {
  NEWLINE: 'newline',
  CYCLE: 'cycle',
  LAUNCH: 'launch',
  PASS: 'pass',
};

/**
 * Invariant 4 (disjoint key-intent classification): classify a single keydown
 * event-like object into exactly one of four mutually exclusive intents:
 *   - 'launch'  — bare Enter OR Ctrl+Enter (no Shift). Fires the highlighted
 *     mode's command exactly as a click on the Enter button would (p8k4d:
 *     bare Enter now launches, reversing aw-038/ADR-0050's original swallow
 *     rule; Ctrl+Enter is kept as a harmless alias).
 *   - 'newline' — Shift+Enter, regardless of Ctrl. No launch; the caller lets
 *     the textarea insert its own line break natively (p8k4d — retires
 *     aw-038's single-line collapse).
 *   - 'cycle'   — Ctrl+ArrowLeft / Ctrl+ArrowRight. Moves `highlightedMode`
 *     (via `nextPromptModeIndex`); the caller reads `event.key` itself to pick
 *     the direction (ArrowRight → forward, ArrowLeft → backward).
 *   - 'pass'    — everything else (ordinary typing, unmodified navigation,
 *     any other modified/unmodified key).
 * Because this is the ONE function every call site consults, 'launch' and
 * 'newline' can never collide or be double-handled — there is no code path
 * where both run for the same keystroke (Enter vs Shift+Enter is a single
 * disjoint branch on `shiftKey`).
 * @param {{key?: string, ctrlKey?: boolean, shiftKey?: boolean}} event — a
 *   keydown event (or a plain object shaped like one, for tests).
 * @returns {'newline'|'cycle'|'launch'|'pass'} one of `PROMPT_KEY_INTENT`'s
 *   four labels. A malformed/absent event (no string `key`) degrades to
 *   'pass' — never a throw.
 */
export function promptBarKeyIntent(event) {
  if (!event || typeof event.key !== 'string') return PROMPT_KEY_INTENT.PASS;
  const ctrl = event.ctrlKey === true;
  const shift = event.shiftKey === true;
  if (event.key === 'Enter') return shift ? PROMPT_KEY_INTENT.NEWLINE : PROMPT_KEY_INTENT.LAUNCH;
  if (ctrl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return PROMPT_KEY_INTENT.CYCLE;
  return PROMPT_KEY_INTENT.PASS;
}
