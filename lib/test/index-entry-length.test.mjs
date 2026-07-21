// Unit tests for lib/index-entry-length.mjs — the ADR-0060 INDEX
// entry-length-cap lint (agentic-workflow-ngzwz). Covers: word-count
// extraction across both on-disk bullet shapes (per-BC `- **id** — prose —
// \`pointer\`` and top-level adr-global's `- **ADR-NNNN — title** (date,
// status) — prose — \`pointer\``), the date-based grandfather boundary (on/
// before ADOPTION_DATE never flagged, strictly after IS flagged when over
// cap), loss-tolerance on an unreadable/undated linked file, and the
// recurring live-tree gate (mirrors lib/id-grammar.mjs's final test): the
// real tree must have zero non-grandfathered over-length entries today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findOverLengthEntriesInIndex,
  findOverLengthIndexEntries,
  ADOPTION_DATE,
  MAX_WORDS,
} from '../index-entry-length.mjs';

function words(n, prefix = 'w') {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

function makeTaskFile(dir, fileName, { created = '2026-01-01', completed = '' } = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, fileName),
    `---\nid: ${fileName.replace(/\.md$/, '')}\ntitle: Filler\nstatus: done\ntype: feature\n` +
      `context: widgets\ncreated: ${created}\ncompleted: ${completed}\n---\n\n## Why\n\nFiller.\n`
  );
}

function makeAdrFile(dir, fileName, date) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, fileName),
    `---\nid: ADR-9999\ntitle: Filler ADR\nscope: widgets\nstatus: accepted\ndate: ${date}\n---\n\n# Filler\n`
  );
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

function scratchProject() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-idxlen-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', 'widgets');
  mkdirSync(bcDir, { recursive: true });
  return { root, bcDir };
}

function indexWithDoneList(entries) {
  return (
    `# Widgets — Index\n\n<!-- done-list:start -->\n` +
    entries.map((e) => `${e}\n`).join('') +
    `<!-- done-list:end -->\n`
  );
}

function indexWithAdrLocal(entries) {
  return (
    `# Widgets — Index\n\n<!-- adr-local:start -->\n` +
    entries.map((e) => `${e}\n`).join('') +
    `<!-- adr-local:end -->\n`
  );
}

// --- entry parsing + word count ---------------------------------------------

test('an under-cap prose entry is never flagged, regardless of date', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'done'), 'widgets-aaaaa.md', { completed: '2026-08-01' });
  const line = `- **widgets-aaaaa** — ${words(10)} (feature) — \`done/widgets-aaaaa.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('an over-cap prose entry dated STRICTLY AFTER adoption is flagged', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'done'), 'widgets-bbbbb.md', { completed: '2026-08-01' });
  const line = `- **widgets-bbbbb** — ${words(MAX_WORDS + 10)} (feature) — \`done/widgets-bbbbb.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'widgets-bbbbb');
  assert.equal(violations[0].section, 'done-list');
  assert.ok(violations[0].words > MAX_WORDS);
  cleanup(root);
});

test('an over-cap prose entry dated ON adoption date is grandfathered (boundary is inclusive)', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'done'), 'widgets-ccccc.md', { completed: ADOPTION_DATE });
  const line = `- **widgets-ccccc** — ${words(MAX_WORDS + 10)} (feature) — \`done/widgets-ccccc.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('an over-cap prose entry dated well BEFORE adoption is grandfathered', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'done'), 'widgets-ddddd.md', { completed: '2026-05-01' });
  const line = `- **widgets-ddddd** — ${words(MAX_WORDS + 50)} (feature) — \`done/widgets-ddddd.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('an over-cap entry whose linked task file is unreadable is loss-tolerantly NOT flagged (can\'t tell -> grandfathered)', () => {
  const { root, bcDir } = scratchProject();
  // Deliberately no `done/widgets-eeeee.md` file on disk.
  const line = `- **widgets-eeeee** — ${words(MAX_WORDS + 10)} (feature) — \`done/widgets-eeeee.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('the todo/doing/backlog sections use the linked task\'s `created` date when `completed` is blank', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'todo'), 'widgets-fffff.md', { created: '2026-09-01', completed: '' });
  const content =
    `# Widgets — Index\n\n<!-- todo-list:start -->\n` +
    `- **widgets-fffff** — ${words(MAX_WORDS + 10)} (feature) — \`todo/widgets-fffff.md\`\n` +
    `<!-- todo-list:end -->\n`;
  writeFileSync(path.join(bcDir, 'INDEX.md'), content);
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].date, '2026-09-01');
  cleanup(root);
});

