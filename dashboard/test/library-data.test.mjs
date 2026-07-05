// Tests for the dashboard library/navigation's pure /api/tree → grouped-artifact
// transform (agentic-workflow-008). The library view itself is a thin React shell
// over the styleguide's TreeGroup/RailItem; the load-bearing, framework-free logic
// is this transform — pooling the tree's artifact LOCATIONS (vision, context-map,
// every BC README, research, ADRs — never tasks) into legibly grouped, slide-over-
// openable items. That is what is tested here (node --test, no DOM).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { treeToLibrary, libraryCount, footerStatusLine } from '../app/library-data.js';

function sampleTree() {
  return {
    root: '/proj',
    locations: {
      vision: '.agentheim/vision.md',
      contextMap: '.agentheim/context-map.md',
      adrs: [
        '.agentheim/knowledge/decisions/0001-foo.md',
        '.agentheim/knowledge/decisions/0009-dashboard-frontend-app-shell.md',
      ],
      research: [
        '.agentheim/knowledge/research/some-report.md',
      ],
    },
    contexts: [
      {
        name: 'alpha',
        readme: '.agentheim/contexts/alpha/README.md',
        index: '.agentheim/contexts/alpha/INDEX.md',
        concepts: ['.agentheim/contexts/alpha/concepts/widget.md'],
        lifecycle: { backlog: [{ id: 'alpha-001', status: 'backlog', path: 'x' }], todo: [], doing: [], done: [] },
      },
      {
        name: 'beta',
        readme: '.agentheim/contexts/beta/README.md',
        index: null,
        concepts: [],
        lifecycle: { backlog: [], todo: [], doing: [], done: [] },
      },
    ],
  };
}

test('the library groups are in a stable, legible order (Concepts right after Bounded contexts)', () => {
  const groups = treeToLibrary(sampleTree());
  assert.deepEqual(
    groups.map((g) => g.group),
    ['Product', 'Bounded contexts', 'Concepts', 'Research', 'Decisions'],
  );
});

test('every BC concept page is listed under Concepts, titled by baseName, type concept', () => {
  const groups = treeToLibrary(sampleTree());
  const concepts = groups.find((g) => g.group === 'Concepts');
  // alpha carries one concept page (widget.md); beta has none.
  assert.deepEqual(concepts.items.map((i) => i.title), ['widget']);
  assert.equal(concepts.items[0].type, 'concept');
  assert.equal(concepts.items[0].path, '.agentheim/contexts/alpha/concepts/widget.md');
});

test('Concepts iterate across every BC, omitting BCs with no concepts', () => {
  const tree = sampleTree();
  tree.contexts[1].concepts = ['.agentheim/contexts/beta/concepts/saga.md'];
  const groups = treeToLibrary(tree);
  const concepts = groups.find((g) => g.group === 'Concepts');
  assert.deepEqual(concepts.items.map((i) => i.title), ['widget', 'saga']);
});

test('an empty Concepts group is omitted (loss-tolerant: missing/empty concepts → no group)', () => {
  const tree = sampleTree();
  tree.contexts[0].concepts = [];
  delete tree.contexts[1].concepts; // missing entirely
  const groups = treeToLibrary(tree);
  assert.equal(groups.some((g) => g.group === 'Concepts'), false);
});

test('vision and context map land in the Product group', () => {
  const groups = treeToLibrary(sampleTree());
  const product = groups.find((g) => g.group === 'Product');
  assert.deepEqual(
    product.items.map((i) => i.type).sort(),
    ['map', 'vision'],
  );
  const vision = product.items.find((i) => i.type === 'vision');
  assert.equal(vision.path, '.agentheim/vision.md');
  assert.equal(vision.title, 'Vision');
});

test('every BC README is listed under Bounded contexts, titled by context name', () => {
  const groups = treeToLibrary(sampleTree());
  const bcs = groups.find((g) => g.group === 'Bounded contexts');
  assert.deepEqual(bcs.items.map((i) => i.title), ['alpha', 'beta']);
  for (const it of bcs.items) assert.equal(it.type, 'context');
  assert.equal(bcs.items[0].path, '.agentheim/contexts/alpha/README.md');
});

test('all ADRs are listed under Decisions, sorted as the tree gives them', () => {
  const groups = treeToLibrary(sampleTree());
  const adrs = groups.find((g) => g.group === 'Decisions');
  assert.deepEqual(
    adrs.items.map((i) => i.path),
    [
      '.agentheim/knowledge/decisions/0001-foo.md',
      '.agentheim/knowledge/decisions/0009-dashboard-frontend-app-shell.md',
    ],
  );
  for (const it of adrs.items) assert.equal(it.type, 'adr');
});

