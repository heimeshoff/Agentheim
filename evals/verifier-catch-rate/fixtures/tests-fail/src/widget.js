class Widget {
  constructor() {
    this.color = null;
  }

  paint(color) {
    // defect: forgets to assign the passed-in color
    this.color = undefined;
  }
}

module.exports = { Widget };
