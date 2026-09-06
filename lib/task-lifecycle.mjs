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

import { existsSync, statSync, readFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

import { classifyTaskId } from './id-grammar.mjs';
import { withLifecycleLock } from './lifecycle-lock.mjs';
import { writeFileAtomic } from './atomic-write.mjs';

/** The four lifecycle folders, in forward order. */
export const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/**
 * Legal move sets, keyed by policy.
 * - `ui`     — a restricted Promote-only set (`backlog→todo`). Originally the
 *              dashboard's drag surface; the dashboard write path was removed in
 *              ADR-0017, so this set is now wired to no caller and kept only as the
 *              generic restricted policy (and the default).
 * - `skill`  — the fuller set the skills drive: forward steps only
 *              (Promote, Claim, Complete). **Backward moves and skips remain
 *              illegal under `skill` specifically** — that forward-only property
 *              is real and shared by its three callers (`promoteTask`/
 *              `claimBatch`/`completeTask`); it is NOT a project-wide rule every
 *              policy inherits (see `bounce` below).
 * - `bounce` — a dedicated, separate policy key (agentic-workflow-qd24q,
 *              ADR-0077): exactly `{'doing->backlog'}`, the one backward move
 *              `bounceTask` performs. Deliberately its OWN key rather than an
 *              addition to `skill`'s set — widening `skill` would silently
 *              change what every one of its three existing callers' forward-only
 *              invariant means, for a move none of them ever intends to make.
 */
const LEGAL_MOVES = {
  ui: new Set(['backlog->todo']),
  skill: new Set(['backlog->todo', 'todo->doing', 'doing->done']),
  bounce: new Set(['doing->backlog']),
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
 * Read-only precondition probe (ADR-0038; ADR-0054's compute-then-write rule):
 * resolve whether `id` actually sits in `from` inside `context`, distinguishing
 * "moved elsewhere already" (`stale-precondition`) from "never existed"
 * (`not-found`) — the exact distinction `applyTaskMove` used to compute
 * inline. This is now the ONE implementation both `applyTaskMove` (its own
 * move precondition) and the mechanized verbs' compute phase
 * (`promoteTask`/`completeTask`, synthesizing a source-missing rejection
 * BEFORE any move) call — a second copy of this check would drift, which is
 * exactly the failure mode ADR-0054 removes elsewhere in this module.
 *
 * @returns {{ok:true,fromPath:string}|{ok:false,code:string,reason:string}}
 */
function resolveSourceOrReject(rootDir, context, from, id) {
  const fromPath = resolveTaskFile(rootDir, context, from, id);
  if (fromPath) return { ok: true, fromPath };
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
 * @param {'ui'|'skill'|'bounce'} [options.policy]   Legal-move set to enforce.
 *                                          Default `ui` (the dashboard's
 *                                          Promote-only surface).
 * @param {number} [options.expectedMtimeMs] Optimistic mtime precondition; if the
 *                                          file's current mtime differs, reject.
 * @param {(content:string)=>string} [options.transformBody] Optional hook
 *   (agentic-workflow-qd24q, ADR-0077): applied to the already-read source
 *   content immediately BEFORE `rewriteStatus`, so its output is published by
 *   this function's one existing write-destination-then-unlink-source step
 *   (ADR-0055 ordering unchanged) — never a second write. Every caller other
 *   than `bounceTask` passes nothing and stays byte-identical. This is how
 *   `bounceTask`'s `## Worker note` rides the mover's single write: the
 *   rejected alternative (call the mover unmodified, then a second
 *   `writeFileAtomic` of the note after the move) is not retriable — a retry
 *   after "moved but note failed" would hit this verb's own `illegal-move`
 *   precondition (the task is no longer in `doing/`), silently losing the
 *   worker's `reason` with no recovery path. Writing the note into the source
 *   in place BEFORE the move is ADR-0055's rejected shape (mtime corruption,
 *   non-idempotent append on retry) — this hook sidesteps both by composing
 *   into the one write that already happens.
 * @returns {{ok:true,state:{id,from,to,status,path,fromPath,mtimeMs}}|{ok:false,code:string,reason:string}}
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
  const sourceProbe = resolveSourceOrReject(rootDir, context, from, id);
  if (!sourceProbe.ok) return sourceProbe;
  const fromPath = sourceProbe.fromPath;

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

  // --- 6. Perform the move: status rewrite + write-destination-then-unlink-source
  // (ADR-0055). The source is only ever READ, then unlinked — never rewritten
  // in place. A missing destination lifecycle folder is BACKFILLED
  // (mkdirSync recursive), never rejected: LIFECYCLE_FOLDERS is fixed
  // aggregate vocabulary, so a folder's disk-absence (git tracks no empty
  // directories) only ever means "currently empty," never a domain refusal.
  // Any failure up to and including the destination write leaves the source
  // structurally untouched (unread-from only, mtime intact — a retry's
  // expectedMtimeMs guard still validates) and is reported as a clean
  // {ok:false}: nothing has moved. A failure in the unlink AFTER the
  // destination write already landed cannot be honestly reported as "nothing
  // moved" — a duplicate now exists at both paths, individually satisfying
  // status-matches-folder and self-healing on retry via
  // resolveSourceOrReject's "elsewhere" branch — so it is left as an uncaught
  // throw, the same severity as the write-source-then-rename shape's old
  // renameSync throw.
  const bodyForRewrite =
    typeof options.transformBody === 'function' ? options.transformBody(content) : content;
  const rewritten = rewriteStatus(bodyForRewrite, to);
  // Preserve the on-disk filename (the `<id>-<slug>.md` convention) across the
  // move — only the folder changes. The id is stable; the slug rides along.
  const toDir = folderDir(rootDir, context, to);
  const toPath = path.join(toDir, path.basename(fromPath));

  try {
    mkdirSync(toDir, { recursive: true });
    // agentic-workflow-vhz69: the destination write drops in cleanly through
    // the atomic write-temp-then-rename primitive -- same directory
    // (toDir, already backfilled above), same "write a whole file" shape.
    // This also hardens the self-healing duplicate path ADR-0055 documents
    // (a retry that finds a stale duplicate already at toPath overwrites it
    // atomically rather than truncating it in place).
    writeFileAtomic(toPath, rewritten);
  } catch (err) {
    return reject(
      'write-failed',
      `Could not write task ${id}'s moved file into ${to}/: ${err.message}`
    );
  }
  unlinkSync(fromPath);

  return {
    ok: true,
    state: {
      id,
      from,
      to,
      status: to,
      path: toPath,
      // The pre-move path (ADR-0038 manifest fix, infrastructure-h8k2m): callers
      // that build a `changed` manifest for a scoped `git add` need BOTH paths of
      // the rename — the destination this move created AND the source it
      // vacated — so the caller's `git add` stages the deletion too, not just
      // the new file. Without this, a scoped add of only `state.path` leaves a
      // stale duplicate tracked at the old lifecycle folder.
      fromPath,
      mtimeMs: statSync(toPath).mtimeMs,
    },
  };
}

/**
 * Derive the `<bc>` from a bare task id, for BOTH id shapes (ADR-0028 §4, amended
 * by ADR-0044):
 *   - legacy sequential: `<bc>-NNN` (all-digit tail, e.g. `agentic-workflow-077`)
 *   - a 5-char token tail over Crockford base32 minus the look-alikes `i l o u`
 *     (`[0-9a-hjkmnp-tv-z]{5}`), e.g. `agentic-workflow-k3f9q` (well-formed,
 *     leading letter) OR `infrastructure-5w5gs` (out-of-spec, leading digit).
 *
 * The match is END-ANCHORED on the bare id (deriveContext's only caller,
 * `applyTaskMove`, always passes the bare id, never the slugged filename), so a
 * slug is never in scope and `m[1]` is the BC.
 *
 * ADR-0044 loosens the token branch to DROP the leading-letter constraint,
 * keeping only length = 5 and the in-charset requirement — the resolver is now
 * digit-lead-tolerant. This deliberately reverses the `agentic-workflow-078`
 * property that "a digit-leading tail is never a new token": that assumption
 * broke on the real, on-disk, out-of-spec id `infrastructure-5w5gs`, which
 * `deriveContext` must still resolve. Well-formedness (leading-letter) is now a
 * MINTING rule enforced by `lib/id-grammar.mjs`'s stricter `classifyTaskId`, not
 * a resolver precondition — the resolver stays merely shape-validating (length +
 * charset), not shape-agnostic. An out-of-charset tail (`uuuuu`, the excluded
 * look-alike `u`) or a wrong-length tail (6-char `3f9qxz`) still falls through
 * to the `m ? m[1] : id` fallback and returns the id unchanged — never
 * undefined.
 */
export function deriveContext(id) {
  const m = String(id).match(/^(.*)-(?:\d+|[0-9a-hjkmnp-tv-z]{5})$/);
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
//
// Atomicity (ADR-0054): COMPUTE-THEN-WRITE, not the dry-run marker mirror this
// superseded. The full new INDEX.md + protocol.md content is computed PURELY
// (no disk writes) before `applyTaskMove` runs; a throw during that compute is
// caught and returned as `{ok:false, code:'bookkeeping-marker-mismatch',
// reason}` with nothing moved and nothing written. `applyTaskMove` is the only
// disk mutation, and it is the LAST mutation before the two
// `writeNormalizedFile` calls.
// ---------------------------------------------------------------------------

const DEFAULT_PROTOCOL_HEADER =
  '# Protocol\n\nChronological log of everything that happens in this project.\nNewest entries on top.\n\n---\n\n';

/** Read one frontmatter field's raw value (no YAML parser — matches the rest of this module). */
function parseFrontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------------------
// EOL/BOM boundary normalization (infrastructure-5w5gs).
//
// Windows `.agentheim` checkouts routinely carry CRLF `INDEX.md`/`protocol.md`
// (git's `core.autocrlf`, most editors), and Mediatheca's `INDEX.md` additionally
// carries a leading UTF-8 BOM. `removeIndexLine`/`insertIndexLineAtTop`/
// `prependProtocolEntry` below assume `\n` — their marker regexes/`indexOf`
// silently fail to match CRLF, and they INSERT freshly `\n`-built content (a new
// list line, a new protocol entry), which a `\r?\n`-tolerant regex alone would
// still leave as mixed-EOL.
//
// Fix: normalize at the read/write BOUNDARY, not inside the edit functions.
// `readNormalizedFile`/`readProtocolOrDefault` detect the file's DOMINANT EOL
// (not merely its first EOL, so an already-mixed file — the residue of a prior
// half-broken run — restores cleanly to one style) and a leading BOM, strip
// both to a canonical `\n` in-memory form, and hand that to the unchanged
// marker logic below. `writeNormalizedFile` restores the original EOL/BOM on
// write, converting the freshly-inserted content to the file's style too.
// ---------------------------------------------------------------------------

const BOM = '﻿';

/** Count `\r\n` vs lone `\n` and return whichever is the majority style. Ties favor `\n`. */
export function detectDominantEol(text) {
  const crlfCount = (text.match(/\r\n/g) ?? []).length;
  const totalLf = (text.match(/\n/g) ?? []).length;
  const lfOnlyCount = totalLf - crlfCount;
  return crlfCount > lfOnlyCount ? '\r\n' : '\n';
}

/**
 * Strip a leading UTF-8 BOM and canonicalize all line endings to `\n`. Returns
 * the dominant EOL and whether a BOM was present, so the write side can
 * restore both.
 */
export function normalizeText(raw) {
  const bom = raw.startsWith(BOM);
  const stripped = bom ? raw.slice(BOM.length) : raw;
  const eol = detectDominantEol(stripped);
  const content = stripped.replace(/\r\n/g, '\n');
  return { content, eol, bom };
}

/** Inverse of `normalizeText`: restore the original EOL style and BOM before writing. */
export function denormalizeText({ content, eol, bom }) {
  const restored = eol === '\n' ? content : content.replace(/\n/g, eol);
  return bom ? BOM + restored : restored;
}

/**
 * Read a file, returning its canonicalized `\n` content plus its original
 * EOL/BOM. Exported (agentic-workflow-vhz69) so
 * `lib/task-lifecycle-capture-dismiss.mjs` imports this implementation
 * instead of carrying its own duplicate now that pt0gy has landed and no
 * concurrent worktree is editing this module (ADR-0073's "Why a separate
 * module" section named this fold as the re-examination trigger).
 */
export function readNormalizedFile(filePath) {
  return normalizeText(readFileSync(filePath, 'utf8'));
}

/**
 * Write canonical `\n` content back out, restoring the EOL/BOM captured at
 * read time, via the write-temp-then-rename atomic primitive
 * (`lib/atomic-write.mjs`, agentic-workflow-vhz69) -- the primitive takes
 * already-denormalized bytes. Exported for the same reason as
 * `readNormalizedFile` above.
 */
export function writeNormalizedFile(filePath, content, meta) {
  writeFileAtomic(filePath, denormalizeText({ content, eol: meta.eol, bom: meta.bom }));
}

/**
 * Same as `readNormalizedFile`, but defaults to the LF, no-BOM
 * `DEFAULT_PROTOCOL_HEADER` when the file doesn't exist yet (a brand-new
 * project) — mirrors the try/catch every verb used to do inline.
 */
function readProtocolOrDefault(protocolPath) {
  try {
    return readNormalizedFile(protocolPath);
  } catch {
    return { content: DEFAULT_PROTOCOL_HEADER, eol: '\n', bom: false };
  }
}

/** Remove the line naming `id` (`**<id>**`) from a `<!-- <section>:start/end -->` marker block. */
export function removeIndexLine(content, section, id) {
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
export function insertIndexLineAtTop(content, section, line) {
  const marker = `<!-- ${section}:start -->\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error(`INDEX.md is missing the ${section} start marker.`);
  const at = idx + marker.length;
  return content.slice(0, at) + line + '\n' + content.slice(at);
}

/**
 * Add `delta` to the `**<Label>:** N` count line, scoped to the
 * `<!-- task-counts:start/end -->` block (mirroring `removeIndexLine`'s block
 * capture) so an identically-labeled line elsewhere in the file — e.g. in a
 * header or example — is never the one edited. Throws (fail-closed; caught by
 * the verbs' compute phase per ADR-0054) when: the `task-counts` block itself
 * is missing; the label's line is missing or non-numeric INSIDE that block; or
 * applying `delta` would take the count below zero — a below-zero result means
 * the INDEX is already desynced from disk, so this rejects rather than
 * silently corrupting it further (e.g. writing `-1`, which then makes the
 * label's own regex unmatchable for every subsequent mutation).
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
export function prependProtocolEntry(content, entryBody) {
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
  return withLifecycleLock(rootDir, () => promoteTaskLocked(rootDir, id, opts), opts.lock);
}

/**
 * The actual PROMOTE compute-then-write body, run while `promoteTask` holds
 * the one project-wide lifecycle lock (agentic-workflow-pt0gy) — never call
 * this directly.
 */
function promoteTaskLocked(rootDir, id, opts) {
  const context = opts.context ?? deriveContext(id);
  const now = opts.now ?? new Date();

  const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');

  // --- 1. resolve the source (read-only, no mutation); read title/type/
  // fileName from it. A source-missing rejection is SYNTHESIZED from the
  // shared probe, never derived by speculatively invoking applyTaskMove. ---
  const sourceProbe = resolveSourceOrReject(rootDir, context, 'backlog', id);
  if (!sourceProbe.ok) return sourceProbe;
  const sourceContent = readFileSync(sourceProbe.fromPath, 'utf8');
  const title = parseFrontmatterField(sourceContent, 'title');
  const type = parseFrontmatterField(sourceContent, 'type');
  const fileName = path.basename(sourceProbe.fromPath);

  // --- 2. compute the full new INDEX.md + protocol.md content, PURELY (ADR-0054):
  // a throw here is caught and returned as a structured rejection with nothing
  // moved and nothing written. ---
  let indexFile, protocolFile, newIndexContent, newProtocolContent;
  try {
    indexFile = readNormalizedFile(indexPath);
    let indexContent = indexFile.content;
    indexContent = removeIndexLine(indexContent, 'backlog-list', id);
    indexContent = insertIndexLineAtTop(
      indexContent,
      'todo-list',
      `- **${id}** — ${title} (${type}) — \`todo/${fileName}\``
    );
    indexContent = adjustIndexCount(indexContent, 'Backlog', -1);
    indexContent = adjustIndexCount(indexContent, 'Todo', 1);
    newIndexContent = indexContent;

    // Hoisted here (ADR-0054): a broken knowledge/ dir rejects BEFORE anything
    // moves, rather than throwing after the move already happened.
    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    const entryBody =
      `## ${formatProtocolTimestamp(now)} -- Modeling / Promoted: ${id} - ${title}\n\n` +
      `**Type:** Modeling / Promote\n` +
      `**BC:** ${context}\n` +
      `**From → To:** backlog → todo`;
    newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- 3. the move — the first and only disk mutation, and the last mutation
  // before the writes. ---
  const moveResult = applyTaskMove(rootDir, id, 'backlog', 'todo', { context, policy: 'skill' });
  if (!moveResult.ok) return moveResult;

  // --- 4. writes ---
  writeNormalizedFile(indexPath, newIndexContent, indexFile);
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);

  // --- backlink reconciliation: no-op for PROMOTE (see doc comment above) ---

  const message = `model(${context}): promote ${id} — ${title} [${id}]`;

  return {
    ok: true,
    // `fromPath` (the vacated backlog/ path) is listed alongside the new
    // taskPath so the caller's scoped `git add` stages BOTH halves of the
    // rename — see the `applyTaskMove` doc comment on `state.fromPath`.
    changed: [moveResult.state.fromPath, moveResult.state.path, indexPath, protocolPath],
    message,
    verb: 'promote',
    id,
  };
}

// ---------------------------------------------------------------------------
// bounceTask — the git-free BOUNCE lifecycle script (agentic-workflow-qd24q,
// ADR-0077). The `doing → backlog` half of "one class of writer per
// bookkeeping file" `work`'s BOUNCE integration used to hand-write.
//
// Mirrors promoteTask's shape exactly: a read-only source probe, a PURE
// compute of the full new INDEX.md + protocol.md content (ADR-0054), then the
// one `applyTaskMove` mutation (this time under the dedicated `bounce` policy
// key, §LEGAL_MOVES above), then the writes. The one addition over promoteTask
// is `options.transformBody`: the caller-supplied `reason` becomes a
// `## Worker note` section appended to the task body, published by
// `applyTaskMove`'s own destination write — never a second write (see the
// `transformBody` doc comment above `applyTaskMove` for the two rejected
// alternatives).
//
// INDEX bookkeeping uses the ADR-0073 strict-removal variant (report how many
// `doing-list` lines were ACTUALLY removed, rather than assuming exactly one)
// so the `Doing` count delta is always derived from the real edit, matching
// `dismissTask`'s own discipline in `lib/task-lifecycle-capture-dismiss.mjs`.
// ---------------------------------------------------------------------------

/**
 * Strict `removeIndexLine` variant (mirrors `lib/task-lifecycle-capture-
 * dismiss.mjs`'s own, ADR-0073): reports how many lines it actually removed,
 * rather than silently no-oping on a missing line while a caller's
 * count-delta assumption still fires. Private to this module — duplicated
 * rather than imported across the two lifecycle modules, matching their
 * existing "duplicate what isn't exported" convention.
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

/** Append a `## Worker note` section quoting `reason` verbatim, for `applyTaskMove`'s `transformBody` hook. */
function appendWorkerNote(content, reason) {
  const trimmed = content.replace(/\s*$/, '');
  return `${trimmed}\n\n## Worker note\n\n${reason}\n`;
}

/**
 * Bounce a task: move it `doing → backlog` (the `bounce` policy — the ONLY
 * legal move under it), appending a `## Worker note` quoting `opts.reason`
 * verbatim, then perform the INDEX.md marker/count edit and prepend the
 * `Task bounced` protocol entry.
 *
 * @param {string} rootDir
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.context]   Bounded-context name; defaults to `deriveContext(id)`.
 * @param {Date}   [opts.now]       Clock override for the protocol timestamp (tests).
 * @param {string} opts.reason      Required: the worker's BOUNCE `REASON`, verbatim.
 * @returns {{ok:true,changed:string[],message:string,verb:'bounce',id:string}
 *          |{ok:false,code:string,reason:string}}
 */
export function bounceTask(rootDir, id, opts = {}) {
  return withLifecycleLock(rootDir, () => bounceTaskLocked(rootDir, id, opts), opts.lock);
}

/**
 * The actual BOUNCE compute-then-write body, run while `bounceTask` holds the
 * one project-wide lifecycle lock (agentic-workflow-pt0gy) — never call this
 * directly.
 */
function bounceTaskLocked(rootDir, id, opts) {
  const context = opts.context ?? deriveContext(id);
  const now = opts.now ?? new Date();

  const reason = opts.reason;
  if (typeof reason !== 'string' || reason.trim() === '') {
    return reject('missing-reason', 'bounce requires opts.reason (the worker\'s BOUNCE REASON, verbatim).');
  }

  const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');

  // --- 1. resolve the source in doing/ (read-only probe), BEFORE any mutation.
  // A `stale-precondition` from the shared probe (the task is elsewhere, not
  // gone entirely) is remapped to `illegal-move` here: bounce's own domain
  // vocabulary for "this move does not apply to where the task currently
  // sits" — distinct from the race-condition connotation `stale-precondition`
  // carries for the other verbs, which recompute the same source inside the
  // same call. A genuine `not-found` (the task is nowhere) propagates as-is.
  const sourceProbe = resolveSourceOrReject(rootDir, context, 'doing', id);
  if (!sourceProbe.ok) {
    if (sourceProbe.code === 'stale-precondition') {
      return reject(
        'illegal-move',
        `Task ${id} is not in doing/ — bounce only applies to a task currently in doing/. ${sourceProbe.reason}`
      );
    }
    return sourceProbe;
  }
  const sourceContent = readFileSync(sourceProbe.fromPath, 'utf8');
  const title = parseFrontmatterField(sourceContent, 'title');
  const taskType = parseFrontmatterField(sourceContent, 'type');
  const fileName = path.basename(sourceProbe.fromPath);

  // --- 2. compute the full new INDEX.md + protocol.md content, PURELY
  // (ADR-0054): a throw here is caught and returned as a structured rejection
  // with nothing moved and nothing written. ---
  let indexFile, protocolFile, newIndexContent, newProtocolContent;
  try {
    indexFile = readNormalizedFile(indexPath);
    const { content: afterRemove, removed: doingRemoved } = removeIndexLineStrict(indexFile.content, 'doing-list', id);
    let indexContent = insertIndexLineAtTop(
      afterRemove,
      'backlog-list',
      `- **${id}** — ${title} (${taskType}) — \`backlog/${fileName}\``
    );
    indexContent = adjustIndexCount(indexContent, 'Doing', -doingRemoved);
    indexContent = adjustIndexCount(indexContent, 'Backlog', 1);
    newIndexContent = indexContent;

    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    const entryBody =
      `## ${formatProtocolTimestamp(now)} -- Task bounced: ${id} - ${title}\n\n` +
      `**Type:** Work / Task bounced\n` +
      `**BC:** ${context}\n` +
      `**From → To:** doing → backlog\n` +
      `**Reason:** ${reason}`;
    newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- 3. the move — the first and only disk mutation, and the last mutation
  // before the writes. The `## Worker note` rides this one write via
  // `transformBody`, never a second write (see the doc comment on
  // `applyTaskMove`'s `options.transformBody`). ---
  const moveResult = applyTaskMove(rootDir, id, 'doing', 'backlog', {
    context,
    policy: 'bounce',
    transformBody: (content) => appendWorkerNote(content, reason),
  });
  if (!moveResult.ok) return moveResult;

  // TEST-ONLY (agentic-workflow-qd24q): simulate a crash between the move
  // above (which has ALREADY published the `## Worker note` via
  // `transformBody`) and the INDEX/protocol writes below — proves the note
  // never depends on those writes succeeding. Gated on `NODE_TEST_CONTEXT`,
  // exactly like `lib/lifecycle-lock.mjs`'s `holdMs` (agentic-workflow-dpbjj),
  // so a stray opt can never affect a real invocation.
  if (opts.testCrashBeforeIndexWrite && process.env.NODE_TEST_CONTEXT) {
    throw new Error('agentic-workflow-qd24q test-only injected crash before the INDEX write');
  }

  // --- 4. writes ---
  writeNormalizedFile(indexPath, newIndexContent, indexFile);
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);

  const message = `chore(${context}): task bounced — ${title} [${id}]`;

  return {
    ok: true,
    // The new backlog/ path first, then the vacated doing/ path — see the
    // `applyTaskMove` doc comment on `state.fromPath` for why both are staged.
    changed: [moveResult.state.path, moveResult.state.fromPath, indexPath, protocolPath],
    message,
    verb: 'bounce',
    id,
  };
}

// ---------------------------------------------------------------------------
// claimBatch — the git-free, BATCH CLAIM lifecycle script (agentic-workflow-t7m4c,
// ADR-0032, ADR-0038).
//
// Under ADR-0032 the conductor claims a whole ready set at once, in a single
// per-batch commit (the `todo → doing` move rides in that batch-start commit,
// not in each task's eventual squash-merge) — so unlike promoteTask/completeTask
// this handler is BATCH-shaped: it takes a list of ids and returns ONE manifest
// covering every one of them, including a single "Batch started" protocol entry.
//
// A batch may legitimately span more than one bounded context (`work`'s Phase 2
// scans every BC's todo/ at once), so this handler groups its INDEX.md edits per
// BC while still writing exactly one protocol entry and one manifest. The
// resulting commit message drops the `<bc>` token when the batch spans more than
// one context — there is no single BC to attribute a cross-BC commit to.
//
// Fail-loud, no partial rollback: every id is pre-checked to exist in `todo/`
// BEFORE any move happens, so a missing id aborts the whole batch with nothing
// moved. Once the pre-check passes, a later per-id failure (a rare mid-batch
// race — e.g. a concurrent DISMISS pulled the file out from under the batch
// between the pre-check and the move) is surfaced immediately with whichever
// ids already moved this call named in the rejection; those moved ids are NOT
// rolled back. This mirrors applyTaskMove's own philosophy elsewhere in this
// module: fail loud with a structured reason, never silently paper over a
// partial state.
//
// Atomicity (ADR-0054): COMPUTE-THEN-WRITE, not the dry-run marker mirror this
// superseded. Every BC's full new INDEX.md content, and the one shared
// protocol.md entry, are computed PURELY (no disk writes) up front, from the
// pre-move `todo/` files read during the pre-check — a throw during that
// compute is caught and returned as a structured rejection with nothing moved
// and nothing written. The move loop is the LAST step before the writes; the
// documented mid-batch vanish race (above) still applies to that loop, and
// still writes NEITHER file when it fires — the writes only run after every
// id in the batch has moved successfully.
// ---------------------------------------------------------------------------

/**
 * Claim a batch of ready tasks: move each `todo → doing`, then perform the
 * INDEX.md marker/count edits (grouped per BC) and prepend ONE protocol.md
 * "Batch started" entry naming every id.
 *
 * @param {string} rootDir
 * @param {string[]} ids           Task ids to claim, in the order they'll be listed.
 * @param {object} [opts]
 * @param {Object<string,string>} [opts.contexts]  Optional id -> BC override map;
 *   defaults to `deriveContext(id)` per id.
 * @param {Date}   [opts.now]              Clock override for the protocol timestamp (tests).
 * @param {string} [opts.parallel]         Override for the `**Parallel:**` line
 *   (e.g. `"yes (3 workers — ...held to next wave...)"`); defaults to
 *   `yes (N workers)` / `no (1 worker)` from `ids.length`.
 * @param {string} [opts.planningAdvisory] Optional `**Planning advisory:**` line;
 *   omitted entirely when absent (matches `work/SKILL.md`'s Phase 3 step 3).
 * @returns {{ok:true,changed:string[],message:string,verb:'claim',ids:string[]}
 *          |{ok:false,code:string,reason:string,id?:string,claimed?:string[]}}
 */
export function claimBatch(rootDir, ids, opts = {}) {
  return withLifecycleLock(rootDir, () => claimBatchLocked(rootDir, ids, opts), opts.lock);
}

/**
 * The actual batch-CLAIM compute-then-write body, run while `claimBatch`
 * holds the one project-wide lifecycle lock (agentic-workflow-pt0gy) — never
 * call this directly.
 */
function claimBatchLocked(rootDir, ids, opts) {
  const now = opts.now ?? new Date();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return reject('missing-ids', 'claimBatch requires at least one task id.');
  }

  const contextFor = (id) => opts.contexts?.[id] ?? deriveContext(id);

  // --- 1. resolve every source (read-only, no mutation) BEFORE any move; abort
  // the whole batch — nothing moved — if any id doesn't resolve in todo/. ----
  const entries = [];
  const missing = [];
  for (const id of uniqueIds) {
    const context = contextFor(id);
    const fromPath = resolveTaskFile(rootDir, context, 'todo', id);
    if (!fromPath) {
      missing.push(id);
      continue;
    }
    const content = readFileSync(fromPath, 'utf8');
    entries.push({
      id,
      context,
      fromPath,
      title: parseFrontmatterField(content, 'title'),
      type: parseFrontmatterField(content, 'type'),
      fileName: path.basename(fromPath),
    });
  }
  if (missing.length > 0) {
    return reject(
      'not-found',
      `Batch claim aborted, nothing moved: ${missing.join(', ')} not found in todo/ (already claimed elsewhere, or never promoted).`
    );
  }

  const byContext = new Map();
  for (const e of entries) {
    if (!byContext.has(e.context)) byContext.set(e.context, []);
    byContext.get(e.context).push(e);
  }

  // --- 2. compute the full new INDEX.md content per BC + the one shared
  // protocol.md entry, PURELY (ADR-0054): a throw here is caught and returned
  // as a structured rejection with nothing moved and nothing written. -------
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');
  const indexPlan = new Map(); // context -> { path, meta, newContent }
  let protocolFile, newProtocolContent;
  try {
    for (const [context, contextEntries] of byContext) {
      const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
      const indexFile = readNormalizedFile(indexPath);
      let indexContent = indexFile.content;
      for (const e of contextEntries) {
        indexContent = removeIndexLine(indexContent, 'todo-list', e.id);
        indexContent = insertIndexLineAtTop(
          indexContent,
          'doing-list',
          `- **${e.id}** — ${e.title} (${e.type}) — \`doing/${e.fileName}\``
        );
        indexContent = adjustIndexCount(indexContent, 'Todo', -1);
        indexContent = adjustIndexCount(indexContent, 'Doing', 1);
      }
      indexPlan.set(context, { path: indexPath, meta: indexFile, newContent: indexContent });
    }

    // Hoisted here (ADR-0054): a broken knowledge/ dir rejects BEFORE anything
    // moves, rather than throwing after the move already happened.
    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);
    const tasksLine = entries.map((e) => `${e.id} - ${e.title}`).join(', ');
    const parallel = opts.parallel ?? (entries.length > 1 ? `yes (${entries.length} workers)` : 'no (1 worker)');
    let entryBody =
      `## ${formatProtocolTimestamp(now)} -- Batch started: [${entries.map((e) => e.id).join(', ')}]\n\n` +
      `**Type:** Work / Batch start\n` +
      `**Tasks:** ${tasksLine}\n` +
      `**Parallel:** ${parallel}`;
    if (opts.planningAdvisory) {
      entryBody += `\n**Planning advisory:** ${opts.planningAdvisory}`;
    }
    newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- 3. the move loop — the LAST step before the writes. Fail-loud, no
  // partial rollback (see doc comment above): a mid-batch race surfaces the
  // ids already moved this call in `claimed`, and NEITHER file is written
  // below (the writes only run once every id has moved). ---------------------
  const moved = [];
  for (const e of entries) {
    const moveResult = applyTaskMove(rootDir, e.id, 'todo', 'doing', { context: e.context, policy: 'skill' });
    if (!moveResult.ok) {
      return { ...moveResult, id: e.id, claimed: moved.map((m) => m.id) };
    }
    moved.push({ ...e, path: moveResult.state.path });
  }

  // --- 4. writes ---
  const indexPaths = [];
  for (const [context, plan] of indexPlan) {
    writeNormalizedFile(plan.path, plan.newContent, plan.meta);
    indexPaths.push(plan.path);
  }
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);

  // --- commit message: single-BC batches keep the `chore(<bc>): ...` convention;
  // a batch spanning multiple BCs drops the <bc> token — there's no one BC to name.
  const contexts = [...byContext.keys()];
  const trailer = moved.map((m) => `[${m.id}]`).join(' ');
  const message =
    contexts.length === 1 ? `chore(${contexts[0]}): batch start ${trailer}` : `chore: batch start ${trailer}`;

  return {
    ok: true,
    // Each moved task contributes BOTH its vacated `todo/` source path and its
    // new `doing/` destination path, so the caller's scoped `git add` of
    // `changed` stages the rename atomically instead of leaving a stale
    // duplicate at the source path (infrastructure-h8k2m).
    changed: [...moved.flatMap((m) => [m.fromPath, m.path]), ...indexPaths, protocolPath],
    message,
    verb: 'claim',
    ids: moved.map((m) => m.id),
  };
}

