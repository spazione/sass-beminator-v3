import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('signature-fixture.scss', import.meta.url);
function modifier(args, element = false) {
  const call = `@include bem.modifier(${args}) { content: 'value'; }`;
  return compileScss(`@use '../../src' as bem;
    @include bem.block('page') {
      @include bem.block('card') {
        ${element ? `@include bem.element('title') { ${call} }` : call}
      }
    }`, { url });
}
for (const [label, args, positional, suffix] of [
  ['named mod1, omitted mod2', "$mod1: 'active'", "'active'", '--active'],
  ['named mod1, explicit null mod2', "$mod1: 'active', $mod2: null", "'active'", '--active'],
  ['named mod1 and mod2', "$mod1: 'active', $mod2: 'large'", "'active', 'large'", '--active'],
  ['positional null equals omitted second modifier', "'active', null", "'active'", '--active'],
]) {
  test(`modifier signature: ${label}`, () => {
    for (const element of [false, true]) {
      const actual = modifier(args, element);
      const subject = element ? '.card__title' : '.card';
      const compound = args.includes("'large'") ? `${subject}--active${subject}--large` : `${subject}${suffix}`;
      assert.equal(actual, `.page ${compound} {\n  content: "value";\n}`);
      assert.equal(actual, modifier(positional, element));
    }
  });
}
test('obsolete v3-only modifier keywords have no compatibility aliases', () => {
  for (const args of ["$name: 'active'", "$name: 'active', $second: 'large'", "$mod1: 'active', $second: 'large'", "'active', $second: 'large'"]) {
    assert.throws(() => modifier(args), /Missing argument \$mod1|No parameter named \$second/);
  }
});
test('named empty second modifier remains invalid; null is the only absent-value sentinel', () => {
  assert.throws(() => modifier("$mod1: 'active', $mod2: ''"), /expected a nonempty literal BEM name/);
});
test('extend retains name, mod1, and optional null mod2 keyword signature', () => {
  const compile = (args) => compileScss(`@use '../../src' as bem;
    @include bem.block('card') {
      @include bem.extend(${args}) { content: 'value'; }
    }`, { url });
  for (const [named, positional, expected] of [
    ["$name: 'icon', $mod1: 'active'", "'icon', 'active'", '.card .icon--active'],
    ["$name: 'icon', $mod1: 'active', $mod2: null", "'icon', 'active'", '.card .icon--active'],
    ["$name: 'icon', $mod1: 'active', $mod2: 'large'", "'icon', 'active', 'large'", '.card .icon--active.icon--large'],
  ]) {
    assert.equal(compile(named), `${expected} {\n  content: "value";\n}`);
    assert.equal(compile(named), compile(positional));
  }
});
