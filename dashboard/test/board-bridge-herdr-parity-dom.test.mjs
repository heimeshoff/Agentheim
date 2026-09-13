// Agentheim — DOM proof of parity between the VS Code and Herdr bridge kinds
// (infrastructure-vpbks, ADR-0082). Every board launch button funnels through
// the ONE `launchOrCopy` (bridge-launch.js): with a Herdr bridge selected
// (`GET /api/bridge` reporting `kind:'herdr', live:true`), each button must
// produce a `POST /api/bridge/launch` body whose `prompt` is byte-identical to
// the string the VS Code path would have POSTed to `/run` for the same click —
// one source of truth (modeling-command.js), never re-derived per bridge kind.
//
// This is a LIVE render+click behavior (which literal endpoint fires, what the
// captured request body actually contains) exactly what a source-regex suite
// cannot see — driven through the real `DashboardBoard` / `BoardPromptBar`
// components via dom-harness.mjs, mirroring board-render-probe-hover.test.mjs's
// `/api/tree` fixture pattern and board-prompt-bar-capability-dom.test.mjs's
// bridge-fetch-stub pattern.
//
// One case per button, per the task's acceptance criteria: Quick Capture,
// Modeling (both via BoardPromptBar's fire()), Refine, Promote
// (BacklogCardLaunchPair), and per-card Work (TodoCardLaunch).

import { mount, act, flush, dom } from './dom-harness.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  refineCommandFor,
  promoteCommandFor,
  workCommandFor,
  quickCaptureCommandFor,
  modelingCommandFor,
} from '../app/modeling-command.js';

const HERDR_TOKEN = 'herdr-parity-token';
const HERDR_CAPS = ['prompt', 'skipPermissions', 'name', 'model'];

function fixtureTree() {
  return {
    contexts: [
      {
        name: 'alpha',
        lifecycle: {
          backlog: [
            { id: 'bl-1', title: 'Backlog one', status: 'backlog', type: 'feature', context: 'alpha', path: '.agentheim/board/alpha/backlog/bl-1.md' },
          ],
          todo: [
            { id: 'td-1', title: 'Todo one', status: 'todo', type: 'feature', context: 'alpha', path: '.agentheim/board/alpha/todo/td-1.md' },
          ],
          doing: [],
          done: [],
        },
      },
    ],
  };
}

// A single fetch stub, installed on BOTH `globalThis.fetch` (the bare `fetch`
// board.js uses for `/api/tree` etc, resolved through Node's real global
// scope) and `globalThis.window.fetch` (the jsdom window property board.js's
// bridge-launch call sites bind via `window.fetch.bind(window)`) — the two
// are DIFFERENT objects once dom-harness.mjs sets `globalThis.window =
// dom.window`, so both must be stubbed for a board that both fetches its own
// tree AND dispatches a bridge launch in the same test.
function makeHerdrFetch(launchCalls) {
  return async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/tree') {
      const tree = fixtureTree();
      return { ok: true, json: async () => tree, text: async () => JSON.stringify(tree) };
    }
    if (href === '/api/bridge') {
      return {
        ok: true,
        json: async () => ({ present: true, kind: 'herdr', token: HERDR_TOKEN, capabilities: HERDR_CAPS, live: true }),
      };
    }
    if (href === '/api/bridge/launch') {
      return {
        ok: true,
        status: 202,
        json: async () => ({ ok: true }),
      };
    }
    if (href.startsWith('/api/')) {
      // Any other same-origin read the mounted board might incidentally poll
      // (whats-next, search, ...) degrades harmlessly — not this test's concern.
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
}

// A recording wrapper: every call to `/api/bridge/launch` is captured (url,
// opts) in `calls`, in addition to being answered by the base stub above.
function makeRecordingHerdrFetch(calls) {
  const base = makeHerdrFetch(calls);
  return async (url, opts = {}) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge/launch') calls.push({ url: href, opts });
    return base(url, opts);
  };
}

