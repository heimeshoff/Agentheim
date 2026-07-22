// Unit tests for lib/human-eye-criteria.mjs — the ADR-0061 falsifiability-gate
// lint (agentic-workflow-mxk6v). Covers: bullet parsing + marker detection,
// the all-human-eye / required-note predicate, loss-tolerance on an
// unparseable file, and the recurring live-tree gate (mirrors
// lib/id-grammar.mjs / lib/index-entry-length.mjs's final test): the real
// tree must have zero tasks whose criteria are all `[human-eye]` yet missing
// the required note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseAcceptanceCriteria,
  isAllHumanEye,
  findAllHumanEyeTasksMissingNote,
  HUMAN_EYE_MARKER_RE,
  REQUIRED_NOTE_RE,
  ADOPTION_DATE,
} from '../human-eye-criteria.mjs';

function scratchProject() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-humaneye-'));
  const bcDir = path.join(root, '.agentheim', 'contexts', 'widgets');
  return { root, bcDir };
}

// Default `created` is strictly after ADOPTION_DATE so tests exercise the
// "note required" branch by default; pass `created` explicitly to exercise
// the grandfather boundary.
function writeTask(dir, fileName, body, { created = '2026-07-22' } = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, fileName),
    `---\nid: ${fileName.replace(/\.md$/, '')}\ntitle: Filler\nstatus: todo\ntype: feature\n` +
      `context: widgets\ncreated: ${created}\ncompleted:\n---\n\n${body}`
  );
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// --- parseAcceptanceCriteria -------------------------------------------------

test('parses machine-checkable bullets with no marker', () => {
  const content = `## Acceptance criteria\n- [ ] The button is blue.\n- [ ] Clicking it fires an event.\n`;
  const criteria = parseAcceptanceCriteria(content);
  assert.equal(criteria.length, 2);
  assert.ok(criteria.every((c) => c.humanEye === false));
  assert.equal(criteria[0].text, 'The button is blue.');
});

test('parses a `[human-eye]` marked bullet, bold or plain', () => {
  const content =
    `## Acceptance criteria\n` +
    `- [ ] The slot visibly shows the captured frame. [human-eye]\n` +
    `- [ ] The animation feels smooth. **[human-eye]**\n`;
  const criteria = parseAcceptanceCriteria(content);
  assert.equal(criteria.length, 2);
  assert.ok(criteria.every((c) => c.humanEye === true));
});

test('a missing `## Acceptance criteria` section yields no criteria (loss-tolerant)', () => {
  const content = `## Why\nSome prose.\n\n## What\nMore prose.\n`;
  assert.deepEqual(parseAcceptanceCriteria(content), []);
});

test('stops parsing at the next `##` heading', () => {
  const content =
    `## Acceptance criteria\n- [ ] One.\n\n## Notes\n- [ ] Not a criterion, in Notes.\n`;
  const criteria = parseAcceptanceCriteria(content);
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].text, 'One.');
});

// --- isAllHumanEye ------------------------------------------------------------

test('isAllHumanEye is false for zero criteria', () => {
  assert.equal(isAllHumanEye([]), false);
});

test('isAllHumanEye is false when only some criteria are human-eye', () => {
  assert.equal(
    isAllHumanEye([
      { text: 'a', humanEye: true },
      { text: 'b', humanEye: false },
    ]),
    false
  );
});

test('isAllHumanEye is true when every criterion is human-eye', () => {
  assert.equal(
    isAllHumanEye([
      { text: 'a', humanEye: true },
      { text: 'b', humanEye: true },
    ]),
    true
  );
});

// --- HUMAN_EYE_MARKER_RE / REQUIRED_NOTE_RE -----------------------------------

test('HUMAN_EYE_MARKER_RE matches the marker case-insensitively', () => {
  assert.ok(HUMAN_EYE_MARKER_RE.test('- [ ] x. [HUMAN-EYE]'));
  assert.ok(!HUMAN_EYE_MARKER_RE.test('- [ ] no marker here'));
});

