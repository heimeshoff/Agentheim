// Foreign-project integration test (ADR-0002; infrastructure-009, amended by 010).
//
// THE FIELD-FAILURE CONDITION, made permanent.
// infrastructure-009's original version ran the card form WITH CLAUDE_PLUGIN_ROOT
// set to the repo — so it passed while the real field run (env empty) failed. This
// amendment (infrastructure-010) reproduces the actual field condition:
//   - CLAUDE_PLUGIN_ROOT is DELETED from the child env (it is empty in installed
//     consumers, the root cause of the v0.8.3 bug),
//   - cwd is a foreign project that has ONLY `.agentheim/` (no dashboard/),
//   - the launcher is reached ONLY through the env-independent resolver bootstrap,
//     which derives the cache from os.homedir().
//
// To exercise THIS repo's resolver/launcher under that condition without depending
// on whatever happens to be installed, we point os.homedir() (via HOME/USERPROFILE
// in the child env) at a temp fake home whose plugin cache version dir links to the
// repo's own dashboard/. The bootstrap then walks that cache, finds the resolver,
// and spawns launch.mjs — with the FOREIGN project as cwd — exactly as it would in
// the field. We assert: no module-not-found, runfile under the FOREIGN project,
// status + stop work.
//
// Teardown (ADR-0002: detached, unref'd process; Windows process.kill/taskkill) is
// the risk area: launch spawns a detached server, so the test MUST stop it via the
// launcher's own stop path AND remove the temp dirs in a `finally`.

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

import { runfilePath } from '../runfile.mjs';
import { extractLauncherInvocations, substituteArguments } from './helpers/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const repoRoot = path.join(dashboardDir, '..');
const cardPath = path.join(repoRoot, 'commands', 'dashboard.md');

/**
 * Build the launcher command for a given verb straight out of the card, so the
 * integration test runs the LITERAL card form (incl. the `node -e` bootstrap)
 * rather than a hand-retyped approximation that could drift.
 *
 * infrastructure-k9t2v: the card carries a SINGLE invocation that forwards the
 * verb at runtime via `$ARGUMENTS`. This simulates Claude Code's own
 * slash-command argument substitution — replacing the literal `$ARGUMENTS`
 * placeholder with the verb text — so each verb is still exercised as a real,
 * distinct shell command even though the card's source has only one line.
 */
function cardCommandFor(verb) {
  const card = readFileSync(cardPath, 'utf8');
  const [invocation] = extractLauncherInvocations(card);
  if (!invocation) throw new Error('card has no launcher invocation');
  const verbArg = verb === 'launch' ? '' : verb;
  return substituteArguments(invocation, verbArg);
}

/**
 * Build a fake plugin cache home whose newest version dir's dashboard/ links to
 * THIS repo's dashboard/. Returns { home, cleanup }. The bootstrap, run with
 * HOME/USERPROFILE pointed here, will discover this dir as the install.
 */
function makeFakeCacheHome() {
  const home = mkdtempSync(path.join(tmpdir(), 'infra010-home-'));
  const versionDir = path.join(
    home,
    '.claude',
    'plugins',
    'cache',
    'agentheim',
    'agentheim',
    '9.9.9' // a semver max so it wins regardless of anything real on the box
  );
  mkdirSync(versionDir, { recursive: true });
  // Link the version dir's dashboard/ to the repo dashboard so resolve-launcher.mjs
  // and launch.mjs (with all their sibling imports) resolve from one place.
  symlinkSync(dashboardDir, path.join(versionDir, 'dashboard'), 'junction');
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

/**
 * Run a card command through bash (the card's `allowed-tools: Bash(node:*)`
 * execution context). CLAUDE_PLUGIN_ROOT is DELETED (the field condition); HOME and
 * USERPROFILE point at the fake cache home so os.homedir() resolves there.
 */
function runCard(command, { cwd, home }) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CLAUDE_PLUGIN_ROOT; // reproduce the empty-var field condition
  return spawnSync('bash', ['-c', command], { cwd, env, encoding: 'utf8' });
}

test('foreign + EMPTY CLAUDE_PLUGIN_ROOT: resolver-bootstrap launch writes the runfile under the project, status + stop work', async () => {
  // Guard: bash must be available (the card's execution context). Skip otherwise.
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return;

  const foreign = mkdtempSync(path.join(tmpdir(), 'infra010-foreign-'));
  mkdirSync(path.join(foreign, '.agentheim'));
  const { home, cleanup } = makeFakeCacheHome();

  const launchCmd = cardCommandFor('launch');
  const statusCmd = cardCommandFor('status');
  const stopCmd = cardCommandFor('stop');

  try {
    // --- launch via the literal card command, env-independent ---
    const launched = runCard(launchCmd, { cwd: foreign, home });
    assert.equal(
      launched.status,
      0,
      `launch failed (no module-not-found expected):\n${launched.stdout}\n${launched.stderr}`
    );
    assert.doesNotMatch(
      `${launched.stdout}${launched.stderr}`,
      /Cannot find module/,
      'resolver-bootstrap launch must resolve launch.mjs (no module-not-found)'
    );
    assert.doesNotMatch(
      `${launched.stdout}${launched.stderr}`,
      /no Agentheim dashboard resolver found/,
      'resolver must be found in the (fake) home cache'
    );

    // --- the runfile lands under the FOREIGN project, not the cache/repo ---
    const rfPath = runfilePath(foreign);
    let appeared = false;
    for (let i = 0; i < 100 && !appeared; i++) {
      appeared = existsSync(rfPath);
      if (!appeared) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(appeared, `runfile must be written under the foreign project at ${rfPath}`);
    const rf = JSON.parse(readFileSync(rfPath, 'utf8'));
    assert.ok(rf.pid > 0 && rf.port > 0, 'runfile must carry a live pid + port');

    // --- status reports running ---
    const status = runCard(statusCmd, { cwd: foreign, home });
    assert.equal(status.status, 0, `status failed:\n${status.stderr}`);
    assert.match(status.stdout, /running/i, `status should report running:\n${status.stdout}`);
  } finally {
    try {
      runCard(stopCmd, { cwd: foreign, home });
    } catch {
      /* swallow — teardown must not mask the real failure */
    }
    rmSync(foreign, { recursive: true, force: true });
    cleanup();
  }
});

test('foreign + EMPTY CLAUDE_PLUGIN_ROOT: after card-form stop, the runfile is gone (no orphan)', async () => {
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return;

  const foreign = mkdtempSync(path.join(tmpdir(), 'infra010-stop-'));
  mkdirSync(path.join(foreign, '.agentheim'));
  const { home, cleanup } = makeFakeCacheHome();

  const launchCmd = cardCommandFor('launch');
  const stopCmd = cardCommandFor('stop');
  try {
    runCard(launchCmd, { cwd: foreign, home });
    const rfPath = runfilePath(foreign);
    for (let i = 0; i < 100 && !existsSync(rfPath); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const stopped = runCard(stopCmd, { cwd: foreign, home });
    assert.equal(stopped.status, 0, `stop failed:\n${stopped.stderr}`);

    let gone = false;
    for (let i = 0; i < 100 && !gone; i++) {
      gone = !existsSync(rfPath);
      if (!gone) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(gone, 'stop must remove the runfile (no orphaned runtime state)');
  } finally {
    try {
      runCard(stopCmd, { cwd: foreign, home });
    } catch {
      /* best effort */
    }
    rmSync(foreign, { recursive: true, force: true });
    cleanup();
  }
});
