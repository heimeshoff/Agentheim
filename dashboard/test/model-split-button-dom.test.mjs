// Agentheim — end-to-end DOM proof of ModelSplitButton's menu keyboard
// contract (infrastructure-d2n8s, driven through dom-harness.mjs).
//
// This file lives in dashboard/test/, not the styleguide's own test/, on
// purpose: dashboard/ is the ONE tree in the repo with a real node_modules
// (jsdom, react, react-dom — all dashboard/package.json devDependencies),
// and dom-harness.mjs's resolve hook is what lets a styleguide module
// (which has no node_modules of its own anywhere up its tree) resolve
// `react`/`htm` at test time. Mounting ModelSplitButton — a component
// design-system OWNS — from HERE, across the BC boundary, by a plain
// relative import (consumed unforked, ADR-0003; exactly how build.mjs and
// board.js already reach it) is the proof this task's cross-BC reach claim
// asked for: "converting ModelSplitButton's menu keyboard behavior is what
// proves the cross-BC reach actually works. Without it, nobody learns
// whether a styleguide component can be mounted until the next a11y task
// discovers it can't."
//
// button.js's own docblock states the contract this file drives for real:
// "a ROVING-TABINDEX menu... the caret is a real, Tab-reachable trigger...
// once open, focus moves onto the highlighted menuitemradio row,
// ArrowUp/ArrowDown move it (clamped, no wraparound), Enter selects and
// closes, Escape closes and returns focus to the caret (no keyboard trap,
// WCAG 2.1.2)." model-split-button.test.mjs (styleguide/test/) used to
// "prove" the delegation with a single source-regex assertion —
// `arrowDirection(e.key)` / `isSelectKey(e.key)` / `isDismissKey(e.key)`
// appear somewhere in button.js's source, which cannot distinguish "wired
// correctly" from "wired backwards" or "never actually reached by a real
// keystroke". That regex test is RETIRED (see model-split-button.test.mjs's
// header note) — this file drives the real component with real DOM
// KeyboardEvents and reads real DOM focus/attributes instead. Every OTHER
// assertion in model-split-button.test.mjs (structure, ARIA attributes,
// tokens, the icon registry, the canvas specimens, the no-hardcoded-model-
// name guard) is untouched — this task's scope is the keyboard CONTRACT,
// not a big-bang regex migration (see the task's "What", point 3).
//
// design-system-me97j adds the `disabled`-narrowing tests below: `disabled`
// now gates the PRIMARY region only, so the caret stays clickable, keyboard-
// reachable, and at full opacity regardless of `disabled` — only `locked`
// removes the caret. Proven here through the same mounted-DOM harness rather
// than by reading source, per this widget's established precedent.

import { mount, act, dispatchKeyDown } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const OPTIONS = ['Fable', 'Opus', 'Sonnet', 'Haiku'];

async function mountOpenMenu(value = 'Opus') {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const selections = [];
  const { root, container } = await mount(ModelSplitButton, {
    label: value,
    options: OPTIONS,
    value,
    onSelect: (opt) => selections.push(opt),
    ariaLabel: 'Send',
  });
  const caret = container.querySelector('button[aria-haspopup="menu"]');
  assert.ok(caret, 'a caret trigger must render when not locked');
  await act(async () => { caret.click(); });
  return { root, container, caret, selections };
}

test('opening the menu moves REAL DOM focus onto the currently-selected option (roving tabindex, not aria-activedescendant)', async () => {
  const { root, container, caret } = await mountOpenMenu('Opus');
  try {
    assert.equal(container.querySelector('[role="menu"]') !== null, true, 'the menu panel must be open');
    const active = document.activeElement;
    assert.equal(active.getAttribute('role'), 'menuitemradio', 'DOM focus must land on a menu row, not stay on the caret');
    assert.equal(active.textContent.trim(), 'Opus', 'focus must start on the row matching the current value');
    assert.notEqual(active, caret, 'focus must have actually moved off the caret into the menu');
  } finally {
    await act(async () => root.unmount());
  }
});

