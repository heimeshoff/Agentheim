---
id: ADR-0028
title: Task ids carry a short random token tail, replacing sequential integers; legacy ids coexist go-forward
scope: global
status: proposed
date: 2026-06-17
related_tasks: [agentic-workflow-077, agentic-workflow-qd24q]
related_adrs: [0001, 0012, 0017, 0022, 0026]
---

# ADR-0028: Task ids carry a short random token tail, replacing sequential integers; legacy ids coexist go-forward

## Context

A task id is the spine of the whole system: it names the `<id>-<slug>.md` file, it is the
key in `depends_on` / `blocks` / `prior_art` / `related_tasks`, it is the `[<id>]` commit
trailer that `git log` indexes (ADR-0026), it is the dashboard `id` projection, and it is
what retirement is defined over (ADR-0022). Until now that id was a **sequential per-BC
integer** (`agentic-workflow-077`), minted by scanning the BC's existing task files for the
next free number.

That mint assumes a **single writer owning a global counter**. The moment two people run
Agentheim on **separate branches of the same repo**, both scan the same tree and both pick
the same next number — `agentic-workflow-077` on branch A *and* `agentic-workflow-077` on
branch B — for two unrelated tasks. On merge they collide silently and corrosively: two
`<id>-<slug>.md` files claim one id, every backlink edge that mentions `agentic-workflow-077`
becomes ambiguous, the `[agentic-workflow-077]` trailer can no longer identify which task
shipped, and "dismissed ids are retired" (ADR-0022) loses meaning. The sequential-integer
scheme is fundamentally incompatible with concurrent, branch-based collaboration.

The migration policy is **fixed by the builder (go-forward coexistence)**: existing ids
(`agentic-workflow-001`…`-077`, all `design-system-*`, `infrastructure-*`) stay exactly as
they are on disk and in frontmatter — **no rewrite sweep, no history-touching migration**.
Legacy `[<id>]` commit trailers stay valid. Only *new* captures use the new scheme. The two
id shapes therefore coexist **permanently**, which is a hard constraint on whatever scheme
we pick: it must live alongside legacy `<bc>-NNN` ids with no ambiguity.

An architect round (2026-06-17) scored three zero-or-low-coordination schemes against the
hard requirements:

| Scheme | Collision-free | Readability vs long BC prefix | Ordering | Coexists w/ legacy | Mint complexity |
|---|---|---|---|---|---|
| **A** per-author/branch prefix (`agentic-workflow-mh-07`) | by discipline, not construction | good | within-author only | extra segment to parse | needs a per-writer namespace chosen once |
| **B** short random token (`agentic-workflow-k3f9q`) ✅ | **by construction** | **good** (5 chars) | none | **clean** (leading-letter tell) | trivial — emit a token |
| **C** ULID / timestamp (`agentic-workflow-01jz8k3f9q`) | by construction | poor (long) | global, sortable | clean | trivial |

The BC prefix is already the **full BC name** (`agentic-workflow-`, 17 chars) — `aw-` is
prose shorthand only — so id length matters, and ULID's extra length hurts most here.
Scheme B's only real cost is the loss of chronological ordering, which is acceptable: the
dashboard already sorts by `mtimeMs`, not by id (agentic-workflow-013), so id ordering was
only ever a human-readability nicety, never a mechanism.

## Decision

**New task ids are `<bc>-<token>`, where `<token>` is a short random string generated
independently on each branch with no coordination. Existing sequential ids are kept
unchanged; the two shapes coexist go-forward.**

### 1. Token grammar

- A new id is `<bc>-<token>`. The `<bc>-` prefix is unchanged — it still names the bounded
  context at a glance (`agentic-workflow-k3f9q`, `design-system-q7r2m`).
- `<token>` is **exactly 5 characters** drawn from Crockford base32, lowercase, minus the
  look-alikes `i l o u` — i.e. the alphabet `0123456789abcdefghjkmnpqrstvwxyz`.
- The **first character of the token is a letter** (`[a-hjkmnp-tv-z]` — note `p-t` then
  `v-z`, which excludes the `u` look-alike); the remaining four are any token character
  (`[0-9a-hjkmnp-tv-z]`). Lowercase only.
