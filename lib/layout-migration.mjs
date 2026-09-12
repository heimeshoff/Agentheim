// layout-migration — the `migrate` verb (ADR-0078 §4, agentic-workflow-e896r):
// moves a legacy `.agentheim/contexts/` tree into the two-root `knowledge/` +
// `board/` layout the rest of the mechanized-verb family already resolves
// through (`lib/task-system-paths.mjs`, agentic-workflow-cj54k). Git-free
// (ADR-0038 Ruling B): this module only renames/writes files; the CALLER
// `git add -- .agentheim` + commits the returned manifest.
//
// LAYOUT-OVERRIDE DISCIPLINE (non-obvious, load-bearing — see the task's own
// Notes): mid-move the tree is transiently 'mixed' (both `contexts/` and
// `board/` exist at once), and every getter on `task-system-paths.mjs`
// THROWS a structured `{code:'mixed-layout'}` error on a mixed detect. So
// this module calls `detectLayout(rootDir)` EXACTLY ONCE, up front, and
// thereafter passes an explicit `{layout:'legacy'}` (sources) or
// `{layout:'board'}` (destinations) opt to every getter it uses below. A bare
// getter call anywhere in the write phase is a bug, not a style choice.
//
// `board/` IS ALWAYS CREATED, even when zero BCs moved (a project whose
// `.agentheim/` exists but has populated neither `contexts/` nor `board/`
// yet still detects `'legacy'`) — otherwise every skill would re-run the
// migration forever, since `detectLayout` never reports `'board'` for an
// `.agentheim/` with no `board/` marker directory on disk.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { withLifecycleLock } from './lifecycle-lock.mjs';
import { writeFileAtomic } from './atomic-write.mjs';
import { normalizeText, denormalizeText } from './task-lifecycle.mjs';
import {
  detectLayout,
  taskFolderPath,
  taskIndexPath,
  doneArchiveDir,
  protocolPath,
  protocolArchiveDir,
  knowledgeIndexPath,
  bcReadmePath,
  bcConceptsDir,
  topIndexPath,
  visionPath,
  contextMapPath,
  styleguideDir,
  listKnowledgeContexts,
} from './task-system-paths.mjs';

const LEGACY = { layout: 'legacy' };
const BOARD = { layout: 'board' };

const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

// ---------------------------------------------------------------------------
// splitIndexContent — pure. Splits the LEGACY combined per-BC `INDEX.md` (the
// pre-ADR-0078 shape: one file carrying both halves) into its task half
// (`references/task-index-template.md`) and knowledge half
// (`references/knowledge-index-template.md`).
//
// Every retained line is byte-verbatim EXCEPT the relative-link depth
// rewrite (adr-local / research-local links, one level deeper once the
// knowledge half sits under `knowledge/contexts/<bc>/`) and the ONE new
// cross-half Pointers line each half gains (task half -> knowledge half,
// knowledge half -> task half) — the builder decision recorded in this
// task's Notes: a half with no route back to its sibling is a dead end.
//
// A marker block that is entirely absent from the input (legal for an empty
// BC) is simply absent from its half — never synthesized.
//
// NOTE on signature: the task's illustrative sketch shows
// `splitIndexContent(text) -> {taskHalf, knowledgeHalf}`, but the new
// cross-half Pointers lines both embed the BC's own name in a relative path
// (`../../knowledge/contexts/<bc>/INDEX.md` and
// `../../../board/<bc>/INDEX.md`) -- there is no reliable way to recover the
// machine BC slug from the file's own free-text H1 title, so `bc` is a
// required second parameter here.
// ---------------------------------------------------------------------------

const HEADING_TASKS = '## Tasks by status';
const HEADING_ADR = '## ADRs scoped to this BC';
const HEADING_RESEARCH = '## Research touching this BC';
const HEADING_CONCEPTS = '## Concepts (opt-in synthesis pages)';
const HEADING_POINTERS = '## Pointers';

const README_POINTER_PREFIX = '- BC README';
const DONE_ARCHIVE_POINTER_PREFIX = '- Done-list archive';

