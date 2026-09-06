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
// shape kept in `references/index-template.md`'s "Per-BC (LEGACY combined
// shape)" section) into its task half (`references/task-index-template.md`)
// and knowledge half (`references/knowledge-index-template.md`).
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
 */
export function migrateLayout(rootDir, opts = {}) {
  const layout = detectLayout(rootDir);

  if (layout === 'board') {
    return { ok: true, verb: 'migrate', noop: true, changed: [] };
  }
  if (layout === 'mixed') {
    return {
      ok: false,
      code: 'mixed-layout',
      reason: `migrate refuses a 'mixed' .agentheim/ layout under ${rootDir} -- both 'contexts/' and 'board/' (or a split vision.md) are present; resolve the ambiguity by hand first.`,
    };
  }

  return withLifecycleLock(rootDir, () => migrateLegacyLocked(rootDir, opts), opts.lock);
}
