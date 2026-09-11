// legacy-path-literal-lint — the ADR-0078 sweep's permanent live-tree lint
// (agentic-workflow-zgav8), mirroring `lib/doctrine-line-pointer.mjs`'s shape
// (ADR-0069): stdlib-only, side-effect-free, loss-tolerant, an enumerated
// `{file, match, rationale}` ALLOWLIST, and a test walking the real repo
// root.
//
// Purpose: keep the two-root layout's `board/` / `knowledge/contexts/`
// rewrite (ADR-0078) from silently regressing back to the pre-migration
// `.agentheim/contexts/` shape as doctrine prose and `lib/`/`dashboard/`
// source get edited over time — cj54k's temporary per-file lint
// (`lib/test/task-system-paths-literal-lint.test.mjs`, now deleted) only
// ever covered nine enumerated `lib/` files; this widens the same two
// `path.join`-segment shapes (g) to a permanent, tree-wide scan and adds six
// more forbidden shapes covering doctrine prose.
//
// Shape doctrine (mirrors lib/doctrine-line-pointer.mjs / lib/index-entry-length.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies (plus the sibling
//     `lib/task-system-paths.mjs`, itself stdlib-only, for BC-README
//     enumeration);
//   - side-effect-free — a root path in, plain violation data out; never
//     writes;
//   - loss-tolerant — an unreadable file or directory is skipped, never
//     thrown; a 'mixed'-layout repo root simply skips BC-README enumeration
//     rather than throwing.
//
// Forbidden shapes (task agentic-workflow-zgav8 §3), each a named regex,
// first match wins per line (mirrors doctrine-line-pointer.mjs's `break`):
//   (a) `.agentheim/contexts/`                       — the legacy root itself
//   (b) `contexts/<segment>/(backlog|todo|doing|done|done-archive)/` — a
//       lifecycle folder under `contexts/` — UNCONDITIONAL, with or without
//       the `.agentheim/` prefix, since a lifecycle folder never lives under
//       `knowledge/` regardless of how the path is anchored
//   (c) `contexts/*/`                                 — the bare wildcard-BC form
//   (d) `.agentheim/vision.md`
//   (e) `.agentheim/context-map.md`
//   (f) `knowledge/protocol`                          — catches both
//       `.agentheim/knowledge/protocol.md` and `knowledge/protocol/YYYY-MM.md`
//   (g) the two `path.join`-segment shapes ported verbatim from cj54k's
//       temporary lint (quoted `'contexts'`/`"contexts"`, and the adjacent
//       pair `'knowledge', 'protocol`) — applied to `lib/` and `dashboard/`
//       files only (`.mjs`/`.js`), since these are code-literal shapes, not
//       doctrine prose.
//
// Bare `contexts/<bc>/INDEX.md` / `contexts/<bc>/README.md` (no `.agentheim/`
// prefix, a concrete BC name, not a lifecycle folder) are explicitly ALLOWED
// — see the task's ground-truth item 0: `knowledge/index.md`'s bc-list lines
// already spell exactly this, and it resolves correctly under the `board/`
// layout (relative to `knowledge/index.md`'s own directory, straight into
// `knowledge/contexts/`).
//
// Two escape hatches, exactly like doctrine-line-pointer.mjs:
//   - an enumerated ALLOWLIST of `{file, match, rationale}` entries, for
//     every authoring-time-known occurrence (the layout module's own legacy
//     branches, the legacy INDEX template kept byte-verbatim, etc);
//   - a per-line `<!-- legacy-path-ok -->` HTML-comment marker, recognized
//     ONLY inside a BC README (the one dynamically-discovered surface this
//     lint cannot enumerate ahead of time) — anywhere else the marker text is
//     inert and the line is still a violation.
//
// A third, layout-gated tolerance (not a permanent exemption) covers the 20
// literal `dashboard/app/*.js` styleguide ESM import specifiers hxq1g left
// unchanged on purpose (jsdom must resolve the on-disk path): tolerated only
// while `detectLayout(repoRoot) === 'legacy'`, flagged once it is `'board'`
// — so tgr31's own dashboard-suite-green criterion forces the re-point.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { detectLayout, listKnowledgeContexts, bcReadmePath } from './task-system-paths.mjs';

/** Top-level directories (relative to repo root) this lint walks, recursively. */
const WALK_DIRS = ['skills', 'agents', 'references', 'commands', 'lib', 'dashboard'];

/** Extensions this lint reads. */
const WALK_EXTENSIONS = new Set(['.md', '.mjs', '.js']);

