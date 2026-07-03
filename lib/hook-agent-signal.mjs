#!/usr/bin/env node
// hook-agent-signal — the Claude Code hook entrypoint behind the live in-flight
// lane (agentic-workflow-m9w5c, ADR-0043).
//
// Wired as a `Stop` command hook in three places:
//   - `skills/work/SKILL.md` frontmatter        → mode "session-heartbeat"
//     (fires on every orchestrator turn while `work` is active; the
//     work-session-presence-lock research's heartbeat design).
//   - `agents/worker.md` frontmatter            → mode "worker-stop"
//   - `agents/verifier.md` frontmatter           → mode "verifier-stop"
//     (a subagent's own `Stop` is auto-converted to `SubagentStop` when it
//     completes — the work-terminal-completion-signal research's mechanism.)
//
// Reads the hook's JSON payload from stdin (best-effort — an empty/malformed
// payload degrades to "no session id", never a crash), applies the matching
// PURE transition from lib/agent-heartbeat.mjs, and writes the result to the
// ADVISORY artifact `.agentheim/state/in-flight.json` (ADR-0027 category,
// extended to this second artifact by ADR-0043). This is an ADVISORY write —
// git-ignored (`.agentheim/state/`), overwritten, never a lifecycle write; the
// dashboard reads it and stays read-only over it (ADR-0017).
//
// A hook command must never break the Claude Code session it runs inside: every
// failure path here (unreadable stdin, unresolvable project root, an unwritable
// state/ dir) is swallowed and the script exits 0. Observability that can crash
// the thing it observes defeats its own purpose.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverRoot } from '../dashboard/discovery.mjs';
import { applyHeartbeat, applyAgentCompletion } from './agent-heartbeat.mjs';

const STATE_RELATIVE_PATH = path.join('.agentheim', 'state', 'in-flight.json');

/** Read all of stdin synchronously, tolerating "no stdin"/a closed pipe. Never throws. */
function readStdinSync() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Parse the hook's JSON payload. Malformed/absent input yields `{}` — never throws. */
function parsePayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Resolve the project root: `${CLAUDE_PROJECT_DIR}` first (the documented, reliable
 * hook env var), falling back to walking up from cwd. Returns null on failure. */
function resolveRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '' && existsSync(fromEnv)) {
    return path.resolve(fromEnv);
  }
  try {
    return discoverRoot(process.cwd());
  } catch {
    return null;
  }
}

/** Load the prior state, tolerating an absent/corrupt file. Returns null (not `{}`) on
 * absence/corruption so the pure `apply*` functions treat it as "start fresh". */
function loadExisting(target) {
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Run one hook fire end-to-end: read stdin, resolve the target file, apply the
 * matching pure transition, write the result. Exported (not just invoked at
 * module scope) so tests can drive it directly without a subprocess.
 * @param {string} mode — "session-heartbeat" | "worker-stop" | "verifier-stop"
 * @param {{ stdin?: string, root?: string, now?: () => string }} [deps] — injected
 *   for testing; production use reads real stdin/env/clock.
 * @returns {{ok: true, path: string} | {ok: false, reason: string}}
 */
export function runHook(mode, deps = {}) {
  const raw = deps.stdin ?? readStdinSync();
  const payload = parsePayload(raw);
  const root = deps.root ?? resolveRoot();
  if (!root) return { ok: false, reason: 'no-project-root' };

  const nowIso = deps.now ? deps.now() : new Date().toISOString();
  const target = path.join(root, STATE_RELATIVE_PATH);
  const existing = loadExisting(target);
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;

  let next;
  if (mode === 'worker-stop' || mode === 'verifier-stop') {
    const agentType = mode === 'worker-stop' ? 'worker' : 'verifier';
    const agentId = typeof payload.agent_id === 'string' ? payload.agent_id : sessionId ?? '';
    next = applyAgentCompletion(existing, { agentType, agentId, sessionId, nowIso });
  } else {
    // "session-heartbeat" and any unrecognized mode both degrade to a plain heartbeat —
    // never a hard failure over an unexpected argv (a hook command must not break the
    // session it runs inside).
    next = applyHeartbeat(existing, { sessionId, nowIso });
  }

  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch (err) {
    return { ok: false, reason: `write-failed: ${err.message}` };
  }
  return { ok: true, path: target };
}

// CLI entrypoint — only when invoked directly (not when imported by tests). Same
// isMain guard idiom as lib/task-lifecycle-cli.mjs / lib/protocol-rotation.mjs.
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const mode = process.argv[2] || 'session-heartbeat';
  // Best-effort by design (see file header): never exit non-zero, never rethrow.
  try {
    runHook(mode);
  } catch {
    /* a hook must never crash the session it observes */
  }
  process.exit(0);
}
