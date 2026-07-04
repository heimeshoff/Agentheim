---
id: infrastructure-m3q7k
title: deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token
status: backlog
type: bug
context: infrastructure
created: 2026-07-04
completed:
depends_on: []
blocks: []
tags: [task-lifecycle, cli, task-ids, adr-0028, id-grammar, derive-context, promote, claim, complete, validation]
related_adrs: [0028, 0038]
related_research: []
prior_art: [infrastructure-5w5gs]
---

## Why

`deriveContext(id)` (`lib/task-lifecycle.mjs:254`) maps a bare task id back to its
bounded-context name so the mechanized lifecycle verbs (`promoteTask`,
`claimBatch`, `completeTask`) know which BC's `INDEX.md` to edit. Its regex is
`^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$` — it accepts either a
**legacy all-digit tail** (`-077`) or a **new ADR-0028 token** whose first
character is a letter (`[a-hjkmnp-tv-z]`).

A token that starts with a **digit** matches neither branch: it is not all-digits
(so not the legacy form) and its lead is not a letter (so not the new form). On
such an id `deriveContext` fails to match and returns the **whole id** as the
"context". The verbs then look in `contexts/<whole-id>/todo/`, which never exists,
and fail with `"<id> not found in todo/ (already claimed elsewhere, or never
promoted)"` — even though the task is sitting right there in the correct BC's
`todo/`.

This is not hypothetical. On 2026-07-04, running `work` on `infrastructure-5w5gs`
(prior art below), the mechanized `claim` and `complete` both failed exactly this
way. The token `5w5gs` starts with `5`, a digit — an **out-of-spec** ADR-0028
token (`references/id-grammar.md` §"First character is a letter"). The only way to
drive the batch through was to hand-pass an explicit `contexts` / `context` BC
override in the CLI's JSON opts on every verb. The lifecycle is meant to be
hands-free (ADR-0038); an out-of-spec id silently disables that.

## What

Make the id→BC resolution **robust to (or protective against) a leading-digit
token**, so the mechanized lifecycle never strands on an out-of-spec id and never
needs a hand-passed BC override to recover.

There are two candidate root-cause fixes, not mutually exclusive — the refinement
should decide which (or both):

1. **Harden `deriveContext` (and its sibling parser in
   `lib/duplicate-id-check.mjs`, which the code comments call the "dual-shape
   regex").** Recognize a `<bc>-<token>` id even when the token leads with a digit,
   so resolution degrades gracefully instead of returning the whole id. The catch:
   a leading-digit tail is genuinely **ambiguous** with the legacy all-digit form
   (`references/id-grammar.md` disambiguates purely on "is the first char after the
   last `-` a letter?"). Any loosening must not misparse a real legacy `-077` id or
   a BC name that itself contains digits. This needs care, which is why it's a
   decision to refine, not an obvious patch.

2. **Reject out-of-spec ids at the point of capture / minting** (a lint or
   validation gate), so a leading-digit token can never reach disk in the first
   place. There is currently **no code generator** — task ids are minted by the
   capturing agent's prose (per `references/id-grammar.md`, "generate the token
   randomly"), so nothing structurally enforces the grammar. A validation seam
   (e.g. in `duplicate-id-check.mjs` or a capture-time check) would catch a bad
   token before it becomes a baked-in, git-historied id.

Note the go-forward constraint: `infrastructure-5w5gs` is already shipped with its
out-of-spec id (in `done/`, in git history, in commit trailers). ADR-0028 §5 and
the id-grammar reference both say ids are **never renumbered** — so fix #1 (make
the resolver tolerate what's already on disk) has standing value even if fix #2
prevents future occurrences. A resolver that can't parse an id already in the tree
is the more urgent gap.

## Acceptance criteria

- [ ] `deriveContext` resolves a `<bc>-<token>` id whose token starts with a digit
      (e.g. `infrastructure-5w5gs`) to its correct BC — OR an equivalent mechanism
      ensures the mechanized `promote` / `claim` / `complete` verbs no longer fail
      on such an id without a hand-passed BC override.
- [ ] No regression: legacy all-digit tails (`infrastructure-020`), well-formed new
      tokens (`infrastructure-q8m4t`), and BC names containing digits or hyphens
      still resolve exactly as today. A test covers each shape.
- [ ] The sibling "dual-shape regex" in `lib/duplicate-id-check.mjs` stays
      consistent with whatever `deriveContext` decides — the two must not diverge
      on a leading-digit token.
- [ ] (If fix #2 is chosen or added) a capture/mint-time validation rejects or
      flags an out-of-spec token before it lands on disk, with a test asserting a
      leading-digit token is caught.
- [ ] The already-shipped `infrastructure-5w5gs` id is left as-is (never
      renumbered, ADR-0028 §5) — the fix accommodates it rather than rewriting it.

## Notes

- Discovered 2026-07-04 while running `work` on `infrastructure-5w5gs` (the CRLF
  lifecycle bug). The irony is exact: fixing one class of lifecycle-tooling
  fragility surfaced a second, independent one in the same module.
- Root-cause ambiguity (generator vs. resolver) is the reason this is a **backlog
  bug with a decision embedded**, not a ready-to-work patch. Refinement should
  settle: harden the resolver, add a mint-time gate, or both — and resolve the
  legacy-tail-vs-leading-digit-token disambiguation cleanly.
- `deriveContext`'s callers are enumerated at `lib/task-lifecycle.mjs:147, 481,
  595, 756` (applyTaskMove, promoteTask, claimBatch, completeTask) — all four
  inherit the same fragility, and all four already accept a `context`/`contexts`
  override that a caller can hand-pass as the current workaround.
- Related grammar of record: `references/id-grammar.md` (ADR-0028 §1). The
  disambiguation rule there ("first char after the last `-` a letter?") is the
  exact seam a leading-digit token falls through.
