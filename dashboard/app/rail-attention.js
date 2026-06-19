/* ============================================================
   Agentheim — rail "new item" attention transform (agentic-workflow-n4h7q)

   The PURE, framework-free brain behind the left rail's "this research
   report / ADR just arrived — look here" cue. It sits ON TOP of the live
   re-projection (treeToLibrary over /api/tree, aw-008/aw-011): every SSE
   tree-changed frame re-fetches and re-projects (aw-009), and this layer
   diffs the fresh projection's research/ADR pointers against a per-SESSION
   baseline to decide which rail rows should blink.

   The blink itself is the styleguide cue (design-system-v8k2p), consumed
   UNFORKED (ADR-0003) — this module only decides WHICH paths are flagged
   and which group headers inherit the cue; the styleguide TreeItem /
   Collapsible turn the marker on from a boolean.

   Scope is RESEARCH REPORTS + ADRs only (the builder asked for those two
   knowledge-artifact kinds; BCs, concepts, the vision/map, and tasks are
   out of scope). Detection is keyed on path AND mtime:
     - CREATED  — a path absent from the session baseline, or
     - MODIFIED — a path in the baseline whose mtimeMs is NEWER than its
                  baseline value (builder decision 2026-06-19: modified
                  also blinks, not created-only).

   State is in-memory presentation state only (ADR-0017): the baseline +
   cleared maps live in the React shell, never on disk, never in
   localStorage, never via an /api write. A page reload resets the baseline
   (that IS the acknowledgement-by-reload model) so nothing is "new" on a
   fresh page.

   No React, no htm, no DOM — unit-testable under `node --test`, mirroring
   board-sort.js / board-group.js / slide-over-data.js.
   ============================================================ */

// The styleguide content `type`s (library-data.js item shape) this cue covers.
// Research reports + ADRs ONLY — every other rail kind is deliberately excluded.
const ATTENTION_TYPES = new Set(['research', 'adr']);

