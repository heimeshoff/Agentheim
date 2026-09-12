import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { searchCorpus, stripFrontmatter, buildExcerpt } from '../search.mjs';
import { createDashboardServer } from '../server.mjs';

/**
 * Build an .agentheim/ fixture exercising every searchable category and both
 * ranking tiers. The term "Falcon" appears:
 *   - in a BC README body (alpha)            → body tier, Bounded contexts
 *   - in an ADR title (0007-falcon)          → title tier, Decisions
 *   - in a research body (spike-x)           → body tier, Research
 *   - in a task title (alpha-001 "Falcon …") → title tier, Tickets
 *   - in a task body (alpha-002)             → body tier, Tickets
 *   - in a BC name (falcon-bc README)        → title tier, Bounded contexts
 *   - in a concept page body (alpha/falcon-c)→ body tier, Concepts
 *   - in an ADR FRONTMATTER only (0008)      → MUST NOT match (frontmatter excluded)
 */
function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw050-search-'));
  const ah = path.join(base, '.agentheim');
  mkdirSync(ah);

  const knowledge = path.join(ah, 'knowledge');
  mkdirSync(knowledge, { recursive: true });
  writeFileSync(path.join(knowledge, 'vision.md'), '# Vision: Acme');
  writeFileSync(path.join(knowledge, 'context-map.md'), '# Context map');
  mkdirSync(path.join(knowledge, 'decisions'), { recursive: true });
  mkdirSync(path.join(knowledge, 'research'), { recursive: true });

  // ADR whose TITLE (body heading is irrelevant — title is the baseName) matches.
  writeFileSync(
    path.join(knowledge, 'decisions', '0007-falcon-launch.md'),
    '# Some heading\n\nbody without the term'
  );
  // ADR whose FRONTMATTER ONLY carries the term — must NOT match.
  writeFileSync(
    path.join(knowledge, 'decisions', '0008-other.md'),
    '---\nid: ADR-0008\ntags: [Falcon]\n---\n\nbody without the term'
  );
  // Research whose BODY matches.
  writeFileSync(
    path.join(knowledge, 'research', 'spike-x.md'),
    '# Spike\n\nThe Falcon protocol is interesting.'
  );

  // BC "alpha": README body matches; tasks.
  const alphaKnowledge = path.join(knowledge, 'contexts', 'alpha');
  mkdirSync(alphaKnowledge, { recursive: true });
  writeFileSync(path.join(alphaKnowledge, 'README.md'), '# Alpha\n\nWe deploy via Falcon here.');
  // Concept page (per-BC, under concepts/) whose BODY matches (body tier, Concepts).
  mkdirSync(path.join(alphaKnowledge, 'concepts'), { recursive: true });
  writeFileSync(
    path.join(alphaKnowledge, 'concepts', 'deployment.md'),
    '# Deployment\n\nThe Falcon rollout strategy lives here.'
  );
  const alpha = path.join(ah, 'board', 'alpha');
  for (const f of ['backlog', 'todo', 'doing', 'done']) {
    mkdirSync(path.join(alpha, f), { recursive: true });
  }
  writeFileSync(
    path.join(alpha, 'backlog', 'alpha-001-falcon-thing.md'),
    '---\nid: alpha-001\ntitle: Falcon migration\nstatus: backlog\ntype: feature\ncontext: alpha\n---\n\nbody only'
  );
  writeFileSync(
    path.join(alpha, 'done', 'alpha-002-other.md'),
    '---\nid: alpha-002\ntitle: Plain thing\nstatus: done\ntype: bug\ncontext: alpha\n---\n\nthe Falcon appears in the body'
  );

  // BC "falcon-bc": its NAME matches (title tier, Bounded contexts).
  const fbcKnowledge = path.join(knowledge, 'contexts', 'falcon-bc');
  mkdirSync(fbcKnowledge, { recursive: true });
  writeFileSync(path.join(fbcKnowledge, 'README.md'), '# Falcon BC\n\nno extra hit body');
  const fbc = path.join(ah, 'board', 'falcon-bc');
  for (const f of ['backlog', 'todo', 'doing', 'done']) {
    mkdirSync(path.join(fbc, f), { recursive: true });
  }

  return { base };
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

