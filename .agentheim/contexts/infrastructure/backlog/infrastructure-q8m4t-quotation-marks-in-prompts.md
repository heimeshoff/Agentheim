---
id: infrastructure-q8m4t
title: Support quotation marks (Gänsefüsschen) in prompts
status: backlog
type: bug
context: infrastructure
created: 2026-06-23
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
Not stated at capture — the builder wants to be able to type quotation marks
(Gänsefüsschen) into a prompt and have them work.

## What
Be able to use Gänsefüsschen (quotation marks) in prompts.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `quick-capture` on 2026-06-23 — raw, unrefined. Needs a `modeling` refine
pass before it can be promoted.

Likely related to the prompt-passing path through the Bridge — `infrastructure-020`
("Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell")
already moved the bridge to a raw-argv `createTerminal` launch so quotes/metacharacters
survive verbatim (ADR-0018, infra-020). Refinement should check whether this is a residual
gap (e.g. German typographic quotes „ " » «, or the dashboard prompt-bar sanitizer) versus
already covered by infra-020.
