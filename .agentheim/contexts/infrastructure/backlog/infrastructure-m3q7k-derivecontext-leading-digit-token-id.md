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

The current "return the id unchanged on a leading-digit token" behavior is **not
an oversight — it is a deliberate, tested decision** shipped by
`agentic-workflow-078` (the dual-shape-regex task) and pinned by a test asserting
`deriveContext('agentic-workflow-3f9qx') === 'agentic-workflow-3f9qx'`
(`lib/test/task-lifecycle.test.mjs:352`). 078's stance was *"an out-of-spec id is
malformed — refuse to parse it, fail visibly."* The flaw is that nothing
**enforces** the letter-lead invariant at mint time (ids are minted by agent prose
per `references/id-grammar.md`; there is no code generator), so a malformed id
reaches disk anyway and then strands the lifecycle. Fixing this therefore means
knowingly **overturning** 078's refuse-to-parse choice, and adding the enforcement
078 assumed was already there.

## What

Make id→BC resolution robust to an already-shipped leading-digit token, **and**
pin the grammar going forward. Two coordinated fixes — a **Postel split**: a
forgiving reader (the resolver tolerates what's on disk) plus a strict writer (a
mint-time lint stops new bad ids). They address different halves — the resolver
fixes the already-shipped `infrastructure-5w5gs`; the lint prevents recurrence.

1. **Loosen the resolver.** `deriveContext` (`lib/task-lifecycle.mjs:255`) — the
   **sole** dual-shape id parser in the codebase — loosens **only** its token
   branch, dropping the leading-letter constraint but keeping length = 5 and the
   Crockford-minus-`ilou` charset:

   ```
   before: /^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/
   after:  /^(.*)-(?:\d+|[0-9a-hjkmnp-tv-z]{5})$/
   ```

   A 5-char in-charset tail now resolves whether it leads with a letter or a
   digit. This stays **shape-validating, not shape-agnostic**: `uuuuu` (out of
   charset) and `3f9qxz` (6 chars) still fall through to the `m ? m[1] : id`
   fallback and return the id unchanged. This deliberately reverses the
   `agentic-workflow-078` property that "a digit-leading tail is never a new
   token" — the 078 test and the `deriveContext` doc comment
   (`lib/task-lifecycle.mjs:239-252`) are rewritten, not worked around.

2. **Add a mint-time lint.** A new pure `lib/id-grammar.mjs` (stdlib-only,
   side-effect-free) becomes the grammar's single source of truth, shaped like the
   `agentic-workflow-080` duplicate-id guard (pure predicate + a `node --test`
   live-tree scan). It rejects an out-of-spec token at capture time and flags any
   stray on the tree — **except** an explicit grandfather allowlist for
   `infrastructure-5w5gs`, which ADR-0028 §5 forbids renumbering.

The lint lives in its **own** module, deliberately **not** folded into
`lib/duplicate-id-check.mjs`: that module is charter-bound to compare ids as whole
strings and never parse the tail (its header, lines 24-27), and is therefore the
wrong home for well-formedness logic.

## Acceptance criteria

**Resolver + the 078 reversal**

- [ ] `deriveContext` loosens only its token branch to
      `/^(.*)-(?:\d+|[0-9a-hjkmnp-tv-z]{5})$/`; the `m ? m[1] : id` fallback is
      unchanged. `deriveContext('infrastructure-5w5gs') === 'infrastructure'`.
- [ ] The `agentic-workflow-078` test at `lib/test/task-lifecycle.test.mjs:352` is
      **rewritten** (not deleted) to assert the leading-digit 5-char token now
      resolves: `deriveContext('agentic-workflow-3f9qx') === 'agentic-workflow'`,
      with its comment updated. The `deriveContext` doc comment
      (`lib/task-lifecycle.mjs:239-252`) is corrected — the "malformed
      leading-digit token falls through" narrative is no longer true for a 5-char
      in-charset tail.

**No regression (a test covers each shape)**

- [ ] Legacy all-digit tails still resolve: `infrastructure-020`, and reserved
      foundation ids `design-system-001` / `infrastructure-001` (all-digit tails,
      caught by the legacy branch).
- [ ] Well-formed leading-letter tokens still resolve: `agentic-workflow-k3f9q`.
- [ ] BC names containing hyphens (and any digits) still resolve exactly as today
      (greedy `.*` unaffected).
- [ ] **`uuuuu` look-alike rejection preserved** — `u` is out of charset, so
      `deriveContext('agentic-workflow-uuuuu')` still returns the id unchanged
      (`lib/test/task-lifecycle.test.mjs:364` stays green, untouched).
