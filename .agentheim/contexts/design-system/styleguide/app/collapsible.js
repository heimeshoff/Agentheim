/* ============================================================
   Agentheim — Collapsible: the shared section primitive
   (design-system-005)

   The canonical chevron-header + revealed-body affordance, factored
   out of TreeGroup (library.js) so a SECOND consumer — the dashboard
   board's group-by-bounded-context lens (agentic-workflow-014) — can
   reuse it unforked (ADR-0003) instead of cloning a board-local copy
   that drifts from the styleguide tokens.

   It owns the open/close truth, so it owns the body it reveals: the
   `${open && body}` reveal logic lives HERE, once, not duplicated in
   every consumer. The body container is body-AGNOSTIC — TreeItem rows
   in the library, draggable TicketCards on the board — and takes a
   `bodyStyle` override so each consumer keeps its own spacing.

   Controlled OR uncontrolled (the standard React resolution):
   - CONTROLLED when `open` is supplied — the parent owns the state
     (the board drives it from persisted per-(column,BC) view-state,
     ADR-0015). A toggle fires `onToggle` and writes NO internal state.
   - UNCONTROLLED when `open` is omitted and `defaultOpen` is given —
     the primitive holds the `useState` (the original TreeGroup
     behavior). A toggle flips internal state AND still fires `onToggle`
     if one was passed.

   The header is ONE canonical look (a small redesign unifying the two
   pre-existing headers, not a pure dedup): chevron rotates to 90° when
   open, an ellipsis-truncating uppercase `--font-ui` label that takes
   `flex:1`, and a right-aligned `--font-mono` count — OR an arbitrary
   trailing slot in that position. This changes TreeGroup's header
   visually (the count moves to the right edge, the label gains
   truncation), so it reopens the styleguide gate for builder re-review.

   Authored with htm tagged templates, no JSX (ADR-0005).
   ============================================================ */
import { useState } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { isControlled } from "./collapsible-state.js";
import { attentionCueClass } from "./motion.js";

// Re-export the pure resolution so consumers can import either entrypoint; the
// decision itself lives React-free in collapsible-state.js (testable without the
// canvas import map).
export { isControlled };

/**
 * The shared collapsible section.
 *
 * @param {object} props
 * @param {string} props.label — the section label (uppercase, ellipsis-truncated).
 * @param {number|string} [props.count] — a trailing mono count; omitted when a
 *        `trailing` slot is given.
 * @param {() => any} [props.trailing] — an optional render-prop occupying the
 *        right-aligned trailing position INSTEAD of the count.
 * @param {boolean} [props.open] — CONTROLLED open state. When supplied the parent
 *        owns the truth; the primitive writes no internal state.
 * @param {(next: boolean) => void} [props.onToggle] — fired on every toggle with
 *        the NEXT open value. Required for a controlled consumer; optional for an
 *        uncontrolled one that wants to observe toggles.
 * @param {boolean} [props.defaultOpen=true] — the UNCONTROLLED initial state
 *        (ignored when `open` is supplied).
 * @param {object} [props.bodyStyle] — style overrides merged onto the revealed
 *        body container (each consumer keeps its own gap/padding).
 * @param {object} [props.style] — style overrides merged onto the outer wrapper.
 * @param {boolean} [props.attention=false] — opt-in "new item" ambient cue
 *        (design-system-v8k2p). When ON, the header carries a quiet breathing
 *        left-edge marker so an arrival under a COLLAPSED group is still visible
 *        (the consumer propagates "new" up to the parent group). OFF (default)
 *        adds no class — byte-identical to today. The detection + lifecycle is
 *        the consumer's job (agentic-workflow-n4h7q); the primitive only renders.
 * @param {any} props.children — the body, revealed only when open. Arbitrary.
 */
export function Collapsible({
  label, count, trailing,
  open, onToggle, defaultOpen = true,
  bodyStyle, style, attention = false, children,
}) {
  const controlled = isControlled(open);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    // Uncontrolled: the primitive holds the truth, so flip it. Controlled: the
    // parent owns it — do NOT write internal state, just announce the intent.
    if (!controlled) setInternalOpen(next);
    // Always announce: a controlled parent MUST hear every toggle; an
    // uncontrolled observer may also want to.
    onToggle && onToggle(next);
  };

  return html`
    <div style=${{ marginBottom: 4, ...style }}>
      <button className=${["focusable", attentionCueClass(attention)].filter(Boolean).join(" ")} onClick=${toggle} aria-expanded=${isOpen}
        style=${{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          padding: "6px 8px", border: "none", background: "transparent",
          cursor: "pointer", textAlign: "left",
        }}>
        <${Icon} name="chevron-right" size=${13} color="var(--fg-3)"
          style=${{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform var(--duration-fast) var(--ease-base)" }} />
        <span style=${{
          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>${label}</span>
        ${trailing
          ? trailing()
          : (count != null && html`<span style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)" }}>${count}</span>`)}
      </button>
      ${isOpen && html`
        <div style=${{ display: "flex", flexDirection: "column", ...bodyStyle }}>
          ${children}
        </div>`}
    </div>`;
}
