// Tests for the rail "new item" attention transform (agentic-workflow-n4h7q).
//
// The PURE brain behind the left rail's "this research report / ADR just arrived —
// look here" blink. It diffs the live /api/tree projection's research/ADR pointers
// (path + mtimeMs, aw-t3b9k) against a per-SESSION baseline + a cleared snapshot to
// decide which rail rows blink, then derives each group header's cue from its leaves.
// Like board-sort / board-group, it is a pure function over the projection — no
// React, no DOM — so the load-bearing detection/clearing logic is tested here under
// node --test. The React wiring in board.js is integration glue (a separate source
// guard locks the cue is threaded into the rail render).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { railMtimeIndex, flaggedPaths, annotateGroups } from '../app/rail-attention.js';

// A /api/tree fixture carrying research + ADR pointers with the aw-t3b9k parallel
// meta maps, plus a non-attention pointer (vision) and a BC readme to prove scope.
function tree({ adrMtime = 100, resMtime = 200 } = {}) {
  return {
    locations: {
      vision: '.agentheim/vision.md',
      adrs: ['.agentheim/knowledge/decisions/ADR-0001-foo.md'],
      research: ['.agentheim/knowledge/research/bar.md'],
      adrsMeta: { '.agentheim/knowledge/decisions/ADR-0001-foo.md': { mtimeMs: adrMtime } },
      researchMeta: { '.agentheim/knowledge/research/bar.md': { mtimeMs: resMtime } },
    },
    contexts: [{ name: 'agentic-workflow', readme: '.agentheim/contexts/agentic-workflow/README.md' }],
  };
}

const ADR = '.agentheim/knowledge/decisions/ADR-0001-foo.md';
const RES = '.agentheim/knowledge/research/bar.md';

// ---- railMtimeIndex -----------------------------------------------------------

test('railMtimeIndex carries research + ADR pointers keyed by path → mtimeMs', () => {
  const idx = railMtimeIndex(tree({ adrMtime: 100, resMtime: 200 }));
  assert.deepEqual(idx, { [ADR]: 100, [RES]: 200 });
});

test('railMtimeIndex excludes non-research/ADR pointers (vision, BC readme)', () => {
  const idx = railMtimeIndex(tree());
  assert.ok(!('.agentheim/vision.md' in idx), 'vision is out of scope');
  assert.ok(!('.agentheim/contexts/agentic-workflow/README.md' in idx), 'BC readme is out of scope');
});

test('railMtimeIndex degrades an unstattable pointer to null mtime', () => {
  const t = tree();
  delete t.locations.adrsMeta[ADR]; // present in flat array, missing from meta
  const idx = railMtimeIndex(t);
  assert.equal(idx[ADR], null);
});

test('railMtimeIndex is total over a null/empty/malformed tree', () => {
  assert.deepEqual(railMtimeIndex(null), {});
  assert.deepEqual(railMtimeIndex({}), {});
  assert.deepEqual(railMtimeIndex({ locations: 'nope' }), {});
});

// ---- flaggedPaths: created / modified / unchanged -----------------------------

test('a path absent from baseline (created after load) is flagged', () => {
  const baseline = {}; // nothing existed at load
  const index = railMtimeIndex(tree());
  const flagged = flaggedPaths({ index, baseline });
  assert.ok(flagged.has(ADR));
  assert.ok(flagged.has(RES));
});

test('a path with a NEWER mtime than baseline (modified after load) is flagged', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100, resMtime: 200 }));
  const index = railMtimeIndex(tree({ adrMtime: 150, resMtime: 200 })); // ADR re-saved
  const flagged = flaggedPaths({ index, baseline });
  assert.ok(flagged.has(ADR), 'modified ADR blinks');
  assert.ok(!flagged.has(RES), 'untouched research does not blink');
});

test('a path present and UNCHANGED since load does not blink', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100, resMtime: 200 }));
  const index = railMtimeIndex(tree({ adrMtime: 100, resMtime: 200 }));
  const flagged = flaggedPaths({ index, baseline });
  assert.equal(flagged.size, 0);
});

test('an OLDER-or-equal mtime than baseline never flags (no spurious blink)', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100 }));
  const index = railMtimeIndex(tree({ adrMtime: 90 })); // clock skew / touch back
  const flagged = flaggedPaths({ index, baseline });
  assert.ok(!flagged.has(ADR));
});

// ---- reconciliation: vanish + flood -------------------------------------------

test('a flagged path that VANISHES from the projection drops out cleanly', () => {
  const baseline = {}; // both created after load → both flagged
  // Now the ADR file is moved/removed: the live projection no longer carries it.
  const t = tree();
  t.locations.adrs = [];
  delete t.locations.adrsMeta[ADR];
  const index = railMtimeIndex(t);
  const flagged = flaggedPaths({ index, baseline });
  assert.ok(!flagged.has(ADR), 'vanished ADR is not flagged (no orphaned blink)');
  assert.ok(flagged.has(RES), 'the surviving research still blinks');
});

