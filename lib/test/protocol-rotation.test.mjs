// Unit tests for the protocol.md rotation script (agentic-workflow-r2c7m, ADR-0039).
//
// Covers the acceptance criteria: cap boundary (a small injected cap stands in
// for the real ~1,000-line default so tests stay fast and readable), verbatim
// move (never rewrite/summarize — bytes travel unchanged), newest-on-top
// ordering preserved inside an archive file, and live-file recency (the
// current/newest month is never rolled out, however large).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { rotateProtocol, parseProtocolEntries, runCli, DEFAULT_CAP_LINES } from '../protocol-rotation.mjs';

const CLI_PATH = fileURLToPath(new URL('../protocol-rotation.mjs', import.meta.url));

const HEADER = '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n';

/** One protocol entry, in the exact shape `promoteTask`'s prependProtocolEntry produces. */
function entry(date, label, fields = ['**Type:** Test']) {
  return `## ${date} -- ${label}\n\n${fields.join('\n')}\n\n---\n\n`;
}

function makeProject(protocolContent) {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-protorot-'));
  mkdirSync(path.join(root, '.agentheim', 'knowledge'), { recursive: true });
  const protocolPath = path.join(root, '.agentheim', 'knowledge', 'protocol.md');
  writeFileSync(protocolPath, protocolContent);
  return { root, protocolPath, archiveDir: path.join(root, '.agentheim', 'knowledge', 'protocol') };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// --- parseProtocolEntries -----------------------------------------------

test('parseProtocolEntries splits header from entries and derives each entry\'s YYYY-MM month', () => {
  const content =
    HEADER +
    entry('2026-07-03 14:20', 'July entry two') +
    entry('2026-07-01 09:00', 'July entry one') +
    entry('2026-06-05', 'June entry (date-only heading)');
  const { header, entries } = parseProtocolEntries(content);
  assert.equal(header, HEADER);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].month, '2026-07');
  assert.equal(entries[1].month, '2026-07');
  assert.equal(entries[2].month, '2026-06');
});

test('parseProtocolEntries returns each entry\'s raw text byte-for-byte verbatim', () => {
  const e1 = entry('2026-07-03 14:20', 'An entry', ['**Type:** Test', '**Note:** filler line']);
  const content = HEADER + e1;
  const { entries } = parseProtocolEntries(content);
  assert.equal(entries[0].raw, e1);
});

// --- rotateProtocol: cap boundary ----------------------------------------

test('DEFAULT_CAP_LINES is ~1000, matching the doctrine\'s stated cap', () => {
  assert.equal(DEFAULT_CAP_LINES, 1000);
});

test('under the cap: protocol.md is left untouched, no archive is written', () => {
  const content = HEADER + entry('2026-07-03 14:20', 'Only entry');
  const { root, protocolPath, archiveDir } = makeProject(content);
  try {
    const result = rotateProtocol(root, { capLines: 1000 });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, false);
    assert.deepEqual(result.changed, []);
    assert.equal(readFileSync(protocolPath, 'utf8'), content);
    assert.equal(existsSync(archiveDir), false);
  } finally {
    cleanup(root);
  }
});

test('exactly at the cap (boundary): not rotated', () => {
  // Build content whose line count is exactly the injected cap.
  const content = HEADER + entry('2026-07-03 14:20', 'Boundary entry');
  const capLines = (content.match(/\n/g) || []).length;
  const { root, protocolPath } = makeProject(content);
  try {
    const result = rotateProtocol(root, { capLines });
    assert.equal(result.rotated, false);
    assert.equal(readFileSync(protocolPath, 'utf8'), content);
  } finally {
    cleanup(root);
  }
});

test('over the cap with two months present: the older month rolls out whole, the newer month stays live', () => {
  const junE1 = entry('2026-06-20 10:00', 'June entry two (newer within June)');
  const junE2 = entry('2026-06-05 09:00', 'June entry one (older within June)');
  const julE1 = entry('2026-07-03 14:20', 'July entry (current month)');
  const content = HEADER + julE1 + junE1 + junE2;
  const capLines = (HEADER + julE1).match(/\n/g).length; // cap = exactly the current month's footprint
  const { root, protocolPath, archiveDir } = makeProject(content);
  try {
    const result = rotateProtocol(root, { capLines });
    assert.equal(result.ok, true);
    assert.equal(result.rotated, true);
    assert.deepEqual(result.rolledMonths, ['2026-06']);

    // Live file: header + July entry only — the current month never rolls.
    const live = readFileSync(protocolPath, 'utf8');
    assert.equal(live, HEADER + julE1);

    // Archive: both June entries, verbatim, newest-on-top (E1 before E2).
    const archivePath = path.join(archiveDir, '2026-06.md');
    assert.ok(existsSync(archivePath));
    const archived = readFileSync(archivePath, 'utf8');
    const idxE1 = archived.indexOf(junE1);
    const idxE2 = archived.indexOf(junE2);
    assert.ok(idxE1 !== -1 && idxE2 !== -1, 'both June entries present verbatim in the archive');
    assert.ok(idxE1 < idxE2, 'newest-on-top order preserved inside the archive');

    assert.ok(result.changed.includes(protocolPath));
    assert.ok(result.changed.includes(archivePath));
  } finally {
    cleanup(root);
  }
});

