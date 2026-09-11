---
id: agentic-workflow-078
title: deriveContext resolves both legacy NNN and new token id shapes (dual-shape regex) + tests
status: done
type: refactor
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-18
depends_on: []
blocks: [agentic-workflow-079]
tags: [identity, ids, lib, task-lifecycle, regex]
related_adrs: [0028, 0012]
related_research: []
prior_art: [agentic-workflow-077]
---

## Why

ADR-0028 replaces the sequential-integer task id with a `<bc>-<token>` shape (5-char random
token, leading letter) while keeping legacy `<bc>-NNN` ids go-forward. The one code change the
ADR identifies is `deriveContext` in `lib/task-lifecycle.mjs`: its current `/^(.*)-\d+/` only
recognises an all-digit tail, so a new token-tailed id (`agentic-workflow-k3f9q`) would derive
the wrong BC (or fall through to returning the whole id). `resolveTaskFile` needs no change —
ADR-0012's trailing-`-` anchor already handles both shapes — but it wants a test to lock that in.

This is the smallest implementation slice of ADR-0028 and ships first; it is what every other
new-id behavior depends on.

## What

Update `deriveContext(id)` in `lib/task-lifecycle.mjs` to derive the correct BC for **both**
id shapes, end-anchored on the bare id, per ADR-0028 §4. Add tests covering both shapes for
`deriveContext` and a `resolveTaskFile` resolution test for a token-tailed id.

## Acceptance criteria

- [ ] `deriveContext('agentic-workflow-077')` returns `agentic-workflow` (legacy, unchanged).
- [ ] `deriveContext('agentic-workflow-k3f9q')` returns `agentic-workflow` (new token shape).
- [ ] The replacement regex is dual-shape and end-anchored, e.g.
      `/^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/`, using `m[1]` as the BC. A token with a
      leading digit must NOT be treated as a token (it would be ambiguous with legacy); a
      legacy all-digit tail must still derive the BC.
- [ ] `resolveTaskFile` resolves a token-tailed `<id>-<slug>.md` file via its existing
      trailing-`-` anchor with no code change — covered by a new test that creates a fixture
      file `agentic-workflow-k3f9q-some-slug.md` and asserts it resolves from the bare id.
- [ ] The no-match fallback is preserved: the new regex is **stricter** (end-anchored) than the
      old unanchored `/^(.*)-\d+/`, so an id matching **neither** shape — a malformed
      leading-digit "token" (`agentic-workflow-3f9qx`), or an id with no recognizable tail —
      must still return the id unchanged via the `m ? m[1] : id` fallback (never `undefined`,
      never a throw). A test pins this.
- [ ] No legacy id behavior regresses: existing `deriveContext` / `resolveTaskFile` tests stay
      green.
- [ ] No id rewrite, no migration — go-forward coexistence (ADR-0028).

## Notes

- Touch point: `lib/task-lifecycle.mjs`, `deriveContext` (~line 240) only. `resolveTaskFile`
  (~line 64) is unchanged but gains a token-shape test.
- **Caller confirmed safe for end-anchoring:** `deriveContext` has exactly **one** caller —
  `applyTaskMove` (`lib/task-lifecycle.mjs:147`, `options.context ?? deriveContext(id)`) — and it
  is always passed the **bare** `id`, never the `<id>-<slug>` filename. So the ADR-0028 §4 claim
  "the slug is not in scope" holds at the only call site; end-anchoring the regex on the bare id
  cannot regress a real caller.
- Grammar and disambiguation tell are fixed by ADR-0028 §1–§3; do not re-litigate them here —
  this task implements the ratified grammar. The regex in the AC is the **`u`-excluding** form
  (`[a-hjkmnp-tv-z]` / `[0-9a-hjkmnp-tv-z]`) reconciled during aw-077's verification — do not
  reintroduce the `p-z` span that re-admits the look-alike `u`.

## Outcome (2026-06-18)

`deriveContext` in `lib/task-lifecycle.mjs` now derives the BC for **both** id shapes via the
ratified `u`-excluding, end-anchored regex
`/^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/` (ADR-0028 §4), with the original
`m ? m[1] : id` fallback preserved. `deriveContext` is now **exported** so it can be unit-tested
directly. `resolveTaskFile` was left untouched (ADR-0012's trailing-`-` anchor already covers both
shapes).

Tests added to `lib/test/task-lifecycle.test.mjs` (7 new, all green; full suite 22/22):
- legacy all-digit tail `agentic-workflow-077` → `agentic-workflow` (unchanged).
- new token tail `agentic-workflow-k3f9q` → `agentic-workflow`.
- malformed leading-digit "token" `agentic-workflow-3f9qx` → id unchanged (fallback, never undefined).
- no recognizable tail `nodashhere` → id unchanged.
- look-alike `u` token `agentic-workflow-uuuuu` → id unchanged (the `u`-exclusion holds).
- token-tailed `<id>-some-slug.md` resolves from the bare id via `applyTaskMove` (ADR-0012, no
  `resolveTaskFile` change) and the slug rides along across the move.
- token-tailed task moves with the BC derived end-to-end through `applyTaskMove` (no `context` option).

Key files:
- `lib/task-lifecycle.mjs` (`deriveContext`, ~line 240 — regex + export).
- `lib/test/task-lifecycle.test.mjs` (new tests appended).

No new id behavior decision was made (grammar is ratified by ADR-0028), so no ADR written.
Go-forward coexistence: no id rewrite, no migration. BC README id-scheme line was already current
from aw-077 — no README change needed.
