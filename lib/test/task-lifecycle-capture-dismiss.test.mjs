import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { captureTask, dismissTask } from '../task-lifecycle-capture-dismiss.mjs';

const FOLDERS = ['backlog', 'todo', 'doing', 'done'];

function bcDir(root, bc) {
  return path.join(root, '.agentheim', 'contexts', bc);
}

function makeProjectRoot() {
  return mkdtempSync(path.join(tmpdir(), 'aw-capdis-'));
}

function ensureFolders(root, bc) {
  for (const f of FOLDERS) mkdirSync(path.join(bcDir(root, bc), f), { recursive: true });
}

function taskContent({
  id,
  title = 'A task',
  status,
  type = 'feature',
  context,
  dependsOn = [],
  blocks = [],
  priorArt = [],
  created = '2026-07-01',
} = {}) {
  return `---
id: ${id}
title: ${title}
status: ${status}
type: ${type}
context: ${context}
created: ${created}
completed:
depends_on: [${dependsOn.join(', ')}]
blocks: [${blocks.join(', ')}]
tags: []
related_adrs: []
related_research: []
prior_art: [${priorArt.join(', ')}]
---

## Why

stuff
`;
}

function writeTask(root, bc, folder, spec) {
  const fileName = spec.fileName ?? `${spec.id}-slug.md`;
  const filePath = path.join(bcDir(root, bc), folder, fileName);
  writeFileSync(filePath, taskContent({ ...spec, status: folder, context: bc }));
  return filePath;
}

function makeIndexMd({
  backlogLines = [],
  todoLines = [],
  doingLines = [],
  doneLines = [],
  counts = { Backlog: 0, Todo: 0, Doing: 0, Done: 0 },
} = {}) {
  return `# BC — Index

Catalog of everything in this bounded context.

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** ${counts.Backlog}
- **Todo:** ${counts.Todo}
- **Doing:** ${counts.Doing}
- **Done:** ${counts.Done}
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
${todoLines.map((l) => l + '\n').join('')}<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
${doingLines.map((l) => l + '\n').join('')}<!-- doing-list:end -->

### Done
<!-- done-list:start -->
${doneLines.map((l) => l + '\n').join('')}<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
<!-- adr-local:end -->
`;
}

function writeIndex(root, bc, opts) {
  const p = path.join(bcDir(root, bc), 'INDEX.md');
  writeFileSync(p, makeIndexMd(opts));
  return p;
}

function indexPath(root, bc) {
  return path.join(bcDir(root, bc), 'INDEX.md');
}

function protocolPath(root) {
  return path.join(root, '.agentheim', 'knowledge', 'protocol.md');
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// captureTask
// ---------------------------------------------------------------------------

test('captureTask registers a backlog-authored file: INDEX insert + count delta + protocol entry', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-k3f9q';
    writeTask(root, bc, 'backlog', { id, title: 'A captured idea', type: 'feature' });
    writeIndex(root, bc, { counts: { Backlog: 0, Todo: 0, Doing: 0, Done: 0 } });

    const now = new Date(2026, 8, 6, 10, 0);
    const res = captureTask(root, id, { context: bc, now, source: 'modeling', summary: 'The idea, in one line.' });

    assert.equal(res.ok, true);
    assert.equal(res.verb, 'capture');
    assert.equal(res.id, id);
    assert.equal(res.message, `chore(${bc}): capture ${id} — A captured idea [${id}]`);
    assert.deepEqual(new Set(res.changed), new Set([indexPath(root, bc), protocolPath(root)]));

    const indexContent = readFileSync(indexPath(root, bc), 'utf8');
    assert.match(indexContent, new RegExp(`backlog-list:start -->\\n- \\*\\*${id}\\*\\* — A captured idea \\(feature\\) — \`backlog/${id}-slug.md\``));
    assert.match(indexContent, /\*\*Backlog:\*\* 1/);

    const protocolContent = readFileSync(protocolPath(root), 'utf8');
    assert.match(protocolContent, new RegExp(`Modeling / Captured: ${id} - A captured idea`));
    assert.match(protocolContent, /\*\*Type:\*\* Modeling \/ Capture/);
    assert.match(protocolContent, /\*\*Filed to:\*\* backlog/);
    assert.match(protocolContent, /\*\*Summary:\*\* The idea, in one line\./);
  } finally {
    cleanup(root);
  }
});

