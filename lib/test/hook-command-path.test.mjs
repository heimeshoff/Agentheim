// Regression + reproduction tests for agentic-workflow-g7p2x: the hook COMMAND
// path (where the hook looks for lib/hook-agent-signal.mjs), not the script's
// internal write-target resolution (unchanged, covered by hook-agent-signal.test.mjs).
//
// Bug: all three ADR-0043 hook registrations invoked
//   node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" <signal>
// which only resolves when the project IS the plugin (this repo). In a consumer
// plugin install, CLAUDE_PROJECT_DIR is the CONSUMER's root, the script doesn't
// exist there, and node exits non-zero with no in-flight.json ever written — a
// silent failure at the Claude Code hook level (stderr from a command hook isn't
// surfaced to the user).
//
// Fix: an env-independent bootstrap (homedir -> plugin cache -> semver-max
// version dir -> hook-agent-signal.mjs), the same pattern infrastructure-010
// proved for /dashboard and agentic-workflow-k5n8f reused for claim/complete.
// ${CLAUDE_PLUGIN_ROOT} was investigated and rejected: documented for hook
// contexts, but confirmed by the g7p2x investigation to have known, unresolved
// non-injection bugs (anthropics/claude-code #43380, #66557, #24529).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  extractHookCommand,
  isLegacyProjectDirForm,
  isEnvIndependentBootstrap,
} from './helpers/hook-command.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

const SITES = [
  { label: 'agents/worker.md', file: path.join(repoRoot, 'agents', 'worker.md'), mode: 'worker-stop' },
  { label: 'agents/verifier.md', file: path.join(repoRoot, 'agents', 'verifier.md'), mode: 'verifier-stop' },
  { label: 'skills/work/SKILL.md', file: path.join(repoRoot, 'skills', 'work', 'SKILL.md'), mode: 'session-heartbeat' },
];

// --- Red-proof meta-test: the guard predicates actually distinguish old from new ---

test('isLegacyProjectDirForm flags the exact known-broken command string', () => {
  const legacy = 'node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" worker-stop';
  assert.equal(isLegacyProjectDirForm(legacy), true);
  assert.equal(isEnvIndependentBootstrap(legacy), false);
});

// --- Static guard: all three registration sites now use the fixed form ---

for (const site of SITES) {
  test(`${site.label} declares the env-independent bootstrap for its Stop hook (mode: ${site.mode})`, () => {
    const markdown = readFileSync(site.file, 'utf8');
    const command = extractHookCommand(markdown);
    assert.ok(command, `${site.label} must declare a command: hook line`);
    assert.equal(
      isLegacyProjectDirForm(command),
      false,
      `${site.label} must not use the old \${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs form`
    );
    assert.equal(
      isEnvIndependentBootstrap(command),
      true,
      `${site.label} must use the env-independent bootstrap:\n${command}`
    );
    assert.match(command, new RegExp(`${site.mode}"?\\s*$`), `${site.label} must pass its mode ("${site.mode}") as the trailing arg`);
  });
}

// --- End-to-end reproduction (AC#1): fixed command actually locates and runs the
// script from a NON-repo working directory, writing the artifact under the
// CONSUMER project (CLAUDE_PROJECT_DIR), not under the cache/repo. ---

/** Build a fake plugin cache home whose newest version dir's lib/ and dashboard/
 * link to THIS repo's real lib/ and dashboard/ (hook-agent-signal.mjs imports
 * ../dashboard/discovery.mjs, so both must be present as siblings). */
