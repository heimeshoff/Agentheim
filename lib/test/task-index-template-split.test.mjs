// Covers agentic-workflow-cj54k's deliverable 3 (the two-template split),
// reshaped by agentic-workflow-g5ez5 once the legacy combined template file
// (the one this task deleted from `references/`) was retired:
//
//   - `references/task-index-template.md` (task half) union
//     `references/knowledge-index-template.md` (knowledge half) carries
//     EXACTLY the literal 8-marker Per-BC set: task-counts / todo-list /
//     doing-list / done-list / backlog-list / adr-local / research-local /
//     concepts.
//   - `captureTask`'s empty-BC backfill renders the task-half template,
//     byte-for-byte, via the exported `renderIndexTemplate(context)` (no
//     `layout` argument — a DETECTED legacy tree is refused upstream).

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

// --- deliverable 3: marker-set split ----------------------------------------

test('task-index-template.md union knowledge-index-template.md carries exactly the literal 8-marker Per-BC set', () => {
  const taskRaw = readFileSync(path.join(REFERENCES_DIR, 'task-index-template.md'), 'utf8');
  const knowledgeRaw = readFileSync(path.join(REFERENCES_DIR, 'knowledge-index-template.md'), 'utf8');

  const taskMarkers = markerNames(taskRaw);
  const knowledgeMarkers = markerNames(knowledgeRaw);

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

test('renderIndexTemplate(context) body carries only the five task-status markers', () => {
  const body = renderIndexTemplate('widgets');
  assert.deepEqual(
    markerNames(body),
    new Set(['task-counts', 'todo-list', 'doing-list', 'done-list', 'backlog-list'])
  );
  assert.match(body, /# Widgets — Index/);
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
    let expected = renderIndexTemplate(bc);
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

// --- legacy refusal (agentic-workflow-g5ez5, ADR-0078 §5 2nd phase) --------
// captureTask on a DETECTED legacy tree is refused before any backfill is
// attempted -- the legacy-fixture backfill case (renderIndexTemplate's now-
// deleted `layout` argument) is dropped; this replaces it.

test('captureTask on a detected legacy-layout fixture is refused with legacy-layout, nothing backfilled', () => {
  const root = makeProjectRoot('aw-capdis-legacy-');
  const bc = 'widgets';
  try {
    for (const folder of ['backlog', 'todo', 'doing', 'done']) {
      mkdirSync(path.join(root, '.agentheim', 'contexts', bc, folder), { recursive: true });
    }
    const id = 'widgets-gr3sh';
    writeFileSync(path.join(root, '.agentheim', 'contexts', bc, 'backlog', `${id}-slug.md`), taskContent(id, bc));

    const res = captureTask(root, id, { context: bc, protocolEntry: false });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'legacy-layout');
    assert.equal(existsSync(path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md')), false);
  } finally {
    cleanup(root);
  }
});