function installFetch(calls) {
  const impl = makeRecordingHerdrFetch(calls);
  globalThis.fetch = impl;
  globalThis.window.fetch = impl;
}

class FakeEventSource {
  constructor(url) { this.url = url; this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
}
globalThis.EventSource = FakeEventSource;

function launchToken(opts) {
  const headers = opts.headers || {};
  return headers['X-Agentheim-Bridge-Token'] ?? headers['x-agentheim-bridge-token'];
}

const { DashboardBoard, BoardPromptBar } = await import('../app/board.js');

// ---- card buttons (Refine / Promote / Work) --------------------------------

function findButtonByTitlePrefix(card, prefix) {
  return Array.from(card.querySelectorAll('button')).find((b) => (b.getAttribute('title') || '').startsWith(prefix));
}

test('Refine (backlog card), herdr selected: POST /api/bridge/launch prompt is byte-identical to refineCommandFor(id)', async () => {
  const calls = [];
  installFetch(calls);
  const { root, container } = await mount(DashboardBoard, {});
  try {
    await flush(10);
    const card = container.querySelector('[data-ticket-id="bl-1"]');
    assert.ok(card, 'the backlog card must be mounted');
    const refineBtn = findButtonByTitlePrefix(card, 'Refine');
    assert.ok(refineBtn, 'the Refine button must be present on a backlog card');

    await act(async () => { refineBtn.click(); });
    await flush(10);

    assert.equal(calls.length, 1, 'exactly one POST /api/bridge/launch must have fired');
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.prompt, refineCommandFor('bl-1'), 'the herdr launch body\'s prompt must equal what the VS Code path would have POSTed');
    assert.equal(launchToken(calls[0].opts), HERDR_TOKEN);
  } finally {
    await act(async () => root.unmount());
  }
});

test('Promote (backlog card), herdr selected: POST /api/bridge/launch prompt is byte-identical to promoteCommandFor(id)', async () => {
  const calls = [];
  installFetch(calls);
  const { root, container } = await mount(DashboardBoard, {});
  try {
    await flush(10);
    const card = container.querySelector('[data-ticket-id="bl-1"]');
    assert.ok(card, 'the backlog card must be mounted');
    const promoteBtn = findButtonByTitlePrefix(card, 'Promote');
    assert.ok(promoteBtn, 'the Promote button must be present on a backlog card');

    await act(async () => { promoteBtn.click(); });
    await flush(10);

    assert.equal(calls.length, 1, 'exactly one POST /api/bridge/launch must have fired');
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.prompt, promoteCommandFor('bl-1'));
    assert.equal(launchToken(calls[0].opts), HERDR_TOKEN);
  } finally {
    await act(async () => root.unmount());
  }
});

