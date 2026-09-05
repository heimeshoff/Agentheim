// Merge-back conflict ladder — pure helpers only (ADR-0072, agentic-workflow-pcwnn).
//
// The ladder itself (reset-and-salvage / clean-worktree / merge-main-into-branch /
// resolve-dispatch / checkpoint-fail-closed / re-verify / escalate) is conductor-executed
// prose in `skills/work/SKILL.md` — every git invocation stays with the conductor, never a
// `lib/` module, never the worker (ADR-0032, ADR-0038's three-layer boundary). This module
// mechanizes only the three things that are pure functions of already-captured text/state:
//
//   1. Turning `git diff --name-only --diff-filter=U` / `git status --porcelain` output into
//      the resolution allow-list, and flagging the fail-closed `AA`-under-decisions/ guard.
//   2. Rendering the resolve-conflict dispatch prompt block from already-gathered facts.
//   3. The one-shot-per-worktree budget arithmetic, kept structurally separate from the
//      ordinary FAIL-iteration counter (a resolve dispatch is not a verifier FAIL).
//
// GIT-FREE BY DESIGN: nothing here shells out to git or touches the filesystem. Every
// function is a pure transform of strings/plain objects already captured by the conductor.

const UNMERGED_STATUS_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

// Matches "knowledge/decisions/" anywhere in a path, so it fires whether the caller hands
// a repo-root-relative path (".agentheim/knowledge/decisions/0072-....md") or a path already
// rooted at ".agentheim/" — the guard cares about the directory, not the exact prefix depth.
const DECISIONS_DIR_RE = /(^|\/)knowledge\/decisions\//;

