// Tests for lib/worker-result.mjs — mechanized parsing of a worker's strict
// RESULT block, including the four SUCCESS blocks agentic-workflow-ghcaj
// adds (README_DELTA / ADRS / OUTCOME / BACKLOG_ITEMS). Pure, no filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseWorkerResult, resultSidecarRelativePath, unescapeNotificationCopy, selectResultSource } from '../worker-result.mjs';

const HEADER_FIELDS = [
  'TASK_ID: agentic-workflow-ghcaj',
  'SUMMARY: Did the thing well.',
  'FILES_CHANGED: 2',
  'FILE_LIST: /repo/lib/foo.mjs, /repo/lib/test/foo.test.mjs',
  'ADRS_WRITTEN: none',
  'TESTS_ADDED: 3',
  'TESTS_PASSING: yes',
  'TDD_SKIPPED: no',
  'CONCEPT_CANDIDATE: none',
];

function successText({ readmeDelta = '[]', adrs = '', outcome = '## Outcome\n\nDid the thing.', backlogItems = '', trailer = '' } = {}) {
  return [
    'RESULT: SUCCESS',
    ...HEADER_FIELDS,
    '',
    '````README_DELTA',
    readmeDelta,
    '````',
    '',
    '````ADRS',
    adrs,
    '````',
    '',
    '````OUTCOME',
    outcome,
    '````',
    '',
    '````BACKLOG_ITEMS',
    backlogItems,
    '````',
    ...(trailer ? ['', trailer] : []),
  ].join('\n');
}

