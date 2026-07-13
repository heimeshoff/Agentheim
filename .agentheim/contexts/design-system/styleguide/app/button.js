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
import { useState, useRef, useEffect, useCallback } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import {
  initialHighlightIndex, nextHighlightIndex, arrowDirection,
  isSelectKey, isDismissKey, widestOptionLength,
} from "./button-state.js";

// Re-export the pure resolutions so consumers can import either entrypoint; the
// decisions themselves live React-free in button-state.js (testable without the
// canvas import map).
export {
  initialHighlightIndex, nextHighlightIndex, arrowDirection,
  isSelectKey, isDismissKey, widestOptionLength,
};

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
 * @param {boolean} [props.disabled=false] — when true, forwarded to the underlying
 *        <button> as the real `disabled` attribute (design-system-tfhn6), so the
 *        control leaves the tab order and cannot be activated by click or keyboard —
 *        not a consumer-side `pointer-events` fake, which would leave the button
 *        focusable and announcing as enabled. Painted as de-emphasis by `opacity`
 *        (ADR-0016), never a fill swap: the --accent-ochre fill and --accent-ochre-fg
 *        glyph are a contrast-matched pair (see above) and stay untouched, literal,
 *        in both branches.
 */
export function EnterButton({ onClick, size = 34, ariaLabel = "Send", disabled = false }) {
  return html`
    <button
      type="button"
      className="focusable"
      aria-label=${ariaLabel}
      disabled=${disabled}
      onClick=${onClick}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "var(--accent-ochre)",
        color: "var(--accent-ochre-fg)",
      }}>
      <${Icon} name="corner-down-left" size=${18} color="var(--accent-ochre-fg)" />
    </button>`;
}

/**
 * ModelSplitButton — the ochre EnterButton WIDENED into a labelled split
 * button (design-system-r9dtm): the prompt console's launch affordance,
 * now carrying which model the session will run on plus a caret that opens
 * a menu to change it.
 *
 * ONE ochre surface, one hairline divider — NOT a second neutral button
 * beside the ochre one. ADR-0048 licenses ochre on the primed primary
 * action (surface 2, restated by ADR-0051); the caret region is part of
 * that SAME primed action, so it stays on the ochre surface rather than
 * reading as a second action of different weight. `EnterButton` above is
 * unchanged and stays exported for any other icon-only caller.
 *
 * The model LIST is never this component's to know — it arrives as
 * `options` (an array of labels); the styleguide has no idea which model
 * names Agentheim actually offers.
 *
 * Keyboard model: a ROVING-TABINDEX menu, a third distinct focus model
 * from Menu's (ds-015) and SearchField's (ds-016) — see button-state.js's
 * header note. The caret is a real, Tab-reachable trigger (Enter/Space
 * open it natively, a native <button> firing `click`); once open, focus
 * moves onto the highlighted `menuitemradio` row, ArrowUp/ArrowDown move
 * it (clamped, no wraparound), Enter selects and closes, Escape closes and
 * returns focus to the caret (no keyboard trap, WCAG 2.1.2).
 *
 * @param {object} props
 * @param {string} props.label — the current model's label, shown beside the glyph.
 * @param {() => void} [props.onClick] — fires on the PRIMARY region only (the
 *        launch) — never on caret activation.
 * @param {(open: boolean) => void} [props.onOpenMenu] — fires with the next
 *        open state whenever the caret toggles the menu — never on primary
 *        activation.
 * @param {string[]} [props.options=[]] — the selectable model labels. Body-
 *        agnostic: the consumer supplies the list.
 * @param {string} [props.value] — the currently selected option (rendered
 *        `aria-checked` on its menu row).
 * @param {(option: string) => void} [props.onSelect] — fires when a menu
 *        item is chosen (click or Enter).
 * @param {boolean} [props.locked=false] — renders NO caret region and no menu
 *        at all — absent, not merely disabled (the Quick Capture pinned-model
 *        case). The primary region still launches.
 * @param {boolean} [props.disabled=false] — both regions non-interactive at
 *        0.55 opacity, matching `EnterButton`'s existing disabled treatment.
 * @param {string} [props.ariaLabel="Send"] — accessible label for the primary region.
 * @param {boolean} [props.defaultOpen=false] — render with the menu already
 *        open (mirrors `Menu`'s `defaultOpen` idiom, ds-015) — used by the
 *        canvas's menu-open specimen.
 * @param {number} [props.size=34] — the fixed height of both regions, in px
 *        (matches `EnterButton`'s square footprint on the vertical axis).
 */
