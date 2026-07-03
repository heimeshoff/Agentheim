// Unit tests for the per-BC INDEX.md done-list rotation script
// (agentic-workflow-c8j3w). Applies the cap-and-roll convention ADR-0039
// established for protocol.md (agentic-workflow-r2c7m) to the `done-list`
// marker block in each bounded context's `INDEX.md`.
//
// Covers the acceptance criteria: entry-count cap boundary (a small injected
// cap stands in for the real ~30-entry default so tests stay fast), verbatim
// move (never rewrite/summarize a done-list line), newest-on-top ordering
// preserved inside an archive file, current-month-never-rolls recency, the
// done-list header naming the archive location after a rotation, and that the
// `**Done:** N` lifetime count is left untouched (it is not a live-list size,
// it is a total-ever-completed counter owned by `completeTask`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  rotateIndexDoneList,
  rotateAllIndexDoneLists,
  parseDoneListEntries,
  runCli,
  DEFAULT_CAP_ENTRIES,
} from '../index-rotation.mjs';

const CLI_PATH = fileURLToPath(new URL('../index-rotation.mjs', import.meta.url));

const DONE_HEADER = '### Done (most recent first; older entries kept for prior-art search)';

/** One done-list line, in the exact shape `completeTask`'s insertIndexLineAtTop produces. */
function doneLine(id, title, type, fileName) {
  return `- **${id}** — ${title} (${type}) — \`done/${fileName}\``;
}

function indexContent(lines, eol = '\n') {
  const body =
    `# Test BC — Index\n\n` +
    `## Tasks by status\n\n` +
    `<!-- task-counts:start -->\n` +
    `- **Backlog:** 0\n` +
    `- **Todo:** 0\n` +
    `- **Doing:** 0\n` +
    `- **Done:** ${lines.length}\n` +
    `<!-- task-counts:end -->\n\n` +
    `${DONE_HEADER}\n` +
    `<!-- done-list:start -->\n` +
    lines.map((l) => `${l}\n`).join('') +
    `<!-- done-list:end -->\n\n` +
    `## Pointers\n\n` +
    `- BC README: \`README.md\`\n`;
  return eol === '\r\n' ? body.replace(/\n/g, '\r\n') : body;
}

function makeTaskFile(doneDir, fileName, completed) {
  mkdirSync(doneDir, { recursive: true });
  const id = fileName.replace(/\.md$/, '');
  const content =
    `---\n` +
    `id: ${id}\n` +
    `title: Filler task\n` +
    `status: done\n` +
    `type: feature\n` +
    `context: widgets\n` +
    `created: 2026-01-01\n` +
    `completed: ${completed}\n` +
    `---\n\n## Why\n\nFiller.\n`;
  writeFileSync(path.join(doneDir, fileName), content);
}

function makeProject(lines, entryMonths, eol = '\n') {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-idxrot-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', 'widgets');
  mkdirSync(bcDir, { recursive: true });
  const indexPath = path.join(bcDir, 'INDEX.md');
  writeFileSync(indexPath, indexContent(lines, eol));
  const doneDir = path.join(bcDir, 'done');
  for (const [fileName, completed] of Object.entries(entryMonths)) {
    makeTaskFile(doneDir, fileName, completed);
  }
  return { root, indexPath, archiveDir: path.join(bcDir, 'done-archive'), doneDir };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// --- parseDoneListEntries --------------------------------------------------

test('parseDoneListEntries extracts id + fileName from each done-list line, verbatim raw text', () => {
  const l1 = doneLine('widgets-aaa', 'First widget', 'feature', 'widgets-aaa-first.md');
  const l2 = doneLine('widgets-bbb', 'Second widget', 'bug', 'widgets-bbb-second.md');
  const content = indexContent([l1, l2]);
  const entries = parseDoneListEntries(content);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].raw, l1);
  assert.equal(entries[0].id, 'widgets-aaa');
  assert.equal(entries[0].fileName, 'widgets-aaa-first.md');
  assert.equal(entries[1].raw, l2);
  assert.equal(entries[1].id, 'widgets-bbb');
});

