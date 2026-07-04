// CRLF / BOM / mixed-EOL coverage for the task-lifecycle bookkeeping helpers
// (infrastructure-5w5gs). See lib/task-lifecycle.mjs's EOL/BOM boundary-
// normalization block for the design: detect the file's dominant EOL + a
// leading BOM on read, canonicalize to `\n` in-memory, run the unchanged
// marker logic, restore the original EOL/BOM on write.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  detectDominantEol,
  normalizeText,
  denormalizeText,
  removeIndexLine,
  insertIndexLineAtTop,
  prependProtocolEntry,
  promoteTask,
  claimBatch,
  completeTask,
} from '../task-lifecycle.mjs';

const BC = 'agentic-workflow';
const FOLDERS = ['backlog', 'todo', 'doing', 'done'];
const BOM = '﻿';

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** Every `\n` in `text` is part of a `\r\n` pair — i.e. no lone LF remains. */
function isAllCrlf(text) {
  return !/(?<!\r)\n/.test(text);
}

/** No `\r\n` appears anywhere — i.e. no CRLF sneaked into an LF file. */
function isAllLf(text) {
  return !text.includes('\r\n');
}

// --- detectDominantEol / normalizeText / denormalizeText -------------------

test('detectDominantEol picks CRLF when it is the majority style', () => {
  const text = 'a\r\nb\r\nc\r\nd\r\ne\r\nf\n'; // 5 CRLF, 1 lone LF
  assert.equal(detectDominantEol(text), '\r\n');
});

test('detectDominantEol picks LF when it is the majority style', () => {
  const text = 'a\nb\nc\nd\ne\nf\r\n'; // 5 lone LF, 1 CRLF
  assert.equal(detectDominantEol(text), '\n');
});

test('detectDominantEol defaults to LF when there are no newlines at all', () => {
  assert.equal(detectDominantEol('no newlines here'), '\n');
});

test('normalizeText/denormalizeText round-trip a CRLF file with a BOM, byte for byte', () => {
  const raw = BOM + 'line one\r\nline two\r\nline three\r\n';
  const { content, eol, bom } = normalizeText(raw);
  assert.equal(bom, true);
  assert.equal(eol, '\r\n');
  assert.equal(content, 'line one\nline two\nline three\n'); // canonical form: BOM stripped, LF only
  assert.equal(denormalizeText({ content, eol, bom }), raw);
});

test('normalizeText/denormalizeText round-trip a plain LF file unchanged (no BOM, no CRLF)', () => {
  const raw = 'line one\nline two\n';
  const { content, eol, bom } = normalizeText(raw);
  assert.equal(bom, false);
  assert.equal(eol, '\n');
  assert.equal(content, raw);
  assert.equal(denormalizeText({ content, eol, bom }), raw);
});

// --- removeIndexLine / insertIndexLineAtTop / prependProtocolEntry, exercised
// through a full normalize -> edit -> denormalize round trip on CRLF and
// BOM+CRLF fixtures. ---------------------------------------------------------

function crlfIndexFixture() {
  return (
    '<!-- todo-list:start -->\r\n' +
    '- **agentic-workflow-900** — First (feature) — `todo/agentic-workflow-900.md`\r\n' +
    '- **agentic-workflow-901** — Second (feature) — `todo/agentic-workflow-901.md`\r\n' +
    '<!-- todo-list:end -->\r\n'
  );
}

test('removeIndexLine on a CRLF fixture removes only the named line and the round trip stays pure CRLF', () => {
  const { content, eol, bom } = normalizeText(crlfIndexFixture());
  const edited = removeIndexLine(content, 'todo-list', 'agentic-workflow-900');
  assert.doesNotMatch(edited, /agentic-workflow-900/);
  assert.match(edited, /agentic-workflow-901/);
  const written = denormalizeText({ content: edited, eol, bom });
  assert.ok(isAllCrlf(written), `expected pure CRLF, got: ${JSON.stringify(written)}`);
});

