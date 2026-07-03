const { EventEmitter } = require('node:events');

class Widget extends EventEmitter {
  constructor() {
    super();
    this.color = null;
  }

  paint(color) {
    this.color = color;
    // New domain event, introduced by this diff, not reflected in the README.
    this.emit('WidgetRepainted', { color });
  }
}

module.exports = { Widget };