test('parseDoneListEntries throws when the done-list markers are missing (malformed INDEX.md)', () => {
  assert.throws(() => parseDoneListEntries('# Nothing here\n'));
});

// --- rotateIndexDoneList: cap boundary -------------------------------------

test('DEFAULT_CAP_ENTRIES is ~30, matching the task\'s proposed N', () => {
  assert.equal(DEFAULT_CAP_ENTRIES, 30);
});

test('under the cap: INDEX.md is left untouched, no archive is written', () => {
  const l1 = doneLine('widgets-aaa', 'A', 'feature', 'widgets-aaa.md');
  const l2 = doneLine('widgets-bbb', 'B', 'feature', 'widgets-bbb.md');
  const { root, indexPath, archiveDir } = makeProject([l1, l2], {
    'widgets-aaa.md': '2026-07-01',
    'widgets-bbb.md': '2026-07-02',
  });
  try {
    const before = readFileSync(indexPath, 'utf8');
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 5 });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, false);
    assert.deepEqual(result.changed, []);
    assert.equal(result.liveEntries, 2);
    assert.equal(readFileSync(indexPath, 'utf8'), before);
    assert.equal(existsSync(archiveDir), false);
  } finally {
    cleanup(root);
  }
});

test('exactly at the cap (boundary): not rotated', () => {
  const l1 = doneLine('widgets-aaa', 'A', 'feature', 'widgets-aaa.md');
  const l2 = doneLine('widgets-bbb', 'B', 'feature', 'widgets-bbb.md');
  const { root, indexPath } = makeProject([l1, l2], {
    'widgets-aaa.md': '2026-07-01',
    'widgets-bbb.md': '2026-07-02',
  });
  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 2 });
    assert.equal(result.rotated, false);
    assert.equal(result.liveEntries, 2);
    assert.ok(readFileSync(indexPath, 'utf8').includes(l1));
  } finally {
    cleanup(root);
  }
});

// --- rotateIndexDoneList: month grouping + rolling -------------------------

test('over the cap with two months present: the older month rolls out whole, verbatim, newest-on-top; the newer month stays live', () => {
  const julNew = doneLine('widgets-jn2', 'July newer', 'feature', 'widgets-jn2.md');
  const junOld1 = doneLine('widgets-jo1', 'June newer-of-the-old', 'feature', 'widgets-jo1.md');
  const junOld2 = doneLine('widgets-jo2', 'June older-of-the-old', 'feature', 'widgets-jo2.md');
  const { root, indexPath, archiveDir } = makeProject([julNew, junOld1, junOld2], {
    'widgets-jn2.md': '2026-07-03',
    'widgets-jo1.md': '2026-06-20',
    'widgets-jo2.md': '2026-06-05',
  });
  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, true);
    assert.deepEqual(result.rolledMonths, ['2026-06']);
    assert.equal(result.liveEntries, 1);

    const live = readFileSync(indexPath, 'utf8');
    assert.ok(live.includes(julNew));
    assert.ok(!live.includes(junOld1));
    assert.ok(!live.includes(junOld2));

    const archivePath = path.join(archiveDir, '2026-06.md');
    assert.ok(existsSync(archivePath));
    const archived = readFileSync(archivePath, 'utf8');
    const idx1 = archived.indexOf(junOld1);
    const idx2 = archived.indexOf(junOld2);
    assert.ok(idx1 !== -1 && idx2 !== -1, 'both June entries present verbatim in the archive');
    assert.ok(idx1 < idx2, 'newest-on-top order preserved inside the archive');

    assert.ok(result.changed.includes(indexPath));
    assert.ok(result.changed.includes(archivePath));
  } finally {
    cleanup(root);
  }
});

