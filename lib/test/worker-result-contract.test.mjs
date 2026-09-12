// Tests for lib/worker-result-contract.mjs — the live-tree lint keeping
// every restatement of the worker RESULT contract honest (ADR-0059, ADR-0068,
// ADR-0080 §6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  checkWorkerResultContract,
  extractSuccessFieldOrder,
  extractSubagentPromptTemplateSection,
  findRestatedFieldLists,
  SUCCESS_FIELDS_ORDER,
} from '../worker-result-contract.mjs';

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'worker-result-contract-'));
  mkdirSync(path.join(root, 'references'), { recursive: true });
  mkdirSync(path.join(root, 'agents'), { recursive: true });
  mkdirSync(path.join(root, 'skills', 'work'), { recursive: true });
  return root;
}

const COMPLIANT_REFERENCE = `# Worker return format

\`\`\`
RESULT: SUCCESS
TASK_ID: <task-id>
SUMMARY: <one or two sentences>
FILES_CHANGED: <integer count>
FILE_LIST: <comma-separated absolute paths>
ADRS_WRITTEN: <comma-separated filenames, or "none">
TESTS_ADDED: <integer count>
TESTS_PASSING: yes | no
TDD_SKIPPED: <reason, or "no">
CONCEPT_CANDIDATE: <name> | none
\`\`\`

The worker's final action, for every RESULT kind, writes its exact RESULT text to the sidecar
named by \`Result file:\` in its spawn prompt — \`.worktrees/.results/<task-id>.iter-<N>.md\` — then
returns the same text, ending with a line reading exactly \`RESULT_END\`.
`;

const COMPLIANT_WORKER_MD = `# Worker

## Your task
Result file: <ABSOLUTE-PATH>

Write your RESULT to the sidecar above as your final action, then return it.
`;

const COMPLIANT_SKILL_MD = `## Subagent Prompt Template

\`\`\`
## Your task
Workspace: <ABSOLUTE-PATH-TO-WORKTREE>
Result file: <ABSOLUTE-PATH>
\`\`\`

## Next section
Nothing relevant here.
`;

function writeCompliantFixture(root, overrides = {}) {
  writeFileSync(path.join(root, 'references', 'worker-return-format.md'), overrides.reference ?? COMPLIANT_REFERENCE);
  writeFileSync(path.join(root, 'agents', 'worker.md'), overrides.workerMd ?? COMPLIANT_WORKER_MD);
  writeFileSync(path.join(root, 'skills', 'work', 'SKILL.md'), overrides.skillMd ?? COMPLIANT_SKILL_MD);
}

// ---- extractSuccessFieldOrder ----

test('extractSuccessFieldOrder: pulls the ordered field names out of the RESULT: SUCCESS sample', () => {
  const order = extractSuccessFieldOrder(COMPLIANT_REFERENCE);
  assert.deepEqual(order, [...SUCCESS_FIELDS_ORDER]);
});

test('extractSuccessFieldOrder: returns null when no RESULT: SUCCESS sample is present', () => {
  assert.equal(extractSuccessFieldOrder('# Nothing here'), null);
});

// ---- extractSubagentPromptTemplateSection ----

test('extractSubagentPromptTemplateSection: slices from the heading to the next H2', () => {
  const section = extractSubagentPromptTemplateSection(COMPLIANT_SKILL_MD);
  assert.match(section, /Result file:/);
  assert.doesNotMatch(section, /Nothing relevant here/);
});

test('extractSubagentPromptTemplateSection: empty string when the heading is missing', () => {
  assert.equal(extractSubagentPromptTemplateSection('# Something else entirely'), '');
});

// ---- findRestatedFieldLists ----

