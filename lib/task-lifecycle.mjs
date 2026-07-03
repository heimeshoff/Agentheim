// applyTaskMove — the single Task-lifecycle mover (ADR-0001, ADR-0007, ADR-0017).
//
// This is agentic-workflow DOMAIN logic. It is the canonical writer of
// task-lifecycle state, owned by and used by the skills (`modeling` / `work`).
// The dashboard does NOT call it: as of ADR-0017 the dashboard is read-only and
// has no write path, so skills are the sole owners of lifecycle transitions. The
// `ui` policy below is retained as a generic restricted (Promote-only) move set —
// it models a legal-move subset and is no longer wired to any caller.
//
// It (1) validates `from→to` against the legal-move policy incl. `depends_on`
// guards, (2) enforces *status matches folder* — folder rename AND frontmatter
// `status` rewrite together, never one without the other, (3) performs the move,
// and (4) returns success-with-new-state OR a structured rejection carrying a
// domain reason. An optimistic precondition (expected `from` folder + the file's
// mtime) is honored: if disk disagrees it rejects WITHOUT mutating anything.
//
// Scope boundary (ADR-0007): this operation owns ONLY the task-file move + status
// rewrite + precondition. INDEX/protocol side-effects stay with the skills /
// orchestrator; a dashboard-performed promote does NOT touch indexes in v1.
//
// Node stdlib only (node:fs, node:path) — zero dependencies, matching the
// dashboard runtime's constraint.