test('the current (newest) month is never rolled out, even if it alone exceeds the cap', () => {
  const jul1 = doneLine('widgets-j1', 'July one', 'feature', 'widgets-j1.md');
  const jul2 = doneLine('widgets-j2', 'July two', 'feature', 'widgets-j2.md');
  const { root, indexPath, archiveDir } = makeProject([jul1, jul2], {
    'widgets-j1.md': '2026-07-10',
    'widgets-j2.md': '2026-07-01',
  });
  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    assert.equal(result.rotated, false);
    assert.deepEqual(result.rolledMonths, []);
    assert.equal(readFileSync(indexPath, 'utf8').includes(jul1) && true, true);
    assert.equal(existsSync(archiveDir), false);
  } finally {
    cleanup(root);
  }
});

test('rolling stops as soon as the live list is back under the cap (three months, only the oldest rolls)', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (middle)', 'feature', 'widgets-jun.md');
  const may = doneLine('widgets-may', 'May (oldest)', 'feature', 'widgets-may.md');
  const { root, indexPath, archiveDir } = makeProject([jul, jun, may], {
    'widgets-jul.md': '2026-07-03',
    'widgets-jun.md': '2026-06-15',
    'widgets-may.md': '2026-05-10',
  });
  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 2 });
    assert.equal(result.rotated, true);
    assert.deepEqual(result.rolledMonths, ['2026-05']);

    const live = readFileSync(indexPath, 'utf8');
    assert.ok(live.includes(jul) && live.includes(jun));
    assert.ok(!live.includes(may));
    assert.equal(existsSync(path.join(archiveDir, '2026-06.md')), false);
    assert.ok(existsSync(path.join(archiveDir, '2026-05.md')));
    assert.ok(readFileSync(path.join(archiveDir, '2026-05.md'), 'utf8').includes(may));
  } finally {
    cleanup(root);
  }
});

test('rotating an already-under-cap list a second time is a no-op (idempotent)', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (older)', 'feature', 'widgets-jun.md');
  const { root, indexPath, archiveDir } = makeProject([jul, jun], {
    'widgets-jul.md': '2026-07-03',
    'widgets-jun.md': '2026-06-05',
  });
  try {
    const first = rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    assert.equal(first.rotated, true);
    const afterFirst = readFileSync(indexPath, 'utf8');
    const second = rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    assert.equal(second.rotated, false);
    assert.equal(readFileSync(indexPath, 'utf8'), afterFirst);
    assert.ok(readFileSync(path.join(archiveDir, '2026-06.md'), 'utf8').includes(jun));
  } finally {
    cleanup(root);
  }
});

test('a missing INDEX.md is a no-op, ok:true, nothing written', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-idxrot-missing-'));
  mkdirSync(path.join(root, '.agentheim', 'contexts', 'widgets'), { recursive: true });
  try {
    const result = rotateIndexDoneList(root, 'widgets');
    assert.equal(result.ok, true);
    assert.equal(result.rotated, false);
    assert.deepEqual(result.changed, []);
  } finally {
    cleanup(root);
  }
});

// --- reachability / header / count preservation -----------------------------

test('after rotation the done-list header names the archive location; the **Done:** lifetime count is left untouched', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (older)', 'feature', 'widgets-jun.md');
  const { root, indexPath } = makeProject([jul, jun], {
    'widgets-jul.md': '2026-07-03',
    'widgets-jun.md': '2026-06-05',
  });
  try {
    rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    const live = readFileSync(indexPath, 'utf8');
    assert.ok(!live.includes(DONE_HEADER), 'the generic header line was rewritten');
    assert.ok(live.includes('done-archive/'), 'the header names the archive location');
    assert.ok(live.includes('**Done:** 2'), 'the lifetime Done count is untouched by rotation');
  } finally {
    cleanup(root);
  }
});