test('findRestatedFieldLists: flags a line naming all nine fields outside the reference file', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'agents', 'verifier.md'),
      'The fields are (TASK_ID, SUMMARY, FILES_CHANGED, FILE_LIST, ADRS_WRITTEN, TESTS_ADDED, TESTS_PASSING, TDD_SKIPPED, CONCEPT_CANDIDATE).\n'
    );
    const hits = findRestatedFieldLists(root);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findRestatedFieldLists: does not flag the reference file itself', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'skills', 'work', 'worker-return-format.md'), COMPLIANT_REFERENCE);
    const hits = findRestatedFieldLists(root);
    assert.deepEqual(hits, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findRestatedFieldLists: does not flag a partial mention (fewer than all nine fields)', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'agents', 'worker.md'), 'See TASK_ID and SUMMARY for details.\n');
    assert.deepEqual(findRestatedFieldLists(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- checkWorkerResultContract: fixture behavior ----

test('checkWorkerResultContract: a fully compliant fixture has zero violations', () => {
  const root = makeFixtureRoot();
  try {
    writeCompliantFixture(root);
    assert.deepEqual(checkWorkerResultContract(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: (a) a drifted SUCCESS field order is flagged', () => {
  const root = makeFixtureRoot();
  try {
    const badReference = COMPLIANT_REFERENCE.replace('TASK_ID: <task-id>\nSUMMARY:', 'SUMMARY: <one or two sentences>\nTASK_ID:');
    writeCompliantFixture(root, { reference: badReference });
    const violations = checkWorkerResultContract(root);
    assert.ok(violations.some((v) => v.code === 'fields-order-drift'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: (b) a reference missing RESULT_END / Result file: / .worktrees/.results/ is flagged', () => {
  const root = makeFixtureRoot();
  try {
    const badReference = COMPLIANT_REFERENCE.replace(/RESULT_END/g, '').replace(/Result file:/g, '').replace(/\.worktrees\/\.results\//g, '');
    writeCompliantFixture(root, { reference: badReference });
    const violations = checkWorkerResultContract(root);
    const missing = violations.filter((v) => v.code === 'missing-required-string').map((v) => v.detail);
    assert.deepEqual(missing.sort(), ['.worktrees/.results/', 'RESULT_END', 'Result file:'].sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: (c) agents/worker.md missing "Result file:" is flagged', () => {
  const root = makeFixtureRoot();
  try {
    writeCompliantFixture(root, { workerMd: '# Worker\n\nNo sidecar field mentioned here.\n' });
    const violations = checkWorkerResultContract(root);
    assert.ok(violations.some((v) => v.code === 'missing-result-file-field' && v.file.endsWith('worker.md')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: (c) the Subagent Prompt Template missing "Result file:" is flagged even if it appears elsewhere in SKILL.md', () => {
  const root = makeFixtureRoot();
  try {
    const badSkill = `Result file: mentioned in some other unrelated section.\n\n## Subagent Prompt Template\n\n\`\`\`\n## Your task\nWorkspace: <ABSOLUTE-PATH>\n\`\`\`\n\n## Next section\n`;
    writeCompliantFixture(root, { skillMd: badSkill });
    const violations = checkWorkerResultContract(root);
    assert.ok(violations.some((v) => v.code === 'missing-result-file-field' && v.file.endsWith('SKILL.md')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: (d) a restated field list outside the reference is flagged', () => {
  const root = makeFixtureRoot();
  try {
    writeCompliantFixture(root);
    writeFileSync(
      path.join(root, 'agents', 'verifier.md'),
      'Fields: (TASK_ID, SUMMARY, FILES_CHANGED, FILE_LIST, ADRS_WRITTEN, TESTS_ADDED, TESTS_PASSING, TDD_SKIPPED, CONCEPT_CANDIDATE).\n'
    );
    const violations = checkWorkerResultContract(root);
    assert.ok(violations.some((v) => v.code === 'restated-field-list' && v.file.endsWith('verifier.md')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkWorkerResultContract: a missing reference file is its own single violation', () => {
  const root = makeFixtureRoot();
  try {
    const violations = checkWorkerResultContract(root);
    assert.deepEqual(violations, [{ code: 'reference-missing', file: path.join(root, 'references', 'worker-return-format.md') }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- checkWorkerResultContract: the recurring live-tree gate ----

test('the live tree satisfies the worker RESULT contract', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = checkWorkerResultContract(repoRoot);
  assert.deepEqual(violations, [], `expected no contract violations, found: ${JSON.stringify(violations, null, 2)}`);
});
