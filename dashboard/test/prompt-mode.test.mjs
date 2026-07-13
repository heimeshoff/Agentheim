// Pure-module coverage for the board prompt bar's keyboard-committed
// selection model (ADR-0050, agentic-workflow-bz3az). `dashboard/app/prompt-mode.js`
// carries four invariants; this suite locks each one directly against the pure
// exports, mirroring the `node --test` coverage of board-sort.js/board-group.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_MODES,
  DEFAULT_PROMPT_MODE_INDEX,
  clampPromptModeIndex,
  nextPromptModeIndex,
  promptBarKeyIntent,
  PROMPT_KEY_INTENT,
  canFirePromptMode,
  nameForPromptMode,
} from '../app/prompt-mode.js';

// --- fixed order / shape -----------------------------------------------

// agentic-workflow-m3vhq: Plain is APPENDED LAST as the fifth mode — the
// four-mode order and count are now historical (bz3az/q7r3x); this suite
// asserts the five-mode shape going forward.
test('PROMPT_MODES holds exactly five modes in the fixed order Quick Capture · Modeling · Inquire · Research · Plain', () => {
  assert.equal(PROMPT_MODES.length, 5);
  assert.deepEqual(PROMPT_MODES.map((m) => m.label), ['Quick Capture', 'Modeling', 'Inquire', 'Research', 'Plain']);
});

test('index 0 is Quick Capture — the default/reset target', () => {
  assert.equal(PROMPT_MODES[0].label, 'Quick Capture');
  assert.equal(DEFAULT_PROMPT_MODE_INDEX, 0);
});

test('each mode carries a commandFor builder that is a function', () => {
  for (const mode of PROMPT_MODES) {
    assert.equal(typeof mode.commandFor, 'function');
    assert.equal(typeof mode.icon, 'string');
    assert.equal(typeof mode.subtitle, 'string');
  }
});

// agentic-workflow-q7r3x: subtitles conform to Section 1b, lowercased and
// fuller, exact strings. agentic-workflow-m3vhq appends Plain's subtitle.
test('subtitles match Section 1b exactly, lowercased and fuller (agentic-workflow-q7r3x, +Plain from m3vhq)', () => {
  assert.deepEqual(PROMPT_MODES.map((m) => m.subtitle), [
    'file it fast, no ceremony',
    'shape into structure',
    'ask the codebase',
    'dig deeper',
    'straight to Claude, no skill',
  ]);
});

// agentic-workflow-q7r3x: the four mode-tab glyphs are the concrete
// design-system-xr4sb set — Inquire keeps its deliberate design-system-r4k8m
// glyph; diamond/circle-dot replace the undeliberate compass/search defaults
// Modeling and Research previously wore. agentic-workflow-m3vhq reuses the
// existing `bot` glyph for Plain — no new glyph.
test('glyphs are the concrete design-system-xr4sb set, +Plain\'s reused `bot` glyph (agentic-workflow-q7r3x / m3vhq)', () => {
  assert.deepEqual(PROMPT_MODES.map((m) => m.icon), [
    'plus',
    'diamond',
    'message-circle-question',
    'circle-dot',
    'bot',
  ]);
});

// agentic-workflow-aqyqd (third ADR-0050 amendment): `requiresPrompt` is
// RETIRED entirely — it existed only to mark Plain as the exception among
// four always-firing peers. Once every mode declines on an empty prompt,
// the per-mode flag is a fiction; "a prompt is required" is a property of
// the BAR (canFirePromptMode), not of any one mode. The key must appear on
// no `PROMPT_MODES` entry, Plain included.
test('no PROMPT_MODES entry carries requiresPrompt — the flag is retired; decline-to-launch is a bar-level property, not a per-mode one (agentic-workflow-aqyqd)', () => {
  for (const mode of PROMPT_MODES) {
    assert.equal('requiresPrompt' in mode, false, `${mode.id} must not carry a requiresPrompt key`);
  }
});

// --- invariant 2: index always in range (clampPromptModeIndex) ---------

test('clampPromptModeIndex passes through every valid index unchanged', () => {
  for (let i = 0; i < PROMPT_MODES.length; i++) {
    assert.equal(clampPromptModeIndex(i), i);
  }
});

test('clampPromptModeIndex degrades every invalid input to the default (0), never throws, never NaN', () => {
  const invalid = [-1, 5, 100, -100, 1.5, NaN, Infinity, -Infinity, null, undefined, 'x', {}, [], '2', true, false];
  for (const value of invalid) {
    const result = clampPromptModeIndex(value);
    assert.ok(Number.isInteger(result), `clamp(${String(value)}) must be an integer`);
    assert.ok(result >= 0 && result < PROMPT_MODES.length, `clamp(${String(value)}) must be in range`);
  }
  // Explicitly: fully invalid values land on the default target, index 0.
  assert.equal(clampPromptModeIndex(-1), 0);
  // agentic-workflow-m3vhq: re-pinned — 5 is now the first OUT-of-range index
  // (Plain, index 4, is now valid), so this assertion must move from 4 to 5.
  assert.equal(clampPromptModeIndex(5), 0);
  assert.equal(clampPromptModeIndex(NaN), 0);
  assert.equal(clampPromptModeIndex(undefined), 0);
  assert.equal(clampPromptModeIndex('nonsense'), 0);
});

