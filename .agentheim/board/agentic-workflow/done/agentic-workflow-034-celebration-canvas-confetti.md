---
id: agentic-workflow-034
title: Fire the celebration with canvas-confetti instead of the CSS-keyframe burst
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: bb953cd
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, motion, dependency]
related_adrs: [ADR-0020, ADR-0014, ADR-0016, ADR-0003]
related_research: []
prior_art: [agentic-workflow-025, agentic-workflow-023]
---

## Why
The board celebration today is a hand-rolled **CSS-keyframe** confetti burst
(`BoardConfetti` / `ensureConfettiStyle` in `dashboard/app/board.js`, introduced by
aw-023, reasoned in ADR-0020). The builder finds it underwhelming and wants the real
particle physics of [canvas-confetti](https://www.kirilv.com/canvas-confetti/) —
"that looks way better than the version we have right now." The aw-025 temporary
"🎉 Replay celebration" button was built precisely to iterate on this animation; this
task is the iteration it enabled.

## What
Replace the **implementation** behind the existing celebration trigger with
**canvas-confetti**, leaving the trigger wiring untouched. The burst still fires from
exactly where it does today — on a successful prompt-bar launch / landed clipboard
copy, and via the aw-025 replay button — by the same `confettiKey` remount path. Only
*how the particles are drawn* changes: from CSS keyframes to a canvas-confetti call.

Builder decisions (captured at intake, sharpened in refine 2026-06-15):

- **Canvas scope — full-window burst.** Use canvas-confetti's **default global
  `confetti()`** (its fixed full-viewport canvas, `pointer-events: none`, above
  content, auto-cleared), firing from an **origin near the prompt-bar buttons** so
  particles rain across the page. This is a deliberate step up from today's
  contained-over-the-buttons footprint — the dramatic "way better" upgrade the
  builder wanted. (Refine decision over a board-local `confetti.create(el)` scoped
  canvas.) It remains a **board-owned, board-local transient ACK** in *ownership* —
  the board injects/owns the call, it is consumed within the BC, and it is **not**
  promoted to a design-system primitive — even though the pixel footprint is now
  full-window. The amended ADR-0020 records that the "board-local" clause was about
  *ownership + not-a-DS-primitive*, not literal footprint (see Notes).
- **Palette — all four status bases, theme-aware.** Feed canvas-confetti the four
  **status-palette bases** — `--st-done` / `--st-todo` / `--st-doing` / `--st-backlog`
  — resolved per the **active light/dark theme**. This **drops** today's muted
  `--fg-3` grey and **adds** the warm `--st-doing` amber the CSS burst omits, for the
  livelier/brighter spread. It must **not** pull the reserved selection accent
  `--accent-ochre-soft` (ADR-0016) nor the `--obligation` skip-permissions danger hue
  (aw-021) — both are excluded by construction (neither is a status base). The exact
  liveliness (particle count, spread, velocity, origin) is tuned in the aw-025 replay
  loop until the builder is satisfied.
- **Colors resolved at fire time (refine decision).** canvas-confetti draws on a
  JS `<canvas>` and **cannot** consume `var(--st-done)` the way the CSS keyframes
  do — it needs concrete color strings. Read each token to a hex value at fire time
  via `getComputedStyle(document.documentElement).getPropertyValue('--st-done')`
  (trimmed), **not** a static hard-coded list. Resolving at fire time means the burst
  **tracks the active theme** for free (the tokens differ per light/dark), staying a
  true projection of the styleguide tokens (ADR-0003) rather than a forked copy.
- **Delivery — vendor + bundle locally.** Add canvas-confetti as a **build-time
  dependency** in `dashboard/package.json` (`devDependencies`, alongside
  react/marked/htm), `import`ed in `dashboard/app/board.js` so esbuild folds it into
  the committed `dashboard/dist/app.js` (`bundle: true`, `nodePaths` already points
  at `dashboard/node_modules`). The dashboard runs on `127.0.0.1` with **no network
  guarantee** — a CDN load is out. This is the dashboard's **first bundled frontend
  runtime dependency** (react/marked/htm are framework/render infra), so it earns an
  ADR (see Notes).

What this task does **not** change:
- The **trigger semantics** — no new surfaces fire confetti; the prompt-bar success
  path and the aw-025 replay button are the only callers. No launch / bridge / copy /
  textarea-clear / lifecycle-write behaviour changes (the board stays a read-only
  projection of disk — ADR-0001 / ADR-0017).
- The **reduced-motion contract** — under `prefers-reduced-motion: reduce` the
  celebration renders **nothing** (ADR-0014's strip-to-plain). canvas-confetti must be
  guarded by the existing `matchMedia` check so reduce stays silent.
- The **board-local, not-a-styleguide-primitive** stance — the confetti remains a
  board-local transient ACK (ADR-0020), consumed within the BC, not promoted to a
  design-system motion primitive and not filing a design-system child task. (The
  amended ADR records the new dependency + CSS→canvas swap, not a new shared
  primitive.)

## Acceptance criteria
- [ ] The celebration burst is rendered by **canvas-confetti**, not the CSS keyframes;
      `ensureConfettiStyle`'s `@keyframes` injection and the `.agentheim-confetti-piece`
      DOM-span rendering are removed, and `BoardConfetti` drives a canvas-confetti call.
- [ ] The burst uses canvas-confetti's **default global `confetti()`** (full-viewport
      canvas), firing from an **origin near the prompt-bar buttons** (not the stock
      `{x:0.5, y:0.5}` centre) — exact origin/spread tuned in the replay loop.
- [ ] canvas-confetti is added to **`dashboard/package.json` `devDependencies`** and
      `import`ed in `board.js`, so esbuild **bundles it into `dashboard/dist/app.js`**
      — no CDN, no runtime network fetch; the celebration works with the machine offline.
- [ ] The burst fires from the **same triggers** as today: a successful prompt-bar
      launch / landed clipboard copy, and the aw-025 replay button — via the unchanged
      `confettiKey` remount path. No new firing surfaces.
- [ ] The particle colors are the **four status-palette bases** (`--st-done` /
      `--st-todo` / `--st-doing` / `--st-backlog`), **resolved at fire time** via
      `getComputedStyle` (not a static list) so the burst **tracks the active
      light/dark theme**. The set draws **neither** `--accent-ochre-soft` (ADR-0016)
      **nor** the `--obligation` hue (aw-021), and no longer uses the `--fg-3` grey.
- [ ] Under `prefers-reduced-motion: reduce` the celebration shows **nothing** — the
      existing `matchMedia` guard wraps the canvas-confetti call so `confetti()` is
      never invoked under reduce (ADR-0014).
- [ ] Firing the celebration performs **no** launch, bridge call, clipboard copy,
      textarea clear, or lifecycle write — behaviour beyond the visual is unchanged.
- [ ] No new design-system primitive and no design-system child task — the styleguide
      source is untouched; canvas-confetti is consumed board-locally (ADR-0003 /
      ADR-0020).
- [ ] **ADR-0020 is amended in place** (an amendment section, the aw-021/aw-030
      precedent — not a new superseding ADR) recording: canvas-confetti as the
      dashboard's first **bundled frontend runtime dependency**, the CSS→canvas swap,
      the full-window footprint (board-local in *ownership*, not a DS primitive), the
      four-status-base theme-aware palette, and that ADR-0014's reduced-motion silence
      still binds.
- [ ] The dashboard app is rebuilt (`dashboard/dist/`) and the existing dashboard test
      suite stays green; the canvas-confetti integration has at least a smoke-level
      guard (e.g. a pure colour-resolver tested for the four tokens + reserved-token
      exclusion, and the reduced-motion no-call path asserted).

## Notes
Captured via `modeling` (Facilitator) on 2026-06-15. Builder gave the canvas-confetti
URL and chose, at intake: **brand-derived livelier palette** (over canvas-confetti's
stock multi-color default or a strict token match) and **vendor+bundle** delivery
(over CDN).

- **This amends/reshapes ADR-0020.** ADR-0020 deliberately chose a *CSS-only,
  dependency-free* burst drawing strictly from status-palette tokens. This task keeps
  the *board-local transient ACK* spirit and the *no-reserved-token* color discipline,
  but reverses the *CSS-only / dependency-free* clause. The worker (or a refine pass)
  should write a follow-on ADR — likely amending ADR-0020 — that records: the new
  bundled dependency, the CSS→canvas implementation swap, the brand-derived-but-livelier
  palette rule, and that ADR-0014's reduced-motion silence still binds. `type: decision`
  was considered but the decision is small and tightly coupled to this implementation,
  so it rides along as the feature's ADR rather than a separate decision task.
- **Trigger wiring is reused unchanged.** `BoardPromptBar` owns
  `const [confettiKey, setConfettiKey] = useState(0)`; the success path and the aw-025
  temp button both bump it to remount `BoardConfetti`. This task swaps what
  `BoardConfetti` *renders*, not who calls it.
- **aw-025's replay button stays** as the live iteration vehicle while the palette /
  intensity is tuned; it remains throwaway scaffolding (its own removal is out of scope
  here).
- **Frontend gate:** depends on `design-system-001` (styleguide), which is **done /
  approved (2026-06-05)** — the gate is satisfied, so this task is promotable.

**Resolved in refine (2026-06-15):**
- **Canvas scope → full-window.** Default global `confetti()`, origin near the
  prompt bar (over a board-local scoped `confetti.create(el)`). Still board-*owned*
  and not a DS primitive; the ADR-0020 amendment must clarify the "board-local"
  clause meant ownership, not footprint.
- **Token resolution → at fire time via `getComputedStyle`** (over a static derived
  list), so the burst tracks the active light/dark theme automatically.
- **Palette → the four status bases** (`--st-done/--st-todo/--st-doing/--st-backlog`),
  dropping `--fg-3`, adding the `--st-doing` amber. Reserved `--accent-ochre-soft` /
  `--obligation` excluded by construction.
- **ADR → amend ADR-0020 in place** (aw-021/aw-030 precedent), not a new ADR.

**Still left to the worker / replay loop (genuinely an iteration target, not
under-refinement):** the exact canvas-confetti tuning — `particleCount` / `spread` /
`startVelocity` / `gravity` / `scalar` and the precise normalized `origin` mapped
from the prompt-bar's on-screen position — dialed in via the aw-025 replay button
until the builder is satisfied.

## Outcome

The board celebration is now rendered by **canvas-confetti** instead of the
hand-rolled CSS-keyframe burst. The trigger wiring (`confettiKey` / `setConfettiKey`
/ `onResult` and the aw-025 replay button) is untouched — only the implementation
behind `BoardConfetti` swapped.

- Added `canvas-confetti@^1.9.4` to `dashboard/package.json` `devDependencies` and
  `import`ed it in `board.js`; esbuild folds it into the committed `dist/app.js`
  (verified — no CDN, offline-capable).
- Removed `ensureConfettiStyle` (the `@keyframes` injector) and the
  `.agentheim-confetti-piece` DOM-span rendering. `BoardConfetti` now fires a single
  `fireConfetti()` on remount, calling canvas-confetti's default full-viewport
  `confetti()` from an origin near the prompt-bar buttons (`{x:0.18, y:0.92}`, angle
  75 — lively defaults, the exact tuning is the aw-025 replay-loop iteration target).
- New pure module `dashboard/app/confetti-palette.js` (`CONFETTI_TOKENS` +
  `resolveConfettiColors`): the four status bases `--st-done` / `--st-todo` /
  `--st-doing` / `--st-backlog` resolved at fire time via `getComputedStyle`, so the
  burst tracks the active light/dark theme. Drops `--fg-3`, adds `--st-doing`;
  excludes `--accent-ochre-soft` and `--obligation` by construction.
- Reduced-motion: the `matchMedia` guard wraps the fire path, so `confetti()` is
  never invoked under `prefers-reduced-motion: reduce` (ADR-0014).
- Amended **ADR-0020 in place** (not a new ADR): records canvas-confetti as the
  dashboard's first bundled frontend runtime dependency, the CSS→canvas swap, the
  full-window footprint (board-local = ownership, not pixels), the theme-aware
  four-status-base palette, and that ADR-0014's reduced-motion silence still binds.

Key files: `dashboard/app/board.js`, `dashboard/app/confetti-palette.js`,
`dashboard/test/confetti-palette.test.mjs`, `dashboard/test/board-prompt-bar.test.mjs`,
`dashboard/package.json`, `dashboard/package-lock.json`, `dashboard/dist/app.js`,
`.agentheim/knowledge/decisions/0020-board-confetti-board-local-transient-ack.md`,
`.agentheim/contexts/agentic-workflow/README.md`.

Tests: full `node --test` suite green (313 tests); new pure colour-resolver unit
tests + the reduced-motion no-call guard + the canvas-confetti swap source guards.