/** Directory names never descended into, anywhere under a walk root. */
const EXCLUDE_DIR_NAMES = new Set(['test', 'node_modules', 'dist', '.worktrees', 'evals']);

/**
 * Explicit, enumerated allowlist. Each entry suppresses only the exact
 * `file` (repo-root-relative, forward-slash) + a line containing `match` (a
 * literal substring) — never a whole file or a whole pattern class. Add an
 * entry here only with an inline `rationale`.
 * @type {{file: string, match: string, rationale: string}[]}
 */
export const ALLOWLIST = [
  {
    file: 'lib/task-system-paths.mjs',
    match: "'contexts'",
    rationale:
      "the canonical layout module (ADR-0078) — its 'legacy' branches ARE the legacy-tree resolution logic, not doctrine drift.",
  },
  {
    file: 'lib/task-system-paths.mjs',
    match: '.agentheim/contexts/',
    rationale: "the same module's header comment and doc comments describe the legacy shape it resolves against.",
  },
  {
    file: 'lib/task-system-paths.mjs',
    match: "'knowledge', 'protocol",
    rationale: "the module's own 'legacy' branch for protocolPath/protocolArchiveDir.",
  },
  {
    file: 'lib/task-system-paths.mjs',
    match: '.agentheim/vision.md',
    rationale: "the module's own doc comment defining the 'mixed'-layout detection rule (a root vision.md coexisting with the knowledge one).",
  },
  {
    file: 'lib/layout-migration.mjs',
    match: 'contexts',
    rationale:
      'the `migrate` verb (ADR-0078 §4) — every legacy-side path in this module is the SOURCE side of the move; it must literally read the legacy tree to move it.',
  },
  {
    file: 'lib/layout-migration.mjs',
    match: 'knowledge/protocol',
    rationale: 'the same module — the doc comment and `rewriteTopIndexPointers`/`rewriteReadmeContent` source-side literals for the pointer-rewrite it performs.',
  },
  {
    file: 'lib/layout-migration.mjs',
    match: '.agentheim/vision.md',
    rationale: 'the same module — `rewriteReadmeContent`\'s source-side literal for the legacy `vision.md` mention it rewrites.',
  },
  {
    file: 'lib/layout-migration.mjs',
    match: '.agentheim/context-map.md',
    rationale: 'the same module — `rewriteReadmeContent`\'s source-side literal for the legacy `context-map.md` mention it rewrites.',
  },
  {
    file: 'references/index-template.md',
    match: '.agentheim/contexts/',
    rationale:
      'the "Per-BC (LEGACY combined shape)" heading names the legacy combined INDEX path deliberately (task §2) — the section it titles documents the transitional shape on purpose.',
  },
  {
    file: 'references/index-template.md',
    match: 'contexts/<bc>/done-archive/',
    rationale:
      "the fenced LEGACY-combined-shape template block is kept byte-verbatim — `captureTask`'s empty-BC backfill renders it at runtime for a `'legacy'`-layout tree (task §0) — until the dogfood migration retires legacy support.",
  },
  {
    file: 'references/knowledge-index-template.md',
    match: '.agentheim/contexts/',
    rationale: "the transitional-shape paragraph names the legacy combined INDEX path for context (ADR-0068: pointer, not restatement).",
  },
  {
    file: 'references/task-index-template.md',
    match: '.agentheim/contexts/',
    rationale: "the transitional-shape paragraph names the legacy combined INDEX path for context (ADR-0068: pointer, not restatement).",
  },
  {
    file: 'dashboard/build.mjs',
    match: 'contexts',
    rationale: "legacy-layout comments describing the pre-ADR-0078 styleguide/dashboard path shape for historical context.",
  },
  {
    file: 'skills/whats-next/SKILL.md',
    match: '.agentheim/contexts/',
    rationale:
      "the task-mandated legacy-tree detection notice (ADR-0078 §4/§5) — a read-only skill telling the builder to run a writing skill first; quoting the literal legacy path IS the point of this line.",
  },
  {
    file: 'skills/inquire/SKILL.md',
    match: '.agentheim/contexts/',
    rationale:
      "the same legacy-tree detection notice as `whats-next/SKILL.md`, for the other read-only skill.",
  },
  {
    file: 'dashboard/project-name.mjs',
    match: '.agentheim/vision.md',
    rationale:
      "explicitly contrasts the legacy vs `board` vision.md path as documentation for why the resolution goes through `visionPath` (agentic-workflow-hxq1g) — a definition of the legacy shape, not a literal path join.",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: '.agentheim/contexts/',
    rationale: "this module's own header comment and shape (a)/allowlist-example prose quote the literal forbidden shapes it recognizes — quoting the shape IS the point.",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: 'contexts/*/',
    rationale: "this module's own header comment quoting shape (c).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: '.agentheim/vision.md',
    rationale: "this module's own header comment quoting shape (d).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: '.agentheim/context-map.md',
    rationale: "this module's own header comment quoting shape (e).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: 'knowledge/protocol',
    rationale: "this module's own header comment quoting shape (f).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: "'contexts'",
    rationale: "this module's own header comment and allowlist-example prose quoting shape (g1).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: "'knowledge', 'protocol",
    rationale: "this module's own header comment quoting shape (g2).",
  },
  {
    file: 'lib/legacy-path-literal-lint.mjs',
    match: 'contexts/<bc>/done-archive/',
    rationale: "this module's own allowlist-example prose quoting the `references/index-template.md` entry above, verbatim.",
  },
];

