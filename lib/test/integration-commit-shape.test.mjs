// Integration-shape git fixture for agentic-workflow-ghcaj (amends ADR-0032
// §3/§4/§6): a worker's branch carries source and tests only; the conductor
// materializes README delta / ADR / task-move / backlog-item bookkeeping on
// `main` at squash-merge integration, in ONE commit (ADR-0026 shape).
//
// BOUNDED EXCEPTION to "lib is git-free" (ADR-0038, the same exception
// ADR-0072's `git-facts-merge-conflict.test.mjs` already carved out): this
// test file shells out to real `git` against a THROWAWAY repo created fresh
// with `fs.mkdtempSync(path.join(os.tmpdir(), ...))` — NEVER an env-derived
// path, NEVER this project's own repository. Runtime `lib/` code
// (`readme-delta.mjs`, `worker-result.mjs`, `task-lifecycle.mjs`,
// `adr-allocation.mjs`) stays fully git-free; only this fixture drives real
// git around calls to those pure functions. `test.skip`s the whole file when
// `git --version` fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { applyReadmeDelta } from '../readme-delta.mjs';
import { completeTask, materializeTaskFile } from '../task-lifecycle.mjs';
import { nextAdrNumber, finalizeAdrNumbering } from '../adr-allocation.mjs';

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const GIT_AVAILABLE = gitAvailable();

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}
function gitTry(cwd, args) {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

function makeRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aw-integration-shape-'));
  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-B', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  return dir;
}

function write(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  return abs;
}

const README_BASE =
  '# Fixture BC\n\n' +
  '## Ubiquitous language\n\n' +
  '- **Task** — a unit of work as a markdown file.\n' +
  '- **Widget** — an existing term.\n';

function indexFixture({ backlog = 0, todo = 0, doing = 0, done = 0, doingLines = [], doneLines = [], backlogLines = [] }) {
  return (
    `# Fixture BC — Index\n\n---\n\n## Tasks by status\n\n<!-- task-counts:start -->\n` +
    `- **Backlog:** ${backlog}\n- **Todo:** ${todo}\n- **Doing:** ${doing}\n- **Done:** ${done}\n` +
    `<!-- task-counts:end -->\n\n### Todo\n<!-- todo-list:start -->\n<!-- todo-list:end -->\n\n` +
    `### Doing\n<!-- doing-list:start -->\n${doingLines.map((l) => l + '\n').join('')}<!-- doing-list:end -->\n\n` +
    `### Done\n<!-- done-list:start -->\n${doneLines.map((l) => l + '\n').join('')}<!-- done-list:end -->\n\n` +
    `### Backlog\n<!-- backlog-list:start -->\n${backlogLines.map((l) => l + '\n').join('')}<!-- backlog-list:end -->\n\n` +
    `## ADRs scoped to this BC\n\n<!-- adr-local:start -->\n<!-- adr-local:end -->\n`
  );
}

const PROTOCOL_BASE = '# Protocol\n\nChronological log.\n\n---\n\n';

function taskBody({ id, title, extra = '' }) {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: doing\ntype: chore\ncontext: fixture-bc\n---\n\n## Why\n\nFixture task.\n${extra}`;
}

// ---------------------------------------------------------------------------
// Criterion: "Both intents survive" — two workers' deltas against the same
// base, applied sequentially on one `main` fixture, plus the code squash-
// merges cleanly for both.
// ---------------------------------------------------------------------------

