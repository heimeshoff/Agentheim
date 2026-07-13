// Agentheim — end-to-end DOM proof of the capability-aware model lock + skew
// banner (agentic-workflow-n4qte, driven through dom-harness.mjs, ADR-0056).
//
// infrastructure-v8r3q shipped a trustworthy `{ present, capabilities }`
// bridge signal, but the prompt bar itself only ever asked "is a bridge
// there at all?" (`bridgePresent`, agentic-workflow-m2vkp). Against a
// stale-but-present bridge (0.4.0 on disk, 0.2.0 running in the live
// extension host — exactly infrastructure-v8r3q's motivating scenario), the
// old code rendered a FULLY LIVE, unlocked model selector that claimed
// "Running on Opus" while infrastructure-v8r3q's own wire-level guarantee
// silently dropped the field before it ever reached the bridge. That is a
// LIVE render+event behavior — whether the split button actually renders
// locked, whether the label actually reads "Default" instead of a real
// model name, and whether a mocked legacy /health actually produces the
// banner in the DOM — exactly what a regex-over-source assertion
// structurally cannot see (board-prompt-bar.test.mjs's regex suite can pin
// that the string "reload your VS Code window" appears in board.js, but not
// that it is the string actually rendered against a legacy probe result).
//
// This file mounts the REAL `BoardPromptBar` against all three distinct
// probe outcomes the task's `What` table names: absent, legacy/skewed
// (present but missing capabilities), and full.

import { mount, act, flush, dom } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The standard native-setter trick for driving a REAL `input` event through a
// React-controlled textarea (mirrors board-prompt-bar-shrink-dom.test.mjs /
// board-prompt-console-clip-dom.test.mjs's own helper).
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

// ---- fetch stubs for the three probe outcomes -------------------------

function stubAbsentBridgeFetch() {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: false }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

// A pre-handshake (0.2.0-shaped) listener: present, but /health omits
// `capabilities` entirely -> LEGACY_CAPABILITIES (ADR-0018, infra-v8r3q).
// Also answers /run so a launch fired against it can be driven end-to-end.
function stubLegacyBridgeFetch(port, token) {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, port, token }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (href === `http://127.0.0.1:${port}/run`) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

function stubFullBridgeFetch(port, token) {
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

// ---- DOM helpers --------------------------------------------------------

// The primary launch region is the ONE <button> in the tree that is neither
// a mode tab (role="tab") nor the split button's caret (aria-haspopup="menu")
// — its rendered textContent is the icon (an aria-hidden <span>, no text)
// plus the model label span, so its trimmed text IS the rendered model label.
function primaryLaunchButton(container) {
  const candidates = Array.from(container.querySelectorAll('button')).filter(
    (b) => b.getAttribute('role') !== 'tab'
      && b.getAttribute('aria-haspopup') !== 'menu'
      && !b.closest('[role="alert"]'), // exclude the skew banner's own dismiss button
  );
  assert.equal(candidates.length, 1, 'exactly one primary ModelSplitButton launch region must be present');
  return candidates[0];
}

function caretButton(container) {
  return container.querySelector('button[aria-haspopup="menu"]');
}

function skewBanner(container) {
  return container.querySelector('[role="alert"]');
}

async function mountReadyBoardPromptBar() {
  const { BoardPromptBar } = await import('../app/board.js');
  const { root, container } = await mount(BoardPromptBar, {});
  // Flush the mount-time bridge probe (probeBridge -> discoverBridge ->
  // probeHealth, each an async hop) and the re-render it triggers, before
  // the caller reads anything derived from it.
  await flush(10);
  return { root, container };
}

// A fresh mount defaults to Quick Capture, whose model is PINNED to Haiku
// (isModelLockedForMode) regardless of bridge capability — `modelLocked =
// !bridgeSupportsModel || isModelLockedForMode(highlightedMode)` is true on
// Quick Capture even against a full-capability bridge. Every test that wants
// to observe the CAPABILITY axis (not the mode-pin axis) moves off Quick
// Capture first, mirroring board-prompt-bar-dom.test.mjs's own trap-avoidance
// helper.
async function moveOffQuickCapture(container) {
  const tabs = container.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 5, 'the five PROMPT_MODES tabs must be present');
  await act(async () => { tabs[1].click(); }); // Modeling
}

// ---- outcome 1: absent ---------------------------------------------------

