/* ============================================================
   Agentheim — dashboard modeling-command string builders (agentic-workflow-016,
   extended by aw-020 and aw-022)

   Pure, framework-free builders for the exact Claude Code command strings the
   board's backlog affordances launch (VS Code bridge, ADR-0018) — and copy to the
   clipboard on the bridge-absent fallback. The board stays a projection of disk
   (ADR-0001) — these add no lifecycle write, only the launch/clipboard
   side-effect; each string is a pure function of the ticket id.

   No React, no htm, no DOM, no clipboard, so they are unit-testable under
   `node --test`, mirroring board-sort.js / board-data.js. The React wiring (the
   cornerAction buttons + the column launch pair) and the window.fetch / clipboard
   side-effects live in board.js / bridge-launch.js as integration glue around this.

   The command text is the FULLY-QUALIFIED `/agentheim:modeling` (confirmed with
   the builder, aw-016), NOT the bare `/modeling` alias, so the launch/paste
   resolves regardless of the builder's alias setup.

   - Backlog COLUMN affordance (aw-020): the bare `/agentheim:modeling`
     (MODELING_COMMAND) and `/agentheim:quick-capture` (QUICK_CAPTURE_COMMAND).
   - Backlog CARD affordance (aw-022): a per-card Refine / Promote pair — an
     EXPLICIT-VERB command per the card's id: `refineCommandFor(id)` →
     `/agentheim:modeling refine <id>` and `promoteCommandFor(id)` →
     `/agentheim:modeling promote <id>`. The verbs are explicit on purpose
     (builder decision, 2026-06-14): they read unambiguously to the `modeling`
     skill's REFINE / PROMOTE routing and stay symmetric, rather than relying on a
     bare-id implicit refine.
   ============================================================ */

// The fully-qualified, bare modeling command — what the backlog add-ticket `+`
// copies, and the prefix every per-card command shares.
// agentic-workflow-aqyqd: the board's prompt-bar Modeling tab no longer
// reaches this bare form — canFirePromptMode (prompt-mode.js) declines to
// launch ANY mode on an empty prompt, so `modelingCommandFor('')`'s fallback
// to this constant is unreachable from the board. Left in place (still
// correct, pure, unit-tested) — do not delete or "restore" the bare launch.
export const MODELING_COMMAND = '/agentheim:modeling';

// The fully-qualified quick-capture command (agentic-workflow-020) — the fast
// idea-dump skill, renamed to `/agentheim:quick-capture` in aw-019. The backlog
// add affordance is now TWO launch buttons (Quick Capture / Modeling); this is
// the exact prompt the Quick Capture button hands to the bridge's POST /run (the
// extension passes it to `claude` as a raw argv element — no shell wrap, ADR-0018
// amended by infrastructure-020) and the exact text it
// copies to the clipboard on the bridge-absent fallback path. Bare and
// fully-qualified for the same reason MODELING_COMMAND is — it resolves
// regardless of the builder's alias setup.
// agentic-workflow-aqyqd: unreachable from the board for the same reason
// MODELING_COMMAND is (canFirePromptMode declines every mode on an empty
// prompt) — left in place, do not delete or "restore" the bare launch.
export const QUICK_CAPTURE_COMMAND = '/agentheim:quick-capture';

// The fully-qualified research command (agentic-workflow-036) — the board prompt
// bar's third launch button (beside Quick Capture / Modeling) hands this exact
// string to the bridge's POST /run (the extension passes it to `claude` as a raw
// argv element — no shell wrap, ADR-0018 amended by infrastructure-020) and
// copies the same on the bridge-absent fallback. Like the other two
// authoring buttons it CONSUMES the typed prompt (researchCommandFor), so the bare
// constant is the empty-prompt fallback only. Bare and fully-qualified for the same
// reason MODELING_COMMAND is — it resolves regardless of the builder's alias setup.
// agentic-workflow-aqyqd: unreachable from the board for the same reason
// MODELING_COMMAND is (canFirePromptMode declines every mode on an empty
// prompt) — left in place, do not delete or "restore" the bare launch.
export const RESEARCH_COMMAND = '/agentheim:research';

// The fully-qualified inquire command (agentic-workflow-h7n2c) — the board prompt
// bar's fourth launch button (between Modeling and Research) hands this exact string
// to the bridge's POST /run (the extension passes it to `claude` as a raw argv
// element — no shell wrap, ADR-0018 amended by infrastructure-020)
// and copies the same on the bridge-absent fallback. Like the other authoring buttons
// it CONSUMES the typed prompt (inquireCommandFor), so the bare constant is the
// empty-prompt fallback only. The `inquire` skill answers questions toward the codebase
// (read-only over `.agentheim/` and the source, ADR-0017). Bare and fully-qualified for
// the same reason MODELING_COMMAND is — it resolves regardless of the builder's alias setup.
// agentic-workflow-aqyqd: unreachable from the board for the same reason
// MODELING_COMMAND is (canFirePromptMode declines every mode on an empty
// prompt) — left in place, do not delete or "restore" the bare launch.
export const INQUIRE_COMMAND = '/agentheim:inquire';

