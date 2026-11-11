import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findContextMapNotationViolations, WORKER_SENTENCE } from '../context-map-notation-lint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const FILES = [
  'references/context-map-notation.md',
  'skills/brainstorm/SKILL.md',
  'agents/strategic-modeler.md',
  'agents/worker.md',
];

function copyTree() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-cmnotation-'));
  for (const f of FILES) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    cpSync(path.join(repoRoot, f), path.join(root, f));
  }
  return root;
}
function mutate(root, rel, fn) {
  const p = path.join(root, rel);
  writeFileSync(p, fn(readFileSync(p, 'utf8')));
}
function run(mut) {
  const root = copyTree();
  try {
    if (mut) mut(root);
    return findContextMapNotationViolations(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the live tree is clean', () => {
  assert.deepEqual(run(), []);
});

// Windows checkouts with core.autocrlf=true get CRLF line endings; the lint
// must give the same verdict on a CRLF copy of the live tree as on LF.
const toCrlf = (s) => s.replace(/\r?\n/g, '\r\n');

test('a CRLF checkout of the live tree is clean', () => {
  assert.deepEqual(run((r) => { for (const f of FILES) mutate(r, f, toCrlf); }), []);
});

test('a CRLF checkout still flags a broken Diagram fence', () => {
  const v = run((r) => {
    for (const f of FILES) mutate(r, f, toCrlf);
    mutate(r, FILES[1], (s) => s.replace('## Diagram\r\n```mermaid', '## Gram\r\n```text'));
  });
  assert.ok(v.some((x) => x.file === FILES[1] && /Diagram/.test(x.problem)));
});

test('missing notation file is flagged', () => {
  const v = run((r) => rmSync(path.join(r, FILES[0])));
  assert.ok(v.some((x) => x.file === FILES[0] && x.problem === 'missing'));
});

test('notation example without flowchart LR is flagged', () => {
  const v = run((r) => mutate(r, FILES[0], (s) => s.replaceAll('flowchart LR', 'graph TD')));
  assert.ok(v.some((x) => x.file === FILES[0]));
});

test('notation example with a colour value is flagged', () => {
  for (const bad of ['fill:#fff', 'stroke:red', 'stroke:#333', 'color:blue']) {
    const v = run((r) =>
      mutate(r, FILES[0], (s) => s.replace('classDef core stroke-width:3px;', `classDef core ${bad};`))
    );
    assert.ok(v.some((x) => /colour/.test(x.problem)), bad);
  }
});

test('brainstorm template without a Diagram fence is flagged', () => {
  const v = run((r) => mutate(r, FILES[1], (s) => s.replace('## Diagram\n```mermaid', '## Gram\n```text')));
  assert.ok(v.some((x) => x.file === FILES[1] && /Diagram/.test(x.problem)));
});

test('brainstorm without the notation pointer is flagged', () => {
  const v = run((r) => mutate(r, FILES[1], (s) => s.replaceAll(FILES[0], 'x')));
  assert.ok(v.some((x) => x.file === FILES[1] && /pointer/.test(x.problem)));
});

test('strategic-modeler without pointer or Diagram mention is flagged', () => {
  const v = run((r) => mutate(r, FILES[2], (s) => s.replaceAll(FILES[0], 'x').replaceAll('## Diagram', 'x')));
  assert.equal(v.filter((x) => x.file === FILES[2]).length, 2);
});

test('worker.md without the sentence is flagged', () => {
  const v = run((r) => mutate(r, FILES[3], (s) => s.replace(WORKER_SENTENCE, 'x')));
  assert.ok(v.some((x) => x.file === FILES[3]));
});