// ---------------------------------------------------------------------------
// Pure stripFrontmatter
// ---------------------------------------------------------------------------

test('stripFrontmatter removes a leading fenced block, leaves bodyless files intact', () => {
  assert.equal(
    stripFrontmatter('---\nid: x\ntitle: T\n---\n\nbody here').trim(),
    'body here'
  );
  // No frontmatter → whole text is body.
  assert.equal(stripFrontmatter('# Heading\n\nbody').trim(), '# Heading\n\nbody');
  // Unterminated fence → treat whole text as body (loss-tolerant).
  assert.equal(stripFrontmatter('---\nid: x\nno close').includes('no close'), true);
});

// ---------------------------------------------------------------------------
// Pure buildExcerpt edge cases (ADR-0023)
// ---------------------------------------------------------------------------

test('buildExcerpt: term in the middle gets ~60 chars each side, original case', () => {
  const left = 'L'.repeat(100);
  const right = 'R'.repeat(100);
  const body = `${left} Falcon ${right}`;
  const ex = buildExcerpt(body, 'falcon');
  assert.match(ex, /Falcon/); // original case preserved
  assert.ok(ex.length < body.length); // windowed
  assert.ok(ex.includes('L') && ex.includes('R'));
});

test('buildExcerpt: term at the very start has no left window', () => {
  const ex = buildExcerpt('Falcon ' + 'R'.repeat(100), 'falcon');
  assert.ok(ex.startsWith('Falcon'));
});

test('buildExcerpt: term at the very end has no right window', () => {
  const ex = buildExcerpt('L'.repeat(100) + ' Falcon', 'falcon');
  assert.ok(ex.endsWith('Falcon'));
});

test('buildExcerpt: first occurrence wins when the term repeats', () => {
  const body = 'A Falcon then later another Falcon entirely';
  const ex = buildExcerpt(body, 'falcon');
  // The window is anchored at the FIRST Falcon, so the leading "A " is present.
  assert.ok(ex.startsWith('A Falcon'));
});

test('buildExcerpt: case-insensitive match slices the ORIGINAL-case body', () => {
  const ex = buildExcerpt('xx FALCON yy', 'falcon');
  assert.match(ex, /FALCON/); // not lowercased
});

test('buildExcerpt: multi-line body is collapsed to one legible line', () => {
  const ex = buildExcerpt('line one\n\n  Falcon  \n\tline three', 'falcon');
  assert.equal(/[\n\t]/.test(ex), false);
  assert.equal(/ {2,}/.test(ex), false);
});

test('buildExcerpt: term absent returns empty string', () => {
  assert.equal(buildExcerpt('nothing here', 'falcon'), '');
});

// ---------------------------------------------------------------------------
// Pure searchCorpus — match scope, ranking, result shape
// ---------------------------------------------------------------------------

