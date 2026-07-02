/* ============================================================
   Agentheim — Kanban
   Column header + ticket card (two directions) + board.
   ============================================================ */
import { useState } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { StatusDot, StatusChip, MonoId, MetaChip } from "./primitives.js";
import { EmptyColumn } from "./empty.js";
import { doingPulseClass, dependencyRingClass } from "./motion.js";
import { showEstimate } from "./card.js";
import { STATUSES, COLUMN_ORDER, TICKETS } from "./data.js";

// Re-export so the doing-pulse decision (design-system-004 / ADR-0014) is
// reachable from the kanban surface as well as ./motion.js. Same for the
// estimate-visibility decision (design-system-006) and the dependency-ring
// decision (design-system-w4t9k / ADR-0034).
export { doingPulseClass, showEstimate, dependencyRingClass };

// ---- Column header ----
// onAdd: optional add-ticket affordance (agentic-workflow-018). Like EmptyColumn's
//   slot, the header `+` is now OPTIONAL — absent -> no `+`. The board is a
//   projection of disk (ADR-0001), so the dashboard supplies onAdd ONLY for backlog
//   (where it copies the modeling command); todo/doing/done render no `+`.
export function ColumnHeader({ status, count, onAdd }) {
  const s = STATUSES[status];
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 9,
      padding: "0 4px 12px", marginBottom: 4,
    }}>
      <${StatusDot} status=${status} size=${8} />
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
        letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--fg-2)",
      }}>${s.label}</span>
      <span style=${{
        fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)",
        fontFeatureSettings: '"tnum"',
      }}>${count}</span>
      <div style=${{ flex: 1 }} />
      ${onAdd && html`
        <button className="focusable" title="Add ticket" onClick=${onAdd} style=${{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: "var(--radius-sm)",
          border: "none", background: "transparent", color: "var(--fg-3)", cursor: "pointer",
          transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
        }}
          onMouseEnter=${(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; }}
          onMouseLeave=${(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}>
          <${Icon} name="plus" size=${15} />
        </button>`}
    </div>`;
}

// ---- Ticket card ----
// variant: "rail" (status as a colored left edge) | "badge" (status pill on top)
// cornerAction: optional render-prop for a single quiet affordance in the
//   bottom-right of the meta row (design-system-006). The styleguide owns the
//   slot's placement + isolation; the CONSUMER owns the control's look/behavior.
//   The card wraps whatever the prop returns in a propagation-stopping container
//   so activating it never bubbles to the card's own onClick (the card is a
//   button that opens the slide-over). Absent -> the card is unchanged.
// dependencyRelation: optional "waiting-on" | "holding-up" (design-system-w4t9k /
//   ADR-0034) — renders a quiet breathing ring around the card's perimeter when
//   this card is a dependency of whatever card the builder is hovering. The
//   styleguide only turns the ring on/off; detecting which card is the target
//   and the hover lifecycle is the CONSUMER's job (agentic-workflow-k5p8w).
//   Default null -> byte-identical to today.
export function TicketCard({ ticket, variant = "rail", selected = false, onClick, forceHover = false, cornerAction, dependencyRelation = null }) {
  const [hover, setHover] = useState(false);
  const s = STATUSES[ticket.status];
  const isHover = hover || forceHover;

  const base = {
    position: "relative",
    background: "var(--surface-1)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius-md)",
    padding: variant === "rail" ? "13px 14px 13px 16px" : "12px 14px 13px",
    cursor: "pointer",
    overflow: "hidden",
    transition: "border-color var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
    boxShadow: isHover ? "var(--shadow-md)" : "none",
    borderColor: isHover ? "var(--hairline-strong)" : "var(--hairline)",
  };
  // ADR-0016 / design-system-010: ordinary selection is never signalled by the
  // reserved accent. The card carries NO visual selection cue — `selected` is
  // purely semantic (aria-pressed below), so a selected card looks identical to
  // an unselected one.

  return html`
    <div className=${["focusable", dependencyRingClass(dependencyRelation)].filter(Boolean).join(" ")} tabIndex=${0} role="button" aria-pressed=${selected}
      onClick=${onClick}
      onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}
      style=${base}>

      ${variant === "rail" && html`
        <span className=${doingPulseClass(ticket.status)} style=${{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: s.color, opacity: 0.9,
        }} />`}

      <!-- Top row -->
      <div style=${{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        ${variant === "badge"
          ? html`<${StatusChip} status=${ticket.status} />`
          : html`<${MonoId} color="var(--fg-3)">${ticket.id}</${MonoId}>`}
        <div style=${{ flex: 1 }} />
        ${ticket.agent && html`
          <span title="Assigned to an agent" style=${{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 500,
            color: "var(--ct-context)",
          }}>
            <${Icon} name="bot" size=${13} color="var(--ct-context)" />
          </span>`}
        ${variant === "badge" && html`<${MonoId} color="var(--fg-3)">${ticket.id}</${MonoId}>`}
      </div>

      <!-- Title -->
      <div style=${{
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500,
        lineHeight: 1.4, color: "var(--fg-1)", marginBottom: 12,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", textWrap: "pretty",
      }}>${ticket.title}</div>

      <!-- Meta row -->
      <div style=${{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <${MetaChip} icon="folder">${ticket.context}</${MetaChip}>
        ${showEstimate(ticket.est) && html`<${MetaChip} mono>${ticket.est} pt</${MetaChip}>`}
        <div style=${{ flex: 1 }} />
        ${ticket.updated && html`<span style=${{
          fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)",
        }}>${ticket.updated}</span>`}
        ${cornerAction && html`
          <span
            onClick=${(e) => e.stopPropagation()}
            onKeyDown=${(e) => e.stopPropagation()}
            style=${{ display: "inline-flex", alignItems: "center", marginLeft: 2 }}>
            ${cornerAction()}
          </span>`}
      </div>
    </div>`;
}

// ---- Column (header + stacked cards) ----
export function Column({ status, tickets, variant, selectedId, onOpen }) {
  return html`
    <div style=${{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
      <${ColumnHeader} status=${status} count=${tickets.length} onAdd=${() => {}} />
      <div style=${{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        ${tickets.length === 0
          ? html`<${EmptyColumn} status=${status} />`
          : tickets.map((t) => html`
              <${TicketCard} key=${t.id} ticket=${t} variant=${variant}
                selected=${selectedId === t.id} onClick=${() => onOpen(t)} />`)}
      </div>
    </div>`;
}

// ---- Board ----
export function KanbanBoard({ variant = "rail", selectedId, onOpen }) {
  return html`
    <div style=${{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      ${COLUMN_ORDER.map((status) => html`
        <${Column} key=${status} status=${status} variant=${variant}
          tickets=${TICKETS.filter((t) => t.status === status)}
          selectedId=${selectedId} onOpen=${onOpen} />`)}
    </div>`;
}
