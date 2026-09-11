---
id: agentic-workflow-079
title: Sweep id-minting prose in the three live skills from next-number to random token
status: done
type: chore
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-18
depends_on: [agentic-workflow-078]
blocks: []
tags: [identity, ids, skills, modeling, quick-capture, brainstorm]
related_adrs: [0028]
related_research: []
prior_art: [agentic-workflow-077]
---

## Why

ADR-0028 ratifies the `<bc>-<token>` id scheme. The minting *instruction* currently lives as
prose in three live skills and still tells the skill to "scan existing files to determine the
next number" — the single-writer counter that ADR-0028 abolishes. Those instructions must move
to "emit a fresh 5-char random token (leading letter)". Depends on aw-078 so the runtime
(`deriveContext`) already accepts token ids before the skills start minting them.

ADR-0028 §6 enumerates exactly three live minting call sites; §7 carves out the **reserved
foundation ids** that stay deterministic. The aw-077 verification failure (the token grammar
regex re-admitted the look-alike `u` because the grammar was restated inconsistently across
files) is the cautionary precedent for this sweep: the three new inline statements must not
drift apart the way that one did.

## What

Update the id-minting prose and the retirement prose in the three live skills to ADR-0028's
token scheme; resolve the well-known foundation-id reservation in the same skills per ADR-0028 §7.
Leave the `capture-workspace/` eval fixtures unchanged.

**Canonical-grammar rule (drift guard, from the aw-077 precedent):** the token-emit instruction
appears inline in all three skills (each must be self-contained — a minting agent has only its
own `SKILL.md` loaded). To stop the three copies drifting, each inline statement must be
**byte-identical** in its grammar clause **and** name **ADR-0028 §1** as the canonical source it
restates. ADR-0028 §1 is the single definition to reconcile against; the skills never paraphrase
the alphabet or the leading-letter class differently.

The exact grammar clause (ADR-0028 §1) to inline verbatim in each skill:

> Emit a fresh id `<bc>-<token>`, where `<token>` is **exactly 5 characters** from the alphabet
> `0123456789abcdefghjkmnpqrstvwxyz` (Crockford base32, lowercase, minus the look-alikes
> `i l o u`); the **first character is a letter** (`[a-hjkmnp-tv-z]`), the remaining four are any
> token character. Generate it randomly — **never scan existing files for a "next number".** See
> ADR-0028 §1.

## Acceptance criteria

- [ ] `skills/quick-capture/SKILL.md` (~line 154) — the "Determine the next number by scanning
      **all four** lifecycle folders … and adding one" step is replaced with the canonical
      token-emit clause above (verbatim grammar + cite of ADR-0028 §1).
