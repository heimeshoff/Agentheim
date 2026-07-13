# Design System

## Purpose

The home for Agentheim's **frontend infrastructure** — the visual language, component
patterns, and styleguide that any UI-bearing feature in any other BC must conform to.
It exists so that frontend work has a single reviewed source of truth for look-and-feel
instead of each feature inventing its own.

It was created the moment Agentheim grew its first UI-bearing feature (the `dashboard`,
in the `agentic-workflow` BC). Before that, Agentheim was a markdown-and-prompts plugin
with no frontend at all.

## Classification

**supporting** — it serves other BCs' UI work; it is not the product itself. Today its
only consumer is `agentic-workflow`'s `dashboard` feature.

## The styleguide gate

Every UI/frontend task in any BC must list this BC's styleguide task
(`design-system-001-styleguide`) in its `depends_on`, and no frontend task may be
promoted to `todo` ahead of the styleguide. The styleguide is reviewed and approved by
the builder before any BC implements its UI.

## The styleguide

The styleguide artifact lives at `styleguide/` and is the reviewed visual language all UI
conforms to. Direction (decided 2026-06-05): a refined, content-first developer tool —
"Linear precision, Notion calm, Vercel restraint" — **dark-first with a light toggle**,
quiet by default, color used only to signal **ticket status** and **content type**.

> **Palette heritage superseded (`design-system-e9apx`, ADR-0049, 2026-07-05).** The neutral
> family originally described as "derived from the Ledger design system" — a warm-paper
> `--surface-0` (`#FAF8F4` light / `#0F1115` dark) — is retired in favor of a cooler, bluer
> **"Command deck"** identity (the dashboard-redesign brief's 1b direction). This is a
> **values-only** shift: every token keeps its existing name and structural role
> (`--surface-0/1/2`, the `--fg-1`…`--fg-4` text ramp, hairlines, accent) — only the hex values
> move, in both `[data-theme]` blocks. The light theme is *derived* from the 1b dark reference
> (not a separate light mock), anchored on the existing `--swatch-light` (`#FAF8F4`) starting
> point; the ADR-0016 frozen preview swatches (`--swatch-light` / `--swatch-dark`) re-pin to the
> new `--surface-0` values so the `ThemeToggle` keeps previewing the theme it actually switches
> to. See ADR-0049
> (`.agentheim/knowledge/decisions/0049-command-deck-palette-identity-supersedes-warm-ledger-heritage.md`).
> The actual hex substitution is the downstream `design-system-a31e0` task; accent-usage policy
> is the separate, sibling ADR-0048.

> **Hex substitution landed (`design-system-a31e0`, 2026-07-05).** Both `[data-theme]`
> blocks of `styles/colors_and_type.css` now carry the Command-deck values — every token
> keeps its name and role (values only, no rename): dark `--surface-0/1/2` →
> `#090C12` / `#0D1119` / `#121826` (app bg / panel / ticket-card — the 1b brief's four-rung
> stack collapsed onto the system's three surface slots, dropping the intermediate
> "panel-2" rung as redundant against the token count), `--hairline` / `--hairline-strong` →
> `#1C2330` / `#2B3548`, the `--fg-1`…`--fg-4` ramp → `#F2F5F9` / `#AEB8C4` / `#7D8794` /
> `#48515C`, and `--accent-ochre` → `#E5A13C` (`-soft` `#5E4015`, `-tint` `#211A0D`). The
> light theme is *derived*, not separately art-directed: `--surface-0` stays pinned at the
> `#FAF8F4` anchor, and the rest of the light ramp (surfaces, hairlines, the `--fg-1`…`--fg-4`
> ramp) is computed by re-applying the dark stack's HSL step sizes on the same cool
> blue-grey hue family, inverted — landing `--surface-1/2` at `#EFF1F4` / `#E4E7ED`,
> hairlines at `#D9DDE4` / `#C2C9D4`, and `--fg-1`…`--fg-4` at `#0C0E12` / `#414956` /
> `#6D788B` / `#A8B0BD`. Light `--accent-ochre` derives to `#B87619` (`-soft` `#E6C28E`,
> `-tint` `#FBF2DF`) — nearly unchanged from the prior warm-paper accent, since the 1b hue
> sits in the same amber family. Per ADR-0049 §3 the frozen preview swatches re-pin:
> `--swatch-dark` → `#090C12` (new dark `--surface-0`), `--swatch-light` stays `#FAF8F4`,
> and both fixed on-swatch fg tokens now mirror the new `--fg-1` values
> (`theme-toggle.test.mjs` updated to assert the re-pinned lock). Status/content-type
> tokens in `styles/agentheim.css` (`--st-*`, `--ct-*`, `--rel-dep*`, `--code-bg`/
> `--code-block-bg`) are **unchanged** — out of this task's scope; only the new
> `--emphasis-border` token (ADR-0048) was added there, in both theme blocks
> (`color-mix(in oklab, var(--accent-ochre) 50%/40%, transparent)` light/dark — a
> border-suited softened alpha, not a bare `--accent-ochre` reuse), with no consumer
> wired yet. `dashboard/dist/` was rebuilt (`node build.mjs`, twice, byte-identical on
> the second pass) to fold the new hexes into the served bundle.

Tokens are the source of truth in
`styleguide/styles/colors_and_type.css` (surfaces, type, spacing, radii, motion) and
`styleguide/styles/agentheim.css` (status + content-type palettes, elevation, markdown
reading scale). The canvas (`styleguide/index.html`) documents the tokens and renders every
component pattern in context.

### Source architecture (ESM single source — ADR-0003, ADR-0005)

As of `design-system-002`, the styleguide source under `styleguide/app/*.js` is **native
ES modules** — the single source of truth feeding two consumers (ADR-0003): the buildless
reviewable canvas and the esbuild-bundled dashboard dist (`infrastructure-002`). Every
cross-file symbol is an explicit `export`/`import`; there are no `window.*` globals and no
in-browser Babel. Views are authored with **htm tagged templates** (`app/html.js`), parsed
at runtime — **no JSX is shipped to the browser** (ADR-0005). The canvas
(`styleguide/index.html`) loads `app/app.js` via `<script type="module">` with an
**import map** resolving `react`, `react-dom/client`, `marked`, and `htm` to pinned esm.sh
URLs; opening the file needs no toolchain. Tokens (`styles/*.css`) are unchanged.

> **Gate status after the ESM migration (`design-system-002`): OPEN — re-approved by the
> builder 2026-06-06** ("looks good, everything works"). The builder reviewed the migrated
> canvas (`styleguide/index.html` — sections 05–10 + the live kanban→drawer demo) and
> confirmed visual parity. The gate now stands open against the **migrated ESM source**, not
> just the original in-browser-Babel artifact.

> **Gate re-confirmed after the offline-webfonts change (`design-system-003`): OPEN —
> re-approved by the builder 2026-06-06.** Vendoring the webfonts locally edited the gated
> token CSS (`styles/colors_and_type.css`), lightly reopening the gate; the visual delta was
> nil (same Inter Tight / JetBrains Mono families and weights, now served from `styles/fonts/`
> instead of the Google Fonts CDN), and the builder re-confirmed. The gate stands open against
> the now-fully-offline styleguide.

> **Approved by the builder 2026-06-05** — the styleguide gate is open. Frontend tasks in
> any BC may now be promoted (each still subject to its own other dependencies). See
> `design-system-001` (done).

### Webfonts — vendored locally (offline, ADR-0008)

As of `design-system-003` the type families are **committed locally**, not pulled from a
CDN. The token CSS no longer `@import`s Google Fonts; instead `styles/colors_and_type.css`
declares `@font-face` rules pointing at `styles/fonts/`:

- `InterTight-latin.woff2` — Inter Tight, variable weight axis (covers 400/500/600).
- `JetBrainsMono-latin.woff2` — JetBrains Mono, variable weight axis (covers 400/500).

These are the Google Fonts **latin-subset** woff2 (variable fonts), so one file per family
covers every weight the tokens use; only the latin subset is vendored (the styleguide is
latin-only content). OFL 1.1 licenses sit beside the fonts (`*-OFL.txt`). The `url()` is
`fonts/<file>.woff2`, **relative to the CSS**, so it resolves both in the source canvas
(`styleguide/styles/fonts/`) and in the dashboard dist (`infrastructure`'s `build.mjs`
copies `styles/fonts/` → `dist/fonts/`). Result: the canvas and the bundled dashboard
render the correct type with **no network at view time**. Adding non-latin glyphs later
requires vendoring the matching subset. See ADR-0008.

### Motion — transitions plus two ambient cues (ADR-0014, ADR-0029)

Motion is **quiet and mostly transition-only**: short, event-triggered eases
(`--duration-fast` / `--duration-base`, `--ease-base`) on hover, theme flip, and
the drawer. The `TicketCard` hover reads as a **raise, not a jump**
(`design-system-008`): hover deepens the shadow one step on the scale
(`--shadow-sm` → `--shadow-md`, `styles/agentheim.css`) and applies **no
`transform`/`translateY` offset**, so the card's content stays put rather than
nudging upward. As of `design-system-010` the `TicketCard` carries **no visual
selected cue at all** — the former ochre border + 1px accent ring were removed, so
a selected card looks identical to an unselected one. The `selected` prop is now
purely semantic (it still drives `aria-pressed`); this completes ADR-0016's
direction (ordinary selection is never signalled by the reserved accent) for the
card — the last place that still used the ochre ring. As of `design-system-004` the language admits **one ambient
(looping) cue**: a doing-status ticket card's ochre rail **breathes** — a calm,
low-amplitude pulse — so the doing column reads as *actively worked* at a glance.
This is the system's first `@keyframes` and its first loop token,
`--duration-ambient` (`styles/colors_and_type.css`); the pulse keyframes +
`.ticket-rail--pulse` class live in `styles/agentheim.css`. It is **status-keyed**
(`status === "doing"`, never the `agent` field) via `doingPulseClass()` in
`app/motion.js`, applied by the styleguide `TicketCard`; the dashboard inherits it
unforked (ADR-0003), no dashboard-side change. The cue stays inside the quiet-by-
default law: **ochre-only** (draws solely from `--st-doing`, no new hue) and
**low amplitude**. Under `prefers-reduced-motion: reduce` it is **fully stripped**
to a plain rail (pure progressive enhancement) — the standing contract for any
future ambient motion: always strippable to a still-legible static baseline.

As of `design-system-v8k2p` the language admits a **second ambient cue** on the
left rail — the "new item" **attention** marker (ADR-0029). A freshly-arrived
`TreeItem` row or its (possibly collapsed) `Collapsible` group header can carry a
quiet **breathing left-edge dot** drawing the eye to it until acknowledged. It is
the sibling of the doing-breathe but a *distinct* signal: it draws from the
existing `--st-todo` "incoming" token (never the reserved selection accent
`--accent-ochre-soft`, ADR-0016), runs on its own `--duration-attention` token
(`@keyframes rail-attention-breathe` / `.rail-attention::before` in
`styles/agentheim.css`), and is **opt-in, default OFF** via `attention` on both
surfaces — off renders byte-identical to today. Detection of *which* rows are new
and the until-acknowledged lifecycle belong to the **consumer**
(`agentic-workflow-n4h7q`); the styleguide only renders the cue, on/off, via the
React-free `attentionCueClass()` in `app/motion.js` (`node --test`-able, mirroring
`doingPulseClass`). Its reduced-motion behaviour **diverges deliberately** from
the pulse: because "new" is not otherwise encoded on the row, the cue keeps a
**steady static dot** rather than vanishing — motion removed, signal retained
(ADR-0029). This makes the system's ambient motion a small **taxonomy**:
`--st-doing` breathe = *active status*, `--st-todo` dot = *new / attention*.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003)
> and must be **rebuilt** to pick up this styleguide change; the source edit alone
> does not update the bundle.