- Regex for a new tail: `[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}`.
- Example: `agentic-workflow-k3f9q` — 22 chars, only 2 longer than the legacy
  `agentic-workflow-077` (20). The on-disk filename is unchanged in shape:
  `agentic-workflow-k3f9q-collision-resistant-task-ids.md`.

### 2. Collision model — 5 chars, leading letter

The 32-symbol alphabet `0123456789abcdefghjkmnpqrstvwxyz` has **22 letters** (the leading
class `[a-hjkmnp-tv-z]`) and 10 digits. The leading-letter rule fixes the first character to
one of those 22 letters and leaves four free characters over the full 32-symbol alphabet,
giving `22 × 32^4 ≈ 2.31 × 10^7` ≈ **23.1 million** distinct tokens per BC. Birthday-collision
probability over a realistic concurrent window:

- n ≈ 50 unmerged new tasks in one BC: `≈ 1 − e^(−50·49 / (2·2.31e7))` ≈ **0.005%**.
- n = 1000 (implausible for a per-BC unmerged window): ≈ **2.2%**.

**5 characters is ratified** as the default. The belt-and-braces alternative was 6 chars
(`≈ 887M` space) at one extra keystroke; rejected for v1 because 5 already drives the
realistic-window collision probability to a rounding error, and the id is typed by humans
in `dismiss <id>` / `refine <id>`. The optional duplicate-id CI lint (child task 4) is the
cheap insurance against the residual tail, not a longer token.

**Leading-letter rule** (vs the weaker "tail contains ≥1 letter") is ratified because it is
the structural disambiguation tell against legacy ids (§3) and is trivially checkable: a
parser keys on the single character right after the last `-`.

### 3. Coexistence with legacy ids — the disambiguation tell

- A **legacy** tail is **all digits** (`-077`).
- A **new** tail **leads with a letter** (`-k3f9q`).

These two shapes are disjoint: a digit-leading tail is never a new token, a letter-leading
tail is never legacy. Parsers disambiguate on "is the first character after the last `-` a
letter?" — no lookup table, no migration map. Legacy ids are untouched on disk and in
frontmatter; their `[<bc>-NNN]` commit trailers stay valid forever (ADR-0026 unchanged).

### 4. Resolution touch-points

- **`deriveContext(id)`** (`lib/task-lifecycle.mjs`, currently `/^(.*)-\d+/`) is the **one**
  code change. It must derive the BC for **both** shapes. The minimal correct form is a
  dual-shape, end-anchored match:
  `/^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/`, returning `m[1]` as the BC. (The
  current regex is unanchored and matches the *first* `-NNN`, which already misbehaves on
  ids whose slug contains digits; the replacement is end-anchored on the id, and
  `deriveContext` is called with the bare id, so the slug is not in scope.) This change is
  carried by a child `refactor` task with tests asserting **both** `agentic-workflow-077`
  and `agentic-workflow-k3f9q` derive `agentic-workflow`.
- **`resolveTaskFile`** (`lib/task-lifecycle.mjs`) needs **no change**. Its existing
  trailing-`-` anchor (`name === '<id>.md' || name.startsWith('<id>-')`, ADR-0012) already
  resolves both shapes. ADR-0012's guarantee that a bare `alpha-001` never collides with a
  longer-numbered `alpha-0010` now *also* disambiguates legacy vs new tokens by the same
  anchoring. The refactor task adds a resolution test for a token-tailed id to lock this in.
- **Commit trailer** (`[<bc>-<token>]`, ADR-0026) — unchanged; a token is greppable exactly
  as an integer was.
- **Dashboard `id` projection** — unchanged; it carries the id verbatim.

### 5. Retirement under the new scheme (amends ADR-0022 §5)

ADR-0022 §5 said: *"IDs are gone, never reused. Consistent with 'never renumber': a
dismissed number is retired, a future capture takes the next free number."* Under the new
scheme **there is no "next free number"** to take. The generator emits a random token and
**never consults history**, so:

- "**never reuse, never renumber**" holds **by construction** — a dismissed token is simply
  one of ~23.1M points the generator will, with overwhelming probability, never emit again,
  and there is no counter to advance or rewind.
- The legacy clause is **retained verbatim for legacy ids**: a dismissed legacy *number* is
  retired and a future *legacy-style* capture (there are none going forward) would take the
  next free number. New captures never renumber because they never number.

ADR-0022 §5 is amended in place to state both: legacy ids keep the retired-number rule; new
ids satisfy never-reuse by construction because tokens are random and the generator never
consults history.

### 6. Minting call sites

Every id-minting instruction in the **three live skills** moves from "scan existing files to
determine the next number" to "emit a fresh random token":

- `skills/modeling/SKILL.md` — CAPTURE's "look at existing task files to determine the next
  number" step.
- `skills/quick-capture/SKILL.md` — "determine the next number by scanning all four" step.
- `skills/brainstorm/SKILL.md` — its greenfield foundation tasks (walking skeleton,
  styleguide) that today mint `-001`-style ids.

Eval fixtures under `skills/capture-workspace/` are **explicitly left unchanged** — they are
snapshots / fixtures, not a live skill. This is carried by a child `chore` task.

### 7. Well-known foundation ids — the styleguide gate (the genuinely open call)

`brainstorm` mints a foundation styleguide task and the styleguide *gate* references it by a
**hard-coded id**: every frontend task across every BC must list `design-system-001-styleguide`
in its `depends_on` (`skills/modeling/SKILL.md`, `skills/brainstorm/SKILL.md`, and each
frontend-bearing BC README). A hard-coded id is incompatible with a *random* token: if
`brainstorm` mints `design-system-q7r2m` for the styleguide in a new project, nothing
downstream knows that string.

**Decision: foundation tasks keep a deterministic, reserved well-known id; the random-token
scheme applies only to ordinary captures.** Specifically:

- `brainstorm` mints the styleguide task with the **reserved id**
  `design-system-001-styleguide` (and the walking-skeleton / foundation tasks likewise keep
  their reserved deterministic ids). These are emitted by `brainstorm` exactly once per
  project, by `brainstorm` alone, before any concurrent multi-branch capture exists — so
  there is **no two-writer race** to collide them, and the gate references in the skills and
  BC READMEs stay valid as written.
- Reserved ids are a **closed, enumerated set** owned by `brainstorm` (today: the styleguide
  gate id, and the walking-skeleton foundation id). They are the only ids that may carry a
  digit-leading legacy-style tail going forward; everything `modeling` / `quick-capture`
  mints is a random token.
- The disambiguation tell still holds: a reserved foundation id (`design-system-001`) has an
  all-digit tail and resolves as "legacy-shaped" through `deriveContext` / `resolveTaskFile`
  with no special case.

Rejected alternative — *"`brainstorm` records the minted random id and every skill looks it
up dynamically"*: it adds a lookup indirection (a `foundation-ids` registry file or a README
scrape) to the hottest gate in the system, for no benefit over reserving the id, since the
foundation task has no two-writer race to protect against. Reservation is strictly simpler
and keeps the gate references literal and greppable. For *this* repo the point is moot —
`design-system-001-styleguide` already exists as a kept legacy id — but the reservation rule
is what makes the gate survive in a **new** project.

### 8. Re-routing across bounded contexts (amends, agentic-workflow-qd24q / ADR-0077)

A cross-BC move of a backlog task (`reroute`) cannot keep the moved task's id. The id is a
composite `{context, token}` value (§1 above): the `<bc>-` prefix is not decoration, it is
load-bearing — `deriveContext(id)` is a pure prefix parse with no fallback, and
`promoteTask`/`completeTask`/the vestigial `findMovedFromDoingPath` all default their BC
through it with no explicit `context` override supplied by any current skill. `captureTask`
additionally fail-closes a frontmatter `context:` that disagrees with the id-derived prefix
(`context-mismatch`). A re-route that kept the old id and merely rewrote `context:` in
frontmatter would therefore mint exactly the state `captureTask` already refuses to accept,
and would silently disagree with `deriveContext` everywhere else the id is used.

