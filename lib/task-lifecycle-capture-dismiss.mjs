// task-lifecycle-capture-dismiss — the git-free CAPTURE and DISMISS lifecycle
// scripts (ADR-0038 Ruling B, ADR-0054, ADR-0022-amended, agentic-workflow-e4bjh).
//
// This is a SEPARATE, additive module rather than an extension of
// `lib/task-lifecycle.mjs` — deliberately, to keep this task's diff a
// self-contained, mergeable hunk alongside a concurrent sibling task editing
// that same shared file. A handful of small private helpers below
// (`parseFrontmatterField`, `formatProtocolTimestamp`, `readProtocolOrDefault`,
// `adjustIndexCount`, and a task-file resolver mirroring `resolveTaskFile`)
// are therefore DUPLICATED from `task-lifecycle.mjs` rather than imported —
// they are not exported there, and exporting them would mean editing that
// shared module's existing lines. The pure edit primitives it already ships
// (`insertIndexLineAtTop`, `prependProtocolEntry`, `normalizeText`,
// `readNormalizedFile`/`writeNormalizedFile`) ARE reused directly; only what
// isn't exported is duplicated, and only in the amount needed here.
//
// agentic-workflow-vhz69 folded the ONE exception back in: `readNormalizedFile`
// / `writeNormalizedFile` are now imported from `task-lifecycle.mjs` (which
// exports them) instead of duplicated — pt0gy having landed, no concurrent
// worktree is editing that module anymore, closing the "re-examine once none
// is in flight" trigger ADR-0073's "Why a separate module" section named.
// `writeNormalizedFile` now also routes through `lib/atomic-write.mjs`'s
// write-temp-then-rename primitive, so this module's writers get that
// guarantee for free.
//
// CAPTURE — registers a task file the CALLER already wrote (modeling's
// CAPTURE, quick-capture, or brainstorm's per-task foundation-task minting)
// to exactly one of `backlog/` or `todo/`. It never authors task-file prose —
// that judgment stays with the skills. It validates frontmatter, inserts the
// INDEX line + count delta, and (unless structurally skipped) prepends a
// protocol entry keyed by the caller's `source`.
//
// DISMISS — two-phase (`{plan:true}` / `{confirm:[...ids]}`). Mechanizes
// ADR-0022's cascade with two live-tree contradictions fixed (this task's ADR
// amends ADR-0022 accordingly): the cascade follows `depends_on` edges ONLY
// (`blocks` is reconciliation-only, never traversed — the on-disk `blocks`/
// `depends_on` asymmetry made "equivalently, follow blocks" factually false),
// and membership/stripping match on EXACT frontmatter `id` equality only,
// never `resolveTaskFile`-style filename/prefix resolution (the on-disk
// `design-system-001-styleguide` vs `design-system-001` mismatch).
//
// Atomicity (ADR-0054): compute-then-write throughout. Write order on a
// confirmed dismiss is INDEX edits -> task-file unlinks -> surviving backlink
// stripping -> protocol entry — reversing ADR-0022 §4's listed order
// deliberately (Notes, agentic-workflow-e4bjh): a crash after unlink-before-
// reconcile leaves an unrecoverable "ready and invisible" desync, whereas this
// order leaves every residual failure "blocked and visible."
//
// Git-free (ADR-0038 Ruling B): never shells out to `git`. Node stdlib only.

import {
  existsSync,
  readFileSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveContext,
  LIFECYCLE_FOLDERS,
  insertIndexLineAtTop,
  prependProtocolEntry,
  normalizeText,
  readNormalizedFile,
  writeNormalizedFile,
} from './task-lifecycle.mjs';
import { writeFileAtomic } from './atomic-write.mjs';
import { classifyTaskId, GRANDFATHERED_IDS, mintTaskId } from './id-grammar.mjs';
import { withLifecycleLock } from './lifecycle-lock.mjs';

function reject(code, reason) {
  return { ok: false, code, reason };
}

// --- duplicated small helpers (see header note on why) ---------------------

const DEFAULT_PROTOCOL_HEADER =
  '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n';

function parseFrontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

/** Parse a bracketed frontmatter array field (`field: [a, b]`), single-line only (matches task-lifecycle.mjs's parseDependsOn convention). */
function parseArrayField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*\\[([^\\]]*)\\]\\s*$`, 'm'));
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatProtocolTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readProtocolOrDefault(protocolPath) {
  try {
    return readNormalizedFile(protocolPath);
  } catch {
    return { content: DEFAULT_PROTOCOL_HEADER, eol: '\n', bom: false };
  }
}

/**
 * Add `delta` to the `**<Label>:** N` count line, scoped to the
 * `<!-- task-counts:start/end -->` block, with the same below-zero guard as
 * `task-lifecycle.mjs`'s private `adjustIndexCount` (ADR-0054 hardening) —
 * duplicated here rather than imported (not exported there).
 */
function adjustIndexCount(content, label, delta) {
  const blockRe = /(<!-- task-counts:start -->\n)([\s\S]*?)(<!-- task-counts:end -->)/;
  const blockMatch = content.match(blockRe);
  if (!blockMatch) throw new Error('INDEX.md is missing the task-counts markers.');
  const labelRe = new RegExp(`(\\*\\*${label}:\\*\\* )(\\d+)`);
  const inner = blockMatch[2];
  const m = inner.match(labelRe);
  if (!m) throw new Error(`INDEX.md is missing the ${label} count.`);
  const current = Number(m[2]);
  const next = current + delta;
  if (next < 0) {
    throw new Error(`INDEX.md's ${label} count (${current}) would go negative with delta ${delta} (${current} + ${delta} = ${next}).`);
  }
  const newInner = inner.replace(labelRe, `$1${next}`);
  return content.replace(blockRe, `$1${newInner}$3`);
}

