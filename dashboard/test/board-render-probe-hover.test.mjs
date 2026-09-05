// jsdom DOM-render proof (agentic-workflow-rw6ck) that hovering a card
// re-renders ONLY that card and its resolved dependency ring targets — not
// every card on the board.
//
// Before this task, `board.js` had NO `React.memo` anywhere: hovering a
// backlog/todo card lifts `hoveredId` into the board root
// (`DashboardBoard`'s `setHoveredId`), which recomputes `waitingOn`/
// `holdingUp`/`targetIds` and re-renders every mounted `BoardCard` — all
// ~200+ of them, most sitting in the always-mounted Done column. A test-only
// render-count PROBE (an injectable `{ card, column }` recorder, default a
// no-op, threaded DashboardBoard -> BoardColumn -> BoardCard exactly like
// WhatsNextPanel's/InFlightLane's `fetchDoc` DI) makes the render fan-out
// directly OBSERVABLE. A DOM-mutation-based check would be a FALSE GREEN
// here: an unmemoized card that re-renders to IDENTICAL output mutates
// nothing observable in the DOM, so mutation-counting cannot distinguish
// "skipped" from "re-rendered identically" — this is exactly why the task
// calls a DOM-mutation observer the WRONG mechanism.
//
// ADR-0062 (runner-first): this test was run RED against the unmodified
// board (BoardCardMemo/BoardColumnMemo aliased to the bare, unmemoized
// components, no other change) before BoardCard/BoardColumn were wrapped in
// React.memo — see the task's `## Outcome` for the captured red transcript.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mount, flush, act, dom } from './dom-harness.mjs';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type, data) {
    for (const fn of this.listeners[type] || []) fn({ data });
  }
}
globalThis.EventSource = FakeEventSource;

// One backlog card (the hover SOURCE) depending on one todo target and
// blocking one doing target, plus 197 unrelated Done cards — 200 total. The
// two dependency targets live OUTSIDE Done specifically so "0 renders for
// every Done-column card" and "exactly {hovered id, target1, target2}" are
// two independently-checkable, non-overlapping claims.
function bigFixtureTree() {
  const done = [];
  for (let i = 0; i < 197; i++) {
    done.push({
      id: `done-${String(i).padStart(3, '0')}`,
      title: `Done task ${i}`,
      status: 'done',
      type: 'chore',
      context: 'alpha',
      path: `.agentheim/contexts/alpha/done/done-${i}.md`,
    });
  }
  return {
    contexts: [
      {
        name: 'alpha',
        lifecycle: {
          backlog: [
            {
              id: 'src-1', title: 'Backlog source', status: 'backlog', type: 'feature',
              context: 'alpha', path: '.agentheim/contexts/alpha/backlog/src-1.md',
              dependsOn: ['t1'], blocks: ['t2'],
            },
          ],
          todo: [
            { id: 't1', title: 'Target one', status: 'todo', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/todo/t1.md' },
          ],
          doing: [
            { id: 't2', title: 'Target two', status: 'doing', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/doing/t2.md' },
          ],
          done,
        },
      },
    ],
  };
}

const FIXTURE = bigFixtureTree();

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/tree')) {
    return { ok: true, json: async () => FIXTURE, text: async () => JSON.stringify(FIXTURE) };
  }
  return { ok: false, status: 404, text: async () => '', json: async () => null };
};

const { DashboardBoard } = await import('../app/board.js');

async function dispatchHoverEnter(target) {
  // React's onMouseEnter/onMouseLeave are synthesized from the native,
  // BUBBLING mouseover/mouseout pair (mouseenter/mouseleave themselves don't
  // bubble and can't be delegated at React's root listener) — a real browser
  // click on this card fires mouseover first, exactly what this dispatches.
  const event = new dom.window.MouseEvent('mouseover', { bubbles: true, cancelable: true, relatedTarget: null });
  await act(async () => { target.dispatchEvent(event); });
}

test('hovering a backlog card re-renders only that card and its resolved dependency targets — not the 197 Done cards', async () => {
  const cardRenders = [];
  const renderProbe = {
    card: (id) => cardRenders.push(id),
    column: () => {},
  };

  const { root, container } = await mount(DashboardBoard, { renderProbe });
  try {
    await flush();

    // Sanity: the board actually mounted all 200 cards (a bug that dropped
    // cards would make the "0 Done renders" assertion vacuously true).
    const doneNodes = container.querySelectorAll('[data-ticket-id^="done-"]');
    assert.equal(doneNodes.length, 197, 'all 197 Done cards must be mounted');
    const srcNode = container.querySelector('[data-ticket-id="src-1"]');
    assert.ok(srcNode, 'the backlog source card must be mounted');

    // Reset the probe AFTER mount — mount-time renders are not what this test
    // is about.
    cardRenders.length = 0;

    await dispatchHoverEnter(srcNode);

    const doneRenders = cardRenders.filter((id) => id.startsWith('done-'));
    assert.deepEqual(doneRenders, [], '0 renders for every Done-column card');

    assert.deepEqual(
      cardRenders.slice().sort(),
      ['src-1', 't1', 't2'].sort(),
      'exactly the hovered card and its two resolved dependency targets must render — nothing else, no duplicates',
    );
  } finally {
    await act(async () => root.unmount());
  }
});
