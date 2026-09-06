// The one path module for the two-root `.agentheim/` layout (ADR-0078).
//
// Before this module, `path.join(rootDir, '.agentheim', 'contexts', context,
// folder)` (and its `knowledge`/`protocol` siblings) was repeated per verb
// across nine `lib/` modules. ADR-0078 moves every lifecycle folder, the
// task-half INDEX, and the protocol under `.agentheim/board/`, and every BC
// README plus the knowledge-half INDEX under `.agentheim/knowledge/contexts/
// <bc>/`. This module centralizes every one of those joins so the move is a
// one-place change, not a hundred-place hunt.
//
// TRANSITION WINDOW (this task, agentic-workflow-cj54k): every getter below
// resolves correctly against WHICHEVER layout is actually on disk — 'legacy'
// (today's `.agentheim/contexts/` tree) or 'board' (ADR-0078's target tree).
// Only 'mixed' (both present, or an ambiguous vision.md split) is refused.
// After the dogfood migration (agentic-workflow-tgr31), a later task hardens
// every consumer except `migrate` itself to refuse 'legacy' too — that
// hardening is explicitly OUT of scope here.
//
// STRUCTURED-ERROR CONVENTION (documented once, applied uniformly): every
// getter and enumerator, on a 'mixed' layout, THROWS an `Error` carrying a
// `.code === 'mixed-layout'` property (plus `.layout` and the function name
// in the message) — never a guess, never an empty result. Callers that want
// to surface this as a structured `{ok:false, ...}` rejection catch it and
// re-shape it themselves (see e.g. `task-lifecycle.mjs`'s compute-then-write
// try/catch), matching the existing "a throw here is caught and returned as
// a structured rejection" idiom already used for other pure-compute steps.
//
// Node stdlib only (node:fs, node:path) — zero dependencies, matching the
// dashboard runtime's constraint (this module is NOT imported by the
// dashboard yet; agentic-workflow-hxq1g introduces that edge and records it).

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Detect which of the two `.agentheim/` layouts `rootDir` is actually using.
 *
 * - `'legacy'` — `.agentheim/contexts/` exists, `.agentheim/board/` does not.
 * - `'board'`  — `.agentheim/board/` exists, `.agentheim/contexts/` does not.
 * - `'mixed'`  — both `contexts/` and `board/` exist, OR a root-level
 *   `.agentheim/vision.md` coexists with `.agentheim/knowledge/vision.md`
 *   (an ambiguous, partially-migrated tree either way).
 * - Neither `contexts/` nor `board/` exists: a completely ABSENT `.agentheim/`
 *   (a fresh project, before its first `brainstorm`) resolves `'board'` —
 *   there is nothing to be legacy ABOUT. An `.agentheim/` that already
 *   exists on disk (even empty, or holding only e.g. `knowledge/
 *   protocol.md`) but simply hasn't populated `contexts/`/`board/` yet is
 *   presumed `'legacy'` — the pre-ADR-0078 shape, since `board/` is never
 *   created without its own marker directory.
 *
 * Cheap by design (a handful of `existsSync` calls) — lints and lifecycle
 * verbs call this once per invocation; memoization is deliberately not done.
 */
export function detectLayout(rootDir) {
  const agentheimDir = path.join(rootDir, '.agentheim');
  const hasContexts = existsSync(path.join(agentheimDir, 'contexts'));
  const hasBoard = existsSync(path.join(agentheimDir, 'board'));
  const hasRootVision = existsSync(path.join(agentheimDir, 'vision.md'));
  const hasKnowledgeVision = existsSync(path.join(agentheimDir, 'knowledge', 'vision.md'));

  if ((hasContexts && hasBoard) || (hasRootVision && hasKnowledgeVision)) return 'mixed';
  if (hasContexts) return 'legacy';
  if (hasBoard) return 'board';
  return existsSync(agentheimDir) ? 'legacy' : 'board';
}

/** Throw the one structured `'mixed-layout'` error, uniformly, for `fnName`. */
function mixedLayoutError(fnName) {
  const err = new Error(`${fnName}: layout is 'mixed' — refusing to guess which root to resolve.`);
  err.code = 'mixed-layout';
  err.layout = 'mixed';
  throw err;
}

/** Resolve `opts.layout` (override) or fall back to `detectLayout(rootDir)`, throwing on 'mixed'. */
function resolveLayout(rootDir, opts, fnName) {
  const layout = opts.layout ?? detectLayout(rootDir);
  if (layout === 'mixed') mixedLayoutError(fnName);
  return layout;
}

const AGENTHEIM = '.agentheim';

/** A lifecycle folder (`backlog|todo|doing|done`) for `bc`, e.g. its `done/`. */
export function taskFolderPath(rootDir, bc, folder, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'taskFolderPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, folder)
    : path.join(rootDir, AGENTHEIM, 'board', bc, folder);
}