// --- ADR line parsing, both on-disk shapes ----------------------------------

test('per-BC adr-local shape (`- **ADR-NNNN** — prose — pointer`) is parsed and dated from the ADR\'s `date` field', () => {
  const { root, bcDir } = scratchProject();
  const decisionsDir = path.join(root, '.agentheim', 'knowledge', 'decisions');
  makeAdrFile(decisionsDir, '9999-filler.md', '2026-09-05');
  const line = `- **ADR-9999** — ${words(MAX_WORDS + 20)} — \`../../knowledge/decisions/9999-filler.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithAdrLocal([line]));
  const violations = findOverLengthEntriesInIndex(path.join(bcDir, 'INDEX.md'), bcDir);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'ADR-9999');
  assert.equal(violations[0].section, 'adr-local');
  assert.equal(violations[0].date, '2026-09-05');
  cleanup(root);
});

test('top-level adr-global shape (`- **ADR-NNNN — title** (date, status) — prose — pointer`) is parsed correctly', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-idxlen-'));
  const knowledgeDir = path.join(root, '.agentheim', 'knowledge');
  const decisionsDir = path.join(knowledgeDir, 'decisions');
  makeAdrFile(decisionsDir, '9999-filler.md', '2026-09-10');
  const line =
    `- **ADR-9999 — A rather elaborate title with its own — em dash inside** ` +
    `(2026-09-10, accepted) — ${words(MAX_WORDS + 20)} — \`knowledge/decisions/9999-filler.md\``;
  const content = `# Index\n\n<!-- adr-global:start -->\n${line}\n<!-- adr-global:end -->\n`;
  writeFileSync(path.join(knowledgeDir, 'index.md'), content);
  const violations = findOverLengthEntriesInIndex(
    path.join(knowledgeDir, 'index.md'),
    path.join(root, '.agentheim')
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'ADR-9999');
  assert.equal(violations[0].section, 'adr-global');
  assert.equal(violations[0].date, '2026-09-10');
  cleanup(root);
});

// --- findOverLengthIndexEntries: whole-tree walk ----------------------------

test('findOverLengthIndexEntries walks every BC INDEX.md plus the top-level index.md', () => {
  const { root, bcDir } = scratchProject();
  makeTaskFile(path.join(bcDir, 'done'), 'widgets-ggggg.md', { completed: '2026-09-01' });
  const line = `- **widgets-ggggg** — ${words(MAX_WORDS + 10)} (feature) — \`done/widgets-ggggg.md\``;
  writeFileSync(path.join(bcDir, 'INDEX.md'), indexWithDoneList([line]));
  const violations = findOverLengthIndexEntries(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'widgets-ggggg');
  cleanup(root);
});

// --- the recurring live-tree gate -------------------------------------------
// Mirrors lib/id-grammar.mjs's final test: the LIVE .agentheim/ tree must
// have zero non-grandfathered over-length INDEX entries. This is what keeps
// the lint green today despite the many pre-existing long entries (all
// grandfathered by date) that motivated this task in the first place.

test('the live .agentheim/ tree has NO non-grandfathered over-length INDEX entries', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findOverLengthIndexEntries(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected no over-length new entries, found: ${violations
      .map((v) => `${v.file}#${v.section}:${v.id} (${v.words}w, ${v.date})`)
      .join('; ')}`
  );
});
