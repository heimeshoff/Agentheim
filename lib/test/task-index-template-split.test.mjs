// Covers agentic-workflow-cj54k's deliverable 3 (the two-template split) and
// the captureTask half of deliverable 2 (dual-layout empty-BC backfill):
//
//   - `references/task-index-template.md` (task half) union
//     `references/knowledge-index-template.md` (knowledge half) carries
//     EXACTLY today's Per-BC marker set: task-counts / todo-list /
//     doing-list / done-list / backlog-list / adr-local / research-local /
//     concepts — diffed against `references/index-template.md`'s LEGACY
//     combined-shape Per-BC section (kept verbatim there for the transition).
//   - `captureTask`'s empty-BC backfill selects the task-half template
//     under a `board`-layout fixture, and the combined template under a
//     `legacy`-layout fixture — byte-for-byte, via the exported
//     `renderIndexTemplate(context, layout)`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureTask, renderIndexTemplate } from '../task-lifecycle-capture-dismiss.mjs';

const REFERENCES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'references');

/** Extract the first fenced ```markdown block's content — marker scans must never see surrounding prose (which names markers as text, e.g. "the `<!-- name:start -->` markers" or "inserts under `<!-- adr-global:start -->`"). */
function firstFencedBlock(raw) {
  const fenceStart = raw.indexOf('```markdown');
  if (fenceStart === -1) return raw;
  const bodyStart = raw.indexOf('\n', fenceStart) + 1;
  const fenceEnd = raw.indexOf('```', bodyStart);
  return fenceEnd === -1 ? raw.slice(bodyStart) : raw.slice(bodyStart, fenceEnd);
}

function markerNames(content) {
  const fenced = firstFencedBlock(content);
  const names = new Set();
  const re = /<!--\s*([\w-]+):start\s*-->/g;
  let m;
  while ((m = re.exec(fenced))) names.add(m[1]);
  return names;
}

/** The LEGACY combined-shape Per-BC section's own fenced example (kept verbatim). */
function legacyPerBcFencedBody() {
  const raw = readFileSync(path.join(REFERENCES_DIR, 'index-template.md'), 'utf8');
  const marker = '## Per-BC (LEGACY combined shape):';
  const idx = raw.indexOf(marker);
  assert.ok(idx !== -1, 'index-template.md must still carry its LEGACY combined-shape Per-BC section');
  const after = raw.slice(idx);
  const fenceStart = after.indexOf('```markdown');
  const bodyStart = after.indexOf('\n', fenceStart) + 1;
  const fenceEnd = after.indexOf('```', bodyStart);
  return after.slice(bodyStart, fenceEnd);
}

// --- deliverable 3: marker-set split ----------------------------------------

test('task-index-template.md union knowledge-index-template.md carries exactly today\'s 8-marker Per-BC set', () => {
  const taskRaw = readFileSync(path.join(REFERENCES_DIR, 'task-index-template.md'), 'utf8');
  const knowledgeRaw = readFileSync(path.join(REFERENCES_DIR, 'knowledge-index-template.md'), 'utf8');
  const legacyRaw = legacyPerBcFencedBody();

  const taskMarkers = markerNames(taskRaw);
  const knowledgeMarkers = markerNames(knowledgeRaw);
  const legacyMarkers = markerNames(legacyRaw);

  const union = new Set([...taskMarkers, ...knowledgeMarkers]);
  const expected = new Set([
    'task-counts',
    'todo-list',
    'doing-list',
    'done-list',
    'backlog-list',
    'adr-local',
    'research-local',
    'concepts',
  ]);

  assert.deepEqual(union, expected);
  // Diffed against today's (LEGACY, kept-verbatim) Per-BC marker set: identical.
  assert.deepEqual(union, legacyMarkers);
  // Disjoint halves — no marker doubly claimed by both new templates.
  assert.deepEqual([...taskMarkers].filter((n) => knowledgeMarkers.has(n)), []);
});

test('task-index-template.md carries only the five task-status markers', () => {
  const taskRaw = readFileSync(path.join(REFERENCES_DIR, 'task-index-template.md'), 'utf8');
  assert.deepEqual(
    markerNames(taskRaw),
    new Set(['task-counts', 'todo-list', 'doing-list', 'done-list', 'backlog-list'])
  );
});