test('ArrowDown/ArrowUp move the roving highlight AND real DOM focus together, clamped at both ends (no wraparound)', async () => {
  const { root, container } = await mountOpenMenu('Opus'); // starts highlighted on Opus (index 1)
  try {
    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' });
    assert.equal(document.activeElement.textContent.trim(), 'Sonnet');

    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' });
    assert.equal(document.activeElement.textContent.trim(), 'Haiku', 'Haiku is the last option');

    // Past the last option: CLAMPS, does not wrap to Fable.
    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' });
    assert.equal(document.activeElement.textContent.trim(), 'Haiku', 'ArrowDown past the last option must stay on the last, not wrap');

    await dispatchKeyDown(document.activeElement, { key: 'ArrowUp' });
    assert.equal(document.activeElement.textContent.trim(), 'Sonnet');
    await dispatchKeyDown(document.activeElement, { key: 'ArrowUp' });
    assert.equal(document.activeElement.textContent.trim(), 'Opus');
    await dispatchKeyDown(document.activeElement, { key: 'ArrowUp' });
    assert.equal(document.activeElement.textContent.trim(), 'Fable', 'Fable is the first option');

    // Before the first option: CLAMPS, does not wrap to Haiku.
    await dispatchKeyDown(document.activeElement, { key: 'ArrowUp' });
    assert.equal(document.activeElement.textContent.trim(), 'Fable', 'ArrowUp before the first option must stay on the first, not wrap');
  } finally {
    await act(async () => root.unmount());
  }
});

test('Enter selects the highlighted option, fires onSelect exactly once, closes the menu, and returns focus to the caret (WCAG 2.1.2, no keyboard trap)', async () => {
  const { root, container, caret, selections } = await mountOpenMenu('Opus');
  try {
    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' }); // -> Sonnet
    await dispatchKeyDown(document.activeElement, { key: 'Enter' });

    assert.deepEqual(selections, ['Sonnet'], 'onSelect must fire exactly once, with the highlighted option');
    assert.equal(container.querySelector('[role="menu"]'), null, 'the menu must close on selection');
    assert.equal(document.activeElement, caret, 'focus must return to the caret trigger after selecting — not left stranded in a removed menu');
  } finally {
    await act(async () => root.unmount());
  }
});

test('Escape dismisses the menu WITHOUT selecting, and returns focus to the caret (WCAG 2.1.2, no keyboard trap)', async () => {
  const { root, container, caret, selections } = await mountOpenMenu('Opus');
  try {
    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' }); // move the highlight off the initial value
    await dispatchKeyDown(document.activeElement, { key: 'Escape' });

    assert.deepEqual(selections, [], 'Escape must never fire onSelect');
    assert.equal(container.querySelector('[role="menu"]'), null, 'the menu must close on Escape');
    assert.equal(document.activeElement, caret, 'focus must return to the caret trigger, exiting the menu — the keyboard-trap mitigation');
  } finally {
    await act(async () => root.unmount());
  }
});

test('the open menu panel anchors ABOVE the button (bottom, not top) — design-system-k3f7q: the prompt console is docked bottom-viewport, so a top-anchored panel opens into the screen edge', async () => {
  const { root, container } = await mountOpenMenu('Opus');
  try {
    const panel = container.querySelector('[role="menu"]');
    assert.ok(panel, 'the menu panel must be open');
    assert.equal(panel.style.top, '', 'the panel must NOT anchor on top — that opens the menu downward, into the docked console\'s bottom edge');
    assert.equal(panel.style.bottom, 'calc(100% + 6px)', 'the panel must anchor on bottom, emitting the menu upward from the button');
  } finally {
    await act(async () => root.unmount());
  }
});