As of `design-system-w4t9k` the taxonomy admits a **third ambient cue**: a
**dependency-relation ring** around a `TicketCard`'s **perimeter** (ADR-0034). While
the builder hovers a card, its dependencies can carry a quiet breathing ring so the
hover-driven relation ("this card is waiting on / holding up the one you're pointing
at") reads at a glance — the styleguide capability behind
`agentic-workflow-r9k2p`'s hover feature.

- **Card perimeter, not rail — deliberately.** A hover target can simultaneously be
  an actively-doing card (rail pulse) or a freshly-arrived one (rail attention dot);
  a third rail-based cue would collide with either. The ring is an **inset `::after`**
  around the whole card (clip-safe under the card's existing `overflow: hidden`), so
  it composes with both sibling cues with no visual collision.
- **Direction rides line-style, not a second hue.** `waiting-on` (the card is in the
  hovered card's `depends_on`) renders a **solid** breathing ring; `holding-up` (the
  card is in the hovered card's `blocks`) renders a **dashed** breathing ring — same
  hue, one dedicated token, `--rel-dep` (+ `--rel-dep-tint`), added to **both** theme
  blocks of `styles/agentheim.css`. This is a deliberate departure from ADR-0029's
  "reuse an existing status token" guidance (ADR-0034): a dependency relation is not
  a status, so it earns its own token rather than overloading an existing one.
  Proposed starting hue: cyan/aqua (`#1E88A8` light / `#5FC7DE` dark), distinct from
  every status/content-type token and from the reserved `--accent-ochre-soft`
  (ADR-0016) — **exact hue is a gate-review item with the builder**.
- **Its own loop token**, `--duration-relation: 2000ms`, in the motion block of
  `styles/colors_and_type.css` beside `--duration-ambient` / `--duration-attention`.
- **Reduced motion keeps the ring** (the ADR-0029 pattern, not ADR-0014's): the
  loop stops but the ring stays visible as a static solid/dashed border — a
  dependency relation has no other static encoding on the target card, so vanishing
  would erase the signal.
- **Opt-in via `dependencyRelation`** (`"waiting-on" | "holding-up" | null`, default
  `null`) on `TicketCard`, appending `dependencyRingClass(dependencyRelation)`
  (`app/motion.js`, re-exported from `app/kanban.js`) to the card root. Detection of
  which cards are hover targets and the hover lifecycle is the **consumer's** job
  (`agentic-workflow-k5p8w`); the styleguide only renders the ring on/off.

See ADR-0034
(`.agentheim/knowledge/decisions/0034-dependency-ring-third-ambient-signal-dedicated-token-direction-by-line-style.md`).

> **Gate re-review reopened by the dependency-relation ring
> (`design-system-w4t9k`).** A new `--rel-dep` token pair, a third `@keyframes` loop,
> and an inset perimeter ring join `TicketCard` — a visible styleguide change that
> reopens the design-system gate per the `design-system-005` / `007` / `009` / `014`
> / `015` / `017` / `018` / `020` / `021` / `v8k2p` precedent. Re-review against the
> canvas (`styleguide/index.html` → section 06, the dependency-ring specimen: solid
> waiting-on, dashed holding-up, and a doing card wearing both the rail pulse and
> the perimeter ring at once) **before** `agentic-workflow-k5p8w` wires the live
> hover detection and rebuilds `dist/`.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and
> was **not** rebuilt here — this task adds the ring capability with **no shipped
> dashboard consumer yet** (the ds-018 / ds-020 / ds-021 live-board pattern); `dist/`
> is rebuilt by the consuming task (`agentic-workflow-k5p8w`) when the hover-driven
> ring actually renders on the board.

As of `design-system-b7n2s` the dependency-relation language gains **two sibling
mechanisms** covering "the target is present but not currently visible": a
**hidden-dependency presence marker** on a collapsed `Collapsible` header (or any
other arbitrary element), and an **off-viewport edge-blink primitive** for a scroll
area. Both reuse `--rel-dep` / `--duration-relation` (one shared visual language
across "pulsing on the card," "present but hidden," and "off-viewport") — no new
hue, no new loop token.

- **Hidden-dependency marker — `.rel-present` + `dependencyPresentClass(present)`
  (`app/motion.js`).** A **hollow** (border-only, never filled) breathing dot,
  deliberately distinct from the *filled* `--st-todo` rail attention dot (ADR-0029)
  so "a dependency is hidden here" never reads as "a new item is here."
  **Direction-agnostic** by design: a collapsed group can hold both `waiting-on` and
  `holding-up` targets at once, so one marker meaning "expand to see" is enough —
  direction stays on the on-card ring, never duplicated onto every group header.
  Painted via `::after` (the attention dot uses `::before`), so the two markers
  compose on the **same** header without collision.
  - **`Collapsible`'s new `hasHiddenDependency` prop** (`app/collapsible.js`,
    default `false`) wires the marker onto the header button — a prop **separate**
    from `attention` in meaning, lifecycle, and rendered class; it is **not** an
    overload of it (ADR-0029, design-system-v8k2p precedent). Off renders
    byte-identical to today; on is simultaneous-safe with `attention`.
  - **The `rel-present` class also works standalone**, with no `Collapsible`
    required — usable directly on an arbitrary element (the Done column's
    height-clamped `chevrons-up`/`chevrons-down` collapse control,
    design-system-c3p9k, which is not a `Collapsible`).
  - Reduced motion keeps the ADR-0029 pattern: the loop stops but the hollow dot
    stays visible (a collapsed header has no other static encoding of "a
    dependency is hidden here").
- **Off-viewport edge-blink — a PRIMITIVE only, no new component.** Mirroring the
  ADR-0003 "styleguide owns look/mechanics, consumer owns placement" seam used for
  `cornerAction` (design-system-006): `.rel-edge-blink` + `.rel-edge-blink--top` /
  `--bottom` + `@keyframes rel-edge-blink-breathe` in `agentheim.css`, and the
  direction-aware `edgeBlinkClass(edge)` (`edge ∈ {"top","bottom"}`) in
  `app/motion.js`. The board (`agentic-workflow-h9v3m`) builds and places the actual
  small edge indicator (e.g. a `--rel-dep`-tinted chevron `Icon` pinned to its own
  scroll container's edge) using its own scroll geometry — design-system doesn't
  know the scroll container exists.
- **Canvas specimens** — section 09 (`Collapsible`) gains a `hasHiddenDependency`
  header variant (collapsed, open, and a third group proving coexistence with
  `attention`), and a scroll-frame mockup documenting the edge-blink primitive with
  a top and a bottom `--rel-dep` chevron.

See ADR-0034 pt. 6
(`.agentheim/knowledge/decisions/0034-dependency-ring-third-ambient-signal-dedicated-token-direction-by-line-style.md`),
which names these as sibling mechanisms to the on-card ring, not variants of it.

> **Gate re-review reopened by the hidden/off-viewport dependency markers
> (`design-system-b7n2s`).** A new `Collapsible` prop (`hasHiddenDependency`) and
> visible marker, plus a new off-viewport edge-blink primitive, join the canvas — a
> visible styleguide change that reopens the design-system gate per the
> `design-system-005` / `007` / `009` / `014` / `015` / `017` / `018` / `020` /
> `021` / `v8k2p` / `w4t9k` precedent. Re-review against the canvas
> (`styleguide/index.html` → section 09, the hidden-dependency and edge-blink
> specimens) **before** `agentic-workflow-h9v3m` / `agentic-workflow-r9k2p` wire the
> live board consumers and rebuild `dist/`.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and
> was **not** rebuilt here — this task adds both mechanisms with **no shipped
> dashboard consumer yet** (the ds-018 / ds-020 / ds-021 / w4t9k live-board pattern);
> `dist/` is rebuilt by the consuming tasks (`agentic-workflow-h9v3m` /
> `agentic-workflow-r9k2p`) when the markers actually render on the board.

### TicketCard — estimate chip is conditional; an optional corner-action slot (design-system-006)

> **Estimate-visibility rule superseded (`design-system-v08qq`).** The
> "estimate chip is conditional" contract below is retired, not merely
> re-tuned: `TicketCard` no longer renders an estimate chip **at all**, ever.
> `app/card.js` (`showEstimate`) is deleted along with its two pure-function
> tests — a global bump rather than an unreferenced export, since grepping
> every consumer (not just every import — the design-system-t896s
> `--radius-md` trap) found `showEstimate` had exactly one caller, the render
> line this task removed. See "TicketCard condensed to 1b" below for the
> full new anatomy. The `cornerAction` contract (second bullet below) is
> **unchanged** and remains load-bearing.

The `TicketCard` (`app/kanban.js`) is consumed by the dashboard **unforked**
(ADR-0003), so consumer-shaped affordances live here, not board-side. Two
contracts:

- ~~**Estimate chip is conditional.** The `… pt` meta chip renders only when
  there is a real estimate…~~ **Superseded above** — the chip no longer
  exists in any form.
- **Optional `cornerAction` render-prop.** The card accepts an optional
  `cornerAction` function rendering a single quiet control in the **bottom-right
  of the meta row** (the former estimate-chip position). The **styleguide owns the
  slot's look/placement and click isolation**; the **consumer owns the control's
  behavior**. The card wraps the slot in a `stopPropagation` container so
  activating the action never bubbles to the card's own `onClick` (the card is a
  button that opens the slide-over). Absent → the card is unchanged. The downstream
  consumer (a backlog card's copy-command button) is `agentic-workflow-016`. As of
  `design-system-v08qq`, `cornerAction` is the **only** thing that can occupy a meta
  row — the row itself renders only when one is supplied.

> Live-board note: same as Motion — the served dashboard `dist/` is a derived
> artifact (ADR-0003) and must be **rebuilt** to pick up this styleguide change.

### TicketCard condensed to 1b — no context chip, no estimate, no timestamp, smaller type (design-system-v08qq)

`TicketCard` (`app/kanban.js`) is condensed toward 1b's "Command deck" card
anatomy (`inspiration/Agentheim UX Explorations.html`, §1b): a status cue, a
mono ticket ID, and a two-line title — nothing else, unless `cornerAction` is
supplied.

- **Meta row emptied of content.** The bounded-context `MetaChip` (folder
  glyph), the estimate `MetaChip`, and the `updated` timestamp are all gone.
  The context chip was the only one of the three that ever rendered on the
  real dashboard board; it was judged **redundant**, not merely condensed —
  task ids are `<bc>-<token>` (ADR-0028), so a card's mono id already names
  its bounded context at the top of the card. The estimate chip and the
  timestamp were **already invisible on the real board** before this task
  (`dashboard/app/board-data.js` feeds the `'—'` placeholder / an empty
  string, both falsy against `showEstimate` / `ticket.updated`); they were
  visible only in the styleguide canvas specimen. The flat-column objection
  (an ungrouped column loses its only BC cue) was raised and dismissed on
  the same ADR-0028 mono-id reasoning — the chip is redundant in grouped
  **and** flat columns alike.
- **The meta row renders only when `cornerAction` is supplied.** `cornerAction`
  is unchanged and load-bearing (backlog's Refine/Promote pair,
  `agentic-workflow-022`) — see the supersession note above. The row wraps
  `cornerAction` alone now (no spacer, no sibling elements). The title's
  `marginBottom` is `cornerAction ? 12 : 0` so a rowless card ends flush at
  its title, matching 1b, with no dangling trailing whitespace.
- **Type scale condensed to 1b's.** The mono id (`MonoId`, `app/primitives.js`)
  drops from 11.5px to **10px** — bumped **globally** in the shared primitive
  rather than given a `size` prop, because grepping every RENDER site (not
  just every import — the design-system-t896s `--radius-md` trap this task
  was warned against) found `MonoId` has exactly two render sites, both
  inside `TicketCard` itself (`app/kanban.js`, the `rail` and `badge`
  variants); `app/app.js` imports `MonoId` on line 13 but never renders it.
  With no other consumer, a global bump is safe where a global `--radius-md`
  bump (t896s) was not. The title drops from 14px/`line-height: 1.4` to
  **12px/1.5**, inline in `TicketCard`'s own style object (not a shared
  primitive, no equivalent trap).
- **Out of scope, deliberately unchanged.** Card padding, `--radius-card`,
  the status rail, the `bot` agent icon, the two-line title clamp, the hover
  shadow, and the dependency ring.
- **Follow-up, not this task.** Once `TicketCard` ignores them,
  `board-data.js`'s `est` / `updated` placeholder fields are dead in the
  `agentic-workflow` BC — out of a design-system task's scope, flagged for a
  separate task if worth the churn.

> **Gate re-review reopened by the TicketCard condensation
> (`design-system-v08qq`).** A visible styleguide change (smaller type,
> the meta row gone except for `cornerAction`) — the `design-system-008` /
> `design-system-010` / `design-system-t896s` precedent (lightweight
> re-review of the Kanban section of the canvas, not a full pass).
> **Builder confirmation PENDING.**

> Live-board note: the served dashboard `dist/` is a derived artifact
> (ADR-0003) and **was rebuilt** (`node build.mjs`, from `dashboard/`) in
> this task — the live board's context chip disappears immediately; the
> estimate chip and timestamp were already invisible there (see above).

### Collapsible — the shared section primitive (design-system-005)

The chevron-header + revealed-body affordance is now a single shared primitive,
`Collapsible` (`app/collapsible.js`), instead of two near-identical headers (the
tree's `TreeGroup` and a board-local clone). Both consume it **unforked**
(ADR-0003) — the styleguide owns the look, the consumer drives the state:

- **One canonical header look** — chevron rotating to 90° when open, an
  ellipsis-truncating uppercase `--font-ui` label that takes the row (`flex:1`),
  and a right-aligned `--font-mono` count (or an arbitrary trailing slot). This
  **unified** the two pre-existing headers (a small redesign, not pure dedup):
  the tree's count moved to the right edge and its label gained truncation.
- **Owns the reveal; body-agnostic.** The primitive holds the open truth and
  conditionally renders the body it reveals — so the `{open && …}` logic lives in
  ONE place. Children are arbitrary (`TreeItem` rows in the tree, `TicketCard`s
  on the board); each consumer passes its own spacing via a
  **`bodyStyle`** override.
- **Controlled OR uncontrolled.** Controlled when `open` + `onToggle` are
  supplied — the board drives it from collapse state persisted per `(column, BC)`
  (ADR-0015); the primitive writes no internal state, only announces every
  toggle. Uncontrolled when `open` is omitted and `defaultOpen` is given — the
  `TreeGroup` behavior, the primitive holds its own `useState`. The pure
  resolution (`isControlled(open)`) lives React-free in `app/collapsible-state.js`
  so it is testable under `node --test` (mirroring `showEstimate` / `doingPulseClass`).

The canvas documents the pattern in BOTH modes (section 09, `CollapsibleSpecimen`).

> **Gate re-confirmed after the shared-Collapsible extraction (`design-system-005`):
> OPEN — re-approved by the builder 2026-06-09.** The unified header is a **visual
> change to the library tree** (`TreeGroup`'s count moved to the right edge; its label
> now truncates with an ellipsis), which lightly reopened the gate per the
> `design-system-002` / `003` / `004` precedent. The builder reviewed the canvas
> (`styleguide/index.html` → section 09 — the tree specimen wearing the unified header,
> and the new Collapsible specimen in both controlled and uncontrolled modes) and
> re-confirmed. The gate now stands open against the **unified canonical header**.

> Live-board note: same as Motion — the served dashboard `dist/` is a derived
> artifact (ADR-0003) and was **rebuilt** (`node build.mjs`) to pick up this change.

### ThemeToggle — the swatched theme control (design-system-007, ADR-0016)

The Dark/Light theme control is a **dedicated `ThemeToggle`** (`app/live.js`,
alongside the generic `Segmented`), not `Segmented` itself. `Segmented` fills the
**selected** option with `--surface-inverse` — a token that **flips under
`[data-theme]`** — which read *backwards* for a theme toggle (in dark mode the
selected "Dark" button went bright). Two rules fix it (ADR-0016):

- **Fixed, non-theming swatch tokens.** Each button **previews** the theme it
  switches to via two `:root` tokens that are **deliberately NOT redefined under
  `.dark` / `[data-theme="dark"]`**: `--swatch-light` (`#FAF8F4`) and
  `--swatch-dark` (`#0F1115`), plus fixed on-swatch foregrounds
  (`--swatch-light-fg`, `--swatch-dark-fg`) so the label + moon/sun icon stay
  legible on each swatch in **both** themes. The "Dark" button is always dark and
  the "Light" button always light, in either theme. These are the system's first
  **frozen** (theme-independent) tokens — the precedent: a control that *previews*
  a mode paints from frozen tokens, never the live surface tokens.
- **Selection by de-emphasis, never accent.** The selected option is at full
  strength; the unselected one is **dimmed** (opacity). No ring, no ochre, no new
  hue — keeping the accent reserved for status / focus (ADR-0014) and "color =
  status / content-type only" intact.

`Segmented` is **unchanged** — its inverse-fill selection still serves the
card-variant, drawer-header, and dashboard Board↔Library switchers (those are mode
switches, not theme previews, and read correctly inverse-filled). Both consumers
swap unforked (ADR-0003): the styleguide `TopBar` and the dashboard `ShellRail`
header — same `value` / `onChange` / `options` contract, same persistence
(`dashboard/app/theme-state.js`, agentic-workflow-017); only the control's look
changed.

> **Gate re-confirmed after the ThemeToggle redesign (`design-system-007`): OPEN —
> re-approved by the builder 2026-06-09.** The theme control in the styleguide
> `TopBar` (every page) now wears the swatched look (each button its own theme, the
> inactive one dimmed) instead of the inverse-filled `Segmented`. This visible change
> rode the same re-review as `design-system-005`; the builder reviewed the live
> control in the canvas header and re-confirmed. The gate stands open against the
> **swatched theme control**.

> Live-board note: same as Motion — the served dashboard `dist/` is a derived
> artifact (ADR-0003) and was **rebuilt** (`node build.mjs`) to pick up the new
> control + swatch tokens.

### Drawer header — Copy dropped; an optional Open-in-full-screen action (design-system-009)

The slide-over `Drawer` header (`app/drawer.js`, both `HeaderMinimal` and
`HeaderContextual`) lost its two dead, `onClick`-less buttons' worth of clutter:

- **Copy button removed.** The `IconButton name="copy" title="Copy path"` is gone
  from both headers — no replacement. (The `copy` glyph stays in `icons.js`; it is
  still used by the canvas copy-command button.)
- **Open-in-editor → optional Open-in-full-screen action.** The action is labelled
  **"Open in full screen"** (title + `aria-label`) and wears the **`maximize` glyph**
  (four outward corners — the fullscreen/expand cue; ds-013 swapped it off the
  external-link `square-arrow-out-up-right`, which read as "navigate away" — the wrong
  mental model for an action that maximizes the task into the main pane). It is wired
  to an **optional `onOpenFullScreen` callback** the consumer supplies — a single bare
  `onOpenFullScreen()` prop on `Drawer`, threaded to BOTH headers. **Absent callback →
  the button is not rendered** (the ds-006 `cornerAction` absent-slot precedent: the
  styleguide owns look/placement, the consumer owns behavior). In `HeaderMinimal` the
  vertical hairline divider before Close is guarded by the same callback, so it never
  dangles when the action is absent.

The Drawer's existing behavior (open/close animation, Esc + scrim-click close,
markdown body) is unchanged. The canvas (`styleguide/index.html` section 07)
supplies an `onOpenFullScreen` handler on both header demos so the action renders
visibly. The downstream consumer that wires `onOpenFullScreen` to render the task in
the dashboard main pane is `agentic-workflow-039` (not yet shipped — until then the
live slide-over passes no callback, so the action is correctly absent there).

> **Gate re-review reopened by the Drawer-header change (`design-system-009`).** The
> slide-over header (visible on every Drawer surface) dropped the Copy button and
> gained the Open-in-full-screen action; this is a visible styleguide change and
> reopens the design-system gate per the `design-system-005` / `007` precedent.
> Re-review with the builder against the canvas (`styleguide/index.html` → section 07
> header demos) **before** the agentic-workflow wiring (`agentic-workflow-039`) ships.

> Live-board note: same as Motion — the served dashboard `dist/` is a derived
> artifact (ADR-0003) and was **rebuilt** (`node build.mjs`) to fold the unforked
> Drawer change into `dashboard/dist/app.js`.

### Drawer contextual header leads with the title, path demoted (design-system-014)

The `HeaderContextual` header (`app/drawer.js`) now **leads with the item's title**
instead of the file path:

- **`describeItem` carries `title`.** Both the `doc` branch (the one the live
  dashboard renders on — no `status` is threaded) and the `ticket` branch (styleguide
  demo) now thread `title: item.title` onto the normalized drawer shape.
- **A prominent title heading.** `HeaderContextual` renders an `<h2>` lead line —
  `var(--font-ui)`, `15.5px`, `fontWeight: 600`, `var(--fg-1)` — directly under the
  pill/action row. The **path is demoted** to a quiet sub-line beneath it, keeping its
  existing `var(--font-mono)` / `11.5px` / `var(--fg-3)` treatment.
- **Graceful fallback.** `heading = info.title || info.path` — a title-less item still
  names itself with the path as the lead, and the (now redundant) path sub-line is
  guarded by `info.title` so it never duplicates the fallback heading. `HeaderMinimal`
  is unchanged (out of scope; the dashboard slide-over uses `contextual`).

This is the **styleguide capability** behind the dashboard request. Per ADR-0003 the
change lives in the styleguide source (consumed unforked); the dashboard `dist/` rebuild
and the actual title-data threading (`intentToDrawerItem`) are **agentic-workflow-047's**
job, not this task's — mirrors the `design-system-009` → `agentic-workflow-039` ordering.

> **Gate re-review reopened by the Drawer-header title change (`design-system-014`).**
> The contextual header now leads with a title heading — a visible styleguide change on
> the canvas (`styleguide/index.html` → Drawer section, both `describeItem`-fed demos).
> Re-review against the canvas **before** the agentic-workflow wiring (`agentic-workflow-047`)
> ships the title data and rebuilds `dist/`.

### Drawer — in-place expandable width (design-system-020)

The slide-over `Drawer` (`app/drawer.js`) can now **widen in place** — a different
affordance from `design-system-009`'s `onOpenFullScreen`, which *promotes the task out*
into the main pane. "Expand" keeps you where you are and makes the reading column wider;
"promote" leaves the slide-over entirely. The two are deliberately kept distinct.

- **A controlled expand seam (ds-005 pattern).** `Drawer` accepts `expanded` (boolean),
  `onToggleExpand`, and `expandedWidth` (string). `expanded` defined ⇒ **controlled** (the
  consumer owns the truth and supplies its own width); omitted ⇒ **uncontrolled** (the
  primitive holds its own `useState`). The load-bearing `expanded !== undefined ⇒ controlled`
  resolution is the React-free `isExpandControlled` in `app/drawer-state.js`, testable under
  `node --test` (mirrors `collapsible-state.js`'s `isControlled`). `onToggleExpand` fires on
  every toggle; state is written only when uncontrolled.
- **Styleguide owns the look, consumer owns the width.** The collapsed default
  `min(560px, 78%)` stays in the primitive (`COLLAPSED_WIDTH`); the expanded width is
  read from the `expandedWidth` prop. Rail-awareness is a **consumer fact** — there is no
  `248` literal and no `calc(100vw - …)` in `drawer.js`; the live slide-over passes its own
  rail-aware value (`agentic-workflow-074`).
- **A body-top chevron, not a header action.** An `IconButton` renders at the top-left of
  the **scrollable body, above `Markdown`** — a new slot. It flips label
  **"Expand panel" / "Collapse panel"** and glyph **`panel-right-open` (collapsed) /
  `panel-right-close` (expanded)**. The chevron sits with the content it widens; the
  header's maximize ("promote out") + Close are **untouched**. The header-action placement
  (chevron grouped beside maximize) was put to the builder and **rejected**.
- **Width transition + reduced-motion strip (ADR-0014).** The panel `transition` gains a
  `width …` segment alongside the existing `transform …` slide. Under
  `prefers-reduced-motion: reduce` (read via `matchMedia`, the modal/menu/search precedent)
  the **width** segment is stripped to instant; the slide already honours the same contract.
- **Two new glyphs.** `panel-right-open` / `panel-right-close` added to `app/icons.js`
  (Lucide geometry verbatim — shared rounded frame + right divider at `x=15`, with the
  chevron pointing into / out of the content). They read as "widen this right-anchored
  panel in place," deliberately distinct from `maximize` (four-corner promote).

Per ADR-0003 the capability lives in the styleguide source (consumed unforked); the
`dist/` rebuild and the rail-aware wiring are **agentic-workflow-074's** job, not this
task's — mirrors the `design-system-009` → `agentic-workflow-039`,
`design-system-014` → `agentic-workflow-047` ordering. This task ships the capability with
no live dashboard consumer yet (the ds-017 / ds-018 live-board pattern).

> **Gate re-review reopened by the Drawer expandable-width change (`design-system-020`).**
> A body-top chevron now appears on every Drawer surface, the canvas Drawer section (07)
> gains an `expanded`-driven specimen, and two glyphs join the section-04 icon gallery — a
> visible styleguide change that reopens the design-system gate per the `design-system-005`
> / `007` / `009` / `014` / `015` / `017` / `018` precedent. Re-review against
> `styleguide/index.html` (Drawer section 07 + the section-04 icon gallery) **before**
> `agentic-workflow-074` wires the live slide-over and rebuilds `dist/`.

### Content type — `concept` joins the registry (design-system-021)

The content-type registry (`app/data.js`, `CONTENT_TYPES`) gained a **seventh**
type, `concept`, alongside the existing `ticket | context | vision | map | research
| adr` — so any consumer emitting `{ type: 'concept' }` gets a distinct icon + color
at a glance, the same shape as the other six. Before this, `CONTENT_TYPES` had no
`concept` key, so the `TreeItem` deref (`const t = CONTENT_TYPES[item.type]` then
`<Icon name=${t.icon} … />`) would have thrown on a concept row. This is the
styleguide capability behind aw-075 (Concepts as a first-class artifact kind in the
dashboard's left-rail nav group + search category).

- **Glyph → `lightbulb`** (builder-decided at refine — concept = idea / insight /
  synthesis). Added to `app/icons.js` `LUCIDE` at upstream Lucide geometry (bulb dome
  path + filament base `M9 18h6` + screw base `M10 22h4`), inner markup only; `Icon`
  supplies the `<svg>` wrapper. Surfaced in the section-04 interface-set gallery
  (`foundations2.js`, the curated `ui` array).
- **Registry entry** — `concept: { label: "Concept", icon: "lightbulb", color:
  "var(--ct-concept)", tint: "var(--ct-concept-tint)" }`, placed **after** `adr`,
  preserving registry order. It auto-surfaces in the section-04 content-type set
  (that DocCard is `Object.entries(CONTENT_TYPES)`-derived).
- **Tokens → a magenta / pink hue** (builder-decided at refine — maximally distinct
  from the six in use; nearest neighbour is map purple). `--ct-concept` /
  `--ct-concept-tint` added to **both** theme blocks of `styles/agentheim.css`: light
  `#B0479A` / tint `#F7E3F1`, dark `#D98AC8` / tint `#2A1626`. It is distinct from the
  six existing content types and **never** aliases the reserved selection accent
  `--accent-ochre-soft` (ADR-0016).
- **Canvas specimen** — a "Concepts" group of `type: 'concept'` rows joins the demo
  `LIBRARY`, so the section-09 `TreeSpecimen` renders a live concept `TreeItem`
  (exercising the previously-throwing deref) and section-04 shows the new glyph in
  both the interface set and the content-type set.

Per ADR-0003 the change lives in the styleguide source (consumed unforked); the
`dist/` rebuild + the rail/search wiring are **agentic-workflow-075's** job, not this
task's — mirrors the `design-system-017` → `agentic-workflow-048`, `design-system-020`
→ `agentic-workflow-074` ordering. This task ships the capability with no live
dashboard consumer yet (the ds-017 / ds-018 / ds-020 live-board pattern).

> **Gate re-review reopened by the `concept` content-type (`design-system-021`).** A
> new content-type glyph (`lightbulb`) joins the section-04 icon gallery + content-type
> set, a magenta/pink `--ct-concept` token pair lands in both themes, and the
> section-09 `TreeSpecimen` renders a live `type: 'concept'` row — a visible styleguide
> change that reopens the design-system gate per the `design-system-005` / `007` /
> `009` / `014` / `015` / `017` / `018` / `020` precedent. Re-review against
> `styleguide/index.html` (section 04 icon + content-type sets, section 09 tree) **before**
> `agentic-workflow-075` wires the Concepts rail group + search category and rebuilds `dist/`.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and was
> **not** rebuilt here — this change only adds a content type (glyph + registry entry +
> token pair) to the styleguide source with no shipped dashboard consumer yet; `dist/` is
> rebuilt by the consuming task (`agentic-workflow-075`) when concept rows actually render.

### Menu / Popover — the shared dropdown primitive (design-system-015)

The trigger-plus-dismissible-floating-panel affordance is now a single shared
primitive, `Menu` (`app/menu.js`, with `MenuItem` / `MenuDivider` sugar), instead
of a board-local dropdown. It was **factored out of the dashboard topbar's settings
gear** (`agentic-workflow-049`, which shipped the affordance board-local first) and
the topbar now consumes it **unforked** (ADR-0003) — the `agentic-workflow-014` →
`design-system-005` sequencing repeated (board-local control promoted once worth
unifying). Same seam as `Collapsible` (ds-005) and `cornerAction` (ds-006): the
styleguide owns the look/placement, the consumer owns the behavior.

- **Owns the open/close truth + the panel it reveals.** The `{open && panel}` reveal
  logic lives in ONE place. The floating panel is **anchored** under the trigger,
  aligned to the `align` edge (default `right`), elevated at **`--shadow-md`** (the
  "Popovers" elevation role named in the token set), on `--surface-1` with a hairline
  and `--radius-md`. The reveal is a one-frame opacity + small translate, **stripped
  under `prefers-reduced-motion`** (a hard show) — the standing ambient-motion
  contract.
- **Body-agnostic item area.** Consumers compose arbitrary menu items via `children`
  (the board composes a theme toggle, a skip-permissions toggle, a divider, and a
  Stop launch). `MenuItem` / `MenuDivider` are thin token-styled wrappers; consumers
  may also drop raw elements.
- **Trigger is a render-prop.** The consumer owns the trigger's look (the board passes
  a neutral gear that stays neutral when closed) and receives `{ open, toggle }`; the
  primitive owns the panel + dismissal. Keyboard-operable: a focusable `<button>`
  trigger (Enter/Space opens natively), focusable items, **Esc closes**.
- **Dismissal: Esc + outside-click, root-ref scoped.** An in-panel click (flipping a
  toggle) is scoped out by the primitive's root ref so the popover survives in-menu
  interaction. The decisions are pure (`app/menu-state.js`: `isControlled`,
  `isDismissKey`, `shouldDismissOnOutsideClick`, `isOpenKey`), testable under
  `node --test` without the canvas import map (mirroring `collapsible-state`).
- **Controlled OR uncontrolled.** Controlled when `open` + `onOpenChange` are
  supplied — the board drives it controlled so it can close the menu programmatically
  after a successful Stop; the primitive writes no internal state, only announces.
  Uncontrolled when `open` is omitted and `defaultOpen` is given — the primitive holds
  its own `useState`.

The board's `SettingsMenu` (`dashboard/app/board.js`) is now a **pure consumer**: its
former board-local popover machinery (the outside-click / Esc document listeners, the
root ref, the reduced-motion reveal, the panel chrome) is **deleted**, re-expressed via
the shared `Menu`. The aw-049 decisions are preserved — the closed gear stays neutral,
the `--obligation` armed hue stays on the skip-permissions toggle inside the open menu,
the toggles keep the menu open while Stop / Esc / outside-click close it. The canvas
documents the pattern in BOTH modes (section 10, `MenuSpecimen`).

> **Gate re-review reopened by the shared-Menu extraction (`design-system-015`).** The
> canvas gained a new documented **Menu / popover** pattern (section 10, a gear trigger
> + anchored `--shadow-md` panel in both controlled and uncontrolled modes) — a visible
> styleguide change that reopens the design-system gate per the `design-system-005` /
> `007` / `009` precedent. Re-review with the builder against the canvas
> (`styleguide/index.html` → section 10).

> Live-board note: same as Motion — the served dashboard `dist/` is a derived artifact
> (ADR-0003) and was **rebuilt** (`node build.mjs`) to fold the shared-Menu retirement
> into `dashboard/dist/app.js`.

> **Gate re-review reopened by the trash-2 glyph (`design-system-017`).** The shared icon
> set (`styleguide/app/icons.js`, the `LUCIDE` map) gained a `trash-2` glyph at upstream
> Lucide geometry, now surfaced in the canvas's section-04 interface-set gallery
> (`foundations2.js`, the curated `ui` array) — a visible styleguide change that reopens
> the design-system gate per the `design-system-005` / `007` / `009` / `014` / `015`
> precedent. Re-review with the builder against the canvas (`styleguide/index.html` →
> section 04, the new trash can in the monochrome interface set) **before**
> `agentic-workflow-048` ships the board's per-card dismiss affordance.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and was
> **not** rebuilt here — this change only adds a dictionary entry + gallery item to the
> styleguide source; `dist/` is rebuilt by the consuming task (`agentic-workflow-048`)
> when the trash can actually renders on the board.

### Button / Modal / ConfirmDialog — the centered confirm-dialog family (design-system-018)

The styleguide gained a **three-layer** primitive family for centered, scrim-backed
confirm dialogs — the affordance the board's per-card dismiss (`agentic-workflow-048`)
will eventually consume. Built ahead of a shipped board-local consumer (a builder
override of the build-later trigger); the canvas specimens stand in as proof-of-shape.

- **`Button` (`app/button.js`) — the first shared labelled button.** Before this there
  was only the icon-only ghost `IconButton` (`app/drawer.js`). A token-composed labelled
  button (`--font-ui`, `--radius-sm`, hairline, the `IconButton`'s
  `--duration-fast`/`--ease-base` hover language) with **two variants**: `neutral`
  (default — `--surface-1` fill brightening to `--surface-2`) and `destructive`, which
  draws from the **`--obligation` danger family** (`--obligation-soft` fill, `--obligation`
  border/label). Danger never borrows the **reserved ochre selection accent** (ADR-0016).
  Presentational and stateless beyond local hover — no state module. Keyboard-operable
  for free (native `<button>`).
- **`Modal` (`app/modal.js`) — the centered scrim-backed shell.** The **centered sibling
  of the `Drawer`**: it borrows the Drawer's proven machinery (the `window`
  keydown-Escape listener, the scrim `onClick`, the `requestAnimationFrame` shown-flag
  reveal, the 200ms unmount delay) but differs deliberately on three axes — (1) it is
  **`position: fixed`, viewport-centered, and stacked ABOVE the Drawer** (`zIndex: 60` >
  the Drawer's `40`), not a contained `absolute; inset:0` pane; (2) the reveal is **fade +
  slight scale-up** (`scale(0.97)` → `scale(1)` with opacity over `--duration-base`), not
  the Drawer's `translateX` slide, **stripped to a hard show under
  `prefers-reduced-motion`** (ADR-0014); (3) it adds a **full focus trap** — focus moves
  into the panel on open, Tab/Shift-Tab cycle stays contained, and focus returns to the
  trigger on close. The scrim reuses the Drawer's **exact** `rgba(8,9,12,0.40)` dim
  verbatim (there is no `--scrim` token). The panel elevates at `--shadow-lg`, on
  `--surface-1` with a hairline and `--radius-md`. Body content is arbitrary (the
  body-agnostic seam of `Menu`/`Collapsible`).
- **`ConfirmDialog` (`app/confirm-dialog.js`) — composed over `Modal` + `Button`.** Renders
  consumer-supplied **title** + **body**, a **Cancel** (neutral `Button`) and a **Confirm**
  `Button`. **Esc, scrim-click, and Cancel all cancel** (route through the `Modal`'s
  `onClose`); **Confirm** fires the consumer's `onConfirm`. An optional **`destructive`**
  flag renders the Confirm as the destructive `Button` (the `--obligation` tint); default
  Confirm stays neutral. The consumer owns the copy/labels (the ds-005 / ds-006 / ds-015
  seam).

The pure dismiss-key and focus-trap-wrap decisions live React-free in
`app/modal-state.js` (`isDismissKey`, `isTrapKey`, `nextTrapFocusIndex`), testable under
`node --test` without the canvas import map — mirroring `collapsible-state` / `menu-state`.
The canvas documents the family in section 12 (`ModalSection`): the `Button` in both
variants, and a `ConfirmDialog` specimen with both a neutral and a destructive dialog.

> **Gate re-review reopened by the confirm-dialog family (`design-system-018`).** The
> canvas gained a new documented **Modal / confirm dialog** pattern (section 12: a Button
> row in both variants, and a live ConfirmDialog in neutral + destructive forms) — a
> visible styleguide change that reopens the design-system gate per the `design-system-005`
> / `007` / `009` / `014` / `015` / `017` precedent. Re-review with the builder against the
> canvas (`styleguide/index.html` → section 12) **before** `agentic-workflow-048` migrates
> its board-local confirm onto `ConfirmDialog`.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and was
> **not** rebuilt here — this task adds new primitives with **no shipped dashboard
> consumer** yet (the board still owns its own confirm). `dist/` is rebuilt by the consuming
> task (`agentic-workflow-048`) when `ConfirmDialog` actually renders on the board.

### Search field + grouped-results combobox (design-system-016, ADR-0024)

The styleguide gained a **search-field + grouped-results** pattern, `SearchField`
(`app/search.js`) — the affordance the dashboard's global search runs on. A
token-styled text input that, as you type, opens a floating panel of results
**grouped by category** (Bounded contexts → Decisions → Research → Tickets), each
row a title plus a matched-text excerpt, walked by the keyboard and chosen by Enter
or click. Consumed unforked (ADR-0003); same body-agnostic seam as `Menu` /
`Collapsible` / `cornerAction`.

- **The styleguide's first text-input control — search-scoped.** A token-styled
  input (surfaces / type / radii, an `--accent-ochre` focus ring + `--accent-ochre-soft`
  halo, a search glyph, and a clear `×` affordance). It stays **scoped to this
  module** — *not* extracted as a shared `Input` primitive (refine 2026-06-16): a
  general input waits for a **second** consumer, per the BC's "promote when the
  second consumer appears" doctrine (`Collapsible` ds-005, `Menu` ds-015). Retiring
  the bespoke board prompt-bar `<textarea>` onto a shared input is a *future* task.
- **A STANDALONE floating panel — not composed on the `Menu` (ADR-0024).** A
  combobox keeps focus **in the input** and highlights rows via
  `aria-activedescendant`, whereas `Menu` (ds-015) moves focus **into** its items —
  so wholesale reuse would fight that primitive. `SearchField` owns its **own**
  panel + outside-click/Esc dismiss machinery, and **matches the Menu's Popover
  elevation by convention** — the same `--shadow-md` / `--surface-1` / `--hairline`
  / `--radius-md` — so the two read identically **without sharing code**. The reveal
  is the standing one-frame opacity + translate, **stripped under
  `prefers-reduced-motion`**. (A third popover-ish consumer would make the dismiss
  machinery an extraction candidate — out of scope here.)
- **Active-descendant keyboard model.** Focus stays in the input; **↑/↓ move a
  single highlight across ALL rows (spanning groups)** via `aria-activedescendant`,
  **Enter** selects the highlighted row, **Esc** closes + clears; mouse hover + click
  select the same way. ARIA `combobox` input over a `role="listbox"` panel of
  `role="option"` rows.
- **Never a dead panel.** The panel state is a pure machine
  (`panelState(query, count)`): **closed** on an empty/whitespace query (no box),
  **no-results** (an explicit "no matches" line) on a non-empty query that matched
  nothing, **results** otherwise.
- **Body-agnostic / data-driven.** The consumer supplies the grouped result data +
  an `onSelect` callback (and optional `getTitle` / `getExcerpt` readers); the
  styleguide owns the look, placement, and keyboard mechanics. It **never** calls
  `/api/search` itself — it is fed (the `agentic-workflow-050` backend + ADR-0023;
  `agentic-workflow-052` does the topbar wiring + routing). Mirrors the
  `design-system-014` → `agentic-workflow-047` and `design-system-009` →
  `agentic-workflow-039` styleguide-capability-first ordering.

The load-bearing decisions are pure (`app/search-state.js`: `flattenGroups`,
`resultCount`, `panelState`, `nextActiveIndex`, `activeDescendantId`,
`arrowDirection`, `isDismissKey`, `isSelectKey`, `shouldDismissOnOutsideClick`,
`markMatches`), testable under `node --test` without the canvas import map —
mirroring `collapsible-state` / `menu-state` / `modal-state`. The canvas documents
the pattern in **section 11** (`SearchSpecimen` — type *design*, *adr*, or *zzz*).

> **Gate re-review reopened by the search pattern (`design-system-016`).** The canvas
> gained a new documented **Search & grouped results** pattern (section 11: a
> token-styled field opening a standalone `--shadow-md` panel of grouped, marked-
> excerpt result rows, walked by the keyboard) — a visible styleguide change that
> reopens the design-system gate per the `design-system-005` / `007` / `009` / `014`
> / `015` / `017` / `018` precedent. Re-review with the builder against the canvas
> (`styleguide/index.html` → section 11) **before** `agentic-workflow-052` wires it
> into the dashboard topbar.
>
> **Gate re-confirmed: OPEN — approved by the builder 2026-06-16.** The builder
> reviewed the live Search & grouped-results pattern in the canvas (section 11) and
> confirmed it ("styleguide looks good"). The gate stands open against the source that
> includes the search-field combobox; `agentic-workflow-052` may now consume it.
>
> **Gate re-review reopened by the search category-header contrast bump
> (`design-system-019`).** The grouped-results **category header** colour was raised
> from `--fg-4` (the dimmest foreground, below the `--fg-3` excerpts) to `--fg-2` — a
> stronger organising label that out-reads the excerpts yet stays quieter than the
> `--fg-1` result-row titles. Size/weight/uppercase/letter-spacing are unchanged; this
> is a colour-token-only, presentation change. It is a visible styleguide change that
> reopens the design-system gate per the `design-system-005` / `007` / `009` / `014` /
> `015` / `017` / `018` precedent. The served `dist/` was rebuilt (`node build.mjs`) so
> the live `agentic-workflow-052` topbar search picks up the stronger headers.
> **Builder confirmation PENDING** — re-review the canvas (`styleguide/index.html` →
> section 11, Search & grouped-results specimen) and re-confirm the gate OPEN.
>
> **Gate re-review reopened by the inquiry glyph (`design-system-r4k8m`).** The shared
> icon set (`styleguide/app/icons.js`, the `LUCIDE` map) gained a
> `message-circle-question` glyph at upstream Lucide geometry (chat bubble carrying a
> question mark — "ask a question toward the codebase") for the board's Inquire launch
> card (`agentic-workflow-h7n2c`), and it is surfaced in the section-04 interface-set
> gallery (`foundations2.js`, the curated `ui` array) — a visible styleguide change that
> reopens the design-system gate per the `design-system-005` / `007` / `009` / `014` /
> `015` / `017` precedent. `dist/` deliberately NOT rebuilt — a derived artifact
> (ADR-0003) that the consuming task (`agentic-workflow-h7n2c`) rebuilds when the Inquire
> card actually renders the glyph on the board. **Builder confirmation PENDING** —
> re-review the canvas (`styleguide/index.html` → section 04, Iconography interface set)
> and re-confirm the gate OPEN.
>
> **Gate re-review reopened by the double-chevron pair (`design-system-c3p9k`).** The
> shared icon set (`styleguide/app/icons.js`, the `LUCIDE` map) gained the
> `chevrons-up` and `chevrons-down` glyphs at verbatim upstream Lucide geometry (two
> stacked chevrons each — "collapse upward / expand downward") for the Done-column
> collapse control (`agentic-workflow-m2v8d`), and both are surfaced in the section-04
> interface-set gallery (`foundations2.js`, the curated `ui` array) — a visible
> styleguide change that reopens the design-system gate per the `design-system-005` /
> `007` / `009` / `014` / `015` / `017` / `r4k8m` precedent. `dist/` deliberately NOT
> rebuilt — a derived artifact (ADR-0003) that the consuming task
> (`agentic-workflow-m2v8d`) rebuilds when the collapse button actually renders the
> glyph on the board. **Builder confirmation PENDING** — re-review the canvas
> (`styleguide/index.html` → section 04, Iconography interface set) and re-confirm the
> gate OPEN.
>
> **Gate re-review reopened by the prompt-mode glyphs + icon Enter button
> (`design-system-xr4sb`).** Aligned to Section 1b: the shared icon set
> (`styleguide/app/icons.js`, the `LUCIDE` map) gained `diamond` (Modeling, replaces the
> undeliberate `compass`) and `circle-dot` (Research, replaces the undeliberate
> `search`), both surfaced in the section-04 interface-set gallery (`foundations2.js`,
> the curated `ui` array). Inquire keeps `message-circle-question` (r4k8m's deliberate
> glyph supersedes 1b's bare "?" — no shipped decision reversed, no ADR). A third glyph,
> `corner-down-left`, backs a new solid-ochre icon-square `EnterButton` variant
> (`styleguide/app/button.js`) — filled `--accent-ochre` directly, `--radius-sm`
> corners, a compact square footprint, licensed by ADR-0048's surface-2 "primed
> primary action" carve-out (it fires/commits the prompt, so ochre is permitted; not a
> new accent exception). The glyph foreground draws from a new dedicated
> `--accent-ochre-fg` token pair (`styles/colors_and_type.css`) rather than a generic
> `--fg-1`/`--surface-0` surface token, because `--accent-ochre` inverts lightness
> across themes (darker in light theme, lighter in dark theme) — the opposite of how
> `--fg-1` flips, so a generic foreground token would go illegible in one theme. Both
> mode glyphs and the Enter-button specimen are a visible styleguide change that
> reopens the design-system gate per the `design-system-005` / `007` / `009` / `014` /
> `015` / `017` / `r4k8m` / `c3p9k` precedent. `dist/` deliberately NOT rebuilt — a
> derived artifact (ADR-0003) that the consuming task (`agentic-workflow-q7r3x`)
> rebuilds when the tab layout + Enter button actually render on the board.
> **Builder confirmation PENDING** — re-review the canvas (`styleguide/index.html` →
> section 04, Iconography interface set; section 12, Button — neutral, destructive &
> Enter) and re-confirm the gate OPEN.

> **Gate re-review reopened by the EnterButton disabled state
> (`design-system-tfhn6`).** `EnterButton` (`styleguide/app/button.js`) gains a
> `disabled = false` prop, forwarded to the underlying `<button>` as the real
> `disabled` attribute — the control leaves the tab order and cannot be activated by
> click or keyboard, not a consumer-side `pointer-events` fake that would leave it
> focusable and announcing as enabled. Painted as de-emphasis by `opacity` only
> (ADR-0016): `opacity: 0.55` / `cursor: default` when disabled, `opacity: 1` /
> `cursor: pointer` otherwise — the `--accent-ochre` fill and `--accent-ochre-fg`
> glyph (ADR-0048's surface-2 carve-out, ADR-0051) stay literal and untouched in both
> branches, preserving the two-theme contrast pairing xr4sb established rather than
> stranding the glyph on an unvetted fill swap. This is the styleguide's first
> disabled state on any primitive — the shape (real attribute + ADR-0016 opacity,
> never a fill swap) is the one a later `Button` / `IconButton` disabled state should
> follow. A second "Enter — disabled" specimen sits beside the existing enabled one in
> `ButtonRow` (section 12), a visible styleguide change that reopens the design-system
> gate per the `design-system-005` / `007` / `009` / `014` / `015` / `017` / `r4k8m` /
> `c3p9k` / `xr4sb` precedent. `dist/` deliberately NOT rebuilt — a derived artifact
> (ADR-0003) that the consuming task (`agentic-workflow-m3vhq`) rebuilds when the
> disabled Enter button actually renders on the board's Plain prompt-bar mode.
> **Builder confirmation PENDING** — re-review the canvas (`styleguide/index.html` →
> section 12, Button — neutral, destructive & Enter) and re-confirm the gate OPEN.

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and
> was rebuilt here (`node build.mjs`), but the bundle is byte-identical — the
> dashboard entry is the board, and `SearchField` has **no shipped dashboard consumer
> yet** (it is consumed only by the canvas + the future `agentic-workflow-052`), so it
> is not yet pulled into `dist/app.js`. The build was re-run to keep `dist/` provably
> in sync with source; `dist/` folds `SearchField` in when `agentic-workflow-052`
> actually renders it on the board.

### ModelSplitButton — the ochre Enter button widens into a labelled split button (design-system-r9dtm, ADR-0048, ADR-0051)

The prompt console's launch affordance widens from an icon-only square into a
**split button**, `ModelSplitButton` (`app/button.js`, sibling to the unchanged
`EnterButton`): a primary region (the `corner-down-left` glyph + the current
model's label) that launches, and a caret region that opens a menu of model
options. **One ochre surface, one hairline divider — not a second neutral
button beside the ochre one**: ADR-0048 licenses ochre on the whole primed
primary action (surface 2, restated by ADR-0051), and the caret is part of
that same action, not a separate one of different weight.

- **Two `<button>`s, one bordered ochre group.** The primary region fires
  `onClick` (the launch) and never opens the menu; the caret fires
  `onOpenMenu`/toggles the menu and never launches — a real click-region
  split via two elements, not a click-position test on one button.
- **`locked` removes the caret region and the menu entirely** (absent, not
  merely disabled) — the Quick Capture pinned-model case. The primary region
  still launches.
- **`disabled` governs the PRIMARY region only** (`design-system-me97j`,
  fixing `design-system-r9dtm`'s original single-gate wiring): the primary
  `<button>` alone gets the real `disabled` attribute and dims to
  `opacity: 0.55`, matching `EnterButton`'s existing disabled treatment
  (ADR-0016 opacity-only de-emphasis, never a fill swap). The caret region is
  untouched by `disabled` — full opacity, clickable, keyboard-reachable, menu
  openable — because the only thing `disabled` ever means at the one real
  consumer (the dashboard prompt bar) is "there is nothing to launch," which
  has no bearing on picking a model for the *next* launch. Only `locked`
  removes the caret region; a control painted dead that still responds to
  clicks is a lying affordance, so the whole-surface dim was rejected rather
  than kept and merely made harmless.
- **A roving-tabindex menu — a third, distinct focus model** from `Menu`
  (ds-015, consumer-supplied focusable items) and `SearchField` (ds-016,
  focus stays in the input via `aria-activedescendant`). Opening the caret
  moves focus onto the highlighted `role="menuitemradio"` row (`aria-checked`
  on the current option); ArrowUp/ArrowDown move the highlight (clamped, no
  wraparound), Enter selects and closes, Escape closes **and returns focus to
  the caret** (no keyboard trap, WCAG 2.1.2). The caret carries
  `aria-haspopup="menu"` / `aria-expanded`; the panel is `role="menu"` on
  `--surface-1` / `--hairline` / `--shadow-md`, matching every other popover
  by convention.
- **The panel emits upward, unconditionally** (`design-system-k3f7q`): it
  anchors `bottom: calc(100% + 6px)`, never `top:` — no `menuPlacement` prop,
  no collision auto-flip. The split button's only home is the bottom-docked
  prompt console (`agentic-workflow-bz3az`), so a downward-opening panel
  would open straight into the viewport's bottom edge; Quick Capture pins the
  model (`locked` renders no caret or menu at all), so no consumer wants it
  downward. ArrowUp/ArrowDown keep their existing meaning — the panel moving
  above the button does not invert them. Revisit only if a second,
  top-anchored consumer appears. The board-side half of this fix moved the
  prompt console's `overflow: hidden` off the `<section>` and onto the
  `role="tablist"` mode-tab row (the only element that actually needed it, to
  round its own end cells) — the section no longer clips anything absolutely
  positioned inside it, this menu included.
- **Body-agnostic model list.** The model list is never the styleguide's to
  know — it arrives as `options` (an array of labels) via props; no
  Agentheim-specific model name appears anywhere in the styleguide source or
  canvas (canvas specimens use placeholder labels).
- **No-reflow width.** The label region's `min-width` is sized in `ch` units
  from the longest of `options` (`widestOptionLength`, `button-state.js`), so
  switching the selected model never reflows the prompt-bar row — no fixed
  pixel width.
- **New glyph** — `chevron-down` joins `app/icons.js` (verbatim Lucide
  geometry) for the caret.

The keyboard/menu decisions are pure (`app/button-state.js`:
`initialHighlightIndex`, `nextHighlightIndex`, `arrowDirection`,
`isSelectKey`, `isDismissKey`, `widestOptionLength`), testable under
`node --test` without the canvas import map — a dedicated module rather than
composing `Menu`/`SearchField`'s state, mirroring `search.js`'s own
"a third distinct focus model earns its own state module" precedent. The
canvas documents four specimens in section 12 (`ModelSplitButtonRow`):
normal, locked, disabled, and menu-open (via a `defaultOpen` prop mirroring
`Menu`'s idiom).

Per ADR-0003 the primitive lives here so `agentic-workflow-m2vkp` (the
prompt-bar consumer, which `depends_on` this task) consumes it **unforked** —
the board must not hand-roll its own ochre split button.

> **Gate re-review reopened by ModelSplitButton (`design-system-r9dtm`).** A
> new split-button primitive joins section 12 of the canvas (normal, locked,
> disabled, and menu-open specimens) and the shared icon set gains
> `chevron-down` — a visible styleguide change that reopens the design-system
> gate per the `design-system-005` / `007` / `009` / `014` / `015` / `017` /
> `018` / `r4k8m` / `c3p9k` / `xr4sb` / `tfhn6` precedent. Re-review against
> the canvas (`styleguide/index.html` → section 12, "ModelSplitButton — Enter
> widened into a labelled split button") **before** `agentic-workflow-m2vkp`
> wires it into the live prompt bar and rebuilds `dist/`.

> **Gate re-review reopened again by the menu-placement fix
> (`design-system-k3f7q`).** The menu-open specimen's panel now emits upward
> instead of downward (a visible change to the section 12 canvas) — re-review
> the "Menu open" specimen before the fix is considered gate-clean.

> **Gate re-review reopened again by the disabled-caret fix
> (`design-system-me97j`).** The "Disabled" specimen now paints two-tone —
> the primary region alone dims to 0.55 opacity, the caret region stays at
> full opacity and clickable — where it previously dimmed the whole ochre
> group (a visible change to the section 12 canvas). Re-review the
> "Disabled" specimen before the fix is considered gate-clean.

> Live-board note: the served dashboard `dist/` is a derived artifact
> (ADR-0003) and was **not** rebuilt here — this task ships the primitive with
> **no shipped dashboard consumer yet** (the ds-018/ds-020/ds-021 live-board
> pattern); `dist/` is rebuilt by the consuming task (`agentic-workflow-m2vkp`)
> when the split button actually renders on the board's prompt bar.

### Command-deck retokenization (design-system-a31e0, ADR-0048, ADR-0049)

See the identity-framing note above (under "The styleguide") for the full hex table.
Every surface, hairline, foreground, and accent value in **both** `[data-theme]` blocks
of `styles/colors_and_type.css` changed (values only, no rename), the frozen preview
swatches re-pinned (ADR-0049 §3), and `styles/agentheim.css` gained the
`--emphasis-border` token pair (ADR-0048, no consumer wired yet).

> **Gate re-review reopened by the Command-deck retokenization
> (`design-system-a31e0`).** This is the single biggest visual change the canvas has
> taken to date — every component's chrome now renders in the cooler, darker
> Command-deck palette instead of the warm-paper-derived one. **One consolidated
> re-review of the whole canvas** (`styleguide/index.html`, every section) is needed
> with the builder, not a per-component pass, per the `design-system-005` / `007` /
> `009` / `014` / `015` / `017` / `018` / `020` / `021` / `v8k2p` / `w4t9k` / `b7n2s`
> precedent. This unlocks the downstream agentic-workflow wiring set (`vk6mc` /
> `wsfsk` / `bz3az` / `a2pm1` / `c2ver`) and the sibling radius task (`t896s`).
> **Builder confirmation PENDING.**

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and
> **was rebuilt** (`node build.mjs`, from `dashboard/`) in this task — verified
> reproducible (a second run produced no further diff) — so the live dashboard picks
> up the new hexes immediately, ahead of any downstream agentic-workflow consumer.

### TicketCard corner radius — dedicated `--radius-card` token (design-system-t896s)

1b's condensed ticket card calls for a 10px corner radius, larger than the system's
8px `--radius-md`. `--radius-md` is a heavily shared token — grepping its consumers
found `Menu` (`menu.js`), `Modal` (`modal.js`), the `Drawer` (`app.js`), `SearchField`
(`search.js`), `EmptyColumn` (`empty.js`), the live-activity list (`live.js`), and
several `app.js` chrome panels, all rounding at 8px. Bumping `--radius-md` itself
would have re-rounded every one of those unrelated surfaces as a side effect of a
ticket-card-only aesthetic call from 1b.

Decision: introduce a dedicated `--radius-card: 10px` token (`styles/colors_and_type.css`,
in the shared `:root` radii block — radius is not a per-theme value, so it lives
alongside `--radius-sm` / `--radius-md`, not duplicated per `[data-theme]` block).
`TicketCard`'s base style (`app/kanban.js`) now reads `var(--radius-card)` instead of
`var(--radius-md)`; `Menu`/`Modal`/`Drawer`/everything else keeps `--radius-md` at 8px,
untouched. The Foundations "Radii" doc card (`app/foundations2.js`) was updated to
list the new token (role: "Ticket card") and to relabel `--radius-md`'s role as
"Menu, modal, drawer" now that it no longer covers cards.

> **Gate re-review reopened by the TicketCard radius bump (`design-system-t896s`).**
> A small, isolated visual change to a single, already-reviewed primitive — the
> `design-system-008` / `design-system-010` precedent applies (lightweight
> re-review of the Kanban section of the canvas, not a full pass). **Builder
> confirmation PENDING.**

> Live-board note: the served dashboard `dist/` is a derived artifact (ADR-0003) and
> **was rebuilt** (`node build.mjs`, from `dashboard/`) in this task — verified
> reproducible (a second run produced no further diff).

## Relationships with other contexts

- **agentic-workflow** — depends on this BC's styleguide for its `dashboard` feature.
- **infrastructure** — the styleguide ships as plain static assets (no install); the
  dashboard's runtime (`infrastructure-001`) should vendor/pre-bundle the CDN scripts the
  canvas currently loads. See `design-system-001` → Delivery.

## Pointers

- Styleguide artifact: `styleguide/index.html` (+ `styleguide/styles/`, `styleguide/app/*.js` ES modules; entry `app/app.js`)
- Shared `Collapsible` primitive: `styleguide/app/collapsible.js` (+ React-free `collapsible-state.js`), consumed by `TreeGroup` and the dashboard board (design-system-005)
- Shared `Menu` / `Popover` primitive: `styleguide/app/menu.js` (+ React-free `menu-state.js`), consumed by the dashboard topbar settings gear (design-system-015)
- Confirm-dialog family: `styleguide/app/button.js`, `styleguide/app/modal.js`, `styleguide/app/confirm-dialog.js` (+ React-free `modal-state.js`); the centered, scrim-backed confirm dialog the board's per-card dismiss will consume (design-system-018)
- Search field + grouped-results combobox: `styleguide/app/search.js` (+ React-free `search-state.js`); a standalone `--shadow-md` popover (NOT composed on `Menu`, ADR-0024) feeding the dashboard global search (`agentic-workflow-052`, fed by `/api/search` aw-050 + ADR-0023) (design-system-016)
- Drawer in-place expandable width: `styleguide/app/drawer.js` (+ React-free `drawer-state.js`); a controlled `expanded`/`onToggleExpand`/`expandedWidth` seam with a body-top chevron (`panel-right-open`/`panel-right-close` glyphs), consumed rail-aware by the dashboard slide-over (`agentic-workflow-074`) (design-system-020)
- `concept` content type: `styleguide/app/data.js` (`CONTENT_TYPES.concept`, `lightbulb` glyph, `--ct-concept`/`--ct-concept-tint` magenta tokens in `styles/agentheim.css`); the styleguide capability behind Concepts as a first-class artifact kind in the dashboard rail + search (`agentic-workflow-075`) (design-system-021)
- Dependency-relation ring: `styleguide/app/motion.js` (`dependencyRingClass`, re-exported from `styleguide/app/kanban.js`), `--rel-dep`/`--rel-dep-tint` tokens + `.rel-ring` keyframes in `styles/agentheim.css`, `--duration-relation` in `styles/colors_and_type.css`; the `TicketCard.dependencyRelation` prop the dashboard's hover-dependency feature will consume (`agentic-workflow-k5p8w`), see ADR-0034 (design-system-w4t9k)
- Hidden/off-viewport dependency markers: `styleguide/app/motion.js` (`dependencyPresentClass`, `edgeBlinkClass`), `Collapsible.hasHiddenDependency` (`styleguide/app/collapsible.js`), `.rel-present` / `.rel-edge-blink(--top|--bottom)` + keyframes in `styles/agentheim.css` (reusing `--rel-dep` / `--duration-relation`); the styleguide capability the board's collapsed-section marker and scroll-edge indicator will consume (`agentic-workflow-h9v3m`, `agentic-workflow-r9k2p`), see ADR-0034 pt. 6 (design-system-b7n2s)
- Prompt-mode tab glyphs + solid-ochre icon Enter button: `styleguide/app/icons.js` (`diamond`, `circle-dot`, `corner-down-left` glyphs), `styleguide/app/button.js` (`EnterButton`), `--accent-ochre-fg` dedicated on-accent foreground pair in `styles/colors_and_type.css` (ADR-0048 surface-2 carve-out, ADR-0051); the styleguide primitives the dashboard prompt console will consume (`agentic-workflow-q7r3x`) (design-system-xr4sb)
- `EnterButton` disabled state: `styleguide/app/button.js` (`disabled = false` prop, real `<button disabled>` attribute, ADR-0016 opacity-only de-emphasis — `--accent-ochre` fill / `--accent-ochre-fg` glyph stay untouched), second "Enter — disabled" specimen in `ButtonRow` (`styleguide/app/app.js`, section 12); the styleguide's first disabled state on any primitive, the shape a later `Button`/`IconButton` disabled state should follow; consumed by the dashboard's Plain prompt-bar mode (`agentic-workflow-m3vhq`) (design-system-tfhn6)
- TicketCard condensed to 1b: `styleguide/app/kanban.js` (meta row gated on `cornerAction`, title `marginBottom: cornerAction ? 12 : 0`, title 12px/1.5), `styleguide/app/primitives.js` (`MonoId` 10px, only two render sites, both in `kanban.js`); `app/card.js` (`showEstimate`, design-system-006) retired entirely — no remaining caller (design-system-v08qq)
- ModelSplitButton: `styleguide/app/button.js` (+ React-free `button-state.js`: `initialHighlightIndex`, `nextHighlightIndex`, `arrowDirection`, `isSelectKey`, `isDismissKey`, `widestOptionLength`), `chevron-down` glyph in `styleguide/app/icons.js`; the ochre `EnterButton` widened into a labelled split button with a roving-tabindex model menu, consumed unforked by the dashboard prompt bar (`agentic-workflow-m2vkp`) (design-system-r9dtm)
- BC index: `INDEX.md`