// The fully-qualified, bare WORK command (agentic-workflow-024) — what the board
// prompt bar's right-side action column launches to kick off an EXECUTION run
// against the ready backlog. Unlike Quick Capture / Modeling (authoring actions that
// consume the typed prompt), Work IGNORES the textarea and always launches this bare
// command, so it is a plain constant rather than a `*CommandFor(prompt)` builder.
// Bare and fully-qualified for the same reason MODELING_COMMAND is — it resolves
// regardless of the builder's alias setup (ADR-0018 launch / clipboard fallback).
export const WORK_COMMAND = '/agentheim:work';

// The fully-qualified, bare WHAT'S-NEXT command (agentic-workflow-064 button,
// agentic-workflow-069 swap) — what the main-column topbar's standing "What's next"
// button (between the gear and Work) launches to get a concise overview of the most
// sensible next steps. It invokes the `whats-next` skill (skills/whats-next/SKILL.md):
// read-only over `.agentheim/` (reads vision / boards / protocol / open questions,
// recommends the next step, never moves or commits — ADR-0017). Like WORK_COMMAND it
// IGNORES the prompt-bar textarea, so it is a plain constant rather than a
// `*CommandFor(prompt)` builder. Bare and fully-qualified for the same reason the others
// are — it resolves regardless of the builder's alias setup (ADR-0018 launch / clipboard
// fallback; the extension wraps a slash command the same way it wraps any prompt).
export const WHATS_NEXT_COMMAND = '/agentheim:whats-next';

/**
 * Trim an id-like value to a safe suffix, or '' for anything that is not a real
 * id. Shared by the explicit-verb card builders so each degrades identically: a
 * missing/empty/whitespace/non-string id yields '' (never `"[object Object]"`,
 * never a throw). A real id is trimmed so a stray-padded projection value can
 * never produce a doubled space.
 */
function safeId(id) {
  return typeof id === 'string' ? id.trim() : '';
}

/**
 * Trim a prompt-like value to a safe, non-empty string, or '' for anything that is
 * not real prompt text. Shared by the board prompt-bar builders (aw-023) so each
 * degrades identically: a missing / empty / whitespace-only / non-string prompt
 * yields '' (never `"[object Object]"`, never a throw). Only the ENDS are trimmed —
 * interior whitespace in the typed prompt is preserved verbatim.
 */
function safePrompt(prompt) {
  return typeof prompt === 'string' ? prompt.trim() : '';
}

/**
 * Build the QUICK CAPTURE command, optionally seeded with the board prompt-bar's
 * typed prompt (aw-023). The relocated column button hands the bridge this exact
 * string (the extension passes it to `claude` as a raw argv element — no shell
 * wrap, ADR-0018 amended by infrastructure-020) and copies it on
 * the bridge-absent fallback.
 * @param {string} [prompt] — the live textarea contents.
 * @returns {string} `"/agentheim:quick-capture <prompt>"` for a real prompt (one
 *   separating space, trimmed ends), else the bare `QUICK_CAPTURE_COMMAND`
 *   (byte-identical to aw-020). Pure: no DOM, no I/O, never throws.
 */
export function quickCaptureCommandFor(prompt) {
  const trimmed = safePrompt(prompt);
  return trimmed ? `${QUICK_CAPTURE_COMMAND} ${trimmed}` : QUICK_CAPTURE_COMMAND;
}

/**
 * Build the MODELING command, optionally seeded with the board prompt-bar's typed
 * prompt (aw-023). The relocated column button hands the bridge this exact string;
 * the clipboard fallback copies the same.
 * @param {string} [prompt] — the live textarea contents.
 * @returns {string} `"/agentheim:modeling <prompt>"` for a real prompt (one
 *   separating space, trimmed ends), else the bare `MODELING_COMMAND`
 *   (byte-identical to aw-020). Pure: no DOM, no I/O, never throws.
 */
export function modelingCommandFor(prompt) {
  const trimmed = safePrompt(prompt);
  return trimmed ? `${MODELING_COMMAND} ${trimmed}` : MODELING_COMMAND;
}

