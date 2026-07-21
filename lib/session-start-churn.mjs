// Deterministic helpers for work's session-start human-churn reconciliation
// (agentic-workflow-hhjjx — Dorc July-2026 review recommendation A6,
// surviving piece 3 of 3). See skills/work/SKILL.md's "Session-start
// human-churn reconciliation" section and ADR-0066 for the mechanism this
// implements. Mirror image of agentic-workflow-d6q4h's session-END
// carry-over reconciliation — same slot, the other end of the session.
//
// WHY THIS EXISTS
// A human/out-of-band commit — a raw edit landed straight on `main`, no
// worker/skill in the loop, no amendment — leaves the agents' world model
// stale: tests pinned to the old state then fail mysteriously, and whole
// tasks exist only to chase that drift after the fact (Dorc review). ADR-
// 0026's `[<task-id>]` commit-trailer convention makes "human commit"
// cheaply detectable: a commit missing every bracketed trailer is either a
// human/out-of-band commit, or one of the small number of machine commit
// shapes that also omit the trailer by convention (`modeling` DISMISS,
// `brainstorm` — see ADR-0026's message-convention table). This
// reconciliation deliberately does not try to distinguish the two: it is
// advisory-only and never gates or auto-files anything, so a handful of
// known-machine false positives cost the builder one glance, while silently
// under-flagging a genuine human commit would defeat the whole point.
//
// This module is entirely GIT-FREE (ADR-0038): it never shells out to git
// and never writes anything. The one git read this reconciliation needs —
//   git log --since="<since>" --name-only --format='%x1eCOMMIT%x1f%H%x1f%s'
// — is a CONDUCTOR step in skills/work/SKILL.md prose (see that section for
// the exact command); this module only parses the resulting text plus the
// protocol.md excerpt already in the conductor's hands. Judgment — which
// touched files count as "governed" (ADR-referenced paths, BC README
// runtime-surface manifests), and what to recommend — stays with the skill,
// per ADR-0038's three-layer boundary; this module only detects and shapes
// text.

const SESSION_END_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+--\s+Work session ended\s*$/m;
const TASK_TRAILER_RE = /\[[^\]\s]+\]/;
const COMMIT_MARKER = '\x1e';
const FIELD_SEP = '\x1f';

/**
 * Find the most recent "## YYYY-MM-DD HH:MM -- Work session ended" protocol
 * entry and resolve it into the commit-range boundary the conductor's own
 * `git log --since=...` read needs. Protocol entries are newest-on-top, so
 * the FIRST match in document order is the most recent session end.
 * @param {string} protocolText contents (or a leading excerpt) of protocol.md
 * @returns {{since: string, heading: string}|null} `since` is a git
 *   `--since`-compatible timestamp (`"YYYY-MM-DD HH:MM"`); `heading` is the
 *   matched entry's full heading line. `null` when no such entry is found —
 *   a fresh project with no prior session-end entry — the caller's
 *   SKIP-SILENTLY signal (there is nothing yet to compare against).
 */
export function resolveSinceLastSessionEnd(protocolText) {
  const match = String(protocolText || '').match(SESSION_END_HEADING_RE);
  if (!match) return null;
  const [heading, date, time] = match;
  return { since: `${date} ${time}`, heading: heading.trim() };
}

/**
 * Parse the exact `git log --name-only
 * --format='%x1eCOMMIT%x1f%H%x1f%s'` output shape (documented above) into
 * structured per-commit records. Loss-tolerant: a block whose header does
 * not match the expected `COMMIT\x1f<sha>\x1f<subject>` shape is skipped
 * rather than throwing, so one odd/truncated block never aborts the whole
 * read.
 * @param {string} rawGitLogText
 * @returns {Array<{sha: string, subject: string, files: string[]}>}
 */
export function parseCommitLog(rawGitLogText) {
  const text = String(rawGitLogText || '');
  if (!text.includes(COMMIT_MARKER)) return [];
  return text
    .split(COMMIT_MARKER)
    .slice(1) // drop the empty/preamble chunk before the first marker
    .map((block) => {
      const newlineIdx = block.indexOf('\n');
      const header = newlineIdx === -1 ? block : block.slice(0, newlineIdx);
      const rest = newlineIdx === -1 ? '' : block.slice(newlineIdx + 1);
      const parts = header.split(FIELD_SEP);
      if (parts[0] !== 'COMMIT' || !parts[1] || parts[2] === undefined) return null;
      const files = rest
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return { sha: parts[1], subject: parts[2], files };
    })
    .filter(Boolean);
}

/**
 * True when a commit subject carries the ADR-0026 `[<task-id>]` trailer
 * convention — one or more bracketed tokens anywhere in the subject (a
 * trivial-squash wave carries several, e.g. `... [id-1] [id-2]`).
 * @param {string} subject
 * @returns {boolean}
 */
export function hasTaskTrailer(subject) {
  return TASK_TRAILER_RE.test(String(subject || ''));
}

/**
 * Filter parsed commits down to those WITHOUT a task-id trailer — the
 * human/out-of-band (or trailer-less machine, see header note) commits this
 * reconciliation exists to surface.
 * @param {Array<{sha: string, subject: string, files: string[]}>} commits
 * @returns {Array<{sha: string, subject: string, files: string[]}>}
 */
export function findUntrailedCommits(commits) {
  return (commits || []).filter((c) => !hasTaskTrailer(c.subject));
}

/**
 * Format one untrailed commit for the session-start advisory — a short sha,
 * its subject, and its touched files. Skill prose appends the governed-file
 * flag (judgment, ADR-0038) after this text; this only shapes the base line.
 * @param {{sha: string, subject: string, files: string[]}} commit
 * @returns {string}
 */
export function formatUntrailedCommitLine(commit) {
  const shortSha = String(commit.sha || '').slice(0, 7);
  const files = commit.files && commit.files.length ? commit.files.join(', ') : '(no files recorded)';
  return `${shortSha} ${commit.subject} — ${files}`;
}

/**
 * Format the whole human-churn advisory body — one line per untrailed
 * commit, or the explicit "clean" line when none exist. Never a gate; pure
 * text shaping for the session-start line / whats-next advisory (ADR-0027
 * family).
 * @param {Array<{sha: string, subject: string, files: string[]}>} untrailedCommits
 * @returns {string}
 */
export function formatHumanChurnSummary(untrailedCommits) {
  if (!untrailedCommits || untrailedCommits.length === 0) {
    return 'none — no commits without a task-id trailer since the last session end';
  }
  return untrailedCommits.map(formatUntrailedCommitLine).join('\n');
}