test('insertIndexLineAtTop on a CRLF fixture inserts the fresh line as CRLF too (no mixed endings)', () => {
  const { content, eol, bom } = normalizeText(crlfIndexFixture());
  const edited = insertIndexLineAtTop(
    content,
    'todo-list',
    '- **agentic-workflow-902** — Third (feature) — `todo/agentic-workflow-902.md`'
  );
  const written = denormalizeText({ content: edited, eol, bom });
  assert.ok(isAllCrlf(written), `expected pure CRLF including the freshly-inserted line, got: ${JSON.stringify(written)}`);
  // freshly inserted line is now first
  const lines = written.split('\r\n');
  assert.match(lines[1], /agentic-workflow-902/);
});

function crlfProtocolFixture() {
  return (
    '# Protocol\r\n\r\n' +
    'Chronological log.\r\n\r\n' +
    '---\r\n\r\n' +
    '## 2026-07-01 09:00 -- Older entry\r\n\r\n' +
    '**Type:** Work / Task completion\r\n\r\n' +
    '---\r\n\r\n'
  );
}

test('prependProtocolEntry on a CRLF fixture inserts a CRLF entry above the older one, no mixed endings', () => {
  const { content, eol, bom } = normalizeText(crlfProtocolFixture());
  const entryBody = '## 2026-07-03 10:00 -- New entry\n\n**Type:** Work / Task completion';
  const edited = prependProtocolEntry(content, entryBody);
  const written = denormalizeText({ content: edited, eol, bom });
  assert.ok(isAllCrlf(written), `expected pure CRLF including the freshly-inserted entry, got: ${JSON.stringify(written)}`);
  const newIdx = written.indexOf('New entry');
  const oldIdx = written.indexOf('Older entry');
  assert.ok(newIdx > -1 && oldIdx > -1 && newIdx < oldIdx);
});

test('a BOM-prefixed CRLF INDEX.md round-trips with the BOM preserved exactly once (not doubled, not dropped)', () => {
  const raw = BOM + crlfIndexFixture();
  const { content, eol, bom } = normalizeText(raw);
  const edited = removeIndexLine(content, 'todo-list', 'agentic-workflow-900');
  const written = denormalizeText({ content: edited, eol, bom });
  assert.equal(written.indexOf(BOM), 0);
  assert.equal(written.lastIndexOf(BOM), 0); // exactly one BOM, at the start
  assert.ok(isAllCrlf(written.slice(BOM.length)));
});

test('an already-mixed-EOL fixture (residue of a prior half-broken run) normalizes to its dominant EOL', () => {
  // 4 CRLF lines, 1 lone-LF line — CRLF is the majority.
  const raw =
    '<!-- todo-list:start -->\r\n' +
    '- **agentic-workflow-910** — A (feature) — `todo/x.md`\r\n' +
    '- **agentic-workflow-911** — B (feature) — `todo/y.md`\n' + // residue: lone LF
    '- **agentic-workflow-912** — C (feature) — `todo/z.md`\r\n' +
    '<!-- todo-list:end -->\r\n';
  const { content, eol, bom } = normalizeText(raw);
  assert.equal(eol, '\r\n');
  const edited = insertIndexLineAtTop(content, 'todo-list', '- **agentic-workflow-913** — D (feature) — `todo/w.md`');
  const written = denormalizeText({ content: edited, eol, bom });
  assert.ok(isAllCrlf(written), `expected the mixed file to normalize fully to CRLF, got: ${JSON.stringify(written)}`);
});

// --- end-to-end: promoteTask / claimBatch / completeTask on CRLF fixtures ---

function crlf(text) {
  return text.replace(/\n/g, '\r\n');
}

function makeIndexMdLf({
  backlogLines = [],
  todoLines = [],
  doingLines = [],
  counts = { Backlog: 0, Todo: 0, Doing: 0, Done: 0 },
} = {}) {
  return `# Agentic Workflow — Index

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
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
<!-- adr-local:end -->
`;
}

const CRLF_PROTOCOL_HEADER = crlf(
  '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n'
);