// --- invariant 3: total, deterministic wraparound (nextPromptModeIndex) -

test('Ctrl+→ (forward) steps 0→1→2→3→4→0, a total 5-cycle visiting every index exactly once (agentic-workflow-m3vhq)', () => {
  let i = 0;
  const seen = [i];
  for (let step = 0; step < 5; step++) {
    i = nextPromptModeIndex(i, 1);
    seen.push(i);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 0]);
});

test('Ctrl+← (backward) steps 0→4→3→2→1→0, a total 5-cycle visiting every index exactly once (agentic-workflow-m3vhq)', () => {
  let i = 0;
  const seen = [i];
  for (let step = 0; step < 5; step++) {
    i = nextPromptModeIndex(i, -1);
    seen.push(i);
  }
  assert.deepEqual(seen, [0, 4, 3, 2, 1, 0]);
});

test('forward wraparound specifically: past Plain (4) wraps to Quick Capture (0) (agentic-workflow-m3vhq)', () => {
  assert.equal(nextPromptModeIndex(4, 1), 0);
});

test('backward wraparound specifically: before Quick Capture (0) wraps to Plain (4) (agentic-workflow-m3vhq)', () => {
  assert.equal(nextPromptModeIndex(0, -1), 4);
});

test('nextPromptModeIndex is defined and in-range for every current index and both directions (never throws)', () => {
  for (let current = 0; current < PROMPT_MODES.length; current++) {
    for (const direction of [1, -1]) {
      const next = nextPromptModeIndex(current, direction);
      assert.ok(Number.isInteger(next) && next >= 0 && next < PROMPT_MODES.length);
    }
  }
});

test('nextPromptModeIndex clamps an out-of-range current before stepping, never throwing', () => {
  assert.doesNotThrow(() => nextPromptModeIndex(NaN, 1));
  assert.doesNotThrow(() => nextPromptModeIndex(-5, -1));
  assert.doesNotThrow(() => nextPromptModeIndex(undefined, 1));
  const result = nextPromptModeIndex(NaN, 1);
  assert.ok(Number.isInteger(result) && result >= 0 && result < PROMPT_MODES.length);
});

// --- invariant 4: disjoint key-intent classification (promptBarKeyIntent) -

test('bare Enter (no Ctrl, no Shift) classifies as launch (p8k4d reverses aw-038/ADR-0050s swallow)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Enter', ctrlKey: false }), PROMPT_KEY_INTENT.LAUNCH);
  assert.equal(promptBarKeyIntent({ key: 'Enter' }), PROMPT_KEY_INTENT.LAUNCH);
});

test('Ctrl+Enter also classifies as launch (kept as a harmless alias, p8k4d Notes)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Enter', ctrlKey: true }), PROMPT_KEY_INTENT.LAUNCH);
});

test('Shift+Enter classifies as newline regardless of Ctrl (p8k4d new intent, retires aw-038 collapse)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Enter', shiftKey: true, ctrlKey: false }), PROMPT_KEY_INTENT.NEWLINE);
  assert.equal(promptBarKeyIntent({ key: 'Enter', shiftKey: true, ctrlKey: true }), PROMPT_KEY_INTENT.NEWLINE);
});

// agentic-workflow-tkq7v (ADR-0050 amendment): Ctrl+←/→ (with or without
// Shift) is RESTORED to native word-jump/word-select — it must classify as
// pass-through, not cycle. This is the exact assertion the original
// bz3az/ADR-0050 suite made the other way — re-pinned here on purpose so the
// reversal stays visible, per the task's explicit instruction to invert
// rather than delete.
test('Ctrl+ArrowRight and Ctrl+ArrowLeft classify as pass-through, with or without Shift — native word-jump/word-select restored (agentic-workflow-tkq7v)', () => {
  assert.equal(promptBarKeyIntent({ key: 'ArrowRight', ctrlKey: true }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'ArrowLeft', ctrlKey: true }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'ArrowRight', ctrlKey: true, shiftKey: true }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true }), PROMPT_KEY_INTENT.PASS);
});

test('unmodified ArrowLeft/ArrowRight (no Ctrl) classify as pass-through, not cycle', () => {
  assert.equal(promptBarKeyIntent({ key: 'ArrowRight', ctrlKey: false }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'ArrowLeft' }), PROMPT_KEY_INTENT.PASS);
});

