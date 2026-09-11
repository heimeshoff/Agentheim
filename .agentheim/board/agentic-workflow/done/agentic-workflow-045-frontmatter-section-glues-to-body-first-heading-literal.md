---
id: agentic-workflow-045
title: Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why"
status: done
type: bug
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: bac8a0b
depends_on: [design-system-001]
blocks: []
tags: [bug, dashboard, frontmatter, markdown]
related_adrs: [0010, 0021]
related_research: []
prior_art: [agentic-workflow-043, agentic-workflow-007, agentic-workflow-027]
---

## Why
Since aw-043 folded document frontmatter into a collapsed "Front matter" section, opening a
task shows a raw `## Why` at the top of the body — the literal `##` markers instead of a
rendered heading. The first heading of every task body is swallowed, so the reader's eye
lands on un-rendered markdown exactly where it expects the document to start. Reported by the
builder: *"the two # are shown, instead of a title."*

## What
The defect is the join in `withFrontmatterSection` (`dashboard/app/frontmatter.js`):

```js
return frontmatterSection(fields) + body;
```

`frontmatterSection(...)` returns an HTML block ending in `</details>` (no trailing newline),
and `parseFrontmatter` strips the leading newline off `body`, so `body` starts immediately
with `## Why`. The concatenation produces `…</details>## Why` on a single line. marked reads
`</details>## Why` as one line *inside* the raw HTML block (a type-6 HTML block runs until a
blank line), so the body's first heading never gets a line-start and renders as literal
`## Why` text. The same transform feeds both render surfaces — the slide-over Drawer
(`slide-over.js`, ADR-0010) and the main-pane reader (`main-pane-reader.js`, ADR-0021) — so
both are affected.

The fix is to separate the section from the body with a blank line so marked closes the
`<details>` HTML block before parsing the body, e.g. `frontmatterSection(fields) + '\n\n' + body`
(only when a section is present — a document with no frontmatter must still pass through
byte-for-byte).

## Acceptance criteria
- [ ] When a document has frontmatter, `withFrontmatterSection` separates the `<details>`
      section from the body with a blank line so the body's first markdown heading renders as
      a real heading (not literal `## …` text).
- [ ] Opening a task in the slide-over Drawer shows `## Why` rendered as a heading "Why" — no
      visible `##` markers at the top of the body.
- [ ] The same holds in the main-pane reader (non-task docs whose body opens with a heading,
      e.g. a README's `# Title`, render the heading rather than literal `#`).
- [ ] A document with no frontmatter still passes through byte-for-byte (no added blank line,
      no behavioural change).
- [ ] Regression test added under `dashboard/` (node --test, alongside the existing
      frontmatter tests) asserting the separator is present and the first body heading survives.

## Notes
- Root-caused during the capture session: `frontmatter.js:146` (the join) + `frontmatter.js:86`
  (`parseFrontmatter` strips the leading `\n` off `body`, guaranteeing the glue).
- Prior art: aw-043 introduced the fold (and its tests covered `frontmatterSection` /
  `parseFrontmatter` output in isolation but not the marked-rendering integration that this
  bug lives in); aw-007 built the slide-over markdown renderer; aw-027 added the main-pane
  reader. Both surfaces share the transform (ADR-0010, ADR-0021).
- Secondary observation (out of scope for this fix, flag for refinement if it bothers the
  builder): the fold means a task no longer shows its `title` anywhere except inside the
  collapsed Front matter section — the first thing visible is now the `## Why` heading. If a
  visible title is wanted, that's a separate capture, not this bug.

## Outcome
`withFrontmatterSection` (`dashboard/app/frontmatter.js`) now separates the collapsed
`<details>` Front matter section from the stripped body with a blank line, so marked closes the
type-6 raw-HTML block before parsing the body and the body's first markdown heading renders as a
real heading instead of literal `## …` text. The fix is guarded: when there is no frontmatter the
section is empty and the body passes through byte-for-byte (no added blank line, no behavioural
change). Because both render surfaces share this single transform, the slide-over Drawer
(ADR-0010) and the main-pane reader (ADR-0021) are fixed at once — no styleguide change, no
design-system child task.

Verified end-to-end: a real `marked.parse(withFrontmatterSection(sample))` now emits
`<h2>Why</h2>` rather than literal `## Why`. Two regression tests added to
`dashboard/test/frontmatter.test.mjs` — one asserting the `</details>\n\n## Why` separator and a
line-start first heading, one asserting a no-frontmatter doc (e.g. a README opening with `# Title`)
is unchanged with no leading blank line.

Key files:
- `dashboard/app/frontmatter.js` — the join fix (empty-section guard + `'\n\n'` separator).
- `dashboard/test/frontmatter.test.mjs` — regression tests.
- `dashboard/dist/app.js` — rebuilt bundle (`node build.mjs`) so the static handler serves the fix.

Suite: 395 passing (was 393; +2 new tests).
</content>
</invoke>
