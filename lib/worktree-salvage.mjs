// Worktree-abandonment diff salvage — storage-path/filename convention only (ADR-0063).
//
// Every `work` path that abandons a worker's per-worker git worktree (ADR-0032) with
// un-merged changes still sitting in it — a FAIL-iteration-3 escalation, a BOUNCE, or an
// orphaned worktree's "discard" disposition (ADR-0032's session-end reconciliation) — must
// capture that worktree's diff to a patch file BEFORE the worktree is removed. This closes a
// confirmed incident (Dorc review recommendation A1): a FAIL-iteration-3 escalation once had
// its already-verified fix deleted along with the `aw/<task-id>` branch, and the builder had
// to re-derive work the system had already done.
//
// GIT-FREE BY DESIGN (ADR-0038's three-layer boundary): capturing the diff itself needs a git
// command (`git -C <worktree> diff <fork-point>`), and git is owned exclusively by the
// conductor — never a `lib/` module, never a worker. So this module computes ONLY the
// storage path/filename convention from pure inputs (task id, abandonment tag); it never
// shells out to git. The git capture command itself is conductor-executed prose in
// `skills/work/SKILL.md` ("Salvaging a worktree's diff before abandonment").

import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Task ids and tags are both filename components — keep them to characters that are safe
// (and portable) in a filename on every OS this project runs on, matching the collision-
// resistant id grammar (ADR-0028/ADR-0044) rather than inventing a second alphabet.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function assertSafeSegment(value, label) {
  if (typeof value !== 'string' || value.length === 0 || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a non-empty string of [A-Za-z0-9._-], got: ${JSON.stringify(value)}`);
  }
}

/** Tag for a `RESULT: BOUNCED` abandonment (see BOUNCE integration in `skills/work/SKILL.md`). */
export const BOUNCE_TAG = 'bounced';

/** Tag for an orphaned worktree's "discard" disposition (session-end reconciliation / Phase 1 recovery). */
export const DISCARD_TAG = 'discarded';

/**
 * Tag for the merge-back conflict ladder's rung 1 capture (ADR-0072, agentic-workflow-pcwnn):
 * the loser's diff is salvaged BEFORE `main` is reset and BEFORE the branch is touched by the
 * ladder's in-worktree `git merge main`, so a real merge conflict never risks losing verified
 * work the same way the FAIL-iteration-3 incident (ADR-0063) did. Distinct from `escalationTag`/
 * `BOUNCE_TAG`/`DISCARD_TAG` — a task that later ALSO escalates or is discarded gets a second,
 * differently-tagged file, never an overwrite of this one.
 */
export const MERGE_CONFLICT_TAG = 'merge-conflict';

/**
 * Tag for a FAIL-iteration-3 (or earlier `task-under-specified`) escalation, at the
 * iteration the escalation fired on.
 *
 * @param {number} iteration  A positive integer (the verification iteration, typically 3).
 * @returns {string} e.g. "escalated-iter3"
 */
export function escalationTag(iteration) {
  if (!Number.isInteger(iteration) || iteration < 1) {
    throw new TypeError(`iteration must be a positive integer, got: ${JSON.stringify(iteration)}`);
  }
  return `escalated-iter${iteration}`;
}

/**
 * Ensure the salvage directory exists. Pure `fs.mkdirSync` — no git.
 *
 * @param {string} salvageRoot  Absolute path to the salvage directory
 *   (the project's convention is `<repo-root>/.agentheim/salvage/`).
 * @returns {string} the same `salvageRoot`, for chaining.
 */
export function ensureSalvageDir(salvageRoot) {
  if (typeof salvageRoot !== 'string' || salvageRoot.length === 0) {
    throw new TypeError(`salvageRoot must be a non-empty string, got: ${JSON.stringify(salvageRoot)}`);
  }
  mkdirSync(salvageRoot, { recursive: true });
  return salvageRoot;
}

/**
 * Compute the storage path for a task's salvaged diff. One abandonment EVENT = one file;
 * a task abandoned twice (e.g. escalated, then later discarded at session end) gets two
 * distinct, differently-tagged files, never an overwrite of the earlier record.
 *
 * @param {string} salvageRoot  Absolute path to the salvage directory.
 * @param {string} taskId       The task's collision-resistant id (ADR-0028), e.g. "agentic-workflow-hvqa4".
 * @param {string} tag          One of `BOUNCE_TAG`, `DISCARD_TAG`, or `escalationTag(N)`'s output.
 * @returns {string} absolute path, e.g. ".../.agentheim/salvage/agentic-workflow-hvqa4-bounced.patch"
 */
export function salvagePatchPath(salvageRoot, taskId, tag) {
  if (typeof salvageRoot !== 'string' || salvageRoot.length === 0) {
    throw new TypeError(`salvageRoot must be a non-empty string, got: ${JSON.stringify(salvageRoot)}`);
  }
  assertSafeSegment(taskId, 'taskId');
  assertSafeSegment(tag, 'tag');
  return path.join(salvageRoot, `${taskId}-${tag}.patch`);
}

/**
 * The one-line reference to paste into a task's `## Salvage note` and into whatever message
 * reaches the user/builder for this abandonment (the escalation summary; the end-of-run
 * report). Keeping the phrasing in one place means every call site names the patch the same
 * way instead of drifting into ad hoc wording per abandonment path.
 *
 * @param {string} patchPath  Absolute path returned by `salvagePatchPath`.
 * @returns {string}
 */
export function formatSalvageReference(patchPath) {
  if (typeof patchPath !== 'string' || patchPath.length === 0) {
    throw new TypeError(`patchPath must be a non-empty string, got: ${JSON.stringify(patchPath)}`);
  }
  return `Salvaged diff: \`${patchPath}\` (apply with \`git apply <patch>\` against a scratch checkout, or open it directly to review).`;
}