// ---------------------------------------------------------------------------
// materializeTaskFile — write a NEW backlog task file from a full body
// (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6).
//
// Under the report-carried design, a worker's `BACKLOG_ITEMS` block carries
// COMPLETE follow-up task file bodies (frontmatter + sections), never just
// an id (that was `NEW_BACKLOG_ITEMS`'s old, sufficient-only-because-the-
// worker-wrote-the-file-itself shape). The conductor materializes each body
// onto `main` at squash-merge integration — this is the one function in
// this module that writes a task file that never existed on disk before,
// rather than moving one that already does (every other verb above wraps
// `applyTaskMove`; this one has no move to wrap).
//
// Git-free (ADR-0038 Ruling B): plain fs writes only, never shells out to
// git. Fail-closed on a duplicate id, mirroring the id-grammar's own
// never-renumber/never-reuse invariant (ADR-0028 §5): a `BACKLOG_ITEMS`
// body naming an id already on disk ANYWHERE in the four lifecycle folders
// (a re-dispatched worker re-reporting the same backlog item, or a genuine
// collision) is refused rather than silently overwritten or duplicated.
// ---------------------------------------------------------------------------

/** Very small, deterministic kebab-case slugifier — the id-grammar itself never mandates a slug shape; task filenames elsewhere in this project are agent-chosen prose at minting time. This is this function's own minting rule, not a restatement of any existing convention. */
function slugifyTitle(title) {
  const base = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= 60) return base || 'untitled';
  return base.slice(0, 60).replace(/-+$/, '') || 'untitled';
}

