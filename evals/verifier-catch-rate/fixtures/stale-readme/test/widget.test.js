const { test } = require('node:test');
const assert = require('node:assert');
const { Widget } = require('../src/widget.js');

test('painting a widget emits a WidgetRepainted event', () => {
  const w = new Widget();
  let seen = null;
  w.on('WidgetRepainted', (evt) => { seen = evt; });
  w.paint('red');
  assert.deepStrictEqual(seen, { color: 'red' });
});
