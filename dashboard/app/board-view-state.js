/* ============================================================
   Agentheim — dashboard board persisted view-state (agentic-workflow-014)

   The single, versioned localStorage store for the board's per-column VIEW
   LENS — grouped/flat, sort choice, per-(column, BC) collapse state, and the
   Done-column PEEK/collapse boolean — that now SURVIVES a reload.

   This deliberately REVERSES ADR-0009's "in-session view-state only — no
   localStorage" clause and SUPERSEDES agentic-workflow-012's in-session-only
   sort (see the ADR-0009 addendum). The reversal is bounded: this store carries
   PRESENTATION view-state ONLY. It never records lifecycle truth — which task is
   in which column stays a pure projection of disk (/api/tree, ADR-0001/0002),
   re-fetched on every SSE `tree-changed` frame. Persisting how you LOOK at the
   board is not a second source of truth about the board's CONTENT.

   The store is pure over an INJECTED storage backend (the real localStorage, or a
   stub in tests), framework-free, and defensive: any malformed / stale / missing
   blob degrades to "every column defaults" rather than throwing — a blank board
   must never come from a corrupt preference. Unit-tested under `node --test`.
   ============================================================ */

import { DEFAULT_SORT, SORT_OPTIONS } from './board-sort.js';

// The one localStorage key the whole board view-state lives under.
export const VIEW_STATE_KEY = 'agentheim.board.viewState';

// Bump this when the persisted shape changes incompatibly: a blob written by a
// different version is ignored on load (treated as "no stored state"), so an old
// preference can never feed a new board a shape it does not understand.
export const VIEW_STATE_VERSION = 1;

const SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));

/**
 * The state a column with NO stored preference falls back to: flat (not grouped),
 * the default sort, every section expanded, and EXPANDED (not peeked). A brand-new
 * bounded context, or a fresh column, lands here.
 *
 * `peek` (agentic-workflow-m2v8d) is the Done-column COLLAPSE affordance — it
 * REPLACES aw-072's `hidden` flag (which dropped the column from the layout). When
 * true the Done column stays in the layout but its body is HEIGHT-CLAMPED to a short
 * peek of the most-recent completions with a bottom fade; when false the full list
 * renders. It defaults to `false` so a column with no stored preference is EXPANDED
 * — "expanded by default" is the AC. Today only the Done column renders the control,
 * but the field lives on the generic per-column shape (the cleanest fit with the
 * existing store); the UI wires the affordance for Done alone.
 */
export function defaultColumnState() {
  return { grouped: false, sort: DEFAULT_SORT, collapsed: [], peek: false };
}

// Coerce one stored (untrusted) column blob into a well-formed column state.
// grouped → boolean; sort → a known sort value or the default; collapsed → an
// array of strings; peek → boolean. Two back-compat paths, neither needing a
// VIEW_STATE_VERSION bump (additive field + retired field):
//   - An OLD blob that predates `peek` simply lacks it → coerces to `false`
//     (expanded), the AC's "no stored preference resolves to the full list".
//   - An OLD blob carrying aw-072's retired `hidden` flag is IGNORED — `hidden` is
//     not read or written, so a previously-hidden Done degrades to shown + expanded
//     rather than blanking the board (the migration AC). The field is simply dropped
//     on the next save.
// Never NaN, never undefined, never a throw.
function normalizeColumn(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const sort = SORT_VALUES.has(r.sort) ? r.sort : DEFAULT_SORT;
  const collapsed = Array.isArray(r.collapsed)
    ? r.collapsed.filter((bc) => typeof bc === 'string')
    : [];
  return { grouped: !!r.grouped, sort, collapsed, peek: !!r.peek };
}

/**
 * Read the persisted per-column view-state from the injected storage.
 * @param {{ getItem: (k: string) => (string|null) }} [storage] — the storage backend.
 * @returns {Object<string, { grouped, sort, collapsed }>} a map of column → state.
 *
 * Returns `{}` (so every column defaults) when there is no backend, no stored
 * blob, a stale version, or malformed JSON. Each stored column is normalized, so
 * a partially-corrupt blob still yields a safe shape. Never throws.
 */