/**
 * Materialize one `BACKLOG_ITEMS` entry's full body as a new file in
 * `contexts/<bc>/backlog/<id>-<slug>.md`, where `<bc>` is `deriveContext(id)`
 * and `<slug>` is mechanically derived from the body's `title:` frontmatter
 * field (`slugifyTitle`, above).
 *
 * @param {string} rootDir Absolute project root (the folder holding `.agentheim/`).
 * @param {string} body    The full task file text — frontmatter (with a
 *   parseable `id:` field whose value passes `classifyTaskId`) through its
 *   `## ` sections — written to disk VERBATIM.
 * @returns {{ok:true, changed:string[], path:string, id:string, context:string}
 *          |{ok:false, code:string, reason:string}}
 */
export function materializeTaskFile(rootDir, body) {
  const id = parseFrontmatterField(body, 'id');
  if (!id) {
    return reject('missing-id', 'materializeTaskFile: the body has no frontmatter `id:` field.');
  }
  if (classifyTaskId(id) === 'malformed') {
    return reject(
      'malformed-id',
      `materializeTaskFile: id "${id}" fails the id grammar (lib/id-grammar.mjs's classifyTaskId) — refusing to mint a non-well-formed id.`
    );
  }

  const context = deriveContext(id);
  for (const folder of LIFECYCLE_FOLDERS) {
    if (resolveTaskFile(rootDir, context, folder, id)) {
      return reject(
        'duplicate-id',
        `materializeTaskFile: id ${id} already exists in ${context}/${folder}/ — refusing to overwrite or duplicate it.`
      );
    }
  }

  const title = parseFrontmatterField(body, 'title');
  const slug = slugifyTitle(title);
  const dir = folderDir(rootDir, context, 'backlog');
  const filePath = path.join(dir, `${id}-${slug}.md`);

  mkdirSync(dir, { recursive: true });
  // agentic-workflow-vhz69: routed through the atomic primitive too -- a
  // crash mid-write here would leave a new task file half-written under
  // backlog/, which is the same "silent corruption other verbs can't
  // detect" failure class as a truncated INDEX.md, even though the
  // duplicate-id guard above means there is no pre-existing content this
  // write could have clobbered.
  writeFileAtomic(filePath, body);

  return { ok: true, changed: [filePath], path: filePath, id, context };
}