/** The trailing header repeat ADR-0080 §2 mandates on SUCCESS — the `RESULT: SUCCESS` line plus the nine fields, optionally overridden field-by-field. */
function trailingHeaderBlock(overrides = {}) {
  const fields = { ...Object.fromEntries(HEADER_FIELDS.map((l) => l.split(/: (.*)/s).slice(0, 2))), ...overrides };
  return ['RESULT: SUCCESS', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`)].join('\n');
}

// ---- SUCCESS: happy path ----

test('parses a SUCCESS block with all four fenced blocks, an empty README_DELTA', () => {
  const result = parseWorkerResult(successText());
  assert.equal(result.ok, true);
  assert.equal(result.result, 'SUCCESS');
  assert.equal(result.fields.TASK_ID, 'agentic-workflow-ghcaj');
  assert.equal(result.fields.TESTS_PASSING, 'yes');
  assert.deepEqual(result.blocks.readmeDelta, []);
  assert.deepEqual(result.blocks.adrs, []);
  assert.equal(result.blocks.outcome, '## Outcome\n\nDid the thing.');
  assert.deepEqual(result.blocks.backlogItems, []);
});

test('parses a non-empty README_DELTA JSON array', () => {
  const delta = JSON.stringify([
    { document: 'README.md', section: 'Ubiquitous language', ops: [{ op: 'append', body: '- **X** — a term.' }] },
  ]);
  const result = parseWorkerResult(successText({ readmeDelta: delta }));
  assert.equal(result.ok, true);
  assert.equal(result.blocks.readmeDelta.length, 1);
  assert.equal(result.blocks.readmeDelta[0].section, 'Ubiquitous language');
  assert.equal(result.blocks.readmeDelta[0].ops[0].op, 'append');
});

test('parses an ADR body that itself contains a fenced (triple-backtick) code block', () => {
  const adrBody =
    '---\nid: ADR-0099\ntitle: Example\n---\n\n# ADR-0099: Example\n\n## Decision\n\n```js\nconst x = 1;\n```\n\nDone.';
  const adrsBlock = `<!-- ADR: 0099-example.md -->\n${adrBody}`;
  const result = parseWorkerResult(successText({ adrs: adrsBlock }));
  assert.equal(result.ok, true);
  assert.equal(result.blocks.adrs.length, 1);
  assert.equal(result.blocks.adrs[0].filename, '0099-example.md');
  assert.match(result.blocks.adrs[0].body, /```js\nconst x = 1;\n```/);
});

test('parses multiple ADR files and multiple backlog items in one block each', () => {
  const adrsBlock = ['<!-- ADR: 0099-first.md -->', 'First body.', '<!-- ADR: 0100-second.md -->', 'Second body.'].join('\n');
  const backlogBlock = [
    '<!-- TASK: agentic-workflow-ab3f9-followup-one.md -->',
    '---\nid: agentic-workflow-ab3f9\ntitle: Follow-up one\n---\n\n## Why\n\nBecause.',
    '<!-- TASK: agentic-workflow-cd4g0-followup-two.md -->',
    '---\nid: agentic-workflow-cd4g0\ntitle: Follow-up two\n---\n\n## Why\n\nAlso because.',
  ].join('\n');
  const result = parseWorkerResult(successText({ adrs: adrsBlock, backlogItems: backlogBlock }));
  assert.equal(result.blocks.adrs.length, 2);
  assert.equal(result.blocks.adrs[0].filename, '0099-first.md');
  assert.equal(result.blocks.adrs[1].filename, '0100-second.md');
  assert.equal(result.blocks.backlogItems.length, 2);
  assert.equal(result.blocks.backlogItems[0].filename, 'agentic-workflow-ab3f9-followup-one.md');
  assert.match(result.blocks.backlogItems[1].body, /Follow-up two/);
});

// ---- BOUNCED / FAILED ----

test('parses a BOUNCED block', () => {
  const text = 'RESULT: BOUNCED\nTASK_ID: agentic-workflow-ghcaj\nREASON: Missing acceptance criteria.';
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'BOUNCED');
  assert.equal(result.fields.REASON, 'Missing acceptance criteria.');
  assert.equal(result.blocks, null);
});

test('parses a FAILED block', () => {
  const text = 'RESULT: FAILED\nTASK_ID: agentic-workflow-ghcaj\nERROR: Could not get tests green.';
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'FAILED');
  assert.equal(result.fields.ERROR, 'Could not get tests green.');
  assert.equal(result.blocks, null);
});

test('BOUNCED missing REASON is rejected, not partially accepted', () => {
  const result = parseWorkerResult('RESULT: BOUNCED\nTASK_ID: agentic-workflow-ghcaj');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-field');
});

// ---- malformed / truncated ----

test('a truncated block (never closed) returns a structured rejection naming the block, never a partial success', () => {
  const text = [
    'RESULT: SUCCESS',
    'TASK_ID: agentic-workflow-ghcaj',
    'SUMMARY: x',
    'FILES_CHANGED: 0',
    'FILE_LIST: ',
    'ADRS_WRITTEN: none',
    'TESTS_ADDED: 0',
    'TESTS_PASSING: yes',
    'TDD_SKIPPED: no',
    'CONCEPT_CANDIDATE: none',
    '````README_DELTA',
    '[]',
    // no closing fence — truncated
  ].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'truncated-block');
  assert.equal(result.block, 'README_DELTA');
});

test('a malformed README_DELTA (invalid JSON) is rejected naming that block', () => {
  const result = parseWorkerResult(successText({ readmeDelta: '{ not: valid json' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'malformed-block');
  assert.equal(result.block, 'README_DELTA');
});

test('a README_DELTA that parses but is not an array is rejected', () => {
  const result = parseWorkerResult(successText({ readmeDelta: '{"section":"x"}' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'malformed-block');
});

test('missing one-line field is rejected, never silently defaulted', () => {
  const text = successText().replace('TESTS_PASSING: yes\n', '');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-field');
  assert.match(result.reason, /TESTS_PASSING/);
});

test('blocks out of order are rejected naming the expected block', () => {
  const text = [
    'RESULT: SUCCESS',
    'TASK_ID: agentic-workflow-ghcaj',
    'SUMMARY: x',
    'FILES_CHANGED: 0',
    'FILE_LIST: ',
    'ADRS_WRITTEN: none',
    'TESTS_ADDED: 0',
    'TESTS_PASSING: yes',
    'TDD_SKIPPED: no',
    'CONCEPT_CANDIDATE: none',
    '````ADRS',
    '',
    '````',
    '````README_DELTA',
    '[]',
    '````',
    '````OUTCOME',
    'x',
    '````',
    '````BACKLOG_ITEMS',
    '',
    '````',
  ].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-block');
  assert.equal(result.block, 'README_DELTA');
});

test('an unrecognized RESULT value is rejected', () => {
  const result = parseWorkerResult('RESULT: MAYBE\nTASK_ID: x');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'unknown-result');
});

test('an empty string is rejected', () => {
  const result = parseWorkerResult('');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'empty-result');
});

// ============================================================================
// ADR-0080: sidecar path, trailing header repeat + RESULT_END, source ladder
// ============================================================================

// ---- resultSidecarRelativePath ----

test('resultSidecarRelativePath: pins the exact string shape', () => {
  assert.equal(resultSidecarRelativePath('agentic-workflow-qwfq3', 1), '.worktrees/.results/agentic-workflow-qwfq3.iter-1.md');
  assert.equal(resultSidecarRelativePath('agentic-workflow-qwfq3', 3), '.worktrees/.results/agentic-workflow-qwfq3.iter-3.md');
});

test('resultSidecarRelativePath: throws on a non-positive-integer iteration', () => {
  assert.throws(() => resultSidecarRelativePath('t', 0), TypeError);
  assert.throws(() => resultSidecarRelativePath('t', -1), TypeError);
  assert.throws(() => resultSidecarRelativePath('t', 1.5), TypeError);
  assert.throws(() => resultSidecarRelativePath('t', 'x'), TypeError);
});

// ---- Layout: leading-only, trailing-only, both, mismatches ----

test('leading-only without a sentinel parses identically to the pre-ADR-0080 shape', () => {
  const result = parseWorkerResult(successText());
  assert.equal(result.ok, true);
  assert.equal(result.result, 'SUCCESS');
  assert.equal(result.fields.TASK_ID, 'agentic-workflow-ghcaj');
  assert.deepEqual(result.blocks.readmeDelta, []);
  assert.deepEqual(result.layout, { leadingHeader: true, trailingHeader: false, endSentinel: false, softMismatch: [] });
  assert.ok(!('RESULT' in result.fields));
});

test('leading header plus a bare RESULT_END sentinel (no repeated header) parses, endSentinel true, trailingHeader false', () => {
  const result = parseWorkerResult(successText({ trailer: 'RESULT_END' }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.layout, { leadingHeader: true, trailingHeader: false, endSentinel: true, softMismatch: [] });
});

test('trailing-only: text begins at the README_DELTA fence (top-truncated), header recovered from the trailing copy', () => {
  const text = [
    '````README_DELTA',
    '[]',
    '````',
    '',
    '````ADRS',
    '',
    '````',
    '',
    '````OUTCOME',
    '## Outcome\n\nDid the thing.',
    '````',
    '',
    '````BACKLOG_ITEMS',
    '',
    '````',
    '',
    trailingHeaderBlock(),
    'RESULT_END',
  ].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'SUCCESS');
  assert.equal(result.fields.TASK_ID, 'agentic-workflow-ghcaj');
  assert.equal(result.fields.FILE_LIST, '/repo/lib/foo.mjs, /repo/lib/test/foo.test.mjs');
  assert.deepEqual(result.layout, { leadingHeader: false, trailingHeader: true, endSentinel: true, softMismatch: [] });
});

test('both copies present and equal: ok, both layout flags true, no soft mismatch', () => {
  const text = successText({ trailer: `${trailingHeaderBlock()}\nRESULT_END` });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.layout, { leadingHeader: true, trailingHeader: true, endSentinel: true, softMismatch: [] });
});

test('a mechanical-field mismatch (FILE_LIST) between copies rejects header-mismatch naming the field', () => {
  const text = successText({ trailer: trailingHeaderBlock({ FILE_LIST: '/repo/lib/other.mjs' }) });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'header-mismatch');
  assert.equal(result.field, 'FILE_LIST');
});

test('a prose-field mismatch (SUMMARY) is a soft mismatch, ok, leading value wins', () => {
  const text = successText({ trailer: trailingHeaderBlock({ SUMMARY: 'A completely different summary.' }) });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.fields.SUMMARY, 'Did the thing well.');
  assert.deepEqual(result.layout.softMismatch, ['SUMMARY']);
});

test('a whitespace-only difference between copies is not a mismatch at all (mechanical or soft)', () => {
  const text = successText({ trailer: trailingHeaderBlock({ SUMMARY: '  Did   the thing well.  ' }) });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.layout.softMismatch, []);
});

test('an incomplete trailing fragment is ignored, layout.trailingHeader is false, leading fields win', () => {
  const text = successText({ trailer: 'RESULT: SUCCESS\nTASK_ID: agentic-workflow-ghcaj' });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.layout.trailingHeader, false);
  assert.equal(result.layout.leadingHeader, true);
  assert.equal(result.fields.SUMMARY, 'Did the thing well.');
});

test('a stray four-backtick fence line outside any open block is rejected stray-fence', () => {
  const text = ['RESULT: SUCCESS', ...HEADER_FIELDS, '````', '````README_DELTA', '[]', '````', '', '````ADRS', '', '````', '', '````OUTCOME', 'x', '````', '', '````BACKLOG_ITEMS', '', '````'].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'stray-fence');
});

test('a trailing BOUNCED/FAILED header copy alongside fenced SUCCESS blocks rejects layout-conflict', () => {
  const text = [successText(), '', 'RESULT: BOUNCED', 'TASK_ID: agentic-workflow-ghcaj', 'REASON: corrupted trailer'].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'layout-conflict');
});

test('preamble before the leading RESULT: line is still missing-result-line', () => {
  const result = parseWorkerResult(`Here is what I did:\n${successText()}`);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-result-line');
});

test('RESULT never lands in fields for BOUNCED/FAILED either, and RESULT_END is recognized', () => {
  const bounced = parseWorkerResult('RESULT: BOUNCED\nTASK_ID: agentic-workflow-ghcaj\nREASON: x\n\nRESULT_END');
  assert.equal(bounced.ok, true);
  assert.ok(!('RESULT' in bounced.fields));
  assert.deepEqual(bounced.layout, { leadingHeader: true, trailingHeader: false, endSentinel: true, softMismatch: [] });

  const failed = parseWorkerResult('RESULT: FAILED\nTASK_ID: agentic-workflow-ghcaj\nERROR: x\n\nRESULT_END');
  assert.equal(failed.ok, true);
  assert.ok(!('RESULT' in failed.fields));
  assert.equal(failed.layout.endSentinel, true);
});

test('spoof: literal RESULT: SUCCESS / RESULT_END lines inside OUTCOME and BACKLOG_ITEMS content are block content, not headers', () => {
  const spoofedOutcome = '## Outcome\n\nQuoting the format:\n\nRESULT: SUCCESS\nRESULT_END\n\nThat is the shape.';
  const spoofedBacklog = '<!-- TASK: agentic-workflow-ab3f9-followup.md -->\n---\nid: agentic-workflow-ab3f9\n---\n\nRESULT: SUCCESS\nRESULT_END\n';
  const text = successText({ outcome: spoofedOutcome, backlogItems: spoofedBacklog });
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.match(result.blocks.outcome, /RESULT: SUCCESS\nRESULT_END/);
  assert.match(result.blocks.backlogItems[0].body, /RESULT: SUCCESS\nRESULT_END/);
  assert.equal(result.layout.trailingHeader, false);
});

test('tolerance: extra NAME blocks between BACKLOG_ITEMS and the trailing copy still parse, four blocks intact', () => {
  const text = [
    successText(),
    '',
    '````EXTRA_ONE',
    'some extra content',
    '````',
    '',
    '````EXTRA_TWO',
    'more extra content',
    '````',
    '',
    trailingHeaderBlock(),
    'RESULT_END',
  ].join('\n');
  const result = parseWorkerResult(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.blocks.readmeDelta, []);
  assert.deepEqual(result.blocks.adrs, []);
  assert.equal(result.blocks.backlogItems.length, 0);
  assert.equal(result.layout.trailingHeader, true);
});

// ---- unescapeNotificationCopy ----

test('unescapeNotificationCopy: a single left-to-right pass — &amp;lt; becomes &lt;, never <', () => {
  assert.equal(unescapeNotificationCopy('&amp;lt;'), '&lt;');
});

test('unescapeNotificationCopy: plain text with no entities and no stray tag lines is byte-identical', () => {
  const plain = successText();
  assert.equal(unescapeNotificationCopy(plain), plain);
});

test('unescapeNotificationCopy: the 2026-09-12 16:20 incident shape — escaped entities plus stray closing-tag lines round-trip to a parseable, correct text', () => {
  const raw = [
    '````README_DELTA',
    '[]',
    '````',
    '</ADRS>',
    '',
    '````ADRS',
    '',
    '````',
    '',
    '````OUTCOME',
    'Did the <thing> well.',
    '````',
    '</OUTCOME>',
    '',
    '````BACKLOG_ITEMS',
    '',
    '````',
    '',
    trailingHeaderBlock(),
    'RESULT_END',
  ].join('\n');
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const unescaped = unescapeNotificationCopy(escaped);
  assert.ok(!unescaped.includes('</ADRS>'));
  assert.ok(!unescaped.includes('</OUTCOME>'));
  assert.match(unescaped, /Did the <thing> well\./);

  const result = parseWorkerResult(unescaped);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'SUCCESS');
  assert.match(result.blocks.outcome, /Did the <thing> well\./);
});

// ---- selectResultSource ----

test('selectResultSource: a valid sidecar wins over transcript/notification', () => {
  const result = selectResultSource({ taskId: 'agentic-workflow-ghcaj', sidecar: successText(), transcript: undefined, notification: undefined });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'sidecar');
  assert.equal(result.parsed.fields.TASK_ID, 'agentic-workflow-ghcaj');
});

test('selectResultSource: an empty sidecar falls through to a valid transcript', () => {
  const result = selectResultSource({ taskId: 'agentic-workflow-ghcaj', sidecar: '', transcript: successText(), notification: undefined });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'transcript');
});

test('selectResultSource: a sidecar with the wrong TASK_ID is skipped (recorded as task-id-mismatch), falls to transcript', () => {
  const wrongSidecar = successText().replace('agentic-workflow-ghcaj', 'agentic-workflow-other');
  const result = selectResultSource({ taskId: 'agentic-workflow-ghcaj', sidecar: wrongSidecar, transcript: successText(), notification: undefined });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'transcript');
  const sidecarAttempt = result.attempts.find((a) => a.source === 'sidecar');
  assert.equal(sidecarAttempt.code, 'task-id-mismatch');
});

test('selectResultSource: sidecar unparseable, transcript empty, notification is the only usable (escaped, top-truncated) copy', () => {
  const truncated = [
    '````README_DELTA',
    '[]',
    '````',
    '',
    '````ADRS',
    '',
    '````',
    '',
    '````OUTCOME',
    'x',
    '````',
    '',
    '````BACKLOG_ITEMS',
    '',
    '````',
    '',
    trailingHeaderBlock(),
    'RESULT_END',
  ].join('\n');
  const escapedNotification = truncated.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const result = selectResultSource({ taskId: 'agentic-workflow-ghcaj', sidecar: 'not a result at all', transcript: '', notification: escapedNotification });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'notification');
});

test('selectResultSource: all three dead returns no-valid-source with three attempts', () => {
  const result = selectResultSource({ taskId: 'agentic-workflow-ghcaj', sidecar: 'garbage one', transcript: 'garbage two', notification: 'garbage three' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'no-valid-source');
  assert.equal(result.attempts.length, 3);
});
