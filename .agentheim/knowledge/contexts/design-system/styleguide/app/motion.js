/* ============================================================
   Agentheim — motion helpers
   Framework-free (no React) so the load-bearing decisions are
   testable under `node --test` without the canvas import map.
   ============================================================ */

/**
 * The ambient "actively working" pulse (design-system-004).
 *
 * Returns the CSS hook class for a card's status rail. The pulse is keyed
 * strictly off `status === "doing"` — NOT the `agent` field: "in the doing
 * column" is the honest signal for actively-worked, since the dashboard reads
 * disk state (which folder a task sits in), not whether a worker process is
 * live this second. Motion (not just the ochre hue) now carries the status
 * signal — see ADR-0014. The animation itself, its ochre-only glow, and the
 * `prefers-reduced-motion` strip-to-plain contract live in the CSS
 * (`styles/agentheim.css` + the `--duration-ambient` token in
 * `styles/colors_and_type.css`); this returns only the class that turns it on.
 *
 * @param {string} status — a ticket status ("backlog" | "todo" | "doing" | "done").
 * @returns {string} the pulse class for doing cards, otherwise "".
 */
export function doingPulseClass(status) {
  return status === "doing" ? "ticket-rail--pulse" : "";
}

/**
 * The "new item" attention cue (design-system-v8k2p) — sibling of the doing-card
 * pulse above. Returns the CSS hook class that makes a rail row (TreeItem) or a
 * group header (Collapsible) carry a quiet ambient "this just arrived — look
 * here" marker. It is OPT-IN and default-OFF: an absent/falsy flag returns "" so
 * an unflagged surface renders byte-identical to today.
 *
 * Detecting WHICH rows are new and the until-acknowledged lifecycle (clear on
 * click / reload, propagate "new" up to a collapsed group's header) is the
 * CONSUMER's job (agentic-workflow-n4h7q) — this styleguide half only turns the
 * cue on or off from a boolean. The marker itself stays inside the quiet-by-
 * default law (ADR-0014): low amplitude, drawn ONLY from the existing --st-todo
 * status token (the "incoming/new work" hue — NOT the reserved selection accent
 * --accent-ochre-soft, ADR-0016, and not a new hue). The breathe keyframes, the
 * --duration-attention token, and the reduced-motion strip-to-static-marker
 * contract live in the CSS (`styles/agentheim.css` + `styles/colors_and_type.css`);
 * this returns only the class that turns it on.
 *
 * @param {boolean} [isNew] — true when the row/header should draw the eye.
 * @returns {string} the attention class when flagged, otherwise "".
 */
export function attentionCueClass(isNew) {
  return isNew ? "rail-attention" : "";
}

/**
 * The dependency-relation ring (design-system-w4t9k) — a THIRD ambient signal,
 * sibling to the doing-pulse and the attention dot above, but a card-PERIMETER
 * treatment rather than a rail one (see ADR-0034): a hovered card's target can
 * simultaneously be actively-doing (rail pulse) or freshly-arrived (rail
 * attention dot), so a third rail-based cue would collide with one of those.
 *
 * Direction is carried by an orthogonal LINE-STYLE channel on ONE dedicated
 * hue (--rel-dep) rather than a second color: "waiting-on" (the card is a
 * dependency the hovered card is waiting on) renders a SOLID breathing ring;
 * "holding-up" (the card is blocked ON the hovered card) renders a DASHED
 * breathing ring, same hue. This breaks the ADR-0029 precedent of reusing an
 * existing status token — a dependency relation is not a status, so it earns
 * its own token (ADR-0034).
 *
 * Detection of which cards are hover targets and the hover lifecycle is the
 * CONSUMER's job (agentic-workflow-k5p8w) — this only turns the ring on/off
 * from a relation string. The breathe keyframes, the --rel-dep / --rel-dep-tint
 * tokens, the --duration-relation token, and the reduced-motion
 * strip-loop-but-keep-the-ring contract live in the CSS (`styles/agentheim.css`
 * + `styles/colors_and_type.css`); this returns only the class(es) that turn
 * it on.
 *
 * @param {string} [relation] — "waiting-on" | "holding-up" | null | undefined.
 * @returns {string} the ring class(es) for a known relation, otherwise "".
 */
export function dependencyRingClass(relation) {
  if (relation === "waiting-on") return "rel-ring rel-ring--waiting-on";
  if (relation === "holding-up") return "rel-ring rel-ring--holding-up";
  return "";
}

/**
 * The hidden/off-viewport dependency PRESENCE marker (design-system-b7n2s) — a
 * sibling mechanism to the on-card ring above (ADR-0034 pt. 6), not a variant
 * of it or of the rail attention dot (ADR-0029). Says "a highlighted
 * dependency target is present but not visible right now" on a COLLAPSED
 * `Collapsible` header or any other arbitrary element (the Done column's
 * height-clamped collapse control, which is not a `Collapsible`).
 *
 * Reuses --rel-dep / --duration-relation (one shared visual language across
 * "pulsing on the card" and "present but hidden") but renders a HOLLOW
 * (border-only) breathing dot — deliberately distinct from the FILLED
 * --st-todo attention dot (ADR-0029) so "a dependency is hidden here" never
 * reads as "a new item is here." Direction-agnostic on purpose: a collapsed
 * group can hold BOTH waiting-on and holding-up targets at once, so one
 * marker meaning "expand to see" is enough — direction stays on the on-card
 * ring, not duplicated onto every group header.
 *
 * A SEPARATE opt-in flag from `attention`/`attentionCueClass` — different
 * meaning, different lifecycle, and (in the CSS) a different pseudo-element,
 * so both may be applied to the same header at once without collision. The
 * breathe keyframes, the hollow-border treatment, and the reduced-motion
 * strip-loop-but-keep-the-marker contract live in the CSS
 * (`styles/agentheim.css`); this returns only the class that turns it on.
 *
 * @param {boolean} [present] — true when a highlighted dependency target is
 *        hidden inside the collapsed section / off-screen behind this control.
 * @returns {string} the marker class when flagged, otherwise "".
 */
export function dependencyPresentClass(present) {
  return present ? "rel-present" : "";
}

/**
 * The off-viewport edge-blink — a PRIMITIVE only, no new component
 * (design-system-b7n2s). Mirrors the ADR-0003 "styleguide owns look/mechanics,
 * consumer owns placement" seam used for `cornerAction` (ds-006): the
 * styleguide ships the CSS (`.rel-edge-blink` + a direction modifier +
 * `@keyframes rel-edge-blink-breathe`) and this direction-aware helper; the
 * board (`agentic-workflow-h9v3m`) builds and places the actual small edge
 * indicator (e.g. a `--rel-dep`-tinted chevron `Icon` pinned to its own
 * scroll container's edge) using its own scroll geometry — the styleguide
 * doesn't know the scroll container exists.
 *
 * Reuses --rel-dep / --duration-relation, same shared visual language as the
 * on-card ring and the hidden-dependency marker above.
 *
 * @param {string} [edge] — "top" | "bottom".
 * @returns {string} the edge-blink class(es) for a known edge, otherwise "".
 */
export function edgeBlinkClass(edge) {
  if (edge === "top") return "rel-edge-blink rel-edge-blink--top";
  if (edge === "bottom") return "rel-edge-blink rel-edge-blink--bottom";
  return "";
}