/** Build a promoteTask-ready project, with INDEX.md and protocol.md written as CRLF. */
function makePromoteProjectCrlf({ id, title = 'A promotable task', type = 'feature', bomIndex = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-promote-crlf-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  writeFileSync(
    path.join(bcDir, 'backlog', fileName),
    // task file itself stays LF — only INDEX.md/protocol.md are CRLF in this bug.
    `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: ${type}\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  const indexPath = path.join(bcDir, 'INDEX.md');
  const indexLf = makeIndexMdLf({
    backlogLines: [`- **${id}** — ${title} (${type}) — \`backlog/${fileName}\``],
    counts: { Backlog: 1, Todo: 0, Doing: 0, Done: 0 },
  });
  writeFileSync(indexPath, (bomIndex ? BOM : '') + crlf(indexLf));
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  writeFileSync(protocolPath, CRLF_PROTOCOL_HEADER);
  return { root, bcDir, indexPath, protocolPath, fileName };
}

test('promoteTask completes fully against a CRLF INDEX.md + CRLF protocol.md: no throw, no partial state, files stay CRLF', () => {
  const id = 'agentic-workflow-950';
  const title = 'A promotable task';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProjectCrlf({ id, title });
  const now = new Date(2026, 6, 4, 9, 0);
  try {
    const res = promoteTask(root, id, { context: BC, now });
    assert.equal(res.ok, true);
    assert.equal(res.verb, 'promote');

    const taskPath = path.join(bcDir, 'todo', fileName);
    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), false);
    assert.equal(existsSync(taskPath), true);

    const indexContent = readFileSync(indexPath, 'utf8');
    assert.doesNotMatch(indexContent, new RegExp(`backlog-list:start[\\s\\S]*\\*\\*${id}\\*\\*`));
    assert.match(indexContent, new RegExp(`todo-list:start -->\\r\\n- \\*\\*${id}\\*\\*`));
    assert.match(indexContent, /\*\*Backlog:\*\* 0/);
    assert.match(indexContent, /\*\*Todo:\*\* 1/);
    assert.ok(isAllCrlf(indexContent), 'INDEX.md must stay pure CRLF, including the freshly-inserted line');

    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.match(protocolContent, new RegExp(`Modeling / Promoted: ${id}`));
    assert.ok(isAllCrlf(protocolContent), 'protocol.md must stay pure CRLF, including the freshly-inserted entry');
  } finally {
    cleanup(root);
  }
});

test('promoteTask preserves a leading BOM on a CRLF INDEX.md (not doubled, not dropped)', () => {
  const id = 'agentic-workflow-951';
  const { root, indexPath } = makePromoteProjectCrlf({ id, bomIndex: true });
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, true);
    const indexContent = readFileSync(indexPath, 'utf8');
    assert.equal(indexContent.indexOf(BOM), 0);
    assert.equal(indexContent.lastIndexOf(BOM), 0);
  } finally {
    cleanup(root);
  }
});

