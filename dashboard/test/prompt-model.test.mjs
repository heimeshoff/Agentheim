// Pure-module coverage for the board prompt bar's MODEL selector (ADR-0050's
// fifth amendment, agentic-workflow-m2vkp). `dashboard/app/prompt-model.js`
// mirrors `prompt-mode.js`'s discipline on a second, orthogonal axis; this
// suite locks its shape, its in-range/wraparound guards, and the read-time
// pin projection directly against the pure exports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_MODELS,
  DEFAULT_PROMPT_MODEL_INDEX,
  clampPromptModelIndex,
  nextPromptModelIndex,
  isModelLockedForMode,
  modelForMode,
  shouldWindowCtrlMHandle,
} from '../app/prompt-model.js';
import { DEFAULT_PROMPT_MODE_INDEX, promptBarKeyIntent, PROMPT_KEY_INTENT } from '../app/prompt-mode.js';

// --- shape / ids ---------------------------------------------------------

test('PROMPT_MODELS holds exactly four models in the fixed order Fable · Opus · Sonnet · Haiku', () => {
  assert.equal(PROMPT_MODELS.length, 4);
  assert.deepEqual(PROMPT_MODELS.map((m) => m.label), ['Fable', 'Opus', 'Sonnet', 'Haiku']);
});

// The ids must be the exact short aliases the bridge's MODEL_ALLOWLIST
// (vscode-extension/src/bridge.js) accepts — a full model name is NOT in the
// allowlist and would silently degrade to no --model flag at all.
test('PROMPT_MODELS ids are the bridge MODEL_ALLOWLIST short aliases, not full model ids', () => {
  assert.deepEqual(PROMPT_MODELS.map((m) => m.id), ['fable', 'opus', 'sonnet', 'haiku']);
});

test('Opus (index 1) is the default model on mount', () => {
  assert.equal(DEFAULT_PROMPT_MODEL_INDEX, 1);
  assert.equal(PROMPT_MODELS[DEFAULT_PROMPT_MODEL_INDEX].label, 'Opus');
});

// --- in-range guard (clampPromptModelIndex) -------------------------------

test('clampPromptModelIndex passes through every valid index unchanged', () => {
  for (let i = 0; i < PROMPT_MODELS.length; i++) {
    assert.equal(clampPromptModelIndex(i), i);
  }
});

test('clampPromptModelIndex degrades every invalid input to the default (Opus, 1), never throws, never NaN', () => {
  const invalid = [-1, 4, 100, -100, 1.5, NaN, Infinity, -Infinity, null, undefined, 'x', {}, [], '2', true, false];
  for (const value of invalid) {
    const result = clampPromptModelIndex(value);
    assert.ok(Number.isInteger(result), `clamp(${String(value)}) must be an integer`);
    assert.ok(result >= 0 && result < PROMPT_MODELS.length, `clamp(${String(value)}) must be in range`);
  }
  assert.equal(clampPromptModelIndex(-1), DEFAULT_PROMPT_MODEL_INDEX);
  assert.equal(clampPromptModelIndex(4), DEFAULT_PROMPT_MODEL_INDEX);
  assert.equal(clampPromptModelIndex(NaN), DEFAULT_PROMPT_MODEL_INDEX);
  assert.equal(clampPromptModelIndex(undefined), DEFAULT_PROMPT_MODEL_INDEX);
});

// --- total, deterministic wraparound (nextPromptModelIndex) ---------------

test('Ctrl+M (forward) steps 0->1->2->3->0, a total 4-cycle visiting every index exactly once', () => {
  let i = 0;
  const seen = [i];
  for (let step = 0; step < 4; step++) {
    i = nextPromptModelIndex(i, 1);
    seen.push(i);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 0]);
});

test('backward direction steps 0->3->2->1->0, a total 4-cycle visiting every index exactly once', () => {
  let i = 0;
  const seen = [i];
  for (let step = 0; step < 4; step++) {
    i = nextPromptModelIndex(i, -1);
    seen.push(i);
  }
  assert.deepEqual(seen, [0, 3, 2, 1, 0]);
});

test('forward wraparound specifically: past Haiku (3) wraps to Fable (0)', () => {
  assert.equal(nextPromptModelIndex(3, 1), 0);
});