test('absent bridge: no banner, split button locked, label reads Default, hint names "No bridge reachable"', async () => {
  globalThis.window.fetch = stubAbsentBridgeFetch();
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);

    assert.equal(skewBanner(container), null, 'plain absence must never raise the skew banner — absence is a normal mode (ADR-0018)');
    assert.equal(caretButton(container), null, 'the split button must render locked (no caret) when no bridge is reachable');
    assert.equal(primaryLaunchButton(container).textContent.trim(), 'Default');

    const titledSpan = container.querySelector('span[title]');
    assert.ok(titledSpan, 'the split button must be wrapped in a title tooltip span');
    assert.match(titledSpan.getAttribute('title'), /No bridge reachable/);
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- outcome 2: legacy / skewed (present, missing capabilities) ---------

test('legacy/skewed bridge (present, /health omits capabilities): the banner renders with the generic reload copy, the split button locks, and the label reads Default — not a real model name', async () => {
  globalThis.window.fetch = stubLegacyBridgeFetch(39201, 'legacy-token-1');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);

    const banner = skewBanner(container);
    assert.ok(banner, 'a present-but-skewed bridge must raise the dismissible banner');
    assert.match(
      banner.textContent,
      /Your VS Code bridge is running an older version\. Some launch options are unavailable until you reload the window\./,
      'the banner copy must be the generic, field-naming-nothing text (builder\'s ruling: it fires on ANY missing capability)',
    );

    assert.equal(
      caretButton(container),
      null,
      'the split button must render locked exactly as the absent-bridge case does — same visual/keyboard treatment',
    );
    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      'Default',
      'a locked button that still names a real model ("Opus") is the silent lie this task exists to remove',
    );

    const titledSpan = container.querySelector('span[title]');
    assert.match(
      titledSpan.getAttribute('title'),
      /Your VS Code bridge is running an older version — reload your VS Code window to pick up model selection\./,
      'the tooltip must name the reload remedy, textually distinct from the "no bridge reachable" wording',
    );
    assert.doesNotMatch(
      titledSpan.getAttribute('title'),
      /No bridge reachable/,
      'the too-old remedy must not be confused with the genuinely-absent remedy — there is nothing to reload for a genuinely absent bridge',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

test('legacy/skewed bridge: dismissing the banner removes it from the DOM and it does not reappear on a later re-render of the same mount (session-local dismiss, ADR-0017)', async () => {
  globalThis.window.fetch = stubLegacyBridgeFetch(39202, 'legacy-token-2');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);
    const banner = skewBanner(container);
    assert.ok(banner, 'the banner must be present before dismissal');
    const dismissBtn = banner.querySelector('button');
    assert.ok(dismissBtn, 'the banner must carry its own dismiss control');

    await act(async () => { dismissBtn.click(); });
    assert.equal(skewBanner(container), null, 'the banner must be gone immediately after dismissal');

    // A later re-render of the SAME mount (moving the highlight again) must
    // not resurrect the banner — the dismiss is scoped to this mount, not to
    // one render of it.
    const tabs = container.querySelectorAll('[role="tab"]');
    await act(async () => { tabs[2].click(); }); // Inquire
    assert.equal(skewBanner(container), null, 'the banner must stay dismissed across further re-renders of the same mount');
  } finally {
    await act(async () => root.unmount());
  }
});

test('legacy bridge: firing a launch does NOT produce a "launched on <model>" success signal for a non-default model — the displayed model reads Default before, during, and after the launch', async () => {
  globalThis.window.fetch = stubLegacyBridgeFetch(39203, 'legacy-token-3');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);
    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      'Default',
      'before firing, the label already reads Default — never a real model name',
    );

    const textarea = container.querySelector('textarea');
    assert.ok(textarea, 'the prompt textarea must be present');
    await typeIntoTextarea(textarea, 'Try Sonnet on a legacy bridge');

    // A successful launch fires the board's celebration burst
    // (BoardConfetti/fireConfetti, board.js) — a real `<canvas>`-drawing,
    // real-timer animation with no bearing on this task, and jsdom has no
    // `canvas` npm package installed to back `getContext()` (no prior DOM
    // test has ever driven a launch all the way to success). BoardConfetti
    // itself already short-circuits entirely under
    // `prefers-reduced-motion: reduce` (its own matchMedia guard, board.js),
    // so stubbing `window.matchMedia` to report that preference is the
    // board's own sanctioned "skip the animation" path — not a new bypass
    // invented for this test.
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    try {
      await act(async () => { primaryLaunchButton(container).click(); });
      await flush(10);
    } finally {
      window.matchMedia = previousMatchMedia;
    }

    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      'Default',
      'after a launch against a legacy bridge, the displayed model must STILL read Default — matching what ' +
      'infrastructure-v8r3q\'s wire-level omission actually sent (no model field reached the listener), never ' +
      'a model name the request could not actually carry',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- outcome 3: full ------------------------------------------------------

test('full-capability bridge: no banner, split button unlocked, label names the real selected model', async () => {
  globalThis.window.fetch = stubFullBridgeFetch(39204, 'full-token');
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);

    assert.equal(
      skewBanner(container),
      null,
      'a bridge advertising the full KNOWN_CAPABILITIES set must never raise the skew banner',
    );
    assert.ok(caretButton(container), 'the split button must render UNLOCKED when the bridge genuinely supports model selection');
    assert.equal(
      primaryLaunchButton(container).textContent.trim(),
      'Opus',
      'the default selected model must be named for real, not "Default"',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- forward-skew: a newer extension than the dashboard knows about ------

test('forward-skew (a bridge advertising MORE than KNOWN_CAPABILITIES) never raises the banner — a field the dashboard never sends is not the builder\'s problem', async () => {
  const port = 39205;
  const token = 'forward-token';
  globalThis.window.fetch = async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, port, token }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return {
        ok: true,
        json: async () => ({ ok: true, capabilities: ['prompt', 'skipPermissions', 'name', 'model', 'someFutureField'] }),
      };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
  const { root, container } = await mountReadyBoardPromptBar();
  try {
    await moveOffQuickCapture(container);

    assert.equal(
      skewBanner(container),
      null,
      'a bridge advertising a superset of KNOWN_CAPABILITIES is forward-skew (a newer extension), not staleness — no banner',
    );
    assert.ok(caretButton(container), 'a forward-skewed bridge still fully supports model selection — unlocked');
    assert.equal(primaryLaunchButton(container).textContent.trim(), 'Opus');
  } finally {
    await act(async () => root.unmount());
  }
});
