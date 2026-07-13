// Agentheim — jsdom DOM-render test harness (infrastructure-d2n8s)
//
// A source-regex suite (board-prompt-bar.test.mjs, model-split-button.test.mjs)
// reads board.js / button.js as TEXT and asserts strings appear in it — forced,
// because there was no DOM under `node --test`. That is not a stylistic quirk;
// it is a real, measured blind spot: agentic-workflow-m2vkp shipped a
// double-handled Ctrl+M (React 18 `createRoot` delegates keydown at the root
// CONTAINER; the event then bubbles on to `document`, where a second listener
// also fired — no `stopPropagation()`, `preventDefault()` doesn't stop
// propagation, so the model advanced by +2, not +1) with 1279 tests green,
// because reading source as a string cannot tell you what happens when two
// listeners are both attached and one bubbles into the other. Only a
// fresh-context verifier reasoning about React's delegation model caught it.
// See board-prompt-bar-dom.test.mjs for that reproduction, driven through
// THIS harness.
//
// jsdom is a `dashboard/package.json` devDependency ONLY — never installed
// or reachable to RUN the dashboard (ADR-0002/ADR-0003's build/test-time-only
// carve-out, the same category infrastructure-002 already established for
// esbuild/react/react-dom; dist-build.test.mjs asserts jsdom never reaches
// the committed bundle).
//
// USAGE — import this module FIRST, before any dynamic import of board.js or
// a styleguide component:
//
//   import { mount, act, dispatchKeyDown } from './dom-harness.mjs';
//   const { BoardPromptBar } = await import('../app/board.js');
//   const { root, container } = await mount(BoardPromptBar, { skipPermissions: false });
//   try {
//     ... dispatchKeyDown(target, { ctrlKey: true, key: 'm' }) ...
//   } finally {
//     await act(async () => root.unmount());   // ALWAYS — board.js registers
//       // its document keydown listener in a useEffect; a leaked mount makes
//       // the NEXT test's dispatch double-fire, producing a bogus RED.
//   }
//
// This module's own first statement registers the bare-specifier resolve
// hook (resolve-hook.mjs) that lets a styleguide module — which has no
// node_modules anywhere up its own tree — resolve `react`/`htm`/`marked`
// against dashboard/node_modules (mirrors build.mjs's esbuild `nodePaths`).
// `node --test` runs every matched test FILE in its own child process, so
// this registration is scoped to whichever test file imports dom-harness.mjs
// — it has no effect on any other file in the suite.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./resolve-hook.mjs', import.meta.url);

const { JSDOM } = await import('jsdom');

// pretendToBeVisual: true gives jsdom real layout/animation timers
// (requestAnimationFrame etc.) that React's scheduler consults. A real
// http://localhost/ origin, since board.js issues both relative
// (`/api/bridge`) and absolute (`http://127.0.0.1:<port>/...`) fetches.
export const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MessageChannel = dom.window.MessageChannel;

// `globalThis.navigator` is a GETTER-ONLY accessor on modern Node — a plain
// `globalThis.navigator = dom.window.navigator` throws in ESM strict mode.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

// React 18's `act()` refuses to run outside what it believes is a test
// environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function resolveAct() {
  const React = await import('react');
  if (typeof React.act === 'function') return React.act;
  // React 18.3.1's own `act` export is unverified at authoring time; the
  // fallback (react-dom/test-utils) emits a deprecation warning but works.
  const testUtils = await import('react-dom/test-utils');
  return testUtils.act;
}

export const act = await resolveAct();

/**
 * Mount `Component` with `props`. The container is attached to
 * `document.body` BEFORE `createRoot(container)` — a DETACHED container
 * never sees an event bubble to `document`, so the m2vkp bug this harness
 * exists to catch would silently NOT reproduce and the harness would give a
 * false green (the single easiest way to ship something worthless here).
 * Wrapped in `act()` so mount-time effects (board.js's bridge probe +
 * its document keydown listener registration) have flushed.
 * @returns {Promise<{root: import('react-dom/client').Root, container: HTMLElement}>}
 */
export async function mount(Component, props = {}) {
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Component, props));
  });
  return { root, container };
}

/**
 * Dispatch a REAL keydown on `target` through jsdom's full spec
 * capture/bubble algorithm — plain DOM behavior, not browser-specific, so
 * the m2vkp mechanism (a React-delegated listener at the root container,
 * then the same native event bubbling on to `document`) reproduces here
 * exactly as it does in a real browser. Wrapped in `act()` so a listener's
 * state update (including the `document`-scoped handler's, which is NOT
 * itself inside React's own dispatch) has flushed before the caller asserts.
 * @returns {Promise<KeyboardEvent>}
 */
export async function dispatchKeyDown(target, init = {}) {
  const event = new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

/**
 * Flush pending microtasks/timers (an async effect's `.then()`, e.g.
 * board.js's mount-time bridge probe) and the resulting re-render, wrapped
 * in `act()`.
 */
export async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
