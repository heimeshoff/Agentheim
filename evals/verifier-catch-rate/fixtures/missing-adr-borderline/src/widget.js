const HISTORY_LIMIT = 5;

class Widget {
  constructor() {
    this.color = null;
    this.paintHistory = [];
  }

  paint(color) {
    this.color = color;
    this.paintHistory.push(color);
    if (this.paintHistory.length > HISTORY_LIMIT) {
      this.paintHistory.shift();
    }
  }
}

module.exports = { Widget, HISTORY_LIMIT };
