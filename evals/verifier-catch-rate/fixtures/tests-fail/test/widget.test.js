const { test } = require('node:test');
const assert = require('node:assert');
const { Widget } = require('../src/widget.js');

test('painting a widget sets its color', () => {
  const w = new Widget();
  w.paint('red');
  assert.strictEqual(w.color, 'red');
});
