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
  recognizeMachineShape,
  partitionUntrailedCommits,
  formatChurnSummaryLine,
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

// --- recognizeMachineShape (agentic-workflow-pzacx, ADR-0066 consumer-tuning amendment) ---
// One test per references/commit-doctrine.md known trailer-less machine shape, including
// `modeling` CONSOLIDATE (the audit-found omission) and `research` (the iteration-1 verifier
// finding this iteration fixes), so a genuinely human commit is the only thing left unrecognized.

test('recognizeMachineShape recognizes a `modeling` DISMISS commit', () => {
  assert.equal(
    recognizeMachineShape('chore(agentic-workflow): dismiss agentic-workflow-abcde'),
    'modeling DISMISS'
  );
});

test('recognizeMachineShape recognizes a `modeling` DISMISS cascade-set commit', () => {
  assert.equal(
    recognizeMachineShape('chore(agentic-workflow): dismiss agentic-workflow-abcde, agentic-workflow-fghij'),
    'modeling DISMISS'
  );
});

test('recognizeMachineShape recognizes a `modeling` CONSOLIDATE commit', () => {
  assert.equal(
    recognizeMachineShape('model(agentic-workflow): consolidate agentic-workflow README'),
    'modeling CONSOLIDATE'
  );
});

test('recognizeMachineShape recognizes a `brainstorm` session commit scoped to a BC', () => {
  assert.equal(
    recognizeMachineShape('chore(agentic-workflow): brainstorm session reconciliation — vision extended'),
    'brainstorm'
  );
});

test('recognizeMachineShape recognizes a `brainstorm` session commit with the global (no-BC) scope token dropped', () => {
  assert.equal(
    recognizeMachineShape('chore: brainstorm project foundations — vision created'),
    'brainstorm'
  );
});

test('recognizeMachineShape recognizes a `research` commit scoped to a BC', () => {
  assert.equal(
    recognizeMachineShape('chore(agentic-workflow): research session-start-churn-tuning'),
    'research'
  );
});

test('recognizeMachineShape recognizes a `research` commit with the global (no-BC) scope token dropped', () => {
  assert.equal(recognizeMachineShape('chore: research cross-cutting-observability'), 'research');
});

test('recognizeMachineShape recognizes `work`\'s bare reconcile-stranded fallback commit', () => {
  assert.equal(
    recognizeMachineShape('chore: reconcile stranded protocol.md edit'),
    'reconcile stranded carry-over'
  );
});

test('recognizeMachineShape recognizes `work`\'s bare session-end-bookkeeping fallback commit', () => {
  assert.equal(recognizeMachineShape('chore: work session end bookkeeping'), 'session-end bookkeeping');
});

test('recognizeMachineShape recognizes `work`\'s bare protocol-rotation fallback commit', () => {
  assert.equal(
    recognizeMachineShape('chore: rotate protocol — 2026-05, 2026-06'),
    'protocol rotation'
  );
});

test('recognizeMachineShape recognizes `work`\'s bare INDEX done-list-rotation fallback commit', () => {
  assert.equal(
    recognizeMachineShape('chore: rotate INDEX done-list — agentic-workflow:2026-06'),
    'INDEX done-list rotation'
  );
});

test('recognizeMachineShape returns null for a genuinely human commit', () => {
  assert.equal(recognizeMachineShape('Fix typo in README'), null);
});

test('recognizeMachineShape returns null for empty/missing input', () => {
  assert.equal(recognizeMachineShape(''), null);
  assert.equal(recognizeMachineShape(undefined), null);
});

// --- recognizeMachineShape: agentic-workflow-m7xva additions (trailer-less batch-capture,
// release-flow shapes) — three real historical subjects the shape table was missing.

test('recognizeMachineShape recognizes a trailer-less batch-capture summary commit (2e2b241)', () => {
  assert.equal(
    recognizeMachineShape('chore(agentic-workflow): capture 10 post-Dorc consistency-audit follow-up tasks'),
    'batch-capture summary'
  );
});

