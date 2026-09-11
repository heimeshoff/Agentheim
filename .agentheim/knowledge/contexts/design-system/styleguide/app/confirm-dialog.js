/* ============================================================
   Agentheim — ConfirmDialog: the confirm-specific affordance
   (design-system-018)

   Composed over the Modal shell + the Button primitive: renders
   consumer-supplied title + body, plus a Cancel (neutral Button) and a
   Confirm (Button) control. The consumer owns the copy and the labels
   (the "styleguide owns look/placement, consumer owns behavior" seam —
   ds-005 Collapsible, ds-006 cornerAction, ds-015 Menu).

   Esc, scrim-click and Cancel all CANCEL (cancel = the Modal's onClose);
   Confirm invokes the consumer's onConfirm. An optional `destructive`
   flag renders the Confirm as the destructive Button (the --obligation
   tint, ADR-0016) — default Confirm stays neutral. This exists because
   the primitive's first real use (aw-048's per-card dismiss) is a
   destructive confirm.

   Authored in htm, no JSX (ADR-0005); consumes Modal + Button unforked
   across the BC boundary (ADR-0003).
   ============================================================ */
import { html } from "./html.js";
import { Modal } from "./modal.js";
import { Button } from "./button.js";

/**
 * The confirm-specific dialog.
 *
 * @param {object} props
 * @param {boolean} props.open — whether the dialog is open (forwarded to Modal).
 * @param {string} props.title — the dialog heading (consumer-owned copy).
 * @param {any} [props.children] — the dialog body / message (consumer-owned).
 * @param {() => void} props.onClose — invoked by Esc, scrim-click AND Cancel.
 *        Closing the dialog never confirms.
 * @param {() => void} props.onConfirm — invoked by the Confirm control.
 * @param {string} [props.confirmLabel="Confirm"] — the Confirm button label.
 * @param {string} [props.cancelLabel="Cancel"] — the Cancel button label.
 * @param {boolean} [props.destructive=false] — when set, the Confirm renders the
 *        destructive Button (--obligation tint). Default → a neutral Confirm.
 */
export function ConfirmDialog({
  open, title, children, onClose, onConfirm,
  confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = false,
}) {
  return html`
    <${Modal} open=${open} onClose=${onClose} ariaLabel=${title} maxWidth=${420}>
      <div style=${{ padding: "22px 24px 20px" }}>
        <h2 style=${{
          margin: "0 0 8px",
          fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600,
          lineHeight: 1.3, color: "var(--fg-1)",
        }}>${title}</h2>
        ${children && html`
          <div style=${{
            fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.55,
            color: "var(--fg-2)",
          }}>${children}</div>`}
        <div style=${{
          display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22,
        }}>
          <${Button} variant="neutral" onClick=${onClose}>${cancelLabel}<//>
          <${Button}
            variant=${destructive ? "destructive" : "neutral"}
            onClick=${onConfirm}
            autoFocus=${true}>${confirmLabel}<//>
        </div>
      </div>
    <//>`;
}
