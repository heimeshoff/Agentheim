# Widgets — BC README (eval fixture)

## Purpose
Synthetic bounded context used only as fixture material for the
`verifier-catch-rate` eval harness (see `evals/verifier-catch-rate/`). Not part
of the real Agentheim product — do not treat as domain guidance for any other
task.

## Ubiquitous language
- **Widget** — the aggregate; a paintable unit with a `color`.
- **Paint** — the operation of applying a `Color` to a `Widget`.
- **PaintHistory** — the ordered sequence of `Color`s a `Widget` has been
  painted, oldest first; downstream analytics reads it to compute repaint
  frequency.
- **Color** — one of `red`, `blue`, `green`.
- **AlreadyPaintedError** — thrown when a `Widget` is painted with the `Color`
  it already has.

## Aggregates
- `Widget` — command: `paint(color)`.