test('captureTask registers a todo-authored file (quick-capture source) into todo-list / Todo count', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-t0k3n';
    writeTask(root, bc, 'todo', { id, title: 'Ready idea', type: 'chore' });
    writeIndex(root, bc, { counts: { Backlog: 0, Todo: 0, Doing: 0, Done: 0 } });

    const res = captureTask(root, id, { context: bc, source: 'quick-capture', summary: 'jotted', now: new Date(2026, 8, 6, 11, 0) });
    assert.equal(res.ok, true);

    const indexContent = readFileSync(indexPath(root, bc), 'utf8');
    assert.match(indexContent, new RegExp(`todo-list:start -->\\n- \\*\\*${id}\\*\\* — Ready idea \\(chore\\)`));
    assert.match(indexContent, /\*\*Todo:\*\* 1/);

    const protocolContent = readFileSync(protocolPath(root), 'utf8');
    assert.match(protocolContent, new RegExp(`Capture / Captured: ${id} - Ready idea`));
    assert.match(protocolContent, /\*\*Type:\*\* Capture\n/);
    assert.match(protocolContent, /\*\*Filed to:\*\* todo/);
  } finally {
    cleanup(root);
  }
});

test('captureTask accepts a grandfathered malformed id (classifyTaskId: malformed, but on the allowlist)', () => {
  const root = makeProjectRoot();
  const bc = 'infrastructure';
  try {
    ensureFolders(root, bc);
    const id = 'infrastructure-5w5gs';
    writeTask(root, bc, 'backlog', { id, title: 'Out-of-spec id, already shipped' });
    writeIndex(root, bc, {});

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, true);
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects not-found (zero writes) when the file is in neither backlog/ nor todo/', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-abcde';
    const idxBefore = writeIndex(root, bc, {});
    const before = readFileSync(idxBefore, 'utf8');

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not-found');
    assert.equal(readFileSync(idxBefore, 'utf8'), before);
    assert.equal(existsSync(protocolPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects ambiguous-location (zero writes) when the file exists in BOTH backlog/ and todo/', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-dup01';
    writeTask(root, bc, 'backlog', { id, title: 'dup' });
    writeTask(root, bc, 'todo', { id, title: 'dup' });
    const idxBefore = writeIndex(root, bc, {});
    const before = readFileSync(idxBefore, 'utf8');

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'ambiguous-location');
    assert.equal(readFileSync(idxBefore, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects invalid-id (malformed, not grandfathered) with zero writes', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-9zzzz'; // digit-leading 5-char tail, not grandfathered
    writeTask(root, bc, 'backlog', { id, title: 'bad id' });
    const idxBefore = writeIndex(root, bc, {});
    const before = readFileSync(idxBefore, 'utf8');

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'invalid-id');
    assert.equal(readFileSync(idxBefore, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects status-mismatch when frontmatter status disagrees with the folder found', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-stat1';
    const filePath = path.join(bcDir(root, bc), 'backlog', `${id}-slug.md`);
    writeFileSync(filePath, taskContent({ id, title: 'x', status: 'todo', context: bc }));
    writeIndex(root, bc, {});

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'status-mismatch');
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects context-mismatch when frontmatter context disagrees with the id-derived one', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-ctx01';
    const filePath = path.join(bcDir(root, bc), 'backlog', `${id}-slug.md`);
    writeFileSync(filePath, taskContent({ id, title: 'x', status: 'backlog', context: 'design-system' }));
    writeIndex(root, bc, {});

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'context-mismatch');
  } finally {
    cleanup(root);
  }
});

test('captureTask rejects missing-field when title is absent entirely', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-905';
    const filePath = path.join(bcDir(root, bc), 'backlog', `${id}-slug.md`);
    writeFileSync(
      filePath,
      `---\nid: ${id}\nstatus: backlog\ntype: feature\ncontext: ${bc}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
    );
    writeIndex(root, bc, {});

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'missing-field');
  } finally {
    cleanup(root);
  }
});

test('captureTask refuses index-missing when the BC already holds other tasks and has no INDEX.md', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    // A pre-existing done/ task the BC already had — INDEX.md absent.
    writeTask(root, bc, 'done', { id: 'agentic-workflow-900', title: 'Old', status: 'done' });
    const id = 'agentic-workflow-902';
    writeTask(root, bc, 'backlog', { id, title: 'New' });

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'index-missing');
    assert.equal(existsSync(indexPath(root, bc)), false);
  } finally {
    cleanup(root);
  }
});

test('captureTask backfills a missing INDEX.md from references/index-template.md when the BC holds nothing but the captured file', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-fresh';
    writeTask(root, bc, 'backlog', { id, title: 'First task' });

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's', now: new Date(2026, 8, 6) });
    assert.equal(res.ok, true);
    assert.equal(existsSync(indexPath(root, bc)), true);
    const content = readFileSync(indexPath(root, bc), 'utf8');
    assert.match(content, /# Agentic Workflow — Index/);
    assert.match(content, new RegExp(`backlog-list:start -->\\n- \\*\\*${id}\\*\\* — First task`));
    assert.match(content, /\*\*Backlog:\*\* 1/);
    assert.match(content, /\*\*Todo:\*\* 0/);
  } finally {
    cleanup(root);
  }
});

test('captureTask with protocolEntry:false performs no protocol.md read or write (byte-identical after)', () => {
  const root = makeProjectRoot();
  const bc = 'infrastructure';
  try {
    ensureFolders(root, bc);
    const id = 'infrastructure-001';
    writeTask(root, bc, 'todo', { id, title: 'Walking skeleton', type: 'spike' });
    writeIndex(root, bc, {});
    const pPath = protocolPath(root);
    mkdirSync(path.dirname(pPath), { recursive: true });
    const originalProtocol = '# Protocol\n\nUnrelated content.\n\n---\n\nold entry\n';
    writeFileSync(pPath, originalProtocol);

    const res = captureTask(root, id, { context: bc, protocolEntry: false });
    assert.equal(res.ok, true);
    assert.equal(res.changed.includes(pPath), false);
    assert.equal(readFileSync(pPath, 'utf8'), originalProtocol);
  } finally {
    cleanup(root);
  }
});

test('captureTask requires source/summary when a protocol entry is being written', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-903';
    writeTask(root, bc, 'backlog', { id, title: 'x' });
    writeIndex(root, bc, {});

    const noSource = captureTask(root, id, { summary: 's' });
    assert.equal(noSource.ok, false);
    assert.equal(noSource.code, 'invalid-source');

    const noSummary = captureTask(root, id, { source: 'modeling' });
    assert.equal(noSummary.ok, false);
    assert.equal(noSummary.code, 'missing-summary');
  } finally {
    cleanup(root);
  }
});

test('captureTask compute-then-write: a marker-mismatched INDEX.md rejects with nothing written (atomicity)', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-904';
    writeTask(root, bc, 'backlog', { id, title: 'x' });
    const idxP = indexPath(root, bc);
    const broken = '# Broken index, no task-counts markers\n\n### Backlog\n<!-- backlog-list:start -->\n<!-- backlog-list:end -->\n';
    writeFileSync(idxP, broken);
    const pPath = protocolPath(root);

    const res = captureTask(root, id, { context: bc, source: 'modeling', summary: 's' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.equal(readFileSync(idxP, 'utf8'), broken);
    assert.equal(existsSync(pPath), false);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// dismissTask — plan
// ---------------------------------------------------------------------------

test('dismissTask plan: a lone task with no dependents plans a single-member cascade with zero writes', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const id = 'agentic-workflow-lone1';
    writeTask(root, bc, 'backlog', { id, title: 'Lonely' });
    const idxP = writeIndex(root, bc, { backlogLines: [`- **${id}** — Lonely (feature) — \`backlog/${id}-slug.md\``], counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 } });
    const before = readFileSync(idxP, 'utf8');

    const res = dismissTask(root, id, { plan: true });
    assert.equal(res.ok, true);
    assert.deepEqual(res.cascade, { leadId: id, memberIds: [id] });
    assert.deepEqual(res.advisories, []);
    assert.equal(res.members.length, 1);
    assert.equal(existsSync(path.join(bcDir(root, bc), 'backlog', `${id}-slug.md`)), true);
    assert.equal(readFileSync(idxP, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('dismissTask plan: cascades a transitive depends_on chain', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-chnA', title: 'A' });
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-chnB', title: 'B', dependsOn: ['agentic-workflow-chnA'] });
    writeTask(root, bc, 'todo', { id: 'agentic-workflow-chnC', title: 'C', dependsOn: ['agentic-workflow-chnB'] });
    writeIndex(root, bc, {});

    const res = dismissTask(root, 'agentic-workflow-chnA', { plan: true });
    assert.equal(res.ok, true);
    assert.deepEqual(res.cascade.memberIds, ['agentic-workflow-chnA', 'agentic-workflow-chnB', 'agentic-workflow-chnC'].sort());
  } finally {
    cleanup(root);
  }
});

