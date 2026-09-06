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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  promoteTask,
  claimBatch,
  completeTask,
  bounceTask,
  deriveContext,
  insertIndexLineAtTop,
  prependProtocolEntry,
  normalizeText,
  denormalizeText,
} from './task-lifecycle.mjs';
import { captureTask, dismissTask, rerouteTask } from './task-lifecycle-capture-dismiss.mjs';
import { migrateLayout } from './layout-migration.mjs';
import { discoverRoot } from '../dashboard/discovery.mjs';
import { partitionCheckpointFiles } from './derived-artifact-guard.mjs';
import { withLifecycleLock } from './lifecycle-lock.mjs';
import {
  taskFolderPath,
  protocolPath as resolveProtocolPath,
  knowledgeIndexPath as resolveKnowledgeIndexPath,
  topIndexPath as resolveTopIndexPath,
} from './task-system-paths.mjs';

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
//
// Vestigial post-ghcaj (agentic-workflow-ghcaj): a worker's FILE_LIST is
// source and tests only and never names a task file at all, so no fileList
// entry can ever match a MOVED_FROM_DOING_FOLDERS path anymore — the
// conductor performs the one doing -> done/backlog move directly on `main`.
// Kept, not removed; a follow-up task should delete this dead path.
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
 * Vestigial post-ghcaj (agentic-workflow-ghcaj): this detection can no
 * longer fire in the ordinary path — a worker's FILE_LIST never names a
 * task file (source and tests only), so the `fileList` loop below never
 * matches. Retained for a resumed/interrupted session; a follow-up task
 * should remove it.
 *
 * @param {string} rootDir worktree root
 * @param {string} id task id
 * @param {string[]} fileList the caller's declared checkpoint fileList
 * @returns {string|null}
 */
