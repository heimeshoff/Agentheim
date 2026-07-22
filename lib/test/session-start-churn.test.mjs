// Unit tests for work's session-start human-churn reconciliation (agentic-
// workflow-hhjjx — Dorc July-2026 review recommendation A6, mirror image of
// agentic-workflow-d6q4h's session-END carry-over reconciliation). See
// ADR-0066 and skills/work/SKILL.md's "Session-start human-churn
// reconciliation" section. The judgment half — which touched files count as
// "governed", and how to phrase the builder-facing recommendation — is NOT
// unit-testable prose; it lives in skill prose. This file covers only the
// deterministic trailer-parsing / commit-range-resolution half.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSinceLastSessionEnd,
  parseCommitLog,
  hasTaskTrailer,
  findUntrailedCommits,
  formatUntrailedCommitLine,
  formatHumanChurnSummary,
} from '../session-start-churn.mjs';

// --- resolveSinceLastSessionEnd ---

test('resolveSinceLastSessionEnd finds the most recent session-end heading', () => {
  const protocolText = `# Protocol

## 2026-07-21 14:32 -- Work session ended

**Type:** Work / Session end

---

## 2026-07-20 09:10 -- Work session ended

**Type:** Work / Session end

---
`;
  const result = resolveSinceLastSessionEnd(protocolText);
  assert.deepEqual(result, {
    since: '2026-07-21 14:32',
    heading: '## 2026-07-21 14:32 -- Work session ended',
  });
});

test('resolveSinceLastSessionEnd returns null with no prior session-end entry (fresh project)', () => {
  const protocolText = `# Protocol

## 2026-07-21 14:32 -- Task verified and completed: agentic-workflow-abcde - [Some task]

**Type:** Work / Task completion

---
`;
  assert.equal(resolveSinceLastSessionEnd(protocolText), null);
});

test('resolveSinceLastSessionEnd returns null for empty/missing input', () => {
  assert.equal(resolveSinceLastSessionEnd(''), null);
  assert.equal(resolveSinceLastSessionEnd(undefined), null);
});

test('resolveSinceLastSessionEnd resolves a vacuum-guard exit\'s minimal session-end entry (agentic-workflow-c5nvb)', () => {
  // A vacuum-guard exit (skills/work/SKILL.md Phase 2 step 8) writes a cheap,
  // minimal "## ... -- Work session ended" entry instead of the full
  // end-of-run template, purely to give this reconciliation a boundary. This
  // proves the heading regex resolves that minimal shape exactly the same as
  // a full entry — the boundary works even with almost no body underneath it.
  const protocolText = `# Protocol

## 2026-07-22 10:00 -- Work session ended

**Type:** Work / Session end
**Completed:** 0 — vacuum guard exit (no ready tasks; open item(s) surfaced above)

---
`;
  const result = resolveSinceLastSessionEnd(protocolText);
  assert.deepEqual(result, {
    since: '2026-07-22 10:00',
    heading: '## 2026-07-22 10:00 -- Work session ended',
  });
});

// --- parseCommitLog ---

const SAMPLE_LOG =
  '\x1eCOMMIT\x1fd36d6b82\x1fchore(agentic-workflow): batch start [agentic-workflow-hhjjx]\n' +
  '\n' +
  '.agentheim/contexts/agentic-workflow/INDEX.md\n' +
  '.agentheim/knowledge/protocol.md\n' +
  '\x1eCOMMIT\x1fabc1234\x1fFix typo in README\n' +
  '\n' +
  '.agentheim/contexts/agentic-workflow/README.md\n' +
  '\x1eCOMMIT\x1fdef5678\x1ffeature(agentic-workflow): thing [agentic-workflow-rx630] [agentic-workflow-qz1h7]\n' +
  '\n' +
  'lib/spike-stop-loss.mjs\n' +
  'skills/work/SKILL.md\n';