test('a task file with no readable `completed:` frontmatter still rotates (falls back to file mtime, loss-tolerant)', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const undated = doneLine('widgets-undated', 'Undated older one', 'feature', 'widgets-undated.md');
  const { root, indexPath, doneDir } = makeProject([jul], { 'widgets-jul.md': '2026-07-03' });
  // widgets-undated.md deliberately has no `completed:` field.
  mkdirSync(doneDir, { recursive: true });
  writeFileSync(
    path.join(doneDir, 'widgets-undated.md'),
    '---\nid: widgets-undated\ntitle: Undated\nstatus: done\n---\n\n## Why\n\nFiller.\n'
  );
  // Splice the undated line into the live INDEX.md as the second (older) entry.
  let content = readFileSync(indexPath, 'utf8');
  content = content.replace(`${jul}\n<!-- done-list:end -->`, `${jul}\n${undated}\n<!-- done-list:end -->`);
  content = content.replace('**Done:** 1', '**Done:** 2');
  writeFileSync(indexPath, content);

  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 5 });
    // Both entries fit under the cap of 5 — no rotation, but parsing/derivation
    // must not throw on the missing `completed:` field.
    assert.equal(result.ok, true);
    assert.equal(result.rotated, false);
    assert.equal(result.liveEntries, 2);
  } finally {
    cleanup(root);
  }
});

// --- CRLF robustness ---------------------------------------------------------

test('rotation is EOL-robust: works identically against a CRLF-checked-out INDEX.md', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (older)', 'feature', 'widgets-jun.md');
  const { root, indexPath, archiveDir } = makeProject(
    [jul, jun],
    { 'widgets-jul.md': '2026-07-03', 'widgets-jun.md': '2026-06-05' },
    '\r\n'
  );
  try {
    const result = rotateIndexDoneList(root, 'widgets', { capEntries: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, true);
    assert.deepEqual(result.rolledMonths, ['2026-06']);

    const live = readFileSync(indexPath, 'utf8');
    assert.ok(live.includes(jul));
    assert.ok(!live.includes(jun));
    assert.ok(live.includes('done-archive/'));

    const archived = readFileSync(path.join(archiveDir, '2026-06.md'), 'utf8');
    assert.ok(archived.includes(jun));
  } finally {
    cleanup(root);
  }
});

// --- rotateAllIndexDoneLists / runCli / real invocation ---------------------

test('rotateAllIndexDoneLists rotates every BC under contexts/ and aggregates the manifest', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (older)', 'feature', 'widgets-jun.md');
  const { root, indexPath, archiveDir } = makeProject([jul, jun], {
    'widgets-jul.md': '2026-07-03',
    'widgets-jun.md': '2026-06-05',
  });
  try {
    const result = rotateAllIndexDoneLists(root, { capEntries: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, true);
    assert.ok(result.contexts.widgets.rotated);
    assert.ok(result.changed.includes(indexPath));
    assert.ok(existsSync(path.join(archiveDir, '2026-06.md')));
  } finally {
    cleanup(root);
  }
});

test('runCli rotates via an injected discoverRoot and rotateOpts', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const jun = doneLine('widgets-jun', 'June (older)', 'feature', 'widgets-jun.md');
  const { root, indexPath } = makeProject([jul, jun], {
    'widgets-jul.md': '2026-07-03',
    'widgets-jun.md': '2026-06-05',
  });
  try {
    const { exitCode, output } = runCli({ discoverRoot: () => root, rotateOpts: { capEntries: 1 } });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.rotated, true);
    assert.ok(readFileSync(indexPath, 'utf8').includes(jul));
  } finally {
    cleanup(root);
  }
});

test('runCli surfaces a discoverRoot failure as exitCode 1, code no-project-root', () => {
  const { exitCode, output } = runCli({
    discoverRoot: () => {
      throw new Error('No .agentheim/ project found.');
    },
  });
  assert.equal(exitCode, 1);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'no-project-root');
});

test('the real `node lib/index-rotation.mjs` invocation prints the manifest and exits 0 (isMain + discoverRoot wiring)', () => {
  const jul = doneLine('widgets-jul', 'July (current)', 'feature', 'widgets-jul.md');
  const { root } = makeProject([jul], { 'widgets-jul.md': '2026-07-03' });
  try {
    const out = execFileSync(process.execPath, [CLI_PATH], { cwd: root, encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
  } finally {
    cleanup(root);
  }
});
