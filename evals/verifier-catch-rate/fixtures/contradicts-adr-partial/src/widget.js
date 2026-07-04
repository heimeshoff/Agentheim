const COLORS = new Set(['red', 'blue', 'green']);

class InvalidColorError extends Error {}

class Widget {
  constructor() {
    this.color = null;
  }

  paint(color) {
    if (!COLORS.has(color)) {
      throw new InvalidColorError(`${color} is not a valid Color`);
    }
    this.color = color;
  }

  paintOrFallback(color, fallbackRaw) {
    try {
      this.paint(color);
    } catch (err) {
      if (err instanceof InvalidColorError) {
        // Fallback: keep the pipeline moving with whatever raw value the
        // upstream integration sent, rather than dropping the record.
        this.color = fallbackRaw;
        return;
      }
      throw err;
    }
  }
}

module.exports = { Widget, InvalidColorError };
