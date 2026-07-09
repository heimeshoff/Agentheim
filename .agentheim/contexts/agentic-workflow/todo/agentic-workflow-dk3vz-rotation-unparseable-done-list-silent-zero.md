---
id: agentic-workflow-dk3vz
title: rotateIndexDoneList reads an unparseable done-list as empty — silent {ok:true, liveEntries:0}
status: todo
type: bug
context: agentic-workflow
created: 2026-07-09
completed:
depends_on: []
blocks: []
tags: [index, rotation, cap-and-roll, bookkeeping, silent-failure, fail-closed]
related_adrs: [0038, 0039, 0041, 0047]
related_research: []
prior_art: [agentic-workflow-c8j3w, agentic-workflow-d4q7f, agentic-workflow-v8n3t]
---

## Why

`parseDoneListEntries` (`lib/index-rotation.mjs`) skips any non-blank done-list line that doesn't
match `ENTRY_LINE` — deliberately loss-tolerant per line, so one malformed entry never aborts a
rotation. That tolerance is right for *skipping* a line and wrong for every other use it currently
gets put to. It has three faces, all confirmed against `main` at refinement time:

**Face 1 — the silent zero.** When *no* line matches (a project whose done-list is written in any
other shape), `rotateIndexDoneList` returns `{ok:true, rotated:false, liveEntries:0}` —
indistinguishable from a genuinely empty list. The cap can never fire for that project, and the
manifest actively asserts everything is fine, so the ADR-0047 session-end check surfaces nothing.

Field report (WisdomHeim vault, 2026-07-09, plugin ~0.8.x): all four BCs reported `liveEntries: 0`,
including one with six done tasks recorded as markdown-link lines.

**Face 2 — the rewrite-time drop.** On a done-list that is *partially* parseable and over cap, a
firing rotation rebuilds the block from `keptEntries` only (`:237-242`) — every unmatched non-blank
line is silently deleted from the live `INDEX.md` and lands in no archive file. Per-line
loss-tolerance is fine for skipping; it is not fine once the block gets *rewritten* around the
skipped lines.

**Face 3 — one bad BC aborts the others, after they have already written.** Found at refinement, and
the reason the fix's shape is not cosmetic. `parseDoneListEntries` *throws* when the done-list
markers are missing (deliberate, pinned by a test), but `rotateAllIndexDoneLists` (`:288`) calls
`rotateIndexDoneList` in a bare loop with no `try`/`catch`, over BCs in sorted order. So if
`agentic-workflow` rotates successfully — writing a rewritten `INDEX.md` and a new
`done-archive/2026-06.md` — and then `design-system` throws on missing markers, the throw escapes,
the manifest is lost, and `work`'s session-end step sees a non-zero exit. Its prose
(`skills/work/SKILL.md`, "INDEX done-list rotation check", step 1) then says to *"treat a non-zero
exit / `ok:false` as a soft failure: change nothing"* — so the already-written rotation is left on
disk, uncommitted and unmentioned. This is the same partial-mutation shape as the sibling bug
`agentic-workflow-wq7fn` (throws *after* `applyTaskMove` has moved files), one layer up.

Face 3 constrains face 1's fix: **if the unparseable signal surfaces as a top-level `ok:false` /
non-zero exit, it fires exactly that "change nothing" branch** and strands any healthy BC's rotation
from the same run. Hence the per-BC signal below, decided with the builder.

## What

Distinguish "empty" from "unparseable", never rewrite a block containing lines the parser didn't
understand, and never let one BC's malformed index abort or strand another's.

The discriminator is safe: a genuinely empty done-list in this repo is literally zero non-blank
lines between the markers (verified across all three BCs), so *"has non-blank lines, matched none"*
separates unparseable from empty with no false positive on a fresh BC.

### The decided contract

Refuse whenever the answer would be **wrong** or the rewrite would be **destructive**; report but
proceed when the list is merely dirty and no rewrite is pending.

```
ok:false  ⟸  (parsed === 0 && nonBlank > 0)          # face 1 — the cap question is unanswerable
          ||  (unmatched > 0 && rotation would fire)  # face 2 — the rewrite would drop lines
          ||  (done-list markers missing)             # face 3 — was an uncaught throw
```

1. **Per-BC `ok:false`; the top level stays `ok:true`.** A refusing BC gets
   `{ok:false, code, context, reason}` inside `contexts[<bc>]` and **writes nothing**. The top-level
   manifest stays `{ok:true, ...}`, `runCli` still exits `0`, and top-level `changed` still lists
   every *healthy* BC's rotation — so `work` commits those and reports the refusal, rather than
   stranding them. This preserves ADR-0038's invariant that `ok:false` means nothing was written,
   and reuses the family's existing `{ok:false, code, reason}` vocabulary rather than inventing a
   `warnings` channel (there is no precedent for one anywhere in `lib/`).

   Codes: `unparseable-done-list` (faces 1 and 2, `reason` distinguishing them) and
   `missing-done-list-markers` (face 3).

2. **Partial parse under cap is reported, not fatal.** When unmatched non-blank lines exist but no
   rotation would fire, the BC returns `{ok:true, rotated:false, liveEntries:N, unmatched:K}` — the
   builder learns about the malformed line *before* it becomes a blocked rotation.

