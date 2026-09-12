// End-state proof (agentic-workflow-g5ez5, What item 4 / acceptance criterion
// #4): a fresh project — driven the way `brainstorm` + `capture` create one —
// lands EXACTLY the two-root shape ADR-0078 §1 describes, with `detectLayout`
// reporting `'board'` at every step, including the moment only
// `knowledge/vision.md` exists (ADR-0078 §5's own definition: a neither-root
// tree is `'board'`, not a third "still legacy" state). No write ENOENTs on
// the not-yet-existing `board/` — `materializeTaskFile`'s and `captureTask`'s
// own `mkdirSync(dir, {recursive:true})` calls create it on demand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { detectLayout } from '../task-system-paths.mjs';
import { materializeTaskFile } from '../task-lifecycle.mjs';
import { captureTask } from '../task-lifecycle-capture-dismiss.mjs';

const BC = 'widgets';
const ID = 'widgets-fr35h';

function scratchRoot() {
  return mkdtempSync(path.join(tmpdir(), 'aw-fresh-project-'));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('a fresh project driven the way brainstorm + capture create one lands exactly the two-root shape, detectLayout "board" throughout, no ENOENT', () => {
  const root = scratchRoot();
  try {
    // --- 0. Completely absent .agentheim/ — the moment before brainstorm ---
    assert.equal(existsSync(path.join(root, '.agentheim')), false);
    assert.equal(detectLayout(root), 'board');

    // --- 1. brainstorm writes knowledge/vision.md first ---
    const knowledgeDir = path.join(root, '.agentheim', 'knowledge');
    mkdirSync(knowledgeDir, { recursive: true });
    writeFileSync(path.join(knowledgeDir, 'vision.md'), '# Vision: Widget Co\n\n## Purpose\n\nMake widgets.\n');
    // The critical moment ADR-0078 §5 calls out: only knowledge/vision.md
    // exists yet (no contexts/, no board/) — still 'board', never 'legacy'.
    assert.equal(detectLayout(root), 'board');

    // --- 2. brainstorm writes context-map.md + the top-level index.md ---
    writeFileSync(path.join(knowledgeDir, 'context-map.md'), '# Context map\n');
    writeFileSync(
      path.join(knowledgeDir, 'index.md'),
      '# Index\n\n<!-- bc-list:start -->\n<!-- bc-list:end -->\n\n<!-- adr-global:start -->\n<!-- adr-global:end -->\n\n<!-- research-global:start -->\n<!-- research-global:end -->\n'
    );
    assert.equal(detectLayout(root), 'board');

    // --- 3. modeling/brainstorm creates the BC: knowledge/contexts/<bc>/README.md ---
    // + its knowledge-half INDEX.md — a BC exists once its README does
    // (ADR-0078 §6), never authored by capture itself.
    const knowledgeBcDir = path.join(knowledgeDir, 'contexts', BC);
    mkdirSync(knowledgeBcDir, { recursive: true });
    writeFileSync(path.join(knowledgeBcDir, 'README.md'), `# ${BC}\n\nUbiquitous language.\n`);
    writeFileSync(
      path.join(knowledgeBcDir, 'INDEX.md'),
      `# ${BC} — Index (knowledge)\n\n<!-- adr-local:start -->\n<!-- adr-local:end -->\n\n<!-- research-local:start -->\n<!-- research-local:end -->\n\n<!-- concepts:start -->\n<!-- concepts:end -->\n`
    );
    assert.equal(detectLayout(root), 'board');

    // --- 4. the BC's lifecycle-folder scaffold — still nothing under board/ yet ---
    assert.equal(existsSync(path.join(root, '.agentheim', 'board')), false);

    // --- 5. one capture: materializeTaskFile writes the backlog file (creating
    // board/<bc>/backlog/ — and board/ itself — out of nothing), then
    // captureTask backfills board/<bc>/INDEX.md and board/protocol.md, both
    // also not-yet-existing. Neither write ENOENTs. ---
    const body = [
      '---',
      `id: ${ID}`,
      'title: Ship the first widget',
      'status: backlog',
      'type: feature',
      `context: ${BC}`,
      'created: 2026-09-12',
      'completed:',
      'depends_on: []',
      'blocks: []',
      'tags: []',
      '---',
      '',
      '## Why',
      '',
      'Ship it.',
      '',
    ].join('\n');
    const materializeResult = materializeTaskFile(root, body);
    assert.equal(materializeResult.ok, true, JSON.stringify(materializeResult));
    assert.equal(detectLayout(root), 'board');

    const captureResult = captureTask(root, ID, { context: BC, source: 'modeling', summary: 'First widget task' });
    assert.equal(captureResult.ok, true, JSON.stringify(captureResult));
    assert.equal(detectLayout(root), 'board');

    // The three OTHER lifecycle folders (todo/doing/done) are scaffolded here
    // too, mirroring modeling's convention of a fully-shaped fresh BC —
    // capture itself only ever creates backlog/ (or todo/) on demand.
    for (const folder of ['todo', 'doing', 'done']) {
      mkdirSync(path.join(root, '.agentheim', 'board', BC, folder), { recursive: true });
    }

    // --- Final shape assertions ---
    // No top-level legacy surfaces.
    assert.equal(existsSync(path.join(root, '.agentheim', 'contexts')), false);
    assert.equal(existsSync(path.join(root, '.agentheim', 'vision.md')), false);
    assert.equal(existsSync(path.join(root, '.agentheim', 'context-map.md')), false);

    // Everything durable lives under knowledge/.
    assert.equal(existsSync(path.join(knowledgeDir, 'vision.md')), true);
    assert.equal(existsSync(path.join(knowledgeDir, 'context-map.md')), true);
    assert.equal(existsSync(path.join(knowledgeDir, 'index.md')), true);
    assert.equal(existsSync(path.join(knowledgeBcDir, 'README.md')), true);
    assert.equal(existsSync(path.join(knowledgeBcDir, 'INDEX.md')), true);

    // Everything task-system lives under board/, and nothing else does.
    const boardDir = path.join(root, '.agentheim', 'board');
    const bcBoardDir = path.join(boardDir, BC);
    for (const folder of ['backlog', 'todo', 'doing', 'done']) {
      assert.equal(existsSync(path.join(bcBoardDir, folder)), true, `board/${BC}/${folder}/ should exist`);
    }
    assert.equal(existsSync(path.join(bcBoardDir, 'INDEX.md')), true);
    assert.equal(existsSync(path.join(boardDir, 'protocol.md')), true);
    // Nothing else directly under board/ besides the one BC folder + protocol.md.
    assert.deepEqual(readdirSync(boardDir).sort(), [BC, 'protocol.md'].sort());
    // Nothing else directly under the BC's board folder besides the four
    // lifecycle folders + INDEX.md.
    assert.deepEqual(readdirSync(bcBoardDir).sort(), ['INDEX.md', 'backlog', 'doing', 'done', 'todo'].sort());
  } finally {
    cleanup(root);
  }
});
