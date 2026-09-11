/* ============================================================
   Agentheim — Modal: the shared centered scrim-backed shell
   (design-system-018)

   A generic centered-panel-over-scrim shell — the reusable chrome a
   ConfirmDialog (and any future centered dialog) composes over. It is
   the CENTERED sibling of the Drawer's machinery (drawer.js, ds-001):
   it borrows the Drawer's proven bits — the `window` keydown-Escape
   listener, the scrim `onClick`, the requestAnimationFrame shown-flag
   reveal toggle, and the 200ms unmount delay — but three things differ
   deliberately:

   1. PLACEMENT. The Drawer is a *contained* overlay (position:absolute;
      inset:0; z-index:40, scoped to its pane, sliding from the right).
      The Modal is `position:fixed`, centered on the whole VIEWPORT, and
      stacks ABOVE the Drawer (a z-index above the Drawer's 40) so a
      Modal opened over a slide-over is not occluded.
   2. REVEAL. The Drawer slides (translateX). A centered panel can't
      slide, so the Modal reveal is fade + slight scale-up
      (scale(0.97) → scale(1) with opacity, over --duration-base /
      --ease-base). STRIPPED under prefers-reduced-motion to a hard show
      (ADR-0014's strip-to-plain contract; the same as the Menu's
      one-frame reveal).
   3. FOCUS TRAP. The Drawer has none. The Modal moves focus into the
      panel on open, keeps Tab / Shift-Tab contained while open (the
      wrap math lives in modal-state.js), and returns focus to the
      trigger on close.

   The scrim reuses the Drawer's EXACT dim — rgba(8,9,12,0.40) — verbatim
   (there is no --scrim token; the Drawer hard-codes this value) for a
   consistent backdrop. Body content is arbitrary (the body-agnostic seam
   of Menu / Collapsible — ds-015 / ds-005).

   Authored in htm tagged templates, no JSX shipped (ADR-0005); consumed
   unforked across the BC boundary (ADR-0003). The pure dismiss/trap
   decisions live React-free in modal-state.js.
   ============================================================ */
import { useState, useEffect, useRef } from "react";
import { html } from "./html.js";
import { isDismissKey, isTrapKey, nextTrapFocusIndex } from "./modal-state.js";

// Re-export the pure resolutions so consumers can import either entrypoint; the
// decisions themselves live React-free in modal-state.js (testable without the
// canvas import map).
export { isDismissKey, isTrapKey, nextTrapFocusIndex };

// The tab-focusable elements within a container, in document order. Used by the
// trap to know what to cycle between and where focus currently sits.
const FOCUSABLE_SELECTOR = [
  "a[href]", "button:not([disabled])", "textarea:not([disabled])",
  "input:not([disabled])", "select:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusablesIn(el) {
  if (!el || typeof el.querySelectorAll !== "function") return [];
  return Array.from(el.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * The centered scrim-backed shell.
 *
 * @param {object} props
 * @param {boolean} props.open — whether the modal is open. Driven by the
 *        consumer (the seam the ConfirmDialog forwards). A close triggers the
 *        200ms unmount delay so the reveal can reverse.
 * @param {() => void} props.onClose — invoked on Esc AND scrim-click. The
 *        consumer owns what closing means.
 * @param {string} [props.ariaLabel] — accessible label for the dialog.
 * @param {number} [props.maxWidth=420] — panel max width.
 * @param {object} [props.panelStyle] — style overrides merged onto the panel.
 * @param {any} props.children — arbitrary panel body (the body-agnostic seam).
 */
export function Modal({
  open, onClose, ariaLabel = "Dialog", maxWidth = 420, panelStyle, children,
}) {
  const [render, setRender] = useState(!!open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef(null);
  // The element focused when the modal opened — focus returns here on close.
  const returnFocusRef = useRef(null);

  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mount/unmount with the Drawer's reveal pattern: on open, render then flip the
  // shown flag (next frame, or immediately under reduced motion) so the fade +
  // scale-up transition runs; on close, drop shown and unmount after 200ms so the
  // reveal reverses before teardown.
  useEffect(() => {
    if (open) {
      setRender(true);
      if (reduce || typeof requestAnimationFrame !== "function") {
        setShown(true);
        return undefined;
      }
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const tmo = setTimeout(() => setRender(false), 200);
    return () => clearTimeout(tmo);
  }, [open, reduce]);

  // Capture the trigger on open and move focus INTO the panel; restore focus to
  // the trigger on close. The capture happens before focus moves so the dialog
  // returns the user exactly where they were.
  useEffect(() => {
    if (!open) return undefined;
    if (typeof document !== "undefined") {
      returnFocusRef.current = document.activeElement;
    }
    // Land initial focus inside the panel (first focusable, else the panel).
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => {
          const items = focusablesIn(panelRef.current);
          if (items.length) items[0].focus();
          else if (panelRef.current) panelRef.current.focus();
        })
      : 0;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      const back = returnFocusRef.current;
      if (back && typeof back.focus === "function") back.focus();
    };
  }, [open]);

  // Esc dismisses (delegated to the pure predicate); Tab / Shift-Tab cycle stays
  // contained within the panel (the wrap math is delegated to nextTrapFocusIndex).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (isDismissKey(e.key)) { onClose(); return; }
      if (!isTrapKey(e.key)) return;
      const items = focusablesIn(panelRef.current);
      if (!items.length) { e.preventDefault(); return; }
      const active = typeof document !== "undefined" ? document.activeElement : null;
      const activeIndex = items.indexOf(active);
      const next = nextTrapFocusIndex(items.length, activeIndex, e.shiftKey);
      if (next >= 0) {
        e.preventDefault();
        items[next].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;

  return html`
    <div
      style=${{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, boxSizing: "border-box",
      }}>
      <!-- Scrim: the Drawer's exact dim, reused verbatim (no --scrim token) -->
      <div onClick=${onClose} style=${{
        position: "absolute", inset: 0,
        background: "rgba(8,9,12,0.40)",
        opacity: shown ? 1 : 0,
        transition: reduce ? "none" : "opacity var(--duration-base) var(--ease-base)",
        backdropFilter: "saturate(0.9)",
      }} />

      <!-- Panel: centered, fade + scale-up, full focus trap -->
      <div
        ref=${panelRef}
        role="dialog"
        aria-modal="true"
        aria-label=${ariaLabel}
        tabIndex=${-1}
        style=${{
          position: "relative",
          width: "100%", maxWidth,
          background: "var(--surface-1)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
          opacity: shown ? 1 : 0,
          transform: shown ? "scale(1)" : "scale(0.97)",
          transition: reduce ? "none"
            : "opacity var(--duration-base) var(--ease-base), transform var(--duration-base) var(--ease-base)",
          willChange: "opacity, transform",
          ...panelStyle,
        }}>
        ${children}
      </div>
    </div>`;
}