/** Index of `heading`'s own line start in `content`, or -1 if absent. */
function findHeadingIndex(content, heading) {
  if (content.startsWith(`${heading}\n`)) return 0;
  const idx = content.indexOf(`\n${heading}\n`);
  return idx === -1 ? -1 : idx + 1;
}

/** The adr-local / research-local relative-link depth rewrite (knowledge half sits one level deeper). */
function rewriteBcLocalLinkDepth(segment) {
  return segment
    .split('../../knowledge/decisions/').join('../../decisions/')
    .split('../../knowledge/research/').join('../../research/');
}

export function splitIndexContent(text, bc) {
  const anchors = [
    { key: 'tasks', heading: HEADING_TASKS },
    { key: 'adr', heading: HEADING_ADR },
    { key: 'research', heading: HEADING_RESEARCH },
    { key: 'concepts', heading: HEADING_CONCEPTS },
    { key: 'pointers', heading: HEADING_POINTERS },
  ]
    .map((a) => ({ ...a, index: findHeadingIndex(text, a.heading) }))
    .filter((a) => a.index !== -1)
    .sort((a, b) => a.index - b.index);

  const headerEnd = anchors.length > 0 ? anchors[0].index : text.length;
  const header = text.slice(0, headerEnd);

  const segments = {};
  anchors.forEach((a, i) => {
    const end = i + 1 < anchors.length ? anchors[i + 1].index : text.length;
    segments[a.key] = text.slice(a.index, end);
  });

  let taskHalf = header;
  if (segments.tasks) taskHalf += segments.tasks;
  if (!taskHalf.endsWith('\n')) taskHalf += '\n';

  let knowledgeHalf = '';
  if (segments.adr) knowledgeHalf += rewriteBcLocalLinkDepth(segments.adr);
  if (segments.research) knowledgeHalf += rewriteBcLocalLinkDepth(segments.research);
  if (segments.concepts) knowledgeHalf += segments.concepts;
  if (knowledgeHalf && !knowledgeHalf.endsWith('\n')) knowledgeHalf += '\n';

  // Pointers is the one section SHARED by both halves in the legacy file --
  // split its bullets by keyword rather than moving the whole block. Any
  // bullet matching neither known prefix (a real-world drift this task does
  // not need to model generically) is conservatively kept on the knowledge
  // half rather than dropped.
  let readmeLine = null;
  let doneArchiveLine = null;
  const otherLines = [];
  if (segments.pointers) {
    for (const line of segments.pointers.split('\n')) {
      if (line.startsWith(README_POINTER_PREFIX)) readmeLine = line;
      else if (line.startsWith(DONE_ARCHIVE_POINTER_PREFIX)) doneArchiveLine = line;
      else if (line.startsWith('- ')) otherLines.push(line);
    }
  }

  const newTaskPointerLine = `- Knowledge half (ADRs / research / concepts / BC README) for this BC: \`../../knowledge/contexts/${bc}/INDEX.md\``;
  const newKnowledgePointerLine = `- Task board (tasks by status) for this BC: \`../../../board/${bc}/INDEX.md\``;

  taskHalf += `\n${HEADING_POINTERS}\n\n`;
  if (doneArchiveLine) taskHalf += `${doneArchiveLine}\n`;
  taskHalf += `${newTaskPointerLine}\n`;

  knowledgeHalf += `${knowledgeHalf ? '\n' : ''}${HEADING_POINTERS}\n\n`;
  if (readmeLine) knowledgeHalf += `${readmeLine}\n`;
  for (const line of otherLines) knowledgeHalf += `${line}\n`;
  knowledgeHalf += `${newKnowledgePointerLine}\n`;

  return { taskHalf, knowledgeHalf };
}

// ---------------------------------------------------------------------------
// Pointer rewrites — pure, tested in isolation (item 3 of the task's What).
// ---------------------------------------------------------------------------

