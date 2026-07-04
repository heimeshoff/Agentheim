---
id: ADR-0044
title: deriveContext becomes digit-lead-tolerant; the leading-letter rule downgrades from parser precondition to minting rule
scope: global
status: accepted
date: 2026-07-04
related_tasks: [infrastructure-m3q7k]
related_adrs: [0028, 0038]
---

# ADR-0044: `deriveContext` becomes digit-lead-tolerant; the leading-letter rule downgrades from parser precondition to minting rule

## Context

ADR-0028 §3 named the leading-letter rule as "the structural disambiguation tell against
legacy ids," and §4 built `deriveContext`'s dual-shape regex directly on that tell:
`/^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/`. The regex's letter-lead token branch
assumed every on-disk token would already be well-formed — but nothing in the system
**enforces** that at mint time (ids are minted by agent prose per `references/id-grammar.md`;
there is no code generator standing between "an agent writes a token" and "the token lands on
disk").

On 2026-07-04, `infrastructure-5w5gs` shipped as a real, merged, on-disk task id whose token
(`5w5gs`) leads with a digit — out of spec per `references/id-grammar.md` "first character is
a letter." `deriveContext('infrastructure-5w5gs')` matched **neither** regex branch (not
all-digit, so not legacy; not letter-led, so not a valid new token) and fell through to the
`m ? m[1] : id` fallback, returning the **whole id** as the "BC." The mechanized lifecycle
verbs (`promoteTask`, `claimBatch`, `completeTask` — ADR-0038) then looked for
`contexts/infrastructure-5w5gs/todo/`, which never exists, and failed with a false
"not found" — even though the task sat correctly in `contexts/infrastructure/todo/`. The only
workaround was hand-passing an explicit `context`/`contexts` override on every verb call,
defeating the hands-free mechanization ADR-0038 exists to deliver.

This "return the id unchanged on a leading-digit token" behavior was not an oversight: it was
a deliberate, tested choice shipped by `agentic-workflow-078` (the task that introduced the
dual-shape regex), pinned by a test asserting
`deriveContext('agentic-workflow-3f9qx') === 'agentic-workflow-3f9qx'`. 078's stance was "an
out-of-spec id is malformed — refuse to parse it, fail visibly." That stance assumed the
letter-lead invariant was already enforced elsewhere; it was not. Fixing the strand therefore
means knowingly reversing 078's refuse-to-parse choice for the resolver, while adding the
mint-time enforcement 078 assumed already existed.

## Decision

**Split the grammar's two responsibilities across two different strictness levels — a
forgiving resolver (reads what's already on disk) and a strict minter (refuses to emit new
out-of-spec ids) — rather than keeping one regex do both jobs.**

### Amends ADR-0028 §3 — the disambiguation tell downgrades from parser precondition to minting rule