/**
 * Strict `removeIndexLine` variant (Notes, agentic-workflow-e4bjh): reports
 * how many lines it actually removed, rather than silently no-oping on a
 * missing line while a caller's count-delta assumption still fires. DISMISS's
 * INDEX count deltas are derived from this return value, never from cascade-
 * set cardinality.
 */
function removeIndexLineStrict(content, section, id) {
  const re = new RegExp(`(<!-- ${section}:start -->\\n)([\\s\\S]*?)(<!-- ${section}:end -->)`);
  const m = content.match(re);
  if (!m) throw new Error(`INDEX.md is missing the ${section} markers.`);
  let removed = 0;
  const kept = m[2]
    .split('\n')
    .filter((line) => {
      if (line.includes(`**${id}**`)) {
        removed++;
        return false;
      }
      return true;
    })
    .join('\n');
  return { content: content.replace(re, `$1${kept}$3`), removed };
}

/** Mirrors `task-lifecycle.mjs`'s private `resolveTaskFile` (not exported there). */
function findTaskFile(rootDir, context, folder, id) {
  const dir = path.join(rootDir, '.agentheim', 'contexts', context, folder);
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
  const match = names.find((name) => name === `${id}.md` || (name.startsWith(`${id}-`) && name.toLowerCase().endsWith('.md')));
  return match ? path.join(dir, match) : null;
}

// ---------------------------------------------------------------------------
// index-template.md rendering (capture's INDEX-backfill path)
//
// Read sibling-relative off THIS module's own `import.meta.url` — never via
// `lib/resolve-plugin-file.mjs` (that resolver is for locating an executable
// entry point across a repo/plugin-cache boundary; `references/` ships beside
// `lib/` in both shapes, so a plain one-level-up join already works
// identically in the repo and an installed plugin cache) and never an
// embedded copy (a second hand-typed copy of the template is exactly the
// drift risk ADR-0054's Notes describe for the dry-run mirror it removed).
// ---------------------------------------------------------------------------

function loadIndexTemplateRaw() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.join(moduleDir, '..', 'references', 'index-template.md');
  // Canonicalize to `\n` regardless of the checkout's line-ending style
  // (a Windows `.agentheim` checkout routinely carries CRLF here) — the
  // marker regexes below assume `\n`, matching the rest of this module's
  // EOL-normalization convention (task-lifecycle.mjs's infrastructure-5w5gs
  // fix, reused by reference).
  return normalizeText(readFileSync(templatePath, 'utf8')).content;
}

/** Extract the fenced `## Per-BC:` markdown example out of `index-template.md`. */
function extractPerBcTemplate(raw) {
  const marker = '## Per-BC:';
  const idx = raw.indexOf(marker);
  if (idx === -1) throw new Error('references/index-template.md is missing its "## Per-BC:" section.');
  const after = raw.slice(idx);
  const fenceStart = after.indexOf('```markdown');
  if (fenceStart === -1) throw new Error('references/index-template.md\'s Per-BC section is missing its fenced example.');
  const bodyStart = after.indexOf('\n', fenceStart) + 1;
  const fenceEnd = after.indexOf('```', bodyStart);
  if (fenceEnd === -1) throw new Error('references/index-template.md\'s Per-BC fenced example has no closing fence.');
  return after.slice(bodyStart, fenceEnd);
}

const TEMPLATE_SECTIONS_TO_EMPTY = ['todo-list', 'doing-list', 'done-list', 'backlog-list', 'adr-local', 'research-local', 'concepts'];

function emptySectionBlock(content, section) {
  const re = new RegExp(`(<!-- ${section}:start -->\\n)([\\s\\S]*?)(<!-- ${section}:end -->)`);
  return re.test(content) ? content.replace(re, '$1$3') : content;
}

function zeroTaskCounts(content) {
  const blockRe = /(<!-- task-counts:start -->\n)([\s\S]*?)(<!-- task-counts:end -->)/;
  return content.replace(blockRe, (_m, a, inner, b) => a + inner.replace(/(\*\*(?:Backlog|Todo|Doing|Done):\*\* )N/g, '$10') + b);
}

function renderBcName(context) {
  return String(context)
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Render a brand-new, empty per-BC `INDEX.md` from the template, for `context`. */
function renderIndexTemplate(context) {
  const raw = loadIndexTemplateRaw();
  let body = extractPerBcTemplate(raw);
  body = body.replace('<BC name>', renderBcName(context));
  for (const section of TEMPLATE_SECTIONS_TO_EMPTY) {
    body = emptySectionBlock(body, section);
  }
  body = zeroTaskCounts(body);
  return body;
}

/** True iff `context`'s four lifecycle folders hold nothing but `exactFilePath`. */
function bcHasOnlyThisFile(rootDir, context, exactFilePath) {
  const contextDir = path.join(rootDir, '.agentheim', 'contexts', context);
  const resolvedExact = path.resolve(exactFilePath);
  for (const folder of LIFECYCLE_FOLDERS) {
    const dir = path.join(contextDir, folder);
    if (!existsSync(dir)) continue;
    let names;
    try {
      names = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name);
    } catch {
      names = [];
    }
    for (const name of names) {
      if (path.resolve(path.join(dir, name)) !== resolvedExact) return false;
    }
  }
  return true;
}

