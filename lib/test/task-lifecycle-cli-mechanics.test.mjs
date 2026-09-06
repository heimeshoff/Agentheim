// Unit + integration tests for the two OPTS-ONLY mechanics verbs `log` and
// `index-add` (agentic-workflow-pt0gy), plus the load-bearing concurrency
// proof: two REAL, separately-spawned `capture` calls racing on one BC of one
// temp project must both land — the literal lost-update assertion an
// in-process call could never expose (one interpreter serializes for free).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runCli, FORBIDDEN_INDEX_ADD_SECTIONS } from '../task-lifecycle-cli.mjs';
import { lifecycleLockPath } from '../lifecycle-lock.mjs';

const CLI_PATH = fileURLToPath(new URL('../task-lifecycle-cli.mjs', import.meta.url));
const BC = 'agentic-workflow';

function makeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cli-mech-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

function protocolPath(root) {
  return path.join(root, '.agentheim', 'knowledge', 'protocol.md');
}

function knowledgeIndexPath(root) {
  return path.join(root, '.agentheim', 'knowledge', 'index.md');
}

function bcIndexPath(root, bc = BC) {
  return path.join(root, '.agentheim', 'contexts', bc, 'INDEX.md');
}

function headingCount(content) {
  return (content.match(/^## /gm) || []).length;
}

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

test('runCli log: writes one protocol.md entry, message null when omitted, and returns the manifest', () => {
  const root = makeRoot();
  try {
    const { exitCode, output } = runCli(
      ['log', JSON.stringify({ title: 'Modeling / Refined: agentic-workflow-999 - A task', body: '**Type:** Modeling / Refine\n**BC:** agentic-workflow' })],
      { discoverRoot: () => root, taskOpts: { now: new Date(2026, 8, 6, 9, 30) } }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.verb, 'log');
    assert.equal(output.message, null);
    assert.deepEqual(output.changed, [protocolPath(root)]);
    assert.equal(output.timestamp, '2026-09-06 09:30');
    const content = readFileSync(protocolPath(root), 'utf8');
    assert.match(content, /^## 2026-09-06 09:30 -- Modeling \/ Refined: agentic-workflow-999 - A task$/m);
    assert.match(content, /\*\*Type:\*\* Modeling \/ Refine/);
  } finally {
    cleanup(root);
  }
});

test('runCli log: echoes opts.message verbatim when provided', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: 'X', body: 'body text', message: 'chore(x): a commit' })], {
      discoverRoot: () => root,
    });
    assert.equal(output.ok, true);
    assert.equal(output.message, 'chore(x): a commit');
  } finally {
    cleanup(root);
  }
});

test('runCli log: missing-opts when neither title nor body is present', () => {
  const root = makeRoot();
  try {
    const { exitCode, output } = runCli(['log', JSON.stringify({})], { discoverRoot: () => root });
    assert.equal(exitCode, 1);
    assert.equal(output.code, 'missing-opts');
    assert.equal(existsSync(protocolPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('runCli log: missing-title when only body is present', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ body: 'just a body' })], { discoverRoot: () => root });
    assert.equal(output.code, 'missing-title');
  } finally {
    cleanup(root);
  }
});

test('runCli log: invalid-title on a newline in the title', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: 'Line1\nLine2', body: 'x' })], { discoverRoot: () => root });
    assert.equal(output.code, 'invalid-title');
  } finally {
    cleanup(root);
  }
});

test('runCli log: invalid-title on a leading "#"', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: '# Already a heading', body: 'x' })], { discoverRoot: () => root });
    assert.equal(output.code, 'invalid-title');
  } finally {
    cleanup(root);
  }
});

test('runCli log: missing-body when only title is present', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: 'A title' })], { discoverRoot: () => root });
    assert.equal(output.code, 'missing-body');
  } finally {
    cleanup(root);
  }
});

test('runCli log: heading-in-body refuses a body containing its own "## " line', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: 'A title', body: 'line one\n## a fake heading\nline two' })], {
      discoverRoot: () => root,
    });
    assert.equal(output.code, 'heading-in-body');
    assert.equal(existsSync(protocolPath(root)), false);
  } finally {
    cleanup(root);
  }
});

