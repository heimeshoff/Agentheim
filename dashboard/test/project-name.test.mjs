// Project-name resolution for the dashboard tab title (infrastructure-011).
// The dashboard can be pointed at any discovered project; the browser tab
// <title> must name THAT project, not the baked default. Name source:
//   1. the `# Vision: <Name>` heading in the project's .agentheim/vision.md
//   2. fall back to the project root folder name when vision.md is missing
//      or carries no `# Vision:` heading.
// The ` — Dashboard` suffix/format is preserved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseVisionName,
  resolveProjectName,
  dashboardTitle,
  injectTitle,
} from '../project-name.mjs';

test('parseVisionName reads the name from a `# Vision: <Name>` heading', () => {
  assert.equal(parseVisionName('# Vision: Books\n\n## Purpose\n'), 'Books');
});

test('parseVisionName preserves human casing (e.g. Agentheim)', () => {
  assert.equal(parseVisionName('# Vision: Agentheim\n'), 'Agentheim');
});

test('parseVisionName tolerates leading whitespace and trims the captured name', () => {
  assert.equal(parseVisionName('   # Vision:    My Project   \n'), 'My Project');
});

test('parseVisionName returns null when there is no `# Vision:` heading', () => {
  assert.equal(parseVisionName('# Something Else\n\nbody\n'), null);
  assert.equal(parseVisionName(''), null);
  assert.equal(parseVisionName('## Vision: Nested\n'), null);
});

// --- resolveProjectName: vision heading wins, folder name is the fallback ---

function makeProject(folderName, visionContents) {
  const base = mkdtempSync(path.join(tmpdir(), 'agentheim-pn-'));
  const root = path.join(base, folderName);
  mkdirSync(path.join(root, '.agentheim'), { recursive: true });
  if (visionContents !== undefined) {
    writeFileSync(path.join(root, '.agentheim', 'vision.md'), visionContents, 'utf8');
  }
  return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

test('resolveProjectName uses the vision heading name', () => {
  const { root, cleanup } = makeProject('some-folder', '# Vision: Books\n');
  try {
    assert.equal(resolveProjectName(root), 'Books');
  } finally {
    cleanup();
  }
});

test('resolveProjectName falls back to the folder basename when vision.md is absent', () => {
  const { root, cleanup } = makeProject('my-books-app', undefined);
  try {
    assert.equal(resolveProjectName(root), 'my-books-app');
  } finally {
    cleanup();
  }
});

test('resolveProjectName falls back to the folder basename when vision.md has no `# Vision:` heading', () => {
  const { root, cleanup } = makeProject('fallback-folder', '## Purpose\n\nno heading here\n');
  try {
    assert.equal(resolveProjectName(root), 'fallback-folder');
  } finally {
    cleanup();
  }
});

// --- resolveProjectName under the ADR-0078 two-root `board` layout ---

function makeBoardProject(folderName, visionContents) {
  const base = mkdtempSync(path.join(tmpdir(), 'agentheim-pn-board-'));
  const root = path.join(base, folderName);
  // A marker `board/` directory is enough for detectLayout to resolve 'board'.
  mkdirSync(path.join(root, '.agentheim', 'board'), { recursive: true });
  if (visionContents !== undefined) {
    mkdirSync(path.join(root, '.agentheim', 'knowledge'), { recursive: true });
    writeFileSync(path.join(root, '.agentheim', 'knowledge', 'vision.md'), visionContents, 'utf8');
  }
  return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

test('resolveProjectName reads knowledge/vision.md on a board-layout fixture (ADR-0078, agentic-workflow-hxq1g)', () => {
  const { root, cleanup } = makeBoardProject('some-folder', '# Vision: Books\n');
  try {
    assert.equal(resolveProjectName(root), 'Books');
  } finally {
    cleanup();
  }
});

test('resolveProjectName falls back to the folder basename on a board fixture with no vision.md', () => {
  const { root, cleanup } = makeBoardProject('my-board-app', undefined);
  try {
    assert.equal(resolveProjectName(root), 'my-board-app');
  } finally {
    cleanup();
  }
});

test('resolveProjectName falls back to the folder basename on a mixed layout (visionPath throws, never surfaces)', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'agentheim-pn-mixed-'));
  const root = path.join(base, 'mixed-folder');
  mkdirSync(path.join(root, '.agentheim', 'contexts'), { recursive: true });
  mkdirSync(path.join(root, '.agentheim', 'board'), { recursive: true });
  try {
    assert.equal(resolveProjectName(root), 'mixed-folder');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// --- dashboardTitle: the ` — Dashboard` suffix/format is preserved ---

test('dashboardTitle appends the preserved " — Dashboard" suffix', () => {
  assert.equal(dashboardTitle('Books'), 'Books — Dashboard');
  assert.equal(dashboardTitle('Agentheim'), 'Agentheim — Dashboard');
});

// --- injectTitle: rewrite the served index.html <title> only ---

test('injectTitle replaces the <title> contents with the project title', () => {
  const html = '<head><title>Agentheim — Dashboard</title></head>';
  assert.equal(
    injectTitle(html, 'Books — Dashboard'),
    '<head><title>Books — Dashboard</title></head>',
  );
});

test('injectTitle leaves the Agentheim title unchanged when at home', () => {
  const html = '<head><title>Agentheim — Dashboard</title></head>';
  assert.equal(
    injectTitle(html, 'Agentheim — Dashboard'),
    '<head><title>Agentheim — Dashboard</title></head>',
  );
});

test('injectTitle is a no-op when no <title> element is present', () => {
  const html = '<head><meta charset="utf-8"></head>';
  assert.equal(injectTitle(html, 'Books — Dashboard'), html);
});

test('injectTitle HTML-escapes the project name so it cannot break out of the title', () => {
  const html = '<title>x</title>';
  assert.equal(
    injectTitle(html, 'A & B <script> — Dashboard'),
    '<title>A &amp; B &lt;script&gt; — Dashboard</title>',
  );
});