/**
 * `knowledge/index.md`'s Pointers section: `knowledge/protocol.md` (and its
 * sibling archive path `knowledge/protocol/YYYY-MM.md`) now live under
 * `board/`, one level up from `index.md`'s own directory. The `vision.md` /
 * `context-map.md` lines are left untouched -- they become correct-as-
 * written once both files sit beside `index.md`. The `bc-list` block is left
 * COMPLETELY untouched (ADR-0078 §6): its lines already end in
 * `contexts/<bc>/INDEX.md`, which resolves relative to `index.md`'s own
 * directory straight into the knowledge half -- rewriting it would break it.
 */
export function rewriteTopIndexPointers(content) {
  return content.split('knowledge/protocol').join('../board/protocol');
}

const README_LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done', 'done-archive'];

/**
 * A BC's `README.md`: literal `.agentheim/contexts/<bc>/...` mentions move to
 * `.agentheim/board/<bc>/...` (lifecycle folders) or stay in the knowledge
 * half's own directory naming; root-level `vision.md` / `context-map.md`
 * mentions gain the `knowledge/` prefix; `protocol.md` mentions move to
 * `board/`; and the same adr-local/research-local relative-link depth
 * rewrite the INDEX split applies (the README now sits at the same
 * `knowledge/contexts/<bc>/` depth as its knowledge-half INDEX).
 */
export function rewriteReadmeContent(content, bc) {
  let out = content;
  for (const folder of README_LIFECYCLE_FOLDERS) {
    out = out.split(`.agentheim/contexts/${bc}/${folder}/`).join(`.agentheim/board/${bc}/${folder}/`);
  }
  out = out.split(`.agentheim/contexts/${bc}/INDEX.md`).join(`.agentheim/board/${bc}/INDEX.md`);
  out = out.split('.agentheim/knowledge/protocol.md').join('.agentheim/board/protocol.md');
  out = out.split('.agentheim/vision.md').join('.agentheim/knowledge/vision.md');
  out = out.split('.agentheim/context-map.md').join('.agentheim/knowledge/context-map.md');
  out = rewriteBcLocalLinkDepth(out);
  return out;
}

// ---------------------------------------------------------------------------
// worktree-active guard — refuse when a live worker worktree (branch
// `aw/<task-id>`, ADR-0032) is registered: it still carries the legacy tree
// on disk, and moving `main`'s tree out from under it would strand it.
// Read-only `git worktree list --porcelain`; injectable for tests.
// ---------------------------------------------------------------------------

function listWorktreePorcelain(rootDir) {
  try {
    return execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: rootDir, encoding: 'utf8' });
  } catch {
    // Not a git repo (a bare fs fixture) or git unavailable -- nothing to refuse on.
    return '';
  }
}

function checkWorktreeActive(rootDir, opts) {
  const output = (opts.listWorktreePorcelain ?? listWorktreePorcelain)(rootDir);
  const blocks = output.split(/\n\s*\n/);
  for (const block of blocks) {
    const branchMatch = block.match(/^branch refs\/heads\/(aw\/.+)$/m);
    if (!branchMatch) continue;
    const pathMatch = block.match(/^worktree (.+)$/m);
    return { active: true, branch: branchMatch[1], path: pathMatch ? pathMatch[1] : null };
  }
  return { active: false };
}

// ---------------------------------------------------------------------------
// Residual-reference scan (agentic-workflow-vsb06) -- a read-only, post-move
// walk of the PROJECT root (not `.agentheim/`, which the verb already owns
// and rewrites) counting occurrences of the literal `.agentheim/contexts/`
// left behind in files `migrate` never touches: `CLAUDE.md`,
// `.claude/commands/*.md`, and anything else outside `.agentheim/`. Runs
// AFTER `withLifecycleLock`'s write phase releases the lock (see
// `migrateLayout` below) -- it is read-only and must never extend the lock
// hold. Loss-tolerant (an unreadable file/dir is skipped, never thrown) and
// bounded (5000 files or 2 seconds, whichever comes first) so a huge
// monorepo never makes the migrating run slow.
// ---------------------------------------------------------------------------

const LEGACY_CONTEXTS_LITERAL = '.agentheim/contexts/';
const RESIDUAL_TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.mjs', '.cjs', '.ts', '.sh', '.ps1']);
const RESIDUAL_EXCLUDE_DIR_NAMES = new Set(['.git', 'node_modules', '.worktrees']);
const RESIDUAL_MAX_FILES = 5000;
const RESIDUAL_MAX_MS = 2000;