test('both intents survive: two sequential README replaces + two provisional-collision ADRs land contiguous, zero conflict markers, code squash-merges cleanly', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  const dir = makeRepo();
  write(dir, '.agentheim/contexts/fixture-bc/README.md', README_BASE);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);

  // Two worker branches, each a code-only, disjoint-file change — mirrors
  // the ghcaj rule that a worker branch never touches .agentheim/.
  git(dir, ['checkout', '-q', '-b', 'aw/task-A']);
  write(dir, 'lib/a.mjs', 'export const a = 1;\n');
  git(dir, ['add', 'lib/a.mjs']);
  git(dir, ['commit', '-q', '-m', 'wip [task-A]']);

  git(dir, ['checkout', '-q', 'main']);
  git(dir, ['checkout', '-q', '-b', 'aw/task-B']);
  write(dir, 'lib/b.mjs', 'export const b = 2;\n');
  git(dir, ['add', 'lib/b.mjs']);
  git(dir, ['commit', '-q', '-m', 'wip [task-B]']);

  git(dir, ['checkout', '-q', 'main']);

  const decisionsDir = path.join(dir, '.agentheim', 'knowledge', 'decisions');
  const readmePath = path.join(dir, '.agentheim', 'contexts', 'fixture-bc', 'README.md');
  const expectedOriginal = '- **Task** — a unit of work as a markdown file.';

  // --- integrate task-A ---
  const squashA = gitTry(dir, ['merge', '--squash', 'aw/task-A']);
  assert.equal(squashA.code, 0, `squash A should be clean: ${squashA.stderr}`);

  const beforeA = readFileSync(readmePath, 'utf8');
  const deltaA = applyReadmeDelta(beforeA, {
    section: 'Ubiquitous language',
    ops: [{ op: 'replace', anchor: 'Task', expected: expectedOriginal, body: '- **Task** — a unit of work (worker A addition).' }],
  });
  assert.deepEqual(deltaA.dispositions, ['applied']);
  writeFileSync(readmePath, deltaA.content, 'utf8');

  const adrNumA = nextAdrNumber(decisionsDir); // '0001' — decisions/ is empty at this point
  write(dir, `.agentheim/knowledge/decisions/${adrNumA}-a-decision.md`, `---\nid: ADR-${adrNumA}\ntitle: A decision\n---\n\n# ADR-${adrNumA}: A decision\n`);
  const finalizeA = finalizeAdrNumbering(decisionsDir, [`${adrNumA}-a-decision.md`]);

  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'integrate task-A']);

  // --- integrate task-B (unaware of A's changes) ---
  const squashB = gitTry(dir, ['merge', '--squash', 'aw/task-B']);
  assert.equal(squashB.code, 0, `squash B (after A) should be clean: ${squashB.stderr}`);

  const beforeB = readFileSync(readmePath, 'utf8'); // now holds A's replace
  const deltaB = applyReadmeDelta(beforeB, {
    section: 'Ubiquitous language',
    ops: [{ op: 'replace', anchor: 'Task', expected: expectedOriginal, body: '- **Task** — a unit of work (worker B addition).' }],
  });
  assert.deepEqual(deltaB.dispositions, ['merged']); // B's `expected` (the original) no longer matches A's applied text
  writeFileSync(readmePath, deltaB.content, 'utf8');

  // B independently guessed the SAME provisional number A guessed, from its
  // own worktree's decisions/ snapshot taken before A landed.
  const adrNumB = '0001';
  write(dir, `.agentheim/knowledge/decisions/${adrNumB}-b-decision.md`, `---\nid: ADR-${adrNumB}\ntitle: B decision\n---\n\n# ADR-${adrNumB}: B decision\n`);
  const finalizeB = finalizeAdrNumbering(decisionsDir, [`${adrNumB}-b-decision.md`]);

  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'integrate task-B']);

  // --- assertions ---
  const finalReadme = readFileSync(readmePath, 'utf8');
  assert.match(finalReadme, /worker A addition/);
  assert.match(finalReadme, /worker B addition/);
  assert.doesNotMatch(finalReadme, /<{7}|={7}|>{7}/); // zero conflict markers anywhere

  const adrFiles = readdirSync(decisionsDir).sort();
  assert.deepEqual(adrFiles, ['0001-a-decision.md', '0002-b-decision.md']);
  assert.equal(finalizeB.renumbered.length, 1);
  assert.equal(finalizeB.renumbered[0].to, 'ADR-0002');

  assert.equal(existsSync(path.join(dir, 'lib', 'a.mjs')), true);
  assert.equal(existsSync(path.join(dir, 'lib', 'b.mjs')), true);

  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Criterion: "Integration commit shape" — one fixture driving squash-merge
// -> applyReadmeDelta -> ADR write + finalizeAdrNumbering -> OUTCOME append
// -> complete -> materializeTaskFile -> ONE commit; the worker branch's own
// tree has no change under .agentheim/.
// ---------------------------------------------------------------------------