test('runCli log: separator-in-body refuses a body containing a bare "---" line', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['log', JSON.stringify({ title: 'A title', body: 'line one\n---\nline two' })], {
      discoverRoot: () => root,
    });
    assert.equal(output.code, 'separator-in-body');
  } finally {
    cleanup(root);
  }
});

test('runCli log: bookkeeping-marker-mismatch when protocol.md is missing the header separator, nothing written', () => {
  const root = makeRoot();
  const pPath = protocolPath(root);
  try {
    mkdirSync(path.dirname(pPath), { recursive: true });
    writeFileSync(pPath, '# Protocol\n\nno separator here\n');
    const before = readFileSync(pPath, 'utf8');
    const { output } = runCli(['log', JSON.stringify({ title: 'A title', body: 'a body' })], { discoverRoot: () => root });
    assert.equal(output.ok, false);
    assert.equal(output.code, 'bookkeeping-marker-mismatch');
    assert.equal(readFileSync(pPath, 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('the real `node lib/task-lifecycle-cli.mjs log <json-opts>` invocation prints the manifest and exits 0', () => {
  const root = makeRoot();
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, 'log', JSON.stringify({ title: 'Real spawn', body: 'a body' })], {
      cwd: root,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verb, 'log');
    assert.equal(existsSync(protocolPath(root)), true);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// index-add
// ---------------------------------------------------------------------------

function makeKnowledgeIndex(root) {
  const p = knowledgeIndexPath(root);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(
    p,
    `# Index\n\n---\n\n## Bounded contexts\n\n<!-- bc-list:start -->\n<!-- bc-list:end -->\n\n## Global ADRs (scope: global)\n\n<!-- adr-global:start -->\n<!-- adr-global:end -->\n\n## Cross-BC research\n\n<!-- research-global:start -->\n<!-- research-global:end -->\n`
  );
  return p;
}

function makeBcIndex(root, bc = BC, { backlogLines = [] } = {}) {
  const p = bcIndexPath(root, bc);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(
    p,
    `# ${bc} — Index\n\n---\n\n## Tasks by status\n\n<!-- task-counts:start -->\n- **Backlog:** ${backlogLines.length}\n- **Todo:** 0\n- **Doing:** 0\n- **Done:** 0\n<!-- task-counts:end -->\n\n### Todo\n<!-- todo-list:start -->\n<!-- todo-list:end -->\n\n### Doing\n<!-- doing-list:start -->\n<!-- doing-list:end -->\n\n### Done\n<!-- done-list:start -->\n<!-- done-list:end -->\n\n### Backlog\n<!-- backlog-list:start -->\n${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->\n\n## ADRs scoped to this BC\n\n<!-- adr-local:start -->\n<!-- adr-local:end -->\n\n## Research touching this BC\n\n<!-- research-local:start -->\n<!-- research-local:end -->\n\n## Concepts (opt-in synthesis pages)\n\n<!-- concepts:start -->\n<!-- concepts:end -->\n`
  );
  return p;
}

test('runCli index-add: bc:null targets the top-level knowledge/index.md and inserts under adr-global', () => {
  const root = makeRoot();
  try {
    makeKnowledgeIndex(root);
    const { exitCode, output } = runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0099** — A decision — 2026-09-06 — `knowledge/decisions/0099-a-decision.md`' })],
      { discoverRoot: () => root }
    );
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.skipped, false);
    assert.deepEqual(output.changed, [knowledgeIndexPath(root)]);
    const content = readFileSync(knowledgeIndexPath(root), 'utf8');
    assert.match(content, /<!-- adr-global:start -->\n- \*\*0099\*\*/);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: a BC name targets that BC\'s INDEX.md and inserts under concepts', () => {
  const root = makeRoot();
  try {
    makeBcIndex(root);
    const line = '- **live-tree** — synthesis of the live-update family — derived_from: [a, b] — `concepts/live-tree.md`';
    const { output } = runCli(['index-add', JSON.stringify({ bc: BC, section: 'concepts', id: 'live-tree', line })], {
      discoverRoot: () => root,
    });
    assert.equal(output.ok, true);
    assert.deepEqual(output.changed, [bcIndexPath(root)]);
    const content = readFileSync(bcIndexPath(root), 'utf8');
    assert.match(content, /<!-- concepts:start -->\n- \*\*live-tree\*\*/);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: missing-bc when opts.bc is omitted entirely (not even null)', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(['index-add', JSON.stringify({ section: 'adr-global', id: '0099', line: '- **0099** — x' })], {
      discoverRoot: () => root,
    });
    assert.equal(output.code, 'missing-bc');
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: missing-section, missing-id, missing-line each refuse', () => {
  const root = makeRoot();
  try {
    assert.equal(
      runCli(['index-add', JSON.stringify({ bc: null, id: '0099', line: '- **0099** — x' })], { discoverRoot: () => root }).output.code,
      'missing-section'
    );
    assert.equal(
      runCli(['index-add', JSON.stringify({ bc: null, section: 'adr-global', line: '- **0099** — x' })], { discoverRoot: () => root }).output.code,
      'missing-id'
    );
    assert.equal(
      runCli(['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099' })], { discoverRoot: () => root }).output.code,
      'missing-line'
    );
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: task-list-section-forbidden for all five forbidden sections', () => {
  const root = makeRoot();
  try {
    makeBcIndex(root);
    for (const section of FORBIDDEN_INDEX_ADD_SECTIONS) {
      const { output } = runCli(
        ['index-add', JSON.stringify({ bc: BC, section, id: 'agentic-workflow-777', line: '- **agentic-workflow-777** — x' })],
        { discoverRoot: () => root }
      );
      assert.equal(output.ok, false, `expected ${section} to be forbidden`);
      assert.equal(output.code, 'task-list-section-forbidden');
    }
    assert.equal(FORBIDDEN_INDEX_ADD_SECTIONS.size, 5);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: id-not-in-line refuses when the line does not actually contain the id', () => {
  const root = makeRoot();
  try {
    makeKnowledgeIndex(root);
    const { output } = runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0100** — a different id' })],
      { discoverRoot: () => root }
    );
    assert.equal(output.code, 'id-not-in-line');
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: index-missing refuses without backfilling when the target INDEX.md does not exist', () => {
  const root = makeRoot();
  try {
    const { output } = runCli(
      ['index-add', JSON.stringify({ bc: 'some-bc-with-no-index', section: 'concepts', id: 'x', line: '- **x** — y' })],
      { discoverRoot: () => root }
    );
    assert.equal(output.code, 'index-missing');
    assert.equal(existsSync(bcIndexPath(root, 'some-bc-with-no-index')), false);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: identical id + byte-identical line is a no-op success (skipped:true, changed:[])', () => {
  const root = makeRoot();
  try {
    const line = '- **0099** — A decision — 2026-09-06 — `knowledge/decisions/0099-a-decision.md`';
    makeKnowledgeIndex(root);
    const first = runCli(['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line })], {
      discoverRoot: () => root,
    });
    assert.equal(first.output.skipped, false);
    const before = readFileSync(knowledgeIndexPath(root), 'utf8');
    const second = runCli(['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line })], {
      discoverRoot: () => root,
    });
    assert.equal(second.exitCode, 0);
    assert.equal(second.output.ok, true);
    assert.equal(second.output.skipped, true);
    assert.deepEqual(second.output.changed, []);
    assert.equal(readFileSync(knowledgeIndexPath(root), 'utf8'), before);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: identical id + different line refuses duplicate-id-conflict', () => {
  const root = makeRoot();
  try {
    makeKnowledgeIndex(root);
    runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0099** — Original title — `knowledge/decisions/0099-original.md`' })],
      { discoverRoot: () => root }
    );
    const { output } = runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0099** — DIFFERENT title — `knowledge/decisions/0099-original.md`' })],
      { discoverRoot: () => root }
    );
    assert.equal(output.ok, false);
    assert.equal(output.code, 'duplicate-id-conflict');
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: a shorter id never false-positives as a duplicate of a longer-numbered sibling (word/hyphen boundary)', () => {
  const root = makeRoot();
  try {
    makeKnowledgeIndex(root);
    // Seed the LONGER id first.
    runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '00990', line: '- **00990** — Sibling decision — `knowledge/decisions/00990-sibling.md`' })],
      { discoverRoot: () => root }
    );
    // Now the SHORTER id, which is a strict prefix of the sibling's line text --
    // must NOT be treated as a duplicate/conflict.
    const { output } = runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0099** — A decision — `knowledge/decisions/0099-a-decision.md`' })],
      { discoverRoot: () => root }
    );
    assert.equal(output.ok, true);
    assert.equal(output.skipped, false);
    const content = readFileSync(knowledgeIndexPath(root), 'utf8');
    assert.match(content, /\*\*0099\*\*/);
    assert.match(content, /\*\*00990\*\*/);
  } finally {
    cleanup(root);
  }
});

test('runCli index-add: bookkeeping-marker-mismatch when the target section markers are absent', () => {
  const root = makeRoot();
  try {
    const p = knowledgeIndexPath(root);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, '# Index\n\n---\n\nno markers here at all\n');
    const { output } = runCli(
      ['index-add', JSON.stringify({ bc: null, section: 'adr-global', id: '0099', line: '- **0099** — x' })],
      { discoverRoot: () => root }
    );
    assert.equal(output.ok, false);
    assert.equal(output.code, 'bookkeeping-marker-mismatch');
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Live-tree lint: FORBIDDEN_INDEX_ADD_SECTIONS covers exactly the
// task-status region's markers in references/index-template.md, and the
// legal (non-forbidden) markers in the template are exactly the six named
// in this task's What §2.
// ---------------------------------------------------------------------------

test('FORBIDDEN_INDEX_ADD_SECTIONS covers every marker in index-template.md\'s task-status region, and the remaining markers are exactly the six legal sections', () => {
  const templatePath = fileURLToPath(new URL('../../references/index-template.md', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');

  // Only look inside the fenced ```markdown code blocks -- the prose elsewhere
  // in this doc uses "<!-- name:start -->" as a generic placeholder example,
  // which is not itself a real marker name.
  const fencedBlocks = [...template.matchAll(/```markdown\r?\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
  assert.ok(fencedBlocks.length > 0, 'expected at least one ```markdown fenced block in the template');

  const regionMatch = fencedBlocks.match(/## Tasks by status\r?\n([\s\S]*?)\r?\n## ADRs scoped to this BC/);
  assert.ok(regionMatch, 'expected to find the "## Tasks by status" ... "## ADRs scoped to this BC" region in the template');
  const regionMarkers = [...regionMatch[1].matchAll(/<!-- ([a-z-]+):start -->/g)].map((m) => m[1]);
  assert.ok(regionMarkers.length > 0);
  for (const marker of regionMarkers) {
    assert.ok(FORBIDDEN_INDEX_ADD_SECTIONS.has(marker), `expected "${marker}" (task-status region) to be forbidden`);
  }
  assert.equal(regionMarkers.length, FORBIDDEN_INDEX_ADD_SECTIONS.size, 'the task-status region should name exactly the forbidden set, no more, no less');

  const allMarkers = new Set([...fencedBlocks.matchAll(/<!-- ([a-z-]+):start -->/g)].map((m) => m[1]));
  const legalMarkers = [...allMarkers].filter((m) => !FORBIDDEN_INDEX_ADD_SECTIONS.has(m));
  assert.deepEqual(
    legalMarkers.sort(),
    ['adr-global', 'adr-local', 'bc-list', 'concepts', 'research-global', 'research-local'].sort()
  );
});

// ---------------------------------------------------------------------------
// The concurrency proof (AC #1): spawn two REAL `capture` calls into one BC
// of one temp project concurrently. In-process would pass with no lock at
// all (one interpreter serializes for free) -- this must go through
// `child_process.spawn` against the real CLI file.
//
// Forced overlap (agentic-workflow-dpbjj): both children carry a fixed
// `lock.holdMs` (H, ~300ms) on their third argv, honoured by
// `withLifecycleLock` (lib/lifecycle-lock.mjs) only under `node --test`'s
// `NODE_TEST_CONTEXT`. Without a real lock, both children would finish in
// ~H (whichever wins the race just holds it once); with the lock, the
// second child cannot even begin ITS hold until the first releases, so
// first-spawn-to-last-exit wall clock is forced to >= 2*H -- a fake or
// missing lock cannot reach that floor.
// ---------------------------------------------------------------------------

function taskBody({ id, title }) {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\ntype: feature\ncontext: ${BC}\ncreated: 2026-09-06\ncompleted:\ndepends_on: []\nblocks: []\ntags: []\n---\n\n## Why\n\nstuff\n`;
}

function spawnCapture(root, id, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, 'capture', id, JSON.stringify(opts)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      try {
        resolve({ code, output: JSON.parse(out.trim()) });
      } catch (parseErr) {
        reject(new Error(`capture child produced unparseable output (exit ${code}, stderr ${err}): ${JSON.stringify(out)} -- ${parseErr.message}`));
      }
    });
  });
}

test('two real, concurrently-spawned `capture` calls into one BC both land: no lost update on the INDEX list, the count, or the protocol heading count', async () => {
  const root = makeRoot();
  try {
    const bcDir = path.join(root, '.agentheim', 'contexts', BC);
    const backlogDir = path.join(bcDir, 'backlog');
    for (const f of ['backlog', 'todo', 'doing', 'done']) mkdirSync(path.join(bcDir, f), { recursive: true });

    const idA = 'agentic-workflow-90001';
    const idB = 'agentic-workflow-90002';
    writeFileSync(path.join(backlogDir, `${idA}-slug.md`), taskBody({ id: idA, title: 'Concurrent capture A' }));
    writeFileSync(path.join(backlogDir, `${idB}-slug.md`), taskBody({ id: idB, title: 'Concurrent capture B' }));

    makeBcIndex(root);
    const pPath = protocolPath(root);
    mkdirSync(path.dirname(pPath), { recursive: true });
    writeFileSync(pPath, '# Protocol\n\nNewest entries on top.\n\n---\n\n## 2026-09-01 00:00 -- Pre-existing entry\n\n**Type:** X\n\n---\n\n');
    const headingsBefore = headingCount(readFileSync(pPath, 'utf8'));

    const H = 300; // ms -- forced hold inside the locked section, both children
    const firstSpawn = Date.now();
    const [resA, resB] = await Promise.all([
      spawnCapture(root, idA, { source: 'modeling', summary: 'A', lock: { holdMs: H } }),
      spawnCapture(root, idB, { source: 'modeling', summary: 'B', lock: { holdMs: H } }),
    ]);
    const lastExit = Date.now();

    assert.equal(resA.code, 0, `capture A should exit 0, got output ${JSON.stringify(resA.output)}`);
    assert.equal(resA.output.ok, true);
    assert.equal(resB.code, 0, `capture B should exit 0, got output ${JSON.stringify(resB.output)}`);
    assert.equal(resB.output.ok, true);

    const indexContent = readFileSync(bcIndexPath(root), 'utf8');
    assert.match(indexContent, new RegExp(`\\*\\*${idA}\\*\\*`));
    assert.match(indexContent, new RegExp(`\\*\\*${idB}\\*\\*`));

    const backlogCountLine = indexContent.match(/\*\*Backlog:\*\* (\d+)/);
    assert.ok(backlogCountLine);
    const backlogDirCount = readdirSync(backlogDir).length;
    assert.equal(Number(backlogCountLine[1]), backlogDirCount, 'the **Backlog:** count must equal readdirSync(backlogDir).length -- the literal lost-update assertion');
    assert.equal(backlogDirCount, 2);

    const headingsAfter = headingCount(readFileSync(pPath, 'utf8'));
    assert.equal(headingsAfter - headingsBefore, 2, 'protocol.md should gain exactly 2 "## " headings, one per capture');

    assert.ok(
      lastExit - firstSpawn >= 2 * H,
      `first-spawn-to-last-exit wall clock must be >= 2*H (${2 * H}ms) -- serialization must have happened, got ${lastExit - firstSpawn}ms`
    );

    assert.equal(existsSync(lifecycleLockPath(root)), false, 'the lifecycle lock file must not exist once both captures have exited');
  } finally {
    cleanup(root);
  }
});
