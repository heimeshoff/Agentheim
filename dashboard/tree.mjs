// Read projection of the project's `.agentheim/` tree (agentic-workflow-005,
// ADR-0002). Walks the discovered root and projects, for the dashboard's read
// views (board aw-006, slide-over aw-007, navigation aw-008, SSE consumer aw-009):
//   - every BC, its four lifecycle folders, and each task's frontmatter
//     (id, title, status, type, context, path, mtimeMs, dependsOn, blocks) —
//     POINTERS + METADATA only,
//   - the LOCATIONS of vision / context-map / BC READMEs+INDEXes+concepts /
//     research reports / ADRs.
// No document bodies cross this boundary — /api/doc carries those. "Disk is the
// source of truth; the tree is a projection" — this module never writes and never
// interprets a lifecycle move (aw-009 owns interpretation).
//
// TWO-ROOT LAYOUT (ADR-0078, agentic-workflow-hxq1g): every `.agentheim/` path
// this module resolves goes through `lib/task-system-paths.mjs` — the FIRST
// `dashboard -> lib` import (previously the only cross-import ran `lib ->
// dashboard`, for `discoverRoot`). BC enumeration is authoritative from
// `knowledge/contexts/` (`listKnowledgeContexts`, ADR-0078 §6) — a `board/<bc>/`
// folder with no matching README is not a BC, it is an `orphan-task-folder`
// warning on the payload. `buildTree` calls `detectLayout` ONCE and threads the
// resolved `{layout}` opt into every getter, because each getter THROWS on a
// 'mixed' detect; a 'mixed' tree short-circuits into a `migrationPending`
// payload before any getter is touched. The dashboard NEVER migrates (ADR-0017)
// and NEVER calls the `migrate` verb — on `'legacy'` or `'mixed'` it renders a
// "layout migration pending" notice instead of an empty or half-shaped board.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  detectLayout,
  taskFolderPath,
  bcReadmePath,
  taskIndexPath,
  knowledgeIndexPath,
  bcConceptsDir,
  visionPath as resolveVisionPath,
  contextMapPath as resolveContextMapPath,
  decisionsDir,
  researchDir,
  listBoardContexts,
  listKnowledgeContexts,
} from '../lib/task-system-paths.mjs';

const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

// Frontmatter keys the projection surfaces. Everything else in the frontmatter is
// deliberately dropped — the board only needs to label and sort cards.
const TASK_FIELDS = ['id', 'title', 'status', 'type', 'context'];

/** Project-root-relative, forward-slashed path for a file inside the project. */
function relPointer(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/');
}

/**
 * File modification time in epoch ms, or null if the file cannot be stat'd. This
 * is the same loss-tolerant `statSync(abs).mtimeMs` mechanism the per-task
 * projection uses (aw-013): mtime is METADATA within ADR-0002's pointers+metadata
 * contract (never a document body), and a stat failure degrades to null rather
 * than aborting the walk.
 */
function mtimeOf(abs) {
  try {
    return statSync(abs).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Build a parallel metadata map for a list of absolute file paths, keyed by the
 * SAME in-root path string the flat `locations.adrs` / `locations.research`
 * arrays use, each value carrying that file's `mtimeMs` (aw-t3b9k). Additive: the
 * flat string arrays stay byte-compatible for `treeToLibrary` / `library-data`
 * and the search corpus, while the read-only dashboard (ADR-0017) gains the
 * modification time it cannot stat itself — feeding aw-n4h7q's "modified blinks".
 */
export function metaMap(root, absFiles) {
  const meta = {};
  for (const abs of absFiles) {
    meta[relPointer(root, abs)] = { mtimeMs: mtimeOf(abs) };
  }
  return meta;
}

// Frontmatter list fields (depends_on / blocks) round-trip as raw, unresolved
// id-string arrays — pointers+metadata only (ADR-0002); the board resolves them
// against the live tree, loss-tolerantly. Absent/scalar/malformed → [].
function idList(v) {
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s) : [];
}

/** List `.md` files directly in `dir` (non-recursive), sorted, abs paths. */
function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

/**
 * Parse the leading `---`-fenced YAML-ish frontmatter of a markdown file into a
 * flat string map. Intentionally tiny (no YAML dep, stdlib-only per ADR-0002):
 * handles `key: value` and simple `[a, b]` lists, which is all task frontmatter
 * uses. Malformed or missing frontmatter yields `{}` — the caller degrades
 * gracefully rather than aborting the walk.
 */
export function parseFrontmatter(text) {
  const src = String(text ?? '');
  if (!src.startsWith('---')) return {};
  // Find the closing fence on its own line.
  const lines = src.split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return {}; // unterminated fence → no frontmatter
  const fm = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    fm[key] = value;
  }
  return fm;
}