§3's leading-letter rule remains the tell **minters must honor when emitting a new id**. It no
longer holds as a **hard precondition the parser enforces** — the parser (`deriveContext`) is
now tolerant of a token that fails the letter-lead check, provided it is still 5 characters
over the Crockford-minus-`ilou` charset. The disjointness claim ("a digit-leading tail is
never a new token") is retired as a *parsing* invariant; it survives only as a *minting*
convention, backstopped by code (see below) rather than the resolver's regex shape.

### Amends ADR-0028 §4 — `deriveContext`'s token branch loosens to length + charset only

`deriveContext` (`lib/task-lifecycle.mjs`) loosens **only** its token branch, dropping the
leading-letter constraint but keeping length = 5 and the Crockford-minus-`ilou` charset:

```
before: /^(.*)-(?:\d+|[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4})$/
after:  /^(.*)-(?:\d+|[0-9a-hjkmnp-tv-z]{5})$/
```

A 5-char in-charset tail now resolves its BC whether it leads with a letter or a digit. This
stays **shape-validating, not shape-agnostic**: an out-of-charset tail (`uuuuu`, containing the
excluded look-alike `u`) and a wrong-length tail (a 6-char `3f9qxz`) still fall through to the
`m ? m[1] : id` fallback and return the id unchanged. This deliberately reverses the
`agentic-workflow-078` property that "a digit-leading tail is never a new token" for the
*resolver only* — `resolveTaskFile`'s trailing-`-` anchor (ADR-0012) needs no change, since it
never parses the tail.

### New: mint-time enforcement (the half 078 assumed already existed)

A new pure module, `lib/id-grammar.mjs`, becomes the grammar's single source of truth for
well-formedness, shaped like the `agentic-workflow-080` duplicate-id guard
(`lib/duplicate-id-check.mjs`: pure predicate + a `node --test` live-tree scan). It exports:

- `classifyTaskId(id) → 'token' | 'legacy' | 'malformed'` — `'token'` uses the **strict**
  ADR-0028 §1 grammar (leading-letter `[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}`), deliberately
  **stricter** than the now-loosened resolver.
- `isWellFormedTaskId(id)` — `true` for `'token'` or `'legacy'`, `false` for `'malformed'`.
- `GRANDFATHERED_IDS` — a frozen allowlist, currently `['infrastructure-5w5gs']`, citing
  ADR-0028 §5 (never-renumber) as the reason it is never fixed up.
- `findMalformedTaskIds(root)` — walks the live tree (reusing `duplicate-id-check.mjs`'s
  `LIFECYCLE_FOLDERS` + frontmatter-`id`-first pattern) and returns every id classified
  `malformed` that is **not** in `GRANDFATHERED_IDS`.

Capture-time enforcement is a documentation change in the minting skills
(`skills/modeling` CAPTURE, `skills/quick-capture`, per ADR-0028 §6): after minting a token,
verify `classifyTaskId(newId) === 'token'` and auto-re-mint on failure — cheap, since a fresh
random token is free and non-interactive. Since minting happens via agent prose with no code
generator standing in the loop, the always-on backstop is `findMalformedTaskIds`'s live-tree
`node --test` scan (mirroring `agentic-workflow-080`'s final live-tree duplicate-id test),
which will catch any future stray on merge regardless of whether a given agent run followed
the documented re-mint step.

The lint lives in its own module rather than folding into `lib/duplicate-id-check.mjs`: that
module is charter-bound (its own header) to compare ids as whole strings and never parse the
tail, so well-formedness logic does not belong there.

### Resulting asymmetry

Parsers end up **more forgiving than minters**, by design: the reader (`deriveContext`)
tolerates a legacy stray already on disk; the writer (the minting skills + the live-tree lint)
refuses to let a new one through. This is the headline consequence, not a compromise — it is
the only shape that both (a) unbreaks `infrastructure-5w5gs` today and (b) prevents recurrence
going forward, since nothing else in the system enforces minting discipline.

## Consequences

**Positive:** `infrastructure-5w5gs` (and any similarly out-of-spec id already on disk) now
resolves correctly through every mechanized lifecycle verb with no override needed;
recurrence is prevented by a mechanical live-tree check, not agent discipline alone;
`deriveContext` stays a single, simple regex.

**Negative:** the resolver's charset-based validation is weaker than the minter's — a
malformed-but-in-charset-and-length id could theoretically be minted by a bug and still
resolve; this residual gap is exactly what `findMalformedTaskIds`'s live-tree scan exists to
catch. The `agentic-workflow-078` test asserting `3f9qx` (5-char, digit-lead) stays unresolved
is reversed — its scenario now resolves; the test is rewritten, not deleted, to document the
new behavior.

Builds on ADR-0028 (token grammar, §1; disambiguation, §3; resolver, §4; never-renumber, §5;
minting call sites, §6). Amends ADR-0028 §3 (tell downgraded from parser precondition to
minting rule) and §4 (resolver regex loosened). Consistent with ADR-0038 (lifecycle
mechanization is meant to be hands-free — this ADR removes the last case where it wasn't).