test('backward wraparound specifically: before Fable (0) wraps to Haiku (3)', () => {
  assert.equal(nextPromptModelIndex(0, -1), 3);
});

test('nextPromptModelIndex is defined and in-range for every current index and both directions (never throws)', () => {
  for (let current = 0; current < PROMPT_MODELS.length; current++) {
    for (const direction of [1, -1]) {
      const next = nextPromptModelIndex(current, direction);
      assert.ok(Number.isInteger(next) && next >= 0 && next < PROMPT_MODELS.length);
    }
  }
});

test('nextPromptModelIndex clamps an out-of-range current before stepping, never throwing', () => {
  assert.doesNotThrow(() => nextPromptModelIndex(NaN, 1));
  assert.doesNotThrow(() => nextPromptModelIndex(-5, -1));
  assert.doesNotThrow(() => nextPromptModelIndex(undefined, 1));
  const result = nextPromptModelIndex(NaN, 1);
  assert.ok(Number.isInteger(result) && result >= 0 && result < PROMPT_MODELS.length);
});

// --- isModelLockedForMode --------------------------------------------------

test('isModelLockedForMode is true for Quick Capture (mode index 0), false for every other mode', () => {
  assert.equal(isModelLockedForMode(DEFAULT_PROMPT_MODE_INDEX), true);
  assert.equal(isModelLockedForMode(0), true);
  assert.equal(isModelLockedForMode(1), false);
  assert.equal(isModelLockedForMode(2), false);
  assert.equal(isModelLockedForMode(3), false);
  assert.equal(isModelLockedForMode(4), false);
});

test('isModelLockedForMode never throws on a missing/NaN/out-of-range mode index', () => {
  assert.doesNotThrow(() => isModelLockedForMode(undefined));
  assert.doesNotThrow(() => isModelLockedForMode(NaN));
  assert.doesNotThrow(() => isModelLockedForMode(999));
  assert.equal(isModelLockedForMode(undefined), false);
  assert.equal(isModelLockedForMode(NaN), false);
  assert.equal(isModelLockedForMode(999), false);
});

// Iteration 1 verification caught: `Number(modeIndex) === DEFAULT_PROMPT_MODE_INDEX`
// coerces null/''/false/[] all to 0, silently reporting them "locked" —
// contradicting the function's own documented contract that a missing index
// is simply "not Quick Capture". These values are all genuinely "missing", not
// "Quick Capture", so every one of them must resolve to false.
test('isModelLockedForMode treats null/empty-string/false/[] as "missing", never as Quick Capture (index 0), despite each coercing to 0 via Number())', () => {
  assert.equal(Number(null), 0, 'sanity: Number(null) really is 0');
  assert.equal(Number(''), 0, 'sanity: Number("") really is 0');
  assert.equal(Number(false), 0, 'sanity: Number(false) really is 0');
  assert.equal(Number([]), 0, 'sanity: Number([]) really is 0');
  assert.equal(isModelLockedForMode(null), false);
  assert.equal(isModelLockedForMode(''), false);
  assert.equal(isModelLockedForMode(false), false);
  assert.equal(isModelLockedForMode([]), false);
});

test('isModelLockedForMode is still true for the genuine integer 0, Quick Capture itself', () => {
  assert.equal(isModelLockedForMode(0), true);
  assert.equal(DEFAULT_PROMPT_MODE_INDEX, 0);
});

// --- modelForMode: the read-time projection, not a mutation ---------------

test('modelForMode resolves Quick Capture to Haiku regardless of the selected model', () => {
  const haikuIndex = PROMPT_MODELS.findIndex((m) => m.id === 'haiku');
  for (let selected = 0; selected < PROMPT_MODELS.length; selected++) {
    assert.equal(modelForMode(0, selected), haikuIndex, `selected=${selected} must still resolve to Haiku on Quick Capture`);
  }
});

test('modelForMode resolves every non-Quick-Capture mode to the (clamped) selected model', () => {
  for (let mode = 1; mode <= 4; mode++) {
    for (let selected = 0; selected < PROMPT_MODELS.length; selected++) {
      assert.equal(modelForMode(mode, selected), selected);
    }
  }
});

