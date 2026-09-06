// Tests for lib/worker-result.mjs — mechanized parsing of a worker's strict
// RESULT block, including the four SUCCESS blocks agentic-workflow-ghcaj
// adds (README_DELTA / ADRS / OUTCOME / BACKLOG_ITEMS). Pure, no filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseWorkerResult } from '../worker-result.mjs';

function successText({ readmeDelta = '[]', adrs = '', outcome = '## Outcome\n\nDid the thing.', backlogItems = '' } = {}) {
  return [
    'RESULT: SUCCESS',
    'TASK_ID: agentic-workflow-ghcaj',
    'SUMMARY: Did the thing well.',
    'FILES_CHANGED: 2',
    'FILE_LIST: /repo/lib/foo.mjs, /repo/lib/test/foo.test.mjs',
    'ADRS_WRITTEN: none',
    'TESTS_ADDED: 3',
    'TESTS_PASSING: yes',
    'TDD_SKIPPED: no',
    'CONCEPT_CANDIDATE: none',
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
  ].join('\n');
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