/** First 8KiB sniff: a NUL byte anywhere in that window means "not text". */
function isLikelyUtf8Text(buf) {
  const len = Math.min(buf.length, 8192);
  for (let i = 0; i < len; i += 1) {
    if (buf[i] === 0) return false;
  }
  return true;
}

/**
 * `null` for anything not eligible (wrong extension, or an extension-less
 * file that sniffs as binary); the decoded text otherwise. Throws only on an
 * unreadable file -- callers catch that and skip it (loss-tolerant).
 */
function readResidualScanText(absFile) {
  const ext = path.extname(absFile).toLowerCase();
  const buf = readFileSync(absFile);
  if (RESIDUAL_TEXT_EXTENSIONS.has(ext)) return buf.toString('utf8');
  if (ext === '') return isLikelyUtf8Text(buf) ? buf.toString('utf8') : null;
  return null;
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) return count;
    count += 1;
    idx += needle.length;
  }
}

/**
 * The default recursive walker: every FILE under `rootDir`, skipping `.git/`,
 * `node_modules/`, `.worktrees/`, and the whole top-level `.agentheim/` tree
 * (the part `migrate` owns and rewrites; its interior history is deliberately
 * not reported here). A generator so a bounded consumer (`scanResidualReferences`)
 * can stop early without building the full file list first.
 */
function* defaultWalkProjectFiles(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (dir === rootDir && entry.name === '.agentheim') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (RESIDUAL_EXCLUDE_DIR_NAMES.has(entry.name)) continue;
        stack.push(abs);
      } else if (entry.isFile()) {
        yield abs;
      }
    }
  }
}

/**
 * Read-only, post-move scan of `rootDir` for literal `.agentheim/contexts/`
 * mentions left in project files outside `.agentheim/`. MUST be called
 * outside `withLifecycleLock` -- see `migrateLayout`.
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @param {object} [opts.residualScan] TEST-ONLY overrides (never set outside `lib/test/`).
 * @param {Function} [opts.residualScan.walkProjectFiles] TEST-ONLY override
 *   for the default walker -- an injectable/spyable seam so tests can assert
 *   the walk is (or is not) invoked, and that it only runs once the
 *   lifecycle lock is released.
 * @param {number} [opts.residualScan.maxFiles] TEST-ONLY override for the
 *   5000-file scan bound.
 * @param {number} [opts.residualScan.maxMs] TEST-ONLY override for the 2s
 *   scan bound.
 * @returns {{residualReferences: {file:string, count:number}[], residualReferencesTruncated?: true}}
 */
