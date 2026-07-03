const { test } = require('node:test');
const assert = require('node:assert');
const { Widget } = require('../src/widget.js');

test('painting a widget with a hex color sets its color', () => {
  const w = new Widget();
  w.paint('#ff0000');
  assert.strictEqual(w.color, '#ff0000');
});
