const { test } = require('node:test');
const assert = require('node:assert');
const { Widget, Color, AlreadyPaintedError } = require('../src/widget.js');

test('painting a widget sets its color', () => {
  const w = new Widget();
  w.paint(Color.RED);
  assert.strictEqual(w.color, Color.RED);
});

test('painting an already-painted widget with the same color throws AlreadyPaintedError', () => {
  const w = new Widget();
  w.paint(Color.BLUE);
  assert.throws(() => w.paint(Color.BLUE), AlreadyPaintedError);
});