test('Work (per-card, todo card), herdr selected: POST /api/bridge/launch prompt is byte-identical to workCommandFor(id)', async () => {
  const calls = [];
  installFetch(calls);
  const { root, container } = await mount(DashboardBoard, {});
  try {
    await flush(10);
    const card = container.querySelector('[data-ticket-id="td-1"]');
    assert.ok(card, 'the todo card must be mounted');
    const workBtn = findButtonByTitlePrefix(card, 'Work');
    assert.ok(workBtn, 'the per-card Work button must be present on a todo card');

    await act(async () => { workBtn.click(); });
    await flush(10);

    assert.equal(calls.length, 1, 'exactly one POST /api/bridge/launch must have fired');
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.prompt, workCommandFor('td-1'));
    assert.equal(launchToken(calls[0].opts), HERDR_TOKEN);
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- prompt bar (Quick Capture / Modeling) ----------------------------------

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

function primaryLaunchButton(container) {
  const candidates = Array.from(container.querySelectorAll('button')).filter(
    (b) => b.getAttribute('role') !== 'tab' && b.getAttribute('aria-haspopup') !== 'menu',
  );
  assert.equal(candidates.length, 1, 'exactly one primary ModelSplitButton launch region must be present');
  return candidates[0];
}

// A successful launch fires BoardConfetti (a real canvas-drawing animation
// jsdom cannot back, since the `canvas` npm package is not installed) —
// stubbing `window.matchMedia` to report `prefers-reduced-motion: reduce` is
// BoardConfetti's own sanctioned "skip the animation" guard (board.js), the
// same one board-prompt-bar-capability-dom.test.mjs already uses to drive a
// launch to success under this harness.
async function withReducedMotion(fn) {
  const previous = window.matchMedia;
  window.matchMedia = () => ({ matches: true });
  try {
    await fn();
  } finally {
    window.matchMedia = previous;
  }
}

test('Quick Capture, herdr selected: POST /api/bridge/launch prompt is byte-identical to quickCaptureCommandFor(text)', async () => {
  const calls = [];
  installFetch(calls);
  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const textarea = container.querySelector('textarea');
    assert.ok(textarea, 'the prompt textarea must be present');
    await typeIntoTextarea(textarea, 'ship the herdr parity fix');

    await withReducedMotion(async () => {
      await act(async () => { primaryLaunchButton(container).click(); });
      await flush(10);
    });

    assert.equal(calls.length, 1, 'exactly one POST /api/bridge/launch must have fired');
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.prompt, quickCaptureCommandFor('ship the herdr parity fix'));
    assert.equal(launchToken(calls[0].opts), HERDR_TOKEN);
  } finally {
    await act(async () => root.unmount());
  }
});

test('Modeling, herdr selected: POST /api/bridge/launch prompt is byte-identical to modelingCommandFor(text)', async () => {
  const calls = [];
  installFetch(calls);
  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const tabs = container.querySelectorAll('[role="tab"]');
    assert.equal(tabs.length, 5, 'the five PROMPT_MODES tabs must be present');
    await act(async () => { tabs[1].click(); }); // Modeling

    const textarea = container.querySelector('textarea');
    await typeIntoTextarea(textarea, 'dark mode toggle');

    await withReducedMotion(async () => {
      await act(async () => { primaryLaunchButton(container).click(); });
      await flush(10);
    });

    assert.equal(calls.length, 1, 'exactly one POST /api/bridge/launch must have fired');
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.prompt, modelingCommandFor('dark mode toggle'));
    assert.equal(launchToken(calls[0].opts), HERDR_TOKEN);
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- kind:'none' and explicit kind:'vscode', DOM-level (verifier iteration 1) --
//
// Acceptance criterion 1 requires all THREE kinds to be DOM-tested, not just
// unit-tested: `herdr` is covered above; `vscode`/absent is covered by the
// pre-existing board-prompt-bar-capability-dom.test.mjs (kind-less fixtures);
// this closes the `kind:'none'` gap (and adds an explicit `kind:'vscode'`
// fixture, since the pre-existing suite only ever exercises the kind-ABSENT
// form of the VS Code path, never the literal string).

test('kind:"none", DOM-level: no VS Code discovery, no herdr launch — clipboard fallback only, and it actually lands', async () => {
  const calls = [];
  const impl = async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    calls.push(href);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: false, kind: 'none' }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
  globalThis.fetch = impl;
  globalThis.window.fetch = impl;

  // jsdom carries no `navigator.clipboard` by default (copyToClipboard would
  // resolve false "for free", exactly like a genuinely blocked clipboard —
  // board-prompt-bar-shrink-dom.test.mjs relies on that same fact for its own
  // "declined" case). A real stub here proves the clipboard path was
  // genuinely TAKEN and genuinely landed, not merely that nothing else fired.
  const copied = [];
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: async (text) => { copied.push(text); } },
    configurable: true,
  });

  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const textarea = container.querySelector('textarea');
    assert.ok(textarea, 'the prompt textarea must be present');
    await typeIntoTextarea(textarea, 'no bridge at all please');

    await withReducedMotion(async () => {
      await act(async () => { primaryLaunchButton(container).click(); });
      await flush(10);
    });

    assert.ok(calls.length > 0, 'the discovery endpoint must have been reached at least once (mount-time probe + fire-time discover)');
    assert.ok(
      calls.every((u) => u === '/api/bridge'),
      `kind:"none" must never reach any route beyond discovery — saw: ${JSON.stringify(calls)}`,
    );
    assert.deepEqual(
      copied,
      [quickCaptureCommandFor('no bridge at all please')],
      'the clipboard fallback must have actually landed, with the byte-identical Quick Capture prompt',
    );
  } finally {
    await act(async () => root.unmount());
    delete globalThis.navigator.clipboard;
  }
});

