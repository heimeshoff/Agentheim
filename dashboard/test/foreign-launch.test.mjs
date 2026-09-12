// Foreign-project integration test (ADR-0002; infrastructure-009, amended by
// 010, retargeted onto the installed CLI by infrastructure-x56qm / ADR-0079).
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
// infrastructure-x56qm RETARGETS this seam: `/dashboard` no longer carries a
// `node` invocation at all (ADR-0079 §3, pointer-only), so the daily launch
// path this test must exercise is the INSTALLED CLI a consumer gets from
// `/setup` — `<home>/.local/bin/agentheim-dashboard.mjs` — not the (now
// nonexistent) card bootstrap line. This is a strictly stronger guard than the
// card-line form it replaces: it runs `lib/setup-cli.mjs`'s real `installCli`
// against a fake home, THEN exercises the literal file it produced.
//
// The fake home still doubles as a fake plugin cache (a version dir whose
// `dashboard/` links to THIS repo's own dashboard/): the installed CLI's OWN
// internal resolution (byte-identical to dashboard/resolve-launcher.mjs's
// logic) walks os.homedir() -> cache -> newest semver to find
// dashboard/resolve-launcher.mjs, exactly as it would for a real consumer.
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
import { installCli } from '../../lib/setup-cli.mjs';
import { cliCommandFor } from './helpers/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');

/**
 * Build a fake HOME whose plugin cache's newest version dir's dashboard/ links
 * to THIS repo's dashboard/, AND has the CLI actually installed into
 * `<home>/.local/bin` via the real `installCli` (from THIS repo's real
 * `dashboard/cli/`, found repo-locally since this test runs inside the repo).
 * Returns { home, cleanup }.
 */
function makeFakeHome() {
  const home = mkdtempSync(path.join(tmpdir(), 'infra-x56qm-home-'));
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
  // and launch.mjs (with all their sibling imports) resolve from one place --
  // this is what the INSTALLED agentheim-dashboard.mjs's own internal cache
  // walk needs to find dashboard/resolve-launcher.mjs from a foreign project.
  symlinkSync(dashboardDir, path.join(versionDir, 'dashboard'), 'junction');

  const installResult = installCli({ homedir: home, platform: process.platform, env: process.env });
  if (installResult.exitCode !== 0) {
    throw new Error(`fixture setup: installCli failed: ${installResult.lines.join('\n')}`);
  }
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

/**
 * Run a CLI command through bash. CLAUDE_PLUGIN_ROOT is DELETED (the field
 * condition); HOME and USERPROFILE point at the fake home so os.homedir()
 * resolves there for BOTH the installed script's own cache walk.
 */
function runCli(command, { cwd, home }) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CLAUDE_PLUGIN_ROOT; // reproduce the empty-var field condition
  return spawnSync('bash', ['-c', command], { cwd, env, encoding: 'utf8' });
}

test('installed CLI + EMPTY CLAUDE_PLUGIN_ROOT: launch writes the runfile under the project, status + stop work', async () => {
  // Guard: bash must be available (the daily-path execution context). Skip otherwise.
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return;

  const foreign = mkdtempSync(path.join(tmpdir(), 'infra-x56qm-foreign-'));
  mkdirSync(path.join(foreign, '.agentheim'));
  const { home, cleanup } = makeFakeHome();

  const launchCmd = cliCommandFor(home, 'launch');
  const statusCmd = cliCommandFor(home, 'status');
  const stopCmd = cliCommandFor(home, 'stop');

  try {
    // --- launch via the installed CLI, env-independent ---
    const launched = runCli(launchCmd, { cwd: foreign, home });
    assert.equal(
      launched.status,
      0,
      `launch failed (no module-not-found expected):\n${launched.stdout}\n${launched.stderr}`
    );
    assert.doesNotMatch(
      `${launched.stdout}${launched.stderr}`,
      /Cannot find module/,
      'installed CLI launch must resolve launch.mjs (no module-not-found)'
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
    const status = runCli(statusCmd, { cwd: foreign, home });
    assert.equal(status.status, 0, `status failed:\n${status.stderr}`);
    assert.match(status.stdout, /running/i, `status should report running:\n${status.stdout}`);
  } finally {
    try {
      runCli(stopCmd, { cwd: foreign, home });
    } catch {
      /* swallow — teardown must not mask the real failure */
    }
    rmSync(foreign, { recursive: true, force: true });
    cleanup();
  }
});

test('installed CLI + EMPTY CLAUDE_PLUGIN_ROOT: after stop, the runfile is gone (no orphan)', async () => {
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return;

  const foreign = mkdtempSync(path.join(tmpdir(), 'infra-x56qm-stop-'));
  mkdirSync(path.join(foreign, '.agentheim'));
  const { home, cleanup } = makeFakeHome();

  const launchCmd = cliCommandFor(home, 'launch');
  const stopCmd = cliCommandFor(home, 'stop');
  try {
    runCli(launchCmd, { cwd: foreign, home });
    const rfPath = runfilePath(foreign);
    for (let i = 0; i < 100 && !existsSync(rfPath); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const stopped = runCli(stopCmd, { cwd: foreign, home });
    assert.equal(stopped.status, 0, `stop failed:\n${stopped.stderr}`);

    let gone = false;
    for (let i = 0; i < 100 && !gone; i++) {
      gone = !existsSync(rfPath);
      if (!gone) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(gone, 'stop must remove the runfile (no orphaned runtime state)');
  } finally {
    try {
      runCli(stopCmd, { cwd: foreign, home });
    } catch {
      /* best effort */
    }
    rmSync(foreign, { recursive: true, force: true });
    cleanup();
  }
});
