/* ============================================================
   Agentheim — foundations part 2
   Typography, spacing, radii, elevation, iconography.
   ============================================================ */
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { GuideSection, SubHead, DocCard } from "./foundations.js";
import { CONTENT_TYPES } from "./data.js";

// ---- Type specimen row ----
function TypeRow({ sample, role, spec, sampleStyle }) {
  return html`
    <div style=${{ display: "flex", alignItems: "baseline", gap: 24, padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style=${{ flex: 1, minWidth: 0, ...sampleStyle }}>${sample}</div>
      <div style=${{ width: 150, flexShrink: 0 }}>
        <div style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500, color: "var(--fg-2)" }}>${role}</div>
        <div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>${spec}</div>
      </div>
    </div>`;
}

export function TypographySection() {
  return html`
    <${GuideSection} index="02" title="Typography"
      desc="Two families. Inter Tight carries the interface; JetBrains Mono carries every number, ticket ID, and ADR identifier. A separate, larger reading scale is tuned for long-form markdown so ADRs and research notes stay comfortable over many screens.">

      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginBottom: 26 }}>
        <${DocCard}>
          <${SubHead}>Interface — Inter Tight</${SubHead}>
          <div style=${{ marginTop: -4, marginBottom: -16 }}>
            <${TypeRow} role="Heading 1" spec="23px · 600" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 23, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>Zero to oriented</span>`} />
            <${TypeRow} role="Heading 2" spec="18px · 500" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 500, color: "var(--fg-1)" }}>Bounded contexts</span>`} />
            <${TypeRow} role="Body" spec="14px · 400" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--fg-1)" }}>The folder is the source of truth.</span>`} />
            <${TypeRow} role="Body small" spec="13px · 400" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)" }}>Read-first lens over agent files.</span>`} />
            <${TypeRow} role="Label" spec="11px · 600 · caps" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-3)" }}>Workspace</span>`} />
          </div>
        </${DocCard}>

        <${DocCard}>
          <${SubHead}>Reading scale — markdown</${SubHead}>
          <div style=${{ marginTop: -4, marginBottom: -16 }}>
            <${TypeRow} role="Prose H1" spec="27px · 600" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>ADR-0007</span>`} />
            <${TypeRow} role="Prose H2" spec="20px · 600" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)" }}>Decision</span>`} />
            <${TypeRow} role="Prose body" spec="15.5px · 1.72" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 15.5, lineHeight: 1.5, color: "var(--fg-1)" }}>Writes append domain events.</span>`} />
            <${TypeRow} role="Inline code" spec="mono · 0.86em" sample=${html`<span><span style=${{ fontFamily: "var(--font-ui)", fontSize: 15.5, color: "var(--fg-1)" }}>replay </span><code style=${{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--code-bg)", border: "1px solid var(--code-border)", borderRadius: 4, padding: "1px 6px", color: "var(--fg-1)" }}>InvoiceEvent</code></span>`} />
            <${TypeRow} role="Link" spec="accent ochre" sample=${html`<span style=${{ fontFamily: "var(--font-ui)", fontSize: 15.5, color: "var(--accent-ochre)", borderBottom: "1px solid color-mix(in oklab, var(--accent-ochre) 40%, transparent)" }}>context map</span>`} />
          </div>
        </${DocCard}>
      </div>

      <${DocCard}>
        <${SubHead}>Monospace — JetBrains Mono · numerals, identifiers, code</${SubHead}>
        <div style=${{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
          <div>
            <div style=${{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--fg-1)", fontFeatureSettings: '"tnum","zero"' }}>AGH-128</div>
            <div style=${{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>Ticket ID</div>
          </div>
          <div style=${{ width: 1, height: 38, background: "var(--hairline)" }} />
          <div>
            <div style=${{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--fg-1)", fontFeatureSettings: '"tnum","zero"' }}>ADR-0007</div>
            <div style=${{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>Decision record</div>
          </div>
          <div style=${{ width: 1, height: 38, background: "var(--hairline)" }} />
          <div>
            <div style=${{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--fg-1)", fontFeatureSettings: '"tnum","zero"' }}>0123456789</div>
            <div style=${{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>Tabular · slashed zero</div>
          </div>
          <div style=${{ width: 1, height: 38, background: "var(--hairline)" }} />
          <div>
            <div style=${{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--fg-1)" }}>p95 · 96ms</div>
            <div style=${{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>Inline metric</div>
          </div>
        </div>
      </${DocCard}>
    </${GuideSection}>`;
}

// =====================  SPACING / RADII / ELEVATION  =====================
const SPACE_STEPS = [
  ["--space-1", 4], ["--space-2", 8], ["--space-3", 12], ["--space-4", 16],
  ["--space-5", 24], ["--space-6", 32], ["--space-7", 48], ["--space-8", 64], ["--space-9", 96],
];

export function SpacingSection() {
  return html`
    <${GuideSection} index="03" title="Spacing, radii &amp; elevation"
      desc="A 4px base unit. The system leans into the larger steps for breathing room around content and tightens to the smaller steps inside dense board columns. Radii are small and consistent; elevation is rare — reserved mainly for the drawer lifting above the board.">

      <div style=${{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 26, marginBottom: 26 }}>
        <${DocCard}>
          <${SubHead}>Spacing scale</${SubHead}>
          <div style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
            ${SPACE_STEPS.map(([name, px]) => html`
              <div key=${name} style=${{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style=${{ width: 64, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>${name.replace("--", "")}</span>
                <div style=${{ height: 14, width: px, background: "var(--accent-ochre)", opacity: 0.85, borderRadius: 2 }} />
                <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>${px}px</span>
              </div>`)}
          </div>
        </${DocCard}>

        <${DocCard}>
          <${SubHead}>Radii</${SubHead}>
          <div style=${{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            ${[["--radius-sm", "4px", "Chips, inputs"], ["--radius-md", "8px", "Cards, drawer"], ["--radius-none", "0", "Tables, hairlines"]].map(([v, px, role]) => html`
              <div key=${v} style=${{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                <div style=${{ width: 70, height: 56, background: "var(--surface-2)", border: "1px solid var(--hairline-strong)", borderRadius: `var(${v})` }} />
                <div style=${{ textAlign: "center" }}>
                  <div style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>${px}</div>
                  <div style=${{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>${role}</div>
                </div>
              </div>`)}
          </div>
        </${DocCard}>
      </div>

      <${DocCard}>
        <${SubHead}>Elevation</${SubHead}>
        <div style=${{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          ${[["--shadow-sm", "Card hover"], ["--shadow-md", "Popovers"], ["--shadow-lg", "Modals"], ["--shadow-drawer", "Slide-over drawer"]].map(([v, role]) => html`
            <div key=${v} style=${{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <div style=${{ width: 132, height: 64, background: "var(--surface-0)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", boxShadow: `var(${v})` }} />
              <div style=${{ textAlign: "center" }}>
                <div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)" }}>${v.replace("--", "")}</div>
                <div style=${{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>${role}</div>
              </div>
            </div>`)}
        </div>
      </${DocCard}>
    </${GuideSection}>`;
}

// =====================  ICONOGRAPHY  =====================
export function IconSection() {
  const ui = ["square-kanban", "library", "search", "plus", "folder", "chevron-right", "x", "copy", "square-arrow-out-up-right", "bot", "inbox", "arrow-right", "folder-git-2", "settings-2", "trash-2", "lightbulb", "message-circle-question", "chevrons-up", "chevrons-down"];
  return html`
    <${GuideSection} index="04" title="Iconography"
      desc="Lucide at a uniform 1.5px stroke. Icons match surrounding text color in chrome, but content-type icons carry their type's color — the one place an icon is allowed to be chromatic, because color is the fastest way to tell a README from an ADR.">

      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        <${DocCard}>
          <${SubHead}>Interface set · 1.5px · monochrome</${SubHead}>
          <div style=${{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            ${ui.map((n) => html`
              <div key=${n} title=${n} style=${{ display: "flex", alignItems: "center", justifyContent: "center", height: 40, border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)", color: "var(--fg-2)", background: "var(--surface-0)" }}>
                <${Icon} name=${n} size=${17} />
              </div>`)}
          </div>
        </${DocCard}>

        <${DocCard}>
          <${SubHead}>Content-type set · colored by token</${SubHead}>
          <div style=${{ display: "flex", flexDirection: "column", gap: 12 }}>
            ${Object.entries(CONTENT_TYPES).map(([key, t]) => html`
              <div key=${key} style=${{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style=${{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: t.tint }}>
                  <${Icon} name=${t.icon} size=${17} color=${t.color} />
                </div>
                <span style=${{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)" }}>${t.label}</span>
                <div style=${{ flex: 1 }} />
                <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>${t.icon}</span>
              </div>`)}
          </div>
        </${DocCard}>
      </div>
    </${GuideSection}>`;
}