/**
 * Build the RESEARCH command, optionally seeded with the board prompt-bar's typed
 * prompt (aw-036). The third prompt-bar button hands the bridge this exact string;
 * the clipboard fallback copies the same. Mirrors quickCaptureCommandFor /
 * modelingCommandFor exactly.
 * @param {string} [prompt] — the live textarea contents.
 * @returns {string} `"/agentheim:research <prompt>"` for a real prompt (one
 *   separating space, trimmed ends), else the bare `RESEARCH_COMMAND`. Pure: no
 *   DOM, no I/O, never throws.
 */
export function researchCommandFor(prompt) {
  const trimmed = safePrompt(prompt);
  return trimmed ? `${RESEARCH_COMMAND} ${trimmed}` : RESEARCH_COMMAND;
}

/**
 * Build the INQUIRE command, optionally seeded with the board prompt-bar's typed
 * prompt (aw-h7n2c). The fourth prompt-bar button (between Modeling and Research)
 * hands the bridge this exact string; the clipboard fallback copies the same. Mirrors
 * researchCommandFor / quickCaptureCommandFor / modelingCommandFor exactly.
 * @param {string} [prompt] — the live textarea contents.
 * @returns {string} `"/agentheim:inquire <prompt>"` for a real prompt (one
 *   separating space, trimmed ends), else the bare `INQUIRE_COMMAND`. Pure: no
 *   DOM, no I/O, never throws.
 */
export function inquireCommandFor(prompt) {
  const trimmed = safePrompt(prompt);
  return trimmed ? `${INQUIRE_COMMAND} ${trimmed}` : INQUIRE_COMMAND;
}

/**
 * Build the PLAIN command — the fifth prompt-bar mode (agentic-workflow-m3vhq,
 * ADR-0050 amended). Plain is the escape hatch from every other mode's
 * ceremony: the typed prompt goes to Claude VERBATIM, with no skill, no slash
 * command, no routing. It is deliberately the ONE builder with no bare-command
 * constant — there is no skill to name, so an empty prompt degrades to the
 * empty string rather than a bare command, letting the caller (BoardPromptBar's
 * `fire`, gated by `canFirePromptMode` in prompt-mode.js) treat Plain as a
 * true no-op when nothing has been typed.
 * @param {string} [prompt] — the live textarea contents.
 * @returns {string} the trimmed prompt verbatim for a real prompt, else ''
 *   (missing / whitespace-only / non-string all degrade to ''). Pure: no DOM,
 *   no I/O, never throws.
 */
export function plainCommandFor(prompt) {
  return safePrompt(prompt);
}

/**
 * Build the per-card REFINE command — what the backlog card's Refine launch
 * button seeds (aw-022). Refine runs the full Socratic refinement of the ticket.
 * @param {string} [id] — the card's ticket id.
 * @returns {string} `"/agentheim:modeling refine <id>"` for a real id, else the
 *   bare verb command `"/agentheim:modeling refine"` (the skill then asks for a
 *   target rather than the board guessing). Pure: no DOM, no I/O, never throws.
 */
export function refineCommandFor(id) {
  const trimmed = safeId(id);
  const base = `${MODELING_COMMAND} refine`;
  return trimmed ? `${base} ${trimmed}` : base;
}

/**
 * Build the per-card PROMOTE command — what the backlog card's Promote launch
 * button seeds (aw-022). Promote runs the readiness check + the backlog → todo
 * move (so it only ever appears on backlog cards).
 * @param {string} [id] — the card's ticket id.
 * @returns {string} `"/agentheim:modeling promote <id>"` for a real id, else the
 *   bare verb command `"/agentheim:modeling promote"`. Pure: no DOM, no I/O,
 *   never throws.
 */
export function promoteCommandFor(id) {
  const trimmed = safeId(id);
  const base = `${MODELING_COMMAND} promote`;
  return trimmed ? `${base} ${trimmed}` : base;
}

/**
 * Build the per-card DISMISS command — what the board card's hover-revealed red
 * trash can seeds (aw-048). Dismiss hard-deletes an unstarted backlog/todo task
 * together with its entire transitive dependent subtree (ADR-0022); the spawned
 * `modeling` session LISTS and RE-CONFIRMS the full cascade set before deleting
 * anything, so this command only seeds-and-fires the one id (the board is
 * read-only over disk, ADR-0017 — it does not compute the cascade itself).
 * Mirrors refineCommandFor / promoteCommandFor exactly (shared safeId helper,
 * same explicit-verb + degrade-on-empty contract).
 * @param {string} [id] — the card's ticket id.
 * @returns {string} `"/agentheim:modeling dismiss <id>"` for a real id, else the
 *   bare verb command `"/agentheim:modeling dismiss"`. Pure: no DOM, no I/O,
 *   never throws.
 */
export function dismissCommandFor(id) {
  const trimmed = safeId(id);
  const base = `${MODELING_COMMAND} dismiss`;
  return trimmed ? `${base} ${trimmed}` : base;
}
