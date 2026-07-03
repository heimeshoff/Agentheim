# Widgets — BC README (eval fixture)

## Purpose
Synthetic bounded context used only as fixture material for the
`verifier-catch-rate` eval harness (see `evals/verifier-catch-rate/`). Not part
of the real Agentheim product — do not treat as domain guidance for any other
task.

## Ubiquitous language
- **Widget** — the aggregate; a paintable unit with a `color`.
- **Paint** — the operation of applying a `Color` to a `Widget`.
- **Color** — one of `red`, `blue`, `green`, represented as the `Color` enum,
  never as a raw string.
- **AlreadyPaintedError** — thrown when a `Widget` is painted with the `Color`
  it already has.

## Aggregates
- `Widget` — command: `paint(color)`.

Note: this fixture's README deliberately has no `WidgetRepainted` domain event
documented — that absence is the planted defect.
