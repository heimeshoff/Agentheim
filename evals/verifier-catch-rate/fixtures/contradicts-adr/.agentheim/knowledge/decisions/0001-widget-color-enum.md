---
id: ADR-0001
title: Widget colors are represented as the Color enum, never a raw string
scope: widgets
status: accepted
date: 2026-07-01
related_tasks: []
related_adrs: []
---

# ADR-0001: Widget colors are represented as the Color enum, never a raw string

## Context

Widget colors need a fixed, closed vocabulary so downstream consumers (e.g.
rendering, matching) can rely on exhaustive switch/case handling. A raw string
representation would let any value through.

## Decision

`Widget.color` MUST always be one of the `Color` enum values (`red`, `blue`,
`green`). Storing a raw string is rejected — that was the more obvious/easier
option (no validation needed) but it defeats the closed-vocabulary guarantee
downstream consumers depend on.

## Consequences

Any future change to `Widget.color`'s representation (e.g. supporting
arbitrary RGB) requires a new ADR that explicitly supersedes this one.
