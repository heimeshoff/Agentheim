/* ============================================================
   Agentheim — slide-over drawer
   Animates in from the right (in-context, Notion-like).
   Two header directions: "minimal" and "contextual".
   ============================================================ */
import { useState, useEffect, Fragment } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { TypePill, StatusChip, Markdown } from "./primitives.js";
import { CONTENT_TYPES } from "./data.js";
import { isExpandControlled } from "./drawer-state.js";

// The collapsed panel width lives in the primitive; the expanded width is a
// consumer fact (rail-awareness is the consumer's, ADR-0003 unforked seam).
const COLLAPSED_WIDTH = "min(560px, 78%)";

// ---- Ghost icon button ----
export function IconButton({ name, title, onClick, size = 16, "aria-label": ariaLabel }) {
  const [hover, setHover] = useState(false);
  return html`
    <button className="focusable" title=${title} aria-label=${ariaLabel || title} onClick=${onClick}
      onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: "var(--radius-sm)",
        border: "none", cursor: "pointer",
        background: hover ? "var(--surface-2)" : "transparent",
        color: hover ? "var(--fg-1)" : "var(--fg-3)",
        transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${name} size=${size} />
    </button>`;
}

// Normalize a ticket or doc into a common shape for the drawer
export function describeItem(item) {
  if (!item) return null;
  if (item.status) {
    // ticket
    return {
      kind: "ticket", type: "ticket",
      path: `tickets/${item.id}.md`,
      id: item.id, status: item.status, title: item.title,
      context: item.context, est: item.est, agent: item.agent, updated: item.updated,
      body: item.body,
    };
  }
  return {
    kind: "doc", type: item.type,
    path: item.meta, id: null, title: item.title, body: item.body,
  };
}