/** The task-half `INDEX.md` (task-counts + the four status lists) for `bc`. */
export function taskIndexPath(rootDir, bc, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'taskIndexPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, 'INDEX.md')
    : path.join(rootDir, AGENTHEIM, 'board', bc, 'INDEX.md');
}

/** The `done-archive/` directory (ADR-0047) for `bc`. */
export function doneArchiveDir(rootDir, bc, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'doneArchiveDir');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, 'done-archive')
    : path.join(rootDir, AGENTHEIM, 'board', bc, 'done-archive');
}

/** The live `protocol.md`. */
export function protocolPath(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'protocolPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'knowledge', 'protocol.md')
    : path.join(rootDir, AGENTHEIM, 'board', 'protocol.md');
}

/** The monthly protocol-archive directory (ADR-0039). */
export function protocolArchiveDir(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'protocolArchiveDir');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'knowledge', 'protocol')
    : path.join(rootDir, AGENTHEIM, 'board', 'protocol');
}

/**
 * The knowledge-half `INDEX.md` (adr-local / research-local / concepts) for
 * `bc`. Under `'legacy'` this is DELIBERATELY the same file as
 * `taskIndexPath` — `index-add` keeps working unchanged until the dogfood
 * migration splits the two halves apart.
 */
export function knowledgeIndexPath(rootDir, bc, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'knowledgeIndexPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, 'INDEX.md')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'contexts', bc, 'INDEX.md');
}

/** The BC's `README.md`. */
export function bcReadmePath(rootDir, bc, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'bcReadmePath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, 'README.md')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'contexts', bc, 'README.md');
}

/** The BC's `concepts/` directory. */
export function bcConceptsDir(rootDir, bc, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'bcConceptsDir');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', bc, 'concepts')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'contexts', bc, 'concepts');
}

/** The project-wide top-level `index.md`. Unchanged across both layouts. */
export function topIndexPath(rootDir, opts = {}) {
  resolveLayout(rootDir, opts, 'topIndexPath');
  return path.join(rootDir, AGENTHEIM, 'knowledge', 'index.md');
}

/** The ADR directory. Unchanged across both layouts (ADR-0078 §7). */
export function decisionsDir(rootDir, opts = {}) {
  resolveLayout(rootDir, opts, 'decisionsDir');
  return path.join(rootDir, AGENTHEIM, 'knowledge', 'decisions');
}

/** The research-report directory. Unchanged across both layouts. */
export function researchDir(rootDir, opts = {}) {
  resolveLayout(rootDir, opts, 'researchDir');
  return path.join(rootDir, AGENTHEIM, 'knowledge', 'research');
}

/** The project `vision.md`. */
export function visionPath(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'visionPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'vision.md')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'vision.md');
}

/** The project `context-map.md`. */
export function contextMapPath(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'contextMapPath');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'context-map.md')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'context-map.md');
}

/**
 * The design-system styleguide source directory (app source; the dashboard
 * build reads it here — that read stays out of scope for THIS task, see
 * agentic-workflow-hxq1g). Hardcoded to the `design-system` BC: it is the
 * only bounded context that owns a styleguide.
 */
export function styleguideDir(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'styleguideDir');
  return layout === 'legacy'
    ? path.join(rootDir, AGENTHEIM, 'contexts', 'design-system', 'styleguide')
    : path.join(rootDir, AGENTHEIM, 'knowledge', 'contexts', 'design-system', 'styleguide');
}

function readSubdirNames(dir, exclude = []) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !exclude.includes(d.name))
    .map((d) => d.name);
}

/**
 * Every bounded context that has a task-system (`board`) presence: the
 * directories directly under the task-half root. Under `'legacy'` this reads
 * `contexts/` (the one shared root); under `'board'` it reads `board/`,
 * excluding the `protocol/` archive directory (a sibling of the BC
 * directories, not a BC itself).
 */
export function listBoardContexts(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'listBoardContexts');
  return layout === 'legacy'
    ? readSubdirNames(path.join(rootDir, AGENTHEIM, 'contexts'))
    : readSubdirNames(path.join(rootDir, AGENTHEIM, 'board'), ['protocol']);
}

/**
 * Every bounded context that has a knowledge presence: the directories
 * directly under the knowledge-half root. Under `'legacy'` this reads
 * `contexts/` (the same shared root `listBoardContexts` reads); under
 * `'board'` it reads `knowledge/contexts/` — the authoritative BC list
 * (ADR-0078 §6).
 */
export function listKnowledgeContexts(rootDir, opts = {}) {
  const layout = resolveLayout(rootDir, opts, 'listKnowledgeContexts');
  return layout === 'legacy'
    ? readSubdirNames(path.join(rootDir, AGENTHEIM, 'contexts'))
    : readSubdirNames(path.join(rootDir, AGENTHEIM, 'knowledge', 'contexts'));
}