test('REQUIRED_NOTE_RE matches the builder-eye-only phrase case-insensitively', () => {
  assert.ok(REQUIRED_NOTE_RE.test('Verification is Builder-Eye Only — see ADR-0061.'));
  assert.ok(!REQUIRED_NOTE_RE.test('No note here.'));
});

// --- findAllHumanEyeTasksMissingNote: whole-tree walk -------------------------

test('flags a task whose criteria are all human-eye and has no builder-eye-only note', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-aaaaa.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n\n## Notes\nNothing relevant.\n`
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'widgets-aaaaa');
  cleanup(root);
});

test('does not flag an all-human-eye task that carries the required note', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-bbbbb.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n\n## Notes\n` +
      `Verification is builder-eye only — every acceptance criterion is human-eye (ADR-0061).\n`
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('does not flag a task with a mix of machine-checkable and human-eye criteria', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-ccccc.md',
    `## Acceptance criteria\n- [ ] It compiles.\n- [ ] It looks right. [human-eye]\n`
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('does not flag a fully machine-checkable task', () => {
  const { root, bcDir } = scratchProject();
  writeTask(path.join(bcDir, 'todo'), 'widgets-ddddd.md', `## Acceptance criteria\n- [ ] It compiles.\n`);
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('an unparseable/unreadable file never aborts the walk (loss-tolerant)', () => {
  const { root, bcDir } = scratchProject();
  // A directory listing that includes a stray non-.md-readable path is not
  // constructible via writeTask; instead prove a genuinely empty todo/ dir,
  // plus a well-formed sibling, both walk cleanly.
  mkdirSync(path.join(bcDir, 'todo'), { recursive: true });
  writeTask(path.join(bcDir, 'backlog'), 'widgets-eeeee.md', `## Why\nNo acceptance criteria section yet.\n`);
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('walks every BC and every scanned lifecycle folder (todo/doing/done)', () => {
  const { root, bcDir } = scratchProject();
  const otherBcDir = path.join(root, '.agentheim', 'contexts', 'gadgets');
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-fffff.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n`
  );
  writeTask(
    path.join(otherBcDir, 'doing'),
    'gadgets-ggggg.md',
    `## Acceptance criteria\n- [ ] It feels right. [human-eye]\n`
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.equal(violations.length, 2);
  const ids = violations.map((v) => v.id).sort();
  assert.deepEqual(ids, ['gadgets-ggggg', 'widgets-fffff']);
  cleanup(root);
});

// --- scope: backlog/ residents are legal without the note by design --------

test('does not flag an all-human-eye, note-less task sitting in backlog/', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'backlog'),
    'widgets-hhhhh.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n`
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

// --- ADOPTION_DATE grandfathering, mirroring lib/spike-stop-loss.mjs -------

test('does not flag an all-human-eye, note-less task created ON the adoption date (grandfathered boundary)', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-iiiii.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n`,
    { created: ADOPTION_DATE }
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('flags an all-human-eye, note-less task created strictly AFTER the adoption date', () => {
  const { root, bcDir } = scratchProject();
  writeTask(
    path.join(bcDir, 'todo'),
    'widgets-jjjjj.md',
    `## Acceptance criteria\n- [ ] It looks right. [human-eye]\n`,
    { created: '2026-07-22' }
  );
  const violations = findAllHumanEyeTasksMissingNote(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'widgets-jjjjj');
  cleanup(root);
});

// --- the recurring live-tree gate --------------------------------------------
// Mirrors lib/id-grammar.mjs's / lib/index-entry-length.mjs's final test: the
// LIVE .agentheim/ tree must have zero tasks whose criteria are all
// `[human-eye]` yet missing the required note. Trivially true today since no
// task on disk uses the marker yet — this is the gate that keeps it true
// going forward.

test('the live .agentheim/ tree has NO all-human-eye tasks missing the builder-eye-only note', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findAllHumanEyeTasksMissingNote(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected no all-human-eye tasks missing the note, found: ${violations.map((v) => v.id).join(', ')}`
  );
});
