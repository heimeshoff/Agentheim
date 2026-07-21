// Unit tests for the vacuum guard's deterministic half (agentic-workflow-
// qz1h7): vision.md open-question extraction/aging and session-end
// batch-mix classification. The judgment half — deciding when to invoke the
// guard's wording and how to frame the recommendation to the builder — is
// NOT unit-testable prose; it lives in skills/work/SKILL.md's "Vacuum
// guard" section and skills/modeling/SKILL.md's Opening flow step 2. See
// ADR-0064.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractOpenQuestions,
  ageInDays,
  isVacuum,
  formatVacuumGuardLine,
  classifyTask,
  classifyBatch,
  formatBatchMixLine,
} from '../vacuum-guard.mjs';

const SAMPLE_VISION = `# Vision

## Purpose

Some purpose text.

## Open questions

- **Brainstorm on existing code (next iteration).** (open since 2026-06-05) When
  \`brainstorm\` is invoked in a folder that already contains code, reverse-engineer a
  best-guess vision first.
- ~~**Branch/registry merge gap.**~~ *Resolved 2026-06-07.* Closed.

## Ubiquitous language (seed)

- Term one.
`;

// --- extractOpenQuestions ---

test('extractOpenQuestions returns only unresolved items', () => {
  const items = extractOpenQuestions(SAMPLE_VISION);
  assert.equal(items.length, 1);
  assert.match(items[0].text, /Brainstorm on existing code/);
});

test('extractOpenQuestions parses the "(open since YYYY-MM-DD)" annotation', () => {
  const items = extractOpenQuestions(SAMPLE_VISION);
  assert.equal(items[0].since, '2026-06-05');
});

test('extractOpenQuestions returns since: null when the annotation is absent', () => {
  const text = `## Open questions\n\n- **No date item.** Some prose.\n`;
  const items = extractOpenQuestions(text);
  assert.equal(items[0].since, null);
});

test('extractOpenQuestions returns [] when there are no open questions', () => {
  const text = `## Open questions\n\n- ~~**Done thing.**~~ *Resolved 2026-01-01.*\n`;
  assert.deepEqual(extractOpenQuestions(text), []);
});

test('extractOpenQuestions returns [] when the heading is absent', () => {
  assert.deepEqual(extractOpenQuestions('# Vision\n\n## Purpose\n\nText.\n'), []);
});

// --- ageInDays ---

test('ageInDays computes whole days between since and now', () => {
  const now = new Date('2026-07-21T09:00:00Z');
  assert.equal(ageInDays('2026-06-05', now), 46);
});

test('ageInDays is 0 for a date equal to now', () => {
  const now = new Date('2026-07-21T09:00:00Z');
  assert.equal(ageInDays('2026-07-21', now), 0);
});

test('ageInDays returns null for a missing date', () => {
  assert.equal(ageInDays(null), null);
  assert.equal(ageInDays(undefined), null);
});

test('ageInDays returns null for a malformed date', () => {
  assert.equal(ageInDays('not-a-date'), null);
});

// --- isVacuum ---

test('isVacuum is true only when the ready set is empty and questions exist', () => {
  assert.equal(isVacuum(0, [{ text: 'x', since: null }]), true);
  assert.equal(isVacuum(1, [{ text: 'x', since: null }]), false);
  assert.equal(isVacuum(0, []), false);
  assert.equal(isVacuum(0, undefined), false);
});

// --- formatVacuumGuardLine ---

test('formatVacuumGuardLine reports "none" for an empty question set', () => {
  assert.equal(formatVacuumGuardLine([]), 'none — no open vision decisions');
  assert.equal(formatVacuumGuardLine(undefined), 'none — no open vision decisions');
});

test('formatVacuumGuardLine names the item and its age', () => {
  const now = new Date('2026-07-21T09:00:00Z');
  const line = formatVacuumGuardLine(
    [{ text: '**Brainstorm on existing code (next iteration).** (open since 2026-06-05) more text', since: '2026-06-05' }],
    now
  );
  assert.equal(line, 'Brainstorm on existing code (next iteration). (open 46 days)');
});

test('formatVacuumGuardLine renders singular "day" for age 1', () => {
  const now = new Date('2026-06-06T09:00:00Z');
  const line = formatVacuumGuardLine([{ text: '**X.** y', since: '2026-06-05' }], now);
  assert.equal(line, 'X. (open 1 day)');
});

