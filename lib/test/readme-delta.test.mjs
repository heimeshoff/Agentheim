// Tests for lib/readme-delta.mjs — the two-op README delta grammar
// (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6). Pure, git-free,
// fixture-driven against small synthetic documents shaped like the real BC
// README (never the live tree).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyReadmeDelta, FALLBACK_SECTION } from '../readme-delta.mjs';

function doc(sections) {
  // sections: array of { name, body } -> a minimal README-shaped document.
  const parts = ['# Fixture BC\n'];
  for (const s of sections) {
    parts.push(`## ${s.name}\n\n${s.body}\n`);
  }
  return parts.join('\n');
}

const UBIQ_BODY =
  '- **Skill** — a natural-language-triggered capability.\n' +
  '- **Task** — a unit of work as a markdown file.\n' +
  '- **Bounded context (modeled)** — a domain area in the project.';

const AGGREGATES_BODY =
  '- **Task** — protects: status always matches its folder.\n' +
  '- **Bounded context (modeled)** — protects: a task belongs to exactly one BC.';

function fixtureDoc() {
  return doc([
    { name: 'Ubiquitous language', body: UBIQ_BODY },
    { name: 'Aggregates', body: AGGREGATES_BODY },
  ]);
}

// ---- append ----

test('append lands a new bullet at the end of the named section\'s bullet list', () => {
  const { content, dispositions } = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Widget** — a new term.' }],
  });
  assert.deepEqual(dispositions, ['applied']);
  const ubiqSection = content.split('## Aggregates')[0];
  assert.match(ubiqSection, /Bounded context \(modeled\)\*\* — a domain area in the project\.\n- \*\*Widget\*\* — a new term\./);
});

test('append to a section is never confused with a same-termHead bullet in a DIFFERENT section', () => {
  const { content } = applyReadmeDelta(fixtureDoc(), {
    section: 'Aggregates',
    ops: [{ op: 'append', body: '- **Widget** — protects: nothing yet.' }],
  });
  const ubiq = content.split('## Aggregates')[0];
  const aggregates = content.split('## Aggregates')[1];
  assert.doesNotMatch(ubiq, /Widget/);
  assert.match(aggregates, /Widget/);
});

test('append is a noop-already when the identical bullet is already the last one (idempotent re-dispatch)', () => {
  const once = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Widget** — a new term.' }],
  });
  const twice = applyReadmeDelta(once.content, {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Widget**   —   a new term.' }], // whitespace-different, same collapsed text
  });
  assert.deepEqual(twice.dispositions, ['noop-already']);
  assert.equal(twice.content, once.content);
});

test('append to a missing section lands as appended-fallback into Ubiquitous language', () => {
  const { content, dispositions } = applyReadmeDelta(fixtureDoc(), {
    section: 'Runtime surface',
    ops: [{ op: 'append', body: '- **Gadget** — a fallback-landed term.' }],
  });
  assert.deepEqual(dispositions, ['appended-fallback']);
  const ubiqSection = content.split('## Aggregates')[0];
  assert.match(ubiqSection, /Gadget/);
  assert.equal(FALLBACK_SECTION, 'Ubiquitous language');
});

// ---- replace ----

test('replace matches on (section, termHead) truncated at the first "(" and whitespace-collapsed, and replaces the whole bullet extent', () => {
  const { content, dispositions } = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Bounded context',
        expected: '- **Bounded context (modeled)** — a domain area in the project.',
        body: '- **Bounded context (modeled)** — a domain area in the project, now with a longer\n  multi-line continuation describing the concept further.',
      },
    ],
  });
  assert.deepEqual(dispositions, ['applied']);
  assert.match(content, /multi-line continuation describing the concept further\./);
  // The old single-line form is gone (replaced, not appended alongside).
  assert.equal((content.match(/Bounded context \(modeled\)/g) ?? []).length, 2); // once here, once in Aggregates
});

test('replace never touches a same-termHead bullet in ANOTHER section', () => {
  const { content } = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Bounded context',
        expected: '- **Bounded context (modeled)** — a domain area in the project.',
        body: '- **Bounded context (modeled)** — RENAMED IN UBIQ ONLY.',
      },
    ],
  });
  const aggregates = content.split('## Aggregates')[1];
  assert.match(aggregates, /protects: a task belongs to exactly one BC\./);
  assert.doesNotMatch(aggregates, /RENAMED IN UBIQ ONLY/);
});