export function loadViewState(storage) {
  if (!storage || typeof storage.getItem !== 'function') return {};
  let raw;
  try {
    raw = storage.getItem(VIEW_STATE_KEY);
  } catch {
    return {}; // storage access can throw (e.g. disabled / private mode).
  }
  if (raw == null) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {}; // a corrupt blob must never crash the board.
  }
  if (!parsed || typeof parsed !== 'object') return {};
  if (parsed.version !== VIEW_STATE_VERSION) return {}; // a different shape — ignore.

  const columns = parsed.columns && typeof parsed.columns === 'object' ? parsed.columns : {};
  const out = {};
  for (const [col, colRaw] of Object.entries(columns)) {
    out[col] = normalizeColumn(colRaw);
  }
  return out;
}

/**
 * Persist the per-column view-state under the versioned envelope.
 * @param {{ setItem: (k: string, v: string) => void } | null | undefined} storage
 * @param {Object<string, { grouped, sort, collapsed }>} state — column → state map.
 *
 * A no-op when there is no backend (e.g. SSR / no DOM). Storage write failures
 * (quota, disabled) are swallowed — a failed PREFERENCE write must never surface
 * as a board error. Never throws.
 */
export function saveViewState(storage, state) {
  if (!storage || typeof storage.setItem !== 'function') return;
  const columns = {};
  for (const [col, colState] of Object.entries(state || {})) {
    columns[col] = normalizeColumn(colState);
  }
  try {
    storage.setItem(VIEW_STATE_KEY, JSON.stringify({ version: VIEW_STATE_VERSION, columns }));
  } catch {
    /* preference persistence is best-effort; never throw. */
  }
}

// The peek clamp's visual height target (agentic-workflow-m2v8d): the max-height a
// COLLAPSED (peeked) column body is clamped to, in pixels. This is a VISUAL height
// target of ≈3.5 average rail cards — a height clamp, NOT a node count (a long title
// may show slightly fewer/more cards; that is acceptable). Derived from the rail
// TicketCard's ~80px body + the 10px inter-card gap: 3.5 * 80 + 3 * 10 ≈ 310, rounded
// to a round target. Exported so the board and its tests share one source of truth.
export const PEEK_MAX_HEIGHT_PX = 310;

// The bottom gradient FADE height (px) the peek mask runs over — the band across which
// whatever card the clamp cuts fades to transparent toward the bottom edge.
export const PEEK_FADE_PX = 64;

/**
 * The pure CSS-style fragment that HEIGHT-CLAMPS a collapsed (peeked) column body
 * (agentic-workflow-m2v8d, replacing aw-072's drop-from-layout `visibleColumns`).
 * Given the column's `peek` boolean, returns the style props to spread onto the column
 * BODY container:
 *   - peeked  → a `maxHeight` of PEEK_MAX_HEIGHT_PX, `overflow: hidden`, and a bottom
 *     `mask-image` (+ `WebkitMaskImage`) linear-gradient fade over PEEK_FADE_PX, so the
 *     card the clamp cuts FADES out toward the bottom and NOTHING renders below the
 *     clamp. The clamp is ONE max-height on the whole body — orthogonal to grouping
 *     (it does not run per-section; sections fall where they may inside the faded
 *     region).
 *   - expanded → an EMPTY object (no clamp, no fade — the full list renders).
 *
 * Presentation-only (ADR-0017): the clamp suppresses RENDERING of the overflow only;
 * the tasks still exist on disk and survive every SSE re-projection. A task completing
 * into a collapsed Done just slots into the (still-clamped) overflow — it never
 * auto-expands. Pure + total: a non-true `peek` (false / undefined / garbage) yields
 * the expanded (empty) style; never throws.
 *
 * @param {boolean} peek — whether the column is collapsed to a peek.
 * @returns {Object} a style fragment to spread onto the column body, or {} when expanded.
 */
export function peekClampStyle(peek) {
  if (peek !== true) return {};
  const fade = `linear-gradient(to bottom, #000 0, #000 calc(100% - ${PEEK_FADE_PX}px), transparent 100%)`;
  return {
    maxHeight: PEEK_MAX_HEIGHT_PX,
    overflow: 'hidden',
    maskImage: fade,
    WebkitMaskImage: fade,
  };
}
