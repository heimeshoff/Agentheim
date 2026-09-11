/* ============================================================
   Agentheim — Menu / Popover: the shared dropdown primitive
   (design-system-015)

   A trigger that toggles an anchored, dismissible floating panel of
   arbitrary menu items. Factored out of the dashboard topbar's board-
   local settings dropdown (agentic-workflow-049) so a SECOND popover
   consumer (any future settings / overflow menu) reuses it unforked
   (ADR-0003) instead of re-inventing the trigger + floating-panel +
   dismiss-on-outside-click/Esc machinery and drifting from the tokens
   — exactly the situation that warranted extracting Collapsible
   (design-system-005, captured by agentic-workflow-014).

   It owns the open/close truth, so it owns the floating panel it
   reveals: the `${open && panel}` reveal logic lives HERE, once, not
   duplicated in every consumer. The item area is body-AGNOSTIC — the
   board composes a theme toggle, a skip-permissions toggle and a Stop
   launch into it; another consumer composes anything — the same
   "styleguide owns the look/placement, consumer owns the behavior" seam
   as ds-006's cornerAction and ds-005's Collapsible.

   Controlled OR uncontrolled (the standard React resolution, ds-005):
   - UNCONTROLLED when `open` is omitted — the primitive holds the
     useState(defaultOpen). The board's settings gear runs this way: it
     owns no menu state, the primitive does.
   - CONTROLLED when `open` is supplied — the parent owns the truth; a
     toggle fires `onOpenChange` and the primitive writes NO internal
     state.

   The panel:
   - anchors to the trigger (absolutely positioned under it), aligned to
     the `align` edge (default "right" — top-right origin, the gear's
     placement);
   - elevates at `--shadow-md` (the "Popovers" elevation role named in
     the token set), on `--surface-1` with a hairline, `--radius-md`;
   - reveals with a one-frame opacity + small translate, SUPPRESSED under
     prefers-reduced-motion (a hard show, no fade) — the same contract
     the board-local dropdown carried.

   Dismissal: Escape and an outside mousedown close it; an in-panel click
   (flipping a toggle) is scoped out by the root ref so the popover
   survives in-menu interaction. The decisions are pure (menu-state.js),
   testable under `node --test` without the canvas import map.

   Authored with htm tagged templates, no JSX (ADR-0005).
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";
import { html } from "./html.js";
import {
  isControlled, isDismissKey, shouldDismissOnOutsideClick,
} from "./menu-state.js";

// Re-export the pure resolutions so consumers can import either entrypoint; the
// decisions themselves live React-free in menu-state.js (testable without the
// canvas import map).
export { isControlled, isDismissKey, shouldDismissOnOutsideClick };

/**
 * The shared menu / popover.
 *
 * @param {object} props
 * @param {(o: { open: boolean, toggle: () => void, ref: object }) => any} props.trigger
 *        — a render-prop for the trigger control. Receives the current `open`
 *        flag and a `toggle()` it must call on activation (a focusable
 *        <button>: Enter/Space activates it natively). The consumer owns the
 *        trigger's LOOK (the board passes a neutral gear that stays neutral when
 *        closed); the primitive owns the open/close TRUTH and the panel.
 * @param {boolean} [props.open] — CONTROLLED open state. When supplied the
 *        parent owns the truth; the primitive writes no internal state.
 * @param {(next: boolean) => void} [props.onOpenChange] — fired on every
 *        open/close with the NEXT value. Required for a controlled consumer;
 *        optional for an uncontrolled one that wants to observe.
 * @param {boolean} [props.defaultOpen=false] — the UNCONTROLLED initial state
 *        (ignored when `open` is supplied).
 * @param {"left"|"right"} [props.align="right"] — which trigger edge the panel
 *        aligns to (and its transform origin).
 * @param {number} [props.gap=6] — vertical offset between trigger and panel.
 * @param {number} [props.minWidth=188] — panel min width.
 * @param {string} [props.ariaLabel] — accessible label for the menu panel.
 * @param {object} [props.panelStyle] — style overrides merged onto the panel.
 * @param {object} [props.style] — style overrides merged onto the anchor wrapper.
 * @param {any} props.children — the menu items, revealed only when open.
 *        Arbitrary; the consumer composes them.
 */