test('searchCorpus: empty / short query returns [] with no walk', () => {
  const { base } = makeProject();
  try {
    assert.deepEqual(searchCorpus(base, ''), []);
    assert.deepEqual(searchCorpus(base, '   '), []);
    assert.deepEqual(searchCorpus(base, 'a'), []); // < 2 chars
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: matches title + body across all four categories, case-insensitive', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    const paths = results.map((r) => r.path);
    // alpha README (body), 0007 ADR (title), spike-x research (body),
    // alpha-001 task (title), alpha-002 task (body), falcon-bc README (name/title),
    // alpha/concepts/deployment (body).
    assert.equal(results.length, 7);
    assert.ok(paths.some((p) => p.endsWith('alpha/README.md')));
    assert.ok(paths.some((p) => p.endsWith('0007-falcon-launch.md')));
    assert.ok(paths.some((p) => p.endsWith('spike-x.md')));
    assert.ok(paths.some((p) => p.endsWith('alpha-001-falcon-thing.md')));
    assert.ok(paths.some((p) => p.endsWith('alpha-002-other.md')));
    assert.ok(paths.some((p) => p.endsWith('falcon-bc/README.md')));
    assert.ok(paths.some((p) => p.endsWith('alpha/concepts/deployment.md')));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: frontmatter-only term does NOT match', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    assert.equal(results.some((r) => r.path.endsWith('0008-other.md')), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: ranking is title-tier first, then fixed category order', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    // Title tier first: falcon-bc (Bounded contexts), 0007 ADR (Decisions),
    // alpha-001 (Tickets) — in category order BCs → Concepts → Decisions →
    // Research → Tickets. Then body tier: alpha README (Bounded contexts),
    // deployment (Concepts), spike-x (Research), alpha-002 (Tickets).
    const cats = results.map((r) => r.category);
    assert.deepEqual(cats, [
      'Bounded contexts', // falcon-bc (title)
      'Decisions', // 0007 (title)
      'Tickets', // alpha-001 (title)
      'Bounded contexts', // alpha README (body)
      'Concepts', // alpha/concepts/deployment (body)
      'Research', // spike-x (body)
      'Tickets', // alpha-002 (body)
    ]);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: non-task results carry library-compatible intent (type/title/path)', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    const adr = results.find((r) => r.path.endsWith('0007-falcon-launch.md'));
    assert.equal(adr.category, 'Decisions');
    assert.equal(adr.type, 'adr');
    assert.equal(typeof adr.title, 'string');
    assert.equal(adr.status, undefined); // not task-shaped
    const ctx = results.find((r) => r.path.endsWith('falcon-bc/README.md'));
    assert.equal(ctx.type, 'context');
    assert.equal(ctx.title, 'falcon-bc');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: concept results carry library-compatible intent (type concept, baseName title)', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    const concept = results.find((r) => r.path.endsWith('alpha/concepts/deployment.md'));
    assert.ok(concept, 'concept page is searchable');
    assert.equal(concept.category, 'Concepts');
    assert.equal(concept.type, 'concept');
    assert.equal(concept.title, 'deployment'); // baseName, like ADRs/research
    assert.equal(concept.status, undefined); // not task-shaped
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: task results carry board-compatible intent (status/id/context)', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    const task = results.find((r) => r.path.endsWith('alpha-001-falcon-thing.md'));
    assert.equal(task.category, 'Tickets');
    assert.equal(task.status, 'backlog');
    assert.equal(task.id, 'alpha-001');
    assert.equal(task.context, 'alpha');
    assert.equal(task.title, 'Falcon migration');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: title-only match excerpts from the title', () => {
  const { base } = makeProject();
  try {
    const results = searchCorpus(base, 'falcon');
    const task = results.find((r) => r.path.endsWith('alpha-001-falcon-thing.md'));
    // alpha-001's body has no "falcon"; the excerpt is drawn from the title.
    assert.match(task.excerpt, /Falcon migration/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('searchCorpus: never throws on an unreadable artifact (loss tolerant)', () => {
  const { base } = makeProject();
  try {
    // Point the tree at a path that no longer exists by removing one file after
    // enumeration would have picked it up — searchCorpus must still return.
    rmSync(path.join(base, '.agentheim', 'knowledge', 'research', 'spike-x.md'));
    const results = searchCorpus(base, 'falcon');
    assert.ok(Array.isArray(results));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// HTTP route — GET /api/search
// ---------------------------------------------------------------------------

test('GET /api/search returns { query, results } JSON, read-only', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/search?q=falcon`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.query, 'falcon');
    assert.equal(Array.isArray(body.results), true);
    assert.equal(body.results.length, 7);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/search with short / missing q returns empty results, no walk', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    for (const q of ['', 'a', '%20%20']) {
      const res = await fetch(`http://127.0.0.1:${port}/api/search?q=${q}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.results, []);
    }
    // Entirely missing q param.
    const res = await fetch(`http://127.0.0.1:${port}/api/search`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).results, []);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