function buildCaptureEntryBody(source, { id, title, context, folder, summary }, now) {
  const ts = formatProtocolTimestamp(now);
  if (source === 'quick-capture') {
    return (
      `## ${ts} -- Capture / Captured: ${id} - ${title}\n\n` +
      `**Type:** Capture\n` +
      `**BC:** ${context}\n` +
      `**Filed to:** ${folder}\n` +
      `**Summary:** ${summary}`
    );
  }
  return (
    `## ${ts} -- Modeling / Captured: ${id} - ${title}\n\n` +
    `**Type:** Modeling / Capture\n` +
    `**BC:** ${context}\n` +
    `**Filed to:** ${folder}\n` +
    `**Summary:** ${summary}`
  );
}

// ---------------------------------------------------------------------------
// captureTask
// ---------------------------------------------------------------------------

/**
 * Register a task file the caller already wrote to `backlog/` or `todo/`:
 * validate its frontmatter, insert the matching INDEX line + count delta, and
 * (unless structurally skipped) prepend a protocol entry.
 *
 * @param {string} rootDir
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.context]         Defaults to `deriveContext(id)`.
 * @param {Date}   [opts.now]             Clock override (tests).
 * @param {boolean} [opts.protocolEntry]  `false` = structural skip: no
 *   protocol.md read or write occurs at all. Defaults to `true`.
 * @param {'modeling'|'quick-capture'} [opts.source]  Required when a protocol
 *   entry is being written; selects the entry template.
 * @param {string} [opts.summary]         Required when a protocol entry is
 *   being written.
 * @returns {{ok:true,changed:string[],message:string,verb:'capture',id:string}
 *          |{ok:false,code:string,reason:string}}
 */
export function captureTask(rootDir, id, opts = {}) {
  return withLifecycleLock(rootDir, () => captureTaskLocked(rootDir, id, opts), opts.lock);
}

/**
 * The actual CAPTURE compute-then-write body, run while `captureTask` holds
 * the one project-wide lifecycle lock (agentic-workflow-pt0gy) — never call
 * this directly.
 */
function captureTaskLocked(rootDir, id, opts) {
  const now = opts.now ?? new Date();
  const context = opts.context ?? deriveContext(id);

  const backlogPath = findTaskFile(rootDir, context, 'backlog', id);
  const todoPath = findTaskFile(rootDir, context, 'todo', id);
  if (backlogPath && todoPath) {
    return reject('ambiguous-location', `Task ${id} was found in BOTH backlog/ and todo/ — capture requires exactly one.`);
  }
  if (!backlogPath && !todoPath) {
    return reject('not-found', `Task ${id} was not found in backlog/ or todo/ under context "${context}".`);
  }
  const folder = backlogPath ? 'backlog' : 'todo';
  const filePath = backlogPath ?? todoPath;
  const fileName = path.basename(filePath);
  const content = readFileSync(filePath, 'utf8');

  const fmId = parseFrontmatterField(content, 'id');
  const fmStatus = parseFrontmatterField(content, 'status');
  const fmContext = parseFrontmatterField(content, 'context');
  const fmTitle = parseFrontmatterField(content, 'title');
  const fmType = parseFrontmatterField(content, 'type');
  const fmCreated = parseFrontmatterField(content, 'created');

  if (fmId !== id) {
    return reject('invalid-frontmatter', `Frontmatter id "${fmId}" does not match the requested id "${id}".`);
  }
  const idKind = classifyTaskId(id);
  if (idKind === 'malformed' && !GRANDFATHERED_IDS.includes(id)) {
    return reject('invalid-id', `Id "${id}" is not well-formed (classifyTaskId: malformed, and not grandfathered).`);
  }
  if (fmStatus !== folder) {
    return reject('status-mismatch', `Frontmatter status "${fmStatus}" does not match the folder ${id} was found in ("${folder}").`);
  }
  const expectedContext = deriveContext(id);
  if (fmContext !== expectedContext) {
    return reject('context-mismatch', `Frontmatter context "${fmContext}" does not match the id-derived context "${expectedContext}".`);
  }
  if (!fmTitle) return reject('missing-field', `Task ${id} is missing a "title".`);
  if (!fmType) return reject('missing-field', `Task ${id} is missing a "type".`);
  if (!fmCreated) return reject('missing-field', `Task ${id} is missing a "created" date.`);

  const protocolEntry = opts.protocolEntry !== false;
  if (protocolEntry) {
    if (opts.source !== 'modeling' && opts.source !== 'quick-capture') {
      return reject('invalid-source', `capture requires opts.source to be "modeling" or "quick-capture" (got ${JSON.stringify(opts.source ?? null)}).`);
    }
    if (!opts.summary) {
      return reject('missing-summary', 'capture requires opts.summary when a protocol entry is being written.');
    }
  }

  const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  const section = folder === 'backlog' ? 'backlog-list' : 'todo-list';
  const countLabel = folder === 'backlog' ? 'Backlog' : 'Todo';
  const line = `- **${id}** — ${fmTitle} (${fmType}) — \`${folder}/${fileName}\``;

  let indexFile, newIndexContent;
  try {
    if (existsSync(indexPath)) {
      indexFile = readNormalizedFile(indexPath);
    } else {
      if (!bcHasOnlyThisFile(rootDir, context, filePath)) {
        return reject(
          'index-missing',
          `${context}'s INDEX.md is missing, and its lifecycle folders hold more than just ${id} — refusing to backfill a fresh template over real pre-existing tasks.`
        );
      }
      indexFile = { content: renderIndexTemplate(context), eol: '\n', bom: false };
    }
    let indexContent = indexFile.content;
    indexContent = insertIndexLineAtTop(indexContent, section, line);
    indexContent = adjustIndexCount(indexContent, countLabel, 1);
    newIndexContent = indexContent;
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  let protocolPath, protocolFile, newProtocolContent;
  if (protocolEntry) {
    protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
    try {
      mkdirSync(path.dirname(protocolPath), { recursive: true });
      protocolFile = readProtocolOrDefault(protocolPath);
      const entryBody = buildCaptureEntryBody(opts.source, { id, title: fmTitle, context, folder, summary: opts.summary }, now);
      newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
    } catch (err) {
      return reject('bookkeeping-marker-mismatch', err.message);
    }
  }

  mkdirSync(path.dirname(indexPath), { recursive: true });
  writeNormalizedFile(indexPath, newIndexContent, indexFile);
  const changed = [indexPath];
  if (protocolEntry) {
    writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);
    changed.push(protocolPath);
  }

  const message = `chore(${context}): capture ${id} — ${fmTitle} [${id}]`;

  return { ok: true, changed, message, verb: 'capture', id };
}

