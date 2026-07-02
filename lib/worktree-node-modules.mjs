// Dashboard node_modules link for per-worker git worktrees (ADR-0032).
//
// A fresh `git worktree add` checks out only TRACKED files — `dashboard/node_modules/`
// is gitignored and build-time only (ADR-0003), so a worktree that touches `dashboard/`
// starts with none. Per-worktree `npm install` is expensive and Windows-lock-prone;
// ADR-0032 instead LAZILY LINKS the worktree's `dashboard/node_modules` to the ONE
// real `dashboard/node_modules` in the main tree — safe because node_modules is
// read-only during a build (esbuild reads deps, writes each worktree's own tracked
// `dashboard/dist/`), so there is no concurrent writer to the shared directory.
//
// OS-divergent branch confined to ONE helper (mirrors dashboard/launch.mjs, ADR-0002):
// Windows needs a directory JUNCTION (`fs.symlinkSync(target, link, 'junction')` —
// no admin rights required, unlike a symlink); POSIX uses a plain directory symlink
// (the `type` argument to `symlinkSync` is ignored on POSIX). Both are created and
// removed through this one seam.
//
// SPIKE-CONFIRMED SAFETY RULE (agentic-workflow-f6m2q de-risking spike): a throwaway
// fixture proved that `git worktree remove --force` does NOT stop at an un-removed
// junction — it recurses THROUGH it and deletes the REAL target directory's
// CONTENTS (no EBUSY, just silent data loss of the shared node_modules). So
// `unlinkDashboardNodeModules` MUST run before any `git worktree remove` on a
// worktree this module ever linked, with no exceptions — see skills/work/SKILL.md
// "Windows & node_modules" for the doctrine that enforces the ordering. This module
// also refuses, as a second line of defense, to ever touch a `node_modules` that
// isn't itself a symlink/junction (see the safety guard in `unlinkDashboardNodeModules`).

import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';

/**
 * Does this task touch the `dashboard/` build tree? Only tasks that do get a
 * node_modules link — every other task's worktree never needs one.
 *
 * A path "touches dashboard" when `dashboard` appears as a DIRECTORY segment
 * (not the bare filename) — `dashboard/app/board.js` and `dashboard/build.mjs`
 * both count; `commands/dashboard.md` does not (dashboard is the filename there,
 * not a folder). Accepts both `/`- and `\`-separated paths.
 *
 * @param {string[]} fileList  A worker's FILE_LIST (or any list of paths).
 * @returns {boolean}
 */
export function taskTouchesDashboard(fileList) {
  if (!Array.isArray(fileList)) return false;
  return fileList.some((p) => {
    if (typeof p !== 'string' || !p) return false;
    const segments = p.split(/[\\/]+/).filter(Boolean);
    const dirSegments = segments.slice(0, -1); // exclude the filename itself
    return dirSegments.includes('dashboard');
  });
}

/**
 * Lazily link `<worktreeRoot>/dashboard/node_modules` to the ONE real
 * `<mainRoot>/dashboard/node_modules`. Idempotent — a second call on an
 * already-linked worktree is a no-op, not an error.
 *
 * @param {string} worktreeRoot  Absolute path to the worktree's root.
 * @param {string} mainRoot      Absolute path to the main tree's root.
 * @returns {{linked: true, linkPath: string, target: string} |
 *           {linked: false, reason: 'already-linked'|'main-node-modules-missing'|'worktree-dashboard-dir-missing', linkPath: string}}
 */
export function linkDashboardNodeModules(worktreeRoot, mainRoot) {
  const target = path.join(mainRoot, 'dashboard', 'node_modules');
  const linkPath = path.join(worktreeRoot, 'dashboard', 'node_modules');

  if (existsSync(linkPath)) {
    return { linked: false, reason: 'already-linked', linkPath };
  }
  if (!existsSync(target)) {
    return { linked: false, reason: 'main-node-modules-missing', linkPath };
  }
  const worktreeDashboardDir = path.join(worktreeRoot, 'dashboard');
  if (!existsSync(worktreeDashboardDir)) {
    return { linked: false, reason: 'worktree-dashboard-dir-missing', linkPath };
  }

  // Windows junctions require an ABSOLUTE target; POSIX symlinks tolerate either,
  // so resolving to absolute unconditionally keeps the one call cross-platform.
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  symlinkSync(path.resolve(target), linkPath, type);
  return { linked: true, linkPath, target };
}

/**
 * Remove a worktree's `dashboard/node_modules` LINK — never the real directory it
 * points to. MUST be called before `git worktree remove` on any worktree this
 * module linked (see the module-level spike note: removal-without-unlink-first
 * silently deletes the real node_modules' contents).
 *
 * Safety guard: if `dashboard/node_modules` exists but is NOT a symlink/junction
 * (e.g. a real directory — from a per-worktree install, or called on the main
 * tree by mistake), this REFUSES to touch it rather than guessing.
 *
 * @param {string} worktreeRoot  Absolute path to the worktree's root.
 * @returns {{unlinked: true, linkPath: string} |
 *           {unlinked: false, reason: 'not-present'|'stat-failed'|'not-a-link-refusing-to-touch', linkPath: string}}
 */
export function unlinkDashboardNodeModules(worktreeRoot) {
  const linkPath = path.join(worktreeRoot, 'dashboard', 'node_modules');
  if (!existsSync(linkPath)) {
    return { unlinked: false, reason: 'not-present', linkPath };
  }

  let stat;
  try {
    stat = lstatSync(linkPath);
  } catch {
    return { unlinked: false, reason: 'stat-failed', linkPath };
  }

  if (!stat.isSymbolicLink()) {
    return { unlinked: false, reason: 'not-a-link-refusing-to-touch', linkPath };
  }

  unlinkSync(linkPath);
  return { unlinked: true, linkPath };
}
