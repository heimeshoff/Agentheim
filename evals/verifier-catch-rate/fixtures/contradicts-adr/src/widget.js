class Widget {
  constructor() {
    this.color = null;
  }

  paint(color) {
    // Violates ADR-0001: stores whatever raw string is passed in, not the
    // Color enum.
    this.color = String(color);
  }
}

module.exports = { Widget };
