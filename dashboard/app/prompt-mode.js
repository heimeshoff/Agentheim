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

   AMENDED by agentic-workflow-aqyqd (see ADR-0050's third "## Amendment"
   section): the second amendment's "the four legacy modes always fire"
   clause is REVERSED — decline-to-launch generalizes from Plain alone to
   EVERY mode. `requiresPrompt` is retired as a concept ("a prompt is
   required" is now a property of the bar, not of any one mode);
   `canFirePromptMode` answers purely from the trimmed prompt and keeps
   `index` in its signature, deliberately unread. `promptBarKeyIntent`
   (invariant 4) stays untouched, exactly as m3vhq left it.

   AMENDED by agentic-workflow-tkq7v (see ADR-0050's fourth "## Amendment"
   section): invariant 4's `cycle` trigger moves from Ctrl+←/→ to Tab /
   Shift+Tab — the prompt field is genuinely multi-line since p8k4d, and
   Ctrl+←/→ was shadowing native word-jump/word-select inside it. Ctrl+←/→
   (with or without Shift) now classify 'pass', restoring native caret
   behavior. Ctrl+Tab / Alt+Tab stay 'pass' too, so this module never shadows
   the browser's own tab-switch chords. `newline`, `launch`, and `pass`'s
   other triggers (Enter, Shift+Enter, Ctrl+Enter, Ctrl+Space) are untouched.

   AMENDED by agentic-workflow-m2vkp (see ADR-0050's fifth "## Amendment"
   section): invariant 4 gains a FIFTH disjoint label, `cycle_model` —
   Ctrl+M — cycling a SECOND, orthogonal axis (which MODEL the launched
   session runs on, `dashboard/app/prompt-model.js`) rather than which mode is
   highlighted. `cycle_model` is classified HERE, in the one classifier every
   keydown routes through, precisely so a fifth intent holds disjoint from the
   other four BY CONSTRUCTION rather than by a second handler agreeing not to
   collide with `promptBarKeyIntent`'s existing branches. The model axis's own
   wraparound/clamp/pin logic lives in `prompt-model.js`, mirroring this
   module's shape — but the KEYDOWN CLASSIFICATION stays singular, here.

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
// agentic-workflow-m3vhq appended a FIFTH mode, Plain, LAST. Quick Capture
// stays index 0 (the mount default and post-launch reset target, unchanged) —
// Plain is a peer, not a promoted baseline.
//
// agentic-workflow-aqyqd (third ADR-0050 amendment) RETIRES the per-mode
// `requiresPrompt` flag m3vhq introduced on Plain alone. The flag existed for
// exactly one reason: to mark Plain as the exception among four peers that
// always fired. Once every mode declines on an empty prompt (see
// `canFirePromptMode` below), the per-mode axis is a fiction — "a prompt is
// required" is a property of the BAR, not of any one mode — so no entry here
// carries `requiresPrompt` any more.
export const PROMPT_MODES = [
  { id: 'quick-capture', label: 'Quick Capture', subtitle: 'file it fast, no ceremony', icon: 'plus', commandFor: quickCaptureCommandFor },
  { id: 'modeling', label: 'Modeling', subtitle: 'shape into structure', icon: 'diamond', commandFor: modelingCommandFor },
  { id: 'inquire', label: 'Inquire', subtitle: 'ask the codebase', icon: 'message-circle-question', commandFor: inquireCommandFor },
  { id: 'research', label: 'Research', subtitle: 'dig deeper', icon: 'circle-dot', commandFor: researchCommandFor },
  { id: 'plain', label: 'Plain', subtitle: 'straight to Claude, no skill', icon: 'bot', commandFor: plainCommandFor },
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
 * (introduced agentic-workflow-m3vhq for Plain alone; GENERALIZED to every
 * mode by agentic-workflow-aqyqd, the third ADR-0050 amendment). Both
 * `fire()`'s guard (board.js) and the Enter button's `disabled` state consult
 * this single function rather than each re-deriving "can this mode launch?"
 * independently.
 *
 * The prompt bar is a prompt console: with no prompt there is nothing to
 * send, in any mode. `requiresPrompt` (m3vhq's per-mode flag marking Plain as
 * the lone exception) is retired — "a prompt is required" is now a property
 * of THE BAR, not of any one mode, so this predicate answers purely from the
 * trimmed prompt.
 *
 * `index` is kept in the signature deliberately, though UNREAD: it keeps
 * both call sites (`board.js`'s `fire()` guard and its Enter-button disabled
 * state) and this module's tests stable across the reversal, and leaves a
 * cheap door open for a future per-mode exception to return without a
 * re-plumbing. Because `index` is never read, an out-of-range or
 * non-numeric `index` cannot throw here — the old `clampPromptModeIndex`
 * lookup this function used to perform (to find `mode.requiresPrompt`) is
 * gone along with the mode lookup itself.
 * @param {*} index — unread; retained only for signature/call-site stability
 *   and a future per-mode exception.
 * @param {*} prompt — the live textarea contents (trimmed internally; a
 *   missing/non-string/whitespace-only prompt is treated as empty).
 * @returns {boolean} `true` exactly when the trimmed prompt is non-empty;
 *   `false` otherwise. Pure: no DOM, no I/O, never throws.
 */
export function canFirePromptMode(index, prompt) {
  const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
  return trimmed.length > 0;
}

// Every launch used to show up in VS Code as "Claude" — the bridge extension
// hard-coded createTerminal({ name: 'Claude' }). infrastructure-c6fzb threads
// an explicit session `name` through POST /run instead, and the prompt bar is
// the best place to build it: it already knows WHICH mode is armed, more
// cleanly than the bridge's own `/agentheim:<skill>` prefix-parsing fallback
// can recover it from the seeded command string alone.
const LAUNCH_NAME_MAX_LEN = 60;

/**
 * Build the session name for a prompt-bar launch (infrastructure-c6fzb):
 * `"<mode label>: <typed text>"`, or the bare mode label when nothing was
 * typed. Capped defensively — the bridge (`vscode-extension/src/bridge.js`)
 * re-sanitizes/caps whatever it receives regardless, so this is a courtesy
 * derivation, not the authoritative sanitizer.
 * @param {*} index — the highlighted mode index (clamped internally).
 * @param {*} prompt — the live textarea contents.
 * @returns {string} never throws; a missing/non-string/whitespace-only
 *   prompt degrades to the bare mode label.
 */
export function nameForPromptMode(index, prompt) {
  const idx = clampPromptModeIndex(index);
  const label = PROMPT_MODES[idx].label;
  const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
  const base = trimmed ? `${label}: ${trimmed}` : label;
  return base.slice(0, LAUNCH_NAME_MAX_LEN);
}

// The five disjoint key-intent labels `promptBarKeyIntent` classifies every
// keydown into (invariant 4). Exported so call sites compare against these
// rather than repeating the string literals.
//
// AMENDED by agentic-workflow-p8k4d: 'swallow' is retired and replaced by
// 'newline' (Shift+Enter, letting the textarea insert its line break
// natively). Bare Enter moves from 'swallow' to 'launch'.
//
// AMENDED by agentic-workflow-m2vkp (ADR-0050's fifth amendment): a FIFTH
// label, 'cycle_model' (Ctrl+M), cycles the SECOND, orthogonal model-
// selection axis (prompt-model.js) — disjoint from 'cycle', which moves the
// mode-highlight axis.
export const PROMPT_KEY_INTENT = {
  NEWLINE: 'newline',
  CYCLE: 'cycle',
  CYCLE_MODEL: 'cycle_model',
  LAUNCH: 'launch',
  PASS: 'pass',
};

/**
 * Invariant 4 (disjoint key-intent classification): classify a single keydown
 * event-like object into exactly one of five mutually exclusive intents:
 *   - 'launch'      — bare Enter OR Ctrl+Enter (no Shift). Fires the
 *     highlighted mode's command exactly as a click on the Enter button
 *     would (p8k4d: bare Enter now launches, reversing aw-038/ADR-0050's
 *     original swallow rule; Ctrl+Enter is kept as a harmless alias).
 *   - 'newline'     — Shift+Enter, regardless of Ctrl. No launch; the caller
 *     lets the textarea insert its own line break natively (p8k4d — retires
 *     aw-038's single-line collapse).
 *   - 'cycle'       — Tab (no Ctrl/Alt) or Shift+Tab (agentic-workflow-tkq7v,
 *     ADR-0050 amendment — reverses the original Ctrl+ArrowLeft/ArrowRight
 *     trigger). Moves `highlightedMode` (via `nextPromptModeIndex`); the
 *     caller reads `event.shiftKey` itself to pick the direction (Tab →
 *     forward, Shift+Tab → backward). Ctrl+Tab / Alt+Tab classify 'pass' so
 *     browser tab-switch chords are never shadowed. Ctrl+ArrowLeft /
 *     Ctrl+ArrowRight (with or without Shift) now classify 'pass' too,
 *     restoring native word-jump/word-select inside the textarea.
 *   - 'cycle_model' — Ctrl+M (agentic-workflow-m2vkp, ADR-0050's fifth
 *     amendment). Moves the SELECTED MODEL index (`nextPromptModelIndex`,
 *     `prompt-model.js`) — an axis entirely separate from `highlightedMode`.
 *     In a browser `keydown`, Ctrl+M reports `key === 'm'` with `ctrlKey` —
 *     it does NOT masquerade as `Enter` (the ASCII-CR reading is a terminal
 *     concept; the dashboard runs in VS Code's Simple Browser, not a
 *     terminal) — so this branch can never collide with 'launch'.
 *   - 'pass'        — everything else (ordinary typing, unmodified
 *     navigation, any other modified/unmodified key).
 * Because this is the ONE function every call site consults, no two of the
 * five labels can ever collide or be double-handled for the same keystroke.
 * @param {{key?: string, ctrlKey?: boolean, shiftKey?: boolean}} event — a
 *   keydown event (or a plain object shaped like one, for tests).
 * @returns {'newline'|'cycle'|'cycle_model'|'launch'|'pass'} one of
 *   `PROMPT_KEY_INTENT`'s five labels. A malformed/absent event (no string
 *   `key`) degrades to 'pass' — never a throw.
 */
export function promptBarKeyIntent(event) {
  if (!event || typeof event.key !== 'string') return PROMPT_KEY_INTENT.PASS;
  const ctrl = event.ctrlKey === true;
  const alt = event.altKey === true;
  const shift = event.shiftKey === true;
  if (event.key === 'Enter') return shift ? PROMPT_KEY_INTENT.NEWLINE : PROMPT_KEY_INTENT.LAUNCH;
  // agentic-workflow-tkq7v (ADR-0050 amendment): the cycle trigger moves from
  // Ctrl+←/→ to Tab / Shift+Tab. Ctrl+Tab and Alt+Tab are deliberately left
  // classified 'pass' so the browser's own tab-switch chords are never
  // shadowed — only a bare Tab (with or without Shift alone) cycles.
  if (event.key === 'Tab' && !ctrl && !alt) return PROMPT_KEY_INTENT.CYCLE;
  // agentic-workflow-m2vkp (ADR-0050's fifth amendment): Ctrl+M cycles the
  // SELECTED MODEL, an axis disjoint from the mode highlight above.
  if (ctrl && !alt && (event.key === 'm' || event.key === 'M')) return PROMPT_KEY_INTENT.CYCLE_MODEL;
  // Ctrl+ArrowLeft / Ctrl+ArrowRight (with or without Shift) are no longer
  // intercepted at all — they fall through to 'pass', restoring the
  // textarea's native word-jump and word-select.
  return PROMPT_KEY_INTENT.PASS;
}