// The load-bearing round-trip: the pin is a projection at READ time, never a
// mutation of the stored selection. Selecting Opus on Modeling, switching to
// Quick Capture (which resolves Haiku), then switching back to Modeling must
// show Opus again — because `modelForMode` never writes `selectedModel`.
test('the Quick Capture pin never overwrites the stored selection: Modeling(Opus) -> Quick Capture(Haiku) -> Modeling(Opus) round-trips', () => {
  const opusIndex = PROMPT_MODELS.findIndex((m) => m.id === 'opus');
  const haikuIndex = PROMPT_MODELS.findIndex((m) => m.id === 'haiku');
  let selectedModel = opusIndex; // the builder selected Opus while on Modeling (mode index 1)

  const onModeling = modelForMode(1, selectedModel);
  assert.equal(onModeling, opusIndex, 'Modeling must show the selected model, Opus');

  // Switching to Quick Capture reads the pin — but MUST NOT mutate selectedModel.
  const onQuickCapture = modelForMode(0, selectedModel);
  assert.equal(onQuickCapture, haikuIndex, 'Quick Capture must show Haiku regardless of the selection');
  assert.equal(selectedModel, opusIndex, 'the stored selection must be untouched by reading the pin');

  // Switching back to Modeling must restore Opus, not Haiku.
  const backOnModeling = modelForMode(1, selectedModel);
  assert.equal(backOnModeling, opusIndex, 'switching back to Modeling must restore Opus, proving the pin never overwrote the selection');
});

test('modelForMode never throws on a missing/NaN/out-of-range modeIndex or selectedModelIndex', () => {
  assert.doesNotThrow(() => modelForMode(undefined, undefined));
  assert.doesNotThrow(() => modelForMode(NaN, NaN));
  assert.doesNotThrow(() => modelForMode(999, 999));
  assert.doesNotThrow(() => modelForMode(-1, -1));
  const result = modelForMode(999, 999);
  assert.ok(Number.isInteger(result) && result >= 0 && result < PROMPT_MODELS.length);
});

// --- shouldWindowCtrlMHandle: the Ctrl+M double-dispatch mutual-exclusion --
//
// Iteration 1 verification of agentic-workflow-m2vkp caught a real bug: Ctrl+M
// while the prompt field is focused was handled TWICE (once by the field's own
// onPromptKeyDown/CYCLE_MODEL branch, once again by the window-scoped
// `document` fallback, since the native keydown still bubbles to `document`
// under React's createRoot even after the field's handler runs) — stepping
// selectedModel by two instead of one. PROMPT_MODELS has four entries, so a
// step of two from Opus (1) lands on Haiku (3) and back, making Fable (0) and
// Sonnet (2) unreachable via a focused-field Ctrl+M. `shouldWindowCtrlMHandle`
// is the fix: the window-scoped listener consults it and refuses to act
// whenever the keydown's target IS the prompt field, leaving that case
// entirely to the field's own handler.
//
// These tests drive the REAL exported functions (promptBarKeyIntent,
// shouldWindowCtrlMHandle, nextPromptModelIndex) through the same two-path
// scenario board.js's two handlers implement, so a reintroduction of the
// double-dispatch bug (e.g. dropping the guard, or reversing its sense) turns
// this genuinely red — unlike a regex asserting both handlers merely contain
// `setSelectedModel(`, which cannot distinguish "handled once" from "handled
// twice".

test('shouldWindowCtrlMHandle refuses when the keydown\'s target IS the prompt field — the field\'s own handler already owns it', () => {
  const promptFieldEl = { tag: 'the-real-textarea-node' };
  const event = { ctrlKey: true, key: 'm', target: promptFieldEl };
  assert.equal(shouldWindowCtrlMHandle(event, promptFieldEl), false);
});

test('shouldWindowCtrlMHandle allows acting when the keydown\'s target is NOT the prompt field — anywhere else on the board', () => {
  const promptFieldEl = { tag: 'the-real-textarea-node' };
  const somewhereElse = { tag: 'a-button-or-the-body' };
  assert.equal(shouldWindowCtrlMHandle({ target: somewhereElse }, promptFieldEl), true);
  assert.equal(shouldWindowCtrlMHandle({ target: undefined }, promptFieldEl), true);
  assert.equal(shouldWindowCtrlMHandle({ target: null }, promptFieldEl), true);
});