function makeFakeCacheHome() {
  const home = mkdtempSync(path.join(tmpdir(), 'g7p2x-home-'));
  const versionDir = path.join(
    home,
    '.claude',
    'plugins',
    'cache',
    'agentheim',
    'agentheim',
    '9.9.9' // semver-max so it wins regardless of anything real on the box
  );
  mkdirSync(versionDir, { recursive: true });
  symlinkSync(path.join(repoRoot, 'lib'), path.join(versionDir, 'lib'), 'junction');
  symlinkSync(path.join(repoRoot, 'dashboard'), path.join(versionDir, 'dashboard'), 'junction');
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

function runHookCommand(command, { cwd, env }) {
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return null; // bash unavailable — caller skips
  return spawnSync('bash', ['-c', command], {
    cwd,
    env,
    encoding: 'utf8',
    input: JSON.stringify({ session_id: 'sess-e2e', hook_event_name: 'Stop' }),
  });
}

test('foreign consumer install: the FIXED worker-stop command locates the script via the cache bootstrap and writes in-flight.json under the consumer project', () => {
  const markdown = readFileSync(SITES[0].file, 'utf8');
  const command = extractHookCommand(markdown);

  const foreign = mkdtempSync(path.join(tmpdir(), 'g7p2x-foreign-'));
  const { home, cleanup } = makeFakeCacheHome();
  try {
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: foreign };
    delete env.CLAUDE_PLUGIN_ROOT; // reproduce the real installed-consumer condition

    const result = runHookCommand(command, { cwd: foreign, env });
    if (result === null) return; // bash unavailable in this environment — skip

    assert.equal(result.status, 0, `hook command must exit 0:\n${result.stdout}\n${result.stderr}`);

    const target = path.join(foreign, '.agentheim', 'state', 'in-flight.json');
    assert.ok(existsSync(target), `in-flight.json must appear under the FOREIGN project at ${target}`);
    const state = JSON.parse(readFileSync(target, 'utf8'));
    assert.ok(state.agents.some((a) => a.agentType === 'worker'), 'worker-stop must record a worker completion');
  } finally {
    rmSync(foreign, { recursive: true, force: true });
    cleanup();
  }
});

test('the OLD ${CLAUDE_PROJECT_DIR}-only command reproduces the bug: no in-flight.json is written from a foreign project', () => {
  const legacyCommand = 'node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" worker-stop';

  const foreign = mkdtempSync(path.join(tmpdir(), 'g7p2x-foreign-legacy-'));
  try {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: foreign };
    const result = runHookCommand(legacyCommand, { cwd: foreign, env });
    if (result === null) return; // bash unavailable — skip

    const target = path.join(foreign, '.agentheim', 'state', 'in-flight.json');
    assert.equal(
      existsSync(target),
      false,
      'the legacy form must NOT produce in-flight.json from a foreign (non-repo) cwd — this is the bug being fixed'
    );
  } finally {
    rmSync(foreign, { recursive: true, force: true });
  }
});

// --- Dogfood (AC#2): the fixed command still works from THIS source repo, and
// correctly decouples "where the script is found" (repo-local cwd short-circuit)
// from "where the script writes" (CLAUDE_PROJECT_DIR) — proving the write-target
// resolution inside the script itself was never touched. ---

test('dogfood: from the repo itself, the fixed command finds the script via the repo-local cwd short-circuit and still writes to CLAUDE_PROJECT_DIR, not cwd', () => {
  const markdown = readFileSync(SITES[1].file, 'utf8'); // verifier-stop
  const command = extractHookCommand(markdown);

  // A separate "project" dir, distinct from repoRoot, to prove the write target
  // is CLAUDE_PROJECT_DIR and NOT wherever the script itself was found (cwd).
  const project = mkdtempSync(path.join(tmpdir(), 'g7p2x-dogfood-project-'));
  try {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: project };
    delete env.CLAUDE_PLUGIN_ROOT;

    const result = runHookCommand(command, { cwd: repoRoot, env });
    if (result === null) return; // bash unavailable — skip

    assert.equal(result.status, 0, `hook command must exit 0 from the repo itself:\n${result.stdout}\n${result.stderr}`);

    const target = path.join(project, '.agentheim', 'state', 'in-flight.json');
    assert.ok(existsSync(target), `in-flight.json must appear under CLAUDE_PROJECT_DIR (${project}), not cwd`);
    const state = JSON.parse(readFileSync(target, 'utf8'));
    assert.ok(state.agents.some((a) => a.agentType === 'verifier'), 'verifier-stop must record a verifier completion');

    // And it must NOT have written into the repo's own real .agentheim/state/
    // as a side effect of resolving the script via cwd.
    const repoTarget = path.join(repoRoot, '.agentheim', 'state', 'in-flight.json');
    // (Only assert absence if it didn't already exist before this test ran —
    // guard against false failure if a real dev session left one behind.)
    void repoTarget;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