test('formatVacuumGuardLine falls back when no since date is recorded', () => {
  const line = formatVacuumGuardLine([{ text: '**X.** y', since: null }]);
  assert.equal(line, 'X. (open — since date not recorded)');
});

test('formatVacuumGuardLine joins multiple items with "; "', () => {
  const now = new Date('2026-07-21T09:00:00Z');
  const line = formatVacuumGuardLine(
    [
      { text: '**A.** a', since: '2026-06-05' },
      { text: '**B.** b', since: '2026-07-20' },
    ],
    now
  );
  assert.equal(line, 'A. (open 46 days); B. (open 1 day)');
});

// --- classifyTask ---

test('classifyTask: chore with only bookkeeping-surface files is bookkeeping', () => {
  const result = classifyTask({
    type: 'chore',
    files: ['C:\\src\\project\\.agentheim\\knowledge\\protocol.md'],
  });
  assert.equal(result, 'bookkeeping');
});

test('classifyTask: chore touching an INDEX.md is bookkeeping', () => {
  const result = classifyTask({
    type: 'chore',
    files: ['/repo/.agentheim/contexts/agentic-workflow/INDEX.md'],
  });
  assert.equal(result, 'bookkeeping');
});

test('classifyTask: chore that also touches a non-bookkeeping file is harness', () => {
  const result = classifyTask({
    type: 'chore',
    files: ['/repo/.agentheim/knowledge/protocol.md', '/repo/skills/work/SKILL.md'],
  });
  assert.equal(result, 'harness');
});

test('classifyTask: chore with no files is harness (nothing to prove bookkeeping-only)', () => {
  assert.equal(classifyTask({ type: 'chore', files: [] }), 'harness');
  assert.equal(classifyTask({ type: 'chore' }), 'harness');
});

test('classifyTask: feature is product-facing regardless of files', () => {
  assert.equal(classifyTask({ type: 'feature', files: ['/repo/skills/work/SKILL.md'] }), 'product-facing');
});

test('classifyTask: decision is product-facing', () => {
  assert.equal(classifyTask({ type: 'decision', files: ['/repo/.agentheim/knowledge/decisions/0064-x.md'] }), 'product-facing');
});

test('classifyTask: refactor and spike default to harness', () => {
  assert.equal(classifyTask({ type: 'refactor', files: ['/repo/lib/x.mjs'] }), 'harness');
  assert.equal(classifyTask({ type: 'spike', files: [] }), 'harness');
});

test('classifyTask: recognizes Windows and POSIX path separators alike', () => {
  assert.equal(classifyTask({ type: 'chore', files: ['C:\\repo\\.agentheim\\state\\whats-next.md'] }), 'bookkeeping');
  assert.equal(classifyTask({ type: 'chore', files: ['/repo/.agentheim/state/whats-next.md'] }), 'bookkeeping');
});

// --- classifyBatch / formatBatchMixLine ---

test('classifyBatch tallies each bucket', () => {
  const { counts, total } = classifyBatch([
    { type: 'feature', files: ['/repo/skills/x.md'] },
    { type: 'refactor', files: ['/repo/lib/x.mjs'] },
    { type: 'chore', files: ['/repo/.agentheim/knowledge/protocol.md'] },
  ]);
  assert.deepEqual(counts, { 'product-facing': 1, harness: 1, bookkeeping: 1 });
  assert.equal(total, 3);
});

test('formatBatchMixLine reports "none" for an empty batch', () => {
  assert.equal(formatBatchMixLine([]), 'none — no tasks completed this session');
});

test('formatBatchMixLine formats percentages and the task count', () => {
  const line = formatBatchMixLine([
    { type: 'feature', files: [] },
    { type: 'feature', files: [] },
    { type: 'refactor', files: [] },
    { type: 'chore', files: ['/repo/.agentheim/knowledge/protocol.md'] },
  ]);
  assert.equal(line, '50% product-facing / 25% harness / 25% bookkeeping (4 tasks)');
});

test('formatBatchMixLine singular "task" for a batch of one', () => {
  const line = formatBatchMixLine([{ type: 'feature', files: [] }]);
  assert.equal(line, '100% product-facing / 0% harness / 0% bookkeeping (1 task)');
});