// agentic-workflow-tkq7v: Tab (no modifiers) and Shift+Tab now classify as
// cycle — the new trigger invariant 4's cycle label uses, replacing
// Ctrl+←/→. Ctrl+Tab / Alt+Tab must stay pass-through so the browser's own
// tab-switch chords are never shadowed.
test('Tab (no modifiers) and Shift+Tab classify as cycle (agentic-workflow-tkq7v)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Tab' }), PROMPT_KEY_INTENT.CYCLE);
  assert.equal(promptBarKeyIntent({ key: 'Tab', shiftKey: true }), PROMPT_KEY_INTENT.CYCLE);
});

test('Ctrl+Tab and Alt+Tab classify as pass-through, not cycle — never shadow browser tab-switch chords (agentic-workflow-tkq7v)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Tab', ctrlKey: true }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'Tab', altKey: true }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 'Tab', ctrlKey: true, shiftKey: true }), PROMPT_KEY_INTENT.PASS);
});

test('ordinary typing and other modified keys classify as pass-through', () => {
  assert.equal(promptBarKeyIntent({ key: 'a', ctrlKey: false }), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: ' ', ctrlKey: false }), PROMPT_KEY_INTENT.PASS);
});

test('a malformed/absent event degrades to pass-through, never throws', () => {
  assert.equal(promptBarKeyIntent(undefined), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent(null), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({}), PROMPT_KEY_INTENT.PASS);
  assert.equal(promptBarKeyIntent({ key: 123 }), PROMPT_KEY_INTENT.PASS);
});

test('bare Enter and Shift+Enter can never collide: exactly one of launch/newline fires for each, never both', () => {
  const bare = promptBarKeyIntent({ key: 'Enter', ctrlKey: false });
  const shift = promptBarKeyIntent({ key: 'Enter', shiftKey: true, ctrlKey: false });
  assert.notEqual(bare, shift);
  assert.equal(bare, PROMPT_KEY_INTENT.LAUNCH);
  assert.equal(shift, PROMPT_KEY_INTENT.NEWLINE);
});

test('every classification returns exactly one of the four disjoint labels', () => {
  const labels = new Set(Object.values(PROMPT_KEY_INTENT));
  assert.equal(labels.size, 4);
  assert.ok(!('SWALLOW' in PROMPT_KEY_INTENT), 'the swallow label must be retired (p8k4d)');
  assert.equal(PROMPT_KEY_INTENT.NEWLINE, 'newline');
  const samples = [
    { key: 'Enter', ctrlKey: false },
    { key: 'Enter', ctrlKey: true },
    { key: 'Enter', shiftKey: true, ctrlKey: false },
    { key: 'Tab' },
    { key: 'Tab', shiftKey: true },
    { key: 'a', ctrlKey: false },
  ];
  for (const s of samples) {
    assert.ok(labels.has(promptBarKeyIntent(s)));
  }
});

// agentic-workflow-m3vhq (AC 5): Plain's decline-to-launch is a `fire()`-level
// concern, NOT a fifth key-intent. promptBarKeyIntent stays untouched — bare
// Enter on an empty Plain prompt still classifies as `launch`; whether that
// launch actually fires is `canFirePromptMode`'s job, consulted downstream in
// board.js's fire(), not here.
test('promptBarKeyIntent is UNTOUCHED by Plain: bare Enter still classifies as launch regardless of mode or prompt content (agentic-workflow-m3vhq)', () => {
  assert.equal(promptBarKeyIntent({ key: 'Enter', ctrlKey: false }), PROMPT_KEY_INTENT.LAUNCH);
  // The classifier has no notion of "which mode" or "is the prompt empty" —
  // it classifies the KEYSTROKE only, never the mode/prompt pair.
  assert.equal(typeof promptBarKeyIntent.length, 'number');
  assert.equal(promptBarKeyIntent.length, 1, 'promptBarKeyIntent must take only the event — no mode/prompt params were added for Plain');
});

// --- canFirePromptMode (introduced agentic-workflow-m3vhq, generalized to
// every mode by agentic-workflow-aqyqd) --------------------------------
//
// The ONE predicate both the fire() guard (AC 4) and the Enter button's
// disabled state (AC 6) consult, rather than each re-deriving "can this mode
// fire right now?" independently. `requiresPrompt` (m3vhq's per-mode flag)
// is retired by aqyqd — the predicate now answers purely from the trimmed
// prompt, for every index alike.