/** A finite-number guard so a null/absent mtime never produces a bogus comparison. */
function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Build the per-session mtime index for the rail's research/ADR pointers from a
 * /api/tree projection. Keyed by the same in-root path string the flat
 * `locations.adrs` / `locations.research` arrays use (so it lines up with each
 * library item's `path`); values are the pointer's `mtimeMs` (aw-t3b9k's parallel
 * meta maps `locations.adrsMeta` / `locations.researchMeta`), or `null` when the
 * file was unstattable.
 *
 * This is the snapshot the shell records ONCE at mount as the baseline, and the
 * same shape it recomputes every live frame to diff against it.
 *
 * @param {object|null} tree — the /api/tree JSON ({ locations: { adrs, research,
 *        adrsMeta, researchMeta } }).
 * @returns {Record<string, number|null>} path → mtimeMs (research + ADR pointers only).
 *
 * Pure + total: a null/empty/malformed tree yields `{}`; a path present in the flat
 * array but missing from the meta map degrades to `null` (never throws).
 */
export function railMtimeIndex(tree) {
  const t = tree && typeof tree === 'object' ? tree : {};
  const locations = t.locations && typeof t.locations === 'object' ? t.locations : {};
  const index = {};

  const add = (paths, meta) => {
    const list = Array.isArray(paths) ? paths : [];
    const m = meta && typeof meta === 'object' ? meta : {};
    for (const p of list) {
      if (!p) continue;
      const entry = m[p];
      index[p] = entry && typeof entry === 'object' && 'mtimeMs' in entry ? entry.mtimeMs : null;
    }
  };

  add(locations.adrs, locations.adrsMeta);
  add(locations.research, locations.researchMeta);
  return index;
}

/**
 * Decide whether a single path is currently flagged "new/attention", given the
 * live projection's mtime, the session baseline, and the cleared snapshot.
 *
 * A path is flagged when it is BOTH:
 *   - new-vs-baseline — absent from `baseline` (created), OR its `current` mtime is
 *     strictly NEWER than its baseline mtime (modified); AND
 *   - not-cleared-at-this-mtime — absent from `cleared`, OR its `current` mtime is
 *     strictly NEWER than the mtime it was cleared at (a still-newer edit re-flags).
 *
 * mtime comparisons require finite numbers on BOTH sides — a null/absent mtime can
 * never satisfy a "newer than" test, so a re-save with an unstattable mtime does not
 * spuriously re-flag (created-vs-baseline still flags on path presence alone).
 *
 * Caller is responsible for reconciliation (only call for paths present in the live
 * index) — see `flaggedPaths`.
 *
 * @returns {boolean}
 */
function isFlagged(path, current, baseline, cleared) {
  const inBaseline = Object.prototype.hasOwnProperty.call(baseline, path);
  const baseMtime = inBaseline ? baseline[path] : undefined;
  // new vs baseline: created (not in baseline) OR modified (strictly newer mtime).
  const created = !inBaseline;
  const modified = inBaseline && isFiniteNum(current) && isFiniteNum(baseMtime) && current > baseMtime;
  if (!created && !modified) return false;

  // not cleared at this mtime: a click records the mtime acknowledged; a later edit
  // (strictly newer) re-flags. A null current mtime can never beat the cleared mark.
  const inCleared = Object.prototype.hasOwnProperty.call(cleared, path);
  if (inCleared) {
    const clearedMtime = cleared[path];
    const newerThanCleared = isFiniteNum(current) && isFiniteNum(clearedMtime) && current > clearedMtime;
    if (!newerThanCleared) return false;
  }
  return true;
}

/**
 * Compute the set of rail paths currently flagged with the attention cue.
 *
 * The flagged set is ALWAYS the intersection of "created-or-modified vs baseline,
 * not cleared at this mtime" with "present in the current projection" — so a flagged
 * path whose file VANISHES (moved/removed) before being clicked silently drops out
 * (no orphaned blink, builder decision 2026-06-19). No cap: every qualifying path is
 * flagged, so a batch arriving in one frame all blink.
 *
 * @param {object} args
 * @param {Record<string, number|null>} args.index — the CURRENT railMtimeIndex.
 * @param {Record<string, number|null>} args.baseline — the session baseline index.
 * @param {Record<string, number|null>} [args.cleared] — path → mtime cleared at.
 * @returns {Set<string>} the in-root paths to flag right now.
 *
 * Pure + total: missing/malformed args degrade to empty maps; returns a Set (possibly
 * empty), never throws.
 */
export function flaggedPaths({ index, baseline, cleared } = {}) {
  const idx = index && typeof index === 'object' ? index : {};
  const base = baseline && typeof baseline === 'object' ? baseline : {};
  const cl = cleared && typeof cleared === 'object' ? cleared : {};

  const flagged = new Set();
  for (const path of Object.keys(idx)) {
    if (isFlagged(path, idx[path], base, cl)) flagged.add(path);
  }
  return flagged;
}

/**
 * Annotate the rendered rail groups with the attention cue.
 *
 * Threads a per-leaf `attention` boolean onto each `treeToLibrary` item whose path is
 * in `flaggedSet`, and DERIVES each group's `attention` (true whenever ANY of its
 * leaves is currently flagged). The group flag is what makes an arrival under a
 * COLLAPSED group still noticeable; it clears automatically once all its new leaves
 * are cleared, and re-appears if any leaf re-flags — because it is derived, never
 * stored.
 *
 * Only research/ADR ITEMS can carry the cue (ATTENTION_TYPES); other kinds always
 * render `attention: false` even if (defensively) their path collided with the set.
 * A group with no flagged research/ADR leaf gets `attention: false`.
 *
 * @param {Array<{ group: string, items: Array }>} groups — treeToLibrary output.
 * @param {Set<string>|Iterable<string>} flaggedSet — the flagged paths.
 * @returns {Array<{ group, items, attention }>} the same shape, with `attention`
 *          added to every group and every item. Returns a NEW array/objects (input
 *          never mutated). Degrades to `[]` for a non-array `groups`.
 */
export function annotateGroups(groups, flaggedSet) {
  if (!Array.isArray(groups)) return [];
  const flagged = flaggedSet instanceof Set ? flaggedSet : new Set(flaggedSet || []);

  return groups.map((g) => {
    const items = Array.isArray(g.items) ? g.items : [];
    let groupAttention = false;
    const annotated = items.map((it) => {
      const on = ATTENTION_TYPES.has(it && it.type) && flagged.has(it && it.path);
      if (on) groupAttention = true;
      return { ...it, attention: on };
    });
    return { ...g, items: annotated, attention: groupAttention };
  });
}