3. **Face 3: catch per BC.** `rotateAllIndexDoneLists` wraps its per-BC `rotateIndexDoneList` call in
   `try`/`catch`, converting a throw into that BC's `{ok:false, code:'missing-done-list-markers'}`.
   `parseDoneListEntries` keeps throwing (its existing test stays green); only the caller changes.

4. **`work` must surface it.** The refusal is worthless if the session-end check swallows it. Today
   step 2 says `rotated:false` → *"nothing to do... silent no-op is correct"*, which would swallow
   both a per-BC `ok:false` and an `unmatched > 0` report.

### Accepted consequence

A BC whose done-list stays malformed refuses to rotate on **every** session and its live list grows
past the cap until a human fixes the line. That is the fail-closed trade, taken knowingly: it is
loud every session, and the alternative (carrying unmatched lines through the rewrite) cannot
preserve their position — an unmatched line has no `completed:` date, so no month, so it can only
stay in the live block while the entries that surrounded it roll away. Verbatim in bytes, not in
order. Refusing is the simpler and more honest contract, and matches ADR-0038's posture.

## Acceptance criteria

- [ ] A done-list block with non-blank lines and zero `ENTRY_LINE` matches no longer yields a bare
      `{ok:true, rotated:false, liveEntries:0}`. That BC returns `{ok:false,
      code:'unparseable-done-list', context, reason}` naming the BC, and writes nothing.
- [ ] A partially parseable done-list **over cap** loses no line: that BC refuses with the same
      `unparseable-done-list` code and writes nothing — no `INDEX.md` rewrite, no archive file. A
      test pins that the unmatched line is still present in `INDEX.md` afterwards.
- [ ] A partially parseable done-list **under cap** returns `{ok:true, rotated:false, liveEntries:N,
      unmatched:K}` with `K > 0` — reported, not fatal, nothing written.
- [ ] `rotateAllIndexDoneLists` no longer propagates a per-BC throw: a BC with missing done-list
      markers yields `contexts[<bc>] = {ok:false, code:'missing-done-list-markers', ...}` while every
      other BC still rotates normally. A test pins that a *healthy* BC sorted **before** a
      marker-less one still rotates, still appears in top-level `changed`, and its files are on disk
      — the stranding scenario from face 3.
- [ ] The top-level manifest stays `{ok:true, ...}` and `runCli` still exits `0` when one or more
      BCs refuse; top-level `changed` contains only the healthy BCs' paths. A test pins the exit
      code, because a non-zero exit is what re-triggers `work`'s "change nothing" branch.
- [ ] `parseDoneListEntries`' existing signature and its two existing tests are unchanged (it still
      returns an entry array, and still throws on missing markers). Counting unmatched/non-blank
      lines is additive.
- [ ] `skills/work/SKILL.md`'s "INDEX done-list rotation check" documents how the new signal is
      handled: after the `rotated` branches, iterate `contexts` and surface, in the end-of-run
      summary, every BC with `ok === false` (naming BC + `code` + `reason`) and every BC with
      `unmatched > 0`. Explicitly: a refusal never blocks the session and never prevents committing
      the healthy BCs' `changed` paths. Step 2's "silent no-op is correct" is narrowed so it applies
      only when no BC refused and no BC reported unmatched lines.
- [ ] ADR-0047 gains an in-place `## Amendment` recording the third manifest branch (per-BC refusal)
      and the narrowed no-op — its "Mechanics" section names the old two-branch shape verbatim. Use
      the in-place-amendment precedent ADR-0050 set (`p8k4d` / `m3vhq`), **not** a new ADR; the
      decision here refines a stated rule rather than establishing a new one.
- [ ] Existing suite (`node --test lib/test/*.test.mjs`) stays green.

## Notes

- **Suggested shape, not mandated.** Add a `parseDoneList(content) → {entries, unmatched, nonBlank}`
  and reduce `parseDoneListEntries` to a thin wrapper returning `.entries`. That keeps the existing
  export and both its tests untouched while giving `rotateIndexDoneList` the counts it needs.
- The blank-line skip stays as-is. So does the single-malformed-line skip when the rest of the block
  parses and no rotation fires — that path now merely *reports* via `unmatched`. The defect was never
  per-line tolerance itself; it was the aggregate silent zero, the rewrite-time drop, and the
  uncaught throw.
- `ENTRY_LINE` is `/^- \*\*([^*]+)\*\* .+ \`done\/([^\`]+)\`\r?$/`. The vault's markdown-link shape
  (`- [id](done/x.md) — title`) has no `**`, so it matches nothing — that is face 1's trigger.
- Watch the current-month rule when writing the face-2 test: `rotateIndexDoneList` only rewrites
  after `rolledMonths.length > 0`, and the current (newest) month is never rolled. An over-cap
  fixture therefore needs at least two months present, or no rotation fires and the test proves
  nothing.
- Only `lib/index-rotation.mjs`, `lib/test/index-rotation.test.mjs` and `skills/work/SKILL.md`
  reference these functions — checked at refinement, there is no other caller to break.
- Sibling bug: `agentic-workflow-wq7fn` — the same fail-closed / partial-mutation theme in
  `lib/task-lifecycle.mjs`. Independent (different file, different call path); no `depends_on` edge.
- Origin record: `infrastructure-nvrz0` in the WisdomHeim vault's `.agentheim/` (transplanted here
  2026-07-09 after verifying against `main`). Faces 1 and 2 came from that report; face 3 was found
  at refinement by reading `rotateAllIndexDoneLists`.
