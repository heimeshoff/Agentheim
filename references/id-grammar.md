---
name: Task ID grammar
description: Canonical `<bc>-<token>` id format — 5-char Crockford base32 token, lowercase, leading letter, look-alikes excluded. ADR-0028 §1.
---

# Task ID grammar

Every fresh task id is `<bc>-<token>`; the `<bc>-` prefix names the bounded context.

`<token>` is **exactly 5 characters**, Crockford base32, lowercase, minus the look-alikes `i l o u` — alphabet `0123456789abcdefghjkmnpqrstvwxyz`.

- **First character** is a letter (`[a-hjkmnp-tv-z]` — excludes the `u` look-alike).
- **Remaining four** are any token character (`[0-9a-hjkmnp-tv-z]`).
- Lowercase only.

Regex for a new tail: `[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}`.

Generate the token **randomly** — never scan existing files for a "next number". Example: `agentic-workflow-k3f9q`. IDs are stable and never renumbered; with a random token this holds **by construction** — the generator never consults history, so there is no counter to advance or collide. When minting several ids at once, generate an independent fresh token for each.

## Legacy vs. new tails

- **Legacy tail** = all digits (e.g. `-077`). Kept as-is on disk — never rewritten or renumbered.
- **New tail** leads with a letter (e.g. `-k3f9q`).
- Disambiguation: is the first character after the last `-` a letter? Yes → new-style token. No → legacy digit tail.
- **Reserved foundation ids** (e.g. `design-system-001-styleguide`, `infrastructure-001-walking-skeleton`) keep deterministic digit-leading tails — a closed set `brainstorm` mints, not random tokens (ADR-0028 §7). Every other id, including decision tasks `brainstorm` emits, gets an ordinary random token.

ADR of record: `.agentheim/knowledge/decisions/0028-collision-resistant-task-ids-short-random-token.md` §1 (Token grammar).
