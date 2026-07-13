// Agentheim — end-to-end DOM proof of the Ctrl+M double-dispatch fix
// (infrastructure-d2n8s, driven through dom-harness.mjs).
//
// agentic-workflow-m2vkp (2026-07-13) shipped a double-handled Ctrl+M: React
// 18 `createRoot` delegates keydown at the ROOT CONTAINER, the event then
// bubbles on to `document`, where a window-scoped listener also fired.
// Neither called `stopPropagation()`, and `preventDefault()` does not stop
// propagation, so `selectedModel` advanced by +2, not +1 — a parity trap
// that left Fable and Sonnet unreachable via a focused-field Ctrl+M. 1279
// tests were green; no source-regex test could see it (a *live
// event-propagation behavior*, not something reading board.js as a string
// can predict). The fix, `shouldWindowCtrlMHandle` (prompt-model.js), used
// to be proven by two half-tests that never actually drove board.js: a
// behavioral test re-implementing board.js's two dispatch paths in its own
// body (prompt-model.test.mjs), and a source-regex test pinning the guard's
// call site (board-prompt-bar.test.mjs). This file collapses that split
// proof into ONE genuine end-to-end assertion: mount the REAL
// `BoardPromptBar`, dispatch a REAL `Ctrl+M` keydown, read the REAL rendered
// DOM. See dom-harness.mjs's own header for why this reproduces the bug
// (jsdom's spec-accurate capture/bubble algorithm) where a source-regex
// suite structurally cannot.
//
// Mutation-tested: temporarily removing the `shouldWindowCtrlMHandle` guard
// call from board.js's window-scoped listener (2026-07-13, this task) turned
// the first test below genuinely RED — the rendered label read "Haiku"
// (Opus stepped by two) instead of "Sonnet" (stepped by exactly one). The
// mutation was reverted byte-exact afterward; see this task's Outcome.
//
// board-prompt-bar.test.mjs KEEPS its one regex test pinning that the
// window-scoped listener calls `shouldWindowCtrlMHandle` BEFORE
// preventDefault/setSelectedModel — a source-regex suite proves a call
// site's ORDERING (that the guard is checked first, not merely present
// somewhere), which a behavioral test genuinely does not assert; that one
// test is complementary to this file, not superseded by it.
// prompt-model.test.mjs's own unit tests of `shouldWindowCtrlMHandle` as a
// pure function are ALSO kept (they test the guard's contract directly, not
// a re-implementation of board.js's dispatch paths) — only the two tests
// that hand-replayed board.js's two dispatch paths in prompt-model.test.mjs
// are retired here, since this file now drives the real thing.

