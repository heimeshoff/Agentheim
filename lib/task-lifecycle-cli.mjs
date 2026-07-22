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

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { promoteTask, claimBatch, completeTask, deriveContext } from './task-lifecycle.mjs';
import { discoverRoot } from '../dashboard/discovery.mjs';
import { partitionCheckpointFiles } from './derived-artifact-guard.mjs';

// checkpoint — NOT a task-move verb (moves no task, edits no INDEX), unlike
// its three siblings below. It stays on this CLI anyway (an argued departure
// the task sanctions) because it is git-free and shares the same manifest
// convention: the conductor calls it before `git -C .worktrees/<id> add`, to
// filter the worker's self-reported FILE_LIST down to what is safe to stage.
// agentic-workflow-q7v3k / ADR-0057: a derived artifact (dashboard/dist/,
// ADR-0003) never rebuilds itself in main history because the conductor
// never *stages* it, so a worktree rebuild — mechanically unavoidable, since
// running the test suite rebuilds it (dashboard/test/dist-build.test.mjs's
// `before()` hook) — is rendered inert rather than merely forbidden.
const DERIVED_ARTIFACT_REFUSAL_REASON =
  "dashboard/dist/ is a derived, bundled artifact (ADR-0003: the styleguide/dashboard app/ source is the single source of truth; dist/ is esbuild's build-time output), not source, so the checkpoint guard drops it rather than staging it. esbuild tree-shakes unused exports, so a bundle rebuilt inside one worker's worktree is not a pure function of that worker's diff — staging and merging it risks shipping an artifact built from a source tree that never existed post-merge (ADR-0057).";

// Lifecycle folders a worker's OWN move (never `applyTaskMove`, which never
// runs inside a worktree — ADR-0038 Ruling B) can ever land the task file in,
// each implying the SAME vacated source: `doing/` (agentic-workflow-w2njd).
// Every id ever passed to `checkpoint` was, by construction, batch-claimed
// into `doing/` before dispatch (ADR-0032) — so a task file found under
// `done/` (SUCCESS) or `backlog/` (BOUNCE) always implies a `doing/` -> that
// folder move, never any other source.
const MOVED_FROM_DOING_FOLDERS = ['done', 'backlog'];

/**
 * Detect a moved task file for `id` among `fileList`'s entries and, if found,
 * return the absolute path of the `doing/` counterpart the move vacated — or
 * `null` if no such move is present in this fileList (an ordinary,
 * task-file-free checkpoint call, the common case for iteration checkpoints
 * before a worker's final move).
 *
 * This is the fix for the bug the checkpoint staging set previously had: the
 * conductor's fileList only ever names the task file's NEW location (per
 * skills/work/SKILL.md's "FILE_LIST + moved task file"/"abs-path-to-task-
 * file-in-backlog"), so the moved-from `doing/` path's deletion was never
 * staged, leaving the wip commit's tree holding the task file in BOTH
 * lifecycle folders. Detection needs no git and no extra caller-supplied
 * field — it is a pure function of the id + fileList already at hand,
 * closing the gap without a new hand-rule for the doctrine to carry.
 *
 * Safe by construction, not merely by convention: the candidate `doing/`
 * path is only returned when it no longer exists on disk, confirming the
 * move actually vacated it in THIS worktree (as opposed to some unrelated,
 * still-live duplicate) — `git add` on a vacated-but-previously-tracked path
 * stages the deletion; done on a path that both never existed AND was never
 * tracked aborts the whole `git add`, which is exactly what this guard
 * avoids by requiring the on-disk absence first.
 *
 * @param {string} rootDir worktree root
 * @param {string} id task id
 * @param {string[]} fileList the caller's declared checkpoint fileList
 * @returns {string|null}
 */
function findMovedFromDoingPath(rootDir, id, fileList) {
  const context = deriveContext(id);
  for (const filePath of fileList) {
    for (const folder of MOVED_FROM_DOING_FOLDERS) {
      const dir = path.join(rootDir, '.agentheim', 'contexts', context, folder) + path.sep;
      if (!filePath.startsWith(dir)) continue;
      const basename = path.basename(filePath);
      const isThisTask = basename === `${id}.md` || basename.startsWith(`${id}-`);
      if (!isThisTask) continue;
      const fromPath = path.join(rootDir, '.agentheim', 'contexts', context, 'doing', basename);
      if (!existsSync(fromPath)) return fromPath;
    }
  }
  return null;
}

/**
 * checkpoint handler — partitions `opts.fileList` (absolute, OS-native-
 * separator paths, the worker's self-reported FILE_LIST) via
 * `partitionCheckpointFiles`, against `rootDir` as the worktree root. When
 * `fileList` names the task file at its NEW lifecycle location (`done/` or
 * `backlog/`), the vacated `doing/` counterpart is detected and folded into
 * the set before partitioning, so `changed` names BOTH halves of the move
 * (agentic-workflow-w2njd).
 * @param {string} rootDir the discovered project root — when invoked with
 *   cwd inside a worker's worktree, this IS that worktree's root.
 * @param {string} id the task id, folded into the wip-commit `message`.
 * @param {object} opts
 * @param {string[]} opts.fileList required; absolute paths to partition.
 * @param {number} [opts.iteration] defaults to 1.
 */
function checkpointFiles(rootDir, id, opts = {}) {
  const { fileList, iteration = 1 } = opts;
  if (!Array.isArray(fileList)) {
    return {
      ok: false,
      code: 'invalid-file-list',
      reason: 'checkpoint requires opts.fileList to be an array of absolute paths.',
    };
  }

  const movedFromPath = findMovedFromDoingPath(rootDir, id, fileList);
  const effectiveFileList = movedFromPath ? [...fileList, movedFromPath] : fileList;

  const { changed, refused } = partitionCheckpointFiles(rootDir, effectiveFileList);
  return {
    ok: true,
    changed,
    refused,
    refusalReason: refused.length > 0 ? DERIVED_ARTIFACT_REFUSAL_REASON : null,
    message: `wip [${id}] iter ${iteration}`,
    verb: 'checkpoint',
  };
}

/** verb -> (rootDir, idOrIds, opts) => result, one handler per mechanized lifecycle verb. */
const HANDLERS = {
  promote: (rootDir, id, opts) => promoteTask(rootDir, id, opts),
  claim: (rootDir, ids, opts) => claimBatch(rootDir, ids.split(',').filter(Boolean), opts),
  complete: (rootDir, id, opts) => completeTask(rootDir, id, opts),
  checkpoint: (rootDir, id, opts) => checkpointFiles(rootDir, id, opts),
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