test('research reports are listed under Research', () => {
  const groups = treeToLibrary(sampleTree());
  const research = groups.find((g) => g.group === 'Research');
  assert.deepEqual(research.items.map((i) => i.path), ['.agentheim/knowledge/research/some-report.md']);
  assert.equal(research.items[0].type, 'research');
});

test('NO task ever appears in the library (it is the non-task surface)', () => {
  const groups = treeToLibrary(sampleTree());
  const allPaths = groups.flatMap((g) => g.items.map((i) => i.path));
  assert.ok(!allPaths.includes('x'), 'a lifecycle task path leaked into the library');
  const allTypes = new Set(groups.flatMap((g) => g.items.map((i) => i.type)));
  assert.ok(!allTypes.has('ticket'), 'a ticket-typed item leaked into the library');
});

test('every item carries a unique id, a styleguide content type, a title and a path (slide-over intent shape)', () => {
  const groups = treeToLibrary(sampleTree());
  const items = groups.flatMap((g) => g.items);
  const ids = new Set();
  const CONTENT_TYPES = new Set(['context', 'vision', 'map', 'research', 'adr', 'concept']);
  for (const it of items) {
    assert.ok(it.id && !ids.has(it.id), `id present and unique: ${it.id}`);
    ids.add(it.id);
    assert.ok(CONTENT_TYPES.has(it.type), `recognized content type: ${it.type}`);
    assert.ok(typeof it.title === 'string' && it.title.length > 0, 'has a title');
    assert.ok(typeof it.path === 'string' && it.path.length > 0, 'has a path for /api/doc');
  }
});

test('empty groups are omitted so the nav never shows a 0-item heading', () => {
  const tree = { locations: { vision: null, contextMap: null, adrs: [], research: [] }, contexts: [] };
  const groups = treeToLibrary(tree);
  assert.deepEqual(groups, []);
});

test('a BC with a null/non-array concepts field never throws (loss-tolerant)', () => {
  const tree = sampleTree();
  tree.contexts[0].concepts = null;
  tree.contexts[1].concepts = 'oops';
  assert.doesNotThrow(() => treeToLibrary(tree));
  const groups = treeToLibrary(tree);
  assert.equal(groups.some((g) => g.group === 'Concepts'), false);
});

test('a missing/null tree degrades to an empty library (no throw)', () => {
  assert.deepEqual(treeToLibrary(null), []);
  assert.deepEqual(treeToLibrary(undefined), []);
  assert.deepEqual(treeToLibrary({}), []);
});

test('libraryCount totals every artifact across groups (the rail badge)', () => {
  // 2 product + 2 BC readmes + 1 concept + 2 adrs + 1 research = 8
  assert.equal(libraryCount(treeToLibrary(sampleTree())), 8);
  assert.equal(libraryCount([]), 0);
  assert.equal(libraryCount(null), 0);
});

// footerStatusLine (agentic-workflow-wsfsk, 1a shape): the rail's footer status
// line, sourced LOSS-TOLERANTLY off the same grouped projection the tree
// already renders — counting the Decisions group (ADRs are themselves "done"
// work) rather than wiring a separate board/task read into the rail.
test('footerStatusLine counts the Decisions group as "N done" when present', () => {
  const groups = treeToLibrary(sampleTree()); // 2 ADRs in sampleTree()
  assert.equal(footerStatusLine(groups), 'all clear · 2 done');
});

test('footerStatusLine degrades to "all clear" (no count) when there is no Decisions group', () => {
  const tree = sampleTree();
  tree.locations.adrs = [];
  const groups = treeToLibrary(tree);
  assert.equal(footerStatusLine(groups), 'all clear');
});

test('footerStatusLine never throws on a missing/malformed groups projection (loss-tolerant)', () => {
  assert.doesNotThrow(() => footerStatusLine(null));
  assert.doesNotThrow(() => footerStatusLine(undefined));
  assert.doesNotThrow(() => footerStatusLine([]));
  assert.doesNotThrow(() => footerStatusLine('oops'));
  assert.doesNotThrow(() => footerStatusLine([{ group: 'Decisions', items: 'not-an-array' }]));
  assert.doesNotThrow(() => footerStatusLine([null, undefined, 42]));
  assert.equal(footerStatusLine(null), 'all clear');
  assert.equal(footerStatusLine([{ group: 'Decisions', items: 'not-an-array' }]), 'all clear');
});