// ---------------------------------------------------------------------------
// completeTask — the git-free COMPLETE lifecycle script (agentic-workflow-t7m4c,
// ADR-0032, ADR-0038).
//
// Post-ghcaj (agentic-workflow-ghcaj, amending ADR-0032 §3/§4/§6): the
// worker's branch/worktree never touches `.agentheim/` at all, so the
// `doing → done` move happens HERE, on `main`, at squash-merge integration —
// the first and ordinarily only time the file moves. This handler stays
// IDEMPOTENT w.r.t. an already-moved state for a different reason now: a
// resumed/interrupted session re-running `complete` after a crash. If
// `applyTaskMove`'s `doing → done` attempt rejects `stale-precondition` AND
// the task resolves in `done/` already, that is treated as a no-op move (not
// an error) and bookkeeping proceeds against the file already there. Any
// other rejection (illegal-move, a genuine stale-precondition where the file
// is somewhere else entirely, not-found) propagates untouched, exactly like
// promoteTask.
//
// Single-task shape (mirrors promoteTask, unlike claimBatch): the ADR-0032
// trivial-squash carve-out (folding several eligible same-BC/same-batch tasks'
// squash-merges into ONE commit) is composed by the CALLER, not built into this
// script — see the design note in the BC README / ADR-0042. The conductor calls
// `completeTask` once per task in the carve-out set and folds the resulting
// manifests' `changed` paths into one `git add` + one commit carrying every
// task's `[<id>]` trailer.
//
// Atomicity (ADR-0054): COMPUTE-THEN-WRITE, not the dry-run marker mirror this
// superseded. The source is resolved doing/, else done/ (idempotent) — a
// read-only step, before any move — and the full new INDEX.md + protocol.md
// content is computed PURELY from it; a throw during that compute is caught
// and returned as a structured rejection with nothing moved and nothing
// written. On the normal (non-idempotent) path, `applyTaskMove` is the only
// disk mutation and the last one before the writes; on the idempotent path
// there is no move at all, so the writes are the ONLY mutation.
// ---------------------------------------------------------------------------

