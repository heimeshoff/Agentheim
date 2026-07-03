const Color = Object.freeze({ RED: 'red', BLUE: 'blue', GREEN: 'green' });

class AlreadyPaintedError extends Error {
  constructor(color) {
    super(`Widget is already painted ${color}`);
    this.name = 'AlreadyPaintedError';
  }
}

class Widget {
  constructor() {
    this.color = null;
  }

  paint(color) {
    if (!Object.values(Color).includes(color)) {
      throw new TypeError(`paint() requires a Color enum value, got ${color}`);
    }
    if (this.color === color) {
      throw new AlreadyPaintedError(color);
    }
    this.color = color;
  }
}

module.exports = { Widget, Color, AlreadyPaintedError };