export function scanResidualReferences(rootDir, opts = {}) {
  const residualOpts = opts.residualScan ?? {};
  const walk = residualOpts.walkProjectFiles ?? defaultWalkProjectFiles;
  const maxFiles = residualOpts.maxFiles ?? RESIDUAL_MAX_FILES;
  const maxMs = residualOpts.maxMs ?? RESIDUAL_MAX_MS;

  const counts = new Map();
  const start = Date.now();
  let filesWalked = 0;
  let truncated = false;

  for (const absFile of walk(rootDir)) {
    filesWalked += 1;
    if (filesWalked > maxFiles || Date.now() - start > maxMs) {
      truncated = true;
      break;
    }
    let text;
    try {
      text = readResidualScanText(absFile);
    } catch {
      continue; // unreadable -- loss-tolerant
    }
    if (text == null) continue;
    const count = countOccurrences(text, LEGACY_CONTEXTS_LITERAL);
    if (count > 0) {
      const rel = path.relative(rootDir, absFile).split(path.sep).join('/');
      counts.set(rel, count);
    }
  }

  const residualReferences = [...counts.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  return truncated ? { residualReferences, residualReferencesTruncated: true } : { residualReferences };
}

// ---------------------------------------------------------------------------
// The verb itself.
// ---------------------------------------------------------------------------

function readAndSplitFile(filePath) {
  return normalizeText(readFileSync(filePath, 'utf8'));
}

/**
 * `atomicOpts` is a TEST-ONLY passthrough (never set outside `lib/test/`) to
 * `writeFileAtomic`'s own `injectFailureAfterWrite`/`renameSync` seams — lets
 * a test prove every rewritten file in this module really does go through
 * the atomic primitive (a forced failure leaves the target exactly as it
 * was, never truncated).
 */
function writeAtomicNormalized(filePath, content, meta, atomicOpts = {}) {
  writeFileAtomic(filePath, denormalizeText({ content, eol: meta.eol, bom: meta.bom }), atomicOpts);
}

function renameIfExists(from, to, moved) {
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  renameSync(from, to);
  moved.push({ from, to });
}

function migrateLegacyLocked(rootDir, opts) {
  const worktreeCheck = checkWorktreeActive(rootDir, opts);
  if (worktreeCheck.active) {
    return {
      ok: false,
      code: 'worktree-active',
      reason: `A live worker worktree on branch "${worktreeCheck.branch}" (${worktreeCheck.path ?? 'unknown path'}) still carries the legacy layout -- finish or remove it before migrating.`,
    };
  }

  const agentheimDir = path.join(rootDir, '.agentheim');
  const contextsDir = path.join(agentheimDir, 'contexts');
  const moved = [];

  // `board/` is created unconditionally -- see this module's header.
  mkdirSync(path.join(agentheimDir, 'board'), { recursive: true });
  mkdirSync(path.join(agentheimDir, 'knowledge'), { recursive: true });

  renameIfExists(visionPath(rootDir, LEGACY), visionPath(rootDir, BOARD), moved);
  renameIfExists(contextMapPath(rootDir, LEGACY), contextMapPath(rootDir, BOARD), moved);
  renameIfExists(protocolPath(rootDir, LEGACY), protocolPath(rootDir, BOARD), moved);
  renameIfExists(protocolArchiveDir(rootDir, LEGACY), protocolArchiveDir(rootDir, BOARD), moved);

  const bcs = existsSync(contextsDir) ? listKnowledgeContexts(rootDir, LEGACY) : [];
  const atomicWriteOpts = opts.atomicWriteOpts ?? {};

  for (const bc of bcs) {
    for (const folder of LIFECYCLE_FOLDERS) {
      renameIfExists(taskFolderPath(rootDir, bc, folder, LEGACY), taskFolderPath(rootDir, bc, folder, BOARD), moved);
    }
    renameIfExists(doneArchiveDir(rootDir, bc, LEGACY), doneArchiveDir(rootDir, bc, BOARD), moved);
    renameIfExists(bcReadmePath(rootDir, bc, LEGACY), bcReadmePath(rootDir, bc, BOARD), moved);
    renameIfExists(bcConceptsDir(rootDir, bc, LEGACY), bcConceptsDir(rootDir, bc, BOARD), moved);

    if (bc === 'design-system') {
      renameIfExists(styleguideDir(rootDir, LEGACY), styleguideDir(rootDir, BOARD), moved);
    }

    const legacyIndexPath = taskIndexPath(rootDir, bc, LEGACY); // legacy: task+knowledge share this one path
    if (existsSync(legacyIndexPath)) {
      const { content, eol, bom } = readAndSplitFile(legacyIndexPath);
      const { taskHalf, knowledgeHalf } = splitIndexContent(content, bc);
      const taskDest = taskIndexPath(rootDir, bc, BOARD);
      const knowledgeDest = knowledgeIndexPath(rootDir, bc, BOARD);
      mkdirSync(path.dirname(taskDest), { recursive: true });
      mkdirSync(path.dirname(knowledgeDest), { recursive: true });
      writeAtomicNormalized(taskDest, taskHalf, { eol, bom }, atomicWriteOpts);
      writeAtomicNormalized(knowledgeDest, knowledgeHalf, { eol, bom }, atomicWriteOpts);
      unlinkSync(legacyIndexPath);
      moved.push({ from: legacyIndexPath, to: [taskDest, knowledgeDest] });
    }
  }

  // Pointer rewrites (item 3).
  const topIndex = topIndexPath(rootDir, BOARD);
  if (existsSync(topIndex)) {
    const { content, eol, bom } = readAndSplitFile(topIndex);
    const rewritten = rewriteTopIndexPointers(content);
    if (rewritten !== content) writeAtomicNormalized(topIndex, rewritten, { eol, bom }, atomicWriteOpts);
  }
  for (const bc of bcs) {
    const readmeDest = bcReadmePath(rootDir, bc, BOARD);
    if (!existsSync(readmeDest)) continue;
    const { content, eol, bom } = readAndSplitFile(readmeDest);
    const rewritten = rewriteReadmeContent(content, bc);
    if (rewritten !== content) writeAtomicNormalized(readmeDest, rewritten, { eol, bom }, atomicWriteOpts);
  }

  // The emptied legacy `contexts/` tree is removed once every file under it
  // has been moved or split out.
  if (existsSync(contextsDir)) {
    rmSync(contextsDir, { recursive: true, force: true });
  }

  return {
    ok: true,
    verb: 'migrate',
    changed: ['.agentheim'],
    moved,
    message: 'chore(agentheim): migrate .agentheim/ to the two-root layout (ADR-0078)',
  };
}

/**
 * `migrateLayout(rootDir, opts) -> manifest` — the `migrate` verb
 * (`lib/task-lifecycle-cli.mjs`'s `migrate`).
 *
 * - `'board'` -> `{ok:true, verb:'migrate', noop:true, changed:[]}`, zero writes
 *   (no lock acquired -- a noop is read-only, per the same convention
 *   `dismissTask`'s zero-write plan phase already establishes).
 * - `'mixed'` -> `{ok:false, code:'mixed-layout', reason}`, zero writes.
 * - `'legacy'` -> locked (`withLifecycleLock`, ADR-0075) move + split +
 *   pointer rewrite; see `migrateLegacyLocked` above.
 *
 * `migrate`'s legacy-reading path is PERMANENT (ADR-0078 §5) -- it is never
 * gated behind any later "refuse legacy" hardening applied to every other
 * consumer.
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @param {object} [opts.lock] forwarded to `withLifecycleLock`/`acquireLifecycleLock`.
 * @param {Function} [opts.listWorktreePorcelain] TEST-ONLY override for the
 *   `git worktree list --porcelain` read.
 * @param {object} [opts.atomicWriteOpts] TEST-ONLY passthrough to every
 *   `writeFileAtomic` call in the write phase (e.g. `injectFailureAfterWrite`).
 * @param {boolean} [opts.scanResiduals] On an already-`board` tree, run the
 *   same residual-reference scan the moved path always runs, and return it
 *   on the noop manifest too (an on-demand re-check). Ignored on the moved
 *   path (which always scans) and on refusals (`mixed-layout` etc, which
 *   return unchanged).
 * @param {object} [opts.residualScan] TEST-ONLY overrides forwarded to
 *   `scanResidualReferences` (see its own doc comment).
 */
export function migrateLayout(rootDir, opts = {}) {
  const layout = detectLayout(rootDir);

  if (layout === 'board') {
    if (!opts.scanResiduals) {
      return { ok: true, verb: 'migrate', noop: true, changed: [] };
    }
    return { ok: true, verb: 'migrate', noop: true, changed: [], ...scanResidualReferences(rootDir, opts) };
  }
  if (layout === 'mixed') {
    return {
      ok: false,
      code: 'mixed-layout',
      reason: `migrate refuses a 'mixed' .agentheim/ layout under ${rootDir} -- both 'contexts/' and 'board/' (or a split vision.md) are present; resolve the ambiguity by hand first.`,
    };
  }

  const result = withLifecycleLock(rootDir, () => migrateLegacyLocked(rootDir, opts), opts.lock);
  if (!result.ok) return result;
  // Outside the lock (already released by withLifecycleLock's `finally`) --
  // the moved path always scans, unconditionally of `opts.scanResiduals`.
  return { ...result, ...scanResidualReferences(rootDir, opts) };
}
