---
id: agentic-workflow-g2fgb
title: `lib/readme-delta.mjs`'s `replace` op anchors a bold term head that wraps onto a continuation line — `termHeadOf` matches on the whitespace-collapsed bullet text, guarded by a wrapped-head test fixture, and a missing anchor disposes distinctly from an `expected` collision
status: todo
type: bug
context: agentic-workflow
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [captured, readme-delta, mechanization, bookkeeping, merge-back, integration]
related_adrs: [0074, 0054, 0038, 0059, 0041]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-pcwnn]
---

## Why

Post-ghcaj (ADR-0074) a worker never edits its BC README; it reports a `README_DELTA` and
the conductor applies it on `main` through `lib/readme-delta.mjs`'s `applyReadmeDelta`.
The `replace` op anchors on `(section, termHead)`, where `termHeadOf` extracts the bullet's
bold lead-in with a regex of the shape `^- **(.+?)**` run against the bullet's full
multi-line text **without** the `s` flag. `.` never crosses a newline, so whenever the
closing `**` sits on the bullet's second line the function returns `null` — and a `null`
term head can never equal any `anchor` string.

That is the shape of most hand-wrapped ADR bullets in the BC READMEs. The infrastructure
README's Decisions bullet reads, across two lines,
`- **ADR-0013 — Plugin release discipline (manifest bump bound to a vX.Y.Z tag, by` /
`  checklist).**` — so a `replace` targeting it always falls into `applyReplace`'s
"anchor gone" branch: disposition `merged`, body appended at the END of the section.
Because a worker's `replace` body is the whole amended bullet, the mechanized write
duplicates the entire bullet. Observed live on 2026-09-12 integrating infrastructure-j3rsn:
the verifier's dry run counted `^- **ADR-0013` going 1 → 2 and "Amendment
(infrastructure-w45ce)" 1 → 2. The worker's `anchor`, `expected` (whitespace-collapsed
match) and `body` were all correct — no re-dispatch could have fixed it — and the
conductor hand-spliced the j3rsn amendment sub-bullet in place instead, which is exactly
the hand-applied bookkeeping ghcaj exists to retire.

Two smaller defects ride along. The existing multi-line test fixture ("a multi-line
bullet extent (continuation lines) is captured and replaced as a whole") wraps only the
bullet's *tail*; its bold head still closes on line 1, so the wrapped-head case has no
coverage. And because a missing anchor and an `expected` mismatch both dispose `merged`,
the conductor's integration log cannot tell an anchoring failure (a grammar bug — every
retry fails identically) from a genuine collision (a sibling landed first — pcwnn's
authority rule applies, both intents survive). The two need different reactions and
today they look the same.

## What

Make wrapped and single-line bullets anchor identically, cover the wrapped-head shape
with a fixture, and let the conductor distinguish "no such anchor" from "expected no
longer matches" — all inside the existing two-op grammar (`append` / `replace`), which
stays monotone per ADR-0074 / ADR-0041: no new op, no removal, still never a refusal.

1. **Anchor on collapsed text.** `termHeadOf` computes the term head on the
   whitespace-collapsed bullet text (`collapseWs(text)` first, then the bold-lead-in match
   and the first-`(` truncation), so a bullet whose `**…**` lead-in closes on a
   continuation line produces the same anchor key as its single-line equivalent. Adding
   the `s` flag and collapsing afterwards is an acceptable equivalent; the point is that
   line-wrapping inside the lead-in is never observable to the anchor.
2. **Wrapped-head fixture.** A `node --test` case in `lib/test/readme-delta.test.mjs`
   shaped like the live ADR-0013 bullet: the bold head spans two lines, contains a `(`
   before its closing `**`, and the `replace` op's `anchor` is the head truncated at that
   `(`. It must dispose `applied`, replace the bullet in place, and leave exactly one
   bullet with that head in the section.
3. **Distinct missing-anchor disposition.** `applyReplace`'s no-target branch returns its
   own disposition (suggested name `anchor-missing`) instead of `merged`. Behaviour is
   unchanged — the body is still appended at the end of the section's bullet list, never
   dropped, never refused — only the label differs, so the conductor can react
   differently: an `anchor-missing` op on a `replace` whose worker read the README this
   batch is a grammar or anchor-authoring bug to surface, not a collision to accept.
   Update the disposition vocabulary wherever it is enumerated: the aw README's ghcaj
   bullet (Ubiquitous language, the "two-op grammar" sentence), `skills/work/SKILL.md`'s
   integration step (a) and its session-end **README delta:** line (~lines 322 and 464 —
   the line that lists which dispositions get reported), and an addendum on ADR-0074.

