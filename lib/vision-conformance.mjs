// Deterministic helpers for work's session-end vision-conformance pass
// (agentic-workflow-v6d4n — see skills/work/SKILL.md's "Vision-conformance
// check (session-end)" section, and ADR-0040 for the mechanism this
// implements).
//
// WHY THIS EXISTS
// The pass itself is genuine LLM judgment ("does this shipped task pull
// toward a stated non-goal, or away from a stated success criterion?") and
// is exercised by evals/vision-conformance-check/'s fixtures, not by unit
// tests. What IS deterministic — and so belongs here, stdlib-only, unit
// tested — is (1) extracting vision.md's two named, bounded-read sections
// ("What success looks like" / "Non-goals") without pulling in the rest of
// the document, and (2) formatting the resulting flags into the two
// advisory surfaces the pass feeds: the session-end protocol entry's
// `**Vision-conformance:**` line, and (when warranted) the
// `.agentheim/state/whats-next.md` advisory (ADR-0027 family).
//
// This pass NEVER blocks anything — every export here is pure text
// shaping, never a gate (ADR-0017, vision.md's "Not autonomous" non-goal).

const HEADING_RE = /^##\s+(.+?)\s*$/;
const LIST_ITEM_RE = /^\s*(?:-|\d+\.)\s+(.*\S)\s*$/;

/**
 * Extract the bullet/numbered-list items under an exact level-2 ("## ")
 * markdown heading, stopping at the next level-2 heading (or end of
 * document). Non-list lines under the heading (prose, blank lines) are
 * skipped rather than collected — this pass only wants the enumerated
 * items, not surrounding narration.
 * @param {string} text    full markdown document (e.g. vision.md's contents)
 * @param {string} heading exact heading text, without the leading `## `
 *                         (e.g. "What success looks like")
 * @returns {string[]} item texts in document order, marker stripped and
 *                      trimmed; [] if the heading is absent
 */
export function extractSection(text, heading) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let inSection = false;
  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      if (inSection) break; // reached the next level-2 heading — stop
      inSection = headingMatch[1].trim() === heading;
      continue;
    }
    if (!inSection) continue;
    const item = line.match(LIST_ITEM_RE);
    if (item) items.push(item[1].trim());
  }
  return items;
}

/**
 * Extract vision.md's two bounded-read sections in one pass — the "cheap,
 * bounded read" the v6d4n task specifies: these two named sections only,
 * never the whole vision, never a per-task deep dive.
 * @param {string} visionText full contents of vision.md
 * @returns {{successCriteria: string[], nonGoals: string[]}}
 */
export function extractVisionSections(visionText) {
  return {
    successCriteria: extractSection(visionText, 'What success looks like'),
    nonGoals: extractSection(visionText, 'Non-goals'),
  };
}

/**
 * A short, quotable label for a vision-section item, so a flag can name the
 * exact vision line it diverges from rather than a vague "seems off".
 * Prefers the item's leading **bold** phrase (vision.md's non-goals are
 * typically written "**Not X.** ..."); falls back to the item text itself,
 * truncated to ~60 chars if long.
 * @param {string} item one item returned by extractSection
 * @returns {string}
 */
export function labelFor(item) {
  const bold = item.match(/^\*\*(.+?)\*\*/);
  if (bold) return bold[1].trim();
  return item.length <= 60 ? item : item.slice(0, 57).trimEnd() + '...';
}

/**
 * Format the session-end protocol entry's `**Vision-conformance:**` line
 * (mirrors the `**Carry-over:**` line agentic-workflow-d6q4h added to the
 * same entry). Pure text formatting — never a gate.
 * @param {Array<{taskId: string, kind: ('success'|'non-goal'), label: string, note?: string}>} [flags]
 * @returns {string} `none — batch aligns with vision` when flags is empty
 *                   or absent; otherwise one clause per flag, joined by "; "
 */
export function formatConformanceLine(flags) {
  if (!flags || flags.length === 0) return 'none — batch aligns with vision';
  return flags
    .map(({ taskId, kind, label, note }) => {
      const kindLabel = kind === 'non-goal' ? 'non-goal' : 'success criterion';
      const suffix = note ? ` — ${note}` : '';
      return `${taskId}: diverges from ${kindLabel} "${label}"${suffix}`;
    })
    .join('; ');
}

/**
 * Whether a flag set is worth also surfacing through the whats-next
 * advisory (ADR-0027 family, ADR-0040) rather than only the protocol line —
 * any non-empty flag set qualifies. Named as its own predicate so the
 * threshold has exactly one place to change later, rather than being
 * inlined at every call site.
 * @param {Array<object>} [flags]
 * @returns {boolean}
 */
export function worthSurfacing(flags) {
  return Boolean(flags && flags.length > 0);
}