function findMovedFromDoingPath(rootDir, id, fileList) {
  const context = deriveContext(id);
  for (const filePath of fileList) {
    // Normalize before comparing so a fileList entry using forward slashes on
    // a backslash-native platform (or vice versa) still matches — callers may
    // pass either shape (agentic-workflow-kp7dq hardens w2njd's native-only
    // startsWith check).
    const normalizedFilePath = path.normalize(filePath);
    for (const folder of MOVED_FROM_DOING_FOLDERS) {
      const dir = path.normalize(taskFolderPath(rootDir, context, folder)) + path.sep;
      if (!normalizedFilePath.startsWith(dir)) continue;
      const basename = path.basename(normalizedFilePath);
      const isThisTask = basename === `${id}.md` || basename.startsWith(`${id}-`);
      if (!isThisTask) continue;
      const fromPath = path.join(taskFolderPath(rootDir, context, 'doing'), basename);
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
 *
 * Vestigial post-ghcaj (agentic-workflow-ghcaj): the FILE_LIST -> moved-task-
 * file detection above never fires in the ordinary path, since a worker's
 * FILE_LIST is source and tests only and no task file moves inside a
 * worktree. Retained for a resumed/interrupted session.
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

// ---------------------------------------------------------------------------
// log / index-add — the two OPTS-ONLY mechanics verbs (agentic-workflow-pt0gy).
// Both mechanics, not domain intents (like `checkpoint`, no Key-event
// counterpart), both git-free, both lock-held (ADR-0038 Ruling B applies
// unchanged: judgment stays with the caller — every word of `log`'s
// title/body is judgment; only the timestamp is mechanics, per ADR-0038
// Ruling B).
//
// A handful of small private helpers below (`readNormalizedFile`/
// `writeNormalizedFile`/`readProtocolOrDefault`/`formatProtocolTimestamp`)
// are DUPLICATED from `lib/task-lifecycle.mjs` rather than imported, mirroring
// `lib/task-lifecycle-capture-dismiss.mjs`'s own documented rationale: they
// are not exported there, and exporting them would mean editing that shared
// module's existing lines for a sibling task's sake. The already-exported
// pure edit primitives (`insertIndexLineAtTop`, `prependProtocolEntry`,
// `normalizeText`/`denormalizeText`) are reused directly.
// ---------------------------------------------------------------------------

const DEFAULT_PROTOCOL_HEADER =
  '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n';

function readNormalizedFile(filePath) {
  return normalizeText(readFileSync(filePath, 'utf8'));
}

function writeNormalizedFile(filePath, content, meta) {
  writeFileSync(filePath, denormalizeText({ content, eol: meta.eol, bom: meta.bom }));
}

function readProtocolOrDefault(protocolPath) {
  try {
    return readNormalizedFile(protocolPath);
  } catch {
    return { content: DEFAULT_PROTOCOL_HEADER, eol: '\n', bom: false };
  }
}

/** `YYYY-MM-DD HH:MM` in local time, matching `lib/task-lifecycle.mjs`'s protocol.md entry convention. */
function formatProtocolTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * `log` — prepend one protocol.md entry. Opts-only, no positional id (there
 * is exactly one `protocol.md`). Locked (agentic-workflow-pt0gy): the entire
 * body below runs while `logEntry` holds the one project-wide lifecycle lock.
 *
 * @param {string} rootDir
 * @param {object} opts
 * @param {string} opts.title    Single line; no newline, must not start with `#`.
 * @param {string} opts.body     May be multi-line prose; must not contain a
 *   `## ` heading line or a bare `---` line (either would fabricate or split
 *   a second protocol entry).
 * @param {string} [opts.message]  Echoed VERBATIM in the manifest, or `null`
 *   when omitted — never synthesized. A mechanics verb never constitutes its
 *   own commit; the caller folds `changed` into a commit whose message it
 *   already owns.
 * @param {Date} [opts.now]  Clock override for the protocol timestamp (tests).
 * @returns {{ok:true, changed:string[], message:string|null, verb:'log', timestamp:string}
 *          |{ok:false, code:string, reason:string}}
 */
function logEntry(rootDir, opts = {}) {
  return withLifecycleLock(rootDir, () => logEntryLocked(rootDir, opts), opts.lock);
}

function logEntryLocked(rootDir, opts) {
  const now = opts.now ?? new Date();
  const { title, body } = opts;
  const hasTitle = typeof title === 'string' && title.length > 0;
  const hasBody = typeof body === 'string' && body.length > 0;

  if (!hasTitle && !hasBody) {
    return { ok: false, code: 'missing-opts', reason: 'log requires opts.title and opts.body.' };
  }
  if (!hasTitle) {
    return { ok: false, code: 'missing-title', reason: 'log requires opts.title.' };
  }
  if (title.includes('\n') || title.startsWith('#')) {
    return {
      ok: false,
      code: 'invalid-title',
      reason: 'log\'s title must be a single line and must not start with "#" (the CLI renders the "## " heading itself).',
    };
  }
  if (!hasBody) {
    return { ok: false, code: 'missing-body', reason: 'log requires opts.body.' };
  }
  const bodyLines = body.split('\n');
  if (bodyLines.some((line) => line.startsWith('## '))) {
    return {
      ok: false,
      code: 'heading-in-body',
      reason: 'log\'s body must not contain a "## " heading line -- that would fabricate a second protocol entry.',
    };
  }
  if (bodyLines.some((line) => line.trim() === '---')) {
    return {
      ok: false,
      code: 'separator-in-body',
      reason: 'log\'s body must not contain a bare "---" line -- that would split the entry stream.',
    };
  }

  const protocolPath = resolveProtocolPath(rootDir);
  let protocolFile, newProtocolContent;
  try {
    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    const entryBody = `## ${formatProtocolTimestamp(now)} -- ${title}\n\n${body}`;
    newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
  } catch (err) {
    return { ok: false, code: 'bookkeeping-marker-mismatch', reason: err.message };
  }

  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);
  return {
    ok: true,
    changed: [protocolPath],
    message: opts.message ?? null,
    verb: 'log',
    timestamp: formatProtocolTimestamp(now),
  };
}

/**
 * `index-add`'s five forbidden marker sections (agentic-workflow-pt0gy) — a
 * nameable task-status block whose membership AND coupled count can only ever
 * change together, through a lifecycle-move verb (promote/claim/complete/
 * capture/dismiss). `task-counts` is included deliberately: a bullet inserted
 * above `**Backlog:** N` is invisible to `adjustIndexCount`'s label regex and
 * silently corrupts the invariant this task protects. Exported so a live-tree
 * test can assert this set covers every marker in
 * `references/index-template.md`'s task-status region.
 */
export const FORBIDDEN_INDEX_ADD_SECTIONS = new Set([
  'backlog-list',
  'todo-list',
  'doing-list',
  'done-list',
  'task-counts',
]);

/** Escape a string for literal use inside a `RegExp`. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word/hyphen-boundary match for `id` inside `text` (ADR-0012 anchoring precedent: `agentic-workflow-001` must never false-positive inside `agentic-workflow-0010`). */
function idAtBoundary(id, text) {
  return new RegExp(`(?:^|[^A-Za-z0-9_-])${escapeRegExp(id)}(?:$|[^A-Za-z0-9_-])`).test(text);
}

/** Extract a `<!-- <section>:start -->...<!-- <section>:end -->` block's inner content, or `null` if the markers are absent. */
function extractSectionBlockInner(content, section) {
  const re = new RegExp(`<!-- ${section}:start -->\\n([\\s\\S]*?)<!-- ${section}:end -->`);
  const m = content.match(re);
  return m ? m[1] : null;
}

/** The first existing line inside `inner` whose text matches `id` at a word/hyphen boundary, or `null`. */
function findExistingLineForId(inner, id) {
  for (const line of inner.split('\n')) {
    if (idAtBoundary(id, line)) return line;
  }
  return null;
}

/**
 * `index-add` — insert one line at the top of a named marker block. Opts-only,
 * no positional id (there may be several BC `INDEX.md` files). Locked
 * (agentic-workflow-pt0gy): the entire body below runs while `indexAdd` holds
 * the one project-wide lifecycle lock.
 *
 * @param {string} rootDir
 * @param {object} opts
 * @param {string|null} opts.bc  MUST be present even when `null` (`null` =
 *   the top-level `knowledge/index.md`; an omitted key is ambiguous between
 *   "top-level" and "forgot").
 * @param {string} opts.section  One of the six legal (non-forbidden) sections.
 * @param {string} opts.id       The task/ADR/research/BC id this line names;
 *   checked to actually occur in `opts.line` (`id-not-in-line`) so the
 *   dedupe key can never be vacuous.
 * @param {string} opts.line     The literal line text to insert.
 * @param {string} [opts.message]  Echoed VERBATIM in the manifest, or `null`
 *   when omitted — never synthesized.
 * @returns {{ok:true, changed:string[], skipped:boolean, verb:'index-add', id:string, message:string|null}
 *          |{ok:false, code:string, reason:string}}
 */
function indexAdd(rootDir, opts = {}) {
  return withLifecycleLock(rootDir, () => indexAddLocked(rootDir, opts), opts.lock);
}

function indexAddLocked(rootDir, opts) {
  if (!Object.prototype.hasOwnProperty.call(opts, 'bc')) {
    return {
      ok: false,
      code: 'missing-bc',
      reason: 'index-add requires opts.bc to be present (a BC name, or null for the top-level knowledge/index.md) -- an omitted key is ambiguous between "top-level" and "forgot".',
    };
  }
  const { bc, section, id, line } = opts;
  if (!section) {
    return { ok: false, code: 'missing-section', reason: 'index-add requires opts.section.' };
  }
  if (!id) {
    return { ok: false, code: 'missing-id', reason: 'index-add requires opts.id.' };
  }
  if (!line) {
    return { ok: false, code: 'missing-line', reason: 'index-add requires opts.line.' };
  }
  if (FORBIDDEN_INDEX_ADD_SECTIONS.has(section)) {
    return {
      ok: false,
      code: 'task-list-section-forbidden',
      reason: `index-add refuses the task-status section "${section}" -- task-list membership and its coupled count can only change together, through a lifecycle-move verb (promote/claim/complete/capture/dismiss), never a bare line insert.`,
    };
  }
  if (!idAtBoundary(id, line)) {
    return {
      ok: false,
      code: 'id-not-in-line',
      reason: `index-add requires "line" to actually contain "id" (${id}) at a word/hyphen boundary -- the dedupe key can never be vacuous.`,
    };
  }

  const indexPath = bc === null ? resolveTopIndexPath(rootDir) : resolveKnowledgeIndexPath(rootDir, bc);
  if (!existsSync(indexPath)) {
    return {
      ok: false,
      code: 'index-missing',
      reason: `${indexPath} does not exist -- index-add never backfills a fresh template over what may be a live index; build it from references/index-template.md first.`,
    };
  }

  let indexFile, newContent;
  let skipped = false;
  try {
    indexFile = readNormalizedFile(indexPath);
    const inner = extractSectionBlockInner(indexFile.content, section);
    if (inner === null) {
      throw new Error(`${indexPath} is missing the ${section} markers.`);
    }
    const existingLine = findExistingLineForId(inner, id);
    if (existingLine !== null) {
      if (existingLine === line) {
        skipped = true;
      } else {
        return {
          ok: false,
          code: 'duplicate-id-conflict',
          reason: `"${id}" already has a different line in the "${section}" block of ${indexPath}.`,
        };
      }
    } else {
      newContent = insertIndexLineAtTop(indexFile.content, section, line);
    }
  } catch (err) {
    return { ok: false, code: 'bookkeeping-marker-mismatch', reason: err.message };
  }

  if (skipped) {
    return { ok: true, changed: [], skipped: true, verb: 'index-add', id, message: opts.message ?? null };
  }

  writeNormalizedFile(indexPath, newContent, indexFile);
  return { ok: true, changed: [indexPath], skipped: false, verb: 'index-add', id, message: opts.message ?? null };
}

/** verb -> (rootDir, idOrIds, opts) => result, one handler per mechanized lifecycle verb whose argv carries an id. */
const HANDLERS = {
  promote: (rootDir, id, opts) => promoteTask(rootDir, id, opts),
  claim: (rootDir, ids, opts) => claimBatch(rootDir, ids.split(',').filter(Boolean), opts),
  complete: (rootDir, id, opts) => completeTask(rootDir, id, opts),
  checkpoint: (rootDir, id, opts) => checkpointFiles(rootDir, id, opts),
  // capture/dismiss (agentic-workflow-e4bjh, ADR-0038/ADR-0022-amended): both
  // live in the separate lib/task-lifecycle-capture-dismiss.mjs module (see
  // its header for why), wired here the same way complete's richer opts blob
  // already is — a JSON third positional argv.
  capture: (rootDir, id, opts) => captureTask(rootDir, id, opts),
  dismiss: (rootDir, id, opts) => dismissTask(rootDir, id, opts),
  // bounce/reroute (agentic-workflow-qd24q, ADR-0077): bounce lives in
  // lib/task-lifecycle.mjs alongside promote/claim/complete (it mirrors
  // promoteTask's exact shape); reroute lives in
  // lib/task-lifecycle-capture-dismiss.mjs, reusing that module's INDEX-
  // backfill and cross-project backlink-traversal helpers.
  bounce: (rootDir, id, opts) => bounceTask(rootDir, id, opts),
  reroute: (rootDir, id, opts) => rerouteTask(rootDir, id, opts),
};

/** verb -> (rootDir, opts) => result, one handler per OPTS-ONLY mechanics verb (no positional id — agentic-workflow-pt0gy). */
const OPTS_HANDLERS = {
  log: (rootDir, opts) => logEntry(rootDir, opts),
  'index-add': (rootDir, opts) => indexAdd(rootDir, opts),
  // migrate (agentic-workflow-e896r, ADR-0078 §4): moves a legacy .agentheim/
  // tree into the two-root layout. Opts-only (no positional id -- there is
  // exactly one .agentheim/ per project), git-free, lock-held for its legacy
  // write phase only (a 'board'-layout noop and a 'mixed' refusal are both
  // read-only and take no lock).
  migrate: (rootDir, opts) => migrateLayout(rootDir, opts),
};

/**
 * Per-verb argv arity: `'id'` verbs take `<verb> <id-or-ids> [json-opts]`;
 * `'opts'` verbs take `<verb> [json-opts]` — no positional id at all. The six
 * pre-existing verbs' argv shapes are unchanged; `log`/`index-add` are the
 * first two `'opts'`-arity verbs (agentic-workflow-pt0gy).
 */
const ARITY = {
  promote: 'id',
  claim: 'id',
  complete: 'id',
  checkpoint: 'id',
  capture: 'id',
  dismiss: 'id',
  bounce: 'id',
  reroute: 'id',
  log: 'opts',
  'index-add': 'opts',
  migrate: 'opts',
};

function parseOptsJson(rawOptsJson, thirdArgLabel) {
  if (rawOptsJson === undefined) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(rawOptsJson) };
  } catch (err) {
    return {
      ok: false,
      rejection: {
        ok: false,
        code: 'invalid-opts-json',
        reason: `${thirdArgLabel} must be JSON: ${err.message}`,
      },
    };
  }
}

