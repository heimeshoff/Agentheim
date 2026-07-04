const { test } = require('node:test');
const assert = require('node:assert');
const { Widget, InvalidColorError } = require('../src/widget.js');

test('paint throws InvalidColorError for a value outside the Color enum', () => {
  const w = new Widget();
  assert.throws(() => w.paint('not-an-enum-value'), InvalidColorError);
});

test('paintOrFallback paints normally when color is valid', () => {
  const w = new Widget();
  w.paintOrFallback('red', 'unused');
  assert.strictEqual(w.color, 'red');
});

test('paintOrFallback stores the raw fallback value when color is invalid', () => {
  const w = new Widget();
  w.paintOrFallback('not-an-enum-value', '#ff0000-from-upstream');
  assert.strictEqual(w.color, '#ff0000-from-upstream');
});