function isAllowlisted(relFile, lineText) {
  return ALLOWLIST.some((e) => e.file === relFile && (e.match === '' || lineText.includes(e.match)));
}

const LEGACY_PATH_OK_RE = /<!--\s*legacy-path-ok\s*-->/;

const STYLEGUIDE_IMPORT_RE = /^import .* from "\.\.\/\.\.\/\.agentheim\/contexts\/design-system\/styleguide\//;

/** Each shape tried in order; first match on a line wins. `filter(relFile)` restricts a shape to a subset of files. */
const SHAPES = [
  { id: 'a', re: /\.agentheim\/contexts\// },
  { id: 'b', re: /contexts\/[^\s/'"()]+\/(?:backlog|todo|doing|done|done-archive)\// },
  { id: 'c', re: /contexts\/\*\// },
  { id: 'd', re: /\.agentheim\/vision\.md/ },
  { id: 'e', re: /\.agentheim\/context-map\.md/ },
  { id: 'f', re: /knowledge\/protocol/ },
  {
    id: 'g1',
    re: /'contexts'|"contexts"/,
    filter: (relFile) => relFile.startsWith('lib/') || relFile.startsWith('dashboard/'),
  },
  {
    id: 'g2',
    re: /['"]knowledge['"]\s*,\s*['"]protocol/,
    filter: (relFile) => relFile.startsWith('lib/') || relFile.startsWith('dashboard/'),
  },
];

/** Recursively collect every walked file under `dir`; loss-tolerant on an unreadable directory. */
function walkFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
      out.push(...walkFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && WALK_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** Scan one file's lines for a forbidden shape; pushes onto `violations`. */
function scanFile(repoRoot, absFile, { isBcReadme, layout }, violations) {
  let content;
  try {
    content = readFileSync(absFile, 'utf8');
  } catch {
    return;
  }
  const relFile = path.relative(repoRoot, absFile).split(path.sep).join('/');
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    if (isAllowlisted(relFile, lineText)) return;
    if (isBcReadme && LEGACY_PATH_OK_RE.test(lineText)) return;
    if (layout === 'legacy' && STYLEGUIDE_IMPORT_RE.test(lineText) && relFile.startsWith('dashboard/app/')) return;
    for (const shape of SHAPES) {
      if (shape.filter && !shape.filter(relFile)) continue;
      const m = lineText.match(shape.re);
      if (m) {
        violations.push({ file: relFile, line: idx + 1, match: m[0], text: lineText.trim() });
        return;
      }
    }
  });
}

/**
 * Scan the tree for legacy `.agentheim/contexts/`-shaped path literals.
 * Pure, loss-tolerant, side-effect-free.
 *
 * @param {string} repoRoot Absolute project root (the folder holding `.agentheim/`, `skills/`, etc).
 * @returns {{file: string, line: number, match: string, text: string}[]}
 */
export function findLegacyPathViolations(repoRoot) {
  const violations = [];

  let layout = null;
  try {
    layout = detectLayout(repoRoot);
  } catch {
    layout = null;
  }

  for (const dirName of WALK_DIRS) {
    for (const file of walkFiles(path.join(repoRoot, dirName))) {
      scanFile(repoRoot, file, { isBcReadme: false, layout }, violations);
    }
  }

  if (layout && layout !== 'mixed') {
    let bcs = [];
    try {
      bcs = listKnowledgeContexts(repoRoot, { layout });
    } catch {
      bcs = [];
    }
    for (const bc of bcs) {
      let readmePath;
      try {
        readmePath = bcReadmePath(repoRoot, bc, { layout });
      } catch {
        continue;
      }
      if (existsSync(readmePath)) {
        scanFile(repoRoot, readmePath, { isBcReadme: true, layout }, violations);
      }
    }
  }

  return violations;
}