test('promoteTask is fail-closed on a deliberately marker-broken CRLF INDEX.md: rejects, nothing moved, no writes', () => {
  const id = 'agentic-workflow-952';
  const { root, bcDir, indexPath, protocolPath, fileName } = makePromoteProjectCrlf({ id });
  // Corrupt the todo-list start marker so insertIndexLineAtTop cannot find it.
  const broken = readFileSync(indexPath, 'utf8').replace('<!-- todo-list:start -->', '<!-- todo-liZt:start -->');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolBefore = readFileSync(protocolPath, 'utf8');
  try {
    const res = promoteTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.match(res.reason, /todo-list/i);

    // task file was NOT moved
    assert.equal(existsSync(path.join(bcDir, 'backlog', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), false);
    // no writes at all
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(readFileSync(protocolPath, 'utf8'), protocolBefore);
  } finally {
    cleanup(root);
  }
});

/** Build a claimBatch-ready project across BCs, each with its own EOL style. */
function makeClaimProjectMixedEol({ tasks }) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-claim-eol-'));
  const byBc = new Map();
  for (const t of tasks) {
    const bc = t.context ?? BC;
    if (!byBc.has(bc)) byBc.set(bc, []);
    byBc.get(bc).push(t);
  }
  const paths = {};
  for (const [bc, bcTasks] of byBc) {
    const bcDir = path.join(root, '.agentheim', 'contexts', bc);
    for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
    const todoLines = [];
    for (const t of bcTasks) {
      const fileName = `${t.id}-a-slug.md`;
      writeFileSync(
        path.join(bcDir, 'todo', fileName),
        `---\nid: ${t.id}\ntitle: ${t.title}\nstatus: todo\ntype: feature\ncontext: ${bc}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
      );
      todoLines.push(`- **${t.id}** — ${t.title} (feature) — \`todo/${fileName}\``);
      paths[t.id] = { bcDir, fileName };
    }
    const indexPath = path.join(bcDir, 'INDEX.md');
    const lf = makeIndexMdLf({ todoLines, counts: { Backlog: 0, Todo: bcTasks.length, Doing: 0, Done: 0 } });
    const useCrlf = bcTasks[0].eol === 'crlf';
    writeFileSync(indexPath, useCrlf ? crlf(lf) : lf);
    paths[`__index_${bc}`] = indexPath;
  }
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  writeFileSync(protocolPath, CRLF_PROTOCOL_HEADER);
  return { root, paths, protocolPath };
}

test('claimBatch on a CRLF fixture moves the task, edits INDEX + protocol, and both stay pure CRLF', () => {
  const id = 'agentic-workflow-960';
  const { root, paths, protocolPath } = makeClaimProjectMixedEol({ tasks: [{ id, title: 'A claimable task', eol: 'crlf' }] });
  try {
    const res = claimBatch(root, [id], { now: new Date(2026, 6, 4, 9, 0) });
    assert.equal(res.ok, true);
    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);

    const indexContent = readFileSync(paths[`__index_${BC}`], 'utf8');
    assert.ok(isAllCrlf(indexContent));
    assert.match(indexContent, new RegExp(`doing-list:start -->\\r\\n- \\*\\*${id}\\*\\*`));

    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.ok(isAllCrlf(protocolContent));
    assert.match(protocolContent, /Batch started/);
  } finally {
    cleanup(root);
  }
});

test('claimBatch spanning two BCs preserves each BC INDEX.md\'s own EOL style independently (CRLF and LF)', () => {
  const idA = 'agentic-workflow-961'; // CRLF context
  const idB = 'design-system-961'; // LF context
  const { root, paths } = makeClaimProjectMixedEol({
    tasks: [
      { id: idA, title: 'AW task', context: BC, eol: 'crlf' },
      { id: idB, title: 'DS task', context: 'design-system', eol: 'lf' },
    ],
  });
  try {
    const res = claimBatch(root, [idA, idB], { now: new Date(2026, 6, 4, 9, 15) });
    assert.equal(res.ok, true);

    const awIndex = readFileSync(paths[`__index_${BC}`], 'utf8');
    const dsIndex = readFileSync(paths['__index_design-system'], 'utf8');
    assert.ok(isAllCrlf(awIndex), 'the CRLF BC index must stay pure CRLF');
    assert.ok(isAllLf(dsIndex), 'the LF BC index must stay pure LF (no CRLF regression)');
  } finally {
    cleanup(root);
  }
});