// ---------------------------------------------------------------------------
// dismissTask — two-phase plan/confirm cascade dismiss (ADR-0022, amended)
// ---------------------------------------------------------------------------

/** Walk every BC's four lifecycle folders and parse each task file's relevant fields. */
function loadAllTasks(rootDir) {
  const contextsDir = path.join(rootDir, '.agentheim', 'contexts');
  const out = [];
  if (!existsSync(contextsDir)) return out;
  let bcs;
  try {
    bcs = readdirSync(contextsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    bcs = [];
  }
  for (const bc of bcs) {
    for (const folder of LIFECYCLE_FOLDERS) {
      const dir = path.join(contextsDir, bc, folder);
      let names;
      try {
        names = readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
          .map((e) => e.name);
      } catch {
        names = [];
      }
      for (const name of names) {
        const abs = path.join(dir, name);
        let content;
        try {
          content = readFileSync(abs, 'utf8');
        } catch {
          continue;
        }
        const fmId = parseFrontmatterField(content, 'id') || name.replace(/\.md$/i, '');
        out.push({
          id: fmId,
          title: parseFrontmatterField(content, 'title'),
          status: parseFrontmatterField(content, 'status') || folder,
          bc,
          path: abs,
          fileName: name,
          dependsOn: parseArrayField(content, 'depends_on'),
          blocks: parseArrayField(content, 'blocks'),
        });
      }
    }
  }
  return out;
}

/**
 * The ADR-0022-amended cascade: start from `leadId`, repeatedly add every
 * task whose `depends_on` (EXACT frontmatter-id match only) contains a
 * current member, to a fixed point. `blocks` is never traversed. Returns a
 * canonically sorted id list, or `null` if `leadId` doesn't resolve.
 */
function computeCascadeMemberIds(allTasks, leadId) {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  if (!byId.has(leadId)) return null;
  const memberIds = new Set([leadId]);
  let added = true;
  while (added) {
    added = false;
    for (const t of allTasks) {
      if (memberIds.has(t.id)) continue;
      if (t.dependsOn.some((dep) => memberIds.has(dep))) {
        memberIds.add(t.id);
        added = true;
      }
    }
  }
  return [...memberIds].sort();
}

/**
 * Advisories surfaced but never cascaded: (a) a cascade member's `blocks`
 * entry naming a task that its own `depends_on` doesn't reciprocally cascade
 * in (the live `blocks`/`depends_on` non-mirroring this task's ADR amendment
 * addresses), and (b) any task's `depends_on` entry that near-matches (by
 * filename-style prefix) a cascade member without being an EXACT id match
 * (the live `design-system-001-styleguide` vs `design-system-001` shape).
 */
function computeAdvisories(allTasks, memberIds) {
  const memberSet = new Set(memberIds);
  const advisories = [];
  for (const t of allTasks) {
    if (memberSet.has(t.id)) {
      for (const blockedId of t.blocks) {
        if (!memberSet.has(blockedId)) {
          advisories.push({ type: 'blocks-only', from: t.id, to: blockedId });
        }
      }
    }
    for (const dep of t.dependsOn) {
      if (memberSet.has(dep)) continue;
      const near = memberIds.find((m) => dep !== m && (dep.startsWith(`${m}-`) || m.startsWith(`${dep}-`)));
      if (near) {
        advisories.push({ type: 'dangling-reference', from: t.id, to: dep, near });
      }
    }
  }
  return advisories;
}

function planDismiss(rootDir, leadId) {
  const allTasks = loadAllTasks(rootDir);
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const lead = byId.get(leadId);
  if (!lead) return reject('not-found', `Task ${leadId} was not found.`);

  const memberIds = computeCascadeMemberIds(allTasks, leadId);
  const members = memberIds.map((mid) => byId.get(mid));
  const offenders = members.filter((t) => t.status === 'doing' || t.status === 'done');
  if (offenders.length > 0) {
    return reject(
      'in-flight-or-shipped',
      `Dismissing ${leadId} would touch in-flight/shipped task(s): ${offenders.map((o) => `${o.id} (${o.status})`).join(', ')}. Refusing.`
    );
  }

  const advisories = computeAdvisories(allTasks, memberIds);

  return {
    ok: true,
    verb: 'dismiss-plan',
    id: leadId,
    cascade: { leadId, memberIds },
    members: members.map((t) => ({ id: t.id, title: t.title, bc: t.bc, status: t.status, path: t.path })),
    advisories,
  };
}

function buildDismissEntryBody(members, now) {
  const ts = formatProtocolTimestamp(now);
  const idList = members.map((m) => m.id).join(', ');
  const lines = members.map((m) => `- ${m.id} - ${m.title} (${m.bc})`).join('\n');
  return `## ${ts} -- Modeling / Dismissed: ${idList}\n\n` + `**Type:** Modeling / Dismiss\n` + `**Dismissed:**\n${lines}`;
}

/**
 * The shared generalization (ADR-0068 single-source, agentic-workflow-qd24q)
 * underneath both DISMISS's strip and REROUTE's rename: parse a bracketed
 * frontmatter array field, map each item through `mapId` (return the SAME
 * string to keep an item unchanged, a DIFFERENT string to rename it, or
 * `null` to drop it), and rewrite the field only if anything actually
 * changed. `stripIdsFromField` (dismiss) and `renameIdInField` (reroute) are
 * both thin callers of this one function now, rather than two independently
 * hand-rolled array-rewrites that could drift.
 */
function mapIdsInField(content, field, mapId) {
  const re = new RegExp(`^(${field}:\\s*\\[)([^\\]]*)(\\])\\s*$`, 'm');
  const m = content.match(re);
  if (!m) return content;
  const items = m[2]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const mapped = items.map(mapId).filter((v) => v !== null);
  const changed = mapped.length !== items.length || mapped.some((v, i) => v !== items[i]);
  if (!changed) return content;
  return content.replace(re, `$1${mapped.join(', ')}$3`);
}

function stripIdsFromField(content, field, idsToRemove) {
  return mapIdsInField(content, field, (item) => (idsToRemove.includes(item) ? null : item));
}

/** Rename an EXACT match of `oldId` to `newId` inside one bracketed array field; every other item is untouched. */
function renameIdInField(content, field, oldId, newId) {
  return mapIdsInField(content, field, (item) => (item === oldId ? newId : item));
}

function stripIdsFromTask(content, idsToRemove) {
  let next = content;
  for (const field of ['depends_on', 'blocks', 'prior_art']) {
    next = stripIdsFromField(next, field, idsToRemove);
  }
  return next;
}

/** Rename `oldId` -> `newId` across a task's own three id-array fields (mirrors `stripIdsFromTask`). */
function renameIdInTask(content, oldId, newId) {
  let next = content;
  for (const field of ['depends_on', 'blocks', 'prior_art']) {
    next = renameIdInField(next, field, oldId, newId);
  }
  return next;
}

function confirmDismiss(rootDir, leadId, confirmIds, opts) {
  return withLifecycleLock(rootDir, () => confirmDismissLocked(rootDir, leadId, confirmIds, opts), opts.lock);
}

/**
 * The actual DISMISS-confirm compute-then-write body, run while
 * `confirmDismiss` holds the one project-wide lifecycle lock
 * (agentic-workflow-pt0gy) — never call this directly. `planDismiss` (the
 * zero-write plan phase) deliberately stays UNLOCKED — see this task's ADR.
 */
function confirmDismissLocked(rootDir, leadId, confirmIds, opts) {
  const now = opts.now ?? new Date();
  const allTasks = loadAllTasks(rootDir);
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const lead = byId.get(leadId);
  if (!lead) return reject('not-found', `Task ${leadId} was not found.`);

  const memberIds = computeCascadeMemberIds(allTasks, leadId);
  const confirmSorted = [...new Set(confirmIds)].sort();
  const sameMembership = memberIds.length === confirmSorted.length && memberIds.every((v, i) => v === confirmSorted[i]);
  if (!sameMembership) {
    return reject(
      'cascade-drifted',
      `Cascade membership changed since it was planned: now [${memberIds.join(', ')}], confirmed [${confirmSorted.join(', ')}]. Re-plan and re-confirm.`
    );
  }

  const members = memberIds.map((mid) => byId.get(mid));
  const offenders = members.filter((t) => t.status === 'doing' || t.status === 'done');
  if (offenders.length > 0) {
    return reject(
      'cascade-in-flight',
      `Cascade member(s) moved to an in-flight/shipped folder since planning: ${offenders.map((o) => `${o.id} (${o.status})`).join(', ')}.`
    );
  }

  const memberSet = new Set(memberIds);
  const byBc = new Map();
  for (const t of members) {
    if (!byBc.has(t.bc)) byBc.set(t.bc, []);
    byBc.get(t.bc).push(t);
  }
  const survivors = allTasks.filter((t) => !memberSet.has(t.id));

  const indexPlan = new Map();
  const strippedTaskWrites = [];
  const adrWrites = [];
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
  let protocolFile, newProtocolContent;

  try {
    for (const [bc, bcMembers] of byBc) {
      const indexPath = path.join(rootDir, '.agentheim', 'contexts', bc, 'INDEX.md');
      const indexFile = readNormalizedFile(indexPath);
      let indexContent = indexFile.content;
      let backlogRemoved = 0;
      let todoRemoved = 0;
      for (const t of bcMembers) {
        const section = t.status === 'backlog' ? 'backlog-list' : 'todo-list';
        const { content: nextContent, removed } = removeIndexLineStrict(indexContent, section, t.id);
        indexContent = nextContent;
        if (section === 'backlog-list') backlogRemoved += removed;
        else todoRemoved += removed;
      }
      indexContent = adjustIndexCount(indexContent, 'Backlog', -backlogRemoved);
      indexContent = adjustIndexCount(indexContent, 'Todo', -todoRemoved);
      indexPlan.set(bc, { path: indexPath, meta: indexFile, newContent: indexContent });
    }

    for (const t of survivors) {
      const content = readFileSync(t.path, 'utf8');
      const stripped = stripIdsFromTask(content, memberIds);
      if (stripped !== content) strippedTaskWrites.push({ path: t.path, content: stripped });
    }

    const decisionsDir = path.join(rootDir, '.agentheim', 'knowledge', 'decisions');
    if (existsSync(decisionsDir)) {
      let names = [];
      try {
        names = readdirSync(decisionsDir).filter((n) => n.toLowerCase().endsWith('.md'));
      } catch {
        names = [];
      }
      for (const name of names) {
        const abs = path.join(decisionsDir, name);
        const content = readFileSync(abs, 'utf8');
        const stripped = stripIdsFromField(content, 'related_tasks', memberIds);
        if (stripped !== content) adrWrites.push({ path: abs, content: stripped });
      }
    }

    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    newProtocolContent = prependProtocolEntry(protocolFile.content, buildDismissEntryBody(members, now));
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- writes: INDEX -> unlink -> strip -> protocol (Notes: reverses
  // ADR-0022 §4's listed order — a residual failure stays "blocked and
  // visible" rather than "ready and invisible"). ---------------------------
  const changed = [];
  for (const [, plan] of indexPlan) {
    writeNormalizedFile(plan.path, plan.newContent, plan.meta);
    changed.push(plan.path);
  }
  for (const t of members) {
    unlinkSync(t.path);
    changed.push(t.path);
  }
  // agentic-workflow-vhz69: the surviving-backlink rewrites (a survivor task
  // file's `depends_on`/`blocks`, an ADR's `related_tasks`) are whole-file
  // overwrites of pre-existing content, the same corruption class as
  // INDEX.md/protocol.md -- routed through the same atomic primitive.
  for (const w of strippedTaskWrites) {
    writeFileAtomic(w.path, w.content);
    changed.push(w.path);
  }
  for (const w of adrWrites) {
    writeFileAtomic(w.path, w.content);
    changed.push(w.path);
  }
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);
  changed.push(protocolPath);

  const bcs = [...byBc.keys()];
  const setLabel = memberIds.length <= 4 ? memberIds.join(', ') : leadId;
  const message = bcs.length === 1 ? `chore(${bcs[0]}): dismiss ${setLabel}` : `chore: dismiss ${setLabel}`;

  return { ok: true, changed, message, verb: 'dismiss', id: leadId, memberIds };
}

/**
 * Two-phase dismiss. `opts.plan:true` computes the cascade with zero disk
 * writes; `opts.confirm:[...ids]` recomputes the full guarded cascade fresh
 * and, if it still matches `confirm` and nothing moved to `doing/`/`done/`
 * since planning, performs the hard delete + bookkeeping.
 *
 * @param {string} rootDir
 * @param {string} id  the lead task id
 * @param {object} [opts]
 * @param {boolean} [opts.plan]
 * @param {string[]} [opts.confirm]
 * @param {Date} [opts.now]
 */
export function dismissTask(rootDir, id, opts = {}) {
  if (opts.plan) return planDismiss(rootDir, id);
  if (opts.confirm !== undefined) {
    if (!Array.isArray(opts.confirm)) {
      return reject('invalid-confirm', 'dismiss confirm requires opts.confirm to be an array of ids.');
    }
    return confirmDismiss(rootDir, id, opts.confirm, opts);
  }
  return reject('missing-mode', 'dismiss requires opts.plan:true or opts.confirm:[...ids].');
}

// ---------------------------------------------------------------------------
// rerouteTask — cross-BC backlog re-route, minting a new id (agentic-workflow-
// qd24q, ADR-0077, amends ADR-0028 §8).
//
// Legal only `backlog → backlog` — no status change, no single-BC folder-pair
// transition, so this does NOT wrap `applyTaskMove` (ADR-0055's mover). It
// hand-rolls ADR-0055's write-destination-then-unlink-source ordering: write
// the new file (id/context rewritten, `rerouted_from` marker set) first, then
// unlink the old.
//
// Mints a fresh `<to-bc>-<token>` id (`lib/id-grammar.mjs`'s `mintTaskId`) and
// RETIRES the old one, rather than keeping it under the new BC — see this
// task's ADR for the `deriveContext`/`context-mismatch` hazard that forced
// this. `rerouted_from: <old-id>` on the new file is the idempotence marker a
// crash-retry between the two writes scans for (old and new ids differ, so
// ADR-0055's usual same-id duplicate self-heal cannot fire here).
//
// Backlink re-point (never strip) reuses `mapIdsInField`/`renameIdInField`
// above — the same generalization `dismissTask`'s own strip is built on
// (ADR-0068 single-source) — walking every task via `loadAllTasks` and every
// ADR's `related_tasks` the same way `confirmDismissLocked` already does.
// ---------------------------------------------------------------------------

/** Very small, deterministic kebab-case slugifier — mirrors `lib/task-lifecycle.mjs`'s private `slugifyTitle` (not exported there); duplicated here for the same reason every other small helper in this module is. */
function slugifyTitleForReroute(title) {
  const base = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= 60) return base || 'rerouted';
  return base.slice(0, 60).replace(/-+$/, '') || 'rerouted';
}

/** `true` iff `checkId` resolves to a file in ANY of `bc`'s four lifecycle folders. */
function taskIdExistsInBc(rootDir, bc, checkId) {
  return LIFECYCLE_FOLDERS.some((folder) => findTaskFile(rootDir, bc, folder, checkId) !== null);
}

/**
 * Idempotence lookup: scan `toBc`'s `backlog/` for a file whose frontmatter
 * `rerouted_from` names `oldId` — the marker a retry after a partial write
 * scans for, so it completes the pending unlink/bookkeeping instead of
 * minting a second successor.
 */
function findRerouteSuccessor(rootDir, toBc, oldId) {
  const dir = path.join(rootDir, '.agentheim', 'contexts', toBc, 'backlog');
  if (!existsSync(dir)) return null;
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name);
  } catch {
    return null;
  }
  for (const name of names) {
    const abs = path.join(dir, name);
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (parseFrontmatterField(content, 'rerouted_from') === oldId) {
      return { path: abs, id: parseFrontmatterField(content, 'id') || name.replace(/\.md$/i, ''), content };
    }
  }
  return null;
}

