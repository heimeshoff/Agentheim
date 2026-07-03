class Widget {
  constructor() {
    // Decision, embedded with no ADR: colors are now raw hex strings, not the
    // Color enum — a clear "why not keep the enum?" choice for a future
    // maintainer, undocumented.
    this.color = null;
  }

  paint(hexColor) {
    this.color = hexColor;
  }
}

module.exports = { Widget };