/**
 * Run the CLI against an explicit argv (excluding `node` and the script path)
 * and an optional injectable cwd/discoverRoot/taskOpts — exported so tests (and
 * the `node -e` bootstrap) can drive it without spawning a child process.
 * @param {string[]} argv  `[verb, idOrIds, jsonOptsString?]` for an `'id'`-arity
 *   verb, or `[verb, jsonOptsString?]` for an `'opts'`-arity verb (`log`,
 *   `index-add`).
 * @param {object} [opts]
 * @param {string} [opts.cwd]            defaults to `process.cwd()`
 * @param {Function} [opts.discoverRoot] override for tests; defaults to the real `discoverRoot`
 * @param {object} [opts.taskOpts]       forwarded to the verb handler (e.g. `now` for tests);
 *   takes precedence over any JSON opts argv on a key-by-key basis.
 * @returns {{exitCode:number, output:object}}
 */
export function runCli(argv, opts = {}) {
  const [verb] = argv;
  const cwd = opts.cwd ?? process.cwd();

  if (!verb || !ARITY[verb]) {
    const known = Object.keys(ARITY).join(', ');
    return {
      exitCode: 1,
      output: {
        ok: false,
        code: 'unknown-verb',
        reason: `Unknown or missing verb "${verb ?? ''}". Known verbs: ${known}.`,
      },
    };
  }

  if (ARITY[verb] === 'opts') {
    const [, rawOptsJson] = argv;
    const parsed = parseOptsJson(rawOptsJson, 'The second argument');
    if (!parsed.ok) return { exitCode: 1, output: parsed.rejection };

    let rootDir;
    try {
      rootDir = (opts.discoverRoot ?? discoverRoot)(cwd);
    } catch (err) {
      return { exitCode: 1, output: { ok: false, code: 'no-project-root', reason: err.message } };
    }

    const taskOpts = { ...parsed.value, ...(opts.taskOpts ?? {}) };
    const result = OPTS_HANDLERS[verb](rootDir, taskOpts);
    return { exitCode: result.ok ? 0 : 1, output: result };
  }

  const [, id, rawOptsJson] = argv;
  if (!id) {
    return {
      exitCode: 1,
      output: { ok: false, code: 'missing-id', reason: 'A task id is required: <verb> <task-id>.' },
    };
  }

  const parsed = parseOptsJson(rawOptsJson, 'Third argument');
  if (!parsed.ok) return { exitCode: 1, output: parsed.rejection };

  let rootDir;
  try {
    rootDir = (opts.discoverRoot ?? discoverRoot)(cwd);
  } catch (err) {
    return { exitCode: 1, output: { ok: false, code: 'no-project-root', reason: err.message } };
  }

  const taskOpts = { ...parsed.value, ...(opts.taskOpts ?? {}) };
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