/**
 * Extract the project name from the body of `vision.md`: the trimmed text that
 * follows the `# Vision:` heading (aw-015). This is the FIRST projection value
 * drawn from a markdown BODY rather than frontmatter — it stays EXACTLY ONE
 * trimmed string (a derived metadata field, not a document body), so ADR-0002's
 * "pointers + metadata only, never document bodies" contract still holds, the
 * same way aw-013's `mtimeMs` does. Missing/headingless/empty → null (loss
 * tolerant, mirroring the malformed-frontmatter posture: never abort the walk).
 */
export function parseProjectName(text) {
  const src = String(text ?? '');
  for (const raw of src.split(/\r?\n/)) {
    const m = raw.match(/^\s*#\s*Vision:\s*(.*?)\s*$/);
    if (m) {
      const name = m[1].trim();
      return name.length ? name : null;
    }
  }
  return null;
}

/**
 * Project a single task file into the tree shape. Never throws: an unreadable or
 * frontmatter-less file still produces a card with a filename-derived id so the
 * board can show it. No document body is ever included.
 */
export function projectTask(root, absFile, folder, bcName) {
  let fm = {};
  try {
    fm = parseFrontmatter(readFileSync(absFile, 'utf8'));
  } catch {
    fm = {};
  }
  const base = path.basename(absFile);
  // Filename convention is `<id>-<slug>.md`; derive a fallback id from it.
  const fallbackId = base.replace(/\.md$/i, '');
  // mtimeMs is per-task METADATA within ADR-0002's pointers+metadata contract
  // (not a document body), carried so the board can sort by modification date
  // (aw-012). A stat failure degrades to null and never aborts the walk — same
  // posture as frontmatter parsing above.
  let mtimeMs = null;
  try {
    mtimeMs = statSync(absFile).mtimeMs;
  } catch {
    mtimeMs = null;
  }
  const task = {
    id: typeof fm.id === 'string' && fm.id ? fm.id : fallbackId,
    title: typeof fm.title === 'string' ? fm.title : '',
    // status falls back to the owning folder — disk is the source of truth.
    status: typeof fm.status === 'string' && fm.status ? fm.status : folder,
    type: typeof fm.type === 'string' ? fm.type : '',
    context: typeof fm.context === 'string' && fm.context ? fm.context : bcName,
    path: relPointer(root, absFile),
    mtimeMs,
    // Raw, unresolved id-string arrays from frontmatter (aw-d8q3n) — pointers +
    // metadata only (ADR-0002). No server-side resolution or dedupe: the board
    // resolves these against the pooled cross-BC tree, once it has the full id
    // universe this single-BC walk never sees.
    dependsOn: idList(fm.depends_on),
    blocks: idList(fm.blocks),
  };
  return task;
}

/**
 * Project one bounded context. Under `'board'` a BC's surfaces are split
 * across two roots (ADR-0078 §3): the four lifecycle folders + the task-half
 * `INDEX.md` live under `board/<bc>/`, while `README.md` + the knowledge-half
 * `INDEX.md` + `concepts/` live under `knowledge/contexts/<bc>/`. Under
 * `'legacy'` every getter below resolves into the SAME shared `contexts/<bc>/`
 * directory, so `index` and `knowledgeIndex` point at the identical file —
 * every existing app-side reader of `.index` keeps working unchanged.
 */
function projectContext(root, bcName, layout) {
  const lifecycle = {};
  for (const folder of LIFECYCLE_FOLDERS) {
    const dir = taskFolderPath(root, bcName, folder, { layout });
    lifecycle[folder] = listMarkdown(dir).map((abs) =>
      projectTask(root, abs, folder, bcName)
    );
  }
  const readmePath = bcReadmePath(root, bcName, { layout });
  const indexPath = taskIndexPath(root, bcName, { layout });
  const knowledgeIndex = knowledgeIndexPath(root, bcName, { layout });
  const conceptsDir = bcConceptsDir(root, bcName, { layout });
  return {
    name: bcName,
    readme: existsSync(readmePath) ? relPointer(root, readmePath) : null,
    index: existsSync(indexPath) ? relPointer(root, indexPath) : null,
    knowledgeIndex: existsSync(knowledgeIndex) ? relPointer(root, knowledgeIndex) : null,
    concepts: listMarkdown(conceptsDir).map((abs) => relPointer(root, abs)),
    lifecycle,
  };
}

/**
 * Build the full read projection for the project rooted at `root` (the directory
 * holding `.agentheim/`). Pure read; returns a plain JSON-serializable object.
 *
 * DETECT ONCE, THEN OVERRIDE: every getter in `task-system-paths.mjs` throws a
 * `{code:'mixed-layout'}` error on a mixed detect, so a 'mixed' tree is handled
 * BEFORE any getter is called — never by catching the throw. `layout` is then
 * threaded as an explicit opt into every remaining call so the whole build
 * stays internally consistent even if the tree changes under it mid-walk.
 */
export function buildTree(root) {
  const absRoot = path.resolve(root);
  const layout = detectLayout(absRoot);

  if (layout === 'mixed') {
    // A half-migrated tree renders the "layout migration pending" notice, not
    // a 500 and not a guess at which root to trust (ADR-0078 §5).
    return {
      root: absRoot,
      layout,
      migrationPending: true,
      project: { name: null },
      locations: {},
      contexts: [],
      warnings: [],
    };
  }

  const visionFile = resolveVisionPath(absRoot, { layout });
  const contextMapFile = resolveContextMapPath(absRoot, { layout });
  const adrsDir = decisionsDir(absRoot, { layout });
  const researchDirResolved = researchDir(absRoot, { layout });

  // knowledge/contexts/ is the authoritative BC list (ADR-0078 §6) — a BC
  // exists when it has a domain description, not merely a task folder.
  const knowledgeBcNames = listKnowledgeContexts(absRoot, { layout }).slice().sort();
  const boardBcNames = listBoardContexts(absRoot, { layout });
  const warnings = boardBcNames
    .filter((name) => !knowledgeBcNames.includes(name))
    .sort()
    .map((bc) => ({ code: 'orphan-task-folder', bc }));

  const contexts = knowledgeBcNames.map((name) => projectContext(absRoot, name, layout));

  // Derived project METADATA: the project name from vision.md's `# Vision:`
  // heading (aw-015). Disambiguates WHICH project's .agentheim the dashboard
  // header is showing (Agentheim is installed across many repos). One trimmed
  // string, never the vision body — still pointers+metadata only (ADR-0002).
  let projectName = null;
  if (existsSync(visionFile)) {
    try {
      projectName = parseProjectName(readFileSync(visionFile, 'utf8'));
    } catch {
      projectName = null;
    }
  }

  // List once so the flat string arrays and the parallel meta maps share a
  // single source of truth (same files, same in-root path keys).
  const adrFiles = listMarkdown(adrsDir);
  const researchFiles = listMarkdown(researchDirResolved);

  return {
    root: absRoot,
    layout,
    // 'legacy' still needs migrating; 'board' is the target shape. 'mixed' is
    // handled above, before this point is ever reached.
    migrationPending: layout === 'legacy',
    project: { name: projectName },
    locations: {
      vision: existsSync(visionFile) ? relPointer(absRoot, visionFile) : null,
      contextMap: existsSync(contextMapFile) ? relPointer(absRoot, contextMapFile) : null,
      adrs: adrFiles.map((abs) => relPointer(absRoot, abs)),
      research: researchFiles.map((abs) => relPointer(absRoot, abs)),
      // Additive parallel metadata maps (aw-t3b9k): same path keys, each value
      // { mtimeMs } so the read-only dashboard can diff a doc's modification time
      // against its session baseline (aw-n4h7q). Never a document body (ADR-0002).
      adrsMeta: metaMap(absRoot, adrFiles),
      researchMeta: metaMap(absRoot, researchFiles),
    },
    contexts,
    warnings,
  };
}