test('the current month is never rolled out, even if it alone exceeds the cap', () => {
  const julE1 = entry('2026-07-03 14:20', 'July entry one');
  const julE2 = entry('2026-07-01 09:00', 'July entry two');
  const content = HEADER + julE1 + julE2; // single month, only "current" bucket exists
  const { root, protocolPath, archiveDir } = makeProject(content);
  try {
    // Cap far below the content's actual size — still a single (current) month, so no rotation.
    const result = rotateProtocol(root, { capLines: 3 });
    assert.equal(result.rotated, false);
    assert.deepEqual(result.rolledMonths, []);
    assert.equal(readFileSync(protocolPath, 'utf8'), content);
    assert.equal(existsSync(archiveDir), false);
  } finally {
    cleanup(root);
  }
});

test('rolling stops as soon as the live file is back under the cap (three months, only the oldest rolls)', () => {
  const jul = entry('2026-07-03 14:20', 'July (current)');
  const jun = entry('2026-06-15 09:00', 'June (middle)');
  const may = entry('2026-05-10 09:00', 'May (oldest)');
  const content = HEADER + jul + jun + may;
  const capLines = (HEADER + jul + jun).match(/\n/g).length; // fits header+July+June, not May
  const { root, protocolPath, archiveDir } = makeProject(content);
  try {
    const result = rotateProtocol(root, { capLines });
    assert.equal(result.rotated, true);
    assert.deepEqual(result.rolledMonths, ['2026-05']);

    const live = readFileSync(protocolPath, 'utf8');
    assert.equal(live, HEADER + jul + jun);
    assert.equal(existsSync(path.join(archiveDir, '2026-06.md')), false);
    assert.ok(existsSync(path.join(archiveDir, '2026-05.md')));
    assert.equal(readFileSync(path.join(archiveDir, '2026-05.md'), 'utf8').includes(may), true);
  } finally {
    cleanup(root);
  }
});

test('rotating an already-under-cap file a second time is a no-op (idempotent)', () => {
  const jul = entry('2026-07-03 14:20', 'July (current)');
  const jun = entry('2026-06-05 09:00', 'June (older)');
  const content = HEADER + jul + jun;
  const capLines = (HEADER + jul).match(/\n/g).length;
  const { root, protocolPath, archiveDir } = makeProject(content);
  try {
    const first = rotateProtocol(root, { capLines });
    assert.equal(first.rotated, true);
    const second = rotateProtocol(root, { capLines });
    assert.equal(second.rotated, false);
    assert.equal(readFileSync(protocolPath, 'utf8'), HEADER + jul);
    assert.equal(readFileSync(path.join(archiveDir, '2026-06.md'), 'utf8').includes(jun), true);
  } finally {
    cleanup(root);
  }
});

test('a missing protocol.md is a no-op, ok:true, nothing written', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-protorot-missing-'));
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  try {
    const result = rotateProtocol(root);
    assert.equal(result.ok, true);
    assert.equal(result.rotated, false);
    assert.deepEqual(result.changed, []);
  } finally {
    cleanup(root);
  }
});

// --- runCli / real invocation ---------------------------------------------

test('runCli rotates via an injected discoverRoot and rotateOpts', () => {
  const jul = entry('2026-07-03 14:20', 'July (current)');
  const jun = entry('2026-06-05 09:00', 'June (older)');
  const content = HEADER + jul + jun;
  const capLines = (HEADER + jul).match(/\n/g).length;
  const { root, protocolPath } = makeProject(content);
  try {
    const { exitCode, output } = runCli({ discoverRoot: () => root, rotateOpts: { capLines } });
    assert.equal(exitCode, 0);
    assert.equal(output.ok, true);
    assert.equal(output.rotated, true);
    assert.equal(readFileSync(protocolPath, 'utf8'), HEADER + jul);
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

test('the real `node lib/protocol-rotation.mjs` invocation prints the manifest and exits 0 (isMain + discoverRoot wiring)', () => {
  const jul = entry('2026-07-03 14:20', 'July (current)');
  const jun = entry('2026-06-05 09:00', 'June (older)');
  const content = HEADER + jul + jun;
  const { root } = makeProject(content);
  try {
    const out = execFileSync(process.execPath, [CLI_PATH], { cwd: root, encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.ok, true);
  } finally {
    cleanup(root);
  }
});
