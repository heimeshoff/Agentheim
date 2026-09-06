// derived-artifact-guard — makes the "workers never rebuild dashboard/dist/"
// contract structural (agentic-workflow-q7v3k, ADR-0057), by filtering the
// declared FILE_LIST at the conductor's checkpoint `git add`, not by
// prompting the worker harder and not by linting the working tree.
//
// The insight this module encodes: a rebuilt `dashboard/dist/` has exactly
// one channel by which it can escape a worktree and reach `main` — the
// conductor's enumerated checkpoint stage (skills/work/SKILL.md). A worker
// can dirty its worktree all it likes; if the derived artifact is never
// *staged*, it never reaches the squash-merge, and the rebuild is inert.
// This is why the guard operates on a caller-supplied path LIST, never a
// tree walk — it replaces judgment with transcription at the one seam that
// already exists, the same move ADR-0038 made for the lifecycle verbs.
//
// Shape doctrine (mirrors lib/agent-spawn-namespace.mjs's purity doctrine,
// ADR-0052 — NOT its live-tree scanning shape, since this guard is a filter
// over declared data, not a tree walk):
//   - stdlib-only (node:path) — zero dependencies;
//   - git-free — never runs `git status` / `git diff`; operates purely on
//     the strings the caller hands in, so it is structurally immune to the
//     known `autocrlf` phantom-modification of `dashboard/dist/app.js`;
//   - side-effect-free — paths in, plain data out; never writes, never
//     touches the filesystem.

import path from 'node:path';

/**
 * Every declared-source-relative prefix (POSIX-separator, trailing `/`) that
 * marks a derived, bundled artifact rather than tracked source (ADR-0003:
 * the styleguide/dashboard `app/` source is the single source of truth;
 * `dashboard/dist/` is esbuild's build-time output). The trailing `/` is
 * load-bearing: it makes every prefix check a segment-boundary match, so
 * `dashboard/dist-notes.md` is never mistaken for `dashboard/dist/`.
 */
export const DERIVED_ARTIFACT_PREFIXES = Object.freeze(['dashboard/dist/']);

/**
 * Every declared-source-relative prefix (POSIX-separator, trailing `/`) that
 * marks a `.agentheim/` bookkeeping path — README deltas, ADR bodies, the
 * task file's own lifecycle move, backlog items — none of which a worker's
 * private branch may carry after agentic-workflow-ghcaj (amends ADR-0032 §3,
 * §4, §6): those artifacts now travel in the worker's structured `RESULT`
 * block and are materialized by the conductor on `main` at squash-merge
 * integration, never staged out of a worktree. A worker that still writes
 * under `.agentheim/` in its worktree (leftover habit, a stale prompt, a
 * bug) is rendered INERT by this guard — the same posture ADR-0057 already
 * established for `dashboard/dist/` — rather than failing the task outright.
 * The trailing `/` is load-bearing for the same reason as
 * `DERIVED_ARTIFACT_PREFIXES`: it makes the match a segment-boundary match,
 * so a root-level `.agentheim-notes.md` is never mistaken for a path inside
 * `.agentheim/`.
 */
export const BOOKKEEPING_PATH_PREFIXES = Object.freeze(['.agentheim/']);

/**
 * Convert an absolute, OS-native-separator path (the real `FILE_LIST` shape
 * — references/worker-return-format.md line 17) into a POSIX-separator path
 * relative to `worktreeRoot`, for prefix matching against
 * `DERIVED_ARTIFACT_PREFIXES`.
 * @param {string} worktreeRoot
 * @param {string} filePath
 * @returns {{ relPosix: string, outsideWorktree: boolean }}
 */
function toWorktreeRelative(worktreeRoot, filePath) {
  const rel = path.relative(worktreeRoot, filePath);
  // path.relative starts a result with '..' when filePath climbs out of
  // worktreeRoot, and returns an absolute path when the two roots don't
  // share a common ancestor at all (e.g. different Windows drive letters) —
  // both are the "outside this worktree" case.
  const outsideWorktree = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  const relPosix = rel.split(path.sep).join('/');
  return { relPosix, outsideWorktree };
}

/**
 * Partition a worker's declared `FILE_LIST` (checkpoint-time) into files
 * safe to stage (`changed`) and files the guard refuses (`refused`), each
 * refusal carrying `{ path, reason }` with `reason` one of
 * `'derived-artifact'` (matches a `DERIVED_ARTIFACT_PREFIXES` entry),
 * `'bookkeeping-path'` (matches a `BOOKKEEPING_PATH_PREFIXES` entry — a
 * worker's own worktree must never carry a `.agentheim/` write, per
 * agentic-workflow-ghcaj), or `'outside-worktree'` (resolves outside
 * `worktreeRoot` entirely).
 *
 * Operates on the declared list only — never on the working tree. It
 * neither runs nor needs `git status` / `git diff`.
 *
 * @param {string} worktreeRoot Absolute path to the worker's worktree root.
 * @param {string[]} fileList Absolute, OS-native-separator paths (the
 *   worker's self-reported `FILE_LIST`).
 * @returns {{ changed: string[], refused: {path: string, reason: string}[] }}
 */
export function partitionCheckpointFiles(worktreeRoot, fileList) {
  const changed = [];
  const refused = [];

  for (const filePath of fileList) {
    const { relPosix, outsideWorktree } = toWorktreeRelative(worktreeRoot, filePath);

    if (outsideWorktree) {
      refused.push({ path: filePath, reason: 'outside-worktree' });
      continue;
    }

    const isDerived = DERIVED_ARTIFACT_PREFIXES.some((prefix) => relPosix.startsWith(prefix));
    if (isDerived) {
      refused.push({ path: filePath, reason: 'derived-artifact' });
      continue;
    }

    const isBookkeeping = BOOKKEEPING_PATH_PREFIXES.some((prefix) => relPosix.startsWith(prefix));
    if (isBookkeeping) {
      refused.push({ path: filePath, reason: 'bookkeeping-path' });
      continue;
    }

    changed.push(filePath);
  }

  return { changed, refused };
}