test('dismissTask plan: refuses in-flight-or-shipped when a dependent is in doing/', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-infA', title: 'A' });
    writeTask(root, bc, 'doing', { id: 'agentic-workflow-infB', title: 'B', dependsOn: ['agentic-workflow-infA'] });
    writeIndex(root, bc, {});

    const res = dismissTask(root, 'agentic-workflow-infA', { plan: true });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'in-flight-or-shipped');
    assert.match(res.reason, /agentic-workflow-infB/);
  } finally {
    cleanup(root);
  }
});

test('dismissTask plan: a blocks-only asymmetric edge is an advisory, not a cascade member, and the near-miss id reference is a dangling-reference advisory (design-system-001 vs -001-styleguide regression)', () => {
  const root = makeProjectRoot();
  const dsBc = 'design-system';
  const awBc = 'agentic-workflow';
  try {
    ensureFolders(root, dsBc);
    ensureFolders(root, awBc);
    // The lead lists `blocks` at a survivor, but the survivor's `depends_on`
    // does NOT reciprocally name the lead (the live asymmetry this task's ADR
    // amendment addresses).
    writeTask(root, dsBc, 'backlog', { id: 'design-system-001', title: 'Styleguide', blocks: ['agentic-workflow-001'] });
    writeTask(root, awBc, 'backlog', { id: 'agentic-workflow-001', title: 'Frontend task' });
    // A THIRD task references the lead by a near-miss, non-exact id (the live
    // design-system-001-styleguide vs design-system-001 mismatch).
    writeTask(root, awBc, 'backlog', { id: 'agentic-workflow-002', title: 'Depends on styleguide by wrong id', dependsOn: ['design-system-001-styleguide'] });
    writeIndex(root, dsBc, {});
    writeIndex(root, awBc, {});

    const res = dismissTask(root, 'design-system-001', { plan: true });
    assert.equal(res.ok, true);
    // Only the lead is cascaded — neither the blocks-only survivor nor the
    // near-miss referrer are pulled in.
    assert.deepEqual(res.cascade.memberIds, ['design-system-001']);
    assert.ok(res.advisories.some((a) => a.type === 'blocks-only' && a.from === 'design-system-001' && a.to === 'agentic-workflow-001'));
    assert.ok(res.advisories.some((a) => a.type === 'dangling-reference' && a.from === 'agentic-workflow-002' && a.to === 'design-system-001-styleguide'));
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// dismissTask — confirm
// ---------------------------------------------------------------------------

test('dismissTask confirm: deletes the cascade, edits INDEX (strict removal-derived delta), and prepends one protocol entry', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const leadPath = writeTask(root, bc, 'backlog', { id: 'agentic-workflow-cfmA', title: 'A' });
    const depPath = writeTask(root, bc, 'todo', { id: 'agentic-workflow-cfmB', title: 'B', dependsOn: ['agentic-workflow-cfmA'] });
    // INDEX already has a line for A, but NOT for B (a pre-existing desync) —
    // the strict removal count must not falsely assume both lines existed.
    const idxP = writeIndex(root, bc, {
      backlogLines: [`- **agentic-workflow-cfmA** — A (feature) — \`backlog/agentic-workflow-cfmA-slug.md\``],
      counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
    });

    const plan = dismissTask(root, 'agentic-workflow-cfmA', { plan: true });
    assert.equal(plan.ok, true);

    const res = dismissTask(root, 'agentic-workflow-cfmA', { confirm: plan.cascade.memberIds, now: new Date(2026, 8, 6, 12, 0) });
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'dismiss');
    assert.deepEqual(res.memberIds.sort(), ['agentic-workflow-cfmA', 'agentic-workflow-cfmB']);

    assert.equal(existsSync(leadPath), false);
    assert.equal(existsSync(depPath), false);

    const indexContent = readFileSync(idxP, 'utf8');
    // Backlog line for A actually existed and was removed -> Backlog -1.
    assert.match(indexContent, /\*\*Backlog:\*\* 0/);
    // Todo never had a line for B (desync) -> strict count stays at 0, not -1.
    assert.match(indexContent, /\*\*Todo:\*\* 0/);
    assert.doesNotMatch(indexContent, /agentic-workflow-cfmA/);

    const protocolContent = readFileSync(protocolPath(root), 'utf8');
    assert.match(protocolContent, /Modeling \/ Dismissed: agentic-workflow-cfmA, agentic-workflow-cfmB/);
    assert.match(protocolContent, /\*\*Type:\*\* Modeling \/ Dismiss/);
    assert.match(protocolContent, /- agentic-workflow-cfmA - A \(agentic-workflow\)/);
    assert.match(protocolContent, /- agentic-workflow-cfmB - B \(agentic-workflow\)/);

    assert.ok(res.changed.includes(idxP));
    assert.ok(res.changed.includes(leadPath));
    assert.ok(res.changed.includes(depPath));
    assert.ok(res.changed.includes(protocolPath(root)));
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: a cross-BC cascade edits both BCs\' INDEX.md', () => {
  const root = makeProjectRoot();
  const bcA = 'agentic-workflow';
  const bcB = 'design-system';
  try {
    ensureFolders(root, bcA);
    ensureFolders(root, bcB);
    writeTask(root, bcA, 'backlog', { id: 'agentic-workflow-xbcA', title: 'Lead' });
    writeTask(root, bcB, 'backlog', { id: 'design-system-xbcB', title: 'Dependent', dependsOn: ['agentic-workflow-xbcA'] });
    const idxA = writeIndex(root, bcA, {
      backlogLines: [`- **agentic-workflow-xbcA** — Lead (feature) — \`backlog/agentic-workflow-xbcA-slug.md\``],
      counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
    });
    const idxB = writeIndex(root, bcB, {
      backlogLines: [`- **design-system-xbcB** — Dependent (feature) — \`backlog/design-system-xbcB-slug.md\``],
      counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
    });

    const plan = dismissTask(root, 'agentic-workflow-xbcA', { plan: true });
    const res = dismissTask(root, 'agentic-workflow-xbcA', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, true);
    assert.ok(res.changed.includes(idxA));
    assert.ok(res.changed.includes(idxB));
    assert.doesNotMatch(readFileSync(idxA, 'utf8'), /agentic-workflow-xbcA/);
    assert.doesNotMatch(readFileSync(idxB, 'utf8'), /design-system-xbcB/);
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: strips surviving backlinks (depends_on/blocks/prior_art) for exactly the confirmed set, leaving an unrelated dangling reference alone', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-strpA', title: 'A' });
    const survivorPath = writeTask(root, bc, 'backlog', {
      id: 'agentic-workflow-strpS',
      title: 'Survivor',
      // The `blocks` edge is asymmetric (S doesn't depend_on A) so S is never
      // cascaded, but it must still be stripped — blocks IS a stripped field.
      priorArt: ['agentic-workflow-strpA', 'agentic-workflow-unrelated-999'],
      // no depends_on on A: kept purely a blocks reference here
    });
    // manually inject a blocks reference too (writeTask's helper doesn't take a
    // reverse-edge shape naturally — edit the file directly).
    writeFileSync(survivorPath, readFileSync(survivorPath, 'utf8').replace('blocks: []', 'blocks: [agentic-workflow-strpA]'));
    writeIndex(root, bc, {});

    const plan = dismissTask(root, 'agentic-workflow-strpA', { plan: true });
    assert.deepEqual(plan.cascade.memberIds, ['agentic-workflow-strpA']);

    const res = dismissTask(root, 'agentic-workflow-strpA', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, true);

    const survivorContent = readFileSync(survivorPath, 'utf8');
    assert.match(survivorContent, /^blocks: \[\]$/m);
    assert.match(survivorContent, /^prior_art: \[agentic-workflow-unrelated-999\]$/m);
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: strips a dismissed id from an ADR\'s related_tasks', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-adrA', title: 'A' });
    writeIndex(root, bc, {});
    const decisionsDir = path.join(root, '.agentheim', 'knowledge', 'decisions');
    mkdirSync(decisionsDir, { recursive: true });
    const adrPath = path.join(decisionsDir, '0099-example.md');
    writeFileSync(adrPath, `---\nid: ADR-0099\ntitle: Example\nrelated_tasks: [agentic-workflow-adrA, agentic-workflow-other]\n---\n\nBody.\n`);

    const plan = dismissTask(root, 'agentic-workflow-adrA', { plan: true });
    const res = dismissTask(root, 'agentic-workflow-adrA', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, true);
    assert.ok(res.changed.includes(adrPath));
    const adrContent = readFileSync(adrPath, 'utf8');
    assert.match(adrContent, /^related_tasks: \[agentic-workflow-other\]$/m);
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: rejects cascade-drifted when membership grew since planning', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-drftA', title: 'A' });
    writeIndex(root, bc, {});

    const plan = dismissTask(root, 'agentic-workflow-drftA', { plan: true });
    assert.deepEqual(plan.cascade.memberIds, ['agentic-workflow-drftA']);

    // A new dependent appears after planning, before confirm.
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-drftB', title: 'B', dependsOn: ['agentic-workflow-drftA'] });

    const res = dismissTask(root, 'agentic-workflow-drftA', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'cascade-drifted');
    assert.equal(existsSync(path.join(bcDir(root, bc), 'backlog', 'agentic-workflow-drftA-slug.md')), true);
    assert.equal(existsSync(path.join(bcDir(root, bc), 'backlog', 'agentic-workflow-drftB-slug.md')), true);
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: rejects cascade-in-flight when membership is unchanged but a member moved to doing/', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    writeTask(root, bc, 'backlog', { id: 'agentic-workflow-iflA', title: 'A' });
    writeTask(root, bc, 'todo', { id: 'agentic-workflow-iflB', title: 'B', dependsOn: ['agentic-workflow-iflA'] });
    writeIndex(root, bc, {});

    const plan = dismissTask(root, 'agentic-workflow-iflA', { plan: true });
    assert.equal(plan.ok, true);

    // B moves todo -> doing between plan and confirm (membership unchanged).
    const doingPath = path.join(bcDir(root, bc), 'doing', 'agentic-workflow-iflB-slug.md');
    mkdirSync(path.dirname(doingPath), { recursive: true });
    writeFileSync(doingPath, taskContent({ id: 'agentic-workflow-iflB', title: 'B', status: 'doing', context: bc, dependsOn: ['agentic-workflow-iflA'] }));
    rmSync(path.join(bcDir(root, bc), 'todo', 'agentic-workflow-iflB-slug.md'));

    const res = dismissTask(root, 'agentic-workflow-iflA', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'cascade-in-flight');
  } finally {
    cleanup(root);
  }
});