/** Rewrite `id:`/`context:` and set `rerouted_from:` in a task body's frontmatter. */
function rewriteRerouteFrontmatter(content, { newId, toBc, oldId }) {
  let next = /^id:\s*.*$/m.test(content) ? content.replace(/^id:\s*.*$/m, `id: ${newId}`) : content;
  if (/^context:\s*.*$/m.test(next)) {
    next = next.replace(/^context:\s*.*$/m, `context: ${toBc}\nrerouted_from: ${oldId}`);
  } else {
    next = next.replace(/^id:\s*.*$/m, `id: ${newId}\ncontext: ${toBc}\nrerouted_from: ${oldId}`);
  }
  return next;
}

/** `true` iff the `backlog-list` marker block already carries a line naming `id` at a word/hyphen boundary. */
function backlogListHasId(indexContent, id) {
  const m = indexContent.match(/<!-- backlog-list:start -->\n([\s\S]*?)<!-- backlog-list:end -->/);
  if (!m) throw new Error('INDEX.md is missing the backlog-list markers.');
  const re = new RegExp(`(?:^|[^A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9_-])`);
  return m[1].split('\n').some((line) => re.test(line));
}

function buildRerouteEntryBody(oldId, newId, title, fromBc, toBc, now) {
  const ts = formatProtocolTimestamp(now);
  return (
    `## ${ts} -- Modeling / Re-routed: ${oldId} → ${newId}\n\n` +
    `**Type:** Modeling / Re-route\n` +
    `**Title:** ${title}\n` +
    `**From → To:** ${fromBc} → ${toBc}`
  );
}