/**
 * Complete a task: move it `doing → done` on `main` (idempotent only for a
 * resumed/interrupted session's re-run after a crash — post-ghcaj the worker
 * branch never moves it first), then perform the INDEX.md marker/count edit and
 * prepend the protocol.md completion entry.
 *
 * @param {string} rootDir
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.context]      Bounded-context name; defaults to `deriveContext(id)`.
 * @param {Date}   [opts.now]          Clock override for the protocol timestamp (tests).
 * @param {string} [opts.summary]      Worker's 1-line SUMMARY; falls back to the task title in
 *   the commit message when absent.
 * @param {string} [opts.duration]     Wall time from dispatch to verdict (e.g. `4m12s`).
 * @param {boolean} [opts.skipped]     True for the "verification skipped" entry variant.
 * @param {string} [opts.skipReason]   Required in spirit when `skipped` is true (defaults to
 *   `unspecified`).
 * @param {string} [opts.verification] The `**Verification:**` line's value for the non-skipped
 *   variant; defaults to `PASS (iteration ${opts.iteration ?? 1})`.
 * @param {number} [opts.filesChanged] Defaults to 0.
 * @param {number} [opts.testsAdded]   Defaults to 0 (non-skipped variant only).
 * @param {string} [opts.adrsWritten]  Defaults to `"none"` (non-skipped variant only).
 * @returns {{ok:true,changed:string[],message:string,verb:'complete',id:string,idempotent:boolean}
 *          |{ok:false,code:string,reason:string}}
 */
