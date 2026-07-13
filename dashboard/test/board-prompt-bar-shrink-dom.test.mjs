// Agentheim — end-to-end DOM proof that a successful launch shrinks the
// auto-growing prompt field back to its one-line resting height
// (agentic-workflow-vsg9d, the sibling regression aw-038's own Notes
// flagged: "confirm the confetti still computes origin/aim correctly" — the
// regression turned out to be the field's HEIGHT, not the confetti).
//
// Root cause (see the task file's "Why" section): `onResult` used to call
// `autoGrowField(textareaRef.current, PROMPT_FIELD_MAX_PX)` synchronously,
// right after `setPrompt("")`. React batches that state update, so the
// textarea's real DOM `value` (and therefore its `scrollHeight`) had not yet
// been committed when the measurement ran — the inline height stayed pinned
// to the OLD, tall reading, and only the next keystroke (which measures a
// now-correct DOM) snapped it back. The fix moves the measurement into a
// `useLayoutEffect` keyed on `prompt`, which runs AFTER React commits the DOM
// for whichever value `prompt` now holds.
//
// THE TRAP THIS FILE EXISTS TO AVOID (see the task's Notes): jsdom does not
// do real layout — `scrollHeight` is 0 unless stubbed, so a naive assertion
// ("height collapsed") would pass whether or not the bug were fixed. This
// file ties a `scrollHeight` getter DIRECTLY to the textarea's live `.value`
// DOM property (a plain, unmanaged property jsdom really does track) — which
// is exactly the mechanism the bug lived in: `autoGrowField` reads
// `el.scrollHeight`, and in a real browser that reflects whatever text is
// ACTUALLY painted right now, not whatever React's component state currently
// holds. Proxying scrollHeight off `.value` reproduces the stale-DOM read
// faithfully: if the measurement runs before React commits the clear,
// `.value` (and so this proxy) still reports the OLD, long text.
//
// Mutation-tested (2026-07-13, this task): reverting the fix — restoring the
// synchronous `autoGrowField(textareaRef.current, PROMPT_FIELD_MAX_PX)` call
// inside `onResult` and removing the `useLayoutEffect` — turned the first
// test below genuinely RED (the field's inline height stayed at the GROWN
// reading instead of collapsing to `PROMPT_FIELD_MIN_PX`). The mutation was
// reverted byte-exact afterward; see this task's Outcome section.

import { mount, act, dispatchKeyDown, flush, dom } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// board.js's aw-038 growth band, hardcoded here (not exported from board.js) —
// see the doc comment at board.js's PROMPT_FIELD_MIN_PX/PROMPT_FIELD_MAX_PX.
const PROMPT_FIELD_MIN_PX = 40;
const PROMPT_FIELD_MAX_PX = 168;

// jsdom performs NO real layout — `HTMLElement.scrollHeight` is always 0
// (dom-harness.mjs's own header, and this task's Notes). This getter proxies
// scrollHeight off the textarea's CURRENT `.value`, so a long, multi-line
// value reads as visually tall and an empty value reads as exactly one line
// (LINE_HEIGHT_PX chosen to equal PROMPT_FIELD_MIN_PX, so a shrunk field's
// proxied scrollHeight and its CSS resting height coincide exactly).
const LINE_HEIGHT_PX = PROMPT_FIELD_MIN_PX;
const CHARS_PER_VISUAL_LINE = 30;
Object.defineProperty(dom.window.HTMLTextAreaElement.prototype, 'scrollHeight', {
  configurable: true,
  get() {
    const value = typeof this.value === 'string' ? this.value : '';
    const visualLines = value.split('\n').reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / CHARS_PER_VISUAL_LINE)),
      0,
    );
    return Math.max(1, visualLines) * LINE_HEIGHT_PX;
  },
});

// The `prefers-reduced-motion` guard (BoardConfetti) is the cleanest way to
// keep a successful launch from actually driving canvas-confetti's real
// particle/rAF loop through jsdom (which has no `canvas` 2D context backend
// installed — `HTMLCanvasElement.getContext('2d')` returns null under
// jsdom). Forcing "reduce" is a legitimate test-only stub of a MEDIA QUERY,
// not a change to production behavior; confetti's own wiring is untouched by
// this task and is already covered elsewhere (confetti-launch.test.mjs,
// confetti-palette.test.mjs, and board-prompt-bar.test.mjs's regex guard that
// `BoardConfetti` calls `fireConfetti()` unguarded).
dom.window.matchMedia = () => ({
  matches: true,
  media: '',
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return false; },
});

// The standard native-setter trick for driving a REAL `input` event through a
// React-controlled textarea: React only intercepts the setter it installs on
// the specific DOM NODE it controls, not the prototype's own accessor — so
// grabbing the prototype's native setter and calling it with `this` bound to
// the element bypasses that per-node interception and lets a genuine `input`
// event fire exactly as a real keystroke would.
const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLTextAreaElement.prototype,
  'value',
).set;

