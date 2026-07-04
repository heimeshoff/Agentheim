# Widgets — BC README (eval fixture)

## Purpose
Synthetic bounded context used only as fixture material for the
`verifier-catch-rate` eval harness (see `evals/verifier-catch-rate/`). Not part
of the real Agentheim product — do not treat as domain guidance for any other
task.

## Ubiquitous language
- **Widget** — the aggregate; a paintable, resizable unit with a `color` and a
  `weight`.
- **Paint** — the operation of applying a `Color` to a `Widget`.
- **Resize** — the operation of changing a `Widget`'s `weight`, bounded by
  `MaxWeight`.
- **Color** — one of `red`, `blue`, `green`, represented as the `Color` enum,
  never as a raw string.
- **MaxWeight** — 100; the upper bound a `Widget`'s `weight` may reach via
  `resize`.
- **AlreadyPaintedError** — thrown when a `Widget` is painted with the `Color`
  it already has.

## Aggregates
- `Widget` — command: `paint(color)`.