test('claimBatch is fail-closed on a marker-broken CRLF INDEX.md: rejects, nothing moved, no writes (any BC)', () => {
  const id = 'agentic-workflow-962';
  const { root, paths } = makeClaimProjectMixedEol({ tasks: [{ id, title: 'A claimable task', eol: 'crlf' }] });
  const indexPath = paths[`__index_${BC}`];
  const broken = readFileSync(indexPath, 'utf8').replace('doing-list:start', 'doing-liZt:start');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  try {
    const res = claimBatch(root, [id]);
    assert.equal(res.ok, false);
    assert.match(res.reason, /doing-list/i);

    const { bcDir, fileName } = paths[id];
    assert.equal(existsSync(path.join(bcDir, 'todo', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
  } finally {
    cleanup(root);
  }
});

/** Build a completeTask-ready project with a CRLF INDEX.md + CRLF protocol.md. */
function makeCompleteProjectCrlf({ id, title = 'A completable task', startFolder = 'doing' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-complete-crlf-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', BC);
  for (const f of FOLDERS) mkdirSync(path.join(bcDir, f), { recursive: true });
  const fileName = `${id}-a-slug.md`;
  const status = startFolder === 'done' ? 'done' : 'doing';
  writeFileSync(
    path.join(bcDir, startFolder, fileName),
    `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\ntype: feature\ncontext: ${BC}\ncreated: 2026-07-01\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`
  );
  const indexPath = path.join(bcDir, 'INDEX.md');
  const lf = makeIndexMdLf({
    doingLines: [`- **${id}** — ${title} (feature) — \`doing/${fileName}\``],
    counts: { Backlog: 0, Todo: 0, Doing: 1, Done: 0 },
  });
  writeFileSync(indexPath, crlf(lf));
  const protocolDir = path.join(root, '.agentheim', 'knowledge');
  mkdirSync(protocolDir, { recursive: true });
  const protocolPath = path.join(protocolDir, 'protocol.md');
  writeFileSync(protocolPath, CRLF_PROTOCOL_HEADER);
  return { root, bcDir, indexPath, protocolPath, fileName };
}

test('completeTask on a CRLF fixture moves doing -> done, edits INDEX + protocol, and both stay pure CRLF', () => {
  const id = 'agentic-workflow-970';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProjectCrlf({ id });
  try {
    const res = completeTask(root, id, { context: BC, now: new Date(2026, 6, 4, 10, 0), summary: 'Done', verification: 'PASS (iteration 1)' });
    assert.equal(res.ok, true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), true);

    const indexContent = readFileSync(indexPath, 'utf8');
    assert.ok(isAllCrlf(indexContent));
    assert.match(indexContent, new RegExp(`done-list:start -->\\r\\n- \\*\\*${id}\\*\\*`));

    const protocolContent = readFileSync(protocolPath, 'utf8');
    assert.ok(isAllCrlf(protocolContent));
  } finally {
    cleanup(root);
  }
});

test('completeTask idempotent path (already in done/) still works against a CRLF INDEX.md/protocol.md', () => {
  const id = 'agentic-workflow-971';
  const { root, bcDir, indexPath, fileName } = makeCompleteProjectCrlf({ id, startFolder: 'done' });
  try {
    const res = completeTask(root, id, { context: BC, summary: 'Already done', verification: 'PASS (iteration 1)' });
    assert.equal(res.ok, true);
    assert.equal(res.idempotent, true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), true);
    const indexContent = readFileSync(indexPath, 'utf8');
    assert.ok(isAllCrlf(indexContent));
    assert.match(indexContent, /\*\*Done:\*\* 1/);
  } finally {
    cleanup(root);
  }
});

test('completeTask is fail-closed on a marker-broken CRLF INDEX.md: rejects, nothing moved, no writes', () => {
  const id = 'agentic-workflow-972';
  const { root, bcDir, indexPath, protocolPath, fileName } = makeCompleteProjectCrlf({ id });
  const broken = readFileSync(indexPath, 'utf8').replace('done-list:start', 'done-liZt:start');
  writeFileSync(indexPath, broken);
  const indexBefore = readFileSync(indexPath, 'utf8');
  const protocolBefore = readFileSync(protocolPath, 'utf8');
  try {
    const res = completeTask(root, id, { context: BC });
    assert.equal(res.ok, false);
    assert.match(res.reason, /done-list/i);

    assert.equal(existsSync(path.join(bcDir, 'doing', fileName)), true);
    assert.equal(existsSync(path.join(bcDir, 'done', fileName)), false);
    assert.equal(readFileSync(indexPath, 'utf8'), indexBefore);
    assert.equal(readFileSync(protocolPath, 'utf8'), protocolBefore);
  } finally {
    cleanup(root);
  }
});