test('a batch of new docs arriving in one frame ALL blink — no cap', () => {
  const baseline = {};
  const adrs = Array.from({ length: 12 }, (_, i) => `adr-${i}.md`);
  const adrsMeta = Object.fromEntries(adrs.map((p, i) => [p, { mtimeMs: i }]));
  const index = railMtimeIndex({ locations: { adrs, adrsMeta } });
  const flagged = flaggedPaths({ index, baseline });
  assert.equal(flagged.size, 12, 'every flagged leaf blinks — no cap');
});

// ---- clearing: per-entry, mtime-versioned -------------------------------------

test('clearing one entry leaves the others flagged', () => {
  const baseline = {}; // both created → both flagged
  const index = railMtimeIndex(tree({ adrMtime: 100, resMtime: 200 }));
  const cleared = { [ADR]: 100 }; // user clicked the ADR (cleared at its current mtime)
  const flagged = flaggedPaths({ index, baseline, cleared });
  assert.ok(!flagged.has(ADR), 'the clicked ADR clears');
  assert.ok(flagged.has(RES), 'the other entry keeps blinking');
});

test('an entry modified AGAIN after it was cleared (still-newer mtime) re-blinks', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100 }));
  const cleared = { [ADR]: 150 }; // cleared after a first edit bumped it to 150
  const index = railMtimeIndex(tree({ adrMtime: 200 })); // edited AGAIN, newer than cleared
  const flagged = flaggedPaths({ index, baseline, cleared });
  assert.ok(flagged.has(ADR), 'a still-newer edit re-flags the cleared doc');
});

test('a re-save at the SAME mtime as cleared does not re-blink', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100 }));
  const cleared = { [ADR]: 150 };
  const index = railMtimeIndex(tree({ adrMtime: 150 })); // equal to cleared, not newer
  const flagged = flaggedPaths({ index, baseline, cleared });
  assert.ok(!flagged.has(ADR));
});

test('a null current mtime can never beat a cleared mark (no spurious re-flag)', () => {
  const baseline = railMtimeIndex(tree({ adrMtime: 100 }));
  const cleared = { [ADR]: 150 };
  const t = tree();
  delete t.locations.adrsMeta[ADR]; // unstattable now → null mtime
  const index = railMtimeIndex(t);
  const flagged = flaggedPaths({ index, baseline, cleared });
  assert.ok(!flagged.has(ADR));
});

test('flaggedPaths is total over missing/malformed args', () => {
  assert.equal(flaggedPaths().size, 0);
  assert.equal(flaggedPaths({}).size, 0);
  assert.equal(flaggedPaths({ index: 'nope', baseline: null }).size, 0);
});

// ---- annotateGroups: per-leaf + derived group cue -----------------------------

function libraryGroups() {
  return [
    { group: 'Research', items: [{ id: 'res-bar', type: 'research', title: 'bar', path: RES }] },
    {
      group: 'Decisions',
      items: [{ id: 'adr-ADR-0001-foo', type: 'adr', title: 'ADR-0001-foo', path: ADR }],
    },
    {
      group: 'Bounded contexts',
      items: [{ id: 'ctx-aw', type: 'context', title: 'agentic-workflow', path: 'x/README.md' }],
    },
  ];
}

test('annotateGroups flags the leaf whose path is in the set and derives the group cue', () => {
  const out = annotateGroups(libraryGroups(), new Set([RES]));
  const research = out.find((g) => g.group === 'Research');
  const decisions = out.find((g) => g.group === 'Decisions');
  assert.equal(research.items[0].attention, true, 'the flagged research leaf blinks');
  assert.equal(research.attention, true, 'the group header inherits the cue (derived)');
  assert.equal(decisions.items[0].attention, false, 'an unflagged ADR leaf does not blink');
  assert.equal(decisions.attention, false, 'the group with no flagged leaf has no cue');
});

test('a group cue clears once all its new leaves are cleared (derived from leaves)', () => {
  // no flagged paths → every leaf and group is attention:false.
  const out = annotateGroups(libraryGroups(), new Set());
  for (const g of out) {
    assert.equal(g.attention, false);
    for (const it of g.items) assert.equal(it.attention, false);
  }
});

test('annotateGroups only flags research/ADR leaves, never other kinds', () => {
  // Even if a BC readme path were (defensively) in the flagged set, a context leaf
  // must not carry the cue — scope is research + ADRs only.
  const out = annotateGroups(libraryGroups(), new Set(['x/README.md']));
  const bc = out.find((g) => g.group === 'Bounded contexts');
  assert.equal(bc.items[0].attention, false);
  assert.equal(bc.attention, false);
});

test('annotateGroups does not mutate its input and is total over a non-array', () => {
  const groups = libraryGroups();
  annotateGroups(groups, new Set([RES]));
  assert.equal('attention' in groups[0], false, 'input group untouched');
  assert.equal('attention' in groups[0].items[0], false, 'input item untouched');
  assert.deepEqual(annotateGroups(null, new Set()), []);
});