- [ ] A **6-char** digit-leading tail still falls through (`…-3f9qxz` → unchanged),
      proving the loosening stays length-validating.

**Mint-time validator (fix #2)**

- [ ] New `lib/id-grammar.mjs`, stdlib-only, side-effect-free, exporting:
      `classifyTaskId(id) → 'token' | 'legacy' | 'malformed'` (token = the
      **strict** ADR-0028 §1 grammar, leading-letter `[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}`
      — deliberately stricter than the resolver); `isWellFormedTaskId(id)`; a
      frozen `GRANDFATHERED_IDS` = `['infrastructure-5w5gs']` (comment citing
      ADR-0028 §5); and `findMalformedTaskIds(root)` that walks the live tree
      (reusing the `LIFECYCLE_FOLDERS` + frontmatter-`id`-first pattern from
      `duplicate-id-check.mjs`) and returns ids that are `malformed` **and not**
      grandfathered.
- [ ] `lib/test/id-grammar.test.mjs` (`node --test`) covers: `5w5gs` →
      malformed-but-grandfathered → not flagged; a well-formed token → `token`;
      `-077` / `-001` → `legacy`; `uuuuu` / 6-char → `malformed`; and a
      **live-tree scan asserting zero non-grandfathered malformed ids** (the
      recurring gate, mirroring aw-080's final live-tree test).
- [ ] Capture-time enforcement is documented: the token-minting skills
      (`skills/modeling` CAPTURE and `skills/quick-capture`, per ADR-0028 §6) gain
      a step — after minting, verify `classifyTaskId(newId) === 'token'` and
      **auto-re-mint** on failure (a fresh random token is free and
      non-interactive). Since there is no code generator, the enforceable
      always-on backstop is the live-tree test.

**Grandfathering**

- [ ] `infrastructure-5w5gs` is left **un-renumbered** (ADR-0028 §5) — it appears
      only in `GRANDFATHERED_IDS`, never in a move or rewrite.
- [ ] Reserved foundation ids (`design-system-001`, `infrastructure-001`) need
      **no** allowlist entry — their on-disk frontmatter `id` is all-digit-tailed
      and passes the `legacy` branch.

**ADR (write first, at work time)**

- [ ] The first work commit is a short ADR **amending ADR-0028 §3–§4** (scope
      global, in the pattern of how 0028 amends 0022 §5): records that the resolver
      is now digit-lead-tolerant (`§3`'s "leading-letter is the disambiguation
      tell" is downgraded from a *parser precondition* to a *minting rule*), that
      minters are now stricter than the parser, and that the grammar is enforced by
      `lib/id-grammar.mjs` + the grandfather allowlist. Add its id to this task's
      `related_adrs` when written.

## Notes

- **`deriveContext` is the only tail-parsing regex in the codebase.** The captured
  claim of a "sibling dual-shape regex" in `lib/duplicate-id-check.mjs` was
  **wrong** — that module is charter-bound shape-agnostic (whole-string id
  comparison, header lines 24-27). `resolveTaskFile` (`lib/task-lifecycle.mjs`,
  ADR-0012 trailing-`-` anchoring) also never parses the tail. So there is no
  second parser to keep in sync; the old AC #3 was dropped.
- Discovered 2026-07-04 while running `work` on `infrastructure-5w5gs` (the CRLF
  lifecycle bug). The irony is exact: fixing one class of lifecycle-tooling
  fragility surfaced a second, independent one in the same module.
- The resolver loosening **overturns a tested, intentional aw-078 decision** —
  that is expected and is the point. Reverse the 078 test and fix the doc comment;
  never work around them.
- Parsers end up **more forgiving than minters** by design — the reader tolerates
  a legacy stray, the writer refuses to emit one. That asymmetry is the reason both
  halves ship together (and is the ADR's headline consequence).
- `deriveContext`'s callers — `applyTaskMove` (`:147`), `promoteTask` (`:481`),
  `claimBatch` (`:595`), `completeTask` (`:756`) — all inherit the fix for free
  when no `context`/`contexts` override is passed; the `5w5gs` hand-passed-override
  workaround is then no longer needed.
- Grammar / decision of record: `references/id-grammar.md` (ADR-0028 §1) and
  `.agentheim/knowledge/decisions/0028-collision-resistant-task-ids-short-random-token.md`
  (§3 disambiguation, §4 resolver, §5 never-renumber, §7 reserved foundation ids).
- Refined 2026-07-04 with the `architect` specialist; builder chose the Postel
  split + the 5-char-any-lead resolver style. Design fully settled — no open
  questions block work.