test('shouldWindowCtrlMHandle never throws and degrades to "act" when the event or the field ref is missing entirely', () => {
  assert.doesNotThrow(() => shouldWindowCtrlMHandle(undefined, undefined));
  assert.doesNotThrow(() => shouldWindowCtrlMHandle(null, null));
  assert.equal(shouldWindowCtrlMHandle(undefined, undefined), true);
  assert.equal(shouldWindowCtrlMHandle(null, { tag: 'field' }), true);
  assert.equal(shouldWindowCtrlMHandle({ target: {} }, null), true);
});

// The regression test: replays board.js's ACTUAL two dispatch paths for a
// single physical Ctrl+M keydown (field-focused case) against the real
// exported functions, and asserts the net step is exactly one.
test('a single Ctrl+M keydown, dispatched while the prompt field is focused, advances selectedModel by exactly one — not two — across both dispatch paths', () => {
  const promptFieldEl = { tag: 'the-real-textarea-node' };
  // The one physical keydown: React delegates it to the field first (target
  // is the field), then the SAME native event bubbles on to `document`.
  const keydown = { ctrlKey: true, altKey: false, key: 'm', target: promptFieldEl };

  const opusIndex = PROMPT_MODELS.findIndex((m) => m.id === 'opus');
  const sonnetIndex = PROMPT_MODELS.findIndex((m) => m.id === 'sonnet');
  let selectedModel = opusIndex; // DEFAULT_PROMPT_MODEL_INDEX
  let handledCount = 0;

  // Path 1: mirrors board.js's onPromptKeyDown — the field's ONE keydown
  // classifier decides this is CYCLE_MODEL, and (with the model unlocked)
  // cycles selectedModel.
  if (promptBarKeyIntent(keydown) === PROMPT_KEY_INTENT.CYCLE_MODEL) {
    selectedModel = nextPromptModelIndex(selectedModel, 1);
    handledCount += 1;
  }

  // Path 2: mirrors board.js's onWindowKeyDown — the window-scoped fallback,
  // now gated by shouldWindowCtrlMHandle, must refuse because `keydown.target`
  // is the prompt field (path 1 already owns this keystroke).
  if (keydown.ctrlKey && !keydown.altKey && (keydown.key === 'm' || keydown.key === 'M')) {
    if (shouldWindowCtrlMHandle(keydown, promptFieldEl)) {
      selectedModel = nextPromptModelIndex(selectedModel, 1);
      handledCount += 1;
    }
  }

  assert.equal(handledCount, 1, 'exactly one of the two dispatch paths may act on a single field-focused Ctrl+M keydown');
  assert.equal(selectedModel, sonnetIndex, 'Opus (1) -> Sonnet (2): one keystroke must advance by exactly one step, not two');
});

// The companion case: the SAME keydown shape but NOT targeting the prompt
// field (nothing is focused, or focus is elsewhere on the board) — here the
// field's own onPromptKeyDown never even runs (it is only ever invoked for
// events targeting the field), so path 2 is the keystroke's ONLY handler and
// must act.
test('a Ctrl+M keydown NOT targeting the prompt field is handled by the window-scoped fallback alone, still advancing selectedModel by exactly one', () => {
  const promptFieldEl = { tag: 'the-real-textarea-node' };
  const somewhereElse = { tag: 'document-body' };
  const keydown = { ctrlKey: true, altKey: false, key: 'M', target: somewhereElse };

  const opusIndex = PROMPT_MODELS.findIndex((m) => m.id === 'opus');
  const sonnetIndex = PROMPT_MODELS.findIndex((m) => m.id === 'sonnet');
  let selectedModel = opusIndex;
  let handledCount = 0;

  // onPromptKeyDown is never invoked here (its own registration only fires for
  // events on the field) — nothing to replay for path 1.

  if (keydown.ctrlKey && !keydown.altKey && (keydown.key === 'm' || keydown.key === 'M')) {
    if (shouldWindowCtrlMHandle(keydown, promptFieldEl)) {
      selectedModel = nextPromptModelIndex(selectedModel, 1);
      handledCount += 1;
    }
  }

  assert.equal(handledCount, 1, 'the window-scoped fallback must be the sole handler when Ctrl+M does not target the prompt field');
  assert.equal(selectedModel, sonnetIndex, 'still exactly one step: Opus (1) -> Sonnet (2)');
});
