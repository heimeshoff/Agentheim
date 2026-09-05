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

/** Element-wise array equality (never by reference — /api/tree hands back a
 * fresh array on every fetch even when its contents are unchanged). */
function arraysEqualElementwise(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Value-equality for the identity-stable reconcile: the full treeTicket field
 * set EXCEPT the quiet constant placeholders (est/updated/agent, which never
 * vary). `mtimeMs` is deliberately included — a worker editing a task body
 * changes its mtime, and the mtime-ordered sorts need that ticket to
 * re-render. `dependsOn`/`blocks` compare element-wise since they arrive as
 * fresh arrays on every fetch regardless of content.
 */
function ticketsValueEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.status === b.status &&
    a.type === b.type &&
    a.context === b.context &&
    a.path === b.path &&
    a.mtimeMs === b.mtimeMs &&
    arraysEqualElementwise(a.dependsOn, b.dependsOn) &&
    arraysEqualElementwise(a.blocks, b.blocks)
  );
}

/** Whether two column arrays hold, in order, the exact same objects. */
function columnsIdentical(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Pool the whole tree projection into four flat lifecycle columns.
 * @param {object|null} tree — the /api/tree JSON ({ contexts: [{ lifecycle }] }).
 * @param {{ backlog, todo, doing, done }} [prev] — the PREVIOUS columns this
 *        function returned, for the identity-stable reconcile below. Omit on
 *        the first call (nothing to reconcile against yet).
 * @returns {{ backlog, todo, doing, done }} arrays of TicketCard-shaped objects.
 *
 * Every bounded context's tasks land in the SAME four columns (flat board, no
 * swimlanes). Degrades to four empty columns for a null/empty/malformed tree so
 * the board renders the styleguide empty-column state rather than throwing.
 *
 * IDENTITY-STABLE PROJECTION: when `prev` is supplied, a freshly-projected
 * ticket that is `ticketsValueEqual` to the prior ticket of the same id keeps
 * the PRIOR object — never a fresh allocation for an unchanged task. A column
 * array whose members are then all identical to `prev`'s equivalent column is
 * itself reused (same array reference); if all four columns reuse, the whole
 * `prev` object is returned. Re-projecting an unchanged tree therefore commits
 * nothing, and a single task move changes exactly the one ticket and the two
 * columns its move touches — the mechanism `React.memo`d board components
 * depend on to skip a re-render (agentic-workflow-rw6ck). See the BC README's
 * "Identity-stable projection" entry.
 */
export function treeToColumns(tree, prev) {
  const prevById = new Map();
  if (prev) {
    for (const c of COLUMN_ORDER) {
      for (const t of (Array.isArray(prev[c]) ? prev[c] : [])) prevById.set(t.id, t);
    }
  }

  const cols = {};
  for (const c of COLUMN_ORDER) cols[c] = [];

  const contexts = tree && Array.isArray(tree.contexts) ? tree.contexts : [];
  for (const bc of contexts) {
    const lifecycle = bc && bc.lifecycle ? bc.lifecycle : {};
    for (const folder of COLUMN_ORDER) {
      const tasks = Array.isArray(lifecycle[folder]) ? lifecycle[folder] : [];
      for (const task of tasks) {
        const fresh = treeTicket(task);
        const prior = prevById.get(fresh.id);
        const reconciled = prior && ticketsValueEqual(prior, fresh) ? prior : fresh;
        cols[columnFor(task)].push(reconciled);
      }
    }
  }

  if (!prev) return cols;

  let allColumnsReused = true;
  for (const c of COLUMN_ORDER) {
    const prevArr = Array.isArray(prev[c]) ? prev[c] : [];
    if (columnsIdentical(prevArr, cols[c])) {
      cols[c] = prevArr; // reuse the array itself too, not just its members.
    } else {
      allColumnsReused = false;
    }
  }
  return allColumnsReused ? prev : cols;
}