import { existsSync, statSync, renameSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/** The four lifecycle folders, in forward order. */
export const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/**
 * Legal move sets, keyed by policy.
 * - `ui`    — a restricted Promote-only set (`backlog→todo`). Originally the
 *             dashboard's drag surface; the dashboard write path was removed in
 *             ADR-0017, so this set is now wired to no caller and kept only as the
 *             generic restricted policy (and the default).
 * - `skill` — the fuller set the skills drive: forward steps only
 *             (Promote, Claim, Complete). Backward moves and skips remain illegal.
 */
const LEGAL_MOVES = {
  ui: new Set(['backlog->todo']),
  skill: new Set(['backlog->todo', 'todo->doing', 'doing->done']),
};

function reject(code, reason) {
  return { ok: false, code, reason };
}

/** The absolute path of a lifecycle folder for a context. */
function folderDir(rootDir, context, folder) {
  return path.join(rootDir, '.agentheim', 'contexts', context, folder);
}

/**
 * Resolve the actual task file for `id` inside one lifecycle folder, or null if
 * absent. Task files on disk follow the convention `<id>-<slug>.md` (e.g.
 * `agentic-workflow-009-dashboard-live-update.md`) while the id in frontmatter /
 * the read projection is the bare `<id>` (`agentic-workflow-009`). The skills'
 * worker and the dashboard both address a task by its bare id, so the mover must
 * map id → file. It matches either the exact `<id>.md` OR `<id>-<slug>.md`,
 * anchored so a bare `alpha-001` never collides with `alpha-0010` (ADR-0012).
 * If more than one file matches (a malformed project), the exact `<id>.md` wins,
 * else the first sorted match — deterministic, never ambiguous at runtime.
 */
function resolveTaskFile(rootDir, context, folder, id) {
  const dir = folderDir(rootDir, context, folder);
  const exact = path.join(dir, `${id}.md`);
  if (existsSync(exact)) return exact;
  if (!existsSync(dir)) return null;
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
  const match = names.find((name) => name === `${id}.md` || name.startsWith(`${id}-`) && name.toLowerCase().endsWith('.md'));
  return match ? path.join(dir, match) : null;
}

/** Parse `depends_on: [a, b]` out of YAML frontmatter. Returns a string[]. */
function parseDependsOn(content) {
  const m = content.match(/^depends_on:\s*\[([^\]]*)\]\s*$/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A dependency is satisfied iff a file `<depId>.md` exists in some BC's `done/`
 * folder. We scan every `contexts/<bc>/done/` because a dependency may live in
 * another bounded context (e.g. the design-system styleguide gating a frontend
 * task in agentic-workflow).
 */
function dependencySatisfied(rootDir, depId) {
  const contextsDir = path.join(rootDir, '.agentheim', 'contexts');
  if (!existsSync(contextsDir)) return false;
  // depId may already encode its BC, but we don't rely on that — just look in
  // every done/ folder.
  let entries;
  try {
    entries = statSync(contextsDir).isDirectory()
      ? readdirNamesSync(contextsDir)
      : [];
  } catch {
    return false;
  }
  for (const bc of entries) {
    // Task files follow the `<id>-<slug>.md` convention (the slug rides along
    // with the id), so an exact `<depId>.md` rarely exists. Match the same way
    // resolveTaskFile does: exact id, or `<depId>-…` (trailing hyphen guards
    // against prefix collisions like `design-system-001` vs `…-0015`).
    if (resolveTaskFile(rootDir, bc, 'done', depId)) return true;
  }
  return false;
}

function readdirNamesSync(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Move a task between lifecycle folders, enforcing the Task aggregate invariants.
 *
 * @param {string} rootDir  Absolute project root (the folder holding `.agentheim/`).
 *                          Passed explicitly — no ambient cwd — so a skill context
 *                          and the dashboard runtime call it identically.
 * @param {string} id       Task id, e.g. `agentic-workflow-003`.
 * @param {string} from     Folder the caller believes the task is in (the optimistic
 *                          precondition's source).
 * @param {string} to       Target folder.
 * @param {object} [options]
 * @param {string} [options.context]        Bounded-context name. Defaults to the
 *                                          `<bc>` prefix parsed from `id`.
 * @param {'ui'|'skill'} [options.policy]   Legal-move set to enforce. Default `ui`
 *                                          (the dashboard's Promote-only surface).
 * @param {number} [options.expectedMtimeMs] Optimistic mtime precondition; if the
 *                                          file's current mtime differs, reject.
 * @returns {{ok:true,state:{id,from,to,status,path,mtimeMs}}|{ok:false,code:string,reason:string}}
 */
export function applyTaskMove(rootDir, id, from, to, options = {}) {
  const context = options.context ?? deriveContext(id);
  const policy = options.policy ?? 'ui';

  // --- 1. Shape validation ------------------------------------------------
  if (!LIFECYCLE_FOLDERS.includes(from) || !LIFECYCLE_FOLDERS.includes(to)) {
    return reject(
      'illegal-move',
      `Unknown lifecycle folder in ${from}->${to}; valid folders are ${LIFECYCLE_FOLDERS.join(', ')}.`
    );
  }

  // --- 2. Legal-move policy ----------------------------------------------
  const legal = LEGAL_MOVES[policy] ?? LEGAL_MOVES.ui;
  if (!legal.has(`${from}->${to}`)) {
    return reject(
      'illegal-move',
      `${from}->${to} is not a legal ${policy} move. Legal ${policy} moves: ${[...legal].join(', ')}.`
    );
  }

  // --- 3. Optimistic precondition: file is actually in `from` -------------
  const fromPath = resolveTaskFile(rootDir, context, from, id);
  if (!fromPath) {
    // Distinguish "moved elsewhere" (stale view) from "never existed" (not-found).
    const elsewhere = LIFECYCLE_FOLDERS.some(
      (f) => f !== from && resolveTaskFile(rootDir, context, f, id) !== null
    );
    if (elsewhere) {
      return reject(
        'stale-precondition',
        `Task ${id} is not in ${from} — it appears to have already moved. Refetch the board.`
      );
    }
    return reject('not-found', `Task ${id} was not found in context ${context}.`);
  }

  // --- 4. Optimistic precondition: mtime guard ----------------------------
  const stat = statSync(fromPath);
  if (
    options.expectedMtimeMs !== undefined &&
    options.expectedMtimeMs !== null &&
    !mtimeMatches(stat.mtimeMs, options.expectedMtimeMs)
  ) {
    return reject(
      'stale-precondition',
      `Task ${id} was modified since it was read (mtime changed) — it may have already moved. Refetch the board.`
    );
  }

  // --- 5. depends_on guard (frontend gate) --------------------------------
  const content = readFileSync(fromPath, 'utf8');
  if (to === 'todo') {
    // Promote: no unmet dependency may exist. A frontend task cannot promote
    // ahead of e.g. the styleguide.
    const deps = parseDependsOn(content);
    const unmet = deps.filter((dep) => !dependencySatisfied(rootDir, dep));
    if (unmet.length > 0) {
      return reject(
        'blocked-dependency',
        `Task ${id} cannot be promoted: unmet depends_on [${unmet.join(', ')}] (the dependency is not yet in a done/ folder).`
      );
    }
  }

  // --- 6. Perform the move: status rewrite + folder rename, together -------
  // Rewrite frontmatter `status` to match the destination folder BEFORE the
  // rename, then rename. If the rename throws, the in-memory rewrite is
  // discarded (we never wrote it to the old path), so no partial move escapes.
  const rewritten = rewriteStatus(content, to);
  // Preserve the on-disk filename (the `<id>-<slug>.md` convention) across the
  // move — only the folder changes. The id is stable; the slug rides along.
  const toPath = path.join(folderDir(rootDir, context, to), path.basename(fromPath));

  // Write the status-rewritten body to the source path, then rename. Writing to
  // source first (not dest) keeps a single canonical file at all times; the
  // rename is the atomic publish of the new state.
  writeFileSync(fromPath, rewritten);
  renameSync(fromPath, toPath);

  return {
    ok: true,
    state: {
      id,
      from,
      to,
      status: to,
      path: toPath,
      mtimeMs: statSync(toPath).mtimeMs,
    },
  };
}

/**
 * Derive the `<bc>` from a bare task id, for BOTH id shapes (ADR-0028 §4):
 *   - legacy sequential: `<bc>-NNN` (all-digit tail, e.g. `agentic-workflow-077`)
 *   - new random token:  `<bc>-<token>` where token leads with a letter and is
 *     5 chars over Crockford base32 minus the look-alikes `i l o u`
 *     (`[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}`, e.g. `agentic-workflow-k3f9q`).
 *
 * The match is END-ANCHORED on the bare id (deriveContext's only caller,
 * `applyTaskMove`, always passes the bare id, never the slugged filename), so a
 * slug is never in scope and `m[1]` is the BC. The two tails are disjoint: a
 * digit-leading tail is never a new token, a letter-leading tail is never legacy.
 * Anything matching NEITHER shape (a malformed leading-digit "token" such as
 * `agentic-workflow-3f9qx`, or an id with no recognizable tail) falls through to
 * the `m ? m[1] : id` fallback and returns the id unchanged — never undefined.
 */
export function deriveContext(id) {
  const m = String(id).match(/^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/);
  return m ? m[1] : id;
}

/** Rewrite the frontmatter `status:` line to `status: <folder>`. */
function rewriteStatus(content, folder) {
  if (/^status:.*$/m.test(content)) {
    return content.replace(/^status:.*$/m, `status: ${folder}`);
  }
  // No status line present — defensively inject one after the opening `---`.
  return content.replace(/^---\n/, `---\nstatus: ${folder}\n`);
}

/**
 * mtime comparison tolerant of float/precision drift across filesystems. Treat
 * values within 1ms as equal.
 */
function mtimeMatches(actual, expected) {
  return Math.abs(Number(actual) - Number(expected)) < 1;
}

// ---------------------------------------------------------------------------
// promoteTask — the git-free PROMOTE lifecycle script (ADR-0038 Ruling B).
//
// This is layer 2 of the three-layer boundary: it wraps `applyTaskMove` (layer
// 1, unchanged) and owns the deterministic bookkeeping text-surgery around it —
// INDEX.md marker edits + count deltas, the protocol.md prepend — that today
// lives as hand-maintained skill prose. It makes NO judgment call (readiness is
// the caller's job; the fail-closed depends_on gate is `applyTaskMove`'s, not
// re-implemented here) and NEVER shells out to `git` — its sole output is an
// enumerated manifest `{ changed, message, verb, id }` for the caller (a skill)
// to `git add` and commit.
// ---------------------------------------------------------------------------

const DEFAULT_PROTOCOL_HEADER =
  '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n';

/** Read one frontmatter field's raw value (no YAML parser — matches the rest of this module). */
function parseFrontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

/** Remove the line naming `id` (`**<id>**`) from a `<!-- <section>:start/end -->` marker block. */
function removeIndexLine(content, section, id) {
  const re = new RegExp(`(<!-- ${section}:start -->\\n)([\\s\\S]*?)(<!-- ${section}:end -->)`);
  const m = content.match(re);
  if (!m) throw new Error(`INDEX.md is missing the ${section} markers.`);
  const kept = m[2]
    .split('\n')
    .filter((line) => !line.includes(`**${id}**`))
    .join('\n');
  return content.replace(re, `$1${kept}$3`);
}

/** Insert `line` as the new first entry of a `<!-- <section>:start -->` marker block. */
function insertIndexLineAtTop(content, section, line) {
  const marker = `<!-- ${section}:start -->\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error(`INDEX.md is missing the ${section} start marker.`);
  const at = idx + marker.length;
  return content.slice(0, at) + line + '\n' + content.slice(at);
}

/** Add `delta` to the `**<Label>:** N` count line under `<!-- task-counts:start -->`. */
function adjustIndexCount(content, label, delta) {
  const re = new RegExp(`(\\*\\*${label}:\\*\\* )(\\d+)`);
  const m = content.match(re);
  if (!m) throw new Error(`INDEX.md is missing the ${label} count.`);
  return content.replace(re, `$1${Number(m[2]) + delta}`);
}

/** `YYYY-MM-DD HH:MM` in local time, matching the protocol.md entry convention. */
function formatProtocolTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Prepend `entryBody` (the `## heading` line through its `**Field:**` lines, no
 * trailing separator) right after the header's `---` line, matching every other
 * entry's `\n\n---\n\n` separator exactly.
 */
function prependProtocolEntry(content, entryBody) {
  const marker = '\n---\n\n';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    throw new Error("protocol.md is missing the header's `---` separator.");
  }
  const at = idx + marker.length;
  return content.slice(0, at) + `${entryBody}\n\n---\n\n` + content.slice(at);
}

/**
 * Mechanize the PROMOTE flow's bookkeeping (ADR-0038): move the task via
 * `applyTaskMove`, then perform the INDEX.md marker/count edits, the
 * protocol.md prepend, and backlink reconciliation (a no-op for PROMOTE — a
 * folder move changes no other task's or ADR's backlinks — kept as an explicit
 * step so CLAIM/COMPLETE, which DO reconcile backlinks, share this shape).
 *
 * Git-free: never runs `git`. On success returns the enumerated manifest the
 * caller `git add`s and commits; on rejection, returns `applyTaskMove`'s
 * structured `{ok:false, code, reason}` verbatim and writes nothing.
 *
 * @param {string} rootDir
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.context]  Bounded-context name; defaults to `deriveContext(id)`.
 * @param {Date}   [opts.now]     Clock override for the protocol timestamp (tests).
 * @returns {{ok:true,changed:string[],message:string,verb:'promote',id:string}
 *          |{ok:false,code:string,reason:string}}
 */
export function promoteTask(rootDir, id, opts = {}) {
  const context = opts.context ?? deriveContext(id);
  const now = opts.now ?? new Date();

  const moveResult = applyTaskMove(rootDir, id, 'backlog', 'todo', { context, policy: 'skill' });
  if (!moveResult.ok) return moveResult;

  const taskPath = moveResult.state.path;
  const taskContent = readFileSync(taskPath, 'utf8');
  const title = parseFrontmatterField(taskContent, 'title');
  const type = parseFrontmatterField(taskContent, 'type');
  const fileName = path.basename(taskPath);

  // --- INDEX.md: backlog line removed, todo line inserted at top, counts shifted ---
  const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  let indexContent = readFileSync(indexPath, 'utf8');
  indexContent = removeIndexLine(indexContent, 'backlog-list', id);
  indexContent = insertIndexLineAtTop(
    indexContent,
    'todo-list',
    `- **${id}** — ${title} (${type}) — \`todo/${fileName}\``
  );
  indexContent = adjustIndexCount(indexContent, 'Backlog', -1);
  indexContent = adjustIndexCount(indexContent, 'Todo', 1);
  writeFileSync(indexPath, indexContent);

  // --- protocol.md: prepend the "Modeling / Promoted" entry ---
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
  mkdirSync(path.dirname(protocolPath), { recursive: true }); // a brand-new project may lack knowledge/ entirely
  let protocolContent;
  try {
    protocolContent = readFileSync(protocolPath, 'utf8');
  } catch {
    protocolContent = DEFAULT_PROTOCOL_HEADER;
  }
  const entryBody =
    `## ${formatProtocolTimestamp(now)} -- Modeling / Promoted: ${id} - ${title}\n\n` +
    `**Type:** Modeling / Promote\n` +
    `**BC:** ${context}\n` +
    `**From → To:** backlog → todo`;
  protocolContent = prependProtocolEntry(protocolContent, entryBody);
  writeFileSync(protocolPath, protocolContent);

  // --- backlink reconciliation: no-op for PROMOTE (see doc comment above) ---

  const message = `model(${context}): promote ${id} — ${title} [${id}]`;

  return {
    ok: true,
    changed: [taskPath, indexPath, protocolPath],
    message,
    verb: 'promote',
    id,
  };
}
