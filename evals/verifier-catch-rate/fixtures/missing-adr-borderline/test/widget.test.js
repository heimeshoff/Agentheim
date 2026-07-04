const { test } = require('node:test');
const assert = require('node:assert');
const { Widget } = require('../src/widget.js');

test('paint appends to paintHistory', () => {
  const w = new Widget();
  w.paint('red');
  w.paint('blue');
  assert.deepStrictEqual(w.paintHistory, ['red', 'blue']);
});

test('paintHistory keeps only the 5 most recent colors', () => {
  const w = new Widget();
  const colors = ['red', 'blue', 'green', 'red', 'blue', 'green', 'red'];
  for (const c of colors) w.paint(c);
  assert.deepStrictEqual(w.paintHistory, colors.slice(-5));
});