function assertString(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string, got: ${JSON.stringify(value)}`);
  }
}

function assertNonEmptyString(value, label) {
  assertString(value, label);
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
}

// ---------------------------------------------------------------------------------------
// 1. Unmerged-path parsing → resolution allow-list, AA-under-decisions/ guard, resolved flag
// ---------------------------------------------------------------------------------------

/**
 * Parse `git diff --name-only --diff-filter=U` output into a flat list of paths. This form
 * carries no per-path status code, so `findAdrNumberGuardHits` cannot be evaluated from it
 * alone — use `parsePorcelainStatus`/`unmergedFromPorcelain` when the `AA` guard matters.
 *
 * @param {string} diffNameOnlyOutput
 * @returns {string[]}
 */
export function parseUnmergedPaths(diffNameOnlyOutput) {
  assertString(diffNameOnlyOutput, 'diffNameOnlyOutput');
  return diffNameOnlyOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Parse `git status --porcelain` (v1) output into `{path, code}` entries, where `code` is the
 * two-character XY status (e.g. `"UU"`, `"AA"`, `" M"`, `"??"`). A renamed/copied entry's
 * `"OLD -> NEW"` shape is reduced to `NEW` defensively — a `U`-status entry never carries a
 * rename arrow, but a caller may hand this the whole porcelain stream, not just the unmerged
 * lines.
 *
 * @param {string} porcelainOutput
 * @returns {{path: string, code: string}[]}
 */
export function parsePorcelainStatus(porcelainOutput) {
  assertString(porcelainOutput, 'porcelainOutput');
  const entries = [];
  for (const rawLine of porcelainOutput.split(/\r?\n/)) {
    if (!rawLine) continue;
    const code = rawLine.slice(0, 2);
    const rest = rawLine.slice(3); // index 2 is the separating space
    if (!rest) continue;
    const arrowIdx = rest.indexOf(' -> ');
    const filePath = arrowIdx === -1 ? rest : rest.slice(arrowIdx + 4);
    entries.push({ path: filePath, code });
  }
  return entries;
}

/**
 * Filter `parsePorcelainStatus`'s output down to genuinely unmerged entries (one of git's
 * seven `U`-involving XY codes).
 *
 * @param {string} porcelainOutput
 * @returns {{path: string, code: string}[]}
 */
export function unmergedFromPorcelain(porcelainOutput) {
  return parsePorcelainStatus(porcelainOutput).filter((entry) => UNMERGED_STATUS_CODES.has(entry.code));
}

/**
 * Dedupe + sort a list of paths into the resolution allow-list.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function buildAllowList(paths) {
  if (!Array.isArray(paths)) {
    throw new TypeError(`paths must be an array, got: ${JSON.stringify(paths)}`);
  }
  return [...new Set(paths)].sort();
}

/**
 * The fail-closed guard (rung 3): any `U` path under `knowledge/decisions/` carrying `AA`
 * status (two identical provisional ADR filenames — ADR-0058 numbers with differing slugs
 * never collide, so this should never actually fire; it exists as a guard, not an expected
 * case) must escalate rather than be dispatched to a worker for resolution.
 *
 * @param {{path: string, code: string}[]} entries
 * @returns {{path: string, code: string}[]}
 */
export function findAdrNumberGuardHits(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError(`entries must be an array, got: ${JSON.stringify(entries)}`);
  }
  return entries.filter((entry) => entry && entry.code === 'AA' && DECISIONS_DIR_RE.test(entry.path));
}

/**
 * "Resolved" is reported only when the allow-list is empty.
 *
 * @param {string[]} allowList
 * @returns {boolean}
 */
export function isResolved(allowList) {
  return Array.isArray(allowList) && allowList.length === 0;
}

/**
 * Convenience wrapper over `parseUnmergedPaths` + `buildAllowList` + `isResolved`. Carries no
 * `adrGuardHits` (this input format has no status codes) — always `[]`.
 *
 * @param {string} diffNameOnlyOutput
 * @returns {{allowList: string[], adrGuardHits: [], resolved: boolean}}
 */
export function conflictStateFromNameOnly(diffNameOnlyOutput) {
  const allowList = buildAllowList(parseUnmergedPaths(diffNameOnlyOutput));
  return { allowList, adrGuardHits: [], resolved: isResolved(allowList) };
}

/**
 * Convenience wrapper over `unmergedFromPorcelain` + `buildAllowList` +
 * `findAdrNumberGuardHits` + `isResolved` — the one call a caller needs when it has
 * `git status --porcelain` output and wants the full conflict state.
 *
 * @param {string} porcelainOutput
 * @returns {{allowList: string[], adrGuardHits: {path: string, code: string}[], resolved: boolean}}
 */
export function conflictStateFromPorcelain(porcelainOutput) {
  const entries = unmergedFromPorcelain(porcelainOutput);
  const allowList = buildAllowList(entries.map((entry) => entry.path));
  const adrGuardHits = findAdrNumberGuardHits(entries);
  return { allowList, adrGuardHits, resolved: isResolved(allowList) };
}

// ---------------------------------------------------------------------------------------
// 2. Resolve-conflict dispatch prompt builder
// ---------------------------------------------------------------------------------------

/**
 * Render the resolve-conflict dispatch prompt block — a variant of the Subagent Prompt
 * Template's `## Your task` framing, appended alongside it, never replacing the standard
 * `## Rules — CRITICAL` list. The conductor still performs the `done → doing` revert and
 * appends the `## Merge-conflict note (iteration N)` section to the task file itself
 * (file-system side effects, out of scope for a pure helper); this function only renders the
 * prose block describing the situation to the worker.
 *
 * @param {Object} opts
 * @param {string} opts.taskId
 * @param {string} opts.siblingId
 * @param {string} opts.siblingSummary
 * @param {string} opts.newBaseSha
 * @param {string[]} opts.allowList
 * @param {string} opts.siblingStatScopedToAllowList - the sibling's committed changes to the
 *   allow-list paths, already scoped and formatted by the conductor (e.g. a `--stat`-shaped
 *   summary) — this function treats it as opaque text, never re-derives or re-scopes it.
 * @returns {string}
 */
export function buildResolveDispatchPrompt(opts) {
  const { taskId, siblingId, siblingSummary, newBaseSha, allowList, siblingStatScopedToAllowList } = opts ?? {};
  assertNonEmptyString(taskId, 'taskId');
  assertNonEmptyString(siblingId, 'siblingId');
  assertNonEmptyString(siblingSummary, 'siblingSummary');
  assertNonEmptyString(newBaseSha, 'newBaseSha');
  if (!Array.isArray(allowList) || allowList.length === 0) {
    throw new TypeError(`allowList must be a non-empty array, got: ${JSON.stringify(allowList)}`);
  }
  assertString(siblingStatScopedToAllowList, 'siblingStatScopedToAllowList');

  const allowListBlock = allowList.map((entryPath) => `- ${entryPath}`).join('\n');

  return `## Merge-conflict note — resolve, same task, same worktree, new base

Task: ${taskId}. Your worktree's branch was merged with the updated \`main\` (sibling task
${siblingId} — ${siblingSummary}) and a real conflict surfaced on the allow-list below. New
base: ${newBaseSha}.

**Orientation.** Inside the conflict markers, \`<<<<<<< HEAD\` is *your own* work; the block
after \`=======\` down to \`>>>>>>> main\` is the sibling's work, already integrated into
\`main\`.

**Authority.** You may not undo or weaken the sibling's change — it is already accepted. You
re-express your own intent on top of it. Both intents must survive in the resolved file.

**Scope — resolve only these paths** (the resolution allow-list), plus any test that must
change to keep both intents green:
${allowListBlock}

**Sibling's change to these paths, scoped to the allow-list above:**
${siblingStatScopedToAllowList}

Remove every conflict marker. Run the suite. Return the ordinary strict \`RESULT:\` block with
the resolved files in FILE_LIST — you edit files only; the conductor stages and commits, as
always.`;
}

// ---------------------------------------------------------------------------------------
// 3. Budget arithmetic — one-shot-per-worktree, structurally separate from the FAIL counter
// ---------------------------------------------------------------------------------------

/**
 * @typedef {Object} LadderState
 * @property {boolean} ladderUsedThisWorktree
 */

/**
 * Fresh ladder state for a newly created worktree — the ladder has not fired yet.
 *
 * @returns {LadderState}
 */
export function createLadderState() {
  return { ladderUsedThisWorktree: false };
}

/**
 * A real merge-back conflict was just detected for this worktree (ladder rung 3). Deciding
 * this NEVER touches the FAIL-iteration counter — a resolve dispatch is not a verifier FAIL
 * (mixing the two would fire escalation on the healthiest tasks, e.g. a PASS on iteration 3
 * that then conflicts).
 *
 * @param {LadderState} state
 * @returns {{decision: 'dispatch-resolve'|'escalate', state: LadderState}}
 */
export function onMergeBackConflict(state) {
  if (!state || typeof state.ladderUsedThisWorktree !== 'boolean') {
    throw new TypeError(`state must be a LadderState ({ladderUsedThisWorktree: boolean}), got: ${JSON.stringify(state)}`);
  }
  if (state.ladderUsedThisWorktree) {
    // Second conflict on the same worktree — the one-shot budget is spent. Escalate, no dispatch.
    return { decision: 'escalate', state };
  }
  return { decision: 'dispatch-resolve', state: { ladderUsedThisWorktree: true } };
}

/**
 * The ordinary FAIL-iteration decision — used both for a normal verification round and for a
 * post-resolve re-verify. `iteration` is whatever it already was; a resolve dispatch never
 * calls this, so a post-resolve FAIL continues the count from its prior value with the same
 * cap-3 rule as any other FAIL.
 *
 * @param {number} iteration - the iteration number that was just verified (1-based)
 * @param {'PASS'|'SKIP'|'FAIL'} verdict
 * @returns {{decision: 'integrate'|'re-dispatch'|'escalate', nextIteration?: number}}
 */
export function decideAfterVerifierVerdict(iteration, verdict) {
  if (!Number.isInteger(iteration) || iteration < 1) {
    throw new TypeError(`iteration must be a positive integer, got: ${JSON.stringify(iteration)}`);
  }
  if (verdict === 'PASS' || verdict === 'SKIP') {
    return { decision: 'integrate' };
  }
  if (verdict !== 'FAIL') {
    throw new TypeError(`verdict must be one of PASS, SKIP, FAIL, got: ${JSON.stringify(verdict)}`);
  }
  if (iteration >= 3) {
    return { decision: 'escalate', nextIteration: iteration };
  }
  return { decision: 're-dispatch', nextIteration: iteration + 1 };
}

/**
 * The worktree is torn down (PASS integration, or discarded after an escalation). "Per
 * worktree lifetime" means the ladder's one-shot budget resets only here — never silently
 * across sessions on the SAME worktree.
 *
 * @returns {LadderState}
 */
export function onWorktreeTeardown() {
  return createLadderState();
}
