// Deterministic helpers for the vacuum guard and the session-end batch-mix
// line (agentic-workflow-qz1h7 — Dorc July-2026 review recommendation A2).
// See skills/work/SKILL.md's "Vacuum guard" section, skills/modeling/
// SKILL.md's Opening flow step 2, and ADR-0064 for the mechanism these
// implement.
//
// WHY THIS EXISTS
// An empty ready set / backlog is a *user decision waiting*, not agent fuel.
// Left unguarded, a session with nothing refined to work on drifts toward
// self-generated harness/bookkeeping filler instead of surfacing the actual
// blocker: an open question in vision.md the builder hasn't decided yet.
// What is deterministic — and so belongs here, stdlib-only, unit tested — is
// (1) extracting vision.md's "## Open questions" section, filtering out
// items already marked resolved (struck through), and computing each
// item's age from its `(open since YYYY-MM-DD)` annotation, and (2)
// classifying a session's completed tasks into product-facing / harness /
// bookkeeping and formatting the resulting mix line. Whether to actually
// invoke the guard (is the ready set really empty?) and how to word the
// surfaced recommendation to the builder is judgment left to the calling
// skill's prose.
//
// This module NEVER blocks anything — every export here is pure text
// shaping/classification, never a gate (ADR-0017, vision.md's "Not
// autonomous" non-goal). It is also git-free per ADR-0038: callers hand in
// already-known task metadata (`type`, `files`) rather than this module
// shelling out to git itself.

import { extractSection, labelFor } from './vision-conformance.mjs';

const OPEN_QUESTIONS_HEADING = 'Open questions';
const RESOLVED_MARK_RE = /^~~/;
const SINCE_RE = /\(open since (\d{4}-\d{2}-\d{2})\)/;

/**
 * Extract vision.md's currently-open (unresolved) items from its
 * "## Open questions" section. An item already marked resolved is written
 * `~~**Title.** ...~~ *Resolved YYYY-MM-DD.*` (strikethrough) by existing
 * convention — those are excluded; only items still awaiting a builder
 * decision are returned, each carrying its `since` date when the item text
 * carries the `(open since YYYY-MM-DD)` annotation convention (this task's
 * convention — see ADR-0064), or `null` when the annotation is absent.
 * @param {string} visionText full contents of vision.md
 * @returns {Array<{text: string, since: string|null}>}
 */
export function extractOpenQuestions(visionText) {
  return extractSection(visionText, OPEN_QUESTIONS_HEADING)
    .filter((item) => !RESOLVED_MARK_RE.test(item.trim()))
    .map((item) => {
      const match = item.match(SINCE_RE);
      return { text: item, since: match ? match[1] : null };
    });
}

/**
 * Whole days between an ISO `YYYY-MM-DD` date and `now` (default: the real
 * current time), computed at UTC-midnight granularity so it is stable
 * regardless of time-of-day. Returns `null` for a missing/malformed date
 * rather than throwing — callers render that as "since date not recorded".
 * @param {string|null|undefined} sinceISODate
 * @param {Date} [now]
 * @returns {number|null}
 */
export function ageInDays(sinceISODate, now = new Date()) {
  if (!sinceISODate) return null;
  const since = new Date(`${sinceISODate}T00:00:00Z`);
  if (Number.isNaN(since.getTime())) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - since.getTime()) / 86400000));
}

/**
 * The vacuum guard's own trigger predicate — a named threshold so it has
 * exactly one place to change later, mirroring `worthSurfacing` in
 * vision-conformance.mjs. True only when the ready set is genuinely empty
 * AND at least one vision.md open question is still unresolved.
 * @param {number} readyCount tasks ready to dispatch (work) / backlog size (modeling)
 * @param {Array<object>} openQuestions from `extractOpenQuestions`
 * @returns {boolean}
 */
export function isVacuum(readyCount, openQuestions) {
  return readyCount === 0 && Array.isArray(openQuestions) && openQuestions.length > 0;
}

/**
 * Format the open questions for the builder-facing surface (the `work`
 * vacuum-guard message, or `modeling`'s Opening flow) — one clause per item,
 * naming it (`labelFor`'s bold-phrase convention) and its age.
 * @param {Array<{text: string, since: string|null}>} openQuestions
 * @param {Date} [now]
 * @returns {string} `none — no open vision decisions` when empty
 */
