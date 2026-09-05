// Foreign-project integration test for the version-aware reuse/replace decision
// (ADR-0002 addendum, infrastructure-rgknz) — run at the SAME seam
// infrastructure-009/010 established (foreign-launch.test.mjs): the literal
// card form, `CLAUDE_PLUGIN_ROOT` deleted from the child env (the field
// condition), `os.homedir()` redirected to a fake plugin cache linking THIS
// repo's dashboard/, and the runfile asserted to land under the FOREIGN
// project, never the cache/repo.
//
// The property under test here is different from foreign-launch.test.mjs's:
// once a live server's runfile is made to claim an OLDER plugin version than
// the one currently on disk (the field symptom — "I updated the plugin and the
// dashboard didn't update"), a second `launch` through the SAME env-independent
// resolver bootstrap must REPLACE it — stop the outgoing pid, launch a fresh
// one, and land the new runfile under the SAME foreign project — rather than
// reporting `already running` against the stale process.
//
// (A real installed-plugin cache holds a full COPY of dashboard/ per version
// dir, not a symlink, so two on-disk versions there differ for real. This
// harness instead forces the skew directly on the written runfile — Node
// resolves an ESM module loaded through a symlink/junction to its REAL path
// for `import.meta.url`, so a second symlinked fake version dir would collapse
// back to the SAME real `plugin.json` and couldn't actually differ. Forcing
// the runfile's recorded version is the faithful way to exercise the skew at
// this seam without fighting that symlink-realpath collapse.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { runfilePath, readRunfile } from '../runfile.mjs';
import { extractLauncherInvocations, verbOf } from './helpers/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const repoRoot = path.join(dashboardDir, '..');
const cardPath = path.join(repoRoot, 'commands', 'dashboard.md');

function cardCommandFor(verb) {
  const card = readFileSync(cardPath, 'utf8');
  const invocations = extractLauncherInvocations(card);
  const match = invocations.find((line) => verbOf(line) === verb);
  if (!match) throw new Error(`card has no "${verb}" invocation`);
  return match;
}

function makeFakeCacheHome() {
  const home = mkdtempSync(path.join(tmpdir(), 'infra-rgknz-home-'));
  const versionDir = path.join(
    home,
    '.claude',
    'plugins',
    'cache',
    'agentheim',
    'agentheim',
    '9.9.9'
  );
  mkdirSync(versionDir, { recursive: true });
  symlinkSync(dashboardDir, path.join(versionDir, 'dashboard'), 'junction');
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

function runCard(command, { cwd, home }) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CLAUDE_PLUGIN_ROOT;
  return spawnSync('bash', ['-c', command], { cwd, env, encoding: 'utf8' });
}

test('foreign + EMPTY CLAUDE_PLUGIN_ROOT: a version-mismatched live runfile is REPLACED on the next launch, runfile stays under the foreign project', async () => {
  const bashProbe = spawnSync('bash', ['-c', 'exit 0']);
  if (bashProbe.error) return;

  const foreign = mkdtempSync(path.join(tmpdir(), 'infra-rgknz-foreign-'));
  mkdirSync(path.join(foreign, '.agentheim'));
  const { home, cleanup } = makeFakeCacheHome();

  const launchCmd = cardCommandFor('launch');
  const stopCmd = cardCommandFor('stop');
  const rfPath = runfilePath(foreign);

  try {
    // --- first launch: real plugin version/root recorded ---
    const launched = runCard(launchCmd, { cwd: foreign, home });
    assert.equal(launched.status, 0, `first launch failed:\n${launched.stdout}\n${launched.stderr}`);

    let appeared = false;
    for (let i = 0; i < 100 && !appeared; i++) {
      appeared = existsSync(rfPath);
      if (!appeared) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(appeared, `runfile must be written under the foreign project at ${rfPath}`);
    const firstRf = readRunfile(foreign);
    assert.ok(firstRf.pid > 0);
    assert.ok(firstRf.pluginVersion, 'the first runfile must record a real plugin version');

    // --- force a version skew directly on the runfile: same live pid, but
    //     claiming an OLDER version than the one actually on disk (the field
    //     symptom this task fixes) ---
    writeFileSync(
      rfPath,
      JSON.stringify(
        { ...firstRf, pluginVersion: '0.0.1-older-than-anything-real' },
        null,
        2
      )
    );

    // --- second launch through the SAME bootstrap: must REPLACE, not reuse ---
    const relaunched = runCard(launchCmd, { cwd: foreign, home });
    assert.equal(relaunched.status, 0, `relaunch failed:\n${relaunched.stdout}\n${relaunched.stderr}`);
    assert.match(
      relaunched.stdout,
      /replaced/i,
      `relaunch over a version-mismatched runfile must report "replaced":\n${relaunched.stdout}`
    );
    assert.doesNotMatch(
      relaunched.stdout,
      /already running/i,
      'a version-mismatched runfile must never be reported as "already running"'
    );

    // --- the runfile STILL lands under the foreign project, with a fresh pid
    //     and the real (non-forced) plugin version ---
    const secondRf = readRunfile(foreign);
    assert.notEqual(secondRf.pid, firstRf.pid, 'the outgoing (version-mismatched) process must be replaced by a new pid');
    assert.equal(secondRf.pluginVersion, firstRf.pluginVersion, 'the replacement must record the real plugin version, not the forced one');
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