test('replace is noop-already when the bullet already reads as the incoming body', () => {
  const first = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Task',
        expected: '- **Task** — a unit of work as a markdown file.',
        body: '- **Task** — a unit of work, renamed.',
      },
    ],
  });
  const second = applyReadmeDelta(first.content, {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Task',
        expected: '- **Task** — a unit of work as a markdown file.', // stale expected — but body already matches
        body: '- **Task**   —   a unit of work, renamed.',
      },
    ],
  });
  assert.deepEqual(second.dispositions, ['noop-already']);
  assert.equal(second.content, first.content);
});

test('expected compares whitespace-collapsed, not byte-exact', () => {
  const { dispositions } = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Task',
        expected: '- **Task**   —    a unit  of\n  work as a markdown file.',
        body: '- **Task** — a unit of work, renamed.',
      },
    ],
  });
  assert.deepEqual(dispositions, ['applied']);
});

test('a missing anchor (gone) is grouped with the collision family — merged, appended rather than dropped', () => {
  const { content, dispositions } = applyReadmeDelta(fixtureDoc(), {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Nonexistent Term',
        expected: '- **Nonexistent Term** — anything.',
        body: '- **Nonexistent Term** — landed anyway.',
      },
    ],
  });
  assert.deepEqual(dispositions, ['merged']);
  assert.match(content, /Nonexistent Term\*\* — landed anyway\./);
});

// ---- both intents survive (two workers, same base) ----

test('two sequential replaces against the same anchor from two "workers" both survive: second reports merged with the expected mismatch surfaced', () => {
  const base = fixtureDoc();
  const workerAExpected = '- **Task** — a unit of work as a markdown file.';

  const afterA = applyReadmeDelta(base, {
    section: 'Ubiquitous language',
    ops: [
      { op: 'replace', anchor: 'Task', expected: workerAExpected, body: '- **Task** — a unit of work (worker A addition).' },
    ],
  });
  assert.deepEqual(afterA.dispositions, ['applied']);

  // Worker B read the ORIGINAL bullet (base), unaware of A's change.
  const afterB = applyReadmeDelta(afterA.content, {
    section: 'Ubiquitous language',
    ops: [
      { op: 'replace', anchor: 'Task', expected: workerAExpected, body: '- **Task** — a unit of work (worker B addition).' },
    ],
  });
  assert.deepEqual(afterB.dispositions, ['merged']);
  assert.match(afterB.content, /worker A addition/);
  assert.match(afterB.content, /worker B addition/);
});

test('two sequential appends to the same section both survive', () => {
  const base = fixtureDoc();
  const afterA = applyReadmeDelta(base, {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Alpha** — worker A term.' }],
  });
  const afterB = applyReadmeDelta(afterA.content, {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Beta** — worker B term.' }],
  });
  assert.deepEqual(afterB.dispositions, ['applied']);
  assert.match(afterB.content, /Alpha/);
  assert.match(afterB.content, /Beta/);
});

// ---- multi-line bullet extent ----

test('a multi-line bullet extent (continuation lines) is captured and replaced as a whole', () => {
  const multi = doc([
    {
      name: 'Ubiquitous language',
      body:
        '- **Skill** — a natural-language-triggered capability: `brainstorm`, `modeling`,\n' +
        '  `research`, `work` (plus doctrine docs).\n' +
        '- **Task** — a unit of work.',
    },
  ]);
  const { content, dispositions } = applyReadmeDelta(multi, {
    section: 'Ubiquitous language',
    ops: [
      {
        op: 'replace',
        anchor: 'Skill',
        expected:
          '- **Skill** — a natural-language-triggered capability: `brainstorm`, `modeling`, `research`, `work` (plus doctrine docs).',
        body: '- **Skill** — replaced entirely, single line now.',
      },
    ],
  });
  assert.deepEqual(dispositions, ['applied']);
  assert.doesNotMatch(content, /natural-language-triggered capability: `brainstorm`/);
  assert.match(content, /replaced entirely, single line now\./);
  assert.match(content, /\*\*Task\*\* — a unit of work\./);
});