test('dismissTask confirm: compute-then-write — a marker-mismatched INDEX.md rejects with nothing deleted or written', () => {
  const root = makeProjectRoot();
  const bc = 'agentic-workflow';
  try {
    ensureFolders(root, bc);
    const leadPath = writeTask(root, bc, 'backlog', { id: 'agentic-workflow-atmB', title: 'A' });
    const broken = '# Broken index\n\n### Backlog\n<!-- backlog-list:start -->\n<!-- backlog-list:end -->\n';
    writeFileSync(indexPath(root, bc), broken);

    const plan = dismissTask(root, 'agentic-workflow-atmB', { plan: true });
    assert.equal(plan.ok, true);

    const res = dismissTask(root, 'agentic-workflow-atmB', { confirm: plan.cascade.memberIds });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'bookkeeping-marker-mismatch');
    assert.equal(existsSync(leadPath), true);
    assert.equal(readFileSync(indexPath(root, bc), 'utf8'), broken);
    assert.equal(existsSync(protocolPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('dismissTask requires plan or confirm', () => {
  const root = makeProjectRoot();
  try {
    const res = dismissTask(root, 'whatever-00001', {});
    assert.equal(res.ok, false);
    assert.equal(res.code, 'missing-mode');
  } finally {
    cleanup(root);
  }
});
