// Read projection of the project's `.agentheim/` tree (agentic-workflow-005,
// ADR-0002). Walks the discovered root and projects, for the dashboard's read
// views (board aw-006, slide-over aw-007, navigation aw-008, SSE consumer aw-009):
//   - every BC, its four lifecycle folders, and each task's frontmatter
//     (id, title, status, type, context, path, mtimeMs) — POINTERS + METADATA only,
//   - the LOCATIONS of vision / context-map / BC READMEs+INDEXes+concepts /
//     research reports / ADRs.
// No document bodies cross this boundary — /api/doc carries those. "Disk is the
// source of truth; the tree is a projection" — this module never writes and never
// interprets a lifecycle move (aw-009 owns interpretation).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

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
  };
  return task;
}

/** Project one bounded-context folder. */
function projectContext(root, bcDir, bcName) {
  const lifecycle = {};
  for (const folder of LIFECYCLE_FOLDERS) {
    const dir = path.join(bcDir, folder);
    lifecycle[folder] = listMarkdown(dir).map((abs) =>
      projectTask(root, abs, folder, bcName)
    );
  }
  const readmePath = path.join(bcDir, 'README.md');
  const indexPath = path.join(bcDir, 'INDEX.md');
  const conceptsDir = path.join(bcDir, 'concepts');
  return {
    name: bcName,
    readme: existsSync(readmePath) ? relPointer(root, readmePath) : null,
    index: existsSync(indexPath) ? relPointer(root, indexPath) : null,
    concepts: listMarkdown(conceptsDir).map((abs) => relPointer(root, abs)),
    lifecycle,
  };
}

/**
 * Build the full read projection for the project rooted at `root` (the directory
 * holding `.agentheim/`). Pure read; returns a plain JSON-serializable object.
 */
export function buildTree(root) {
  const absRoot = path.resolve(root);
  const ah = path.join(absRoot, '.agentheim');

  const visionPath = path.join(ah, 'vision.md');
  const contextMapPath = path.join(ah, 'context-map.md');
  const adrsDir = path.join(ah, 'knowledge', 'decisions');
  const researchDir = path.join(ah, 'knowledge', 'research');

  const contextsDir = path.join(ah, 'contexts');
  let bcNames = [];
  if (existsSync(contextsDir)) {
    try {
      bcNames = readdirSync(contextsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      bcNames = [];
    }
  }

  const contexts = bcNames.map((name) =>
    projectContext(absRoot, path.join(contextsDir, name), name)
  );

  // Derived project METADATA: the project name from vision.md's `# Vision:`
  // heading (aw-015). Disambiguates WHICH project's .agentheim the dashboard
  // header is showing (Agentheim is installed across many repos). One trimmed
  // string, never the vision body — still pointers+metadata only (ADR-0002).
  let projectName = null;
  if (existsSync(visionPath)) {
    try {
      projectName = parseProjectName(readFileSync(visionPath, 'utf8'));
    } catch {
      projectName = null;
    }
  }

  // List once so the flat string arrays and the parallel meta maps share a
  // single source of truth (same files, same in-root path keys).
  const adrFiles = listMarkdown(adrsDir);
  const researchFiles = listMarkdown(researchDir);

  return {
    root: absRoot,
    project: { name: projectName },
    locations: {
      vision: existsSync(visionPath) ? relPointer(absRoot, visionPath) : null,
      contextMap: existsSync(contextMapPath) ? relPointer(absRoot, contextMapPath) : null,
      adrs: adrFiles.map((abs) => relPointer(absRoot, abs)),
      research: researchFiles.map((abs) => relPointer(absRoot, abs)),
      // Additive parallel metadata maps (aw-t3b9k): same path keys, each value
      // { mtimeMs } so the read-only dashboard can diff a doc's modification time
      // against its session baseline (aw-n4h7q). Never a document body (ADR-0002).
      adrsMeta: metaMap(absRoot, adrFiles),
      researchMeta: metaMap(absRoot, researchFiles),
    },
    contexts,
  };
}