export function ModelSplitButton({
  label, onClick, onOpenMenu, options = [], value, onSelect,
  locked = false, disabled = false, ariaLabel = "Send", defaultOpen = false, size = 34,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [highlight, setHighlight] = useState(() => initialHighlightIndex(options, value));
  const rootRef = useRef(null);
  const caretRef = useRef(null);
  const itemRefs = useRef([]);

  const canOpenMenu = !locked && !disabled;

  const setMenuOpen = useCallback((next) => {
    setOpen(next);
    onOpenMenu && onOpenMenu(next);
  }, [onOpenMenu]);

  const closeAndRefocus = useCallback(() => {
    setMenuOpen(false);
    caretRef.current && caretRef.current.focus();
  }, [setMenuOpen]);

  // Opening the menu starts the highlight at the current value and moves
  // focus onto that row (roving tabindex, not aria-activedescendant — see
  // the module docblock above). An outside mousedown closes + refocuses,
  // matching the Menu/SearchField outside-click convention.
  useEffect(() => {
    if (!open) return undefined;
    const idx = initialHighlightIndex(options, value);
    setHighlight(idx);
    const item = itemRefs.current[idx];
    item && item.focus();
    const onDocDown = (e) => {
      const inside = !!(rootRef.current && rootRef.current.contains(e.target));
      if (!inside) closeAndRefocus();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, options, value, closeAndRefocus]);

  const onCaretClick = () => {
    if (!canOpenMenu) return;
    setMenuOpen(!open);
  };

  const selectAt = (index) => {
    const opt = options[index];
    if (opt !== undefined) onSelect && onSelect(opt);
    closeAndRefocus();
  };

  const onItemKeyDown = (e, index) => {
    const dir = arrowDirection(e.key);
    if (dir) {
      e.preventDefault();
      const next = nextHighlightIndex(index, options.length, dir);
      setHighlight(next);
      const item = itemRefs.current[next];
      item && item.focus();
      return;
    }
    if (isSelectKey(e.key)) {
      e.preventDefault();
      selectAt(index);
      return;
    }
    if (isDismissKey(e.key)) {
      e.preventDefault();
      closeAndRefocus();
    }
  };

  const labelMinWidth = widestOptionLength(options);

  return html`
    <div ref=${rootRef} style=${{ position: "relative", display: "inline-flex" }}>
      <div style=${{
        display: "inline-flex", alignItems: "stretch",
        borderRadius: "var(--radius-sm)", overflow: "hidden",
        background: "var(--accent-ochre)",
        opacity: disabled ? 0.55 : 1,
      }}>
        <button
          type="button"
          className="focusable"
          aria-label=${ariaLabel}
          disabled=${disabled}
          onClick=${() => { if (!disabled) onClick && onClick(); }}
          style=${{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: size, padding: "0 12px", boxSizing: "border-box",
            cursor: disabled ? "default" : "pointer",
            border: "none", background: "transparent",
            color: "var(--accent-ochre-fg)",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
          }}>
          <${Icon} name="corner-down-left" size=${18} color="var(--accent-ochre-fg)" />
          <span style=${{ minWidth: `${labelMinWidth}ch`, textAlign: "left" }}>${label}</span>
        </button>
        ${!locked ? html`
          <div aria-hidden="true" style=${{
            width: 1, alignSelf: "stretch", margin: "6px 0",
            background: "var(--accent-ochre-fg)", opacity: 0.35,
          }} />
          <button
            ref=${caretRef}
            type="button"
            className="focusable"
            aria-label="Change model"
            aria-haspopup="menu"
            aria-expanded=${open}
            disabled=${disabled}
            onClick=${onCaretClick}
            style=${{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: Math.round(size * 0.7), height: size, padding: 0,
              cursor: disabled ? "default" : "pointer",
              border: "none", background: "transparent", color: "var(--accent-ochre-fg)",
            }}>
            <${Icon} name="chevron-down" size=${14} color="var(--accent-ochre-fg)" />
          </button>` : null}
      </div>
      ${open && !locked ? html`
        <div role="menu" aria-label="Model" style=${{
          position: "absolute", top: `calc(100% + 6px)`, right: 0, zIndex: 20,
          minWidth: 140, display: "flex", flexDirection: "column", gap: 2,
          padding: 6, boxSizing: "border-box",
          background: "var(--surface-1)", border: "1px solid var(--hairline)",
          borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
        }}>
          ${options.map((opt, i) => html`
            <div
              key=${opt}
              ref=${(el) => { itemRefs.current[i] = el; }}
              role="menuitemradio"
              aria-checked=${opt === value}
              tabIndex=${i === highlight ? 0 : -1}
              onKeyDown=${(e) => onItemKeyDown(e, i)}
              onClick=${() => selectAt(i)}
              style=${{
                padding: "6px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: i === highlight ? "var(--surface-2)" : "transparent",
                color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 13,
              }}>
              ${opt}
            </div>`)}
        </div>` : null}
    </div>`;
}
