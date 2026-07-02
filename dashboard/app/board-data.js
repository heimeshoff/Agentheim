/* ============================================================
   Agentheim — dashboard board data transform (agentic-workflow-006)

   The pure, framework-free bridge between the read projection
   (/api/tree, aw-005) and the approved styleguide Kanban
   components (design-system-001/002). Given the tree JSON it
   pools every bounded context's tasks into the four FLAT lifecycle
   columns (no swimlanes — the per-card BC chip tells contexts
   apart, per the aw-006 decision) and maps each tree task into the
   shape the styleguide `TicketCard` renders.

   Kept in its own module (no React, no htm) so it is unit-testable
   under `node --test` without a DOM, and so the React board shell
   stays thin. The styleguide source is the single source of UI
   truth (ADR-0003); this transform shapes DATA for it, it does not
   restyle or fork any component.
   ============================================================ */

// The four lifecycle columns, in board order. Mirrors the styleguide's
// COLUMN_ORDER and the on-disk lifecycle folders (backlog → todo → doing → done).
export const COLUMN_ORDER = ['backlog', 'todo', 'doing', 'done'];

const COLUMN_SET = new Set(COLUMN_ORDER);

/**
 * Normalize any task status into one of the four canonical lifecycle values.
 * Disk is the source of truth, but a hand-edited task file can carry a malformed
 * status (e.g. a leaked frontmatter-template comment: `todo  # backlog | …`). The
 * styleguide `TicketCard` indexes a fixed STATUSES registry by this value and
 * reads `.color` off the result — an unrecognized key would be `undefined` and
 * throw AT RENDER TIME, unmounting the whole React root (a blank board). So the
 * board never lets a non-canonical status reach the card: an unknown status is
 * bucketed into `backlog`, matching where `columnFor` places the same task. One
 * bad task file can no longer crash the board.
 */
function normalizeStatus(status) {
  return typeof status === 'string' && COLUMN_SET.has(status) ? status : 'backlog';
}

/**
 * Map one /api/tree task into the object the styleguide `TicketCard` reads.
 * The tree projection carries { id, title, status, type, context, path }; the
 * card additionally renders `est` and `updated` meta and an `agent` flag. The
 * read model deliberately omits those (pointers/metadata only, ADR-0002), so we
 * supply quiet, defined placeholders rather than letting the card show
 * `undefined`. `path` is carried through unchanged — the slide-over (aw-007)
 * uses it to fetch the body via /api/doc; the open-intent emitted on click
 * carries the whole ticket, path included.
 */
export function treeTicket(task) {
  const t = task || {};
  return {
    id: t.id ?? '',
    title: t.title ?? '',
    // Always one of the four canonical statuses — never the raw disk value, which
    // the card would index into STATUSES and crash on if malformed (normalizeStatus).
    status: normalizeStatus(t.status),
    type: t.type ?? '',
    context: t.context ?? '',
    path: t.path ?? '',
    // File modification time the projection carries (aw-013), consumed by the
    // board-side sort's modification-date orderings (aw-012). Normalized to null
    // when absent — null means "could not stat" (ADR-0002) and the sort treats it
    // as the oldest; the TicketCard itself does not render it.
    mtimeMs: typeof t.mtimeMs === 'number' ? t.mtimeMs : null,
    // Raw, unresolved id-string arrays the /api/tree projection carries
    // (agentic-workflow-d8q3n, ADR-0002 — pointers+metadata only). The board
    // resolves these against the pooled cross-BC ticket universe on hover
    // (board-dependencies.js); absent/malformed here degrades to [] so a
    // missing or corrupt frontmatter field never reaches the resolver as
    // anything but an array.
    dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
    blocks: Array.isArray(t.blocks) ? t.blocks : [],
    // Card meta the read model does not carry — defined, quiet defaults.
    est: '—',
    updated: '',
    agent: false,
  };
}

/** Which lifecycle column a task belongs to — by status, falling back safely. */
function columnFor(task) {
  // Disk is the source of truth; status drives placement. Shares normalizeStatus
  // with treeTicket so a card's status and its column can never disagree: an
  // unrecognized status is bucketed into backlog so a malformed task is still
  // shown, never lost.
  return normalizeStatus(task && task.status);
}

/**
 * Pool the whole tree projection into four flat lifecycle columns.
 * @param {object|null} tree — the /api/tree JSON ({ contexts: [{ lifecycle }] }).
 * @returns {{ backlog, todo, doing, done }} arrays of TicketCard-shaped objects.
 *
 * Every bounded context's tasks land in the SAME four columns (flat board, no
 * swimlanes). Degrades to four empty columns for a null/empty/malformed tree so
 * the board renders the styleguide empty-column state rather than throwing.
 */
export function treeToColumns(tree) {
  const cols = {};
  for (const c of COLUMN_ORDER) cols[c] = [];

  const contexts = tree && Array.isArray(tree.contexts) ? tree.contexts : [];
  for (const bc of contexts) {
    const lifecycle = bc && bc.lifecycle ? bc.lifecycle : {};
    for (const folder of COLUMN_ORDER) {
      const tasks = Array.isArray(lifecycle[folder]) ? lifecycle[folder] : [];
      for (const task of tasks) {
        cols[columnFor(task)].push(treeTicket(task));
      }
    }
  }
  return cols;
}
