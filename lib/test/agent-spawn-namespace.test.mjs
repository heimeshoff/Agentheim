// Tests for lib/agent-spawn-namespace.mjs — the live-tree lint guarding the
// infrastructure-nz6k4 namespacing convention: every internal `subagent_type`
// spawn identifier naming an Agentheim-provided agent must carry the
// `agentheim:` plugin-namespace prefix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { findBareAgentSpawns, AGENTHEIM_AGENT_NAMES } from '../agent-spawn-namespace.mjs';

// --- AGENTHEIM_AGENT_NAMES ---------------------------------------------------

test('AGENTHEIM_AGENT_NAMES is frozen and lists the eight Agentheim agents', () => {
  assert.equal(Object.isFrozen(AGENTHEIM_AGENT_NAMES), true);
  assert.deepEqual(
    [...AGENTHEIM_AGENT_NAMES].sort(),
    [
      'architect',
      'orchestrator',
      'research-reviewer',
      'researcher',
      'strategic-modeler',
      'tactical-modeler',
      'verifier',
      'worker',
    ].sort()
  );
});

// --- findBareAgentSpawns: fixture behavior -----------------------------------

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-spawn-namespace-'));
  mkdirSync(path.join(root, 'skills', 'work'), { recursive: true });
  mkdirSync(path.join(root, 'agents'), { recursive: true });
  return root;
}

test('findBareAgentSpawns flags a bare subagent_type spawn of an Agentheim agent name', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'skills', 'work', 'SKILL.md'),
      'Spawn with `Agent(subagent_type: "worker", prompt: <p>)`.\n'
    );
    const found = findBareAgentSpawns(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, 'worker');
    assert.equal(found[0].line, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findBareAgentSpawns does NOT flag a properly-qualified `agentheim:` spawn', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'skills', 'work', 'SKILL.md'),
      'Spawn with `Agent(subagent_type: "agentheim:worker", prompt: <p>)`.\n'
    );
    const found = findBareAgentSpawns(root);
    assert.deepEqual(found, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findBareAgentSpawns ignores a subagent_type value that is not an Agentheim agent name', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'skills', 'work', 'SKILL.md'),
      'Spawn with `Agent(subagent_type: "general-purpose", prompt: <p>)`.\n'
    );
    const found = findBareAgentSpawns(root);
    assert.deepEqual(found, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findBareAgentSpawns catches a bare routing-table row in agents/*.md, not just skills/', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'agents', 'worker.md'),
      '| Cross-cutting tech | `architect` |\n'
    );
    const found = findBareAgentSpawns(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, 'architect');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- findBareAgentSpawns: the recurring live-tree gate -----------------------

test('the live skills/ and agents/ trees have NO bare Agentheim agent-name spawns', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const found = findBareAgentSpawns(repoRoot);
  assert.deepEqual(
    found,
    [],
    `expected no bare agent-name spawns, found: ${found
      .map((f) => `${f.file}:${f.line} (${f.name})`)
      .join(', ')}`
  );
});
