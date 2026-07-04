/* ============================================================
   Agentheim — dashboard WHAT'S-NEXT panel state (agentic-workflow-073,
   dismiss rewired to delete-on-disk by agentic-workflow-vmk1z / ADR-0046)

   The `whats-next` skill writes a single-latest ADVISORY recommendation artifact
   (ADR-0027) at `.agentheim/state/whats-next.md` — frontmattered markdown carrying
   a `generated` ISO-8601 timestamp and three body sections. The dashboard reads it
   and renders it as a dismissible panel above the board prompt bar. This module is
   the dashboard-side PURE helpers behind that panel's render path:

     1. `splitWhatsNextSections` — the pure body-splitter behind the three-column
        layout (aw-q7m4k).
     2. `formatStaleness` — a PURE staleness formatter over the `generated` stamp.
        This is a rendering cue ONLY (ADR-0027 §4: the frontmatter is descriptive,
        nothing keys behaviour off it).

   Dismiss (ADR-0046) is NO LONGER a client-side localStorage hide keyed by
   `generated` — that store (`loadDismissed` / `saveDismissed` / `isDismissed`,
   `WHATS_NEXT_KEY`, `WHATS_NEXT_VERSION`) is RETIRED entirely. Dismissing the
   panel now issues `DELETE /api/whats-next` (board.js), which removes the
   artifact from disk; an absent artifact already renders nothing (no client-side
   suppression needed), and a fresh `whats-next` run has no prior dismissal to
   consult. See ADR-0046 for the full rationale.

   The remaining helpers are presentation view-state ONLY; they record no
   lifecycle truth and survive every SSE re-projection untouched. Pure,
   framework-free, unit-tested under `node --test` with no DOM.
   ============================================================ */

import { parseFrontmatter } from './frontmatter.js';

// The single in-root path of the advisory artifact (ADR-0027 §2). The panel fetches
// it via the existing GET /api/doc carrier (the same in-root-guarded body transport
// the slide-over and main-pane reader use — ADR-0021 / ADR-0023).
export const WHATS_NEXT_DOC_PATH = '.agentheim/state/whats-next.md';

/**
 * Split the advisory artifact body into its named sections, one per H2 heading — the
 * pure transform behind the panel's three-column layout (aw-q7m4k). The leading
 * frontmatter is STRIPPED (via the same parseFrontmatter the dismiss/staleness reads
 * use, so nothing drifts), then the stripped markdown is cut on each `## ` heading into
 * ordered `{ heading, content }` columns.
 *
 * LOSS-TOLERANT by design (ADR-0027 §4.4 — the body shape is descriptive, never
 * load-bearing): the artifact always carries three H2 sections (Where things stand /
 * Recommended move / Next), but this never assumes that. It returns WHATEVER H2 sections
 * are present, in document order; content before the first H2 is kept as a leading
 * headingless column; an empty / blank / frontmatter-only / non-string body yields `[]`.
 * Never throws, never invents a section.
 *
 * @param {string} raw — the raw artifact markdown (with or without frontmatter).
 * @returns {Array<{ heading: string, content: string }>}
 */
export function splitWhatsNextSections(raw) {
  const { body } = parseFrontmatter(typeof raw === 'string' ? raw : '');
  if (typeof body !== 'string' || body.trim() === '') return [];

  const lines = body.split('\n');
  const sections = [];
  let current = null; // { heading, lines: [] }
  const flush = () => {
    if (current === null) return;
    const content = current.lines.join('\n');
    // Drop a leading headingless section that is only whitespace (the conventional
    // blank gap before the first heading), but keep a real preamble.
    if (current.heading === '' && content.trim() === '') return;
    sections.push({ heading: current.heading, content });
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*\S)\s*$/);
    if (h2) {
      flush();
      current = { heading: h2[1].trim(), lines: [] };
    } else {
      if (current === null) current = { heading: '', lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return sections;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Pluralise a whole-number count + unit ("1 minute" / "5 minutes"). */
function ago(count, unit) {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * Format the age of a recommendation as a human staleness cue — RENDERING ONLY
 * (ADR-0027 §4). Under a minute (or a future-stamped clock) reads "just now"; older
 * reads "N minutes/hours/days ago". An unparseable / missing timestamp returns ""
 * (the panel then shows no cue) rather than throwing.
 * @param {string|null|undefined} generated — the ISO-8601 `generated` stamp.
 * @param {number} now — the current epoch ms (injected so it stays pure/testable).
 * @returns {string} the staleness label, or "" when unparseable.
 */
export function formatStaleness(generated, now) {
  if (typeof generated !== 'string' || generated === '') return '';
  const then = Date.parse(generated);
  if (Number.isNaN(then)) return '';
  const elapsed = Number(now) - then;
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return 'just now'; // also clamps future.
  if (elapsed < HOUR) return ago(Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return ago(Math.floor(elapsed / HOUR), 'hour');
  return ago(Math.floor(elapsed / DAY), 'day');
}
