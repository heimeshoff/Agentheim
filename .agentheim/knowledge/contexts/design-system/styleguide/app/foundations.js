/* ============================================================
   Agentheim — brand glyph, theme context, foundations docs
   ============================================================ */
import { useState, useEffect, useContext, createContext } from "react";
import { html } from "./html.js";
import { StatusChip, TypePill } from "./primitives.js";

export const ThemeCtx = createContext("dark");

export function Glyph({ size = 22 }) {
  return html`
    <svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" style=${{ display: "block" }}>
      <rect x="1" y="1" width="22" height="22" rx="6.5" stroke="var(--accent-ochre)" strokeWidth="1.5" />
      <rect x="6.4" y="13" width="2.4" height="5" rx="1.2" fill="var(--fg-2)" />
      <rect x="10.8" y="9" width="2.4" height="9" rx="1.2" fill="var(--accent-ochre)" />
      <rect x="15.2" y="6" width="2.4" height="12" rx="1.2" fill="var(--fg-1)" />
    </svg>`;
}

export function useHex(varName) {
  const theme = useContext(ThemeCtx);
  const [hex, setHex] = useState("");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    setHex(v.toUpperCase());
  }, [varName, theme]);
  return hex;
}

// ---- Doc scaffolding ----
export function GuideSection({ index, title, desc, children }) {
  return html`
    <section style=${{ marginBottom: 72 }}>
      <div style=${{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8 }}>
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-ochre)", fontWeight: 500 }}>${index}</span>
        <h2 style=${{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 23, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>${title}</h2>
      </div>
      ${desc && html`<p style=${{ margin: "0 0 24px", maxWidth: 640, fontFamily: "var(--font-ui)", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-2)" }}>${desc}</p>`}
      ${children}
    </section>`;
}

export function SubHead({ children, style }) {
  return html`
    <div style=${{
      fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
      textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 14, ...style,
    }}>${children}</div>`;
}

export function DocCard({ children, style, pad = 24 }) {
  return html`
    <div style=${{
      background: "var(--surface-1)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-md)", padding: pad, ...style,
    }}>${children}</div>`;
}

// ---- Color swatch ----
export function Swatch({ varName, label, role, ring = false }) {
  const hex = useHex(varName);
  return html`
    <div style=${{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style=${{
        height: 56, borderRadius: "var(--radius-md)", background: `var(${varName})`,
        border: ring ? "1px solid var(--hairline-strong)" : "1px solid var(--hairline)",
      }} />
      <div>
        <div style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500, color: "var(--fg-1)" }}>${label}</div>
        <div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>${varName}</div>
        <div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 1 }}>${hex || "—"}</div>
        ${role && html`<div style=${{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", marginTop: 5, lineHeight: 1.4 }}>${role}</div>`}
      </div>
    </div>`;
}

export function SwatchGrid({ items, cols = 4 }) {
  return html`
    <div style=${{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18 }}>
      ${items.map((s) => html`<${Swatch} key=${s.varName} ...${s} />`)}
    </div>`;
}

// ---- Semantic color row (status / content type): chip + solid + tint ----
export function SemanticRow({ swatchColor, tintColor, label, token, sample }) {
  const solid = useHex(swatchColor);
  return html`
    <div style=${{ display: "flex", alignItems: "center", gap: 16, padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style=${{ width: 26, height: 26, borderRadius: "var(--radius-sm)", background: `var(${swatchColor})`, flexShrink: 0 }} />
      <div style=${{ width: 26, height: 26, borderRadius: "var(--radius-sm)", background: `var(${tintColor})`, border: "1px solid var(--hairline)", flexShrink: 0 }} />
      <div style=${{ flex: 1, minWidth: 0 }}>
        <div style=${{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 500, color: "var(--fg-1)" }}>${label}</div>
        <div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", marginTop: 1 }}>${swatchColor} · ${tintColor}</div>
      </div>
      <div style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", width: 76, textAlign: "right" }}>${solid}</div>
      <div style=${{ width: 132, display: "flex", justifyContent: "flex-end" }}>${sample}</div>
    </div>`;
}

// =====================  COLOR  =====================
export function ColorSection() {
  return html`
    <${GuideSection} index="01" title="Color"
      desc="Grays do the structural work; color is reserved for meaning. One chromatic accent (ochre) carries brand and focus. Status and content-type palettes are deliberately muted — a notch brighter than a pure neutral, so a busy board reads at a glance without becoming loud.">

      <${SubHead}>Surfaces &amp; foreground</${SubHead}>
      <${DocCard} style=${{ marginBottom: 18 }}>
        <${SwatchGrid} items=${[
          { varName: "--surface-0", label: "Surface 0", role: "Page background", ring: true },
          { varName: "--surface-1", label: "Surface 1", role: "Cards, raised rows", ring: true },
          { varName: "--surface-2", label: "Surface 2", role: "Pressed, nested", ring: true },
          { varName: "--surface-inverse", label: "Surface inverse", role: "Inverted chips" },
        ]} />
        <div style=${{ height: 18 }} />
        <${SwatchGrid} items=${[
          { varName: "--fg-1", label: "Foreground 1", role: "Primary text" },
          { varName: "--fg-2", label: "Foreground 2", role: "Secondary text" },
          { varName: "--fg-3", label: "Foreground 3", role: "Meta, placeholder" },
          { varName: "--fg-4", label: "Foreground 4", role: "Disabled, hairline-adjacent" },
        ]} />
      </${DocCard}>

      <${DocCard} style=${{ marginBottom: 26 }}>
        <${SwatchGrid} cols=${4} items=${[
          { varName: "--hairline", label: "Hairline", role: "Default 1px borders", ring: true },
          { varName: "--hairline-strong", label: "Hairline strong", role: "Dividers with weight", ring: true },
          { varName: "--accent-ochre", label: "Accent ochre", role: "Brand · focus · links" },
          { varName: "--accent-ochre-tint", label: "Accent tint", role: "Accent fill", ring: true },
        ]} />
      </${DocCard}>

      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        <div>
          <${SubHead}>Status — kanban</${SubHead}>
          <${DocCard} pad=${20}>
            <${SemanticRow} swatchColor="--st-backlog" tintColor="--st-backlog-tint" label="Backlog" sample=${html`<${StatusChip} status="backlog" />`} />
            <${SemanticRow} swatchColor="--st-todo" tintColor="--st-todo-tint" label="To do" sample=${html`<${StatusChip} status="todo" />`} />
            <${SemanticRow} swatchColor="--st-doing" tintColor="--st-doing-tint" label="Doing" sample=${html`<${StatusChip} status="doing" />`} />
            <div style=${{ marginBottom: -11 }}>
              <${SemanticRow} swatchColor="--st-done" tintColor="--st-done-tint" label="Done" sample=${html`<${StatusChip} status="done" />`} />
            </div>
          </${DocCard}>
        </div>
        <div>
          <${SubHead}>Content types — library</${SubHead}>
          <${DocCard} pad=${20}>
            <${SemanticRow} swatchColor="--ct-ticket" tintColor="--ct-ticket-tint" label="Ticket" sample=${html`<${TypePill} type="ticket" />`} />
            <${SemanticRow} swatchColor="--ct-context" tintColor="--ct-context-tint" label="Bounded context" sample=${html`<${TypePill} type="context" />`} />
            <${SemanticRow} swatchColor="--ct-vision" tintColor="--ct-vision-tint" label="Vision" sample=${html`<${TypePill} type="vision" />`} />
            <${SemanticRow} swatchColor="--ct-map" tintColor="--ct-map-tint" label="Context map" sample=${html`<${TypePill} type="map" />`} />
            <${SemanticRow} swatchColor="--ct-research" tintColor="--ct-research-tint" label="Research" sample=${html`<${TypePill} type="research" />`} />
            <div style=${{ marginBottom: -11 }}>
              <${SemanticRow} swatchColor="--ct-adr" tintColor="--ct-adr-tint" label="ADR" sample=${html`<${TypePill} type="adr" />`} />
            </div>
          </${DocCard}>
        </div>
      </div>
    </${GuideSection}>`;
}
