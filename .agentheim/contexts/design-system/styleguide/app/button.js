/* ============================================================
   Agentheim — Button: the shared labelled-button primitive
   (design-system-018)

   The styleguide had NO shared text/label button — only the icon-only
   ghost IconButton (drawer.js). ConfirmDialog (ds-018) needs labelled
   Cancel / Confirm controls, so this task adds the missing base
   primitive rather than hand-rolling button styling inside the dialog.

   Two variants:
   - `neutral` (default) — a quiet token-composed button: --surface-1
     fill, hairline border, --fg-1 label, brightening to --surface-2 on
     hover, echoing the IconButton's hover-transition language
     (--duration-fast / --ease-base).
   - `destructive` — tinted with the --obligation danger family
     (#8C3A3A light / #B86C6C dark, --obligation-soft for the fill/hover):
     the same red aw-048's trash uses. ADR-0016 keeps danger OFF the
     reserved selection accent (the ochre), so destructive draws ONLY
     from the --obligation family.

   Presentational and stateless beyond local hover — no React-free state
   module of its own (unlike Modal's focus-trap logic). Authored in htm,
   no JSX (ADR-0005); consumed unforked across the BC boundary (ADR-0003).
   ============================================================ */
import { useState } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";

/**
 * The shared labelled button.
 *
 * @param {object} props
 * @param {"neutral"|"destructive"} [props.variant="neutral"] — the visual
 *        family. `destructive` tints from --obligation (ADR-0016 keeps danger
 *        off the reserved ochre accent).
 * @param {() => void} [props.onClick] — activation handler. A native <button>
 *        fires this on click AND on Enter/Space, so the control is keyboard-
 *        operable for free.
 * @param {"button"|"submit"} [props.type="button"] — the native button type.
 * @param {boolean} [props.autoFocus] — focus this button on mount (the dialog's
 *        Confirm uses it to land initial focus inside the panel).
 * @param {string} [props.ariaLabel] — accessible label (defaults to children).
 * @param {object} [props.style] — style overrides merged onto the button.
 * @param {any} props.children — the button label.
 */
export function Button({
  variant = "neutral", onClick, type = "button",
  autoFocus, ariaLabel, style, children,
}) {
  const [hover, setHover] = useState(false);
  const destructive = variant === "destructive";

  // Token palette per variant. Danger draws ONLY from the --obligation family
  // (ADR-0016): a soft fill, an --obligation border/label, deepening on hover.
  const base = destructive
    ? {
        background: hover ? "var(--obligation)" : "var(--obligation-soft)",
        color: hover ? "var(--surface-0)" : "var(--obligation)",
        borderColor: "var(--obligation)",
      }
    : {
        background: hover ? "var(--surface-2)" : "var(--surface-1)",
        color: "var(--fg-1)",
        borderColor: "var(--hairline-strong)",
      };

  return html`
    <button
      type=${type}
      className="focusable"
      aria-label=${ariaLabel}
      autoFocus=${autoFocus}
      onClick=${onClick}
      onMouseEnter=${() => setHover(true)}
      onMouseLeave=${() => setHover(false)}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 7, padding: "7px 14px", cursor: "pointer",
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
        lineHeight: 1.2,
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${base.borderColor}`,
        background: base.background,
        color: base.color,
        transition:
          "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
        ...style,
      }}>
      ${children}
    </button>`;
}

/**
 * The solid-ochre icon Enter button (design-system-xr4sb) — the prompt
 * console's compact submit affordance.
 *
 * Sits within ADR-0048's surface-2 "primed primary action" carve-out: the
 * button FIRES/commits the prompt the instant there is one to send, so a
 * filled --accent-ochre background is PERMITTED here (not a new accent
 * exception — ADR-0051 licenses this exact surface). Filled directly with
 * --accent-ochre (a fill, not a border/outline), the `corner-down-left`
 * ("↵") return-arrow glyph, a compact square footprint, and --radius-sm
 * corners — visibly distinct from the neutral/destructive text `Button`
 * above (padded pill, hairline border, no fill) and from the ghost
 * `IconButton` (drawer.js — transparent, hover-only, no fill).
 *
 * The glyph draws from --accent-ochre-fg, a dedicated fixed on-accent
 * foreground pair (colors_and_type.css) chosen for contrast against
 * --accent-ochre specifically — NOT the generic --fg-1/--surface-0 surface
 * tokens. --accent-ochre inverts lightness across themes (darker in light
 * theme, lighter in dark theme), the opposite of how --fg-1 flips, so
 * reusing a generic foreground token here would go illegible in one theme.
 *
 * @param {object} props
 * @param {() => void} [props.onClick] — activation handler.
 * @param {number} [props.size=34] — the square footprint, in px.
 * @param {string} [props.ariaLabel="Send"] — accessible label (icon-only, no visible text).
 */
export function EnterButton({ onClick, size = 34, ariaLabel = "Send" }) {
  return html`
    <button
      type="button"
      className="focusable"
      aria-label=${ariaLabel}
      onClick=${onClick}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, padding: 0, cursor: "pointer",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "var(--accent-ochre)",
        color: "var(--accent-ochre-fg)",
      }}>
      <${Icon} name="corner-down-left" size=${18} color="var(--accent-ochre-fg)" />
    </button>`;
}
