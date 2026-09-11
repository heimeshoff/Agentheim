---
id: agentic-workflow-ngzwz
title: INDEX entry diet — hard-cap new entry length; the linked artifact carries the detail
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [bookkeeping, index, doctrine, lint, dorc-review]
related_adrs: [0041, 0047, 0039, 0060]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-w7q2m]
---

## Why

Dorc review recommendation A6 (surviving piece 1 of 3): single INDEX bullets ran 300–500
words, and the swollen knowledge base became a per-session context tax on every worker
and verifier that reads it. Agentheim's own `contexts/agentic-workflow/INDEX.md` shows
the same drift — recent ADR entries run ~200+ words each. The INDEX is a *catalog*; the
ADR/task file is where detail belongs.

(The other two Dorc A6 complaints — protocol rotation never firing and the done-list cap
not being enforced — are already fixed here by ADR-0045/0047; this task is the remaining
gap.)

## What

Hard-cap the length of **newly written** INDEX entries (ADR lines, task lines) at 2–3
sentences: the claim and the pointer, with detail living in the linked artifact. Applies
to every skill that appends INDEX entries (`work`'s index updates, `modeling`'s capture/
refine inserts). Existing over-length entries are left verbatim — no retroactive rewrite
(consistent with ADR-0039's verbatim discipline; a CONSOLIDATE-style cleanup can be a
separate, builder-approved action).

## Acceptance criteria

- [x] The index-update steps in `skills/work/SKILL.md` and `skills/modeling/SKILL.md`
      state the cap (2–3 sentences, ~60 words) for new entries.
- [x] Per the mechanize-or-drop rule ([[agentic-workflow-z394j]]): either a lint flags
      new over-length entries (live-tree `node --test` check scoped to entries newer than
      adoption, or a length check in the lifecycle CLI's bookkeeping path), or the task
      explicitly records "prose-only, unenforced" with the accepted risk.
- [x] Existing entries untouched; the no-retroactive-rewrite decision is recorded.
- [x] An ADR records the doctrine.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. Scoping the lint to
new/recent entries avoids failing the tree on the existing long entries; grandfathering
mirrors ADR-0044's `GRANDFATHERED_IDS` pattern.

## Outcome

Shipped enforcement (not the "prose-only, unenforced" marker) per ADR-0059's
mechanize-or-drop rule — this task is the self-referential proof case that rule names.

- **`lib/index-entry-length.mjs`** (+ `lib/test/index-entry-length.test.mjs`, 10 tests,
  git-free, stdlib-only): a live-tree lint exporting `ADOPTION_DATE` (`2026-07-21`) and
  `MAX_WORDS` (`60`). `findOverLengthIndexEntries(root)` walks every per-BC `INDEX.md`
  plus the top-level `.agentheim/knowledge/index.md`, parses each task/ADR bullet
  (tolerant of both the per-BC `- **id** — prose — \`pointer\`` shape and the top-level
  adr-global `- **ADR-NNNN — title** (date, status) — prose — \`pointer\`` shape), and
  flags an entry only when its prose exceeds `MAX_WORDS` **and** the linked task/ADR's
  date (task `completed`/`created`, ADR `date`) is strictly after `ADOPTION_DATE` —
  grandfathering every pre-existing entry by date rather than an id allowlist (ADR-0044's
  `GRANDFATHERED_IDS` idea, scaled past a single stray id). Loss-tolerant throughout: an
  unparseable line, unreadable linked file, or missing date is never flagged. The final
  test asserts the LIVE tree has zero non-grandfathered over-length entries today — it
  passes because every current entry predates or matches `ADOPTION_DATE`.
- **`skills/work/SKILL.md`** "Index updates" — states the cap for the ADR-line prose the
  conductor hand-composes, and cross-references `modeling` for task-line prose (which the
  conductor never writes itself — it's the task's `title:` frontmatter, embedded verbatim
  by `insertIndexLineAtTop`).
- **`skills/modeling/SKILL.md`** "Updating indexes" — states the cap on the `title:`
  frontmatter CAPTURE/REFINE author, since that title is what an INDEX task line carries
  unchanged.
- **`.agentheim/knowledge/decisions/0060-index-entry-length-cap-date-grandfathered-lint.md`**
  (ADR-0060, scope: agentic-workflow) — records the doctrine, the date-grandfathering
  mechanism, and the accepted "same-day blind spot" (an entry written on `ADOPTION_DATE`
  itself is indistinguishable from a pre-adoption entry, so real enforcement effectively
  starts the day after adoption — a recorded tradeoff, not a bug).
- **BC README** — added an "INDEX entry-length cap" ubiquitous-language bullet alongside
  the existing Mechanize-or-drop entry.

No retroactive rewrite: every entry currently on disk (including the ~100-500 word ADR
bullets that motivated the Dorc review) is left byte-for-byte untouched, per the
no-retroactive-rewrite decision this task's Why/What sections named and ADR-0060 records.