export function Menu({
  trigger,
  open, onOpenChange, defaultOpen = false,
  align = "right", gap = 6, minWidth = 188,
  ariaLabel = "Menu", panelStyle, style, children,
}) {
  const controlled = isControlled(open);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : internalOpen;

  // A one-frame-delayed reveal flag drives the open transition (opacity + a
  // small translate). Under prefers-reduced-motion the panel is shown hard.
  const [shown, setShown] = useState(false);
  const rootRef = useRef(null);

  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setOpen = useCallback((next) => {
    // Uncontrolled: the primitive holds the truth, so flip it. Controlled: the
    // parent owns it — do NOT write internal state, just announce the intent.
    if (!controlled) setInternalOpen(next);
    onOpenChange && onOpenChange(next);
  }, [controlled, onOpenChange]);

  const toggle = useCallback(() => setOpen(!isOpen), [setOpen, isOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  // Esc closes; an outside mousedown closes. A click WITHIN the root (the
  // trigger or a menu item) is scoped out by the ref so the popover stays open.
  // The listeners are only attached while open, torn down on close/unmount.
  useEffect(() => {
    if (!isOpen) { setShown(false); return undefined; }
    const onKey = (e) => { if (isDismissKey(e.key)) close(); };
    const onDocDown = (e) => {
      const inside = !!(rootRef.current && rootRef.current.contains(e.target));
      if (shouldDismissOnOutsideClick(true, inside)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocDown);
    // Reveal: under reduced motion show immediately (no fade); otherwise flip
    // the reveal flag on the next frame so the transition runs.
    let raf = 0;
    if (reduce || typeof requestAnimationFrame !== "function") {
      setShown(true);
    } else {
      raf = requestAnimationFrame(() => setShown(true));
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [isOpen, reduce, close]);

  const edge = align === "left" ? { left: 0 } : { right: 0 };
  const origin = align === "left" ? "top left" : "top right";

  return html`
    <div ref=${rootRef} style=${{ position: "relative", display: "inline-flex", ...style }}>
      ${trigger({ open: isOpen, toggle, ref: rootRef })}
      ${isOpen ? html`
        <div
          role="menu"
          aria-label=${ariaLabel}
          style=${{
            position: "absolute", top: `calc(100% + ${gap}px)`, ...edge, zIndex: 20,
            minWidth, display: "flex", flexDirection: "column", gap: 8,
            padding: 10, boxSizing: "border-box",
            background: "var(--surface-1)", border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
            transformOrigin: origin,
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(-4px)",
            transition: reduce ? "none"
              : "opacity var(--duration-fast) var(--ease-base), transform var(--duration-fast) var(--ease-base)",
            ...panelStyle,
          }}>
          ${children}
        </div>` : null}
    </div>`;
}

/**
 * A token-styled menu item row wrapper — a thin <div role="menuitem"> the
 * consumer drops a focusable control into. Look/placement is the primitive's;
 * behavior is the consumer's. Optional sugar; consumers may also compose raw
 * elements directly into the Menu body.
 *
 * @param {object} props
 * @param {object} [props.style] — style overrides.
 * @param {any} props.children — the item's control.
 */
export function MenuItem({ style, children }) {
  return html`<div role="menuitem" style=${{ display: "flex", ...style }}>${children}</div>`;
}

/**
 * A 1px hairline divider between menu groups (the board separates its toggles
 * from the Stop action with one). Pure presentation.
 */
export function MenuDivider() {
  return html`<div style=${{ height: 1, background: "var(--hairline)", margin: "1px 0" }} />`;
}