**Decision: `reroute` mints a fresh `<to-bc>-<token>` id via the new `mintTaskId(context)`
(`lib/id-grammar.mjs`) and retires the old id, rather than keeping it under the new BC.** The
token is generated randomly, exactly per §1 (never by scanning history), and verified against
`classifyTaskId` before use (the ADR-0044 backstop). This is the first CODE call site that
mints an id — every other minting instruction in this ADR (§6) is agent prose a skill
executes; `reroute` is a mechanized verb with no agent turn in the loop to hand-pick a token,
so the mint itself had to become code.

Because the old and new ids are *different* (unlike every other mechanized move in this
project, which preserves the id across a folder transition), the retired-old/minted-new pair
needs its own crash-retry idempotence story: the new file carries a `rerouted_from: <old-id>`
frontmatter field, which a retry scans the target BC's `backlog/` for before minting anything,
reusing the found successor's id rather than manufacturing a second one. See
`agentic-workflow-qd24q`'s ADR-0077 for the full verb contract, its manifest, and its
rejection ladder.

This section amends §1's scope statement only insofar as a token is now also minted by code,
not only by agent prose — the token grammar itself (§1) and the collision model (§2) are
unchanged and govern the code-minted case identically.

## Consequences

**Positive**

- Two branches can each capture a new task with no shared counter and never collide on
  merge — the core requirement — collision-free by construction, not by discipline.
- The id stays human-usable: `agentic-workflow-k3f9q` is two characters longer than the
  legacy id, still typeable in `dismiss`/`refine` and readable on a board card.
- BC affiliation is preserved (the `<bc>-` prefix is unchanged).
- Legacy ids and their commit trailers are untouched — zero migration risk, zero history
  rewrite.
- Never-reuse / never-renumber now holds **by construction** for new ids, not by a
  bookkeeping convention.

**Negative**

- New ids carry **no chronological ordering** — you cannot tell from two ids which was
  captured first. Accepted: the dashboard sorts by `mtimeMs` (agentic-workflow-013), and id
  ordering was never a mechanism.
- A token is **less mnemonic** than a small integer (`k3f9q` vs `077`). Mitigated by the
  short length and by always pairing the id with the slugged filename / card title.
- A residual, tiny collision probability remains (≈0.005% at a realistic window). Mitigated
  by the optional duplicate-id CI lint (child task 4), not by a longer token.
- Two id shapes coexist permanently, so any new id-parsing code must handle both. Mitigated:
  the only parser that cares (`deriveContext`) gets the dual-shape regex once.

**Neutral**

- ADR-0012's anchored id→file resolution is unchanged and now does double duty as the
  legacy-vs-token disambiguator at the filesystem layer.
- The commit-trailer index (ADR-0026) and the dashboard projection are unchanged — both
  carry the id verbatim regardless of shape.

## Alternatives considered

- **Scheme A — per-author/branch prefix** (`agentic-workflow-mh-07`). Rejected: collision-free
  only *by discipline* (two authors must pick distinct namespaces, and one author on two
  branches still collides), and it adds a segment every parser must learn.
- **Scheme C — ULID / timestamp tail** (`agentic-workflow-01jz8k3f9q`). Rejected: collision-
  free and globally sortable, but the long tail hurts most precisely here, where the prefix
  is already the full BC name; the chronological ordering it buys is something the dashboard
  does not use.
- **6-character token.** Considered as belt-and-braces; rejected for v1 — 5 chars already
  makes the realistic-window collision a rounding error, and the CI lint covers the tail.
- **Rewrite-migration of legacy ids to tokens.** Off the table — the builder fixed
  go-forward coexistence; a rewrite would touch history and invalidate every legacy commit
  trailer for no benefit.

Builds on **ADR-0001** (ids stable, never renumbered) and **ADR-0012** (anchored id→file
resolution). Amends **ADR-0022 §5** (retirement restated for both shapes). Leaves
**ADR-0026** (commit-trailer index) unchanged.