async function typeIntoTextarea(textarea, value) {
  await act(async () => {
    nativeTextareaValueSetter.call(textarea, value);
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

// A long, single-line prompt (no explicit newline) that the CHARS_PER_VISUAL_LINE
// proxy above reads as several visual lines: ceil(150/30) = 5 lines *
// LINE_HEIGHT_PX(40) = 200px, clamped by autoGrowField at PROMPT_FIELD_MAX_PX
// (168) — comfortably inside the growth band, well above PROMPT_FIELD_MIN_PX.
const LONG_WRAPPING_PROMPT = 'x'.repeat(150);

// agentic-workflow-n4qte: named "FullSuccess" — advertise the full
// capability set so this genuinely reads as a fully-live, non-skewed bridge
// (a health response with no `capabilities` now reads as legacy/skewed and
// would raise the new dismissible banner, an unrelated extra DOM element
// this file's shrink-to-fit assertions have no reason to account for).
function stubBridgeFetchFullSuccess(port, token) {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, port, token }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return { ok: true, json: async () => ({ ok: true, capabilities: ['prompt', 'skipPermissions', 'name', 'model'] }) };
    }
    if (href === `http://127.0.0.1:${port}/run`) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

async function mountReadyBoardPromptBar() {
  const { BoardPromptBar } = await import('../app/board.js');
  const { root, container } = await mount(BoardPromptBar, {});
  // Flush the mount-time bridge probe (probeBridge -> discoverBridge ->
  // probeHealth) and the setBridgePresent re-render it triggers.
  await flush(10);
  return { root, container };
}

test('a prompt that grew the field to fit several wrapped lines returns to the one-line resting height immediately after a successful bridge launch — no keystroke needed', async () => {
  globalThis.window.fetch = stubBridgeFetchFullSuccess(41123, 'test-token-shrink-1');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    const textarea = container.querySelector('textarea');
    assert.ok(textarea, 'the prompt textarea must be present');

    await typeIntoTextarea(textarea, LONG_WRAPPING_PROMPT);
    assert.equal(
      textarea.style.height,
      '168px',
      'typing a long wrapping prompt must grow the field (clamped at PROMPT_FIELD_MAX_PX) — sanity check that growth still works (aw-038)',
    );

    await dispatchKeyDown(textarea, { key: 'Enter' });
    // Let the launchOrCopy promise chain (discoverBridge -> probeHealth ->
    // runOnBridge, each an async hop) resolve, and the resulting setPrompt("")
    // + useLayoutEffect re-measure flush.
    await flush(10);

    assert.equal(
      textarea.value,
      '',
      'a successful bridge launch must clear the prompt',
    );
    assert.equal(
      textarea.style.height,
      `${PROMPT_FIELD_MIN_PX}px`,
      'the field must snap back to its one-line resting height right after the clear — not stay pinned to the grown, ' +
      'pre-clear reading (the "field stays tall after a launch" bug: a direct autoGrowField call inside onResult used ' +
      'to measure the textarea BEFORE React committed the setPrompt("") clear to the DOM)',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

test('firing several long prompts in a row leaves the field at one line each time — no accumulating height', async () => {
  globalThis.window.fetch = stubBridgeFetchFullSuccess(41124, 'test-token-shrink-2');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    const textarea = container.querySelector('textarea');

    for (let i = 0; i < 3; i += 1) {
      await typeIntoTextarea(textarea, LONG_WRAPPING_PROMPT);
      assert.equal(
        textarea.style.height,
        '168px',
        `round ${i}: typing must grow the field before the launch`,
      );

      await dispatchKeyDown(textarea, { key: 'Enter' });
      await flush(10);

      assert.equal(
        textarea.style.height,
        `${PROMPT_FIELD_MIN_PX}px`,
        `round ${i}: the field must be back at one line after this launch, not accumulating height from prior rounds`,
      );
    }
  } finally {
    await act(async () => root.unmount());
  }
});

test('a declined launch (bridge unreachable AND clipboard blocked) leaves the prompt text AND the grown height untouched — the shrink is tied to the clear, not the attempt', async () => {
  // No `window.fetch` at all: `launchOrCopy` goes straight to the clipboard
  // fallback (bridge-launch.js's own contract), and jsdom's `navigator.clipboard`
  // is undefined by default, so `copyToClipboard` resolves `false` without any
  // stubbing — both paths fail "for free".
  delete globalThis.window.fetch;
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    const textarea = container.querySelector('textarea');

    await typeIntoTextarea(textarea, LONG_WRAPPING_PROMPT);
    assert.equal(textarea.style.height, '168px', 'typing must grow the field before the (declined) launch attempt');

    await dispatchKeyDown(textarea, { key: 'Enter' });
    await flush(10);

    assert.equal(
      textarea.value,
      LONG_WRAPPING_PROMPT,
      'a fully-silent (declined) action must leave the typed prompt untouched',
    );
    assert.equal(
      textarea.style.height,
      '168px',
      'a declined launch must leave the field at its CURRENT grown height — the shrink is tied to the clear, ' +
      'never to the mere attempt',
    );
  } finally {
    await act(async () => root.unmount());
  }
});
