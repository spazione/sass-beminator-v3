import assert from 'node:assert/strict';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('separator-fixture.scss', import.meta.url);
const prelude = (config) => `@use '../../src' as bem${config ? ` with (${config})` : ''};`;
const compile = (config, body = '') => compileScss(`${prelude(config)} ${body}`, { url });
const block = (body) => `@include bem.block('card') { ${body} }`;
const element = (body) => block(`@include bem.element('item') { ${body} }`);
const declaration = "content: 'configured';";
function selectors(css) {
  const rule = /([^{}]+)\{\s*content: "configured";\s*\}/g;
  const result = [...css.matchAll(rule)].map((match) => match[1].trim());
  assert.equal(css.replace(rule, '').trim(), '', 'Unexpected CSS');
  return result;
}
const custom = "$element-separator: '-', $modifier-separator: '_'";
const cases = [
  ['root', block(declaration), ['.card']],
  ['element', element(declaration), ['.card-item']],
  ['block modifier', block(`@include bem.modifier('active') { ${declaration} }`), ['.card_active']],
  ['element modifier and qualifier', element(`@include bem.modifier('active') { @include bem.selector(':hover') { ${declaration} } }`), ['.card-item_active:hover']],
  ['block conjunction', block(`@include bem.modifier('active', 'large') { ${declaration} }`), ['.card_active.card_large']],
  ['element conjunction', element(`@include bem.modifier('active', 'large') { ${declaration} }`), ['.card-item_active.card-item_large']],
  ['element under block modifier', block(`@include bem.modifier('active') { @include bem.element('title') { ${declaration} } }`), ['.card_active .card-title']],
  ['element under element modifier', element(`@include bem.modifier('active') { @include bem.element('title') { ${declaration} } }`), ['.card-item_active .card-title']],
  ['nested block owner', `@include bem.block('page') { ${block(`@include bem.element('title') { @include bem.modifier('large') { ${declaration} } }`)} }`, ['.page .card-title_large']],
  ['single extend and element modifier', block(`@include bem.extend('icon', 'large') { ${declaration} @include bem.element('label') { @include bem.modifier('active', 'wide') { ${declaration} } } }`), ['.card .icon_large', '.card .icon_large .icon-label_active.icon-label_wide']],
  ['double extend and compound qualifier', block(`@include bem.extend('icon', 'a', 'b') { ${declaration} @include bem.element('label') { @include bem.selector('[disabled]:hover') { ${declaration} } } }`), ['.card .icon_a.icon_b', '.card .icon_a.icon_b .icon-label[disabled]:hover']],
];
for (const [name, source, expected] of cases) {
  test(`configured separators: ${name}`, () => {
    assert.deepEqual(selectors(compile(custom, source)), expected);
  });
}
for (const relation of ['+', '>', '~']) {
  test(`configured ${relation} preserves both targets, RHS modifiers, and extend ownership`, () => {
    const branch = `@include bem.selector('${relation}') {
      @include bem.element('child') { ${declaration} @include bem.modifier('active', 'large') { ${declaration} } }
      @include bem.element('other') { ${declaration} }
    }`;
    for (const [source, scope, owner] of [
      [element(branch), '', 'card'],
      [`@include bem.block('page') { ${element(branch)} }`, '.page ', 'card'],
      [block(`@include bem.extend('icon', 'a', 'b') { @include bem.element('item') { ${branch} } }`), '.card .icon_a.icon_b ', 'icon'],
    ]) {
      assert.deepEqual(selectors(compile(custom, source)), [
        `${scope}.${owner}-item ${relation} .${owner}-child`,
        `${scope}.${owner}-item ${relation} .${owner}-child_active.${owner}-child_large`,
        `${scope}.${owner}-item ${relation} .${owner}-other`,
      ]);
    }
  });
}
test('historical reversed separators preserve extend scope and conjunction', () => {
  assert.deepEqual(selectors(compile("$element-separator: '--', $modifier-separator: '-'",
    block(`@include bem.extend('icon', 'a', 'b') { @include bem.element('item') { ${declaration} } }`))),
  ['.card .icon-a.icon-b .icon--item']);
});
for (const separator of ['_', '__', '___', '-', '--', '---', '-_', '_-', '_-_']) {
  test(`equal separators ${separator} are valid without collision detection`, () => {
    assert.deepEqual(selectors(compile(`$element-separator: '${separator}', $modifier-separator: '${separator}'`,
      element(`@include bem.modifier('active', 'large') { ${declaration} }`))),
    [`.card${separator}item${separator}active.card${separator}item${separator}large`]);
  });
}
for (const setting of ['element-separator', 'modifier-separator']) {
  test(`${setting} rejects invalid values at module load even without BEM calls`, () => {
    for (const value of ["''", "' '", "'.'", "':'", "'>'", "'__ '", "'a'", '1', 'false', "('-', '_')", '(a: b)', '()']) {
      assert.throws(() => compile(`$${setting}: ${value}`),
        new RegExp(`BEMinator: \\$${setting} must be a nonempty string containing only`));
    }
  });
  test(`Sass resolves explicit null ${setting} to !default before BEMinator validation`, () => {
    const source = element(`@include bem.modifier('active') { ${declaration} }`);
    assert.equal(compile(`$${setting}: null`, source), compile('', source));
  });
}
test('each separator can be configured independently, including unquoted Sass strings', () => {
  const source = element(`@include bem.modifier('active') { ${declaration} }`);
  assert.deepEqual(selectors(compile("$element-separator: '-'", source)), ['.card-item--active']);
  assert.deepEqual(selectors(compile('$modifier-separator: _', source)), ['.card__item_active']);
});
test('explicit defaults preserve default CSS for all construction cases', () => {
  for (const [, source] of cases) {
    assert.equal(compile("$element-separator: '__', $modifier-separator: '--'", source), compile('', source));
  }
});
test('custom separator sibling sequences and repeated roots restore parent context', () => {
  const branches = [
    `@include bem.block('icon') { @include bem.element('inner') { ${declaration} } }`,
    `@include bem.extend('icon', 'a', 'b') { @include bem.element('inner') { ${declaration} } }`,
    `@include bem.modifier('active') { @include bem.element('inner') { ${declaration} } }`,
    `@include bem.element('item') { @include bem.selector('[disabled]:hover') { ${declaration} }
      @include bem.selector('>') { @include bem.element('child') { ${declaration} } } }`,
  ];
  const expected = [ ['.card .icon-inner'], ['.card .icon_a.icon_b .icon-inner'],
    ['.card_active .card-inner'], ['.card-item[disabled]:hover', '.card-item > .card-child'] ];
  for (const order of [[0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2]]) {
    const source = block(order.map((i) => `${branches[i]} @include bem.element('after') { ${declaration} }`).join('\n')) + element(declaration);
    assert.deepEqual(selectors(compile(custom, source)),
      [...order.flatMap((i) => [...expected[i], '.card-after']), '.card-item']);
  }
});
test('configuration does not weaken nesting and selector validation', () => {
  for (const [source, error] of [
    [element('@include bem.element("bad") {}'), /element -> element/],
    [block('@include bem.modifier("a") { @include bem.modifier("b") {} }'), /modifier -> modifier/],
    [block('@include bem.extend("icon", "a") { @include bem.element("item") { @include bem.modifier("b") { @include bem.block("bad") {} } } }'), /block is forbidden beneath extend/],
    [element('@include bem.selector(":has(.x)") {}'), /functional pseudo selectors are unsupported in the current BEMinator API/],
    [element('@include bem.selector(":hover") { @include bem.selector(":focus") {} }'), /qualified -> qualified is unsupported in the current BEMinator API/],
    [element('@include bem.selector(">") { color: red; }'), /Declarations may only be used within style rules/],
  ]) assert.throws(() => compile(custom, source), error);
});
test('compiler reuse keeps independently configured modules and failed loads isolated', () => {
  const compiler = initCompiler();
  const source = element(`@include bem.modifier('active') { ${declaration} }`);
  const run = (config) => compiler.compileString(`${prelude(config)} ${source}`, { url }).css;
  try {
    assert.deepEqual(selectors(run(custom)), ['.card-item_active']);
    assert.throws(() => run("$element-separator: '.'"), /BEMinator: \$element-separator/);
    assert.deepEqual(selectors(run('')), ['.card__item--active']);
    assert.deepEqual(selectors(run(custom)), ['.card-item_active']);
  } finally { compiler.dispose(); }
});