export function formatVacuumGuardLine(openQuestions, now = new Date()) {
  if (!openQuestions || openQuestions.length === 0) {
    return 'none — no open vision decisions';
  }
  return openQuestions
    .map(({ text, since }) => {
      const label = labelFor(text);
      const days = ageInDays(since, now);
      const age = days === null ? 'open — since date not recorded' : `open ${days} day${days === 1 ? '' : 's'}`;
      return `${label} (${age})`;
    })
    .join('; ');
}

// --- Batch-mix classification --------------------------------------------

// Matched as a path *segment*, not an anchored prefix, so this works for
// both repo-relative paths ("lib/vacuum-guard.mjs") and the absolute paths
// worker SUCCESS returns actually carry in `FILE_LIST`
// ("C:\...\lib\vacuum-guard.mjs" or "/…/lib/vacuum-guard.mjs") — either
// slash style, matched anywhere in the path.
const HARNESS_SEGMENT_RE = /[\\/](lib|skills|agents|references|evals)[\\/]/;
const ADR_SEGMENT_RE = /[\\/]\.agentheim[\\/]knowledge[\\/]decisions[\\/]/;
const BOOKKEEPING_SEGMENT_RE =
  /[\\/]\.agentheim[\\/](knowledge[\\/]protocol\.md$|contexts[\\/][^\\/]+[\\/]INDEX\.md$|state[\\/])/;

/**
 * Classify one completed task into the batch-mix's three buckets, by task
 * `type` + the surface its touched files land on (ADR-0064's documented
 * heuristic):
 *
 * 1. `type: chore` whose touched files are *entirely* protocol/INDEX/state
 *    bookkeeping surfaces (rotation, session-end logging) → **bookkeeping**.
 *    A chore that also touches anything else (a cleanup chore editing real
 *    skill/lib/agent files) → **harness**, not bookkeeping — it changed the
 *    machinery, it didn't just log about it.
 * 2. `type: feature` or `type: decision` → **product-facing** — for
 *    Agentheim's own self-hosting repo the "product" *is* the framework's
 *    builder-facing capability, so a shipped feature or a judgment call
 *    that changes that capability counts as product-facing even when its
 *    files live under `skills/`/`lib/` (unlike bucket 1/3's own file-based
 *    checks, this bucket is keyed on `type` alone, deliberately — see
 *    ADR-0064).
 * 3. Everything else (`refactor`, `spike`, or any other type) →
 *    **harness** — internal machinery maintenance that isn't itself new
 *    builder-facing capability and isn't pure bookkeeping either.
 *
 * @param {{type?: string, files?: string[]}} task
 * @returns {'product-facing'|'harness'|'bookkeeping'}
 */
export function classifyTask({ type, files } = {}) {
  const paths = Array.isArray(files) ? files : [];
  if (type === 'chore') {
    const allBookkeeping = paths.length > 0 && paths.every((p) => BOOKKEEPING_SEGMENT_RE.test(p));
    return allBookkeeping ? 'bookkeeping' : 'harness';
  }
  if (type === 'feature' || type === 'decision') return 'product-facing';
  return 'harness';
}

/**
 * Tally a session's completed tasks into the three buckets.
 * @param {Array<{type?: string, files?: string[]}>} tasks
 * @returns {{counts: {'product-facing': number, harness: number, bookkeeping: number}, total: number}}
 */
export function classifyBatch(tasks) {
  const counts = { 'product-facing': 0, harness: 0, bookkeeping: 0 };
  for (const task of tasks || []) {
    counts[classifyTask(task)] += 1;
  }
  return { counts, total: (tasks || []).length };
}

/**
 * Format the session-end protocol entry's batch-mix line. Percentages are
 * rounded independently and are not forced to sum to exactly 100 — this is
 * a legible-at-a-glance advisory, not an audited statistic.
 * @param {Array<{type?: string, files?: string[]}>} tasks
 * @returns {string} `none — no tasks completed this session` for an empty batch
 */
export function formatBatchMixLine(tasks) {
  const { counts, total } = classifyBatch(tasks);
  if (total === 0) return 'none — no tasks completed this session';
  const pct = (n) => Math.round((n / total) * 100);
  const taskWord = total === 1 ? 'task' : 'tasks';
  return `${pct(counts['product-facing'])}% product-facing / ${pct(counts.harness)}% harness / ${pct(counts.bookkeeping)}% bookkeeping (${total} ${taskWord})`;
}