test('knowledge-index-template.md carries only the three knowledge markers', () => {
  const knowledgeRaw = readFileSync(path.join(REFERENCES_DIR, 'knowledge-index-template.md'), 'utf8');
  assert.deepEqual(markerNames(knowledgeRaw), new Set(['adr-local', 'research-local', 'concepts']));
});

// --- deliverable 2 (capture half): dual-layout empty-BC backfill -----------

function makeProjectRoot(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

function taskContent(id, bc) {
  return `---
id: ${id}
title: Fresh task
status: backlog
type: feature
context: ${bc}
created: 2026-09-06
completed:
depends_on: []
blocks: []
tags: []
related_adrs: []
related_research: []
prior_art: []
---

## Why

stuff
`;
}

test('renderIndexTemplate("board") body carries only the five task-status markers', () => {
  const body = renderIndexTemplate('widgets', 'board');
  assert.deepEqual(
    markerNames(body),
    new Set(['task-counts', 'todo-list', 'doing-list', 'done-list', 'backlog-list'])
  );
  assert.match(body, /# Widgets — Index/);
});

test('renderIndexTemplate("legacy") body carries all eight Per-BC markers', () => {
  const body = renderIndexTemplate('widgets', 'legacy');
  assert.deepEqual(
    markerNames(body),
    new Set(['task-counts', 'todo-list', 'doing-list', 'done-list', 'backlog-list', 'adr-local', 'research-local', 'concepts'])
  );
});

test('captureTask on a board-layout fixture backfills board/<bc>/INDEX.md from the task-half template, byte-for-byte', () => {
  const root = makeProjectRoot('aw-capdis-board-');
  const bc = 'widgets';
  try {
    mkdirSync(path.join(root, '.agentheim', 'board', bc, 'backlog'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', bc, 'todo'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', bc, 'doing'), { recursive: true });
    mkdirSync(path.join(root, '.agentheim', 'board', bc, 'done'), { recursive: true });
    const id = 'widgets-fr3sh';
    writeFileSync(path.join(root, '.agentheim', 'board', bc, 'backlog', `${id}-slug.md`), taskContent(id, bc));

    const res = captureTask(root, id, { context: bc, protocolEntry: false });
    assert.equal(res.ok, true, JSON.stringify(res));

    const indexFile = path.join(root, '.agentheim', 'board', bc, 'INDEX.md');
    assert.equal(existsSync(indexFile), true);
    const actual = readFileSync(indexFile, 'utf8');

    // Byte-for-byte: the ONLY diff from the raw template is the id's line
    // inserted under backlog-list and the Backlog count bumped to 1 — build
    // that exact expectation from the exported renderer directly.
    let expected = renderIndexTemplate(bc, 'board');
    expected = expected.replace(
      '<!-- backlog-list:start -->\n',
      `<!-- backlog-list:start -->\n- **${id}** — Fresh task (feature) — \`backlog/${id}-slug.md\`\n`
    );
    expected = expected.replace('**Backlog:** 0', '**Backlog:** 1');
    assert.equal(actual, expected);
  } finally {
    cleanup(root);
  }
});

test('captureTask on a legacy-layout fixture backfills contexts/<bc>/INDEX.md from the COMBINED template, byte-for-byte', () => {
  const root = makeProjectRoot('aw-capdis-legacy-');
  const bc = 'widgets';
  try {
    for (const folder of ['backlog', 'todo', 'doing', 'done']) {
      mkdirSync(path.join(root, '.agentheim', 'contexts', bc, folder), { recursive: true });
    }
    const id = 'widgets-gr3sh';
    writeFileSync(path.join(root, '.agentheim', 'contexts', bc, 'backlog', `${id}-slug.md`), taskContent(id, bc));

    const res = captureTask(root, id, { context: bc, protocolEntry: false });
    assert.equal(res.ok, true, JSON.stringify(res));

    const indexFile = path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md');
    assert.equal(existsSync(indexFile), true);
    const actual = readFileSync(indexFile, 'utf8');

    let expected = renderIndexTemplate(bc, 'legacy');
    expected = expected.replace(
      '<!-- backlog-list:start -->\n',
      `<!-- backlog-list:start -->\n- **${id}** — Fresh task (feature) — \`backlog/${id}-slug.md\`\n`
    );
    expected = expected.replace('**Backlog:** 0', '**Backlog:** 1');
    assert.equal(actual, expected);
  } finally {
    cleanup(root);
  }
});