test('integration commit shape: one commit holds code + README + ADR + done/<task> + new backlog file + INDEX + protocol; the worker branch touches nothing under .agentheim/', (t) => {
  if (!GIT_AVAILABLE) return t.skip('git not available');

  const dir = makeRepo();
  const id = 'fixture-bc-abc12';
  const fileName = `${id}-integration-fixture.md`;

  write(dir, '.agentheim/contexts/fixture-bc/README.md', README_BASE);
  write(
    dir,
    `.agentheim/contexts/fixture-bc/doing/${fileName}`,
    taskBody({ id, title: 'Integration fixture task' })
  );
  write(
    dir,
    '.agentheim/contexts/fixture-bc/INDEX.md',
    indexFixture({ doing: 1, doingLines: [`- **${id}** — Integration fixture task (chore) — \`doing/${fileName}\``] })
  );
  write(dir, '.agentheim/knowledge/protocol.md', PROTOCOL_BASE);
  write(dir, 'lib/existing.mjs', 'export const existing = true;\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);
  const baseSha = git(dir, ['rev-parse', 'HEAD']).trim();

  git(dir, ['checkout', '-q', '-b', `aw/${id}`]);
  write(dir, 'lib/feature.mjs', 'export const feature = true;\n');
  git(dir, ['add', 'lib/feature.mjs']);
  git(dir, ['commit', '-q', '-m', `wip [${id}] iter 1`]);

  git(dir, ['checkout', '-q', 'main']);
  const squash = gitTry(dir, ['merge', '--squash', `aw/${id}`]);
  assert.equal(squash.code, 0, `squash should be clean: ${squash.stderr}`);
  const stagedBeforeIntegration = git(dir, ['diff', '--name-only', '--cached']).trim().split('\n').filter(Boolean);
  assert.deepEqual(stagedBeforeIntegration, ['lib/feature.mjs']);

  // (a) applyReadmeDelta
  const readmePath = path.join(dir, '.agentheim', 'contexts', 'fixture-bc', 'README.md');
  const delta = applyReadmeDelta(readFileSync(readmePath, 'utf8'), {
    section: 'Ubiquitous language',
    ops: [{ op: 'append', body: '- **Gizmo** — landed by the integration fixture.' }],
  });
  writeFileSync(readmePath, delta.content, 'utf8');

  // (b) ADR write + finalizeAdrNumbering
  const decisionsDir = path.join(dir, '.agentheim', 'knowledge', 'decisions');
  const adrNum = nextAdrNumber(decisionsDir);
  const adrFilename = `${adrNum}-integration-fixture-decision.md`;
  write(dir, `.agentheim/knowledge/decisions/${adrFilename}`, `---\nid: ADR-${adrNum}\ntitle: Integration fixture decision\n---\n\n# ADR-${adrNum}: Integration fixture decision\n`);
  finalizeAdrNumbering(decisionsDir, [adrFilename]);

  // (c) append OUTCOME to the task file (still in doing/ at this point)
  const doingPath = path.join(dir, '.agentheim', 'contexts', 'fixture-bc', 'doing', fileName);
  const withOutcome = readFileSync(doingPath, 'utf8') + '\n## Outcome\n\nLanded via the integration fixture.\n';
  writeFileSync(doingPath, withOutcome, 'utf8');

  // (d) complete — the real doing -> done move + INDEX/protocol edit
  const completeResult = completeTask(dir, id, {
    context: 'fixture-bc',
    now: new Date('2026-09-06T00:00:00'),
    summary: 'Integration fixture task landed.',
    verification: 'PASS (iteration 1)',
    filesChanged: 1,
  });
  assert.equal(completeResult.ok, true);

  // (e) materializeTaskFile — a brand-new backlog item this task discovered
  const backlogBody = taskBody({ id: 'fixture-bc-def34', title: 'Follow-up from the fixture' });
  const materializeResult = materializeTaskFile(dir, backlogBody);
  assert.equal(materializeResult.ok, true);

  // --- scoped git add: every path (a)-(e) wrote, plus the squash-staged code ---
  const scopedAdd = [
    ...stagedBeforeIntegration,
    readmePath,
    path.join(decisionsDir, adrFilename),
    ...completeResult.changed,
    ...materializeResult.changed,
  ];
  git(dir, ['add', '--', ...scopedAdd]);
  const commitResult = gitTry(dir, ['commit', '-q', '-m', `chore(fixture-bc): integration fixture [${id}]`]);
  assert.equal(commitResult.code, 0, `integration commit should succeed: ${commitResult.stderr}`);

  // --- exactly ONE commit landed on top of base ---
  const log = git(dir, ['log', '--oneline', `${baseSha}..HEAD`]).trim().split('\n').filter(Boolean);
  assert.equal(log.length, 1);

  // --- the tree holds everything, in one shot ---
  const doneRel = `.agentheim/contexts/fixture-bc/done/${fileName}`;
  assert.equal(existsSync(path.join(dir, 'lib', 'feature.mjs')), true);
  assert.match(readFileSync(readmePath, 'utf8'), /Gizmo/);
  assert.equal(readdirSync(decisionsDir).length, 1);
  assert.equal(existsSync(path.join(dir, doneRel)), true);
  assert.match(readFileSync(path.join(dir, doneRel), 'utf8'), /## Outcome\n\nLanded via the integration fixture\./);
  assert.equal(existsSync(doingPath), false); // no doing/ duplicate
  const backlogFiles = readdirSync(path.join(dir, '.agentheim', 'contexts', 'fixture-bc', 'backlog'));
  assert.equal(backlogFiles.length, 1);
  assert.match(backlogFiles[0], /^fixture-bc-def34-/);
  const indexContent = readFileSync(path.join(dir, '.agentheim', 'contexts', 'fixture-bc', 'INDEX.md'), 'utf8');
  assert.match(indexContent, /done-list:start -->\n- \*\*fixture-bc-abc12\*\*/);
  assert.match(indexContent, /\*\*Doing:\*\* 0/);
  assert.match(indexContent, /\*\*Done:\*\* 1/);
  const protocolContent = readFileSync(path.join(dir, '.agentheim', 'knowledge', 'protocol.md'), 'utf8');
  assert.match(protocolContent, /Task verified and completed: fixture-bc-abc12/);

  // --- the worker branch's own tree has NO change under .agentheim/ ---
  const branchBookkeepingDiff = git(dir, ['diff', baseSha, `aw/${id}`, '--', '.agentheim']).trim();
  assert.equal(branchBookkeepingDiff, '');

  rmSync(dir, { recursive: true, force: true });
});