import { mount, act, dispatchKeyDown, flush } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// AC trap #2 (see the task's Notes): stubbing only `discoverBridge`'s `GET
// /api/bridge` and leaving the second call, `probeHealth`'s token-bearing
// `GET http://127.0.0.1:<port>/health`, un-stubbed would make this test's
// outcome depend on whether the builder's REAL VS Code bridge extension
// happens to be listening on this box right now. Both calls are stubbed.
// agentic-workflow-n4qte: this file's whole point is the Ctrl+M double-
// dispatch fix, which only matters when the model selector is genuinely
// UNLOCKED — a health response with no `capabilities` now reads as a
// legacy/skewed bridge (bridgeSupportsModel: false), which would lock the
// selector (and raise the new skew banner) before Ctrl+M's own behavior
// under test could ever be reached. Advertise the full capability set so
// this stays a fully-live bridge, exactly as these tests already intend.
function stubBridgeFetch(port, token) {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, port, token }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return { ok: true, json: async () => ({ ok: true, capabilities: ['prompt', 'skipPermissions', 'name', 'model'] }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

// The primary launch region is the ONE <button> in the tree that is neither
// a mode tab (role="tab") nor the split button's caret (aria-haspopup="menu")
// — its rendered textContent is the icon (an aria-hidden <span>, no text) plus
// the model label span, so its trimmed text IS the rendered model label.
function primaryLaunchButton(container) {
  const candidates = Array.from(container.querySelectorAll('button')).filter(
    (b) => b.getAttribute('role') !== 'tab' && b.getAttribute('aria-haspopup') !== 'menu',
  );
  assert.equal(candidates.length, 1, 'exactly one primary ModelSplitButton launch region must be present');
  return candidates[0];
}

async function mountReadyBoardPromptBar() {
  const { BoardPromptBar } = await import('../app/board.js');
  const { root, container } = await mount(BoardPromptBar, {});
  // Flush the mount-time bridge probe (probeBridge -> discoverBridge ->
  // probeHealth, each an async hop) and the setBridgePresent re-render it
  // triggers, before the caller does anything that depends on bridgePresent.
  await flush(10);
  return { root, container };
}

// AC trap #2 (again): a FRESH mount defaults to Quick Capture, whose model is
// PINNED to Haiku (isModelLockedForMode) — `modelLocked = !bridgePresent ||
// isModelLockedForMode(highlightedMode)` is true on Quick Capture regardless
// of bridge presence, so Ctrl+M is a no-op on THAT axis alone even with the
// bridge stubbed live. Every test below moves off Quick Capture (clicks the
// Modeling tab) before touching Ctrl+M, so the guard this file exists to
// prove is actually exercised, not accidentally short-circuited upstream.
async function moveOffQuickCapture(container) {
  const tabs = container.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 5, 'the five PROMPT_MODES tabs must be present');
  await act(async () => { tabs[1].click(); }); // Modeling
}

test('a single Ctrl+M keydown, dispatched on the focused prompt field, advances the rendered model by exactly one — Opus to Sonnet, not the double-dispatch bug\'s Haiku', async () => {
  globalThis.window.fetch = stubBridgeFetch(39123, 'test-token-1');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);
    assert.equal(primaryLaunchButton(container).textContent.trim(), 'Opus', 'Opus is the default model on mount');

    const textarea = container.querySelector('textarea');
    assert.ok(textarea, 'the prompt textarea must be present');
    textarea.focus();
    assert.equal(document.activeElement, textarea, 'the textarea must actually hold DOM focus before the keydown');

    await dispatchKeyDown(textarea, { ctrlKey: true, key: 'm' });

    const label = primaryLaunchButton(container).textContent.trim();
    assert.equal(
      label,
      'Sonnet',
      'one physical Ctrl+M keydown, with the field focused, must step the model by exactly ONE (Opus -> Sonnet) — ' +
      'a "Haiku" result here means the keystroke was handled TWICE (once by onPromptKeyDown, once by the window-scoped ' +
      '`document` listener the same native event still bubbles to under React 18 createRoot), the m2vkp regression.',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

test('a Ctrl+M keydown NOT targeting the prompt field (dispatched elsewhere in the mounted tree) is still handled exactly once, by the window-scoped fallback alone', async () => {
  globalThis.window.fetch = stubBridgeFetch(39124, 'test-token-2');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);
    assert.equal(primaryLaunchButton(container).textContent.trim(), 'Opus');

    // Focus lands nowhere in particular; dispatch on the section root instead
    // of the textarea, so `event.target` is NOT the prompt field and
    // `onPromptKeyDown` (only ever invoked for events targeting the field)
    // never runs at all — this keystroke's ONLY handler is the window-scoped
    // `document` listener.
    const section = container.querySelector('section');
    assert.ok(section, 'the docked console section must be present');
    await dispatchKeyDown(section, { ctrlKey: true, key: 'M' });

    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      'Sonnet',
      'the window-scoped fallback, as the keystroke\'s sole handler, must still step by exactly one',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

test('design-system-me97j: with an empty prompt, Enter is greyed and inert but the model menu still opens and a selection sticks', async () => {
  globalThis.window.fetch = stubBridgeFetch(39126, 'test-token-4');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container); // Modeling — model NOT locked, unlike Quick Capture
    const primary = primaryLaunchButton(container);
    assert.equal(primary.textContent.trim(), 'Opus', 'Opus is the default model on mount');
    assert.equal(primary.disabled, true, 'Enter must be genuinely disabled with a blank prompt');

    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.ok(caret, 'the model caret must render (not locked on the Modeling tab)');
    assert.equal(caret.disabled, false, 'the caret must NOT be disabled by a blank prompt — picking a model precedes typing');

    await act(async () => { caret.click(); });
    assert.ok(container.querySelector('[role="menu"]'), 'clicking the caret must open the model menu even with an empty prompt');

    const sonnetRow = Array.from(container.querySelectorAll('[role="menuitemradio"]')).find(
      (row) => row.textContent.trim() === 'Sonnet',
    );
    assert.ok(sonnetRow, 'Sonnet must be a selectable option');
    await act(async () => { sonnetRow.click(); });

    assert.equal(container.querySelector('[role="menu"]'), null, 'selecting a model must close the menu');
    assert.equal(primaryLaunchButton(container).textContent.trim(), 'Sonnet', 'the selection must stick — the launch region now reads the newly-picked model');
    assert.equal(primaryLaunchButton(container).disabled, true, 'Enter must remain disabled — the prompt is still blank');
  } finally {
    await act(async () => root.unmount());
  }
});

test('Ctrl+M is a true no-op on a freshly-mounted board (Quick Capture pins the model to Haiku) — proving the setup above is actually necessary, not incidental', async () => {
  // Companion to the trap this file exists to avoid: WITHOUT moving off Quick
  // Capture, the model axis is locked regardless of the bridge, so a naive
  // mount-and-dispatch test would pass trivially because nothing happens —
  // and would survive the shouldWindowCtrlMHandle mutation undetected. This
  // test locks that a FRESH mount really is in that inert state, so a reader
  // can see the other two tests' setup (moveOffQuickCapture) is load-bearing.
  globalThis.window.fetch = stubBridgeFetch(39125, 'test-token-3');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    const before = primaryLaunchButton(container).textContent.trim();
    const textarea = container.querySelector('textarea');
    textarea.focus();
    await dispatchKeyDown(textarea, { ctrlKey: true, key: 'm' });
    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      before,
      'Ctrl+M on a freshly-mounted board (still Quick Capture) must not move the model at all',
    );
  } finally {
    await act(async () => root.unmount());
  }
});