// agentic-workflow-aqyqd (third ADR-0050 amendment, REVERSES the second
// amendment's "the four legacy modes always fire" clause): NO mode fires on
// an empty/whitespace-only/missing prompt — the decline-to-launch property
// generalizes from Plain alone to the bar as a whole. This is the exact
// assertion `agentic-workflow-m3vhq` wrote down the other way — re-pinned
// here on purpose, not deleted, so the reversal stays visible.
test('canFirePromptMode is false for EVERY mode (index 0..4) on an empty/whitespace-only/missing prompt — decline generalizes from Plain to the whole bar (agentic-workflow-aqyqd, reverses m3vhq)', () => {
  for (let i = 0; i < PROMPT_MODES.length; i++) {
    assert.equal(canFirePromptMode(i, ''), false, `mode index ${i} must NOT fire on an empty prompt`);
    assert.equal(canFirePromptMode(i, undefined), false, `mode index ${i} must NOT fire on a missing prompt`);
    assert.equal(canFirePromptMode(i, null), false, `mode index ${i} must NOT fire on a null prompt`);
    assert.equal(canFirePromptMode(i, '   '), false, `mode index ${i} must NOT fire on a whitespace-only prompt`);
  }
});

test('canFirePromptMode is true for EVERY mode (index 0..4) once the prompt has real content (agentic-workflow-aqyqd)', () => {
  for (let i = 0; i < PROMPT_MODES.length; i++) {
    assert.equal(canFirePromptMode(i, 'talk to me'), true, `mode index ${i} must fire on real content`);
    assert.equal(canFirePromptMode(i, '  padded  '), true, `mode index ${i} must fire on a padded real prompt`);
  }
});

// `index` is retained in the signature (call-site + test stability, and a
// cheap door back to a future per-mode exception) but deliberately UNREAD —
// the same prompt must produce the same answer regardless of which index is
// passed, including out-of-range ones.
test('canFirePromptMode does not read index — an out-of-range/non-numeric index never throws and never changes the answer for the same prompt (agentic-workflow-aqyqd)', () => {
  assert.doesNotThrow(() => canFirePromptMode(999, ''));
  assert.doesNotThrow(() => canFirePromptMode(-1, 'x'));
  assert.doesNotThrow(() => canFirePromptMode(NaN, 'x'));
  assert.doesNotThrow(() => canFirePromptMode(undefined, 'x'));
  assert.equal(canFirePromptMode(999, ''), false);
  assert.equal(canFirePromptMode(-1, ''), false);
  assert.equal(canFirePromptMode(999, 'x'), true);
  assert.equal(canFirePromptMode(-1, 'x'), true);
  assert.equal(canFirePromptMode(NaN, 'x'), canFirePromptMode(0, 'x'));
});

// --- nameForPromptMode (infrastructure-c6fzb) --------------------------
//
// Every dashboard-launched session used to show as "Claude" in VS Code; the
// bridge now names the session at launch via POST /run's optional `name`
// field. The prompt bar builds that name from mode + typed text, since it
// already knows which mode is armed more cleanly than the bridge's own
// `/agentheim:<skill>` prefix-parsing fallback can recover it.

test('nameForPromptMode builds "<mode label>: <typed text>" for every mode', () => {
  assert.equal(nameForPromptMode(0, 'dark mode toggle'), 'Quick Capture: dark mode toggle');
  assert.equal(nameForPromptMode(1, 'dark mode toggle'), 'Modeling: dark mode toggle');
  assert.equal(nameForPromptMode(2, 'why is this slow'), 'Inquire: why is this slow');
  assert.equal(nameForPromptMode(3, 'competitor pricing'), 'Research: competitor pricing');
  assert.equal(nameForPromptMode(4, 'hello there'), 'Plain: hello there');
});

test('nameForPromptMode trims the prompt and degrades to the bare mode label when there is nothing typed', () => {
  assert.equal(nameForPromptMode(1, '   '), 'Modeling');
  assert.equal(nameForPromptMode(1, ''), 'Modeling');
  assert.equal(nameForPromptMode(1, undefined), 'Modeling');
  assert.equal(nameForPromptMode(1, null), 'Modeling');
  assert.equal(nameForPromptMode(1, '  dark mode  '), 'Modeling: dark mode');
});

test('nameForPromptMode clamps an invalid index the same way clampPromptModeIndex does, never throwing', () => {
  assert.equal(nameForPromptMode(999, 'x'), nameForPromptMode(DEFAULT_PROMPT_MODE_INDEX, 'x'));
  assert.doesNotThrow(() => nameForPromptMode(NaN, 'x'));
  assert.doesNotThrow(() => nameForPromptMode(undefined, 'x'));
});

test('nameForPromptMode caps the derived name at a defensive length, never throwing on a very long prompt', () => {
  const long = 'x'.repeat(500);
  const name = nameForPromptMode(1, long);
  assert.ok(name.length <= 60, 'the derived name must be capped');
  assert.ok(name.startsWith('Modeling: '), 'the mode-label prefix must survive the cap');
});