- [ ] `skills/modeling/SKILL.md` (~line 263, "ID convention") — the "Look at existing task files
      in the BC to determine the next number" step is replaced with the **same** canonical
      token-emit clause (byte-identical grammar to quick-capture's).
- [ ] `skills/modeling/SKILL.md` (~line 206, DISMISS step 7) — the retirement prose ("A dismissed
      number is retired, consistent with 'never renumber' — a future capture takes the next free
      number, never a dismissed one") is restated per ADR-0028 §5: never-reuse / never-renumber
      holds **by construction** for tokens (the generator never consults history); the
      next-free-number clause is **retained verbatim only for legacy `<bc>-NNN` ids**.
- [ ] `skills/brainstorm/SKILL.md` — the two greenfield **foundation** tasks keep **reserved
      deterministic** ids per ADR-0028 §7:
        - the styleguide task stays the literal `design-system-001-styleguide` (already written
          at ~line 186, unchanged);
        - the walking-skeleton placeholder `infrastructure-XXX-walking-skeleton` (~line 177) is
          pinned to the **reserved literal `infrastructure-001-walking-skeleton`** (decided in
          refinement — nothing references it by hard-coded string, but §7 puts it in the reserved
          set and a deterministic id keeps it consistent with the styleguide gate).
- [ ] `skills/brainstorm/SKILL.md` — every **non-foundation** task brainstorm emits (the global /
      BC-local **decision tasks**, ~line 136/270) uses a **random token**, not a `-001`-style id.
      The reserved set is closed at exactly the two foundation ids above (ADR-0028 §7). If
      brainstorm's decision-task prose names no explicit minting step today, add the canonical
      token-emit clause so the default is unambiguous.
- [ ] The styleguide-gate references stay literal and valid: `depends_on: design-system-001-styleguide`
      in `skills/modeling/SKILL.md`, `skills/brainstorm/SKILL.md`, and each frontend-bearing BC
      README is untouched; the walking-skeleton's downstream reference stays **relative** ("the
      walking-skeleton task"), now resolving to `infrastructure-001-walking-skeleton`.
- [ ] `skills/capture-workspace/` fixtures are **NOT** modified (they are snapshots named
      `capture/SKILL.md`, the old skill name — not a live skill) — verify the final diff touches no
      path under `capture-workspace/`.
- [ ] A minted token id is still greppable as a `[<bc>-<token>]` commit trailer (ADR-0026 — no
      change needed, just confirm the prose doesn't break it).

## Notes

- Reserved foundation ids (`design-system-001-styleguide`, `infrastructure-001-walking-skeleton`)
  are the **only** digit-tailed ids minted going forward (ADR-0028 §7); everything `modeling` /
  `quick-capture` mints — and every non-foundation task `brainstorm` mints — is a random token.
- This is documentation/prose only — no code. The runtime change (the dual-shape `deriveContext`
  regex that must accept token ids) is aw-078, and aw-079 `depends_on` it so the runtime tolerates
  the ids these skills start minting.
- Drift guard rationale: aw-077's verifier caught the grammar stated two different ways (regex
  re-admitted `u`). Mandating byte-identical inline grammar + a single ADR-0028 §1 cite across the
  three skills is the cheap structural defense against repeating that here.
- The optional duplicate-id CI lint is aw-080 (the belt-and-braces against the residual collision
  tail) — out of scope for this prose sweep.

## Outcome

Swept the id-minting prose in the three live skills from the abolished single-writer
next-number counter to ADR-0028's random-token scheme, and resolved the foundation-id
reservation in `brainstorm`.

- `skills/quick-capture/SKILL.md` (ID convention, ~line 154) — next-number scan replaced with
  the canonical token-emit clause (verbatim grammar + ADR-0028 §1 cite); never-reuse restated
  as holding by construction for tokens, legacy `<bc>-NNN` kept as-is.
- `skills/modeling/SKILL.md` — ID convention (~line 263) replaced with the **byte-identical**
  grammar clause; DISMISS step 7 (~line 206) retirement prose restated per ADR-0028 §5
  (never-reuse by construction for tokens; legacy next-free-number clause retained verbatim for
  legacy ids only).
- `skills/brainstorm/SKILL.md` — walking-skeleton placeholder pinned to the reserved literal
  `infrastructure-001-walking-skeleton` (~line 179); styleguide kept literal
  `design-system-001-styleguide` (~line 188) with a reserved-id note; the closed reserved set of
  exactly two foundation ids spelled out; the **non-foundation** decision-task minting step
  (~line 167) made explicit with the same canonical token-emit clause so the default is
  unambiguous.

Drift guard satisfied: the token grammar (alphabet `0123456789abcdefghjkmnpqrstvwxyz`,
look-alike exclusion `i l o u`, leading-letter class `[a-hjkmnp-tv-z]`, exactly 5 chars) and the
single **ADR-0028 §1** cite are identical across all three live skills (one cite each). Gate
literals (`depends_on: design-system-001-styleguide`) and the relative walking-skeleton reference
are intact. No `capture-workspace/` fixture touched. No code change (runtime tolerance was
aw-078). BC README already documented the token scheme (aw-077) — no README change needed.
</content>
</invoke>
