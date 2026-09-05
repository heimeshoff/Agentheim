// Tests for the dashboard board's pure /api/tree → column-tickets transform
// (agentic-workflow-006). The board view itself is a thin React shell over the
// styleguide's Column/TicketCard; the load-bearing, framework-free logic is this
// transform, so that is what is tested here (node --test, no DOM).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COLUMN_ORDER, treeToColumns, treeTicket } from '../app/board-data.js';

function sampleTree() {
  return {
    root: '/proj',
    locations: { vision: null, contextMap: null, adrs: [], research: [] },
    contexts: [
      {
        name: 'alpha',
        lifecycle: {
          backlog: [
            { id: 'alpha-001', title: 'A backlog task', status: 'backlog', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/backlog/alpha-001.md' },
          ],
          todo: [
            { id: 'alpha-002', title: 'A todo task', status: 'todo', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/todo/alpha-002.md' },
          ],
          doing: [],
          done: [
            { id: 'alpha-003', title: 'A done task', status: 'done', type: 'chore', context: 'alpha', path: '.agentheim/contexts/alpha/done/alpha-003.md' },
          ],
        },
      },
      {
        name: 'beta',
        lifecycle: {
          backlog: [],
          todo: [
            { id: 'beta-001', title: 'Another todo task', status: 'todo', type: 'bug', context: 'beta', path: '.agentheim/contexts/beta/todo/beta-001.md' },
          ],
          doing: [
            { id: 'beta-002', title: 'A doing task', status: 'doing', type: 'feature', context: 'beta', path: '.agentheim/contexts/beta/doing/beta-002.md' },
          ],
          done: [],
        },
      },
    ],
  };
}

test('COLUMN_ORDER is the four lifecycle columns in order', () => {
  assert.deepEqual(COLUMN_ORDER, ['backlog', 'todo', 'doing', 'done']);
});

test('treeToColumns produces exactly the four lifecycle columns', () => {
  const cols = treeToColumns(sampleTree());
  assert.deepEqual(Object.keys(cols).sort(), ['backlog', 'doing', 'done', 'todo']);
});

test('tasks from ALL bounded contexts are pooled into one flat column (no swimlanes)', () => {
  const cols = treeToColumns(sampleTree());
  // todo column carries alpha-002 AND beta-001 — two different BCs, one column.
  const todoIds = cols.todo.map((t) => t.id).sort();
  assert.deepEqual(todoIds, ['alpha-002', 'beta-001']);
  const todoContexts = new Set(cols.todo.map((t) => t.context));
  assert.deepEqual([...todoContexts].sort(), ['alpha', 'beta']);
});

test('each card carries its BC in the context field (the chip label) and its source path', () => {
  const cols = treeToColumns(sampleTree());
  const beta = cols.doing.find((t) => t.id === 'beta-002');
  assert.equal(beta.context, 'beta');
  assert.equal(beta.path, '.agentheim/contexts/beta/doing/beta-002.md');
});

test('a card lands in the column matching its status, not necessarily its folder origin', () => {
  // A task whose frontmatter status disagrees with its folder still files under status.
  const tree = sampleTree();
  tree.contexts[0].lifecycle.backlog[0].status = 'doing';
  const cols = treeToColumns(tree);
  assert.ok(cols.doing.some((t) => t.id === 'alpha-001'), 'status-driven placement');
  assert.ok(!cols.backlog.some((t) => t.id === 'alpha-001'), 'no longer in backlog');
});

test('an unknown status is bucketed conservatively into backlog so no card is lost', () => {
  const tree = sampleTree();
  tree.contexts[0].lifecycle.todo[0].status = 'weird';
  const cols = treeToColumns(tree);
  assert.ok(cols.backlog.some((t) => t.id === 'alpha-002'));
});

test('empty contexts/locations do not throw and yield four empty columns', () => {
  const cols = treeToColumns({ contexts: [] });
  for (const c of COLUMN_ORDER) assert.deepEqual(cols[c], []);
});

test('a missing tree (null/undefined) degrades to four empty columns', () => {
  const cols = treeToColumns(null);
  for (const c of COLUMN_ORDER) assert.deepEqual(cols[c], []);
});

test('treeTicket maps a tree task into the TicketCard shape the styleguide expects', () => {
  const t = treeTicket({
    id: 'alpha-002', title: 'A todo task', status: 'todo',
    type: 'feature', context: 'alpha',
    path: '.agentheim/contexts/alpha/todo/alpha-002.md',
  });
  // The styleguide TicketCard reads: id, title, status, context, est, updated, agent.
  assert.equal(t.id, 'alpha-002');
  assert.equal(t.title, 'A todo task');
  assert.equal(t.status, 'todo');
  assert.equal(t.context, 'alpha');
  assert.equal(t.path, '.agentheim/contexts/alpha/todo/alpha-002.md');
  // The card renders these — they must be present (defined) so the card never shows undefined.
  assert.notEqual(t.est, undefined);
  assert.notEqual(t.updated, undefined);
});

test('treeTicket normalizes a malformed status so it can never crash the card', () => {
  // Regression: a hand-edited task file leaked its frontmatter-template comment
  // into the status (`todo  # backlog | todo | doing | done`). The styleguide
  // TicketCard indexes STATUSES[status] and reads .color off it — an unknown key
  // is undefined and throws AT RENDER TIME, unmounting the whole board (blank
  // page). treeTicket must hand the card a canonical status, never the raw value.
  const leaked = treeTicket({
    id: 'aw-014', title: 'malformed', status: 'todo                # backlog | todo | doing | done',
  });
  assert.equal(leaked.status, 'backlog'); // unknown → bucketed, matches its column
  assert.ok(COLUMN_ORDER.includes(leaked.status), 'status is always one of the four columns');

  // A well-formed status still passes through untouched.
  assert.equal(treeTicket({ id: 'x', title: 'x', status: 'doing' }).status, 'doing');
  // A missing/empty status also lands on a canonical value, never '' or undefined.
  assert.ok(COLUMN_ORDER.includes(treeTicket({ id: 'x', title: 'x' }).status));
});

test('treeTicket carries mtimeMs through so the board-side sort can order by it (aw-012/aw-013)', () => {
  // The /api/tree projection carries each task's file modification time (aw-013);
  // the default board sort (modification date descending, aw-012) needs it on the
  // projected ticket. Pass it through unchanged.
  const t = treeTicket({
    id: 'alpha-002', title: 'A todo task', status: 'todo',
    type: 'feature', context: 'alpha',
    path: '.agentheim/contexts/alpha/todo/alpha-002.md',
    mtimeMs: 1717000000000,
  });
  assert.equal(t.mtimeMs, 1717000000000);
});

test('treeTicket leaves mtimeMs null when the read model could not stat the file', () => {
  // aw-013/ADR-0002: mtimeMs is null when the file cannot be stat'd. The board
  // sort treats null as oldest — so it must arrive as null, not undefined/0.
  const t = treeTicket({ id: 'x-1', title: 'x', status: 'todo', mtimeMs: null });
  assert.equal(t.mtimeMs, null);
  const t2 = treeTicket({ id: 'x-2', title: 'x', status: 'todo' });
  assert.equal(t2.mtimeMs, null);
});

test('treeTicket carries dependsOn/blocks through so the hover resolver can use them (aw-d8q3n/aw-k5p8w)', () => {
  // The /api/tree projection carries raw, unresolved id-string arrays
  // (ADR-0002); the board-side hover resolver (board-dependencies.js) needs
  // them on the pooled ticket. Pass them through unchanged.
  const t = treeTicket({
    id: 'alpha-002', title: 'A todo task', status: 'todo',
    dependsOn: ['alpha-001'], blocks: ['alpha-003', 'alpha-004'],
  });
  assert.deepEqual(t.dependsOn, ['alpha-001']);
  assert.deepEqual(t.blocks, ['alpha-003', 'alpha-004']);
});

test('treeTicket defaults dependsOn/blocks to [] when absent or malformed', () => {
  // Absent, non-array, or otherwise malformed frontmatter must never reach the
  // resolver as anything but an array — never undefined, never a throw.
  const missing = treeTicket({ id: 'x-1', title: 'x', status: 'todo' });
  assert.deepEqual(missing.dependsOn, []);
  assert.deepEqual(missing.blocks, []);

  const malformed = treeTicket({ id: 'x-2', title: 'x', status: 'todo', dependsOn: 'not-an-array', blocks: null });
  assert.deepEqual(malformed.dependsOn, []);
  assert.deepEqual(malformed.blocks, []);
});

// ---- Identity-stable projection (agentic-workflow-rw6ck) -------------------
// treeToColumns(tree, prev) reconciles against the previously-projected
// columns: a task whose projected ticket is value-equal to the prior one
// keeps the SAME object, so a re-fetch of an unchanged tree commits nothing
// and a single task move re-renders a single card. See the README's
// "Identity-stable projection" ubiquitous-language entry.

test('treeToColumns(tree, prev) called twice on the same tree reuses every ticket object, every column array, and returns prev itself', () => {
  const tree = sampleTree();
  const first = treeToColumns(tree);
  const second = treeToColumns(tree, first);

  for (const c of COLUMN_ORDER) {
    assert.equal(second[c].length, first[c].length, `${c} column length must be unchanged`);
    for (let i = 0; i < first[c].length; i++) {
      assert.equal(second[c][i], first[c][i], `${c}[${i}] ticket object must be the SAME object (referential identity)`);
    }
    assert.equal(second[c], first[c], `${c} column array itself must be reused (all members identical)`);
  }
  assert.equal(second, first, 'treeToColumns must return the PREVIOUS columns object itself when every column is reused');
});

test('treeToColumns(tree, prev) after one task moves todo->doing: exactly one ticket differs by identity, exactly the two affected columns are fresh, everything else is reused', () => {
  const tree = sampleTree();
  const first = treeToColumns(tree);

  const moved = sampleTree();
  moved.contexts[1].lifecycle.todo[0].status = 'doing'; // beta-001: todo -> doing
  const second = treeToColumns(moved, first);

  assert.notEqual(second, first, 'the top-level columns object must be fresh when something changed');
  assert.equal(second.backlog, first.backlog, 'backlog is unaffected by the move — array reused');
  assert.equal(second.done, first.done, 'done is unaffected by the move — array reused');
  assert.notEqual(second.todo, first.todo, 'todo lost a ticket — must be a fresh array');
  assert.notEqual(second.doing, first.doing, 'doing gained a ticket — must be a fresh array');

  const firstById = new Map();
  for (const c of COLUMN_ORDER) for (const t of first[c]) firstById.set(t.id, t);
  const secondById = new Map();
  for (const c of COLUMN_ORDER) for (const t of second[c]) secondById.set(t.id, t);

  let differing = 0;
  for (const [id, t] of secondById) {
    if (firstById.get(id) !== t) differing += 1;
  }
  assert.equal(differing, 1, 'exactly one ticket object must differ by identity after one task move');
  assert.notEqual(secondById.get('beta-001'), firstById.get('beta-001'), 'the moved ticket itself must be the one that differs');
});

test('treeToColumns(tree, prev) treats mtimeMs as part of value-equality — a changed mtime allocates a fresh ticket object', () => {
  const tree = sampleTree();
  const first = treeToColumns(tree);

  const touched = sampleTree();
  touched.contexts[0].lifecycle.todo[0].mtimeMs = 1717000000000; // alpha-002 body edited
  const second = treeToColumns(touched, first);

  const firstAlpha002 = first.todo.find((t) => t.id === 'alpha-002');
  const secondAlpha002 = second.todo.find((t) => t.id === 'alpha-002');
  assert.notEqual(secondAlpha002, firstAlpha002, 'an mtime change must allocate a fresh ticket object — the sort reads it');
});

test('treeToColumns(tree, prev) compares dependsOn/blocks element-wise, not by array identity', () => {
  const tree = sampleTree();
  tree.contexts[0].lifecycle.todo[0].dependsOn = ['alpha-001'];
  const first = treeToColumns(tree);

  // A fresh /api/tree fetch always yields NEW array instances even when the
  // element contents are unchanged — the reconcile must not be fooled by that
  // into allocating a fresh ticket.
  const refetched = sampleTree();
  refetched.contexts[0].lifecycle.todo[0].dependsOn = ['alpha-001'];
  const second = treeToColumns(refetched, first);

  const firstAlpha002 = first.todo.find((t) => t.id === 'alpha-002');
  const secondAlpha002 = second.todo.find((t) => t.id === 'alpha-002');
  assert.equal(secondAlpha002, firstAlpha002, 'element-wise-equal dependsOn must reuse the prior ticket object');

  const changed = sampleTree();
  changed.contexts[0].lifecycle.todo[0].dependsOn = ['alpha-003'];
  const third = treeToColumns(changed, second);
  const thirdAlpha002 = third.todo.find((t) => t.id === 'alpha-002');
  assert.notEqual(thirdAlpha002, secondAlpha002, 'a genuinely changed dependsOn must allocate a fresh ticket object');
});
