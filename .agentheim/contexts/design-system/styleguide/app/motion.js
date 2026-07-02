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