// ---- Drawer header: minimal ----
export function HeaderMinimal({ info, onClose, onOpenFullScreen }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px 14px 22px", borderBottom: "1px solid var(--hairline)",
      flexShrink: 0,
    }}>
      <${TypePill} type=${info.type} />
      <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)" }}>${info.path}</span>
      <div style=${{ flex: 1 }} />
      ${onOpenFullScreen && html`<${IconButton} name="maximize" title="Open in full screen" aria-label="Open in full screen" onClick=${onOpenFullScreen} />`}
      ${onOpenFullScreen && html`<div style=${{ width: 1, height: 18, background: "var(--hairline)", margin: "0 2px" }} />`}
      <${IconButton} name="x" title="Close" onClick=${onClose} size=${17} />
    </div>`;
}

// ---- Drawer header: contextual (tinted band + meta) ----
export function HeaderContextual({ info, onClose, onOpenFullScreen }) {
  const t = CONTENT_TYPES[info.type];
  // Lead with the item's title; fall back to the path so a title-less item
  // still names itself rather than rendering a blank heading.
  const heading = info.title || info.path;
  return html`
    <div style=${{
      padding: "16px 16px 14px 22px", borderBottom: "1px solid var(--hairline)",
      background: t.tint, flexShrink: 0,
    }}>
      <div style=${{ display: "flex", alignItems: "center", gap: 10 }}>
        <${TypePill} type=${info.type} />
        ${info.kind === "ticket" && html`<${StatusChip} status=${info.status} />`}
        <div style=${{ flex: 1 }} />
        ${onOpenFullScreen && html`<${IconButton} name="maximize" title="Open in full screen" aria-label="Open in full screen" onClick=${onOpenFullScreen} />`}
        <${IconButton} name="x" title="Close" onClick=${onClose} size=${17} />
      </div>
      <h2 style=${{
        margin: "12px 0 0", paddingLeft: 1,
        fontFamily: "var(--font-ui)", fontSize: 15.5, fontWeight: 600,
        lineHeight: 1.25, color: "var(--fg-1)",
      }}>${heading}</h2>
      <div style=${{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, paddingLeft: 1 }}>
        ${info.title && html`<span style=${{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)" }}>${info.path}</span>`}
        ${info.kind === "ticket" && html`
          <${Fragment}>
            <span style=${{ color: "var(--fg-4)" }}>·</span>
            <span style=${{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-3)" }}>
              <${Icon} name="folder" size=${12} color="var(--fg-3)" />${info.context}
            </span>
            <span style=${{ color: "var(--fg-4)" }}>·</span>
            <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)" }}>updated ${info.updated}</span>
          <//>`}
      </div>
    </div>`;
}

// ---- Drawer ----
export function Drawer({ item, headerVariant = "minimal", onClose, onOpenFullScreen, expanded, onToggleExpand, expandedWidth, contained = true }) {
  const [render, setRender] = useState(!!item);
  const [shown, setShown] = useState(false);
  const [cur, setCur] = useState(item);

  // In-place expandable width (ds-020), ds-005 controlled/uncontrolled seam:
  // `expanded` defined ⇒ the consumer owns the truth (the slide-over drives it
  // and supplies its own rail-aware `expandedWidth`); omitted ⇒ the primitive
  // holds its own state. Always announce onToggleExpand; write state only when
  // uncontrolled.
  const expandControlled = isExpandControlled(expanded);
  const [selfExpanded, setSelfExpanded] = useState(false);
  const isExpanded = expandControlled ? expanded : selfExpanded;
  const toggleExpand = () => {
    if (!expandControlled) setSelfExpanded((v) => !v);
    if (onToggleExpand) onToggleExpand();
  };

  // The width transition is ambient motion; strip it to instant under
  // prefers-reduced-motion (ADR-0014 motion contract — the existing translateX
  // slide already honours it via the same media query in CSS). The transform
  // segment is left intact; only the width segment is conditional.
  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panelWidth = isExpanded && expandedWidth ? expandedWidth : COLLAPSED_WIDTH;
  const panelTransition = reduce
    ? "transform var(--duration-base) var(--ease-base)"
    : "transform var(--duration-base) var(--ease-base), width var(--duration-base) var(--ease-base)";

  useEffect(() => {
    if (item) {
      setCur(item);
      setRender(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    } else if (render) {
      setShown(false);
      const tmo = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(tmo);
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!render) return null;
  const info = describeItem(cur);

  return html`
    <div style=${{ position: "absolute", inset: 0, zIndex: 40, overflow: "hidden", borderRadius: "inherit" }}>
      <!-- Scrim -->
      <div onClick=${onClose} style=${{
        position: "absolute", inset: 0,
        background: "rgba(8,9,12,0.40)",
        opacity: shown ? 1 : 0,
        transition: "opacity var(--duration-base) var(--ease-base)",
        backdropFilter: "saturate(0.9)",
      }} />

      <!-- Panel -->
      <div className="scroll-quiet" style=${{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: panelWidth,
        background: "var(--surface-0)",
        borderLeft: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-drawer)",
        display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)",
        transition: panelTransition,
        willChange: "transform, width",
      }}>
        ${headerVariant === "contextual"
          ? html`<${HeaderContextual} info=${info} onClose=${onClose} onOpenFullScreen=${onOpenFullScreen} />`
          : html`<${HeaderMinimal} info=${info} onClose=${onClose} onOpenFullScreen=${onOpenFullScreen} />`}

        <!-- Scrollable body -->
        <div className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", padding: "30px 40px 56px" }}>
          <!-- Body-top expand chevron (ds-020): widen the panel WHERE YOU ARE.
               Sits with the content it widens, distinct from the header's
               "promote out" maximize. -->
          <div style=${{ display: "flex", justifyContent: "flex-start", marginBottom: 10, marginLeft: -6 }}>
            <${IconButton}
              name=${isExpanded ? "panel-right-close" : "panel-right-open"}
              title=${isExpanded ? "Collapse panel" : "Expand panel"}
              aria-label=${isExpanded ? "Collapse panel" : "Expand panel"}
              onClick=${toggleExpand} />
          </div>
          <${Markdown} source=${info.body} />
        </div>
      </div>
    </div>`;
}
