// bridge-selection — the per-machine "which bridge does the dashboard use"
// fact (ADR-0082 §1, infrastructure-e8h9f). `<home>/.config/agentheim/
// config.json` = `{schema:1, bridge:'vscode'|'herdr'|'none'}`, written by
// `/setup use bridge <kind>` and read by `status`/the dashboard server.
//
// WHY THIS LOCATION
// User-level, once-per-machine, never inside a project tree — the same shape
// ADR-0079 already chose for the CLI install target (infrastructure-x56qm).
// Deliberately NOT `<home>/.agentheim/` (name-collides with the PROJECT-level
// `.agentheim/` directory) and NOT `<home>/.claude/` (not Agentheim's own).
//
// EVERY FIXTURE MUST BE HERMETIC: `homedir` is always an injected parameter,
// never a bare `os.homedir()` call buried where a test can't reach it.
//
// READ NEVER THROWS: absence of the file, an unreadable file, invalid JSON,
// a non-object shape, or an unrecognized `bridge` value all resolve to the
// same `{bridge: null}` -- behaviourally identical to `'vscode'` on the read
// side (today's default is unchanged on upgrade), never a thrown error a
// caller would need to catch.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The three recognized bridge kinds -- shared by the reader's validation and `/setup`'s verb parsing. */
export const BRIDGE_KINDS = ['vscode', 'herdr', 'none'];

const BRIDGE_KIND_SET = new Set(BRIDGE_KINDS);

/**
 * The per-machine config file path -- built from an injected `homedir`, never
 * `os.homedir()` inline (`lib/test/sole-path-constructor.test.mjs`'s doctrine).
 * @param {string} homedir
 * @returns {string} `<home>/.config/agentheim/config.json`
 */
export function bridgeConfigPath(homedir) {
  return path.join(homedir, '.config', 'agentheim', 'config.json');
}

/**
 * Read the recorded bridge selection. Never throws: any failure to read or
 * parse the file, or an unrecognized `bridge` value, resolves to
 * `{bridge: null}`.
 * @param {string} homedir
 * @returns {{bridge: 'vscode'|'herdr'|'none'|null}}
 */
export function readBridgeSelection(homedir) {
  let raw;
  try {
    raw = readFileSync(bridgeConfigPath(homedir), 'utf8');
  } catch {
    return { bridge: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { bridge: null };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { bridge: null };
  }

  const bridge = parsed.bridge;
  if (!BRIDGE_KIND_SET.has(bridge)) {
    return { bridge: null };
  }
  return { bridge };
}

/**
 * Write the bridge selection, creating `<home>/.config/agentheim/` if absent.
 * @param {string} homedir
 * @param {'vscode'|'herdr'|'none'} kind
 * @returns {{schema: 1, bridge: 'vscode'|'herdr'|'none'}} the written contents
 */
export function writeBridgeSelection(homedir, kind) {
  if (!BRIDGE_KIND_SET.has(kind)) {
    throw new Error(`invalid bridge kind: ${JSON.stringify(kind)} (expected one of ${BRIDGE_KINDS.join('|')})`);
  }
  const configPath = bridgeConfigPath(homedir);
  mkdirSync(path.dirname(configPath), { recursive: true });
  const contents = { schema: 1, bridge: kind };
  writeFileSync(configPath, JSON.stringify(contents, null, 2) + '\n');
  return contents;
}
