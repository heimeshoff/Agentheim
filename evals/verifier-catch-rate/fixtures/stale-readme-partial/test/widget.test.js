const { test } = require('node:test');
const assert = require('node:assert');
const { Widget, MaxWeightExceededError } = require('../src/widget.js');

test('resizing a widget within MaxWeight sets its weight', () => {
  const w = new Widget();
  w.resize(50);
  assert.strictEqual(w.weight, 50);
});

test('resizing a widget above MaxWeight throws', () => {
  const w = new Widget();
  assert.throws(() => w.resize(150), MaxWeightExceededError);
});