test('recognizeMachineShape recognizes a release manifest bump commit (2ac05bc)', () => {
  assert.equal(recognizeMachineShape('chore(release): v0.9.2'), 'release manifest bump');
});

test('recognizeMachineShape recognizes a release protocol-record commit carrying the [work] pseudo-trailer (a328700)', () => {
  assert.equal(
    recognizeMachineShape('chore(protocol): record v0.9.2 release shipped [work]'),
    'release protocol record'
  );
});

test('recognizeMachineShape recognizes a release protocol-record commit with the optional parenthetical aside', () => {
  assert.equal(
    recognizeMachineShape('chore(protocol): record v0.8.2 release shipped (merge to main + tag pushed) [work]'),
    'release protocol record'
  );
});

// --- partitionUntrailedCommits ---

test('partitionUntrailedCommits splits recognized machine shapes from human commits', () => {
  const untrailed = [
    { sha: 'aaa0001', subject: 'chore(agentic-workflow): dismiss agentic-workflow-old01', files: [] },
    { sha: 'bbb0002', subject: 'Fix typo in README', files: ['README.md'] },
    {
      sha: 'ccc0003',
      subject: 'model(agentic-workflow): consolidate agentic-workflow README',
      files: ['.agentheim/contexts/agentic-workflow/README.md'],
    },
  ];
  const { recognized, human } = partitionUntrailedCommits(untrailed);
  assert.equal(recognized.length, 2);
  assert.equal(human.length, 1);
  assert.equal(human[0].sha, 'bbb0002');
  assert.equal(recognized[0].shape, 'modeling DISMISS');
  assert.equal(recognized[1].shape, 'modeling CONSOLIDATE');
});

test('partitionUntrailedCommits handles an empty/missing list', () => {
  assert.deepEqual(partitionUntrailedCommits([]), { recognized: [], human: [] });
  assert.deepEqual(partitionUntrailedCommits(undefined), { recognized: [], human: [] });
});

test('partitionUntrailedCommits partitions the three real historical missed-shape subjects (agentic-workflow-m7xva) as machine, not human', () => {
  const untrailed = [
    {
      sha: '2e2b241',
      subject: 'chore(agentic-workflow): capture 10 post-Dorc consistency-audit follow-up tasks',
      files: [],
    },
    { sha: '2ac05bc', subject: 'chore(release): v0.9.2', files: ['.claude-plugin/plugin.json', 'CHANGELOG.md'] },
    {
      sha: 'a328700',
      subject: 'chore(protocol): record v0.9.2 release shipped [work]',
      files: ['.agentheim/knowledge/protocol.md'],
    },
  ];
  const { recognized, human } = partitionUntrailedCommits(untrailed);
  assert.equal(human.length, 0);
  assert.equal(recognized.length, 3);
  assert.equal(recognized[0].shape, 'batch-capture summary');
  assert.equal(recognized[1].shape, 'release manifest bump');
  assert.equal(recognized[2].shape, 'release protocol record');
});

// --- formatChurnSummaryLine ---

test('formatChurnSummaryLine reports both counts', () => {
  const partition = {
    recognized: [{ sha: 'aaa0001', subject: 'chore: work session end bookkeeping', files: [], shape: 'session-end bookkeeping' }],
    human: [
      { sha: 'bbb0002', subject: 'Fix typo in README', files: ['README.md'] },
      { sha: 'ccc0003', subject: 'Quick edit', files: ['lib/vacuum-guard.mjs'] },
    ],
  };
  assert.equal(formatChurnSummaryLine(partition), '1 recognized machine-shape commits, 2 human commits');
});

test('formatChurnSummaryLine reports zero/zero when nothing is untrailed', () => {
  assert.equal(
    formatChurnSummaryLine({ recognized: [], human: [] }),
    '0 recognized machine-shape commits, 0 human commits'
  );
});