test('parseCommitLog parses the documented git log shape into structured commits', () => {
  const commits = parseCommitLog(SAMPLE_LOG);
  assert.equal(commits.length, 3);
  assert.deepEqual(commits[0], {
    sha: 'd36d6b82',
    subject: 'chore(agentic-workflow): batch start [agentic-workflow-hhjjx]',
    files: ['.agentheim/contexts/agentic-workflow/INDEX.md', '.agentheim/knowledge/protocol.md'],
  });
  assert.deepEqual(commits[1], {
    sha: 'abc1234',
    subject: 'Fix typo in README',
    files: ['.agentheim/contexts/agentic-workflow/README.md'],
  });
  assert.deepEqual(commits[2].files, ['lib/spike-stop-loss.mjs', 'skills/work/SKILL.md']);
});

test('parseCommitLog returns [] for empty input', () => {
  assert.deepEqual(parseCommitLog(''), []);
  assert.deepEqual(parseCommitLog(undefined), []);
});

test('parseCommitLog is loss-tolerant of a malformed block (no header parts)', () => {
  const malformed = '\x1eNOT-A-COMMIT-BLOCK\n\nsome-file.md\n';
  assert.deepEqual(parseCommitLog(malformed), []);
});

test('parseCommitLog handles a commit with no touched files', () => {
  const log = '\x1eCOMMIT\x1fabc0000\x1fEmpty commit message only\n\n';
  const commits = parseCommitLog(log);
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, []);
});

// --- hasTaskTrailer ---

test('hasTaskTrailer is true for a single [<task-id>] trailer', () => {
  assert.equal(hasTaskTrailer('feature(agentic-workflow): thing [agentic-workflow-hhjjx]'), true);
});

test('hasTaskTrailer is true for a trivial-squash wave with multiple trailers', () => {
  assert.equal(hasTaskTrailer('chore(bc): tweak [id-1] [id-2] [id-3]'), true);
});

test('hasTaskTrailer is false for a subject with no bracketed trailer', () => {
  assert.equal(hasTaskTrailer('Fix typo in README'), false);
});

test('hasTaskTrailer is false for empty/missing input', () => {
  assert.equal(hasTaskTrailer(''), false);
  assert.equal(hasTaskTrailer(undefined), false);
});

// --- findUntrailedCommits ---

test('findUntrailedCommits filters to only commits missing a task-id trailer', () => {
  const commits = parseCommitLog(SAMPLE_LOG);
  const untrailed = findUntrailedCommits(commits);
  assert.equal(untrailed.length, 1);
  assert.equal(untrailed[0].sha, 'abc1234');
});

test('findUntrailedCommits returns [] for an empty/missing list', () => {
  assert.deepEqual(findUntrailedCommits([]), []);
  assert.deepEqual(findUntrailedCommits(undefined), []);
});

// --- formatUntrailedCommitLine ---

test('formatUntrailedCommitLine shapes a short sha, the subject, and its files', () => {
  const line = formatUntrailedCommitLine({
    sha: 'abc1234567890',
    subject: 'Fix typo in README',
    files: ['.agentheim/contexts/agentic-workflow/README.md'],
  });
  assert.equal(line, 'abc1234 Fix typo in README — .agentheim/contexts/agentic-workflow/README.md');
});

test('formatUntrailedCommitLine handles a commit with no recorded files', () => {
  const line = formatUntrailedCommitLine({ sha: 'abc1234', subject: 'Empty commit', files: [] });
  assert.equal(line, 'abc1234 Empty commit — (no files recorded)');
});

// --- formatHumanChurnSummary ---

test('formatHumanChurnSummary reports "none" when every commit since last session end carries a trailer', () => {
  assert.equal(
    formatHumanChurnSummary([]),
    'none — no commits without a task-id trailer since the last session end'
  );
});

test('formatHumanChurnSummary joins one line per untrailed commit', () => {
  const untrailed = [
    { sha: 'abc1234', subject: 'Fix typo in README', files: ['README.md'] },
    { sha: 'def5678', subject: 'Quick edit', files: ['lib/vacuum-guard.mjs'] },
  ];
  const summary = formatHumanChurnSummary(untrailed);
  assert.equal(
    summary,
    'abc1234 Fix typo in README — README.md\ndef5678 Quick edit — lib/vacuum-guard.mjs'
  );
});
