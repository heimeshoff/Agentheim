// Introduces a new, undocumented domain term: "Lacquering" (and the
// "Strategy" pattern name) — neither appears in the BC README's
// Ubiquitous language section.
class WidgetLacqueringStrategy {
  apply(widget, color) {
    widget.color = color;
  }
}

class Widget {
  constructor() {
    this.color = null;
    this.lacqueringStrategy = new WidgetLacqueringStrategy();
  }

  paint(color) {
    this.lacqueringStrategy.apply(this, color);
  }
}

module.exports = { Widget, WidgetLacqueringStrategy };