test('disabled (design-system-me97j): the caret is clickable and the menu opens — a blank prompt must not block picking a model', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Opus', options: OPTIONS, value: 'Opus', disabled: true, ariaLabel: 'Send',
  });
  try {
    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.ok(caret, 'a disabled (but unlocked) split button must still render a caret trigger');
    await act(async () => { caret.click(); });
    assert.ok(container.querySelector('[role="menu"]'), 'clicking the caret must open the menu even when disabled');
  } finally {
    await act(async () => root.unmount());
  }
});

test('disabled (design-system-me97j): the caret carries no disabled attribute, stays keyboard-reachable, and Enter/ArrowDown still selects', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const selections = [];
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Opus', options: OPTIONS, value: 'Opus', disabled: true, ariaLabel: 'Send',
    onSelect: (opt) => selections.push(opt),
  });
  try {
    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.equal(caret.disabled, false, 'the caret <button> must not carry the disabled property when only `disabled` (not `locked`) is set');
    assert.equal(caret.hasAttribute('disabled'), false, 'the caret <button> must not carry the disabled attribute either');

    await act(async () => { caret.click(); });
    assert.equal(document.activeElement.getAttribute('role'), 'menuitemradio', 'opening via click must still move focus onto the highlighted row');

    await dispatchKeyDown(document.activeElement, { key: 'ArrowDown' }); // -> Sonnet
    await dispatchKeyDown(document.activeElement, { key: 'Enter' });
    assert.deepEqual(selections, ['Sonnet'], 'Enter must still select the highlighted option while disabled');
  } finally {
    await act(async () => root.unmount());
  }
});

test('disabled (design-system-me97j): the primary button is still genuinely disabled — attribute present, onClick never fires', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  let fired = false;
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Opus', options: OPTIONS, value: 'Opus', disabled: true, ariaLabel: 'Send',
    onClick: () => { fired = true; },
  });
  try {
    const primary = container.querySelector('button[aria-label="Send"]');
    assert.ok(primary, 'the primary <button> must render');
    assert.equal(primary.disabled, true, 'the primary <button> must carry the real disabled property');
    await act(async () => { primary.click(); });
    assert.equal(fired, false, 'a disabled primary button must never fire onClick');
  } finally {
    await act(async () => root.unmount());
  }
});

test('disabled (design-system-me97j): 0.55 opacity sits on the primary region only — the caret region renders at full opacity', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Opus', options: OPTIONS, value: 'Opus', disabled: true, ariaLabel: 'Send',
  });
  try {
    const primary = container.querySelector('button[aria-label="Send"]');
    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.equal(primary.style.opacity, '0.55', 'the primary region must dim to 0.55 opacity when disabled');
    assert.notEqual(caret.style.opacity, '0.55', 'the caret region must NOT dim — it stays fully interactive');
  } finally {
    await act(async () => root.unmount());
  }
});

test('locked still removes the caret region entirely, regardless of disabled (existing behaviour must not regress)', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Opus', options: OPTIONS, value: 'Opus', locked: true, disabled: true, ariaLabel: 'Send',
  });
  try {
    assert.equal(container.querySelector('button[aria-haspopup="menu"]'), null, 'locked + disabled together must still render no caret at all');
  } finally {
    await act(async () => root.unmount());
  }
});

test('locked renders no caret and no menu at all — the keyboard contract above is simply unreachable, matching the Quick Capture pinned-model case', async () => {
  const { ModelSplitButton } = await import(
    '../../.agentheim/contexts/design-system/styleguide/app/button.js'
  );
  const { root, container } = await mount(ModelSplitButton, {
    label: 'Haiku', options: OPTIONS, value: 'Haiku', locked: true, ariaLabel: 'Send',
  });
  try {
    assert.equal(container.querySelector('button[aria-haspopup="menu"]'), null, 'a locked split button must render no caret trigger');
    assert.equal(container.querySelector('[role="menu"]'), null, 'a locked split button must render no menu, even nominally "open"');
  } finally {
    await act(async () => root.unmount());
  }
});
