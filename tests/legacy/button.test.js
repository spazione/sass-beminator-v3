import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileLegacy } from '../../helpers/legacy.js';
import { setup, compile, call, block, css, comparisons, parents, minimal } from '../components/support.js';

const legacy = (body, extra = '') => compileLegacy(`${setup} ${extra} ${body.replaceAll('button.btn', 'bem.btn')}`);
const expected = JSON.parse(readFileSync(new URL('../components/fixtures/compatibility.json', import.meta.url), 'utf8'));
for (const [name, args, extra] of comparisons) {
  test(`Button live legacy comparison: ${name}`, () => {
    const body = block(call(args));
    const reference = legacy(body, extra);
    assert.equal(reference, expected[name], 'Historical evidence must not drift');
    assert.equal(css(compile(body, '', extra)), css(reference));
  });
}
for (const [name, parent] of parents.filter(([name]) => ['block', 'modifier', 'qualified', 'extend'].includes(name))) {
  test(`legacy parent comparison: ${name}`, () => {
    assert.equal(css(compile(parent(call()), '', minimal)), css(legacy(parent(call()), minimal)));
  });
}
test('legacy and v3 custom element separator comparison', () => {
  assert.equal(css(compile(block(call()), "with ($element-separator: '-')")),
    css(legacy(block(call()), "bem.$element-separator: '-';")));
});