function rerouteTask(rootDir, id, opts = {}) {
  return withLifecycleLock(rootDir, () => rerouteTaskLocked(rootDir, id, opts), opts.lock);
}

/**
 * The actual REROUTE compute-then-write body, run while `rerouteTask` holds
 * the one project-wide lifecycle lock — never call this directly.
 */
function rerouteTaskLocked(rootDir, id, opts) {
  const now = opts.now ?? new Date();
  const toBc = opts.to;
  if (!toBc) {
    return reject('missing-to', 'reroute requires opts.to (the target bounded-context name).');
  }
  const fromBc = opts.context ?? deriveContext(id);
  if (toBc === fromBc) {
    return reject('same-bc', `reroute requires a different target BC than "${id}"'s own ("${fromBc}").`);
  }

  const toBcDir = path.join(rootDir, '.agentheim', 'contexts', toBc);
  if (!existsSync(toBcDir)) {
    return reject('unknown-bc', `Target bounded context "${toBc}" has no contexts/${toBc}/ directory.`);
  }

  // --- 1. idempotence lookup + source probe (both read-only, before any
  // mutation). A successor already carrying `rerouted_from: <id>` means a
  // prior call got at least as far as writing the new file. -----------------
  const successor = findRerouteSuccessor(rootDir, toBc, id);
  const sourcePath = findTaskFile(rootDir, fromBc, 'backlog', id);
  if (!sourcePath && !successor) {
    return reject(
      'not-in-backlog',
      `Task ${id} was not found in ${fromBc}/backlog/ — reroute only applies to a backlog task.`
    );
  }

  let newId, newFileName, newFilePath, newFileContent, title, taskType;
  if (successor) {
    newId = successor.id;
    newFilePath = successor.path;
    newFileName = path.basename(successor.path);
    newFileContent = successor.content;
    title = parseFrontmatterField(newFileContent, 'title');
    taskType = parseFrontmatterField(newFileContent, 'type');
  } else {
    const sourceContent = readFileSync(sourcePath, 'utf8');
    title = parseFrontmatterField(sourceContent, 'title');
    taskType = parseFrontmatterField(sourceContent, 'type');
    newId = mintTaskId(toBc);
    let guard = 0;
    while (taskIdExistsInBc(rootDir, toBc, newId) && guard < 25) {
      newId = mintTaskId(toBc);
      guard += 1;
    }
    const slug = slugifyTitleForReroute(title);
    newFileName = `${newId}-${slug}.md`;
    newFilePath = path.join(toBcDir, 'backlog', newFileName);
    newFileContent = rewriteRerouteFrontmatter(sourceContent, { newId, toBc, oldId: id });
  }

  // --- 2. the target BC's missing INDEX.md is backfilled only under
  // captureTask's otherwise-empty rule (reusing its own private helpers,
  // same module) and refused `index-missing` otherwise. ---------------------
  const fromIndexPath = path.join(rootDir, '.agentheim', 'contexts', fromBc, 'INDEX.md');
  const toIndexPath = path.join(toBcDir, 'INDEX.md');
  if (!existsSync(toIndexPath) && !bcHasOnlyThisFile(rootDir, toBc, newFilePath)) {
    return reject(
      'index-missing',
      `${toBc}'s INDEX.md is missing, and its lifecycle folders hold more than just the re-routed task — refusing to backfill a fresh template over real pre-existing tasks.`
    );
  }

  // --- 3. compute the full new content for both INDEX.md files, every
  // touched backlink file, and the one protocol entry, PURELY (ADR-0054): a
  // throw here is caught and returned as a structured rejection with nothing
  // moved and nothing written. ----------------------------------------------
  let fromIndexFileMeta, toIndexFile, newFromIndexContent, newToIndexContent, protocolFile, newProtocolContent;
  const backlinkWrites = [];
  const adrWrites = [];
  try {
    fromIndexFileMeta = readNormalizedFile(fromIndexPath);
    const { content: afterRemove, removed } = removeIndexLineStrict(fromIndexFileMeta.content, 'backlog-list', id);
    newFromIndexContent = adjustIndexCount(afterRemove, 'Backlog', -removed);

    toIndexFile = existsSync(toIndexPath) ? readNormalizedFile(toIndexPath) : { content: renderIndexTemplate(toBc), eol: '\n', bom: false };
    const line = `- **${newId}** — ${title} (${taskType}) — \`backlog/${newFileName}\``;
    if (backlogListHasId(toIndexFile.content, newId)) {
      newToIndexContent = toIndexFile.content; // already inserted by a prior partial run
    } else {
      newToIndexContent = adjustIndexCount(insertIndexLineAtTop(toIndexFile.content, 'backlog-list', line), 'Backlog', 1);
    }

    const allTasks = loadAllTasks(rootDir);
    for (const t of allTasks) {
      if (t.id === id || t.id === newId) continue;
      const taskContent = readFileSync(t.path, 'utf8');
      const renamed = renameIdInTask(taskContent, id, newId);
      if (renamed !== taskContent) backlinkWrites.push({ path: t.path, content: renamed });
    }

    const decisionsDir = path.join(rootDir, '.agentheim', 'knowledge', 'decisions');
    if (existsSync(decisionsDir)) {
      let names = [];
      try {
        names = readdirSync(decisionsDir).filter((n) => n.toLowerCase().endsWith('.md'));
      } catch {
        names = [];
      }
      for (const name of names) {
        const abs = path.join(decisionsDir, name);
        const content = readFileSync(abs, 'utf8');
        const renamed = renameIdInField(content, 'related_tasks', id, newId);
        if (renamed !== content) adrWrites.push({ path: abs, content: renamed });
      }
    }

    const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    newProtocolContent = prependProtocolEntry(protocolFile.content, buildRerouteEntryBody(id, newId, title, fromBc, toBc, now));
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- 4. writes: new file -> unlink old (ADR-0055 ordering, hand-rolled —
  // this transition never wraps applyTaskMove) -> both INDEX.md files ->
  // backlink rewrites -> ADR rewrites -> protocol. ---------------------------
  if (!successor) {
    mkdirSync(path.dirname(newFilePath), { recursive: true });
    writeFileAtomic(newFilePath, newFileContent);
  }
  if (sourcePath) {
    unlinkSync(sourcePath);
  }
  writeNormalizedFile(fromIndexPath, newFromIndexContent, fromIndexFileMeta);
  mkdirSync(path.dirname(toIndexPath), { recursive: true });
  writeNormalizedFile(toIndexPath, newToIndexContent, toIndexFile);
  for (const w of backlinkWrites) {
    writeFileAtomic(w.path, w.content);
  }
  for (const w of adrWrites) {
    writeFileAtomic(w.path, w.content);
  }
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);

  const message = `chore(${toBc}): re-route ${id} → ${newId} [${newId}]`;

  return {
    ok: true,
    changed: [
      newFilePath,
      ...(sourcePath ? [sourcePath] : []),
      fromIndexPath,
      toIndexPath,
      protocolPath,
      ...backlinkWrites.map((w) => w.path),
      ...adrWrites.map((w) => w.path),
    ],
    message,
    verb: 'reroute',
    id,
    newId,
  };
}

export { rerouteTask };