test('explicit kind:"vscode", DOM-level: today\'s VS Code path runs unmodified — POST /run fires, POST /api/bridge/launch never does', async () => {
  const port = 39310;
  const token = 'explicit-vscode-token';
  const runCalls = [];
  const impl = async (url, opts = {}) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ port, token, kind: 'vscode' }) };
    }
    if (href === `http://127.0.0.1:${port}/health`) {
      return { ok: true, json: async () => ({ ok: true, capabilities: HERDR_CAPS }) };
    }
    if (href === `http://127.0.0.1:${port}/run`) {
      runCalls.push({ url: href, opts });
      return { ok: true, status: 202, json: async () => ({ ok: true }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
  globalThis.fetch = impl;
  globalThis.window.fetch = impl;

  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const textarea = container.querySelector('textarea');
    await typeIntoTextarea(textarea, 'explicit vscode kind still works');

    await withReducedMotion(async () => {
      await act(async () => { primaryLaunchButton(container).click(); });
      await flush(10);
    });

    assert.equal(runCalls.length, 1, 'exactly one POST /run must have fired against the VS Code listener');
    const body = JSON.parse(runCalls[0].opts.body);
    assert.equal(body.prompt, quickCaptureCommandFor('explicit vscode kind still works'));
    assert.equal(launchToken(runCalls[0].opts), token);
  } finally {
    await act(async () => root.unmount());
  }
});

// ---- probeBridge dual-kind, driven through the REAL prompt bar --------------
//
// The prompt bar's model selector greys out when no bridge is reachable
// (probeBridge) — the same live-render behavior board-prompt-bar-capability-
// dom.test.mjs already proves for the VS Code kind. This proves it renders
// UNLOCKED against a live herdr bridge too (the split button's caret present,
// a real model name shown), and LOCKED when the herdr bridge is recorded but
// not live — `probeBridge` must resolve `{present, capabilities}` correctly
// for both kinds, per the task's acceptance criteria.

test('herdr bridge live: the model split button renders UNLOCKED (probeBridge resolves present:true, full capabilities)', async () => {
  installFetch([]);
  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const tabs = container.querySelectorAll('[role="tab"]');
    await act(async () => { tabs[1].click(); }); // off Quick Capture's model pin

    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.ok(caret, 'a live, full-capability herdr bridge must unlock the model split button');
  } finally {
    await act(async () => root.unmount());
  }
});

test('herdr bridge recorded but not live: the model split button renders LOCKED (probeBridge resolves present:false)', async () => {
  const impl = async (url) => {
    const href = typeof url === 'string' ? url : String(url);
    if (href === '/api/bridge') {
      return { ok: true, json: async () => ({ present: true, kind: 'herdr', token: HERDR_TOKEN, capabilities: HERDR_CAPS, live: false }) };
    }
    throw new Error(`unstubbed fetch in a DOM-harness test: ${href}`);
  };
  globalThis.fetch = impl;
  globalThis.window.fetch = impl;

  const { root, container } = await mount(BoardPromptBar, {});
  try {
    await flush(10);
    const tabs = container.querySelectorAll('[role="tab"]');
    await act(async () => { tabs[1].click(); });

    const caret = container.querySelector('button[aria-haspopup="menu"]');
    assert.equal(caret, null, 'a not-live herdr bridge must render the split button locked, exactly like an absent bridge');
  } finally {
    await act(async () => root.unmount());
  }
});