Out of scope: any change to `append`, to the `expected` comparison, to the fallback
section behaviour, or to how workers author `anchor` (the truncate-at-first-`(`,
whitespace-collapsed rule in `references/worker-return-format.md` stays as is).

## Acceptance criteria

- [ ] `applyReadmeDelta` given a section containing a bullet whose bold lead-in closes on a
      continuation line — a fixture mirroring the infrastructure README's ADR-0013 bullet,
      first line `- **ADR-0013 — Plugin release discipline (manifest bump bound to a vX.Y.Z tag, by`
      and second line `  checklist).** …` — and a `replace` op with
      `anchor: 'ADR-0013 — Plugin release discipline'` and a correct whitespace-collapsed
      `expected` disposes `['applied']`, replaces the whole bullet extent in place, and the
      resulting content contains exactly one line matching `^- **ADR-0013`.
- [ ] The same fixture with an `expected` that does NOT match the current bullet disposes
      `['merged']` and places the body immediately after the anchored bullet's extent (not at
      the end of the section) — i.e. the wrapped head now reaches the collision branch, never
      the missing-anchor branch.
- [ ] A `replace` whose `anchor` matches no bullet in the section disposes a distinct
      disposition (`anchor-missing`, or whatever name the worker picks — but not `merged`),
      with the body still appended at the end of the section's bullet list; the existing
      test "a missing anchor (gone) is grouped with the collision family" is updated to
      assert the new label and the unchanged placement.
- [ ] Every other existing `lib/test/readme-delta.test.mjs` case passes unchanged —
      single-line heads, the tail-only multi-line extent, section isolation, `noop-already`,
      `appended-fallback`, and sequential replaces all keep their current dispositions.
- [ ] `node --test lib/test/*.test.mjs` is green (the bare-directory form finds nothing under
      Node 25 — use the glob), and `lib/readme-delta.mjs` still has zero `import` statements
      (stdlib-free, git-free, ADR-0038 layer 2).
- [ ] `skills/work/SKILL.md`'s integration step (a) and its session-end "README delta:"
      line, the aw README's ghcaj "two-op grammar" sentence, and ADR-0074 (as an addendum,
      not a rewrite) all name the new disposition; a grep for the new disposition name over
      `skills/`, `.agentheim/knowledge/` and `lib/` returns each of those files plus the
      module and its test, and nothing else.

## Notes

- Observed live and hand-worked-around on 2026-09-12 during the `work` session that
  integrated infrastructure-j3rsn: the Decisions `replace` on the ADR-0013 bullet disposed
  `merged` and would have duplicated the whole bullet; the conductor hand-spliced the j3rsn
  amendment sub-bullet in place after the w45ce sub-bullet and recorded it as Conductor
  note (2) in the "Work session ended" protocol entry of 2026-09-12 18:07. The verifier
  independently confirmed the limitation. Not auto-filed by `work` — captured here.
- The `Testing`-section `append` op in the same delta disposed `applied` cleanly, and the
  x56qm / js62b `replace` ops on single-line bullets ("Launch / Stop", "Install surface")
  disposed `applied` — the failure is specific to a wrapped term head, so the fix is local
  to `termHeadOf` and the test surface is small.
- Reproduction (no fix): run the no-`s`-flag regex against the live ADR-0013 bullet's
  29-line extent — `null`; run it against `collapseWs(text)` — match. The infrastructure
  README is CRLF on this box; the conductor feeds `applyReadmeDelta` LF-normalized content,
  so the fixture should be LF.
- Doctrine: ADR-0054 (compute-then-write — the conductor writes the returned content once,
  which is why a wrong disposition silently lands), ADR-0074 / agentic-workflow-ghcaj (the
  grammar and its monotone invariant), ADR-0038 (git-free lib module), ADR-0059
  (mechanize-or-drop — the wrapped-head property ships with its own `node --test`
  enforcement in this task), ADR-0041 (only CONSOLIDATE may reduce a README; a duplicated
  bullet is additive, but it is exactly the kind of noise that pushes a README toward the
  ~600-line consolidation trigger). pcwnn's authority rule ("never undo the other change,
  re-express your own on top") remains the rule for the genuine-collision branch only.
- Convention check (ADR-0059): the only convention-shaped element is the new disposition
  name, and it is enforced by the updated test case plus the grep criterion above — no
  "prose-only, unenforced" marker needed.
