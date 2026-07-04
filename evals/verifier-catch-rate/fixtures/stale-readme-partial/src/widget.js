const MAX_WEIGHT = 100;

class MaxWeightExceededError extends Error {}

class Widget {
  constructor() {
    this.color = null;
    this.weight = 0;
  }

  paint(color) {
    this.color = color;
  }

  resize(weight) {
    if (weight > MAX_WEIGHT) {
      throw new MaxWeightExceededError(`weight ${weight} exceeds MaxWeight (${MAX_WEIGHT})`);
    }
    this.weight = weight;
  }
}

module.exports = { Widget, MaxWeightExceededError, MAX_WEIGHT };
