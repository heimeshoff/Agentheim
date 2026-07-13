// Agentheim — end-to-end DOM proof that the prompt console no longer clips
// its own popovers (design-system-k3f7q, driven through dom-harness.mjs).
//
// Two independent causes stacked to make ModelSplitButton's model menu
// unreadable: (1) the panel opened DOWNWARD (fixed in button.js — see
// dashboard/test/model-split-button-dom.test.mjs's placement test), straight
// into the bottom-docked console's own screen edge, and (2) the console
// `<section>` carried `overflow: hidden`, which — regardless of which way
// the panel opened — sheared off anything absolutely positioned inside it.
// Flipping only the anchor without lifting the clip just moves the shear
// from the viewport's bottom edge to the console's top edge; both causes
// have to be fixed together, which is why this file mounts the REAL
// `BoardPromptBar` (not a source regex) and walks the REAL rendered
// ancestor chain of the REAL open menu.
//
// Mutation-tested (design-system-k3f7q): temporarily restoring
// `overflow: "hidden"` on the console `<section>` in board.js turned the
// "no ancestor clips the open menu" test below genuinely RED (the section
// itself failed the no-clip walk). Reverted byte-exact afterward.

import { mount, act, flush } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubBridgeFetch(port, token) {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, port, token }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

async function mountReadyBoardPromptBar(port, token) {
  globalThis.window.fetch = stubBridgeFetch(port, token);
  const { BoardPromptBar } = await import('../app/board.js');
  const { root, container } = await mount(BoardPromptBar, {});
  await flush(10);
  return { root, container };
}

// A fresh mount defaults to Quick Capture, whose model is PINNED
// (isModelLockedForMode) — the split button renders `locked`, with no caret
// and no menu at all. Moving to a different mode unlocks the caret so the
// menu this task is about can actually be opened.
async function moveOffQuickCapture(container) {
  const tabs = container.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 5, 'the five PROMPT_MODES tabs must be present');
  await act(async () => { tabs[1].click(); }); // Modeling
}

// canFirePromptMode (prompt-mode.js) also gates the split button's `disabled`
// on a non-blank prompt (unrelated to the model lock above) — a blank prompt
// disables BOTH regions, caret included, so the caret needs a real value in
// the field before it is clickable at all.
async function typeAPrompt(container, text = 'hello') {
  const textarea = container.querySelector('textarea');
  assert.ok(textarea, 'the prompt textarea must be present');
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => {
    nativeSetter.call(textarea, text);
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

async function openModelMenu(container) {
  const caret = container.querySelector('button[aria-haspopup="menu"]');
  assert.ok(caret, 'the model split button caret must render once unlocked');
  await act(async () => { caret.click(); });
  const panel = container.querySelector('[role="menu"]');
  assert.ok(panel, 'the model menu must be open');
  return panel;
}

// Inline style, not computed — board.js/button.js set `overflow` directly
// via React's style object, so the DOM element's OWN `style.overflow`
// (never a CSS cascade concern here) is exactly what the production code
// declared.
function clippingAncestors(el, stopAt) {
  const hits = [];
  let node = el.parentElement;
  while (node && node !== stopAt.parentElement) {
    if (node.style && node.style.overflow === 'hidden') {
      hits.push(node);
    }
    node = node.parentElement;
  }
  return hits;
}

test('no ancestor of the open model menu clips it — the console section no longer carries overflow: hidden', async () => {
  const { root, container } = await mountReadyBoardPromptBar(39201, 'clip-test-1');
  try {
    await moveOffQuickCapture(container);
    await typeAPrompt(container);
    const panel = await openModelMenu(container);
    const section = container.querySelector('section');
    assert.ok(section, 'the docked console section must be present');

    const hits = clippingAncestors(panel, section);
    assert.deepEqual(
      hits, [],
      'no ancestor between the open menu panel and the console section may carry overflow: hidden — ' +
      'that clip is exactly what sheared the menu off before this fix',
    );
    assert.notEqual(section.style.overflow, 'hidden', 'the console section itself must not carry overflow: hidden');
  } finally {
    await act(async () => root.unmount());
  }
});

test('the mode-tab row keeps its own clip, still rounding its end cells to the shell\'s corners — the clip MOVED, it did not disappear', async () => {
  const { root, container } = await mountReadyBoardPromptBar(39202, 'clip-test-2');
  try {
    const tablist = container.querySelector('[role="tablist"]');
    assert.ok(tablist, 'the mode-tab row must be present');
    assert.equal(tablist.style.overflow, 'hidden', 'the tab row must clip its own end cells');
    assert.ok(
      tablist.style.borderTopLeftRadius && tablist.style.borderTopRightRadius,
      'the tab row must round its own top corners to match the shell it now clips against',
    );
  } finally {
    await act(async () => root.unmount());
  }
});