export function completeTask(rootDir, id, opts = {}) {
  return withLifecycleLock(rootDir, () => completeTaskLocked(rootDir, id, opts), opts.lock);
}

/**
 * The actual COMPLETE compute-then-write body, run while `completeTask` holds
 * the one project-wide lifecycle lock (agentic-workflow-pt0gy) — never call
 * this directly.
 */
function completeTaskLocked(rootDir, id, opts) {
  const context = opts.context ?? deriveContext(id);
  const now = opts.now ?? new Date();

  const indexPath = path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  const protocolPath = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');

  // --- 1. resolve the source: doing/, else done/ (idempotent) — read-only, no
  // mutation, before any move. A source-missing rejection (the file is
  // nowhere, or genuinely elsewhere, e.g. todo/) is SYNTHESIZED from the
  // shared probe, never derived by speculatively invoking applyTaskMove. ---
  const doingPath = resolveTaskFile(rootDir, context, 'doing', id);
  const donePath = doingPath ? null : resolveTaskFile(rootDir, context, 'done', id);
  const idempotent = !doingPath && !!donePath;
  let sourcePath;
  if (doingPath) {
    sourcePath = doingPath;
  } else if (donePath) {
    sourcePath = donePath;
  } else {
    // Neither doing/ nor done/ has it — the shared probe distinguishes a
    // genuine stale-precondition (elsewhere, e.g. todo/) from not-found.
    return resolveSourceOrReject(rootDir, context, 'doing', id);
  }
  const sourceContent = readFileSync(sourcePath, 'utf8');
  const title = parseFrontmatterField(sourceContent, 'title');
  const taskType = parseFrontmatterField(sourceContent, 'type') || 'chore';
  const fileName = path.basename(sourcePath);

  const hasSummary = opts.summary !== undefined && opts.summary !== null && opts.summary !== '';
  const summary = hasSummary ? opts.summary : '(no summary provided)';
  const duration = opts.duration ?? '(unknown)';
  const filesChanged = opts.filesChanged ?? 0;

  // --- 2. compute the full new INDEX.md + protocol.md content, PURELY
  // (ADR-0054): a throw here is caught and returned as a structured rejection
  // with nothing moved and nothing written. ---
  let indexFile, protocolFile, newIndexContent, newProtocolContent;
  try {
    indexFile = readNormalizedFile(indexPath);
    let indexContent = indexFile.content;
    indexContent = removeIndexLine(indexContent, 'doing-list', id);
    indexContent = insertIndexLineAtTop(
      indexContent,
      'done-list',
      `- **${id}** — ${title} (${taskType}) — \`done/${fileName}\``
    );
    indexContent = adjustIndexCount(indexContent, 'Doing', -1);
    indexContent = adjustIndexCount(indexContent, 'Done', 1);
    newIndexContent = indexContent;

    // Hoisted here (ADR-0054): a broken knowledge/ dir rejects BEFORE anything
    // moves, rather than throwing after the move already happened.
    mkdirSync(path.dirname(protocolPath), { recursive: true });
    protocolFile = readProtocolOrDefault(protocolPath);

    let entryBody;
    if (opts.skipped) {
      const reason = opts.skipReason ?? 'unspecified';
      entryBody =
        `## ${formatProtocolTimestamp(now)} -- Task completed (verification skipped): ${id} - ${title}\n\n` +
        `**Type:** Work / Task completion\n` +
        `**Task:** ${id} - ${title}\n` +
        `**Summary:** ${summary}\n` +
        `**Duration:** ${duration}\n` +
        `**Verification:** SKIPPED — ${reason}\n` +
        `**Files changed:** ${filesChanged}`;
    } else {
      const verification = opts.verification ?? `PASS (iteration ${opts.iteration ?? 1})`;
      const testsAdded = opts.testsAdded ?? 0;
      const adrsWritten = opts.adrsWritten ?? 'none';
      entryBody =
        `## ${formatProtocolTimestamp(now)} -- Task verified and completed: ${id} - ${title}\n\n` +
        `**Type:** Work / Task completion\n` +
        `**Task:** ${id} - ${title}\n` +
        `**Summary:** ${summary}\n` +
        `**Duration:** ${duration}\n` +
        `**Verification:** ${verification}\n` +
        `**Files changed:** ${filesChanged}\n` +
        `**Tests added:** ${testsAdded}\n` +
        `**ADRs written:** ${adrsWritten}`;
    }
    newProtocolContent = prependProtocolEntry(protocolFile.content, entryBody);
  } catch (err) {
    return reject('bookkeeping-marker-mismatch', err.message);
  }

  // --- 3. the move — skipped entirely on the idempotent path (the worker's
  // worktree already performed it; there is nothing left to move in THIS
  // working tree). Otherwise the only disk mutation, and the last one before
  // the writes. ---
  let finalPath = sourcePath;
  let fromPathForManifest;
  if (!idempotent) {
    const moveResult = applyTaskMove(rootDir, id, 'doing', 'done', { context, policy: 'skill' });
    if (!moveResult.ok) return moveResult; // genuine race: propagate untouched, nothing written
    finalPath = moveResult.state.path;
    fromPathForManifest = moveResult.state.fromPath;
  }

  // --- 4. writes ---
  writeNormalizedFile(indexPath, newIndexContent, indexFile);
  writeNormalizedFile(protocolPath, newProtocolContent, protocolFile);

  const message = `${taskType}(${context}): ${hasSummary ? summary : title} [${id}]`;

  // The idempotent path never vacated a `doing/` path in THIS working tree (a
  // prior squash-merge already did), so `fromPath` is absent and must not be
  // added to `changed` — nothing to stage there (see the `applyTaskMove` doc
  // comment on `state.fromPath`).
  const changed = idempotent
    ? [finalPath, indexPath, protocolPath]
    : [fromPathForManifest, finalPath, indexPath, protocolPath];

  return {
    ok: true,
    changed,
    message,
    verb: 'complete',
    id,
    idempotent,
  };
}
