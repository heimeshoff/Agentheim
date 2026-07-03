#!/usr/bin/env node
// task-lifecycle CLI — thin argv parse -> discoverRoot -> handler -> print manifest ->
// exit (ADR-0038 layer 2/3 boundary, agentic-workflow-k5n8f, agentic-workflow-t7m4c).
//
// Git-free (ADR-0038 Ruling B): this CLI never runs `git`. It performs the
// deterministic INDEX/protocol text surgery (via lib/task-lifecycle.mjs's
// promoteTask / claimBatch / completeTask) and prints an enumerated manifest
// `{ changed, message, verb, id|ids }` — or a structured rejection `{ok:false,
// code, reason}` — for the CALLER (a skill / orchestrator) to `git add` and
// commit. Node stdlib only.
//
// Three verbs, three argv shapes (the second positional argument's meaning
// depends on the verb):
//   - `promote <task-id>`          — single id.
//   - `claim <id-1>,<id-2>,...`    — a comma-separated batch of ids (ADR-0032:
//     the conductor claims a whole ready set in one call, one manifest, one
//     "Batch started" protocol entry).
//   - `complete <task-id>`         — single id, idempotent w.r.t. an
//     already-in-done/ file (the worker's worktree may have already moved it).
//
// An optional THIRD positional argument, on any verb, is a JSON object string
// merged into the handler's `opts` — this is how `complete` receives the richer
// bookkeeping fields (summary, duration, verification, filesChanged, etc.) that
// don't fit a bare id, and how `claim` receives an optional `parallel` /
// `planningAdvisory` override. Example:
//   `node lib/task-lifecycle-cli.mjs complete <id> '{"summary":"...","verification":"PASS (iteration 1)"}'`
//
// Two invocation shapes for the CLI itself:
//   1. Direct dev/repo use: `node lib/task-lifecycle-cli.mjs <verb> <id-or-ids> [json-opts]`
//      (the isMain guard below drives this via `main()`).
//   2. The env-free `node -e` bootstrap (infrastructure-010's pattern, reused by
//      lib/resolve-plugin-file.mjs for an installed-plugin consumer project):
//      the bootstrap `import()`s this module and calls the exported `main`
//      directly with its own sliced argv — it does NOT rely on `isMain`, since
//      `process.argv[1]` inside a dynamic import from a `node -e` string never
//      equals this module's own path.
//
// `discoverRoot` is reused from `dashboard/discovery.mjs` as-is (a `lib ->
// dashboard` import direction the architect flagged as a follow-on to clean up
// by promoting it into `lib/` — not done here, per k5n8f's Notes).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { promoteTask, claimBatch, completeTask } from './task-lifecycle.mjs';
import { discoverRoot } from '../dashboard/discovery.mjs';

/** verb -> (rootDir, idOrIds, opts) => result, one handler per mechanized lifecycle verb. */
const HANDLERS = {
  promote: (rootDir, id, opts) => promoteTask(rootDir, id, opts),
  claim: (rootDir, ids, opts) => claimBatch(rootDir, ids.split(',').filter(Boolean), opts),
  complete: (rootDir, id, opts) => completeTask(rootDir, id, opts),
};

/**
 * Run the CLI against an explicit argv (excluding `node` and the script path)
 * and an optional injectable cwd/discoverRoot/taskOpts — exported so tests (and
 * the `node -e` bootstrap) can drive it without spawning a child process.
 * @param {string[]} argv  `[verb, idOrIds, jsonOptsString?]`
 * @param {object} [opts]
 * @param {string} [opts.cwd]            defaults to `process.cwd()`
 * @param {Function} [opts.discoverRoot] override for tests; defaults to the real `discoverRoot`
 * @param {object} [opts.taskOpts]       forwarded to the verb handler (e.g. `now` for tests);
 *   takes precedence over any third-argv JSON opts on a key-by-key basis.
 * @returns {{exitCode:number, output:object}}
 */
export function runCli(argv, opts = {}) {
  const [verb, id, rawOptsJson] = argv;
  const cwd = opts.cwd ?? process.cwd();

  if (!verb || !HANDLERS[verb]) {
    const known = Object.keys(HANDLERS).join(', ');
    return {
      exitCode: 1,
      output: {
        ok: false,
        code: 'unknown-verb',
        reason: `Unknown or missing verb "${verb ?? ''}". Known verbs: ${known}.`,
      },
    };
  }
  if (!id) {
    return {
      exitCode: 1,
      output: { ok: false, code: 'missing-id', reason: 'A task id is required: <verb> <task-id>.' },
    };
  }

  let cliOpts = {};
  if (rawOptsJson !== undefined) {
    try {
      cliOpts = JSON.parse(rawOptsJson);
    } catch (err) {
      return {
        exitCode: 1,
        output: { ok: false, code: 'invalid-opts-json', reason: `Third argument must be JSON: ${err.message}` },
      };
    }
  }

  let rootDir;
  try {
    rootDir = (opts.discoverRoot ?? discoverRoot)(cwd);
  } catch (err) {
    return { exitCode: 1, output: { ok: false, code: 'no-project-root', reason: err.message } };
  }

  const taskOpts = { ...cliOpts, ...(opts.taskOpts ?? {}) };
  const result = HANDLERS[verb](rootDir, id, taskOpts);
  return { exitCode: result.ok ? 0 : 1, output: result };
}

/**
 * Print the manifest (or rejection) as JSON on stdout and exit with the
 * matching code. This is the whole runtime behavior, exported so the `node -e`
 * bootstrap can call it directly after `import()`, mirroring how
 * `dashboard/resolve-launcher.mjs`'s bootstrap calls the exported `run`.
 * @param {string[]} [argv]  defaults to `process.argv.slice(2)` (the direct
 *   `node lib/task-lifecycle-cli.mjs <verb> <id>` shape)
 */
export function main(argv = process.argv.slice(2)) {
  const { exitCode, output } = runCli(argv);
  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
